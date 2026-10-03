/* Whack-a-Bot: malfunctioning bots pop out of nine floor hatches during a 60 second shift.
 * Bonk the angry ones, spare the friendly ones, and grab the rare golden bot. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 640, H = 640, SHIFT = 60;
  const GX = 20, GY = 70, CW = 200, CH = 188;       // grid origin and cell size
  const RX = 68, RY = 23;                           // hatch opening radii
  const BOT_H = 104;
  const OPEN_T = 0.08, RISE_T = 0.12, HIT_T = 0.42, SINK_T = 0.13, CLOSE_T = 0.09;
  const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
  const LETTERS = ['Q', 'W', 'E', 'A', 'S', 'D', 'Z', 'X', 'C'];
  const CODE = {};
  DIGITS.forEach((d, i) => { CODE['Digit' + d] = i; CODE['Numpad' + d] = i; });
  LETTERS.forEach((l, i) => { CODE['Key' + l] = i; });
  const KINDS = {
    bad: { colors: ['#ff6b3d', '#ff5a5a', '#ff8a5c'], eye: '#ffe066' },
    good: { colors: ['#5ad1e6', '#7cf08a', '#9fdc6b'], eye: '#bff6ff' },
    gold: { colors: ['#ffd84a'], eye: '#fffbe0' }
  };
  const HEADS = ['box', 'dome', 'tv'], ANTENNAS = ['ball', 'twin', 'bolt', 'dish'];
  const SPARK = ['#fff3a0', '#ffd36b', '#ff9d2e'];

  const cellOf = i => {
    const top = GY + Math.floor(i / 3) * CH;
    return { cx: GX + (i % 3) * CW + CW / 2, top, hy: top + CH - 46 };
  };
  const easeBack = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const multFor = streak => Math.min(5, 1 + Math.floor(streak / 5));

  // ---------- drawing helpers (shared with the card art) ----------
  function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }

  function hatchBase(c, cx, hy, rx, ry) {
    c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, cx, hy + 4, rx + 18, ry + 12);
    c.save();
    c.beginPath(); c.ellipse(cx, hy, rx + 16, ry + 11, 0, 0, Math.PI * 2); c.clip();
    K.hazard(c, cx - rx - 18, hy - ry - 12, (rx + 18) * 2, (ry + 12) * 2, { stripe: 9 });
    c.restore();
    c.fillStyle = '#2b4353'; ellipse(c, cx, hy, rx + 7, ry + 5);
    c.fillStyle = '#4a6474'; c.beginPath(); c.ellipse(cx, hy, rx + 7, ry + 5, 0, Math.PI, Math.PI * 2); c.ellipse(cx, hy + 2, rx + 3, ry + 2, 0, Math.PI * 2, Math.PI, true); c.fill();
    const g = c.createLinearGradient(0, hy - ry, 0, hy + ry);
    g.addColorStop(0, '#020507'); g.addColorStop(1, '#16242e');
    c.fillStyle = g; ellipse(c, cx, hy, rx, ry);
  }

  /** Sliding hatch doors, open 0..1. */
  function hatchDoors(c, cx, hy, rx, ry, open) {
    if (open >= 1) return;
    c.save();
    c.beginPath(); c.ellipse(cx, hy, rx, ry, 0, 0, Math.PI * 2); c.clip();
    const gap = open * rx;
    for (const sd of [-1, 1]) {
      const inner = cx + sd * gap, outer = cx + sd * (gap + rx + 4);
      const x0 = Math.min(inner, outer), w = Math.abs(outer - inner);
      c.fillStyle = '#435d6d'; c.fillRect(x0, hy - ry, w, ry * 2);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      for (let k = 1; k < 4; k++) c.fillRect(x0, hy - ry + k * ry * 0.5, w, 1.5);
      c.fillStyle = C.safety; c.fillRect(sd < 0 ? inner - 4 : inner, hy - ry, 4, ry * 2);
    }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(cx - gap - 1, hy - ry, 2 + gap * 2, ry * 2);
    c.restore();
  }

  /** The lift a bot rides up on: a piston column under a round steel deck at y. */
  function drawLift(c, x, y, hy) {
    c.fillStyle = '#26404f'; c.fillRect(x - 9, y, 18, hy + 40 - y);
    c.fillStyle = '#4a6474'; c.fillRect(x - 5, y, 4, hy + 40 - y);
    c.fillStyle = '#2b4353'; ellipse(c, x, y + 3, 46, 10);
    c.fillStyle = C.steel; ellipse(c, x, y, 46, 9);
    c.fillStyle = '#a9b6bf'; ellipse(c, x, y - 1.5, 38, 5.5);
  }

  /** Mallet with a hazard-striped head. Grip at (px, py), head centre 93*s along angle ang. */
  function drawMallet(c, px, py, ang, s) {
    c.save(); c.translate(px, py); c.rotate(ang); c.scale(s, s);
    c.fillStyle = '#8b9aa6'; K.rr(c, -10, -4.5, 94, 9, 4);
    c.fillStyle = '#1b2a35'; K.rr(c, -14, -6.5, 34, 13, 6);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 4; i++) c.fillRect(-9 + i * 8, -6.5, 2, 13);
    c.fillStyle = '#39505e'; K.rr(c, 76, -30, 34, 60, 8);
    c.save(); K.rrPath(c, 78, -15, 30, 30, 3); c.clip(); K.hazard(c, 78, -15, 30, 30, { stripe: 7 }); c.restore();
    c.fillStyle = C.steel; K.rr(c, 73, -35, 40, 12, 5); K.rr(c, 73, 23, 40, 12, 5);
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(77, -33, 32, 3); c.fillRect(77, 25, 32, 3);
    c.restore();
  }

  /** Comic starburst with a word in it. */
  function drawBurst(c, x, y, r, text, fill, ink) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2, d = k % 2 ? r * 0.64 : r; c.lineTo(Math.cos(a) * d + 3, Math.sin(a) * d * 0.78 + 4); }
    c.closePath(); c.fill();
    c.fillStyle = fill;
    c.beginPath();
    for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2, d = k % 2 ? r * 0.64 : r; c.lineTo(Math.cos(a) * d, Math.sin(a) * d * 0.78); }
    c.closePath(); c.fill();
    K.text(c, text, 0, 1, { size: Math.round(r * 0.4), color: ink, shadow: false });
    c.restore();
  }

  function star4(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r); c.lineTo(x + r * 0.28, y - r * 0.28); c.lineTo(x + r, y); c.lineTo(x + r * 0.28, y + r * 0.28);
    c.lineTo(x, y + r); c.lineTo(x - r * 0.28, y + r * 0.28); c.lineTo(x - r, y); c.lineTo(x - r * 0.28, y - r * 0.28);
    c.closePath(); c.fill();
  }

  function bolt(c, x0, y0, x1, y1, seed) {
    c.beginPath(); c.moveTo(x0, y0);
    for (let k = 1; k < 4; k++) {
      const q = k / 4, j = ((seed * 7 + k * 13) % 10 - 5) * 1.3;
      c.lineTo(x0 + (x1 - x0) * q + j, y0 + (y1 - y0) * q - j * 0.5);
    }
    c.lineTo(x1, y1); c.stroke();
  }

  function drawFloor(c, keys) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#132330'); g.addColorStop(1, '#1a2d3a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // tread-plate pattern
    c.fillStyle = 'rgba(255,255,255,0.028)';
    for (let y = 70; y < H; y += 18) {
      for (let x = (y / 18) % 2 ? 0 : 9; x < W; x += 18) {
        c.save(); c.translate(x, y); c.rotate(0.6); c.fillRect(-5, -1.3, 10, 2.6); c.restore();
      }
    }
    // top strip
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, 58);
    c.fillStyle = '#2b4353'; c.fillRect(0, 58, W, 3);
    K.text(c, 'SHIFT', 88, 13, { size: 11, body: true, color: C.muted, align: 'left', shadow: false });
    c.fillStyle = '#060b0f'; K.rr(c, 86, 22, 294, 24, 7);
    K.text(c, 'COMBO', 412, 13, { size: 11, body: true, color: C.muted, align: 'left', shadow: false });
    for (let k = 0; k < 5; k++) { c.fillStyle = '#1b2a35'; K.rr(c, 474 + k * 30, 26, 24, 16, 4); }
    // cells and hatches
    for (let i = 0; i < 9; i++) {
      const { cx, top, hy } = cellOf(i);
      const x = cx - CW / 2 + 6, y = top + 6, w = CW - 12, h = CH - 10;
      c.fillStyle = 'rgba(0,0,0,0.25)'; K.rr(c, x, y + 3, w, h, 14);
      c.fillStyle = '#1b2d39'; K.rr(c, x, y, w, h, 14);
      c.strokeStyle = '#27404f'; c.lineWidth = 2; K.rrPath(c, x + 1, y + 1, w - 2, h - 2, 13); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.14)';
      for (const [bx, by] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) K.circle(c, bx, by, 2.2);
      hatchBase(c, cx, hy, RX, RY);
      if (keys) {
        c.fillStyle = '#0f1a23'; K.rr(c, x + 18, y + 12, 24, 24, 5);
        c.strokeStyle = '#2b4353'; c.lineWidth = 1.5; K.rrPath(c, x + 18.5, y + 12.5, 23, 23, 5); c.stroke();
        K.text(c, DIGITS[i], x + 30, y + 25, { size: 14, body: true, color: C.ink, shadow: false });
        K.text(c, LETTERS[i], x + 52, y + 25, { size: 12, body: true, color: '#4a6272', shadow: false });
      }
    }
  }

  Arcade.register({
    id: 'whack-a-bot',
    title: 'Whack-a-Bot',
    cat: 'action',
    blurb: 'Bonk the broken bots. Spare the friendly ones.',
    rules: [
      'Angry, sparking bots pop out of the hatches. Bonk them before they duck back down.',
      'Leave the happy blue and green bots alone. Bonking one costs points.',
      'Golden bots are rare and worth a big bonus.',
      'Good hits in a row build a combo. A miss or a friendly hit resets it.'
    ],
    how: 'Click or tap a hatch · keys 1 to 9 (number pad layout) or Q W E / A S D / Z X C',
    accent: '#ff5a5a',
    usesPlayer: false,

    thumb(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#132330'); g.addColorStop(1, '#1a2d3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0c151c'; ctx.fillRect(0, 0, w, 26);
      ctx.fillStyle = '#060b0f'; K.rr(ctx, 12, 8, 150, 11, 4);
      ctx.fillStyle = C.good; K.rr(ctx, 13, 9, 96, 9, 3);
      K.text(ctx, '×3', 196, 14, { size: 14, color: C.safety });
      for (let k = 0; k < 5; k++) { ctx.fillStyle = k < 2 ? C.safety : '#1b2a35'; K.rr(ctx, 216 + k * 18, 8, 14, 11, 3); }
      const hs = [[54, 152], [160, 152], [266, 152]];
      for (const [cx, hy] of hs) hatchBase(ctx, cx, hy, 38, 13);
      hatchDoors(ctx, 266, 152, 38, 13, 0);
      // friendly bot half up on the left, angry bot bonked in the middle
      const clip = (cx, hy, draw) => {
        ctx.save(); ctx.beginPath(); ctx.rect(cx - 60, 20, 120, hy - 20); ctx.ellipse(cx, hy, 38, 13, 0, 0, Math.PI * 2); ctx.clip(); draw(); ctx.restore();
      };
      clip(54, 152, () => K.drawBot(ctx, 54, 140, 72, { body: '#5ad1e6', eye: '#bff6ff', head: 'dome', antenna: 'ball', mood: 'happy', arms: 'wave', t: 0.4 }));
      clip(160, 152, () => {
        ctx.save(); ctx.translate(160, 155); ctx.scale(0.7, 0.7); drawLift(ctx, 0, 0, 20); ctx.restore();
        K.drawBot(ctx, 160, 118, 80, { body: '#ff6b3d', eye: '#ffe066', head: 'tv', antenna: 'twin', mood: 'angry', arms: 'up', t: 0.2 });
      });
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2;
      bolt(ctx, 124, 96, 136, 118, 3); bolt(ctx, 196, 92, 186, 114, 5);
      drawMallet(ctx, 222, 104, Math.atan2(78 - 104, 172 - 222), 0.62);
      drawBurst(ctx, 232, 62, 30, 'BONK!', C.safety, C.bg);
      ctx.fillStyle = '#fff3a0';
      star4(ctx, 110, 60, 5); star4(ctx, 204, 100, 4); star4(ctx, 132, 44, 3.5);
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const bg = K.layer(W, H, c => drawFloor(c, !api.isTouch), 2);
      const fx = K.particles(), shake = K.shaker();
      const hatches = [];
      for (let i = 0; i < 9; i++) hatches.push(Object.assign(cellOf(i), { i, phase: 'idle', pt: 0, bot: null, upTime: 1, cool: 0 }));
      let score = 0, streak = 0, bestStreak = 0, fixed = 0, golds = 0;
      let elapsed = 0, started = false, over = false, spawnT = 0.4, lastSec = SHIFT, t = 0, multShown = 1;
      const swings = [], bursts = [], rings = [], smoke = [];
      let redFlash = 0;

      const hud = () => { api.score(score); };
      api.stat('Time', SHIFT);
      hud();

      function setPhase(h, phase) { h.phase = phase; h.pt = 0; }
      /** Send a bot back down from wherever it is (used when the shift ends). */
      function retract(h) {
        if (h.phase === 'open') { const o = doorOpen(h); setPhase(h, 'close'); h.pt = CLOSE_T * (1 - o); }
        else if (h.phase === 'rise' || h.phase === 'up') { const r = Math.min(1, rise(h)); setPhase(h, 'sink'); h.pt = SINK_T * (1 - r); }
      }
      function rise(h) {
        switch (h.phase) {
          case 'rise': return easeBack(Math.min(1, h.pt / RISE_T));
          case 'up': case 'hit': return 1;
          case 'sink': return Math.max(0, 1 - h.pt / SINK_T);
          default: return 0;
        }
      }
      function doorOpen(h) {
        if (h.phase === 'idle') return 0;
        if (h.phase === 'open') return Math.min(1, h.pt / OPEN_T);
        if (h.phase === 'close') return Math.max(0, 1 - h.pt / CLOSE_T);
        return 1;
      }
      const hittable = h => !!h.bot && !h.bot.hit &&
        ((h.phase === 'rise' && h.pt > RISE_T * 0.3) || h.phase === 'up' || (h.phase === 'sink' && h.pt < SINK_T * 0.6));

      function stepHatch(h, dt) {
        h.pt += dt;
        if (h.cool > 0) h.cool -= dt;
        switch (h.phase) {
          case 'open': if (h.pt >= OPEN_T) setPhase(h, 'rise'); break;
          case 'rise': if (h.pt >= RISE_T) setPhase(h, 'up'); break;
          case 'up': if (h.pt >= h.upTime) setPhase(h, 'sink'); break;
          case 'hit': if (h.pt >= HIT_T) setPhase(h, 'sink'); break;
          case 'sink': if (h.pt >= SINK_T) setPhase(h, 'close'); break;
          case 'close': if (h.pt >= CLOSE_T) { h.bot = null; setPhase(h, 'idle'); h.cool = 0.25; } break;
        }
      }

      function spawn() {
        const p = K.clamp(elapsed / SHIFT, 0, 1);
        const active = hatches.reduce((n, h) => n + (h.phase !== 'idle' ? 1 : 0), 0);
        const maxUp = p < 0.2 ? 1 : p < 0.45 ? 2 : p < 0.75 ? 3 : 4;
        if (active >= maxUp) { spawnT = 0.1; return; }
        const free = hatches.filter(h => h.phase === 'idle' && h.cool <= 0);
        if (!free.length) { spawnT = 0.1; return; }
        spawnT = K.lerp(0.95, 0.42, p) * K.rand(0.75, 1.25);
        const h = K.pick(free);
        const r = Math.random();
        const pGold = elapsed > 6 ? 0.055 : 0, pGood = K.lerp(0.15, 0.3, p);
        const kind = r < pGold ? 'gold' : r < pGold + pGood ? 'good' : 'bad';
        const baseUp = K.lerp(1.55, 0.62, p);
        h.bot = {
          kind, hit: false, seed: Math.random() * 10,
          body: K.pick(KINDS[kind].colors), eye: KINDS[kind].eye,
          head: K.pick(HEADS), antenna: kind === 'gold' ? 'bolt' : K.pick(ANTENNAS)
        };
        h.upTime = kind === 'gold' ? baseUp * 0.72 : kind === 'good' ? baseUp * 1.2 : baseUp * K.rand(0.9, 1.1);
        setPhase(h, 'open');
        api.tone(kind === 'gold' ? 700 : 300, 0.05, 'square', 0.025, kind === 'gold' ? 600 : 250);
      }

      const sideOf = x => (x > W * 0.62 ? -1 : 1);   // which side the mallet swings in from
      function swing(x, y) {
        swings.push({ x, y, t: 0, dir: sideOf(x) });
        if (swings.length > 6) swings.shift();
      }
      function pop(text, fill, ink, x, bx, by) {
        bursts.push({ x: K.clamp(bx - sideOf(x) * 58, 56, W - 56), y: by - 52, t: 0, text, fill, ink });
      }

      function whack(i, x, y) {
        if (over) return;
        const h = hatches[i];
        swing(x, y);
        if (!started) return;
        if (hittable(h)) {
          const b = h.bot;
          b.hit = true;
          setPhase(h, 'hit');
          const bx = h.cx, by = h.hy - 60;
          if (b.kind === 'good') {
            if (streak >= 3) fx.float('Combo lost', bx, by - 50, C.muted, { size: 14 });
            streak = 0; multShown = 1;
            score = Math.max(0, score - 25);
            fx.float('-25', bx, by - 20, C.bad, { size: 22, life: 1.1 });
            pop('OOPS!', C.bad, '#ffffff', x, bx, by);
            fx.burst(bx, by, ['#5ad1e6', '#bff6ff'], 10, 160);
            shake.add(0.22); redFlash = 0.25;
            api.sfx('error');
          } else {
            streak++; fixed++;
            bestStreak = Math.max(bestStreak, streak);
            const mult = multFor(streak);
            const pts = (b.kind === 'gold' ? 50 : 10) * mult;
            score += pts;
            if (b.kind === 'gold') {
              golds++;
              fx.float('+' + pts + ' GOLD!', bx, by - 30, C.safety, { size: 24, life: 1.2 });
              fx.burst(bx, by, ['#ffd84a', '#fff3a0', '#ffffff'], 30, 320);
              pop('WOW!', '#ffd84a', C.bg, x, bx, by);
              api.sfx('coin'); api.tone(1500, 0.14, 'square', 0.035, 500, 0.08);
              shake.add(0.15);
            } else {
              fx.float('+' + pts, bx, by - 30, mult > 1 ? C.safety : C.ink, { size: 22 });
              fx.burst(bx, by, [b.body, '#fff3a0', '#8b9aa6'], 16, 260);
              pop('BONK!', C.safety, C.bg, x, bx, by);
              api.tone(210, 0.1, 'square', 0.06, -120); api.tone(1100, 0.05, 'square', 0.03, 300, 0.03);
              shake.add(0.1);
            }
            rings.push({ x: bx, y: by, t: 0, color: b.kind === 'gold' ? '#ffd84a' : C.safety });
            if (mult > multShown) { api.toast('COMBO ×' + mult); api.sfx('power'); }
            multShown = mult;
          }
        } else if (h.bot && h.bot.hit) {
          api.tone(420, 0.03, 'square', 0.02);
        } else {
          if (streak >= 3) fx.float('Combo lost', x, y - 34, C.muted, { size: 14 });
          streak = 0; multShown = 1;
          fx.float('Miss', x, y - 12, '#8b9aa6', { size: 16, life: 0.6 });
          fx.burst(x, y, ['#8b9aa6', '#56666f'], 6, 130, { lift: 60, life: 0.35 });
          api.tone(900, 0.03, 'square', 0.022); api.tone(140, 0.08, 'triangle', 0.05, -40);
        }
        hud();
      }

      function finish() {
        over = true;
        hatches.forEach(retract);
        const s = n => (n === 1 ? '' : 's');
        let detail;
        if (!fixed) detail = 'No bots fixed this shift. Bonk the angry red ones next time.';
        else {
          detail = 'You fixed ' + fixed + ' bot' + s(fixed);
          if (golds) detail += ', including ' + golds + ' golden one' + s(golds);
          detail += bestStreak >= 3 ? ', with a best streak of ' + bestStreak + '.' : '.';
        }
        api.toast('SHIFT OVER');
        api.win({ score, title: 'Shift complete', detail, delay: 1100 });
      }

      // ---------- input ----------
      api.on(cv.el, 'pointerdown', e => {
        const p = cv.toLocal(e);
        const col = Math.floor((p.x - GX) / CW), row = Math.floor((p.y - GY) / CH);
        if (col < 0 || col > 2 || row < 0 || row > 2) return;
        whack(row * 3 + col, p.x, p.y);
      });
      api.onKey((name, e) => {
        const i = CODE[e.code];
        if (i == null || e.repeat) return;
        const h = hatches[i];
        const up = !!h.bot && h.phase !== 'idle' && h.phase !== 'open';
        whack(i, h.cx + 4, up ? h.hy - 64 : h.hy);
      });

      // ---------- update ----------
      function update(dt) {
        for (const h of hatches) stepHatch(h, dt);
        if (!started || over) return;
        elapsed += dt;
        const left = Math.max(0, SHIFT - elapsed);
        const sec = Math.ceil(left);
        if (sec !== lastSec) {
          lastSec = sec;
          api.stat('Time', sec);
          if (sec === 10) api.toast('10 SECONDS!');
          if (sec <= 5 && sec > 0) api.sfx('tick');
        }
        if (left <= 0) { finish(); return; }
        spawnT -= dt;
        if (spawnT <= 0) spawn();
        // sparks and smoke from broken bots
        for (const h of hatches) {
          const b = h.bot;
          if (!b || b.hit || b.kind !== 'bad' || h.phase !== 'up') continue;
          if (Math.random() < dt * 9) fx.burst(h.cx + K.rand(-24, 24), h.hy - 92, SPARK, 2, 150, { lift: 110, life: 0.35, size: 2.6 });
          if (Math.random() < dt * 3) smoke.push({ x: h.cx + K.rand(-12, 12), y: h.hy - 100, r: K.rand(4, 7), vx: K.rand(-10, 10), vy: K.rand(-40, -25), life: 0.9 });
        }
      }

      // ---------- drawing ----------
      function drawTop() {
        const left = Math.max(0, SHIFT - elapsed), frac = left / SHIFT;
        const col = frac > 0.5 ? C.good : frac > 0.2 ? C.safety : C.bad;
        const blink = started && !over && left <= 10 && Math.sin(t * 12) > 0;
        K.text(ctx, String(Math.ceil(left)), 46, 33, { size: 28, color: blink ? '#ffffff' : col });
        if (frac > 0.01) {
          ctx.fillStyle = col; K.rr(ctx, 88, 24, 290 * frac, 20, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; K.rr(ctx, 92, 26, Math.max(0, 290 * frac - 8), 4, 2);
        }
        const mult = multFor(streak);
        K.text(ctx, '×' + mult, 414, 36, { size: 24, color: mult > 1 ? C.safety : C.muted, align: 'left' });
        const lit = mult >= 5 ? 5 : streak % 5;
        for (let k = 0; k < lit; k++) {
          ctx.fillStyle = mult >= 5 ? (Math.sin(t * 10 + k) > 0 ? C.safety : '#fff3a0') : C.safety;
          K.rr(ctx, 474 + k * 30, 26, 24, 16, 4);
        }
      }

      function drawBotAt(h) {
        const b = h.bot;
        const r = rise(h);
        if (!b || r <= 0.001) return;
        let x = h.cx, y = h.hy - 56 + (1 - r) * 134;
        if (b.kind === 'bad' && h.phase === 'up') x += Math.sin(t * 47 + b.seed) * 1.4;
        ctx.save();
        ctx.beginPath(); ctx.rect(h.cx - 100, h.top - 10, 200, h.hy - h.top + 10); ctx.ellipse(h.cx, h.hy, RX, RY, 0, 0, Math.PI * 2);
        ctx.clip();
        if (b.kind === 'gold') {
          const g = ctx.createRadialGradient(x, y - 10, 10, x, y - 10, 80);
          g.addColorStop(0, 'rgba(255,216,74,' + (0.4 + 0.15 * Math.sin(t * 8)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,216,74,0)');
          ctx.fillStyle = g; ctx.fillRect(x - 80, y - 90, 160, 160);
        }
        let mood = 'angry', arms = 'up';
        if (b.hit) { mood = b.kind === 'good' ? 'sad' : 'sleep'; arms = 'down'; }
        else if (b.kind === 'good') { mood = 'happy'; arms = 'wave'; }
        else if (b.kind === 'gold') { mood = 'wow'; arms = 'up'; }
        drawLift(ctx, h.cx, y + BOT_H * 0.49, h.hy);
        if (b.hit && h.phase === 'hit' && h.pt < 0.14) {
          const sq = 1 - (0.14 - h.pt) / 0.14 * 0.14;
          ctx.translate(x, y + 50); ctx.scale(2 - sq, sq); ctx.translate(-x, -(y + 50));
        }
        K.drawBot(ctx, x, y, BOT_H, { body: b.body, eye: b.eye, head: b.head, antenna: b.antenna, base: 'wheels', mood, arms, t: t + b.seed });
        ctx.restore();
        // extras that float above the hatch
        if (!b.hit && b.kind === 'bad' && h.phase === 'up' && Math.sin(t * 31 + b.seed * 3) > -0.2) {
          ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2.2;
          const seed = Math.floor(t * 20 + b.seed);
          bolt(ctx, x - 40, y - 44, x - 26, y - 20, seed);
          bolt(ctx, x + 40, y - 40, x + 27, y - 16, seed + 3);
        }
        if (b.kind === 'gold' && !b.hit) {
          ctx.fillStyle = '#fffbe0';
          for (let k = 0; k < 4; k++) {
            const a = t * 2.5 + k * Math.PI / 2;
            star4(ctx, x + Math.cos(a) * 54, y - 20 + Math.sin(a) * 30, 5 + 2 * Math.sin(t * 9 + k));
          }
        }
        if (b.hit && b.kind !== 'good' && h.phase === 'hit') {
          ctx.fillStyle = C.safety;
          for (let k = 0; k < 3; k++) {
            const a = t * 7 + k * Math.PI * 2 / 3;
            star4(ctx, x + Math.cos(a) * 26, y - 62 + Math.sin(a) * 8, 6);
          }
        }
      }

      function drawSwings(dt) {
        for (let k = swings.length - 1; k >= 0; k--) {
          const s = swings[k];
          s.t += dt;
          if (s.t > 0.3) { swings.splice(k, 1); continue; }
          const gx = s.x + s.dir * 70, gy = s.y + 62;
          const strike = Math.atan2(s.y - gy, s.x - gx);
          const raised = strike + s.dir * 1.25;
          let ang;
          if (s.t < 0.06) { const q = s.t / 0.06; ang = raised + (strike - raised) * q * q; }
          else ang = strike + s.dir * 0.1 * Math.max(0, Math.sin((s.t - 0.06) * 30)) * Math.max(0, 1 - (s.t - 0.06) * 6);
          ctx.globalAlpha = s.t > 0.2 ? Math.max(0, 1 - (s.t - 0.2) / 0.1) : 1;
          drawMallet(ctx, gx, gy, ang, 1);
          ctx.globalAlpha = 1;
        }
      }

      function render(dt) {
        ctx.save();
        shake.apply(ctx, 10);
        ctx.drawImage(bg, 0, 0, W, H);
        drawTop();
        for (const h of hatches) { hatchDoors(ctx, h.cx, h.hy, RX, RY, doorOpen(h)); drawBotAt(h); }
        for (let k = smoke.length - 1; k >= 0; k--) {
          const p = smoke[k];
          p.life -= dt;
          if (p.life <= 0) { smoke.splice(k, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          const a = p.life / 0.9;
          ctx.fillStyle = 'rgba(150,162,172,' + (0.4 * a).toFixed(3) + ')';
          K.circle(ctx, p.x, p.y, p.r * (1.8 - a * 0.8));
        }
        for (let k = rings.length - 1; k >= 0; k--) {
          const r = rings[k];
          r.t += dt;
          if (r.t > 0.3) { rings.splice(k, 1); continue; }
          K.ring(ctx, r.x, r.y, 14 + r.t * 180, 4 * (1 - r.t / 0.3), K.alpha(r.color, 1 - r.t / 0.3));
        }
        fx.draw(ctx);
        drawSwings(dt);
        for (let k = bursts.length - 1; k >= 0; k--) {
          const b = bursts[k];
          b.t += dt;
          if (b.t > 0.42) { bursts.splice(k, 1); continue; }
          const sc = b.t < 0.08 ? 0.55 + b.t / 0.08 * 0.55 : 1.1 - Math.min(0.1, (b.t - 0.08));
          ctx.globalAlpha = b.t > 0.3 ? Math.max(0, 1 - (b.t - 0.3) / 0.12) : 1;
          drawBurst(ctx, b.x, b.y - b.t * 30, 42 * sc, b.text, b.fill, b.ink);
          ctx.globalAlpha = 1;
        }
        if (redFlash > 0) { ctx.fillStyle = K.alpha(C.bad, redFlash * 0.5); ctx.fillRect(0, 0, W, H); }
        ctx.restore();
      }

      api.toast('READY?');
      api.after(1000, () => { if (over) return; started = true; api.toast('GO!'); api.sfx('power'); });

      api.loop(dt => {
        t += dt;
        redFlash = Math.max(0, redFlash - dt);
        update(dt);
        fx.update(dt); shake.update(dt);
        render(dt);
      });
    }
  });
})();
