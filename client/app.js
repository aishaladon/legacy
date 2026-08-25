const state = {
  chatHistory:        [],
  currentResearch:    '',
  parsedFindings:     [],
  currentMetadata:    null,
  currentImageB64:    null,
  currentImageType:   null,
  bulkQueue:          [],
  bulkResults:        [],
  previousPage:       'dashboard',
  ancestorCache:      {},
  selectedCategories: [], // empty = all
  selectedLocations:  [], // location filter for research
  researchName:       '',  // last ancestor name researched (for research log)
  // Modal state
  modalTable:         null,
  modalRecordId:      null,
  modalFields:        [],
};

// ── Database categories (mirrors server/anthropic.js) ─────────────────────────
const DB_CATEGORIES = {
  slavery:      { label: 'Slavery & Freedmen'          },
  census:       { label: 'Census & Voter Lists'         },
  vitals:       { label: 'Birth, Marriage & Death'      },
  military:     { label: 'Military'                     },
  newspapers:   { label: 'Newspapers & Periodicals'     },
  immigration:  { label: 'Immigration & Travel'         },
  dna:          { label: 'DNA & Genetic Genealogy'      },
  international:{ label: 'International & Colonial'     },
  state:        { label: 'State & Regional Archives'    },
  university:   { label: 'University & Specialized'     },
  trees:        { label: 'Public Trees & Collaborative' },
};

// ── Location data for "Research by Location" ─────────────────────────────────
const LOCATION_DATA = {
  usa: {
    regions: [
      { name: 'New England',
        places: ['Connecticut','Maine','Massachusetts','New Hampshire','Rhode Island','Vermont'] },
      { name: 'Mid-Atlantic',
        places: ['Delaware','Maryland','New Jersey','New York','Pennsylvania','Washington D.C.'] },
      { name: 'South — Primary Research Zone',
        places: ['Alabama','Arkansas','Florida','Georgia','Kentucky','Louisiana','Mississippi',
                 'North Carolina','South Carolina','Tennessee','Virginia','West Virginia'] },
      { name: 'Midwest',
        places: ['Illinois','Indiana','Iowa','Kansas','Michigan','Minnesota','Missouri',
                 'Nebraska','North Dakota','Ohio','South Dakota','Wisconsin'] },
      { name: 'Southwest',
        places: ['Arizona','New Mexico','Oklahoma','Texas'] },
      { name: 'West',
        places: ['Alaska','California','Colorado','Hawaii','Idaho','Montana',
                 'Nevada','Oregon','Utah','Washington','Wyoming'] },
      { name: 'Territories & Insular Areas',
        places: ['Puerto Rico','U.S. Virgin Islands','Guam','American Samoa'] },
    ],
  },
  africa: {
    regions: [
      { name: 'Senegambia & Upper Guinea  ·  Major slave-trade origin',
        places: ['Senegal','Gambia','Guinea-Bissau','Guinea','Sierra Leone','Liberia'] },
      { name: 'Gold Coast & Slave Coast  ·  Major slave-trade origin',
        places: ['Ghana','Togo','Benin','Nigeria','Ivory Coast'] },
      { name: 'Bight of Biafra  ·  Major slave-trade origin',
        places: ['Cameroon','Equatorial Guinea','Gabon','Republic of Congo'] },
      { name: 'West Central Africa / Kongo Kingdom  ·  Largest origin region',
        places: ['DR Congo','Angola','São Tomé & Príncipe','Cape Verde'] },
      { name: 'East & Southern Africa  ·  Indian Ocean slave trade',
        places: ['Mozambique','Tanzania','Kenya','Madagascar','South Africa','Zimbabwe'] },
    ],
  },
  colonial: {
    regions: [
      { name: 'Primary Slaveholding Powers  ·  Largest archival holdings',
        places: ['Portugal','Britain / England','France','Spain','Netherlands'] },
      { name: 'Secondary Colonial Powers',
        places: ['Denmark-Norway','Sweden','Brandenburg-Prussia'] },
      { name: 'Receiving Nations & Colonial Destinations',
        places: ['Brazil','Cuba','Haiti / Saint-Domingue','Jamaica',
                 'Barbados','Trinidad','Suriname'] },
    ],
  },
};

let activeLocTab = 'usa';

function initLocationSelector() {
  Object.entries(LOCATION_DATA).forEach(([tabKey, tabData]) => {
    const grid = document.getElementById(`loc-grid-${tabKey}`);
    if (!grid) return;
    grid.innerHTML = tabData.regions.map(region => `
      <div class="loc-region">
        <div class="loc-region-label">${escHtml(region.name)}</div>
        <div class="loc-chips">
          ${region.places.map(place => {
            const id = locChipId(tabKey, place);
            return `<button class="loc-chip" id="${id}" data-place="${escHtml(place)}" onclick="toggleLocation(this.dataset.place)">${escHtml(place)}</button>`;
          }).join('')}
        </div>
      </div>`).join('');
  });
}

function locChipId(tab, place) {
  return `loc-${tab}-${place.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function setLocTab(key, btn) {
  activeLocTab = key;
  document.querySelectorAll('.loc-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  Object.keys(LOCATION_DATA).forEach(k => {
    const grid = document.getElementById(`loc-grid-${k}`);
    if (grid) grid.style.display = (k === key) ? '' : 'none';
  });
}

function toggleLocation(place) {
  const idx = state.selectedLocations.indexOf(place);
  // Find chip across all tabs
  let chip = null;
  for (const tabKey of Object.keys(LOCATION_DATA)) {
    chip = document.getElementById(locChipId(tabKey, place));
    if (chip) break;
  }
  if (idx > -1) {
    state.selectedLocations.splice(idx, 1);
    if (chip) chip.classList.remove('selected');
  } else {
    state.selectedLocations.push(place);
    if (chip) chip.classList.add('selected');
  }
  updateLocationDisplay();
}

function clearLocationFilter() {
  state.selectedLocations = [];
  document.querySelectorAll('.loc-chip.selected').forEach(c => c.classList.remove('selected'));
  updateLocationDisplay();
}

function updateLocationDisplay() {
  const bar  = document.getElementById('loc-selected-bar');
  const text = document.getElementById('loc-selected-text');
  if (!bar || !text) return;
  if (state.selectedLocations.length === 0) {
    bar.style.display = 'none';
  } else {
    bar.style.display = '';
    text.textContent  = state.selectedLocations.join(' · ');
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
const loadedPages = new Set(); // track which pages have already loaded data

function showPage(pageId, forceReload = false) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');

  const navBtn = document.querySelector(`[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Only load data once unless forceReload is set
  const loaders = {
    dashboard:          loadDashboard,
    'family-tree':      loadFamilyTree,
    ancestors:          loadAncestors,
    'research-log':     loadResearchLog,
    questions:          loadQuestions,
    sources:            loadSources,
    dna:                loadDNA,
    archives:           loadArchivesPage,
    'profile-settings': loadProfileSettings,
    'upgrade-plan':     loadUpgradePlan,
    'help-page':        () => {},  // static — no load needed
  };

  if (loaders[pageId] && (!loadedPages.has(pageId) || forceReload)) {
    loadedPages.add(pageId);
    loaders[pageId]();
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    state.previousPage = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
    showPage(page);
  });
});

function goBack() {
  showPage(state.previousPage || 'ancestors');
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('kg_token'); }

function logout() {
  localStorage.removeItem('kg_token');
  localStorage.removeItem('kg_user');
  window.location.href = '/login';
}

// Guard: redirect to login if no token
(function checkAuth() {
  if (!getToken()) window.location.href = '/login';
})();

// Show logged-in user name in sidebar if element exists
(function showUser() {
  const stored = localStorage.getItem('kg_user');
  if (!stored) return;
  try {
    const user = JSON.parse(stored);
    const el = document.getElementById('sidebar-user-name');
    if (el) el.textContent = user.name || user.email;
  } catch (_) {}
})();

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (res.status === 401) {
    logout();
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Global center-screen notification toast ───────────────────────────────────
const _TOAST_ICONS = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};
let _toastTimer = null;
function showToast(message, type = 'success') {
  let t = document.getElementById('global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'global-toast';
    document.body.appendChild(t);
  }
  t.className = `toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${_TOAST_ICONS[type] || _TOAST_ICONS.info}</span><span class="toast-msg">${message}</span>`;
  clearTimeout(_toastTimer);
  t.classList.remove('toast-show');
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('toast-show')));
  _toastTimer = setTimeout(() => t.classList.remove('toast-show'), type === 'error' ? 6000 : 3200);
}

function showAlert(containerId, message, type = 'success') {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => { el.innerHTML = ''; }, 5000);
  }
  showToast(message, type);
}

// ── Pagination helpers ────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;
const _pgState  = {};   // tableName → current page number

function _pg(key) { return _pgState[key] || 1; }

function _pgSlice(items, key) {
  const p = _pg(key);
  const total = items.length;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  const cur = Math.min(p, pages);
  _pgState[key] = cur;
  return { slice: items.slice((cur-1)*PAGE_SIZE, cur*PAGE_SIZE), page: cur, pages, total };
}

function _pgBarHtml(key, page, pages, total) {
  if (pages <= 1) return '';
  const start = (page-1)*PAGE_SIZE + 1;
  const end   = Math.min(page*PAGE_SIZE, total);
  return `<div class="pagination-bar">
    <button ${page<=1?'disabled':''} onclick="_pgNav('${key}',-1)">← Prev</button>
    <span class="pg-info">${start}–${end} of ${total}</span>
    <button ${page>=pages?'disabled':''} onclick="_pgNav('${key}',1)">Next →</button>
  </div>`;
}

function _pgNav(key, dir) {
  _pgState[key] = (_pgState[key] || 1) + dir;
  const rerenders = {
    'People':             renderAncestorsTable,
    'Research Log':       () => { loadedPages.delete('research-log'); showPage('research-log'); },
    'Research Questions': renderQuestionsPage,
    'Sources':            renderSourcesPage,
    'DNA Testing':        () => renderDNAPage(allDNATestingCache, allDNAMatchesCache),
    'DNA Matches':        () => renderDNAPage(allDNATestingCache, allDNAMatchesCache),
  };
  if (rerenders[key]) rerenders[key]();
}

// ── Search ────────────────────────────────────────────────────────────────────
let searchDebounceTimer = null;
let currentFilter       = 'all';
let lastSearchResults   = [];
let lastArchiveResults  = null;

function handleSearchInput() {
  clearTimeout(searchDebounceTimer);
  const q = document.getElementById('search-input').value.trim();
  if (!q) { clearSearch(); return; }
  searchDebounceTimer = setTimeout(runSearch, 400);
}

async function runSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (q.length < 2) return;

  const resultsEl  = document.getElementById('search-results');
  const headerEl   = document.getElementById('search-results-header');
  const listEl     = document.getElementById('search-results-list');
  const defaultEl  = document.getElementById('dashboard-default');
  const filterRow  = document.getElementById('search-filter-row');

  resultsEl.style.display  = 'block';
  defaultEl.style.display  = 'none';
  filterRow.style.display  = 'flex';
  headerEl.textContent     = 'Searching…';
  listEl.innerHTML         = '<span class="spinner"></span>';

  try {
    const [internal, external] = await Promise.all([
      api(`/api/search?q=${encodeURIComponent(q)}`),
      api(`/api/archives-search?q=${encodeURIComponent(q)}`).catch(() => null),
    ]);
    lastSearchResults = internal;
    lastArchiveResults = external;
    renderSearchResults();
  } catch (err) {
    listEl.innerHTML    = `<div class="alert alert-error">${err.message}</div>`;
    headerEl.textContent = 'Search failed';
  }
}

function renderSearchResults() {
  const listEl   = document.getElementById('search-results-list');
  const headerEl = document.getElementById('search-results-header');
  const q        = document.getElementById('search-input').value.trim();

  const filtered = currentFilter === 'all'
    ? lastSearchResults
    : lastSearchResults.filter(r =>
        r.type === currentFilter ||
        (currentFilter === 'DNA' && (r.type === 'DNA Testing' || r.type === 'DNA Match'))
      );

  // Count external archive hits
  const archiveCount = lastArchiveResults
    ? (lastArchiveResults.nara?.length || 0) +
      (lastArchiveResults.slaveVoyages?.length || 0) +
      (lastArchiveResults.chroniclingAmerica?.length || 0) +
      (lastArchiveResults.enslaved?.length || 0)
    : 0;

  const total = filtered.length + (currentFilter === 'all' ? archiveCount : 0);
  headerEl.textContent = `${total} result${total !== 1 ? 's' : ''} for "${q}"`;

  let html = '';

  // Internal results
  if (filtered.length) {
    html += `<div class="search-section-label">Your Records</div>`;
    html += filtered.map(r => {
      const typeClass = 'type-' + r.type.replace(/\s+/g, '-');
      const snippetHtml = r.snippets && r.snippets.length
        ? `<div class="search-result-snippet">${r.snippets.map(s => escHtml(s)).join('<br>')}</div>`
        : '';
      const clickable = r.type === 'Person' ? `onclick="openProfile('${r.id}')"` : '';
      return `
        <div class="search-result-item" ${clickable}>
          <span class="search-result-type ${typeClass}">${escHtml(r.type)}</span>
          <div style="flex:1;">
            <div class="search-result-name">${escHtml(r.name)}</div>
            ${snippetHtml}
            <div class="search-result-table">${escHtml(r.table)}</div>
          </div>
        </div>`;
    }).join('');
  }

  // External archive results (only shown on "all" filter)
  if (currentFilter === 'all' && lastArchiveResults) {
    // Epistemic state badge — always show "documented" for confirmed archive hits
    const epistemicBadge = `<span style="font-size:.65rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:#062F58;color:#3DDC84;border:1px solid #3DDC8455;border-radius:3px;padding:1px 5px;margin-left:6px;">documented</span>`;

    const archiveSections = [
      { key: 'nara',               label: 'National Archives (NARA)',    color: '#04223F' },
      { key: 'slaveVoyages',       label: 'Slave Voyages Database',      color: '#062F58' },
      { key: 'enslaved',           label: 'Enslaved.org',                color: '#04223F' },
      { key: 'chroniclingAmerica', label: 'Chronicling America (LoC)',   color: '#062F58' },
    ];

    for (const section of archiveSections) {
      const hits = lastArchiveResults[section.key] || [];
      if (!hits.length) continue;
      html += `<div class="search-section-label" style="margin-top:1.2rem;">${escHtml(section.label)}</div>`;
      html += hits.map(r => {
        const meta = [r.date, r.recordGroup, r.origin, r.destination, r.role, r.dataset, r.publication, r.state]
          .filter(Boolean).map(escHtml).join(' · ');
        const snippet = r.snippet ? `<div class="search-result-snippet" style="font-size:.78rem;color:rgba(192,220,248,.55);margin-top:3px;">${escHtml(r.snippet)}…</div>` : '';
        return `
          <div class="search-result-item archive-result" ${r.url ? `onclick="window.open('${escHtml(r.url)}','_blank')"` : ''} style="cursor:${r.url ? 'pointer' : 'default'};">
            <span class="search-result-type" style="background:${section.color};color:#C0DCF8;border:1px solid #3DDC8422;min-width:60px;text-align:center;">
              ${escHtml(section.label.split(' ')[0])}
            </span>
            <div style="flex:1;">
              <div class="search-result-name">${escHtml(r.title)}${epistemicBadge}</div>
              ${meta ? `<div class="search-result-snippet">${meta}</div>` : ''}
              ${snippet}
              ${r.url ? `<div class="search-result-table" style="color:#EF9F27;">↗ View record</div>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    if (lastArchiveResults.errors && lastArchiveResults.errors.length) {
      html += `<div style="font-size:.78rem;color:rgba(192,220,248,.4);margin-top:.5rem;padding:0 4px;">
        Some sources unavailable: ${lastArchiveResults.errors.map(escHtml).join('; ')}
      </div>`;
    }
  }

  if (!html) {
    html = `<div class="empty-state"><div class="empty-icon empty-icon-svg"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><p>No results found. Try a different search term.</p></div>`;
  }

  listEl.innerHTML = html;
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderSearchResults();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  // Hide results but keep the search bar visible (sticky)
  document.getElementById('search-results').style.display     = 'none';
  document.getElementById('dashboard-default').style.display  = 'block';
  document.getElementById('search-filter-row').style.display  = 'none';
  currentFilter     = 'all';
  lastSearchResults = [];
  lastArchiveResults = null;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  const allChip = document.querySelector('.filter-chip[data-filter="all"]');
  if (allChip) allChip.classList.add('active');
}

// ── Database category selector ────────────────────────────────────────────────
function initDatabaseCategories() {
  const grid = document.getElementById('db-category-grid');
  if (!grid) return;
  // Start with all selected
  state.selectedCategories = Object.keys(DB_CATEGORIES);
  grid.innerHTML = Object.entries(DB_CATEGORIES).map(([key, cat]) => `
    <div class="db-category-card selected" id="cat-${key}" onclick="toggleCategory('${key}')">
      <div class="cat-label">${cat.label || ''}</div>
    </div>`).join('');
  updateResearchSubtitle();
}

function toggleCategory(key) {
  const card = document.getElementById(`cat-${key}`);
  const idx  = state.selectedCategories.indexOf(key);
  if (idx > -1) {
    state.selectedCategories.splice(idx, 1);
    card.classList.remove('selected');
  } else {
    state.selectedCategories.push(key);
    card.classList.add('selected');
  }
  updateResearchSubtitle();
}

function selectAllDatabases() {
  state.selectedCategories = Object.keys(DB_CATEGORIES);
  document.querySelectorAll('.db-category-card').forEach(c => c.classList.add('selected'));
  updateResearchSubtitle();
}

function deselectAllDatabases() {
  state.selectedCategories = [];
  document.querySelectorAll('.db-category-card').forEach(c => c.classList.remove('selected'));
  updateResearchSubtitle();
}

function updateResearchSubtitle() {
  const el = document.getElementById('research-subtitle');
  if (!el) return;
  const n = state.selectedCategories.length;
  const total = Object.keys(DB_CATEGORIES).length;
  if (n === 0)     el.textContent = '⚠ No databases selected — select at least one category';
  else if (n === total) el.textContent = `Searching all ${total} database categories simultaneously`;
  else             el.textContent = `Searching ${n} of ${total} database categories`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [data, logEntries, people] = await Promise.all([
      api('/api/dashboard'),
      api('/api/research-log'),
      api('/api/ancestors'),
    ]);
    document.getElementById('stat-ancestors').textContent = data.ancestorsCount ?? '—';
    document.getElementById('stat-questions').textContent = data.questionsCount ?? '—';
    document.getElementById('stat-archives').textContent  = data.archivesCount  ?? '—';
    document.getElementById('stat-dna').textContent       = data.dnaCount       ?? '—';
    renderAncestorCards(data.recentAncestors || [], 'dashboard-ancestors');
    const personMap = {};
    people.forEach(p => { personMap[p.id] = personName(p); });
    renderDashboardResearchLog(logEntries.slice(0, 10), personMap);
    loadedPages.add('dashboard');
  } catch (err) {
    document.getElementById('dashboard-ancestors').innerHTML =
      `<div class="alert alert-error">Could not load dashboard: ${err.message}</div>`;
  }
}

// ── Family Tree ────────────────────────────────────────────────────────────────
async function loadFamilyTree() {
  if (typeof initFamilyTree === 'function') {
    initFamilyTree();
  }
}

// ── Ancestors list ─────────────────────────────────────────────────────────────
async function loadAncestors() {
  const grid      = document.getElementById('ancestors-grid');
  const tableWrap = document.getElementById('ancestors-table-wrap');
  const allLabel  = document.getElementById('ancestors-all-label');
  grid.innerHTML  = '<span class="spinner"></span>';
  if (tableWrap) tableWrap.innerHTML = '<span class="spinner"></span>';

  try {
    const raw = await api('/api/ancestors');

    // Deduplicate by ID
    const seen = new Set();
    const ancestors = raw.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id); return true;
    });

    // Populate global people cache for person-link pickers in modals
    allPeopleCache = [...ancestors].sort((a, b) => personName(a).localeCompare(personName(b)));

    // Sort newest-first by _createdTime
    const sorted = [...ancestors].sort((a, b) =>
      new Date(b._createdTime || 0) - new Date(a._createdTime || 0)
    );

    // Recent 8 as cards
    renderAncestorCards(sorted.slice(0, 8), 'ancestors-grid');

    // Update count label
    if (allLabel) allLabel.textContent = `All People (${ancestors.length})`;

    // Full table — sorted A–Z by name for readability
    const tableData = [...ancestors].sort((a, b) =>
      personName(a).localeCompare(personName(b))
    );

    if (!tableWrap) return;
    renderAncestorsTable();
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    if (tableWrap) tableWrap.innerHTML = '';
  }
}

