/* Bot Yard Arcade · kit.js
 * The shared parts bin: palette, fonts, math, canvas drawing helpers and the
 * robot renderer. Exposed as window.BotKit; games receive it as api.kit.
 * Every helper draws in the caller's current coordinate space. */
(function () {
  'use strict';

  // ---------- palette (taken from Scrap Yard Bot) ----------
  const C = {
    bg: '#0f1a23',        // deepest steel: screens and page ground
    panel: '#172733',     // raised panels
    panel2: '#1c2f3c',
    line: '#223845',      // borders and grid lines
    muted: '#6f8796',     // secondary text
    ink: '#e6eef2',       // primary text
    safety: '#f5c518',    // safety yellow: the main accent
    hazard: '#ff6b3d',    // hazard orange: danger
    glow: '#5ad1e6',      // cyan LED glow
    steel: '#8b9aa6',     // bare metal
    steelDark: '#39505e',
    dark: '#1b2a35',      // visors, tyres
    eye: '#bff6ff',
    good: '#7cf08a',
    bad: '#ff4d4d',
    gold: '#e0c064'
  };
  const PLATING = ['#5ad1e6', '#f5c518', '#ff8a5c', '#9fdc6b', '#c3a6ff', '#ff6fa8', '#c9d4db', '#ff5a5a'];

  const DISPLAY = '"Bungee", "Chakra Petch", system-ui, sans-serif';
  const BODY = '"Chakra Petch", ui-sans-serif, system-ui, sans-serif';
  /** font(24) → Bungee display face. font(14, 'body') → Chakra Petch bold. font(14, 'body', 500) → medium. */
  function font(px, kind, weight) {
    return kind === 'body' ? (weight || 700) + ' ' + px + 'px ' + BODY : px + 'px ' + DISPLAY;
  }

  // ---------- math ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1)); // inclusive
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  /** Axis-aligned box overlap. Boxes are {x, y, w, h} with x/y at the top-left. */
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---------- colour ----------
  function hexRgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = parseInt(h, 16) || 0;
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  /** shade('#5ad1e6', -0.3) darkens 30%; shade(hex, 0.3) lightens 30%. */
  function shade(hex, amt) {
    const [r, g, b] = hexRgb(hex);
    const target = amt < 0 ? 0 : 255, p = Math.min(1, Math.abs(amt));
    const mix = v => Math.round(v + (target - v) * p);
    return '#' + ((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1);
  }
  /** alpha('#5ad1e6', 0.4) → 'rgba(90,209,230,0.4)' */
  function alpha(hex, a) {
    const [r, g, b] = hexRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // ---------- shapes ----------
  /** Round-rect path only (use for stroke or clip). r may be a number or [tl, tr, br, bl]. */
  function rrPath(c, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const radii = Array.isArray(r)
      ? r.map(v => Math.max(0, Math.min(v || 0, w / 2, h / 2)))
      : Math.max(0, Math.min(r || 0, w / 2, h / 2));
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, radii); return; }
    const q = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
    const tl = q[0], tr = q[1] ?? q[0], br = q[2] ?? q[0], bl = q[3] ?? q[1] ?? q[0];
    c.moveTo(x + tl, y);
    c.lineTo(x + w - tr, y); c.arcTo(x + w, y, x + w, y + tr, tr);
    c.lineTo(x + w, y + h - br); c.arcTo(x + w, y + h, x + w - br, y + h, br);
    c.lineTo(x + bl, y + h); c.arcTo(x, y + h, x, y + h - bl, bl);
    c.lineTo(x, y + tl); c.arcTo(x, y, x + tl, y, tl);
    c.closePath();
  }
  /** Filled round rect in the current fillStyle. */
  function rr(c, x, y, w, h, r) { rrPath(c, x, y, w, h, r); c.fill(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fill(); }
  function ring(c, x, y, r, width, color) {
    c.save(); c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.stroke(); c.restore();
  }
  /** Text with a soft drop shadow. o: {size, color, align, baseline, body, weight, shadow:false, font} */
  function text(c, str, x, y, o) {
    o = o || {};
    c.save();
    c.font = o.font || font(o.size || 20, o.body ? 'body' : 'display', o.weight);
    c.textAlign = o.align || 'center';
    c.textBaseline = o.baseline || 'middle';
    if (o.shadow !== false) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillText(str, x + 2, y + 2); }
    c.fillStyle = o.color || C.ink;
    c.fillText(str, x, y);
    c.restore();
  }

  // ---------- parts ----------
  /** Toothed gear centred on x,y. o: {teeth, color, hole, rot} */
  function gear(c, x, y, r, o) {
    o = o || {};
    const teeth = o.teeth || 8, inner = r * 0.76, step = Math.PI * 2 / teeth;
    c.save(); c.translate(x, y); c.rotate(o.rot || 0);
    c.fillStyle = o.color || C.gold;
    c.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      c.lineTo(Math.cos(a - step * 0.32) * inner, Math.sin(a - step * 0.32) * inner);
      c.lineTo(Math.cos(a - step * 0.17) * r, Math.sin(a - step * 0.17) * r);
      c.lineTo(Math.cos(a + step * 0.17) * r, Math.sin(a + step * 0.17) * r);
      c.lineTo(Math.cos(a + step * 0.32) * inner, Math.sin(a + step * 0.32) * inner);
    }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; circle(c, 0, 0, inner * 0.78);
    c.fillStyle = o.color || C.gold; circle(c, 0, 0, inner * 0.62);
    c.fillStyle = o.hole || C.bg; circle(c, 0, 0, r * 0.28);
    c.restore();
  }
  /** Hex nut centred on x,y with radius r. */
  function nut(c, x, y, r, o) {
    o = o || {};
    c.save(); c.translate(x, y); c.rotate(o.rot || 0);
    c.fillStyle = o.color || C.steel;
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath(); c.moveTo(r, 0); c.lineTo(r / 2, -r * 0.866); c.lineTo(-r / 2, -r * 0.866); c.lineTo(0, 0); c.closePath(); c.fill();
    c.fillStyle = o.hole || C.bg; circle(c, 0, 0, r * 0.45);
    c.restore();
  }
  /** Hex-head bolt, head at the top, centred on x,y, total height s. */
  function bolt(c, x, y, s, o) {
    o = o || {};
    const k = s / 30;
    c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(k, k);
    c.fillStyle = o.color || C.steel;
    c.fillRect(-4, -6, 8, 21);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 5; i++) c.fillRect(-4, -3 + i * 4, 8, 1.4);
    c.fillStyle = o.color || C.steel; rr(c, -9, -15, 18, 9, 2);
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-7, -13, 14, 2);
    c.restore();
  }
  /** Battery centred on x,y. Vertical when h > w. level 0..1 */
  function battery(c, x, y, w, h, level, color) {
    const lvl = clamp(level == null ? 1 : level, 0, 1);
    const col = color || (lvl > 0.5 ? C.good : lvl > 0.2 ? C.safety : C.bad);
    const vert = h > w;
    c.save(); c.translate(x - w / 2, y - h / 2);
    const nubW = vert ? w * 0.44 : w * 0.08, nubH = vert ? h * 0.08 : h * 0.44;
    c.fillStyle = C.steel;
    if (vert) rr(c, (w - nubW) / 2, -nubH + 1, nubW, nubH, 2);
    else rr(c, w - 1, (h - nubH) / 2, nubW, nubH, 2);
    c.fillStyle = C.steel; rr(c, 0, 0, w, h, Math.min(w, h) * 0.22);
    const pad = Math.max(2, Math.min(w, h) * 0.14);
    c.fillStyle = C.dark; rr(c, pad, pad, w - pad * 2, h - pad * 2, Math.min(w, h) * 0.12);
    c.fillStyle = col;
    if (vert) { const fh = (h - pad * 4) * lvl; rr(c, pad * 2, h - pad * 2 - fh, w - pad * 4, fh, 2); }
    else { const fw = (w - pad * 4) * lvl; rr(c, pad * 2, pad * 2, fw, h - pad * 4, 2); }
    c.restore();
  }
  /** Microchip centred on x,y, size s. */
  function chip(c, x, y, s, color) {
    c.save(); c.translate(x, y);
    const h = s / 2;
    c.fillStyle = C.steel;
    for (let i = -2; i <= 2; i++) {
      const p = i * s * 0.16;
      c.fillRect(p - 1.5, -h - s * 0.12, 3, s * 0.14); c.fillRect(p - 1.5, h - 2, 3, s * 0.14);
      c.fillRect(-h - s * 0.12, p - 1.5, s * 0.14, 3); c.fillRect(h - 2, p - 1.5, s * 0.14, 3);
    }
    c.fillStyle = C.dark; rr(c, -h, -h, s, s, s * 0.1);
    c.fillStyle = color || C.glow; rr(c, -h * 0.5, -h * 0.5, h, h, s * 0.06);
    c.fillStyle = 'rgba(255,255,255,0.35)'; circle(c, -h * 0.72, -h * 0.72, s * 0.05);
    c.restore();
  }
  /** Cartoon bomb centred on x,y with body radius r. t animates the fuse spark. */
  function bomb(c, x, y, r, t) {
    const k = r / 15;
    c.save(); c.translate(x, y); c.scale(k, k);
    c.fillStyle = '#26292d'; circle(c, 0, 2, 15);
    c.fillStyle = C.hazard; c.fillRect(-15, -1, 30, 5);
    c.fillStyle = '#3d4247'; rr(c, -5, -17, 10, 6, 2);
    c.strokeStyle = '#a58a5a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -17); c.quadraticCurveTo(6, -24, 3, -27); c.stroke();
    c.fillStyle = Math.sin((t || 0) * 40) > 0 ? '#fff3a0' : '#ff9d2e'; circle(c, 3, -28, 3.5);
    c.restore();
  }
  /** Yellow/black hazard stripes filling a rectangle. o: {stripe, a, b} */
  function hazard(c, x, y, w, h, o) {
    o = o || {};
    const s = o.stripe || 14;
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = o.b || '#1a1a1a'; c.fillRect(x, y, w, h);
    c.fillStyle = o.a || C.safety;
    for (let i = -h; i < w + h; i += s * 2) {
      c.beginPath();
      c.moveTo(x + i, y + h); c.lineTo(x + i + s, y + h); c.lineTo(x + i + s + h, y); c.lineTo(x + i + h, y);
      c.closePath(); c.fill();
    }
    c.restore();
  }
  /** Factory wall with panel seams and rivets. o.floor = y of a hazard-striped floor (optional). */
  function bgFactory(c, w, h, o) {
    o = o || {};
    const floor = o.floor == null ? null : o.floor;
    const bottom = floor == null ? h : floor;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 2;
    for (let x = 0; x < w; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, bottom); c.stroke(); }
    for (let y = 60; y < bottom; y += 120) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < w; x += 80) {
      for (let y = 60; y < bottom; y += 120) {
        for (const [dx, dy] of [[6, 6], [74, 6], [6, 114], [74, 114]]) {
          if (y + dy < bottom) circle(c, x + dx, y + dy, 2);
        }
      }
    }
    if (floor != null) {
      c.fillStyle = '#0d171e'; c.fillRect(0, floor, w, h - floor);
      c.fillStyle = '#2b4353'; c.fillRect(0, floor, w, 4);
      if (h - floor > 26) {
        hazard(c, 0, floor + 12, w, Math.min(14, h - floor - 16), { stripe: 14 });
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, floor + 12, w, Math.min(14, h - floor - 16));
      }
    }
  }
  /** Soft dark vignette over the whole screen; call last each frame for an arcade-screen look. */
  function vignette(c, w, h, strength) {
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (strength == null ? 0.45 : strength) + ')');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  /** Pre-render a static layer once: layer(w, h, (ctx, w, h) => {...}). Blit with ctx.drawImage(layer, 0, 0, w, h). */
  function layer(w, h, draw, k) {
    k = k || 2;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
    const c = cv.getContext('2d'); c.scale(k, k);
    draw(c, w, h);
    return cv;
  }

  // ---------- the robot ----------
  const BOT = {
    body: '#5ad1e6', eye: '#bff6ff', head: 'box', antenna: 'ball', base: 'wheels',
    mood: 'happy', arms: 'down', look: 0, lookY: 0, t: 0, walk: false, flip: false, shadow: false
  };
  const LEDS = ['#ff5a5a', '#f5c518', '#7cf08a'];

  function botBase(c, o, t, body) {
    const spin = o.walk ? t * 10 : 0;
    if (o.base === 'treads') {
      c.fillStyle = C.dark; rr(c, -31, 32, 62, 18, 9);
      c.fillStyle = C.steelDark; rr(c, -27, 35, 54, 12, 6);
      c.fillStyle = C.steel; for (const wx of [-18, 0, 18]) circle(c, wx, 41, 4.5);
      c.fillStyle = C.dark; for (const wx of [-18, 0, 18]) circle(c, wx, 41, 1.6);
      c.fillStyle = 'rgba(255,255,255,0.16)';
      const off = o.walk ? (t * 40) % 8 : 0;
      for (let lx = -27 + off; lx < 26; lx += 8) { c.fillRect(lx, 32.6, 3, 2); c.fillRect(lx, 47.4, 3, 2); }
    } else if (o.base === 'legs') {
      const step = o.walk ? Math.sin(t * 12) * 3 : 0;
      c.fillStyle = C.steel; rr(c, -18, 28, 10, 17 + step, 3); rr(c, 8, 28, 10, 17 - step, 3);
      c.fillStyle = C.dark; circle(c, -13, 37, 2.2); circle(c, 13, 37, 2.2);
      c.fillStyle = body; rr(c, -23, 44 + Math.min(0, step), 17, 6, 3); rr(c, 6, 44 + Math.min(0, -step), 17, 6, 3);
    } else if (o.base === 'hover') {
      const f = Math.sin(t * 30) * 0.5 + 0.5;
      c.fillStyle = alpha(C.glow, 0.22 + f * 0.15);
      c.beginPath(); c.ellipse(0, 45, 20 + f * 3, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = alpha(C.eye, 0.75);
      c.beginPath(); c.ellipse(0, 40.5, 9, 3 + f, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = C.steelDark; rr(c, -15, 29, 30, 9, 4);
      c.fillStyle = C.steel; rr(c, -9, 35, 18, 4, 2);
    } else {
      c.fillStyle = C.steelDark; rr(c, -24, 30, 48, 7, 3);
      for (const wx of [-17, 17]) {
        c.fillStyle = C.dark; circle(c, wx, 41, 9);
        c.fillStyle = C.steel; circle(c, wx, 41, 4);
        c.strokeStyle = C.steel; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(wx + Math.cos(spin) * 5.5, 41 + Math.sin(spin) * 5.5);
        c.lineTo(wx + Math.cos(spin) * 8, 41 + Math.sin(spin) * 8);
        c.stroke();
      }
    }
  }

  function botArms(c, o, t, body, caps) {
    if (o.arms === 'none') return;
    const aL = o.arms === 'up' ? 2.75 : 0.15;
    const aR = o.arms === 'up' ? -2.75 : o.arms === 'wave' ? -2.45 - Math.sin(t * 10) * 0.45 : -0.15;
    for (const [sx, a] of [[-31, aL], [31, aR]]) {
      if (caps) {
        c.fillStyle = body; circle(c, sx, 0, 6.5);
        c.fillStyle = 'rgba(255,255,255,0.3)'; circle(c, sx - 1.5, -1.5, 2);
        continue;
      }
      c.save(); c.translate(sx, 0); c.rotate(a);
      c.fillStyle = C.steel; rr(c, -3.5, 0, 7, 21, 3);
      c.strokeStyle = C.steel; c.lineWidth = 3.2;
      c.beginPath(); c.moveTo(-2, 20); c.lineTo(-5.5, 26); c.moveTo(2, 20); c.lineTo(5.5, 26); c.stroke();
      c.restore();
    }
  }

  function botEyes(c, o, cx, cy, gap, r, blink, square) {
    const lx = clamp(o.look || 0, -1, 1) * 3, ly = clamp(o.lookY || 0, -1, 1) * 2;
    for (const side of [-1, 1]) {
      const ex = cx + side * gap + lx, ey = cy + ly;
      if (blink || o.mood === 'sleep') {
        c.fillStyle = o.eye; c.fillRect(ex - r, ey - 0.9, r * 2, 1.8);
        continue;
      }
      const er = o.mood === 'wow' ? r * 1.3 : r;
      c.fillStyle = alpha(o.eye, 0.22); circle(c, ex, ey, er + 2.5);
      c.fillStyle = o.eye;
      if (square) rr(c, ex - er, ey - er, er * 2, er * 2, 1.2); else circle(c, ex, ey, er);
      if (o.mood === 'angry' || o.mood === 'sad') {
        const inner = -side, d = er + 2.6, angry = o.mood === 'angry';
        c.fillStyle = C.dark;
        c.beginPath();
        c.moveTo(ex - inner * d, ey - d);
        c.lineTo(ex + inner * d, ey - d);
        c.lineTo(ex + inner * d, ey + (angry ? 0.2 : -0.95) * er);
        c.lineTo(ex - inner * d, ey + (angry ? -0.95 : 0.2) * er);
        c.closePath(); c.fill();
      }
    }
  }

  function botMouth(c, o, x, y, col, small) {
    const k = small ? 0.7 : 1;
    c.strokeStyle = col; c.lineWidth = 2.4 * k; c.lineCap = 'round';
    c.beginPath();
    switch (o.mood) {
      case 'happy': c.arc(x, y - 3.5 * k, 5 * k, 0.2 * Math.PI, 0.8 * Math.PI); break;
      case 'sad': c.arc(x, y + 4 * k, 5 * k, 1.2 * Math.PI, 1.8 * Math.PI); break;
      case 'wow': c.arc(x, y, 2.6 * k, 0, Math.PI * 2); break;
      case 'angry':
        c.moveTo(x - 5 * k, y + 1); c.lineTo(x - 1.7 * k, y - 1); c.lineTo(x + 1.7 * k, y + 1); c.lineTo(x + 5 * k, y - 1);
        break;
      default: c.moveTo(x - 4.5 * k, y); c.lineTo(x + 4.5 * k, y);
    }
    c.stroke();
  }

  function botHead(c, o, t, body) {
    const blink = (t % 3.4) < 0.12;
    if (o.head === 'dome') {
      c.fillStyle = body;
      c.beginPath();
      c.arc(0, -20, 23, Math.PI, 0);
      c.lineTo(23, -12); c.quadraticCurveTo(23, -9, 20, -9);
      c.lineTo(-20, -9); c.quadraticCurveTo(-23, -9, -23, -12);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.beginPath(); c.ellipse(-9, -34, 6, 3, -0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = C.dark; rr(c, -18, -31, 36, 13, 6.5);
      botEyes(c, o, 0, -24.5, 7, 3.6, blink, false);
      botMouth(c, o, 0, -13.5, C.dark, true);
      return -43;
    }
    if (o.head === 'tv') {
      c.fillStyle = body; rr(c, -25, -42, 50, 32, 5);
      c.fillStyle = C.dark; rr(c, -21, -38, 35, 24, 4);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = -36; y < -15; y += 3) c.fillRect(-20, y, 33, 1);
      c.fillStyle = shade(body, -0.35); circle(c, 19.5, -32, 2.4); circle(c, 19.5, -24, 2.4);
      c.fillStyle = shade(body, -0.35); rr(c, 17, -19, 5, 5, 1);
      botEyes(c, o, -3.5, -29, 7, 3.4, blink, true);
      botMouth(c, o, -3.5, -20.5, o.eye, true);
      return -42;
    }
    c.fillStyle = body; rr(c, -22, -42, 44, 32, 8);
    c.fillStyle = 'rgba(255,255,255,0.2)'; rr(c, -17, -40, 34, 3.5, 2);
    c.fillStyle = C.dark; rr(c, -16, -35, 32, 15, 5);
    botEyes(c, o, 0, -27.5, 7, 3.8, blink, false);
    botMouth(c, o, 0, -14.5, C.dark, false);
    return -42;
  }

  function botAntenna(c, o, t, top) {
    const on = Math.sin(t * 8) > 0;
    c.strokeStyle = C.steel; c.lineWidth = 2.6; c.lineCap = 'round';
    if (o.antenna === 'none') return;
    if (o.antenna === 'bolt') {
      c.beginPath(); c.moveTo(0, top); c.lineTo(0, top - 3); c.stroke();
      c.fillStyle = C.safety;
      c.beginPath();
      c.moveTo(3, top - 18); c.lineTo(-5, top - 8); c.lineTo(-0.5, top - 8);
      c.lineTo(-3, top - 1); c.lineTo(5, top - 11); c.lineTo(0.5, top - 11);
      c.closePath(); c.fill();
      return;
    }
    if (o.antenna === 'twin') {
      for (const sx of [-1, 1]) {
        c.beginPath(); c.moveTo(sx * 9, top + 1); c.lineTo(sx * 15, top - 10); c.stroke();
        c.fillStyle = (on === (sx > 0)) ? '#ff4d4d' : '#ffb3b3'; circle(c, sx * 15.5, top - 12.5, 3.6);
      }
      return;
    }
    if (o.antenna === 'dish') {
      c.beginPath(); c.moveTo(7, top); c.lineTo(10, top - 7); c.stroke();
      c.save(); c.translate(11, top - 10); c.rotate(-0.55);
      c.fillStyle = C.steel; c.beginPath(); c.ellipse(0, 0, 9, 4.8, 0, 0, Math.PI); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(0, 0.5, 6, 2.4, 0, 0, Math.PI); c.closePath(); c.fill();
      c.strokeStyle = C.steel; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 1); c.lineTo(0, -7); c.stroke();
      c.fillStyle = on ? '#ff4d4d' : '#ffb3b3'; circle(c, 0, -8, 2.2);
      c.restore();
      return;
    }
    c.beginPath(); c.moveTo(0, top); c.lineTo(0, top - 9); c.stroke();
    c.fillStyle = on ? '#ff4d4d' : '#ffb3b3'; circle(c, 0, top - 12, 4.5);
    c.fillStyle = 'rgba(255,255,255,0.5)'; circle(c, -1.3, top - 13.5, 1.3);
  }

  /**
   * drawBot(ctx, cx, cy, h, opts): a robot centred on (cx, cy), about h tall and 0.7h wide.
   * opts: body (colour), eye (colour), head 'box'|'dome'|'tv', antenna 'ball'|'bolt'|'twin'|'dish'|'none',
   *       base 'wheels'|'treads'|'legs'|'hover', mood 'happy'|'neutral'|'sad'|'angry'|'wow'|'sleep',
   *       arms 'down'|'up'|'wave'|'none', look -1..1, lookY -1..1, t (seconds, animates blink/lights),
   *       walk (animate wheels/legs), flip (mirror), shadow (ground shadow).
   * Pass api.player straight in to draw the player's own bot: drawBot(ctx, x, y, 80, {...api.player, t}).
   */
  function drawBot(c, x, y, h, opts) {
    const o = Object.assign({}, BOT, opts);
    const s = h / 110, t = o.t || 0, body = o.body;
    c.save();
    c.translate(x, y);
    c.scale(o.flip ? -s : s, s);
    c.translate(0, 4.5);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (o.shadow) {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(0, 50.5, 30, 4.5, 0, 0, Math.PI * 2); c.fill();
    }
    botBase(c, o, t, body);
    const bob = o.base === 'hover' ? Math.sin(t * 4) * 2 - 2 : (o.walk && o.base === 'legs' ? -Math.abs(Math.sin(t * 12)) * 1.5 : 0);
    c.translate(0, bob);
    botArms(c, o, t, body, false);
    c.fillStyle = body; rr(c, -28, -6, 56, 38, 9);
    c.fillStyle = 'rgba(0,0,0,0.2)'; rr(c, -28, 21, 56, 11, [0, 0, 9, 9]);
    c.fillStyle = 'rgba(255,255,255,0.2)'; rr(c, -23, -3, 46, 3.5, 2);
    c.fillStyle = C.dark; rr(c, -17, 2, 34, 14, 4);
    for (let i = 0; i < 3; i++) {
      const lit = o.mood !== 'sleep' && (Math.floor(t * 2.5) + i) % 4 !== 0;
      c.fillStyle = lit ? LEDS[i] : '#33434e'; circle(c, -9 + i * 9, 9, 3);
    }
    c.fillStyle = 'rgba(255,255,255,0.35)'; circle(c, -23.5, 27, 1.6); circle(c, 23.5, 27, 1.6);
    botArms(c, o, t, body, true);
    c.fillStyle = C.steel; c.fillRect(-6, -11, 12, 6);
    const top = botHead(c, o, t, body);
    botAntenna(c, o, t, top);
    c.restore();
  }

  /** A small canvas element with a bot drawn on it, for DOM games. Redraw with el.redraw(opts). */
  function botCanvas(px, opts) {
    const k = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(px * k);
    cv.style.width = cv.style.height = px + 'px';
    cv.className = 'bot-canvas';
    const c = cv.getContext('2d');
    c.scale(k, k);
    cv.redraw = o => { c.clearRect(0, 0, px, px); drawBot(c, px / 2, px / 2, px * 0.92, o); };
    cv.redraw(opts);
    return cv;
  }

  // ---------- effects ----------
  /** Particle system: const fx = kit.particles(); fx.burst(x, y, colour); fx.float('+10', x, y); fx.update(dt); fx.draw(ctx). */
  function particles() {
    const list = [];
    return {
      list,
      burst(x, y, color, n, power, o) {
        o = o || {};
        n = n == null ? 12 : n; power = power == null ? 200 : power;
        for (let i = 0; i < n && list.length < 700; i++) {
          const a = Math.random() * Math.PI * 2, sp = power * (0.3 + Math.random() * 0.7);
          list.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift == null ? 80 : o.lift),
            life: (o.life || 0.7) * (0.7 + Math.random() * 0.6),
            color: Array.isArray(color) ? pick(color) : color,
            size: (o.size || 3) * (0.6 + Math.random() * 0.8),
            g: o.gravity == null ? 700 : o.gravity
          });
        }
      },
      float(str, x, y, color, o) {
        o = o || {};
        list.push({ text: String(str), x, y, vx: 0, vy: -(o.speed || 70), life: o.life || 0.9, color: color || C.safety, size: o.size || 16, g: 0 });
      },
      update(dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt;
          if (p.life <= 0) list.splice(i, 1);
        }
      },
      draw(c) {
        for (const p of list) {
          c.globalAlpha = clamp(p.life * 1.6, 0, 1);
          if (p.text) {
            c.font = font(p.size, 'body'); c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(p.text, p.x + 1.5, p.y + 1.5);
            c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
          } else {
            c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          }
        }
        c.globalAlpha = 1;
      },
      clear() { list.length = 0; }
    };
  }
  /** Screen shake: const sh = kit.shaker(); sh.add(0.4); sh.update(dt); then inside save/restore: sh.apply(ctx). */
  function shaker() {
    let s = 0;
    return {
      add(v) { s = Math.max(s, v); },
      update(dt) { s = Math.max(0, s - dt); },
      apply(c, mag) {
        if (s <= 0) return;
        const m = (mag || 14) * s;
        c.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
      },
      get value() { return s; }
    };
  }
  /** setPointerCapture that never throws (synthetic events have no live pointer). */
  function capture(el, e) { try { el.setPointerCapture(e.pointerId); } catch (_) { /* no live pointer */ } }

  // Shared friendly bee art.
  function drawBee(c, x, y, size, t) {
    c.save(); c.translate(x, y); c.scale(size / 32, size / 32);
    c.fillStyle = 'rgba(218,250,255,.8)';
    const flap = .55 + Math.abs(Math.sin((t || 0) * 25)) * .45;
    for (const [x, a] of [[-4, -.5], [6, .5]]) { c.beginPath(); c.ellipse(x, -10, 7, 11 * flap, a, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#ffc943'; c.beginPath(); c.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#302f38'; c.fillRect(-9, -12, 4, 24); c.fillRect(-1, -12, 4, 24); c.restore();
    c.fillStyle = '#302f38'; circle(c, 9, -2, 2.3);
    c.strokeStyle = '#302f38'; c.lineWidth = 1.5; c.beginPath(); c.arc(10, 2, 3, 0, 1.5); c.stroke(); c.restore();
  }
  function drawFlower(c, x, y, size, color) {
    c.save(); c.translate(x, y); c.scale(size / 24, size / 24);
    c.strokeStyle = '#287c53'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 15); c.stroke();
    c.fillStyle = color || '#fff4d0';
    for (let i = 0; i < 6; i++) circle(c, Math.cos(i * Math.PI / 3) * 7, Math.sin(i * Math.PI / 3) * 7, 5);
    c.fillStyle = '#ffb52e'; circle(c, 0, 0, 5); c.restore();
  }
  function drawHive(c, x, y, size) {
    c.save(); c.translate(x, y); c.scale(size / 48, size / 48);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#e4a52a' : '#ffcc55'; rr(c, -20 + i * 3, 10 - i * 8, 40 - i * 6, 13, 7); }
    c.fillStyle = '#674221'; circle(c, 0, 13, 6); c.restore();
  }

  window.BotKit = {
    C, PLATING, DISPLAY, BODY, font,
    rand, randi, pick, clamp, lerp, dist, shuffle, overlap,
    shade, alpha,
    rrPath, rr, circle, ring, text,
    gear, nut, bolt, battery, chip, bomb, hazard, bgFactory, vignette, layer,
    drawBot, drawBee, drawFlower, drawHive, botCanvas, particles, shaker, capture
  };
})();
