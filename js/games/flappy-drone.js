/* Flappy Drone: the player's bot, in drone mode, threads the gaps between factory stacks.
 * One button: tap, click, Space, W or Up fires the jets and gravity pulls the bot down. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 480, H = 720;
  const CEIL = 34;                   // underside of the ceiling girder
  const FLOOR = 648;                 // top of the factory floor
  const BOT_X = 150, BOT_H = 64, READY_Y = 318;
  const JET_Y = 27;                  // jets below the bot's centre
  const PW = 78, CAP_H = 26, CAP_OV = 7, CAP_W = PW + CAP_OV * 2;
  const GRAV = 1500, FLAP_V = -440, MAX_FALL = 660;
  const SPACING = 255;               // distance between gates
  const TILE = 112;                  // repeat width of the floor and ceiling strips
  const FAR_W = 480, FAR_TOP = FLOOR - 240;
  const MID_W = 640, MID_TOP = FLOOR - 236;
  const LK = 2;                      // pixel density of the pre-rendered layers
  const HIT = [[-12, 11], [10, 13]]; // the bot's hit capsule: [offset along its spine, radius]
  const SPARKS = ['#fff3a0', '#ffd36b', '#ff9d2e', '#ff6b3d'];
  const JET = [C.glow, C.eye, '#ffffff'];

  // ---------- deterministic skyline (the thumb and the game share it) ----------
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  const FAR = (function () {
    const r = seeded(11), list = [];
    let x = 0;
    while (x < FAR_W) {
      const w = 36 + r() * 54, h = 60 + r() * 100;
      list.push({ k: 'b', x, w, h, seed: Math.floor(r() * 1e6) });
      const roll = r();
      if (roll < 0.5) list.push({ k: 's', x: x + w * (0.15 + r() * 0.6), w: 8 + r() * 5, h: h + 50 + r() * 70 });
      else if (roll < 0.7) list.push({ k: 't', x: x + w * 0.5, w: 14 + r() * 8, h });
      x += w + 4 + r() * 18;
    }
    return list;
  })();
  const MID = (function () {
    const r = seeded(29), list = [], stacks = [];
    let x = 10;
    while (x < MID_W - 20) {
      const roll = r();
      if (roll < 0.5) {
        const w = 96 + r() * 80, h = 58 + r() * 44;
        list.push({ k: 'hall', x, w, h, teeth: Math.max(3, Math.round(w / 26)), seed: Math.floor(r() * 1e6) });
        x += w;
      } else if (roll < 0.8) {
        const w = 16 + r() * 6, h = 150 + r() * 60;
        list.push({ k: 'stack', x: x + 8, w, h });
        stacks.push({ x: x + 8 + w / 2, y: FLOOR - h - 4 });
        x += w + 16;
      } else {
        const w = 34 + r() * 14, h = 112 + r() * 46;
        list.push({ k: 'tower', x, w, h });
        x += w + 6;
      }
      x += 4 + r() * 14;
    }
    return { list, stacks };
  })();

  // ---------- painters (used for the pre-rendered layers and for the thumb) ----------
  function paintSky(c, w) {
    const g = c.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, '#09121a'); g.addColorStop(0.55, '#0f1e29'); g.addColorStop(1, '#1d3444');
    c.fillStyle = g; c.fillRect(0, 0, w, H);
    const glow = c.createRadialGradient(w * 0.62, FLOOR, 20, w * 0.62, FLOOR, 430);
    glow.addColorStop(0, 'rgba(90,209,230,0.14)'); glow.addColorStop(1, 'rgba(90,209,230,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, H);
    const r = seeded(3);
    for (let i = 0; i < 80; i++) {
      const x = r() * w, y = 44 + r() * (FLOOR - 320), s = r() < 0.15 ? 2 : 1.3;
      c.fillStyle = 'rgba(191,246,255,' + (0.12 + r() * 0.3).toFixed(2) + ')';
      c.fillRect(x, y, s, s);
    }
  }

  function paintFar(c, x0) {
    for (const off of [-FAR_W, 0, FAR_W]) {
      const bx = x0 + off;
      c.fillStyle = '#142633';
      for (const s of FAR) {
        const x = bx + s.x;
        if (s.k === 'b') c.fillRect(x, FLOOR - s.h, s.w, s.h);
        else if (s.k === 's') { c.fillRect(x, FLOOR - s.h, s.w, s.h); c.fillRect(x - 2, FLOOR - s.h, s.w + 4, 4); }
        else {
          c.fillRect(x - s.w, FLOOR - s.h - s.w * 0.8, s.w * 2, s.w * 0.8 + 2);
          c.beginPath(); c.arc(x, FLOOR - s.h - s.w * 0.8, s.w, Math.PI, 0); c.fill();
        }
      }
      for (const s of FAR) {
        if (s.k !== 'b') continue;
        const r = seeded(s.seed);
        for (let wy = FLOOR - s.h + 10; wy < FLOOR - 10; wy += 12) {
          for (let wx = bx + s.x + 6; wx < bx + s.x + s.w - 6; wx += 10) {
            if (r() < 0.16) {
              c.fillStyle = r() < 0.7 ? 'rgba(245,197,24,0.3)' : 'rgba(90,209,230,0.28)';
              c.fillRect(wx, wy, 3, 4);
            }
          }
        }
      }
    }
  }

  function paintMid(c, x0) {
    const ink = '#0c1720';
    for (const off of [-MID_W, 0, MID_W]) {
      const bx = x0 + off;
      for (const s of MID.list) {
        const x = bx + s.x, top = FLOOR - s.h;
        c.fillStyle = ink;
        if (s.k === 'hall') {
          c.fillRect(x, top, s.w, s.h);
          const tw = s.w / s.teeth;
          c.beginPath(); c.moveTo(x, top);
          for (let i = 0; i < s.teeth; i++) { c.lineTo(x + i * tw, top - 16); c.lineTo(x + (i + 1) * tw, top); }
          c.closePath(); c.fill();
          c.fillStyle = 'rgba(90,209,230,0.2)';
          for (let i = 0; i < s.teeth; i++) c.fillRect(x + i * tw, top - 14, 2.5, 13);
          const r = seeded(s.seed);
          for (let wx = x + 8; wx < x + s.w - 14; wx += 14) {
            if (r() < 0.7) {
              c.fillStyle = r() < 0.8 ? 'rgba(245,197,24,0.4)' : 'rgba(90,209,230,0.38)';
              c.fillRect(wx, top + 16, 8, 10);
            }
          }
        } else if (s.k === 'stack') {
          c.fillRect(x, top, s.w, s.h);
          c.fillRect(x - 3, top - 4, s.w + 6, 7);
          c.fillStyle = 'rgba(255,255,255,0.05)';
          for (let y = top + 22; y < FLOOR; y += 34) c.fillRect(x, y, s.w, 3);
        } else {
          const tankH = 28, lx = x + 5, rx = x + s.w - 5;
          c.strokeStyle = ink; c.lineWidth = 3;
          c.beginPath();
          c.moveTo(lx - 3, FLOOR); c.lineTo(lx, top + tankH); c.moveTo(rx + 3, FLOOR); c.lineTo(rx, top + tankH);
          for (let y = FLOOR; y > top + tankH + 24; y -= 24) { c.moveTo(lx, y); c.lineTo(rx, y - 24); c.moveTo(rx, y); c.lineTo(lx, y - 24); }
          c.stroke();
          c.fillStyle = ink; K.rr(c, x - 2, top, s.w + 4, tankH, 7);
          c.fillStyle = 'rgba(255,77,77,0.95)'; K.circle(c, x + s.w / 2, top - 3, 2.6);
        }
      }
    }
  }

  function stackGrad(c, x, w) {
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#2b3f4b'); g.addColorStop(0.2, '#8195a2'); g.addColorStop(0.36, '#b8c7d0');
    g.addColorStop(0.62, '#6b808d'); g.addColorStop(1, '#263843');
    return g;
  }
  function paintStack(c, x, y, w, h) {
    if (h <= 0) return;
    c.fillStyle = stackGrad(c, x, w); c.fillRect(x, y, w, h);
    for (let by = y + 30; by < y + h; by += 64) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, by, w, 4);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(x, by + 4, w, 1.5);
      c.fillStyle = 'rgba(0,0,0,0.32)'; K.circle(c, x + 9, by + 12, 2.2); K.circle(c, x + w - 9, by + 12, 2.2);
    }
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x, y, 2, h); c.fillRect(x + w - 2, y, 2, h);
  }
  function paintCap(c, x, y, w, h) {
    c.fillStyle = '#16232c'; K.rr(c, x - 1.5, y - 1.5, w + 3, h + 3, 5);
    c.fillStyle = stackGrad(c, x, w); K.rr(c, x, y, w, h, 4);
    K.hazard(c, x + 3, y + 6, w - 6, h - 12, { stripe: 9 });
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 3, y + h - 9, w - 6, 3);
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x + 4, y + 1.5, w - 8, 1.5);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (const bx of [x + 6, x + w - 6]) { K.circle(c, bx, y + 3.2, 1.6); K.circle(c, bx, y + h - 3.2, 1.6); }
  }
  function paintFloor(c, x0, w) {
    c.fillStyle = '#101d26'; c.fillRect(x0, FLOOR, w, H - FLOOR);
    c.fillStyle = '#3a5566'; c.fillRect(x0, FLOOR, w, 4);
    c.fillStyle = '#223845'; c.fillRect(x0, FLOOR + 4, w, 3);
    K.hazard(c, x0, FLOOR + 14, w, 14, { stripe: 14 });
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x0, FLOOR + 14, w, 14);
    for (let x = x0; x < x0 + w; x += 56) {
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, FLOOR + 34, 2, H - FLOOR - 34);
      c.fillStyle = 'rgba(255,255,255,0.12)'; K.circle(c, x + 12, FLOOR + 44, 2.2); K.circle(c, x + 44, FLOOR + 60, 2.2);
    }
  }
  function paintCeil(c, x0, w) {
    c.fillStyle = '#0d1820'; c.fillRect(x0, 0, w, CEIL);
    c.fillStyle = '#2b4353'; c.fillRect(x0, 0, w, 5); c.fillRect(x0, CEIL - 10, w, 4);
    c.strokeStyle = '#223845'; c.lineWidth = 3;
    c.beginPath();
    for (let x = x0, i = 0; x <= x0 + w + 28; x += 28, i++) c.lineTo(x, i % 2 ? CEIL - 10 : 5);
    c.stroke();
    K.hazard(c, x0, CEIL - 6, w, 6, { stripe: 7 });
  }
  function paintBattery(c, x, y, t) {
    c.fillStyle = 'rgba(124,240,138,0.16)'; K.circle(c, x, y, 23 + Math.sin(t * 5) * 2);
    K.ring(c, x, y, 19, 1.5, 'rgba(124,240,138,0.45)');
    K.drawHive(c, x, y, 34);
  }
  function paintMoveSign(c, x, y, t) {
    c.fillStyle = 'rgba(11,20,27,0.85)'; K.rr(c, x - 15, y - 9, 30, 18, 4);
    c.fillStyle = Math.sin(t * 9) > -0.2 ? C.safety : '#6b5a10';
    c.beginPath(); c.moveTo(x - 10, y + 4); c.lineTo(x - 5, y - 5); c.lineTo(x, y + 4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + 1, y - 4); c.lineTo(x + 6, y + 5); c.lineTo(x + 11, y - 4); c.closePath(); c.fill();
  }
  /** The drone: the player's bot in hover mode, tilted, with a jet flame of strength flame 0..1. */
  function drawDrone(c, x, y, ang, h, flame, t, opts) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (flame > 0.02) {
      const k = h / 58, L = (10 + 26 * flame + Math.sin(t * 60) * 3) * k;
      c.fillStyle = 'rgba(90,209,230,' + (0.35 + 0.35 * flame).toFixed(2) + ')';
      c.beginPath(); c.moveTo(-9 * k, 24 * k); c.lineTo(0, 24 * k + L); c.lineTo(9 * k, 24 * k); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath(); c.moveTo(-4.5 * k, 24 * k); c.lineTo(0, 24 * k + L * 0.62); c.lineTo(4.5 * k, 24 * k); c.closePath(); c.fill();
    }
    K.drawBot(c, 0, 0, h, opts);
    c.restore();
  }

  function circleRect(cx, cy, r, x, y, w, h) {
    if (w <= 0 || h <= 0) return false;
    const nx = cx < x ? x : cx > x + w ? x + w : cx;
    const ny = cy < y ? y : cy > y + h ? y + h : cy;
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  Arcade.register({
    id: 'flappy-drone',
    title: 'Flappy Bee Drone',
    cat: 'action',
    blurb: 'Fly your robot through the stacks and collect honey power.',
    rules: [
      'Each tap fires your jets. Gravity pulls you back down.',
      'Fly through the gaps between the stacks: 1 point per gate.',
      'Honey cells floating in the gaps are worth 3 more.',
      'Gaps get tighter and some start to move. Touch nothing!'
    ],
    how: 'Tap, click, Space, W or ↑ to fire your jets',
    accent: '#5ad1e6',
    usesPlayer: true,

    thumb(ctx, w, h, kit, player) {
      const s = w / 640;
      ctx.save();
      ctx.scale(s, s);
      ctx.translate(0, -300);
      paintSky(ctx, 640);
      paintFar(ctx, -60);
      paintMid(ctx, -210);
      for (const [x, gy, gap] of [[196, 452, 190], [456, 540, 180]]) {
        const top = gy - gap / 2, bot = gy + gap / 2;
        paintStack(ctx, x, 0, PW, top - CAP_H);
        paintCap(ctx, x - CAP_OV, top - CAP_H, CAP_W, CAP_H);
        paintCap(ctx, x - CAP_OV, bot, CAP_W, CAP_H);
        paintStack(ctx, x, bot + CAP_H, PW, FLOOR - bot - CAP_H);
      }
      paintBattery(ctx, 495, 530, 0.3);
      paintFloor(ctx, 0, 640);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = JET[i % 3];
        ctx.globalAlpha = 0.85 - i * 0.08;
        ctx.fillRect(66 - i * 11 + (i % 2) * 4, 528 + i * 7, 6, 6);
      }
      ctx.globalAlpha = 1;
      drawDrone(ctx, 96, 462, -0.22, 100, 0.9, 0.2,
        Object.assign({}, player, { base: 'hover', t: 0.4, mood: 'happy', arms: 'up', look: 1, lookY: -0.6 }));
      ctx.restore();
      kit.text(ctx, '12', w / 2, 30, { size: 28, color: kit.C.ink });
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const fx = K.particles(), jet = K.particles(), sh = K.shaker();
      const skyL = K.layer(W, H, c => paintSky(c, W), LK);
      const farL = K.layer(FAR_W, FLOOR - FAR_TOP, c => { c.translate(0, -FAR_TOP); paintFar(c, 0); }, LK);
      const midL = K.layer(MID_W, FLOOR - MID_TOP, c => { c.translate(0, -MID_TOP); paintMid(c, 0); }, LK);
      const floorL = K.layer(W + TILE, H - FLOOR, c => { c.translate(0, -FLOOR); paintFloor(c, 0, W + TILE); }, LK);
      const ceilL = K.layer(W + TILE, CEIL, c => paintCeil(c, 0, W + TILE), LK);
      const stackL = K.layer(PW, H, c => paintStack(c, 0, 0, PW, H), LK);
      const capL = K.layer(CAP_W + 4, CAP_H + 4, c => paintCap(c, 2, 2, CAP_W, CAP_H), LK);
      const vigL = K.layer(W, H, c => K.vignette(c, W, H, 0.5), 1);
      const puffL = K.layer(64, 64, c => {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      }, 1);
      const smokeL = K.layer(64, 64, c => {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(38,44,50,1)'); g.addColorStop(0.5, 'rgba(38,44,50,0.6)'); g.addColorStop(1, 'rgba(38,44,50,0)');
        c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      }, 1);
      const botOpts = Object.assign({}, api.player, { base: 'hover', t: 0, mood: 'happy', arms: 'wave', look: 0.7, lookY: 0 });

      const S = {
        state: 'ready', t: 0, flyT: 0,
        x: BOT_X, y: READY_Y, vx: 0, vy: 0, ang: 0, spin: 0, landed: false, rest: 1.35,
        speed: 70, farX: 0, midX: 0, floorX: 0,
        gates: 0, cells: 0, score: 0, spawned: 0, lastGap: READY_Y,
        thrust: 0, armsT: 0, flash: 0, pop: 0, exT: 0, steamT: 0, smokeT: 0
      };
      const pipes = [], steam = [], smoke = [];
      api.score(0);
      api.stat('Gates', 0);

      const gapY = p => p.cy + (p.amp ? Math.sin(p.ph + S.flyT * p.freq) * p.amp : 0);

      function spawnPipe(x) {
        const n = S.spawned++;
        const gap = Math.round(K.lerp(210, 150, K.clamp(n / 34, 0, 1)));
        let amp = 0, freq = 0, ph = 0;
        if (n === 15 || (n > 15 && Math.random() < Math.min(0.7, 0.32 + (n - 16) * 0.02))) {
          amp = Math.min(64, 28 + (n - 15) * 1.5);
          freq = K.rand(1.1, 1.7);
          ph = Math.random() * Math.PI * 2;
        }
        const lo = CEIL + 70 + gap / 2 + amp, hi = FLOOR - 70 - gap / 2 - amp;
        const step = n < 5 ? 110 : n < 15 ? 170 : 210;
        const cy = K.clamp(S.lastGap + K.rand(-step, step), lo, hi);
        S.lastGap = cy;
        const cell = n >= 2 && Math.random() < 0.3 ? { dy: K.rand(-0.2, 0.2) * gap, got: false } : null;
        pipes.push({ x, cy, gap, amp, freq, ph, passed: false, cell });
      }

      function press() {
        if (api.over) return;
        if (S.state === 'ready') { S.state = 'fly'; spawnPipe(W + 40); }
        if (S.state !== 'fly') return;
        S.vy = FLAP_V; S.thrust = 1; S.armsT = 0.2;
        const jx = S.x - JET_Y * Math.sin(S.ang), jy = S.y + JET_Y * Math.cos(S.ang);
        const n0 = jet.list.length;
        jet.burst(jx, jy, JET, 9, 130, { lift: -170, gravity: 250, life: 0.38, size: 3.2 });
        for (let i = n0; i < jet.list.length; i++) jet.list[i].vx -= S.speed * 0.7;
        api.tone(330, 0.09, 'triangle', 0.05, 260);
      }
      api.onKey((name, e) => { if (!e.repeat && (name === 'fire' || name === 'up')) press(); });
      api.on(api.stage, 'pointerdown', e => {
        if (e.button > 0) return;
        e.preventDefault();
        press();
      });

      function gatePassed() {
        S.gates++; S.score++; S.pop = 1;
        api.score(S.score);
        api.stat('Gates', S.gates);
        api.tone(880, 0.05, 'square', 0.03);
        api.tone(1320, 0.08, 'square', 0.03, 0, 0.05);
        if (S.gates === 15) { api.toast('MOVING GATES!', { color: C.hazard }); api.sfx('power'); }
        else if (S.gates === 10 || S.gates === 25 || S.gates % 50 === 0) { api.toast(S.gates + ' GATES!'); api.sfx('levelup'); }
      }

      function collide() {
        const sa = Math.sin(S.ang), ca = Math.cos(S.ang);
        for (const hc of HIT) {
          const cx = S.x - hc[0] * sa, cy = S.y + hc[0] * ca, r = hc[1];
          if (cy - r < CEIL) return 'ceil';
          if (cy + r > FLOOR) return 'floor';
          for (const p of pipes) {
            if (p.x - CAP_OV > cx + r || p.x + PW + CAP_OV < cx - r) continue;
            const gy = gapY(p), top = gy - p.gap / 2, bot = gy + p.gap / 2;
            if (circleRect(cx, cy, r, p.x, 0, PW, top - CAP_H) ||
                circleRect(cx, cy, r, p.x - CAP_OV, top - CAP_H, CAP_W, CAP_H) ||
                circleRect(cx, cy, r, p.x - CAP_OV, bot, CAP_W, CAP_H) ||
                circleRect(cx, cy, r, p.x, bot + CAP_H, PW, FLOOR - bot - CAP_H)) return 'pipe';
          }
        }
        return null;
      }

      function crash(kind) {
        S.state = 'dead';
        const hx = S.x + (kind === 'pipe' ? 14 : 0), hy = S.y + (kind === 'floor' ? 20 : kind === 'ceil' ? -22 : 0);
        fx.burst(hx, hy, SPARKS, 30, 380, { life: 0.8, size: 3.5 });
        fx.burst(hx, hy, [C.steel, C.steelDark, api.player.body], 10, 220, { life: 1, size: 5 });
        sh.add(0.5); S.flash = 1;
        api.sfx('boom');
        S.vx = kind === 'pipe' ? -90 : 0;
        S.vy = kind === 'ceil' ? 160 : kind === 'floor' ? -240 : -200;
        S.spin = kind === 'floor' ? 4 : 7;
        const g = S.gates, b = S.cells;
        const title = g === 0 ? 'Grounded!' : g < 10 ? 'Crash landing' : g < 25 ? 'Nice flying!' : g < 50 ? 'Sky ace!' : 'Stack legend!';
        const detail = 'You flew through ' + g + ' gate' + (g === 1 ? '' : 's') +
          (b ? ' and grabbed ' + b + ' batter' + (b === 1 ? 'y' : 'ies') + '.' : '.');
        api.gameOver({ score: S.score, title, detail, delay: 1150 });
      }

      function scroll(dt) {
        S.farX += S.speed * 0.12 * dt;
        S.midX += S.speed * 0.3 * dt;
        S.floorX += S.speed * dt;
      }

      function exhaust(dt, rate, power) {
        S.exT += dt;
        while (S.exT > rate) {
          S.exT -= rate;
          const jx = S.x - JET_Y * Math.sin(S.ang), jy = S.y + JET_Y * Math.cos(S.ang);
          const n0 = jet.list.length;
          jet.burst(jx + K.rand(-4, 4), jy, JET, 1, power, { lift: -110, gravity: 120, life: 0.3, size: 2.6 });
          for (let i = n0; i < jet.list.length; i++) jet.list[i].vx -= S.speed * 0.6;
        }
      }

      function update(dt) {
        if (S.state === 'ready') {
          S.y = READY_Y + Math.sin(S.t * 2.6) * 9;
          S.ang = Math.sin(S.t * 1.3) * 0.05;
          scroll(dt);
          exhaust(dt, 0.07, 40);
          return;
        }
        S.flyT += dt;
        for (const p of pipes) p.x -= S.speed * dt;
        while (pipes.length && pipes[0].x + CAP_W < -10) pipes.shift();
        if (S.state === 'fly') {
          const target = 150 + 55 * K.clamp(S.gates / 40, 0, 1);
          S.speed += (target - S.speed) * Math.min(1, dt * 2);
          S.vy = Math.min(MAX_FALL, S.vy + GRAV * dt);
          S.y += S.vy * dt;
          S.ang += (K.clamp(S.vy / 900, -0.28, 0.55) - S.ang) * Math.min(1, dt * 9);
          scroll(dt);
          const last = pipes[pipes.length - 1];
          if (last && last.x + SPACING <= W + 40) spawnPipe(last.x + SPACING);
          exhaust(dt, 0.035, 60);
          for (const p of pipes) {
            if (!p.passed && p.x + PW / 2 < S.x) { p.passed = true; gatePassed(); }
            if (p.cell && !p.cell.got) {
              const bx = p.x + PW / 2, by = gapY(p) + p.cell.dy + Math.sin(S.t * 3 + p.ph) * 4;
              if (K.dist(bx, by, S.x, S.y) < 32) {
                p.cell.got = true; S.cells++; S.score += 3;
                api.score(S.score);
                fx.burst(bx, by, [C.good, '#d6ffd9', C.safety], 18, 220, { life: 0.6 });
                fx.float('+3', bx, by - 20, C.good, { size: 22 });
                api.sfx('coin');
              }
            }
          }
          const hit = collide();
          if (hit) crash(hit);
        } else {
          // dead: tumble to the floor while the world coasts to a stop
          S.speed *= Math.max(0, 1 - dt * 3);
          scroll(dt);
          if (!S.landed) {
            S.vy = Math.min(900, S.vy + GRAV * dt);
            S.y += S.vy * dt; S.x += S.vx * dt; S.vx *= 1 - Math.min(1, dt * 1.5);
            S.ang += S.spin * dt;
            if (S.y > FLOOR - 22) {
              S.y = FLOOR - 22;
              if (S.vy > 200) {
                S.vy *= -0.35; S.spin *= 0.5;
                fx.burst(S.x, FLOOR - 4, SPARKS, 10, 180, { life: 0.5 });
                api.tone(160, 0.12, 'sawtooth', 0.04, -60);
              } else {
                S.landed = true; S.vy = 0;
                S.ang = Math.atan2(Math.sin(S.ang), Math.cos(S.ang));
                S.rest = S.ang >= 0 ? 1.35 : -1.35;
              }
            }
          } else {
            S.ang += (S.rest - S.ang) * Math.min(1, dt * 8);
            S.y += (FLOOR - 19 - S.y) * Math.min(1, dt * 8);
          }
          S.smokeT -= dt;
          if (S.landed && S.smokeT <= 0 && smoke.length < 30) {
            S.smokeT = 0.09;
            smoke.push({ x: S.x + K.rand(-6, 6), y: S.y - 6, r: 5, vy: -40 - Math.random() * 20, life: 1.6, max: 1.6 });
          }
        }
      }

      function stepEffects(dt) {
        S.thrust = Math.max(0, S.thrust - dt * 4);
        S.armsT = Math.max(0, S.armsT - dt);
        S.flash = Math.max(0, S.flash - dt * 3);
        S.pop = Math.max(0, S.pop - dt * 5);
        sh.update(dt); fx.update(dt); jet.update(dt);
        S.steamT -= dt;
        if (S.steamT <= 0) {
          S.steamT = 0.14;
          const off = S.midX % MID_W;
          for (const st of MID.stacks) {
            for (let k = 0; k < 2; k++) {
              const x = st.x - off + k * MID_W;
              if (x > -20 && x < W + 20 && Math.random() < 0.55 && steam.length < 70) {
                steam.push({ x, y: st.y, r: 5, vy: -26 - Math.random() * 14, life: 2.8, max: 2.8 });
              }
            }
          }
        }
        for (let i = steam.length - 1; i >= 0; i--) {
          const p = steam[i];
          p.x -= (S.speed * 0.3 + 12) * dt; p.y += p.vy * dt; p.r += 8 * dt; p.life -= dt;
          if (p.life <= 0) steam.splice(i, 1);
        }
        for (let i = smoke.length - 1; i >= 0; i--) {
          const p = smoke[i];
          p.x -= (S.speed + 14) * dt; p.y += p.vy * dt; p.r += 14 * dt; p.life -= dt;
          if (p.life <= 0) smoke.splice(i, 1);
        }
      }

      function strip(img, off, tw, top, h) {
        const x = -(off % tw);
        ctx.drawImage(img, x, top, tw, h);
        if (x + tw < W) ctx.drawImage(img, x + tw, top, tw, h);
      }

      function drawPipe(p) {
        const gy = gapY(p), top = gy - p.gap / 2, bot = gy + p.gap / 2;
        const x = Math.round(p.x);
        const hTop = Math.min(H, Math.max(0, top - CAP_H)), hBot = Math.min(H, Math.max(0, FLOOR - bot - CAP_H));
        if (hTop >= 1) ctx.drawImage(stackL, 0, (H - hTop) * LK, PW * LK, hTop * LK, x, 0, PW, hTop);
        if (hBot >= 1) ctx.drawImage(stackL, 0, 0, PW * LK, hBot * LK, x, bot + CAP_H, PW, hBot);
        ctx.drawImage(capL, x - CAP_OV - 2, top - CAP_H - 2, CAP_W + 4, CAP_H + 4);
        ctx.drawImage(capL, x - CAP_OV - 2, bot - 2, CAP_W + 4, CAP_H + 4);
        if (p.amp) {
          paintMoveSign(ctx, x + PW / 2, top - CAP_H - 16, S.t);
          paintMoveSign(ctx, x + PW / 2, bot + CAP_H + 16, S.t);
        }
        if (p.cell && !p.cell.got) paintBattery(ctx, x + PW / 2, gy + p.cell.dy + Math.sin(S.t * 3 + p.ph) * 4, S.t);
      }

      function render() {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        sh.apply(ctx, 12);
        ctx.drawImage(skyL, 0, 0, W, H);
        strip(farL, S.farX, FAR_W, FAR_TOP, FLOOR - FAR_TOP);
        strip(midL, S.midX, MID_W, MID_TOP, FLOOR - MID_TOP);
        for (const p of steam) {
          const k = p.life / p.max;
          ctx.globalAlpha = 0.2 * k * Math.min(1, (1 - k) * 6);
          ctx.drawImage(puffL, p.x - p.r * 1.6, p.y - p.r * 1.6, p.r * 3.2, p.r * 3.2);
        }
        ctx.globalAlpha = 1;
        for (const p of pipes) drawPipe(p);
        const fx0 = -(S.floorX % TILE);
        ctx.drawImage(ceilL, fx0, 0, W + TILE, CEIL);
        ctx.drawImage(floorL, fx0, FLOOR, W + TILE, H - FLOOR);
        jet.draw(ctx);

        botOpts.t = S.t;
        botOpts.lookY = K.clamp(S.vy / 600, -1, 1);
        if (S.state === 'dead') { botOpts.mood = S.landed ? 'sad' : 'wow'; botOpts.arms = 'up'; }
        else if (S.state === 'ready') { botOpts.mood = 'happy'; botOpts.arms = 'wave'; }
        else { botOpts.mood = S.vy > 480 ? 'wow' : 'happy'; botOpts.arms = S.armsT > 0 ? 'up' : 'down'; }
        const flame = S.state === 'dead' ? 0 : S.state === 'ready' ? 0.25 : Math.max(0.2, S.thrust);
        drawDrone(ctx, S.x, S.y, S.ang, BOT_H, flame, S.t, botOpts);

        for (const p of smoke) {
          ctx.globalAlpha = 0.7 * (p.life / p.max);
          ctx.drawImage(smokeL, p.x - p.r * 1.6, p.y - p.r * 1.6, p.r * 3.2, p.r * 3.2);
        }
        ctx.globalAlpha = 1;
        fx.draw(ctx);

        if (S.state === 'ready') {
          ctx.fillStyle = 'rgba(11,20,27,0.72)'; K.rr(ctx, W / 2 - 180, 432, 360, 104, 16);
          ctx.strokeStyle = 'rgba(90,209,230,0.35)'; ctx.lineWidth = 2; K.rrPath(ctx, W / 2 - 180, 432, 360, 104, 16); ctx.stroke();
          ctx.globalAlpha = 0.72 + Math.sin(S.t * 5) * 0.28;
          K.text(ctx, 'TAP TO FLY', W / 2, 470, { size: 36, color: C.safety });
          ctx.globalAlpha = 1;
          K.text(ctx, api.isTouch ? 'Each tap fires your jets' : 'Click, Space, W or ↑ fires your jets', W / 2, 510, { size: 18, body: true, color: '#b8c6cf' });
        } else {
          K.text(ctx, String(S.gates), W / 2, 96, { size: Math.round(50 * (1 + S.pop * 0.22)), color: C.ink });
        }
        ctx.restore();
        ctx.drawImage(vigL, 0, 0, W, H);
        if (S.flash > 0) { ctx.fillStyle = 'rgba(255,244,214,' + (S.flash * 0.45).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      }

      api.loop(dt => {
        S.t += dt;
        update(dt);
        stepEffects(dt);
        render();
      });
    }
  });
})();
