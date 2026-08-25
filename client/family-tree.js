/* ══════════════════════════════════════════════════════════════════════════
   FAMILY TREE  ·  Krio Griot
   D3 v7  ·  horizontal (default) / vertical toggle
   — Zoom / pan via d3.zoom()
   — Expand / collapse per node
   — Search → highlight + center
   — Click node → opens person's edit modal
══════════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ── Card geometry ─────────────────────────────────────────────────── */
  const CW   = 196;   // card width
  const CH   = 84;    // card height
  const CR   = 10;    // card corner radius
  const AR   = 22;    // avatar circle radius
  const AX   = -CW / 2 + AR + 10;  // avatar center-x (card-local)

  /* ── Tree spacing ──────────────────────────────────────────────────── */
  // d3.tree().nodeSize([y-gap-between-siblings, x-gap-between-generations])
  const H_NODE = [CH + 22, CW + 76];   // horizontal layout
  const V_NODE = [CW + 60, CH + 60];   // vertical layout

  /* ── Toggle button ─────────────────────────────────────────────────── */
  const TB_R  = 10;   // toggle circle radius
  const TB_X  = CW / 2 - 1;  // offset from card centre (right edge)

  /* ── Module state ──────────────────────────────────────────────────── */
  let _people       = [];
  let _families     = [];      // raw GEDCOM family records
  let _gedcomRootId = null;
  let _gedcomLoaded = false;
  let _overrides    = {};      // airtableId → { fatherId, motherId }
  let _rootData     = null;
  let _svg          = null;
  let _g            = null;
  let _zoomBehavior = null;
  let _orientation  = 'horizontal';
  let _searchTerm   = '';
  let _uid          = 0;   // auto-increment node id for D3 key

  /* ── Edit mode state ────────────────────────────────────────────────── */
  let _editMode         = false;
  let _connectTarget    = null; // { id, name } of person whose parents are being set
  let _connectFather    = null; // { id, name }
  let _connectMother    = null; // { id, name }
  let _backdrop         = null;

  /* ══════════════════════════════════════════════════════════════════
     UTILITY
  ══════════════════════════════════════════════════════════════════ */

  function extractYear(s) {
    if (!s) return '';
    const m = String(s).match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return m ? m[1] : '';
  }

  function trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function personSide(p) {
    const l = (p.line || '').toLowerCase();
    if (l === 'paternal') return 'paternal';
    if (l === 'maternal') return 'maternal';
    if (l === 'both')     return 'both';
    const r = (p.relation || '').toLowerCase();
    if (r.includes('paternal')) return 'paternal';
    if (r.includes('maternal')) return 'maternal';
    return 'unknown';
  }

  function personIsMale(p) {
    if (p.sex === 'Male')   return true;
    if (p.sex === 'Female') return false;
    const r = (p.relation || '').toLowerCase();
    if (/\b(father|grandfather|uncle|brother|husband|male|man)\b/.test(r)) return true;
    if (/\b(mother|grandmother|aunt|sister|wife|female|woman)\b/.test(r))  return false;
    return null;
  }

  /* ══════════════════════════════════════════════════════════════════
     TREE BUILDING — GEDCOM mode (explicit parent-child from FAM records)
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Build the ancestor pedigree tree using explicit GEDCOM family links.
   * people   — enriched people array (each has gedcomId, famcId, famsIds)
   * families — array of { id, husb, wife, children } using GEDCOM IDs
   * rootGedcomId — GEDCOM cross-ref of the tree subject (e.g. "@I30458999319@")
   *
   * Tree direction: root → children = ancestors (matching existing render code).
   * Branches beyond depth AUTO_COLLAPSE are initially collapsed.
   */
  function buildTreeFromGedcom(people, families, rootGedcomId, overrides) {
    if (!people || !people.length) return null;

    const AUTO_COLLAPSE = 3; // collapse branches at this ancestor depth
    overrides = overrides || {};

    // ── Lookup maps ──────────────────────────────────────────────────────────
    const byGedcomId = {}; // gedcomId → person
    const byId       = {}; // airtableId → person
    people.forEach(p => {
      if (p.gedcomId) byGedcomId[p.gedcomId] = p;
      if (p.id)       byId[p.id]             = p;
    });

    const famByGedcomId = {}; // gedcomId → family
    (families || []).forEach(f => { famByGedcomId[f.id] = f; });

    // ── Find root ────────────────────────────────────────────────────────────
    let rootPerson = (rootGedcomId && byGedcomId[rootGedcomId])
                  || people.find(p => p.generation === 0 && p.gedcomId)
                  || people.find(p => p.generation === 0)
                  || people[0];
    if (!rootPerson) return null;

    const visited = new Set(); // prevent cycles

    // ── Recursive ancestor node builder ──────────────────────────────────────
    function buildAncestor(person, depth) {
      if (!person) return null;
      const uid = person.id || person.gedcomId;
      if (visited.has(uid)) return null;
      visited.add(uid);

      const node = {
        ...person,
        _birthYear  : extractYear(person.birthDate),
        _deathYear  : extractYear(person.deathDate),
        _displayName: trunc(person.name || 'Unknown', 22),
        _uid        : ++_uid,
        children    : null,
        _children   : null,
      };

      const parents = [];

      // ── Manual override takes priority over GEDCOM data ──────────────────
      const ov = overrides[person.id];
      if (ov) {
        if (ov.fatherId && byId[ov.fatherId]) {
          const father = buildAncestor(byId[ov.fatherId], depth + 1);
          if (father) parents.push(father);
        }
        if (ov.motherId && byId[ov.motherId]) {
          const mother = buildAncestor(byId[ov.motherId], depth + 1);
          if (mother) parents.push(mother);
        }
      } else {
        // ── Fall back to GEDCOM famcId ──────────────────────────────────────
        const famcId = person.famcId;
        if (famcId && famByGedcomId[famcId]) {
          const fam = famByGedcomId[famcId];
          if (fam.husb && byGedcomId[fam.husb]) {
            const father = buildAncestor(byGedcomId[fam.husb], depth + 1);
            if (father) parents.push(father);
          }
          if (fam.wife && byGedcomId[fam.wife]) {
            const mother = buildAncestor(byGedcomId[fam.wife], depth + 1);
            if (mother) parents.push(mother);
          }
        }
      }

      if (parents.length > 0) {
        if (depth >= AUTO_COLLAPSE) {
          node._children = parents; // collapsed (shows + button)
        } else {
          node.children = parents;  // expanded
        }
      }

      return node;
    }

    const tree = buildAncestor(rootPerson, 0);

    // ── Unlinked people (no GEDCOM data / not reachable from root) ───────────
    // Build these through buildAncestor too, so any manual parent overrides
    // the user has set are honored (most curated people are NOT in the GEDCOM
    // map, so overrides are the only way to link them).
    const unlinked = people
      .filter(p => {
        const uid = p.id || p.gedcomId;
        if (visited.has(uid)) return false;
        // Truly-orphaned people, plus anyone the user has manually connected.
        return !p.famcId || overrides[p.id];
      })
      .map(p => buildAncestor(p, 0))   // honors overrides + marks visited
      .filter(Boolean);

    if (unlinked.length > 0) {
      const virtualNode = {
        id          : '__unlinked__',
        name        : `${unlinked.length} Unlinked People`,
        _displayName: `${unlinked.length} Unlinked`,
        _birthYear  : '',
        _deathYear  : '',
        relation    : 'No family links found',
        line        : '',
        sex         : '',
        photoUrl    : '',
        _isVirtual  : true,
        _uid        : ++_uid,
        children    : null,
        _children   : unlinked,
      };
      if (!tree.children) tree.children = [];
      tree.children.push(virtualNode);
    }

    return tree;
  }

  /* ══════════════════════════════════════════════════════════════════
     TREE BUILDING — Legacy mode (infer parent-child from generation + line)
     Used when no GEDCOM data has been imported yet.
  ══════════════════════════════════════════════════════════════════ */

  function buildTree(people, overrides) {
    if (!people || !people.length) return null;
    overrides = overrides || {};

    /* Normalise generation numbers — track whether the value was explicit */
    const nodes = people.map(p => {
      let gen = p.generation;
      const explicit = (gen !== null && gen !== undefined && !isNaN(parseInt(gen)));
      if (!explicit) {
        // Try to infer from relation text
        const r = (p.relation || '').toLowerCase();
        const greats = (r.match(/\bgreat\b/g) || []).length;
        if (/\b(grandfather|grandmother)\b/.test(r)) gen = 2 + greats;
        else if (/\b(father|mother)\b/.test(r))      gen = 1 + greats;
        else                                          gen = null; // truly unknown
      }
      return { ...p, _gen: parseInt(gen) || 0, _genExplicit: explicit, _uid: ++_uid };
    });

    // Find root: strongly prefer an explicitly-set generation-0 person ("Self")
    let root = nodes.find(n => n._gen === 0 && n._genExplicit)
            || nodes.find(n => n._gen === 0)
            || nodes[0];
    const used  = new Set([root.id]);
    const byId  = {};
    nodes.forEach(n => { byId[n.id] = n; });

    function getParents(person) {
      const nextGen  = person._gen + 1;
      const side     = personSide(person);

      const candidates = nodes.filter(n => {
        if (used.has(n.id) || n.id === person.id) return false;
        if (n._gen !== nextGen) return false;
        const ns = personSide(n);
        if (side === 'unknown' || side === 'both') return true;
        if (ns   === 'unknown' || ns   === 'both') return true;
        return ns === side;
      });

      candidates.sort((a, b) => {
        const am = personIsMale(a), bm = personIsMale(b);
        if (am === true  && bm !== true)  return -1;
        if (bm === true  && am !== true)  return  1;
        if (am === false && bm !== false) return  1;
        if (bm === false && am !== false) return -1;
        return 0;
      });

      const parents = candidates.slice(0, 2);
      parents.forEach(p => used.add(p.id));
      return parents;
    }

    // Manual overrides take priority over generation-based inference.
    function getOverrideParents(person) {
      const ov = overrides[person.id];
      if (!ov || (!ov.fatherId && !ov.motherId)) return null;
      const parents = [];
      for (const pid of [ov.fatherId, ov.motherId]) {
        if (pid && byId[pid] && !used.has(pid)) { used.add(pid); parents.push(byId[pid]); }
      }
      return parents;
    }

    function buildNode(person) {
      const parents = getOverrideParents(person) || getParents(person);
      const node = {
        ...person,
        _birthYear  : extractYear(person.birthDate),
        _deathYear  : extractYear(person.deathDate),
        _displayName: trunc(person.name || 'Unknown', 22),
        _uid        : person._uid,
        children    : parents.length ? parents.map(buildNode) : null,
        _children   : null,
      };
      return node;
    }

    const tree = buildNode(root);

    const orphans = nodes
      .filter(n => !used.has(n.id))
      .map(n => ({
        ...n,
        _birthYear  : extractYear(n.birthDate),
        _deathYear  : extractYear(n.deathDate),
        _displayName: trunc(n.name || 'Unknown', 22),
        _uid: n._uid,
        children: null,
        _children: null,
      }));

    if (orphans.length > 0) {
      const virtualNode = {
        id          : '__unlinked__',
        name        : `${orphans.length} Unlinked People`,
        _displayName: `${orphans.length} Unlinked`,
        _birthYear  : '',
        _deathYear  : '',
        relation    : 'Assign Generation Numbers to link',
        line        : '',
        sex         : '',
        photoUrl    : '',
        _isVirtual  : true,
        _uid        : ++_uid,
        children    : null,
        _children   : orphans,
      };
      if (!tree.children) tree.children = [];
      tree.children.push(virtualNode);
    }

    return tree;
  }

  /* ══════════════════════════════════════════════════════════════════
     D3 RENDERING
  ══════════════════════════════════════════════════════════════════ */

  function makeLayout() {
    const ns = _orientation === 'horizontal' ? H_NODE : V_NODE;
    return d3.tree().nodeSize(ns);
  }

  function makeLinkGen() {
    return _orientation === 'horizontal'
      ? d3.linkHorizontal().x(d => d.y).y(d => d.x)
      : d3.linkVertical().x(d => d.x).y(d => d.y);
  }

  function nodeXY(d) {
    return _orientation === 'horizontal'
      ? { x: d.y, y: d.x }
      : { x: d.x, y: d.y };
  }

  function render(skipTransition) {
    if (!_rootData || !_g) return;

    const layout = makeLayout();
    const linkG  = makeLinkGen();
    const hier   = d3.hierarchy(_rootData, d => d.children);
    layout(hier);

    const DUR = skipTransition ? 0 : 480;
    const T   = _g.transition().duration(DUR).ease(d3.easeCubicInOut);

    /* ── Links ─────────────────────────────────────────────────────── */
    const linksData = hier.links();

    const linkSel = _g.selectAll('.ft-link')
      .data(linksData, d => `${d.source.data._uid}→${d.target.data._uid}`);

    linkSel.enter()
      .append('path')
        .attr('class', 'ft-link')
        .attr('d', d => {
          const o = nodeXY(d.source);
          return linkG({ source: { x: o.x, y: o.y }, target: { x: o.x, y: o.y } });
        })
      .merge(linkSel)
      .transition(T)
        .attr('d', d => {
          const s = nodeXY(d.source), t = nodeXY(d.target);
          return linkG({ source: s, target: t });
        });

    linkSel.exit()
      .transition(T).attr('opacity', 0).remove();

    /* ── Nodes ─────────────────────────────────────────────────────── */
    const nodesData = hier.descendants();

    const nodeSel = _g.selectAll('.ft-node')
      .data(nodesData, d => d.data._uid);

    /* Enter */
    const nodeEnter = nodeSel.enter()
      .append('g')
        .attr('class', d => `ft-node${d.parent ? '' : ' ft-root-node'}`)
        .attr('cursor', 'pointer')
        .attr('transform', d => {
          const pos = d.parent ? nodeXY(d.parent) : nodeXY(d);
          return `translate(${pos.x},${pos.y})`;
        })
        .on('click', onCardClick);

    /* ── Card background ── */
    nodeEnter.append('rect')
      .attr('class', d => `ft-card-bg${d.data._isVirtual ? ' ft-card-virtual' : ''}`)
      .attr('x',  -CW / 2).attr('y',  -CH / 2)
      .attr('width', CW).attr('height', CH)
      .attr('rx', CR);

    /* ── Avatar circle (real people only) ── */
    nodeEnter.filter(d => !d.data._isVirtual)
      .append('circle')
      .attr('class', d => {
        const m = personIsMale(d.data);
        return `ft-avatar ${m === true ? 'ft-avatar-m' : m === false ? 'ft-avatar-f' : 'ft-avatar-u'}`;
      })
      .attr('cx', AX).attr('cy', 0).attr('r', AR);

    /* ── Photo image (clipped circle, real people with photos only) ── */
    const defs = _svg.select('defs');

    nodeEnter.each(function (d) {
      if (d.data._isVirtual || !d.data.photoUrl) return;
      const clipId = `ft-clip-${d.data._uid}`;
      if (defs.select(`#${clipId}`).empty()) {
        defs.append('clipPath').attr('id', clipId)
          .append('circle')
            .attr('cx', AX).attr('cy', 0).attr('r', AR);
      }
      d3.select(this).append('image')
        .attr('href', d.data.photoUrl)
        .attr('x', AX - AR).attr('y', -AR)
        .attr('width', AR * 2).attr('height', AR * 2)
        .attr('clip-path', `url(#${clipId})`);
    });

    /* ── Sex icon (real people without photos) ── */
    nodeEnter.filter(d => !d.data._isVirtual && !d.data.photoUrl)
      .append('text')
        .attr('class', 'ft-avatar-icon')
        .attr('x', AX).attr('y', 1)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(d => {
          const m = personIsMale(d.data);
          return m === true ? '♂' : m === false ? '♀' : '?';
        });

    /* ── Virtual node icon (group/folder) ── */
    nodeEnter.filter(d => !!d.data._isVirtual)
      .append('text')
        .attr('x', -CW / 2 + 28).attr('y', 5)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '20px')
        .attr('fill', '#6a5c30')
        .text('⊕');

    /* ── Text content ── */
    const TX      = AX + AR + 12;   // for real people (after avatar)
    const TX_VIRT = -CW / 2 + 52;  // for virtual nodes (after group icon)

    nodeEnter.append('text')
      .attr('class', 'ft-card-name')
      .attr('x', d => d.data._isVirtual ? TX_VIRT : TX)
      .attr('y', -20)
      .text(d => d.data._displayName);

    nodeEnter.append('text')
      .attr('class', 'ft-card-dates')
      .attr('x', d => d.data._isVirtual ? TX_VIRT : TX)
      .attr('y', -4)
      .text(d => {
        if (d.data._isVirtual) return '';
        const b = d.data._birthYear ? `b. ${d.data._birthYear}` : '';
        const e = d.data._deathYear ? `d. ${d.data._deathYear}` : '';
        const bp = d.data.birthPlace ? d.data.birthPlace.split(',')[0] : '';
        return [b, e].filter(Boolean).join(' · ') || bp || '';
      });

    nodeEnter.append('text')
      .attr('class', 'ft-card-relation')
      .attr('x', d => d.data._isVirtual ? TX_VIRT : TX)
      .attr('y', 14)
      .text(d => trunc(d.data.relation, 30));

    /* ── Expand / collapse toggle ── */
    const toggleEnter = nodeEnter
      .filter(d => d.data.children || d.data._children)
      .append('g')
        .attr('class', 'ft-toggle')
        .attr('transform', `translate(${TB_X}, 0)`)
        .on('click', (event, d) => {
          event.stopPropagation();
          toggleNode(d.data);
        });

    toggleEnter.append('circle')
      .attr('class', 'ft-toggle-bg').attr('r', TB_R);

    toggleEnter.append('text')
      .attr('class', 'ft-toggle-label')
      .text(d => d.data.children ? '−' : '+');

    /* Merge + move to final position */
    const allNodes = nodeEnter.merge(nodeSel);

    allNodes.transition(T)
      .attr('transform', d => {
        const pos = nodeXY(d);
        return `translate(${pos.x},${pos.y})`;
      });

    /* Update toggle sign after collapse/expand */
    allNodes.select('.ft-toggle-label')
      .text(d => d.data.children ? '−' : '+');

    /* Update search highlights */
    allNodes.select('.ft-card-bg')
      .classed('ft-highlighted', d =>
        _searchTerm.length > 0 &&
        (d.data.name || '').toLowerCase().includes(_searchTerm));

    /* Exit */
    nodeSel.exit()
      .transition(T)
      .attr('opacity', 0)
      .attr('transform', d => {
        const pos = d.parent ? nodeXY(d.parent) : nodeXY(d);
        return `translate(${pos.x},${pos.y})`;
      })
      .remove();
  }

  /* ══════════════════════════════════════════════════════════════════
     EXPAND / COLLAPSE
  ══════════════════════════════════════════════════════════════════ */

  function toggleNode(data) {
    if (data.children) {
      data._children = data.children;
      data.children  = null;
    } else if (data._children) {
      data.children  = data._children;
      data._children = null;
    }
    render();
  }

  /* ══════════════════════════════════════════════════════════════════
     CARD CLICK
  ══════════════════════════════════════════════════════════════════ */

  function onCardClick(event, d) {
    event.stopPropagation();
    if (d.data._isVirtual) { toggleNode(d.data); return; }

    if (_editMode) {
      showContextMenu(event, d.data);
    } else {
      openPersonProfile(d.data.id);
    }
  }

  async function openPersonProfile(personId) {
    if (!personId) return;
    // Prefer the app's openProfile — navigates to Ancestors and opens the full profile panel
    if (typeof window.openProfile === 'function') {
      window.openProfile(personId);
      return;
    }
    // Fallback: open edit modal directly
    try {
      const res    = await fetch(`/api/ancestor/${personId}`);
      const record = await res.json();
      if (record && record.id && typeof openEditModal === 'function') {
        openEditModal('People', record.id, record);
      }
    } catch (err) {
      console.error('Family tree: could not load person', err);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     EDIT MODE
  ══════════════════════════════════════════════════════════════════ */

  function toggleEditMode() {
    _editMode = !_editMode;
    const btn    = document.getElementById('ft-edit-btn');
    const banner = document.getElementById('ft-edit-banner');
    if (btn)    btn.classList.toggle('active', _editMode);
    if (banner) banner.style.display = _editMode ? 'flex' : 'none';
    // Tint the SVG container to signal edit mode
    const container = document.getElementById('ft-container');
    if (container) container.classList.toggle('ft-edit-active', _editMode);
    if (!_editMode) {
      dismissContextMenu();
      ftCloseConnect();
    }
  }

  /* ── Context menu (shown when a card is clicked in edit mode) ─────────── */

  function showContextMenu(event, data) {
    const menu = document.getElementById('ft-context-menu');
    if (!menu) return;

    document.getElementById('ft-ctx-name').textContent =
      data._displayName || data.name || 'Unknown';

    // Wire up the two action buttons with the current person's data
    document.getElementById('ft-ctx-edit-btn').onclick = () => {
      dismissContextMenu();
      openPersonProfile(data.id);
    };
    document.getElementById('ft-ctx-connect-btn').onclick = () => {
      dismissContextMenu();
      openConnectPanel(data);
    };

    // Position near the click, keeping within viewport
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = event.clientX + 8, y = event.clientY + 8;
    menu.style.display = 'block';
    const mw = menu.offsetWidth || 180, mh = menu.offsetHeight || 140;
    if (x + mw > vw - 12) x = event.clientX - mw - 8;
    if (y + mh > vh - 12) y = event.clientY - mh - 8;
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';

    showBackdrop(dismissContextMenu, 2000);
  }

  function dismissContextMenu() {
    const menu = document.getElementById('ft-context-menu');
    if (menu) menu.style.display = 'none';
    removeBackdrop();
  }

  /* ── Connect Parents panel ────────────────────────────────────────────── */

  function openConnectPanel(data) {
    _connectTarget = { id: data.id, name: data.name || 'Unknown' };
    _connectFather = null;
    _connectMother = null;

    document.getElementById('ft-connect-title').textContent =
      'Connect Parents: ' + trunc(data.name || 'Unknown', 28);

    // Pre-fill from existing override or GEDCOM data
    const ov = _overrides[data.id];
    if (ov) {
      if (ov.fatherId) {
        const fp = _people.find(p => p.id === ov.fatherId);
        if (fp) { _connectFather = { id: ov.fatherId, name: fp.name }; }
      }
      if (ov.motherId) {
        const mp = _people.find(p => p.id === ov.motherId);
        if (mp) { _connectMother = { id: ov.motherId, name: mp.name }; }
      }
    } else if (data.famcId) {
      // Try to pre-fill from GEDCOM family record
      const fam = _families.find(f => f.id === data.famcId);
      if (fam) {
        if (fam.husb) {
          const fp = _people.find(p => p.gedcomId === fam.husb);
          if (fp) _connectFather = { id: fp.id, name: fp.name };
        }
        if (fam.wife) {
          const mp = _people.find(p => p.gedcomId === fam.wife);
          if (mp) _connectMother = { id: mp.id, name: mp.name };
        }
      }
    }

    // Populate inputs
    const fi = document.getElementById('ft-father-input');
    const mi = document.getElementById('ft-mother-input');
    if (fi) { fi.value = _connectFather ? _connectFather.name : ''; fi.classList.toggle('ft-selected', !!_connectFather); }
    if (mi) { mi.value = _connectMother ? _connectMother.name : ''; mi.classList.toggle('ft-selected', !!_connectMother); }

    // Show "Remove" button only if there's an override to remove
    const removeBtn = document.getElementById('ft-connect-remove-btn');
    if (removeBtn) removeBtn.style.display = _overrides[data.id] ? 'inline-block' : 'none';

    const panel = document.getElementById('ft-connect-panel');
    if (panel) panel.style.display = 'flex';
    showBackdrop(() => ftCloseConnect(), 2050);
  }

  function ftCloseConnect() {
    const panel = document.getElementById('ft-connect-panel');
    if (panel) panel.style.display = 'none';
    _connectTarget = null;
    _connectFather = null;
    _connectMother = null;
    closeDropdown('father');
    closeDropdown('mother');
    removeBackdrop();
  }

  function ftSearchParent(role, term) {
    const dropId = `ft-${role}-dropdown`;
    const drop   = document.getElementById(dropId);
    if (!drop) return;

    const q = (term || '').trim().toLowerCase();
    if (!q) { closeDropdown(role); return; }

    const matches = _people
      .filter(p => p.name && p.name.toLowerCase().includes(q) &&
                   p.id !== (_connectTarget && _connectTarget.id))
      .sort((a, b) => {
        // Exact prefix first
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return  1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);

    if (!matches.length) {
      drop.innerHTML = '<div class="ft-dropdown-empty">No matches</div>';
      drop.classList.add('open');
      return;
    }

    drop.innerHTML = matches.map(p => {
      const b = extractYear(p.birthDate), d = extractYear(p.deathDate);
      const dates = [b ? 'b. ' + b : '', d ? 'd. ' + d : ''].filter(Boolean).join(' · ');
      return `<div class="ft-dropdown-item" data-id="${p.id}" data-name="${escAttr(p.name)}"
                   onclick="ftSelectParent('${role}', '${p.id}', \`${escBacktick(p.name)}\`)">
                <span class="ft-dropdown-item-name">${escHtmlLocal(p.name)}</span>
                ${dates ? `<span class="ft-dropdown-item-dates">${escHtmlLocal(dates)}</span>` : ''}
              </div>`;
    }).join('');
    drop.classList.add('open');
  }

  function ftSelectParent(role, id, name) {
    if (role === 'father') { _connectFather = { id, name }; }
    else                   { _connectMother = { id, name }; }

    const input = document.getElementById(`ft-${role}-input`);
    if (input) { input.value = name; input.classList.add('ft-selected'); }
    closeDropdown(role);
  }

  function ftClearParent(role) {
    if (role === 'father') { _connectFather = null; }
    else                   { _connectMother = null; }
    const input = document.getElementById(`ft-${role}-input`);
    if (input) { input.value = ''; input.classList.remove('ft-selected'); }
    closeDropdown(role);
  }

  async function ftSaveConnection() {
    if (!_connectTarget) return;
    const btn = document.getElementById('ft-connect-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    try {
      const body = {
        childId:  _connectTarget.id,
        fatherId: _connectFather ? _connectFather.id : null,
        motherId: _connectMother ? _connectMother.id : null,
      };
      const res  = await fetch('/api/family-tree/connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      // Update local overrides and rebuild tree
      if (body.fatherId || body.motherId) {
        _overrides[body.childId] = {
          fatherId: body.fatherId,
          motherId: body.motherId,
        };
      } else {
        delete _overrides[body.childId];
      }

      ftCloseConnect();
      rebuildTree();
    } catch (err) {
      console.error('Connect parents failed:', err);
      alert('Could not save connection: ' + err.message);
    } finally {
      if (btn) { btn.textContent = 'Save Connection'; btn.disabled = false; }
    }
  }

  async function ftRemoveConnection() {
    if (!_connectTarget) return;
    const btn = document.getElementById('ft-connect-remove-btn');
    if (btn) { btn.textContent = 'Removing…'; btn.disabled = true; }

    try {
      const res  = await fetch(`/api/family-tree/connect/${encodeURIComponent(_connectTarget.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove failed');

      delete _overrides[_connectTarget.id];
      ftCloseConnect();
      rebuildTree();
    } catch (err) {
      console.error('Remove connection failed:', err);
      alert('Could not remove connection: ' + err.message);
    } finally {
      if (btn) { btn.textContent = 'Remove'; btn.disabled = false; }
    }
  }

  function rebuildTree() {
    _rootData = _gedcomLoaded
      ? buildTreeFromGedcom(_people, _families, _gedcomRootId, _overrides)
      : buildTree(_people, _overrides);
    render();
  }

  /* ── Backdrop helper (light scrim behind panels) ──────────────────────── */

  function showBackdrop(onDismiss, zIndex) {
    removeBackdrop();
    _backdrop = document.createElement('div');
    _backdrop.className = 'ft-backdrop';
    _backdrop.style.zIndex = zIndex || 1999;
    _backdrop.addEventListener('click', onDismiss);
    document.body.appendChild(_backdrop);
  }

  function removeBackdrop() {
    if (_backdrop && _backdrop.parentNode) _backdrop.parentNode.removeChild(_backdrop);
    _backdrop = null;
  }

  /* ── Local HTML escape helpers ────────────────────────────────────────── */

  function escHtmlLocal(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escBacktick(s) {
    return String(s || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  }

  function closeDropdown(role) {
    const drop = document.getElementById(`ft-${role}-dropdown`);
    if (drop) drop.classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════════════════
     ZOOM / PAN
  ══════════════════════════════════════════════════════════════════ */

  function setupZoom() {
    _zoomBehavior = d3.zoom()
      .scaleExtent([0.08, 3])
      .on('zoom', event => _g.attr('transform', event.transform));
    _svg.call(_zoomBehavior);
  }

  function zoomIn()  { _svg.transition().duration(280).call(_zoomBehavior.scaleBy, 1.35); }
  function zoomOut() { _svg.transition().duration(280).call(_zoomBehavior.scaleBy, 1 / 1.35); }

  function resetView() {
    const container = document.getElementById('ft-container');
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;

    // Centre on root node: root is at (0,0) in the tree; translate so it's
    // 1/4 from the left (horizontal) or 1/4 from the top (vertical)
    const tx = _orientation === 'horizontal' ? W * 0.25 : W / 2;
    const ty = H / 2;

    _svg.transition().duration(550).call(
      _zoomBehavior.transform,
      d3.zoomIdentity.translate(tx, ty).scale(0.82)
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     SEARCH
  ══════════════════════════════════════════════════════════════════ */

  function doSearch(term) {
    _searchTerm = (term || '').trim().toLowerCase();

    if (!_searchTerm) {
      render();
      return;
    }

    render(); // highlight first

    // Find matching node in currently visible tree
    const hier   = d3.hierarchy(_rootData, d => d.children);
    const layout = makeLayout();
    layout(hier);

    const match = hier.descendants()
      .find(d => (d.data.name || '').toLowerCase().includes(_searchTerm));

    if (!match) return;

    const container = document.getElementById('ft-container');
    const W = container.clientWidth;
    const H = container.clientHeight;
    const pos = nodeXY(match);

    _svg.transition().duration(620).call(
      _zoomBehavior.transform,
      d3.zoomIdentity
        .translate(W / 2 - pos.x * 0.9, H / 2 - pos.y * 0.9)
        .scale(0.9)
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     ORIENTATION TOGGLE
  ══════════════════════════════════════════════════════════════════ */

  function setOrientation(mode) {
    _orientation = mode;
    document.querySelectorAll('.ft-orient-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.orient === mode);
    });
    render();
    setTimeout(resetView, 60);
  }

  /* ══════════════════════════════════════════════════════════════════
     INIT  — main entry point called by app.js
  ══════════════════════════════════════════════════════════════════ */

  async function init() {
    const container = document.getElementById('ft-container');
    if (!container) return;

    container.innerHTML = `
      <div class="ft-loading">
        <span class="spinner"></span>
        <span style="color:var(--muted);font-size:.9rem;">Building family tree…</span>
      </div>`;

    try {
      const res  = await fetch('/api/family-tree');
      const raw  = await res.json();
      if (raw.error) throw new Error(raw.error);

      // API returns { people, families, gedcomLoaded, gedcomRootId }
      // (backward compat: if it's a plain array, treat as legacy format)
      let people, families, gedcomLoaded, gedcomRootId;
      if (Array.isArray(raw)) {
        people = raw; families = []; gedcomLoaded = false; gedcomRootId = null;
      } else {
        people       = raw.people       || [];
        families     = raw.families     || [];
        gedcomLoaded = raw.gedcomLoaded || false;
        gedcomRootId = raw.gedcomRootId || null;
      }

      _people       = people;
      _families     = families;
      _gedcomLoaded = gedcomLoaded;
      _gedcomRootId = gedcomRootId;
      _overrides    = raw.overrides || {};

      const rootData = gedcomLoaded
        ? buildTreeFromGedcom(people, families, gedcomRootId, _overrides)
        : buildTree(people, _overrides);

      if (!rootData) {
        container.innerHTML = `
          <div class="ft-empty">
            <div class="ft-empty-icon">&#x1F333;</div>
            <div>No people found in your database.</div>
            <div style="color:var(--muted2);font-size:.82rem;margin-top:4px;">
              ${gedcomLoaded
                ? 'GEDCOM data loaded but no tree could be built.'
                : 'Add people to the People table to build your tree.'}
            </div>
          </div>`;
        return;
      }

      _rootData = rootData;

      /* ── Build SVG ── */
      container.innerHTML = '';

      _svg = d3.select(container)
        .append('svg')
          .attr('id', 'ft-svg')
          .attr('width', '100%')
          .attr('height', '100%');

      _svg.append('defs'); // clip-path container

      _g = _svg.append('g').attr('class', 'ft-canvas');

      setupZoom();
      render(true);
      setTimeout(resetView, 80);

      // Show a subtle badge if GEDCOM data is driving the tree
      if (gedcomLoaded) {
        const badge = document.createElement('div');
        badge.style.cssText =
          'position:absolute;top:12px;right:12px;background:rgba(201,168,76,0.12);' +
          'border:1px solid rgba(201,168,76,0.3);border-radius:6px;padding:4px 10px;' +
          'font-size:.72rem;color:#c9a84c;pointer-events:none;';
        badge.textContent = `${people.length.toLocaleString()} people · GEDCOM`;
        container.style.position = 'relative';
        container.appendChild(badge);
      }

    } catch (err) {
      container.innerHTML = `
        <div class="ft-empty">
          <div style="color:var(--danger);font-size:.85rem;">
            Could not load family tree: ${err.message}
          </div>
        </div>`;
    }
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  global.initFamilyTree       = init;
  global.ftSearch             = doSearch;
  global.ftZoomIn             = zoomIn;
  global.ftZoomOut            = zoomOut;
  global.ftResetView          = resetView;
  global.ftSetOrientation     = setOrientation;
  global.ftToggleEditMode     = toggleEditMode;
  global.ftDismissContextMenu = dismissContextMenu;
  global.ftCloseConnect       = ftCloseConnect;
  global.ftSearchParent       = ftSearchParent;
  global.ftSelectParent       = ftSelectParent;
  global.ftClearParent        = ftClearParent;
  global.ftSaveConnection     = ftSaveConnection;
  global.ftRemoveConnection   = ftRemoveConnection;

})(window);
