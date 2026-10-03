/* Bot Invaders: rows of robot invaders march across the factory wall and step down, faster as
 * their numbers drop. Zap them from your own treaded bot, duck behind scrap barriers that wear
 * away, and snipe the mothership drone for a bonus. Each cleared wave starts lower and faster. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 640, H = 720;
  const FLOOR = 686;                   // top of the floor strip
  const PH = 72;                       // player bot height
  const PY = FLOOR - 37;               // player bot centre
  const LAND = PY - 30;                // an invader touching this line has landed
  const HAND_DX = 40.9 * PH / 110;     // where drawBot puts the raised claws (arms: 'up')
  const HAND_DY = -19.5 * PH / 110;
  const COLS = 9, ROWS = 5, TOTAL = COLS * ROWS, SPX = 52, SPY = 44;
  const MARGIN = 14, STEP = 10, DROP = 18;
  const HIT_W = 18, HIT_H = 15;        // invader hit box (half sizes)
  const SPR_W = 50, SPR_H = 46;        // invader sprite box
  const MS_W = 84, MS_H = 44, MS_Y = 56;
  const BW = 88, BH = 52, CELL = 4, BCOLS = BW / CELL, BROWS = BH / CELL;
  const BAR_Y = 534, BAR_X = [136, 320, 504], BAR_SEED = [12345, 67890, 24680];
  const SHOT_SPEED = 660;
  const MARCH = [98, 92, 87, 82];
  const EYE = '#ffe066';

  // one design per row, top row first
  const KINDS = [
    { pts: 50, color: '#ff6fa8', draw: drawSquid },
    { pts: 40, color: '#c3a6ff', draw: drawCrab },
    { pts: 30, color: '#5ad1e6', draw: drawCyclops },
    { pts: 20, color: '#9fdc6b', draw: drawWalker },
    { pts: 10, color: '#f5c518', draw: drawDrone }
  ];

  // ---------- invader art (drawn around 0,0; f is the animation frame 0/1) ----------
  function drawSquid(c, f, col) {
    const dark = K.shade(col, -0.35);
    c.lineCap = 'round';
    c.strokeStyle = C.steel; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -16); c.stroke();
    c.fillStyle = f ? '#ffb3b3' : '#ff4d4d'; K.circle(c, 0, -17.5, 2.6);
    c.strokeStyle = dark; c.lineWidth = 3.2;
    c.beginPath();
    if (f) { c.moveTo(-9, 5); c.lineTo(-15, 14); c.moveTo(0, 6); c.lineTo(0, 15); c.moveTo(9, 5); c.lineTo(15, 14); }
    else { c.moveTo(-9, 5); c.lineTo(-6, 15); c.moveTo(0, 6); c.lineTo(-3, 14); c.moveTo(9, 5); c.lineTo(6, 15); }
    c.stroke();
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, -1, 13, Math.PI, 0);
    c.lineTo(15, 4); c.quadraticCurveTo(15, 7, 12, 7);
    c.lineTo(-12, 7); c.quadraticCurveTo(-15, 7, -15, 4);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-14, 3, 28, 4);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath(); c.ellipse(-5, -9, 4.5, 2.2, -0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.dark; K.rr(c, -9.5, -6.5, 19, 7.5, 3.7);
    c.fillStyle = EYE; K.circle(c, -4, -2.8, 2.1); K.circle(c, 4, -2.8, 2.1);
  }

  function drawCrab(c, f, col) {
    const dark = K.shade(col, -0.35);
    c.lineCap = 'round';
    const s = f ? 2 : -2;
    c.strokeStyle = dark; c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(-8, 7); c.lineTo(-11 - s, 13); c.moveTo(-3, 8); c.lineTo(-4 + s, 14);
    c.moveTo(3, 8); c.lineTo(4 - s, 14); c.moveTo(8, 7); c.lineTo(11 + s, 13);
    c.stroke();
    const ay = f ? -6 : 5;
    c.strokeStyle = C.steel; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-11, 1); c.lineTo(-16, ay); c.moveTo(11, 1); c.lineTo(16, ay); c.stroke();
    c.strokeStyle = col; c.lineWidth = 3.4;
    const open = f ? -Math.PI / 2 : Math.PI / 2;
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.arc(sx * 17, ay + (f ? -3.5 : 3.5), 4.3, open + 0.75, open - 0.75 + Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = C.steel; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-5, -5); c.lineTo(-7, -11); c.moveTo(5, -5); c.lineTo(7, -11); c.stroke();
    c.fillStyle = EYE; K.circle(c, -7, -12, 3); K.circle(c, 7, -12, 3);
    c.fillStyle = C.dark; K.circle(c, f ? -7.8 : -6.2, -12, 1.4); K.circle(c, f ? 6.2 : 7.8, -12, 1.4);
    c.fillStyle = col; K.rr(c, -12, -6, 24, 14, 6);
    c.fillStyle = 'rgba(255,255,255,0.28)'; K.rr(c, -9, -4.5, 18, 2.5, 1.2);
    c.fillStyle = 'rgba(0,0,0,0.2)'; K.rr(c, -12, 3, 24, 5, [0, 0, 6, 6]);
    c.fillStyle = C.dark; K.rr(c, -6, -1, 12, 4.5, 2);
    c.fillStyle = dark; c.fillRect(-2.8, -1, 1.3, 4.5); c.fillRect(1.5, -1, 1.3, 4.5);
  }

  function drawCyclops(c, f, col) {
    const dark = K.shade(col, -0.4);
    c.fillStyle = '#ffb03a';
    c.beginPath(); c.moveTo(-4, 11); c.lineTo(0, 11 + (f ? 8 : 5)); c.lineTo(4, 11); c.closePath(); c.fill();
    c.fillStyle = '#fff3a0';
    c.beginPath(); c.moveTo(-2, 11); c.lineTo(0, 11 + (f ? 5 : 3)); c.lineTo(2, 11); c.closePath(); c.fill();
    c.fillStyle = C.steelDark; K.rr(c, -5, 8, 10, 4, 1.5);
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(-9, -5); c.lineTo(-18, f ? -11 : -7); c.lineTo(-17, 5); c.lineTo(-9, 5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(9, -5); c.lineTo(18, f ? -11 : -7); c.lineTo(17, 5); c.lineTo(9, 5); c.closePath(); c.fill();
    c.fillStyle = col; K.circle(c, 0, -1, 12.5);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath(); c.arc(0, -1, 12.5, 0.12 * Math.PI, 0.88 * Math.PI); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.32)';
    c.beginPath(); c.ellipse(-5, -8.5, 3.6, 2, -0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.dark; K.circle(c, 0, -1, 7.8);
    c.fillStyle = EYE; K.circle(c, 0, -1, 6);
    c.fillStyle = '#ff4d4d'; K.circle(c, f ? -1.6 : 1.6, -1, 3.3);
    c.fillStyle = C.dark; K.circle(c, f ? -1.6 : 1.6, -1, 1.6);
    c.fillStyle = 'rgba(255,255,255,0.85)'; K.circle(c, -2.6, -3.6, 1.2);
  }

  function drawWalker(c, f, col) {
    const dark = K.shade(col, -0.4);
    const l = f ? 0 : 3, r = f ? 3 : 0;
    c.fillStyle = C.steel;
    K.rr(c, -9, 5, 5, 9 - l, 2); K.rr(c, 4, 5, 5, 9 - r, 2);
    c.fillStyle = dark; K.rr(c, -11, 12 - l, 8, 3.5, 1.5); K.rr(c, 3, 12 - r, 8, 3.5, 1.5);
    c.strokeStyle = C.steel; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-12, -2); c.lineTo(-16, f ? -8 : 3); c.moveTo(12, -2); c.lineTo(16, f ? 3 : -8); c.stroke();
    c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -16); c.stroke();
    c.fillStyle = f ? '#fff3a0' : C.safety; K.circle(c, 0, -17, 2.5);
    c.fillStyle = col; K.rr(c, -12, -12, 24, 19, 5);
    c.fillStyle = 'rgba(255,255,255,0.28)'; K.rr(c, -9, -10.5, 18, 2.4, 1.2);
    c.fillStyle = 'rgba(0,0,0,0.2)'; K.rr(c, -12, 2, 24, 5, [0, 0, 5, 5]);
    c.fillStyle = C.dark; K.rr(c, -9, -7, 18, 8, 3);
    c.fillStyle = EYE; K.rr(c, -6.5, -5, 4.5, 4, 1); K.rr(c, 2, -5, 4.5, 4, 1);
    c.fillStyle = C.dark;
    c.beginPath(); c.moveTo(-7, -7.2); c.lineTo(-1.5, -7.2); c.lineTo(-1.5, -5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(7, -7.2); c.lineTo(1.5, -7.2); c.lineTo(1.5, -5); c.closePath(); c.fill();
  }

  function drawDrone(c, f, col) {
    c.fillStyle = C.steel; c.fillRect(-1.5, -12, 3, 6);
    c.fillStyle = 'rgba(205,218,226,0.9)';
    c.beginPath(); c.ellipse(0, -13, f ? 17 : 7, f ? 2.2 : 2.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.steelDark; K.circle(c, 0, -13, 2.4);
    c.strokeStyle = C.steel; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-7, 6); c.lineTo(-9, 11); c.moveTo(7, 6); c.lineTo(9, 11);
    c.moveTo(-13, 11); c.lineTo(-5, 11); c.moveTo(5, 11); c.lineTo(13, 11);
    c.stroke();
    c.fillStyle = col; K.rr(c, -13, -7, 26, 14, 7);
    c.fillStyle = 'rgba(255,255,255,0.3)'; K.rr(c, -9, -5.5, 18, 2.4, 1.2);
    c.fillStyle = 'rgba(0,0,0,0.2)'; K.rr(c, -13, 2, 26, 5, [0, 0, 7, 7]);
    c.fillStyle = C.dark; K.rr(c, -8, -3.5, 16, 6, 3);
    c.fillStyle = 'rgba(255,77,77,0.35)'; K.circle(c, f ? -3 : 3, -0.5, 4);
    c.fillStyle = '#ff4d4d'; K.circle(c, f ? -3 : 3, -0.5, 2.3);
  }

  function drawMother(c, f) {
    c.fillStyle = K.alpha('#ff6fa8', f ? 0.2 : 0.12);
    c.beginPath(); c.moveTo(-12, 10); c.lineTo(12, 10); c.lineTo(22, 21); c.lineTo(-22, 21); c.closePath(); c.fill();
    c.fillStyle = K.alpha(C.glow, 0.28);
    c.beginPath(); c.ellipse(0, -1, 18, 16, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#39505e'; K.rr(c, -9, -13, 18, 13, 5);
    c.fillStyle = C.dark; K.rr(c, -7, -10, 14, 6, 3);
    c.fillStyle = '#ff4d4d'; K.circle(c, -3.2, -7, 1.9); K.circle(c, 3.2, -7, 1.9);
    c.strokeStyle = K.alpha(C.eye, 0.75); c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, -1, 18, 16, 0, Math.PI, 0); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath(); c.ellipse(-9, -10, 4, 1.8, -0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff5a5a';
    c.beginPath(); c.ellipse(0, 4, 38, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = K.shade('#ff5a5a', -0.38);
    c.beginPath(); c.ellipse(0, 6, 35, 7.5, 0, 0, Math.PI); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-28, -2, 56, 2);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = (i + f) % 2 ? '#fff3a0' : '#9c7a12';
      K.circle(c, -28 + i * 8, 5, 2.2);
    }
    c.fillStyle = C.steelDark; K.rr(c, -24, 11, 10, 4, 2); K.rr(c, 14, 11, 10, 4, 2);
  }

  // the player's arm cannon, barrel pointing up from the claw at x,y
  function drawCannon(c, x, y, kick, col) {
    const o = kick * 4;
    c.fillStyle = C.steelDark; K.rr(c, x - 4, y - 15 + o, 8, 17, 3);
    c.fillStyle = C.steel; K.rr(c, x - 3, y - 19 + o, 6, 6, 2);
    c.fillStyle = col; K.rr(c, x - 5, y - 5 + o, 10, 5, 2);
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - 2.5, y - 13 + o, 1.5, 9);
    if (kick > 0.3) { c.fillStyle = K.alpha('#fff3a0', kick); K.circle(c, x, y - 22 + o, 3 + kick * 4); }
  }

  // ---------- scrap barriers ----------
  function scrapShape(i, j) {
    const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2, r = 14;
    if (y < r && x < r && Math.hypot(r - x, r - y) > r) return false;
    if (y < r && x > BW - r && Math.hypot(x - (BW - r), r - y) > r) return false;
    const nx = (x - BW / 2) / 21, ny = (y - BH) / 19;
    return nx * nx + ny * ny >= 1;
  }
  function drawScrap(c, seed) {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    c.fillStyle = '#26363f'; c.fillRect(0, 0, BW, BH);
    const tones = ['#6f8796', '#8b9aa6', '#5b7482', '#7a8f9c'];
    for (let y = 15; y < BH;) {
      const h = 9 + Math.floor(rnd() * 3);
      for (let x = -Math.floor(rnd() * 12); x < BW;) {
        const w = 14 + Math.floor(rnd() * 16);
        c.fillStyle = rnd() < 0.12 ? '#8a5a44' : tones[Math.floor(rnd() * tones.length)];
        K.rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 1.5);
        c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + 1.5, y + 1, w - 3, 1.2);
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 1.5, y + h - 2, w - 3, 1.2);
        c.fillStyle = 'rgba(0,0,0,0.45)'; K.circle(c, x + 3.5, y + h / 2, 1); K.circle(c, x + w - 3.5, y + h / 2, 1);
        x += w;
      }
      y += h;
    }
    c.fillStyle = '#39505e'; c.fillRect(0, 0, BW, 15);
    K.hazard(c, 0, 3, BW, 9, { stripe: 7 });
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(0, 0, BW, 2);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 13, BW, 2);
    K.gear(c, 14 + rnd() * 60, 29 + rnd() * 6, 6.5, { color: '#c9a54a', hole: '#26363f', rot: rnd() * 3 });
    const g = c.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g; c.fillRect(0, 15, BW, BH - 15);
  }
  function makeBarrier(cx, seed) {
    const cv = K.layer(BW, BH, c => drawScrap(c, seed), 2);
    const g = cv.getContext('2d');
    const cells = new Uint8Array(BCOLS * BROWS);
    for (let j = 0; j < BROWS; j++) {
      for (let i = 0; i < BCOLS; i++) {
        if (scrapShape(i, j)) cells[j * BCOLS + i] = 1;
        else g.clearRect(i * CELL, j * CELL, CELL, CELL);
      }
    }
    return { x: Math.round(cx - BW / 2), y: BAR_Y, cv, g, cells };
  }

  // ---------- cached art ----------
  let ART = null;
  function art() {
    if (ART) return ART;
    ART = {
      inv: KINDS.map(k => [0, 1].map(f => K.layer(SPR_W, SPR_H, c => { c.translate(SPR_W / 2, SPR_H / 2); k.draw(c, f, k.color); }, 3))),
      ms: [0, 1].map(f => K.layer(MS_W, MS_H, c => { c.translate(MS_W / 2, MS_H / 2); drawMother(c, f); }, 3)),
      bg: K.layer(W, H, drawBackground, 2),
      vignette: K.layer(W, H, c => K.vignette(c, W, H, 0.38), 1)
    };
    return ART;
  }
  function drawBackground(c) {
    K.bgFactory(c, W, H, { floor: FLOOR });
    const g = c.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, 'rgba(6,12,17,0.8)'); g.addColorStop(1, 'rgba(6,12,17,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, 120);
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, 18);
    c.fillStyle = '#26404f'; c.fillRect(0, 18, W, 4);
    for (let x = 40; x < W; x += 80) {
      c.fillStyle = 'rgba(255,107,61,0.22)'; K.circle(c, x, 9, 6);
      c.fillStyle = '#ff6b3d'; K.circle(c, x, 9, 2.5);
    }
    for (const x of [2, W - 14]) {
      c.fillStyle = '#1a2d39'; c.fillRect(x, 22, 12, FLOOR - 22);
      c.fillStyle = '#2e4a5b'; c.fillRect(x + 3, 22, 3, FLOOR - 22);
      for (let y = 90; y < FLOOR; y += 140) { c.fillStyle = '#39505e'; c.fillRect(x - 2, y, 16, 8); }
    }
  }

  Arcade.register({
    id: 'bot-invaders',
    title: 'Bot Invaders',
    cat: 'action',
    blurb: 'Blast the robot invaders before they reach your bay.',
    rules: [
      'Zap the marching robots. Higher rows are worth more points.',
      'Hide behind the scrap barriers. Every hit wears them away.',
      'Shoot the mothership drone when it flies over for a bonus.',
      'You have 3 lives. If the robots reach your line, it is game over.'
    ],
    how: '← → or A / D · Space to fire · drag to move and fire',
    accent: '#c3a6ff',
    usesPlayer: true,
    touch: ['left', 'right', 'fire'],

    thumb(ctx, w, h, kit, player) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0d1720'); g.addColorStop(1, '#1c2f3c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 2;
      for (let x = 20; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 30; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.save(); ctx.translate(262, 18); ctx.scale(0.62, 0.62); drawMother(ctx, 0); ctx.restore();
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 7; c++) {
          if ((r === 3 && c === 2) || (r === 2 && c === 5)) continue;
          ctx.save(); ctx.translate(64 + c * 32, 42 + r * 24); ctx.scale(0.62, 0.62);
          KINDS[r].draw(ctx, (r + c) % 2, KINDS[r].color);
          ctx.restore();
        }
      }
      ctx.strokeStyle = KINDS[3].color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2;
        ctx.moveTo(128 + Math.cos(a) * 5, 114 + Math.sin(a) * 5); ctx.lineTo(128 + Math.cos(a) * 10, 114 + Math.sin(a) * 10);
      }
      ctx.stroke();
      for (const bx of [56, 264]) {
        ctx.save(); ctx.translate(bx - 22, 138); ctx.scale(0.5, 0.5);
        ctx.beginPath(); kit.rrPath(ctx, 0, 0, BW, BH, [14, 14, 0, 0]); ctx.clip();
        drawScrap(ctx, bx * 97 + 11);
        ctx.fillStyle = '#16262f'; ctx.beginPath(); ctx.ellipse(BW / 2, BH, 21, 19, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(90,209,230,0.4)'; kit.rr(ctx, 175, 96, 7, 20, 3.5);
      ctx.fillStyle = '#ffffff'; kit.rr(ctx, 177, 98, 3, 16, 1.5);
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(84, 138); ctx.lineTo(87, 142); ctx.lineTo(81, 146); ctx.lineTo(87, 150); ctx.lineTo(84, 154); ctx.stroke();
      ctx.fillStyle = '#0d171e'; ctx.fillRect(0, 190, w, 10);
      kit.hazard(ctx, 0, 192, w, 8, { stripe: 8 });
      const s = 54 / 110;
      kit.drawBot(ctx, 160, 164, 54, Object.assign({}, player, { base: 'treads', arms: 'up', mood: 'happy', t: 0.4, shadow: true }));
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(160 + side * 40.9 * s, 164 - 19.5 * s); ctx.scale(0.75, 0.75);
        drawCannon(ctx, 0, 0, 0, player.body);
        ctx.restore();
      }
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const A = art();
      const fx = K.particles(), sh = K.shaker();
      const me = Object.assign({}, api.player, { base: 'treads', arms: 'up', shadow: true, mood: 'happy', t: 0, walk: false, look: 0 });
      const shotGlow = K.alpha(me.body, 0.4);
      const colBottom = new Int8Array(COLS);

      const S = {
        t: 0, over: false, score: 0, lives: 3, wave: 1, kills: 0,
        px: W / 2, vx: 0, target: null, touching: false, fireQ: 0, cool: 0, hand: 1, kick: [0, 0],
        dead: 0, safe: 0, mood: 'happy', moodT: 0, flash: 0, hint: 4.5,
        invs: [], alive: 0, ox: 0, oy: 0, dir: 1, dropNext: false, frame: 0, stepT: 0, note: 0, entry: 0, bottom: 0,
        shots: [], eshots: [], pops: [], barriers: [],
        fireT: 0, ms: null, msT: 0, clearT: 0, bonus: 0
      };
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) S.invs.push({ row: r, col: c, alive: true });

      // ---------- input ----------
      // drag anywhere on the stage (the canvas or the space around it) to steer; fire while touching.
      // A see-through layer over the whole stage takes the touches, so the browser never pans.
      const pad = api.el('div', { style: { position: 'absolute', inset: '0', touchAction: 'none' } });
      api.stage.appendChild(pad);
      api.on(pad, 'pointerdown', e => {
        K.capture(pad, e);
        S.touching = true; S.target = cv.toLocal(e).x; S.fireQ = 0.25;
      });
      api.on(pad, 'pointermove', e => { if (S.touching) S.target = cv.toLocal(e).x; });
      const release = () => { S.touching = false; S.target = null; };
      api.on(pad, 'pointerup', release);
      api.on(pad, 'pointercancel', release);
      api.onKey((name, e) => { if (name === 'fire' && !e.repeat) S.fireQ = 0.2; });

      // ---------- formation ----------
      function entryOff(row) {
        const k = K.clamp((S.entry - (ROWS - 1 - row) * 0.09) / 0.64, 0, 1);
        return -(1 - (1 - Math.pow(1 - k, 3))) * 440;
      }
      const invX = v => S.ox + v.col * SPX;
      const invY = v => S.oy + v.row * SPY + (S.entry < 1 ? entryOff(v.row) : 0);

      function interval() {
        const f = S.alive / TOTAL;
        return Math.max(0.06, (0.065 + 0.55 * Math.pow(f, 1.3)) * Math.max(0.55, 1 - 0.075 * (S.wave - 1)));
      }

      function marchStep() {
        if (S.dropNext) { S.oy += DROP; S.dir = -S.dir; S.dropNext = false; }
        else S.ox += S.dir * STEP;
        S.frame ^= 1;
        api.tone(MARCH[S.note++ % 4], 0.1, 'square', 0.035);
        let minC = COLS, maxC = -1, maxR = -1;
        for (const v of S.invs) {
          if (!v.alive) continue;
          if (v.col < minC) minC = v.col;
          if (v.col > maxC) maxC = v.col;
          if (v.row > maxR) maxR = v.row;
        }
        if (maxC < 0) return;
        const left = S.ox + minC * SPX - HIT_W - 2, right = S.ox + maxC * SPX + HIT_W + 2;
        if ((S.dir > 0 && right + STEP > W - MARGIN) || (S.dir < 0 && left - STEP < MARGIN)) S.dropNext = true;
        S.bottom = S.oy + maxR * SPY + HIT_H;
        if (S.bottom >= BAR_Y - 4) scrapeBarriers();
        if (S.bottom >= LAND) invaded();
      }

      function enemyFire() {
        colBottom.fill(-1);
        for (const v of S.invs) if (v.alive && v.row > colBottom[v.col]) colBottom[v.col] = v.row;
        let col = -1;
        if (Math.random() < 0.4) {
          let best = 1e9;
          for (let c = 0; c < COLS; c++) {
            if (colBottom[c] < 0) continue;
            const d = Math.abs(S.ox + c * SPX - S.px);
            if (d < best) { best = d; col = c; }
          }
        } else {
          let n = 0;
          for (let c = 0; c < COLS; c++) if (colBottom[c] >= 0 && Math.random() < 1 / ++n) col = c;
        }
        if (col < 0) return;
        const plasma = Math.random() < 0.25 + 0.04 * S.wave;
        const speed = Math.min(380, (plasma ? 175 : 220) + 14 * (S.wave - 1));
        S.eshots.push({ x: S.ox + col * SPX, y: S.oy + colBottom[col] * SPY + 16, vy: speed, type: plasma ? 'plasma' : 'bolt', t: 0 });
        api.tone(plasma ? 260 : 330, 0.08, 'square', 0.02, -140);
      }

      function spawnMothership() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        S.ms = { x: dir > 0 ? -MS_W / 2 : W + MS_W / 2, dir, speed: 115 + 8 * S.wave, warble: 0, hi: false };
      }
      function updateMothership(dt) {
        const m = S.ms;
        m.x += m.dir * m.speed * dt;
        m.warble -= dt;
        if (m.warble <= 0) { m.warble = 0.16; m.hi = !m.hi; api.tone(m.hi ? 780 : 620, 0.13, 'sine', 0.03); }
        if (m.x < -MS_W || m.x > W + MS_W) { S.ms = null; S.msT = K.rand(16, 26); }
      }

      // ---------- barriers ----------
      function clearCell(b, i, j) {
        const k = j * BCOLS + i;
        if (!b.cells[k]) return;
        b.cells[k] = 0;
        b.g.clearRect(i * CELL, j * CELL, CELL, CELL);
      }
      function solidAt(b, x, y) {
        const i = Math.floor((x - b.x) / CELL), j = Math.floor((y - b.y) / CELL);
        return i >= 0 && j >= 0 && i < BCOLS && j < BROWS && b.cells[j * BCOLS + i] === 1;
      }
      function barrierAt(x, y) {
        if (y < BAR_Y || y >= BAR_Y + BH) return null;
        for (const b of S.barriers) if (x >= b.x && x < b.x + BW && solidAt(b, x, y)) return b;
        return null;
      }
      function blast(b, x, y) {
        const ci = Math.floor((x - b.x) / CELL), cj = Math.floor((y - b.y) / CELL);
        for (let dj = -3; dj <= 3; dj++) {
          for (let di = -2; di <= 2; di++) {
            const i = ci + di, j = cj + dj;
            if (i < 0 || j < 0 || i >= BCOLS || j >= BROWS) continue;
            const d = Math.hypot(di * 1.2, dj);
            if (d < 1.3 || Math.random() < 0.75 - d * 0.22) clearCell(b, i, j);
          }
        }
        fx.burst(x, y, ['#8b9aa6', '#6f8796', '#a4b2bc', '#7d6a55'], 6, 120, { life: 0.4, size: 2.5, gravity: 500 });
        api.tone(190, 0.05, 'square', 0.02, -60);
      }
      function scrapeBarriers() {
        for (const v of S.invs) {
          if (!v.alive) continue;
          const x = invX(v), y = invY(v);
          if (y + HIT_H < BAR_Y || y - HIT_H > BAR_Y + BH) continue;
          for (const b of S.barriers) {
            if (x + HIT_W < b.x || x - HIT_W > b.x + BW) continue;
            const i0 = Math.max(0, Math.floor((x - HIT_W - b.x) / CELL)), i1 = Math.min(BCOLS - 1, Math.floor((x + HIT_W - b.x) / CELL));
            const j0 = Math.max(0, Math.floor((y - HIT_H - b.y) / CELL)), j1 = Math.min(BROWS - 1, Math.floor((y + HIT_H - b.y) / CELL));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) clearCell(b, i, j);
          }
        }
      }

      // ---------- shots ----------
      function fire() {
        S.hand = -S.hand;
        S.shots.push({ x: S.px + S.hand * HAND_DX, y: PY + HAND_DY - 20 });
        S.kick[S.hand < 0 ? 0 : 1] = 1;
        S.cool = 0.2; S.fireQ = 0;
        api.tone(1180, 0.09, 'square', 0.03, -760);
      }
      function shotHits(s) {
        const tip = s.y - 9;
        if (S.ms && Math.abs(s.x - S.ms.x) < 36 && Math.abs(tip - MS_Y) < 16) { hitMothership(); return true; }
        for (const v of S.invs) {
          if (!v.alive) continue;
          const x = invX(v), y = invY(v);
          if (Math.abs(s.x - x) < HIT_W && Math.abs(tip - y) < HIT_H) { killInvader(v, x, y); return true; }
        }
        for (let j = 0; j < S.eshots.length; j++) {
          const e = S.eshots[j];
          if (Math.abs(e.x - s.x) < 8 && Math.abs(e.y - tip) < 12) {
            S.eshots.splice(j, 1);
            fx.burst(s.x, tip, ['#fff3a0', '#ffffff', C.glow], 8, 140, { life: 0.35, lift: 0 });
            api.tone(880, 0.05, 'square', 0.025, -300);
            return true;
          }
        }
        const b = barrierAt(s.x, tip);
        if (b) { blast(b, s.x, tip); return true; }
        return false;
      }
      function moveShots(dt) {
        const travel = SHOT_SPEED * dt, n = Math.max(1, Math.ceil(travel / 6));
        for (let i = S.shots.length - 1; i >= 0; i--) {
          const s = S.shots[i];
          let hit = false;
          for (let k = 0; k < n && !hit; k++) { s.y -= travel / n; hit = shotHits(s); }
          if (hit || s.y < -24) S.shots.splice(i, 1);
        }
      }
      function moveEnemyShots(dt) {
        for (let i = S.eshots.length - 1; i >= 0; i--) {
          const e = S.eshots[i];
          e.t += dt;
          const travel = e.vy * dt, n = Math.max(1, Math.ceil(travel / 4));
          let gone = false;
          for (let k = 0; k < n && !gone; k++) {
            e.y += travel / n;
            const tip = e.y + 8;
            const b = barrierAt(e.x, tip);
            if (b) { blast(b, e.x, tip); gone = true; }
            else if (S.dead <= 0 && S.safe <= 0 && Math.abs(e.x - S.px) < 19 && tip > PY - 26 && e.y < PY + 34) {
              playerHit();
              return;
            } else if (tip >= FLOOR + 2) {
              gone = true;
              fx.burst(e.x, FLOOR, e.type === 'plasma' ? ['#ff6fa8', '#ffd0e4'] : ['#f5c518', '#fff3a0'], 6, 110, { life: 0.35 });
            }
          }
          if (gone) S.eshots.splice(i, 1);
        }
      }

      // ---------- events ----------
      function killInvader(v, x, y) {
        v.alive = false; S.alive--; S.kills++;
        const kind = KINDS[v.row];
        S.score += kind.pts; api.score(S.score);
        fx.burst(x, y, [kind.color, kind.color, '#ffffff', C.steel], 14, 230, { life: 0.55, lift: 30, gravity: 380 });
        fx.float('+' + kind.pts, x, y - 4, kind.color, { size: 15, life: 0.7, speed: 60 });
        S.pops.push({ x, y, t: 0.2, color: kind.color });
        api.tone(560 - v.row * 50, 0.12, 'square', 0.04, -380);
        sh.add(0.05);
      }
      function hitMothership() {
        const m = S.ms;
        const pts = K.pick([50, 100, 100, 150, 150, 200, 300]);
        S.score += pts; api.score(S.score);
        fx.burst(m.x, MS_Y, ['#ff5a5a', '#f5c518', '#fff3a0', C.glow], 34, 320, { life: 0.8 });
        fx.float('+' + pts, m.x, MS_Y + 20, C.safety, { size: 24, life: 1.3, speed: 40 });
        sh.add(0.22);
        api.sfx('coin'); api.tone(1320, 0.18, 'square', 0.04, 400, 0.12);
        S.ms = null; S.msT = K.rand(16, 26);
        S.mood = 'wow'; S.moodT = 0.9;
      }
      function playerHit() {
        S.lives--; api.stat('Lives', S.lives);
        S.dead = 1.6; S.mood = 'sad'; S.moodT = 0;
        S.eshots.length = 0;
        fx.burst(S.px, PY - 8, [me.body, C.hazard, '#fff3a0', C.steel], 40, 380, { life: 0.9 });
        fx.burst(S.px, PY - 8, ['#39505e', '#1b2a35'], 14, 160, { life: 1.1, lift: 140, gravity: 200, size: 6 });
        sh.add(0.6); S.flash = 0.35;
        api.sfx('boom');
        if (S.lives <= 0) endGame(false);
      }
      function invaded() {
        if (S.over) return;
        S.lives = 0; api.stat('Lives', 0);
        S.dead = 1.6; S.mood = 'sad';
        fx.burst(S.px, PY - 8, [me.body, C.hazard, '#fff3a0'], 44, 420, { life: 1 });
        sh.add(0.7); S.flash = 0.45;
        api.sfx('boom');
        endGame(true);
      }
      function endGame(invasion) {
        if (S.over) return;
        S.over = true;
        const cleared = S.wave - 1;
        const zapped = S.kills + ' robot' + (S.kills === 1 ? '' : 's');
        const detail = cleared > 0
          ? 'You cleared ' + cleared + ' wave' + (cleared === 1 ? '' : 's') + ' and zapped ' + zapped + '.'
          : 'You zapped ' + zapped + ' on wave 1.';
        api.gameOver({ score: S.score, title: invasion ? 'Invaded!' : 'Bot down!', detail, delay: 1100 });
      }
      function waveCleared() {
        const bonus = 100 * S.wave;
        S.score += bonus; api.score(S.score);
        S.bonus = bonus; S.clearT = 2;
        S.eshots.length = 0;
        S.mood = 'happy'; S.moodT = 0;
        api.sfx('levelup');
      }
      function startWave(n) {
        S.wave = n; api.stat('Wave', n);
        for (const v of S.invs) v.alive = true;
        S.alive = TOTAL;
        S.ox = (W - (COLS - 1) * SPX) / 2;
        S.oy = 104 + Math.min(n - 1, 5) * 22;
        S.bottom = S.oy + (ROWS - 1) * SPY + HIT_H;
        S.dir = 1; S.dropNext = false; S.frame = 0; S.stepT = 0.4; S.entry = 0;
        S.fireT = 1.4; S.eshots.length = 0; S.shots.length = 0;
        S.barriers = BAR_X.map((x, i) => makeBarrier(x, BAR_SEED[i] + n * 7));
        S.msT = K.rand(10, 18);
        api.toast('WAVE ' + n);
        if (n > 1) api.sfx('power');
      }

      // ---------- update ----------
      function movePlayer(dt) {
        const dir = (api.keys.right ? 1 : 0) - (api.keys.left ? 1 : 0);
        if (S.touching && S.target != null && !dir) {
          const d = S.target - S.px;
          S.vx = Math.abs(d) < 2 ? 0 : Math.sign(d) * Math.min(440, Math.abs(d) * 12);
        } else S.vx = dir * 320;
        S.px = K.clamp(S.px + S.vx * dt, 34, W - 34);
        S.cool -= dt;
        if (S.fireQ > 0) S.fireQ -= dt;
        if ((api.keys.fire || S.touching || S.fireQ > 0) && S.cool <= 0 && S.shots.length < 2) fire();
      }

      function update(dt) {
        if (S.moodT > 0) { S.moodT -= dt; if (S.moodT <= 0) S.mood = 'happy'; }
        if (S.hint > 0) S.hint -= dt;
        if (S.dead > 0) {
          S.dead -= dt;
          if (S.dead <= 0) { S.safe = 2; S.mood = 'happy'; }
        } else movePlayer(dt);
        if (S.safe > 0) S.safe -= dt;

        if (S.entry < 1) S.entry = Math.min(1, S.entry + dt / 1.1);
        if (S.dead <= 0 && S.entry >= 1 && S.clearT <= 0) {
          S.stepT -= dt;
          if (S.stepT <= 0) { S.stepT = interval(); marchStep(); if (S.over) return; }
          S.fireT -= dt;
          if (S.fireT <= 0) {
            S.fireT = K.rand(0.5, 1.3) / (1 + 0.14 * (S.wave - 1));
            if (S.eshots.length < Math.min(1 + S.wave, 7)) enemyFire();
          }
          if (!S.ms) { S.msT -= dt; if (S.msT <= 0) spawnMothership(); }
        }
        if (S.ms && S.dead <= 0) updateMothership(dt);
        moveShots(dt);
        moveEnemyShots(dt);
        if (S.over) return;
        if (S.clearT > 0) { S.clearT -= dt; if (S.clearT <= 0) startWave(S.wave + 1); }
        else if (S.alive === 0) waveCleared();
      }

      // ---------- drawing ----------
      function drawPlayer(c) {
        if (S.dead > 0) {
          if (S.dead < 1.3 || Math.floor(S.t * 24) % 2) return;
        } else if (S.safe > 0 && Math.floor(S.t * 12) % 2 === 0) return;
        me.t = S.t; me.mood = S.mood; me.walk = Math.abs(S.vx) > 5; me.look = K.clamp(S.vx / 320, -1, 1);
        K.drawBot(c, S.px, PY, PH, me);
        drawCannon(c, S.px - HAND_DX, PY + HAND_DY, S.kick[0], me.body);
        drawCannon(c, S.px + HAND_DX, PY + HAND_DY, S.kick[1], me.body);
      }
      function drawShots(c) {
        for (const s of S.shots) {
          c.fillStyle = shotGlow; K.rr(c, s.x - 4, s.y - 13, 8, 26, 4);
          c.fillStyle = '#ffffff'; K.rr(c, s.x - 1.6, s.y - 10, 3.2, 20, 1.6);
        }
      }
      function drawEnemyShots(c) {
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (const e of S.eshots) {
          if (e.type === 'plasma') {
            const p = 1 + Math.sin(e.t * 20) * 0.15;
            c.fillStyle = 'rgba(255,111,168,0.28)'; K.circle(c, e.x, e.y, 9 * p);
            c.fillStyle = '#ff6fa8'; K.circle(c, e.x, e.y, 5.5);
            c.fillStyle = '#ffe3ef'; K.circle(c, e.x - 1, e.y - 1.5, 2.2);
          } else {
            const z = (Math.floor(e.t * 14) % 2 ? 1 : -1) * 3.6;
            for (let pass = 0; pass < 2; pass++) {
              c.strokeStyle = pass ? '#fff3a0' : 'rgba(245,197,24,0.35)';
              c.lineWidth = pass ? 2.2 : 6;
              c.beginPath();
              c.moveTo(e.x, e.y - 9); c.lineTo(e.x + z, e.y - 4.5); c.lineTo(e.x - z, e.y);
              c.lineTo(e.x + z, e.y + 4.5); c.lineTo(e.x, e.y + 9);
              c.stroke();
            }
          }
        }
      }
      function drawPops(c) {
        c.lineWidth = 2.5; c.lineCap = 'round';
        for (const p of S.pops) {
          const k = p.t / 0.2, r0 = 6 + (1 - k) * 8, r1 = r0 + 7;
          c.globalAlpha = k; c.strokeStyle = p.color;
          c.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
            c.moveTo(p.x + ca * r0, p.y + sa * r0); c.lineTo(p.x + ca * r1, p.y + sa * r1);
          }
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      function drawOverlay(c) {
        if (S.wave === 1 && S.entry < 1 && !S.over) {
          K.text(c, 'GET READY', W / 2, 400, { size: 38, color: C.safety });
        }
        if (S.hint > 0 && !S.over) {
          c.globalAlpha = K.clamp(S.hint, 0, 1);
          K.text(c, api.isTouch ? 'DRAG TO MOVE · HOLD TO FIRE' : '← → MOVE · SPACE TO FIRE', W / 2, 452, { size: 20, body: true, color: C.ink });
          c.globalAlpha = 1;
        }
        if (S.clearT > 0) {
          const a = K.clamp(S.clearT * 2, 0, 1);
          c.globalAlpha = a;
          K.text(c, 'WAVE ' + S.wave + ' CLEAR!', W / 2, 340, { size: 36, color: C.good });
          K.text(c, 'BONUS +' + S.bonus, W / 2, 386, { size: 24, body: true, color: C.safety });
          c.globalAlpha = 1;
        }
        if (!S.over && S.entry >= 1 && S.bottom > LAND - 100) {
          c.globalAlpha = 0.25 + 0.2 * Math.sin(S.t * 10);
          c.fillStyle = C.bad; c.fillRect(12, LAND - 2, W - 24, 4);
          c.globalAlpha = 1;
        }
      }
      function render() {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        sh.apply(ctx, 12);
        ctx.drawImage(A.bg, 0, 0, W, H);
        if (S.ms) ctx.drawImage(A.ms[Math.floor(S.t * 6) % 2], S.ms.x - MS_W / 2, MS_Y - MS_H / 2, MS_W, MS_H);
        for (const b of S.barriers) ctx.drawImage(b.cv, b.x, b.y, BW, BH);
        for (const v of S.invs) {
          if (!v.alive) continue;
          const y = invY(v);
          if (y < -SPR_H) continue;
          ctx.drawImage(A.inv[v.row][S.frame], invX(v) - SPR_W / 2, y - SPR_H / 2, SPR_W, SPR_H);
        }
        drawPops(ctx);
        drawEnemyShots(ctx);
        drawShots(ctx);
        drawPlayer(ctx);
        fx.draw(ctx);
        ctx.restore();
        drawOverlay(ctx);
        ctx.drawImage(A.vignette, 0, 0, W, H);
        if (S.flash > 0) {
          ctx.globalAlpha = S.flash * 1.2;
          ctx.fillStyle = 'rgba(255,90,60,0.45)'; ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }

      api.score(0);
      api.stat('Lives', S.lives);
      startWave(1);
      api.loop(dt => {
        S.t += dt;
        if (!S.over) update(dt);
        else if (S.dead > 0) S.dead = Math.max(0.001, S.dead - dt);
        S.kick[0] = Math.max(0, S.kick[0] - dt * 8); S.kick[1] = Math.max(0, S.kick[1] - dt * 8);
        for (let i = S.pops.length - 1; i >= 0; i--) { S.pops[i].t -= dt; if (S.pops[i].t <= 0) S.pops.splice(i, 1); }
        S.flash = Math.max(0, S.flash - dt);
        fx.update(dt); sh.update(dt);
        render();
      });
    }
  });
})();