async function deleteAncestorRow(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api(`/api/ancestor/${id}`, { method: 'DELETE' });
    showAlert('ancestors-alert', `"${name}" deleted.`);
    loadedPages.delete('ancestors');
    loadAncestors();
  } catch (err) {
    showAlert('ancestors-alert', `Delete failed: ${err.message}`, 'error');
  }
}

function renderAncestorsTable() {
  const tableWrap = document.getElementById('ancestors-table-wrap');
  if (!tableWrap) return;
  if (!allPeopleCache.length) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-icon empty-icon-svg"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><p>No ancestors yet.</p></div>`;
    return;
  }
  const { slice: pageItems, page, pages, total } = _pgSlice(allPeopleCache, 'People');
  const rows = pageItems.map(a => {
    const name     = personName(a);
    const relation = a['Relation to Self'] || '';
    const sex      = a['Sex'] || '';
    const bDate    = a['Birth Date'] || '';
    const bPlace   = a['Birth Place'] || '';
    const dDate    = a['Death Date'] || '';
    const dPlace   = a['Death Place'] || '';
    const safeRec  = JSON.stringify(a).replace(/</g,'\\u003c').replace(/"/g,'&quot;');
    return `<tr data-id="${escHtml(a.id)}">
      <td style="font-weight:600;cursor:pointer;" onclick="openProfile('${a.id}')">${escHtml(name)}</td>
      <td data-field="Relation to Self" data-val="${escHtml(relation)}">${escHtml(relation)||'—'}</td>
      <td data-field="Sex" data-val="${escHtml(sex)}">${escHtml(sex)||'—'}</td>
      <td data-field="Birth Date"  data-val="${escHtml(bDate)}">${escHtml(bDate)||'—'}</td>
      <td data-field="Birth Place" data-val="${escHtml(bPlace)}">${escHtml(bPlace)||'—'}</td>
      <td data-field="Death Date"  data-val="${escHtml(dDate)}">${escHtml(dDate)||'—'}</td>
      <td data-field="Death Place" data-val="${escHtml(dPlace)}">${escHtml(dPlace)||'—'}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditModal('People','${a.id}',${safeRec})">Edit</button></td>
    </tr>`;
  }).join('');
  tableWrap.innerHTML = `
    <div id="people-grid-alert" data-grid-alert="People"></div>
    ${gridBulkBarHtml('People')}
    <div style="overflow-x:auto;">
      <table class="ancestors-full-table" data-grid-table="People">
        <thead><tr>
          <th>Full Name</th><th>Relationship</th><th>Sex</th>
          <th>Birth Date</th><th>Birth Place</th><th>Death Date</th><th>Death Place</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${_pgBarHtml('People', page, pages, total)}`;
  initGrid('People');
}

// ── Research Log ─────────────────────────────────────────────────────────────
const RL_STATUS_COLORS = {
  'Open':        { bg:'#0d1e2a', color:'#7ec8ef' },
  'In Progress': { bg:'#2a2010', color:'var(--accent)' },
  'Proven':      { bg:'#0d2a1a', color:'var(--success)' },
  'Disproven':   { bg:'#2a0d0d', color:'var(--danger)' },
  'On Hold':     { bg:'var(--surface2)', color:'var(--muted)' },
};

