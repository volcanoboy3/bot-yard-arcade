/* Brick Bot: breakout in the factory. Ride your hover platform, bounce the energy core into
 * circuit boards and metal panels, crack riveted steel, set off red hazard bricks and catch
 * falling power-ups. Six hand-built layouts, then they come round again, faster. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C, P = K.PLATING;

  const W = 600, H = 720;
  const WALL = 16, TOP = 52;              // inner edges of the side walls and the ceiling
  const NC = 12, NR = 11;                 // brick grid
  const BRW = 45, BRH = 22, GAP = 2;
  const PITCH_X = BRW + GAP, PITCH_Y = BRH + GAP;
  const X0 = (W - (NC * BRW + (NC - 1) * GAP)) / 2;
  const ROW0 = 100, GRID_BOTTOM = ROW0 + NR * PITCH_Y;
  const BEAM = 632, BASE_Y = BEAM + 34;   // paddle: energy beam on top, platform below
  const R = 8;                            // energy core radius
  const PAD_W = 104, WIDE_W = 166;
  const MAX_BALLS = 6, TRAIL = 8;
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];

  /* Layout key: . empty · 0-7 metal panel in PLATING[n] · a-h circuit board in PLATING[0-7]
   * s riveted steel (2 hits) · S heavy steel (3 hits) · x red hazard (blows up its neighbours) */
  const LAYOUTS = [
    { name: 'Robot face', rows: [
      '...1....1...',
      '...6....6...',
      '.0000000000.',
      '.0aaaaaaaa0.',
      '.0a11aa11a0.',
      '.0a11aa11a0.',
      '.0xaaaaaax0.',
      '.0aa5555aa0.',
      '.0000000000.'
    ] },
    { name: 'Gear', rows: [
      '.....ss.....',
      '..s.1111.s..',
      '...111111...',
      '..11bbbb11..',
      '.s1bb..bb1s.',
      's11b.xx.b11s',
      '.s1bb..bb1s.',
      '..11bbbb11..',
      '...111111...',
      '..s.1111.s..',
      '.....ss.....'
    ] },
    { name: 'Battery', rows: [
      '............',
      '.s66666666s.',
      '.6d3d3d3d36.',
      '.6d3d3d3d36S',
      '.6dx3d3xd36S',
      '.6d3d3d3d36S',
      '.6d3d3d3d36.',
      '.s66666666s.'
    ] },
    { name: 'Rocket', rows: [
      'g....77....g',
      '....7777....',
      '....6666....',
      '.g..6aa6..g.',
      '....6aa6....',
      '....6666....',
      '...s6666s...',
      '..ss6xx6ss..',
      '..s.4444.s..',
      'g....22....g',
      '....1221....'
    ] },
    { name: 'Microchip', rows: [
      '...6.66.6...',
      '..s444444s..',
      '6644eeee4466',
      '..4e1111e4..',
      '664e1xx1e466',
      '..4e1111e4..',
      '6644eeee4466',
      '..s444444s..',
      '...6.66.6...'
    ] },
    { name: 'Lightning', rows: [
      'SeeeeeeeeeeS',
      '......2112..',
      '.....2112...',
      '....2112....',
      '...2112.....',
      '..x211112x..',
      '.....2112...',
      '....2112....',
      '...2112.....',
      '...212......',
      '...22.......'
    ] }
  ];

  const POWERS = {
    wide: { letter: 'W', color: '#9fdc6b', label: 'WIDE', text: 'WIDE PADDLE!', time: 16 },
    multi: { letter: 'M', color: '#5ad1e6', label: 'MULTI', text: 'MULTI-BALL!', time: 0 },
    laser: { letter: 'L', color: '#ff5a5a', label: 'LASER', text: 'LASER CANNONS!', time: 11 },
    slow: { letter: 'S', color: '#c3a6ff', label: 'SLOW', text: 'SLOW BALL!', time: 12 }
  };
  const POWER_BAG = ['wide', 'wide', 'wide', 'multi', 'multi', 'multi', 'laser', 'laser', 'laser', 'slow', 'slow'];
  const TIMED = ['wide', 'laser', 'slow'];

  function parseCell(ch) {
    if (ch >= '0' && ch <= '7') return { kind: 'panel', ci: +ch, hp: 1, pts: 10 };
    if (ch >= 'a' && ch <= 'h') return { kind: 'circuit', ci: ch.charCodeAt(0) - 97, hp: 1, pts: 15 };
    if (ch === 's') return { kind: 'steel', ci: 6, hp: 2, pts: 40 };
    if (ch === 'S') return { kind: 'steel', ci: 6, hp: 3, pts: 60 };
    if (ch === 'x') return { kind: 'hazard', ci: 7, hp: 1, pts: 25 };
    return null;
  }

  // ---------- brick art (drawn at 0,0, BRW × BRH) ----------
  function drawPanel(c, col) {
    c.fillStyle = K.shade(col, -0.45); K.rr(c, 0, 0, BRW, BRH, 4);
    c.fillStyle = col; K.rr(c, 0, 0, BRW, BRH - 3, 4);
    c.fillStyle = 'rgba(255,255,255,0.32)'; K.rr(c, 3, 2, BRW - 6, 2.4, 1.2);
    c.fillStyle = K.shade(col, -0.25);
    K.rr(c, 13, 7.5, BRW - 26, 2.6, 1.3); K.rr(c, 13, 12, BRW - 26, 2.6, 1.3);
    c.fillStyle = K.shade(col, -0.35); K.circle(c, 6.5, 9.5, 2.4); K.circle(c, BRW - 6.5, 9.5, 2.4);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(5, 9, 3, 1);  c.fillRect(BRW - 8, 9, 3, 1);
  }
  function drawCircuit(c, col) {
    c.fillStyle = K.shade(col, -0.74); K.rr(c, 0, 0, BRW, BRH, 3);
    c.fillStyle = K.shade(col, -0.52); K.rr(c, 0, 0, BRW, BRH - 2.5, 3);
    c.strokeStyle = K.alpha(col, 0.9); c.lineWidth = 1.3; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(1, 5.5); c.lineTo(9, 5.5); c.lineTo(12.5, 9); c.lineTo(17, 9);
    c.moveTo(1, 14.5); c.lineTo(8, 14.5); c.lineTo(11, 12); c.lineTo(17, 12);
    c.moveTo(BRW - 1, 4.5); c.lineTo(BRW - 10, 4.5); c.lineTo(BRW - 13, 8); c.lineTo(28, 8);
    c.moveTo(BRW - 1, 15); c.lineTo(BRW - 8, 15); c.lineTo(BRW - 11, 12.5); c.lineTo(28, 12.5);
    c.stroke();
    c.fillStyle = C.gold;
    K.circle(c, 9, 5.5, 1.6); K.circle(c, 8, 14.5, 1.6); K.circle(c, BRW - 10, 4.5, 1.6); K.circle(c, BRW - 8, 15, 1.6);
    c.fillStyle = '#0d151b'; K.rr(c, 17, 4.5, 11, 11, 1.5);
    c.fillStyle = K.alpha(col, 0.95);
    for (let i = 0; i < 3; i++) { c.fillRect(18.5 + i * 3.4, 3, 1.4, 1.6); c.fillRect(18.5 + i * 3.4, 15.4, 1.4, 1.6); }
    c.fillStyle = col; K.circle(c, 22.5, 10, 1.7);
    c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(2, 1.5, BRW - 4, 1.5);
  }
  function drawSteel(c, hp, max) {
    const heavy = max === 3;
    const base = heavy ? '#71889a' : '#a3b1bc';
    c.fillStyle = K.shade(base, -0.5); K.rr(c, 0, 0, BRW, BRH, 3);
    c.fillStyle = base; K.rr(c, 0, 0, BRW, BRH - 3, 3);
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(3, 2, BRW - 6, 2);
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.beginPath(); c.moveTo(10, 0); c.lineTo(20, 0); c.lineTo(12, BRH - 3); c.lineTo(2, BRH - 3); c.closePath(); c.fill();
    if (heavy) {
      c.strokeStyle = K.shade(base, -0.28); c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(9, 4); c.lineTo(BRW - 9, BRH - 7); c.moveTo(9, BRH - 7); c.lineTo(BRW - 9, 4); c.stroke();
    }
    const riv = heavy ? [[4.5, 4.5], [BRW / 2, 4.5], [BRW - 4.5, 4.5], [4.5, BRH - 7], [BRW / 2, BRH - 7], [BRW - 4.5, BRH - 7]]
      : [[4.5, 4.5], [BRW - 4.5, 4.5], [4.5, BRH - 7], [BRW - 4.5, BRH - 7]];
    for (const [x, y] of riv) {
      c.fillStyle = K.shade(base, -0.4); K.circle(c, x, y, 2.1);
      c.fillStyle = 'rgba(255,255,255,0.6)'; K.circle(c, x - 0.6, y - 0.6, 0.8);
    }
    const dmg = max - hp;
    c.strokeStyle = 'rgba(15,26,35,0.9)'; c.lineWidth = 1.5; c.lineJoin = 'miter';
    if (dmg >= 1) {
      c.beginPath(); c.moveTo(16, 1); c.lineTo(20, 7); c.lineTo(15, 11); c.lineTo(21, 18); c.moveTo(20, 7); c.lineTo(26, 9); c.stroke();
    }
    if (dmg >= 2) {
      c.beginPath(); c.moveTo(33, 18); c.lineTo(29, 12); c.lineTo(35, 8); c.lineTo(31, 1); c.moveTo(29, 12); c.lineTo(24, 14); c.stroke();
    }
  }
  function drawHazardBrick(c, lit) {
    c.fillStyle = '#5a1512'; K.rr(c, 0, 0, BRW, BRH, 3);
    c.save();
    K.rrPath(c, 0, 0, BRW, BRH - 3, 3); c.clip();
    K.hazard(c, 0, 0, BRW, BRH - 3, { stripe: 7, a: '#ff5a5a', b: '#2a0f0f' });
    c.restore();
    c.fillStyle = '#1a1a1a'; K.rr(c, BRW / 2 - 10, 2.5, 20, BRH - 8, 3);
    c.fillStyle = lit ? '#fff3a0' : '#ff9d2e';
    c.beginPath(); c.moveTo(BRW / 2, 4.5); c.lineTo(BRW / 2 + 6.5, 15); c.lineTo(BRW / 2 - 6.5, 15); c.closePath(); c.fill();
    c.fillStyle = '#1a1a1a'; c.fillRect(BRW / 2 - 0.9, 7.8, 1.8, 3.8); c.fillRect(BRW / 2 - 0.9, 12.4, 1.8, 1.6);
  }
  function drawBrickArt(c, d, lit) {
    if (d.kind === 'panel') drawPanel(c, P[d.ci]);
    else if (d.kind === 'circuit') drawCircuit(c, P[d.ci]);
    else if (d.kind === 'steel') drawSteel(c, d.hp, d.max || d.hp);
    else drawHazardBrick(c, lit);
  }

  function drawCapsule(c, x, y, type) {
    const p = POWERS[type];
    c.fillStyle = K.alpha(p.color, 0.22); K.rr(c, x - 23, y - 13, 46, 26, 13);
    c.fillStyle = K.shade(p.color, -0.45); K.rr(c, x - 19, y - 8, 38, 18, 9);
    c.fillStyle = p.color; K.rr(c, x - 19, y - 9, 38, 16, 8);
    c.fillStyle = 'rgba(255,255,255,0.4)'; K.rr(c, x - 13, y - 7, 26, 2.6, 1.3);
    c.fillStyle = C.bg; K.rr(c, x - 8, y - 7.5, 16, 13, 4);
    K.text(c, p.letter, x, y - 0.5, { size: 11, color: p.color, shadow: false });
  }

  // the hover platform with the player's bot riding it; x is the centre, w the width
  function drawPlatform(c, x, w, t, bot, laser, beamFlash) {
    const hw = w / 2, col = bot.body;
    const f = 0.5 + 0.5 * Math.sin(t * 26);
    c.fillStyle = K.alpha(C.glow, 0.1 + 0.08 * f);
    c.beginPath(); c.ellipse(x, BASE_Y + 25, hw * 0.9, 7, 0, 0, Math.PI * 2); c.fill();
    for (const sx of [-1, 1]) {
      const jx = x + sx * hw * 0.55;
      c.fillStyle = K.alpha(C.eye, 0.5 + 0.35 * f);
      c.beginPath(); c.ellipse(jx, BASE_Y + 17, 5, 3 + f * 2.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = C.steelDark; K.rr(c, jx - 7, BASE_Y + 10, 14, 5, 2);
    }
    K.drawBot(c, x, BASE_Y - 19, 38, bot);
    c.fillStyle = K.alpha(C.glow, 0.28 + beamFlash * 2); K.rr(c, x - hw + 6, BEAM - 4.5, w - 12, 10, 5);
    c.fillStyle = '#dffbff'; K.rr(c, x - hw + 7, BEAM - 1.5, w - 14, 3.6, 1.8);
    for (const sx of [-1, 1]) {
      const px = sx < 0 ? x - hw : x + hw - 10;
      c.fillStyle = C.steelDark; K.rr(c, px, BEAM, 10, BASE_Y - BEAM + 2, 3);
      c.fillStyle = C.steel; c.fillRect(px + 3.5, BEAM + 5, 2.5, BASE_Y - BEAM - 6);
      if (laser) {
        c.fillStyle = '#ff5a5a'; K.rr(c, px + 1, BEAM - 15, 8, 12, 2);
        c.fillStyle = '#ffd0d0'; K.rr(c, px + 3, BEAM - 18, 4, 4, 1);
      }
      c.fillStyle = K.shade(col, -0.35); K.rr(c, px - 2, BEAM - 5, 14, 10, 3);
      c.fillStyle = col; K.rr(c, px - 2, BEAM - 6, 14, 8, 3);
      c.fillStyle = C.eye; K.circle(c, px + 5, BEAM - 2, 1.8);
    }
    c.fillStyle = K.shade(col, -0.45); K.rr(c, x - hw, BASE_Y, w, 12, 5);
    c.fillStyle = col; K.rr(c, x - hw, BASE_Y, w, 8, 4);
    c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(x - hw + 6, BASE_Y + 1.5, w - 12, 1.5);
    c.fillStyle = K.shade(col, -0.55);
    for (let i = -2; i <= 2; i++) K.circle(c, x + i * hw * 0.34, BASE_Y + 9.5, 1.3);
  }

  // ---------- cached art ----------
  let ART = null;
  function art() {
    if (ART) return ART;
    const mk = (d, lit) => K.layer(BRW, BRH, c => drawBrickArt(c, d, lit), 3);
    ART = {
      panel: P.map((_, i) => mk({ kind: 'panel', ci: i })),
      circuit: P.map((_, i) => mk({ kind: 'circuit', ci: i })),
      steel2: [null, mk({ kind: 'steel', hp: 1, max: 2 }), mk({ kind: 'steel', hp: 2, max: 2 })],
      steel3: [null, mk({ kind: 'steel', hp: 1, max: 3 }), mk({ kind: 'steel', hp: 2, max: 3 }), mk({ kind: 'steel', hp: 3, max: 3 })],
      hazard: [mk({ kind: 'hazard' }, false), mk({ kind: 'hazard' }, true)],
      glow: K.layer(48, 48, c => {
        const g = c.createRadialGradient(24, 24, 2, 24, 24, 24);
        g.addColorStop(0, 'rgba(191,246,255,0.9)'); g.addColorStop(0.35, 'rgba(90,209,230,0.4)'); g.addColorStop(1, 'rgba(90,209,230,0)');
        c.fillStyle = g; c.fillRect(0, 0, 48, 48);
      }, 2),
      bg: K.layer(W, H, drawBackground, 2),
      vignette: K.layer(W, H, c => K.vignette(c, W, H, 0.35), 1)
    };
    return ART;
  }
  function drawBackground(c) {
    K.bgFactory(c, W, H);
    const g = c.createLinearGradient(0, H - 80, 0, H);
    g.addColorStop(0, 'rgba(255,77,77,0)'); g.addColorStop(1, 'rgba(255,77,77,0.2)');
    c.fillStyle = g; c.fillRect(0, H - 80, W, 80);
    for (const x of [0, W - WALL]) {
      c.fillStyle = '#0c151c'; c.fillRect(x, 0, WALL, H);
      c.fillStyle = '#1a2d39'; c.fillRect(x + 4, 0, 8, H);
      c.fillStyle = '#2e4a5b'; c.fillRect(x + 6, 0, 2.5, H);
      for (let y = 80; y < H; y += 100) { c.fillStyle = '#39505e'; c.fillRect(x + 1, y, WALL - 2, 7); }
      c.fillStyle = '#26404f'; c.fillRect(x ? x : WALL - 2, 0, 2, H);
    }
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, TOP);
    K.hazard(c, 0, TOP - 9, W, 7, { stripe: 10 });
    c.fillStyle = '#26404f'; c.fillRect(0, TOP - 2, W, 2);
  }

  Arcade.register({
    id: 'brick-bot',
    title: 'Brick Bot',
    cat: 'action',
    blurb: 'Bounce an energy core to smash circuit-board bricks.',
    rules: [
      'Keep the energy core bouncing. Where it hits your platform sets its angle.',
      'Steel bricks take extra hits. Red hazard bricks blow up their neighbours.',
      'Catch falling power-ups: Wide, Multi-ball, Laser and Slow.',
      'Clear every brick to reach the next level. You have 3 lives.'
    ],
    how: 'Move: mouse, drag or ← → · Launch: Space, click or tap',
    accent: '#ff8a5c',
    usesPlayer: true,

    thumb(ctx, w, h, kit, player) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 2;
      for (let x = 20; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.fillStyle = '#0c151c'; ctx.fillRect(0, 0, w, 14);
      kit.hazard(ctx, 0, 10, w, 6, { stripe: 9 });
      const rows = ['0a1x1a0', '3dsSd3e', '5b4b4.5'];
      rows.forEach((row, r) => {
        for (let col = 0; col < row.length; col++) {
          const d = parseCell(row[col]);
          if (!d) continue;
          d.max = d.hp;
          ctx.save(); ctx.translate(-8 + col * PITCH_X, 24 + r * PITCH_Y);
          drawBrickArt(ctx, d, true);
          ctx.restore();
        }
      });
      ctx.fillStyle = '#fff3a0';
      for (const [x, y, s] of [[251, 98, 3], [262, 106, 2.5], [243, 110, 2], [270, 94, 2]]) ctx.fillRect(x, y, s, s);
      const bx = 214, by = 108;
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = kit.alpha(C.glow, 0.07 + i * 0.05);
        kit.circle(ctx, bx - (7 - i) * 7, by + (7 - i) * 6, R * (0.35 + i * 0.09));
      }
      const gl = ctx.createRadialGradient(bx, by, 2, bx, by, 24);
      gl.addColorStop(0, 'rgba(191,246,255,0.95)'); gl.addColorStop(1, 'rgba(90,209,230,0)');
      ctx.fillStyle = gl; kit.circle(ctx, bx, by, 24);
      ctx.fillStyle = '#e8fdff'; kit.circle(ctx, bx, by, R * 0.78);
      ctx.strokeStyle = 'rgba(90,209,230,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(bx, by, R + 1, (R + 1) * 0.38, 0.6, 0, Math.PI * 2); ctx.stroke();
      drawCapsule(ctx, 70, 118, 'multi');
      ctx.save();
      ctx.translate(0, 150 - BEAM);
      drawPlatform(ctx, 150, PAD_W + 20, 0.3, Object.assign({}, player, { mood: 'happy', t: 0.3, lookY: -1, look: 0.6 }), false, 0);
      ctx.restore();
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const A = art();
      const fx = K.particles(), sh = K.shaker();
      const bot = Object.assign({}, api.player, { t: 0, mood: 'happy', arms: 'down', look: 0, lookY: -1 });

      const S = {
        t: 0, over: false, phase: 'serve', phaseT: 0, score: 0, lives: 3, level: 1, layout: null, title: '',
        bricks: [], grid: new Array(NC * NR).fill(null), remaining: 0, smashed: 0,
        px: W / 2, pvx: 0, pw: PAD_W, target: null, down: false,
        balls: [], caps: [], lasers: [], blasts: [], rings: [],
        base: 360, speed: 360, slowK: 1, combo: 0,
        power: { wide: 0, laser: 0, slow: 0 }, laserT: 0, capT: -9,
        mood: 'happy', moodT: 0, arms: 'down', flash: 0, beamFlash: 0, msg: null
      };

      // ---------- input ----------
      // a see-through layer over the whole stage takes the touches, so the browser never pans
      const pad = api.el('div', { style: { position: 'absolute', inset: '0', touchAction: 'none' } });
      api.stage.appendChild(pad);
      api.on(pad, 'pointerdown', e => {
        S.down = true; K.capture(pad, e);
        S.target = cv.toLocal(e).x;
      });
      api.on(pad, 'pointermove', e => { if (e.pointerType === 'mouse' || S.down) S.target = cv.toLocal(e).x; });
      api.on(pad, 'pointerup', () => { if (!S.down) return; S.down = false; launch(); });
      api.on(pad, 'pointercancel', () => { S.down = false; });
      api.onKey((name, e) => { if ((name === 'fire' || name === 'up') && !e.repeat) launch(); });

      // ---------- levels ----------
      function loadLevel(n) {
        S.level = n;
        S.layout = LAYOUTS[(n - 1) % LAYOUTS.length];
        S.title = 'LV ' + n + ' · ' + S.layout.name.toUpperCase();
        S.bricks.length = 0; S.grid.fill(null); S.remaining = 0;
        S.layout.rows.forEach((row, r) => {
          for (let c = 0; c < NC; c++) {
            const d = parseCell(row[c]);
            if (!d) continue;
            const b = { col: c, row: r, x: X0 + c * PITCH_X, y: ROW0 + r * PITCH_Y, kind: d.kind, ci: d.ci, hp: d.hp, max: d.hp, pts: d.pts, flash: 0, alive: true };
            S.bricks.push(b); S.grid[r * NC + c] = b; S.remaining++;
          }
        });
        S.base = Math.min(660, 360 + 16 * (n - 1));
        S.speed = S.base;
        api.stat('Level', n);
        clearPowers();
        serve();
      }
      function clearPowers() {
        S.power.wide = 0; S.power.laser = 0; S.power.slow = 0;
        S.caps.length = 0; S.lasers.length = 0;
      }
      function newBall(x, y, dx, dy) {
        return { x, y, dx, dy, tx: new Float32Array(TRAIL), ty: new Float32Array(TRAIL), ti: 0, tn: 0 };
      }
      function serve() {
        S.balls.length = 0;
        S.balls.push(newBall(S.px, BEAM - 4 - R, 0, -1));
        S.phase = 'serve'; S.combo = 0;
      }
      function launch() {
        if (S.phase !== 'serve' || S.over) return;
        S.phase = 'play';
        const a = K.clamp(S.pvx / 1600, -0.45, 0.45) + K.rand(-0.2, 0.2);
        const b = S.balls[0];
        b.dx = Math.sin(a); b.dy = -Math.cos(a);
        api.sfx('jump');
      }

      // ---------- bricks ----------
      function brickArt(b) {
        if (b.kind === 'panel') return A.panel[b.ci];
        if (b.kind === 'circuit') return A.circuit[b.ci];
        if (b.kind === 'steel') return b.max === 3 ? A.steel3[b.hp] : A.steel2[b.hp];
        return A.hazard[Math.floor(S.t * 3 + b.col * 0.37) % 2];
      }
      function hitBrick(b, dmg, hx, hy) {
        if (!b.alive) return;
        b.hp -= dmg; b.flash = 0.12;
        if (b.hp > 0) {
          S.score += 10; api.score(S.score);
          api.tone(190, 0.07, 'square', 0.045, -50);
          fx.burst(hx, hy, ['#e6eef2', '#8b9aa6'], 6, 140, { life: 0.35, lift: 20, size: 2.5 });
          return;
        }
        destroyBrick(b, dmg === 1);
      }
      function destroyBrick(b, direct) {
        b.alive = false; S.grid[b.row * NC + b.col] = null; S.remaining--; S.smashed++;
        const cx = b.x + BRW / 2, cy = b.y + BRH / 2;
        S.score += b.pts;
        const col = b.kind === 'steel' ? '#c9d4db' : b.kind === 'hazard' ? '#ff5a5a' : P[b.ci];
        fx.burst(cx, cy, [col, col, '#ffffff'], 12, 200, { life: 0.5, lift: 40, gravity: 500 });
        if (b.kind === 'hazard') explode(b, cx, cy);
        else {
          S.combo++;
          api.tone(NOTES[Math.min(S.combo - 1, NOTES.length - 1)], 0.08, 'square', 0.035);
          if (b.kind === 'steel') fx.float('+' + b.pts, cx, cy, '#e6eef2', { size: 15 });
          if (Math.random() < (direct ? 0.14 : 0.06)) dropPower(cx, cy);
        }
        if (S.combo === 8 || S.combo === 15 || S.combo === 25) {
          const bonus = S.combo * 10;
          S.score += bonus;
          fx.float('COMBO ' + S.combo + '  +' + bonus, cx, cy - 16, C.safety, { size: 18, life: 1.2, speed: 50 });
        }
        api.score(S.score);
      }
      function explode(b, cx, cy) {
        sh.add(0.3); S.flash = 0.12;
        api.sfx('boom');
        fx.burst(cx, cy, ['#ff9d2e', '#ff5a5a', '#fff3a0', '#3a3f44'], 30, 340, { life: 0.7 });
        S.rings.push({ x: cx, y: cy, t: 0 });
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const r = b.row + dr, c = b.col + dc;
            if (r < 0 || c < 0 || r >= NR || c >= NC) continue;
            const n = S.grid[r * NC + c];
            if (n && n.alive) S.blasts.push({ t: 0.09, b: n });
          }
        }
      }

      // ---------- power-ups ----------
      function dropPower(x, y) {
        if (S.caps.length >= 2 || S.phase !== 'play') return;
        S.caps.push({ x, y, type: K.pick(POWER_BAG) });
      }
      function grab(p) {
        const def = POWERS[p.type];
        api.sfx('power');
        const stack = S.t - S.capT < 0.8 ? 30 : 0;
        S.capT = S.t;
        fx.float(def.text, K.clamp(p.x, 90, W - 90), BEAM - 40 - stack, def.color, { size: 18, life: 1.3, speed: 45 });
        fx.burst(p.x, BEAM - 10, [def.color, '#ffffff'], 14, 200, { life: 0.5 });
        S.score += 50; api.score(S.score);
        if (p.type === 'multi') { multiBall(); S.mood = 'wow'; S.moodT = 1; }
        else S.power[p.type] = def.time;
      }
      function multiBall() {
        const src = S.balls.slice();
        for (const b of src) {
          for (const turn of [-0.45, 0.45]) {
            if (S.balls.length >= MAX_BALLS) return;
            const ang = Math.atan2(b.dx, -b.dy) + turn;
            const nb = newBall(b.x, b.y, Math.sin(ang), -Math.cos(ang));
            fixAngle(nb);
            S.balls.push(nb);
          }
        }
      }

      // ---------- ball physics ----------
      function fixAngle(b) {
        if (Math.abs(b.dy) < 0.24) {
          b.dy = (b.dy < 0 ? -1 : 1) * 0.24;
          b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - 0.24 * 0.24);
        }
      }
      function wallTick() { api.tone(240, 0.03, 'square', 0.02); }
      function brickCollide(b) {
        const c0 = Math.max(0, Math.floor((b.x - R - X0) / PITCH_X)), c1 = Math.min(NC - 1, Math.floor((b.x + R - X0) / PITCH_X));
        const r0 = Math.max(0, Math.floor((b.y - R - ROW0) / PITCH_Y)), r1 = Math.min(NR - 1, Math.floor((b.y + R - ROW0) / PITCH_Y));
        let best = null, bd = R * R, bx = 0, by = 0;
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const k = S.grid[r * NC + c];
            if (!k) continue;
            const cx = K.clamp(b.x, k.x, k.x + BRW), cy = K.clamp(b.y, k.y, k.y + BRH);
            const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
            if (d2 < bd) { best = k; bd = d2; bx = cx; by = cy; }
          }
        }
        if (!best) return;
        const dx = b.x - bx, dy = b.y - by;
        if (dx === 0 && dy === 0) b.dy = -b.dy;
        else if (Math.abs(dx) > Math.abs(dy)) { b.dx = Math.abs(b.dx) * Math.sign(dx); b.x = bx + Math.sign(dx) * R; }
        else { b.dy = Math.abs(b.dy) * Math.sign(dy); b.y = by + Math.sign(dy) * R; }
        fixAngle(b);
        hitBrick(best, 1, bx, by);
      }
      function paddleBounce(b) {
        const hw = S.pw / 2;
        const off = K.clamp((b.x - S.px) / hw, -1, 1);
        const a = off * 1.05;
        b.dx = Math.sin(a); b.dy = -Math.cos(a);
        b.y = BEAM - 4 - R;
        S.speed = Math.min(S.base + 170, S.speed + 5);
        S.combo = 0; S.beamFlash = 0.12;
        api.tone(330 + Math.abs(off) * 220, 0.06, 'square', 0.035);
        fx.burst(b.x, BEAM - 3, [C.eye, C.glow], 6, 110, { life: 0.3, lift: 60, gravity: 300, size: 2.5 });
      }
      function moveBall(b, dt) {
        const dist = S.speed * S.slowK * dt, n = Math.max(1, Math.ceil(dist / 5)), step = dist / n;
        for (let i = 0; i < n; i++) {
          b.x += b.dx * step; b.y += b.dy * step;
          if (b.x < WALL + R) { b.x = WALL + R; b.dx = Math.abs(b.dx); wallTick(); }
          else if (b.x > W - WALL - R) { b.x = W - WALL - R; b.dx = -Math.abs(b.dx); wallTick(); }
          if (b.y < TOP + R) { b.y = TOP + R; b.dy = Math.abs(b.dy); fixAngle(b); wallTick(); }
          if (b.y - R < GRID_BOTTOM && b.y + R > ROW0) brickCollide(b);
          if (b.dy > 0 && b.y + R >= BEAM - 4 && b.y + R <= BEAM + 14) {
            const hw = S.pw / 2;
            if (b.x >= S.px - hw - R * 0.7 && b.x <= S.px + hw + R * 0.7) paddleBounce(b);
          }
          if (b.y - R > H) return false;
        }
        return true;
      }
      function pushTrail(b) {
        b.tx[b.ti] = b.x; b.ty[b.ti] = b.y;
        b.ti = (b.ti + 1) % TRAIL;
        if (b.tn < TRAIL) b.tn++;
      }

      // ---------- lives and levels ----------
      function loseLife() {
        S.lives--; api.stat('Lives', S.lives);
        sh.add(0.45); S.flash = 0.25;
        api.sfx('hit');
        clearPowers();
        S.speed = S.base;
        S.mood = 'sad'; S.moodT = 1.6;
        if (S.lives <= 0) {
          S.over = true; S.phase = 'over';
          const lvls = S.level - 1;
          api.gameOver({
            score: S.score, title: 'Out of cores',
            detail: lvls > 0
              ? 'You cleared ' + lvls + ' level' + (lvls === 1 ? '' : 's') + ' and smashed ' + S.smashed + ' bricks.'
              : 'You smashed ' + S.smashed + ' brick' + (S.smashed === 1 ? '' : 's') + ' on level 1.',
            delay: 900
          });
          return;
        }
        S.msg = { text: 'CORE LOST', sub: S.lives + (S.lives === 1 ? ' LIFE LEFT' : ' LIVES LEFT'), color: C.hazard, t: 1.3 };
        S.phase = 'wait'; S.phaseT = 1.1;
      }
      function levelClear() {
        const bonus = 250 * S.level;
        S.score += bonus; api.score(S.score);
        S.msg = { text: 'LEVEL CLEAR!', sub: 'BONUS +' + bonus, color: C.good, t: 1.9 };
        api.sfx('levelup');
        for (const b of S.balls) fx.burst(b.x, b.y, [C.glow, '#ffffff'], 16, 220, { life: 0.6 });
        S.balls.length = 0; S.blasts.length = 0;
        clearPowers();
        S.mood = 'happy'; S.arms = 'up'; S.moodT = 1.9;
        S.phase = 'clear'; S.phaseT = 1.9;
      }

      // ---------- update ----------
      function movePaddle(dt) {
        const dir = (api.keys.right ? 1 : 0) - (api.keys.left ? 1 : 0);
        const prev = S.px;
        if (dir) { S.target = null; S.px += dir * 620 * dt; }
        else if (S.target != null) S.px += (S.target - S.px) * Math.min(1, dt * 30);
        const goal = S.power.wide > 0 ? WIDE_W : PAD_W;
        S.pw += (goal - S.pw) * Math.min(1, dt * 10);
        const hw = S.pw / 2;
        S.px = K.clamp(S.px, WALL + hw, W - WALL - hw);
        S.pvx = K.lerp(S.pvx, (S.px - prev) / Math.max(dt, 0.001), 0.3);
      }
      function update(dt) {
        movePaddle(dt);
        for (const k of TIMED) if (S.power[k] > 0) S.power[k] = Math.max(0, S.power[k] - dt);
        S.slowK += ((S.power.slow > 0 ? 0.62 : 1) - S.slowK) * Math.min(1, dt * 4);
        if (S.moodT > 0) { S.moodT -= dt; if (S.moodT <= 0) { S.mood = 'happy'; S.arms = 'down'; } }

        if (S.phase === 'wait' || S.phase === 'clear') {
          S.phaseT -= dt;
          if (S.phaseT <= 0) {
            if (S.phase === 'wait') serve();
            else { loadLevel(S.level + 1); api.toast('LEVEL ' + S.level); api.sfx('power'); }
          }
        }

        for (let i = S.balls.length - 1; i >= 0; i--) {
          const b = S.balls[i];
          if (S.phase === 'serve') { b.x = S.px; b.y = BEAM - 4 - R; b.tn = 0; continue; }
          if (!moveBall(b, dt)) {
            S.balls.splice(i, 1);
            fx.burst(b.x, H - 6, [C.hazard, '#ff9d2e'], 10, 200, { life: 0.5 });
          } else pushTrail(b);
        }
        if (S.phase === 'play' && S.balls.length === 0) { loseLife(); if (S.over) return; }

        for (let i = S.blasts.length - 1; i >= 0; i--) {
          const q = S.blasts[i];
          q.t -= dt;
          if (q.t <= 0) { S.blasts.splice(i, 1); hitBrick(q.b, 2, q.b.x + BRW / 2, q.b.y + BRH / 2); }
        }

        const hw = S.pw / 2;
        for (let i = S.caps.length - 1; i >= 0; i--) {
          const p = S.caps[i];
          p.y += 150 * dt;
          if (p.y + 9 >= BEAM - 6 && p.y - 9 <= BASE_Y + 12 && Math.abs(p.x - S.px) <= hw + 18) { S.caps.splice(i, 1); grab(p); }
          else if (p.y > H + 20) S.caps.splice(i, 1);
        }

        if (S.power.laser > 0 && S.phase === 'play') {
          S.laserT -= dt;
          if (S.laserT <= 0) {
            S.laserT = 0.36;
            S.lasers.push({ x: S.px - hw + 5, y: BEAM - 16 }, { x: S.px + hw - 5, y: BEAM - 16 });
            api.tone(1500, 0.05, 'square', 0.02, -700);
          }
        }
        const lstep = 760 * dt, ln = Math.max(1, Math.ceil(lstep / 8));
        for (let i = S.lasers.length - 1; i >= 0; i--) {
          const l = S.lasers[i];
          let gone = false;
          for (let k = 0; k < ln && !gone; k++) {
            l.y -= lstep / ln;
            if (l.y < TOP) { gone = true; break; }
            const c = Math.floor((l.x - X0) / PITCH_X), r = Math.floor((l.y - ROW0) / PITCH_Y);
            if (c < 0 || r < 0 || c >= NC || r >= NR) continue;
            const b = S.grid[r * NC + c];
            if (b && l.x >= b.x && l.x <= b.x + BRW && l.y <= b.y + BRH) { hitBrick(b, 1, l.x, b.y + BRH); gone = true; }
          }
          if (gone) {
            S.lasers.splice(i, 1);
            fx.burst(l.x, Math.max(TOP, l.y), ['#ff5a5a', '#ffd0d0'], 4, 90, { life: 0.25, lift: 0 });
          }
        }

        if (S.phase !== 'clear' && S.remaining <= 0) levelClear();
      }

      // ---------- drawing ----------
      function drawBall(c, b) {
        for (let i = 0; i < b.tn; i++) {
          const idx = (b.ti - b.tn + i + TRAIL) % TRAIL, a = (i + 1) / (b.tn + 1);
          c.globalAlpha = a * 0.45;
          c.fillStyle = C.glow; K.circle(c, b.tx[idx], b.ty[idx], R * (0.3 + 0.6 * a));
        }
        c.globalAlpha = 1;
        c.drawImage(A.glow, b.x - 24, b.y - 24, 48, 48);
        c.fillStyle = '#e8fdff'; K.circle(c, b.x, b.y, R * 0.72);
        c.fillStyle = '#ffffff'; K.circle(c, b.x - 2, b.y - 2, R * 0.3);
        c.strokeStyle = 'rgba(90,209,230,0.9)'; c.lineWidth = 1.6;
        c.beginPath(); c.ellipse(b.x, b.y, R + 1, (R + 1) * 0.38, S.t * 6, 0, Math.PI * 2); c.stroke();
      }
      function drawTopBar(c) {
        K.text(c, S.title, 28, 23, { size: 17, align: 'left', color: C.safety });
        let x = W - 26;
        for (const key of TIMED) {
          const left = S.power[key];
          if (left <= 0) continue;
          const def = POWERS[key];
          c.globalAlpha = left < 3 && Math.floor(S.t * 6) % 2 ? 0.45 : 1;
          c.fillStyle = def.color; K.rr(c, x - 78, 9, 78, 22, 11);
          K.text(c, def.label, x - 39, 20.5, { size: 14, body: true, color: C.bg, shadow: false });
          c.globalAlpha = 1;
          c.fillStyle = 'rgba(255,255,255,0.12)'; K.rr(c, x - 74, 34, 70, 4, 2);
          c.fillStyle = def.color; K.rr(c, x - 74, 34, 70 * left / def.time, 4, 2);
          x -= 88;
        }
      }
      function drawMessages(c) {
        if (S.msg) {
          c.globalAlpha = K.clamp(S.msg.t * 2.5, 0, 1);
          K.text(c, S.msg.text, W / 2, 420, { size: 36, color: S.msg.color });
          if (S.msg.sub) K.text(c, S.msg.sub, W / 2, 462, { size: 22, body: true, color: C.safety });
          c.globalAlpha = 1;
        }
        if (S.phase === 'serve' && !S.over) {
          c.globalAlpha = 0.65 + 0.35 * Math.sin(S.t * 5);
          K.text(c, api.isTouch ? 'TAP TO LAUNCH' : 'CLICK OR PRESS SPACE TO LAUNCH', W / 2, 540, { size: 20, body: true, color: C.ink });
          c.globalAlpha = 1;
        }
      }
      function render() {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        sh.apply(ctx, 10);
        ctx.drawImage(A.bg, 0, 0, W, H);
        for (const b of S.bricks) {
          if (!b.alive) continue;
          ctx.drawImage(brickArt(b), b.x, b.y, BRW, BRH);
          if (b.flash > 0) {
            ctx.globalAlpha = b.flash / 0.12 * 0.75; ctx.fillStyle = '#ffffff';
            K.rr(ctx, b.x, b.y, BRW, BRH, 3); ctx.globalAlpha = 1;
          }
        }
        for (const r of S.rings) {
          const k = r.t / 0.35;
          ctx.globalAlpha = 1 - k;
          K.ring(ctx, r.x, r.y, 10 + k * 60, 5 * (1 - k) + 1, '#ffb03a');
        }
        ctx.globalAlpha = 1;
        for (const p of S.caps) drawCapsule(ctx, p.x, p.y, p.type);
        for (const l of S.lasers) {
          ctx.fillStyle = 'rgba(255,90,90,0.35)'; K.rr(ctx, l.x - 3.5, l.y - 10, 7, 20, 3.5);
          ctx.fillStyle = '#ffe0e0'; K.rr(ctx, l.x - 1.3, l.y - 8, 2.6, 16, 1.3);
        }
        bot.t = S.t; bot.mood = S.mood; bot.arms = S.arms;
        const lead = S.balls[0];
        bot.look = lead ? K.clamp((lead.x - S.px) / 140, -1, 1) : 0;
        drawPlatform(ctx, S.px, S.pw, S.t, bot, S.power.laser > 0, S.beamFlash);
        for (const b of S.balls) drawBall(ctx, b);
        fx.draw(ctx);
        ctx.restore();
        drawTopBar(ctx);
        drawMessages(ctx);
        ctx.drawImage(A.vignette, 0, 0, W, H);
        if (S.flash > 0) {
          ctx.globalAlpha = S.flash * 1.6;
          ctx.fillStyle = 'rgba(255,120,80,0.3)'; ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }

      api.score(0);
      api.stat('Lives', S.lives);
      loadLevel(1);
      api.toast('LEVEL 1');
      api.loop(dt => {
        S.t += dt;
        if (!S.over) update(dt);
        for (const b of S.bricks) if (b.flash > 0) b.flash -= dt;
        for (let i = S.rings.length - 1; i >= 0; i--) { S.rings[i].t += dt; if (S.rings[i].t >= 0.35) S.rings.splice(i, 1); }
        if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
        S.flash = Math.max(0, S.flash - dt);
        S.beamFlash = Math.max(0, S.beamFlash - dt);
        fx.update(dt); sh.update(dt);
        render();
      });
    }
  });
})();
