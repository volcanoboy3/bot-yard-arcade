/* Bomb Squad: robot minesweeper. Open every safe tile without touching a bomb; numbers count the
 * bombs in the eight tiles around them. A defuser bot above the field reacts to every move.
 * Layout: a header canvas (mascot, counters, Dig/Flag toggle) over a board canvas. When the tiles
 * would be too small to tap (hard mode on a phone), the board keeps big tiles and scrolls instead. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const MODES = {
    easy: { cols: 9, rows: 9, bombs: 10, base: 1000, per: 5 },
    medium: { cols: 12, rows: 12, bombs: 24, base: 3000, per: 8 },
    hard: { cols: 16, rows: 16, bombs: 48, base: 8000, per: 12 }
  };
  const CELL = 40, BPAD = 8;              // board tile size and margin (logical px)
  const HW = 480, HH = 104;               // header canvas (logical px)
  const NUM = [null, '#5ad1e6', '#7cf08a', '#ff6b3d', '#c3a6ff', '#f5c518', '#ff6fa8', '#e6eef2', '#8b9aa6'];
  const COVERED = 0, FLAGGED = 1, OPEN = 2;
  const HOLD_MS = 400;
  const INK = '#15222c';
  const TOGGLE = { x: 14, y: 17, w: 136, h: 70 };
  const MASCOT = { x: 240, y: 55, h: 88 };

  const CSS = `
  .g-bomb { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; max-width: 100%; max-height: 100%; }
  .g-bomb .bs-head { flex: none; line-height: 0; }
  .g-bomb .bs-head canvas { border-radius: 12px; }
  .g-bomb .bs-wrap { position: relative; flex: none; max-width: 100%; overflow: hidden; border-radius: 12px; background: #0b141b;
    box-shadow: 0 0 0 2px #223845, 0 18px 44px rgba(0,0,0,.4); transition: box-shadow .15s; line-height: 0; }
  .g-bomb .bs-wrap.is-flag { box-shadow: 0 0 0 3px #ff6b3d, 0 18px 44px rgba(0,0,0,.4); }
  .g-bomb .bs-wrap.is-scroll { overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: #39505e #0b141b; }
  .g-bomb .bs-wrap canvas { border-radius: 0; box-shadow: none; }
  .g-bomb .bs-note { margin: 0; font: 700 12.5px/1.2 var(--body); letter-spacing: .03em; color: #8b9aa6; text-align: center; }
  `;

  // ---------- small drawings ----------
  let SPR = null;
  /** Pre-rendered tile sprites (shared by every session). */
  function sprites() {
    if (SPR) return SPR;
    const L = draw => K.layer(CELL, CELL, draw, 3);
    const plate = (top, bottom, hi) => L(c => {
      c.fillStyle = '#0b141b'; c.fillRect(0, 0, CELL, CELL);
      c.fillStyle = 'rgba(0,0,0,0.55)'; K.rr(c, 2, 3.5, CELL - 4, CELL - 4.5, 7);
      const g = c.createLinearGradient(0, 2, 0, CELL - 3);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      c.fillStyle = g; K.rr(c, 2, 2, CELL - 4, CELL - 5, 7);
      c.fillStyle = hi; K.rr(c, 7, 4.5, CELL - 14, 2.5, 1.2);
      c.fillStyle = 'rgba(0,0,0,0.28)'; K.circle(c, 8, CELL - 9, 1.5); K.circle(c, CELL - 8, CELL - 9, 1.5);
    });
    const open = fill => L(c => {
      c.fillStyle = '#0b141b'; c.fillRect(0, 0, CELL, CELL);
      c.fillStyle = fill; c.fillRect(1, 1, CELL - 2, CELL - 2);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(1, 1, CELL - 2, 3); c.fillRect(1, 1, 2, CELL - 2);
    });
    SPR = {
      plate: plate('#36596d', '#274252', 'rgba(255,255,255,0.2)'),
      hot: plate('#44718a', '#305062', 'rgba(255,255,255,0.3)'),
      pressed: open('#1f3441'),
      open: open('#132330'),
      red: open('#8a2622'),
      bombBg: open('#2a1c22')
    };
    return SPR;
  }

  function flagShape(c, s, t, seed, pole, cloth) {
    const wv = Math.sin(t * 5 + seed) * s * 0.03;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, s * 0.33, s * 0.24, s * 0.06, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = pole === INK ? INK : '#1b2a35'; K.rr(c, -s * 0.2, s * 0.24, s * 0.4, s * 0.1, 2);
    c.fillStyle = pole; c.fillRect(-s * 0.05, -s * 0.34, s * 0.07, s * 0.62);
    c.fillStyle = cloth;
    c.beginPath(); c.moveTo(s * 0.02, -s * 0.34); c.lineTo(s * 0.32, -s * 0.2 + wv); c.lineTo(s * 0.02, -s * 0.05); c.closePath(); c.fill();
  }
  function drawFlag(c, x, y, s, k, t, seed) {
    c.save(); c.translate(x, y);
    if (k < 1) c.scale(k, k);
    flagShape(c, s, t, seed, '#d7e2e8', C.hazard);
    c.fillStyle = C.safety; K.circle(c, s * 0.12, -s * 0.2, s * 0.035);
    K.drawBee(c,s*.2,-s*.2,s*.27,t);
    c.restore();
  }
  function shovel(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.rotate(-0.75);
    c.fillStyle = col;
    c.fillRect(-s * 0.06, -s * 0.46, s * 0.12, s * 0.52);
    K.rr(c, -s * 0.2, -s * 0.56, s * 0.4, s * 0.12, 2);
    c.beginPath();
    c.moveTo(-s * 0.21, s * 0.04); c.lineTo(s * 0.21, s * 0.04); c.lineTo(s * 0.21, s * 0.26);
    c.quadraticCurveTo(0, s * 0.56, -s * 0.21, s * 0.26); c.closePath(); c.fill();
    c.restore();
  }
  function clock(c, x, y, r, t) {
    c.fillStyle = C.glow; K.circle(c, x, y, r);
    c.fillStyle = '#0b141b'; K.circle(c, x, y, r * 0.72);
    c.strokeStyle = C.glow; c.lineWidth = Math.max(1.5, r * 0.18); c.lineCap = 'round';
    const a = t * 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); c.moveTo(x, y); c.lineTo(x, y - r * 0.42); c.stroke();
    c.fillStyle = C.glow; c.fillRect(x - r * 0.22, y - r * 1.35, r * 0.44, r * 0.3);
  }
  const fmtTime = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const easeBack = k => { const c1 = 2.2; return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  Arcade.register({
    id: 'bomb-squad',
    title: 'Bee Rescue Squad',
    cat: 'puzzle',
    blurb: 'Keep the hive safe: find the dangerous cells without setting one off.',
    rules: [
      'Open every safe tile. A number tells how many bombs touch that tile.',
      'Flag bombs with a right-click, by holding a tile, or in Flag mode.',
      'Tap a number whose flags are all placed to open the tiles around it.',
      'Your first dig is always safe. Faster clears score more.'
    ],
    how: 'Click or tap to dig · right-click or hold to flag · F: flag mode · arrows + Space',
    accent: '#ff6b3d',
    usesPlayer: false,
    modes: [
      { id: 'easy', label: 'Easy', note: '9×9 · 10 bombs' },
      { id: 'medium', label: 'Medium', note: '12×12 · 24 bombs' },
      { id: 'hard', label: 'Hard', note: '16×16 · 48 bombs' }
    ],

    thumb(ctx, w, h) {
      K.bgFactory(ctx, w, h);
      const S = sprites();
      const cols = 9, rows = 7, s = 24, ox = 94, oy = (h - rows * s) / 2;
      const n = cols * rows, bombs = [2, 6, 16, 17, 27, 35, 44, 48, 52, 55, 60];
      const isB = i => bombs.indexOf(i) >= 0;
      const around = i => {
        const x = i % cols, y = Math.floor(i / cols), out = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
        }
        return out;
      };
      const cnt = i => around(i).filter(isB).length;
      const open = new Array(n).fill(false), q = [31];
      open[31] = true;
      while (q.length) {
        const j = q.shift();
        if (cnt(j)) continue;
        for (const k of around(j)) if (!open[k] && !isB(k)) { open[k] = true; q.push(k); }
      }
      const edge = bombs.filter(b => around(b).some(k => open[k]));
      const found = edge[edge.length - 1], flags = edge.slice(0, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(ctx, ox - 6, oy - 3, cols * s + 12, rows * s + 12, 9);
      ctx.fillStyle = '#0b141b'; K.rr(ctx, ox - 6, oy - 6, cols * s + 12, rows * s + 12, 9);
      ctx.font = K.font(14); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const x = ox + (i % cols) * s, y = oy + Math.floor(i / cols) * s;
        if (i === found) {
          ctx.drawImage(S.red, x, y, s, s);
          K.bomb(ctx, x + s / 2, y + s / 2 + 1, s * 0.27, 0.1);
        } else if (open[i]) {
          ctx.drawImage(S.open, x, y, s, s);
          const c = cnt(i);
          if (c) { ctx.fillStyle = NUM[c]; ctx.fillText(String(c), x + s / 2, y + s / 2 + 1); }
        } else {
          ctx.drawImage(S.plate, x, y, s, s);
          if (flags.indexOf(i) >= 0) drawFlag(ctx, x + s / 2, y + s / 2 + 1, s, 1, 0.4, i);
        }
      }
      const fx0 = ox + (found % cols) * s + s / 2, fy0 = oy + Math.floor(found / cols) * s + s / 2;
      const spark = ['#ff6b3d', '#f5c518', '#fff3a0'];
      for (let k = 0; k < 10; k++) {
        const a = -2.6 + k * 0.52, d = s * 0.62 + (k % 3) * 4;
        ctx.fillStyle = spark[k % 3]; ctx.fillRect(fx0 + Math.cos(a) * d - 1.5, fy0 + Math.sin(a) * d - 1.5, 3, 3);
      }
      K.drawBot(ctx, 52, 106, 108, { body: '#ff8a5c', head: 'dome', antenna: 'dish', base: 'treads', mood: 'wow', arms: 'up', look: 1, lookY: 0.3, t: 0.4, shadow: true });
      K.vignette(ctx, w, h, 0.3);
    },

    start(api) {
      const M = MODES[api.mode] || MODES.easy;
      const cols = M.cols, rows = M.rows, total = cols * rows;
      const BW = cols * CELL + 2 * BPAD, BH = rows * CELL + 2 * BPAD;
      const S = sprites();
      api.css(CSS);
      const headBox = api.el('div', { class: 'bs-head' });
      const wrap = api.el('div', { class: 'bs-wrap' });
      const note = api.el('p', { class: 'bs-note', hidden: true },
        api.isTouch ? 'Swipe the field to see all of it · hold a tile to flag it' : 'Scroll the field to see all of it');
      const root = api.el('div', { class: 'g-bomb' }, headBox, wrap, note);
      api.stage.append(root);

      // ---------- layout: fit everything, or keep tiles tappable and scroll the field ----------
      function measure() {
        const cs = getComputedStyle(api.stage);
        const aw = Math.max(200, api.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
        const ah = Math.max(220, api.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
        const gap = 8, noteH = 20, touch = api.isTouch;
        let s = Math.min(aw / BW, (ah - gap) / (BH + BW * HH / HW), 60 / CELL);
        if (CELL * s >= (touch ? 27 : 17)) {
          const w = BW * s;
          return { s, scroll: false, bw: w, bh: BH * s, ww: w, wh: BH * s, hw: w };
        }
        // big tiles in a scrolling field; the header never takes more than 30% of the height
        const headFor = w => { let hw = Math.min(aw, w); if (hw * HH / HW > ah * 0.3) hw = Math.max(260, ah * 0.3 * HW / HH); return hw; };
        const zoom = (touch ? 34 : 24) / CELL;
        const fitH = (ah - headFor(BW * zoom) * HH / HW - gap - noteH - gap) / BH;
        s = CELL * fitH >= (touch ? 30 : 20) ? Math.min(zoom, fitH) : zoom;   // shrink a little to avoid scrolling both ways
        const bw = BW * s, bh = BH * s, hw = headFor(bw);
        const wh = Math.max(120, Math.min(bh, ah - hw * HH / HW - gap - noteH - gap));
        return { s, scroll: true, bw, bh, ww: Math.min(aw, bw), wh, hw };
      }
      let lay = measure();
      headBox.style.width = lay.hw + 'px';
      wrap.style.width = lay.ww + 'px';
      const head = api.canvas(HW, HH, { parent: headBox });
      const board = api.canvas(BW, BH, { parent: wrap });
      const hc = head.ctx, bc = board.ctx;
      let centred = false;
      function applyLayout() {
        lay = measure();
        headBox.style.width = lay.hw + 'px';
        head.el.style.width = lay.hw + 'px'; head.el.style.height = (lay.hw * HH / HW) + 'px';
        wrap.style.width = lay.ww + 'px'; wrap.style.height = lay.wh + 'px';
        board.el.style.width = lay.bw + 'px'; board.el.style.height = lay.bh + 'px';
        wrap.classList.toggle('is-scroll', lay.scroll);
        board.el.style.touchAction = lay.scroll ? 'pan-x pan-y' : 'none';
        note.hidden = !lay.scroll;
        if (lay.scroll && !centred) {
          centred = true;
          wrap.scrollLeft = (lay.bw - lay.ww) / 2;
          wrap.scrollTop = (lay.bh - lay.wh) / 2;
        }
      }
      applyLayout();
      api.on(window, 'resize', applyLayout);
      api.after(60, applyLayout);

      // ---------- state ----------
      const bomb = new Uint8Array(total), count = new Uint8Array(total), state = new Uint8Array(total);
      const revealAt = new Float32Array(total), flagAt = new Float32Array(total), lossAt = new Float32Array(total).fill(1e9);
      const safeTotal = total - M.bombs;
      const fx = K.particles(), shake = K.shaker();
      let placed = false, opened = 0, flags = 0, elapsed = 0, shownSecs = -1, running = false;
      let ended = false, won = false, lost = false, hitCell = -1, boomAt = -9, flash = 0;
      let flagMode = false, toggleK = 0, cursor = Math.floor(rows / 2) * cols + Math.floor(cols / 2), showCursor = false;
      let hover = -1, press = null, hintCell = -1, hintAt = -9, now = 0;
      let cheerUntil = 0, waveUntil = 0, wowUntil = 0, lossList = [], lossPtr = 0;
      const mascot = { body: '#ff8a5c', eye: C.eye, head: 'dome', antenna: 'dish', base: 'treads', mood: 'happy', arms: 'down', look: 0, lookY: 0.6, t: 0 };

      const colOf = i => i % cols, rowOf = i => (i - (i % cols)) / cols;
      const cellX = i => BPAD + colOf(i) * CELL, cellY = i => BPAD + rowOf(i) * CELL;
      const isNeighbor = (a, b) => a !== b && Math.abs(colOf(a) - colOf(b)) <= 1 && Math.abs(rowOf(a) - rowOf(b)) <= 1;
      function neighbors(i) {
        const x = colOf(i), y = rowOf(i), out = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
          }
        }
        return out;
      }
      function cellFromEvent(e) {
        const p = board.toLocal(e);
        const x = Math.floor((p.x - BPAD) / CELL), y = Math.floor((p.y - BPAD) / CELL);
        return x < 0 || y < 0 || x >= cols || y >= rows ? -1 : y * cols + x;
      }
      function updateStats() {
        api.stat('Bombs', M.bombs - flags);
        api.stat('Time', fmtTime(Math.max(0, shownSecs)));
      }

      // ---------- rules ----------
      function placeBombs(first) {
        const pool = [];
        for (let i = 0; i < total; i++) if (i !== first && !isNeighbor(i, first)) pool.push(i);
        K.shuffle(pool);
        for (let k = 0; k < M.bombs; k++) bomb[pool[k]] = 1;
        for (let i = 0; i < total; i++) { let n = 0; for (const j of neighbors(i)) n += bomb[j]; count[i] = n; }
        placed = true; running = true;
      }

      /** Opens a safe tile and floods through empty ones. Returns how many tiles opened. */
      function flood(i, delay) {
        if (state[i] !== COVERED || bomb[i]) return 0;
        const queue = [i], depth = [0];
        state[i] = OPEN; revealAt[i] = now + delay;
        for (let qi = 0; qi < queue.length; qi++) {
          const j = queue[qi], d = depth[qi];
          if (count[j]) continue;
          for (const k of neighbors(j)) {
            if (state[k] !== COVERED || bomb[k]) continue;
            state[k] = OPEN; revealAt[k] = now + delay + Math.min(0.55, (d + 1) * 0.03);
            queue.push(k); depth.push(d + 1);
          }
        }
        opened += queue.length;
        return queue.length;
      }

      function openSound(n) {
        if (n > 1) {
          api.tone(420, 0.16, 'square', 0.03, 520);
          for (let k = 1; k < Math.min(5, 1 + (n >> 3)); k++) api.tone(700 + k * 110, 0.03, 'square', 0.02, 0, k * 0.06);
        } else api.sfx('click');
        if (n >= 10) cheerUntil = now + 0.9;
      }

      function act(i, flagIt) {
        if (ended || api.over || i < 0) return;
        if (state[i] === OPEN) { chord(i); return; }
        if (flagIt || flagMode) { toggleFlag(i); return; }
        if (state[i] === FLAGGED) { hintCell = i; hintAt = now; api.tone(300, 0.05, 'triangle', 0.03); return; }
        if (!placed) placeBombs(i);
        if (bomb[i]) { explode(i); return; }
        openSound(flood(i, 0));
        checkWin();
      }

      function toggleFlag(i) {
        if (state[i] === OPEN || ended) return;
        if (state[i] === FLAGGED) { state[i] = COVERED; flags--; api.tone(460, 0.06, 'square', 0.03, -160); }
        else {
          state[i] = FLAGGED; flags++; flagAt[i] = now;
          api.tone(560, 0.07, 'square', 0.035, 300);
          fx.burst(cellX(i) + CELL / 2, cellY(i) + CELL / 2, [C.hazard, C.safety], 6, 90, { life: 0.35, size: 2.5, gravity: 200 });
        }
        updateStats();
      }

      function chord(i) {
        if (!count[i]) return;
        let f = 0;
        const shut = [];
        for (const j of neighbors(i)) { if (state[j] === FLAGGED) f++; else if (state[j] === COVERED) shut.push(j); }
        if (!shut.length) return;
        if (f !== count[i]) { hintCell = i; hintAt = now; api.tone(190, 0.08, 'triangle', 0.04); return; }
        const boom = shut.find(j => bomb[j]);
        if (boom != null) { explode(boom); return; }
        let n = 0;
        for (const j of shut) n += flood(j, 0);
        openSound(n);
        checkWin();
      }

      function explode(i) {
        ended = true; lost = true; running = false; press = null;
        hitCell = i; boomAt = now; state[i] = OPEN; revealAt[i] = now;
        const x = cellX(i) + CELL / 2, y = cellY(i) + CELL / 2;
        fx.burst(x, y, [C.hazard, C.safety, '#ff9d2e', '#fff3a0'], 46, 460, { life: 0.9, size: 5 });
        fx.burst(x, y, ['#3a3f44', '#26292d', '#6f8796'], 20, 160, { life: 1.4, size: 8, gravity: -60, lift: 40 });
        shake.add(0.6); flash = 0.45;
        api.sfx('boom');
        const d2 = j => { const dx = colOf(j) - colOf(i), dy = rowOf(j) - rowOf(i); return dx * dx + dy * dy; };
        lossList = [];
        for (let j = 0; j < total; j++) {
          if (j === i) continue;
          if ((bomb[j] && state[j] !== FLAGGED) || (!bomb[j] && state[j] === FLAGGED)) lossList.push(j);
        }
        lossList.sort((a, b) => d2(a) - d2(b));
        const step = Math.min(0.07, 1.1 / Math.max(1, lossList.length));
        lossList.forEach((j, k) => { lossAt[j] = now + 0.4 + k * step; });
        lossPtr = 0;
        const pct = Math.floor(opened / safeTotal * 100);
        const time = fmtTime(Math.floor(elapsed));
        api.after(750, () => api.gameOver({
          score: 0,
          title: 'Kaboom!',
          detail: (pct >= 80 ? 'So close! ' : '') + 'You cleared ' + pct + '% of the safe tiles in ' + time + '.',
          delay: 1000
        }));
      }

      function checkWin() {
        if (ended || opened < safeTotal) return;
        ended = true; won = true; running = false; press = null;
        let k = 0;
        for (let j = 0; j < total; j++) {
          if (bomb[j] && state[j] !== FLAGGED) { state[j] = FLAGGED; flags++; flagAt[j] = now + 0.3 + (k++) * 0.05; }
        }
        updateStats();
        const secs = Math.floor(elapsed);
        const score = Math.max(Math.round(M.base * 0.2), M.base - secs * M.per);
        api.score(score);
        for (let b = 0; b < 6; b++) {
          api.after(250 + b * 170, () => fx.burst(K.rand(BPAD, BW - BPAD), K.rand(BPAD, BH * 0.6), [C.safety, C.glow, C.good, C.hazard, '#ffffff'], 22, 300, { life: 1.1, size: 4 }));
        }
        api.win({
          score,
          title: 'Field cleared!',
          detail: 'You marked all ' + M.bombs + ' bombs and cleared the field in ' + fmtTime(secs) + '.',
          delay: 1400
        });
      }

      function setFlagMode(on) {
        flagMode = on;
        wrap.classList.toggle('is-flag', on);
        api.tone(on ? 700 : 500, 0.05, 'square', 0.035, on ? 200 : -150);
      }

      // ---------- input ----------
      api.on(board.el, 'contextmenu', e => e.preventDefault());
      api.on(head.el, 'contextmenu', e => e.preventDefault());
      api.on(board.el, 'pointerdown', e => {
        if (ended || api.over) return;
        const i = cellFromEvent(e);
        if (i < 0) return;
        showCursor = false; cursor = i;
        const p = { i, id: e.pointerId, mouse: e.pointerType === 'mouse', x: e.clientX, y: e.clientY, used: false, flag: false, stop: null };
        if (p.mouse) {
          if (e.button === 2) { act(i, true); return; }
          if (e.button !== 0) return;
          p.flag = e.shiftKey || e.altKey || e.ctrlKey || e.metaKey;
          press = p;
          K.capture(board.el, e);
          return;
        }
        press = p;
        p.stop = api.after(HOLD_MS, () => {
          if (press !== p || p.used || ended || api.over) return;
          p.used = true;
          if (state[p.i] !== OPEN) {
            toggleFlag(p.i);
            try { if (navigator.vibrate) navigator.vibrate(18); } catch (err) { /* not supported */ }
          }
        });
      });
      api.on(board.el, 'pointermove', e => {
        if (e.pointerType === 'mouse') hover = ended ? -1 : cellFromEvent(e);
        if (!press || e.pointerId !== press.id) return;
        if (press.mouse) { press.i = cellFromEvent(e); return; }
        if (Math.abs(e.clientX - press.x) > 12 || Math.abs(e.clientY - press.y) > 12) {
          if (press.stop) press.stop();
          press = null;
        }
      });
      const release = e => {
        if (!press || e.pointerId !== press.id) return;
        const p = press;
        press = null;
        if (p.stop) p.stop();
        if (e.type !== 'pointerup' || p.used || ended || api.over) return;
        if (p.mouse) { const i = cellFromEvent(e); if (i >= 0) act(i, p.flag); }
        else act(p.i, false);
      };
      api.on(board.el, 'pointerup', release);
      api.on(board.el, 'pointercancel', release);
      api.on(board.el, 'pointerleave', e => { if (e.pointerType === 'mouse') hover = -1; });

      api.on(head.el, 'pointerdown', e => {
        if (api.over) return;
        const p = head.toLocal(e);
        if (!ended && p.x >= TOGGLE.x - 6 && p.x <= TOGGLE.x + TOGGLE.w + 6 && p.y >= TOGGLE.y - 8 && p.y <= TOGGLE.y + TOGGLE.h + 8) { setFlagMode(!flagMode); return; }
        if (Math.abs(p.x - MASCOT.x) < 46 && Math.abs(p.y - MASCOT.y) < 50) { waveUntil = now + 1.1; api.sfx('talk'); }
      });

      function ensureVisible(i) {
        if (!lay.scroll) return;
        const s = lay.s, x = cellX(i) * s, y = cellY(i) * s, c = CELL * s, m = c * 0.6;
        if (x - m < wrap.scrollLeft) wrap.scrollLeft = x - m;
        else if (x + c + m > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = x + c + m - wrap.clientWidth;
        if (y - m < wrap.scrollTop) wrap.scrollTop = y - m;
        else if (y + c + m > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = y + c + m - wrap.clientHeight;
      }

      api.onKey((name, e) => {
        const code = e.code || '';
        if (code === 'KeyF') { if (!e.repeat && !ended) setFlagMode(!flagMode); return; }
        if (ended) return;
        if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
          let x = colOf(cursor), y = rowOf(cursor);
          if (name === 'left') x = Math.max(0, x - 1);
          else if (name === 'right') x = Math.min(cols - 1, x + 1);
          else if (name === 'up') y = Math.max(0, y - 1);
          else y = Math.min(rows - 1, y + 1);
          const next = y * cols + x;
          if (next !== cursor || !showCursor) api.tone(1250, 0.02, 'square', 0.018);
          cursor = next; showCursor = true;
          ensureVisible(cursor);
          return;
        }
        if (e.repeat) return;
        if (name === 'fire' || code === 'Enter' || code === 'NumpadEnter') {
          showCursor = true; wowUntil = now + 0.2;
          act(cursor, e.shiftKey);
        }
      });

      // ---------- drawing ----------
      const boardBg = K.layer(BW, BH, c => {
        c.fillStyle = '#0b141b'; c.fillRect(0, 0, BW, BH);
        c.strokeStyle = '#1c2f3c'; c.lineWidth = 2; c.strokeRect(3, 3, BW - 6, BH - 6);
      }, 2);
      const headBg = K.layer(HW, HH, c => {
        const g = c.createLinearGradient(0, 0, 0, HH);
        g.addColorStop(0, '#1d3140'); g.addColorStop(1, '#142430');
        c.fillStyle = g; c.fillRect(0, 0, HW, HH);
        c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 2;
        for (let x = 40; x < HW; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, HH - 6); c.stroke(); }
        K.hazard(c, 0, HH - 6, HW, 6, { stripe: 9 });
        c.fillStyle = 'rgba(255,255,255,0.1)';
        K.circle(c, 7, 7, 2); K.circle(c, HW - 7, 7, 2);
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(MASCOT.x, MASCOT.y + 44, 34, 5, 0, 0, Math.PI * 2); c.fill();
      }, 2);

      function led(x, y, w, h, text, color) {
        hc.fillStyle = '#0b141b'; K.rr(hc, x, y, w, h, 9);
        hc.strokeStyle = '#223845'; hc.lineWidth = 2; K.rrPath(hc, x + 1, y + 1, w - 2, h - 2, 8); hc.stroke();
        hc.font = K.font(24); hc.textAlign = 'right'; hc.textBaseline = 'middle';
        hc.fillStyle = K.alpha(color, 0.1); hc.fillText(text.replace(/[0-9]/g, '8'), x + w - 12, y + h / 2 + 1);
        hc.fillStyle = color; hc.fillText(text, x + w - 12, y + h / 2 + 1);
      }

      function drawHead() {
        hc.drawImage(headBg, 0, 0, HW, HH);
        // Dig / Flag toggle
        const T = TOGGLE;
        hc.fillStyle = '#0b141b'; K.rr(hc, T.x, T.y, T.w, T.h, 16);
        hc.strokeStyle = '#26404f'; hc.lineWidth = 2; K.rrPath(hc, T.x + 1, T.y + 1, T.w - 2, T.h - 2, 15); hc.stroke();
        const half = T.w / 2 - 4;
        hc.fillStyle = toggleK > 0.5 ? C.hazard : C.safety;
        K.rr(hc, T.x + 4 + half * toggleK, T.y + 4, half, T.h - 8, 12);
        const digOn = toggleK <= 0.5;
        const dx = T.x + 4 + half / 2, fxx = T.x + 4 + half * 1.5;
        shovel(hc, dx, T.y + 27, 26, digOn ? INK : C.muted);
        hc.save(); hc.translate(fxx - 2, T.y + 27); flagShape(hc, 26, now, 0, digOn ? C.muted : INK, digOn ? C.muted : INK); hc.restore();
        K.text(hc, 'DIG', dx, T.y + T.h - 15, { size: 14, body: true, color: digOn ? INK : C.muted, shadow: false });
        K.text(hc, 'FLAG', fxx, T.y + T.h - 15, { size: 14, body: true, color: digOn ? C.muted : INK, shadow: false });
        // counters
        led(330, 12, 136, 38, String(M.bombs - flags), C.hazard);
        K.bomb(hc, 350, 33, 9, now);
        led(330, 56, 136, 38, fmtTime(Math.max(0, shownSecs)), C.glow);
        clock(hc, 350, 76, 9, running ? now : 0);
        // the defuser bot
        const focus = press ? press.i : (hover >= 0 ? hover : (showCursor ? cursor : -1));
        const pressing = press && !press.used && !press.flag && !flagMode && state[press.i] === COVERED;
        let mood = 'happy', arms = 'down', bob = 0;
        if (lost) { mood = 'sad'; bob = now - boomAt < 0.5 ? Math.sin(now * 60) * 2 : 0; }
        else if (won) { arms = 'up'; bob = -Math.abs(Math.sin(now * 8)) * 6; }
        else if (pressing || now < wowUntil) mood = 'wow';
        else if (now < cheerUntil) { arms = 'up'; bob = -Math.abs(Math.sin(now * 10)) * 4; }
        if (!won && !lost && now < waveUntil) arms = 'wave';
        mascot.mood = mood; mascot.arms = arms; mascot.t = now;
        const tl = focus >= 0 ? (colOf(focus) / Math.max(1, cols - 1)) * 2 - 1 : Math.sin(now * 0.7) * 0.4;
        mascot.look += (tl - mascot.look) * 0.2;
        mascot.lookY = lost ? 0.2 : 0.7;
        K.drawBot(hc, MASCOT.x + (lost ? Math.sin(now * 40) * Math.max(0, 0.45 - (now - boomAt)) * 8 : 0), MASCOT.y + bob, MASCOT.h, mascot);
      }

      function drawBoard() {
        const c = bc;
        c.save();
        shake.apply(c, 10);
        c.drawImage(boardBg, 0, 0, BW, BH);
        const chordPress = press && !press.used && !press.flag && press.i >= 0 && state[press.i] === OPEN && count[press.i] > 0 ? press.i : -1;
        const hint = now - hintAt < 0.3 ? hintCell : -1;
        // pass 1: tiles
        for (let i = 0; i < total; i++) {
          const x = cellX(i), y = cellY(i), st = state[i];
          if (st === OPEN && now >= revealAt[i]) {
            if (bomb[i]) { c.drawImage(i === hitCell ? S.red : S.bombBg, x, y, CELL, CELL); K.bomb(c, x + CELL / 2, y + CELL / 2 + 2, CELL * 0.27, now); }
            else c.drawImage(S.open, x, y, CELL, CELL);
            continue;
          }
          if (bomb[i] && st !== FLAGGED && now >= lossAt[i]) {
            c.drawImage(S.bombBg, x, y, CELL, CELL);
            const k = Math.min(1, (now - lossAt[i]) / 0.18);
            K.bomb(c, x + CELL / 2, y + CELL / 2 + 2, CELL * 0.27 * easeBack(k), now);
            continue;
          }
          let spr = S.plate;
          if (st === COVERED && !ended) {
            if (press && !press.used && !press.flag && !flagMode && press.i === i) spr = S.pressed;
            else if (chordPress >= 0 && isNeighbor(chordPress, i)) spr = S.pressed;
            else if (i === hover || (hint >= 0 && (hint === i || isNeighbor(hint, i)))) spr = S.hot;
          } else if (st === FLAGGED && !ended && hint === i) spr = S.hot;
          c.drawImage(spr, x, y, CELL, CELL);
          if (st === FLAGGED && now >= flagAt[i]) {
            drawFlag(c, x + CELL / 2, y + CELL / 2 + 1, CELL, Math.max(0.01, easeBack(Math.min(1, (now - flagAt[i]) / 0.2))), now, i);
            if (!bomb[i] && now >= lossAt[i]) {
              c.strokeStyle = C.bad; c.lineWidth = 4; c.lineCap = 'round';
              c.beginPath(); c.moveTo(x + 9, y + 9); c.lineTo(x + CELL - 9, y + CELL - 9); c.moveTo(x + CELL - 9, y + 9); c.lineTo(x + 9, y + CELL - 9); c.stroke();
            }
          } else if (st === COVERED && flagMode && i === hover && !ended) {
            c.globalAlpha = 0.45; drawFlag(c, x + CELL / 2, y + CELL / 2 + 1, CELL, 1, now, i); c.globalAlpha = 1;
          }
        }
        // pass 2: numbers
        c.font = K.font(22); c.textAlign = 'center'; c.textBaseline = 'middle';
        for (let i = 0; i < total; i++) {
          if (state[i] !== OPEN || bomb[i] || !count[i] || now < revealAt[i]) continue;
          c.fillStyle = NUM[count[i]];
          c.fillText(String(count[i]), cellX(i) + CELL / 2, cellY(i) + CELL / 2 + 1.5);
        }
        // pass 3: plates popping off newly opened tiles
        for (let i = 0; i < total; i++) {
          if (state[i] !== OPEN) continue;
          const k = (now - revealAt[i]) / 0.16;
          if (k < 0 || k >= 1) continue;
          const sz = CELL * (1 - 0.6 * k);
          c.globalAlpha = 1 - k;
          c.drawImage(S.plate, cellX(i) + (CELL - sz) / 2, cellY(i) + (CELL - sz) / 2 - 6 * k, sz, sz);
        }
        c.globalAlpha = 1;
        if (showCursor && !ended) {
          c.strokeStyle = K.alpha(flagMode ? C.hazard : C.safety, 0.75 + 0.25 * Math.sin(now * 8));
          c.lineWidth = 3.5;
          K.rrPath(c, cellX(cursor) + 2, cellY(cursor) + 2, CELL - 4, CELL - 4, 8);
          c.stroke();
        }
        fx.draw(c);
        c.restore();
        if (flash > 0) { c.fillStyle = 'rgba(255,220,170,' + (flash * 0.55) + ')'; c.fillRect(0, 0, BW, BH); }
      }

      updateStats();
      api.loop(dt => {
        now += dt;
        if (running) {
          elapsed += dt;
          const s = Math.min(5999, Math.floor(elapsed));
          if (s !== shownSecs) { shownSecs = s; api.stat('Time', fmtTime(s)); }
        } else if (shownSecs < 0) shownSecs = 0;
        toggleK += ((flagMode ? 1 : 0) - toggleK) * Math.min(1, dt * 14);
        while (lost && lossPtr < lossList.length && now >= lossAt[lossList[lossPtr]]) {
          const j = lossList[lossPtr++];
          if (bomb[j]) {
            fx.burst(cellX(j) + CELL / 2, cellY(j) + CELL / 2, ['#ff9d2e', '#3a3f44'], 5, 90, { life: 0.35, size: 3, gravity: 150 });
            if (lossPtr % 2) api.tone(160 + (lossPtr % 5) * 30, 0.05, 'square', 0.025);
          }
        }
        flash = Math.max(0, flash - dt);
        fx.update(dt);
        shake.update(dt);
        drawBoard();
        drawHead();
      });

      // test hook for the QA scripts: read-only view of the field
      board.el._qa = {
        state: () => ({ cols, rows, bpad: BPAD, cell: CELL, placed, opened, safeTotal, flags, ended, won, lost, flagMode, scroll: lay.scroll, cellCss: CELL * lay.s,
          bombs: Array.from(bomb), states: Array.from(state), counts: Array.from(count) })
      };
    }
  });
})();
