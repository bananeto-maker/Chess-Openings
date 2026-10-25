/* Schach-Regelmodul: legale Züge, SAN-Notation, FEN. Keine Abhängigkeiten. */
(function (root) {
  'use strict';
  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  const sq = (f, r) => r * 8 + f;
  const fileOf = s => s & 7;
  const rankOf = s => s >> 3;
  const name = s => FILES[fileOf(s)] + (rankOf(s) + 1);
  const parseSq = n => sq(FILES.indexOf(n[0]), parseInt(n[1], 10) - 1);
  const colorOf = p => (p === p.toUpperCase() ? 'w' : 'b');
  const inside = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

  function Chess(fen) { this.load(fen || START_FEN); }

  Chess.prototype.load = function (fen) {
    const parts = fen.trim().split(/\s+/);
    this.board = new Array(64).fill(null);
    const rows = parts[0].split('/');
    for (let i = 0; i < 8; i++) {
      let f = 0;
      for (const ch of rows[i]) {
        if (/\d/.test(ch)) f += parseInt(ch, 10);
        else { this.board[sq(f, 7 - i)] = ch; f++; }
      }
    }
    this.turn = parts[1] || 'w';
    this.castling = parts[2] && parts[2] !== '-' ? parts[2] : '';
    this.ep = parts[3] && parts[3] !== '-' ? parseSq(parts[3]) : -1;
    this.half = parseInt(parts[4] || '0', 10);
    this.full = parseInt(parts[5] || '1', 10);
    this.history = [];
  };

  Chess.prototype.fen = function () {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[sq(f, r)];
        if (!p) empty++;
        else { if (empty) { out += empty; empty = 0; } out += p; }
      }
      if (empty) out += empty;
      if (r) out += '/';
    }
    return out + ' ' + this.turn + ' ' + (this.castling || '-') + ' ' +
      (this.ep >= 0 ? name(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  };

  /* Stellungsschlüssel ohne Zugzähler (für Zugumstellungen) */
  Chess.prototype.key = function () { return this.fen().split(' ').slice(0, 4).join(' '); };

  Chess.prototype.attacked = function (s, by) {
    const f0 = fileOf(s), r0 = rankOf(s), b = this.board;
    const pawnDir = by === 'w' ? -1 : 1;
    for (const df of [-1, 1]) {
      const f = f0 + df, r = r0 + pawnDir;
      if (inside(f, r)) { const p = b[sq(f, r)]; if (p === (by === 'w' ? 'P' : 'p')) return true; }
    }
    for (const [df, dr] of KNIGHT) {
      const f = f0 + df, r = r0 + dr;
      if (inside(f, r)) { const p = b[sq(f, r)]; if (p === (by === 'w' ? 'N' : 'n')) return true; }
    }
    for (const [df, dr] of KING) {
      const f = f0 + df, r = r0 + dr;
      if (inside(f, r)) { const p = b[sq(f, r)]; if (p === (by === 'w' ? 'K' : 'k')) return true; }
    }
    const slide = (dirs, kinds) => {
      for (const [df, dr] of dirs) {
        let f = f0 + df, r = r0 + dr;
        while (inside(f, r)) {
          const p = b[sq(f, r)];
          if (p) {
            if (colorOf(p) === by && kinds.includes(p.toUpperCase())) return true;
            break;
          }
          f += df; r += dr;
        }
      }
      return false;
    };
    return slide(ROOK_D, 'RQ') || slide(BISHOP_D, 'BQ');
  };

  Chess.prototype.kingSq = function (c) {
    const k = c === 'w' ? 'K' : 'k';
    return this.board.indexOf(k);
  };

  Chess.prototype.inCheck = function () {
    return this.attacked(this.kingSq(this.turn), this.turn === 'w' ? 'b' : 'w');
  };

  Chess.prototype.pseudo = function () {
    const moves = [], b = this.board, us = this.turn, them = us === 'w' ? 'b' : 'w';
    const add = (from, to, extra) => moves.push(Object.assign({ from, to, piece: b[from], captured: b[to] }, extra || {}));
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p || colorOf(p) !== us) continue;
      const t = p.toUpperCase(), f0 = fileOf(s), r0 = rankOf(s);
      if (t === 'P') {
        const dir = us === 'w' ? 1 : -1, startR = us === 'w' ? 1 : 6, promR = us === 'w' ? 7 : 0;
        const pushPromo = (to, cap) => {
          if (rankOf(to) === promR) for (const pr of 'QRBN') add(s, to, { promotion: pr, captured: cap });
          else add(s, to, { captured: cap });
        };
        const one = sq(f0, r0 + dir);
        if (inside(f0, r0 + dir) && !b[one]) {
          pushPromo(one, null);
          const two = sq(f0, r0 + 2 * dir);
          if (r0 === startR && !b[two]) add(s, two, { double: true });
        }
        for (const df of [-1, 1]) {
          const f = f0 + df, r = r0 + dir;
          if (!inside(f, r)) continue;
          const to = sq(f, r);
          if (b[to] && colorOf(b[to]) === them) pushPromo(to, b[to]);
          else if (to === this.ep) add(s, to, { ep: true, captured: us === 'w' ? 'p' : 'P' });
        }
      } else if (t === 'N' || t === 'K') {
        for (const [df, dr] of (t === 'N' ? KNIGHT : KING)) {
          const f = f0 + df, r = r0 + dr;
          if (!inside(f, r)) continue;
          const to = sq(f, r);
          if (!b[to] || colorOf(b[to]) === them) add(s, to);
        }
        if (t === 'K') {
          const rank = us === 'w' ? 0 : 7, ks = us === 'w' ? 'K' : 'k', qs = us === 'w' ? 'Q' : 'q';
          if (s === sq(4, rank) && !this.attacked(s, them)) {
            if (this.castling.includes(ks) && !b[sq(5, rank)] && !b[sq(6, rank)] &&
              b[sq(7, rank)] === (us === 'w' ? 'R' : 'r') &&
              !this.attacked(sq(5, rank), them) && !this.attacked(sq(6, rank), them))
              add(s, sq(6, rank), { castle: 'K' });
            if (this.castling.includes(qs) && !b[sq(3, rank)] && !b[sq(2, rank)] && !b[sq(1, rank)] &&
              b[sq(0, rank)] === (us === 'w' ? 'R' : 'r') &&
              !this.attacked(sq(3, rank), them) && !this.attacked(sq(2, rank), them))
              add(s, sq(2, rank), { castle: 'Q' });
          }
        }
      } else {
        const dirs = t === 'R' ? ROOK_D : t === 'B' ? BISHOP_D : ROOK_D.concat(BISHOP_D);
        for (const [df, dr] of dirs) {
          let f = f0 + df, r = r0 + dr;
          while (inside(f, r)) {
            const to = sq(f, r);
            if (!b[to]) add(s, to);
            else { if (colorOf(b[to]) === them) add(s, to); break; }
            f += df; r += dr;
          }
        }
      }
    }
    return moves;
  };

  Chess.prototype._make = function (m) {
    const b = this.board, us = this.turn;
    this.history.push({ board: b.slice(), turn: us, castling: this.castling, ep: this.ep, half: this.half, full: this.full, move: m });
    b[m.to] = m.promotion ? (us === 'w' ? m.promotion : m.promotion.toLowerCase()) : b[m.from];
    b[m.from] = null;
    if (m.ep) b[m.to + (us === 'w' ? -8 : 8)] = null;
    if (m.castle) {
      const rank = us === 'w' ? 0 : 7;
      if (m.castle === 'K') { b[sq(5, rank)] = b[sq(7, rank)]; b[sq(7, rank)] = null; }
      else { b[sq(3, rank)] = b[sq(0, rank)]; b[sq(0, rank)] = null; }
    }
    const strip = (chars) => { for (const c of chars) this.castling = this.castling.replace(c, ''); };
    if (m.piece === 'K') strip('KQ');
    if (m.piece === 'k') strip('kq');
    const touch = s => {
      if (s === 0) strip('Q'); if (s === 7) strip('K');
      if (s === 56) strip('q'); if (s === 63) strip('k');
    };
    touch(m.from); touch(m.to);
    this.ep = m.double ? (m.from + m.to) / 2 : -1;
    this.half = (m.piece.toUpperCase() === 'P' || m.captured) ? 0 : this.half + 1;
    if (us === 'b') this.full++;
    this.turn = us === 'w' ? 'b' : 'w';
  };

  Chess.prototype.undo = function () {
    const h = this.history.pop();
    if (!h) return null;
    this.board = h.board; this.turn = h.turn; this.castling = h.castling;
    this.ep = h.ep; this.half = h.half; this.full = h.full;
    return h.move;
  };

  Chess.prototype._legalRaw = function () {
    const us = this.turn, them = us === 'w' ? 'b' : 'w', out = [];
    for (const m of this.pseudo()) {
      this._make(m);
      if (!this.attacked(this.kingSq(us), them)) out.push(m);
      this.undo();
    }
    return out;
  };

  Chess.prototype._san = function (m, legal) {
    let s;
    if (m.castle) s = m.castle === 'K' ? 'O-O' : 'O-O-O';
    else {
      const t = m.piece.toUpperCase();
      if (t === 'P') {
        s = m.captured ? FILES[fileOf(m.from)] + 'x' + name(m.to) : name(m.to);
        if (m.promotion) s += '=' + m.promotion;
      } else {
        const rivals = legal.filter(o => o !== m && o.to === m.to && o.piece === m.piece);
        let dis = '';
        if (rivals.length) {
          const sameFile = rivals.some(o => fileOf(o.from) === fileOf(m.from));
          const sameRank = rivals.some(o => rankOf(o.from) === rankOf(m.from));
          if (!sameFile) dis = FILES[fileOf(m.from)];
          else if (!sameRank) dis = String(rankOf(m.from) + 1);
          else dis = name(m.from);
        }
        s = t + dis + (m.captured ? 'x' : '') + name(m.to);
      }
    }
    this._make(m);
    if (this.inCheck()) s += this._legalRaw().length ? '+' : '#';
    this.undo();
    return s;
  };

  Chess.prototype.moves = function () {
    const legal = this._legalRaw();
    return legal.map(m => Object.assign({}, m, { san: this._san(m, legal), fromName: name(m.from), toName: name(m.to) }));
  };

  const clean = s => String(s).replace(/[+#!?]/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');

  /* Zug ausführen: SAN-String oder {from:'e2', to:'e4', promotion:'Q'} */
  Chess.prototype.move = function (mv) {
    const list = this.moves();
    let m;
    if (typeof mv === 'string') m = list.find(x => clean(x.san) === clean(mv));
    else {
      const from = typeof mv.from === 'string' ? parseSq(mv.from) : mv.from;
      const to = typeof mv.to === 'string' ? parseSq(mv.to) : mv.to;
      m = list.find(x => x.from === from && x.to === to && (!x.promotion || x.promotion === (mv.promotion || 'Q')));
    }
    if (!m) return null;
    this._make(m);
    return m;
  };

  Chess.prototype.perft = function (d) {
    if (d === 0) return 1;
    let n = 0;
    for (const m of this._legalRaw()) { this._make(m); n += this.perft(d - 1); this.undo(); }
    return n;
  };

  Chess.prototype.get = function (s) { return this.board[typeof s === 'string' ? parseSq(s) : s]; };

  /* SAN in deutsche Figurenbuchstaben übersetzen */
  const toGerman = san => san.replace(/[KQRBN]/g, c => ({ K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' })[c]);

  const api = { Chess, START_FEN, toGerman, squareName: name, parseSquare: parseSq };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessCore = api;
})(typeof self !== 'undefined' ? self : this);
