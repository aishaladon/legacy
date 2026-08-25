const BASE_URL = 'https://api.airtable.com/v0';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function baseUrl() {
  return `${BASE_URL}/${process.env.AIRTABLE_BASE_ID}`;
}

// ── Table name constants (matching your actual Airtable) ──────────────────────
const TABLES = {
  PEOPLE:            'People',
  QUESTIONS:         'Research Questions',
  SOURCES:           'Sources',
  EVIDENCE:          'Evidence Analysis',
  DNA_TESTING:       'DNA Testing',
  DNA_MATCHES:       'DNA Matches',
  COLLECTIONS:       'Collections',
  ARCHIVES:          'Archives',
  DONORS:            'Donors',
  STORAGE:           'Storage',
  RESEARCH_LOG:      'Research Log',
};

// ── Fetch all records from a table (handles pagination) ───────────────────────
async function fetchAll(tableName, params = {}) {
  const records = [];
  let offset = null;

  do {
    const query = new URLSearchParams();
    if (offset) query.set('offset', offset);
    Object.entries(params).forEach(([k, v]) => query.set(k, v));

    const url = `${baseUrl()}/${encodeURIComponent(tableName)}?${query}`;
    const res  = await fetch(url, { headers: headers() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));

    records.push(...(data.records || []).map(r => ({ id: r.id, _createdTime: r.createdTime, ...r.fields })));
    offset = data.offset || null;
  } while (offset);

  return records;
}

// ── Create a record ───────────────────────────────────────────────────────────
async function createRecord(tableName, fields) {
  const url = `${baseUrl()}/${encodeURIComponent(tableName)}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify({ fields, typecast: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return { id: data.id, ...data.fields };
}

// ── Fetch single record ────────────────────────────────────────────────────────
async function fetchOne(tableName, id) {
  const url = `${baseUrl()}/${encodeURIComponent(tableName)}/${id}`;
  const res  = await fetch(url, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return { id: data.id, ...data.fields };
}

// ── People (formerly Ancestors) ───────────────────────────────────────────────
async function getAllAncestors() {
  return fetchAll(TABLES.PEOPLE);
}

async function getAncestorById(id) {
  return fetchOne(TABLES.PEOPLE, id);
}

async function saveAncestor(data) {
  if (!data.name) return null;

  // Check if a person with this name already exists — prevent duplicates
  const existing = await fetchAll(TABLES.PEOPLE, {
    filterByFormula: `LOWER({Full Name ★}) = "${data.name.toLowerCase().replace(/"/g, '\\"')}"`,
  });
  if (existing.length > 0) {
    console.log(`Skipping duplicate person: "${data.name}" already exists.`);
    return existing[0];
  }

  const fields = {};
  fields['Full Name ★'] = data.name;
  if (data.birthYear) fields['Birth Date']  = String(data.birthYear);
  if (data.location)  fields['Birth Place'] = data.location;
  if (data.notes)     fields['Notes']       = data.notes;
  return createRecord(TABLES.PEOPLE, fields);
}

// ── Fetch a batch of records by their IDs ─────────────────────────────────────
async function fetchByIds(tableName, ids = []) {
  if (!ids.length) return [];
  // Airtable supports OR(RECORD_ID()="id1", RECORD_ID()="id2", ...)
  const formula = ids.length === 1
    ? `RECORD_ID()="${ids[0]}"`
    : `OR(${ids.map(id => `RECORD_ID()="${id}"`).join(',')})`;
  return fetchAll(tableName, { filterByFormula: formula });
}

// ── Research Questions ────────────────────────────────────────────────────────
async function getAllQuestions() {
  return fetchAll(TABLES.QUESTIONS);
}

async function getQuestionsByAncestor(ancestorId, ancestorRecord) {
  const ids = ancestorRecord?.['Research Questions'] || [];
  return fetchByIds(TABLES.QUESTIONS, ids);
}

// ── Sources ───────────────────────────────────────────────────────────────────
async function getSourcesByAncestor(ancestorId, ancestorRecord) {
  const ids = ancestorRecord?.['Sources'] || [];
  return fetchByIds(TABLES.SOURCES, ids);
}

async function saveSource(sourceData) {
  const fields = {
    'Name ★': sourceData.name || 'Untitled',
  };
  return createRecord(TABLES.SOURCES, fields);
}

