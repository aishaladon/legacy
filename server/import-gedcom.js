#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   GEDCOM Importer  ·  Krio Griot

   Parses a GEDCOM 5.5.1 file and imports all individuals into the Airtable
   People table. Saves relationship maps used by the Family Tree visualisation.

   Outputs (in server/):
     gedcom-map.json   — { "@Ixxxxxxx@": "recABCD...", ... }
     gedcom-data.json  — full parsed GEDCOM (individuals + families)

   Usage:
     node server/import-gedcom.js [/path/to/file.ged]

   Default file path:
     ~/Desktop/Dixon, Redmond & Queen, Daggs & Hill.ged
══════════════════════════════════════════════════════════════════════════════ */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs   = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────

const DEFAULT_GED = path.join(
  process.env.HOME || '/Users/aishaladon',
  'Desktop',
  'Dixon, Redmond & Queen, Daggs & Hill.ged'
);

const GED_FILE  = process.argv[2] || DEFAULT_GED;
const MAP_FILE  = path.join(__dirname, 'gedcom-map.json');
const DATA_FILE = path.join(__dirname, 'gedcom-data.json');

// ── Airtable config ──────────────────────────────────────────────────────────

const BASE_URL = 'https://api.airtable.com/v0';
const BASE_ID  = process.env.AIRTABLE_BASE_ID || 'app8m4USNF5opdXBp';
const API_KEY  = process.env.AIRTABLE_API_KEY;
const TABLE    = 'People';

if (!API_KEY) {
  console.error('❌  AIRTABLE_API_KEY not set in .env');
  process.exit(1);
}

// ── GEDCOM Parser ─────────────────────────────────────────────────────────────

/**
 * Strip GEDCOM name delimiters:  "First /Last/"  →  "First Last"
 */
