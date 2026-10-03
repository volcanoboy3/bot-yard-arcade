/* Bot 2048: slide robot parts around a 4×4 bench. Two matching parts join into the next part,
 * from a bolt all the way up to a whole robot (2048) and beyond. Standard 2048 rules. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 520, H = 520;
  const TRAY = 10, INSET = 14, GAP = 12;
  const CELL = (W - 2 * TRAY - 2 * INSET - 3 * GAP) / 4;   // 109
  const OX = TRAY + INSET, OY = TRAY + INSET;
  const SLIDE = 0.11, POP = 0.16, APPEAR = 0.14;
  const INK = '#15222c';
  const PARTS = [
    null,
    { name: 'Bolt', color: '#8b9aa6' },
    { name: 'Nut', color: '#c9d4db' },
    { name: 'Gear', color: '#e0c064' },
    { name: 'Spring', color: '#9fdc6b' },
    { name: 'Chip', color: '#5ad1e6' },
    { name: 'Battery', color: '#c3a6ff' },
    { name: 'Motor', color: '#ff8a5c' },
    { name: 'Sensor', color: '#ff6fa8' },
    { name: 'Arm', color: '#ff5a5a' },
    { name: 'Head', color: '#f5c518' },
    { name: 'Robot', color: '#f5c518', bot: { body: '#5ad1e6', head: 'box', antenna: 'ball', base: 'wheels', mood: 'happy', arms: 'up', t: 0 } },
    { name: 'Mega Bot', color: '#ff6b3d', bot: { body: '#f5c518', head: 'tv', antenna: 'dish', base: 'treads', mood: 'happy', arms: 'up', t: 0 } },
    { name: 'Giga Bot', color: '#c3a6ff', bot: { body: '#ff6fa8', head: 'dome', antenna: 'twin', base: 'hover', mood: 'happy', arms: 'wave', t: 0 } }
  ];
  const levelOf = v => Math.round(Math.log2(v));
  const partOf = v => PARTS[Math.max(1, Math.min(PARTS.length - 1, levelOf(v)))];
  const VEC = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeBack = k => { const c1 = 2.2; return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  // ---------- part icons (drawn around 0,0, about s wide) ----------
  function spring(c, s) {
    const w = s * 0.3, top = -s * 0.36, bot = s * 0.36, n = 4, step = (bot - top) / n;
    c.strokeStyle = INK; c.lineWidth = s * 0.1; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-w, top);
    for (let i = 0; i < n; i++) { c.lineTo(w, top + step * (i + 0.5)); c.lineTo(-w, top + step * (i + 1)); }
    c.stroke();
    c.fillStyle = INK;
    K.rr(c, -w - s * 0.08, top - s * 0.12, 2 * w + s * 0.16, s * 0.09, 2);
    K.rr(c, -w - s * 0.08, bot + s * 0.03, 2 * w + s * 0.16, s * 0.09, 2);
  }
  function motor(c, s, t) {
    c.fillStyle = INK; K.rr(c, -s * 0.44, -s * 0.28, s * 0.66, s * 0.5, s * 0.1);
    c.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 4; i++) c.fillRect(-s * 0.36 + i * s * 0.13, -s * 0.21, s * 0.05, s * 0.36);
    c.fillStyle = INK; K.rr(c, s * 0.2, -s * 0.2, s * 0.1, s * 0.34, s * 0.03);
    c.fillStyle = '#e6eef2'; c.fillRect(s * 0.3, -s * 0.05, s * 0.14, s * 0.08);
    c.save(); c.translate(s * 0.44, -s * 0.01); c.rotate(t * 9);
    c.fillStyle = INK; c.fillRect(-s * 0.03, -s * 0.16, s * 0.06, s * 0.32);
    c.restore();
    c.fillStyle = INK; K.rr(c, -s * 0.38, s * 0.24, s * 0.52, s * 0.08, 2);
  }
  function sensor(c, s, t) {
    c.fillStyle = INK;
    K.rr(c, -s * 0.5, -s * 0.07, s * 0.12, s * 0.14, 2); K.rr(c, s * 0.38, -s * 0.07, s * 0.12, s * 0.14, 2);
    K.circle(c, 0, 0, s * 0.42);
    c.fillStyle = '#39505e'; K.circle(c, 0, 0, s * 0.31);
    const lx = Math.sin(t * 1.3) * s * 0.06, ly = Math.cos(t * 0.9) * s * 0.03;
    c.fillStyle = C.glow; K.circle(c, lx, ly, s * 0.2);
    c.fillStyle = C.eye; K.circle(c, lx, ly, s * 0.1);
    c.fillStyle = 'rgba(255,255,255,0.85)'; K.circle(c, lx - s * 0.08, ly - s * 0.08, s * 0.05);
  }
  function arm(c, s) {
    c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = s * 0.17;
    c.beginPath(); c.moveTo(-s * 0.3, s * 0.28); c.lineTo(-s * 0.1, -s * 0.2); c.lineTo(s * 0.2, -s * 0.04); c.stroke();
    c.lineWidth = s * 0.075;
    c.beginPath();
    c.moveTo(s * 0.2, -s * 0.04); c.lineTo(s * 0.4, -s * 0.2);
    c.moveTo(s * 0.2, -s * 0.04); c.lineTo(s * 0.42, s * 0.08);
    c.stroke();
    c.fillStyle = '#e6eef2'; K.circle(c, -s * 0.1, -s * 0.2, s * 0.05); K.circle(c, -s * 0.3, s * 0.28, s * 0.05);
    c.fillStyle = INK; K.rr(c, -s * 0.48, s * 0.34, s * 0.36, s * 0.09, 2);
  }
  function head(c, s, t) {
    c.fillStyle = INK;
    c.fillRect(-s * 0.03, -s * 0.5, s * 0.06, s * 0.16);
    c.fillStyle = Math.sin(t * 6) > 0 ? '#ff4d4d' : '#ffb3b3'; K.circle(c, 0, -s * 0.5, s * 0.07);
    c.fillStyle = INK; K.rr(c, -s * 0.42, -s * 0.36, s * 0.84, s * 0.66, s * 0.14);
    K.rr(c, -s * 0.5, -s * 0.12, s * 0.1, s * 0.2, 2); K.rr(c, s * 0.4, -s * 0.12, s * 0.1, s * 0.2, 2);
    c.fillStyle = '#2b4353'; K.rr(c, -s * 0.3, -s * 0.2, s * 0.6, s * 0.26, s * 0.08);
    const blink = (t % 3.1) < 0.12;
    c.fillStyle = C.eye;
    if (blink) { c.fillRect(-s * 0.2, -s * 0.08, s * 0.12, s * 0.03); c.fillRect(s * 0.08, -s * 0.08, s * 0.12, s * 0.03); }
    else { K.circle(c, -s * 0.14, -s * 0.07, s * 0.06); K.circle(c, s * 0.14, -s * 0.07, s * 0.06); }
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-s * 0.12, s * 0.14, s * 0.24, s * 0.045);
  }
  function drawIcon(c, L, s, col, t) {
    switch (L) {
      case 1: K.bolt(c, 0, s * 0.04, s * 0.95, { color: INK, rot: -0.4 }); break;
      case 2: K.nut(c, 0, 0, s * 0.46, { color: INK, hole: col, rot: 0.25 }); break;
      case 3: K.gear(c, 0, 0, s * 0.5, { color: INK, hole: col, teeth: 8, rot: t * 0.7 }); break;
      case 4: spring(c, s); break;
      case 5: K.chip(c, 0, 0, s * 0.66, C.eye); break;
      case 6: K.battery(c, 0, s * 0.02, s * 0.5, s * 0.82, 0.7 + 0.3 * (Math.sin(t * 2) * 0.5 + 0.5), C.good); break;
      case 7: motor(c, s, t); break;
      case 8: sensor(c, s, t); break;
      case 9: arm(c, s); break;
      default: head(c, s, t);
    }
  }

  /** One part tile centred on x,y with side s. k scales it (pop / appear). */
  function drawTile(c, v, x, y, s, t, k) {
    const p = partOf(v), L = levelOf(v), h = s / 2, r = s * 0.13;
    const big = s >= 70;
    const digits = String(v).length;
    const numSize = s * (digits <= 2 ? 0.24 : digits === 3 ? 0.22 : digits === 4 ? 0.19 : 0.16) * (big ? 1 : 1.25);
    c.save();
    c.translate(x, y);
    if (k !== 1) c.scale(k, k);
    c.fillStyle = 'rgba(0,0,0,0.42)'; K.rr(c, -h, -h + Math.max(2, s * 0.035), s, s, r);
    if (p.bot) {
      c.fillStyle = '#101c25'; K.rr(c, -h, -h, s, s, r);
      c.strokeStyle = K.alpha(p.color, 0.28); c.lineWidth = s * 0.08; K.rrPath(c, -h + s * 0.06, -h + s * 0.06, s * 0.88, s * 0.88, r * 0.7); c.stroke();
      c.strokeStyle = p.color; c.lineWidth = Math.max(2, s * 0.03); K.rrPath(c, -h + s * 0.015, -h + s * 0.015, s * 0.97, s * 0.97, r); c.stroke();
      p.bot.t = t;
      K.drawBot(c, 0, big ? -s * 0.04 : -s * 0.1, s * (big ? 0.5 : 0.56), p.bot);
      if (big) K.text(c, p.name.toUpperCase(), 0, -h + s * 0.13, { size: s * 0.115, body: true, color: p.color, shadow: false });
      K.text(c, String(v), 0, h - s * (big ? 0.15 : 0.14), { size: numSize, color: C.ink, shadow: false });
    } else {
      c.fillStyle = p.color; K.rr(c, -h, -h, s, s, r);
      c.fillStyle = 'rgba(0,0,0,0.13)'; K.rr(c, -h, h - s * 0.24, s, s * 0.24, [0, 0, r, r]);
      c.fillStyle = 'rgba(255,255,255,0.32)'; K.rr(c, -h + r, -h + s * 0.03, s - 2 * r, Math.max(1.5, s * 0.028), 2);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      const q = h - s * 0.085, rv = Math.max(1, s * 0.022);
      K.circle(c, -q, -q, rv); K.circle(c, q, -q, rv); K.circle(c, -q, q, rv); K.circle(c, q, q, rv);
      if (big) K.text(c, p.name.toUpperCase(), 0, -h + s * 0.14, { size: s * 0.12, body: true, color: 'rgba(15,26,35,0.72)', shadow: false });
      c.save();
      c.translate(0, big ? -s * 0.03 : -s * 0.1);
      drawIcon(c, L, s * (big ? 0.38 : 0.44), p.color, t);
      c.restore();
      K.text(c, String(v), 0, h - s * (big ? 0.155 : 0.17), { size: numSize, color: INK, shadow: false });
    }
    c.restore();
  }

  function drawBench(c) {
    K.bgFactory(c, W, H);
    c.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(c, TRAY, TRAY + 5, W - 2 * TRAY, H - 2 * TRAY, 20);
    c.fillStyle = '#0b141b'; K.rr(c, TRAY, TRAY, W - 2 * TRAY, H - 2 * TRAY, 20);
    c.strokeStyle = '#26404f'; c.lineWidth = 2; K.rrPath(c, TRAY + 1, TRAY + 1, W - 2 * TRAY - 2, H - 2 * TRAY - 2, 19); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (const [x, y] of [[TRAY + 8, TRAY + 8], [W - TRAY - 8, TRAY + 8], [TRAY + 8, H - TRAY - 8], [W - TRAY - 8, H - TRAY - 8]]) K.circle(c, x, y, 2);
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q < 4; q++) {
        const x = OX + q * (CELL + GAP), y = OY + r * (CELL + GAP);
        c.fillStyle = '#132230'; K.rr(c, x, y, CELL, CELL, CELL * 0.13);
        c.fillStyle = 'rgba(0,0,0,0.3)'; K.rr(c, x, y, CELL, 5, [CELL * 0.13, CELL * 0.13, 0, 0]);
        c.strokeStyle = 'rgba(255,255,255,0.045)'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x + CELL / 2 - 9, y + CELL / 2); c.lineTo(x + CELL / 2 + 9, y + CELL / 2);
        c.moveTo(x + CELL / 2, y + CELL / 2 - 9); c.lineTo(x + CELL / 2, y + CELL / 2 + 9);
        c.stroke();
      }
    }
  }

  Arcade.register({
    id: 'bot-2048',
    title: 'Bot 2048',
    cat: 'puzzle',
    blurb: 'Slide parts together until you build a robot.',
    rules: [
      'Every move slides all the parts. Two matching parts join into the next one.',
      'Bolt, Nut, Gear, Spring, Chip, Battery, Motor, Sensor, Arm, Head, Robot.',
      'Build a Robot (2048) to win, then keep going for a Mega Bot.',
      'When the bench is full and nothing can join, your shift is over.'
    ],
    how: 'Arrow keys or WASD · swipe on the board',
    accent: '#f5c518',
    usesPlayer: false,

    thumb(ctx, w, h) {
      K.bgFactory(ctx, w, h);
      const bs = 184, bx = 16, by = 8, pad = 7, gap = 5, cell = (bs - 2 * pad - 3 * gap) / 4;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(ctx, bx, by + 3, bs, bs, 12);
      ctx.fillStyle = '#0b141b'; K.rr(ctx, bx, by, bs, bs, 12);
      const vals = [2, 0, 4, 2, 8, 16, 0, 4, 64, 32, 128, 8, 2048, 1024, 256, 512];
      for (let i = 0; i < 16; i++) {
        const x = bx + pad + (i % 4) * (cell + gap), y = by + pad + Math.floor(i / 4) * (cell + gap);
        ctx.fillStyle = '#132230'; K.rr(ctx, x, y, cell, cell, 6);
        if (vals[i]) drawTile(ctx, vals[i], x + cell / 2, y + cell / 2, cell, 0.6, 1);
      }
      K.drawBot(ctx, 262, 100, 124, { body: '#5ad1e6', head: 'box', antenna: 'ball', base: 'wheels', mood: 'happy', arms: 'up', t: 0.3, shadow: true });
      ctx.fillStyle = C.safety;
      for (const [x, y, r] of [[216, 44, 3], [306, 58, 2.5], [300, 150, 3], [222, 150, 2]]) {
        ctx.beginPath(); ctx.moveTo(x, y - r * 2.4); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 2.4, y);
        ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.lineTo(x, y + r * 2.4); ctx.lineTo(x - r * 0.6, y + r * 0.6);
        ctx.lineTo(x - r * 2.4, y); ctx.lineTo(x - r * 0.6, y - r * 0.6); ctx.closePath(); ctx.fill();
      }
      K.text(ctx, '2048', 262, 180, { size: 18, color: C.safety });
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const fx = K.particles();
      const bench = K.layer(W, H, drawBench, 2);
      const grid = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
      let tiles = [], ghosts = [];
      let now = 0, moveT = -1, score = 0, maxV = 0, ended = false, won = false, moves = 0;
      let bumpT = -1, bumpR = 0, bumpC = 0;
      const cellX = q => OX + q * (CELL + GAP) + CELL / 2;
      const cellY = r => OY + r * (CELL + GAP) + CELL / 2;

      function spawn(delay) {
        const empty = [];
        for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) if (!grid[r][q]) empty.push(r * 4 + q);
        if (!empty.length) return null;
        const i = K.pick(empty), r = (i / 4) | 0, q = i % 4;
        const tl = { v: Math.random() < 0.9 ? 2 : 4, r, c: q, fr: r, fc: q, born: now + delay, popAt: -9, showV: 0 };
        grid[r][q] = tl; tiles.push(tl);
        return tl;
      }

      function canMove() {
        for (let r = 0; r < 4; r++) {
          for (let q = 0; q < 4; q++) {
            const tl = grid[r][q];
            if (!tl) return true;
            if (q < 3 && grid[r][q + 1] && grid[r][q + 1].v === tl.v) return true;
            if (r < 3 && grid[r + 1][q] && grid[r + 1][q].v === tl.v) return true;
          }
        }
        return false;
      }

      function topValue() { let m = 0; for (const tl of tiles) if (tl.v > m) m = tl.v; return m; }
      const bestLine = () => 'Your best part: ' + partOf(maxV).name + ' (' + maxV + ').';

      function endShift() {
        ended = true;
        api.gameOver({ score, title: 'Out of moves', detail: bestLine(), delay: 1100 });
      }

      function move(dir) {
        if (ended || api.over) return;
        const dr = VEC[dir][0], dc = VEC[dir][1];
        ghosts = [];
        for (const tl of tiles) { tl.fr = tl.r; tl.fc = tl.c; }
        const order = [0, 1, 2, 3], rev = [3, 2, 1, 0];
        const rows = dr === 1 ? rev : order, cols = dc === 1 ? rev : order;
        const merged = [];
        let moved = false, gained = 0;
        for (const r of rows) {
          for (const q of cols) {
            const tl = grid[r][q];
            if (!tl) continue;
            let nr = r, nq = q, joined = false;
            for (;;) {
              const tr = nr + dr, tq = nq + dc;
              if (tr < 0 || tr > 3 || tq < 0 || tq > 3) break;
              const o = grid[tr][tq];
              if (!o) { nr = tr; nq = tq; continue; }
              if (o.v === tl.v && merged.indexOf(o) < 0) {
                grid[r][q] = null;
                tl.r = tr; tl.c = tq;
                ghosts.push(tl);
                tiles.splice(tiles.indexOf(tl), 1);
                o.showV = o.v; o.v *= 2; o.popAt = now + SLIDE;
                merged.push(o);
                gained += o.v; moved = true; joined = true;
              }
              break;
            }
            if (!joined && (nr !== r || nq !== q)) {
              grid[r][q] = null; grid[nr][nq] = tl; tl.r = nr; tl.c = nq; moved = true;
            }
          }
        }
        if (!moved) {
          bumpT = now; bumpR = dr; bumpC = dc;
          api.tone(120, 0.06, 'triangle', 0.035);
          return;
        }
        moveT = now; moves++;
        score += gained;
        api.score(score);
        spawn(SLIDE);
        if (merged.length) {
          const top = merged.reduce((m, o) => Math.max(m, o.v), 0);
          api.tone(260 + levelOf(top) * 70, 0.09, 'square', 0.04, 90);
          const pops = merged.map(o => ({ v: o.v, x: cellX(o.c), y: cellY(o.r) }));
          api.after(SLIDE * 1000, () => {
            for (const p of pops) {
              const col = partOf(p.v).color;
              fx.burst(p.x, p.y, [col, '#ffffff', K.shade(col, 0.3)], 9 + Math.min(12, levelOf(p.v)), 150 + levelOf(p.v) * 12, { life: 0.45, size: 3.2, gravity: 300 });
              fx.float('+' + p.v, p.x, p.y - CELL * 0.05, p.v >= 2048 ? C.good : C.ink, { size: 22, life: 0.8, speed: 70 });
            }
          });
        } else api.tone(210, 0.05, 'triangle', 0.03, 50);

        const top = topValue();
        if (top > maxV) {
          maxV = top;
          api.stat('Top part', partOf(maxV).name);
          if (top >= 64 && top !== 2048) {
            api.after(SLIDE * 1000, () => {
              api.toast(top >= 4096 ? partOf(top).name + ' built!' : 'New part: ' + partOf(top).name, { color: partOf(top).color });
              api.sfx('levelup');
            });
          }
        }
        if (top >= 2048 && !won) {
          won = true;
          api.after(SLIDE * 1000, () => {
            const x = OX + 2 * (CELL + GAP) - GAP / 2, y = OY + 2 * (CELL + GAP) - GAP / 2;
            for (let i = 0; i < 5; i++) fx.burst(x, y, [C.safety, C.glow, C.good, '#ffffff', C.hazard], 20, 360, { life: 1.1, size: 4 });
          });
          api.win({
            score,
            title: 'Robot built!',
            detail: 'You turned bolts into a whole robot in ' + moves + (moves === 1 ? ' move' : ' moves') + '. Keep going for a Mega Bot.',
            next: { label: 'Keep building', run: keepBuilding },
            delay: 1000
          });
          return;
        }
        if (!canMove()) endShift();
      }

      function keepBuilding() {
        api.score(score);
        if (!canMove()) { endShift(); return; }
        api.toast('Next goal: Mega Bot', { color: C.hazard });
      }

      function newGame() {
        for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) grid[r][q] = null;
        tiles = []; ghosts = [];
        score = 0; ended = false; won = false; moves = 0;
        spawn(0.05); spawn(0.12);
        maxV = topValue();
        api.score(0);
        api.stat('Top part', partOf(maxV).name);
      }

      // ---------- input ----------
      api.onKey((name, e) => {
        if (!VEC[name] || e.repeat) return;
        move(name);
      });
      let swipe = null;
      api.on(cv.el, 'pointerdown', e => {
        if (api.over || ended) return;
        swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
        K.capture(cv.el, e);
      });
      const swipeDir = (e, min) => {
        const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      };
      api.on(cv.el, 'pointermove', e => {
        if (!swipe || swipe.done || e.pointerId !== swipe.id) return;
        const d = swipeDir(e, 28);
        if (d) { swipe.done = true; move(d); }
      });
      const release = e => {
        if (!swipe || e.pointerId !== swipe.id) return;
        if (!swipe.done && e.type === 'pointerup') { const d = swipeDir(e, 16); if (d) move(d); }
        swipe = null;
      };
      api.on(cv.el, 'pointerup', release);
      api.on(cv.el, 'pointercancel', release);

      // ---------- drawing ----------
      function render() {
        ctx.drawImage(bench, 0, 0, W, H);
        const k = moveT < 0 ? 1 : Math.min(1, (now - moveT) / SLIDE), e = easeOut(k);
        let ox = 0, oy = 0;
        if (bumpT >= 0 && now - bumpT < 0.16) {
          const b = Math.sin((now - bumpT) / 0.16 * Math.PI) * 6;
          ox = bumpC * b; oy = bumpR * b;
        }
        ctx.save();
        ctx.translate(ox, oy);
        if (k < 1) {
          for (const g of ghosts) {
            drawTile(ctx, g.v, K.lerp(cellX(g.fc), cellX(g.c), e), K.lerp(cellY(g.fr), cellY(g.r), e), CELL, now, 1);
          }
        }
        for (let pass = 0; pass < 2; pass++) {
          for (const tl of tiles) {
            if (now < tl.born) continue;
            const popping = now >= tl.popAt && now < tl.popAt + POP;
            if ((pass === 1) !== popping) continue;
            let sc = 1;
            const ap = (now - tl.born) / APPEAR;
            if (ap < 1) sc = 0.2 + 0.8 * easeBack(Math.max(0, ap));
            if (popping) sc *= 1 + 0.2 * Math.sin((now - tl.popAt) / POP * Math.PI);
            const v = now < tl.popAt ? tl.showV : tl.v;
            drawTile(ctx, v, K.lerp(cellX(tl.fc), cellX(tl.c), e), K.lerp(cellY(tl.fr), cellY(tl.r), e), CELL, now, sc);
          }
        }
        ctx.restore();
        fx.draw(ctx);
      }

      newGame();
      api.loop(dt => {
        now += dt;
        fx.update(dt);
        render();
      });

      // test hook for the QA scripts: read the bench, or load a bench layout (16 values, 0 = empty)
      cv.el._qa = {
        state: () => ({ cells: grid.map(row => row.map(tl => (tl ? tl.v : 0))), score, maxV, ended, won, moves }),
        load(vals) {
          for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) grid[r][q] = null;
          tiles = []; ghosts = [];
          vals.forEach((v, i) => {
            if (!v) return;
            const r = (i / 4) | 0, q = i % 4, tl = { v, r, c: q, fr: r, fc: q, born: now, popAt: -9, showV: 0 };
            grid[r][q] = tl; tiles.push(tl);
          });
          maxV = topValue();
          api.stat('Top part', partOf(maxV).name);
        }
      };
    }
  });
})();