// ── Evidence Analysis ─────────────────────────────────────────────────────────
async function getEvidenceByAncestor(ancestorId, ancestorRecord) {
  const ids = ancestorRecord?.['Evidence Analysis'] || [];
  return fetchByIds(TABLES.EVIDENCE, ids);
}

// ── DNA Testing ───────────────────────────────────────────────────────────────
async function getDNATestingByAncestor(ancestorId, ancestorRecord) {
  const ids = ancestorRecord?.['DNA Tests'] || [];
  return fetchByIds(TABLES.DNA_TESTING, ids);
}

// ── DNA Matches ───────────────────────────────────────────────────────────────
async function getDNAMatchesByAncestor(ancestorId, ancestorRecord) {
  const ids = ancestorRecord?.['DNA Matches'] || [];
  return fetchByIds(TABLES.DNA_MATCHES, ids);
}

// ── Collections ───────────────────────────────────────────────────────────────
async function getAllCollections() {
  return fetchAll(TABLES.COLLECTIONS);
}

// ── Archives ──────────────────────────────────────────────────────────────────
async function getAllArchives() {
  return fetchAll(TABLES.ARCHIVES);
}

async function saveArchive(data) {
  const fields = {};

  // ── Accession Number (primary key) ──────────────────────────────────────────
  // Auto-generate if not provided: ARCH-YYYYMMDD-XXXX
  const accNum = data.accessionNumber || data['Accession Number ★'] ||
    `ARCH-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;
  fields['Accession Number ★'] = accNum;

  // ── Core fields (mapped from AI metadata or manual entry) ───────────────────
  if (data.date)           fields['Inclusive Dates']   = data.date;
  if (data.condition)      fields['Condition']         = data.condition;
  if (data.location)       fields['Box/Folder Reference'] = data.location;
  if (data.extent)         fields['Extent']            = data.extent;

  // ── Build description from title + description + creator + tags ──────────────
  {
    const descParts = [];
    if (data.title)                                        descParts.push(data.title);
    if (data.description && data.description !== data.title) descParts.push(data.description);
    if (data.creator)                                      descParts.push(`Creator: ${data.creator}`);
    if (data.tags)                                         descParts.push(`Tags: ${data.tags}`);
    if (descParts.length) fields['Description'] = descParts.join(' — ');
  }

  // ── Accession Date (passed from client = today, or fallback to today) ─────────
  const today = new Date().toISOString().slice(0, 10);
  fields['Accession Date'] = data.accessionDate || today;

  // ── Formats Included (multipleSelects) ──────────────────────────────────────
  // Only write values that exist as valid select options in Airtable.
  // AI can return arbitrary strings — map keywords to valid options, discard rest.
  if (data.format) {
    // Exact option names in Airtable (do not modify — these must match exactly)
    // NOTE: 'Digital Files ' has a trailing space — this must match Airtable exactly
    const VALID_FORMATS = new Set([
      'Photocopies','Photographs','Correspondence','Legal Docs','Microfilm',
      '35mm Slides','Digital Files ','Obituaries','Newspapers',
    ]);
    const formatMap = {
      'photograph':'Photographs','photo':'Photographs','image':'Photographs',
      'scan':'Photographs','picture':'Photographs','portrait':'Photographs',
      'photocopy':'Photocopies','copy':'Photocopies','duplicate':'Photocopies',
      'xerox':'Photocopies',
      'letter':'Correspondence','correspondence':'Correspondence',
      'email':'Correspondence','memo':'Correspondence',
      'legal':'Legal Docs','deed':'Legal Docs','will':'Legal Docs','probate':'Legal Docs',
      'court':'Legal Docs','contract':'Legal Docs','certificate':'Legal Docs',
      'microfilm':'Microfilm','microfiche':'Microfilm',
      '35mm':'35mm Slides','slide':'35mm Slides','transparency':'35mm Slides',
      'digital':'Digital Files ','file':'Digital Files ','document':'Digital Files ',
      'record':'Digital Files ','pdf':'Digital Files ','spreadsheet':'Digital Files ',
      'obituary':'Obituaries','death notice':'Obituaries',
      'newspaper':'Newspapers','clipping':'Newspapers','article':'Newspapers',
    };
    const raw = String(data.format).toLowerCase().trim();
    let mapped = null;
    // Direct match first
    for (const [keyword, value] of Object.entries(formatMap)) {
      if (raw.includes(keyword)) { mapped = value; break; }
    }
    // If mapped value is valid, use it; otherwise skip entirely
    if (mapped && VALID_FORMATS.has(mapped)) {
      fields['Formats Included'] = [mapped];
    }
    // (format info is still saved in AI Metadata JSON below)
  }

  // ── New fields ───────────────────────────────────────────────────────────────
  if (data.imageUrl)    fields['Image URL']   = data.imageUrl;
  if (data.aiMetadata)  fields['AI Metadata'] = typeof data.aiMetadata === 'object'
    ? JSON.stringify(data.aiMetadata, null, 2)
    : String(data.aiMetadata);

  return createRecord(TABLES.ARCHIVES, fields);
}

// ── Save Research Question ────────────────────────────────────────────────────
async function saveQuestion(data, ancestorId) {
  const fields = {};
  if (data.question) fields['Research Question ★'] = data.question;
  if (data.answer)   fields['Current Conclusion']  = data.answer;
  if (ancestorId)    fields['People']              = [ancestorId];
  return createRecord(TABLES.QUESTIONS, fields);
}

// ── Save Research Log entry ───────────────────────────────────────────────────
async function saveResearchLog(data) {
  const fields = {};
  if (data.title)    fields['Log Title ★']    = data.title;
  if (data.personId) fields['Person']          = [data.personId];
  if (data.status)   fields['Research Status'] = data.status;
  if (data.notes)    fields['Notes']           = data.notes;
  return createRecord(TABLES.RESEARCH_LOG, fields);
}

// ── Save DNA Match ────────────────────────────────────────────────────────────
async function saveDNAMatch(data, ancestorId) {
  const fields = {};
  if (data.name)              fields['Match Name ★']          = data.name;
  if (data.relationship)      fields['Predicted Relationship'] = data.relationship;
  if (data.sharedCm != null)  fields['Shared cM']             = Number(data.sharedCm) || undefined;
  if (data.details)           fields['Notes']                 = data.details;
  if (ancestorId)             fields['Linked Person in Tree'] = [ancestorId];
  // Remove undefined values
  Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);
  return createRecord(TABLES.DNA_MATCHES, fields);
}

// ── Generic record update (for CRUD edit modal) ───────────────────────────────
async function updateAnyRecord(tableName, id, fields) {
  return updateRecord(tableName, id, fields);
}

// ── Generic record delete ─────────────────────────────────────────────────────
async function deleteAnyRecord(tableName, id) {
  return deleteRecord(tableName, id);
}

// ── Generic record create (for CRUD add modal) ────────────────────────────────
async function createAnyRecord(tableName, fields) {
  return createRecord(tableName, fields);
}

// ── Fetch schema for a table (field names) ────────────────────────────────────
async function getTableFields(tableName) {
  // Fetch one record to infer field names
  const records = await fetchAll(tableName, { maxRecords: 1 });
  if (!records.length) return [];
  return Object.keys(records[0]).filter(k => k !== 'id');
}

// ── All Sources (direct fetch, no per-ancestor loop) ─────────────────────────
async function getAllSources() {
  return fetchAll(TABLES.SOURCES);
}

// ── Research Log ─────────────────────────────────────────────────────────────
async function getAllResearchLog() {
  const entries = await fetchAll(TABLES.RESEARCH_LOG);
  // Sort newest-first so dashboard slice(0,10) returns the most recent entries
  return entries.sort((a, b) => new Date(b._createdTime || 0) - new Date(a._createdTime || 0));
}

// ── All DNA records (direct fetch) ───────────────────────────────────────────
async function getAllDNATesting() {
  return fetchAll(TABLES.DNA_TESTING);
}

async function getAllDNAMatches() {
  return fetchAll(TABLES.DNA_MATCHES);
}

// ── Donors ────────────────────────────────────────────────────────────────────
async function getAllDonors() {
  return fetchAll(TABLES.DONORS);
}

// ── Storage ───────────────────────────────────────────────────────────────────
async function getAllStorage() {
  return fetchAll(TABLES.STORAGE);
}

// ── Research Log (by ancestor) ────────────────────────────────────────────────
async function getResearchLogByAncestor(ancestorId, ancestorRecord) {
  const ids = ancestorRecord?.['Research Log'] || [];
  return fetchByIds(TABLES.RESEARCH_LOG, ids);
}

// ── Full profile ──────────────────────────────────────────────────────────────
async function getAncestorProfile(ancestorId) {
  // Fetch the person first so we can use their linked record IDs
  const ancestor = await getAncestorById(ancestorId);

  const archiveIds     = ancestor?.['Archives']     || [];
  const collectionIds  = ancestor?.['Collections']  || [];
  const researchLogIds = ancestor?.['Research Log'] || [];

  const [questions, sources, evidence, dnaTests, dnaMatches, archives, collections, researchLog] =
    await Promise.all([
      getQuestionsByAncestor(ancestorId, ancestor),
      getSourcesByAncestor(ancestorId, ancestor),
      getEvidenceByAncestor(ancestorId, ancestor),
      getDNATestingByAncestor(ancestorId, ancestor),
      getDNAMatchesByAncestor(ancestorId, ancestor),
      fetchByIds(TABLES.ARCHIVES, archiveIds),
      fetchByIds(TABLES.COLLECTIONS, collectionIds),
      fetchByIds(TABLES.RESEARCH_LOG, researchLogIds),
    ]);

  return {
    ancestor,
    questions,
    sources,
    evidence,
    dnaTests,
    dnaMatches,
    archives,
    collections,
    researchLog,
  };
}

// ── Dashboard counts ──────────────────────────────────────────────────────────
async function getDashboardCounts() {
  const [people, questions, archives, collections, dnaTests, dnaMatches] = await Promise.all([
    fetchAll(TABLES.PEOPLE),
    fetchAll(TABLES.QUESTIONS),
    fetchAll(TABLES.ARCHIVES),
    fetchAll(TABLES.COLLECTIONS),
    fetchAll(TABLES.DNA_TESTING),
    fetchAll(TABLES.DNA_MATCHES),
  ]);

  return {
    ancestorsCount:  people.length,
    questionsCount:  questions.length,
    archivesCount:   archives.length + collections.length,
    dnaCount:        dnaTests.length + dnaMatches.length,
    recentAncestors: people.slice(0, 6),
  };
}

// ── Delete a record ───────────────────────────────────────────────────────────
async function deleteRecord(tableName, id) {
  const url = `${baseUrl()}/${encodeURIComponent(tableName)}/${id}`;
  const res  = await fetch(url, { method: 'DELETE', headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return data;
}

// ── Update a record ───────────────────────────────────────────────────────────
async function updateRecord(tableName, id, fields) {
  const url = `${baseUrl()}/${encodeURIComponent(tableName)}/${id}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: headers(),
    body:    JSON.stringify({ fields, typecast: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return { id: data.id, ...data.fields };
}

// ── Merge two people: copy non-empty fields from duplicate into primary, then delete duplicate ──
async function mergeAncestors(keepId, deleteId) {
  const [primary, duplicate] = await Promise.all([
    fetchOne(TABLES.PEOPLE, keepId),
    fetchOne(TABLES.PEOPLE, deleteId),
  ]);

  // Build a patch of fields the primary is missing but the duplicate has
  const patch = {};
  const skipFields = new Set(['id', 'Person ID', 'Full Name ★']);

  for (const [field, value] of Object.entries(duplicate)) {
    if (skipFields.has(field)) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === null || value === undefined || value === '') continue;
    // Only fill in if primary field is empty / missing
    const primaryVal = primary[field];
    const isEmpty = primaryVal === null || primaryVal === undefined || primaryVal === '' ||
                    (Array.isArray(primaryVal) && primaryVal.length === 0);
    if (isEmpty) patch[field] = value;
  }

  if (Object.keys(patch).length > 0) {
    await updateRecord(TABLES.PEOPLE, keepId, patch);
  }

  await deleteRecord(TABLES.PEOPLE, deleteId);
  return { kept: keepId, deleted: deleteId, fieldsMerged: Object.keys(patch) };
}

// ── Search all tables ─────────────────────────────────────────────────────────
async function searchAll(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();

  // Fetch every table in parallel
  const tableList = [
    { key: 'People',            label: 'Person',           table: TABLES.PEOPLE      },
    { key: 'Research Questions',label: 'Research Question',table: TABLES.QUESTIONS   },
    { key: 'Sources',           label: 'Source',           table: TABLES.SOURCES     },
    { key: 'Evidence Analysis', label: 'Evidence',         table: TABLES.EVIDENCE    },
    { key: 'DNA Testing',       label: 'DNA Testing',      table: TABLES.DNA_TESTING },
    { key: 'DNA Matches',       label: 'DNA Match',        table: TABLES.DNA_MATCHES },
    { key: 'Collections',       label: 'Collection',       table: TABLES.COLLECTIONS },
    { key: 'Archives',          label: 'Archive',          table: TABLES.ARCHIVES    },
    { key: 'Donors',            label: 'Donor',            table: TABLES.DONORS      },
    { key: 'Storage',           label: 'Storage',          table: TABLES.STORAGE     },
  ];

  const fetched = await Promise.all(
    tableList.map(t => fetchAll(t.table).catch(() => []))
  );

  const results = [];

  fetched.forEach((records, i) => {
    const { label, key } = tableList[i];
    records.forEach(record => {
      // Search every field value as a string
      const matched = Object.entries(record).some(([field, value]) => {
        if (field === 'id') return false;
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(q));
        }
        return String(value).toLowerCase().includes(q);
      });

      if (matched) {
        // Find the best display name for this record
        const name =
          record['Full Name ★'] ||
          record['Name ★'] ||
          record['Name'] ||
          record['Title'] ||
          record['Research Question ★'] ||
          record['Research Question'] ||
          Object.values(record).find(v => typeof v === 'string' && v.length > 0) ||
          record.id;

        // Collect matching field snippets for context
        const snippets = Object.entries(record)
          .filter(([field, value]) => {
            if (field === 'id') return false;
            if (Array.isArray(value)) return value.some(v => String(v).toLowerCase().includes(q));
            return typeof value === 'string' && value.toLowerCase().includes(q);
          })
          .slice(0, 3)
          .map(([field, value]) => {
            const val = Array.isArray(value) ? value.join(', ') : String(value);
            return `${field}: ${val.substring(0, 120)}`;
          });

        results.push({
          id:       record.id,
          table:    key,
          type:     label,
          name:     String(name).substring(0, 120),
          snippets,
        });
      }
    });
  });

  return results;
}

