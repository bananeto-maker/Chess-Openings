/* Eröffnungstrainer – Theorie und Training */
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
  const PROG_KEY = 'et-progress-v1';
  let progress = normalizeProgress(store.get(PROG_KEY, null));
  function normalizeProgress(p) {
    if (!p || typeof p !== 'object') p = {};
    if (!p.lines || typeof p.lines !== 'object') p.lines = {};
    if (!p.moves || typeof p.moves !== 'object') p.moves = {};
    p.version = 1;
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
      return c === this.game.turn && (!this.opts.color || this.opts.color() === c);
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
  const OPS = {};
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
  const lineKey = (op, li) => op.id + ':' + op.lines[li].name;
  const moveLabel = (ply, san) => { const n = Math.ceil(ply / 2); return (ply % 2 ? n + '. ' : n + '… ') + toGerman(san); };
  const sideText = s => (s === 'w' ? 'Du spielst Weiß' : 'Du spielst Schwarz');
  function pathOf(node) { const p = []; while (node && node.san) { p.unshift(node); node = node.parent; } return p; }
  function gameAt(node) {
    const g = new Chess(); let last = null;
    for (const n of pathOf(node)) last = g.move(n.san);
    return { game: g, last };
  }

  /* ---------- Navigation ---------- */
  let currentView = 'theorie';
  function show(id) {
    $$('.view').forEach(v => { v.hidden = v.id !== id; });
    window.scrollTo({ top: 0 });
  }
  function setTab(view) {
    currentView = view;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    if (view === 'theorie') show(TH.op ? 'view-theorie-op' : 'view-theorie-list');
    if (view === 'training') show(TR.running ? 'view-training-run' : 'view-training-setup'), renderSetup();
    if (view === 'statistik') { renderStats(); show('view-statistik'); }
    store.set('et-view', view);
  }

  /* ================= THEORIE ================= */
  const TH = { op: null, tree: null, node: null, line: 0, board: null, filter: 'all', query: '' };

  function lineStatus(op, li) { return progress.lines[lineKey(op, li)]; }
  function learnedCount(op) { return op.lines.filter((_, li) => { const s = lineStatus(op, li); return s && s.box >= 2; }).length; }

  function renderList() {
    const q = TH.query.trim().toLowerCase();
    const groups = new Map();
    for (const op of DATA.openings) {
      if (TH.filter !== 'all' && op.side !== TH.filter) continue;
      const hay = (op.name + ' ' + op.eco + ' ' + op.group + ' ' + op.lines.map(l => l.name).join(' ')).toLowerCase();
      if (q && !hay.includes(q)) continue;
      const g = (op.side === 'w' ? 'Mit Weiß' : 'Mit Schwarz') + ' · ' + op.group;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(op);
    }
    const host = $('#op-list');
    if (!groups.size) { host.innerHTML = '<p class="lead">Keine Eröffnung gefunden. Versuche einen anderen Suchbegriff.</p>'; return; }
    let html = '';
    for (const [g, ops] of groups) {
      html += `<div class="op-group"><h2>${esc(g)}</h2><div class="op-cards">`;
      for (const op of ops) {
        const learned = learnedCount(op);
        html += `<button type="button" class="op-card" data-op="${op.id}">
          <span class="title">${esc(op.name)}</span>
          <span class="sub"><span class="side-badge ${op.side}">${op.side === 'w' ? 'Weiß' : 'Schwarz'}</span><span class="eco">${esc(op.eco)}</span><span>${op.lines.length} Varianten</span>${learned ? `<span>· ${learned} sitzen</span>` : ''}</span>
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
    if (!TH.board) TH.board = new Board($('#th-board'), { onMove: theoryMove });
    TH.board.interactive = true;
    TH.board.setOrientation(op.side);
    $('#th-name').textContent = op.name;
    $('#th-eco').textContent = 'ECO ' + op.eco;
    const sb = $('#th-side'); sb.className = 'side-badge ' + op.side; sb.textContent = sideText(op.side);
    $('#th-idea').textContent = op.idea;
    store.set('et-last-op', id);
    show('view-theorie-op');
    renderTheory();
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
    // Varianten-Chips
    $('#th-lines').innerHTML = op.lines.map((l, li) =>
      `<button type="button" class="chip" data-line="${li}" aria-pressed="${li === TH.line}">${esc(l.name)}</button>`).join('');
    // Kommentar
    const cm = $('#th-comment');
    if (!node.san) {
      cm.innerHTML = `<p>Ausgangsstellung. Drücke <strong>▶</strong> oder ziehe selbst auf dem Brett.</p>`;
    } else {
      const who = node.ply % 2 === (op.side === 'w' ? 1 : 0) ? 'Dein Zug' : 'Gegnerzug';
      cm.innerHTML = `<p><span class="mv">${esc(moveLabel(node.ply, node.san))}</span> <span class="lead">· ${who}</span></p>` +
        (node.comment ? `<p>${esc(node.comment)}</p>` : '');
    }
    // Verzweigung
    const br = $('#th-branch');
    if (node.children.length > 1) {
      const opp = node.children[0].ply % 2 === (op.side === 'w' ? 0 : 1);
      br.hidden = false;
      br.innerHTML = `<p>${opp ? 'Hier hat der Gegner mehrere Möglichkeiten. Wähle seine Antwort:' : 'Hier gibt es mehrere Fortsetzungen:'}</p><div class="opts">` +
        node.children.map((c, i) => {
          const names = c.lines.map(li => op.lines[li].name).join(' · ');
          return `<button type="button" class="branch-opt" data-child="${i}" aria-pressed="${c.lines.includes(TH.line)}"><span class="mv">${esc(moveLabel(c.ply, c.san))}</span><span class="nm">${esc(names)}</span></button>`;
        }).join('') + '</div>';
    } else br.hidden = true;
    // Zugliste entlang der gewählten Variante
    const ln = op.lines[TH.line];
    let html = '';
    ln.moves.forEach((san, i) => {
      const ply = i + 1;
      if (ply % 2) html += `<li><span class="num">${Math.ceil(ply / 2)}.</span>`;
      const cls = ply === node.ply ? 'cur' : ply > node.ply ? 'future' : '';
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
    const legal = g.moves().filter(m => m.from === from && m.to === to);
    if (!legal.length) return false;
    const m = legal.find(x => !x.promotion || x.promotion === 'Q');
    const child = TH.node.children.find(c => c.san === m.san);
    if (child) { goNode(child); return true; }
    TH.board.shake();
    const cm = $('#th-comment');
    cm.innerHTML = `<p><span class="mv">${esc(toGerman(m.san))}</span> ist in den Varianten dieser Eröffnung nicht enthalten.</p>` +
      (TH.node.children.length ? `<p>Hier vorgesehen: ${TH.node.children.map(c => '<strong>' + esc(toGerman(c.san)) + '</strong>').join(' oder ')}.</p>` : '<p>Die Variante ist hier zu Ende.</p>');
    return false;
  }

  /* ================= TRAINING ================= */
  const TR = { cfg: store.get('et-train-cfg', { color: 'w', mode: 'random', op: '', line: 'all' }), running: false, board: null, streak: 0, lastKey: null };
  const HOURS = [0, 4, 24, 72, 168, 336, 720];

  function candidates() {
    const c = TR.cfg, out = [];
    for (const op of DATA.openings) {
      if (op.side !== c.color) continue;
      if (c.mode === 'target' && op.id !== c.op) continue;
      op.lines.forEach((_, li) => {
        if (c.mode === 'target' && c.line !== 'all' && String(li) !== String(c.line)) return;
        out.push({ op, li });
      });
    }
    return out;
  }
  function dueInfo() {
    const now = Date.now(), list = candidates();
    let due = 0, fresh = 0;
    for (const x of list) { const s = progress.lines[lineKey(x.op, x.li)]; if (!s) fresh++; else if (s.due <= now) due++; }
    return { total: list.length, due, fresh };
  }
  function pickLine() {
    const now = Date.now();
    let list = candidates();
    if (list.length > 1 && TR.lastKey) list = list.filter(x => lineKey(x.op, x.li) !== TR.lastKey);
    const score = x => {
      const s = progress.lines[lineKey(x.op, x.li)];
      if (!s) return 1000 + Math.random() * 50;           // neu: mittlere Priorität
      if (s.due <= now) return 2000 - s.box * 100 + Math.random() * 50; // fällig: höchste Priorität, schwache Boxen zuerst
      return 500 - s.box * 60 - (s.due - now) / 3.6e6 + Math.random() * 30;
    };
    list.sort((a, b) => score(b) - score(a));
    return list[0];
  }

  function renderSetup() {
    const c = TR.cfg;
    $$('#tr-form [data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === c.color)));
    $$('#tr-form [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === c.mode)));
    $('#tr-mode-help').textContent = c.mode === 'random'
      ? 'Die App wählt Eröffnung und Variante. Fällige und fehlerhafte Varianten kommen zuerst.'
      : 'Du übst eine bestimmte Eröffnung, auf Wunsch auch nur eine Variante.';
    $('#tr-target').hidden = c.mode !== 'target';
    const ops = DATA.openings.filter(o => o.side === c.color);
    if (!ops.some(o => o.id === c.op)) { c.op = ops[0].id; c.line = 'all'; }
    $('#tr-op').innerHTML = ops.map(o => `<option value="${o.id}"${o.id === c.op ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
    const op = OPS[c.op];
    if (c.line !== 'all' && !op.lines[c.line]) c.line = 'all';
    $('#tr-line').innerHTML = `<option value="all">Alle Varianten</option>` +
      op.lines.map((l, li) => `<option value="${li}"${String(li) === String(c.line) ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
    const d = dueInfo();
    $('#tr-due').innerHTML = `<strong>${d.total}</strong> Varianten in der Auswahl · <strong>${d.due}</strong> fällig zur Wiederholung · <strong>${d.fresh}</strong> noch nie geübt`;
    store.set('et-train-cfg', c);
  }

  function startTraining() {
    const pick = pickLine();
    if (!pick) return;
    TR.running = true;
    show('view-training-run');
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === 'training')));
    startLine(pick.op, pick.li);
  }

  function startLine(op, li) {
    clearTimeout(TR.timer);
    Object.assign(TR, { op, li, line: op.lines[li], ply: 0, game: new Chess(), last: null, errors: 0, erredPlies: new Set(), finished: false, waiting: false });
    TR.lastKey = lineKey(op, li);
    if (!TR.board) TR.board = new Board($('#tr-board'), { onMove: trainMove, color: () => TR.op && TR.op.side });
    TR.board.setOrientation(op.side);
    TR.board.setHint(-1);
    TR.board.setArrows([]);
    $('#tr-name').textContent = op.name;
    $('#tr-eco').textContent = 'ECO ' + op.eco;
    const sb = $('#tr-side'); sb.className = 'side-badge ' + op.side; sb.textContent = sideText(op.side);
    $('#tr-variant').textContent = 'Variante: wird am Ende verraten';
    $('#tr-result').hidden = true;
    $('#tr-hint').disabled = false; $('#tr-skip').disabled = false;
    setFeedback('', op.side === 'w' ? '<p>Du hast Weiß und beginnst. Spiele den ersten Zug der Eröffnung.</p>' : '<p>Du hast Schwarz. Der Gegner beginnt gleich.</p>');
    updateRun();
    advance();
  }

  const learnerTurn = ply => (ply % 2 === 0) === (TR.op.side === 'w'); // ply = Anzahl bereits gespielter Halbzüge
  function setFeedback(kind, html) { const f = $('#tr-feedback'); f.className = 'block feedback ' + kind; f.innerHTML = html; }

  function updateRun() {
    const total = TR.line.moves.filter((_, i) => learnerTurn(i)).length;
    const done = TR.line.moves.slice(0, TR.ply).filter((_, i) => learnerTurn(i)).length;
    $('#tr-progress').textContent = done + '/' + total;
    $('#tr-errors').textContent = TR.errors;
    $('#tr-streak').textContent = TR.streak;
    let html = '';
    TR.line.moves.slice(0, TR.ply).forEach((san, i) => {
      const ply = i + 1;
      if (ply % 2) html += `<li><span class="num">${Math.ceil(ply / 2)}.</span>`;
      html += `<span class="m${TR.erredPlies.has(ply) ? ' err' : ''}">${esc(toGerman(san))}</span>`;
      if (!(ply % 2) || ply === TR.ply) html += '</li>';
    });
    $('#tr-moves').innerHTML = html || '<li class="lead">Noch keine Züge.</li>';
    TR.board.set(TR.game, TR.last);
  }

  function advance() {
    TR.board.interactive = false;
    if (TR.ply >= TR.line.moves.length) return finishLine();
    if (learnerTurn(TR.ply)) { TR.board.interactive = true; TR.waiting = true; return; }
    TR.timer = setTimeout(() => {
      const san = TR.line.moves[TR.ply];
      const m = TR.game.move(san);
      TR.last = m; TR.ply++;
      updateRun();
      if (TR.ply < TR.line.moves.length) {
        const fb = $('#tr-feedback');
        if (!fb.classList.contains('good') && !fb.classList.contains('bad')) setFeedback('', `<p>Der Gegner spielt <span class="mv">${esc(moveLabel(TR.ply, san))}</span>. Was ist deine Antwort?</p>`);
        else fb.insertAdjacentHTML('beforeend', `<p>Der Gegner antwortet <span class="mv">${esc(moveLabel(TR.ply, san))}</span>.</p>`);
      }
      advance();
    }, TR.ply === 0 ? 600 : 650);
  }

  function expectedMove() {
    const g = new Chess(TR.game.fen());
    return g.moves().find(m => m.san === TR.line.moves[TR.ply]);
  }

  function recordMove(correctFirstTry) {
    const s = progress.moves[TR.op.id] || (progress.moves[TR.op.id] = { correct: 0, total: 0, last: 0 });
    s.total++; if (correctFirstTry) s.correct++; s.last = Date.now();
    saveProgress();
  }

  function trainMove({ from, to }) {
    if (!TR.waiting || TR.finished) return false;
    const legal = TR.game.moves().filter(m => m.from === from && m.to === to);
    if (!legal.length) return false;
    const m = legal.find(x => !x.promotion || x.promotion === 'Q');
    const exp = expectedMove();
    const plyNo = TR.ply + 1;
    if (m.san === exp.san) {
      const firstTry = !TR.erredPlies.has(plyNo);
      if (firstTry) recordMove(true);
      TR.game.move(m.san); TR.last = m; TR.ply++; TR.waiting = false;
      TR.board.setHint(-1); TR.board.setArrows([]);
      updateRun();
      TR.board.flash(to, 'ok');
      const node = commentFor(TR.ply);
      setFeedback('good', `<p><strong>Richtig:</strong> <span class="mv">${esc(moveLabel(TR.ply, m.san))}</span></p>` + (node ? `<p>${esc(node)}</p>` : ''));
      advance();
      return true;
    }
    // falscher Zug
    if (!TR.erredPlies.has(plyNo)) { TR.erredPlies.add(plyNo); TR.errors++; recordMove(false); }
    TR.board.flash(to, 'bad');
    TR.board.shake();
    TR.board.setArrows([{ from: exp.from, to: exp.to }]);
    const why = commentFor(plyNo);
    setFeedback('bad', `<p><strong>Nicht ganz.</strong> Du hast <span class="mv">${esc(toGerman(m.san))}</span> versucht. In dieser Variante spielt man <span class="mv">${esc(toGerman(exp.san))}</span> (Pfeil).</p>` +
      (why ? `<p>Warum: ${esc(why)}</p>` : '') + `<p>Spiel jetzt den richtigen Zug.</p>`);
    updateRun();
    TR.board.setArrows([{ from: exp.from, to: exp.to }]);
    return false;
  }

  function commentFor(ply) {
    const own = TR.line.comments && TR.line.comments[ply];
    if (own) return own;
    let n = TR.op.tree;
    for (let i = 0; i < ply; i++) { n = n.children.find(c => c.san === TR.line.moves[i]); if (!n) return null; }
    return n.comment;
  }

  function showHint() {
    if (!TR.waiting || TR.finished) return;
    const exp = expectedMove();
    const plyNo = TR.ply + 1;
    if (!TR.erredPlies.has(plyNo)) { TR.erredPlies.add(plyNo); TR.errors++; recordMove(false); }
    TR.board.setHint(exp.from);
    updateRun();
    const pieceName = { p: 'Bauern', r: 'Turm', n: 'Springer', b: 'Läufer', q: 'Dame', k: 'König' }[exp.piece.toLowerCase()];
    setFeedback('', `<p><strong>Tipp:</strong> Ziehe mit ${exp.piece.toLowerCase() === 'q' ? 'der' : 'dem'} markierten ${pieceName} (Feld ${squareName(exp.from)}). Tipps zählen als Fehler, damit die Variante öfter wiederholt wird.</p>`);
  }

  function finishLine() {
    TR.finished = true; TR.waiting = false; TR.board.interactive = false;
    const key = lineKey(TR.op, TR.li);
    const s = progress.lines[key] || { box: 0, due: 0, seen: 0, perfect: 0, fails: 0, last: 0 };
    const perfect = TR.errors === 0;
    s.seen++; s.last = Date.now();
    if (perfect) { s.perfect++; s.box = Math.min(s.box + 1, HOURS.length - 1); TR.streak++; }
    else { s.fails++; s.box = 0; TR.streak = 0; }
    s.due = Date.now() + HOURS[s.box] * 3.6e6;
    progress.lines[key] = s;
    saveProgress();
    updateRun();
    $('#tr-variant').textContent = 'Variante: ' + TR.line.name;
    $('#tr-hint').disabled = true; $('#tr-skip').disabled = true;
    const next = s.box === 0 ? 'Sie kommt gleich wieder dran.' : s.box >= 2 ? 'Die Variante sitzt. Sie kommt später zur Auffrischung wieder.' : 'Noch einmal fehlerfrei, dann sitzt sie.';
    const r = $('#tr-result');
    r.hidden = false;
    r.innerHTML = `<p><strong>${perfect ? 'Fehlerfrei gespielt.' : `Variante beendet mit ${TR.errors} Fehler${TR.errors === 1 ? '' : 'n'}.`}</strong> ${next}</p>
      <div class="row"><button type="button" class="btn primary" id="tr-next">Nächste Variante</button><button type="button" class="btn" id="tr-again">Diese wiederholen</button><button type="button" class="btn" id="tr-study">In der Theorie ansehen</button></div>`;
    setFeedback(perfect ? 'good' : '', `<p>Das war <strong>${esc(TR.op.name)}</strong>, Variante <strong>${esc(TR.line.name)}</strong>.</p>`);
    $('#tr-next').focus({ preventScroll: true });
  }

  /* ================= STATISTIK ================= */
  function renderStats() {
    const all = DATA.openings;
    let lines = 0, learned = 0, correct = 0, total = 0;
    for (const op of all) {
      lines += op.lines.length; learned += learnedCount(op);
      const m = progress.moves[op.id]; if (m) { correct += m.correct; total += m.total; }
    }
    const pct = total ? Math.round(correct / total * 100) + ' %' : '–';
    $('#st-totals').innerHTML = [
      [learned + '/' + lines, 'Varianten sitzen'],
      [pct, 'Trefferquote im ersten Versuch'],
      [total, 'trainierte Züge'],
      [Object.values(progress.lines).filter(s => s.due <= Date.now() && s.box < 2).length, 'Varianten zum Wiederholen']
    ].map(([n, t]) => `<div class="total"><span class="n">${n}</span><span class="t">${t}</span></div>`).join('');
    let html = '';
    for (const side of ['w', 'b']) {
      html += `<div><h2 class="label">${side === 'w' ? 'Eröffnungen mit Weiß' : 'Eröffnungen mit Schwarz'}</h2><div class="st-table">`;
      for (const op of all.filter(o => o.side === side)) {
        const l = learnedCount(op), m = progress.moves[op.id];
        const p = m && m.total ? Math.round(m.correct / m.total * 100) + ' %' : '–';
        const last = m && m.last ? new Date(m.last).toLocaleDateString('de-AT') : 'noch nicht geübt';
        html += `<div class="st-row"><div class="nm">${esc(op.name)}<small>${esc(last)}</small></div>
          <div><div class="st-bar" role="img" aria-label="${l} von ${op.lines.length} Varianten sitzen"><span style="width:${Math.round(l / op.lines.length * 100)}%"></span></div><span class="lbl">${l} von ${op.lines.length} sitzen</span></div>
          <div class="pct">${p}<small>Treffer</small></div></div>`;
      }
      html += '</div></div>';
    }
    $('#st-list').innerHTML = html;
  }

  function exportProgress() {
    const text = JSON.stringify({ app: 'eroeffnungstrainer', exported: new Date().toISOString(), progress }, null, 1);
    const msg = $('#st-msg');
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'eroeffnungstrainer-fortschritt-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      msg.textContent = 'Datei wird heruntergeladen. Falls nichts passiert, kopiere den Text unten und speichere ihn als .json-Datei.';
    } catch (e) { msg.textContent = 'Kopiere den Text unten und speichere ihn als .json-Datei.'; }
    const ta = $('#st-export-text'); ta.hidden = false; ta.value = text;
  }
  function importProgress(file) {
    const msg = $('#st-msg');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const p = data.progress || data;
        if (!p.lines || !p.moves) throw new Error('format');
        progress = normalizeProgress(p);
        saveProgress(); renderStats(); renderList();
        msg.textContent = 'Fortschritt importiert: ' + Object.keys(progress.lines).length + ' Varianten.';
      } catch (e) { msg.textContent = 'Die Datei konnte nicht gelesen werden. Wähle eine Datei, die du hier exportiert hast.'; }
    };
    reader.readAsText(file);
  }

  /* ================= Start ================= */
  function bind() {
    $$('.tab').forEach(t => t.addEventListener('click', () => {
      if (t.dataset.view === 'theorie' && currentView === 'theorie' && TH.op) { TH.op = null; renderList(); }
      if (t.dataset.view === 'training' && currentView === 'training' && TR.running) { TR.running = false; clearTimeout(TR.timer); }
      setTab(t.dataset.view);
    }));
    $('#theme-btn').addEventListener('click', () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; store.set('et-theme', theme); applyTheme(theme); });
    // Liste
    $('#op-search').addEventListener('input', e => { TH.query = e.target.value; renderList(); });
    $$('#view-theorie-list [data-filter]').forEach(b => b.addEventListener('click', () => {
      TH.filter = b.dataset.filter;
      $$('#view-theorie-list [data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderList();
    }));
    $('#op-list').addEventListener('click', e => { const c = e.target.closest('[data-op]'); if (c) openOpening(c.dataset.op); });
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
    document.addEventListener('keydown', e => {
      if (currentView !== 'theorie' || !TH.op || /input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { theoryNext(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { theoryPrev(); e.preventDefault(); }
    });
    // Training
    $$('#tr-form [data-color]').forEach(b => b.addEventListener('click', () => { TR.cfg.color = b.dataset.color; renderSetup(); }));
    $$('#tr-form [data-mode]').forEach(b => b.addEventListener('click', () => { TR.cfg.mode = b.dataset.mode; renderSetup(); }));
    $('#tr-op').addEventListener('change', e => { TR.cfg.op = e.target.value; TR.cfg.line = 'all'; renderSetup(); });
    $('#tr-line').addEventListener('change', e => { TR.cfg.line = e.target.value; renderSetup(); });
    $('#tr-form').addEventListener('submit', e => { e.preventDefault(); startTraining(); });
    $('#tr-back').addEventListener('click', () => { TR.running = false; clearTimeout(TR.timer); show('view-training-setup'); renderSetup(); });
    $('#tr-hint').addEventListener('click', showHint);
    $('#tr-skip').addEventListener('click', () => { const p = pickLine(); if (p) startLine(p.op, p.li); });
    $('#tr-result').addEventListener('click', e => {
      if (e.target.id === 'tr-next') { const p = pickLine(); if (p) startLine(p.op, p.li); }
      if (e.target.id === 'tr-again') startLine(TR.op, TR.li);
      if (e.target.id === 'tr-study') {
        const op = TR.op, li = TR.li;
        TR.running = false; currentView = 'theorie';
        $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === 'theorie')));
        openOpening(op.id); selectLine(li);
      }
    });
    // Statistik
    $('#st-export').addEventListener('click', exportProgress);
    $('#st-import-file').addEventListener('change', e => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
    $('#st-reset').addEventListener('click', () => { $('#st-confirm').hidden = false; });
    $('#st-reset-no').addEventListener('click', () => { $('#st-confirm').hidden = true; });
    $('#st-reset-yes').addEventListener('click', () => {
      progress = normalizeProgress({}); saveProgress(); $('#st-confirm').hidden = true;
      $('#st-msg').textContent = 'Fortschritt gelöscht.'; renderStats(); renderList();
    });
  }

  async function loadData() {
    if (window.OPENINGS_DATA) return window.OPENINGS_DATA;
    const r = await fetch('openings.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function init() {
    bind();
    try { DATA = await loadData(); }
    catch (e) {
      $('#loading').innerHTML = 'Die Eröffnungsdaten konnten nicht geladen werden. Öffne die App über einen Webserver (siehe Anleitung) oder nutze die Einzeldatei-Version <strong>Eroeffnungstrainer-Einzeldatei.html</strong>.';
      return;
    }
    for (const op of DATA.openings) { op.tree = buildTree(op); OPS[op.id] = op; }
    $('#loading').hidden = true;
    renderList();
    const v = store.get('et-view', 'theorie');
    setTab(['theorie', 'training', 'statistik'].includes(v) ? v : 'theorie');
  }

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
