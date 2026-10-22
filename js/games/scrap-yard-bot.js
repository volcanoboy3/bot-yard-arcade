/* Scrap Yard Bot — the original game from robot-parts-drop.html, ported to the arcade engine.
 * Catch falling parts to build yourself; each full set ships a model and starts the next. */
(function () {
  'use strict';
  const W = 480, H = 720, GROUND = 664;
  const PARTS = ['legs', 'armL', 'armR', 'head', 'antenna', 'jetpack'];
  const NAMES = { legs: 'Legs', armL: 'L arm', armR: 'R arm', head: 'Head', antenna: 'Antenna', jetpack: 'Jetpack' };
  const PLATING = ['#5ad1e6', '#f5c518', '#ff8a5c', '#9fdc6b', '#c3a6ff', '#ff6fa8'];
  const STEEL = '#8b9aa6', DARK = '#1b2a35';
  const K = window.BotKit;
  const rr = K.rr, circle = K.circle;

  function drawBackground(b) {
    const gr = b.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#132330'); gr.addColorStop(1, '#1c2f3c');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(255,255,255,0.04)'; b.lineWidth = 2;
    for (let x = 0; x < W; x += 80) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, GROUND); b.stroke(); }
    for (let y = 60; y < GROUND; y += 120) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    b.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < W; x += 80) for (let y = 60; y < GROUND; y += 120) {
      [[6, 6], [74, 6], [6, 114], [74, 114]].forEach(([dx, dy]) => { b.beginPath(); b.arc(x + dx, y + dy, 2, 0, 7); b.fill(); });
    }
    // chute at top
    b.fillStyle = '#0c151c'; b.fillRect(0, 0, W, 26);
    b.fillStyle = '#26404f'; b.fillRect(0, 26, W, 6);
    for (let x = 0; x < W; x += 24) {
      b.fillStyle = (x / 24) % 2 ? '#f5c518' : '#1a1a1a';
      b.beginPath(); b.moveTo(x, 26); b.lineTo(x + 12, 26); b.lineTo(x + 6, 32); b.lineTo(x - 6, 32); b.fill();
    }
    // pipes
    b.fillStyle = '#243b49'; b.fillRect(22, 32, 14, GROUND - 32); b.fillRect(W - 36, 32, 14, GROUND - 32);
    b.fillStyle = '#2e4a5b'; b.fillRect(26, 32, 4, GROUND - 32); b.fillRect(W - 32, 32, 4, GROUND - 32);
    // floor
    b.fillStyle = '#0d171e'; b.fillRect(0, GROUND, W, H - GROUND);
    b.fillStyle = '#2b4353'; b.fillRect(0, GROUND, W, 4);
    for (let x = -20; x < W + 20; x += 28) {
      b.fillStyle = '#f5c518'; b.beginPath();
      b.moveTo(x, GROUND + 14); b.lineTo(x + 14, GROUND + 14); b.lineTo(x + 28, GROUND + 30); b.lineTo(x + 14, GROUND + 30); b.fill();
    }
    b.fillStyle = 'rgba(0,0,0,0.35)'; b.fillRect(0, GROUND + 14, W, 16);
    b.fillStyle = '#4a6272'; b.font = '700 11px "Chakra Petch", sans-serif'; b.textAlign = 'left';
    b.fillText('BAY 07 · ASSEMBLY FLOOR', 44, GROUND + 50);
    K.drawHive(b,58,GROUND+43,36); K.drawHive(b,W-58,GROUND+43,36);
  }

  function drawIcon(c, type, col, t) {
    switch (type) {
      case 'legs':
        c.fillStyle = STEEL; rr(c, -12, -16, 9, 26, 3); rr(c, 3, -16, 9, 26, 3);
        c.fillStyle = col; rr(c, -16, 8, 15, 7, 3); rr(c, 1, 8, 15, 7, 3);
        c.fillStyle = DARK; circle(c, -7.5, -3, 3); circle(c, 7.5, -3, 3);
        break;
      case 'armL': case 'armR': {
        const s = type === 'armL' ? 1 : -1;
        c.save(); c.scale(s, 1);
        c.fillStyle = col; circle(c, 0, -14, 7);
        c.fillStyle = STEEL; rr(c, -4, -12, 8, 24, 3);
        c.strokeStyle = STEEL; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-2, 12); c.lineTo(-8, 19); c.moveTo(2, 12); c.lineTo(8, 19); c.stroke();
        c.restore(); break;
      }
      case 'head':
        c.fillStyle = col; rr(c, -18, -14, 36, 28, 7);
        c.fillStyle = DARK; rr(c, -13, -7, 26, 12, 4);
        c.fillStyle = '#bff6ff'; circle(c, -6, -1, 3); circle(c, 6, -1, 3);
        break;
      case 'antenna':
        c.strokeStyle = STEEL; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -10); c.stroke();
        c.fillStyle = col; rr(c, -9, 12, 18, 6, 2);
        c.fillStyle = Math.sin(t * 8) > 0 ? '#ff4d4d' : '#ffb3b3'; circle(c, 0, -13, 6);
        break;
      case 'jetpack':
        c.fillStyle = STEEL; rr(c, -16, -16, 13, 28, 6); rr(c, 3, -16, 13, 28, 6);
        c.fillStyle = col; c.fillRect(-4, -8, 8, 6);
        c.fillStyle = '#ffb03a'; c.beginPath(); c.moveTo(-14, 12); c.lineTo(-9.5, 20 + Math.sin(t * 30) * 3); c.lineTo(-5, 12); c.fill();
        c.beginPath(); c.moveTo(5, 12); c.lineTo(9.5, 20 + Math.cos(t * 30) * 3); c.lineTo(14, 12); c.fill();
        break;
      case 'gear': {
        c.fillStyle = '#c9a54a';
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2, r = i % 2 ? 11 : 15;
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath(); c.fill();
        c.fillStyle = '#132330'; circle(c, 0, 0, 4.5);
        break;
      }
      case 'bomb':
        c.fillStyle = '#26292d'; circle(c, 0, 2, 15);
        c.fillStyle = '#ff6b3d'; c.fillRect(-15, -1, 30, 5);
        c.fillStyle = '#3d4247'; rr(c, -5, -17, 10, 6, 2);
        c.strokeStyle = '#a58a5a'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, -17); c.quadraticCurveTo(6, -24, 3, -27); c.stroke();
        c.fillStyle = Math.sin(t * 40) > 0 ? '#fff3a0' : '#ff9d2e'; circle(c, 3, -28, 3.5);
        break;
    }
  }

  function drawRobot(c, S) {
    const x = S.px, have = S.have, col = PLATING[(S.level - 1) % PLATING.length], t = S.t;
    const legs = have.has('legs');
    const base = legs ? GROUND - 42 : GROUND - 12;
    const top = base - 54;
    const step = S.moving ? Math.sin(t * 16) * 4 : 0;

    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, GROUND + 2, 40, 6, 0, 0, 7); c.fill();

    if (have.has('jetpack')) {
      c.fillStyle = STEEL; rr(c, x - 38, top + 4, 14, 40, 6); rr(c, x + 24, top + 4, 14, 40, 6);
      if (S.moving) {
        c.fillStyle = '#ffb03a';
        [x - 31, x + 31].forEach((fx, i) => {
          c.beginPath(); c.moveTo(fx - 6, top + 44);
          c.lineTo(fx, top + 58 + Math.sin(t * 40 + i) * 5); c.lineTo(fx + 6, top + 44); c.fill();
        });
      }
    }
    if (legs) {
      c.fillStyle = STEEL; rr(c, x - 19, base - 2, 11, 36 + step, 3); rr(c, x + 8, base - 2, 11, 36 - step, 3);
      c.fillStyle = col; rr(c, x - 24, GROUND - 8 + Math.min(0, step), 20, 8, 3); rr(c, x + 4, GROUND - 8 + Math.min(0, -step), 20, 8, 3);
    } else {
      c.fillStyle = '#39505e'; circle(c, x - 14, GROUND - 6, 6); circle(c, x + 14, GROUND - 6, 6);
      c.fillStyle = '#6c8594'; circle(c, x - 14, GROUND - 6, 2); circle(c, x + 14, GROUND - 6, 2);
    }
    const arm = side => {
      const ax = side < 0 ? x - 40 : x + 28;
      const swing = S.moving ? Math.sin(t * 16 + (side < 0 ? 0 : Math.PI)) * 3 : 0;
      c.fillStyle = col; circle(c, ax + 6, top + 10, 7);
      c.fillStyle = STEEL; rr(c, ax + 1, top + 12, 10, 30 + swing, 3);
      c.strokeStyle = STEEL; c.lineWidth = 4; c.lineCap = 'round';
      const cy = top + 42 + swing;
      c.beginPath(); c.moveTo(ax + 4, cy); c.lineTo(ax - 1, cy + 8); c.moveTo(ax + 8, cy); c.lineTo(ax + 13, cy + 8); c.stroke();
    };
    if (have.has('armL')) arm(-1);
    if (have.has('armR')) arm(1);

    c.fillStyle = col; rr(c, x - 28, top, 56, 54, 9);
    c.fillStyle = 'rgba(0,0,0,0.18)'; rr(c, x - 28, top + 40, 56, 14, [0, 0, 9, 9]);
    c.fillStyle = DARK; rr(c, x - 18, top + 10, 36, 22, 4);
    const lights = ['#ff5a5a', '#f5c518', '#7cf08a'];
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i < Math.ceil(have.size / 2) ? lights[i] : '#33434e';
      circle(c, x - 10 + i * 10, top + 21, 3.5);
    }
    c.fillStyle = 'rgba(255,255,255,0.35)'; circle(c, x - 22, top + 6, 2); circle(c, x + 22, top + 6, 2);

    let headTop = top;
    if (have.has('head')) {
      headTop = top - 34;
      c.fillStyle = STEEL; c.fillRect(x - 6, top - 6, 12, 8);
      c.fillStyle = col; rr(c, x - 21, headTop, 42, 30, 8);
      c.fillStyle = DARK; rr(c, x - 15, headTop + 8, 30, 13, 5);
      const blink = (t % 3.2) < 0.12;
      c.fillStyle = '#bff6ff';
      if (blink) { c.fillRect(x - 10, headTop + 14, 8, 2); c.fillRect(x + 2, headTop + 14, 8, 2); }
      else {
        const look = S.vx > 20 ? 2 : S.vx < -20 ? -2 : 0;
        circle(c, x - 6 + look, headTop + 14.5, 3.5); circle(c, x + 6 + look, headTop + 14.5, 3.5);
      }
    }
    if (have.has('antenna')) {
      c.strokeStyle = STEEL; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, headTop); c.lineTo(x, headTop - 18); c.stroke();
      c.fillStyle = Math.sin(t * 8) > 0 ? '#ff4d4d' : '#ffb3b3'; circle(c, x, headTop - 21, 5);
    }
    K.drawBee(c,x+48,top-22+Math.sin(t*3)*4,28,t);
  }

  function drawSheet(c, have) {
    const pad = 44, gap = 4, y = 40, h = 20;
    const w = (W - pad * 2 - gap * 5) / 6;
    c.font = '700 10px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    PARTS.forEach((p, i) => {
      const x = pad + i * (w + gap), on = have.has(p);
      c.fillStyle = on ? '#5ad1e6' : 'rgba(23,39,51,0.85)'; rr(c, x, y, w, h, 4);
      if (!on) { c.strokeStyle = '#223845'; c.lineWidth = 1; c.setLineDash([3, 2]); K.rrPath(c, x + 0.5, y + 0.5, w - 1, h - 1, 4); c.stroke(); c.setLineDash([]); }
      c.fillStyle = on ? '#0f1a23' : '#6f8796';
      c.fillText(NAMES[p].toUpperCase(), x + w / 2, y + h / 2 + 1);
    });
  }

  Arcade.register({
    id: 'scrap-yard-bot',
    title: 'Bee Yard Bot',
    cat: 'action',
    blurb: 'Catch parts to build robot helpers for the beehives.',
    rules: [
      'Catch all six parts to ship your model and move up a mark.',
      'Each part is a perk: legs run faster, the head doubles gear points, the antenna pulls in gears.',
      'A bomb knocks a part off. Get hit with no parts left and you are scrap.'
    ],
    how: '← → or A / D to move · drag on a touch screen',
    accent: '#f5c518',
    touch: ['left', 'right'],

    thumb(ctx, w, h) {
      // a close crop of the assembly floor: a half-built bot reaching for its next part
      const s = w / 400;
      ctx.save();
      ctx.scale(s, s);
      ctx.translate(-40, -(GROUND - 200));
      drawBackground(ctx);
      const demo = { px: 236, have: new Set(['legs', 'armL', 'head', 'antenna']), level: 2, t: 0.2, moving: true, vx: 60 };
      const items = [
        ['gear', 112, GROUND - 168, 0.4], ['armR', 330, GROUND - 112, -0.35], ['bomb', 386, GROUND - 150, 0.15],
        ['gear', 150, GROUND - 76, 1.1], ['jetpack', 402, GROUND - 58, -0.3]
      ];
      for (const [type, x, y, rot] of items) {
        ctx.save(); ctx.translate(x, y);
        if (PARTS.includes(type)) {
          ctx.fillStyle = 'rgba(90,209,230,0.16)'; circle(ctx, 0, 0, 27);
          ctx.strokeStyle = 'rgba(90,209,230,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); ctx.stroke();
        }
        ctx.rotate(type === 'bomb' ? Math.sin(rot) * 0.3 : rot);
        drawIcon(ctx, type, PLATING[1], 0.1);
        ctx.restore();
      }
      drawRobot(ctx, demo);
      const sparks = [[196, GROUND - 150, '#e0c064'], [206, GROUND - 162, '#e0c064'], [184, GROUND - 158, '#f5c518'], [214, GROUND - 146, '#e0c064']];
      for (const [x, y, c] of sparks) { ctx.fillStyle = c; ctx.fillRect(x - 2, y - 2, 4, 4); }
      ctx.fillStyle = '#e0c064'; ctx.font = '700 15px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('+20', 200, GROUND - 172);
      ctx.restore();
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const bg = K.layer(W, H, drawBackground, 2);
      const beep = (f, dur, type, vol, slide, delay) => api.tone(f, dur || 0.08, type || 'square', vol == null ? 0.06 : vol, slide || 0, delay || 0);
      const S = {
        running: true, over: false, score: 0, level: 1, have: new Set(),
        px: W / 2, vx: 0, target: null, items: [], parts: [],
        spawnT: 0.6, t: 0, shake: 0, flash: 0, msg: null, moving: false
      };
      const plating = () => PLATING[(S.level - 1) % PLATING.length];
      api.stat('Model', 'MK-1');

      api.on(cv.el, 'pointerdown', e => { S.target = cv.toLocal(e).x; K.capture(cv.el, e); });
      api.on(cv.el, 'pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) S.target = cv.toLocal(e).x; });

      const speed = () => 260 + (S.have.has('legs') ? 80 : 0) + (S.have.has('jetpack') ? 110 : 0);
      const reach = () => 30 + (S.have.has('armL') ? 14 : 0) + (S.have.has('armR') ? 14 : 0);
      function robotTop() {
        let y = (S.have.has('legs') ? GROUND - 42 : GROUND - 12) - 54;
        if (S.have.has('head')) y -= 34;
        return y;
      }
      function spawn() {
        const pBomb = Math.min(0.42, 0.24 + S.level * 0.03);
        const r = Math.random();
        let type;
        if (r < pBomb && S.t > 3) type = 'bomb';
        else if (r < pBomb + 0.34) {
          const missing = PARTS.filter(p => !S.have.has(p));
          type = (missing.length && Math.random() < 0.7) ? K.pick(missing) : K.pick(PARTS);
        } else type = 'gear';
        S.items.push({
          type, x: 50 + Math.random() * (W - 100), y: 10, r: 20,
          vy: 120 + S.level * 22 + Math.random() * 70,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3
        });
      }
      function burst(x, y, color, n, power) {
        n = n || 14; power = power || 220;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, s = power * (0.3 + Math.random() * 0.7);
          S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6 + Math.random() * 0.4, color, size: 2 + Math.random() * 3 });
        }
      }
      const say = (text, color) => { S.msg = { text, color: color || '#f5c518', t: 1.4 }; };
      const floatText = (text, x, y, color) => S.parts.push({ x, y, vx: 0, vy: -70, life: 0.9, text, color });
      function hud() { api.score(S.score); api.stat('Model', 'MK-' + S.level); }

      function explode(it) {
        S.shake = 0.35; S.flash = 0.25;
        burst(it.x, it.y, '#ff9d2e', 22, 320); burst(it.x, it.y, '#3a3f44', 10, 180);
        beep(140, 0.35, 'sawtooth', 0.09, -100);
      }
      function shipModel() {
        const bonus = 200 * S.level;
        S.score += bonus;
        say('MK-' + S.level + ' SHIPPED! +' + bonus, '#7cf08a');
        for (let i = 0; i < 5; i++) burst(S.px, robotTop() + 40, PLATING[(S.level + i) % PLATING.length], 14, 360);
        [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.14, 'square', 0.05, 0, i * 0.11));
        S.level++; S.have.clear(); S.flash = 0.3;
      }
      function gameOver() {
        S.running = false; S.over = true; S.shake = 0.5;
        for (let i = 0; i < 3; i++) burst(S.px, GROUND - 40, '#ff6b3d', 20, 300);
        api.gameOver({ score: S.score, title: 'Scrapped', detail: 'You reached MK-' + S.level + '.', delay: 750 });
      }
      function catchItem(it) {
        const col = plating();
        if (it.type === 'gear') {
          const pts = S.have.has('head') ? 20 : 10;
          S.score += pts; burst(it.x, it.y, '#e0c064', 8, 140); beep(880, 0.06, 'square', 0.04);
          floatText('+' + pts, it.x, it.y, '#e0c064');
        } else if (it.type === 'bomb') {
          explode(it);
          if (S.have.size === 0) { gameOver(); return; }
          const lost = K.pick([...S.have]);
          S.have.delete(lost);
          S.parts.push({ x: S.px, y: robotTop() + 30, vx: (Math.random() < 0.5 ? -1 : 1) * 260, vy: -380, life: 1.2, icon: lost, rot: 0, color: col });
          say(NAMES[lost].toUpperCase() + ' LOST', '#ff6b3d');
        } else if (S.have.has(it.type)) {
          S.score += 15; burst(it.x, it.y, STEEL, 8, 120); beep(520, 0.07, 'square', 0.04);
          floatText('SCRAP +15', it.x, it.y, '#b8c6cf');
        } else {
          S.have.add(it.type); S.score += 50;
          burst(it.x, it.y, col, 16, 200);
          beep(660, 0.08, 'square', 0.05); beep(990, 0.1, 'square', 0.05, 0, 0.07);
          floatText(NAMES[it.type].toUpperCase() + '!', it.x, it.y, col);
          if (S.have.size === PARTS.length) shipModel();
        }
        hud();
      }

      function stepParticles(dt) {
        S.shake = Math.max(0, S.shake - dt); S.flash = Math.max(0, S.flash - dt);
        for (const p of S.parts) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
          if (!p.text) p.vy += 700 * dt;
          if (p.icon) p.rot += 8 * dt;
        }
        S.parts = S.parts.filter(p => p.life > 0);
        if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      }

      function update(dt) {
        let dir = 0;
        if (api.keys.left) dir -= 1;
        if (api.keys.right) dir += 1;
        if (dir) S.target = null;
        const sp = speed();
        if (S.target != null && !dir) {
          const d = S.target - S.px;
          S.vx = Math.abs(d) < 4 ? 0 : Math.sign(d) * Math.min(sp, Math.abs(d) * 10);
        } else S.vx = dir * sp;
        S.px = Math.max(48, Math.min(W - 48, S.px + S.vx * dt));
        S.moving = Math.abs(S.vx) > 10;

        S.spawnT -= dt;
        if (S.spawnT <= 0) { spawn(); S.spawnT = Math.max(0.32, 0.95 - S.level * 0.08) * (0.7 + Math.random() * 0.6); }

        const top = robotTop();
        const magnet = S.have.has('antenna');
        for (const it of S.items) {
          it.y += it.vy * dt; it.rot += it.vr * dt;
          if (magnet && it.type === 'gear' && it.y > 220) it.x += Math.sign(S.px - it.x) * Math.min(Math.abs(S.px - it.x), 150 * dt);
          const dx = Math.abs(it.x - S.px);
          const hitW = it.type === 'bomb' ? 28 : reach();
          if (!it.dead && it.y + it.r * 0.6 > top && it.y - it.r < GROUND && dx < hitW + it.r * 0.5) {
            it.dead = true; catchItem(it);
            if (!S.running) break;
          } else if (!it.dead && it.y > GROUND - 6) {
            it.dead = true;
            if (it.type === 'bomb') { burst(it.x, GROUND - 4, '#ff9d2e', 10, 160); beep(200, 0.15, 'sawtooth', 0.04, -120); }
            else burst(it.x, GROUND - 4, '#4a6272', 5, 90);
          }
        }
        S.items = S.items.filter(it => !it.dead);
      }

      function render() {
        ctx.save();
        if (S.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * S.shake, (Math.random() - 0.5) * 14 * S.shake);
        ctx.drawImage(bg, 0, 0, W, H);
        drawSheet(ctx, S.have);
        for (const it of S.items) {
          ctx.save(); ctx.translate(it.x, it.y);
          if (PARTS.includes(it.type)) {
            const needed = !S.have.has(it.type);
            ctx.fillStyle = needed ? 'rgba(90,209,230,0.16)' : 'rgba(139,154,166,0.1)';
            circle(ctx, 0, 0, 26 + (needed ? Math.sin(S.t * 6) * 2 : 0));
            if (needed) { ctx.strokeStyle = 'rgba(90,209,230,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.stroke(); }
          }
          ctx.rotate(it.type === 'bomb' ? Math.sin(it.rot) * 0.3 : it.rot);
          drawIcon(ctx, it.type, plating(), S.t);
          ctx.restore();
        }
        if (!S.over) drawRobot(ctx, S);
        for (const p of S.parts) {
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
          if (p.text) {
            ctx.fillStyle = p.color; ctx.font = '700 15px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(p.text, p.x, p.y);
          } else if (p.icon) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); drawIcon(ctx, p.icon, p.color, S.t); ctx.restore();
          } else {
            ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          }
        }
        ctx.globalAlpha = 1;
        if (S.msg) {
          ctx.globalAlpha = Math.min(1, S.msg.t * 2);
          ctx.font = '26px "Bungee", "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(S.msg.text, W / 2 + 2, 152);
          ctx.fillStyle = S.msg.color; ctx.fillText(S.msg.text, W / 2, 150);
          ctx.globalAlpha = 1;
        }
        if (S.flash > 0) { ctx.fillStyle = 'rgba(255,240,200,' + (S.flash * 0.6) + ')'; ctx.fillRect(0, 0, W, H); }
        ctx.restore();
      }

      say('BUILD YOURSELF!');
      hud();
      api.loop(dt => {
        S.t += dt;
        if (S.running) update(dt);
        stepParticles(dt);
        render();
      });
    }
  });
})();