// ── Update Research Question Status ──────────────────────────────────────────
async function updateQuestionStatus(questionId, status) {
  const url = `${baseUrl()}/${encodeURIComponent(TABLES.QUESTIONS)}/${questionId}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: headers(),
    body:    JSON.stringify({ fields: { Status: status } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return { id: data.id, ...data.fields };
}

module.exports = {
  searchAll,
  deleteRecord,
  mergeAncestors,
  saveQuestion,
  saveDNAMatch,
  updateAnyRecord,
  deleteAnyRecord,
  createAnyRecord,
  getTableFields,
  getAllQuestions,
  TABLES,
  getAllAncestors,
  getAncestorById,
  getAncestorProfile,
  getQuestionsByAncestor,
  getSourcesByAncestor,
  getEvidenceByAncestor: getEvidenceByAncestor,
  getDNATestingByAncestor,
  getDNAMatchesByAncestor,
  getAllArchives,
  getAllCollections,
  getAllDonors,
  getAllStorage,
  getAllSources,
  getAllDNATesting,
  getAllDNAMatches,
  getAllResearchLog,
  getResearchLogByAncestor,
  saveSource,
  saveAncestor,
  saveArchive,
  saveResearchLog,
  updateQuestionStatus,
  getDashboardCounts,
  getFamilyTreeData,
};

// ── Family Tree ────────────────────────────────────────────────────────────────
async function getFamilyTreeData() {
  const records = await fetchAll(TABLES.PEOPLE);
  return records.map(r => {
    // Generation Number is a singleSelect string in Airtable ('0','1','2',…)
    const genRaw = r['Generation Number'];
    const generation = (genRaw !== null && genRaw !== undefined)
      ? parseInt(genRaw) : null;

    return {
      id:         r.id,
      name:       r['Full Name ★'] || 'Unknown',
      birthDate:  r['Birth Date']  || '',
      deathDate:  r['Death Date']  || '',
      birthPlace: r['Birth Place'] || '',
      sex:        r['Sex']         || '',
      generation,
      relation:   r['Relation to Self'] || '',
      line:       r['Line']        || '',
      photoUrl:   r['Photo URL']   || '',
      _createdTime: r._createdTime || '',
    };
  });
}
