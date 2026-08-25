// ─────────────────────────────────────────────────────────────────────────────
// relationships.js — compute a person's parents / spouses / children.
//
// Two data sources are combined, override-first:
//   1. family-overrides.json — manual parent links the user creates in the tree,
//      keyed by the WORKING-DB record id (e.g. the curated MySQL `people` rows).
//   2. GEDCOM data — the imported Ancestry/Geni tree. Only useful for people whose
//      working-DB record id also appears in gedcom-map.json (most curated people
//      do NOT, so overrides are the primary source for them).
//
// Kept as a pure module (no I/O, no server deps) so it can be unit-tested against
// the real gedcom-data.json / gedcom-map.json fixtures.
// ─────────────────────────────────────────────────────────────────────────────

function extractYear(s) {
  if (!s) return '';
  const m = String(s).match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  return m ? m[1] : '';
}

function childRelationLabel(sex) {
  const s = (sex || '').toLowerCase();
  if (s.startsWith('m')) return 'Son';
  if (s.startsWith('f')) return 'Daughter';
  return 'Child';
}

// Build fast lookups from the raw gedcom map + data JSON.
//   map  : { gedcomId → recordId }
//   data : { individuals:[{id,name,sex,birthDate,deathDate,famcId,famsIds}], families:[{id,husb,wife,children}], rootId }
function buildGedcomIndex(map, data) {
  const reverseMap = {};                       // recordId → gedcomId
  for (const [gid, rid] of Object.entries(map || {})) reverseMap[rid] = gid;

  const indiByGedcomId = {};                   // gedcomId → full individual
  for (const indi of (data.individuals || [])) indiByGedcomId[indi.id] = indi;

  const famById = {};                          // familyId → family
  for (const fam of (data.families || [])) famById[fam.id] = fam;

  return {
    map:      map || {},
    reverseMap,
    indiByGedcomId,
    famById,
    families: data.families || [],
    rootId:   data.rootId   || null,
  };
}

// Build a display ref for a related person, preferring the working-DB record
// (so the card can link to their profile) and falling back to GEDCOM details.
function relRef(recordId, gedcomId, relation, peopleById, gedcom) {
  let id = null, name = '', birthYear = '', deathYear = '', sex = '', photoUrl = '', inDb = false;

  if (recordId && peopleById[recordId]) {
    const p = peopleById[recordId];
    id = recordId; inDb = true;
    name      = p.name || '';
    birthYear = extractYear(p.birthDate);
    deathYear = extractYear(p.deathDate);
    sex       = p.sex || '';
    photoUrl  = p.photoUrl || '';
  }

  if (gedcomId && gedcom && gedcom.indiByGedcomId[gedcomId]) {
    const indi = gedcom.indiByGedcomId[gedcomId];
    if (!name)      name      = indi.name || '';
    if (!birthYear) birthYear = extractYear(indi.birthDate);
    if (!deathYear) deathYear = extractYear(indi.deathDate);
    if (!sex)       sex       = indi.sex || '';
    // If this GEDCOM person maps to a working-DB record, allow linking to it.
    if (!id && gedcom.map[gedcomId] && peopleById[gedcom.map[gedcomId]]) {
      id = gedcom.map[gedcomId]; inDb = true;
    }
  }

  return {
    id,
    gedcomId: gedcomId || null,
    name: name || 'Unknown',
    birthYear, deathYear, sex, photoUrl,
    relation, inDb,
  };
}

// Canonical de-dupe key for a related person (DB id if we have one, else gedcomId).
function refKey(ref) { return ref.id || ref.gedcomId || ref.name; }

// Compute { parents, spouses, children } for a working-DB person.
//   recordId   : the person's working-DB record id
//   peopleById : { recordId → { name, birthDate, deathDate, sex, photoUrl } }
//   gedcom     : result of buildGedcomIndex (or null when no GEDCOM loaded)
//   overrides  : { childRecordId → { fatherId, motherId } }
function computeRelationships(recordId, peopleById, gedcom, overrides) {
  peopleById = peopleById || {};
  overrides  = overrides  || {};

  const parents = [], spouses = [], children = [];
  const seenP = new Set(), seenS = new Set(), seenC = new Set();

  const gedcomId = gedcom ? gedcom.reverseMap[recordId] : null;
  const rev = (rid) => (gedcom ? gedcom.reverseMap[rid] : null) || null;

  const ov = overrides[recordId];

  // ── Parents ── override first, GEDCOM fills the gaps ──────────────────────
  if (ov && ov.fatherId) {
    parents.push(relRef(ov.fatherId, rev(ov.fatherId), 'Father', peopleById, gedcom));
    seenP.add(ov.fatherId);
  }
  if (ov && ov.motherId) {
    parents.push(relRef(ov.motherId, rev(ov.motherId), 'Mother', peopleById, gedcom));
    seenP.add(ov.motherId);
  }
  if (gedcom && gedcomId) {
    const indi = gedcom.indiByGedcomId[gedcomId];
    const fam  = indi && indi.famcId ? gedcom.famById[indi.famcId] : null;
    if (fam) {
      if (fam.husb && !(ov && ov.fatherId)) parents.push(relRef(gedcom.map[fam.husb], fam.husb, 'Father', peopleById, gedcom));
      if (fam.wife && !(ov && ov.motherId)) parents.push(relRef(gedcom.map[fam.wife], fam.wife, 'Mother', peopleById, gedcom));
    }
  }

  // ── Children + spouses derived from overrides (reverse lookup) ────────────
  // A child C with override {fatherId, motherId} means: this person is a parent
  // of C, and the OTHER listed parent is a spouse / co-parent.
  for (const [childId, o] of Object.entries(overrides)) {
    if (!o) continue;
    const isFather = o.fatherId === recordId;
    const isMother = o.motherId === recordId;
    if (!isFather && !isMother) continue;

    if (!seenC.has(childId)) {
      const c = relRef(childId, rev(childId), 'Child', peopleById, gedcom);
      c.relation = childRelationLabel(c.sex);
      children.push(c); seenC.add(childId);
    }

    const spouseId = isFather ? o.motherId : o.fatherId;
    if (spouseId && !seenS.has(spouseId)) {
      spouses.push(relRef(spouseId, rev(spouseId), 'Spouse', peopleById, gedcom));
      seenS.add(spouseId);
    }
  }

  // ── Spouses + children from GEDCOM families this person is a spouse in ─────
  if (gedcom && gedcomId) {
    const indi = gedcom.indiByGedcomId[gedcomId];
    for (const famId of (indi && indi.famsIds ? indi.famsIds : [])) {
      const fam = gedcom.famById[famId];
      if (!fam) continue;

      const spouseGid = fam.husb === gedcomId ? fam.wife : fam.husb;
      if (spouseGid) {
        const s = relRef(gedcom.map[spouseGid], spouseGid, 'Spouse', peopleById, gedcom);
        const k = refKey(s);
        if (!seenS.has(k)) { spouses.push(s); seenS.add(k); }
      }

      for (const cGid of (fam.children || [])) {
        const c = relRef(gedcom.map[cGid], cGid, 'Child', peopleById, gedcom);
        c.relation = childRelationLabel(c.sex);
        const k = refKey(c);
        if (!seenC.has(k)) { children.push(c); seenC.add(k); }
      }
    }
  }

  return { parents, spouses, children };
}

module.exports = { buildGedcomIndex, computeRelationships, extractYear, childRelationLabel };
