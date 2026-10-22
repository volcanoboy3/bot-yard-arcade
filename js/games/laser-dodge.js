/* Laser Dodge: a top-down test arena. Wall turrets flash a warning line, then fire a beam.
 * Dodge beams, plasma orbs and the sweep laser, grab energy cells, survive the waves. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 600, H = 600;
  const WALL = 36, IN0 = WALL, IN1 = W - WALL, SPAN = IN1 - IN0, CELL = 48, SOCKETS = 11;
  const MID = W / 2;
  const BOT_H = 46, R = 12;                       // bot size and hit radius
  const MAX_V = 250, ACC = 2100, FRICTION = 2600;
  const BEAM_W = 22, SWEEP_LEN = 212, SWEEP_W = 16;
  const WAVE_LEN = 15;
  const RED = '#ff5a5a', HOT = '#fff0ee', PLASMA = '#c3a6ff';
  const X0 = IN0 + 17, X1 = IN1 - 17, Y0 = IN0 + 24, Y1 = IN1 - 22;   // where the bot may go
  const sock = i => IN0 + CELL / 2 + CELL * i;    // socket centre along a wall
  const nearSock = v => K.clamp(Math.round((v - IN0 - CELL / 2) / CELL), 0, SOCKETS - 1);
  const SHIELD_COL = ['#ff6b3d', '#ff6b3d', '#f5c518', '#5ad1e6'];

  // ---------- static arena art ----------
  function paintSocket(c, x, y) {
    c.fillStyle = '#0d171e'; K.circle(c, x, y, 10);
    K.ring(c, x, y, 10, 2, '#4a6272');
    c.fillStyle = '#4a1b20'; K.circle(c, x, y, 4.5);
  }
  function paintArena(c) {
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < SOCKETS; i++) {
      for (let j = 0; j < SOCKETS; j++) {
        const x = IN0 + i * CELL, y = IN0 + j * CELL;
        c.fillStyle = (i + j) % 2 ? '#15242e' : '#132029';
        c.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        c.fillStyle = 'rgba(255,255,255,0.045)'; c.fillRect(x + 1, y + 1, CELL - 2, 2);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 1, y + CELL - 3, CELL - 2, 2);
        c.fillStyle = 'rgba(255,255,255,0.07)';
        K.circle(c, x + 6, y + 6, 1.4); K.circle(c, x + CELL - 6, y + 6, 1.4);
        K.circle(c, x + 6, y + CELL - 6, 1.4); K.circle(c, x + CELL - 6, y + CELL - 6, 1.4);
      }
    }
    // hazard wedges in the corners
    for (const [cx, cy, sx, sy] of [[IN0, IN0, 1, 1], [IN1, IN0, -1, 1], [IN0, IN1, 1, -1], [IN1, IN1, -1, -1]]) {
      c.save();
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + sx * 64, cy); c.lineTo(cx, cy + sy * 64); c.closePath(); c.clip();
      K.hazard(c, Math.min(cx, cx + sx * 64), Math.min(cy, cy + sy * 64), 64, 64, { stripe: 8 });
      c.fillStyle = 'rgba(12,21,28,0.55)'; c.fillRect(Math.min(cx, cx + sx * 64), Math.min(cy, cy + sy * 64), 64, 64);
      c.restore();
    }
    // centre hatch (the sweep emitter rises from here)
    c.fillStyle = '#0e1920'; K.circle(c, MID, MID, 30);
    K.ring(c, MID, MID, 30, 3, '#2b4353');
    c.strokeStyle = '#223845'; c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.moveTo(MID + Math.cos(a) * 9, MID + Math.sin(a) * 9); c.lineTo(MID + Math.cos(a) * 28, MID + Math.sin(a) * 28); }
    c.stroke();
    c.fillStyle = '#223845'; K.circle(c, MID, MID, 8);
    c.save(); c.globalAlpha = 0.07;
    K.text(c, 'TEST ARENA 07', MID, IN1 - 64, { size: 24, shadow: false, color: C.ink });
    c.restore();
    // walls
    c.fillStyle = '#1b2d39';
    c.fillRect(0, 0, W, WALL); c.fillRect(0, H - WALL, W, WALL); c.fillRect(0, 0, WALL, H); c.fillRect(W - WALL, 0, WALL, H);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.fillRect(0, 0, W, 12); c.fillRect(0, 0, 12, H);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(0, H - 12, W, 12); c.fillRect(W - 12, 0, 12, H);
    c.fillStyle = '#0b141b';
    c.fillRect(0, 0, W, 2); c.fillRect(0, H - 2, W, 2); c.fillRect(0, 0, 2, H); c.fillRect(W - 2, 0, 2, H);
    c.fillStyle = '#3a5566';
    c.fillRect(IN0 - 3, IN0 - 3, SPAN + 6, 3); c.fillRect(IN0 - 3, IN1, SPAN + 6, 3);
    c.fillRect(IN0 - 3, IN0 - 3, 3, SPAN + 6); c.fillRect(IN1, IN0 - 3, 3, SPAN + 6);
    for (let i = 0; i < SOCKETS; i++) {
      const p = sock(i);
      paintSocket(c, p, WALL / 2); paintSocket(c, p, H - WALL / 2);
      paintSocket(c, WALL / 2, p); paintSocket(c, W - WALL / 2, p);
    }
    for (const [x, y] of [[WALL / 2, WALL / 2], [W - WALL / 2, WALL / 2], [WALL / 2, H - WALL / 2], [W - WALL / 2, H - WALL / 2]]) {
      c.fillStyle = '#0d171e'; K.circle(c, x, y, 15);
      K.ring(c, x, y, 15, 2.5, C.steel);
      c.fillStyle = '#2b4353'; K.circle(c, x, y, 9);
      c.fillStyle = '#4a1b20'; K.circle(c, x, y, 4.5);
    }
  }

  function drawCell(c, x, y, t) {
    c.fillStyle = 'rgba(124,240,138,0.16)'; K.circle(c, x, y, 20 + Math.sin(t * 5) * 2);
    K.ring(c, x, y, 16, 1.5, 'rgba(124,240,138,0.5)');
    K.drawFlower(c, x, y, 27, '#fff0ac'); K.drawBee(c, x + 14, y - 13, 15, t);
  }
  function drawOrbBody(c, x, y, r, t, a) {
    c.globalAlpha = 0.22 * a; c.fillStyle = PLASMA; K.circle(c, x, y, r + 8 + Math.sin(t * 20) * 1.5);
    c.globalAlpha = a; K.circle(c, x, y, r);
    c.fillStyle = '#efe6ff'; K.circle(c, x - r * 0.2, y - r * 0.2, r * 0.5);
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.4;
    c.beginPath();
    for (let k = 0; k < 3; k++) {
      const b = t * 7 + k * 2.1;
      c.moveTo(x + Math.cos(b) * r * 0.3, y + Math.sin(b) * r * 0.3);
      c.lineTo(x + Math.cos(b + 0.5) * r * 0.8, y + Math.sin(b + 0.5) * r * 0.8);
      c.lineTo(x + Math.cos(b + 0.2) * (r + 5), y + Math.sin(b + 0.2) * (r + 5));
    }
    c.stroke();
    c.globalAlpha = 1;
  }
  /** A beam from (ox, oy) along ang. mode 'warn' draws the telegraph, 'fire' the live beam. */
  function drawBeam(c, ox, oy, ang, len, w, mode, k, t) {
    c.save();
    c.translate(ox, oy); c.rotate(ang);
    if (mode === 'warn') {
      c.globalAlpha = 0.07 + 0.08 * k; c.fillStyle = RED; c.fillRect(0, -w / 2, len, w);
      c.globalAlpha = Math.sin(t * (16 + 44 * k)) > -0.3 ? 0.95 : 0.28;
      c.fillRect(0, -1.2, len, 2.4);
    } else {
      c.globalAlpha = 0.22; c.fillStyle = RED; c.fillRect(0, -w / 2 - 8, len, w + 16);
      c.globalAlpha = 1; c.fillRect(0, -w / 2, len, w);
      c.fillStyle = HOT; c.fillRect(0, -w * 0.2, len, w * 0.4);
    }
    c.restore();
  }

  Arcade.register({
    id: 'laser-dodge',
    title: 'Bee Laser Dodge',
    cat: 'action',
    blurb: 'Protect your bee-powered robot and gather flowers between laser sweeps.',
    rules: [
      'A blinking red line means a laser is about to fire. Move!',
      'Flowers are worth 50. Staying alive earns 10 a second.',
      'You have 3 shields. New waves bring faster lasers, orbs and a spin beam.'
    ],
    how: 'Arrows or WASD to move · drag or tap the arena',
    accent: '#ff5a5a',
    usesPlayer: true,
    touch: ['left', 'right', 'up', 'down'],

    thumb(ctx, w, h, kit, player) {
      const s = 0.7;
      ctx.save();
      ctx.scale(s, s);
      ctx.translate(0, -150);
      paintArena(ctx);
      ctx.save();
      ctx.beginPath(); ctx.rect(IN0, IN0, SPAN, SPAN); ctx.clip();
      drawBeam(ctx, IN0, sock(4), 0, SPAN, BEAM_W, 'fire', 1, 0);
      drawBeam(ctx, sock(7), IN0, Math.PI / 2, SPAN, BEAM_W, 'warn', 0.6, 0.05);
      ctx.restore();
      for (const [x, y] of [[WALL / 2, sock(4)], [sock(7), WALL / 2]]) {
        ctx.globalAlpha = 0.45; ctx.fillStyle = RED; kit.circle(ctx, x, y, 17); ctx.globalAlpha = 1;
        ctx.fillStyle = HOT; kit.circle(ctx, x, y, 5.5);
      }
      drawCell(ctx, 330, 390, 0.3);
      drawOrbBody(ctx, 110, 380, 12, 0.4, 1);
      kit.ring(ctx, 214, 352, 36, 3.5, kit.alpha(C.glow, 0.6));
      kit.drawBot(ctx, 214, 352, 68, Object.assign({}, player, { t: 0.5, mood: 'wow', look: -0.6, shadow: true, arms: 'up' }));
      ctx.restore();
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const arenaL = K.layer(W, H, paintArena, 2);
      const vigL = K.layer(W, H, c => K.vignette(c, W, H, 0.42), 1);
      const fx = K.particles(), sh = K.shaker();
      const botOpts = Object.assign({}, api.player, { t: 0, mood: 'happy', look: 0, lookY: 0, walk: false, shadow: true, arms: 'down' });

      const S = {
        t: 0, time: 0, alive: true, wave: 1, shields: 3, inv: 0, cells: 0, score: 0,
        x: MID, y: 400, vx: 0, vy: 0, target: null, drag: false,
        nextAtk: 1.7, orbCD: 2, sweepCD: 2, cellT: 0.4, flash: 0, hurtT: 0, hint: 4
      };
      const lasers = [], orbs = [];
      let cell = null;
      api.score(0);
      api.stat('Shields', 3);
      api.stat('Wave', 1);
      api.toast('WAVE 1');

      // ---------- input ----------
      function setTarget(e) {
        const p = cv.toLocal(e);
        const lift = e.pointerType === 'touch' ? 34 : 0;   // keep the bot visible above a finger
        S.target = { x: K.clamp(p.x, X0, X1), y: K.clamp(p.y - lift, Y0, Y1) };
      }
      api.on(cv.el, 'pointerdown', e => {
        if (!S.alive || api.over) return;
        K.capture(cv.el, e);
        S.drag = true; setTarget(e);
      });
      api.on(cv.el, 'pointermove', e => { if (S.drag && S.alive) setTarget(e); });
      const release = () => { S.drag = false; };
      api.on(cv.el, 'pointerup', release);
      api.on(cv.el, 'pointercancel', release);

      // ---------- attacks ----------
      const warnTime = () => Math.max(0.5, 0.9 - 0.07 * (S.wave - 1));
      function busy(axis, i) { return lasers.some(L => L.kind === 'wall' && L.axis === axis && L.i === i); }
      function wallLaser(axis, i, warn) {
        if (busy(axis, i)) return;
        const p = sock(i), fromStart = Math.random() < 0.5;
        const L = { kind: 'wall', axis, i, len: SPAN, w: BEAM_W, warn, fire: 0.35, t: 0, phase: 'warn' };
        if (axis === 'h') {
          L.ox = fromStart ? IN0 : IN1; L.oy = p; L.ang = fromStart ? 0 : Math.PI;
          L.tx = fromStart ? WALL / 2 : W - WALL / 2; L.ty = p; L.rx = W - L.tx; L.ry = p;
        } else {
          L.ox = p; L.oy = fromStart ? IN0 : IN1; L.ang = fromStart ? Math.PI / 2 : -Math.PI / 2;
          L.tx = p; L.ty = fromStart ? WALL / 2 : H - WALL / 2; L.rx = p; L.ry = H - L.ty;
        }
        lasers.push(L);
      }
      function cornerLaser(ci, warn) {
        const x = ci % 2 ? W - WALL / 2 : WALL / 2, y = ci > 1 ? H - WALL / 2 : WALL / 2;
        const tx = S.x + K.rand(-18, 18), ty = S.y + K.rand(-18, 18);
        lasers.push({ kind: 'diag', ci, ox: x, oy: y, tx: x, ty: y, ang: Math.atan2(ty - y, tx - x), len: 900, w: BEAM_W, warn: warn + 0.15, fire: 0.4, t: 0, phase: 'warn' });
      }
      function sweep() {
        const spin = (Math.random() < 0.5 ? -1 : 1) * K.rand(0.85, 1.05);
        const toBot = Math.atan2(S.y - MID, S.x - MID);
        lasers.push({ kind: 'sweep', ox: MID, oy: MID, ang: toBot + Math.PI * K.rand(0.6, 1.4), spin, len: SWEEP_LEN, w: SWEEP_W, warn: 1.4, fire: Math.PI * 2 / Math.abs(spin), t: 0, phase: 'warn' });
        api.tone(180, 1.2, 'sawtooth', 0.03, 260);
        api.toast('SPIN BEAM!', { color: RED });
      }
      function spawnOrb() {
        let x = MID, y = MID;
        for (let k = 0; k < 20; k++) {
          x = K.rand(IN0 + 50, IN1 - 50); y = K.rand(IN0 + 50, IN1 - 50);
          if (K.dist(x, y, S.x, S.y) > 190) break;
        }
        const a = Math.random() * Math.PI * 2, sp = Math.min(200, 125 + 12 * (S.wave - 4));
        orbs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 11, t: 0, phase: 'spawn', life: K.rand(9, 11) });
        api.tone(420, 0.35, 'sine', 0.04, 380);
        if (!S.orbSeen) { S.orbSeen = true; api.toast('PLASMA ORBS!', { color: PLASMA }); }
      }
      function pickWeighted(pool) {
        let sum = 0;
        for (const p of pool) sum += p[1];
        let r = Math.random() * sum;
        for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
        return pool[0][0];
      }
      function launchAttack() {
        const w = S.wave, warn = warnTime();
        const active = lasers.filter(L => L.kind !== 'sweep').length;
        if (active >= 3 + w) return false;
        const pool = [['single', 3]];
        if (w >= 2) pool.push(['double', 2.2]);
        if (w >= 3) pool.push(['diag', 2], ['cross', 1.2]);
        if (w >= 4) pool.push(['rake', 1.3]);
        if (w >= 6) pool.push(['diag2', 1], ['grid', 1]);
        const kind = pickWeighted(pool);
        const axis = Math.random() < 0.5 ? 'h' : 'v';
        const mine = ax => nearSock(ax === 'h' ? S.y : S.x);
        if (kind === 'single') wallLaser(axis, Math.random() < 0.55 ? mine(axis) : K.randi(0, SOCKETS - 1), warn);
        else if (kind === 'double') {
          if (Math.random() < 0.5) {
            const a = K.randi(0, SOCKETS - 1);
            let b = K.randi(0, SOCKETS - 1);
            while (Math.abs(a - b) < 3) b = K.randi(0, SOCKETS - 1);
            wallLaser(axis, a, warn); wallLaser(axis, b, warn);
          } else { wallLaser('h', K.randi(0, SOCKETS - 1), warn); wallLaser('v', K.randi(0, SOCKETS - 1), warn); }
        } else if (kind === 'cross') { wallLaser('h', mine('h'), warn); wallLaser('v', mine('v'), warn); }
        else if (kind === 'diag') cornerLaser(K.randi(0, 3), warn);
        else if (kind === 'diag2') { const a = K.randi(0, 3); cornerLaser(a, warn); cornerLaser((a + K.randi(1, 3)) % 4, warn); }
        else if (kind === 'rake') {
          const s0 = K.randi(0, 2);
          for (let i = s0; i < SOCKETS; i += 3) wallLaser(axis, i, warn + 0.15);
        } else {
          const a = K.randi(0, 3), b = K.randi(0, 3);
          wallLaser('h', a, warn + 0.1); wallLaser('h', a + K.randi(4, 7), warn + 0.1);
          wallLaser('v', b, warn + 0.1); wallLaser('v', b + K.randi(4, 7), warn + 0.1);
        }
        api.tone(240, Math.min(0.5, warn), 'sawtooth', 0.022, 360);
        return true;
      }

      function spawnCell() {
        let x = MID, y = MID;
        for (let k = 0; k < 30; k++) {
          x = sock(K.randi(0, SOCKETS - 1)); y = sock(K.randi(0, SOCKETS - 1));
          if (K.dist(x, y, S.x, S.y) > 150 && !(x === MID && y === MID)) break;
        }
        cell = { x, y, t: 0 };
      }

      // ---------- damage ----------
      function hurt() {
        S.shields--; S.inv = 1.6; S.hurtT = 0.6; S.flash = 0.5;
        api.stat('Shields', Math.max(0, S.shields));
        sh.add(0.35);
        fx.burst(S.x, S.y, [RED, '#ffd0d0', SHIELD_COL[Math.max(0, S.shields + 1)]], 26, 320, { life: 0.6 });
        if (S.shields <= 0) { die(); return; }
        api.sfx('hit');
        fx.float(S.shields === 1 ? 'LAST SHIELD!' : '-1 SHIELD', S.x, S.y - 38, C.hazard, { size: 24 });
      }
      function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
      function die() {
        S.alive = false; S.drag = false; S.target = null;
        sh.add(0.6);
        fx.burst(S.x, S.y, ['#fff3a0', '#ff9d2e', RED], 40, 420, { life: 0.9, size: 4 });
        fx.burst(S.x, S.y, [C.steel, C.steelDark, api.player.body], 14, 260, { life: 1.1, size: 5 });
        api.sfx('boom');
        const tm = S.time, n = S.cells;
        const title = tm < 20 ? 'Zapped!' : tm < 45 ? 'Shields down' : tm < 90 ? 'Laser pro!' : 'Laser legend!';
        api.gameOver({
          score: S.score, title, delay: 1100,
          detail: 'You survived ' + fmtTime(tm) + (n
            ? ', reached wave ' + S.wave + ' and collected ' + n + ' energy cell' + (n === 1 ? '' : 's') + '.'
            : ' and reached wave ' + S.wave + '.')
        });
      }

      function hitsBot(L) {
        const dx = Math.cos(L.ang), dy = Math.sin(L.ang);
        const rx = S.x - L.ox, ry = S.y - L.oy;
        const along = rx * dx + ry * dy;
        if (along < -R || along > L.len + R) return false;
        return Math.abs(rx * dy - ry * dx) < L.w / 2 + R - 3;
      }

      // ---------- update ----------
      function move(dt) {
        const ix = (api.keys.right ? 1 : 0) - (api.keys.left ? 1 : 0);
        const iy = (api.keys.down ? 1 : 0) - (api.keys.up ? 1 : 0);
        if (ix || iy) S.target = null;
        let tvx = 0, tvy = 0, acc = FRICTION;
        if (ix || iy) {
          const m = Math.hypot(ix, iy);
          tvx = ix / m * MAX_V; tvy = iy / m * MAX_V; acc = ACC;
        } else if (S.target) {
          const dx = S.target.x - S.x, dy = S.target.y - S.y, d = Math.hypot(dx, dy);
          if (d < 2 && !S.drag) S.target = null;
          else if (d > 0.5) { const sp = Math.min(MAX_V, d * 9); tvx = dx / d * sp; tvy = dy / d * sp; acc = ACC * 1.6; }
        }
        const ex = tvx - S.vx, ey = tvy - S.vy, e = Math.hypot(ex, ey), step = acc * dt;
        if (e <= step) { S.vx = tvx; S.vy = tvy; } else { S.vx += ex / e * step; S.vy += ey / e * step; }
        S.x += S.vx * dt; S.y += S.vy * dt;
        if (S.x < X0) { S.x = X0; S.vx = 0; } else if (S.x > X1) { S.x = X1; S.vx = 0; }
        if (S.y < Y0) { S.y = Y0; S.vy = 0; } else if (S.y > Y1) { S.y = Y1; S.vy = 0; }
      }

      function update(dt) {
        S.time += dt;
        const wave = 1 + Math.floor(S.time / WAVE_LEN);
        if (wave !== S.wave) {
          S.wave = wave;
          api.stat('Wave', wave);
          api.toast('WAVE ' + wave);
          api.sfx('levelup');
          if (wave === 4) S.orbCD = 1.5;
          if (wave === 5) S.sweepCD = 1.5;
        }
        const pts = Math.floor(S.time) * 10 + S.cells * 50;
        if (pts !== S.score) { S.score = pts; api.score(pts); }
        move(dt);

        const sweeping = lasers.some(L => L.kind === 'sweep');
        S.nextAtk -= dt;
        if (S.nextAtk <= 0) {
          const ok = launchAttack();
          const gap = Math.max(0.75, 1.9 - 0.18 * (S.wave - 1)) * (sweeping ? 1.4 : 1);
          S.nextAtk = ok ? gap * K.rand(0.85, 1.15) : 0.3;
        }
        if (S.wave >= 4) {
          S.orbCD -= dt;
          const maxOrbs = S.wave >= 7 ? 3 : S.wave >= 5 ? 2 : 1;
          if (S.orbCD <= 0 && orbs.length < maxOrbs) { spawnOrb(); S.orbCD = 6; }
        }
        if (S.wave >= 5) {
          S.sweepCD -= dt;
          if (S.sweepCD <= 0 && !sweeping) { sweep(); S.sweepCD = Math.max(11, 17 - (S.wave - 5)); }
        }

        if (!cell) { S.cellT -= dt; if (S.cellT <= 0) spawnCell(); }
        else if (K.dist(cell.x, cell.y, S.x, S.y) < R + 16) {
          S.cells++;
          fx.burst(cell.x, cell.y, [C.good, '#d6ffd9', C.safety], 18, 220, { life: 0.6 });
          fx.float('+50', cell.x, cell.y - 22, C.good, { size: 26 });
          api.sfx('coin');
          cell = null; S.cellT = 1;
          S.score = Math.floor(S.time) * 10 + S.cells * 50; api.score(S.score);
        }
      }

      function updateHazards(dt) {
        let fired = false;
        for (let i = lasers.length - 1; i >= 0; i--) {
          const L = lasers[i];
          L.t += dt;
          if (L.phase === 'warn') {
            if (L.t >= L.warn) { L.phase = 'fire'; L.t = 0; fired = true; if (L.kind !== 'sweep') sh.add(0.1); }
            continue;
          }
          if (L.kind === 'sweep') L.ang += L.spin * dt;
          if (L.t >= L.fire) { lasers.splice(i, 1); continue; }
          if (S.alive && S.inv <= 0 && hitsBot(L)) hurt();
          if (Math.random() < dt * 30) {
            const ex = L.ox + Math.cos(L.ang) * L.len, ey = L.oy + Math.sin(L.ang) * L.len;
            if (L.kind !== 'diag') fx.burst(ex, ey, ['#ffd0c8', RED, '#ffb03a'], 2, 160, { life: 0.3, size: 2.5 });
          }
        }
        if (fired) api.sfx('zap');
        for (let i = orbs.length - 1; i >= 0; i--) {
          const o = orbs[i];
          o.t += dt;
          if (o.phase === 'spawn') { if (o.t >= 0.9) { o.phase = 'live'; o.t = 0; } continue; }
          o.x += o.vx * dt; o.y += o.vy * dt;
          if (o.x < IN0 + o.r) { o.x = IN0 + o.r; o.vx = Math.abs(o.vx); }
          if (o.x > IN1 - o.r) { o.x = IN1 - o.r; o.vx = -Math.abs(o.vx); }
          if (o.y < IN0 + o.r) { o.y = IN0 + o.r; o.vy = Math.abs(o.vy); }
          if (o.y > IN1 - o.r) { o.y = IN1 - o.r; o.vy = -Math.abs(o.vy); }
          if (o.phase === 'live') {
            if (o.t > o.life) { o.phase = 'fade'; o.t = 0; }
            else if (S.alive && S.inv <= 0 && K.dist(o.x, o.y, S.x, S.y) < o.r + R - 2) {
              fx.burst(o.x, o.y, [PLASMA, '#ffffff'], 16, 240, { life: 0.5 });
              orbs.splice(i, 1);
              hurt();
            }
          } else if (o.t > 1) {
            fx.burst(o.x, o.y, [PLASMA, '#ffffff'], 8, 120, { life: 0.4 });
            orbs.splice(i, 1);
          }
        }
      }

      // ---------- render ----------
      function turretGlow(x, y, heat, firing) {
        ctx.globalAlpha = 0.2 + 0.35 * heat; ctx.fillStyle = RED;
        K.circle(ctx, x, y, 12 + heat * 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = firing ? HOT : RED; K.circle(ctx, x, y, 4.5 + heat * 1.5);
      }
      function drawSweepCore(L) {
        const up = L.phase === 'warn' ? Math.min(1, L.t / 0.4) : 1;
        ctx.fillStyle = '#0d171e'; K.circle(ctx, MID, MID, 24);
        K.ring(ctx, MID, MID, 24, 3, C.steel);
        ctx.save(); ctx.translate(MID, MID); ctx.rotate(L.ang);
        ctx.fillStyle = C.steelDark; K.rr(ctx, 0, -6, 26 * up, 12, 4);
        ctx.restore();
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(S.t * 12); ctx.fillStyle = RED; K.circle(ctx, MID, MID, 16);
        ctx.globalAlpha = 1; ctx.fillStyle = L.phase === 'fire' ? HOT : RED; K.circle(ctx, MID, MID, 7);
        if (L.phase === 'warn') {
          // arrow arc showing which way it will spin
          const dir = Math.sign(L.spin), a0 = L.ang + dir * 0.25, a1 = L.ang + dir * 1.2;
          ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.arc(MID, MID, 44, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
          const hx = MID + Math.cos(a1) * 44, hy = MID + Math.sin(a1) * 44, ta = a1 + dir * Math.PI / 2;
          ctx.fillStyle = RED;
          ctx.beginPath();
          ctx.moveTo(hx + Math.cos(ta) * 9, hy + Math.sin(ta) * 9);
          ctx.lineTo(hx + Math.cos(ta + 2.4) * 7, hy + Math.sin(ta + 2.4) * 7);
          ctx.lineTo(hx + Math.cos(ta - 2.4) * 7, hy + Math.sin(ta - 2.4) * 7);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      /** The player's bot, its mood (worried when a warning line is close) and its shield ring. */
      function drawPlayer() {
        const blink = S.alive && S.inv > 0 && Math.floor(S.inv * 14) % 2 === 0;
        botOpts.t = S.t;
        botOpts.walk = S.alive && Math.hypot(S.vx, S.vy) > 30;
        botOpts.look = K.clamp(S.vx / MAX_V, -1, 1);
        botOpts.lookY = K.clamp(S.vy / MAX_V, -1, 1);
        let danger = false;
        for (const L of lasers) {
          if (L.phase === 'warn' && L.kind !== 'sweep' && Math.abs((S.x - L.ox) * Math.sin(L.ang) - (S.y - L.oy) * Math.cos(L.ang)) < 40) danger = true;
        }
        botOpts.mood = !S.alive ? 'sad' : S.hurtT > 0 ? 'angry' : danger ? 'wow' : 'happy';
        botOpts.arms = !S.alive || S.hurtT > 0 || danger ? 'up' : 'down';
        ctx.globalAlpha = blink ? 0.35 : S.alive ? 1 : 0.55;
        K.drawBot(ctx, S.x, S.y, BOT_H, botOpts);
        ctx.globalAlpha = 1;
        if (!S.alive) return;
        const n = S.shields, seg = Math.PI * 2 / 3, a0 = S.t * 1.4;
        ctx.strokeStyle = SHIELD_COL[n]; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.globalAlpha = S.inv > 0 ? 0.35 + 0.35 * Math.sin(S.t * 20) : 0.7;
        for (let k = 0; k < n; k++) {
          ctx.beginPath(); ctx.arc(S.x, S.y, 31, a0 + k * seg + 0.22, a0 + (k + 1) * seg - 0.22); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      function render() {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        sh.apply(ctx, 10);
        ctx.drawImage(arenaL, 0, 0, W, H);

        if (cell) drawCell(ctx, cell.x, cell.y + Math.sin(S.t * 3) * 2, S.t);
        for (const o of orbs) {
          if (o.phase === 'spawn') {
            const k = o.t / 0.9;
            ctx.globalAlpha = Math.sin(S.t * 30) > 0 ? 0.9 : 0.4;
            K.ring(ctx, o.x, o.y, 26 - 14 * k, 2.5, PLASMA);
            ctx.globalAlpha = 1;
            ctx.fillStyle = PLASMA; K.circle(ctx, o.x, o.y, 3 + 7 * k);
          }
        }

        // beams and telegraphs, clipped to the arena floor
        ctx.save();
        ctx.beginPath(); ctx.rect(IN0, IN0, SPAN, SPAN); ctx.clip();
        for (const L of lasers) if (L.phase === 'warn') drawBeam(ctx, L.ox, L.oy, L.ang, L.len, L.w, 'warn', L.t / L.warn, S.t);
        ctx.restore();

        drawPlayer();

        for (const o of orbs) {
          if (o.phase === 'live') drawOrbBody(ctx, o.x, o.y, o.r, S.t, 1);
          else if (o.phase === 'fade') drawOrbBody(ctx, o.x, o.y, o.r * (1 - o.t * 0.4), S.t, Math.floor(o.t * 16) % 2 ? 0.3 : 0.85);
        }

        ctx.save();
        ctx.beginPath(); ctx.rect(IN0, IN0, SPAN, SPAN); ctx.clip();
        for (const L of lasers) {
          if (L.phase !== 'fire') continue;
          const grow = Math.min(1, L.t / 0.05) * Math.min(1, (L.fire - L.t) / 0.08);
          drawBeam(ctx, L.ox, L.oy, L.ang, L.len, L.w * (0.3 + 0.7 * grow) + Math.random() * 2, 'fire', 1, S.t);
          if (L.kind === 'sweep') {
            const ex = L.ox + Math.cos(L.ang) * L.len, ey = L.oy + Math.sin(L.ang) * L.len;
            ctx.globalAlpha = 0.35; ctx.fillStyle = RED; K.circle(ctx, ex, ey, 16);
            ctx.globalAlpha = 1; ctx.fillStyle = HOT; K.circle(ctx, ex, ey, 6);
          }
        }
        ctx.restore();

        // turrets that are charging or firing
        for (const L of lasers) {
          const heat = L.phase === 'fire' ? 1 : L.t / L.warn;
          if (L.kind === 'wall') {
            turretGlow(L.tx, L.ty, heat, L.phase === 'fire');
            if (L.phase === 'fire') turretGlow(L.rx, L.ry, 0.6, false);
          } else if (L.kind === 'diag') {
            ctx.save(); ctx.translate(L.tx, L.ty); ctx.rotate(L.ang);
            ctx.fillStyle = C.steel; K.rr(ctx, 4, -5, 20, 10, 3);
            ctx.restore();
            turretGlow(L.tx, L.ty, heat, L.phase === 'fire');
          } else drawSweepCore(L);
        }

        fx.draw(ctx);

        if (S.target && S.alive) {
          ctx.globalAlpha = 0.6;
          K.ring(ctx, S.target.x, S.target.y, 9 + Math.sin(S.t * 10) * 1.5, 2, C.glow);
          ctx.globalAlpha = 1;
        }
        if (S.hint > 0 && S.alive) {
          ctx.globalAlpha = Math.min(1, S.hint);
          ctx.fillStyle = 'rgba(11,20,27,0.78)'; K.rr(ctx, MID - 210, 100, 420, 84, 14);
          K.text(ctx, 'DODGE THE LASERS!', MID, 128, { size: 28, color: C.safety });
          K.text(ctx, api.isTouch ? 'Drag or tap to move' : 'Move with the arrow keys or WASD', MID, 162, { size: 20, body: true, color: '#b8c6cf' });
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        ctx.drawImage(vigL, 0, 0, W, H);
        if (S.flash > 0) { ctx.globalAlpha = S.flash * 0.5; ctx.fillStyle = RED; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      }

      api.loop(dt => {
        S.t += dt;
        S.inv = Math.max(0, S.inv - dt);
        S.hurtT = Math.max(0, S.hurtT - dt);
        S.flash = Math.max(0, S.flash - dt * 2);
        S.hint = Math.max(0, S.hint - dt);
        if (S.alive) update(dt);
        else { S.vx *= 0.9; S.vy *= 0.9; }
        updateHazards(dt);
        if (cell) cell.t += dt;
        fx.update(dt); sh.update(dt);
        render();
      });
    }
  });
})();
