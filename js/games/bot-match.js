/* Bot Match: a memory game on the factory floor.
 * Flip two panels at a time. Matching robots stay face up, glow and cheer.
 * Fewer moves and a faster time score more; harder modes multiply the score. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  // Twelve robots. Each has its own colour and its own head + drive combination,
  // and robots with neighbouring colours also differ in head, drive and antenna.
  const ROBOTS = [
    { name: 'BLAZE',  body: '#ff5a5a', head: 'box',  base: 'wheels', antenna: 'ball', eye: '#bff6ff', arms: 'down' },
    { name: 'TANGO',  body: '#ff9a3c', head: 'dome', base: 'legs',   antenna: 'bolt', eye: '#9dff9d', arms: 'up' },
    { name: 'SPARK',  body: '#f5c518', head: 'box',  base: 'hover',  antenna: 'ball', eye: '#bff6ff', arms: 'wave' },
    { name: 'SPROUT', body: '#9fdc6b', head: 'dome', base: 'treads', antenna: 'bolt', eye: '#ffd36b', arms: 'down' },
    { name: 'MINTY',  body: '#35d49a', head: 'tv',   base: 'wheels', antenna: 'ball', eye: '#ff9ad5', arms: 'up' },
    { name: 'PIXEL',  body: '#5ad1e6', head: 'box',  base: 'treads', antenna: 'bolt', eye: '#ffd36b', arms: 'wave' },
    { name: 'BLIP',   body: '#4f7dff', head: 'tv',   base: 'legs',   antenna: 'twin', eye: '#bff6ff', arms: 'down' },
    { name: 'GIZMO',  body: '#a57bff', head: 'dome', base: 'wheels', antenna: 'dish', eye: '#9dff9d', arms: 'up' },
    { name: 'POPPY',  body: '#ff6fa8', head: 'tv',   base: 'hover',  antenna: 'twin', eye: '#bff6ff', arms: 'wave' },
    { name: 'CHROME', body: '#d3dde3', head: 'box',  base: 'legs',   antenna: 'twin', eye: '#5ad1e6', arms: 'down' },
    { name: 'RUSTY',  body: '#b8733d', head: 'tv',   base: 'treads', antenna: 'dish', eye: '#ffd36b', arms: 'up' },
    { name: 'SHADOW', body: '#4b5864', head: 'dome', base: 'hover',  antenna: 'none', eye: '#ff6b6b', arms: 'down', panel: '#8b9aa6', glow: '#9fb0bc' }
  ];
  const PAIRS = { easy: 6, medium: 8, hard: 12 };
  const MULT = { easy: 1, medium: 1.5, hard: 2 };
  const FLIP = 0.26;       // seconds for a panel to turn over
  const PEEK = 0.7;        // how long a wrong pair stays up before flipping back

  const backOut = t => { t = K.clamp(t, 0, 1) - 1; return 1 + 2.7 * t * t * t + 1.7 * t * t; };
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function secsText(s) {
    if (s < 60) return s + (s === 1 ? ' second' : ' seconds');
    const m = Math.floor(s / 60), r = s % 60;
    return m + (m === 1 ? ' minute' : ' minutes') + (r ? ' ' + r + (r === 1 ? ' second' : ' seconds') : '');
  }

  // ---------- art ----------
  function boltMark(c, x, y, s, color) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath();
    c.moveTo(0.2, -0.5); c.lineTo(-0.3, 0.07); c.lineTo(-0.04, 0.07);
    c.lineTo(-0.2, 0.5); c.lineTo(0.3, -0.07); c.lineTo(0.04, -0.07);
    c.closePath();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.save(); c.translate(0.03, 0.04); c.fill(); c.restore();
    c.fillStyle = color; c.fill();
    c.restore();
  }
  function rivet(c, x, y, r) {
    c.fillStyle = 'rgba(0,0,0,0.4)'; K.circle(c, x + r * 0.35, y + r * 0.45, r);
    c.fillStyle = '#7d93a1'; K.circle(c, x, y, r);
    c.fillStyle = 'rgba(255,255,255,0.5)'; K.circle(c, x - r * 0.3, y - r * 0.3, r * 0.42);
  }

  /** Face-down panel: dark brushed metal, rivet border, gear badge with a lightning bolt. */
  function drawBack(c, w, h) {
    const m = Math.min(w, h), r = Math.max(5, m * 0.09);
    const g = c.createLinearGradient(0, 0, w * 0.5, h);
    g.addColorStop(0, '#3d5869'); g.addColorStop(0.5, '#2b4353'); g.addColorStop(1, '#1f3341');
    c.fillStyle = g; K.rr(c, 0, 0, w, h, r);
    c.fillStyle = 'rgba(255,255,255,0.12)'; K.rr(c, r * 0.6, 2, w - r * 1.2, Math.max(2, h * 0.025), 2);
    const ins = Math.max(7, m * 0.12);
    c.fillStyle = 'rgba(6,14,20,0.38)'; K.rr(c, ins, ins, w - ins * 2, h - ins * 2, r * 0.55);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    K.rrPath(c, ins + 0.5, ins + 0.5, w - ins * 2 - 1, h - ins * 2 - 1, r * 0.55); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = ins + 4; y < h - ins - 3; y += 4) c.fillRect(ins + 3, y, w - ins * 2 - 6, 1);
    // rivets around the border
    const rv = Math.max(1.5, m * 0.024), e = ins / 2;
    const nx = Math.max(2, Math.round((w - e * 2) / (rv * 8))), ny = Math.max(2, Math.round((h - e * 2) / (rv * 8)));
    for (let i = 0; i <= nx; i++) { const x = e + (w - e * 2) * i / nx; rivet(c, x, e, rv); rivet(c, x, h - e, rv); }
    for (let j = 1; j < ny; j++) { const y = e + (h - e * 2) * j / ny; rivet(c, e, y, rv); rivet(c, w - e, y, rv); }
    // badge
    const br = m * 0.25;
    c.fillStyle = 'rgba(0,0,0,0.3)'; K.circle(c, w / 2 + 1.5, h / 2 + 2.5, br);
    K.gear(c, w / 2, h / 2, br, { teeth: 10, color: '#56707f', hole: '#56707f', rot: 0.15 });
    c.fillStyle = '#15222c'; K.circle(c, w / 2, h / 2, br * 0.6);
    K.ring(c, w / 2, h / 2, br * 0.6, Math.max(1, br * 0.07), 'rgba(90,209,230,0.45)');
    boltMark(c, w / 2, h / 2, br * 0.95, C.safety);
    K.drawBee(c,w/2,h/2,Math.min(w,h)*.45,0);
  }

  /** Face-up panel for one robot: colour-washed bay with a spotlight and floor strip. */
  function drawFront(c, w, h, bot) {
    const m = Math.min(w, h), r = Math.max(5, m * 0.09), tint = bot.panel || bot.body;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, K.shade(tint, -0.6)); g.addColorStop(1, K.shade(tint, -0.8));
    c.fillStyle = g; K.rr(c, 0, 0, w, h, r);
    const sp = c.createRadialGradient(w / 2, h * 0.42, 1, w / 2, h * 0.45, Math.max(w, h) * 0.62);
    sp.addColorStop(0, K.alpha(tint, 0.42)); sp.addColorStop(1, K.alpha(tint, 0));
    c.fillStyle = sp; K.rr(c, 0, 0, w, h, r);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
    for (let x = w / 6; x < w; x += w / 3) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x, h * 0.84); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.3)'; K.rr(c, 0, h * 0.86, w, h * 0.14, [0, 0, r, r]);
    c.fillStyle = K.alpha(tint, 0.35); c.fillRect(0, h * 0.86, w, Math.max(1.5, h * 0.012));
    c.strokeStyle = K.alpha(bot.body, 0.6); c.lineWidth = 2;
    K.rrPath(c, 1, 1, w - 2, h - 2, r - 1); c.stroke();
  }

  /** Where the robot sits on a card of size w × h: centre y and height for drawBot. */
  function botFit(w, h) {
    const bh = Math.min(h * 0.74, w * 1.16);
    const s = bh / 110;
    return { bh, by: h * 0.87 - 54 * s };
  }

  // ---------- layout: pick the grid that gives the biggest, most even cards ----------
  function chooseLayout(W, H, n) {
    const small = W < 560;
    const gap = small ? 8 : 14, margin = small ? 4 : 16, header = small ? 38 : 48, cap = 210;
    let best = null;
    for (let cols = 2; cols <= n / 2; cols++) {
      if (n % cols) continue;
      const rows = n / cols;
      const aw = (W - 2 * margin - (cols - 1) * gap) / cols;
      const ah = (H - header - 2 * margin - (rows - 1) * gap) / rows;
      let ch = Math.min(ah, cap);
      const cw = Math.min(aw, ch * 0.92);
      ch = Math.min(ch, cw / 0.64);
      if (cw < 16 || ch < 16) continue;
      const score = cw * ch * (1 - 0.25 * Math.abs(Math.log(cols / rows)));
      if (!best || score > best.score) best = { cols, rows, cw, ch, score };
    }
    if (!best) best = { cols: n / 2, rows: 2, cw: 30, ch: 40 };
    best.gap = gap; best.header = header; best.small = small;
    best.bw = best.cols * best.cw + (best.cols - 1) * gap;
    best.bh = best.rows * best.ch + (best.rows - 1) * gap;
    best.x0 = (W - best.bw) / 2;
    best.y0 = header + Math.max(margin, (H - header - best.bh) / 2);
    return best;
  }

  function drawBackdrop(c, W, H, L) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#132330'); g.addColorStop(1, '#1b2e3b');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 2;
    for (let x = 40; x < W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 60; y < H; y += 120) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    if (!L.small) {
      // the table the panels lie on
      const p = 12;
      c.fillStyle = 'rgba(0,0,0,0.25)'; K.rr(c, L.x0 - p + 3, L.y0 - p + 5, L.bw + p * 2, L.bh + p * 2, 16);
      c.fillStyle = '#16252f'; K.rr(c, L.x0 - p, L.y0 - p, L.bw + p * 2, L.bh + p * 2, 16);
      c.strokeStyle = '#223845'; c.lineWidth = 2; K.rrPath(c, L.x0 - p, L.y0 - p, L.bw + p * 2, L.bh + p * 2, 16); c.stroke();
    }
    K.vignette(c, W, H, 0.35);
  }

  // header plate: PAIRS n/P and one light per pair
  function headerGeom(W, L, P) {
    const pill = L.small ? 11 : 15, step = pill + (L.small ? 4 : 6);
    const labelW = L.small ? 104 : 142;
    const pw = Math.min(Math.max(L.bw, 200), labelW + P * step + 24);
    const ph = L.header - 12;
    return { x: (W - pw) / 2, y: L.y0 - L.header + 2, w: pw, h: ph, pill, step, labelW };
  }
  function drawHeaderPlate(c, g) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; K.rr(c, g.x + 2, g.y + 3, g.w, g.h, g.h / 2);
    c.fillStyle = '#172733'; K.rr(c, g.x, g.y, g.w, g.h, g.h / 2);
    c.strokeStyle = '#2b4353'; c.lineWidth = 2; K.rrPath(c, g.x + 1, g.y + 1, g.w - 2, g.h - 2, g.h / 2 - 1); c.stroke();
  }
  function drawHeaderLive(c, g, found, P, cols, flash) {
    const cy = g.y + g.h / 2;
    const fs = Math.round(g.h * 0.46);
    K.text(c, 'PAIRS', g.x + 16, cy + 1, { size: Math.round(fs * 0.8), body: true, color: C.muted, align: 'left', shadow: false });
    K.text(c, found + '/' + P, g.x + 16 + fs * 3.2, cy + 1, { size: fs, color: found === P ? C.good : C.ink, align: 'left', shadow: false });
    const x0 = g.x + g.labelW + 8;
    for (let i = 0; i < P; i++) {
      const x = x0 + i * g.step, on = i < found;
      c.fillStyle = on ? cols[i] : '#26394a';
      K.rr(c, x, cy - g.pill / 2, g.pill, g.pill, g.pill * 0.3);
      if (on) {
        c.fillStyle = 'rgba(255,255,255,0.35)'; K.rr(c, x + 2, cy - g.pill / 2 + 2, g.pill - 4, g.pill * 0.22, 2);
        if (i === found - 1 && flash > 0) { K.ring(c, x + g.pill / 2, cy, g.pill * (0.7 + (1 - flash) * 0.8), 2, K.alpha(cols[i], flash)); }
      }
    }
  }

  Arcade.register({
    id: 'bot-match',
    title: 'Bee Bot Match',
    cat: 'brain',
    blurb: 'Match pairs of robot bee helpers hiding behind bee cards.',
    rules: [
      'Flip two panels. If the robots match, they stay face up.',
      'No match? They flip back, so remember where each robot was.',
      'Fewer moves and a faster time earn more points.'
    ],
    how: 'Tap or click a panel · arrow keys + Space or Enter',
    accent: '#ff6fa8',
    usesPlayer: false,
    modes: [
      { id: 'easy', label: 'Easy', note: '6 pairs' },
      { id: 'medium', label: 'Medium', note: '8 pairs' },
      { id: 'hard', label: 'Hard', note: '12 pairs' }
    ],

    thumb(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 2;
      for (let x = 40; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      const cw = 52, ch = 74, gap = 8, x0 = (w - (5 * cw + 4 * gap)) / 2, y0 = 36;
      const A = ROBOTS[8], B = ROBOTS[5], D = ROBOTS[1];
      const grid = [['b', A, 'b', B, 'b'], ['b', 'b', A, 'b', 'half']];
      // header plate
      ctx.fillStyle = '#172733'; K.rr(ctx, 90, 8, 140, 20, 10);
      K.text(ctx, 'PAIRS 1/6', 106, 18.5, { size: 10, body: true, color: C.muted, align: 'left', shadow: false });
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i === 0 ? A.body : '#26394a'; K.rr(ctx, 166 + i * 10, 14, 7, 9, 2); }
      for (let r = 0; r < 2; r++) {
        for (let q = 0; q < 5; q++) {
          const it = grid[r][q], x = x0 + q * (cw + gap), y = y0 + r * (ch + gap);
          ctx.save(); ctx.translate(x, y);
          if (it === 'b') drawBack(ctx, cw, ch);
          else if (it === 'half') {
            ctx.translate(cw / 2, -4); ctx.scale(0.42, 1.05); ctx.translate(-cw / 2, 0);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; K.rr(ctx, 6, 10, cw, ch, 6);
            drawFront(ctx, cw, ch, D);
            const f = botFit(cw, ch);
            K.drawBot(ctx, cw / 2, f.by, f.bh, Object.assign({}, D, { mood: 'wow', t: 0.4 }));
          } else {
            drawFront(ctx, cw, ch, it);
            const f = botFit(cw, ch), matched = it === A;
            K.drawBot(ctx, cw / 2, f.by - (matched && q === 1 ? 5 : 0), f.bh, Object.assign({}, it, { mood: matched ? 'happy' : 'wow', arms: matched ? 'up' : it.arms, t: 0.4 }));
            if (matched) {
              ctx.strokeStyle = K.alpha(it.body, 0.25); ctx.lineWidth = 8; K.rrPath(ctx, -2, -2, cw + 4, ch + 4, 8); ctx.stroke();
              ctx.strokeStyle = it.body; ctx.lineWidth = 2.5; K.rrPath(ctx, 1.5, 1.5, cw - 3, ch - 3, 5); ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
      // sparkles over the matched pair
      ctx.fillStyle = '#fff3a0';
      for (const [sx, sy, s] of [[x0 + cw + gap + 8, 40, 3], [x0 + 2 * (cw + gap) + cw - 6, 120, 2.5], [x0 + cw + gap + cw - 4, 100, 2], [x0 + 2 * (cw + gap) + 4, 188, 3]]) {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4); ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore();
      }
      K.vignette(ctx, w, h, 0.35);
    },

    start(api) {
      const mode = PAIRS[api.mode] ? api.mode : 'easy';
      const P = PAIRS[mode], N = P * 2, mult = MULT[mode];

      // Size the canvas to the stage so the board always fits without scrolling.
      const cs = getComputedStyle(api.stage);
      const sw = Math.max(240, api.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
      const sh = Math.max(240, api.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
      const down = Math.min(1, 1280 / sw, 820 / sh);
      const W = Math.round(sw * down), H = Math.round(sh * down);
      const L = chooseLayout(W, H, N);
      const cw = L.cw, ch = L.ch, rad = Math.max(5, Math.min(cw, ch) * 0.09);
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const k = Math.min(3, Math.max(1.5, cv.k || 2));
      const hg = headerGeom(W, L, P);
      const bg = K.layer(W, H, c => { drawBackdrop(c, W, H, L); drawHeaderPlate(c, hg); }, Math.min(2, k));
      const backImg = K.layer(cw, ch, drawBack, k);
      const fit = botFit(cw, ch);

      // pick the robots for this game and shuffle the deck
      const chosen = K.shuffle(ROBOTS.slice()).slice(0, P);
      const faces = chosen.map(bot => K.layer(cw, ch, (c, w, h) => drawFront(c, w, h, bot), k));
      const deck = K.shuffle(chosen.map((b, i) => i).concat(chosen.map((b, i) => i)));
      const cards = deck.map((id, i) => {
        const col = i % L.cols, row = Math.floor(i / L.cols);
        return {
          i, id, bot: chosen[id],
          x: L.x0 + col * (cw + L.gap), y: L.y0 + row * (ch + L.gap),
          flip: 0, target: 0, up: false, matched: false, mood: 'wow',
          deal: -0.25 - i * 0.035, dealt: false, bounce: -1, hopAmp: 1, cheer: 0, shake: 0, glow: 0, hov: 0,
          phase: Math.random() * 3,
          opts: Object.assign({}, chosen[id])
        };
      });

      const fx = K.particles();
      // floating words with a dark outline so they read over any robot
      const says = [];
      const say = (text, x, y, color, size, life) => { says.push({ text, x, y, color, size, life, age: 0 }); };
      function drawSays() {
        if (!says.length) return;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        for (const f of says) {
          const pop = Math.min(1, f.age / 0.14), s = 0.6 + 0.4 * pop + Math.sin(pop * Math.PI) * 0.12;
          ctx.globalAlpha = Math.min(1, (f.life - f.age) * 3);
          ctx.font = K.font(Math.round(f.size * s));
          ctx.lineWidth = Math.max(3, f.size * 0.24); ctx.strokeStyle = 'rgba(8,14,20,0.9)';
          ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.restore();
      }
      const S = {
        t: 0, moves: 0, found: 0, streak: 0, score: 0,
        open: null, pending: null, startT: null, endT: null, lastSec: -1,
        focus: 0, kbd: false, hover: -1, done: false, party: -1,
        foundCols: [], flash: 0
      };
      api.stat('Moves', 0);
      api.stat('Time', '0:00');
      api.score(0);

      const centre = cd => ({ x: cd.x + cw / 2, y: cd.y + ch / 2 });
      function flipUp(cd) { cd.target = 1; cd.up = true; cd.mood = 'wow'; api.tone(620 + Math.random() * 80, 0.05, 'triangle', 0.05, 260); }
      function flipDown(cd) { cd.target = 0; cd.up = false; cd.mood = 'wow'; }

      function clearPending() {
        const p = S.pending;
        if (!p) return;
        p.cancelSad(); p.cancelBack();
        flipDown(p.a); flipDown(p.b);
        api.tone(400, 0.05, 'triangle', 0.035, -120);
        S.pending = null;
      }

      function tryFlip(i) {
        if (S.done || api.over) return;
        const cd = cards[i];
        if (!cd || !cd.dealt || cd.matched || cd.up) return;
        if (S.pending) {
          // a wrong pair is still showing: flip it back early, unless it only just landed
          if (S.t - S.pending.at < FLIP + 0.15) return;
          clearPending();
        }
        if (S.startT == null) S.startT = S.t;
        flipUp(cd);
        if (!S.open) { S.open = cd; return; }
        const a = S.open, b = cd;
        S.open = null;
        S.moves++;
        api.stat('Moves', S.moves);
        if (a.id === b.id) {
          a.matched = b.matched = true;
          S.found++;
          S.streak++;
          const streak = S.streak, last = S.found === P;
          if (last) S.endT = S.t;
          api.after(FLIP * 1000 + 20, () => matched(a, b, streak, last));
        } else {
          S.streak = 0;
          const p = { a, b, at: S.t };
          p.cancelSad = api.after(FLIP * 1000 + 20, () => {
            a.mood = b.mood = 'sad'; a.shake = b.shake = 0.35;
            api.tone(230, 0.16, 'triangle', 0.055, -90);
          });
          p.cancelBack = api.after((FLIP + PEEK) * 1000, () => {
            if (S.pending !== p) return;
            flipDown(a); flipDown(b);
            api.tone(400, 0.05, 'triangle', 0.035, -120);
            S.pending = null;
          });
          S.pending = p;
        }
      }

      function matched(a, b, streak, last) {
        const pts = Math.round((100 + 20 * Math.min(4, streak - 1)) * mult);
        S.score += pts;
        api.score(S.score);
        S.foundCols.push(a.bot.glow || a.bot.body);
        S.flash = 1;
        for (const cd of [a, b]) {
          cd.mood = 'happy'; cd.bounce = 0; cd.hopAmp = 1; cd.glow = 0.01;
          const p = centre(cd);
          fx.burst(p.x, p.y, [cd.bot.body, '#ffffff', C.safety], 16, 230, { gravity: 360, size: 3.4, life: 0.8 });
        }
        const pa = centre(a), pb = centre(b);
        const fs = L.small ? 15 : 20;
        say(a.bot.name + '!', pa.x, a.y + ch * 0.14, K.shade(a.bot.glow || a.bot.body, 0.3), fs, 1.1);
        say('+' + pts, pb.x, b.y + ch * 0.14, C.safety, fs, 1.1);
        if (streak >= 2) say('COMBO x' + streak, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2, C.glow, fs + 4, 1.3);
        api.sfx('coin');
        api.tone(660 + Math.min(streak, 6) * 90, 0.09, 'square', 0.04, 0, 0.12);
        // the robots already found give a little hop too
        for (const cd of cards) if (cd.matched && cd !== a && cd !== b && cd.glow > 0 && cd.bounce < 0) { cd.bounce = 0; cd.hopAmp = 0.35; }
        if (last) finish();
      }

      function finish() {
        S.done = true;
        const secs = Math.max(1, Math.floor(S.endT - S.startT));
        const memory = Math.max(0, 3 * P - S.moves) * 60;   // fewer moves matter most
        const speed = Math.max(0, P * 8 - secs) * 8;
        const bonus = Math.round((memory + speed) * mult);
        S.party = 0;
        for (const cd of cards) { cd.cheer = 1; cd.mood = 'happy'; }
        api.after(450, () => {
          const bs = L.small ? 19 : 28;
          if (memory) say('MEMORY BONUS +' + Math.round(memory * mult), W / 2, H * 0.44, C.good, bs, 1.7);
          if (speed) say('SPEED BONUS +' + Math.round(speed * mult), W / 2, H * 0.44 + bs * 1.5, C.glow, bs, 1.7);
          if (bonus) api.sfx('levelup');
          S.score += bonus;
          api.score(S.score);
        });
        api.after(900, () => {
          const ratio = S.moves / P;
          const title = S.moves === P ? 'Flawless!' : ratio <= 1.6 ? 'Memory master!' : ratio <= 2.2 ? 'Sharp memory!' : 'All matched!';
          api.win({
            score: S.score,
            title,
            detail: 'Matched ' + P + ' pairs in ' + S.moves + ' moves and ' + secsText(secs) + '.',
            delay: 1500
          });
        });
      }

      // ---------- input ----------
      function cardAt(p) {
        const pad = L.gap / 2;
        for (let i = 0; i < N; i++) {
          const cd = cards[i];
          if (p.x >= cd.x - pad && p.x <= cd.x + cw + pad && p.y >= cd.y - pad && p.y <= cd.y + ch + pad) return i;
        }
        return -1;
      }
      api.on(cv.el, 'pointerdown', e => {
        const i = cardAt(cv.toLocal(e));
        if (i < 0) return;
        S.kbd = false; S.focus = i;
        tryFlip(i);
      });
      api.on(cv.el, 'pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const i = cardAt(cv.toLocal(e));
        S.hover = i;
        const cd = cards[i];
        cv.el.style.cursor = cd && !cd.up && !cd.matched && !S.done ? 'pointer' : 'default';
      });
      api.on(cv.el, 'pointerleave', () => { S.hover = -1; });
      api.onKey((name, e) => {
        if (S.done) return;
        const code = e.code || '';
        if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
          if (!S.kbd) { S.kbd = true; return; }       // first press just shows the highlight
          const row = Math.floor(S.focus / L.cols);
          if (name === 'left') S.focus = (S.focus - 1 + N) % N;
          else if (name === 'right') S.focus = (S.focus + 1) % N;
          else if (name === 'up' && row > 0) S.focus -= L.cols;
          else if (name === 'down' && row < L.rows - 1) S.focus += L.cols;
          else return;
          api.tone(900, 0.02, 'square', 0.02);
        } else if (name === 'fire' || code === 'Enter' || code === 'NumpadEnter') {
          if (e.repeat) return;
          if (e.preventDefault) e.preventDefault();
          S.kbd = true;
          tryFlip(S.focus);
        }
      });

      // ---------- update + draw ----------
      function update(dt) {
        S.flash = Math.max(0, S.flash - dt * 1.5);
        for (let i = 0; i < N; i++) {
          const cd = cards[i];
          if (cd.deal < 1) {
            const before = cd.deal;
            cd.deal += dt * 3;
            if (before < 0 && cd.deal >= 0 && i % 3 === 0) api.tone(500 + i * 18, 0.03, 'square', 0.02);
            if (cd.deal > 0.6) cd.dealt = true;
          }
          if (cd.flip !== cd.target) {
            const step = dt / FLIP;
            cd.flip = cd.target > cd.flip ? Math.min(cd.target, cd.flip + step) : Math.max(cd.target, cd.flip - step);
          }
          if (cd.bounce >= 0) { cd.bounce += dt / 0.9; if (cd.bounce >= 1) cd.bounce = -1; }
          if (cd.shake > 0) cd.shake = Math.max(0, cd.shake - dt);
          if (cd.glow > 0 && cd.glow < 1) cd.glow = Math.min(1, cd.glow + dt * 3);
          const hv = i === S.hover && !cd.up && !cd.matched && !S.done ? 1 : 0;
          cd.hov += (hv - cd.hov) * Math.min(1, dt * 14);
        }
        if (S.party >= 0) {
          S.party += dt;
          if (S.party < 1.4 && Math.random() < dt * 9) {
            fx.burst(K.rand(W * 0.15, W * 0.85), K.rand(H * 0.15, H * 0.6), K.PLATING, 18, 260, { gravity: 420, size: 4, life: 1 });
          }
        }
        if (S.startT != null) {
          const el = (S.endT != null ? S.endT : S.t) - S.startT;
          const sec = Math.floor(el);
          if (sec !== S.lastSec) { S.lastSec = sec; api.stat('Time', mmss(sec)); }
        }
      }

      function drawCard(cd) {
        if (cd.deal <= 0) return;
        const d = backOut(cd.deal);
        const ang = cd.flip * Math.PI, sx = Math.abs(Math.cos(ang)), lift = Math.sin(ang);
        let pulse = 0, hop = 0;
        if (cd.bounce >= 0) {
          pulse = Math.sin(cd.bounce * Math.PI) * (1 - cd.bounce) * cd.hopAmp;
          hop = Math.abs(Math.sin(cd.bounce * Math.PI * 3)) * (1 - cd.bounce) * ch * 0.1 * cd.hopAmp;
        }
        if (S.party >= 0 && cd.matched) {
          const w = S.party * 5 - (cd.x / W) * 2.2;
          if (w > 0 && w < Math.PI * 4) hop += Math.abs(Math.sin(w)) * ch * 0.08;
        }
        const shx = cd.shake > 0 ? Math.sin(cd.shake * 70) * 5 * (cd.shake / 0.35) : 0;
        const cx = cd.x + cw / 2 + shx, cy = cd.y + ch / 2 - lift * 7 - cd.hov * 3;
        const sc = d * (1 + lift * 0.07 + pulse * 0.07);
        ctx.save();
        ctx.translate(cx, cy);
        const raised = Math.max(lift, cd.hov);
        if (raised > 0.02) {
          ctx.fillStyle = 'rgba(0,0,0,' + (0.28 * raised).toFixed(3) + ')';
          K.rr(ctx, -cw / 2 * sx * sc + 3, -ch / 2 * sc + 3 + raised * 8, cw * sx * sc, ch * sc, rad);
        }
        ctx.scale(Math.max(0.02, sx) * sc, sc);
        if (cd.flip < 0.5) {
          ctx.drawImage(backImg, -cw / 2, -ch / 2, cw, ch);
          if (cd.hov > 0.01) { ctx.fillStyle = 'rgba(255,255,255,' + (0.08 * cd.hov).toFixed(3) + ')'; K.rr(ctx, -cw / 2, -ch / 2, cw, ch, rad); }
        } else {
          ctx.drawImage(faces[cd.id], -cw / 2, -ch / 2, cw, ch);
          const o = cd.opts;
          o.t = S.t + cd.phase;
          o.mood = cd.mood;
          o.arms = (cd.bounce >= 0 && cd.hopAmp > 0.5) || cd.cheer ? 'up' : cd.bot.arms;
          o.shadow = true;
          K.drawBot(ctx, 0, fit.by - ch / 2 - hop, fit.bh, o);
          if (cd.matched && cd.glow > 0) {
            const a = cd.glow * (0.75 + 0.25 * Math.sin(S.t * 3 + cd.phase));
            ctx.strokeStyle = K.alpha(cd.bot.glow || cd.bot.body, 0.22 * a); ctx.lineWidth = 9;
            K.rrPath(ctx, -cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4, rad + 2); ctx.stroke();
            ctx.strokeStyle = K.alpha(cd.bot.glow || cd.bot.body, 0.95 * a); ctx.lineWidth = 3;
            K.rrPath(ctx, -cw / 2 + 1.5, -ch / 2 + 1.5, cw - 3, ch - 3, Math.max(1, rad - 1)); ctx.stroke();
          }
        }
        ctx.restore();
      }

      function drawFocus() {
        const cd = cards[S.focus];
        const a = 0.65 + 0.35 * Math.sin(S.t * 7);
        ctx.save();
        const o = L.small ? 2 : 5;
        ctx.strokeStyle = K.alpha(C.glow, a); ctx.lineWidth = L.small ? 3 : 3.5;
        K.rrPath(ctx, cd.x - o, cd.y - o - cd.hov * 3, cw + o * 2, ch + o * 2, rad + o - 1); ctx.stroke();
        ctx.fillStyle = K.alpha(C.glow, a);
        const ax = cd.x + cw / 2, ay = cd.y - o - 4;
        ctx.beginPath(); ctx.moveTo(ax - 7, ay - 7); ctx.lineTo(ax + 7, ay - 7); ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      function render() {
        ctx.drawImage(bg, 0, 0, W, H);
        drawHeaderLive(ctx, hg, S.found, P, S.foundCols, S.flash);
        // lifted cards draw last so they sit on top of their neighbours
        for (let i = 0; i < N; i++) { const cd = cards[i]; if (cd.flip === 0 || cd.flip === 1) drawCard(cd); }
        for (let i = 0; i < N; i++) { const cd = cards[i]; if (cd.flip > 0 && cd.flip < 1) drawCard(cd); }
        if (S.kbd && !S.done) drawFocus();
        fx.draw(ctx);
        drawSays();
      }

      api.loop(dt => {
        S.t += dt;
        update(dt);
        fx.update(dt);
        for (let i = says.length - 1; i >= 0; i--) { const f = says[i]; f.age += dt; f.y -= 34 * dt; if (f.age >= f.life) says.splice(i, 1); }
        render();
      });
    }
  });
})();
