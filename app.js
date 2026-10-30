/* Eröffnungstrainer 1.2 – Heute, Theorie, Training, Fallen, Gegenseite, eigene Eröffnungen, Stufen, Import, Ergänzungen */
(function () {
  'use strict';
  const { Chess, toGerman, squareName, parseSquare } = window.ChessCore;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ---------- Speicher ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const APP_VERSION = '1.2';
  const PROG_KEY = 'et-progress-v1';   /* Schlüssel bleibt gleich, damit der Lernstand aus 1.0 übernommen wird */
  const CUSTOM_KEY = 'et-custom-v1';
  let progress = normalizeProgress(store.get(PROG_KEY, null));
  function normalizeProgress(p) {
    if (!p || typeof p !== 'object') p = {};
    for (const k of ['lines', 'moves', 'fails', 'traps', 'gs', 'stufen']) if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = {};
    p.version = 2;
    return p;
  }
  const saveProgress = () => store.set(PROG_KEY, progress);

  /* ---------- Farbschema ---------- */
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABEL = { auto: 'automatisch', light: 'hell', dark: 'dunkel' };
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const b = $('#theme-btn');
    if (b) { b.title = 'Farbschema: ' + THEME_LABEL[t]; b.setAttribute('aria-label', 'Farbschema wechseln, aktuell ' + THEME_LABEL[t]); }
  }
  let theme = store.get('et-theme', 'auto');
  applyTheme(theme);

  /* ---------- Figuren (eigene SVG-Zeichnungen) ---------- */
  const PIECE_PATHS = {
    p: '<circle cx="50" cy="30" r="12"/><path d="M38 44Q50 37 62 44L59 52Q66 63 70 74H30Q34 63 41 52Z"/><rect x="24" y="74" width="52" height="11" rx="4"/>',
    r: '<path d="M28 85H72V74H66L63 44H69V27H61V34H54V27H46V34H39V27H31V44H37L34 74H28Z"/>',
    n: '<path d="M30 85H73C73 64 67 50 65 40C63 28 55 20 43 18L41 11L35 19C29 23 23 33 21 43C20 49 25 53 29 51L37 45C41 45 45 43 47 39C47 49 39 57 35 65C33 71 30 78 30 85Z"/><circle class="dt" cx="37" cy="29" r="3"/>',
    b: '<circle cx="50" cy="14" r="6"/><path d="M50 21C64 31 67 47 59 58L62 65H38L41 58C33 47 36 31 50 21Z"/><path d="M28 86H72V77Q50 67 28 77Z"/><path class="dl" d="M54 33L45 46" fill="none"/>',
    q: '<path d="M27 76L20 37L35 56L36 26L46 52L50 22L54 52L64 26L65 56L80 37L73 76Z"/><circle cx="20" cy="35" r="5"/><circle cx="36" cy="24" r="5"/><circle cx="50" cy="19" r="5"/><circle cx="64" cy="24" r="5"/><circle cx="80" cy="35" r="5"/><rect x="24" y="75" width="52" height="11" rx="4"/>',
    k: '<rect x="45.5" y="8" width="9" height="24" rx="2"/><rect x="38" y="14" width="24" height="9" rx="2"/><path d="M50 36C38 30 21 36 23 50C25 60 32 66 34 73H66C68 66 75 60 77 50C79 36 62 30 50 36Z"/><rect x="27" y="73" width="46" height="12" rx="4"/>'
  };
  const pieceCache = {};
  function pieceSVG(p) {
    if (pieceCache[p]) return pieceCache[p];
    const white = p === p.toUpperCase();
    const fill = white ? '#fbfaf6' : '#22201e';
    const stroke = white ? '#24211e' : '#0c0b0a';
    const detail = white ? '#24211e' : '#f1ece2';
    const body = PIECE_PATHS[p.toLowerCase()]
      .replace('class="dt"', `fill="${detail}" stroke="none"`)
      .replace('class="dl"', `stroke="${detail}" stroke-width="4" stroke-linecap="round"`);
    const name = { p: 'Bauer', r: 'Turm', n: 'Springer', b: 'Läufer', q: 'Dame', k: 'König' }[p.toLowerCase()];
    return (pieceCache[p] = `<svg viewBox="0 0 100 100" role="img" aria-label="${white ? 'weißer' : 'schwarzer'} ${name}"><g fill="${fill}" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round">${body}</g></svg>`);
  }

  /* ---------- Brett ---------- */
  class Board {
    constructor(host, opts) {
      this.host = host;
      this.opts = opts || {};
      this.orientation = 'w';
      this.game = new Chess();
      this.lastMove = null;
      this.selected = -1;
      this.hintSq = -1;
      this.arrowsList = [];
      this.interactive = false;
      this.el = document.createElement('div');
      this.el.className = 'board';
      this.el.setAttribute('role', 'grid');
      this.el.setAttribute('aria-label', 'Schachbrett');
      this.squares = [];
      for (let i = 0; i < 64; i++) {
        const d = document.createElement('div');
        d.className = 'sq';
        this.squares.push(d);
        this.el.appendChild(d);
      }
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('class', 'arrows');
      this.svg.setAttribute('viewBox', '0 0 800 800');
      this.el.appendChild(this.svg);
      host.innerHTML = '';
      host.appendChild(this.el);
      this.bindPointer();
    }
    /* Bildschirmposition (0..63, oben links = 0) -> Feldindex */
    toSq(pos) { const row = Math.floor(pos / 8), col = pos % 8; return this.orientation === 'w' ? (7 - row) * 8 + col : row * 8 + (7 - col); }
    toPos(sq) { const f = sq & 7, r = sq >> 3; return this.orientation === 'w' ? (7 - r) * 8 + f : r * 8 + (7 - f); }
    set(game, lastMove) { this.game = game; this.lastMove = lastMove || null; this.selected = -1; this.render(); }
    flip() { this.orientation = this.orientation === 'w' ? 'b' : 'w'; this.render(); }
    setOrientation(o) { this.orientation = o; this.render(); }
    render() {
      const targets = this.selected >= 0 ? this.game.moves().filter(m => m.from === this.selected) : [];
      for (let pos = 0; pos < 64; pos++) {
        const sq = this.toSq(pos), el = this.squares[pos];
        const f = sq & 7, r = sq >> 3;
        const cls = ['sq', (f + r) % 2 ? 'l' : 'd'];
        if (this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq)) cls.push('last');
        if (this.selected === sq) cls.push('sel');
        if (this.hintSq === sq) cls.push('hint');
        el.className = cls.join(' ');
        el.dataset.sq = sq;
        const p = this.game.board[sq];
        let html = p ? `<div class="piece">${pieceSVG(p)}</div>` : '';
        const t = targets.find(m => m.to === sq);
        if (t) html += t.captured ? '<span class="ring"></span>' : '<span class="dot"></span>';
        const row = Math.floor(pos / 8), col = pos % 8;
        if (row === 7) html += `<span class="coord f">${'abcdefgh'[f]}</span>`;
        if (col === 0) html += `<span class="coord r">${r + 1}</span>`;
        el.innerHTML = html;
        el.setAttribute('aria-label', squareName(sq) + (p ? ' ' + (p === p.toUpperCase() ? 'weiß ' : 'schwarz ') + { p: 'Bauer', r: 'Turm', n: 'Springer', b: 'Läufer', q: 'Dame', k: 'König' }[p.toLowerCase()] : ''));
      }
      this.drawArrows();
    }
    center(sq) { const pos = this.toPos(sq); return [(pos % 8) * 100 + 50, Math.floor(pos / 8) * 100 + 50]; }
    setArrows(list) { this.arrowsList = list || []; this.drawArrows(); }
    drawArrows() {
      let out = '';
      for (const a of this.arrowsList) {
        const [x1, y1] = this.center(a.from), [x2, y2] = this.center(a.to);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
        const hx = x2 - ux * 30, hy = y2 - uy * 30, w = 13, hw = 30;
        const sx = x1 + ux * 22, sy = y1 + uy * 22;
        const px = -uy, py = ux;
        const pts = [
          [sx + px * w, sy + py * w], [hx + px * w, hy + py * w], [hx + px * hw, hy + py * hw], [x2 - ux * 4, y2 - uy * 4],
          [hx - px * hw, hy - py * hw], [hx - px * w, hy - py * w], [sx - px * w, sy - py * w]
        ].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        out += `<polygon points="${pts}" fill="var(--arrow)"/>`;
      }
      this.svg.innerHTML = out;
    }
    setHint(sq) { this.hintSq = sq; this.render(); }
    flash(sq, kind) {
      const el = this.squares[this.toPos(sq)];
      el.classList.remove('ok', 'bad'); void el.offsetWidth; el.classList.add(kind);
      setTimeout(() => el.classList.remove(kind), 750);
    }
    shake() { this.el.classList.remove('shake'); void this.el.offsetWidth; this.el.classList.add('shake'); }
    canPick(sq) {
      const p = this.game.board[sq];
      if (!this.interactive || !p) return false;
      const c = p === p.toUpperCase() ? 'w' : 'b';
      const want = this.opts.color ? this.opts.color() : null;
      return c === this.game.turn && (!want || want === c);
    }
    sqFromPoint(x, y) {
      const r = this.el.getBoundingClientRect();
      if (x < r.left || y < r.top || x >= r.right || y >= r.bottom) return -1;
      const col = Math.floor((x - r.left) / (r.width / 8)), row = Math.floor((y - r.top) / (r.height / 8));
      return this.toSq(row * 8 + col);
    }
    tryMove(from, to) {
      this.selected = -1;
      const ok = this.opts.onMove ? this.opts.onMove({ from, to }) : false;
      if (!ok) this.render();
    }
    bindPointer() {
      let drag = null;
      const cleanup = () => {
        if (drag && drag.ghost) drag.ghost.remove();
        if (drag) this.squares[this.toPos(drag.from)].classList.remove('dragfrom');
        drag = null;
      };
      this.el.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        const sq = this.sqFromPoint(e.clientX, e.clientY);
        if (sq < 0) return;
        if (this.selected >= 0 && this.selected !== sq && !this.canPick(sq)) {
          const from = this.selected;
          this.tryMove(from, sq);
          return;
        }
        if (!this.canPick(sq)) { if (this.selected >= 0) { this.selected = -1; this.render(); } return; }
        e.preventDefault();
        this.el.setPointerCapture && this.el.setPointerCapture(e.pointerId);
        drag = { from: sq, x: e.clientX, y: e.clientY, moved: false, ghost: null, wasSelected: this.selected === sq };
        this.selected = sq; this.render();
      });
      this.el.addEventListener('pointermove', e => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
        const r = this.el.getBoundingClientRect();
        if (!drag.moved) {
          drag.moved = true;
          const g = document.createElement('div');
          g.className = 'ghost';
          g.style.width = g.style.height = (r.width / 8) + 'px';
          g.innerHTML = pieceSVG(this.game.board[drag.from]);
          this.el.appendChild(g);
          drag.ghost = g;
          this.squares[this.toPos(drag.from)].classList.add('dragfrom');
        }
        drag.ghost.style.left = (e.clientX - r.left) + 'px';
        drag.ghost.style.top = (e.clientY - r.top) + 'px';
      });
      const end = e => {
        if (!drag) return;
        const d = drag;
        cleanup();
        if (d.moved) {
          const to = this.sqFromPoint(e.clientX, e.clientY);
          if (to >= 0 && to !== d.from) this.tryMove(d.from, to);
          else { this.selected = -1; this.render(); }
        } else if (d.wasSelected) { this.selected = -1; this.render(); }
      };
      this.el.addEventListener('pointerup', end);
      this.el.addEventListener('pointercancel', () => { cleanup(); this.selected = -1; this.render(); });
    }
  }

  /* ---------- Daten ---------- */
  let DATA = null;
  let CUSTOM = loadCustom();
  let OPS = {};
  let ALL = [];
  function loadCustom() {
    const c = store.get(CUSTOM_KEY, []);
    return Array.isArray(c) ? c.filter(validCustom) : [];
  }
  function validCustom(o) {
    return o && typeof o.id === 'string' && typeof o.name === 'string' && (o.side === 'w' || o.side === 'b') &&
      Array.isArray(o.lines) && o.lines.length && o.lines.every(l => l && typeof l.name === 'string' && Array.isArray(l.moves) && l.moves.length);
  }
  const EXTRA_FIELDS = ['eco', 'group', 'score', 'schaerfe', 'haeufigkeit', 'imported', 'source'];
  const plainLine = l => { const o = { name: l.name, freq: l.freq, moves: l.moves.slice(), comments: Object.assign({}, l.comments || {}) }; if (l.rec) o.rec = true; if (l.dbChecked !== undefined) o.dbChecked = l.dbChecked; return o; };
  const plainCustom = o => {
    const out = { id: o.id, name: o.name, side: o.side, idea: o.idea || '', custom: true, lines: (o._base || o.lines).map(plainLine) };
    for (const k of EXTRA_FIELDS) if (o[k] !== undefined && o[k] !== '') out[k] = o[k];
    if (o.traps && o.traps.length) out.traps = o.traps.map(t => ({ name: t.name, moves: t.moves.slice(), solution: t.solution.slice(), explain: t.explain || '' }));
    if (o.stufeFile) out.stufe = o.stufeFile;
    return out;
  };
  const saveCustom = () => store.set(CUSTOM_KEY, CUSTOM.map(plainCustom));

  function buildTree(op) {
    const root = { san: null, children: [], parent: null, ply: 0, comment: null, lines: [] };
    op.lines.forEach((ln, li) => {
      let node = root;
      root.lines.push(li);
      ln.moves.forEach((san, i) => {
        let child = node.children.find(c => c.san === san);
        if (!child) { child = { san, children: [], parent: node, ply: i + 1, comment: null, lines: [] }; node.children.push(child); }
        const c = ln.comments && ln.comments[i + 1];
        if (c && !child.comment) child.comment = c;
        child.lines.push(li);
        node = child;
      });
    });
    return root;
  }
  function prepCustom(o) {
    o.custom = true;
    if (!o.eco) o.eco = '';
    if (!o.group) o.group = o.imported ? 'Importiert' : 'Eigene Eröffnungen';
    if (!Array.isArray(o.traps)) o.traps = [];
    if (!o.score) o.score = '';
    if (!o.idea) o.idea = '';
    o.lines.forEach((l, i) => { if (!l.freq) l.freq = i === 0 ? 'haupt' : 'neben'; if (!l.comments) l.comments = {}; });
    if (!o._prepped) { o.stufeFile = STUFEN[o.stufe] ? o.stufe : null; o._prepped = true; }
    const sc = scoreOpening(o);
    o.punkte = sc.punkte; o.stufe = o.stufeFile || sc.stufe;
    return o;
  }

  /* ---------- Stufen: Merkschwierigkeit + Seltenheit (gleiche Formel wie in openings.json) ---------- */
  const STUFEN = { anfaenger: 'Anfänger', fortgeschritten: 'Fortgeschritten', profi: 'Profi' };
  const STUFE_ORDER = ['anfaenger', 'fortgeschritten', 'profi'];
  const norm01 = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  function scoreOpening(op) {
    const lines = op._base || op.lines;
    const own = new Set(); let maxP = 0;
    for (const l of lines) {
      maxP = Math.max(maxP, l.moves.length);
      l.moves.forEach((_, i) => { const ply = i + 1; if ((ply % 2 === 1) === (op.side === 'w')) own.add(l.moves.slice(0, ply).join(' ')); });
    }
    const sharp = +op.schaerfe || 3, freq = +op.haeufigkeit || 3;
    const memo = 50 * (0.5 * norm01(own.size, 10, 50) + 0.2 * norm01(maxP, 10, 22) + 0.3 * norm01(sharp, 1, 5));
    const rare = 50 * (5 - Math.max(1, Math.min(5, freq))) / 4;
    const punkte = Math.round(memo + rare);
    return { punkte, stufe: punkte < 40 ? 'anfaenger' : punkte < 60 ? 'fortgeschritten' : 'profi', own: own.size, maxP };
  }
  const stufeOf = op => (progress.stufen[op.id] && STUFEN[progress.stufen[op.id]]) ? progress.stufen[op.id] : (STUFEN[op.stufe] ? op.stufe : scoreOpening(op).stufe);
  const stufeBadge = op => `<span class="lv lv-${stufeOf(op)}">${STUFEN[stufeOf(op)]}</span>`;

  /* ---------- Ergänzungen eingebauter Eröffnungen (getrennt gespeichert) ---------- */
  const EXT_KEY = 'et-ext-v1';
  let EXT = (() => { const e = store.get(EXT_KEY, {}); return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; })();
  const saveExt = () => store.set(EXT_KEY, EXT);
  function applyExt(op) {
    if (!op._base) op._base = op.lines;
    const list = op.custom ? [] : (EXT[op.id] || []);
    op.extKeys = new Set(); op.extSkipped = 0;
    if (!list.length) { op.lines = op._base; return; }
    const tree = buildTree({ lines: op._base });
    const nodeAt = path => { let n = tree; for (const s of path) { n = n.children.find(c => c.san === s); if (!n) return null; } return n; };
    for (const e of list.slice().sort((a, b) => a.path.length - b.path.length)) {
      if (!e || !Array.isArray(e.path) || !e.path.length) { op.extSkipped++; continue; }
      const parent = nodeAt(e.path.slice(0, -1));
      const san = e.path[e.path.length - 1];
      if (!parent) { op.extSkipped++; continue; }
      if (parent.children.some(c => c.san === san)) continue;
      const g = new Chess(); let ok = true;
      for (const m of e.path) if (!g.move(m)) { ok = false; break; }
      const own = (e.path.length % 2 === 1) === (op.side === 'w');
      if (!ok || (own && parent.children.length)) { op.extSkipped++; continue; }
      parent.children.push({ san, children: [], parent, ply: e.path.length, comment: e.comment || null, lines: [], ext: true });
      op.extKeys.add(e.path.join(' '));
    }
    // Varianten aus allen Endpunkten ableiten; verlängerte Varianten behalten ihren Namen (und damit den Lernstand)
    const claimed = new Set(), out = [];
    const leaves = [];
    const walk = (n, path) => { if (!n.children.length) { if (path.length) leaves.push(path); return; } n.children.forEach(c => walk(c, path.concat([c]))); };
    walk(tree, []);
    for (const path of leaves) {
      const moves = path.map(n => n.san);
      const comments = {};
      path.forEach(n => { if (n.comment) comments[n.ply] = n.comment; });
      let bi = op._base.findIndex((l, i) => !claimed.has(i) && l.moves.length <= moves.length && l.moves.every((m, k) => m === moves[k]));
      if (bi >= 0 && op._base.findIndex(l => l.moves.length === moves.length && l.moves.every((m, k) => m === moves[k])) === bi) {
        claimed.add(bi); out.push(op._base[bi]); continue;
      }
      const hasExt = path.some(n => n.ext);
      if (bi >= 0) {
        claimed.add(bi);
        const b = op._base[bi];
        out.push(Object.assign({}, b, { moves, comments: Object.assign({}, b.comments, comments), extended: hasExt }));
      } else {
        const first = path.find(n => n.ext);
        out.push({ name: 'Ergänzung: Mit ' + moveLabel(first.ply, first.san), freq: 'neben', moves, comments, ext: true, extended: true });
      }
    }
    const used = new Set();
    out.forEach(l => { let nm = l.name, k = 2; while (used.has(nm)) nm = l.name + ' (' + (k++) + ')'; used.add(nm); l.name = nm; });
    op.lines = out;
  }
  function markExt(op) {
    const walk = (n, path) => { for (const c of n.children) { const p = path.concat([c.san]); if (op.extKeys && op.extKeys.has(p.join(' '))) c.ext = true; walk(c, p); } };
    walk(op.tree, []);
  }
  function indexOps() {
    OPS = {};
    ALL = DATA.openings.concat(CUSTOM.map(prepCustom));
    for (const op of ALL) { applyExt(op); op.tree = buildTree(op); markExt(op); OPS[op.id] = op; }
  }

  /* Lernstand bereinigen: Einträge zu Eröffnungen oder Varianten, die es nicht mehr gibt, still verwerfen */
  function pruneProgress() {
    const validLine = new Set(), validTrap = new Set();
    for (const op of ALL) {
      op.lines.forEach((_, li) => validLine.add(lineKey(op, li)));
      (op.traps || []).forEach((_, ti) => validTrap.add(op.id + ':' + ti));
    }
    for (const k of Object.keys(progress.lines)) if (!validLine.has(k)) delete progress.lines[k];
    for (const k of Object.keys(progress.fails)) if (!validLine.has(k)) delete progress.fails[k];
    for (const k of Object.keys(progress.moves)) if (!OPS[k]) delete progress.moves[k];
    for (const k of Object.keys(progress.gs)) if (!OPS[k]) delete progress.gs[k];
    for (const k of Object.keys(progress.traps)) if (!validTrap.has(k)) delete progress.traps[k];
    for (const k of Object.keys(progress.stufen)) if (!OPS[k] || !STUFEN[progress.stufen[k]]) delete progress.stufen[k];
    saveProgress();
  }

  const lineKey = (op, li) => op.id + ':' + op.lines[li].name;
  const moveLabel = (ply, san) => { const n = Math.ceil(ply / 2); return (ply % 2 ? n + '. ' : n + '… ') + toGerman(san); };
  const sideText = s => (s === 'w' ? 'Du spielst Weiß' : 'Du spielst Schwarz');
  const other = s => (s === 'w' ? 'b' : 'w');
  const freqLabel = f => (f === 'haupt' ? 'Hauptvariante' : 'Nebenvariante');
  const freqBadge = f => `<span class="fq ${f === 'haupt' ? 'haupt' : 'neben'}">${f === 'haupt' ? 'Haupt' : 'Neben'}</span>`;
  function pathOf(node) { const p = []; while (node && node.san) { p.unshift(node); node = node.parent; } return p; }
  function gameAt(node) {
    const g = new Chess(); let last = null;
    for (const n of pathOf(node)) last = g.move(n.san);
    return { game: g, last };
  }
  function recChild(op, node) {
    const recLi = op.lines.findIndex(l => l.rec);
    return node.children.find(c => recLi >= 0 && c.lines.includes(recLi)) ||
      node.children.find(c => c.lines.some(li => op.lines[li].freq === 'haupt')) || node.children[0];
  }
  function moveFromBoard(g, from, to) {
    const legal = g.moves().filter(m => m.from === from && m.to === to);
    if (!legal.length) return null;
    return legal.find(x => !x.promotion || x.promotion === 'Q');
  }
  const cleanSan = s => String(s).replace(/[+#]/g, '');

  /* ---------- Wiederholung (Kästchen-System) ---------- */
  const HOURS = [0, 4, 24, 72, 168, 336, 720];
  function srUpdate(map, key, perfect) {
    const s = map[key] || { box: 0, due: 0, seen: 0, perfect: 0, fails: 0, last: 0 };
    s.seen++; s.last = Date.now();
    if (perfect) { s.perfect++; s.box = Math.min(s.box + 1, HOURS.length - 1); }
    else { s.fails++; s.box = 0; }
    s.due = Date.now() + HOURS[s.box] * 3.6e6;
    map[key] = s;
    saveProgress();
    return s;
  }
  const nextText = s => s.box === 0 ? 'Sie kommt gleich wieder dran.' : s.box >= 2 ? 'Sitzt. Sie kommt später zur Auffrischung wieder.' : 'Noch einmal fehlerfrei, dann sitzt sie.';

  /* ---------- Navigation ---------- */
  let currentView = 'heute';
  function show(id) {
    $$('.view').forEach(v => { v.hidden = v.id !== id; });
    window.scrollTo({ top: 0 });
  }
  function markTab(view) { $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view))); }
  function setTab(view) {
    if (TR.running && view !== 'training') stopRun();
    currentView = view;
    markTab(view);
    if (view === 'heute') { renderToday(); show('view-heute'); }
    if (view === 'theorie') { if (TH.op && !OPS[TH.op.id]) TH.op = null; if (!TH.op) renderList(); show(TH.op ? 'view-theorie-op' : 'view-theorie-list'); }
    if (view === 'training') { if (TR.running) show('view-training-run'); else { renderSetup(); show('view-training-setup'); } }
    if (view === 'eigene') { if (ED.open) show('view-editor'); else { renderCustomList(); show('view-eigene-list'); } }
    if (view === 'statistik') { renderStats(); show('view-statistik'); }
  }

  /* ================= HEUTE ================= */
  function allLines() {
    const out = [];
    for (const op of ALL) op.lines.forEach((l, li) => out.push({ op, li, key: lineKey(op, li), s: progress.lines[lineKey(op, li)], haupt: l.freq === 'haupt' }));
    return out;
  }
  function allTraps() {
    const out = [];
    for (const op of ALL) (op.traps || []).forEach((t, ti) => out.push({ op, ti, key: op.id + ':' + ti, s: progress.traps[op.id + ':' + ti] }));
    return out;
  }
  const DAILY_LINES = 8, DAILY_NEW = 4;
  function buildDaily() {
    const now = Date.now(), lines = allLines();
    const due = lines.filter(x => x.s && x.s.due <= now).sort((a, b) =>
      (progress.fails[b.key] ? 1 : 0) - (progress.fails[a.key] ? 1 : 0) || (b.haupt - a.haupt) || (a.s.box - b.s.box) || (a.s.due - b.s.due));
    const items = due.slice(0, DAILY_LINES).map(x => ({ type: 'line', op: x.op, li: x.li }));
    if (items.length < DAILY_LINES) {
      // neue Varianten: Hauptvarianten zuerst, Weiß und Schwarz abwechselnd
      const fresh = lines.filter(x => !x.s).sort((a, b) => (b.haupt - a.haupt) || (ALL.indexOf(a.op) - ALL.indexOf(b.op)));
      const w = fresh.filter(x => x.op.side === 'w'), bl = fresh.filter(x => x.op.side === 'b'), mixed = [];
      while (w.length || bl.length) { if (w.length) mixed.push(w.shift()); if (bl.length) mixed.push(bl.shift()); }
      mixed.slice(0, Math.min(DAILY_NEW, DAILY_LINES - items.length)).forEach(x => items.push({ type: 'line', op: x.op, li: x.li }));
    }
    if (!items.length) {
      lines.filter(x => x.s).sort((a, b) => a.s.due - b.s.due).slice(0, 3).forEach(x => items.push({ type: 'line', op: x.op, li: x.li }));
    }
    const traps = allTraps();
    if (traps.length) {
      const t = traps.filter(x => x.s && x.s.due <= now).sort((a, b) => a.s.box - b.s.box)[0] ||
        traps.filter(x => !x.s)[0] || traps.slice().sort((a, b) => a.s.due - b.s.due)[0];
      items.push({ type: 'trap', op: t.op, ti: t.ti });
    }
    return items;
  }
  function renderToday() {
    const now = Date.now(), lines = allLines();
    const due = lines.filter(x => x.s && x.s.due <= now).length;
    const fresh = lines.filter(x => !x.s).length;
    const sit = lines.filter(x => x.s && x.s.box >= 2).length;
    const items = buildDaily();
    const nLines = items.filter(i => i.type === 'line').length, nTrap = items.length - nLines;
    $('#today-summary').innerHTML = `<div class="total"><span class="n">${due}</span><span class="t">Varianten fällig</span></div>
      <div class="total"><span class="n">${fresh}</span><span class="t">noch nie geübt</span></div>
      <div class="total"><span class="n">${sit}/${lines.length}</span><span class="t">Varianten sitzen</span></div>`;
    $('#today-plan').textContent = `Heute: ${nLines} Variante${nLines === 1 ? '' : 'n'}${nTrap ? ' und 1 Falle' : ''}, etwa ${Math.max(3, Math.round(items.length * 0.7))} Minuten.`;
    const fails = Object.keys(progress.fails).length;
    $('#today-note').textContent = fails ? `${fails} Variante${fails === 1 ? '' : 'n'} mit Fehlern vom letzten Mal ${fails === 1 ? 'kommt' : 'kommen'} zuerst dran.` : '';
  }

  /* ================= THEORIE ================= */
  const TH = { op: null, tree: null, node: null, line: 0, board: null, filter: 'all', query: '', stufe: store.get('et-th-stufe', 'all'), sort: store.get('et-th-sort', 'farbe') };
  function learnedCount(op) { return op.lines.filter((_, li) => { const s = progress.lines[lineKey(op, li)]; return s && s.box >= 2; }).length; }

  function renderList() {
    const q = TH.query.trim().toLowerCase();
    const groups = new Map();
    let list = ALL.filter(op => {
      if (TH.filter !== 'all' && op.side !== TH.filter) return false;
      if (TH.stufe !== 'all' && stufeOf(op) !== TH.stufe) return false;
      const hay = (op.name + ' ' + op.eco + ' ' + op.group + ' ' + STUFEN[stufeOf(op)] + ' ' + op.lines.map(l => l.name).join(' ')).toLowerCase();
      return !q || hay.includes(q);
    });
    if (TH.sort === 'stufe') {
      list = list.slice().sort((a, b) => STUFE_ORDER.indexOf(stufeOf(a)) - STUFE_ORDER.indexOf(stufeOf(b)) || a.punkte - b.punkte);
      for (const st of STUFE_ORDER) groups.set(STUFEN[st], []);
      for (const op of list) groups.get(STUFEN[stufeOf(op)]).push(op);
      for (const [k, v] of groups) if (!v.length) groups.delete(k);
    } else {
      for (const op of list) {
        const g = op.custom ? (op.imported ? 'Importierte Eröffnungen' : 'Eigene Eröffnungen') : (op.side === 'w' ? 'Mit Weiß' : 'Mit Schwarz') + (op.side === 'b' ? ' · gegen ' + op.group.split(' ')[0] : '');
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(op);
      }
    }
    const host = $('#op-list');
    if (!groups.size) { host.innerHTML = '<p class="lead">Keine Eröffnung gefunden. Versuche einen anderen Suchbegriff.</p>'; return; }
    let html = '';
    for (const [g, ops] of groups) {
      html += `<div class="op-group"><h2>${esc(g)}</h2><div class="op-cards">`;
      for (const op of ops) {
        const learned = learnedCount(op);
        html += `<button type="button" class="op-card" data-op="${esc(op.id)}">
          <span class="title">${esc(op.name)}</span>
          <span class="sub">${stufeBadge(op)}<span class="pts">${op.punkte} Punkte</span>${op.lines.some(l => l.extended) ? '<span class="fq eigen">+ Ergänzt</span>' : ''}</span>
          <span class="sub"><span class="side-badge ${op.side}">${op.side === 'w' ? 'Weiß' : 'Schwarz'}</span>${op.eco ? `<span class="eco">${esc(op.eco)}</span>` : ''}<span>${op.lines.length} Variante${op.lines.length === 1 ? '' : 'n'}</span>${op.traps && op.traps.length ? `<span>· ${op.traps.length} Falle${op.traps.length === 1 ? '' : 'n'}</span>` : ''}${learned ? `<span>· ${learned} sitzen</span>` : ''}</span>
          <span class="mini-progress" aria-hidden="true"><span style="width:${Math.round(learned / op.lines.length * 100)}%"></span></span>
        </button>`;
      }
      html += '</div></div>';
    }
    host.innerHTML = html;
  }

  function openOpening(id) {
    const op = OPS[id];
    if (!op) return;
    TH.op = op; TH.tree = op.tree; TH.node = op.tree; TH.line = 0;
    if (!TH.board) TH.board = new Board($('#th-board'), { onMove: theoryMove, color: () => null });
    TH.board.interactive = true;
    TH.board.setOrientation(op.side);
    $('#th-name').textContent = op.name;
    $('#th-eco').textContent = op.eco ? 'ECO ' + op.eco : 'Eigene Eröffnung';
    const sb = $('#th-side'); sb.className = 'side-badge ' + op.side; sb.textContent = sideText(op.side);
    $('#th-idea').textContent = op.idea || '';
    $('#th-idea').hidden = !op.idea;
    $('#th-score').innerHTML = op.score ? `<strong>Warum diese Eröffnung:</strong> ${esc(op.score)}. Quelle: Auswertung von 49,8 Mio. Lichess-Partien (The Opening Club, Mai 2026). Die Züge stammen aus der Eröffnungstheorie und sind nicht einzeln mit der Lichess-Datenbank abgeglichen.` : '';
    $('#th-score').hidden = !op.score;
    const nT = (op.traps || []).length;
    $('#th-actions').innerHTML = `<button type="button" class="btn" id="th-gs">Gegen diese Eröffnung üben</button>` +
      (nT ? `<button type="button" class="btn" id="th-traps">Fallen üben (${nT})</button>` : '') +
      `<button type="button" class="btn" id="th-extend">${op.custom ? 'Bearbeiten' : 'Erweitern'}</button>`;
    renderStufeBox();
    show('view-theorie-op');
    renderTheory();
  }

  function renderStufeBox() {
    const op = TH.op, sc = scoreOpening(op), cur = stufeOf(op), own = !!progress.stufen[op.id];
    const base = STUFEN[op.stufe] ? op.stufe : sc.stufe;
    $('#th-stufe').innerHTML = `<label class="stufe-field"><span>Stufe</span><select id="th-stufe-sel">${STUFE_ORDER.map(s => `<option value="${s}"${s === cur ? ' selected' : ''}>${STUFEN[s]}</option>`).join('')}</select></label>
      <span class="help">${op.punkte} Punkte · berechnet: ${STUFEN[base]}${own ? ' · von dir geändert <button type="button" class="linkish" id="th-stufe-reset">zurücksetzen</button>' : ''}</span>`;
  }
  function setStufe(op, st) {
    const base = STUFEN[op.stufe] ? op.stufe : scoreOpening(op).stufe;
    if (st === base) delete progress.stufen[op.id]; else progress.stufen[op.id] = st;
    saveProgress();
  }
  function goNode(node) {
    TH.node = node;
    if (!node.lines.includes(TH.line)) TH.line = node.lines[0];
    renderTheory();
  }
  function selectLine(li) {
    TH.line = li;
    let n = TH.node;
    while (n.parent && !n.lines.includes(li)) n = n.parent;
    TH.node = n;
    renderTheory();
  }
  function childOnLine(node) { return node.children.find(c => c.lines.includes(TH.line)) || node.children[0]; }

  function renderTheory() {
    const { op, node } = TH;
    const { game, last } = gameAt(node);
    TH.board.set(game, last);
    TH.board.setArrows([]);
    $('#th-lines').innerHTML = op.lines.map((l, li) =>
      `<button type="button" class="chip" data-line="${li}" aria-pressed="${li === TH.line}">${esc(l.name)} ${freqBadge(l.freq)}${l.extended ? ' <span class="fq eigen">+ Eigen</span>' : ''}</button>`).join('');
    const cm = $('#th-comment');
    if (!node.san) {
      cm.innerHTML = `<p>Ausgangsstellung. Drücke <strong>▶</strong> oder ziehe selbst auf dem Brett.</p>`;
    } else {
      const own = node.ply % 2 === (op.side === 'w' ? 1 : 0);
      cm.innerHTML = `<p><span class="mv">${esc(moveLabel(node.ply, node.san))}</span> <span class="lead">· ${own ? 'Dein Zug' : 'Gegnerzug'}</span>${node.ext ? ' <span class="fq eigen">Deine Ergänzung</span>' : ''}</p>` +
        (node.comment ? `<p>${esc(node.comment)}</p>` : '');
    }
    const br = $('#th-branch');
    if (node.children.length > 1) {
      const opp = node.children[0].ply % 2 === (op.side === 'w' ? 0 : 1);
      br.hidden = false;
      br.innerHTML = `<p>${opp ? 'Hier hat der Gegner mehrere Möglichkeiten. Wähle seine Antwort:' : 'Hier gibt es mehrere Fortsetzungen:'}</p><div class="opts">` +
        node.children.map((c, i) => {
          const names = c.lines.map(li => op.lines[li].name).join(' · ');
          const haupt = c.lines.some(li => op.lines[li].freq === 'haupt');
          return `<button type="button" class="branch-opt" data-child="${i}" aria-pressed="${c.lines.includes(TH.line)}"><span class="mv">${esc(moveLabel(c.ply, c.san))} ${freqBadge(haupt ? 'haupt' : 'neben')}</span><span class="nm">${esc(names)}</span></button>`;
        }).join('') + '</div>';
    } else br.hidden = true;
    const ln = op.lines[TH.line];
    let html = '';
    let walkN = op.tree;
    ln.moves.forEach((san, i) => {
      const ply = i + 1;
      walkN = walkN && walkN.children.find(c => c.san === san);
      if (ply % 2) html += `<li><span class="num">${Math.ceil(ply / 2)}.</span>`;
      const cls = (ply === node.ply ? 'cur' : ply > node.ply ? 'future' : '') + (walkN && walkN.ext ? ' ext' : '');
      html += `<button type="button" class="${cls}" data-ply="${ply}">${esc(toGerman(san))}</button>`;
      if (!(ply % 2) || ply === ln.moves.length) html += '</li>';
    });
    $('#th-moves').innerHTML = html;
    $('#th-first').disabled = $('#th-prev').disabled = !node.parent;
    $('#th-next').disabled = $('#th-last').disabled = !node.children.length;
  }
  function theoryNext() { const c = childOnLine(TH.node); if (c) goNode(c); }
  function theoryPrev() { if (TH.node.parent) goNode(TH.node.parent); }
  function theoryMove({ from, to }) {
    const g = gameAt(TH.node).game;
    const m = moveFromBoard(g, from, to);
    if (!m) return false;
    const child = TH.node.children.find(c => c.san === m.san);
    if (child) { goNode(child); return true; }
    TH.board.shake();
    $('#th-comment').innerHTML = `<p><span class="mv">${esc(toGerman(m.san))}</span> ist in den Varianten dieser Eröffnung nicht enthalten.</p>` +
      (TH.node.children.length ? `<p>Hier vorgesehen: ${TH.node.children.map(c => '<strong>' + esc(toGerman(c.san)) + '</strong>').join(' oder ')}.</p>` : '<p>Die Variante ist hier zu Ende.</p>');
    return false;
  }

  /* ================= TRAINING ================= */
  const TR = { cfg: Object.assign({ color: 'w', mode: 'random', op: '', line: 'all', gsOp: '', trapOp: 'all', stufe: 'all' }, store.get('et-train-cfg', {})),
    running: false, board: null, streak: 0, lastKey: null, session: null };
  if (!['random', 'target', 'gs', 'traps'].includes(TR.cfg.mode)) TR.cfg.mode = 'random';

  function lineCandidates() {
    const c = TR.cfg, out = [];
    for (const op of ALL) {
      if (op.side !== c.color) continue;
      if (c.mode === 'target' && op.id !== c.op) continue;
      if (c.mode !== 'target' && !stufeOk(op)) continue;
      op.lines.forEach((_, li) => {
        if (c.mode === 'target' && c.line !== 'all' && String(li) !== String(c.line)) return;
        out.push({ type: 'line', op, li, key: lineKey(op, li) });
      });
    }
    return out;
  }
  function trapCandidates() {
    const c = TR.cfg;
    return allTraps().filter(x => x.op.side === c.color && stufeOk(x.op) && (c.trapOp === 'all' || x.op.id === c.trapOp)).map(x => ({ type: 'trap', op: x.op, ti: x.ti, key: x.key }));
  }
  const stufeOk = op => TR.cfg.stufe === 'all' || stufeOf(op) === TR.cfg.stufe;
  function scoreItem(s, haupt) {
    const now = Date.now(), bonus = haupt ? 120 : 0;
    if (!s) return 1000 + bonus + Math.random() * 50;
    if (s.due <= now) return 2000 - s.box * 100 + bonus + Math.random() * 50;
    return 500 - s.box * 60 - (s.due - now) / 3.6e6 + bonus / 2 + Math.random() * 30;
  }
  function pickNext() {
    const c = TR.cfg;
    if (c.mode === 'gs') { const op = OPS[c.gsOp]; return op ? { type: 'gs', op } : null; }
    let list = c.mode === 'traps' ? trapCandidates() : lineCandidates();
    if (list.length > 1 && TR.lastKey) list = list.filter(x => x.key !== TR.lastKey);
    const sc = x => x.type === 'trap' ? scoreItem(progress.traps[x.key], false)
      : scoreItem(progress.lines[x.key], x.op.lines[x.li].freq === 'haupt') + (progress.fails[x.key] ? 300 : 0);
    list.forEach(x => { x.sc = sc(x); });
    list.sort((a, b) => b.sc - a.sc);
    return list[0] || null;
  }

  function renderSetup() {
    const c = TR.cfg;
    $$('#tr-form [data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === c.color)));
    $$('#tr-form [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === c.mode)));
    const help = {
      random: 'Die App wählt Eröffnung und Variante. Fällige, fehlerhafte und Hauptvarianten kommen zuerst.',
      target: 'Du übst eine bestimmte Eröffnung, auf Wunsch auch nur eine Variante.',
      gs: 'Du spielst die andere Farbe und übst, wie man am besten auf eine Eröffnung reagiert.',
      traps: 'Der Gegner macht einen typischen Fehler. Du findest den Zug, der ihn bestraft.'
    }[c.mode];
    $('#tr-mode-help').textContent = help;
    $('#tr-color-field').hidden = c.mode === 'gs';
    $('#tr-target').hidden = c.mode !== 'target';
    $('#tr-gs').hidden = c.mode !== 'gs';
    $('#tr-trapsel').hidden = c.mode !== 'traps';
    // Gezielt
    if (!['all'].concat(STUFE_ORDER).includes(c.stufe)) c.stufe = 'all';
    $('#tr-stufe').value = c.stufe;
    const ops = ALL.filter(o => o.side === c.color && stufeOk(o));
    if (!ops.some(o => o.id === c.op)) { c.op = ops[0] ? ops[0].id : ''; c.line = 'all'; }
    $('#tr-op').innerHTML = ops.length ? ops.map(o => `<option value="${esc(o.id)}"${o.id === c.op ? ' selected' : ''}>${esc(o.name)} (${STUFEN[stufeOf(o)]})</option>`).join('') : '<option value="">Keine Eröffnung in dieser Stufe</option>';
    const op = OPS[c.op];
    if (op && c.line !== 'all' && !op.lines[c.line]) c.line = 'all';
    $('#tr-line').innerHTML = `<option value="all">Alle Varianten</option>` +
      (op ? op.lines.map((l, li) => `<option value="${li}"${String(li) === String(c.line) ? ' selected' : ''}>${esc(l.name)} (${freqLabel(l.freq)})</option>`).join('') : '');
    // Gegenseite
    const gsOps = ALL.filter(stufeOk);
    if (!gsOps.some(o => o.id === c.gsOp)) c.gsOp = gsOps.length ? gsOps[0].id : '';
    $('#tr-gs-op').innerHTML = ['w', 'b'].map(side => `<optgroup label="${side === 'w' ? 'Weiß-Eröffnungen (du spielst Schwarz)' : 'Schwarz-Eröffnungen (du spielst Weiß)'}">` +
      gsOps.filter(o => o.side === side).map(o => `<option value="${esc(o.id)}"${o.id === c.gsOp ? ' selected' : ''}>Gegen ${esc(o.name)}</option>`).join('') + '</optgroup>').join('');
    // Fallen
    const tops = ALL.filter(o => o.side === c.color && stufeOk(o) && o.traps && o.traps.length);
    if (c.trapOp !== 'all' && !tops.some(o => o.id === c.trapOp)) c.trapOp = 'all';
    $('#tr-trap-op').innerHTML = `<option value="all">Alle Eröffnungen</option>` +
      tops.map(o => `<option value="${esc(o.id)}"${o.id === c.trapOp ? ' selected' : ''}>${esc(o.name)} (${o.traps.length})</option>`).join('');
    // Fälligkeit
    const now = Date.now();
    if (c.mode === 'gs') {
      const s = progress.gs[c.gsOp];
      $('#tr-due').innerHTML = s ? `Zuletzt geübt am <strong>${new Date(s.last).toLocaleDateString('de-AT')}</strong> · ${s.perfect} Mal fehlerfrei` : 'Gegen diese Eröffnung hast du noch nicht geübt.';
    } else {
      const list = c.mode === 'traps' ? trapCandidates() : lineCandidates();
      const map = c.mode === 'traps' ? progress.traps : progress.lines;
      let due = 0, fresh = 0;
      for (const x of list) { const s = map[x.key]; if (!s) fresh++; else if (s.due <= now) due++; }
      $('#tr-due').innerHTML = list.length ? `<strong>${list.length}</strong> ${c.mode === 'traps' ? 'Fallen' : 'Varianten'} in der Auswahl · <strong>${due}</strong> fällig · <strong>${fresh}</strong> noch nie geübt`
        : 'Für diese Auswahl gibt es nichts zu üben.';
    }
    store.set('et-train-cfg', c);
  }

  function startTraining() {
    TR.session = null;
    const item = pickNext();
    if (!item) return;
    runItem(item);
  }
  function startDaily() {
    const items = buildDaily();
    if (!items.length) return;
    TR.session = { items, idx: 0, done: 0, perfect: 0 };
    runItem(items[0]);
  }
  function startSingle(item) { TR.session = null; runItem(item); }
  function stopRun() { TR.running = false; TR.session = null; clearTimeout(TR.timer); }

  function runItem(item) {
    clearTimeout(TR.timer);
    TR.running = true;
    currentView = 'training'; markTab('training');
    show('view-training-run');
    if (!TR.board) TR.board = new Board($('#tr-board'), { onMove: runMove, color: () => TR.userColor });
    Object.assign(TR, { item, mode: item.type, op: item.op, game: new Chess(), last: null, errors: 0, erred: new Set(), finished: false, waiting: false, wrongCount: 0, plyMoves: [] });
    TR.board.setHint(-1); TR.board.setArrows([]);
    $('#tr-result').hidden = true;
    $('#tr-hint').disabled = false; $('#tr-skip').disabled = false;
    $('#tr-name').textContent = item.op.name;
    $('#tr-eco').textContent = item.op.eco ? 'ECO ' + item.op.eco : 'Eigene Eröffnung';
    const s = TR.session;
    $('#tr-session').hidden = !s;
    if (s) $('#tr-session').innerHTML = `<span>Tageseinheit</span><strong>Aufgabe ${s.idx + 1} von ${s.items.length}</strong><span class="bar"><span style="width:${Math.round(s.idx / s.items.length * 100)}%"></span></span>`;
    if (item.type === 'line') startLine(item.op, item.li);
    else if (item.type === 'trap') startTrap(item.op, item.ti);
    else startGs(item.op);
  }
  function setSide(color, text) { const sb = $('#tr-side'); sb.className = 'side-badge ' + color; sb.textContent = text || sideText(color); }
  function setFeedback(kind, html) { const f = $('#tr-feedback'); f.className = 'block feedback ' + kind; f.innerHTML = html; }
  function addFeedback(html) { $('#tr-feedback').insertAdjacentHTML('beforeend', html); }
  function renderMoves() {
    let html = '';
    TR.plyMoves.forEach((san, i) => {
      const ply = i + 1;
      if (ply % 2) html += `<li><span class="num">${Math.ceil(ply / 2)}.</span>`;
      html += `<span class="m${TR.erred.has(ply) ? ' err' : ''}">${esc(toGerman(san))}</span>`;
      if (!(ply % 2) || ply === TR.plyMoves.length) html += '</li>';
    });
    $('#tr-moves').innerHTML = html || '<li class="lead">Noch keine Züge.</li>';
    TR.board.set(TR.game, TR.last);
  }
  function playSan(san) { const m = TR.game.move(san); TR.last = m; TR.plyMoves.push(m.san); return m; }
  function setScore(progressText) {
    $('#tr-progress').textContent = progressText;
    $('#tr-errors').textContent = TR.errors;
    $('#tr-streak').textContent = TR.streak;
  }
  function wrongMove(m, exp, why, retryText) {
    const plyNo = TR.plyMoves.length + 1;
    if (!TR.erred.has(plyNo)) { TR.erred.add(plyNo); TR.errors++; if (TR.mode === 'line') recordMove(false); }
    TR.board.flash(m.to, 'bad'); TR.board.shake();
    TR.board.setArrows([{ from: exp.from, to: exp.to }]);
    setFeedback('bad', `<p><strong>Nicht ganz.</strong> Du hast <span class="mv">${esc(toGerman(m.san))}</span> versucht. Richtig ist <span class="mv">${esc(toGerman(exp.san))}</span> (Pfeil).</p>` +
      (why ? `<p>Warum: ${esc(why)}</p>` : '') + `<p>${retryText || 'Spiel jetzt den richtigen Zug.'}</p>`);
    renderMoves();
    TR.board.setArrows([{ from: exp.from, to: exp.to }]);
  }
  function expectedFromSan(san) { return TR.game.moves().find(m => cleanSan(m.san) === cleanSan(san)); }
  function runMove({ from, to }) {
    if (!TR.waiting || TR.finished) return false;
    const m = moveFromBoard(TR.game, from, to);
    if (!m) return false;
    if (TR.mode === 'line') return lineMove(m);
    if (TR.mode === 'trap') return trapMove(m);
    return gsMove(m);
  }
  function showHint() {
    if (!TR.waiting || TR.finished) return;
    const exp = TR.expected();
    if (!exp) return;
    const plyNo = TR.plyMoves.length + 1;
    if (!TR.erred.has(plyNo)) { TR.erred.add(plyNo); TR.errors++; if (TR.mode === 'line') recordMove(false); }
    TR.board.setHint(exp.from);
    renderMoves(); TR.board.setHint(exp.from);
    setScore($('#tr-progress').textContent);
    const pieceName = { p: 'Bauern', r: 'Turm', n: 'Springer', b: 'Läufer', q: 'Dame', k: 'König' }[exp.piece.toLowerCase()];
    setFeedback('', `<p><strong>Tipp:</strong> Ziehe mit ${exp.piece.toLowerCase() === 'q' ? 'der' : 'dem'} markierten ${pieceName} (Feld ${squareName(exp.from)}). Tipps zählen als Fehler, damit die Aufgabe öfter wiederholt wird.</p>`);
  }
  function recordMove(correctFirstTry) {
    const s = progress.moves[TR.op.id] || (progress.moves[TR.op.id] = { correct: 0, total: 0, last: 0 });
    s.total++; if (correctFirstTry) s.correct++; s.last = Date.now();
    saveProgress();
  }
  function showResult(perfect, headline, extraHtml, againLabel) {
    TR.finished = true; TR.waiting = false; TR.board.interactive = false;
    $('#tr-hint').disabled = true; $('#tr-skip').disabled = true;
    if (perfect) TR.streak++; else TR.streak = 0;
    $('#tr-streak').textContent = TR.streak;
    const s = TR.session;
    let nextLabel = 'Nächste Aufgabe';
    if (s) { s.done++; if (perfect) s.perfect++; nextLabel = s.idx + 1 < s.items.length ? `Weiter (${s.idx + 2} von ${s.items.length})` : 'Tageseinheit abschließen'; }
    const r = $('#tr-result');
    r.hidden = false;
    r.innerHTML = `<p><strong>${headline}</strong></p>${extraHtml || ''}
      <div class="row"><button type="button" class="btn primary" id="tr-next">${nextLabel}</button><button type="button" class="btn" id="tr-again">${againLabel || 'Noch einmal'}</button>${TR.mode !== 'trap' ? '<button type="button" class="btn" id="tr-study">In der Theorie ansehen</button>' : ''}</div>`;
    $('#tr-next').focus({ preventScroll: true });
  }
  function nextAfterResult() {
    const s = TR.session;
    if (s) {
      s.idx++;
      if (s.idx < s.items.length) return runItem(s.items[s.idx]);
      return finishSession();
    }
    const item = pickNext(); if (item) runItem(item);
  }
  function finishSession() {
    const s = TR.session;
    TR.running = false; TR.session = null;
    currentView = 'heute'; markTab('heute');
    renderToday(); show('view-heute');
    $('#today-done').hidden = false;
    $('#today-done').innerHTML = `<p><strong>Tageseinheit geschafft.</strong> ${s.perfect} von ${s.items.length} Aufgaben fehlerfrei. Was nicht geklappt hat, kommt beim nächsten Mal zuerst dran.</p>`;
  }

  /* ----- Modus: Variante ----- */
  function startLine(op, li) {
    Object.assign(TR, { li, line: op.lines[li], ply: 0, userColor: op.side, warned: false });
    TR.lastKey = lineKey(op, li);
    TR.expected = () => expectedFromSan(TR.line.moves[TR.ply]);
    TR.board.setOrientation(op.side);
    setSide(op.side);
    $('#tr-variant').textContent = `Variante: wird am Ende verraten · ${freqLabel(TR.line.freq)}`;
    $('#tr-mode').textContent = 'Variante';
    TR.failPly = progress.fails[TR.lastKey] || 0;
    setFeedback('', op.side === 'w' ? '<p>Du hast Weiß und beginnst. Spiele den ersten Zug der Eröffnung.</p>' : '<p>Du hast Schwarz. Der Gegner beginnt gleich.</p>');
    updateLineRun();
    lineAdvance();
  }
  const learnerTurn = ply => (ply % 2 === 0) === (TR.op.side === 'w');
  function updateLineRun() {
    const total = TR.line.moves.filter((_, i) => learnerTurn(i)).length;
    const done = TR.line.moves.slice(0, TR.ply).filter((_, i) => learnerTurn(i)).length;
    setScore(done + '/' + total);
    renderMoves();
  }
  function lineAdvance() {
    TR.board.interactive = false;
    if (TR.ply >= TR.line.moves.length) return finishLine();
    if (learnerTurn(TR.ply)) {
      TR.board.interactive = true; TR.waiting = true;
      if (TR.failPly === TR.ply + 1 && !TR.warned) {
        TR.warned = true;
        addFeedback('<p class="warn-note">Achtung: An dieser Stelle hast du beim letzten Mal danebengegriffen.</p>');
      }
      return;
    }
    TR.timer = setTimeout(() => {
      const san = TR.line.moves[TR.ply];
      playSan(san); TR.ply++;
      updateLineRun();
      if (TR.ply < TR.line.moves.length) {
        const fb = $('#tr-feedback');
        if (!fb.classList.contains('good') && !fb.classList.contains('bad')) setFeedback('', `<p>Der Gegner spielt <span class="mv">${esc(moveLabel(TR.ply, san))}</span>. Was ist deine Antwort?</p>`);
        else addFeedback(`<p>Der Gegner antwortet <span class="mv">${esc(moveLabel(TR.ply, san))}</span>.</p>`);
      }
      lineAdvance();
    }, TR.ply === 0 ? 600 : 650);
  }
  function commentFor(ply) {
    const own = TR.line.comments && TR.line.comments[ply];
    if (own) return own;
    let n = TR.op.tree;
    for (let i = 0; i < ply; i++) { n = n.children.find(c => c.san === TR.line.moves[i]); if (!n) return null; }
    return n.comment;
  }
  function lineMove(m) {
    const exp = TR.expected();
    const plyNo = TR.ply + 1;
    if (m.san === exp.san) {
      if (!TR.erred.has(plyNo)) recordMove(true);
      playSan(m.san); TR.ply++; TR.waiting = false;
      TR.board.setHint(-1); TR.board.setArrows([]);
      updateLineRun();
      TR.board.flash(m.to, 'ok');
      const c = commentFor(TR.ply);
      setFeedback('good', `<p><strong>Richtig:</strong> <span class="mv">${esc(moveLabel(TR.ply, m.san))}</span></p>` + (c ? `<p>${esc(c)}</p>` : ''));
      lineAdvance();
      return true;
    }
    wrongMove(m, exp, commentFor(plyNo));
    setScore($('#tr-progress').textContent);
    return false;
  }
  function finishLine() {
    const key = lineKey(TR.op, TR.li);
    const perfect = TR.errors === 0;
    const s = srUpdate(progress.lines, key, perfect);
    if (perfect) delete progress.fails[key];
    else progress.fails[key] = Math.min(...TR.erred);
    saveProgress();
    updateLineRun();
    $('#tr-variant').textContent = `Variante: ${TR.line.name} · ${freqLabel(TR.line.freq)}`;
    showResult(perfect, perfect ? 'Fehlerfrei gespielt.' : `Variante beendet mit ${TR.errors} Fehler${TR.errors === 1 ? '' : 'n'}.`,
      `<p>${nextText(s)}</p>`, 'Diese wiederholen');
    setFeedback(perfect ? 'good' : '', `<p>Das war <strong>${esc(TR.op.name)}</strong>, Variante <strong>${esc(TR.line.name)}</strong>.</p>`);
  }

  /* ----- Modus: Falle ----- */
  function startTrap(op, ti) {
    const t = op.traps[ti];
    Object.assign(TR, { ti, trap: t, si: 0, userColor: op.side });
    TR.lastKey = op.id + ':' + ti;
    TR.expected = () => expectedFromSan(TR.trap.solution[TR.si]);
    TR.board.setOrientation(op.side);
    setSide(op.side);
    $('#tr-variant').textContent = 'Falle: ' + t.name;
    $('#tr-mode').textContent = 'Falle';
    const pre = t.moves.slice(0, -1);
    pre.forEach(s => playSan(s));
    updateTrapRun();
    setFeedback('', `<p>Die Partie läuft so weit nach Theorie. Pass auf den nächsten Zug des Gegners auf …</p>`);
    TR.timer = setTimeout(() => {
      const san = t.moves[t.moves.length - 1];
      playSan(san);
      updateTrapRun();
      setFeedback('', `<p>Der Gegner spielt <span class="mv">${esc(moveLabel(TR.plyMoves.length, san))}</span>. Das ist ein Fehler.</p><p><strong>Wie bestrafst du ihn?</strong></p>`);
      TR.board.interactive = true; TR.waiting = true;
    }, 900);
  }
  function updateTrapRun() {
    const total = TR.trap.solution.filter((_, i) => i % 2 === 0).length;
    setScore(Math.ceil(TR.si / 2) + '/' + total);
    renderMoves();
  }
  function trapMove(m) {
    const exp = TR.expected();
    if (cleanSan(m.san) === cleanSan(exp.san)) {
      playSan(m.san); TR.si++; TR.waiting = false; TR.board.interactive = false;
      TR.board.setHint(-1); TR.board.setArrows([]);
      updateTrapRun(); TR.board.flash(m.to, 'ok');
      setFeedback('good', `<p><strong>Richtig:</strong> <span class="mv">${esc(moveLabel(TR.plyMoves.length, m.san))}</span></p>`);
      const step = () => {
        if (TR.si >= TR.trap.solution.length) return finishTrap();
        if (TR.si % 2 === 1) {
          TR.timer = setTimeout(() => {
            const san = TR.trap.solution[TR.si]; playSan(san); TR.si++;
            updateTrapRun();
            addFeedback(`<p>Der Gegner antwortet <span class="mv">${esc(moveLabel(TR.plyMoves.length, san))}</span>.</p>`);
            step();
          }, 650);
        } else { TR.waiting = true; TR.board.interactive = true; addFeedback('<p>Weiter, wie geht es jetzt weiter?</p>'); }
      };
      step();
      return true;
    }
    TR.wrongCount++;
    const plyNo = TR.plyMoves.length + 1;
    if (TR.wrongCount === 1 && !TR.erred.has(plyNo)) {
      TR.erred.add(plyNo); TR.errors++;
      TR.board.flash(m.to, 'bad'); TR.board.shake();
      setFeedback('bad', `<p><strong>Nicht ganz.</strong> <span class="mv">${esc(toGerman(m.san))}</span> bestraft den Fehler nicht.</p><p>Schau genau: Welche gegnerische Figur ist jetzt ungedeckt oder angegriffen? Versuch es noch einmal.</p>`);
      renderMoves(); setScore($('#tr-progress').textContent);
      return false;
    }
    wrongMove(m, exp, null);
    setScore($('#tr-progress').textContent);
    return false;
  }
  function finishTrap() {
    const perfect = TR.errors === 0;
    const s = srUpdate(progress.traps, TR.op.id + ':' + TR.ti, perfect);
    renderMoves();
    showResult(perfect, perfect ? 'Falle erkannt und bestraft.' : 'Geschafft, mit Hilfe.', `<p>${esc(TR.trap.explain)}</p><p class="lead">${perfect ? 'Die Falle kommt später zur Auffrischung wieder.' : 'Die Falle kommt bald wieder dran.'}</p>`, 'Diese Falle wiederholen');
    setFeedback(perfect ? 'good' : '', `<p><strong>${esc(TR.trap.name)}</strong> · ${esc(TR.op.name)}</p>`);
    void s;
  }

  /* ----- Modus: Gegenseite ----- */
  function startGs(op) {
    Object.assign(TR, { node: op.tree, userColor: other(op.side), moveCount: 0 });
    TR.lastKey = 'gs:' + op.id;
    TR.expected = () => { const c = recChild(TR.op, TR.node); return c ? expectedFromSan(c.san) : null; };
    TR.board.setOrientation(other(op.side));
    setSide(other(op.side), sideText(other(op.side)) + ' (Gegenseite)');
    $('#tr-variant').textContent = 'Gegen ' + op.name + ': Wie reagierst du am besten?';
    $('#tr-mode').textContent = 'Gegenseite';
    setFeedback('', op.side === 'w'
      ? `<p>Dein Gegner spielt <strong>${esc(op.name)}</strong>, du hast Schwarz. Antworte mit der empfohlenen Fortsetzung.</p>`
      : `<p>Du hast Weiß, dein Gegner antwortet mit <strong>${esc(op.name)}</strong>. Spiele den ersten Zug.</p>`);
    updateGsRun();
    gsAdvance();
  }
  function updateGsRun() { setScore(String(TR.moveCount)); renderMoves(); }
  function lineInfo(node) {
    const op = TR.op, names = node.lines.map(li => op.lines[li]);
    const haupt = names.some(l => l.freq === 'haupt');
    return `${freqBadge(haupt ? 'haupt' : 'neben')} ${esc(names.map(l => l.name).join(' · '))}`;
  }
  function gsAdvance() {
    TR.board.interactive = false;
    const node = TR.node;
    if (!node.children.length) return finishGs();
    if (TR.game.turn === TR.op.side) {
      TR.timer = setTimeout(() => {
        const child = node.children.find(c => c.lines.some(li => TR.node.lines.includes(li))) || node.children[0];
        playSan(child.san); TR.node = child;
        updateGsRun();
        addFeedback(`<p>Der Gegner spielt <span class="mv">${esc(moveLabel(child.ply, child.san))}</span>.${child.comment ? ' Seine Idee: ' + esc(child.comment) : ''}</p>`);
        gsAdvance();
      }, 650);
      return;
    }
    TR.board.interactive = true; TR.waiting = true;
  }
  function gsMove(m) {
    const node = TR.node, rec = recChild(TR.op, node);
    const child = node.children.find(c => c.san === m.san);
    if (!child) {
      const exp = TR.expected();
      wrongMove(m, exp, null, node.children.length > 1 ? `Auch spielbar wären: ${node.children.filter(c => c !== rec).map(c => esc(toGerman(c.san))).join(', ')}.` : 'Spiel jetzt den richtigen Zug.');
      setScore($('#tr-progress').textContent);
      return false;
    }
    playSan(m.san); TR.node = child; TR.waiting = false; TR.moveCount++;
    TR.board.setHint(-1); TR.board.setArrows([]);
    updateGsRun(); TR.board.flash(m.to, 'ok');
    if (child === rec) setFeedback('good', `<p><strong>Richtig:</strong> <span class="mv">${esc(moveLabel(child.ply, child.san))}</span>${node.children.length > 1 ? ' ist die empfohlene Antwort.' : ''}</p><p>${lineInfo(child)}</p>`);
    else setFeedback('', `<p><strong>Auch spielbar:</strong> <span class="mv">${esc(moveLabel(child.ply, child.san))}</span>. Empfohlen ist <span class="mv">${esc(toGerman(rec.san))}</span>.</p><p>${lineInfo(child)}</p>`);
    gsAdvance();
    return true;
  }
  function finishGs() {
    const perfect = TR.errors === 0;
    const s = srUpdate(progress.gs, TR.op.id, perfect);
    renderMoves();
    const names = TR.node.lines.map(li => TR.op.lines[li].name).join(' · ');
    showResult(perfect, perfect ? 'Fehlerfrei durchgespielt.' : `Durchgespielt mit ${TR.errors} Fehler${TR.errors === 1 ? '' : 'n'}.`,
      `<p>Du bist in der Variante <strong>${esc(names)}</strong> gelandet.</p><p class="lead">${s.box >= 2 ? 'Diese Seite sitzt schon gut.' : 'Spiel sie öfter, bis die empfohlenen Antworten sitzen.'}</p>`, 'Noch einmal');
  }

  /* ================= EIGENE ERÖFFNUNGEN ================= */
  const ED = { open: false, op: null, side: 'w', root: null, node: null, board: null, confirmDel: null, extOp: null, back: 'eigene' };
  function renderCustomList() {
    const host = $('#cu-list');
    if (!CUSTOM.length) {
      host.innerHTML = '<div class="empty"><p><strong>Trage deine erste eigene Eröffnung ein.</strong></p><p class="lead">Du ziehst die Züge auf dem Brett, zweigst an Gegnerzügen Varianten ab und speicherst alles. Danach trainierst du sie wie die eingebauten Eröffnungen.</p></div>';
      return;
    }
    host.innerHTML = '<div class="op-cards">' + CUSTOM.map(o => {
      const learned = learnedCount(OPS[o.id] || o);
      const live = OPS[o.id] || o;
      return `<div class="op-card cu-card"><span class="title">${esc(o.name)}</span>
        <span class="sub">${OPS[o.id] ? stufeBadge(live) + `<span class="pts">${live.punkte} Punkte</span>` : ''}${o.imported ? '<span class="fq neben">Importiert</span>' : ''}</span>
        <span class="sub"><span class="side-badge ${o.side}">${o.side === 'w' ? 'Weiß' : 'Schwarz'}</span><span>${o.lines.length} Variante${o.lines.length === 1 ? '' : 'n'}</span>${learned ? `<span>· ${learned} sitzen</span>` : ''}</span>
        <span class="row"><button type="button" class="btn small" data-cu-open="${esc(o.id)}">Ansehen</button><button type="button" class="btn small" data-cu-edit="${esc(o.id)}">Bearbeiten</button><button type="button" class="btn small danger" data-cu-del="${esc(o.id)}">Löschen</button></span>
        ${ED.confirmDel === o.id ? `<span class="confirm"><span>Wirklich löschen? Der Lernstand dazu geht verloren.</span><button type="button" class="btn danger small" data-cu-del-yes="${esc(o.id)}">Ja, löschen</button><button type="button" class="btn small" data-cu-del-no>Abbrechen</button></span>` : ''}
      </div>`;
    }).join('') + '</div>';
  }
  function edNewNode(san, parent) { return { san, children: [], parent, ply: parent ? parent.ply + 1 : 0, comment: '' }; }
  function openEditor(op, extOp) {
    ED.open = true; ED.op = op || null; ED.extOp = extOp || null;
    ED.back = extOp ? 'theorie' : 'eigene';
    const src = extOp || op;
    ED.side = src ? src.side : 'w';
    ED.root = edNewNode(null, null);
    if (src) {
      const t = extOp ? extOp.tree : buildTree({ lines: src._base || src.lines });
      const copy = (s, dst) => { for (const c of s.children) { const n = edNewNode(c.san, dst); n.comment = c.comment || ''; n.locked = !!extOp && !c.ext; n.ext = !!extOp && !!c.ext; dst.children.push(n); copy(c, n); } };
      copy(t, ED.root);
    }
    ED.node = ED.root;
    document.body.classList.toggle('ed-extmode', !!extOp);
    $('#ed-ext-note').hidden = !extOp;
    $('#ed-cancel').textContent = extOp ? '← Zurück zur Eröffnung' : '← Abbrechen';
    $('#ed-title').textContent = extOp ? extOp.name + ' erweitern' : op ? 'Eröffnung bearbeiten' : 'Neue Eröffnung';
    $('#ed-name').value = op ? op.name : '';
    $('#ed-idea').value = op ? (op.idea || '') : '';
    $('#ed-msg').textContent = ''; $('#ed-name-err').textContent = '';
    if (!ED.board) ED.board = new Board($('#ed-board'), { onMove: edMove, color: () => null });
    ED.board.interactive = true;
    ED.board.setOrientation(ED.side);
    currentView = 'eigene'; markTab('eigene');
    show('view-editor');
    renderEditor();
  }
  const edOwn = node => node.ply % 2 === (ED.side === 'w' ? 1 : 0);
  function edLeaves() {
    const out = [];
    const walk = n => { if (!n.children.length) { if (n !== ED.root) out.push(n); return; } n.children.forEach(walk); };
    walk(ED.root);
    return out;
  }
  function renderEditor() {
    const node = ED.node;
    const { game, last } = gameAt(node);
    ED.board.set(game, last);
    $$('#ed-side [data-side]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.side === ED.side)));
    // Zugfolge bis hier und weiter entlang der ersten Fortsetzung
    const path = pathOf(node); let n = node; const ahead = [];
    while (n.children.length) { n = n.children[0]; ahead.push(n); }
    let html = '';
    path.concat(ahead).forEach((p, i) => {
      if (p.ply % 2) html += `<li><span class="num">${Math.ceil(p.ply / 2)}.</span>`;
      else if (i === 0) html += `<li><span class="num">${Math.ceil(p.ply / 2)}…</span>`;
      html += `<button type="button" class="${p === node ? 'cur' : i >= path.length ? 'future' : ''}${p.ext ? ' ext' : ''}" data-ed-ply="${i}">${esc(toGerman(p.san))}</button>`;
      if (!(p.ply % 2)) html += '</li>';
    });
    $('#ed-moves').innerHTML = html || '<li class="lead">Noch keine Züge. Ziehe den ersten Zug auf dem Brett.</li>';
    ED.pathNodes = path.concat(ahead);
    // Hinweis zur Stellung
    const turnOwn = (game.turn === ED.side);
    let info;
    if (!node.san) info = ED.side === 'w' ? 'Startstellung. Du hast Weiß: Ziehe deinen ersten Zug.' : 'Startstellung. Ziehe zuerst den Zug des Gegners (Weiß).';
    else info = `Zuletzt: <span class="mv">${esc(moveLabel(node.ply, node.san))}</span> · ${edOwn(node) ? 'dein Zug' : 'Gegnerzug'}${node.locked ? ' (eingebaut)' : node.ext ? ' (deine Ergänzung)' : ''}. ` +
      (turnOwn ? 'Jetzt ziehst du (eine Antwort pro Stellung).' : 'Jetzt zieht der Gegner. Mehrere Gegnerzüge ergeben Varianten.');
    $('#ed-info').innerHTML = `<p>${info}</p>`;
    // Varianten an dieser Stelle
    const br = $('#ed-branch');
    if (node.children.length > 1) {
      br.hidden = false;
      br.innerHTML = '<p>Hier gibt es mehrere Gegnerzüge (Varianten):</p><div class="opts">' + node.children.map((c, i) =>
        `<button type="button" class="branch-opt" data-ed-child="${i}"><span class="mv">${esc(moveLabel(c.ply, c.san))}</span><span class="nm">${c.locked ? 'eingebaut' : c.ext ? 'deine Ergänzung' : i === 0 ? 'Hauptlinie' : 'Abzweigung'}</span></button>`).join('') + '</div>';
    } else br.hidden = true;
    // Kommentar
    const cf = $('#ed-comment-field');
    cf.hidden = !(node.san && edOwn(node));
    if (!cf.hidden) {
      $('#ed-comment-label').textContent = node.locked ? `Warum ${toGerman(node.san)}? (eingebaut, nicht änderbar)` : `Warum ${toGerman(node.san)}? (optional)`;
      $('#ed-comment').value = node.comment || ''; $('#ed-comment').readOnly = !!node.locked;
    }
    // Variantenübersicht
    const leaves = edLeaves();
    $('#ed-lines').innerHTML = leaves.length ? leaves.map((lf, i) => {
      const ms = pathOf(lf).map(p => p.ply % 2 ? Math.ceil(p.ply / 2) + '.' + toGerman(p.san) : toGerman(p.san)).join(' ');
      const hasExt = pathOf(lf).some(p => p.ext);
      return `<li><button type="button" class="linkish" data-ed-leaf="${i}">${esc(ms)}</button>${hasExt ? ' <span class="fq eigen">+ Eigen</span>' : ''}</li>`;
    }).join('') : '<li class="lead">Noch keine Varianten.</li>';
    ED.leaves = leaves;
    $('#ed-prev').disabled = $('#ed-first').disabled = !node.parent;
    $('#ed-next').disabled = !node.children.length;
    $('#ed-del').disabled = !node.san || !!node.locked;
    $('#ed-del').title = node.locked ? 'Eingebaute Züge lassen sich nicht löschen' : '';
  }
  function edMove({ from, to }) {
    const g = gameAt(ED.node).game;
    const m = moveFromBoard(g, from, to);
    if (!m) return false;
    const node = ED.node;
    const existing = node.children.find(c => c.san === m.san);
    if (existing) { ED.node = existing; renderEditor(); return true; }
    if (g.turn === ED.side && node.children.length) {
      ED.board.shake();
      const c0 = node.children[0];
      $('#ed-msg').textContent = c0.locked
        ? `Hier steht schon der eingebaute Zug ${toGerman(c0.san)}. Für deine Seite gibt es pro Stellung nur einen richtigen Zug, eingebaute Züge lassen sich nicht ersetzen.`
        : `Für deine Seite gibt es pro Stellung nur einen richtigen Zug. Hier steht schon ${toGerman(c0.san)}. Lösche ihn zuerst, wenn du ihn ersetzen willst.`;
      return false;
    }
    const n = edNewNode(m.san, node);
    if (ED.extOp) n.ext = true;
    node.children.push(n);
    ED.node = n;
    $('#ed-msg').textContent = node.children.length > 1 ? `Neue Variante abgezweigt: ${moveLabel(n.ply, n.san)}.` : '';
    renderEditor();
    return true;
  }
  function edDelete() {
    const node = ED.node;
    if (!node.parent || node.locked) return;
    const p = node.parent;
    p.children = p.children.filter(c => c !== node);
    ED.node = p;
    $('#ed-msg').textContent = `${toGerman(node.san)} und alle Züge danach wurden entfernt.`;
    renderEditor();
  }
  function extSave() {
    const op = ED.extOp, list = [];
    const walk = (n, path) => { for (const c of n.children) { const p = path.concat([c.san]); if (c.ext) list.push({ path: p, comment: (c.comment || '').trim() }); walk(c, p); } };
    walk(ED.root, []);
    if (list.length) EXT[op.id] = list; else delete EXT[op.id];
    if (!saveExt()) { $('#ed-msg').textContent = 'Speichern hat nicht geklappt: Der Browser-Speicher ist voll oder gesperrt.'; return; }
    indexOps(); pruneProgress();
    ED.open = false; ED.extOp = null; document.body.classList.remove('ed-extmode');
    currentView = 'theorie'; markTab('theorie');
    openOpening(op.id);
    $('#th-comment').innerHTML = `<p><strong>Ergänzungen gespeichert:</strong> ${list.length === 1 ? '1 ergänzter Zug' : list.length + ' ergänzte Züge'}. Sie sind in Theorie, Training und Gegenseite dabei.</p>`;
  }
  function edSave() {
    if (ED.extOp) return extSave();
    const name = $('#ed-name').value.trim();
    $('#ed-name-err').textContent = '';
    if (!name) { $('#ed-name-err').textContent = 'Gib der Eröffnung einen Namen.'; $('#ed-name').focus(); return; }
    const leaves = edLeaves();
    const usable = leaves.filter(lf => pathOf(lf).some(edOwn));
    if (!usable.length) { $('#ed-msg').textContent = 'Trage mindestens einen eigenen Zug ein, bevor du speicherst.'; return; }
    const used = new Set();
    const lines = usable.map((lf, i) => {
      const path = pathOf(lf);
      let label = 'Hauptlinie';
      if (i > 0) {
        // Abzweigung: der tiefste Knoten, an dem dieser Pfad nicht der ersten Fortsetzung folgt
        let dev = null;
        for (const p of path) if (p.parent && p.parent.children[0] !== p) dev = p;
        label = dev ? 'Mit ' + moveLabel(dev.ply, dev.san) : 'Variante ' + (i + 1);
      }
      let nm = label, k = 2;
      while (used.has(nm)) nm = label + ' (' + (k++) + ')';
      used.add(nm);
      const comments = {};
      path.forEach(p => { if (p.comment && p.comment.trim()) comments[p.ply] = p.comment.trim(); });
      return { name: nm, freq: i === 0 ? 'haupt' : 'neben', moves: path.map(p => p.san), comments };
    });
    const id = ED.op ? ED.op.id : 'eigen-' + Date.now().toString(36);
    const obj = { id, name, side: ED.side, idea: $('#ed-idea').value.trim(), custom: true, lines };
    if (ED.op) { for (const k of EXTRA_FIELDS) if (ED.op[k] !== undefined) obj[k] = ED.op[k]; if (ED.op.traps && ED.op.traps.length) obj.traps = ED.op.traps; }
    const i = CUSTOM.findIndex(o => o.id === id);
    if (i >= 0) CUSTOM[i] = obj; else CUSTOM.push(obj);
    if (!saveCustom()) { $('#ed-msg').textContent = 'Speichern hat nicht geklappt: Der Browser-Speicher ist voll oder gesperrt.'; return; }
    indexOps(); pruneProgress();
    ED.open = false; ED.op = null;
    renderCustomList(); show('view-eigene-list');
    $('#cu-msg').textContent = `„${name}“ gespeichert: ${lines.length} Variante${lines.length === 1 ? '' : 'n'}. Du findest sie in Theorie und Training.`;
  }
  function edCancel() {
    const ext = ED.extOp;
    ED.open = false; ED.op = null; ED.extOp = null; document.body.classList.remove('ed-extmode');
    if (ext) { currentView = 'theorie'; markTab('theorie'); openOpening(ext.id); return; }
    renderCustomList(); show('view-eigene-list');
  }
  function deleteCustom(id) {
    CUSTOM = CUSTOM.filter(o => o.id !== id);
    saveCustom(); indexOps(); pruneProgress();
    if (TH.op && TH.op.id === id) TH.op = null;
    ED.confirmDel = null;
    renderCustomList();
    $('#cu-msg').textContent = 'Eröffnung gelöscht.';
  }

  /* ================= ERÖFFNUNGEN IMPORTIEREN ================= */
  const IMP = { pending: null };
  const slug = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'eroeffnung';
  function parseOpeningsText(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { errors: ['Die Datei ist kein gültiges JSON. Prüfe Klammern und Anführungszeichen (' + e.message + ').'] }; }
    const arr = Array.isArray(data) ? data : Array.isArray(data.openings) ? data.openings : (data && data.lines ? [data] : null);
    if (!arr || !arr.length) return { errors: ['In der Datei wurde keine Eröffnung gefunden. Erwartet wird {"openings": [ … ]}, eine Liste oder eine einzelne Eröffnung.'] };
    const errors = [], ok = [];
    arr.forEach((o, oi) => {
      const label = o && o.name ? `„${o.name}“` : `Eröffnung ${oi + 1}`;
      const err = m => errors.push(label + ': ' + m);
      if (!o || typeof o !== 'object') return err('ist kein Objekt.');
      if (!o.name || typeof o.name !== 'string') err('Feld "name" fehlt.');
      if (o.side !== 'w' && o.side !== 'b') err('Feld "side" muss "w" (Weiß) oder "b" (Schwarz) sein.');
      if (!Array.isArray(o.lines) || !o.lines.length) { err('Feld "lines" fehlt oder ist leer.'); return; }
      if (o.side !== 'w' && o.side !== 'b') return;
      const lines = [], ownAt = new Map(), names = new Set();
      o.lines.forEach((l, li) => {
        const ln = l && l.name ? `Variante „${l.name}“` : `Variante ${li + 1}`;
        if (!l || !Array.isArray(l.moves) || !l.moves.length) return err(ln + ': Feld "moves" fehlt oder ist leer.');
        if (!l.name) err(ln + ': Feld "name" fehlt.');
        if (names.has(l.name)) err(ln + ': Der Name kommt doppelt vor.');
        names.add(l.name);
        const g = new Chess(); let bad = false;
        l.moves.forEach((san, i) => {
          if (bad) return;
          const ply = i + 1;
          if (typeof san !== 'string' || !g.move(san)) { bad = true; return err(`${ln}, Zug ${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'} „${san}“ ist in dieser Stellung nicht möglich.`); }
          const own = (ply % 2 === 1) === (o.side === 'w');
          if (own) {
            const key = l.moves.slice(0, i).join(' '), prev = ownAt.get(key);
            if (prev && prev.san !== san) err(`${ln}, Zug ${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'}: Für deine Seite steht hier schon ${toGerman(prev.san)} (in „${prev.line}“). Pro Stellung ist nur ein eigener Zug erlaubt.`);
            else if (!prev) ownAt.set(key, { san, line: l.name });
          }
        });
        if (bad) return;
        const comments = {};
        if (l.comments && typeof l.comments === 'object') for (const [k, v] of Object.entries(l.comments)) if (+k >= 1 && +k <= l.moves.length && typeof v === 'string') comments[+k] = v;
        const out = { name: String(l.name), freq: l.freq === 'neben' ? 'neben' : l.freq === 'haupt' ? 'haupt' : (li === 0 ? 'haupt' : 'neben'), moves: l.moves.slice(), comments };
        if (l.rec) out.rec = true;
        if (l.dbChecked !== undefined) out.dbChecked = !!l.dbChecked;
        lines.push(out);
      });
      const traps = [];
      (Array.isArray(o.traps) ? o.traps : []).forEach((t, ti) => {
        const tl = `Falle ${t && t.name ? '„' + t.name + '“' : ti + 1}`;
        if (!t || !Array.isArray(t.moves) || !Array.isArray(t.solution) || !t.moves.length || !t.solution.length) return err(tl + ': Felder "moves" und "solution" werden gebraucht.');
        const g = new Chess();
        const all = t.moves.concat(t.solution);
        for (let i = 0; i < all.length; i++) if (!g.move(all[i])) return err(`${tl}: Zug „${all[i]}“ ist nicht möglich.`);
        const userTurnAfter = (t.moves.length % 2 === 0) === (o.side === 'w');
        if (!userTurnAfter) return err(tl + ': Nach dem Fehlerzug muss deine Seite am Zug sein.');
        traps.push({ name: String(t.name || 'Falle ' + (ti + 1)), moves: t.moves.slice(), solution: t.solution.slice(), explain: String(t.explain || '') });
      });
      if (lines.length !== o.lines.length) return;
      const op = { id: o.id ? slug(o.id) : slug(o.name), name: String(o.name), side: o.side, idea: String(o.idea || ''), custom: true, imported: true, lines, traps };
      for (const k of ['eco', 'group', 'score', 'source']) if (typeof o[k] === 'string') op[k] = o[k];
      for (const k of ['schaerfe', 'haeufigkeit']) if (+o[k] >= 1 && +o[k] <= 5) op[k] = +o[k];
      if (STUFEN[o.stufe]) op.stufe = o.stufe;
      ok.push(op);
    });
    return { errors, ok };
  }
  function renderImportMsg(html, kind) { const m = $('#imp-msg'); m.className = 'block feedback ' + (kind || ''); m.innerHTML = html; m.hidden = !html; }
  function startOpeningImport(text) {
    $('#imp-conflict').hidden = true; IMP.pending = null;
    const r = parseOpeningsText(text);
    if (r.errors.length) {
      renderImportMsg(`<p><strong>Nichts importiert.</strong> Bitte korrigiere die Datei:</p><ul>${r.errors.slice(0, 12).map(e => `<li>${esc(e)}</li>`).join('')}</ul>${r.errors.length > 12 ? `<p>… und ${r.errors.length - 12} weitere Fehler.</p>` : ''}`, 'bad');
      return;
    }
    const builtinIds = new Set(DATA.openings.map(o => o.id));
    for (const op of r.ok) if (builtinIds.has(op.id)) op.id = op.id + '-import';
    const conflicts = r.ok.filter(op => CUSTOM.some(c => c.id === op.id));
    if (conflicts.length) {
      IMP.pending = r.ok;
      $('#imp-conflict').hidden = false;
      $('#imp-conflict-text').textContent = `${conflicts.map(c => '„' + c.name + '“').join(', ')} ${conflicts.length === 1 ? 'gibt' : 'gibt'} es schon. Was soll passieren?`;
      renderImportMsg('', '');
      return;
    }
    finishOpeningImport(r.ok, 'replace');
  }
  function finishOpeningImport(list, mode) {
    const names = [];
    for (const op of list) {
      const i = CUSTOM.findIndex(c => c.id === op.id);
      if (i >= 0 && mode === 'replace') CUSTOM[i] = op;
      else {
        if (i >= 0) { let k = 2; while (CUSTOM.some(c => c.id === op.id + '-' + k)) k++; op.id = op.id + '-' + k; op.name = op.name + ' (Kopie)'; }
        CUSTOM.push(op);
      }
      names.push(op.name);
    }
    if (!saveCustom()) { renderImportMsg('<p>Speichern hat nicht geklappt: Der Browser-Speicher ist voll oder gesperrt.</p>', 'bad'); return; }
    indexOps(); pruneProgress();
    IMP.pending = null; $('#imp-conflict').hidden = true; $('#imp-text').value = '';
    renderCustomList(); renderList();
    const info = list.map(op => { const o = OPS[op.id]; return `<li>${esc(o.name)}: ${o.lines.length} Variante${o.lines.length === 1 ? '' : 'n'}${o.traps.length ? ', ' + o.traps.length + ' Falle' + (o.traps.length === 1 ? '' : 'n') : ''}, Stufe ${STUFEN[stufeOf(o)]} (${o.punkte} Punkte)</li>`; }).join('');
    renderImportMsg(`<p><strong>Importiert.</strong> Du findest ${list.length === 1 ? 'die Eröffnung' : 'die Eröffnungen'} in Theorie und Training:</p><ul>${info}</ul>`, 'good');
  }

  /* ================= STATISTIK ================= */
  function renderStats() {
    let lines = 0, learned = 0, correct = 0, total = 0;
    for (const op of ALL) {
      lines += op.lines.length; learned += learnedCount(op);
      const m = progress.moves[op.id]; if (m) { correct += m.correct; total += m.total; }
    }
    const traps = allTraps(), trapsOk = traps.filter(t => t.s && t.s.box >= 1).length;
    const pct = total ? Math.round(correct / total * 100) + ' %' : '–';
    $('#st-totals').innerHTML = [
      [learned + '/' + lines, 'Varianten sitzen'],
      [pct, 'Trefferquote im ersten Versuch'],
      [total, 'trainierte Züge'],
      [trapsOk + '/' + traps.length, 'Fallen gelöst']
    ].map(([n, t]) => `<div class="total"><span class="n">${n}</span><span class="t">${t}</span></div>`).join('');
    let html = '';
    const groups = [['w', false, 'Eröffnungen mit Weiß'], ['b', false, 'Eröffnungen mit Schwarz'], [null, true, 'Eigene Eröffnungen']];
    for (const [side, custom, title] of groups) {
      const ops = ALL.filter(o => !!o.custom === custom && (!side || o.side === side));
      if (!ops.length) continue;
      html += `<div><h2 class="label">${title}</h2><div class="st-table">`;
      for (const op of ops) {
        const l = learnedCount(op), m = progress.moves[op.id];
        const p = m && m.total ? Math.round(m.correct / m.total * 100) + ' %' : '–';
        const last = m && m.last ? new Date(m.last).toLocaleDateString('de-AT') : 'noch nicht geübt';
        const gs = progress.gs[op.id];
        html += `<div class="st-row"><div class="nm">${esc(op.name)}<small>${esc(last)}${gs ? ' · Gegenseite ' + gs.perfect + '× fehlerfrei' : ''}</small></div>
          <div><div class="st-bar" role="img" aria-label="${l} von ${op.lines.length} Varianten sitzen"><span style="width:${Math.round(l / op.lines.length * 100)}%"></span></div><span class="lbl">${l} von ${op.lines.length} sitzen</span></div>
          <div class="pct">${p}<small>Treffer</small></div></div>`;
      }
      html += '</div></div>';
    }
    $('#st-list').innerHTML = html;
  }

  function exportProgress() {
    const text = JSON.stringify({ app: 'eroeffnungstrainer', version: APP_VERSION, exported: new Date().toISOString(), progress, custom: CUSTOM.map(plainCustom), ext: EXT }, null, 1);
    const msg = $('#st-msg');
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'eroeffnungstrainer-lernstand-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      msg.textContent = 'Datei wird heruntergeladen. Sie enthält deinen Lernstand, deine Stufen, eigene und importierte Eröffnungen und deine Ergänzungen. Falls nichts passiert, kopiere den Text unten und speichere ihn als .json-Datei.';
    } catch (e) { msg.textContent = 'Kopiere den Text unten und speichere ihn als .json-Datei.'; }
    const ta = $('#st-export-text'); ta.hidden = false; ta.value = text;
  }
  function importText(text) {
    const data = JSON.parse(text);
    const p = data.progress || data;
    if (!p || typeof p !== 'object' || !p.lines || !p.moves) throw new Error('format');
    let added = 0;
    if (Array.isArray(data.custom)) {
      for (const o of data.custom) {
        if (!validCustom(o)) continue;
        const i = CUSTOM.findIndex(x => x.id === o.id);
        const clean = plainCustom(Object.assign({}, o, { _base: null }));
        if (i >= 0) CUSTOM[i] = clean; else CUSTOM.push(clean);
        added++;
      }
      saveCustom();
    }
    let extN = 0;
    if (data.ext && typeof data.ext === 'object' && !Array.isArray(data.ext)) { EXT = data.ext; saveExt(); extN = Object.values(EXT).reduce((a, l) => a + (Array.isArray(l) ? l.length : 0), 0); }
    indexOps();
    progress = normalizeProgress(p);
    pruneProgress();
    return { lines: Object.keys(progress.lines).length, added, ext: extN };
  }
  function importProgress(file) {
    const msg = $('#st-msg');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const r = importText(reader.result);
        renderStats(); renderList();
        msg.textContent = `Lernstand importiert: ${r.lines} Variante${r.lines === 1 ? '' : 'n'} mit Fortschritt` + (r.added ? `, ${r.added} eigene Eröffnung${r.added === 1 ? '' : 'en'}` : '') + (r.ext ? `, ${r.ext} ergänzte Züge` : '') + '.';
      } catch (e) { msg.textContent = 'Die Datei konnte nicht gelesen werden. Wähle eine Datei, die du im Eröffnungstrainer exportiert hast.'; }
    };
    reader.readAsText(file);
  }

  /* ================= Start ================= */
  function bind() {
    $$('.tab').forEach(t => t.addEventListener('click', () => {
      if (t.dataset.view === 'theorie' && currentView === 'theorie' && TH.op) { TH.op = null; }
      if (t.dataset.view === 'training' && currentView === 'training' && TR.running) stopRun();
      if (t.dataset.view === 'eigene' && currentView === 'eigene' && ED.open) { ED.open = false; ED.extOp = null; document.body.classList.remove('ed-extmode'); }
      setTab(t.dataset.view);
    }));
    $('#theme-btn').addEventListener('click', () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; store.set('et-theme', theme); applyTheme(theme); });
    // Heute
    $('#today-start').addEventListener('click', () => { $('#today-done').hidden = true; startDaily(); });
    $('#today-free').addEventListener('click', () => { TR.cfg.mode = 'random'; setTab('training'); });
    $('#today-traps').addEventListener('click', () => { TR.cfg.mode = 'traps'; setTab('training'); });
    $('#today-gs').addEventListener('click', () => { TR.cfg.mode = 'gs'; setTab('training'); });
    // Liste
    $('#op-search').addEventListener('input', e => { TH.query = e.target.value; renderList(); });
    $$('#view-theorie-list [data-filter]').forEach(b => b.addEventListener('click', () => {
      TH.filter = b.dataset.filter;
      $$('#view-theorie-list [data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderList();
    }));
    $('#op-list').addEventListener('click', e => { const c = e.target.closest('[data-op]'); if (c) openOpening(c.dataset.op); });
    $('#th-stufe-filter').value = TH.stufe; $('#th-sort').value = TH.sort;
    $('#th-stufe-filter').addEventListener('change', e => { TH.stufe = e.target.value; store.set('et-th-stufe', TH.stufe); renderList(); });
    $('#th-sort').addEventListener('change', e => { TH.sort = e.target.value; store.set('et-th-sort', TH.sort); renderList(); });
    $('#th-stufe').addEventListener('change', e => { if (e.target.id === 'th-stufe-sel') { setStufe(TH.op, e.target.value); renderStufeBox(); } });
    $('#th-stufe').addEventListener('click', e => { if (e.target.id === 'th-stufe-reset') { delete progress.stufen[TH.op.id]; saveProgress(); renderStufeBox(); } });
    // Theorie
    $('#th-back').addEventListener('click', () => { TH.op = null; renderList(); show('view-theorie-list'); });
    $('#th-next').addEventListener('click', theoryNext);
    $('#th-prev').addEventListener('click', theoryPrev);
    $('#th-first').addEventListener('click', () => goNode(TH.tree));
    $('#th-last').addEventListener('click', () => { let n = TH.node; while (n.children.length) n = childOnLine(n); goNode(n); });
    $('#th-flip').addEventListener('click', () => TH.board.flip());
    $('#th-lines').addEventListener('click', e => { const c = e.target.closest('[data-line]'); if (c) selectLine(+c.dataset.line); });
    $('#th-branch').addEventListener('click', e => {
      const c = e.target.closest('[data-child]'); if (!c) return;
      const child = TH.node.children[+c.dataset.child];
      TH.line = child.lines[0]; goNode(child);
    });
    $('#th-moves').addEventListener('click', e => {
      const b = e.target.closest('[data-ply]'); if (!b) return;
      const ply = +b.dataset.ply; let n = TH.tree;
      for (let i = 0; i < ply; i++) n = n.children.find(c => c.lines.includes(TH.line));
      goNode(n);
    });
    $('#th-actions').addEventListener('click', e => {
      const op = TH.op; if (!op) return;
      if (e.target.id === 'th-gs') startSingle({ type: 'gs', op });
      if (e.target.id === 'th-traps') { TR.cfg.mode = 'traps'; TR.cfg.color = op.side; TR.cfg.trapOp = op.id; store.set('et-train-cfg', TR.cfg); startTraining(); }
      if (e.target.id === 'th-extend') { if (op.custom) openEditor(CUSTOM.find(o => o.id === op.id)); else openEditor(null, op); }
    });
    document.addEventListener('keydown', e => {
      if (/input|select|textarea/i.test(e.target.tagName)) return;
      if (currentView === 'theorie' && TH.op && !$('#view-theorie-op').hidden) {
        if (e.key === 'ArrowRight') { theoryNext(); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { theoryPrev(); e.preventDefault(); }
      }
      if (currentView === 'eigene' && ED.open) {
        if (e.key === 'ArrowRight' && ED.node.children.length) { ED.node = ED.node.children[0]; renderEditor(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' && ED.node.parent) { ED.node = ED.node.parent; renderEditor(); e.preventDefault(); }
      }
    });
    // Training
    $$('#tr-form [data-color]').forEach(b => b.addEventListener('click', () => { TR.cfg.color = b.dataset.color; renderSetup(); }));
    $$('#tr-form [data-mode]').forEach(b => b.addEventListener('click', () => { TR.cfg.mode = b.dataset.mode; renderSetup(); }));
    $('#tr-op').addEventListener('change', e => { TR.cfg.op = e.target.value; TR.cfg.line = 'all'; renderSetup(); });
    $('#tr-line').addEventListener('change', e => { TR.cfg.line = e.target.value; renderSetup(); });
    $('#tr-gs-op').addEventListener('change', e => { TR.cfg.gsOp = e.target.value; renderSetup(); });
    $('#tr-trap-op').addEventListener('change', e => { TR.cfg.trapOp = e.target.value; renderSetup(); });
    $('#tr-stufe').addEventListener('change', e => { TR.cfg.stufe = e.target.value; renderSetup(); });
    $('#tr-form').addEventListener('submit', e => { e.preventDefault(); startTraining(); });
    $('#tr-back').addEventListener('click', () => {
      const wasSession = !!TR.session;
      stopRun();
      if (wasSession) { setTab('heute'); return; }
      currentView = 'training'; markTab('training'); renderSetup(); show('view-training-setup');
    });
    $('#tr-hint').addEventListener('click', showHint);
    $('#tr-flip').addEventListener('click', () => TR.board && TR.board.flip());
    $('#tr-skip').addEventListener('click', () => nextAfterResult());
    $('#tr-result').addEventListener('click', e => {
      if (e.target.id === 'tr-next') nextAfterResult();
      if (e.target.id === 'tr-again') runItem(TR.item);
      if (e.target.id === 'tr-study') {
        const op = TR.op, li = TR.li, mode = TR.mode, node = TR.node;
        stopRun(); currentView = 'theorie'; markTab('theorie');
        openOpening(op.id);
        if (mode === 'line') selectLine(li);
        else if (mode === 'gs' && node) { TH.line = node.lines[0]; goNode(node); }
      }
    });
    // Eigene
    $('#cu-new').addEventListener('click', () => { $('#cu-msg').textContent = ''; openEditor(null); });
    $('#cu-import').addEventListener('click', () => { const p = $('#imp-panel'); p.hidden = !p.hidden; if (!p.hidden) $('#imp-text').focus(); });
    $('#imp-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const r = new FileReader(); r.onload = () => startOpeningImport(String(r.result)); r.readAsText(f); });
    $('#imp-go').addEventListener('click', () => {
      const t = $('#imp-text').value.trim();
      $('#imp-text-err').textContent = t ? '' : 'Füge zuerst den Text einer Importdatei ein oder wähle eine Datei.';
      if (t) startOpeningImport(t);
    });
    $('#imp-text').addEventListener('input', () => { $('#imp-text-err').textContent = ''; });
    $('#imp-replace').addEventListener('click', () => IMP.pending && finishOpeningImport(IMP.pending, 'replace'));
    $('#imp-copy').addEventListener('click', () => IMP.pending && finishOpeningImport(IMP.pending, 'copy'));
    $('#imp-cancel').addEventListener('click', () => { IMP.pending = null; $('#imp-conflict').hidden = true; renderImportMsg('<p>Import abgebrochen.</p>', ''); });
    $('#cu-list').addEventListener('click', e => {
      const t = e.target;
      if (t.dataset.cuOpen) { currentView = 'theorie'; markTab('theorie'); openOpening(t.dataset.cuOpen); }
      if (t.dataset.cuEdit) openEditor(CUSTOM.find(o => o.id === t.dataset.cuEdit));
      if (t.dataset.cuDel) { ED.confirmDel = t.dataset.cuDel; renderCustomList(); }
      if (t.dataset.cuDelYes) deleteCustom(t.dataset.cuDelYes);
      if (t.hasAttribute('data-cu-del-no')) { ED.confirmDel = null; renderCustomList(); }
    });
    $$('#ed-side [data-side]').forEach(b => b.addEventListener('click', () => {
      if (ED.side === b.dataset.side) return;
      ED.side = b.dataset.side;
      // Eindeutigkeit für die neue Seite prüfen: eigene Verzweigungen würden mehrdeutig
      let conflict = false;
      const walk = n => { const ownNext = n.ply % 2 === (ED.side === 'w' ? 0 : 1); if (ownNext && n.children.length > 1) conflict = true; n.children.forEach(walk); };
      walk(ED.root);
      $('#ed-msg').textContent = conflict ? 'Achtung: Mit dieser Farbe gibt es Stellungen mit mehreren eigenen Zügen. Lösche die überzähligen, bevor du speicherst.' : '';
      ED.board.setOrientation(ED.side);
      renderEditor();
    }));
    $('#ed-first').addEventListener('click', () => { ED.node = ED.root; renderEditor(); });
    $('#ed-prev').addEventListener('click', () => { if (ED.node.parent) { ED.node = ED.node.parent; renderEditor(); } });
    $('#ed-next').addEventListener('click', () => { if (ED.node.children.length) { ED.node = ED.node.children[0]; renderEditor(); } });
    $('#ed-flip').addEventListener('click', () => ED.board.flip());
    $('#ed-del').addEventListener('click', edDelete);
    $('#ed-moves').addEventListener('click', e => { const b = e.target.closest('[data-ed-ply]'); if (b) { ED.node = ED.pathNodes[+b.dataset.edPly]; renderEditor(); } });
    $('#ed-branch').addEventListener('click', e => { const b = e.target.closest('[data-ed-child]'); if (b) { ED.node = ED.node.children[+b.dataset.edChild]; renderEditor(); } });
    $('#ed-lines').addEventListener('click', e => { const b = e.target.closest('[data-ed-leaf]'); if (b) { ED.node = ED.leaves[+b.dataset.edLeaf]; renderEditor(); } });
    $('#ed-comment').addEventListener('input', e => { if (ED.node && ED.node.san) ED.node.comment = e.target.value; });
    $('#ed-name').addEventListener('input', () => { $('#ed-name-err').textContent = ''; });
    $('#ed-save').addEventListener('click', edSave);
    $('#ed-cancel').addEventListener('click', edCancel);
    // Statistik
    $('#st-export').addEventListener('click', exportProgress);
    $('#st-import-file').addEventListener('change', e => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
    $('#st-reset').addEventListener('click', () => { $('#st-confirm').hidden = false; });
    $('#st-reset-no').addEventListener('click', () => { $('#st-confirm').hidden = true; });
    $('#st-reset-yes').addEventListener('click', () => {
      progress = normalizeProgress({}); saveProgress(); $('#st-confirm').hidden = true;
      $('#st-msg').textContent = 'Lernstand gelöscht. Deine eigenen Eröffnungen bleiben erhalten.'; renderStats(); renderList();
    });
  }

  async function loadData() {
    if (window.OPENINGS_DATA) return window.OPENINGS_DATA;
    const r = await fetch('openings.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function init() {
    $$('.app-version').forEach(e => { e.textContent = APP_VERSION; });
    bind();
    try { DATA = await loadData(); }
    catch (e) {
      $('#loading').innerHTML = 'Die Eröffnungsdaten konnten nicht geladen werden. Öffne die App über einen Webserver (siehe Anleitung) oder nutze die Einzeldatei-Version <strong>Eroeffnungstrainer-Einzeldatei.html</strong>.';
      return;
    }
    indexOps();
    pruneProgress();
    $('#loading').hidden = true;
    renderList();
    setTab('heute');
  }

  /* Für Tests: Import ohne Dateiauswahl */
  window.__et = { importText: t => { const r = importText(t); renderStats(); renderList(); return r; }, progress: () => progress, custom: () => CUSTOM.map(plainCustom), ext: () => EXT, ops: () => ALL.map(o => ({ id: o.id, stufe: stufeOf(o), punkte: o.punkte, lines: o.lines.map(l => l.name) })),
    state: () => { const e = TR.running && TR.waiting && TR.expected ? TR.expected() : null; return { running: TR.running, mode: TR.mode, waiting: TR.waiting, finished: TR.finished, exp: e ? { from: e.from, to: e.to, san: e.san } : null, session: TR.session ? { idx: TR.session.idx, n: TR.session.items.length, types: TR.session.items.map(i => i.type) } : null }; } };

  /* ---------- Service Worker (Offline) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.OPENINGS_DATA) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        const offer = w => {
          $('#update-banner').hidden = false;
          $('#update-btn').onclick = () => w.postMessage('skipWaiting');
        };
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    });
  }

  init();
})();
