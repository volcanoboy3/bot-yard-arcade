/* Robo Runner · an endless run down the factory conveyor. Jump crates, barrels and
 * crate stacks, duck under drones, and grab the bolts floating along the way. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;
  const W = 800, H = 400, GROUND = 330, BOT_X = 150, BOT_H = 70;
  // jump: light gravity while jump is held on the way up, heavier once released, heaviest falling
  const JUMP_V = 760, G_HOLD = 1900, G_RISE = 3000, G_FALL = 4300, FAST_FALL = 5200;
  const PX_PER_M = 40;
  const FAR_W = 1600, MID_W = 1600;

  // ---------- static art ----------
  function drawFar(c) {
    const g = c.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#0b151d'); g.addColorStop(1, '#172a38');
    c.fillStyle = g; c.fillRect(0, 0, FAR_W, GROUND);
    // hazy glow near the horizon
    const hz = c.createLinearGradient(0, 150, 0, GROUND);
    hz.addColorStop(0, 'rgba(245,197,24,0)'); hz.addColorStop(1, 'rgba(245,197,24,0.06)');
    c.fillStyle = hz; c.fillRect(0, 150, FAR_W, GROUND - 150);
    // factory silhouettes (the tile wraps at FAR_W)
    const sil = '#13232f', sil2 = '#10202b';
    let x = 0;
    const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    while (x < FAR_W) {
      const w = 90 + rnd() * 120, h = 60 + rnd() * 90, kind = rnd();
      const top = GROUND - h;
      c.fillStyle = kind < 0.5 ? sil : sil2;
      c.fillRect(x, top, w, h);
      if (kind < 0.35) {                     // saw-tooth roof
        for (let i = 0; i < w; i += 30) { c.beginPath(); c.moveTo(x + i, top); c.lineTo(x + i + 30, top); c.lineTo(x + i + 30, top - 16); c.closePath(); c.fill(); }
      } else if (kind < 0.6) {               // chimney
        c.fillRect(x + w * 0.6, top - 70, 14, 70);
        c.fillStyle = 'rgba(255,107,61,0.35)'; c.fillRect(x + w * 0.6, top - 72, 14, 3);
      } else if (kind < 0.8) {               // tank
        c.beginPath(); c.ellipse(x + w / 2, top, w * 0.35, 22, 0, Math.PI, 0); c.fill();
      }
      c.fillStyle = 'rgba(245,197,24,0.18)';
      for (let wy = top + 14; wy < GROUND - 12; wy += 22) for (let wx = x + 10; wx < x + w - 14; wx += 26) if (rnd() < 0.22) c.fillRect(wx, wy, 8, 5);
      x += w + rnd() * 30;
    }
  }
  function drawMid(c) {
    // big pipes along the wall, flanges, vertical drops and valves
    const pipe = (y, h, col) => {
      c.fillStyle = col; c.fillRect(0, y, MID_W, h);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(0, y + 2, MID_W, Math.max(2, h * 0.18));
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y + h - Math.max(2, h * 0.2), MID_W, Math.max(2, h * 0.2));
    };
    pipe(52, 24, '#23394a');
    pipe(92, 10, '#1f3443');
    for (let x = 60; x < MID_W; x += 200) {
      c.fillStyle = '#2d4758'; c.fillRect(x, 48, 12, 32);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 2, 50, 3, 28);
    }
    for (let x = 140; x < MID_W; x += 400) {
      c.fillStyle = '#1d3140'; c.fillRect(x, 76, 18, GROUND - 76);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + 3, 76, 4, GROUND - 76);
      c.fillStyle = '#2d4758'; c.fillRect(x - 3, 180, 24, 10);
      c.fillStyle = C.hazard; K.circle(c, x + 9, 170, 9);
      c.fillStyle = '#b8321a'; c.fillRect(x + 1, 168, 16, 4);
    }
    // hanging lamps
    for (let x = 300; x < MID_W; x += 400) {
      c.strokeStyle = '#2d4758'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 102); c.lineTo(x, 132); c.stroke();
      c.fillStyle = '#39505e'; c.beginPath(); c.moveTo(x - 16, 146); c.lineTo(x - 7, 132); c.lineTo(x + 7, 132); c.lineTo(x + 16, 146); c.closePath(); c.fill();
      const lg = c.createRadialGradient(x, 150, 2, x, 170, 90);
      lg.addColorStop(0, 'rgba(255,236,170,0.22)'); lg.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(x - 16, 146); c.lineTo(x - 90, GROUND); c.lineTo(x + 90, GROUND); c.lineTo(x + 16, 146); c.closePath(); c.fill();
      c.fillStyle = '#fff3c4'; c.fillRect(x - 9, 145, 18, 3);
    }
  }
  function drawBelt(c) {
    // the conveyor frame below the belt (static; rollers and treads move on top)
    c.fillStyle = '#0d171e'; c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = '#1b2a35'; c.fillRect(0, GROUND, W, 16);
    c.fillStyle = '#2b4353'; c.fillRect(0, GROUND, W, 3);
    c.fillStyle = '#16232c'; c.fillRect(0, GROUND + 16, W, 26);
    c.fillStyle = '#4a6272'; c.font = K.font(10, 'body'); c.textAlign = 'left'; c.textBaseline = 'middle';
    for (let x = 14; x < W; x += 400) c.fillText('LINE 3 · OUTBOUND', x, GROUND + 50);
    K.hazard(c, 0, H - 13, W, 13, { stripe: 14 });
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, H - 13, W, 13);
  }

  // ---------- sprites ----------
  function drawCrate(c, x, y, w, h, spikes) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 4, y + 6, w, h - 4);
    c.fillStyle = '#4a6272'; K.rr(c, x, y, w, h, 4);
    c.fillStyle = '#39505e'; K.rr(c, x + 5, y + 5, w - 10, h - 10, 2);
    c.strokeStyle = '#5d7688'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x + 7, y + 7); c.lineTo(x + w - 7, y + h - 7); c.moveTo(x + w - 7, y + 7); c.lineTo(x + 7, y + h - 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + 3, y + 2, w - 6, 2);
    K.hazard(c, x, y + h - 7, w, 7, { stripe: 6 });
    c.fillStyle = '#c9d4db';
    for (const [rx, ry] of [[x + 4, y + 4], [x + w - 4, y + 4]]) K.circle(c, rx, ry, 1.6);
    if (spikes) {
      const n = Math.max(3, Math.round(w / 12)), sw = w / n;
      for (let i = 0; i < n; i++) {
        const sx = x + i * sw;
        c.fillStyle = '#8b9aa6';
        c.beginPath(); c.moveTo(sx + 1, y); c.lineTo(sx + sw / 2, y - 13); c.lineTo(sx + sw - 1, y); c.closePath(); c.fill();
        c.fillStyle = '#e6eef2';
        c.beginPath(); c.moveTo(sx + sw / 2, y - 13); c.lineTo(sx + sw / 2 + 2, y); c.lineTo(sx + 2, y); c.closePath(); c.fill();
      }
    }
  }
  function drawBarrel(c, x, y, r, rot) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, GROUND + 2, r * 0.9, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8a2f14'; K.circle(c, x, y, r);
    c.fillStyle = C.hazard; K.circle(c, x, y, r - 3);
    c.strokeStyle = '#b8421f'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y, r * 0.66, 0, Math.PI * 2); c.stroke();
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#1a1a1a';
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 0.55, a - 0.45, a + 0.45); c.closePath(); c.fill();
    }
    c.fillStyle = C.safety; K.circle(c, 0, 0, r * 0.16);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.45, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2); c.fill();
  }
  function drawDrone(c, x, y, w, h, t) {
    const cx = x + w / 2, cy = y + h / 2;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx, GROUND + 2, w * 0.4, 4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#8b9aa6'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - w * 0.2, cy - 4); c.lineTo(cx - w * 0.46, cy - 11); c.moveTo(cx + w * 0.2, cy - 4); c.lineTo(cx + w * 0.46, cy - 11); c.stroke();
    for (const sx of [-1, 1]) {
      const rx = cx + sx * w * 0.46, spin = Math.abs(Math.sin(t * 40 + sx));
      c.fillStyle = 'rgba(191,246,255,0.35)';
      c.beginPath(); c.ellipse(rx, cy - 13, 14 * spin + 3, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#39505e'; K.circle(c, rx, cy - 12, 3);
    }
    c.fillStyle = '#1b2a35'; K.rr(c, x + w * 0.16, y + 4, w * 0.68, h - 8, 9);
    c.fillStyle = '#2b4353'; K.rr(c, x + w * 0.2, y + 6, w * 0.6, 5, 2);
    K.hazard(c, x + w * 0.22, y + h - 9, w * 0.56, 4, { stripe: 4 });
    const blink = Math.sin(t * 9) > 0;
    c.fillStyle = 'rgba(255,77,77,0.3)'; K.circle(c, cx - 6, cy + 1, 8);
    c.fillStyle = blink ? '#ff4d4d' : '#b82d2d'; K.circle(c, cx - 6, cy + 1, 5);
    c.fillStyle = '#ffd0d0'; K.circle(c, cx - 7.5, cy - 0.5, 1.6);
  }
  function drawBoltPickup(c, x, y, t, i) {
    const bob = Math.sin(t * 4 + i) * 3;
    c.fillStyle = 'rgba(224,192,100,0.18)'; K.circle(c, x, y + bob, 15);
    K.drawBee(c, x, y + bob, 28, t);
  }

  Arcade.register({
    id: 'robo-runner',
    title: 'Robo Bee Runner',
    cat: 'action',
    blurb: 'Race through the bee yard and collect flying bee tokens.',
    rules: [
      'Your bot races along the factory conveyor. It speeds up as you go.',
      'Jump over crates and barrels. Hold jump to clear the tall stacks.',
      'Duck under the flying drones. One bump and your run is over.',
      'Score a point per metre and 10 per bolt.'
    ],
    how: 'Space, ↑ or tap to jump (hold for higher) · ↓ to duck',
    accent: '#f5c518',
    usesPlayer: true,
    touch: [{ key: 'up', label: 'Jump' }, { key: 'down', label: 'Duck' }],
    _live: null,   // read-only view of the running game, for automated tests

    thumb(ctx, w, h, kit, player) {
      const s = h / H;
      ctx.save(); ctx.scale(s, s); ctx.translate(-60, 0);
      ctx.drawImage(kit.layer(FAR_W, GROUND, drawFar, 0.6), -200, 0, FAR_W, GROUND);
      ctx.drawImage(kit.layer(MID_W, GROUND, drawMid, 0.6), -120, 0, MID_W, GROUND);
      K.gear(ctx, 470, 214, 46, { teeth: 12, color: '#243c4c', rot: 0.3, hole: '#132330' });
      K.gear(ctx, 536, 248, 28, { teeth: 9, color: '#2b4556', rot: 0.9, hole: '#132330' });
      drawBelt(ctx);
      drawCrate(ctx, 214, GROUND - 40, 46, 40, true);
      drawDrone(ctx, 420, GROUND - 76, 56, 30, 0.2);
      drawCrate(ctx, 610, GROUND - 96, 52, 48, false); drawCrate(ctx, 610, GROUND - 48, 52, 48, false);
      for (let i = 0; i < 5; i++) drawBoltPickup(ctx, 250 + i * 34, GROUND - 60 - Math.sin(i / 4 * Math.PI) * 80, 0, i);
      ctx.save(); ctx.translate(180, GROUND - 92); ctx.rotate(-0.1);
      kit.drawBot(ctx, 0, -BOT_H * 0.495 * 1.3, BOT_H * 1.3, Object.assign({}, player, { t: 0.3, walk: true, arms: 'up', mood: 'happy', look: 1 }));
      ctx.restore();
      K.text(ctx, '412 m', 90, 34, { size: 28, color: C.safety, align: 'left' });
      ctx.restore();
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const fx = K.particles(), shake = K.shaker();
      const far = K.layer(FAR_W, GROUND, drawFar, 1.5);
      const mid = K.layer(MID_W, GROUND, drawMid, 1.5);
      const belt = K.layer(W, H, drawBelt, 2);
      const vignette = K.layer(W, H, c => K.vignette(c, W, H, 0.4));

      const bot = { y: GROUND, vy: 0, ground: true, duck: false, coyote: 0, buffer: 0, squash: 0, rot: 0, dead: false, dx: 0, deadVx: 0, air: 0 };
      const obstacles = [], bolts = [];
      let speed = 360, dist = 0, boltsGot = 0, score = 0, shownScore = -1, time = 0, scrollFar = 0, scrollMid = 0, scrollBelt = 0;
      let nextSpawn = 700, state = 'ready', readyT = 0, deadT = 0, dustT = 0, milestone = 0;
      let pointerHeld = false, hint = { text: 'HOLD JUMP TO FLY HIGHER', t: 4.2 }, droneHinted = false;
      // a narrow portrait phone shows the landscape track small, so suggest turning it
      if (api.isTouch && window.innerHeight > window.innerWidth * 1.2) {
        api.after(4400, () => { if (!hint) hint = { text: 'TIP: TURN YOUR PHONE SIDEWAYS', t: 3 }; });
      }

      const held = () => api.keys.up || api.keys.fire || pointerHeld;
      const metres = () => Math.floor(dist / PX_PER_M);
      function setScore() {
        score = metres() + boltsGot * 10;
        if (score !== shownScore) { shownScore = score; api.score(score); }
      }

      // ---------- input ----------
      function pressJump() { if (!bot.dead) bot.buffer = 0.13; }
      api.onKey((name, e) => {
        if (e.repeat) return;
        if (name === 'up' || name === 'fire') pressJump();
      });
      api.on(cv.el, 'pointerdown', e => { K.capture(cv.el, e); pointerHeld = true; pressJump(); });
      const up = () => { pointerHeld = false; };
      api.on(cv.el, 'pointerup', up);
      api.on(cv.el, 'pointercancel', up);
      api.on(cv.el, 'lostpointercapture', up);

      // ---------- spawning ----------
      const difficulty = () => K.clamp(metres() / 1500, 0, 1);
      function pickPattern() {
        const m = metres();
        const list = [['crate', 3], ['barrel', 2]];
        if (m > 90) list.push(['drone', 2.4]);
        if (m > 200) list.push(['stack', 1.8]);
        if (m > 330) list.push(['double', 1.4], ['crateDrone', 1.1]);
        if (m > 550) list.push(['droneCrate', 1.1], ['barrelPair', 0.9]);
        let total = 0;
        for (const [, wt] of list) total += wt;
        let r = Math.random() * total;
        for (const [name, wt] of list) { r -= wt; if (r <= 0) return name; }
        return 'crate';
      }
      function boltArc(x0, x1, peak, n) {
        for (let i = 0; i < n; i++) {
          const k = n === 1 ? 0.5 : i / (n - 1);
          bolts.push({ x: K.lerp(x0, x1, k), y: GROUND - 34 - peak * Math.sin(k * Math.PI), i: Math.random() * 6 });
        }
      }
      function spawn() {
        const x0 = W + 40, v = speed;
        const kind = pickPattern();
        let len = 0;
        const crate = (x, spikes) => { obstacles.push({ type: 'crate', x, w: 46, h: 40, spikes }); };
        const drone = x => {
          obstacles.push({ type: 'drone', x, w: 56, h: 30, top: GROUND - 46 - 30, phase: Math.random() * 6 });
          if (Math.random() < 0.5) for (let i = 0; i < 3; i++) bolts.push({ x: x + 6 + i * 22, y: GROUND - 20, i: i });
          if (!droneHinted) { droneHinted = true; hint = { text: 'DUCK UNDER DRONES', t: 2.6 }; }
        };
        switch (kind) {
          case 'crate': crate(x0, true); len = 46; if (Math.random() < 0.3) boltArc(x0 - 70, x0 + 116, 96, 5); break;
          case 'barrel': obstacles.push({ type: 'barrel', x: x0 + 22, r: 22, roll: 100 + Math.random() * 60, rot: 0 }); len = 44; break;
          case 'drone': drone(x0); len = 56; break;
          case 'stack':
            obstacles.push({ type: 'stack', x: x0, w: 52, h: 100 }); len = 52;
            if (Math.random() < 0.45) boltArc(x0 - 60, x0 + 112, 150, 5);
            break;
          case 'double': crate(x0, true); crate(x0 + 46, true); len = 92; if (Math.random() < 0.4) boltArc(x0 - 60, x0 + 152, 110, 6); break;
          case 'crateDrone': crate(x0, true); drone(x0 + Math.max(260, v * 0.74)); len = 46 + Math.max(260, v * 0.74) + 56; break;
          case 'droneCrate': drone(x0); crate(x0 + Math.max(230, v * 0.6), true); len = 56 + Math.max(230, v * 0.6) + 46; break;
          case 'barrelPair':
            obstacles.push({ type: 'barrel', x: x0 + 22, r: 22, roll: 110, rot: 0 });
            obstacles.push({ type: 'barrel', x: x0 + 22 + Math.max(300, v * 0.8), r: 22, roll: 110, rot: 1 });
            len = 44 + Math.max(300, v * 0.8);
            break;
        }
        const gapT = K.lerp(1.3, 0.74, difficulty()) + Math.random() * K.lerp(0.7, 0.45, difficulty());
        const gap = v * gapT;
        if (Math.random() < 0.22) {                      // free-floating bolts in the gap
          const gx = x0 + len + gap * 0.35;
          if (Math.random() < 0.5) boltArc(gx, gx + 150, 70 + Math.random() * 50, 5);
          else for (let i = 0; i < 4; i++) bolts.push({ x: gx + i * 30, y: GROUND - 26, i });
        }
        nextSpawn = len + gap;
      }

      // ---------- collisions ----------
      function botBox() {
        const d = bot.duck && bot.ground;
        return d ? { x: BOT_X - 21, y: bot.y - 32, w: 42, h: 30 } : { x: BOT_X - 16, y: bot.y - 58, w: 32, h: 56 };
      }
      function hits(o, b) {
        if (o.type === 'barrel') {
          const cx = o.x, cy = GROUND - o.r, rr = o.r - 4;
          const nx = K.clamp(cx, b.x, b.x + b.w), ny = K.clamp(cy, b.y, b.y + b.h);
          return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < rr * rr;
        }
        let box;
        if (o.type === 'crate') box = { x: o.x + 4, y: GROUND - o.h - 8, w: o.w - 8, h: o.h + 8 };
        else if (o.type === 'stack') box = { x: o.x + 4, y: GROUND - o.h + 2, w: o.w - 8, h: o.h - 2 };
        else box = { x: o.x + 7, y: o.top + 5, w: o.w - 14, h: o.h - 8 };
        return K.overlap(box, b);
      }
      function crash() {
        bot.dead = true; state = 'dead'; deadT = 0;
        bot.vy = -620; bot.ground = false; bot.deadVx = -140;
        shake.add(0.55);
        fx.burst(BOT_X + 14, bot.y - 30, [C.safety, '#fff3a0', C.hazard, '#ffffff'], 34, 380, { size: 4, life: 0.8 });
        fx.burst(BOT_X, bot.y - 30, [api.player.body, C.steel], 14, 260, { size: 5, life: 1 });
        api.sfx('boom');
        const m = metres();
        api.after(1100, () => api.gameOver({
          score,
          title: 'Crashed at ' + m + ' m',
          detail: 'You ran ' + m + ' m and grabbed ' + boltsGot + (boltsGot === 1 ? ' bee token.' : ' bee tokens.')
        }));
      }

      // ---------- update ----------
      function update(dt) {
        const running = state === 'run' || state === 'ready';
        if (state === 'ready') {
          readyT += dt;
          if (readyT > 1.1) state = 'run';
        }
        if (running) {
          const m = metres();
          speed = 360 + 430 * (1 - Math.exp(-m / 900));
          dist += speed * dt;
          if (m >= milestone + (milestone < 500 ? 100 : 250)) {
            milestone = m - (m % (milestone < 500 ? 100 : 250));
            api.toast(milestone + ' m');
            api.tone(880, 0.08, 'square', 0.04); api.tone(1320, 0.12, 'square', 0.04, 0, 0.08);
          }
        } else speed = Math.max(0, speed - speed * 3.5 * dt);
        scrollFar = (scrollFar + speed * 0.08 * dt) % FAR_W;
        scrollMid = (scrollMid + speed * 0.32 * dt) % MID_W;
        scrollBelt = (scrollBelt + speed * dt) % 48;

        // the bot
        bot.buffer = Math.max(0, bot.buffer - dt);
        bot.coyote = bot.ground ? 0.09 : Math.max(0, bot.coyote - dt);
        const wantDuck = api.keys.down && !bot.dead;
        if (!bot.dead) {
          if (bot.buffer > 0 && (bot.ground || bot.coyote > 0)) {
            bot.vy = -JUMP_V; bot.ground = false; bot.coyote = 0; bot.buffer = 0; bot.squash = -0.14; bot.air = 0;
            api.sfx('jump');
            fx.burst(BOT_X - 6, GROUND - 2, ['#6f8796', '#8b9aa6'], 8, 120, { size: 3, life: 0.4, lift: 20, gravity: 300 });
          }
          bot.duck = wantDuck && bot.ground;
        }
        if (bot.dead) {
          // tumble backwards and come to rest on the belt, lying on its back
          bot.vy += G_FALL * dt; bot.y += bot.vy * dt;
          bot.rot = Math.max(-1.45, bot.rot - 5 * dt);
          bot.dx += bot.deadVx * dt; bot.deadVx *= Math.pow(0.15, dt);
          const rest = GROUND - 26 * Math.abs(Math.sin(bot.rot));
          if (bot.y >= rest && bot.vy > 0) {
            bot.y = rest;
            if (bot.vy > 260) { bot.vy = -bot.vy * 0.35; fx.burst(BOT_X + bot.dx, GROUND - 4, [C.safety, '#fff3a0'], 8, 160, { size: 2.5, life: 0.3 }); api.tone(110, 0.08, 'triangle', 0.05); }
            else bot.vy = 0;
          }
        } else if (!bot.ground) {
          bot.air += dt;
          let g = bot.vy < 0 ? (held() ? G_HOLD : G_RISE) : G_FALL;
          if (wantDuck) g += FAST_FALL;
          bot.vy += g * dt;
          bot.y += bot.vy * dt;
          if (bot.y >= GROUND) {
            const hard = bot.vy;
            bot.y = GROUND; bot.vy = 0; bot.ground = true; bot.squash = 0.16;
            fx.burst(BOT_X + 4, GROUND - 3, [C.safety, '#fff3a0', '#ffffff'], hard > 900 ? 14 : 8, hard > 900 ? 220 : 150, { size: 2.5, life: 0.35, lift: 90 });
            api.tone(140, 0.07, 'triangle', 0.045);
            if (hard > 1000) shake.add(0.08);
          }
        }
        bot.squash *= Math.pow(0.001, dt);
        if (bot.dead) deadT += dt;

        // dust from the wheels, sparks while ducking
        if (bot.ground && !bot.dead && speed > 1) {
          dustT -= dt;
          if (dustT <= 0) {
            dustT = bot.duck ? 0.03 : 0.06;
            if (bot.duck) fx.burst(BOT_X - 18, GROUND - 3, [C.safety, '#fff3a0'], 2, 160, { size: 2, life: 0.25, lift: 60, gravity: 500 });
            else fx.burst(BOT_X - 16, GROUND - 4, ['#4a6272', '#6f8796'], 1, 80, { size: 3.5, life: 0.45, lift: 30, gravity: -40 });
          }
        }

        // world
        if (running) {
          nextSpawn -= speed * dt;
          if (nextSpawn <= 0 && state === 'run') spawn();
        }
        const b = botBox();
        for (const o of obstacles) {
          o.x -= (speed + (o.type === 'barrel' && running ? o.roll : 0)) * dt;
          if (o.type === 'barrel') o.rot -= ((speed + o.roll) / o.r) * dt;
          if (!bot.dead && hits(o, b)) crash();
        }
        let n = 0;
        for (let i = 0; i < obstacles.length; i++) if (obstacles[i].x > -160) obstacles[n++] = obstacles[i];
        obstacles.length = n;
        for (const bl of bolts) {
          bl.x -= speed * dt;
          if (!bl.got && !bot.dead) {
            const nx = K.clamp(bl.x, b.x - 8, b.x + b.w + 8), ny = K.clamp(bl.y, b.y - 8, b.y + b.h + 8);
            if (Math.abs(bl.x - nx) < 6 && Math.abs(bl.y - ny) < 6) {
              bl.got = true; boltsGot++;
              fx.burst(bl.x, bl.y, [C.gold, '#fff3a0'], 8, 150, { size: 2.5, life: 0.4 });
              fx.float('+10', bl.x, bl.y - 16, C.gold, { size: 16, life: 0.7 });
              api.tone(1200 + (boltsGot % 5) * 90, 0.06, 'square', 0.035);
              api.stat('Bolts', boltsGot);
            }
          }
        }
        n = 0;
        for (let i = 0; i < bolts.length; i++) if (bolts[i].x > -30 && !bolts[i].got) bolts[n++] = bolts[i];
        bolts.length = n;
        if (hint) { hint.t -= dt; if (hint.t <= 0) hint = null; }
        setScore();
      }

      // ---------- render ----------
      function render() {
        ctx.save();
        shake.apply(ctx, 12);
        ctx.drawImage(far, -scrollFar, 0, FAR_W, GROUND);
        ctx.drawImage(far, FAR_W - scrollFar, 0, FAR_W, GROUND);
        ctx.drawImage(mid, -scrollMid, 0, MID_W, GROUND);
        ctx.drawImage(mid, MID_W - scrollMid, 0, MID_W, GROUND);
        // wall gears turning with the mid layer
        for (let i = 0; i < 3; i++) {
          const gx = ((i * 560 + 380 - scrollMid * 1.0) % 1680 + 1680) % 1680 - 120;
          if (gx > -80 && gx < W + 80) {
            const rot = scrollMid / 46;
            K.gear(ctx, gx, 214, 46, { teeth: 12, color: '#243c4c', rot, hole: '#132330' });
            K.gear(ctx, gx + 66, 248, 28, { teeth: 9, color: '#2b4556', rot: -rot * 46 / 28 + 0.2, hole: '#132330' });
          }
        }
        ctx.drawImage(belt, 0, 0, W, H);
        // moving treads and rollers
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        for (let x = -scrollBelt; x < W; x += 24) ctx.fillRect(x, GROUND + 5, 12, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let x = -scrollBelt + 12; x < W; x += 24) ctx.fillRect(x, GROUND + 10, 2, 5);
        const rr = scrollBelt / 48 * Math.PI * 2;
        for (let x = -scrollBelt + 24; x < W + 24; x += 48) {
          ctx.fillStyle = '#2b4353'; K.circle(ctx, x, GROUND + 29, 10);
          ctx.fillStyle = '#39505e'; K.circle(ctx, x, GROUND + 29, 6);
          ctx.strokeStyle = '#6f8796'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(rr) * 7, GROUND + 29 + Math.sin(rr) * 7); ctx.lineTo(x - Math.cos(rr) * 7, GROUND + 29 - Math.sin(rr) * 7); ctx.stroke();
        }
        for (const bl of bolts) drawBoltPickup(ctx, bl.x, bl.y, time, bl.i);
        for (const o of obstacles) {
          if (o.type === 'crate') drawCrate(ctx, o.x, GROUND - o.h, o.w, o.h, true);
          else if (o.type === 'stack') { drawCrate(ctx, o.x, GROUND - o.h, o.w, o.h / 2, false); drawCrate(ctx, o.x, GROUND - o.h / 2, o.w, o.h / 2, false); }
          else if (o.type === 'barrel') drawBarrel(ctx, o.x, GROUND - o.r, o.r, o.rot);
          else drawDrone(ctx, o.x, o.top + Math.sin(time * 5 + o.phase) * 2, o.w, o.h, time);
        }
        drawRunner();
        fx.draw(ctx);
        ctx.restore();
        ctx.drawImage(vignette, 0, 0, W, H);
        // distance readout and hints
        K.text(ctx, metres() + ' m', 20, 30, { size: 26, color: C.safety, align: 'left' });
        if (hint && state !== 'ready') {
          ctx.save(); ctx.globalAlpha = Math.min(1, hint.t * 2);
          K.text(ctx, hint.text, W / 2, 132, { size: api.isTouch ? 30 : 22, color: C.ink });
          ctx.restore();
        }
        if (state === 'ready') {
          ctx.save(); ctx.globalAlpha = Math.min(1, (1.1 - readyT) * 3);
          K.text(ctx, 'READY', W / 2, 90, { size: 40, color: C.safety });
          ctx.restore();
        }
      }
      function drawRunner() {
        const duck = bot.duck && bot.ground && !bot.dead;
        const t = time * (0.6 + speed / 600);
        ctx.save();
        ctx.translate(BOT_X + bot.dx, bot.y);
        if (bot.ground && !bot.dead) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.ellipse(0, 1, duck ? 28 : 22, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (bot.dead) ctx.rotate(bot.rot);
        else ctx.rotate(bot.ground ? 0.07 : K.clamp(bot.vy / 3000, -0.12, 0.2));
        const sx = duck ? 1.18 : 1 + bot.squash * 0.6, sy = duck ? 0.56 : 1 - bot.squash;
        ctx.scale(sx, sy);
        K.drawBot(ctx, 0, -BOT_H * 0.495, BOT_H, Object.assign({}, api.player, {
          t, walk: !bot.dead && speed > 1, look: 1, lookY: duck ? 0.6 : 0,
          mood: bot.dead ? 'wow' : duck ? 'neutral' : 'happy',
          arms: bot.dead ? 'up' : !bot.ground ? 'up' : 'down'
        }));
        ctx.restore();
      }

      Arcade.byId['robo-runner']._live = { bot, get obstacles() { return obstacles; }, get speed() { return speed; }, get state() { return state; }, get metres() { return metres(); } };
      api.loop(dt => {
        time += dt;
        update(dt);
        fx.update(dt); shake.update(dt);
        render();
      });
      api.stat('Bolts', 0);
      setScore();
      api.toast('GO!');
      api.sfx('power');
    }
  });
})();
