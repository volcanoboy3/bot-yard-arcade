/* Circuit Connect: turn the wire tiles until power from the generator reaches every robot.
 * Each board is a random spanning tree over the grid (so it can always be solved) with robots on
 * the leaves; every tile is then spun to a random angle. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 600, H = 600;
  const TOP = 48;                         // header band
  const BOARD = 504;                      // board square
  const BX = (W - BOARD) / 2, BY = 78;    // board top-left
  const SIZES = [4, 5, 5, 6, 6, 7, 7, 8];
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // bit d of a mask: 0 up, 1 right, 2 down, 3 left
  const TURN = 0.12;                      // seconds per quarter turn
  const HALF_PI = Math.PI / 2;
  const WIRE_OFF = '#3a5666', CASING = '#0a1218';
  const BOT_COLORS = ['#5ad1e6', '#f5c518', '#ff8a5c', '#9fdc6b', '#c3a6ff', '#ff6fa8', '#c9d4db'];
  const HEADS = ['box', 'dome', 'tv'], ANTENNAS = ['ball', 'bolt', 'twin', 'dish'], BASES = ['wheels', 'treads', 'legs', 'hover'];
  const NO_DASH = [];

  const cw = m => ((m << 1) | (m >> 3)) & 15;
  const ccw = m => ((m >> 1) | (m << 3)) & 15;
  const ones = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

  // ---------- puzzle generation ----------
  /** Random spanning tree over an n×n grid where no tile has more than 3 wires (no crosses). */
  function makeTree(n) {
    const total = n * n, mask = new Array(total), inTree = new Array(total), edges = [];
    const mid = (n - 1) / 2;
    for (let attempt = 0; attempt < 200; attempt++) {
      mask.fill(0); inTree.fill(false); edges.length = 0;
      const sx = Math.round(mid + K.rand(-0.5, 0.49)), sy = Math.round(mid + K.rand(-0.5, 0.49));
      const src = sy * n + sx;
      const grow = i => {
        const x = i % n, y = (i - x) / n;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx >= 0 && ny >= 0 && nx < n && ny < n && !inTree[ny * n + nx]) edges.push([i, ny * n + nx, d]);
        }
      };
      inTree[src] = true;
      let count = 1;
      grow(src);
      while (edges.length && count < total) {
        // mostly a random frontier edge, sometimes a recent one for longer wire runs
        const k = Math.random() < 0.3 ? edges.length - 1 : Math.floor(Math.random() * edges.length);
        const e = edges[k];
        edges[k] = edges[edges.length - 1]; edges.pop();
        const a = e[0], b = e[1], d = e[2];
        if (inTree[b] || ones(mask[a]) >= 3) continue;
        mask[a] |= 1 << d; mask[b] |= 1 << ((d + 2) & 3);
        inTree[b] = true; count++;
        grow(b);
      }
      if (count === total) return { mask: mask.slice(), src };
    }
    // fallback (practically never used): full rows joined by the first column
    mask.fill(0);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n - 1; x++) { mask[y * n + x] |= 2; mask[y * n + x + 1] |= 8; }
      if (y < n - 1) { mask[y * n] |= 4; mask[(y + 1) * n] |= 1; }
    }
    return { mask: mask.slice(), src: Math.floor(n / 2) * n + Math.floor(n / 2) };
  }

  /** Follow the power from the generator. Fills on/depth/from/leak and sets lit + solved. */
  function computePower(P) {
    const cols = P.cols, rows = P.rows;
    P.on.fill(0); P.depth.fill(-1); P.from.fill(-1); P.leak.fill(0);
    const q = P.queue;
    let head = 0, tail = 0, leaks = 0;
    q[tail++] = P.src; P.on[P.src] = 1; P.depth[P.src] = 0;
    while (head < tail) {
      const i = q[head++], m = P.mask[i], x = i % cols, y = (i - x) / cols;
      for (let d = 0; d < 4; d++) {
        if (!(m & (1 << d))) continue;
        const nx = x + DX[d], ny = y + DY[d], j = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !(P.mask[j] & (1 << ((d + 2) & 3)))) {
          P.leak[i] |= 1 << d; leaks++;
          continue;
        }
        if (P.depth[j] < 0) { P.depth[j] = P.depth[i] + 1; P.from[j] = (d + 2) & 3; P.on[j] = 1; q[tail++] = j; }
      }
    }
    let lit = 0;
    for (let k = 0; k < P.bots.length; k++) if (P.on[P.bots[k]]) lit++;
    P.lit = lit;
    P.solved = lit === P.bots.length && leaks === 0;
  }

  function botLook(i) {
    const body = K.pick(BOT_COLORS);
    return {
      body, dim: K.shade(body, -0.52), phase: i * 0.37,
      opts: { body, eye: C.eye, head: K.pick(HEADS), antenna: K.pick(ANTENNAS), base: K.pick(BASES), mood: 'sleep', arms: 'down', t: 0 }
    };
  }

  function blankState(cols, rows) {
    const total = cols * rows;
    return {
      cols, rows, mask: new Array(total).fill(0),
      on: new Uint8Array(total), was: new Uint8Array(total), depth: new Int16Array(total), from: new Int8Array(total),
      leak: new Uint8Array(total), queue: new Int16Array(total),
      bots: [], bot: new Array(total).fill(null), lit: 0, solved: false, src: 0
    };
  }

  function makePuzzle(level) {
    const n = SIZES[Math.min(level, SIZES.length) - 1];
    const tree = makeTree(n);
    const total = n * n;
    const P = blankState(n, n);
    P.n = n; P.s = BOARD / n; P.src = tree.src; P.sol = tree.mask;
    P.rotFrom = new Float32Array(total); P.rotT0 = new Float32Array(total).fill(-99); P.litAt = new Float32Array(total).fill(-99);
    for (let i = 0; i < total; i++) {
      if (i !== P.src && ones(P.sol[i]) === 1) { P.bots.push(i); P.bot[i] = botLook(i); }
    }
    for (let i = 0; i < total; i++) {
      let m = P.sol[i], r = K.randi(0, 3);
      while (r--) m = cw(m);
      P.mask[i] = m;
    }
    // never hand out a solved board, or one where every robot is already awake
    computePower(P);
    for (let guard = 0; (P.solved || P.lit === P.bots.length) && guard < 200; guard++) {
      const i = K.randi(0, total - 1);
      if (cw(P.mask[i]) !== P.mask[i]) { P.mask[i] = cw(P.mask[i]); computePower(P); }
    }
    // par: the fewest turns back to the generated answer (turning either way)
    let par = 0;
    for (let i = 0; i < total; i++) {
      let m = P.mask[i], k = 0;
      while (m !== P.sol[i] && k < 4) { m = cw(m); k++; }
      par += Math.min(k, 4 - k);
    }
    P.par = Math.max(1, par);
    P.was.set(P.on);
    return P;
  }

  // ---------- drawing ----------
  let GLOW = null;
  function glowSprite() {
    if (!GLOW) {
      GLOW = K.layer(64, 64, c => {
        const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
        g.addColorStop(0, 'rgba(90,209,230,0.55)');
        g.addColorStop(0.45, 'rgba(90,209,230,0.2)');
        g.addColorStop(1, 'rgba(90,209,230,0)');
        c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      }, 2);
    }
    return GLOW;
  }

  function makePlate(s) {
    return K.layer(s, s, c => {
      const m = Math.max(2, s * 0.03), r = s * 0.13;
      c.fillStyle = 'rgba(0,0,0,0.55)'; K.rr(c, m, m + 2, s - 2 * m, s - 2 * m, r);
      const g = c.createLinearGradient(0, m, 0, s - m);
      g.addColorStop(0, '#223a4a'); g.addColorStop(1, '#172a36');
      c.fillStyle = g; K.rr(c, m, m, s - 2 * m, s - 2 * m - 1, r);
      c.fillStyle = 'rgba(255,255,255,0.07)'; K.rr(c, m + r * 0.7, m + 2, s - 2 * m - r * 1.4, Math.max(2, s * 0.022), 2);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      const q = m + s * 0.1;
      K.circle(c, q, q, Math.max(1.2, s * 0.02)); K.circle(c, s - q, q, Math.max(1.2, s * 0.02));
      K.circle(c, q, s - q, Math.max(1.2, s * 0.02)); K.circle(c, s - q, s - q, Math.max(1.2, s * 0.02));
    }, 2);
  }

  function wirePath(c, mask, half) {
    c.beginPath();
    for (let d = 0; d < 4; d++) if (mask & (1 << d)) { c.moveTo(0, 0); c.lineTo(DX[d] * half, DY[d] * half); }
  }

  /** Wires of one tile, drawn around (0,0) in the current (possibly rotated) space. */
  function drawWires(c, s, mask, on, from, depth, t, dash) {
    const half = s / 2;
    c.lineCap = 'butt';
    if (on) { c.strokeStyle = 'rgba(90,209,230,0.16)'; c.lineWidth = s * 0.36; wirePath(c, mask, half); c.stroke(); }
    c.strokeStyle = CASING; c.lineWidth = s * 0.21; wirePath(c, mask, half); c.stroke();
    c.fillStyle = CASING; K.circle(c, 0, 0, s * 0.105);
    const col = on ? C.glow : WIRE_OFF;
    c.strokeStyle = col; c.lineWidth = s * 0.105; wirePath(c, mask, half); c.stroke();
    c.fillStyle = col; K.circle(c, 0, 0, s * 0.0525);
    // metal plugs where the wire leaves the tile
    c.fillStyle = on ? '#a6ecf6' : '#58707e';
    const pw = s * 0.26, pd = s * 0.05;
    if (mask & 1) c.fillRect(-pw / 2, -half, pw, pd);
    if (mask & 2) c.fillRect(half - pd, -pw / 2, pd, pw);
    if (mask & 4) c.fillRect(-pw / 2, half - pd, pw, pd);
    if (mask & 8) c.fillRect(-half, -pw / 2, pd, pw);
    if (!on) return;
    // current flowing out from the generator
    c.strokeStyle = '#effdff'; c.lineWidth = s * 0.045;
    c.setLineDash(dash);
    const v = s * 1.5, base = depth * s;
    for (let d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      c.beginPath();
      if (d === from) { c.moveTo(DX[d] * half, DY[d] * half); c.lineTo(0, 0); c.lineDashOffset = base - half - v * t; }
      else { c.moveTo(0, 0); c.lineTo(DX[d] * half, DY[d] * half); c.lineDashOffset = base - v * t; }
      c.stroke();
    }
    c.setLineDash(NO_DASH);
    c.lineDashOffset = 0;
  }

  function drawSource(c, s, t) {
    const r = s * 0.25, p = 0.5 + 0.5 * Math.sin(t * 4);
    c.globalAlpha = 0.5 + 0.5 * p;
    c.drawImage(glowSprite(), -s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
    c.globalAlpha = 1;
    c.fillStyle = CASING; K.rr(c, -r - 2, -r, 2 * r + 4, 2 * r + 4, r * 0.45);
    c.fillStyle = C.safety; K.rr(c, -r, -r, 2 * r, 2 * r, r * 0.42);
    c.fillStyle = 'rgba(255,255,255,0.35)'; K.rr(c, -r * 0.62, -r * 0.88, r * 1.24, r * 0.14, r * 0.07);
    c.fillStyle = '#1b2a35'; K.rr(c, -r * 0.7, -r * 0.62, r * 1.4, r * 1.36, r * 0.26);
    c.fillStyle = p > 0.5 ? '#e8fdff' : C.glow;
    c.beginPath();
    c.moveTo(r * 0.16, -r * 0.5); c.lineTo(-r * 0.36, r * 0.12); c.lineTo(-r * 0.04, r * 0.12);
    c.lineTo(-r * 0.18, r * 0.62); c.lineTo(r * 0.36, -r * 0.04); c.lineTo(r * 0.04, -r * 0.04);
    c.closePath(); c.fill();
    K.drawHive(c,0,0,s*.43); K.drawBee(c,s*.2,-s*.22,s*.22,t);
  }

  function drawRobot(c, s, look, lit, t, litAt, cheer) {
    const h = s * 0.58, age = t - litAt;
    let lift = 0;
    if (cheer) lift = Math.abs(Math.sin(t * 7 + look.phase)) * s * 0.07;
    else if (lit && age < 0.35) lift = Math.sin(age / 0.35 * Math.PI) * s * 0.09;
    if (lit) c.drawImage(glowSprite(), -s * 0.46, -s * 0.5, s * 0.92, s * 0.92);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.beginPath(); c.ellipse(0, h * 0.45, h * 0.34, h * 0.08, 0, 0, Math.PI * 2); c.fill();
    const o = look.opts;
    o.body = lit ? look.body : look.dim;
    o.eye = lit ? C.eye : '#5d7888';
    o.mood = lit ? 'happy' : 'sleep';
    o.arms = cheer || (lit && age < 0.7) ? 'up' : 'down';
    o.t = t + look.phase;
    K.drawBot(c, 0, -lift, h, o);
  }

  function drawSpark(c, x, y, s, t, seed) {
    const f = Math.sin(t * 31 + seed * 2.3) * 0.5 + 0.5;
    const r = s * (0.07 + 0.05 * f);
    c.strokeStyle = f > 0.5 ? '#fff3a0' : '#ff9d2e';
    c.lineWidth = Math.max(1.5, s * 0.028);
    c.lineCap = 'round';
    c.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 4 + t * 7 + seed;
      const ca = Math.cos(a), sa = Math.sin(a);
      c.moveTo(x - ca * r, y - sa * r); c.lineTo(x + ca * r, y + sa * r);
    }
    c.stroke();
    c.fillStyle = '#ffffff'; K.circle(c, x, y, s * 0.03);
  }

  function makeBoardLayer(n) {
    return K.layer(W, H, c => {
      K.bgFactory(c, W, H);
      c.fillStyle = 'rgba(8,14,19,0.62)'; c.fillRect(0, 0, W, TOP);
      K.hazard(c, 0, TOP, W, 6, { stripe: 10 });
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, TOP, W, 6);
      c.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(c, BX - 10, BY - 6, BOARD + 20, BOARD + 20, 16);
      c.fillStyle = '#0b141b'; K.rr(c, BX - 10, BY - 10, BOARD + 20, BOARD + 20, 16);
      c.strokeStyle = '#26404f'; c.lineWidth = 2; K.rrPath(c, BX - 10, BY - 10, BOARD + 20, BOARD + 20, 16); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.12)';
      K.circle(c, BX - 3, BY - 3, 2); K.circle(c, BX + BOARD + 3, BY - 3, 2);
      K.circle(c, BX - 3, BY + BOARD + 3, 2); K.circle(c, BX + BOARD + 3, BY + BOARD + 3, 2);
      const s = BOARD / n;
      c.fillStyle = '#0e1922';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) K.rr(c, BX + x * s + 2, BY + y * s + 2, s - 4, s - 4, s * 0.13);
    }, 2);
  }

  const easeBack = k => { const c1 = 1.9; return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  Arcade.register({
    id: 'circuit-connect',
    title: 'Circuit Hive',
    cat: 'puzzle',
    blurb: 'Rotate the wires to bring honey power from the hive to every robot.',
    rules: [
      'Turn wire tiles so power flows from the generator to every robot.',
      'Tap a tile to turn it clockwise. Right-click or Shift+click turns it back.',
      'No loose ends: every powered wire must plug into another wire.',
      'Fewer turns keep your bonus. The boards grow as you go.'
    ],
    how: 'Click or tap a tile to turn it · right-click turns back · arrows + Space',
    accent: '#5ad1e6',
    usesPlayer: false,

    thumb(ctx, w, h) {
      K.bgFactory(ctx, w, h);
      const cols = 5, rows = 3, s = 54;
      const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2 + 2;
      ctx.fillStyle = '#0b141b'; K.rr(ctx, ox - 8, oy - 8, cols * s + 16, rows * s + 16, 12);
      ctx.strokeStyle = '#26404f'; ctx.lineWidth = 2; K.rrPath(ctx, ox - 8, oy - 8, cols * s + 16, rows * s + 16, 12); ctx.stroke();
      const P = blankState(cols, rows);
      P.mask = [6, 8, 4, 6, 8, 3, 14, 11, 13, 2, 2, 11, 8, 3, 9];   // tile 9 is one turn away from its robot being powered
      P.src = 7; P.bots = [1, 2, 4, 9, 10, 12];
      const looks = [
        ['#f5c518', 'box', 'ball', 'wheels'], ['#ff6fa8', 'dome', 'bolt', 'treads'], ['#9fdc6b', 'tv', 'dish', 'legs'],
        ['#c3a6ff', 'box', 'twin', 'hover'], ['#ff8a5c', 'dome', 'ball', 'wheels'], ['#5ad1e6', 'tv', 'bolt', 'treads']
      ];
      P.bots.forEach((i, k) => {
        const L = looks[k];
        P.bot[i] = { body: L[0], dim: K.shade(L[0], -0.52), phase: k, opts: { body: L[0], eye: C.eye, head: L[1], antenna: L[2], base: L[3], mood: 'sleep', arms: 'down', t: 0 } };
      });
      computePower(P);
      const plate = makePlate(s), dash = [s * 0.07, s * 0.17];
      for (let i = 0; i < cols * rows; i++) {
        const x = i % cols, y = (i - x) / cols;
        ctx.save(); ctx.translate(ox + x * s + s / 2, oy + y * s + s / 2);
        ctx.drawImage(plate, -s / 2, -s / 2, s, s);
        drawWires(ctx, s, P.mask[i], P.on[i], P.from[i], P.depth[i], 0.3, dash);
        if (i === P.src) drawSource(ctx, s, 0.4);
        else if (P.bot[i]) drawRobot(ctx, s, P.bot[i], P.on[i], 1.1, -9, false);
        ctx.restore();
      }
      for (let i = 0; i < cols * rows; i++) {
        if (!P.leak[i]) continue;
        const x = i % cols, y = (i - x) / cols;
        for (let d = 0; d < 4; d++) if (P.leak[i] & (1 << d)) drawSpark(ctx, ox + x * s + s / 2 + DX[d] * s / 2, oy + y * s + s / 2 + DY[d] * s / 2, s, 0.2, i);
      }
      K.vignette(ctx, w, h, 0.35);
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const fx = K.particles();
      let t = 0, score = 0, level = 0, turns = 0, P = null;
      let bg = null, plate = null, dash = NO_DASH;
      let cursor = 0, showCursor = false, hover = -1, solved = false, flash = 0, winAt = 0, winBase = 0, winBonus = 0;
      const miniBot = { body: C.glow, head: 'box', antenna: 'ball', base: 'wheels', mood: 'sleep', arms: 'down', t: 0 };

      const cellAt = (px, py) => {
        const x = Math.floor((px - BX) / P.s), y = Math.floor((py - BY) / P.s);
        return x < 0 || y < 0 || x >= P.n || y >= P.n ? -1 : y * P.n + x;
      };
      const cx = i => BX + (i % P.n) * P.s + P.s / 2;
      const cy = i => BY + Math.floor(i / P.n) * P.s + P.s / 2;
      const bonusNow = () => Math.max(0, 5 * (P.par - Math.max(0, turns - P.par)));

      function rotNow(i) {
        const k = (t - P.rotT0[i]) / TURN;
        if (k >= 1) return 0;
        const e = 1 - Math.pow(1 - Math.max(0, k), 3);
        return P.rotFrom[i] * (1 - e);
      }

      function loadLevel(lv) {
        level = lv; turns = 0; solved = false; flash = 0;
        P = makePuzzle(level);
        P.born = t;
        bg = makeBoardLayer(P.n);
        plate = makePlate(P.s);
        dash = [P.s * 0.07, P.s * 0.17];
        cursor = P.src; hover = -1;
        api.stat('Circuit', level);
        api.stat('Turns', 0);
        api.score(score);
        api.sfx('power');
        api.toast(level === 1 ? 'Wake the robots!' : 'Circuit ' + level, { color: C.glow });
      }

      function refresh() {
        computePower(P);
        let woke = 0, slept = 0;
        for (let k = 0; k < P.bots.length; k++) {
          const i = P.bots[k];
          if (P.on[i] && !P.was[i]) {
            woke++; P.litAt[i] = t;
            fx.burst(cx(i), cy(i) - P.s * 0.1, [C.glow, C.eye, P.bot[i].body], 10, 150, { life: 0.55, size: 3, gravity: 260 });
          } else if (!P.on[i] && P.was[i]) slept++;
          P.was[i] = P.on[i];
        }
        if (P.solved) { finish(); return; }
        if (woke) { api.tone(740, 0.07, 'square', 0.04); api.tone(1110, 0.1, 'square', 0.04, 0, 0.06); }
        else if (slept) api.tone(260, 0.12, 'triangle', 0.045, -90);
      }

      function turn(i, dir) {
        if (solved || api.over || i < 0) return;
        P.mask[i] = dir > 0 ? cw(P.mask[i]) : ccw(P.mask[i]);
        P.rotFrom[i] = rotNow(i) + (dir > 0 ? -HALF_PI : HALF_PI);
        P.rotT0[i] = t;
        turns++;
        api.stat('Turns', turns);
        api.sfx('click');
        refresh();
      }

      function finish() {
        solved = true; flash = 0.3; winAt = t;
        const base = 100 * level, bonus = bonusNow();
        winBase = base; winBonus = bonus;
        score += base + bonus;
        api.score(score);
        for (let k = 0; k < P.bots.length; k++) {
          const i = P.bots[k];
          fx.burst(cx(i), cy(i), [C.glow, C.eye, C.safety, C.good, P.bot[i].body], 14, 240, { life: 0.9, size: 3.5 });
        }
        fx.burst(cx(P.src), cy(P.src), [C.safety, C.glow, '#ffffff'], 26, 320, { life: 1, size: 4 });
        const nb = P.bots.length;
        api.win({
          score,
          title: 'Circuit ' + level + ' powered',
          detail: 'You woke up ' + nb + (nb === 1 ? ' robot' : ' robots') + ' in ' + turns + (turns === 1 ? ' turn' : ' turns') +
            (bonus ? ' and kept a +' + bonus + ' turn bonus.' : '.'),
          next: { label: 'Next circuit', run: () => loadLevel(level + 1) },
          delay: 1300
        });
      }

      api.on(cv.el, 'pointerdown', e => {
        if (solved || api.over || !P || e.button === 1) return;
        const p = cv.toLocal(e), i = cellAt(p.x, p.y);
        if (i < 0) return;
        cursor = i; showCursor = false;
        turn(i, e.button === 2 || e.shiftKey || e.ctrlKey || e.altKey ? -1 : 1);
      });
      api.on(cv.el, 'contextmenu', e => e.preventDefault());
      api.on(cv.el, 'pointermove', e => {
        if (e.pointerType !== 'mouse' || !P) return;
        const p = cv.toLocal(e);
        hover = cellAt(p.x, p.y);
      });
      api.on(cv.el, 'pointerleave', () => { hover = -1; });

      api.onKey((name, e) => {
        if (!P || solved) return;
        const n = P.n, code = e.code || '';
        let x = cursor % n, y = (cursor - x) / n;
        if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
          if (name === 'left') x = Math.max(0, x - 1);
          else if (name === 'right') x = Math.min(n - 1, x + 1);
          else if (name === 'up') y = Math.max(0, y - 1);
          else y = Math.min(n - 1, y + 1);
          const next = y * n + x;
          if (next !== cursor || !showCursor) api.tone(1250, 0.02, 'square', 0.018);
          cursor = next; showCursor = true;
          return;
        }
        if (e.repeat) return;
        if (name === 'fire' || code === 'Enter' || code === 'NumpadEnter') { showCursor = true; turn(cursor, e.shiftKey ? -1 : 1); }
        else if (code === 'KeyQ') { showCursor = true; turn(cursor, -1); }
        else if (code === 'KeyE') { showCursor = true; turn(cursor, 1); }
      });

      function drawHeader() {
        const y = TOP / 2 + 1;
        K.text(ctx, 'CIRCUIT ' + level, 22, y, { size: 22, color: C.safety, align: 'left' });
        const b = solved ? 0 : bonusNow();
        if (!solved) K.text(ctx, 'BONUS +' + b, W / 2, y, { size: 19, body: true, color: b > 0 ? C.good : C.muted });
        const all = P.lit === P.bots.length;
        const label = P.lit + '/' + P.bots.length;
        ctx.font = K.font(22);
        const tw = ctx.measureText(label).width;
        K.text(ctx, label, W - 22, y, { size: 22, color: all ? C.good : C.glow, align: 'right' });
        miniBot.mood = all ? 'happy' : P.lit ? 'neutral' : 'sleep';
        miniBot.eye = P.lit ? C.eye : '#5d7888';
        miniBot.t = t;
        K.drawBot(ctx, W - 22 - tw - 20, y + 1, 34, miniBot);
      }

      function render() {
        ctx.drawImage(bg, 0, 0, W, H);
        drawHeader();
        const n = P.n, s = P.s, total = n * n;
        for (let i = 0; i < total; i++) {
          const x = i % n, y = (i - x) / n;
          const ap = (t - P.born - (x + y) * 0.035) / 0.3;
          if (ap <= 0) continue;
          ctx.save();
          ctx.translate(BX + x * s + s / 2, BY + y * s + s / 2);
          if (ap < 1) { const k = Math.max(0.01, easeBack(ap)); ctx.scale(k, k); }
          ctx.drawImage(plate, -s / 2, -s / 2, s, s);
          if (i === hover && !solved) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; K.rr(ctx, -s / 2 + 3, -s / 2 + 3, s - 6, s - 7, s * 0.12); }
          const rot = rotNow(i);
          if (rot) { ctx.save(); ctx.rotate(rot); }
          drawWires(ctx, s, P.mask[i], P.on[i], P.from[i], P.depth[i], t, dash);
          if (rot) ctx.restore();
          if (i === P.src) drawSource(ctx, s, t);
          else if (P.bot[i]) drawRobot(ctx, s, P.bot[i], P.on[i], t, P.litAt[i], solved);
          ctx.restore();
        }
        // loose powered ends spark
        if (!solved) {
          for (let i = 0; i < total; i++) {
            if (!P.leak[i] || rotNow(i)) continue;
            const x = i % n, y = (i - x) / n;
            for (let d = 0; d < 4; d++) {
              if (P.leak[i] & (1 << d)) drawSpark(ctx, BX + x * s + s / 2 + DX[d] * s / 2, BY + y * s + s / 2 + DY[d] * s / 2, s, t, i + d);
            }
          }
        }
        if (showCursor && !solved) {
          const x = cursor % n, y = (cursor - x) / n;
          ctx.strokeStyle = K.alpha(C.safety, 0.75 + 0.25 * Math.sin(t * 8));
          ctx.lineWidth = 4;
          K.rrPath(ctx, BX + x * s + 3, BY + y * s + 3, s - 6, s - 6, s * 0.14);
          ctx.stroke();
        }
        fx.draw(ctx);
        if (solved) drawBanner();
        if (flash > 0) { ctx.fillStyle = 'rgba(210,250,255,' + (flash * 0.5) + ')'; ctx.fillRect(0, 0, W, H); }
      }

      function drawBanner() {
        const k = Math.min(1, (t - winAt - 0.15) / 0.3);
        if (k <= 0) return;
        const y = BY + BOARD / 2, sc = easeBack(k);
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = 'rgba(8,14,19,0.82)';
        ctx.fillRect(BX - 10, y - 50 * sc, BOARD + 20, 100 * sc);
        ctx.fillStyle = C.glow;
        ctx.fillRect(BX - 10, y - 50 * sc, BOARD + 20, 3); ctx.fillRect(BX - 10, y + 50 * sc - 3, BOARD + 20, 3);
        ctx.translate(W / 2, y); ctx.scale(sc, sc);
        K.text(ctx, 'ALL ROBOTS AWAKE!', 0, -14, { size: 30, color: C.good });
        K.text(ctx, '+' + winBase + (winBonus ? '   ·   TURN BONUS +' + winBonus : ''), 0, 24, { size: 19, body: true, color: C.safety });
        ctx.restore();
      }

      loadLevel(1);
      api.loop(dt => {
        t += dt;
        flash = Math.max(0, flash - dt);
        fx.update(dt);
        render();
      });

      // test hook for the QA scripts: read-only view of the board
      cv.el._qa = { board: () => ({ n: P.n, s: P.s, bx: BX, by: BY, mask: P.mask.slice(), sol: P.sol.slice(), src: P.src, solved: P.solved, lit: P.lit, bots: P.bots.length, par: P.par, turns, level, score }) };
    }
  });
})();