async function loadResearchLog() {
  const el = document.getElementById('research-log-content');
  if (el) el.innerHTML = '<span class="spinner"></span>';
  try {
    const [entries, people] = await Promise.all([
      api('/api/research-log'),
      api('/api/ancestors'),
    ]);
    const personMap = {};
    people.forEach(p => { personMap[p.id] = personName(p); });
    researchLogCache     = entries;
    researchLogPersonMap = personMap;
    renderResearchLogPage(entries, personMap);
    renderDashboardResearchLog(entries.slice(0, 8), personMap);
  } catch (err) {
    if (el) el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderResearchLogTable(entries, personMap, compact = false) {
  if (!entries.length) {
    return `<div class="empty-state"><div class="empty-icon empty-icon-svg"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div><p>No research log entries yet. Click "+ New Entry" to start tracking.</p></div>`;
  }
  const rows = entries.map(e => {
    const title    = e['Log Title ★'] || '';
    const status   = e['Research Status'] || '';
    const sc       = RL_STATUS_COLORS[status] || RL_STATUS_COLORS['On Hold'];
    const line     = e['Genealogical Line'] || '';
    const gen      = e['Generational Line'] || '';
    const rel      = e['Relationship'] || '';
    const personIds = Array.isArray(e['Person']) ? e['Person'] : [];
    const personNamesFromMap = personIds.map(id => personMap[id] || '').filter(Boolean);
    const checklist = Array.isArray(e['Records Checklist']) ? e['Records Checklist'] : [];
    const checkBadges = checklist.slice(0, 3).map(c =>
      `<span style="font-size:.66rem;padding:2px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;white-space:nowrap;">${escHtml(c)}</span>`
    ).join(' ') + (checklist.length > 3 ? ` <span style="font-size:.68rem;color:var(--muted);">+${checklist.length - 3}</span>` : '');
    const ancestryUrl = e['Ancestry Profile URL'] || '';
    const geniUrl     = e['Geni.com Profile URL']  || '';
    const safeRec     = JSON.stringify(e).replace(/</g,'\\u003c').replace(/"/g,'&quot;');
    return `<tr${!compact ? ` data-id="${escHtml(e.id)}"` : ''}>
      <td ${!compact ? `data-field="Log Title ★" data-val="${escHtml(title)}"` : ''} style="font-weight:600;min-width:180px;">${escHtml(title)||'—'}</td>
      <td style="min-width:110px;">${renderPersonLinks(personIds, personNamesFromMap)}</td>
      <td ${!compact ? `data-field="Research Status" data-val="${escHtml(status)}"` : ''}>
        ${status
          ? `<span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:12px;background:${sc.bg};color:${sc.color};white-space:nowrap;">${escHtml(status)}</span>`
          : '<span style="color:var(--muted)">—</span>'}
      </td>
      ${!compact ? `
      <td data-field="Genealogical Line" data-val="${escHtml(line)}">${escHtml(line)||'—'}</td>
      <td style="text-align:center;">${escHtml(gen)||'—'}</td>
      <td data-field="Relationship" data-val="${escHtml(rel)}" style="font-size:.8rem;color:var(--muted);">${escHtml(rel)||'—'}</td>
      <td style="min-width:180px;">${checkBadges || '<span style="color:var(--muted);font-size:.78rem;">—</span>'}</td>
      <td style="white-space:nowrap;">
        ${ancestryUrl ? `<a href="${escHtml(ancestryUrl)}" target="_blank" rel="noopener" style="color:var(--accent);display:inline-flex;" title="Ancestry"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
        ${geniUrl     ? `<a href="${escHtml(geniUrl)}"     target="_blank" rel="noopener" style="color:var(--accent);display:inline-flex;margin-left:4px;" title="Geni.com"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
        ${!ancestryUrl && !geniUrl ? '<span style="color:var(--muted)">—</span>' : ''}
      </td>` : ''}
      <td>
        <button class="btn btn-secondary btn-sm"
          onclick="openEditModal('Research Log','${e.id}',${safeRec})">Edit</button>
      </td>
    </tr>`;
  }).join('');

  const compactCols = `<th>Log Title</th><th>Person</th><th>Status</th><th></th>`;
  const fullCols    = `<th>Log Title</th><th>Person</th><th>Status</th><th>Line</th><th>Gen.</th><th>Relationship</th><th>Records Checked</th><th>Links</th><th></th>`;

  if (compact) {
    return `<div style="overflow-x:auto;">
      <table class="data-table rl-table">
        <thead><tr>${compactCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  return `
    <div data-grid-alert="Research Log"></div>
    ${gridBulkBarHtml('Research Log')}
    <div style="overflow-x:auto;">
      <table class="data-table rl-table" data-grid-table="Research Log">
        <thead><tr>${fullCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderResearchLogPage(entries, personMap) {
  const el = document.getElementById('research-log-content');
  if (!el) return;
  el.innerHTML = renderResearchLogTable(entries, personMap, false);
  initGrid('Research Log');
}

function renderDashboardResearchLog(entries, personMap) {
  const el = document.getElementById('dashboard-research-log');
  if (!el) return;
  el.innerHTML = renderResearchLogTable(entries, personMap, true);
  if (entries.length >= 10) {
    el.innerHTML += `<div style="text-align:right;margin-top:8px;">
      <button class="btn btn-secondary btn-sm" onclick="showPage('research-log')">View all →</button>
    </div>`;
  }
}

// ── Duplicate detection & management ─────────────────────────────────────────
async function findDuplicates() {
  const panel = document.getElementById('duplicates-panel');
  panel.style.display = 'block';
  panel.innerHTML     = '<span class="spinner"></span> Scanning for duplicates…';

  try {
    const all = await api('/api/ancestors');

    // Group by normalized name (lowercase, trimmed)
    const groups = {};
    all.forEach(a => {
      const key = (personName(a) || '').toLowerCase().trim();
      if (!key || key === 'unknown') return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });

    // Only groups with more than one record are duplicates
    const dupGroups = Object.values(groups).filter(g => g.length > 1);

    if (!dupGroups.length) {
      panel.innerHTML = `<div class="alert alert-success">No duplicates found.</div>`;
      setTimeout(() => { panel.style.display = 'none'; panel.innerHTML = ''; }, 3000);
      return;
    }

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div class="section-title" style="margin:0;">${dupGroups.length} duplicate group${dupGroups.length > 1 ? 's' : ''} found</div>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('duplicates-panel').style.display='none'">Close</button>
      </div>
      <div class="dup-bulk-bar" id="dup-bulk-bar" style="display:none;">
        <span class="dup-bulk-count" id="dup-bulk-count">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="dupBulkDelete()">Delete Selected</button>
        <button class="btn btn-secondary btn-sm" onclick="dupClearSelection()">Clear Selection</button>
      </div>
      ${dupGroups.map(group => renderDupGroup(group)).join('')}
    `;
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderDupGroup(records) {
  const name = personName(records[0]);
  const groupId = `dup-group-${records[0].id}`;
  return `
    <div class="dup-group" id="${groupId}">
      <div class="dup-group-header">
        <div class="dup-group-title">Duplicate: "${escHtml(name)}" — ${records.length} records</div>
        <label class="dup-select-all-label">
          <input type="checkbox" class="dup-select-all" data-group="${groupId}"
            onchange="dupToggleGroup('${groupId}', this.checked)" />
          Select all
        </label>
      </div>
      <div class="dup-cards">
        ${records.map(r => renderDupCard(r, records)).join('')}
      </div>
    </div>`;
}

function renderDupCard(record, groupRecords) {
  const name     = personName(record);
  const birth    = personBirth(record);
  const place    = personPlace(record);
  const relation = personRelation(record);
  const line     = personLine(record);
  const others   = groupRecords.filter(r => r.id !== record.id);

  const fields = [
    birth    && `Born: ${birth}`,
    place    && `Place: ${place}`,
    relation && `Relation: ${relation}`,
    line     && `Line: ${line}`,
    `ID: ${record.id}`,
  ].filter(Boolean);

  const mergeButtons = others.map(other =>
    `<button class="btn btn-primary btn-sm"
      onclick="confirmMerge('${record.id}','${other.id}','${escHtml(name)}')">
      Keep this, delete other
    </button>`
  ).join('');

  return `
    <div class="dup-card" id="dup-card-${record.id}">
      <label class="dup-card-check-label">
        <input type="checkbox" class="dup-card-check"
          data-id="${escHtml(record.id)}" data-name="${escHtml(name)}"
          onchange="dupUpdateSelection()" />
      </label>
      <div class="dup-card-body">
        <div class="dup-card-name">${escHtml(name)}</div>
        ${fields.map(f => `<div class="dup-card-field">${escHtml(f)}</div>`).join('')}
        <div class="dup-card-actions">
          ${mergeButtons}
          <button class="btn btn-danger btn-sm"
            onclick="confirmDelete('${record.id}','${escHtml(name)}')">
            Delete this
          </button>
        </div>
      </div>
    </div>`;
}

function dupUpdateSelection() {
  const checked = document.querySelectorAll('.dup-card-check:checked');
  const bar     = document.getElementById('dup-bulk-bar');
  const count   = document.getElementById('dup-bulk-count');
  if (!bar) return;
  bar.style.display  = checked.length > 0 ? 'flex' : 'none';
  count.textContent  = `${checked.length} record${checked.length !== 1 ? 's' : ''} selected`;
  // Sync group-level "select all" checkboxes
  document.querySelectorAll('.dup-group').forEach(group => {
    const allCbs  = group.querySelectorAll('.dup-card-check');
    const allChk  = group.querySelector('.dup-select-all');
    if (!allChk) return;
    const checkedInGroup = [...allCbs].filter(c => c.checked).length;
    allChk.indeterminate = checkedInGroup > 0 && checkedInGroup < allCbs.length;
    allChk.checked       = checkedInGroup === allCbs.length;
  });
}

function dupToggleGroup(groupId, checked) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.dup-card-check').forEach(cb => { cb.checked = checked; });
  dupUpdateSelection();
}

function dupClearSelection() {
  document.querySelectorAll('.dup-card-check, .dup-select-all').forEach(cb => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  dupUpdateSelection();
}

async function dupBulkDelete() {
  const checked = [...document.querySelectorAll('.dup-card-check:checked')];
  if (!checked.length) return;
  const names = checked.map(cb => cb.dataset.name).join(', ');
  if (!confirm(`Permanently delete ${checked.length} record${checked.length !== 1 ? 's' : ''}?\n\n${names}\n\nThis cannot be undone.`)) return;

  const ids = checked.map(cb => cb.dataset.id);
  let deleted = 0, failed = 0;
  for (const id of ids) {
    try {
      await api(`/api/ancestor/${id}`, { method: 'DELETE' });
      document.getElementById(`dup-card-${id}`)?.remove();
      deleted++;
    } catch {
      failed++;
    }
  }
  // Remove empty groups
  document.querySelectorAll('.dup-group').forEach(g => {
    if (g.querySelectorAll('.dup-card').length === 0) g.remove();
  });
  dupUpdateSelection();
  showAlert('ancestors-alert', `${deleted} record${deleted !== 1 ? 's' : ''} deleted.${failed ? ` ${failed} failed.` : ''}`);
  loadedPages.delete('ancestors');
  loadAncestors();
}

async function confirmDelete(id, name) {
  if (!confirm(`Delete "${name}" (ID: ${id})? This cannot be undone.`)) return;
  try {
    await api(`/api/ancestor/${id}`, { method: 'DELETE' });
    showAlert('ancestors-alert', `"${name}" deleted.`);
    document.getElementById(`dup-card-${id}`)?.remove();
    // Remove entire group if only one card left
    document.querySelectorAll('.dup-group').forEach(g => {
      if (g.querySelectorAll('.dup-card').length === 0) g.remove();
    });
    // Reload the grid
    loadedPages.delete('ancestors');
    loadAncestors();
  } catch (err) {
    showAlert('ancestors-alert', `Delete failed: ${err.message}`, 'error');
  }
}

async function confirmMerge(keepId, deleteId, name) {
  if (!confirm(`Keep record ${keepId} and merge fields from ${deleteId} into it, then delete ${deleteId}?\n\nFields that are empty on the record you're keeping will be filled in from the other record. Existing data is never overwritten.`)) return;
  try {
    const result = await api('/api/merge-ancestors', {
      method: 'POST',
      body:   JSON.stringify({ keepId, deleteId }),
    });
    const merged = result.merged.fieldsMerged;
    const msg    = merged.length
      ? `Merged! Fields copied: ${merged.join(', ')}`
      : `Records merged. No new fields to copy — the primary record already had all data.`;
    showAlert('ancestors-alert', msg);
    document.getElementById(`dup-card-${deleteId}`)?.remove();
    document.querySelectorAll('.dup-group').forEach(g => {
      if (g.querySelectorAll('.dup-card').length <= 1) g.remove();
    });
    loadedPages.delete('ancestors');
    loadAncestors();
  } catch (err) {
    showAlert('ancestors-alert', `Merge failed: ${err.message}`, 'error');
  }
}

// ── Field helpers (MySQL snake_case field names) ───────────────────────────────
function personName(a)     { return a.full_name || a['Full Name ★'] || a.Name || 'Unknown'; }
function personPhoto(a)    { return a.photo_url || a['Photo URL'] || null; }
function personBirth(a)    { return a.birth_date || a['Birth Date'] || ''; }
function personDeath(a)    { return a.death_date || a['Death Date'] || ''; }
function personPlace(a)    { return a.birth_place || a['Birth Place'] || a.Location || ''; }
function personRelation(a) { return a.relation_to_self || a['Relation to Self'] || ''; }
function personLine(a)     { return a.line || a.Line || ''; }

function renderAncestorCards(ancestors, containerId) {
  const container = document.getElementById(containerId);

  // Deduplicate by Airtable record ID before rendering
  const seen    = new Set();
  const unique  = ancestors.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  if (!unique.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon empty-icon-svg"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><p>No ancestors found.</p></div>`;
    return;
  }
  container.innerHTML = unique.map(a => {
    const name     = personName(a);
    const photo    = personPhoto(a);
    const birth    = personBirth(a);
    const place    = personPlace(a);
    const relation = personRelation(a);
    const meta     = [relation, birth, place].filter(Boolean).join(' · ');
    const avatar   = photo
      ? `<img src="${photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);" />`
      : `<div class="avatar"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
    return `
      <div class="ancestor-card" onclick="openProfile('${a.id}')">
        ${avatar}
        <div class="anc-name">${escHtml(name)}</div>
        ${meta ? `<div class="anc-meta">${escHtml(meta)}</div>` : ''}
      </div>`;
  }).join('');
}

// ── Ancestor Profile ──────────────────────────────────────────────────────────
async function openProfile(ancestorId) {
  state.previousPage     = document.querySelector('.nav-item.active')?.dataset.page || 'ancestors';
  state.currentProfileId = ancestorId;
  showPage('profile');
  const content = document.getElementById('profile-content');
  content.innerHTML = '<span class="spinner"></span> Loading profile…';

  try {
    const {
      ancestor, questions, sources, evidence,
      dnaTests, dnaMatches, archives, collections, researchLog, relationships,
    } = await api(`/api/ancestor/${ancestorId}`);

    // Cache the ancestor so launchResearchForAncestor can read it safely
    state.ancestorCache[ancestorId] = ancestor;

    const name     = personName(ancestor);
    const photo    = personPhoto(ancestor);
    const birth    = personBirth(ancestor);
    const death    = personDeath(ancestor);
    const place    = personPlace(ancestor);
    const relation = personRelation(ancestor);
    const line     = personLine(ancestor);
    const dates    = [birth, death].filter(Boolean).join(' – ');

    const avatarHtml = photo
      ? `<img src="${photo}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);" />`
      : `<div class="profile-avatar"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

    const metaParts = [relation, line, dates, place].filter(Boolean);

    // ── Extended bio fields ─────────────────────────────────────────────────
    const a = ancestor;
    const bioRows = [];
    if (a.birth_name || a['Birth Name'])           bioRows.push(['Birth Name',      a.birth_name || a['Birth Name']]);
    if (a.also_known_as || a['Also Known As'])      bioRows.push(['Also Known As',   a.also_known_as || a['Also Known As']]);
    if (a.sex || a['Sex'])                          bioRows.push(['Sex',             a.sex || a['Sex']]);
    if (a.race_ethnicity || a['Race/Ethnicity'])    bioRows.push(['Race / Ethnicity',a.race_ethnicity || a['Race/Ethnicity']]);
    if (a.birth_date || a['Birth Date'])            bioRows.push(['Birth Date',      a.birth_date || a['Birth Date']]);
    if (a.birth_place || a['Birth Place'])          bioRows.push(['Birth Place',     a.birth_place || a['Birth Place']]);
    if (a.death_date || a['Death Date'])            bioRows.push(['Death Date',      a.death_date || a['Death Date']]);
    if (a.death_place || a['Death Place'])          bioRows.push(['Death Place',     a.death_place || a['Death Place']]);
    if (a.burial_place || a['Burial Place'])        bioRows.push(['Burial Place',    a.burial_place || a['Burial Place']]);
    if (a.generation_number || a['Generation Number']) bioRows.push(['Generation',   a.generation_number || a['Generation Number']]);
    if (a.line || a['Line'])                        bioRows.push(['Line',            a.line || a['Line']]);
    if (a.relation_to_self || a['Relation to Self'])bioRows.push(['Relation',        a.relation_to_self || a['Relation to Self']]);
    if (a.family_search_id || a['FamilySearch ID'])  bioRows.push(['FamilySearch ID',a.family_search_id || a['FamilySearch ID']]);
    const ancestryUrl = a.ancestry_profile_url || a['Ancestry Profile URL'];
    if (ancestryUrl) bioRows.push(['Ancestry URL', `<a href="${escHtml(ancestryUrl)}" target="_blank" rel="noopener" style="color:var(--accent)">Open Profile</a>`]);
    const geniUrl = a.geni_profile_url || a['Geni Profile URL'];
    if (geniUrl) bioRows.push(['Geni URL', `<a href="${escHtml(geniUrl)}" target="_blank" rel="noopener" style="color:var(--accent)">Open Profile</a>`]);

    const bioHtml = bioRows.length ? `
      <div class="profile-bio-grid">
        ${bioRows.map(([label, val]) => `
          <div class="profile-bio-row">
            <span class="profile-bio-label">${escHtml(label)}</span>
            <span class="profile-bio-val">${typeof val === 'string' && val.startsWith('<a') ? val : escHtml(String(val))}</span>
          </div>`).join('')}
      </div>` : '';

    const notesHtml = (a.notes || a['Notes'])
      ? `<div class="profile-notes"><strong>Notes:</strong> ${escHtml(a.notes || a['Notes'])}</div>` : '';

    const relationshipsHtml = renderRelationshipsPanel(relationships);

    content.innerHTML = `
      <div class="profile-header">
        ${avatarHtml}
        <div>
          <div class="profile-name">${escHtml(name)}</div>
          <div class="profile-meta">${metaParts.map(escHtml).join(' · ')}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="launchResearchForAncestor('${ancestorId}')">
              Run AI Research
            </button>
            <button class="btn btn-outline btn-sm" onclick="openEditModal('People','${ancestorId}',state.ancestorCache['${ancestorId}'])">
              Edit Details
            </button>
          </div>
        </div>
      </div>

      ${bioHtml}
      ${notesHtml}
      ${relationshipsHtml}

      <div class="profile-tabs">
        <button class="tab-btn active" onclick="switchTab('tab-questions', this)">Questions (${(questions||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-researchlog', this)">Research Log (${(researchLog||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-sources', this)">Sources (${(sources||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-evidence', this)">Evidence (${(evidence||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-dnatests', this)">DNA Tests (${(dnaTests||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-dnamatches', this)">DNA Matches (${(dnaMatches||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-archives', this)">Archives (${(archives||[]).length})</button>
        <button class="tab-btn" onclick="switchTab('tab-collections', this)">Collections (${(collections||[]).length})</button>
      </div>

      <div id="tab-questions"   class="tab-content active">${renderQuestionsTab(questions||[])}</div>
      <div id="tab-researchlog" class="tab-content">${renderResearchLogTab(researchLog||[])}</div>
      <div id="tab-sources"     class="tab-content">${renderSourcesTab(sources||[])}</div>
      <div id="tab-evidence"    class="tab-content">${renderEvidenceTab(evidence||[])}</div>
      <div id="tab-dnatests"    class="tab-content">${renderDNATestsTab(dnaTests||[])}</div>
      <div id="tab-dnamatches"  class="tab-content">${renderDNAMatchesTab(dnaMatches||[])}</div>
      <div id="tab-archives"    class="tab-content">${renderArchivesTab(archives||[])}</div>
      <div id="tab-collections" class="tab-content">${renderCollectionsTab(collections||[])}</div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  btn.classList.add('active');
}

// ── Relationships panel (parents / spouses / children, ancestry.com style) ────
function renderRelationshipsPanel(relationships) {
  const rel = relationships || {};
  const parents  = rel.parents  || [];
  const spouses  = rel.spouses  || [];
  const children = rel.children || [];

  // Nothing to show — hide the panel entirely rather than render empty groups.
  if (!parents.length && !spouses.length && !children.length) return '';

  const initials = (name) => (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const personCard = (p) => {
    const years = [p.birthYear, p.deathYear].filter(Boolean).join(' – ');
    const sub   = [p.relation, years].filter(Boolean).join(' · ');
    const avatar = p.photoUrl
      ? `<img src="${escHtml(p.photoUrl)}" alt="" class="rel-avatar-img" />`
      : `<div class="rel-avatar-fallback">${escHtml(initials(p.name))}</div>`;
    const clickable = p.inDb && p.id;
    const attrs = clickable
      ? `class="rel-card rel-card-link" onclick="openProfile('${p.id}')" title="Open profile"`
      : `class="rel-card" title="Not in your working database"`;
    return `
      <div ${attrs}>
        ${avatar}
        <div class="rel-card-text">
          <div class="rel-card-name">${escHtml(p.name)}</div>
          ${sub ? `<div class="rel-card-sub">${escHtml(sub)}</div>` : ''}
        </div>
      </div>`;
  };

  const group = (label, list) => {
    if (!list.length) return '';
    return `
      <div class="rel-group">
        <div class="rel-group-label">${escHtml(label)} <span class="rel-group-count">${list.length}</span></div>
        <div class="rel-group-cards">${list.map(personCard).join('')}</div>
      </div>`;
  };

  return `
    <div class="profile-relationships">
      <div class="profile-rel-header">Relationships</div>
      <div class="profile-rel-body">
        ${group('Parents',  parents)}
        ${group('Spouses',  spouses)}
        ${group('Children', children)}
      </div>
    </div>`;
}

function renderQuestionsTab(questions) {
  if (!questions.length) return emptyState('question', 'No research questions linked.');
  return `<table class="data-table"><thead><tr>
    <th>Research Question</th><th>Status</th><th>Priority</th><th>Conclusion</th><th>GPS</th>
  </tr></thead><tbody>` +
    questions.map(q => {
      const gpsItems = [];
      if (q['Reasonably Exhaustive Search Done '] === true) gpsItems.push('Search Done');
      if (q['Conflicts Resolved '] === true) gpsItems.push('Conflicts Resolved');
      const gpsHtml = gpsItems.length
        ? gpsItems.map(g => `<span class="profile-badge profile-badge-green">${escHtml(g)}</span>`).join(' ')
        : '<span style="color:var(--muted)">—</span>';
      return `<tr>
        <td style="max-width:280px;">${escHtml(q['Research Question ★'] || q['Research Question'] || q.Question || '—')}</td>
        <td>${escHtml(q.Status || '—')}</td>
        <td>${escHtml(q.Priority || '—')}</td>
        <td style="font-size:.82rem;color:var(--muted);max-width:220px;">${escHtml(q['Current Conclusion'] || q.Conclusion || '—')}</td>
        <td style="white-space:nowrap;">${gpsHtml}</td>
      </tr>`;
    }).join('') +
    `</tbody></table>`;
}

function renderResearchLogTab(log) {
  if (!log.length) return emptyState('doc', 'No research log entries linked.');
  return `<table class="data-table"><thead><tr>
    <th>Log Title</th><th>Status</th><th>Line</th><th>Generation</th><th>Relationship</th><th>Notes</th>
  </tr></thead><tbody>` +
    log.map(l => `<tr>
      <td style="font-weight:600;">${escHtml(l['Log Title ★'] || l['Log Title'] || '—')}</td>
      <td>${escHtml(l['Research Status'] || '—')}</td>
      <td>${escHtml(l['Genealogical Line'] || l.Line || '—')}</td>
      <td>${escHtml(l['Generational Line'] || l.Generation || '—')}</td>
      <td>${escHtml(l['Relationship'] || '—')}</td>
      <td style="font-size:.82rem;color:var(--muted);max-width:260px;">${escHtml(l.Notes || '—')}</td>
    </tr>`).join('') +
    `</tbody></table>`;
}

function renderSourcesTab(sources) {
  if (!sources.length) return emptyState('doc', 'No sources linked.');
  return `<table class="data-table"><thead><tr>
    <th>Name</th><th>Type</th><th>Citation</th><th>Notes</th>
  </tr></thead><tbody>` +
    sources.map(s => {
      const url = s['URL'] || s['Source URL'] || s.URL || '';
      const nameHtml = url
        ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--accent)">${escHtml(s['Name ★'] || s.Name || '—')}</a>`
        : escHtml(s['Name ★'] || s.Name || '—');
      return `<tr>
        <td>${nameHtml}</td>
        <td>${escHtml(s['Source Type'] || s.Type || '—')}</td>
        <td style="font-size:.8rem;color:var(--muted);max-width:220px;">${escHtml(s['Short Citation'] || s.Citation || '—')}</td>
        <td style="font-size:.8rem;color:var(--muted);max-width:200px;">${escHtml(s.Notes || '—')}</td>
      </tr>`;
    }).join('') +
    `</tbody></table>`;
}

function renderEvidenceTab(evidence) {
  if (!evidence.length) return emptyState('search', 'No evidence analysis linked.');
  return `<table class="data-table"><thead><tr>
    <th>Name</th><th>Evidence Type</th><th>Conclusion</th><th>Reliability</th><th>Notes</th>
  </tr></thead><tbody>` +
    evidence.map(e => `<tr>
      <td style="font-weight:600;">${escHtml(e['Name ★'] || e.Name || '—')}</td>
      <td>${escHtml(e['Evidence Type'] || e.Type || '—')}</td>
      <td style="font-size:.82rem;max-width:240px;">${escHtml(e['Current Conclusion'] || e.Conclusion || e.Summary || '—')}</td>
      <td>${escHtml(e.Reliability || '—')}</td>
      <td style="font-size:.8rem;color:var(--muted);max-width:200px;">${escHtml(e.Notes || '—')}</td>
    </tr>`).join('') +
    `</tbody></table>`;
}

function renderDNATestsTab(tests) {
  if (!tests.length) return emptyState('dna', 'No DNA tests linked.');
  return `<table class="data-table"><thead><tr>
    <th>Test / Company</th><th>Test Type</th><th>Kit Number</th><th>Status</th><th>Results / Notes</th>
  </tr></thead><tbody>` +
    tests.map(t => `<tr>
      <td style="font-weight:600;">${escHtml(t['Name ★'] || t.Name || t['Test Company'] || t.Company || '—')}</td>
      <td>${escHtml(t['Test Type'] || t.Type || '—')}</td>
      <td style="font-family:monospace;font-size:.82rem;">${escHtml(t['Kit Number'] || t['Kit #'] || '—')}</td>
      <td>${escHtml(t.Status || '—')}</td>
      <td style="font-size:.8rem;color:var(--muted);max-width:260px;">${escHtml(t.Notes || t.Results || t.Description || '—')}</td>
    </tr>`).join('') +
    `</tbody></table>`;
}

function renderDNAMatchesTab(matches) {
  if (!matches.length) return emptyState('dna', 'No DNA matches linked.');
  return `<table class="data-table"><thead><tr>
    <th>Match Name</th><th>Predicted Relationship</th><th>Shared cM</th><th>Platform</th><th>Notes</th>
  </tr></thead><tbody>` +
    matches.map(m => `<tr>
      <td style="font-weight:600;">${escHtml(m['Match Name ★'] || m['Match Name'] || m.Name || '—')}</td>
      <td>${escHtml(m['Predicted Relationship'] || m.Relationship || '—')}</td>
      <td style="font-family:monospace;">${escHtml(String(m['Shared cM'] ?? m.SharedCM ?? m['Shared CM'] ?? '—'))}</td>
      <td>${escHtml(m.Platform || m.Company || '—')}</td>
      <td style="font-size:.8rem;color:var(--muted);max-width:260px;">${escHtml(m.Notes || '—')}</td>
    </tr>`).join('') +
    `</tbody></table>`;
}

function renderArchivesTab(archives) {
  if (!archives.length) return emptyState('folder', 'No archival items linked.');
  return `<table class="data-table"><thead><tr>
    <th>Accession #</th><th>Description</th><th>Format</th><th>Date</th><th>Condition</th><th>Location</th>
  </tr></thead><tbody>` +
    archives.map(a => `<tr>
      <td style="font-family:monospace;font-size:.82rem;white-space:nowrap;">${escHtml(a['Accession Number ★'] || a['Accession Number'] || '—')}</td>
      <td style="max-width:260px;font-size:.82rem;">${escHtml(a.Description || a.Title || a.Name || '—')}</td>
      <td>${escHtml((Array.isArray(a['Formats Included']) ? a['Formats Included'].join(', ') : a['Formats Included']) || a.Format || a.Type || '—')}</td>
      <td style="white-space:nowrap;">${escHtml(a['Inclusive Dates'] || a['Estimated Date'] || a.Date || '—')}</td>
      <td>${escHtml(a.Condition || '—')}</td>
      <td style="font-size:.8rem;color:var(--muted);">${escHtml(a['Box/Folder Reference'] || a.Location || '—')}</td>
    </tr>`).join('') +
    `</tbody></table>`;
}

function renderCollectionsTab(collections) {
  if (!collections.length) return emptyState('folder', 'No collection items linked.');
  return `<table class="data-table"><thead><tr>
    <th>Name</th><th>Type</th><th>Description</th><th>Date</th><th>Notes</th>
  </tr></thead><tbody>` +
    collections.map(c => `<tr>
      <td style="font-weight:600;">${escHtml(c['Name ★'] || c.Name || c.Title || '—')}</td>
      <td>${escHtml(c.Type || c.Category || c['Item Type'] || '—')}</td>
      <td style="font-size:.82rem;max-width:240px;">${escHtml(c.Description || '—')}</td>
      <td style="white-space:nowrap;">${escHtml(c.Date || c['Estimated Date'] || '—')}</td>
      <td style="font-size:.8rem;color:var(--muted);max-width:200px;">${escHtml(c.Notes || '—')}</td>
    </tr>`).join('') +
    `</tbody></table>`;
}

const _EMPTY_ICONS = {
  'question': `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  'doc':      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  'search':   `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  'dna':      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m2 9 20 6"/></svg>`,
  'folder':   `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
};
function emptyState(icon, msg) {
  const svg = _EMPTY_ICONS[icon] || _EMPTY_ICONS['folder'];
  return `<div class="empty-state"><div class="empty-icon empty-icon-svg">${svg}</div><p>${msg}</p></div>`;
}

// ── Person-link chip: clickable name that opens the ancestor profile ─────────
// ids   = array of Airtable record IDs (from a linked-record field)
// names = optional parallel array of display names (from a lookup field)
function renderPersonLinks(ids, names) {
  if (!Array.isArray(ids) || !ids.length) return '<span style="color:var(--muted)">—</span>';
  return ids.map((id, i) => {
    let name = (names && names[i]) || '';
    if (!name) {
      const cached = allPeopleCache.find(p => p.id === id);
      name = cached ? personName(cached) : 'Unknown';
    }
    return `<span class="person-link-chip" onclick="openProfile('${escHtml(id)}')" title="Open profile">${escHtml(name)}</span>`;
  }).join(' ');
}

// ── Launch research pre-filled from profile ───────────────────────────────────
function launchResearchForAncestor(ancestorId) {
  const ancestor = state.ancestorCache[ancestorId] || {};
  showPage('research-agent');
  document.getElementById('r-name').value      = personName(ancestor);
  document.getElementById('r-birth').value     = personBirth(ancestor);
  document.getElementById('r-location').value  = personPlace(ancestor);
  document.getElementById('r-relatives').value = ancestor['Known Relatives'] || '';
  document.getElementById('r-questions').value = '';
  document.getElementById('findings-ancestor-id').textContent = ancestorId;
  document.getElementById('findings-ancestor-input').value    = ancestorId;
}

// ── Research Agent ────────────────────────────────────────────────────────────
async function runResearch() {
  const name      = document.getElementById('r-name').value.trim();
  const birthYear = document.getElementById('r-birth').value.trim();
  const location  = document.getElementById('r-location').value.trim();
  const relatives = document.getElementById('r-relatives').value.trim();
  const questions = document.getElementById('r-questions').value.trim();

  if (!name) {
    showAlert('research-alert', 'Please enter an ancestor name.', 'error');
    return;
  }

  state.researchName = name;

  const outputEl   = document.getElementById('research-output');
  const spinnerEl  = document.getElementById('research-spinner');
  const runBtn     = document.getElementById('run-research-btn');
  const findingsSec = document.getElementById('findings-section');
  const chatPanel  = document.getElementById('chat-panel');

  outputEl.className  = 'active';
  outputEl.innerHTML  = '';
  findingsSec.style.display = 'none';
  chatPanel.className       = '';
  state.currentResearch     = '';
  state.parsedFindings      = [];
  state.chatHistory         = [];

  runBtn.disabled   = true;
  spinnerEl.style.display = 'inline-flex';

  try {
    const response = await fetch('/api/research', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
      body:    JSON.stringify({ name, birthYear, location, relatives, questions,
                               selectedCategories: state.selectedCategories,
                               locationFilters:    state.selectedLocations }),
    });

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const { text, error } = JSON.parse(payload);
          if (error) throw new Error(error);
          if (text) {
            state.currentResearch += text;
            outputEl.innerHTML = renderMarkdown(state.currentResearch);
            outputEl.scrollTop = outputEl.scrollHeight;
          }
        } catch { /* non-JSON line */ }
      }
    }

    // Parse findings and show save panel
    state.parsedFindings = parseFindings(state.currentResearch);
    if (state.parsedFindings.length) {
      renderFindingsList();
      findingsSec.style.display = 'block';
    }

    // Seed chat history
    state.chatHistory = [
      { role: 'user',      content: `Research this ancestor: ${name}, born ${birthYear}, ${location}` },
      { role: 'assistant', content: state.currentResearch },
    ];
    chatPanel.className = 'active';
    document.getElementById('chat-messages').innerHTML = '';

  } catch (err) {
    outputEl.innerHTML += `\n\n<span style="color:var(--danger)">Error: ${escHtml(err.message)}</span>`;
  } finally {
    runBtn.disabled         = false;
    spinnerEl.style.display = 'none';
  }
}

function clearResearch() {
  ['r-name','r-birth','r-location','r-relatives','r-questions'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('research-output').className = '';
  document.getElementById('research-output').innerHTML = '';
  document.getElementById('findings-section').style.display = 'none';
  document.getElementById('chat-panel').className = '';
  state.currentResearch = '';
  state.parsedFindings  = [];
  state.chatHistory     = [];
}

// ── Parse findings from research text ────────────────────────────────────────
function parseFindings(text) {
  const findings = [];

  const blocks = [
    { tag: 'record-json',   type: 'source'   },
    { tag: 'person-json',   type: 'person'   },
    { tag: 'question-json', type: 'question' },
    { tag: 'dna-json',      type: 'dna'      },
  ];

  for (const { tag, type } of blocks) {
    const regex = new RegExp('```' + tag + '\\s*([\\s\\S]*?)```', 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const obj = JSON.parse(match[1].trim());
        findings.push({ type, data: obj, selected: true });
      } catch { /* skip malformed */ }
    }
  }

  return findings;
}

function renderFindingsList() {
  const list = document.getElementById('findings-list');
  if (!state.parsedFindings.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">No structured findings were extracted. You can still save the full report text manually.</p>';
    return;
  }
  const badgeMap = {
    source:   ['badge-source',   'Source'],
    person:   ['badge-person',   'Person'],
    question: ['badge-question', 'Question'],
    dna:      ['badge-dna',      'DNA Match'],
  };

  list.innerHTML = state.parsedFindings.map((f, i) => {
    const [badgeClass, badgeLabel] = badgeMap[f.type] || ['badge-source', f.type];
    let meta = '';
    if (f.type === 'source')   meta = [f.data.sourceType, (f.data.citation||'').substring(0,100)].filter(Boolean).join(' · ');
    if (f.type === 'person')   meta = [f.data.birthYear, f.data.location, f.data.relationship].filter(Boolean).join(' · ');
    if (f.type === 'question') meta = (f.data.answer || '').substring(0, 120);
    if (f.type === 'dna')      meta = [f.data.platform, f.data.relationship].filter(Boolean).join(' · ');
    const title = f.data.name || f.data.question || f.data.title || 'Untitled';
    return `
      <div class="finding-item">
        <input type="checkbox" id="f${i}" ${f.selected ? 'checked' : ''} onchange="state.parsedFindings[${i}].selected=this.checked" />
        <div class="finding-body">
          <div class="finding-title">
            <span class="finding-badge ${badgeClass}">${badgeLabel}</span>
            ${escHtml(title)}
          </div>
          ${meta ? `<div class="finding-meta">${escHtml(meta)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function selectAllFindings()   { state.parsedFindings.forEach((_,i) => { state.parsedFindings[i].selected = true;  document.getElementById(`f${i}`).checked = true;  }); }
function deselectAllFindings() { state.parsedFindings.forEach((_,i) => { state.parsedFindings[i].selected = false; document.getElementById(`f${i}`).checked = false; }); }

async function saveSelectedFindings() {
  const ancestorId = document.getElementById('findings-ancestor-input').value.trim() || null;
  const selected   = state.parsedFindings.filter(f => f.selected);
  if (!selected.length) {
    showAlert('research-alert', 'No findings selected.', 'error');
    return;
  }

  const sources    = selected.filter(f => f.type === 'source').map(f => ({
    name: f.data.name, sourceType: f.data.sourceType, citation: f.data.citation,
  }));
  const ancestors  = selected.filter(f => f.type === 'person').map(f => ({
    name: f.data.name, birthYear: f.data.birthYear, location: f.data.location, notes: f.data.relationship,
  }));
  const questions  = selected.filter(f => f.type === 'question').map(f => ({
    question: f.data.question, answer: f.data.answer, sourceUrl: f.data.sourceUrl,
  }));
  const dnaMatches = selected.filter(f => f.type === 'dna').map(f => ({
    name: f.data.name, platform: f.data.platform, relationship: f.data.relationship, details: f.data.details,
  }));

  try {
    const result = await api('/api/save-findings', {
      method: 'POST',
      body:   JSON.stringify({ sources, ancestors, questions, dnaMatches, ancestorId }),
    });
    const s = result.saved;
    showAlert('research-alert',
      `Saved: ${s.sources.length} source(s), ${s.ancestors.length} person(s), ${s.questions.length} question(s), ${s.dnaMatches.length} DNA match(es) to Airtable.`);

    // Log this research session to Research Log
    try {
      const logTitle = `AI Research: ${state.researchName || document.getElementById('r-name').value.trim() || 'Ancestor'} — ${new Date().toLocaleDateString()}`;
      const logNotes = `AI research session. Saved: ${s.sources.length} source(s), ${s.ancestors.length} person(s), ${s.questions.length} question(s), ${s.dnaMatches.length} DNA match(es).`;
      await api('/api/save-research-log', {
        method: 'POST',
        body: JSON.stringify({
          title:    logTitle,
          personId: ancestorId || null,
          status:   'In Progress',
          notes:    logNotes,
        }),
      });
      loadedPages.delete('research-log');
    } catch (e) { /* non-fatal */ }
  } catch (err) {
    showAlert('research-alert', `Save failed: ${err.message}`, 'error');
  }
}

// ── Chat panel ────────────────────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messagesEl = document.getElementById('chat-messages');
  messagesEl.innerHTML += `<div class="chat-msg user">${escHtml(msg)}</div>`;
  messagesEl.innerHTML += `<div class="chat-msg assistant" id="chat-reply-pending"><span class="spinner"></span></div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const { reply, updatedHistory } = await api('/api/chat', {
      method: 'POST',
      body:   JSON.stringify({ history: state.chatHistory, message: msg }),
    });
    state.chatHistory = updatedHistory;
    document.getElementById('chat-reply-pending').outerHTML =
      `<div class="chat-msg assistant">${renderMarkdown(reply)}</div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (err) {
    document.getElementById('chat-reply-pending').outerHTML =
      `<div class="chat-msg assistant" style="color:var(--danger)">Error: ${escHtml(err.message)}</div>`;
  }
}

// ── Full-table pages ──────────────────────────────────────────────────────────
let allQuestionsCache    = [];
let activeQFilter        = 'all';
let allPeopleCache       = [];  // populated by loadAncestors — used by person-link picker
let allDNATestingCache   = [];
let allDNAMatchesCache   = [];
let researchLogCache     = [];
let researchLogPersonMap = {};

function categorizeStatus(status) {
  if (!status) return 'open';
  const s = status.toLowerCase();
  if (s.includes('proven') || s.includes('solved') || s.includes('answered')) return 'proven';
  if (s.includes('progress') || s.includes('active') || s.includes('researching')) return 'inprogress';
  if (s.includes('disproven') || s.includes('closed') || s.includes('not found')) return 'disproven';
  return 'open';
}

async function loadQuestions() {
  const el = document.getElementById('questions-content');
  el.innerHTML = '<span class="spinner"></span>';
  try {
    allQuestionsCache = await api('/api/questions');
    renderQuestionsPage();
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderQuestionsPage() {
  const el  = document.getElementById('questions-content');
  const all = allQuestionsCache;

  const counts = {
    all:        all.length,
    open:       all.filter(q => categorizeStatus(q.Status) === 'open').length,
    inprogress: all.filter(q => categorizeStatus(q.Status) === 'inprogress').length,
    proven:     all.filter(q => categorizeStatus(q.Status) === 'proven').length,
    disproven:  all.filter(q => categorizeStatus(q.Status) === 'disproven').length,
  };

  const filteredAll = activeQFilter === 'all'
    ? all
    : all.filter(q => categorizeStatus(q.Status) === activeQFilter);
  const { slice: filtered, page: pgQ, pages: pgsQ, total: totQ } = _pgSlice(filteredAll, 'Research Questions');

  const statCards = [
    { key: 'all',        label: 'All Records',  count: counts.all,        color: 'var(--accent)' },
    { key: 'open',       label: 'Open',         count: counts.open,       color: '#7ec8ef' },
    { key: 'inprogress', label: 'In Progress',  count: counts.inprogress, color: '#efef7e' },
    { key: 'proven',     label: 'Proven',       count: counts.proven,     color: 'var(--success)' },
    { key: 'disproven',  label: 'Disproven',    count: counts.disproven,  color: 'var(--danger)' },
  ].map(s => `
    <div class="q-stat-card ${activeQFilter === s.key ? 'q-stat-active' : ''}"
         onclick="setQFilter('${s.key}')"
         style="--qcolor:${s.color}">
      <div class="q-stat-label">${s.label}</div>
      <div class="q-stat-count">${s.count}</div>
    </div>`).join('');

  const tableRows = filtered.length
    ? filtered.map(q => {
        const statusCat = categorizeStatus(q.Status);
        const statusColor = { proven:'var(--success)', inprogress:'#efef7e', disproven:'var(--danger)', open:'var(--muted)' }[statusCat] || 'var(--muted)';
        const qText   = q['Research Question ★'] || q['Research Question'] || q.Name || '';
        const peopleIds   = Array.isArray(q['People']) ? q['People'] : [];
        const peopleNames = Array.isArray(q['Name (from People)']) ? q['Name (from People)'] : [];
        const rtype   = q['Research Type'] || '';
        const priority= q['Priority'] || '';
        const status  = q.Status || '';
        const safeRec = JSON.stringify(q).replace(/</g,'\\u003c').replace(/"/g,'&quot;');
        return `<tr data-id="${escHtml(q.id)}">
          <td data-field="Research Question ★" data-val="${escHtml(qText)}" style="max-width:380px;font-size:.86rem;">${escHtml(qText)||'—'}</td>
          <td style="font-size:.8rem;">${renderPersonLinks(peopleIds, peopleNames)}</td>
          <td data-field="Research Type" data-val="${escHtml(rtype)}" style="font-size:.78rem;color:var(--muted);">${escHtml(rtype)||'—'}</td>
          <td data-field="Priority" data-val="${escHtml(priority)}" style="font-size:.78rem;color:var(--muted);">${escHtml(priority.substring(0,20))||'—'}</td>
          <td data-field="Status" data-val="${escHtml(status)}"><span style="font-size:.75rem;font-weight:600;color:${statusColor};">${escHtml(status.substring(0,28))}${status.length>28?'…':''}</span></td>
          <td><button class="btn btn-secondary btn-sm" onclick="openEditModal('Research Questions','${q.id}',${safeRec})">Edit</button></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">No questions in this category.</td></tr>`;

  el.innerHTML = `
    <div id="questions-grid-alert" data-grid-alert="Research Questions"></div>
    <div class="q-stats-row">${statCards}</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      <button class="btn btn-primary btn-sm" onclick="openAddModal('Research Questions')">+ Add Question</button>
    </div>
    ${gridBulkBarHtml('Research Questions')}
    <div style="overflow-x:auto;">
      <table class="data-table" data-grid-table="Research Questions">
        <thead><tr>
          <th>Research Question</th><th>People</th><th>Research Type</th>
          <th>Priority</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${_pgBarHtml('Research Questions', pgQ, pgsQ, totQ)}`;
  initGrid('Research Questions');
}

function setQFilter(key) {
  activeQFilter = key;
  _pgState['Research Questions'] = 1;
  renderQuestionsPage();
}

// ── Sources page ──────────────────────────────────────────────────────────────
let allSourcesCache  = [];
let activeSrcFilter  = 'all';

function categorizeSrcType(type) {
  if (!type) return 'other';
  const t = type.toLowerCase();
  if (t.includes('primary'))    return 'primary';
  if (t.includes('secondary'))  return 'secondary';
  if (t.includes('repository')) return 'repository';
  if (t.includes('dna'))        return 'dna';
  if (t.includes('found'))      return 'found';
  return 'other';
}

async function loadSources() {
  const el = document.getElementById('sources-content');
  el.innerHTML = '<span class="spinner"></span>';
  try {
    allSourcesCache = await api('/api/sources-all');
    renderSourcesPage();
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderSourcesPage() {
  const el  = document.getElementById('sources-content');
  const all = allSourcesCache;

  const counts = {
    all:        all.length,
    primary:    all.filter(s => categorizeSrcType(s['Source Type']) === 'primary').length,
    secondary:  all.filter(s => categorizeSrcType(s['Source Type']) === 'secondary').length,
    repository: all.filter(s => categorizeSrcType(s['Source Type']) === 'repository').length,
    dna:        all.filter(s => categorizeSrcType(s['Source Type']) === 'dna').length,
    found:      all.filter(s => categorizeSrcType(s['Source Type']) === 'found').length,
    other:      all.filter(s => {
                  const c = categorizeSrcType(s['Source Type']);
                  return c === 'other';
                }).length,
  };

  const filteredAllSrc = activeSrcFilter === 'all'
    ? all
    : all.filter(s => categorizeSrcType(s['Source Type']) === activeSrcFilter);
  const { slice: filtered, page: pgS, pages: pgsS, total: totS } = _pgSlice(filteredAllSrc, 'Sources');

  const statCards = [
    { key: 'all',        label: 'All Sources',     count: counts.all,        color: 'var(--accent)',  bg: '#2a2010' },
    { key: 'primary',    label: 'Primary Source',  count: counts.primary,    color: '#7ec8ef',        bg: '#0d1e2a' },
    { key: 'secondary',  label: 'Secondary Source',count: counts.secondary,  color: '#a8d8a8',        bg: '#0d1e0d' },
    { key: 'repository', label: 'Repository',      count: counts.repository, color: '#c494ef',        bg: '#1a0d2a' },
    { key: 'dna',        label: 'DNA',             count: counts.dna,        color: '#7eefef',        bg: '#0d2020' },
    { key: 'found',      label: 'Found Sources',   count: counts.found,      color: '#efb87e',        bg: '#2a1a0d' },
  ].map(s => `
    <div class="src-stat-card ${activeSrcFilter === s.key ? 'src-stat-active' : ''}"
         onclick="setSrcFilter('${s.key}')"
         style="--srccolor:${s.color};--srcbg:${s.bg}">
      <div class="src-stat-label">${s.label}</div>
      <div class="src-stat-count">${s.count}</div>
    </div>`).join('');

  const typeColors = {
    primary:    { bg:'#0d1e2a', color:'#7ec8ef' },
    secondary:  { bg:'#0d1e0d', color:'#a8d8a8' },
    repository: { bg:'#1a0d2a', color:'#c494ef' },
    dna:        { bg:'#0d2020', color:'#7eefef' },
    found:      { bg:'#2a1a0d', color:'#efb87e' },
    other:      { bg:'var(--surface2)', color:'var(--muted)' },
  };

  const SEARCH_STATUS_STYLE = {
    'Found':              { bg:'#0d2a0d', color:'#7ef87e' },
    'Searched':           { bg:'#0d1e2a', color:'#7ec8ef' },
    'Not Found':          { bg:'#2a0d0d', color:'#ef7e7e' },
    'Partially Searched': { bg:'#2a1a0d', color:'#efb87e' },
    'Search Pending':     { bg:'#1a1a0d', color:'#efef7e' },
    ' Search Pending':    { bg:'#1a1a0d', color:'#efef7e' },   // Airtable stores with leading space
    'Not Yet':            { bg:'var(--surface2)', color:'var(--muted)' },
  };

  const tableRows = filtered.length
    ? filtered.map(s => {
        const name       = s['Name ★'] || s.Name || '—';
        const srcType    = s['Source Type'] || '';
        const cat        = categorizeSrcType(srcType);
        const tc         = typeColors[cat] || typeColors.other;
        const repo       = s['Repository'] || '—';
        const url        = s['URL'] || s['Source URL'] || '';
        const recTypes   = Array.isArray(s['Record Type']) ? s['Record Type'] : [];
        const searchSt   = s['Search Status'] || '';
        const sStyle     = SEARCH_STATUS_STYLE[searchSt] || { bg:'var(--surface2)', color:'var(--muted)' };
        const shortCite  = s['Short Citation'] || '—';
        const fileUrl    = s['Source File URL'] || '';
        const safeRec    = JSON.stringify(s).replace(/</g,'\\u003c').replace(/"/g,'&quot;');
        return `<tr data-id="${escHtml(s.id)}">
          <td data-field="Name ★" data-val="${escHtml(s['Name ★']||s.Name||'')}" style="font-weight:600;max-width:260px;">
            ${url
              ? `<a href="${escHtml(url)}" target="_blank" rel="noopener"
                   style="color:var(--accent);text-decoration:none;"
                   onmouseover="this.style.textDecoration='underline'"
                   onmouseout="this.style.textDecoration='none'">${escHtml(name)}</a>`
              : escHtml(name)}
            ${fileUrl ? `<a href="${escHtml(fileUrl)}" target="_blank" rel="noopener"
              title="View attached file" style="margin-left:6px;font-size:.75rem;color:var(--muted);text-decoration:none;display:inline-flex;vertical-align:middle;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></a>` : ''}
          </td>
          <td>
            ${srcType
              ? `<span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:12px;
                              background:${tc.bg};color:${tc.color};white-space:nowrap;">
                   ${escHtml(srcType)}</span>`
              : '<span style="color:var(--muted);font-size:.78rem;">—</span>'}
          </td>
          <td style="max-width:200px;">
            ${recTypes.length
              ? recTypes.slice(0,3).map(rt =>
                  `<span style="font-size:.68rem;padding:2px 7px;border-radius:10px;margin:1px;display:inline-block;
                                background:var(--surface2);color:var(--text-secondary);white-space:nowrap;">${escHtml(rt)}</span>`
                ).join('') + (recTypes.length > 3 ? `<span style="font-size:.68rem;color:var(--muted);"> +${recTypes.length-3}</span>` : '')
              : '<span style="color:var(--muted);font-size:.78rem;">—</span>'}
          </td>
          <td data-field="Repository" data-val="${escHtml(repo)}" style="font-size:.78rem;color:var(--muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escHtml(repo)||'—'}
          </td>
          <td data-field="Search Status" data-val="${escHtml(searchSt)}">
            ${searchSt
              ? `<span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:12px;
                              background:${sStyle.bg};color:${sStyle.color};white-space:nowrap;">
                   ${escHtml(searchSt)}</span>`
              : '<span style="color:var(--muted);font-size:.78rem;">—</span>'}
          </td>
          <td data-field="Short Citation" data-val="${escHtml(shortCite)}" style="font-size:.78rem;color:var(--muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escHtml(shortCite)||'—'}
          </td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm"
              onclick="openEditModal('Sources','${s.id}',${safeRec})">Edit</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No sources in this category.</td></tr>`;

  el.innerHTML = `
    <div id="sources-alert" data-grid-alert="Sources"></div>
    <div class="src-stats-row">${statCards}</div>
    ${gridBulkBarHtml('Sources')}
    <div style="overflow-x:auto;">
      <table class="data-table sources-table" data-grid-table="Sources" style="min-width:980px;">
        <thead><tr>
          <th>Source Name</th><th>Type</th><th>Record Type</th>
          <th>Repository</th><th>Search Status</th><th>Short Citation</th><th></th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${_pgBarHtml('Sources', pgS, pgsS, totS)}`;
  initGrid('Sources');
}

function setSrcFilter(key) {
  activeSrcFilter = key;
  _pgState['Sources'] = 1;
  renderSourcesPage();
}


async function loadDNA() {
  const el = document.getElementById('dna-content');
  el.innerHTML = '<span class="spinner"></span>';
  try {
    const { testing, matches } = await api('/api/dna-all');
    allDNATestingCache = testing;
    allDNAMatchesCache = matches;
    renderDNAPage(testing, matches);
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderDNAPage(testing, matches) {
  const el = document.getElementById('dna-content');

  const { slice: testingPage, page: pgDT, pages: pgsDT, total: totDT } = _pgSlice(testing, 'DNA Testing');
  const { slice: matchesPage, page: pgDM, pages: pgsDM, total: totDM } = _pgSlice(matches,  'DNA Matches');

  const renderTestingRows = testingPage.length
    ? testingPage.map(d => {
        const label   = d['Test Label ★'] || d['Name ★'] || d.Name || '';
        const company = d['Company'] || d['Testing Company'] || '';
        const type    = d['Test Type'] || '';
        const haplo   = d['Haplogroup'] || '';
        const notes   = d['Analysis Notes'] || d['Notes'] || '';
        const subject = Array.isArray(d['Full Name ★ (from Test Subject)'])
          ? d['Full Name ★ (from Test Subject)'].join(', ') : '';
        const safeRec = JSON.stringify(d).replace(/</g,'\\u003c').replace(/"/g,'&quot;');
        return `<tr data-id="${escHtml(d.id)}">
          <td data-field="Test Label ★" data-val="${escHtml(label)}" style="font-weight:600;">${escHtml(label)||'—'}</td>
          <td style="font-size:.8rem;color:var(--muted);">${escHtml(subject)||'—'}</td>
          <td data-field="Company" data-val="${escHtml(company)}">${escHtml(company)||'—'}</td>
          <td data-field="Test Type" data-val="${escHtml(type)}" style="font-size:.82rem;">${escHtml(type)||'—'}</td>
          <td data-field="Haplogroup" data-val="${escHtml(haplo)}" style="font-size:.78rem;color:var(--muted);">${escHtml(haplo)||'—'}</td>
          <td data-field="Analysis Notes" data-val="${escHtml(notes)}" style="font-size:.76rem;color:var(--muted);max-width:200px;">${escHtml(notes.substring(0,80))}${notes.length>80?'…':''}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="openEditModal('DNA Testing','${d.id}',${safeRec})">Edit</button></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">${totDT === 0 ? 'No DNA tests recorded yet.' : 'No records on this page.'}</td></tr>`;

  const CORR_STATUS_STYLE = {
    'Contacted':     { bg:'#0d1e2a', color:'#7ec8ef' },
    'Not Contacted': { bg:'var(--surface2)', color:'var(--muted)' },
    'No Response':   { bg:'#2a1a0d', color:'#e2a85c' },
    'Responded':     { bg:'#0d2a1a', color:'#4caf7d' },
    'Shared Tree':   { bg:'#2a2010', color:'var(--accent)' },
    'Unresponsive':  { bg:'#2a0d0d', color:'var(--danger)' },
  };

  const renderMatchRows = matchesPage.length
    ? matchesPage.map(m => {
        const name        = m['Match Name ★'] || '';
        const sharedCm    = m['Shared cM']    != null ? String(m['Shared cM'])    : '';
        const sharedSeg   = m['Shared Segments'] != null ? String(m['Shared Segments']) : '';
        const longestSeg  = m['Longest Segment'] != null ? String(m['Longest Segment']) : '';
        const predRel     = m['Predicted Relationship']      || '';
        const likelyRel   = m['Likely Actual Relationship']  || '';
        const cluster     = m['Clustering Group']            || '';
        const corrStatus  = m['Correspondence Status']       || '';
        const cs          = CORR_STATUS_STYLE[corrStatus] || { bg:'var(--surface2)', color:'var(--muted)' };
        const linkedPersonIds   = Array.isArray(m['Linked Person in Tree']) ? m['Linked Person in Tree'] : [];
        const linkedPersonNames = Array.isArray(m['Full Name (from Linked Person in Tree)'])
          ? m['Full Name (from Linked Person in Tree)']
          : (m['Full Name (from Linked Person in Tree)'] ? [m['Full Name (from Linked Person in Tree)']] : []);
        const notes       = m['Notes'] || '';
        const safeRec     = JSON.stringify(m).replace(/</g,'\\u003c').replace(/"/g,'&quot;');
        return `<tr data-id="${escHtml(m.id)}">
          <td data-field="Match Name ★" data-val="${escHtml(name)}" style="font-weight:600;min-width:140px;">${escHtml(name)||'—'}</td>
          <td data-field="Shared cM" data-val="${escHtml(sharedCm)}" style="white-space:nowrap;">
            ${sharedCm ? `<strong>${escHtml(sharedCm)}</strong> cM` : '—'}
          </td>
          <td data-field="Shared Segments" data-val="${escHtml(sharedSeg)}" style="text-align:center;">${escHtml(sharedSeg)||'—'}</td>
          <td data-field="Longest Segment" data-val="${escHtml(longestSeg)}" style="text-align:center;">${escHtml(longestSeg)||'—'}</td>
          <td data-field="Predicted Relationship" data-val="${escHtml(predRel)}" style="font-size:.8rem;">${escHtml(predRel)||'—'}</td>
          <td data-field="Likely Actual Relationship" data-val="${escHtml(likelyRel)}" style="font-size:.8rem;color:var(--accent);">${escHtml(likelyRel)||'—'}</td>
          <td data-field="Clustering Group" data-val="${escHtml(cluster)}" style="font-size:.75rem;color:var(--muted);">${escHtml(cluster)||'—'}</td>
          <td data-field="Correspondence Status" data-val="${escHtml(corrStatus)}">
            ${corrStatus
              ? `<span style="font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;background:${cs.bg};color:${cs.color};">${escHtml(corrStatus)}</span>`
              : '<span style="color:var(--muted)">—</span>'}
          </td>
          <td style="font-size:.78rem;">${renderPersonLinks(linkedPersonIds, linkedPersonNames)}</td>
          <td data-field="Notes" data-val="${escHtml(notes)}" style="font-size:.75rem;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(notes.substring(0,80))}${notes.length>80?'…':''}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="openEditModal('DNA Matches','${m.id}',${safeRec})">Edit</button></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--muted);">${totDM === 0 ? 'No DNA matches recorded yet.' : 'No records on this page.'}</td></tr>`;

  el.innerHTML = `
    <div id="dna-alert" data-grid-alert="DNA Testing"></div>
    <div data-grid-alert="DNA Matches" style="display:none;"></div>

    <!-- DNA Testing table -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div class="section-title" style="margin:0;">DNA Tests <span style="font-weight:400;color:var(--muted);font-size:.8rem;">(${totDT})</span></div>
      <button class="btn btn-secondary btn-sm" onclick="openAddModal('DNA Testing')">+ Add Test</button>
    </div>
    ${gridBulkBarHtml('DNA Testing')}
    <div style="overflow-x:auto;margin-bottom:4px;">
      <table class="data-table dna-table" data-grid-table="DNA Testing">
        <thead><tr>
          <th>Test Label</th><th>Person Tested</th><th>Company</th>
          <th>Test Type</th><th>Haplogroup</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>${renderTestingRows}</tbody>
      </table>
    </div>
    ${_pgBarHtml('DNA Testing', pgDT, pgsDT, totDT)}

    <!-- DNA Matches table -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;margin-top:20px;">
      <div class="section-title" style="margin:0;">DNA Matches <span style="font-weight:400;color:var(--muted);font-size:.8rem;">(${totDM})</span></div>
      <button class="btn btn-primary btn-sm" onclick="openAddModal('DNA Matches')">+ Add Match</button>
    </div>
    ${gridBulkBarHtml('DNA Matches')}
    <div style="overflow-x:auto;">
      <table class="data-table dna-table dna-matches" data-grid-table="DNA Matches">
        <thead><tr>
          <th>Match Name</th><th>Shared cM</th><th>Segments</th><th>Longest</th>
          <th>Predicted Relationship</th><th>Likely Relationship</th>
          <th>Cluster</th><th>Correspondence</th><th>Linked Person</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>${renderMatchRows}</tbody>
      </table>
    </div>
    ${_pgBarHtml('DNA Matches', pgDM, pgsDM, totDM)}`;
  initGrid('DNA Testing');
  initGrid('DNA Matches');
}

// ── Format-type icons for archive items ──────────────────────────────────────
const _SVG = {
  photo:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  doc:     `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  mail:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  book:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  map:     `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
  news:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="18" y1="6" x2="12" y2="6"/><line x1="18" y1="10" x2="12" y2="10"/><line x1="18" y1="14" x2="12" y2="14"/></svg>`,
  audio:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  video:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  file:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  legal:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  folder:  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
};
const FORMAT_ICONS = {
  'Photographs':   { icon: _SVG.photo, color: '#c9a84c' },
  'Photograph':    { icon: _SVG.photo, color: '#c9a84c' },
  'Documents':     { icon: _SVG.doc,   color: '#7ec8ef' },
  'Document':      { icon: _SVG.doc,   color: '#7ec8ef' },
  'Correspondence':{ icon: _SVG.mail,  color: '#a78bfa' },
  'Photocopies':   { icon: _SVG.doc,   color: '#94a3b8' },
  'Obituaries':    { icon: _SVG.doc,   color: '#e2a85c' },
  'Books':         { icon: _SVG.book,  color: '#4caf7d' },
  'Book':          { icon: _SVG.book,  color: '#4caf7d' },
  'Maps':          { icon: _SVG.map,   color: '#60a5fa' },
  'Map':           { icon: _SVG.map,   color: '#60a5fa' },
  'Newspapers':    { icon: _SVG.news,  color: '#fbbf24' },
  'Newspaper':     { icon: _SVG.news,  color: '#fbbf24' },
  'Blueprints':    { icon: _SVG.map,   color: '#38bdf8' },
  'Artwork':       { icon: _SVG.photo, color: '#f472b6' },
  'Audio':         { icon: _SVG.audio, color: '#34d399' },
  'Video':         { icon: _SVG.video, color: '#fb7185' },
  'Digital Files ':{ icon: _SVG.file,  color: '#7ec8ef' },
  'Digital Files': { icon: _SVG.file,  color: '#7ec8ef' },
  'Legal Docs':    { icon: _SVG.legal, color: '#a78bfa' },
  '35mm Slides':   { icon: _SVG.photo, color: '#fb923c' },
};

const COLLECTION_STATUS_STYLE = {
  'Active':      { bg:'#0d2a1a', color:'#4caf7d' },
  'Processing':  { bg:'#2a2010', color:'#c9a84c' },
  'Closed':      { bg:'var(--surface2)', color:'var(--muted)' },
  'Restricted':  { bg:'#2a0d0d', color:'#e05555' },
};

let allArchivesCache    = [];
let allCollectionsCache = [];

async function loadArchivesPage() {
  const galEl  = document.getElementById('archive-gallery');
  const colEl  = document.getElementById('collections-grid');
  if (galEl) galEl.innerHTML = '<span class="spinner"></span>';
  if (colEl) colEl.innerHTML = '<span class="spinner"></span>';

  try {
    const { archives, collections } = await api('/api/archives-full');
    allArchivesCache    = archives    || [];
    allCollectionsCache = collections || [];

    renderCollectionsSection(allCollectionsCache);
    renderArchiveGallery(allArchivesCache);
    updateArchiveTotalStrip(allArchivesCache.length);
  } catch (err) {
    if (galEl) galEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderCollectionsSection(collections) {
  const el = document.getElementById('collections-grid');
  const cntEl = document.getElementById('collections-count');
  if (!el) return;
  if (cntEl) cntEl.textContent = collections.length ? `${collections.length} collections` : '';

  if (!collections.length) {
    el.innerHTML = emptyState('folder', 'No collections yet. Click "+ New Collection" to start.');
    return;
  }

  el.innerHTML = collections.map(c => {
    const name       = c['Collection Name ★'] || 'Untitled Collection';
    const status     = c['Status'] || '';
    const desc       = c['Description'] || '';
    const ss         = COLLECTION_STATUS_STYLE[status] || COLLECTION_STATUS_STYLE['Closed'];
    // Archive count: use linked Archive Record array
    const archiveIds = Array.isArray(c['Archive Record']) ? c['Archive Record'] : [];
    const itemCount  = archiveIds.length;
    // Format chips from linked items or just show status
    const formats    = Array.isArray(c['Formats Included']) ? c['Formats Included'] : [];
    const safeRec    = JSON.stringify(c).replace(/</g,'\\u003c').replace(/"/g,'&quot;');

    // Extract family name from collection name (e.g. "The Hill Papers" → "Hill")
    const familyMatch = name.match(/The\s+(\w+)\s+Papers?/i);
    const familyName  = familyMatch ? familyMatch[1] : name.split(' ')[0];
    const initials    = familyName.slice(0,2).toUpperCase();

    return `<div class="collection-card">
      <div class="collection-card-header">
        <div class="collection-avatar">${initials}</div>
        <div style="flex:1;min-width:0;">
          <div class="collection-name">${escHtml(name)}</div>
          ${status ? `<span class="collection-status-badge" style="background:${ss.bg};color:${ss.color};">${escHtml(status)}</span>` : ''}
        </div>
        <div class="collection-card-actions">
          <button class="btn btn-secondary btn-xs" onclick="openEditModal('Collections','${c.id}',${safeRec})" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        </div>
      </div>
      ${desc ? `<div class="collection-desc">${escHtml(desc.length > 120 ? desc.slice(0,120)+'…' : desc)}</div>` : ''}
      <div class="collection-card-footer">
        <span class="collection-item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
        ${formats.length ? `<span class="collection-formats">${formats.slice(0,3).map(f => escHtml(f)).join(' · ')}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderArchiveGallery(archives) {
  const el = document.getElementById('archive-gallery');
  if (!el) return;

  if (!archives.length) {
    el.innerHTML = emptyState('folder', 'No archival items found. Use the Archive Scanner or "+ Add Item" to start.');
    return;
  }

  el.innerHTML = archives.map(a => {
    const title     = a['Accession Number ★'] || a['Name ★'] || 'Untitled';
    const desc      = a['Description'] || '';
    const formats   = Array.isArray(a['Formats Included']) ? a['Formats Included'] : (a['Format Type'] ? [a['Format Type']] : []);
    const date      = a['Inclusive Dates'] || a['Accession Date'] || a['Estimated Date'] || '';
    const condition = a['Condition'] || '';
    const donor     = Array.isArray(a['Name (from Donor)']) ? a['Name (from Donor)'][0] : (a['Name (from Donor)'] || '');

    // Pick icon from first format type
    const primaryFormat = formats[0] || '';
    const fmt = FORMAT_ICONS[primaryFormat] || { icon: _SVG.folder, color: '#888' };
    const imageUrl  = a['Image URL'] || '';
    const safeRec   = JSON.stringify(a).replace(/</g,'\\u003c').replace(/"/g,'&quot;');

    const thumbHtml = imageUrl
      ? `<img src="${escHtml(imageUrl)}" alt="${escHtml(title)}"
           style="width:100%;height:120px;object-fit:cover;display:block;"
           onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
         <div class="archive-gallery-icon-fallback" style="display:none;height:120px;align-items:center;justify-content:center;background:${fmt.color}22;">
           <span class="archive-gallery-icon">${fmt.icon}</span>
         </div>`
      : `<span class="archive-gallery-icon">${fmt.icon}</span>`;

    return `<div class="archive-gallery-item">
      <div class="archive-gallery-thumb" style="${imageUrl ? 'padding:0;overflow:hidden;' : `background:${fmt.color}22;border-color:${fmt.color}44;`}">
        ${thumbHtml}
      </div>
      <div class="archive-gallery-info">
        <div class="archive-gallery-title" title="${escHtml(title)}">${escHtml(title)}</div>
        ${formats.length ? `<div class="archive-gallery-formats">${formats.slice(0,2).map(f => `<span class="archive-format-chip">${escHtml(f)}</span>`).join('')}</div>` : ''}
        ${date ? `<div class="archive-gallery-meta">${escHtml(String(date).replace(/\n/g,' ').trim())}</div>` : ''}
        ${donor ? `<div class="archive-gallery-meta" style="color:var(--muted);">${escHtml(donor)}</div>` : ''}
      </div>
      <div class="archive-gallery-actions">
        <button class="btn btn-secondary btn-xs" onclick="openEditModal('Archives','${a.id}',${safeRec})" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

function filterArchiveGallery(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderArchiveGallery(allArchivesCache); return; }
  const filtered = allArchivesCache.filter(a => {
    const haystack = [
      a['Accession Number ★'], a['Name ★'], a['Description'],
      a['Condition'], a['Inclusive Dates'], a['Accession Date'],
      ...(Array.isArray(a['Formats Included']) ? a['Formats Included'] : []),
      ...(Array.isArray(a['Name (from Donor)']) ? a['Name (from Donor)'] : []),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
  renderArchiveGallery(filtered);
  updateArchiveTotalStrip(filtered.length, allArchivesCache.length);
}

function updateArchiveTotalStrip(shown, total) {
  const el = document.getElementById('archive-total-strip');
  if (!el) return;
  if (total !== undefined && total !== shown) {
    el.innerHTML = `<span>Showing <strong>${shown}</strong> of <strong>${total}</strong> items</span>`;
  } else {
    el.innerHTML = `<span>Total Items: <strong>${shown}</strong></span>`;
  }
}

// ── Archive Scanner ───────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(Array.from(e.dataTransfer.files));
});

function handleFileSelect(event) {
  handleFiles(Array.from(event.target.files));
  event.target.value = '';
}

function handleFiles(files) {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) return;

  if (imageFiles.length === 1) {
    processSingleFile(imageFiles[0]);
  } else {
    addToQueue(imageFiles);
  }
}

function processSingleFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const match   = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return;

    state.currentImageB64  = match[2];
    state.currentImageType = match[1];

    document.getElementById('preview-img').src = dataUrl;
    document.getElementById('single-preview').style.display = 'flex';
    document.getElementById('bulk-queue').style.display     = 'none';

    await generateMetadataForCurrent();
  };
  reader.readAsDataURL(file);
}

async function generateMetadataForCurrent() {
  const spinnerEl  = document.getElementById('preview-spinner');
  const resultEl   = document.getElementById('metadata-result');
  const standard   = document.getElementById('metadata-standard').value;

  spinnerEl.style.display = 'inline-flex';
  resultEl.classList.remove('active');
  state.currentMetadata = null;

  try {
    const metadata = await api('/api/metadata', {
      method: 'POST',
      body:   JSON.stringify({
        base64:   `data:${state.currentImageType};base64,${state.currentImageB64}`,
        standard,
      }),
    });
    state.currentMetadata = metadata;
    renderMetadataFields(metadata, 'metadata-fields');
    resultEl.classList.add('active');
  } catch (err) {
    showAlert('archive-alert', `Metadata error: ${err.message}`, 'error');
  } finally {
    spinnerEl.style.display = 'none';
  }
}

async function regenerateMetadata() {
  await generateMetadataForCurrent();
}

function renderMetadataFields(metadata, containerId) {
  const el = document.getElementById(containerId);
  const labels = {
    title:         'Title',
    date:          'Date',
    creator:       'Creator',
    description:   'Description',
    format:        'Format',
    condition:     'Condition',
    tags:          'Subject Tags',
    transcription: 'Transcription',
    location:      'Location',
  };
  el.innerHTML = Object.entries(labels)
    .filter(([k]) => metadata[k])
    .map(([k, label]) => `
      <div class="metadata-field">
        <div class="key">${label}</div>
        <div class="val">${escHtml(String(metadata[k]))}</div>
      </div>`).join('');
}

async function saveCurrentMetadata() {
  if (!state.currentMetadata) {
    showAlert('archive-alert', 'No metadata to save.', 'error');
    return;
  }
  try {
    // 1 — Upload the image file to the server
    let imageUrl = null;
    if (state.currentImageB64 && state.currentImageType) {
      const blob     = base64ToBlob(state.currentImageB64, state.currentImageType);
      const formData = new FormData();
      formData.append('image', blob, `archive-${Date.now()}.${state.currentImageType.split('/')[1] || 'jpg'}`);
      const uploadRes = await fetch('/api/upload-archive-image', { method: 'POST', body: formData, headers: { Authorization: 'Bearer ' + getToken() } });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.imageUrl;
      }
    }

    // 2 — Save the archive record with imageUrl + full metadata JSON
    await api('/api/save-archive', {
      method: 'POST',
      body:   JSON.stringify({
        ...state.currentMetadata,
        imageUrl,
        aiMetadata: state.currentMetadata,
        accessionDate: new Date().toISOString().slice(0,10),
      }),
    });
    showAlert('archive-alert', 'Archive item saved to Airtable.');
    loadedPages.delete('archives');
    if (document.getElementById('page-archives')?.classList.contains('active')) {
      showPage('archives');
    }
  } catch (err) {
    showAlert('archive-alert', `Save failed: ${err.message}`, 'error');
  }
}

// ── Bulk queue ────────────────────────────────────────────────────────────────
function addToQueue(files) {
  state.bulkQueue.push(...files);
  document.getElementById('single-preview').style.display = 'none';
  document.getElementById('bulk-queue').style.display     = 'block';
  document.getElementById('queue-count').textContent      = state.bulkQueue.length;

  const listEl = document.getElementById('queue-list');
  listEl.innerHTML = state.bulkQueue.map((f, i) =>
    `<div style="font-size:.82rem;padding:4px 0;color:var(--muted);">${i + 1}. ${escHtml(f.name)}</div>`
  ).join('');
}

function clearQueue() {
  state.bulkQueue   = [];
  state.bulkResults = [];
  document.getElementById('bulk-queue').style.display   = 'none';
  document.getElementById('bulk-results').innerHTML     = '';
  document.getElementById('queue-count').textContent    = '0';
  document.getElementById('bulk-progress').style.display = 'none';
}

async function processBulkQueue() {
  if (!state.bulkQueue.length) return;
  const standard    = document.getElementById('metadata-standard').value;
  const progressEl  = document.getElementById('bulk-progress');
  const barEl       = document.getElementById('progress-bar');
  const labelEl     = document.getElementById('progress-label');
  const resultsEl   = document.getElementById('bulk-results');

  progressEl.style.display = 'block';
  resultsEl.innerHTML      = '';
  state.bulkResults        = [];

  for (let i = 0; i < state.bulkQueue.length; i++) {
    const file = state.bulkQueue[i];
    const pct  = Math.round(((i) / state.bulkQueue.length) * 100);
    barEl.style.width     = `${pct}%`;
    labelEl.textContent   = `Processing ${i + 1} of ${state.bulkQueue.length}: ${file.name}`;

    try {
      const b64 = await fileToBase64(file);
      const metadata = await api('/api/metadata', {
        method: 'POST',
        body:   JSON.stringify({ base64: b64, standard }),
      });
      state.bulkResults.push({ file: file.name, metadata, error: null, b64, mimeType: b64.match(/^data:([^;]+)/)?.[1] });

      resultsEl.innerHTML += `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:.88rem;">${escHtml(file.name)}</strong>
            <button class="btn btn-success btn-sm" onclick="saveBulkResult(${i})">Save</button>
          </div>
          <div id="bulk-meta-${i}"></div>
        </div>`;
      renderMetadataFields(metadata, `bulk-meta-${i}`);
    } catch (err) {
      resultsEl.innerHTML += `<div class="alert alert-error"><strong>${escHtml(file.name)}</strong>: ${err.message}</div>`;
      state.bulkResults.push({ file: file.name, metadata: null, error: err.message });
    }
  }

  barEl.style.width   = '100%';
  labelEl.textContent = `Done — ${state.bulkQueue.length} images processed.`;
}

async function saveBulkResult(index) {
  const result = state.bulkResults[index];
  if (!result?.metadata) return;
  try {
    // Upload the image for this bulk item
    let imageUrl = null;
    if (result.b64 && result.mimeType) {
      const blob     = base64ToBlob(result.b64.replace(/^data:[^;]+;base64,/, ''), result.mimeType);
      const formData = new FormData();
      formData.append('image', blob, `archive-${Date.now()}-${index}.${result.mimeType.split('/')[1] || 'jpg'}`);
      const uploadRes = await fetch('/api/upload-archive-image', { method: 'POST', body: formData, headers: { Authorization: 'Bearer ' + getToken() } });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.imageUrl;
      }
    }

    await api('/api/save-archive', {
      method: 'POST',
      body:   JSON.stringify({
        ...result.metadata,
        imageUrl,
        aiMetadata: result.metadata,
        accessionDate: new Date().toISOString().slice(0,10),
      }),
    });
    showAlert('archive-alert', `"${result.file}" saved to Airtable.`);
    loadedPages.delete('archives');
    if (document.getElementById('page-archives')?.classList.contains('active')) {
      showPage('archives');
    }
  } catch (err) {
    showAlert('archive-alert', `Save failed: ${err.message}`, 'error');
  }
}

function base64ToBlob(base64, mimeType) {
  const bytes  = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mimeType });
}

// ── Modal image upload handler ────────────────────────────────────────────────
// uploadEndpoint and urlFieldId are embedded in the image field definition
async function handleModalImageUpload(input, fid, uploadEndpoint, urlFieldId) {
  const file     = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById(`${fid}-status`);
  const urlField = document.getElementById(urlFieldId || 'mf-Image_URL');
  const endpoint = uploadEndpoint || '/api/upload-archive-image';

  if (statusEl) statusEl.textContent = 'Uploading…';

  try {
    const formData = new FormData();
    formData.append('image', file, file.name);
    const res  = await fetch(endpoint, { method: 'POST', body: formData, headers: { Authorization: 'Bearer ' + getToken() } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    // Show thumbnail preview above the upload button
    const reader = new FileReader();
    reader.onload = e => {
      const label = document.getElementById(`${fid}-file`).closest('label');
      let preview = label.previousElementSibling;
      if (!preview || preview.tagName !== 'IMG') {
        preview = document.createElement('img');
        preview.style.cssText = 'max-width:100%;max-height:160px;border-radius:8px;margin-bottom:6px;display:block;object-fit:cover;';
        label.parentNode.insertBefore(preview, label);
      }
      preview.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Auto-fill the paired URL field
    if (urlField) urlField.value = data.imageUrl;
    if (statusEl) statusEl.textContent = `Uploaded`;
  } catch (err) {
    if (statusEl) statusEl.textContent = `Upload failed: ${err.message}`;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── CRUD Modal ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ── Interactive Grid Engine ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const GRID_TABLES = {
  'People': {
    getCache:    () => allPeopleCache,
    removeIds:   (ids) => { allPeopleCache = allPeopleCache.filter(r => !ids.includes(r.id)); },
    updateField: (id, f, v) => { const r = allPeopleCache.find(x => x.id === id); if (r) r[f] = v; },
    rerender:    () => renderAncestorsTable(),
  },
  'Research Questions': {
    getCache:    () => allQuestionsCache,
    removeIds:   (ids) => { allQuestionsCache = allQuestionsCache.filter(r => !ids.includes(r.id)); },
    updateField: (id, f, v) => { const r = allQuestionsCache.find(x => x.id === id); if (r) r[f] = v; },
    rerender:    () => renderQuestionsPage(),
  },
  'Sources': {
    getCache:    () => allSourcesCache,
    removeIds:   (ids) => { allSourcesCache = allSourcesCache.filter(r => !ids.includes(r.id)); },
    updateField: (id, f, v) => { const r = allSourcesCache.find(x => x.id === id); if (r) r[f] = v; },
    rerender:    () => renderSourcesPage(),
  },
  'DNA Testing': {
    getCache:    () => allDNATestingCache,
    removeIds:   (ids) => { allDNATestingCache = allDNATestingCache.filter(r => !ids.includes(r.id)); },
    updateField: (id, f, v) => { const r = allDNATestingCache.find(x => x.id === id); if (r) r[f] = v; },
    rerender:    () => renderDNAPage(allDNATestingCache, allDNAMatchesCache),
  },
  'DNA Matches': {
    getCache:    () => allDNAMatchesCache,
    removeIds:   (ids) => { allDNAMatchesCache = allDNAMatchesCache.filter(r => !ids.includes(r.id)); },
    updateField: (id, f, v) => { const r = allDNAMatchesCache.find(x => x.id === id); if (r) r[f] = v; },
    rerender:    () => renderDNAPage(allDNATestingCache, allDNAMatchesCache),
  },
  'Research Log': {
    getCache:    () => researchLogCache,
    removeIds:   (ids) => { researchLogCache = researchLogCache.filter(r => !ids.includes(r.id)); },
    updateField: (id, f, v) => { const r = researchLogCache.find(x => x.id === id); if (r) r[f] = v; },
    rerender:    () => renderResearchLogPage(researchLogCache, researchLogPersonMap),
  },
};

// ── Bulk bar / alert HTML helpers ─────────────────────────────────────────────
function gridBulkBarHtml(tableName) {
  const tn = escHtml(tableName);
  return `<div class="grid-bulk-bar" data-table="${tn}">
    <span class="grid-bulk-count"></span>
    <button class="btn btn-danger btn-sm"     onclick="gridDeleteSelected('${tn}')">Delete Selected</button>
    <button class="btn btn-secondary btn-sm"  onclick="gridShowBulkEdit('${tn}')">Edit Field…</button>
    <button class="btn btn-secondary btn-sm"  onclick="gridClearSel('${tn}')">Clear</button>
  </div>`;
}

// ── Per-table selection state ─────────────────────────────────────────────────
const _gridSel = (() => {
  const map = {};
  return (t) => { if (!map[t]) map[t] = new Set(); return map[t]; };
})();

// ── Apply checkboxes + click-to-edit to a rendered table ─────────────────────
function initGrid(tableName) {
  const table = document.querySelector(`table[data-grid-table="${tableName}"]`);
  if (!table) return;

  // Header checkbox
  const hRow = table.querySelector('thead tr');
  if (hRow && !hRow.querySelector('.grid-th-check')) {
    const th = document.createElement('th');
    th.className = 'grid-th-check';
    th.innerHTML = `<input type="checkbox" class="grid-sel-all"
      style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent);"
      title="Select / deselect all visible rows"
      onchange="gridToggleAll(this,'${escHtml(tableName)}')" />`;
    hRow.insertBefore(th, hRow.firstChild);
  }

  // Row checkboxes
  table.querySelectorAll('tbody tr[data-id]').forEach(tr => {
    if (tr.querySelector('.grid-td-check')) return;
    const id = tr.dataset.id;
    const td = document.createElement('td');
    td.className = 'grid-td-check';
    td.innerHTML = `<input type="checkbox" class="grid-row-check"
      data-id="${escHtml(id)}"
      style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent);"
      onchange="gridRowChange(this,'${escHtml(tableName)}')" />`;
    tr.insertBefore(td, tr.firstChild);
  });

  // Restore selection
  const sel = _gridSel(tableName);
  sel.forEach(id => {
    const cb = table.querySelector(`.grid-row-check[data-id="${id}"]`);
    if (cb) cb.checked = true;
  });
  _gridUpdateBar(tableName);

  // Wire inline-edit on data-field cells
  table.querySelectorAll('td[data-field]').forEach(td => {
    const fresh = td.cloneNode(true);
    fresh.addEventListener('click', (e) => {
      if (e.target.closest('a,button,select,input,textarea')) return;
      if (fresh.classList.contains('cell-editing')) return;
      startCellEdit(fresh, tableName);
    });
    td.parentNode.replaceChild(fresh, td);
  });
}

function gridRowChange(cb, tableName) {
  if (cb.checked) _gridSel(tableName).add(cb.dataset.id);
  else _gridSel(tableName).delete(cb.dataset.id);
  _gridUpdateBar(tableName);
}

function gridToggleAll(masterCb, tableName) {
  const table = document.querySelector(`table[data-grid-table="${tableName}"]`);
  const sel = _gridSel(tableName);
  sel.clear();
  if (table) {
    table.querySelectorAll('.grid-row-check').forEach(cb => {
      cb.checked = masterCb.checked;
      if (masterCb.checked) sel.add(cb.dataset.id);
    });
  }
  _gridUpdateBar(tableName);
}

function gridClearSel(tableName) {
  _gridSel(tableName).clear();
  const table = document.querySelector(`table[data-grid-table="${tableName}"]`);
  if (table) {
    table.querySelectorAll('.grid-row-check').forEach(cb => { cb.checked = false; });
    const m = table.querySelector('.grid-sel-all');
    if (m) { m.checked = false; m.indeterminate = false; }
  }
  _gridUpdateBar(tableName);
}

function _gridUpdateBar(tableName) {
  const bar = document.querySelector(`.grid-bulk-bar[data-table="${tableName}"]`);
  if (!bar) return;
  const sel = _gridSel(tableName);
  const n = sel.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  const cEl = bar.querySelector('.grid-bulk-count');
  if (cEl) cEl.textContent = `${n} row${n !== 1 ? 's' : ''} selected`;
  const table = document.querySelector(`table[data-grid-table="${tableName}"]`);
  if (table) {
    const total = table.querySelectorAll('.grid-row-check').length;
    const m = table.querySelector('.grid-sel-all');
    if (m) { m.indeterminate = n > 0 && n < total; m.checked = total > 0 && n === total; }
  }
}

function gridShowAlert(tableName, msg, type = 'success') {
  const el = document.querySelector(`[data-grid-alert="${tableName}"]`);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}" style="margin-bottom:10px;">${escHtml(msg)}</div>`;
  if (type === 'success') setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
}

// ── Bulk Delete ───────────────────────────────────────────────────────────────
async function gridDeleteSelected(tableName) {
  const sel = _gridSel(tableName);
  const ids = [...sel];
  if (!ids.length) return;
  const gt = GRID_TABLES[tableName];
  if (!gt) return;
  const names = ids.map(id => {
    const r = gt.getCache().find(x => x.id === id);
    if (!r) return id;
    const pk = Object.keys(r).find(k => k.includes('★'));
    return String(r[pk] || id).substring(0, 60);
  });
  if (!confirm(`Permanently delete ${ids.length} record${ids.length !== 1 ? 's' : ''}?\n\n• ${names.slice(0,7).join('\n• ')}${names.length > 7 ? `\n  …and ${names.length - 7} more` : ''}\n\nThis cannot be undone.`)) return;
  try {
    for (const id of ids) {
      await api(`/api/record/${encodeURIComponent(tableName)}/${id}`, { method: 'DELETE' });
    }
    gt.removeIds(ids);
    sel.clear();
    gt.rerender();
    const msg = `${ids.length} record${ids.length !== 1 ? 's' : ''} deleted.`;
    gridShowAlert(tableName, msg);
    showToast(msg);
  } catch (err) {
    const msg = `Delete failed: ${err.message}`;
    gridShowAlert(tableName, msg, 'error');
    showToast(msg, 'error');
  }
}

// ── Bulk Edit panel ───────────────────────────────────────────────────────────
function gridShowBulkEdit(tableName) {
  const sel = _gridSel(tableName);
  if (!sel.size) return;
  document.getElementById('_gbf-overlay')?.remove();
  document.getElementById('_gbf-panel')?.remove();

  // Build field list from TABLE_SCHEMAS (resolved lazily after definition)
  const schema = TABLE_SCHEMAS[tableName] || [];
  const fields = schema.filter(f => !f.field.startsWith('_') && ['text','textarea','select','date'].includes(f.type));
  const fieldOpts = fields.map(f =>
    `<option value="${escHtml(f.field)}" data-type="${escHtml(f.type)}"
      data-opts="${escHtml(JSON.stringify(f.options||[]))}">${escHtml(f.label||f.field)}</option>`
  ).join('');

  const overlay = Object.assign(document.createElement('div'), { id: '_gbf-overlay', className: 'grid-bulk-overlay' });
  const panel   = Object.assign(document.createElement('div'), { id: '_gbf-panel',   className: 'grid-bulk-panel' });
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;font-size:1rem;color:var(--accent);">Edit Field — ${sel.size} Record${sel.size!==1?'s':''}</h3>
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('_gbf-overlay')?.remove();document.getElementById('_gbf-panel')?.remove();" title="Close"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Field to Update</label>
      <select id="_gbf-field" onchange="_gbfFieldChange()">${fieldOpts}</select>
    </div>
    <div id="_gbf-val-wrap" class="form-group" style="margin-bottom:20px;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="document.getElementById('_gbf-overlay')?.remove();document.getElementById('_gbf-panel')?.remove();">Cancel</button>
      <button class="btn btn-primary" onclick="_gbfApply('${escHtml(tableName)}')">Apply to ${sel.size} Row${sel.size!==1?'s':''}</button>
    </div>`;
  overlay.onclick = () => { overlay.remove(); panel.remove(); };
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  _gbfFieldChange();
}

function _gbfFieldChange() {
  const sel = document.getElementById('_gbf-field');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const type = opt?.dataset.type || 'text';
  let options = [];
  try { options = JSON.parse(opt?.dataset.opts || '[]'); } catch {}
  const wrap = document.getElementById('_gbf-val-wrap');
  if (!wrap) return;
  let inp = '';
  if (type === 'select') {
    inp = `<select id="_gbf-value">${options.map(o=>`<option value="${escHtml(o)}">${escHtml(o)||'—'}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    inp = `<textarea id="_gbf-value" rows="3" placeholder="New value…"></textarea>`;
  } else if (type === 'date') {
    inp = `<input type="date" id="_gbf-value" />`;
  } else {
    inp = `<input type="text" id="_gbf-value" placeholder="New value…" />`;
  }
  wrap.innerHTML = `<label>${escHtml(opt?.text||'Value')}</label>${inp}`;
}

async function _gbfApply(tableName) {
  const fieldSel = document.getElementById('_gbf-field');
  const valEl    = document.getElementById('_gbf-value');
  if (!fieldSel || !valEl) return;
  const field  = fieldSel.value;
  const newVal = valEl.value;
  const sel = _gridSel(tableName);
  const ids = [...sel];
  const gt  = GRID_TABLES[tableName];
  if (!gt || !ids.length) return;
  document.getElementById('_gbf-overlay')?.remove();
  document.getElementById('_gbf-panel')?.remove();
  try {
    for (const id of ids) {
      await api(`/api/record/${encodeURIComponent(tableName)}/${id}`, {
        method: 'PATCH', body: JSON.stringify({ fields: { [field]: newVal } }),
      });
      gt.updateField(id, field, newVal);
    }
    sel.clear();
    gt.rerender();
    const msg = `"${field}" updated on ${ids.length} record${ids.length!==1?'s':''}.`;
    gridShowAlert(tableName, msg);
    showToast(msg);
  } catch (err) {
    const msg = `Bulk edit failed: ${err.message}`;
    gridShowAlert(tableName, msg, 'error');
    showToast(msg, 'error');
  }
}

// ── Inline cell editing ───────────────────────────────────────────────────────
let _activeCellTd = null;

function startCellEdit(td, tableName) {
  if (td.classList.contains('cell-editing')) return;
  if (_activeCellTd && _activeCellTd !== td && _activeCellTd.dataset.orig !== undefined) {
    _activeCellTd.innerHTML = _activeCellTd.dataset.orig;
    _activeCellTd.classList.remove('cell-editing');
  }
  const field  = td.dataset.field;
  const curVal = td.dataset.val !== undefined ? td.dataset.val : td.textContent.trim();
  const recordId = td.closest('tr')?.dataset.id;
  if (!recordId || !field) return;

  const fSchema = (TABLE_SCHEMAS[tableName] || []).find(f => f.field === field);
  const type = fSchema?.type || 'text';

  td.dataset.orig = td.innerHTML;
  td.classList.add('cell-editing');
  _activeCellTd = td;

  const eid = '_cell-edit-active';
  let editor = '';
  if (type === 'select') {
    const opts = (fSchema.options||[]).map(o =>
      `<option value="${escHtml(o)}"${o===curVal?' selected':''}>${escHtml(o)||'—'}</option>`
    ).join('');
    editor = `<select id="${eid}" class="cell-editor cell-editor-select"
      onchange="commitCellEdit(this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')"
      onblur="commitCellEdit(this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')"
      onkeydown="_cellKey(event,this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')">${opts}</select>`;
  } else if (type === 'textarea') {
    editor = `<textarea id="${eid}" class="cell-editor cell-editor-ta" rows="3"
      onkeydown="_cellKey(event,this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')"
      onblur="commitCellEdit(this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')">${escHtml(curVal)}</textarea>`;
  } else {
    editor = `<input id="${eid}" class="cell-editor" type="text" value="${escHtml(curVal)}"
      onkeydown="_cellKey(event,this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')"
      onblur="commitCellEdit(this,'${recordId}','${escHtml(field)}','${escHtml(tableName)}')" />`;
  }
  td.innerHTML = editor;
  const el = document.getElementById(eid);
  if (el) { el.focus(); if (el.tagName==='INPUT') el.select(); }
}

function _cellKey(e, el, recordId, field, tableName) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitCellEdit(el, recordId, field, tableName); }
  else if (e.key === 'Escape') {
    const td = el.closest('td');
    if (td && td.dataset.orig !== undefined) { td.innerHTML = td.dataset.orig; td.classList.remove('cell-editing'); _activeCellTd = null; }
  }
}

async function commitCellEdit(el, recordId, field, tableName) {
  const td = el.closest('td');
  if (!td || !td.classList.contains('cell-editing')) return;
  if (td.dataset.committing) return;
  td.dataset.committing = '1';
  const newVal   = el.value;
  const origHtml = td.dataset.orig || '';
  td.innerHTML = `<span style="color:var(--muted);font-size:.74rem;font-style:italic;">saving…</span>`;
  td.classList.remove('cell-editing');
  _activeCellTd = null;
  try {
    await api(`/api/record/${encodeURIComponent(tableName)}/${recordId}`, {
      method: 'PATCH', body: JSON.stringify({ fields: { [field]: newVal } }),
    });
    GRID_TABLES[tableName]?.updateField(recordId, field, newVal);
    td.dataset.val = newVal;
    td.innerHTML = renderCellHtml(tableName, field, newVal);
    td.classList.add('cell-saved');
    setTimeout(() => td.classList.remove('cell-saved'), 800);
    td.addEventListener('click', (ev) => { if (!ev.target.closest('a,button')) startCellEdit(td, tableName); }, { once: false });
    showToast(`"${field}" saved.`);
  } catch (err) {
    td.innerHTML = origHtml;
    const msg = `Save failed: ${err.message}`;
    gridShowAlert(tableName, msg, 'error');
    showToast(msg, 'error');
    td.addEventListener('click', (ev) => { if (!ev.target.closest('a,button')) startCellEdit(td, tableName); }, { once: false });
  }
}

// Re-render a cell's display value after inline edit (handles badges/styled fields)
function renderCellHtml(tableName, field, value) {
  if (value === null || value === undefined || value === '') return '—';
  const v = String(value);
  if (tableName === 'Research Questions' && field === 'Status') {
    const cat = categorizeStatus(v);
    const color = { proven:'var(--success)', inprogress:'#efef7e', disproven:'var(--danger)', open:'var(--muted)' }[cat] || 'var(--muted)';
    return `<span style="font-size:.75rem;font-weight:600;color:${color};">${escHtml(v.substring(0,28))}${v.length>28?'…':''}</span>`;
  }
  if (tableName === 'Sources' && field === 'Search Status') {
    const S = { Found:{bg:'#0d2a0d',color:'#7ef87e'}, Searched:{bg:'#0d1e2a',color:'#7ec8ef'}, 'Not Found':{bg:'#2a0d0d',color:'#ef7e7e'}, 'Partially Searched':{bg:'#2a1a0d',color:'#efb87e'}, 'Search Pending':{bg:'#1a1a0d',color:'#efef7e'}, ' Search Pending':{bg:'#1a1a0d',color:'#efef7e'}, 'Not Yet':{bg:'var(--surface2)',color:'var(--muted)'} };
    const s = S[v] || { bg:'var(--surface2)', color:'var(--muted)' };
    return `<span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:12px;background:${s.bg};color:${s.color};white-space:nowrap;">${escHtml(v)}</span>`;
  }
  if (tableName === 'Sources' && field === 'Source Type') {
    const C = { primary:{bg:'#0d1e2a',color:'#7ec8ef'}, secondary:{bg:'#0d1e0d',color:'#a8d8a8'}, repository:{bg:'#1a0d2a',color:'#c494ef'}, dna:{bg:'#0d2020',color:'#7eefef'}, found:{bg:'#2a1a0d',color:'#efb87e'}, other:{bg:'var(--surface2)',color:'var(--muted)'} };
    const tc = C[categorizeSrcType(v)] || C.other;
    return `<span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:12px;background:${tc.bg};color:${tc.color};white-space:nowrap;">${escHtml(v)}</span>`;
  }
  if (tableName === 'Research Log' && field === 'Research Status') {
    const sc = RL_STATUS_COLORS[v] || RL_STATUS_COLORS['On Hold'];
    return `<span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:12px;background:${sc.bg};color:${sc.color};white-space:nowrap;">${escHtml(v)}</span>`;
  }
  if (tableName === 'DNA Matches' && field === 'Correspondence Status') {
    const CS = { Contacted:{bg:'#0d1e2a',color:'#7ec8ef'}, 'Not Contacted':{bg:'var(--surface2)',color:'var(--muted)'}, 'No Response':{bg:'#2a1a0d',color:'#e2a85c'}, Responded:{bg:'#0d2a1a',color:'#4caf7d'}, 'Shared Tree':{bg:'#2a2010',color:'var(--accent)'}, Unresponsive:{bg:'#2a0d0d',color:'var(--danger)'} };
    const cs = CS[v] || { bg:'var(--surface2)', color:'var(--muted)' };
    return `<span style="font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;background:${cs.bg};color:${cs.color};">${escHtml(v)}</span>`;
  }
  return escHtml(v);
}

const TABLE_SCHEMAS = {
  'People': [
    // ── Identity ──────────────────────────────────────────────────────────────
    { field: '_photoUpload',        type: 'image',    label: 'Photo',
      uploadEndpoint: '/api/upload-person-photo', urlFieldId: 'mf-Photo_URL',
      previewField: 'Photo URL' },
    { field: 'Photo URL',           type: 'text',     label: 'Photo URL (auto-filled on upload)' },
    { field: 'Full Name ★',         type: 'text',     label: 'Full Name', required: true },
    { field: 'Birth Name',          type: 'text',     label: 'Birth Name (if different)' },
    { field: 'Also Known As',       type: 'text',     label: 'Also Known As / Aliases' },
    { field: 'Sex',                 type: 'select',   label: 'Sex',
      options: ['','Male','Female','Unknown'] },
    { field: 'Race/Ethnicity (as recorded)', type: 'text', label: 'Race/Ethnicity (as recorded in sources)' },
    // ── Family position ───────────────────────────────────────────────────────
    { field: 'Generation Number',   type: 'select',   label: 'Generation Number (0 = self, 1 = parent…)',
      options: ['','0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20'] },
    { field: 'Relation to Self',    type: 'text',     label: 'Relation to Self (e.g. Paternal Great-Grandmother)' },
    { field: 'Line',                type: 'select',   label: 'Family Line',
      options: ['','Paternal','Maternal','Both','Unknown'] },
    // ── Vital dates & places ──────────────────────────────────────────────────
    { field: 'Birth Date',          type: 'text',     label: 'Birth Date' },
    { field: 'Birth Place',         type: 'text',     label: 'Birth Place' },
    { field: 'Death Date',          type: 'text',     label: 'Death Date' },
    { field: 'Death Place',         type: 'text',     label: 'Death Place' },
    { field: 'Burial Place',        type: 'text',     label: 'Burial Place' },
    // ── Online profiles ───────────────────────────────────────────────────────
    { field: 'Ancestry Profile URL', type: 'text',   label: 'Ancestry Profile URL' },
    { field: 'FamilySearch ID',     type: 'text',     label: 'FamilySearch ID (FSID)' },
    { field: 'Geni Profile URL',    type: 'text',     label: 'Geni.com Profile URL' },
    // ── Notes ─────────────────────────────────────────────────────────────────
    { field: 'Notes',               type: 'textarea', label: 'Notes' },
    // ── Linked records (read-only — managed from their own pages) ─────────────
    { field: '_linked_note', type: 'note',
      label: 'Linked Records',
      text:  'Research Questions, DNA Tests, Collections, Archives, Sources, DNA Matches, and Evidence Analysis are linked from their own pages.' },
  ],
  'Research Questions': [
    { field: 'Research Question ★', type: 'textarea', label: 'Research Question', required: true },
    { field: '_personLink', type: 'person-link', label: 'Person This Question Is About',
      targetField: 'People' },

    { field: '_s1', type: 'section', label: 'Classification' },
    { field: 'Research Type', type: 'select', label: 'Research Type',
      options: [
        '',
        'Identity: Who is this person? Proving existence, name, dates',
        'Relationship: How are two people related?',
        'Event: When/where did something happen?',
        'Place: Where did a family live or migrate?',
        'DNA Correlation: How does a DNA result connect to documentary evidence?',
        'Migration: Tracing movement between locations',
        'Vital Records',
      ]},
    { field: 'Status', type: 'select', label: 'Status',
      options: [
        '',
        'Open: Question exists, research not yet started',
        'In Progress: Actively researching, evidence being gathered',
        'Proven: GPS standard met — written conclusion exists',
        'Disproven: Hypothesis definitively ruled out',
        'Unresolvable: Records destroyed or inaccessible — documented dead end',
      ]},
    { field: 'Priority', type: 'select', label: 'Priority',
      options: [
        '',
        'High: Blocks other research — solve this first',
        'Medium: Important but not blocking',
        'Low: Would be nice to know but not urgent',
      ]},
    { field: 'Date Opened',   type: 'date', label: 'Date Opened' },
    { field: 'Date Resolved', type: 'date', label: 'Date Resolved' },
    { field: 'Next Action',   type: 'text', label: 'Next Action (one specific next step)' },

    { field: '_s2', type: 'section', label: 'Findings & Analysis' },
    { field: 'Current Conclusion',  type: 'textarea', label: 'Current Conclusion' },
    { field: 'Gaps Identified',     type: 'textarea', label: 'Gaps Identified (sources not yet searched)' },
    { field: 'Conflicting Evidence',type: 'textarea', label: 'Conflicting Evidence' },

    { field: '_s3', type: 'section', label: 'GPS Checklist' },
    { field: 'Reasonably Exhaustive Search Done ', type: 'checkbox', label: 'Reasonably Exhaustive Search Done',
      checkLabel: 'Reasonably Exhaustive Search Done' },
    { field: 'All Evidence Cited',    type: 'checkbox', label: 'All Evidence Cited',
      checkLabel: 'All Evidence Cited' },
    { field: 'Conflicts Resolved ',   type: 'checkbox', label: 'Conflicts Resolved',
      checkLabel: 'Conflicts Resolved' },
    { field: 'Written Conclusion Exists', type: 'checkbox', label: 'Written Conclusion Exists',
      checkLabel: 'Written Conclusion Exists (Status → Proven when all four are checked)' },

    { field: '_s4', type: 'section', label: 'References' },
    { field: 'Collections',       type: 'text',     label: 'Collections' },
    { field: 'Sources Consulted', type: 'text',     label: 'Sources Consulted' },
    { field: 'Evidence Items',    type: 'text',     label: 'Evidence Items' },
    { field: 'DNA Tests',         type: 'text',     label: 'DNA Tests' },

    { field: '_linked_rq', type: 'note', label: 'Linked Records',
      text: 'People, Sources, Evidence Analysis, DNA Testing, and DNA Matches are linked from their own pages.' },
  ],
  'Sources': [
    { field: 'Name ★',         type: 'text',     label: 'Source Name', required: true },
    { field: '_personLink',    type: 'person-link', label: 'Person This Source Is About',
      targetField: 'People Mentioned' },

    { field: '_s_src1', type: 'section', label: 'File Attachment' },
    { field: '_sourceFileUpload', type: 'image', label: 'Attach File / Image',
      uploadEndpoint: '/api/upload-source-file', urlFieldId: 'mf-Source_File_URL',
      previewField: 'Source File URL' },
    { field: 'Source File URL', type: 'text',  label: 'Source File URL (auto-filled on upload)' },

    { field: '_s_src2', type: 'section', label: 'Classification' },
    { field: 'Source Type',    type: 'select',   label: 'Source Type',
      options: ['','Repository','Primary Source','Secondary Source','Derivative',
                'Finding Aid','Database','Website','Correspondence','Primary'] },
    { field: 'Record Type',    type: 'multicheck', label: 'Record Type',
      options: ['Census','Vital Record','Land','Military','Probate','Cemetery','Church',
                'Newspaper','Correspondence','Photograph','Legal','Tax',
                'Slave Schedule',"Freedmen's Bureau",'DNA','Ship Manifest','Other'] },

    { field: '_s_src3', type: 'section', label: 'Location & Access' },
    { field: 'Repository',         type: 'text', label: 'Repository / Archive' },
    { field: 'URL',                type: 'text', label: 'URL / Link' },
    { field: 'Physical Location',  type: 'text', label: 'Physical Location (call number, box, folder)' },
    { field: 'Date of Source',     type: 'text', label: 'Date of Source' },
    { field: 'Date Accessed',      type: 'date', label: 'Date Accessed' },

    { field: '_s_src4', type: 'section', label: 'Citation' },
    { field: 'Full Citation',      type: 'textarea', label: 'Full Citation' },
    { field: 'Short Citation',     type: 'text',     label: 'Short Citation' },

    { field: '_s_src5', type: 'section', label: 'Search Status' },
    { field: 'Search Status', type: 'select', label: 'Search Status',
      options: ['','Not Yet','Searched','Found','Not Found','Partially Searched',' Search Pending'] },
    { field: 'Search Notes',  type: 'textarea', label: 'Search Notes' },

    { field: '_linked_src', type: 'note', label: 'Linked Records',
      text: 'Collections, Research Questions, People Mentioned, and Evidence Analysis are linked from their own pages.' },
  ],
  'DNA Testing': [
    { field: 'Test Label ★',     type: 'text',     label: 'Test Label (Company + Type + Subject)', required: true },
    { field: '_personLink',      type: 'person-link', label: 'Person Tested',
      targetField: 'Test Subject' },
    { field: 'Company',          type: 'select',   label: 'Testing Company',
      options: ['','AncestryDNA','23AndMe','African Ancestry','My Heritage','Geni',
                'FamilyTreeDNA','LivingDNA','Nebula Genomics','MyFamilyTree DNA','GedMatch'] },
    { field: 'Test Type',        type: 'select',   label: 'Test Type',
      options: ['','Autosomal','MtDNA','Y DNA','X DNA'] },
    { field: 'Haplogroup',       type: 'text',     label: 'Haplogroup (mtDNA or Y-DNA)' },
    { field: 'Ethnicity Estimates', type: 'textarea', label: 'Ethnicity Estimates (full breakdown)' },
    { field: 'Documentary Corroboration', type: 'textarea', label: 'Documentary Corroboration' },
    { field: 'Analysis Notes',   type: 'textarea', label: 'Analysis Notes' },
  ],
  'DNA Matches': [
    { field: 'Match Name ★', type: 'text', label: 'Match Name', required: true },
    { field: '_personLink', type: 'person-link', label: 'Linked Person in Tree (your tree)',
      targetField: 'Linked Person in Tree' },

    { field: '_s_dna1', type: 'section', label: 'Shared DNA' },
    { field: 'Shared cM',        type: 'text', label: 'Shared cM' },
    { field: 'Shared Segments',  type: 'text', label: 'Shared Segments' },
    { field: 'Longest Segment',  type: 'text', label: 'Longest Segment (cM)' },

    { field: '_s_dna2', type: 'section', label: 'Relationship Analysis' },
    { field: 'Predicted Relationship',     type: 'text',     label: "Predicted Relationship (platform's estimate)" },
    { field: 'Likely Actual Relationship', type: 'text',     label: 'Likely Actual Relationship (your assessment)' },
    { field: 'Possible Relationships',     type: 'textarea', label: 'All Possible Relationships (consistent with cM)' },
    { field: 'Clustering Group',           type: 'text',     label: 'Clustering Group (e.g. Cluster A – Daggs line)' },

    { field: '_s_dna3', type: 'section', label: 'Correspondence' },
    { field: 'Correspondence Status', type: 'select', label: 'Correspondence Status',
      options: ['','Contacted','Not Contacted','No Response','Responded','Shared Tree','Unresponsive'] },
    { field: 'Last Contact',       type: 'date',     label: 'Last Contact' },
    { field: 'Correspondence Log', type: 'textarea', label: 'Correspondence Log' },

    { field: '_s_dna4', type: 'section', label: 'Research Links' },
    { field: 'Notes', type: 'textarea', label: 'Notes' },

    { field: '_linked_dna', type: 'note', label: 'Linked Records',
      text: 'Test (DNA Testing), Linked Person in Tree (People), and Research Questions are linked from their own pages.' },
  ],
  'Archives': [
    { field: 'Accession Number ★', type: 'text',       label: 'Accession Number', required: true },
    { field: '_personLink',        type: 'person-link', label: 'Creator / Person This Item Is About',
      targetField: 'Creator' },
    { field: '_imageUpload',       type: 'image',      label: 'Item Image / Scan' },
    { field: 'Image URL',          type: 'text',       label: 'Image URL (auto-filled on upload)' },
    { field: 'Description',        type: 'textarea',   label: 'Description' },
    { field: 'Formats Included',   type: 'multicheck', label: 'Formats Included',
      options: ['Photocopies','Photographs','Correspondence','Legal Docs','Microfilm',
                '35mm Slides','Digital Files ','Obituaries','Newspapers'] },
    { field: 'Inclusive Dates',    type: 'text',       label: 'Inclusive Dates' },
    { field: 'Accession Date',     type: 'date',       label: 'Accession Date' },
    { field: 'Extent',             type: 'text',       label: 'Extent (e.g. "1 box, 47 items")' },
    { field: 'Condition',          type: 'select',     label: 'Condition',
      options: ['','Excellent','Good','Fair','Poor','Critical'] },
    { field: 'Storage Type',       type: 'text',       label: 'Storage Type' },
    { field: 'Restrictions & Access', type: 'textarea', label: 'Restrictions & Access' },
    { field: 'Recommended Treatments', type: 'multicheck', label: 'Recommended Treatments',
      options: ['Metadata','Digitization','Deacidification','Reboxing','Renaming of Files',
                'Conservation','Rehousing','Transcription'] },
    { field: 'AI Metadata',        type: 'textarea',   label: 'AI Metadata (JSON)' },
  ],
  'Collections': [
    { field: 'Collection Name ★',  type: 'text',     label: 'Collection Name', required: true },
    { field: '_personLink',        type: 'person-link', label: 'Primary Family Member',
      targetField: 'Family Names' },
    { field: 'Status',             type: 'select',   label: 'Status',
      options: ['','Active','Processing','Complete','Pending Accession'] },
    { field: 'Description',        type: 'textarea', label: 'Description' },
    { field: 'Access Restrictions', type: 'textarea', label: 'Access Restrictions' },
    { field: 'Allowed to Share Online', type: 'checkbox', label: 'Allowed to Share Online',
      checkLabel: 'Allowed to Share Online (donor consent to publish)' },
  ],
  'Evidence Analysis': [
    { field: 'Evidence Summary ★',   type: 'text',       label: 'Evidence Summary',   required: true },
    { field: '_personLink',          type: 'person-link', label: 'Person This Evidence Concerns',
      targetField: 'People' },

    { field: '_s_ev1', type: 'section', label: 'Classification' },
    { field: 'Evidence Type',        type: 'select',     label: 'Evidence Type',
      options: [
        '',
        'Direct = answers question explicitly',
        'Indirect = requires inference',
        'Negative = absence of expected record',
      ]},
    { field: 'Information Type',     type: 'select',     label: 'Information Type',
      options: [
        '',
        'Original = created at time of event',
        'Derivative = transcription/abstraction',
        'Authored = compiled later',
      ]},
    { field: 'Supports or Contradicts', type: 'select',  label: 'Supports or Contradicts',
      options: ['','Supports','Contradicts','Inconclusive','Negative Evidence'] },
    { field: 'Confidence Level',     type: 'select',     label: 'Confidence Level',
      options: ['','High','Medium','Low','Speculative'] },

    { field: '_s_ev2', type: 'section', label: 'Content' },
    { field: 'Transcription / Extraction', type: 'textarea', label: 'Transcription / Extraction (exact text from source)' },
    { field: 'Analysis',             type: 'textarea',   label: 'Analysis (your interpretation — why does this matter?)' },
    { field: 'Conclusion Drawn',     type: 'textarea',   label: 'Conclusion Drawn (what you conclude from this evidence alone)' },

    { field: '_linked_ev', type: 'note', label: 'Linked Records',
      text: 'Sources, Research Questions, and People are linked from their own pages.' },
  ],
  'Research Log': [
    { field: 'Log Title ★',          type: 'text',       label: 'Log Title',          required: true },
    { field: '_personLink',          type: 'person-link', label: 'Person Being Researched',
      targetField: 'Person' },
    { field: 'Research Status',      type: 'select',     label: 'Research Status',
      options: ['','Open','In Progress','Proven','Disproven','On Hold'] },
    { field: 'Genealogical Line',    type: 'select',     label: 'Genealogical Line',
      options: ['','Perrin','Daggs','Hill','Epps','Redmond','Abdul Rahman','Unknown'] },
    { field: 'Generational Line',    type: 'select',     label: 'Generational Line (1 = you)',
      options: ['','1','2','3','4','5','6','7','8','9','10'] },
    { field: 'Relationship',         type: 'text',       label: 'Relationship (e.g. 3rd Great-Grandmother)' },
    { field: 'Notes',                type: 'textarea',   label: 'Research Notes / Summary' },
    { field: 'Records Checklist',    type: 'multicheck', label: 'Records Checklist',
      options: ['Census Records','Slave Schedules',"Freedmen's Bureau Records",
                'Ship Manifest / Passenger Lists','Birth Records','Death Records',
                'Marriage Records','Military Records / USCT','Land Records / Deeds',
                'Wills & Probate','Church / Baptism Records','Newspaper Archives',
                'Immigration Records','Tax Records','Social Security Records',
                'DNA Records','FamilySearch Tree','Ancestry Tree','Geni.com Tree',
                'Runaway Slave Advertisements'] },
    { field: 'Ancestry Profile URL', type: 'text',       label: 'Ancestry Profile URL' },
    { field: 'Geni.com Profile URL', type: 'text',       label: 'Geni.com Profile URL' },
    { field: '_linked_rl', type: 'note', label: 'Linked Records',
      text: 'Research Questions, Sources, and DNA Matches are linked from their own pages.' },
  ],
};

// Ensure people cache is warm before any modal opens
async function ensurePeopleCache() {
  if (allPeopleCache.length) return;
  try {
    const raw = await api('/api/ancestors');
    allPeopleCache = raw
      .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)
      .sort((a, b) => personName(a).localeCompare(personName(b)));
  } catch { /* non-fatal — picker will just be empty */ }
}

function _currentPageId() {
  return document.querySelector('.page.active')?.id?.replace('page-','') || '';
}

async function openAddModal(tableName) {
  await ensurePeopleCache();
  state.modalTable    = tableName;
  state.modalRecordId = null;
  state.modalFromPage = _currentPageId();
  document.getElementById('modal-title').textContent       = `Add — ${tableName}`;
  document.getElementById('modal-delete-btn').style.display = 'none';
  document.getElementById('modal-alert').innerHTML          = '';
  renderModalForm(tableName, {});
  document.getElementById('record-modal').style.display = 'flex';
}

async function openEditModal(tableName, recordId, record) {
  await ensurePeopleCache();
  state.modalTable    = tableName;
  state.modalRecordId = recordId;
  state.modalFromPage = _currentPageId();
  document.getElementById('modal-title').textContent       = `Edit — ${tableName}`;
  document.getElementById('modal-delete-btn').style.display = 'inline-flex';
  document.getElementById('modal-alert').innerHTML          = '';
  renderModalForm(tableName, record);
  document.getElementById('record-modal').style.display = 'flex';
}

function renderModalForm(tableName, record) {
  const schema = TABLE_SCHEMAS[tableName];
  const body   = document.getElementById('modal-body');

  if (!schema) {
    body.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">No edit schema defined for "${tableName}" yet.</p>`;
    return;
  }

  body.innerHTML = schema.map(f => {
    const fid     = `mf-${f.field.replace(/[^a-z0-9]/gi,'_')}`;
    const curVal  = record[f.field];
    const curStr  = (curVal !== undefined && curVal !== null) ? String(curVal) : '';
    let input = '';

    if (f.type === 'textarea') {
      input = `<textarea id="${fid}" rows="3">${escHtml(curStr)}</textarea>`;

    } else if (f.type === 'select') {
      const opts = (f.options || []).map(o =>
        `<option value="${escHtml(o)}"${o === curStr ? ' selected' : ''}>${escHtml(o) || '— select —'}</option>`
      ).join('');
      input = `<select id="${fid}">${opts}</select>`;

    } else if (f.type === 'datalist') {
      const dlId = f.listId || `dl-${fid}`;
      const suggestions = (f.suggestions || []).map(s => `<option value="${escHtml(s)}"></option>`).join('');
      input = `<input type="text" id="${fid}" value="${escHtml(curStr)}" list="${dlId}" autocomplete="off" />
               <datalist id="${dlId}">${suggestions}</datalist>`;

    } else if (f.type === 'image') {
      const imgSrc   = curStr || (record[f.previewField] || '');
      const preview  = imgSrc ? `<img src="${escHtml(imgSrc)}" style="max-width:100%;max-height:160px;border-radius:8px;margin-bottom:8px;display:block;object-fit:cover;" />` : '';
      const endpoint = JSON.stringify(f.uploadEndpoint || '/api/upload-archive-image');
      const urlFid   = JSON.stringify(f.urlFieldId || 'mf-Image_URL');
      input = `${preview}
        <label class="archive-upload-label" for="${fid}-file">
          Choose photo to upload
          <input type="file" id="${fid}-file" accept="image/*"
            style="display:none;"
            onchange="handleModalImageUpload(this,'${fid}',${endpoint},${urlFid})" />
        </label>
        <div id="${fid}-status" style="font-size:.75rem;color:var(--muted);margin-top:4px;"></div>`;

    } else if (f.type === 'person-link') {
      // Searchable person picker backed by allPeopleCache
      const targetField = f.targetField || 'People';
      const linkedIds   = Array.isArray(curVal) ? curVal : (curVal ? [curVal] : []);
      // Resolve first linked ID to a display name if possible
      const linkedName  = linkedIds.length
        ? (() => { const p = allPeopleCache.find(x => x.id === linkedIds[0]); return p ? personName(p) : ''; })()
        : '';
      const dlId   = `dl-people-${fid}`;
      const opts   = allPeopleCache.map(p =>
        `<option value="${escHtml(personName(p))}" data-id="${escHtml(p.id)}"></option>`
      ).join('');
      input = `<input type="text" id="${fid}" value="${escHtml(linkedName)}"
                 list="${dlId}" autocomplete="off"
                 placeholder="Type a name to search…"
                 data-target-field="${escHtml(targetField)}" />
               <datalist id="${dlId}">${opts}</datalist>
               <div style="font-size:.72rem;color:var(--muted);margin-top:3px;">
                 Start typing to search all people in your tree
               </div>`;

    } else if (f.type === 'note') {
      input = `<div style="font-size:.78rem;color:var(--muted);padding:7px 10px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);">${escHtml(f.text || '')}</div>`;

    } else if (f.type === 'section') {
      // Rendered as a full-width section divider — no input element
      return `<div class="modal-section-divider"><span>${escHtml(f.label)}</span></div>`;

    } else if (f.type === 'checkbox') {
      const isChecked = curVal === true || curVal === 1 || curStr === 'true' ? 'checked' : '';
      input = `<label class="modal-checkbox-label">
        <input type="checkbox" id="${fid}" ${isChecked} />
        <span>${escHtml(f.checkLabel || f.label)}</span>
      </label>`;

    } else if (f.type === 'date') {
      // Normalize date value — Airtable returns ISO date strings
      const dateVal = curStr ? curStr.slice(0, 10) : '';
      input = `<input type="date" id="${fid}" value="${escHtml(dateVal)}" />`;

    } else if (f.type === 'multicheck') {
      const checked = Array.isArray(curVal) ? curVal : [];
      const items = (f.options || []).map(o => {
        const cbId = `${fid}_${o.replace(/[^a-z0-9]/gi,'_')}`;
        const isChecked = checked.includes(o) ? 'checked' : '';
        return `<label class="multicheck-item">
          <input type="checkbox" id="${cbId}" data-field="${escHtml(f.field)}" value="${escHtml(o)}" ${isChecked} />
          ${escHtml(o)}
        </label>`;
      }).join('');
      input = `<div class="multicheck-grid" id="${fid}-grid">${items}</div>`;

    } else {
      input = `<input type="text" id="${fid}" value="${escHtml(curStr)}" />`;
    }

    const labelHtml = f.type === 'checkbox'
      ? ''   // checkbox has its own inline label
      : `<label>${escHtml(f.label)}${f.required ? ' *' : ''}</label>`;

    return `<div class="form-group">
      ${labelHtml}
      ${input}
    </div>`;
  }).join('');

  state.modalFields = schema;
}

async function saveModal() {
  const schema = TABLE_SCHEMAS[state.modalTable];
  if (!schema) return;

  const fields = {};
  for (const f of schema) {
    const fid = `mf-${f.field.replace(/[^a-z0-9]/gi,'_')}`;

    // ── person-link must come BEFORE the _ prefix skip ──────────────────────
    if (f.type === 'person-link') {
      const el = document.getElementById(fid);
      if (!el || !el.value.trim()) continue;
      const typedName   = el.value.trim();
      const targetField = el.dataset.targetField || 'People';
      const match = allPeopleCache.find(p => personName(p) === typedName)
                 || allPeopleCache.find(p => personName(p).toLowerCase() === typedName.toLowerCase());
      if (match) fields[targetField] = [match.id];
      continue;

    } else if (f.type === 'image' || f.type === 'note' || f.type === 'section' || f.field.startsWith('_')) {
      // Virtual / display-only fields — skip
      continue;

    } else if (f.type === 'checkbox') {
      const el = document.getElementById(fid);
      if (el) fields[f.field] = el.checked;   // always send true/false

    } else if (f.type === 'multicheck') {
      const grid = document.getElementById(`${fid}-grid`);
      if (!grid) continue;
      const checked = Array.from(grid.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      if (checked.length) fields[f.field] = checked;

    } else {
      const el = document.getElementById(fid);
      if (!el) continue;
      const val = el.value.trim();
      if (val) fields[f.field] = val;
    }
  }

  const alertEl = document.getElementById('modal-alert');
  try {
    if (state.modalRecordId) {
      await api(`/api/record/${encodeURIComponent(state.modalTable)}/${state.modalRecordId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ fields }),
      });
    } else {
      await api(`/api/record/${encodeURIComponent(state.modalTable)}`, {
        method: 'POST',
        body:   JSON.stringify({ fields }),
      });
    }
    const isNew      = !state.modalRecordId;
    const tbl        = state.modalTable;
    const fromPage   = state.modalFromPage;
    const profileId  = state.currentProfileId;
    closeModal();
    const verb = isNew ? 'Added' : 'Saved';
    const label = { People: 'person', 'Research Questions': 'research question', Sources: 'source',
      'Evidence Analysis': 'evidence record', 'DNA Testing': 'DNA test', 'DNA Matches': 'DNA match',
      Archives: 'archive item', Collections: 'collection item', 'Research Log': 'log entry',
      Donors: 'donor' }[tbl] || 'record';
    showToast(`${verb} — ${label} updated.`);

    // If the modal was opened from the profile page, reload the profile
    if (fromPage === 'profile' && profileId) {
      openProfile(profileId);
      return;
    }

    // Otherwise reload the table's own page
    const pageMap = {
      'People':             'ancestors',
      'Research Questions': 'questions',
      'Sources':            'sources',
      'DNA Testing':        'dna',
      'DNA Matches':        'dna',
      'Archives':           'archives',
      'Collections':        'archives',
      'Research Log':       'research-log',
    };
    const pageId = pageMap[tbl];
    if (pageId) { loadedPages.delete(pageId); showPage(pageId, true); }
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function deleteModalRecord() {
  if (!state.modalRecordId) return;
  if (!confirm(`Delete this record from ${state.modalTable}? This cannot be undone.`)) return;
  const tbl       = state.modalTable;
  const fromPage  = state.modalFromPage;
  const profileId = state.currentProfileId;
  try {
    await api(`/api/record/${encodeURIComponent(tbl)}/${state.modalRecordId}`, { method: 'DELETE' });
    closeModal();
    showToast('Record deleted.', 'success');

    // If opened from profile, reload the profile (unless we deleted the person themselves)
    if (fromPage === 'profile' && profileId && tbl !== 'People') {
      openProfile(profileId);
      return;
    }

    const pageMap = {
      'People':             'ancestors',
      'Research Questions': 'questions',
      'Sources':            'sources',
      'DNA Testing':        'dna',
      'DNA Matches':        'dna',
      'Archives':           'archives',
      'Collections':        'archives',
      'Research Log':       'research-log',
    };
    const pageId  = pageMap[tbl];
    if (pageId) { loadedPages.delete(pageId); showPage(pageId, true); }
  } catch (err) {
    document.getElementById('modal-alert').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function closeModal() {
  document.getElementById('record-modal').style.display = 'none';
  state.modalTable    = null;
  state.modalRecordId = null;
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('record-modal')) closeModal();
}

// ── Profile ───────────────────────────────────────────────────────────────────
function loadProfile() {
  const saved = JSON.parse(localStorage.getItem('lr-profile') || '{}');
  document.getElementById('profile-name').value     = saved.name     || '';
  document.getElementById('profile-email').value    = saved.email    || '';
  document.getElementById('profile-username').value = saved.username || '';
  if (saved.username) {
    document.getElementById('sidebar-username').textContent = saved.username;
  }
}

// ── User auth helpers (localStorage) ─────────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('lr_user') || 'null'); } catch { return null; }
}
function saveUser(u) { localStorage.setItem('lr_user', JSON.stringify(u)); }

// ── Sidebar profile bootstrap ──────────────────────────────────────────────────
function initSidebarProfile() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('kg_user') || 'null'); } catch (_) {}
  if (!user) return;
  const name = user.name || user.email || 'My Profile';
  const el = document.getElementById('sidebar-username');
  if (el) el.textContent = name;
  const planEl = document.getElementById('sidebar-plan-label');
  if (planEl) planEl.textContent = user.plan === 'researcher' ? 'Researcher Plan' : 'Basic Plan';
  const ppName = document.getElementById('pp-name');
  if (ppName) ppName.textContent = name;
  const ppEmail = document.getElementById('pp-email');
  if (ppEmail) ppEmail.textContent = user.email || '';
  const ppBadge = document.getElementById('pp-plan-badge');
  if (ppBadge) ppBadge.textContent = user.plan === 'researcher' ? 'Researcher' : 'Basic';
}

// ── Profile popup toggle ──────────────────────────────────────────────────────
function toggleProfileMenu(e) {
  e.stopPropagation();
  const popup = document.getElementById('profile-popup');
  const area  = popup.closest('.profile-area');
  const isOpen = popup.style.display !== 'none';
  popup.style.display = isOpen ? 'none' : 'block';
  area.classList.toggle('open', !isOpen);
}
function closeProfileMenu() {
  const popup = document.getElementById('profile-popup');
  if (popup) { popup.style.display = 'none'; }
  const area = document.querySelector('.profile-area');
  if (area) area.classList.remove('open');
}
document.addEventListener('click', (e) => {
  const popup = document.getElementById('profile-popup');
  if (popup && popup.style.display !== 'none') {
    if (!popup.contains(e.target) && !e.target.closest('.user-profile-btn')) closeProfileMenu();
  }
});

// ── Load profile settings page ─────────────────────────────────────────────────
function loadProfileSettings() {
  const user = getUser();
  if (!user) return;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('profile-first', user.firstName);
  setVal('profile-last',  user.lastName);
  setVal('profile-email', user.email);
  setVal('profile-phone', user.phone);
  const billing = user.billingAddress || {};
  setVal('profile-addr', billing.addr);
  setVal('profile-city', billing.city);
  setVal('profile-zip',  billing.zip);
  // Plan display
  const PLAN_LABELS = { free: 'Free', 'basic-paid': 'Basic ($25/month)', upgrade: 'Upgrade ($49/month)' };
  const PLAN_BADGES = { free: 'Free', 'basic-paid': '$25/mo', upgrade: '$49/mo' };
  const isPaid = user.plan === 'basic-paid' || user.plan === 'upgrade';
  const planSub = document.getElementById('settings-plan-sub');
  if (planSub) planSub.textContent = `You are on the ${PLAN_LABELS[user.plan] || 'Free'} plan`;
  const planName = document.getElementById('current-plan-name');
  if (planName) planName.textContent = { free:'Free', 'basic-paid':'Basic', upgrade:'Upgrade' }[user.plan] || 'Free';
  const planBadge = document.getElementById('current-plan-badge');
  if (planBadge) {
    planBadge.textContent = PLAN_BADGES[user.plan] || 'Free';
    planBadge.classList.toggle('paid', isPaid);
  }
  const nudge = document.getElementById('upgrade-nudge');
  if (nudge) nudge.style.display = isPaid ? 'none' : 'block';
  const billingCard = document.getElementById('billing-settings-card');
  if (billingCard) billingCard.style.display = isPaid ? 'block' : 'none';
}

// ── Save profile settings ─────────────────────────────────────────────────────
function saveProfileSettings() {
  const user = getUser() || {};
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  user.firstName = getVal('profile-first') || user.firstName;
  user.lastName  = getVal('profile-last')  || user.lastName;
  user.email     = getVal('profile-email') || user.email;
  user.phone     = getVal('profile-phone');
  const pass = getVal('profile-pass');
  if (pass) { if (pass.length >= 8) user.password = btoa(pass); }
  user.billingAddress = {
    addr: getVal('profile-addr'),
    city: getVal('profile-city'),
    zip:  getVal('profile-zip'),
  };
  saveUser(user);
  initSidebarProfile();
  showToast('Profile settings saved.');
  const alertEl = document.getElementById('profile-save-alert');
  if (alertEl) {
    alertEl.innerHTML = `<div class="alert alert-success" style="margin-bottom:14px;">Profile updated.</div>`;
    setTimeout(() => { alertEl.innerHTML = ''; }, 3000);
  }
}

// ── Billing info save ─────────────────────────────────────────────────────────
function saveBillingInfo() {
  const user = getUser() || {};
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  user.billingAddress = { ...user.billingAddress, card: getVal('settings-card'), exp: getVal('settings-exp') };
  saveUser(user);
  showToast('Billing information saved.');
  const alertEl = document.getElementById('profile-save-alert');
  if (alertEl) {
    alertEl.innerHTML = `<div class="alert alert-success" style="margin-bottom:14px;">Billing information updated.</div>`;
    setTimeout(() => { alertEl.innerHTML = ''; }, 3000);
  }
}

// ── Upgrade plan page ─────────────────────────────────────────────────────────
let _upgradingToPlan = 'basic-paid';
function loadUpgradePlan() {
  const user = getUser();
  if (!user) return;
  const plan = user.plan || 'free';
  // Mark current plan card and disable its button
  ['free','basic-paid','upgrade'].forEach(p => {
    const card = document.getElementById(`upc-${p === 'basic-paid' ? 'basic' : p}`);
    const btn  = document.getElementById(`upc-${p === 'basic-paid' ? 'basic' : p}-btn`);
    if (!card) return;
    if (p === plan) {
      card.style.opacity = '.7';
      if (btn) { btn.textContent = 'Current Plan'; btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'default'; }
    } else {
      card.style.opacity = '1';
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
    }
  });
  document.getElementById('upgrade-form-section').style.display = 'none';
}
function showUpgradeForm(plan, priceLabel) {
  _upgradingToPlan = plan || 'basic-paid';
  const s = document.getElementById('upgrade-form-section');
  if (!s) return;
  s.style.display = 'block';
  const sub = document.getElementById('upgrade-form-plan-sub');
  if (sub) sub.textContent = `${priceLabel || ''} — cancel anytime`;
  const btn = document.getElementById('upgrade-confirm-btn');
  if (btn) btn.textContent = `Confirm Upgrade — ${priceLabel || ''}`;
  s.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function processUpgrade() {
  const card = document.getElementById('uf-card')?.value.replace(/\s/g,'');
  const exp  = document.getElementById('uf-exp')?.value.trim();
  const cvc  = document.getElementById('uf-cvc')?.value.trim();
  const alertEl = document.getElementById('upgrade-form-alert');
  if (!card || card.length < 15 || !exp || !cvc) {
    if (alertEl) alertEl.innerHTML = `<div class="alert alert-error" style="margin-bottom:14px;">Please complete all billing fields.</div>`;
    return;
  }
  const user = getUser() || {};
  user.plan = _upgradingToPlan;
  saveUser(user);
  initSidebarProfile();
  loadedPages.delete('profile-settings');
  loadedPages.delete('upgrade-plan');
  const label = _upgradingToPlan === 'upgrade' ? 'Upgrade (Power Researcher)' : 'Basic';
  if (alertEl) alertEl.innerHTML = `<div class="alert alert-success" style="margin-bottom:14px;">You are now on the ${label} plan. All features are unlocked.</div>`;
  // Refresh plan cards
  setTimeout(() => loadUpgradePlan(), 300);
}

// ── Help / bug report ─────────────────────────────────────────────────────────
function openAppBugReport() { showPage('help-page'); }
function submitHelpBug() {
  const action  = document.getElementById('help-bug-action')?.value.trim();
  const desc    = document.getElementById('help-bug-desc')?.value.trim();
  const alertEl = document.getElementById('help-bug-alert');
  if (!action || !desc) {
    if (alertEl) alertEl.innerHTML = `<div class="alert alert-error" style="margin-bottom:14px;">Please fill in both fields before submitting.</div>`;
    return;
  }
  const subject = encodeURIComponent('Krio Griot Support: ' + action.slice(0, 80));
  const body    = encodeURIComponent('What I was trying to do:\n' + action + '\n\nWhat happened:\n' + desc + '\n\nBrowser/device: ' + navigator.userAgent.slice(0, 120));
  window.location.href = 'mailto:support@kriogriot.com?subject=' + subject + '&body=' + body;
  if (alertEl) alertEl.innerHTML = `<div class="alert alert-success" style="margin-bottom:14px;">Opening your email client…</div>`;
}

// ── Sign-out modal ────────────────────────────────────────────────────────────
function handleAppLogout() {
  closeProfileMenu();
  const m = document.getElementById('signout-modal');
  if (m) { m.style.display = 'flex'; }
}
function closeSignoutModal() {
  const m = document.getElementById('signout-modal');
  if (m) m.style.display = 'none';
}

// ── Compat: old saveProfile kept for safety ───────────────────────────────────
function saveProfile() { saveProfileSettings(); }

// ── Markdown renderer (lightweight) ───────────────────────────────────────────
function renderMarkdown(text) {
  // Strip all structured JSON blocks from visible output
  let html = text
    .replace(/```record-json[\s\S]*?```/g, '')
    .replace(/```person-json[\s\S]*?```/g, '')
    .replace(/```question-json[\s\S]*?```/g, '')
    .replace(/```dna-json[\s\S]*?```/g, '');

  // Headings
  html = html
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // URLs
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--accent);">$1</a>')
    // Paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

// ── Security: HTML escaping ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Sign-out modal backdrop + Escape ─────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const m = document.getElementById('signout-modal');
    if (m && m.style.display === 'flex') { closeSignoutModal(); return; }
  }
});
document.addEventListener('click', function(e) {
  const m = document.getElementById('signout-modal');
  if (m && m.style.display === 'flex' && e.target === m) closeSignoutModal();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
loadDashboard();
initDatabaseCategories();
initLocationSelector();
initSidebarProfile();   // populate sidebar from localStorage user
loadProfile();
