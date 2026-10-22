/* Robot Factory: an idle clicker.
 * Assemble robots by hand, spend them on machines that build robots for you, and watch
 * the factory floor fill up. Progress is saved, and the factory keeps working for up to
 * eight hours while you are away. It never ends: the score is every robot you have ever built. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;
  const W = 800, H = 360, BELT = 292, STATION = 400;
  const OFFLINE_CAP = 8 * 3600;   // seconds of work the factory does while you are away
  const GROWTH = 1.15;

  const MACHINES = BeeEconomy.machines;
  const TOOLS = BeeEconomy.tools;
  const MILESTONES = [10, 100, 1000, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
  const HEADS = ['box', 'dome', 'tv'], ANTS = ['ball', 'bolt', 'twin', 'dish', 'none'];
  const BASES = ['wheels', 'treads', 'legs', 'hover'], EYES = ['#bff6ff', '#9dff9d', '#ffd36b', '#ff9ad5'];
  const ARM_X = [180, 292, 520, 616];

  // ---------- numbers: 1,240 · 12.3K · 3.4M ----------
  const UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];
  function fmt(n) {
    n = Math.floor(Math.max(0, n) + 1e-7);
    if (n < 10000) return n.toLocaleString('en-US');
    let u = -1, v = n;
    while (v >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; }
    const d = v < 10 ? 2 : v < 100 ? 1 : 0, p = Math.pow(10, d);
    let s = (Math.floor(v * p) / p).toFixed(d);
    if (d) s = s.replace(/\.?0+$/, '');
    return s + UNITS[u];
  }
  function fmtRate(r) {
    if (r <= 0) return '0';
    if (r < 10) return (Math.floor(r * 10 + 1e-7) / 10).toFixed(1).replace(/\.0$/, '');
    return fmt(r);
  }
  const fmtGain = n => (n < 10 && Math.abs(n - Math.round(n)) > 0.05 ? n.toFixed(1) : fmt(n));

  // ---------- scene art (800 × 360) ----------
  function drawWall(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 2;
    for (let x = 40; x < W; x += 80) { c.beginPath(); c.moveTo(x, 44); c.lineTo(x, BELT); c.stroke(); }
    for (let y = 130; y < BELT; y += 90) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 40; x < W; x += 80) for (let y = 130; y < BELT; y += 90) { K.circle(c, x + 6, y + 6, 2); K.circle(c, x + 74, y + 6, 2); }
    // high windows
    for (const wx of [236, 564]) {
      c.fillStyle = '#0c151c'; K.rr(c, wx - 36, 62, 72, 46, 6);
      const wg = c.createLinearGradient(0, 66, 0, 104);
      wg.addColorStop(0, '#2a5266'); wg.addColorStop(1, '#16303e');
      c.fillStyle = wg; K.rr(c, wx - 32, 66, 64, 38, 4);
      c.fillStyle = '#0c151c'; c.fillRect(wx - 1.5, 66, 3, 38); c.fillRect(wx - 32, 84, 64, 3);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(wx - 28, 100); c.lineTo(wx - 12, 70); c.lineTo(wx - 4, 70); c.lineTo(wx - 20, 100); c.closePath(); c.fill();
    }
    // light cone over the assembly spot
    const cone = c.createLinearGradient(0, 44, 0, BELT);
    cone.addColorStop(0, 'rgba(245,197,24,0)'); cone.addColorStop(1, 'rgba(245,197,24,0.11)');
    c.fillStyle = cone;
    c.beginPath(); c.moveTo(STATION - 22, 44); c.lineTo(STATION + 22, 44); c.lineTo(STATION + 74, BELT); c.lineTo(STATION - 74, BELT); c.closePath(); c.fill();
    // doorways (dark insides; the frames are drawn in front of the robots)
    c.fillStyle = '#081016'; c.fillRect(0, 190, 64, BELT - 190); c.fillRect(W - 64, 190, 64, BELT - 190);
    c.fillStyle = 'rgba(245,197,24,0.07)'; c.fillRect(0, 190, 64, BELT - 190);
    // ceiling rail
    c.fillStyle = '#0c151c'; c.fillRect(0, 24, W, 20);
    c.fillStyle = '#2b4353'; c.fillRect(0, 42, W, 3);
    c.fillStyle = '#39505e'; for (let x = 20; x < W; x += 40) K.circle(c, x, 34, 2.5);
    // floor, belt frame and legs
    c.fillStyle = '#0d171e'; c.fillRect(0, BELT + 14, W, H - BELT - 14);
    c.fillStyle = '#39505e'; c.fillRect(0, BELT + 14, W, 10);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, BELT + 14, W, 2);
    c.fillStyle = '#1c2a33'; for (const x of [96, 256, 544, 704]) c.fillRect(x - 7, BELT + 24, 14, 26);
    K.hazard(c, 0, H - 14, W, 10, { stripe: 12 });
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, H - 14, W, 10);
  }

  /** Door frames drawn over the robots, so they roll in and out of the walls. */
  function drawFrames(c) {
    for (const [x0, x1] of [[0, 68], [W - 68, W]]) {
      c.fillStyle = '#2b4353'; c.fillRect(x0, 180, x1 - x0, 12);
      K.hazard(c, x0, 182, x1 - x0, 8, { stripe: 8 });
      const post = x0 === 0 ? x1 - 10 : x0;
      c.fillStyle = '#39505e'; c.fillRect(post, 180, 10, BELT - 180 + 14);
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(post, 180, 2, BELT - 180 + 14);
    }
    c.fillStyle = '#0c151c'; K.rr(c, W - 64, 150, 58, 24, 5);
    c.font = K.font(12); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = C.good; c.fillText('SHIP', W - 35, 163);
    c.fillStyle = '#0c151c'; K.rr(c, 6, 150, 58, 24, 5);
    c.fillStyle = C.glow; c.fillText('PARTS', 35, 163);
  }

  function drawBelt(c, off) {
    c.fillStyle = '#1b262e'; c.fillRect(0, BELT, W, 14);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    const seg = 22, s = ((off % seg) + seg) % seg;
    for (let x = s - seg; x < W; x += seg) c.fillRect(x, BELT + 2, 4, 10);
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(0, BELT, W, 2);
    // rollers along the frame
    for (let x = 24; x < W; x += 48) {
      c.fillStyle = '#56707f'; K.circle(c, x, BELT + 19, 5);
      const a = off / 5;
      c.fillStyle = '#1b262e'; K.circle(c, x + Math.cos(a) * 3, BELT + 19 + Math.sin(a) * 3, 1.5);
    }
  }

  function armTip(x, t, i) {
    const dir = i % 2 ? -1 : 1;
    const a1 = (0.35 + Math.sin(t * 1.6 + i * 1.7) * 0.3) * dir;
    const a2 = (-0.8 + Math.sin(t * 2.2 + i * 2.1) * 0.35) * dir;
    return { a1, a2, ex: x - Math.sin(a1) * 70, ey: 58 + Math.cos(a1) * 70, tx: x - Math.sin(a1) * 70 - Math.sin(a1 + a2) * 62, ty: 58 + Math.cos(a1) * 70 + Math.cos(a1 + a2) * 62 };
  }
  function drawRobotArm(c, x, t, i) {
    const p = armTip(x, t, i);
    c.fillStyle = C.steelDark; K.rr(c, x - 17, 40, 34, 12, 3);
    c.save(); c.translate(x, 58); c.rotate(p.a1);
    c.fillStyle = C.safety; K.rr(c, -8, 0, 16, 72, 7);
    c.fillStyle = 'rgba(0,0,0,0.18)'; K.rr(c, 2, 4, 5, 64, 3);
    c.fillStyle = C.dark; K.circle(c, 0, 0, 10); c.fillStyle = C.steel; K.circle(c, 0, 0, 4);
    c.translate(0, 70); c.rotate(p.a2);
    c.fillStyle = '#e0ae12'; K.rr(c, -6, 0, 12, 56, 6);
    c.fillStyle = C.dark; K.circle(c, 0, 0, 8); c.fillStyle = C.steel; K.circle(c, 0, 0, 3.4);
    c.translate(0, 54);
    c.fillStyle = C.steel; K.rr(c, -7, 0, 14, 8, 2);
    c.fillStyle = C.dark; K.rr(c, -3.5, 7, 7, 6, 2);
    c.restore();
    c.fillStyle = K.alpha(C.glow, 0.5 + 0.5 * Math.sin(t * 20 + i)); K.circle(c, p.tx, p.ty + 1, 2.4);
  }

  function pressExt(t) {
    const ph = (t % 1.8) / 1.8;
    if (ph < 0.1) return ph / 0.1;
    if (ph < 0.28) return 1;
    return 1 - (ph - 0.28) / 0.72;
  }
  function drawPress(c, t) {
    const e = pressExt(t), headY = 104 + e * 58;
    c.fillStyle = C.steel; c.fillRect(STATION - 7, 96, 14, headY - 96);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(STATION - 5, 96, 3, headY - 96);
    c.fillStyle = C.steelDark; K.rr(c, STATION - 44, 44, 88, 56, 8);
    K.hazard(c, STATION - 44, 84, 88, 10, { stripe: 8 });
    c.fillStyle = e > 0.95 ? C.hazard : '#5a1f14'; K.circle(c, STATION + 30, 60, 5);
    c.fillStyle = '#2b4353'; K.rr(c, STATION - 36, headY, 72, 16, 4);
    c.fillStyle = C.safety; c.fillRect(STATION - 36, headY + 12, 72, 4);
  }

  function drawWeldBooth(c, t) {
    c.fillStyle = '#26394a'; c.fillRect(652, 120, 10, BELT - 120); c.fillRect(726, 120, 10, BELT - 120);
    c.fillStyle = '#2b4353'; K.rr(c, 646, 112, 96, 16, 4);
    const on = Math.sin(t * 9) > 0;
    c.fillStyle = on ? C.hazard : '#6b2a16'; K.circle(c, 694, 106, 7);
    if (on) { c.fillStyle = 'rgba(255,107,61,0.25)'; K.circle(c, 694, 106, 14); }
  }
  function torchTip(t) { return { x: 694 + Math.sin(t * 2.5) * 14, y: 212 }; }
  function drawTorch(c, t) {
    const p = torchTip(t);
    c.strokeStyle = C.steel; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(694, 128); c.lineTo(p.x, p.y - 14); c.stroke();
    c.fillStyle = C.steelDark; K.rr(c, p.x - 7, p.y - 18, 14, 16, 3);
    const f = 0.6 + 0.4 * Math.sin(t * 40);
    c.fillStyle = 'rgba(191,246,255,0.45)'; K.circle(c, p.x, p.y + 2, 7 * f + 3);
    c.fillStyle = '#ffffff'; K.circle(c, p.x, p.y + 2, 3);
  }

  function drawForeman(c, t) {
    const x = 96, y = 122 + Math.sin(t * 2) * 5, h = 64, s = h / 110;
    const look = Math.sin(t * 0.7) * 0.9;
    K.drawBot(c, x, y, h, { body: '#ff8a5c', eye: '#ffd36b', head: 'tv', antenna: 'none', base: 'hover', arms: Math.sin(t * 0.9) > 0.6 ? 'wave' : 'down', look, t, mood: 'happy' });
    const bob = Math.sin(t * 4) * 2 - 2;
    c.save(); c.translate(x, y); c.scale(s, s); c.translate(0, 4.5 + bob);
    c.fillStyle = C.safety;
    c.beginPath(); c.ellipse(0, -42, 24, 17, 0, Math.PI, 0); c.fill();
    K.rr(c, -32, -44, 64, 6, 3);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-4, -57, 8, 13);
    c.restore();
  }

  function drawFusion(c, t) {
    const x = 716, y = 76, p = 0.5 + 0.5 * Math.sin(t * 3);
    c.fillStyle = '#0c151c'; K.circle(c, x, y, 30);
    const g = c.createRadialGradient(x, y, 1, x, y, 26);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, K.alpha(C.glow, 0.95)); g.addColorStop(1, K.alpha(C.glow, 0));
    c.fillStyle = g; K.circle(c, x, y, 24 + p * 4);
    c.strokeStyle = K.alpha(C.good, 0.8); c.lineWidth = 2;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(x, y, 25, 8, t * 1.4 + k * Math.PI / 3, 0, Math.PI * 2); c.stroke(); }
    K.ring(c, x, y, 31, 4, C.steelDark);
  }

  function drawSwarm(c, t) {
    for (let i = 0; i < 42; i++) {
      const a = t * (0.45 + (i % 5) * 0.09) + i * 1.7;
      const x = 400 + Math.sin(a) * (330 - (i % 7) * 26);
      const y = 150 + Math.sin(a * 2 + i) * (62 - (i % 4) * 9);
      c.fillStyle = i % 3 ? 'rgba(90,209,230,0.9)' : 'rgba(124,240,138,0.9)';
      c.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
    }
  }

  // ---------- shop icons (44 × 44) ----------
  const ICONS = {
    arm(c) {
      c.fillStyle = C.steelDark; K.rr(c, 5, 35, 22, 6, 2);
      c.lineCap = 'round';
      c.strokeStyle = C.safety; c.lineWidth = 8; c.beginPath(); c.moveTo(14, 35); c.lineTo(21, 13); c.stroke();
      c.strokeStyle = '#e0ae12'; c.lineWidth = 6.5; c.beginPath(); c.moveTo(21, 13); c.lineTo(33, 25); c.stroke();
      c.strokeStyle = C.steel; c.lineWidth = 3;
      c.beginPath(); c.moveTo(33, 25); c.lineTo(31, 34); c.moveTo(33, 25); c.lineTo(39, 31); c.stroke();
      c.fillStyle = C.dark; K.circle(c, 14, 35, 4.5); K.circle(c, 21, 13, 4);
      c.fillStyle = C.steel; K.circle(c, 14, 35, 1.8); K.circle(c, 21, 13, 1.6);
      c.fillStyle = K.alpha(C.glow, 0.8); K.circle(c, 35, 33, 2);
    },
    belt(c) {
      K.drawBot(c, 22, 18, 26, { body: C.glow, head: 'box', antenna: 'ball', base: 'wheels', t: 0.3 });
      c.fillStyle = '#1b262e'; K.rr(c, 3, 30, 38, 7, 3);
      c.fillStyle = '#56707f'; for (const x of [9, 22, 35]) K.circle(c, x, 38.5, 3.5);
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(4, 30, 36, 1.5);
    },
    line(c) { c.save(); c.translate(22 - STATION * 0.34, -12); c.scale(0.34, 0.34); drawPress(c, 0.2); c.restore(); c.fillStyle = '#1b262e'; K.rr(c, 4, 38, 36, 5, 2); },
    weld(c) {
      c.strokeStyle = C.steel; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(10, 6); c.lineTo(22, 22); c.stroke();
      c.fillStyle = C.steelDark; K.rr(c, 17, 18, 11, 11, 3);
      c.fillStyle = 'rgba(191,246,255,0.5)'; K.circle(c, 24, 31, 7);
      c.fillStyle = '#fff'; K.circle(c, 24, 31, 3);
      c.fillStyle = '#ffd36b'; for (const [x, y] of [[34, 26], [36, 36], [14, 36], [31, 40], [9, 30]]) c.fillRect(x, y, 2.5, 2.5);
    },
    boss(c) { c.save(); c.translate(22 - 96 * 0.5, 22 - 122 * 0.5); c.scale(0.5, 0.5); drawForeman(c, 0.5); c.restore(); },
    fusion(c) { c.save(); c.translate(22 - 716 * 0.62, 22 - 76 * 0.62); c.scale(0.62, 0.62); drawFusion(c, 0.4); c.restore(); },
    nano(c) {
      for (let i = 0; i < 26; i++) {
        const a = i * 2.4, r = 3 + (i % 9) * 1.9;
        c.fillStyle = i % 3 ? C.glow : C.good;
        c.fillRect(22 + Math.cos(a) * r - 1.5, 22 + Math.sin(a) * r * 0.8 - 1.5, 3, 3);
      }
    }
  };
  const TOOL_ICONS = {
    glove(c) {
      c.fillStyle = C.hazard;
      K.rr(c, 12, 16, 20, 20, 6);
      for (let k = 0; k < 4; k++) K.rr(c, 12 + k * 5, 6 + (k === 0 || k === 3 ? 4 : 0), 4.4, 14, 2.2);
      K.rr(c, 4, 20, 12, 7, 3.5);
      c.fillStyle = C.safety; K.rr(c, 11, 33, 22, 7, 2);
      c.fillStyle = 'rgba(255,255,255,0.3)'; K.rr(c, 15, 19, 12, 3, 1.5);
    },
    driver(c) {
      c.save(); c.translate(22, 22); c.rotate(-0.78);
      c.fillStyle = C.glow; K.rr(c, -5, 2, 10, 17, 4);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-1, 4, 2, 13);
      c.fillStyle = C.steel; c.fillRect(-1.8, -16, 3.6, 19);
      c.fillStyle = '#e6eef2'; c.fillRect(-2.6, -19, 5.2, 4);
      c.restore();
    },
    rivet(c) {
      c.fillStyle = C.steelDark; K.rr(c, 6, 12, 26, 12, 4);
      c.fillStyle = C.hazard; K.rr(c, 14, 22, 9, 15, 3);
      c.fillStyle = C.steel; c.fillRect(32, 15, 7, 6);
      c.fillStyle = C.safety; K.circle(c, 41, 18, 2.5);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(8, 14, 20, 2);
    },
    hammer(c) {
      c.save(); c.translate(22, 22); c.rotate(-0.6);
      c.fillStyle = '#b8733d'; K.rr(c, -2.5, -4, 5, 24, 2);
      c.fillStyle = C.steel; K.rr(c, -12, -14, 24, 11, 3);
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-10, -12, 20, 2);
      c.restore();
    },
    wrench(c) {
      c.save(); c.translate(22, 22); c.rotate(0.78);
      c.fillStyle = K.alpha(C.glow, 0.3); K.circle(c, 0, -10, 12);
      c.fillStyle = C.glow; K.rr(c, -3, -6, 6, 24, 3); K.circle(c, 0, -11, 8);
      c.fillStyle = '#132330'; K.rr(c, -3, -20, 6, 9, 1);
      c.restore();
    }
  };
  function iconCanvas(draw) {
    const k = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 44 * k;
    cv.className = 'rf-icon';
    const c = cv.getContext('2d');
    c.scale(k, k);
    try { draw(c); } catch (e) { /* icon art is decoration only */ }
    return cv;
  }

  const CSS = `
  .g-rf { width: 100%; max-width: 1180px; height: 100%; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .g-rf .rf-main { display: flex; flex-direction: column; gap: 10px; flex: none; min-width: 0; }
  .g-rf .rf-scene { position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 2px #223845; background: #0f1a23; cursor: pointer; }
  .g-rf .rf-scene .game-canvas { border-radius: 0; box-shadow: none; }
  .g-rf .rf-panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
  .g-rf .rf-bank { background: #0f1a23; border-radius: 12px; box-shadow: inset 0 0 0 2px #223845; padding: 8px 14px; display: grid; align-content: center; gap: 3px; min-width: 0; }
  .g-rf .rf-bank span { font: 700 11px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: #6f8796; }
  .g-rf .rf-bank b { font: 400 clamp(24px, 3.4vw, 34px)/1.05 var(--display); color: #f5c518; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .g-rf .rf-bank small { font: 700 13px/1.2 var(--body); color: #aebdc6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .g-rf .rf-assemble { display: grid; place-items: center; align-content: center; gap: 5px; min-width: 150px; padding: 10px 18px; border: 0; border-radius: 12px; cursor: pointer;
    background: #f5c518; color: #0f1a23; box-shadow: 0 5px 0 #a88404; font: 400 22px/1 var(--display); touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 60ms, box-shadow 60ms; }
  .g-rf .rf-assemble small { font: 700 13px/1 var(--body); opacity: .78; }
  .g-rf .rf-assemble:hover { background: #ffd43a; }
  .g-rf .rf-assemble:active, .g-rf .rf-assemble.is-press { transform: translateY(3px); box-shadow: 0 2px 0 #a88404; }
  .g-rf .rf-assemble.is-hint { animation: rf-pulse 1.2s ease-in-out infinite; }
  @keyframes rf-pulse { 50% { box-shadow: 0 5px 0 #a88404, 0 0 0 7px rgba(245,197,24,.3); } }
  .g-rf .rf-shop { flex: 1; min-height: 0; overflow: auto; touch-action: pan-y; overscroll-behavior: contain; background: #172733; border: 2px solid #223845; border-radius: 14px; padding: 10px; display: grid; gap: 8px; align-content: start; }
  .g-rf .rf-h { margin: 2px 2px 0; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font: 700 11px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: #8b9aa6; }
  .g-rf .rf-h span + span { letter-spacing: .04em; text-transform: none; font-weight: 500; font-size: 12px; color: #6f8796; }
  .g-rf .rf-tools, .g-rf .rf-machines { display: grid; gap: 8px; }
  .g-rf .rf-hint { margin: 0 2px; font: 500 13px/1.3 var(--body); color: #6f8796; }
  .g-rf .rf-item { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; text-align: left;
    padding: 7px 12px 7px 8px; border: 0; border-radius: 10px; background: #223845; color: #e6eef2; cursor: pointer; box-shadow: 0 3px 0 #0b141b; touch-action: manipulation; }
  .g-rf .rf-item:hover:not(:disabled) { background: #2b4353; }
  .g-rf .rf-item:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #0b141b; }
  .g-rf .rf-item:disabled { cursor: default; background: #1c2f3c; box-shadow: 0 3px 0 #111d25; }
  .g-rf .rf-item:disabled .rf-icon { opacity: .6; }
  .g-rf .rf-item.is-locked .rf-icon { filter: grayscale(1) brightness(.7); opacity: .35; }
  .g-rf .rf-item.is-tool { box-shadow: 0 3px 0 #0b141b, inset 0 0 0 2px rgba(90,209,230,.45); }
  .g-rf .rf-icon { width: 44px; height: 44px; display: block; border-radius: 8px; background: #132330; }
  .g-rf .rf-info { min-width: 0; display: grid; gap: 3px; }
  .g-rf .rf-info b { font: 400 15px/1.1 var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .g-rf .rf-info small { font: 500 12.5px/1.25 var(--body); color: #aebdc6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .g-rf .rf-item:disabled .rf-info small { color: #8b9aa6; }
  .g-rf .rf-side { display: grid; justify-items: end; gap: 5px; }
  .g-rf .rf-cost { font: 700 15px/1 var(--body); color: #f5c518; white-space: normal; max-width: 125px; text-align: right; line-height: 1.25; font-variant-numeric: tabular-nums; }
  .g-rf .rf-item:disabled .rf-cost { color: #ff8a5c; }
  .g-rf .rf-own { font: 400 13px/1 var(--display); color: #5ad1e6; white-space: nowrap; }
  .g-rf .rf-own.is-new { font: 700 10.5px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: #7cf08a; }
  .g-rf .rf-key { position: absolute; left: 3px; top: 3px; min-width: 16px; padding: 2px 3px; border-radius: 4px; background: #0f1a23; color: #8b9aa6; font: 700 10px/1 var(--body); text-align: center; }
  .g-rf .rf-reset { display: flex; justify-content: center; padding: 6px 0 2px; }
  .g-rf .rf-link { background: none; border: 0; padding: 6px 8px; color: #6f8796; font: 500 13px/1 var(--body); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .g-rf .rf-link:hover { color: #e6eef2; }
  .g-rf .rf-confirm { width: 100%; display: grid; gap: 10px; justify-items: center; text-align: center; padding: 12px; border-radius: 10px; background: #0f1a23; box-shadow: inset 0 0 0 2px #ff6b3d; }
  .g-rf .rf-confirm p { margin: 0; font: 600 14px/1.35 var(--body); color: #e6eef2; }
  .g-rf .rf-confirm div { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .g-rf .rf-btn { border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; font: 400 14px/1 var(--display); background: #223845; color: #e6eef2; box-shadow: 0 3px 0 #0b141b; }
  .g-rf .rf-btn.is-danger { background: #ff6b3d; color: #0f1a23; box-shadow: 0 3px 0 #a33d1c; }
  .g-rf .rf-notice { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); width: min(94%, 470px); z-index: 2; display: flex; align-items: center; gap: 10px;
    padding: 9px 10px 9px 14px; border-radius: 12px; background: rgba(15,26,35,.95); box-shadow: 0 0 0 2px #7cf08a, 0 10px 30px rgba(0,0,0,.5); font: 600 14px/1.3 var(--body); color: #e6eef2; cursor: default; }
  .g-rf .rf-notice b { color: #7cf08a; font-weight: 700; }
  .g-rf .rf-notice p { margin: 0; flex: 1; }
  .g-rf .rf-notice .rf-btn { flex: none; padding: 8px 12px; }
  .g-rf .rf-notice small { display: block; margin-top: 2px; font: 500 12px/1.25 var(--body); color: #8b9aa6; }
  @media (min-width: 860px) {
    .g-rf { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr); gap: 14px; }
    .g-rf .rf-main { justify-content: center; min-height: 0; }
    .g-rf .rf-shop { height: 100%; }
    .g-rf .rf-assemble { min-width: 190px; font-size: 26px; }
  }
  @media (max-width: 520px) {
    .g-rf .rf-notice { top: 6px; padding: 6px 6px 6px 10px; gap: 8px; font-size: 12.5px; line-height: 1.25; border-radius: 10px; }
    .g-rf .rf-notice small { font-size: 11px; }
    .g-rf .rf-notice .rf-btn { padding: 7px 9px; font-size: 12px; }
  }
  @media (max-width: 420px) {
    .g-rf .rf-assemble { min-width: 132px; font-size: 20px; padding: 8px 12px; }
    .g-rf .rf-bank { padding: 7px 12px; }
    .g-rf .rf-shop { padding: 8px; }
    .g-rf .rf-item { gap: 8px; padding-right: 10px; }
  }
  `;

  function sceneThumb(c, t, player) {
    drawWall(c);
    drawBelt(c, 40);
    const bots = [
      [150, { body: '#ff6fa8', head: 'dome', antenna: 'twin', base: 'treads', eye: '#bff6ff' }],
      [270, { body: '#9fdc6b', head: 'tv', antenna: 'dish', base: 'wheels', eye: '#ffd36b' }],
      [540, { body: '#c3a6ff', head: 'box', antenna: 'bolt', base: 'legs', eye: '#9dff9d' }]
    ];
    const s = 94 / 110;
    const g = c.createRadialGradient(STATION, BELT - 42, 6, STATION, BELT - 42, 64);
    g.addColorStop(0, 'rgba(245,197,24,0.45)'); g.addColorStop(1, 'rgba(245,197,24,0)');
    c.fillStyle = g; K.circle(c, STATION, BELT - 42, 64);
    K.drawBot(c, STATION, BELT - 52 * s, 94, Object.assign({}, player, { t, shadow: true, arms: 'wave', mood: 'happy' }));
    for (const [x, o] of bots) K.drawBot(c, x, BELT - 52 * s, 94, Object.assign({ t, shadow: true, mood: 'happy' }, o));
    drawPress(c, 1.2);
    drawRobotArm(c, ARM_X[0], t, 0);
    drawRobotArm(c, ARM_X[2], t, 2);
    drawFrames(c);
  }

  Arcade.register({
    id: 'robot-factory', length: 'Long clicker · 100 permanent upgrades',
    title: 'Robot & Bee Factory',
    cat: 'builder',
    blurb: 'A huge saved clicker: 100 upgrades, robot armies and honey-powered bees.',
    rules: [
      'Tap Assemble (or the factory floor) to build robots. Robots are your money.',
      'Buy 100 permanent upgrades and 12 machine types. Bee helpers make honey for special research.',
      'Your factory saves here and works for up to 8 hours while you are away.',
      'Tap your own bot when it rolls by as the flagship model for a bonus.'
    ],
    how: 'Tap Assemble or the floor · Space builds · 1 to 7 buy',
    accent: '#f5c518',
    usesPlayer: true,

    thumb(ctx, w, h, kit, player) {
      const s = h / H;
      ctx.save();
      ctx.translate((w - W * s) / 2, 0);
      ctx.scale(s, s);
      sceneThumb(ctx, 0.35, player);
      K.drawHive(ctx, 660, 230, 90); K.drawBee(ctx, 590, 130, 60, .3);
      const say = (txt, x, y, col, size) => {
        ctx.font = K.font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(8,14,20,0.9)'; ctx.strokeText(txt, x, y);
        ctx.fillStyle = col; ctx.fillText(txt, x, y);
      };
      say('+2', 292, 142, C.safety, 30);
      say('+2', 520, 160, C.safety, 26);
      say('FLAGSHIP', STATION, 186, C.safety, 18);
      ctx.restore();
    },

    start(api) {
      api.css(CSS);
      const el = api.el;
      const player = api.player;

      // ---------- saved state ----------
      const fresh = () => ({ v: 2, honey: 0, totalHoney: 0, bank: 0, total: 0, clicks: 0, owned: {}, tools: [], seen: [], ms: 0, flags: 0, savedAt: Date.now() });
      function load() {
        const raw = api.load(null), d = fresh();
        if (raw && typeof raw === 'object') {
          const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
          d.bank = num(raw.bank); d.total = Math.max(num(raw.total), d.bank);
          d.honey = num(raw.honey); d.totalHoney = Math.max(d.honey, num(raw.totalHoney));
          d.clicks = num(raw.clicks); d.flags = num(raw.flags);
          d.ms = Math.min(MILESTONES.length, Math.floor(num(raw.ms)));
          d.savedAt = num(raw.savedAt) || Date.now();
          for (const m of MACHINES) d.owned[m.id] = Math.floor(num(raw.owned && raw.owned[m.id]));
          const ok = id => TOOLS.some(t => t.id === id);
          d.tools = Array.isArray(raw.tools) ? [...new Set(raw.tools.filter(ok))] : [];
          d.seen = Array.isArray(raw.seen) ? raw.seen.filter(ok) : [];
        }
        for (const m of MACHINES) d.owned[m.id] = d.owned[m.id] || 0;
        return d;
      }
      let D = load();
      const save = () => { D.savedAt = Date.now(); api.save(D); };

      const owned = id => D.owned[id] || 0;
      const rateOf = m => BeeEconomy.rates([m], { owned: { [m.id]: 1 }, tools: D.tools }, TOOLS).robots;
      const costOf = m => Math.ceil(m.cost * Math.pow(GROWTH, owned(m.id)));
      let R = 0, honeyRate = 0;
      function recalc() { const r = BeeEconomy.rates(MACHINES, D, TOOLS); R = r.robots; honeyRate = r.honey; }
      function clickPower() { return BeeEconomy.tapPower(D, TOOLS, R); }
      function gainHoney(n) { D.honey += n; D.totalHoney += n; }
      recalc();

      // ---------- DOM ----------
      const scene = el('div', { class: 'rf-scene' });
      const noticeText = el('p');
      const noticeBtn = el('button', { type: 'button', class: 'rf-btn' }, 'Great!');
      const notice = el('div', { class: 'rf-notice', role: 'status', hidden: true }, noticeText, noticeBtn);
      const bankNum = el('b', null, '0');
      const rateLine = el('small', null, '');
      const clickLine = el('small', null, '');
      const assembleBtn = el('button', { type: 'button', class: 'rf-assemble' }, el('span', null, 'Assemble'), clickLine);
      const panel = el('div', { class: 'rf-panel' }, el('div', { class: 'rf-bank' }, el('span', null, 'Robots'), bankNum, rateLine), assembleBtn);
      const honeyLine = el('p', { class: 'rf-hint', role: 'status' });
      const progressLine = el('p', { class: 'rf-hint' });
      const toolsHead = el('p', { class: 'rf-h' }, el('span', null, 'Research'), el('span', null, '100 permanent upgrades'));
      const toolsBox = el('div', { class: 'rf-tools' });
      const toolHint = el('p', { class: 'rf-hint' });
      const machBox = el('div', { class: 'rf-machines' });
      const resetBox = el('div', { class: 'rf-reset' });
      const shop = el('div', { class: 'rf-shop' },
        honeyLine, progressLine, toolsHead, toolsBox, toolHint,
        el('p', { class: 'rf-h' }, el('span', null, 'Machines'), el('span', null, 'build robots for you')),
        machBox, resetBox);
      const root = el('div', { class: 'g-rf' }, el('div', { class: 'rf-main' }, scene, panel), shop);
      api.stage.append(root);
      scene.append(notice);
      const cv = api.canvas(W, H, { parent: scene }), ctx = cv.ctx;
      const k = Math.min(2.5, Math.max(1.5, cv.k || 2));
      const wallImg = K.layer(W, H, drawWall, k);
      const frameImg = K.layer(W, H, drawFrames, k);

      function releaseFocus(btn, e) {
        if (e && e.detail > 0) { btn.blur(); try { api.stage.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
      }

      const rows = MACHINES.map((m, i) => {
        const name = el('b', null, m.name);
        const desc = el('small', null, m.desc);
        const cost = el('span', { class: 'rf-cost' });
        const own = el('span', { class: 'rf-own' });
        const btn = el('button', { type: 'button', class: 'rf-item' },
          iconCanvas(ICONS[m.id] || (c => { K.drawHive(c, 22, 23, 34); K.drawBee(c, 31, 10, 14, 0); })), el('span', { class: 'rf-info' }, name, desc), el('span', { class: 'rf-side' }, cost, own));
        if (!api.isTouch && i < 7) btn.append(el('kbd', { class: 'rf-key', 'aria-hidden': 'true' }, String(i + 1)));
        api.on(btn, 'click', e => { buyMachine(m); releaseFocus(btn, e); });
        machBox.append(btn);
        return { m, btn, name, desc, cost, own, state: '', lastCost: -1, lastOwn: -1 };
      });
      const toolRows = TOOLS.map(t => {
        const btn = el('button', { type: 'button', class: 'rf-item is-tool', hidden: true },
          iconCanvas(TOOL_ICONS[t.id] || (c => K.drawBee(c, 22, 24, 32, 0))), el('span', { class: 'rf-info' }, el('b', null, t.name), el('small', null, t.desc)),
          el('span', { class: 'rf-side' }, el('span', { class: 'rf-cost' }, fmt(t.cost) + (t.honeyCost ? ' + ' + fmt(t.honeyCost) + ' honey' : ''))));
        btn.title = t.name + ': ' + t.desc;
        api.on(btn, 'click', e => { buyTool(t); releaseFocus(btn, e); });
        toolsBox.append(btn);
        return { t, btn };
      });

      // reset, with an in-page confirm step
      function showResetLink() {
        const link = el('button', { type: 'button', class: 'rf-link' }, 'Reset factory');
        api.on(link, 'click', showConfirm);
        resetBox.replaceChildren(link);
      }
      function showConfirm() {
        const yes = el('button', { type: 'button', class: 'rf-btn is-danger' }, 'Yes, reset');
        const no = el('button', { type: 'button', class: 'rf-btn' }, 'Keep my factory');
        api.on(yes, 'click', doReset);
        api.on(no, 'click', showResetLink);
        resetBox.replaceChildren(el('div', { class: 'rf-confirm' },
          el('p', null, 'Scrap every robot and machine and start again? Your best score stays.'),
          el('div', null, yes, no)));
        try { no.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
        resetBox.scrollIntoView({ block: 'nearest' });
      }
      function doReset() {
        D = fresh();
        recalc();
        S.bots.length = 0; S.back.length = 0; S.flag = null; S.flagT = K.rand(40, 70);
        save();
        showResetLink();
        refreshTop(); refreshShop(true);
        api.score(0);
        api.stat('Per sec', '0');
        api.toast('Fresh start!');
        api.sfx('power');
      }
      showResetLink();

      // ---------- effects ----------
      const fx = K.particles();
      const says = [];
      let ts = 1;   // canvas text scale, so words stay readable when the scene is drawn small
      const measureText = () => { ts = K.clamp(620 / Math.max(200, cv.el.clientWidth || W), 1, 1.75); };
      measureText();
      const say = (text, x, y, color, size, life) => {
        const half = Math.min(W / 2, text.length * size * ts * 0.37 + 6);   // keep the whole word on screen
        says.push({ text, x: K.clamp(x, half, W - half), y, color, size: size * ts, life: life || 0.9, age: 0 });
        if (says.length > 40) says.shift();
      };
      function drawSays() {
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        for (const f of says) {
          const pop = Math.min(1, f.age / 0.12), s = 0.65 + 0.35 * pop + Math.sin(pop * Math.PI) * 0.15;
          ctx.globalAlpha = Math.min(1, (f.life - f.age) * 3);
          ctx.font = K.font(Math.round(f.size * s));
          ctx.lineWidth = Math.max(3, f.size * 0.22); ctx.strokeStyle = 'rgba(8,14,20,0.9)';
          ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.restore();
      }

      // ---------- scene state ----------
      const S = {
        t: 0, wall: Date.now(), uiT: 0, shopT: 0,
        bots: [], back: [], spawnT: 0.6, backT: 1, pulse: 0, pressHit: false,
        flag: null, flagT: K.rand(16, 28), noticeOff: null
      };
      const beltSpeed = () => 70 + Math.min(70, owned('belt') * 4);
      function randomBot() {
        return { body: K.pick(K.PLATING), head: K.pick(HEADS), antenna: K.pick(ANTS), base: K.pick(BASES), eye: K.pick(EYES), walk: true, shadow: true, mood: 'happy', t: 0 };
      }
      function roomAt(x, gap) { for (const b of S.bots) if (Math.abs(b.x - x) < gap) return b; return null; }
      function spawnBot(x, pop) {
        if (S.bots.length >= 16 || roomAt(x, 78)) return null;
        const b = { x, h: 94, o: randomBot(), pop: pop ? 0 : 1, hop: 0, mul: 1, flag: false, phase: Math.random() * 5 };
        S.bots.push(b);
        return b;
      }
      function spawnFlag() {
        if (roomAt(-40, 86)) return false;
        const b = { x: -40, h: 102, o: Object.assign({}, player, { walk: true, shadow: true, mood: 'happy', arms: 'wave', t: 0 }), pop: 1, hop: 0, mul: 1, flag: true, clicked: false, phase: 0 };
        S.bots.push(b);
        S.flag = b;
        api.tone(988, 0.1, 'triangle', 0.045); api.tone(1318, 0.16, 'triangle', 0.045, 0, 0.1);
        return true;
      }

      // ---------- economy ----------
      function gain(n) {
        if (!(n > 0)) return;
        D.bank += n; D.total += n;
        let hit = -1;
        while (D.ms < MILESTONES.length && D.total >= MILESTONES[D.ms]) { hit = D.ms; D.ms++; }
        if (hit >= 0) { api.toast(fmt(MILESTONES[hit]) + ' robots built!'); api.sfx('levelup'); }
      }
      function assemble(x, y, viaButton) {
        const n = clickPower();
        gain(n);
        gainHoney(Math.max(1, n * .01));
        D.clicks++;
        say('+' + fmtGain(n), x + K.rand(-12, 12), y, C.safety, n >= 1000 ? 30 : 26);
        fx.burst(x, y + 12, [C.safety, '#ffffff', C.glow], 7, 170, { gravity: 420, size: 3.2, life: 0.5 });
        api.tone(K.rand(380, 430), 0.05, 'square', 0.03, 200);
        const near = roomAt(STATION, 60);
        if (near) near.hop = 1;
        else { const b = spawnBot(STATION, true); if (b) fx.burst(STATION, BELT - 40, [b.o.body, '#ffffff'], 10, 200, { gravity: 300 }); }
        S.pulse = 1;
        if (viaButton) {
          assembleBtn.classList.add('is-press');
          api.after(80, () => assembleBtn.classList.remove('is-press'));
        }
        refreshTop();
      }
      function buyMachine(m) {
        const c = costOf(m);
        if (D.bank < c) { api.sfx('error'); return; }
        D.bank -= c;
        D.owned[m.id]++;
        recalc();
        api.sfx('coin');
        const first = D.owned[m.id] === 1;
        const spot = { arm: [ARM_X[Math.min(3, D.owned.arm - 1)], 130], belt: [400, 200], line: [STATION, 110], weld: [694, 180], boss: [96, 120], fusion: [716, 76], nano: [400, 150] }[m.id] || [580, 130];
        fx.burst(spot[0], spot[1], [C.safety, C.glow, '#ffffff'], first ? 26 : 12, first ? 280 : 180, { gravity: 300 });
        say(first ? 'NEW MACHINE!' : '+' + fmtRate(rateOf(m)) + '/s', spot[0], spot[1] - 20, first ? C.good : C.glow, first ? 24 : 20, 1.2);
        api.stat('Per sec', fmtRate(R));
        save();
        refreshTop(); refreshShop(true);
      }
      function buyTool(t) {
        if (D.tools.indexOf(t.id) >= 0 || D.total < t.unlock) return;
        if (D.bank < t.cost || D.honey < (t.honeyCost || 0)) { api.sfx('error'); return; }
        D.bank -= t.cost; D.honey -= t.honeyCost || 0;
        D.tools.push(t.id);
        recalc();
        api.stat('Per sec', fmtRate(R));
        api.sfx('power');
        say(t.name.toUpperCase() + '!', STATION, 120, C.glow, 24, 1.3);
        fx.burst(STATION, 150, [C.glow, C.safety, '#ffffff'], 24, 260, { gravity: 250 });
        save();
        refreshTop(); refreshShop(true);
      }
      function clickFlag(b) {
        if (b.clicked) return;
        b.clicked = true; b.mul = 5; b.hop = 1;
        const bonus = Math.max(25, clickPower() * 20, R * 30);
        gain(bonus);
        D.flags++;
        const y = BELT - 110, sx = K.clamp(b.x, 130 * ts, W - 130 * ts);
        say('FLAGSHIP BONUS', sx, y - 26 * ts, C.good, 22, 1.5);
        say('+' + fmt(bonus), sx, y + 4, C.safety, 30, 1.5);
        fx.burst(b.x, BELT - 50, [C.safety, C.good, '#ffffff', player.body], 30, 320, { gravity: 300 });
        api.sfx('win');
        refreshTop();
      }
      function showNotice(n, capped) {
        const parts = [el('b', null, 'Welcome back! '), 'While you were away your factory built ' + fmt(n) + (Math.floor(n) === 1 ? ' robot.' : ' robots.')];
        if (capped) parts.push(el('small', null, 'It can work on its own for up to eight hours.'));
        noticeText.replaceChildren(...parts);
        notice.hidden = false;
        if (S.noticeOff) S.noticeOff();
        S.noticeOff = api.after(8000, () => { notice.hidden = true; });
        api.sfx('coin');
      }
      api.on(noticeBtn, 'click', e => { notice.hidden = true; releaseFocus(noticeBtn, e); });
      function awayGain(sec) {
        gainHoney(honeyRate * Math.min(sec, OFFLINE_CAP));
        const n = R * Math.min(sec, OFFLINE_CAP);
        if (!(n > 0)) return;
        gain(n);
        if (sec >= 30 && n >= 1) showNotice(n, sec > OFFLINE_CAP);
      }

      // ---------- readouts ----------
      let lastBank = '', lastRate = '', lastClick = '';
      function refreshTop() {
        honeyLine.textContent = 'Honey: ' + fmt(D.honey) + ' · ' + fmtRate(honeyRate) + '/sec · Taps gather nectar too';
        progressLine.textContent = 'Research ' + D.tools.length + '/100 · ' + (D.tools.length === 100 ? 'Royal colony complete! Keep growing.' : 'More research unlocks as you build.');
        api.stat('Upgrades', D.tools.length + '/100');
        const b = fmt(D.bank);
        if (b !== lastBank) { bankNum.textContent = b; lastBank = b; }
        const r = R > 0 ? fmtRate(R) + ' per second' : 'No machines yet';
        if (r !== lastRate) { rateLine.textContent = r; lastRate = r; }
        const cp = '+' + fmtGain(clickPower()) + ' per tap';
        if (cp !== lastClick) { clickLine.textContent = cp; lastClick = cp; }
        assembleBtn.classList.toggle('is-hint', D.total < 15);
      }
      function refreshShop(force) {
        let teaser = false;
        rows.forEach((r, i) => {
          const m = r.m, o = owned(m.id);
          let state = 'open';
          if (!(o > 0 || i === 0 || D.total >= m.cost * 0.35)) { state = teaser ? 'hidden' : 'locked'; teaser = true; }
          if (state !== r.state || force) {
            r.state = state;
            r.btn.hidden = state === 'hidden';
            r.btn.classList.toggle('is-locked', state === 'locked');
            if (state === 'locked') {
              r.name.textContent = '???';
              r.desc.textContent = 'Build ' + fmt(Math.ceil(m.cost * 0.35)) + ' robots to reveal';
              r.cost.textContent = ''; r.own.textContent = '';
              r.btn.title = '';
              r.lastCost = -1; r.lastOwn = -1;
            } else if (state === 'open') {
              r.name.textContent = m.name;
              r.desc.textContent = m.desc + ' · +' + fmtRate(rateOf(m)) + '/s';
              r.btn.title = m.name + ': each one builds ' + fmtRate(rateOf(m)) + (rateOf(m) === 1 ? ' robot' : ' robots') + ' per second.';
            }
          }
          if (state === 'open') {
            const c = costOf(m);
            if (c !== r.lastCost) { r.cost.textContent = fmt(c); r.lastCost = c; }
            if (o !== r.lastOwn) { r.own.textContent = o ? '×' + o : 'New'; r.own.classList.toggle('is-new', !o); r.lastOwn = o; }
            r.btn.disabled = D.bank < c;
          } else r.btn.disabled = true;
        });
        let avail = 0, next = null;
        for (const tr of toolRows) {
          const t = tr.t, have = D.tools.indexOf(t.id) >= 0, open = !have && D.total >= t.unlock;
          tr.btn.hidden = !open;
          if (open) {
            avail++;
            tr.btn.disabled = D.bank < t.cost || D.honey < (t.honeyCost || 0);
            if (D.seen.indexOf(t.id) < 0) { D.seen.push(t.id); api.toast('New research available!', { color: C.glow }); api.sfx('power'); }
          } else if (!have && !next) next = t;
        }
        toolsHead.hidden = !avail && !next;
        toolsBox.hidden = !avail;
        toolHint.hidden = !next || avail > 0;
        if (next) { toolHint.hidden = false; toolHint.textContent = 'Next research: ' + next.name + ' at ' + fmt(next.unlock) + ' robots built.'; }
      }

      // ---------- input ----------
      api.on(assembleBtn, 'click', e => { assemble(STATION, BELT - 104, e.detail === 0); releaseFocus(assembleBtn, e); });
      api.on(cv.el, 'pointerdown', e => {
        const p = cv.toLocal(e);
        const f = S.flag;
        if (f && !f.clicked) {
          const s = f.h / 110, cy = BELT - 52 * s, reach = f.h * 0.5 * Math.max(1, ts * 0.8);
          const onBot = Math.abs(p.x - f.x) < reach && p.y > cy - f.h * 0.8 && p.y < BELT + 20;
          const g = S.tag;
          const onTag = g && p.x > g.x - 6 && p.x < g.x + g.w + 6 && p.y > g.y - 6 && p.y < g.y + g.h + 14;
          if (onBot || onTag) { clickFlag(f); return; }
        }
        assemble(p.x, Math.min(p.y, BELT - 20), false);
      });
      api.onKey((name, e) => {
        if (e.repeat) return;
        const code = e.code || '';
        const onButton = e.target && e.target.tagName === 'BUTTON';
        if (onButton && (code === 'Space' || code === 'Enter' || code === 'NumpadEnter')) return;   // the focused button handles it
        if (name === 'fire' || code === 'Enter' || code === 'NumpadEnter') { assemble(STATION, BELT - 104, true); return; }
        const m = /^(Digit|Numpad)([1-7])$/.exec(code);
        if (m) {
          const r = rows[Number(m[2]) - 1];
          if (r && r.state === 'open' && D.bank >= costOf(r.m)) buyMachine(r.m);
          else api.sfx('error');
        }
      });
      api.on(document, 'visibilitychange', () => { if (document.hidden) save(); });
      api.on(window, 'pagehide', save);

      // ---------- update + draw ----------
      function update(dt) {
        const t = S.t, speed = beltSpeed();
        const flagDue = !S.flag && D.total >= 25 && S.flagT <= 0;
        if (R > 0 && !flagDue) {      // regular robots wait while the flagship is due, so it can get onto the belt
          S.spawnT -= dt;
          if (S.spawnT <= 0) {
            S.spawnT = K.clamp(2.6 / (0.6 + Math.log10(1 + R)), 84 / speed, 3.2) * K.rand(0.85, 1.2);
            spawnBot(-40, false);
          }
        }
        if (!S.flag && D.total >= 25) {
          S.flagT -= dt;
          if (S.flagT <= 0 && spawnFlag()) S.flagT = K.rand(45, 80);
        }
        for (let i = S.bots.length - 1; i >= 0; i--) {
          const b = S.bots[i];
          b.x += speed * b.mul * dt;
          b.pop = Math.min(1, b.pop + dt * 4);
          b.hop = Math.max(0, b.hop - dt * 3.5);
          if (b.flag && b.clicked && Math.random() < dt * 30) fx.burst(b.x - 20, BELT - 30, [C.safety, '#ffffff'], 2, 60, { gravity: 0, life: 0.4 });
          if (b.x > W + 60) { S.bots.splice(i, 1); if (b === S.flag) S.flag = null; }
        }
        if (owned('belt') > 0) {
          S.backT -= dt;
          if (S.backT <= 0) { S.backT = K.rand(1.3, 2.3); if (S.back.length < 12) S.back.push({ x: 104, o: randomBot() }); }
          for (let i = S.back.length - 1; i >= 0; i--) { const b = S.back[i]; b.x += 46 * dt; if (b.x > 700) S.back.splice(i, 1); }
        }
        if (owned('line') > 0) {
          const e = pressExt(t);
          if (e >= 1 && !S.pressHit) { S.pressHit = true; fx.burst(STATION, 180, ['#8b9aa6', '#c9d4db'], 6, 110, { gravity: 200, size: 2.5, life: 0.4 }); }
          else if (e < 1) S.pressHit = false;
        }
        if (owned('weld') > 0 && Math.random() < dt * 16) {
          const p = torchTip(t);
          fx.burst(p.x, p.y + 4, ['#ffd36b', '#ff9d2e', '#ffffff'], 3, 170, { gravity: 700, size: 2.4, life: 0.45, lift: 60 });
        }
        const arms = Math.min(4, owned('arm'));
        for (let i = 0; i < arms; i++) {
          if (Math.random() < dt * 0.8) { const p = armTip(ARM_X[i], t, i); fx.burst(p.tx, p.ty + 4, [C.glow, '#ffffff'], 3, 110, { gravity: 500, size: 2.2, life: 0.35 }); }
        }
        S.pulse = Math.max(0, S.pulse - dt * 3);
        for (let i = says.length - 1; i >= 0; i--) { const f = says[i]; f.age += dt; f.y -= 40 * dt; if (f.age >= f.life) says.splice(i, 1); }
        fx.update(dt);
      }

      function drawBeltBot(b, t) {
        const q = b.pop - 1, e = b.pop < 1 ? Math.max(0.05, 1 + 2.7 * q * q * q + 1.7 * q * q) : 1;
        const hh = b.h * e, s = hh / 110;
        const hop = Math.sin(b.hop * Math.PI) * 18;
        b.o.t = t + b.phase;
        if (b.flag) {
          const g = 0.5 + 0.5 * Math.sin(t * 6);
          ctx.fillStyle = 'rgba(245,197,24,' + (0.18 + g * 0.14).toFixed(3) + ')';
          K.circle(ctx, b.x, BELT - 46, 58);
          K.ring(ctx, b.x, BELT - 46, 54 + g * 4, 3, 'rgba(245,197,24,0.7)');
        }
        K.drawBot(ctx, b.x, BELT - 52 * s - hop, hh, b.o);
      }

      function render() {
        const t = S.t, speed = beltSpeed();
        ctx.drawImage(wallImg, 0, 0, W, H);
        if (owned('fusion') > 0) drawFusion(ctx, t);
        if (owned('belt') > 0) {
          ctx.fillStyle = '#16222a'; ctx.fillRect(40, 200, 720, 9);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          const off = (t * 46) % 18;
          for (let x = 40 + off; x < 760; x += 18) ctx.fillRect(x, 201, 3, 7);
          ctx.fillStyle = '#2b4353'; ctx.fillRect(40, 209, 720, 4);
          for (const b of S.back) {
            const e = Math.min(1, (b.x - 104) / 24, (700 - b.x) / 24);
            if (e <= 0) continue;
            const hh = 44 * e;
            b.o.t = t; K.drawBot(ctx, b.x, 200 - 52 * (hh / 110), hh, b.o);
          }
          ctx.fillStyle = 'rgba(19,35,48,0.38)'; ctx.fillRect(40, 146, 720, 68);
        }
        if (owned('weld') > 0) drawWeldBooth(ctx, t);
        drawBelt(ctx, t * speed);
        // assembly spot
        const pl = 0.35 + S.pulse * 0.65;
        ctx.fillStyle = 'rgba(245,197,24,' + (0.16 + pl * 0.25).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(STATION, BELT + 5, 50 + S.pulse * 10, 7, 0, 0, Math.PI * 2); ctx.fill();
        for (const b of S.bots) drawBeltBot(b, t);
        if (owned('line') > 0) drawPress(ctx, t);
        const arms = Math.min(4, owned('arm'));
        for (let i = 0; i < arms; i++) drawRobotArm(ctx, ARM_X[i], t, i);
        if (owned('arm') > 4) {
          ctx.fillStyle = '#0c151c'; K.rr(ctx, ARM_X[3] + 26, 46, 52, 20, 5);
          K.text(ctx, '×' + owned('arm'), ARM_X[3] + 52, 57, { size: 12, body: true, color: C.safety, shadow: false });
        }
        if (owned('weld') > 0) drawTorch(ctx, t);
        if (owned('boss') > 0) drawForeman(ctx, t);
        ctx.drawImage(frameImg, 0, 0, W, H);
        if (owned('nano') > 0) drawSwarm(ctx, t);
        const f = S.flag;
        S.tag = null;
        if (f && !f.clicked && f.x > 10 && f.x < W - 10) {
          const hw = 62 * ts, hh = 15 * ts;
          const y = BELT - 124 - hh + Math.sin(t * 5) * 4, tx = K.clamp(f.x, hw + 4, W - hw - 4);
          S.tag = { x: tx - hw, y: y - hh, w: hw * 2, h: hh * 2 };
          ctx.fillStyle = 'rgba(12,21,28,0.9)'; K.rr(ctx, tx - hw, y - hh, hw * 2, hh * 2, hh);
          ctx.strokeStyle = C.safety; ctx.lineWidth = 2 * ts; K.rrPath(ctx, tx - hw, y - hh, hw * 2, hh * 2, hh); ctx.stroke();
          K.text(ctx, 'FLAGSHIP', tx, y + 1, { size: Math.round(15 * ts), color: C.safety, shadow: false });
          ctx.fillStyle = C.safety;
          ctx.beginPath(); ctx.moveTo(f.x - 8, y + hh + 3); ctx.lineTo(f.x + 8, y + hh + 3); ctx.lineTo(f.x, y + hh + 12); ctx.closePath(); ctx.fill();
        }
        const bees = Math.min(12, 2 + Math.floor(D.tools.length / 10) + owned('hive'));
        for (let i = 0; i < bees; i++) K.drawBee(ctx, 100 + ((i * 119 + t * 33) % 600), 95 + Math.sin(t * 2 + i) * 25, 24, t + i);
        K.drawHive(ctx, 748, 258, 54);
        for (let i = 0; i < 5; i++) K.drawFlower(ctx, 52 + i * 27, 329, 18, i % 2 ? '#ffc1dc' : '#fff4cf');
        fx.draw(ctx);
        drawSays();
        if (D.total < 10) {
          const a = 0.65 + 0.35 * Math.sin(t * 4);
          ctx.globalAlpha = a;
          K.text(ctx, 'Tap to build a robot!', STATION, 150, { size: Math.round(24 * ts), color: C.ink });
          ctx.globalAlpha = 1;
        }
      }

      // ---------- start up ----------
      const away = (Date.now() - D.savedAt) / 1000;
      if (away > 2) awayGain(away);
      api.stat('Per sec', fmtRate(R));
      api.score(Math.floor(D.total));
      refreshTop();
      refreshShop(true);
      // a few robots already on the belt when the factory has been running
      if (R > 0) for (let x = 130; x < W - 80; x += K.rand(120, 180)) spawnBot(x, false);

      api.loop(dt => {
        S.t += dt;
        const now = Date.now();
        let real = (now - S.wall) / 1000;
        S.wall = now;
        if (!(real >= 0)) real = 0;
        if (real > 2) awayGain(real);         // paused or tab hidden: the factory kept working
        else { gain(R * real); gainHoney(honeyRate * real); }
        update(dt);
        render();
        S.uiT -= dt;
        if (S.uiT <= 0) { S.uiT = 0.1; refreshTop(); }
        S.shopT -= dt;
        if (S.shopT <= 0) { S.shopT = 0.2; refreshShop(false); measureText(); }
      });
      api.every(4000, save);
      api.every(1000, () => api.score(Math.floor(D.total)));
      api.every(5000, () => api.record(Math.floor(D.total)));
      save();
      return () => { save(); api.record(Math.floor(D.total)); };
    }
  });
})();