function cleanName(raw) {
  return raw.replace(/\//g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse a GEDCOM 5.5.1 file.
 * Returns { rootId, individuals: { "@Ixx@": {...} }, families: { "@Fxx@": {...} } }
 */
function parseGedcom(filePath) {
  console.log(`\n📂  Reading ${filePath} …`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split(/\r?\n/);
  console.log(`📄  ${lines.length.toLocaleString()} lines`);

  const individuals = {};
  const families    = {};
  let firstIndiId   = null; // track the very first INDI (tree subject)

  let curIndi  = null;
  let curFam   = null;
  let curEvent = null; // 'BIRT' | 'DEAT' | 'MARR'
  let inNote   = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ── Parse: LEVEL [XREF] TAG [VALUE] ─────────────────────────────────────
    const firstSpace = line.indexOf(' ');
    if (firstSpace < 0) continue;
    const level = parseInt(line.slice(0, firstSpace), 10);
    if (isNaN(level)) continue;

    const rest = line.slice(firstSpace + 1);
    let xref = null, tag = '', value = '';

    // Check if the first token after level is a cross-reference (@X@)
    if (rest.startsWith('@')) {
      const closeAt = rest.indexOf('@', 1);
      if (closeAt > 0) {
        const candidate = rest.slice(0, closeAt + 1);
        if (/^@[A-Z0-9_@]+@$/i.test(candidate)) {
          xref = candidate;
          const afterXref = rest.slice(closeAt + 1).trim();
          const sp2 = afterXref.indexOf(' ');
          if (sp2 < 0) { tag = afterXref; value = ''; }
          else          { tag = afterXref.slice(0, sp2); value = afterXref.slice(sp2 + 1); }
        }
      }
    }
    if (!xref) {
      // No xref — tag is the first token, rest is value
      const sp2 = rest.indexOf(' ');
      if (sp2 < 0) { tag = rest; value = ''; }
      else          { tag = rest.slice(0, sp2); value = rest.slice(sp2 + 1); }
    }

    // ── Level 0: start a new record ──────────────────────────────────────────
    if (level === 0) {
      curEvent = null;
      inNote   = false;

      if (xref && tag === 'INDI') {
        if (!firstIndiId) firstIndiId = xref;
        curIndi = {
          id        : xref,
          name      : '',
          sex       : 'U',
          birthDate : '',
          birthPlace: '',
          deathDate : '',
          deathPlace: '',
          famcId    : null,  // family where this person is a child
          famsIds   : [],    // families where this person is a spouse
          noteText  : '',
        };
        individuals[xref] = curIndi;
        curFam = null;
        continue;
      }

      if (xref && tag === 'FAM') {
        curFam = {
          id           : xref,
          husb         : null,
          wife         : null,
          children     : [],
          marriageDate : '',
          marriagePlace: '',
        };
        families[xref] = curFam;
        curIndi = null;
        continue;
      }

      curIndi = null;
      curFam  = null;
      continue;
    }

    // ── Level 1 ──────────────────────────────────────────────────────────────
    if (level === 1) {
      curEvent = null;
      inNote   = false;

      if (curIndi) {
        switch (tag) {
          case 'NAME':
            if (!curIndi.name && value) curIndi.name = cleanName(value);
            break;
          case 'SEX':
            curIndi.sex = (value || '').trim().toUpperCase().slice(0, 1) || 'U';
            break;
          case 'BIRT': curEvent = 'BIRT'; break;
          case 'DEAT': curEvent = 'DEAT'; break;
          case 'FAMC':
            // Only take the first FAMC (primary family)
            if (!curIndi.famcId) curIndi.famcId = (value || '').trim();
            break;
          case 'FAMS':
            if (value) curIndi.famsIds.push(value.trim());
            break;
          case 'NOTE':
            inNote = true;
            if (value && !curIndi.noteText) {
              curIndi.noteText = value.slice(0, 600);
            }
            break;
        }
      }

      if (curFam) {
        switch (tag) {
          case 'HUSB': if (value) curFam.husb = value.trim(); break;
          case 'WIFE': if (value) curFam.wife = value.trim(); break;
          case 'CHIL': if (value) curFam.children.push(value.trim()); break;
          case 'MARR': curEvent = 'MARR'; break;
        }
      }
      continue;
    }

    // ── Level 2 ──────────────────────────────────────────────────────────────
    if (level === 2) {
      // Note continuation
      if (inNote && curIndi && (tag === 'CONT' || tag === 'CONC')) {
        if (curIndi.noteText.length < 600) {
          const sep = (tag === 'CONT') ? '\n' : '';
          curIndi.noteText += sep + value.slice(0, 600 - curIndi.noteText.length);
        }
        continue;
      }
      // Any non-CONT/CONC tag at level 2 ends the note
      if (tag !== 'CONT' && tag !== 'CONC') inNote = false;

      if (curEvent === 'BIRT' && curIndi) {
        if (tag === 'DATE') curIndi.birthDate  = value;
        if (tag === 'PLAC') curIndi.birthPlace = value;
      } else if (curEvent === 'DEAT' && curIndi) {
        if (tag === 'DATE') curIndi.deathDate  = value;
        if (tag === 'PLAC') curIndi.deathPlace = value;
      } else if (curEvent === 'MARR' && curFam) {
        if (tag === 'DATE') curFam.marriageDate  = value;
        if (tag === 'PLAC') curFam.marriagePlace = value;
      }
      continue;
    }

    // ── Level 3+ note continuations ──────────────────────────────────────────
    if (level >= 3 && inNote && curIndi && (tag === 'CONT' || tag === 'CONC')) {
      if (curIndi.noteText.length < 600) {
        const sep = (tag === 'CONT') ? '\n' : '';
        curIndi.noteText += sep + value.slice(0, 600 - curIndi.noteText.length);
      }
    }
  }

  const indiCount = Object.keys(individuals).length;
  const famCount  = Object.keys(families).length;
  console.log(`✅  Parsed ${indiCount.toLocaleString()} individuals, ${famCount.toLocaleString()} families`);

  return { rootId: firstIndiId, individuals, families };
}

// ── Airtable helpers ──────────────────────────────────────────────────────────

function atHeaders() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch ALL records from the People table (handles pagination).
 * Returns array of { id, 'Full Name ★', ... }
 */
async function fetchAllPeople() {
  const records = [];
  let offset = null;
  do {
    const query = new URLSearchParams();
    if (offset) query.set('offset', offset);
    query.set('fields[]', 'Full Name ★');
    query.set('fields[]', 'Notes');

    const url = `${BASE_URL}/${BASE_ID}/${encodeURIComponent(TABLE)}?${query}`;
    const res  = await fetch(url, { headers: atHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));

    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);
  return records;
}

/**
 * Batch-create up to 10 records at once.
 * Returns the created records array from Airtable.
 */
async function batchCreate(fieldsList) {
  const url = `${BASE_URL}/${BASE_ID}/${encodeURIComponent(TABLE)}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: atHeaders(),
    body:    JSON.stringify({
      records:  fieldsList.map(f => ({ fields: f })),
      typecast: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return data.records;
}

// ── Sex normalisation ─────────────────────────────────────────────────────────

function normSex(s) {
  if (s === 'M') return 'Male';
  if (s === 'F') return 'Female';
  return 'Unknown';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Parse the GEDCOM file
  const { rootId, individuals, families } = parseGedcom(GED_FILE);

  // 2. Save full parsed data (used by the family tree API endpoint)
  const gedData = {
    rootId,
    individuals: Object.values(individuals),
    families:    Object.values(families),
    parsedAt:    new Date().toISOString(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(gedData));
  console.log(`💾  Parsed data saved → ${path.basename(DATA_FILE)}`);

  // 3. Load existing GEDCOM→Airtable map (for resumable imports)
  let map = {};
  if (fs.existsSync(MAP_FILE)) {
    try {
      map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
      const n = Object.keys(map).length;
      if (n > 0) console.log(`🗂   Existing map loaded: ${n.toLocaleString()} entries (will skip these)`);
    } catch (_) { map = {}; }
  }

  // 4. Fetch existing Airtable people (for name-based deduplication)
  console.log('\n🔍  Fetching existing Airtable people for deduplication…');
  const existingRecords = await fetchAllPeople();
  console.log(`    Found ${existingRecords.length.toLocaleString()} existing records`);

  // Build two lookup structures from existing records:
  // a) Name (lowercase) → airtableId  (for name-dedup)
  // b) GEDCOM ID (from Notes field) → airtableId  (for re-import detection)
  const nameToId  = {};
  const gedcToId  = {}; // "GEDCOM: @Ixx@" → airtableId

  for (const rec of existingRecords) {
    const name  = (rec.fields?.['Full Name ★'] || '').toLowerCase().trim();
    const notes = rec.fields?.['Notes'] || '';
    if (name) nameToId[name] = rec.id;

    // Parse "GEDCOM: @Ixxxxxxx@" from the Notes field
    const m = notes.match(/GEDCOM:\s*(@[A-Z0-9_@]+@)/i);
    if (m) gedcToId[m[1]] = rec.id;
  }

  // 5. Determine which GEDCOM individuals still need to be imported
  const indiList = Object.values(individuals);
  const toImport = [];
  let skippedMap = 0, skippedName = 0, skippedGedc = 0;

  for (const indi of indiList) {
    // Skip if already in our local map from a previous run
    if (map[indi.id]) { skippedMap++; continue; }

    // Skip if the Notes field already contains this GEDCOM ID (previous import)
    if (gedcToId[indi.id]) {
      map[indi.id] = gedcToId[indi.id];
      skippedGedc++;
      continue;
    }

    // Skip if a record with the exact same name already exists
    const lc = indi.name.toLowerCase();
    if (lc && nameToId[lc]) {
      map[indi.id] = nameToId[lc];
      skippedName++;
      continue;
    }

    toImport.push(indi);
  }

  console.log(`\n📥  Import plan:`);
  console.log(`    ${toImport.length.toLocaleString()} new people to create`);
  console.log(`    ${skippedMap.toLocaleString()} already in local map`);
  console.log(`    ${skippedGedc.toLocaleString()} matched by GEDCOM ID in Notes`);
  console.log(`    ${skippedName.toLocaleString()} matched by name (deduped)`);

  if (toImport.length === 0) {
    fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
    console.log(`\n✅  Nothing new to import. Map saved → ${path.basename(MAP_FILE)}`);
    return;
  }

  // 6. Batch-import in groups of 10
  const BATCH = 10;
  const batches = [];
  for (let i = 0; i < toImport.length; i += BATCH) {
    batches.push(toImport.slice(i, i + BATCH));
  }

  console.log(`\n📦  ${batches.length} batches × ${BATCH} records`);
  console.log(`    (Rate-limited to 5 req/s — estimated ${Math.ceil(batches.length * 0.22)}s)\n`);

  let imported = 0, errors = 0;
  const startTime = Date.now();

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];

    const fieldsList = batch.map(indi => {
      const fields = {};
      fields['Full Name ★'] = indi.name || 'Unknown';
      if (indi.birthDate)   fields['Birth Date']  = indi.birthDate;
      if (indi.birthPlace)  fields['Birth Place'] = indi.birthPlace;
      if (indi.deathDate)   fields['Death Date']  = indi.deathDate;
      if (indi.deathPlace)  fields['Death Place'] = indi.deathPlace;
      if (indi.sex !== 'U') fields['Sex']         = normSex(indi.sex);

      // Store GEDCOM ID in Notes for traceability + future re-import detection
      let notes = `GEDCOM: ${indi.id}`;
      if (indi.noteText && indi.noteText.trim()) {
        notes += '\n\n' + indi.noteText.trim().slice(0, 800);
      }
      fields['Notes'] = notes;
      return fields;
    });

    try {
      const created = await batchCreate(fieldsList);
      created.forEach((rec, i) => {
        map[batch[i].id] = rec.id;
        imported++;
      });

      // Save map after every batch for crash-resumability
      fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));

      const pct     = Math.round(((b + 1) / batches.length) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(
        `\r  ${String(pct).padStart(3)}%  [${b + 1}/${batches.length}]` +
        `  ${imported.toLocaleString()} imported  ${errors} errors  ${elapsed}s   `
      );

    } catch (err) {
      errors++;
      // Log but continue — partial failure shouldn't abort everything
      process.stdout.write('\n');
      console.error(`  ⚠️   Batch ${b + 1} failed: ${err.message}`);
    }

    // Rate limit: max 5 req/sec → at least 200ms between calls
    if (b < batches.length - 1) await sleep(220);
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n🎉  Import complete in ${totalSec}s`);
  console.log(`    ${imported.toLocaleString()} people created`);
  if (errors > 0) console.log(`    ⚠️   ${errors} batch errors (check output above)`);
  console.log(`\n🗺   Map saved → ${path.basename(MAP_FILE)}`);
  console.log(`📊  Data saved → ${path.basename(DATA_FILE)}`);
  console.log(`\n✨  Restart the server and open Family Tree to see all ${Object.keys(map).length.toLocaleString()} people.\n`);
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
