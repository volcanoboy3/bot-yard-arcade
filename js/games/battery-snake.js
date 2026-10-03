/* Battery Snake: steer a train of battery carts around the depot, led by your bot's head.
 * Batteries make the train longer and faster; golden ones vanish fast; scrap blocks drop in later.
 * The yard is 24×18 cells, turned to 18×24 when the stage is portrait (phones) so cells stay big. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const CS = 30, F = 18;                 // cell size and frame width
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const GOLD = '#f5c518';
  const px = c => F + c * CS + CS / 2;
  const py = r => F + r * CS + CS / 2;

  // ---------- painters (shared by the game and the thumb) ----------
  function paintFloor(c, cols, rows) {
    const W = cols * CS + F * 2, H = rows * CS + F * 2;
    c.fillStyle = '#0d171e'; c.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        c.fillStyle = (q + r) % 2 ? '#152530' : '#12212a';
        c.fillRect(F + q * CS, F + r * CS, CS, CS);
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let q = 0; q <= cols; q++) c.fillRect(F + q * CS - 0.5, F, 1, rows * CS);
    for (let r = 0; r <= rows; r++) c.fillRect(F, F + r * CS - 0.5, cols * CS, 1);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    for (let q = 3; q < cols; q += 3) for (let r = 3; r < rows; r += 3) K.circle(c, F + q * CS, F + r * CS, 1.7);
  }
  function paintFrame(c, cols, rows, wrap) {
    const W = cols * CS + F * 2, H = rows * CS + F * 2;
    c.save();
    c.beginPath(); c.rect(0, 0, W, H); c.rect(F, F, cols * CS, rows * CS); c.clip('evenodd');
    if (!wrap) {
      K.hazard(c, 0, 0, W, H, { stripe: 14 });
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, W, H);
    } else {
      c.fillStyle = '#1b2d39'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(90,209,230,0.55)';
      const chev = (x, y, ang) => {
        c.save(); c.translate(x, y); c.rotate(ang);
        c.beginPath(); c.moveTo(-4, -6); c.lineTo(3, 0); c.lineTo(-4, 6); c.lineTo(-7, 6); c.lineTo(0, 0); c.lineTo(-7, -6); c.closePath(); c.fill();
        c.restore();
      };
      for (let x = F + 45; x < W - F; x += 90) { chev(x, F / 2, -Math.PI / 2); chev(x, H - F / 2, Math.PI / 2); }
      for (let y = F + 45; y < H - F; y += 90) { chev(F / 2, y, Math.PI); chev(W - F / 2, y, 0); }
    }
    c.restore();
    c.fillStyle = '#0b141b';
    c.fillRect(0, 0, W, 2); c.fillRect(0, H - 2, W, 2); c.fillRect(0, 0, 2, H); c.fillRect(W - 2, 0, 2, H);
    if (wrap) {
      c.strokeStyle = C.glow; c.lineWidth = 2; c.setLineDash([10, 8]);
      c.strokeRect(F - 1, F - 1, cols * CS + 2, rows * CS + 2);
      c.setLineDash([]);
    } else {
      c.strokeStyle = '#0b141b'; c.lineWidth = 3;
      c.strokeRect(F - 1.5, F - 1.5, cols * CS + 3, rows * CS + 3);
    }
  }
  /** One battery cart centred on x,y. vertical: travelling up/down. */
  function paintCart(c, x, y, body, vertical) {
    c.fillStyle = C.dark;
    if (vertical) {
      K.rr(c, x - 15, y - 9, 5, 7, 2); K.rr(c, x - 15, y + 2, 5, 7, 2);
      K.rr(c, x + 10, y - 9, 5, 7, 2); K.rr(c, x + 10, y + 2, 5, 7, 2);
    } else {
      K.rr(c, x - 9, y - 15, 7, 5, 2); K.rr(c, x + 2, y - 15, 7, 5, 2);
      K.rr(c, x - 9, y + 10, 7, 5, 2); K.rr(c, x + 2, y + 10, 7, 5, 2);
    }
    c.fillStyle = K.shade(body, -0.4); K.rr(c, x - 12, y - 12, 24, 24, 6);
    c.fillStyle = body; K.rr(c, x - 12, y - 12, 24, 21.5, 6);
    c.fillStyle = 'rgba(255,255,255,0.28)'; K.rr(c, x - 9, y - 10.5, 18, 2.5, 1.2);
    c.fillStyle = 'rgba(0,0,0,0.22)'; K.rr(c, x - 8.5, y - 6.5, 17, 14, 3);
    if (vertical) K.battery(c, x, y + 0.5, 9, 14, 1, C.good);
    else K.battery(c, x - 0.5, y + 0.5, 14, 9, 1, C.good);
  }
  /** The locomotive: the player's bot head seen from above, facing ang. */
  function paintHead(c, x, y, ang, o, t) {
    const body = o.body || C.glow, dark = K.shade(body, -0.4), eye = o.eye || C.eye;
    c.save();
    c.translate(x, y); c.rotate(ang); c.scale(1.14, 1.14);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    if (o.head === 'dome') K.circle(c, 1, 2, 16); else K.rr(c, -14, -13, 30, 30, 8);
    if (o.head === 'dome') {
      c.fillStyle = dark; K.circle(c, 0, 1, 15.5);
      c.fillStyle = body; K.circle(c, 0, 0, 15);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(-5, -7, 6, 3, -0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = C.dark; c.beginPath(); c.arc(0, 0, 12, -1.05, 1.05); c.arc(0, 0, 3, 1.05, -1.05, true); c.closePath(); c.fill();
    } else {
      const rad = o.head === 'tv' ? 3 : 8;
      c.fillStyle = dark; K.rr(c, -15, -14, 30, 30, rad);
      c.fillStyle = body; K.rr(c, -15, -15, 30, 29, rad);
      c.fillStyle = 'rgba(255,255,255,0.25)'; K.rr(c, -12, -13, 20, 3, 1.5);
      c.fillStyle = C.dark; K.rr(c, 1, -11, 12, 22, o.head === 'tv' ? 2 : 5);
      if (o.head === 'tv') {
        c.fillStyle = 'rgba(255,255,255,0.06)';
        for (let yy = -9; yy < 10; yy += 3) c.fillRect(2, yy, 10, 1);
        c.fillStyle = K.shade(body, -0.35); K.circle(c, -10, -9, 2.3); K.circle(c, -10, 9, 2.3);
      }
    }
    // eyes, looking ahead
    const mood = o.mood || 'happy';
    const blink = mood !== 'dead' && (t % 3.4) < 0.12;
    for (const s of [-1, 1]) {
      const ex = 8, ey = s * 5.2;
      if (mood === 'dead') {
        c.strokeStyle = eye; c.lineWidth = 1.8; c.lineCap = 'round';
        c.beginPath(); c.moveTo(ex - 2.6, ey - 2.6); c.lineTo(ex + 2.6, ey + 2.6); c.moveTo(ex + 2.6, ey - 2.6); c.lineTo(ex - 2.6, ey + 2.6); c.stroke();
      } else if (blink) {
        c.fillStyle = eye; c.fillRect(ex - 0.9, ey - 3, 1.8, 6);
      } else {
        const er = mood === 'wow' ? 4 : 3.1;
        c.fillStyle = K.alpha(eye, 0.25); K.circle(c, ex, ey, er + 2.2);
        c.fillStyle = eye;
        if (o.head === 'tv') K.rr(c, ex - er, ey - er, er * 2, er * 2, 1); else K.circle(c, ex, ey, er);
      }
    }
    // antenna on the back of the head
    const on = Math.sin(t * 8) > 0;
    const red = on ? '#ff4d4d' : '#ffb3b3';
    if (o.antenna === 'bolt') {
      c.fillStyle = C.safety;
      c.beginPath(); c.moveTo(-6, -6); c.lineTo(-11, 1); c.lineTo(-8, 1); c.lineTo(-10, 7); c.lineTo(-4, -1); c.lineTo(-7, -1); c.closePath(); c.fill();
    } else if (o.antenna === 'twin') {
      c.fillStyle = on ? '#ff4d4d' : '#ffb3b3'; K.circle(c, -9, -9, 2.6);
      c.fillStyle = on ? '#ffb3b3' : '#ff4d4d'; K.circle(c, -9, 9, 2.6);
    } else if (o.antenna === 'dish') {
      c.fillStyle = C.steel; c.beginPath(); c.arc(-7, 0, 6.5, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(-7, 0, 4, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.fill();
      c.fillStyle = red; K.circle(c, -8, 0, 1.8);
    } else if (o.antenna !== 'none') {
      c.fillStyle = red; K.circle(c, -7, 0, 3.6);
      c.fillStyle = 'rgba(255,255,255,0.55)'; K.circle(c, -8, -1, 1.2);
    }
    c.restore();
  }
  function paintScrap(c, x, y, seed) {
    c.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(c, x - 12, y - 10, 26, 25, 4);
    c.fillStyle = '#4f5c65'; K.rr(c, x - 13, y - 13, 26, 26, 4);
    c.fillStyle = '#6c7b85';
    c.beginPath(); c.moveTo(x - 13, y - 9); c.lineTo(x - 9, y - 13); c.lineTo(x + 9, y - 13); c.lineTo(x + 2, y - 3); c.lineTo(x - 13, y + 1); c.closePath(); c.fill();
    c.fillStyle = '#3a454d';
    c.beginPath(); c.moveTo(x + 13, y - 6); c.lineTo(x + 13, y + 9); c.lineTo(x + 9, y + 13); c.lineTo(x - 4, y + 13); c.lineTo(x + 3, y + 2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(176,98,54,0.75)';
    K.circle(c, x - 6 + (seed % 3) * 3, y + 6, 3); K.circle(c, x + 7, y - 7 + (seed % 2) * 5, 2.2);
    c.strokeStyle = 'rgba(12,20,26,0.8)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x - 10, y + 3); c.lineTo(x - 1, y - 1); c.lineTo(x + 4, y + 8);
    c.moveTo(x + 2, y - 11); c.lineTo(x + 5, y - 4); c.stroke();
    c.fillStyle = '#a9b6bf'; K.circle(c, x - 9, y - 8.5, 1.6); K.circle(c, x + 9, y + 9, 1.6);
  }
  function paintFood(c, x, y, golden, t, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const col = golden ? GOLD : C.good;
    c.fillStyle = K.alpha(col, 0.22); K.circle(c, 0, 0, 14 + Math.sin(t * 5) * 1.5);
    K.ring(c, 0, 0, 12.5, 1.5, K.alpha(col, 0.55));
    if (golden) {
      c.strokeStyle = K.alpha(GOLD, 0.75); c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = t * 1.5 + k * Math.PI / 4, r0 = 14, r1 = 17 + (k % 2) * 2;
        c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      c.stroke();
    }
    K.battery(c, 0, Math.sin(t * 4) * 1.2, 14, 22, 1, col);
    c.restore();
  }

  Arcade.register({
    id: 'battery-snake',
    title: 'Battery Snake',
    cat: 'action',
    blurb: 'Haul batteries with your bot train. Do not crash!',
    rules: [
      'Steer to the batteries. Each one adds a cart and 10 points.',
      'Golden batteries are worth 50 but vanish in a few seconds.',
      'Longer trains go faster, and scrap blocks start to drop in.',
      'Crash into your carts or scrap and the run is over.'
    ],
    how: 'Arrow keys or WASD · swipe on a touch screen',
    accent: '#9fdc6b',
    usesPlayer: true,
    touch: ['left', 'right', 'up', 'down'],
    modes: [
      { id: 'classic', label: 'Classic', note: 'Walls hurt' },
      { id: 'wrap', label: 'Wrap', note: 'Edges loop around' }
    ],

    thumb(ctx, w, h, kit, player) {
      ctx.save();
      ctx.scale(0.8, 0.8);
      ctx.translate(-F - CS * 2, -F - CS);
      paintFloor(ctx, 24, 18);
      const path = [[9, 2], [8, 2], [7, 2], [6, 2], [5, 2], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6]];
      const body = player.body || C.glow;
      ctx.strokeStyle = C.steel; ctx.lineWidth = 4;
      ctx.beginPath();
      path.forEach(([q, r], i) => { if (i) ctx.lineTo(px(q), py(r)); else ctx.moveTo(px(q), py(r)); });
      ctx.stroke();
      for (let i = path.length - 1; i > 0; i--) {
        const [q, r] = path[i], [pq] = path[i - 1];
        paintCart(ctx, px(q), py(r), body, pq === q);
      }
      paintHead(ctx, px(path[0][0]), py(path[0][1]), 0, Object.assign({}, player, { mood: 'wow' }), 0.25);
      paintFood(ctx, px(12), py(2), false, 0.2, 1.1);
      paintFood(ctx, px(13), py(5), true, 0.3, 1.1);
      kit.ring(ctx, px(13), py(5), 21, 2.5, 'rgba(245,197,24,0.25)');
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px(13), py(5), 21, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
      paintScrap(ctx, px(7), py(4), 1);
      paintScrap(ctx, px(12), py(8), 2);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(6, 6, w - 12, h - 12); ctx.clip('evenodd');
      kit.hazard(ctx, 0, 0, w, h, { stripe: 8 });
      ctx.restore();
    },

    start(api) {
      const wrap = api.mode === 'wrap';
      const portrait = api.stage.clientHeight > api.stage.clientWidth * 1.1;
      const COLS = portrait ? 18 : 24, ROWS = portrait ? 24 : 18;
      const GW = COLS * CS, GH = ROWS * CS, W = GW + F * 2, H = GH + F * 2;
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const player = api.player;
      const body = player.body || C.glow;
      const floorL = K.layer(W, H, c => paintFloor(c, COLS, ROWS), 2);
      const frameL = K.layer(W, H, c => paintFrame(c, COLS, ROWS, wrap), 2);
      const vigL = K.layer(W, H, c => K.vignette(c, W, H, 0.35), 1);
      const cartH = K.layer(CS + 4, CS + 4, c => paintCart(c, (CS + 4) / 2, (CS + 4) / 2, body, false), 2);
      const cartV = K.layer(CS + 4, CS + 4, c => paintCart(c, (CS + 4) / 2, (CS + 4) / 2, body, true), 2);
      const scrapL = [0, 1, 2].map(k => K.layer(CS, CS, c => paintScrap(c, CS / 2, CS / 2, k), 2));
      const fx = K.particles(), sh = K.shaker();
      const headOpts = Object.assign({}, player, { mood: 'happy' });

      const S = {
        state: 'ready', t: 0, dt: 0, readyT: 1.3, goT: 0,
        dir: portrait ? DIRS.up : DIRS.right, stepT: 0, grow: 0, eaten: 0, golds: 0, score: 0,
        headAng: portrait ? -Math.PI / 2 : 0, wowT: 0, puffT: 0, popT: 0, popped: 0, flash: 0,
        scrapSeen: false
      };
      const queue = [], snake = [], scraps = [], drops = [], bulges = [], posPool = [];
      const hc = portrait ? 9 : 6, hr = portrait ? 15 : 9;
      for (let i = 0; i < 3; i++) {
        const c = hc - S.dir[0] * i, r = hr - S.dir[1] * i;
        snake.push({ c, r, pc: c - S.dir[0], pr: r - S.dir[1] });
      }
      let food = null, gold = null;

      api.score(0);
      api.stat('Length', snake.length);

      // ---------- helpers ----------
      const onSnake = (c, r) => snake.some(s => s.c === c && s.r === r);
      const scrapAt = (c, r) => scraps.some(s => s.c === c && s.r === r);
      const dropAt = (c, r) => drops.some(s => s.c === c && s.r === r);
      const taken = (c, r) => onSnake(c, r) || scrapAt(c, r) || dropAt(c, r) ||
        (food && food.c === c && food.r === r) || (gold && gold.c === c && gold.r === r);
      const edge = (c, r) => c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
      function freeCell(test) {
        for (let k = 0; k < 400; k++) {
          const c = K.randi(0, COLS - 1), r = K.randi(0, ROWS - 1);
          if (!taken(c, r) && (!test || test(c, r))) return { c, r };
        }
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!taken(c, r)) return { c, r };
        return null;
      }
      function placeFood(first) {
        const head = snake[0];
        if (first) food = { c: head.c + S.dir[0] * 6 + (portrait ? K.randi(-2, 2) : 0), r: head.r + S.dir[1] * 6 + (portrait ? 0 : K.randi(-2, 2)) };
        else food = freeCell((c, r) => (wrap || !edge(c, r) || Math.random() < 0.3) && Math.abs(c - head.c) + Math.abs(r - head.r) > 3);
        if (food) food.t = 0;
        else {
          S.state = 'dead';
          api.win({ score: S.score, title: 'Yard full!', detail: 'Your train filled the whole depot with ' + S.eaten + ' batteries.' });
        }
      }
      const interval = () => Math.max(0.08, 0.18 - (snake.length - 3) * 0.0033);

      // ---------- input ----------
      function turn(name) {
        if (S.state === 'dead' || api.over) return;
        const d = DIRS[name];
        if (!d) return;
        const last = queue.length ? queue[queue.length - 1] : S.dir;
        if (d === last || (d[0] === -last[0] && d[1] === -last[1])) return;
        if (queue.length < 2) queue.push(d);
      }
      api.onKey(name => { if (name && name !== 'fire') turn(name); });
      let swipe = null;
      api.on(cv.el, 'pointerdown', e => { K.capture(cv.el, e); swipe = { x: e.clientX, y: e.clientY }; });
      api.on(cv.el, 'pointermove', e => {
        if (!swipe) return;
        const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        swipe = { x: e.clientX, y: e.clientY };
      });
      const endSwipe = () => { swipe = null; };
      api.on(cv.el, 'pointerup', endSwipe);
      api.on(cv.el, 'pointercancel', endSwipe);

      // ---------- game rules ----------
      function crash(cause, c, r) {
        S.state = 'dead'; S.flash = 1;
        const x = px(K.clamp(c, -0.5, COLS - 0.5)), y = py(K.clamp(r, -0.5, ROWS - 0.5));
        fx.burst(x, y, ['#fff3a0', '#ffd36b', '#ff9d2e', C.hazard], 30, 330, { life: 0.8, size: 3.5 });
        sh.add(0.5);
        api.sfx('boom');
        const n = S.eaten, g = S.golds;
        const title = cause === 'wall' ? 'Hit the wall!' : cause === 'scrap' ? 'Scrap crash!' : 'Tangled up!';
        api.gameOver({
          score: S.score, title, delay: 1200,
          detail: 'Your train hauled ' + n + ' batter' + (n === 1 ? 'y' : 'ies') + (g ? ', ' + g + ' of them golden.' : '.')
        });
      }

      function maybeScrap() {
        const len = snake.length + S.grow;
        if (len < 15) return;
        const cap = Math.min(16, 2 + Math.floor((len - 15) / 2));
        if (scraps.length + drops.length >= cap || Math.random() > 0.65) return;
        const head = snake[0];
        const cell = freeCell((c, r) => {
          if (edge(c, r)) return false;
          if (Math.abs(c - head.c) + Math.abs(r - head.r) < 6) return false;
          for (let k = 1; k <= 7; k++) {
            let ac = head.c + S.dir[0] * k, ar = head.r + S.dir[1] * k;
            if (wrap) { ac = (ac + COLS) % COLS; ar = (ar + ROWS) % ROWS; }
            if (ac === c && ar === r) return false;
          }
          for (const s of scraps) if (Math.abs(s.c - c) <= 1 && Math.abs(s.r - r) <= 1) return false;
          for (const s of drops) if (Math.abs(s.c - c) <= 1 && Math.abs(s.r - r) <= 1) return false;
          return true;
        });
        if (!cell) return;
        drops.push({ c: cell.c, r: cell.r, v: K.randi(0, 2), t: 0, dur: 1.5 });
        if (!S.scrapSeen) { S.scrapSeen = true; api.toast('SCRAP INCOMING!', { color: C.hazard }); }
      }

      function eat(golden) {
        const head = snake[0], x = px(head.c), y = py(head.r);
        S.eaten++; S.grow++; S.wowT = 0.3;
        bulges.push(0);
        if (golden) {
          S.golds++; S.score += 50;
          fx.burst(x, y, [GOLD, '#fff3a0', '#ffffff'], 26, 260, { life: 0.7 });
          fx.float('+50', x, y - 18, GOLD, { size: 28 });
          api.sfx('power');
          gold = null;
        } else {
          S.score += 10;
          fx.burst(x, y, [C.good, '#d6ffd9', C.safety], 16, 200, { life: 0.55 });
          fx.float('+10', x, y - 16, C.good, { size: 22 });
          api.tone(520 + (S.eaten % 8) * 70, 0.07, 'square', 0.04);
          api.tone(780 + (S.eaten % 8) * 70, 0.08, 'square', 0.035, 0, 0.06);
          placeFood(false);
          if (!gold && S.eaten >= 3 && Math.random() < 0.28) {
            const g = freeCell((c, r) => { const d = Math.abs(c - head.c) + Math.abs(r - head.r); return d >= 4 && d <= 14; });
            if (g) { gold = { c: g.c, r: g.r, t: 0, life: 5.5 }; api.tone(1320, 0.12, 'triangle', 0.04, 300); }
          }
          maybeScrap();
        }
        api.score(S.score);
        const len = snake.length + S.grow;
        api.stat('Length', len);
        if (len % 10 === 0) { api.toast('SPEED UP!', { color: C.good }); api.sfx('levelup'); }
      }

      function step() {
        if (queue.length) S.dir = queue.shift();
        const head = snake[0];
        let nc = head.c + S.dir[0], nr = head.r + S.dir[1];
        if (wrap) { nc = (nc + COLS) % COLS; nr = (nr + ROWS) % ROWS; }
        else if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) { crash('wall', nc, nr); return; }
        const tailMoves = S.grow === 0;
        for (let i = 0; i < snake.length - (tailMoves ? 1 : 0); i++) {
          if (snake[i].c === nc && snake[i].r === nr) { crash('self', nc, nr); return; }
        }
        if (scrapAt(nc, nr)) { crash('scrap', nc, nr); return; }
        const tail = snake[snake.length - 1], tc = tail.c, tr = tail.r;
        for (let i = snake.length - 1; i > 0; i--) {
          const s = snake[i], p = snake[i - 1];
          s.pc = s.c; s.pr = s.r; s.c = p.c; s.r = p.r;
        }
        head.pc = head.c; head.pr = head.r; head.c = nc; head.r = nr;
        if (S.grow > 0) { snake.push({ c: tc, r: tr, pc: tc, pr: tr }); S.grow--; }
        for (let i = bulges.length - 1; i >= 0; i--) { bulges[i]++; if (bulges[i] >= snake.length) bulges.splice(i, 1); }
        if (food && nc === food.c && nr === food.r) eat(false);
        else if (gold && nc === gold.c && nr === gold.r) eat(true);
      }

      function update(dt) {
        if (S.state === 'ready') {
          S.readyT -= dt;
          if (S.readyT <= 0) { S.state = 'play'; S.goT = 0.7; api.sfx('blip'); }
          return;
        }
        if (S.state !== 'play') return;
        S.stepT += dt;
        let iv = interval();
        while (S.stepT >= iv && S.state === 'play') { S.stepT -= iv; step(); iv = interval(); }
        if (gold) {
          gold.t += dt;
          if (gold.t >= gold.life) {
            fx.burst(px(gold.c), py(gold.r), [GOLD, '#8a7a3a'], 10, 120, { life: 0.4 });
            gold = null;
          }
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.t = Math.min(d.dur, d.t + dt);
          if (d.t >= d.dur && !onSnake(d.c, d.r)) {
            drops.splice(i, 1);
            scraps.push({ c: d.c, r: d.r, v: d.v });
            fx.burst(px(d.c), py(d.r) + 8, ['#6f8796', '#8b9aa6', '#4a5a64'], 12, 150, { life: 0.5, lift: 40 });
            sh.add(0.12);
            api.tone(120, 0.18, 'square', 0.05, -50);
          }
        }
      }

      // ---------- render ----------
      function segPos(i, p) {
        const s = snake[i];
        const o = posPool[i] || (posPool[i] = { x: 0, y: 0, dx: 0, dy: 0 });
        let dx = s.c - s.pc, dy = s.r - s.pr;
        if (dx > 1) dx -= COLS; else if (dx < -1) dx += COLS;
        if (dy > 1) dy -= ROWS; else if (dy < -1) dy += ROWS;
        o.x = s.pc + dx * p; o.y = s.pr + dy * p; o.dx = dx; o.dy = dy;
        return o;
      }
      /** Calls fn at a grid position, plus its mirror across the edge while it slides through a wrap. */
      function forWrapped(gx, gy, fn) {
        fn(gx, gy);
        if (!wrap) return;
        if (gx < 0.5) fn(gx + COLS, gy); else if (gx > COLS - 1.5) fn(gx - COLS, gy);
        if (gy < 0.5) fn(gx, gy + ROWS); else if (gy > ROWS - 1.5) fn(gx, gy - ROWS);
      }

      function drawDrop(d) {
        const k = d.t / d.dur, x = px(d.c), y = py(d.r);
        ctx.globalAlpha = 0.25 + 0.45 * k; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x, y + 4, 4 + 10 * k, 3 + 7 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.sin(S.t * 18) > 0 ? 0.95 : 0.4;
        ctx.strokeStyle = C.hazard; ctx.lineWidth = 2;
        const e = 13, q = 5;
        ctx.beginPath();
        ctx.moveTo(x - e, y - e + q); ctx.lineTo(x - e, y - e); ctx.lineTo(x - e + q, y - e);
        ctx.moveTo(x + e - q, y - e); ctx.lineTo(x + e, y - e); ctx.lineTo(x + e, y - e + q);
        ctx.moveTo(x + e, y + e - q); ctx.lineTo(x + e, y + e); ctx.lineTo(x + e - q, y + e);
        ctx.moveTo(x - e + q, y + e); ctx.lineTo(x - e, y + e); ctx.lineTo(x - e, y + e - q);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (k > 0.55) ctx.drawImage(scrapL[d.v], x - CS / 2, y - CS / 2 - (1 - k) / 0.45 * 60, CS, CS);
      }

      function render() {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        sh.apply(ctx, 10);
        ctx.drawImage(floorL, 0, 0, W, H);
        const p = S.state === 'play' ? K.clamp(S.stepT / interval(), 0, 1) : S.state === 'ready' ? 0 : 1;

        ctx.save();
        ctx.beginPath(); ctx.rect(F, F, GW, GH); ctx.clip();
        for (const d of drops) drawDrop(d);
        for (const s of scraps) ctx.drawImage(scrapL[s.v], px(s.c) - CS / 2, py(s.r) - CS / 2, CS, CS);
        if (food) paintFood(ctx, px(food.c), py(food.r), false, S.t, K.clamp(food.t * 5, 0.05, 1));
        if (gold) {
          const left = 1 - gold.t / gold.life, x = px(gold.c), y = py(gold.r);
          if (gold.life - gold.t > 1.5 || Math.floor(gold.t * 10) % 2 === 0) paintFood(ctx, x, y, true, S.t, K.clamp(gold.t * 5, 0.05, 1));
          K.ring(ctx, x, y, 21, 2.5, 'rgba(245,197,24,0.2)');
          ctx.strokeStyle = left > 0.3 ? GOLD : C.hazard; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
        }

        // the train: couplings first, then carts from tail to head
        const n = snake.length;
        for (let i = 0; i < n; i++) segPos(i, p);
        ctx.strokeStyle = C.steel; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = Math.max(1, S.popped); i < n - 1; i++) {
          const a = posPool[i], b = posPool[i + 1];
          if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.y - b.y) > 1.5) continue;
          ctx.moveTo(F + a.x * CS + CS / 2, F + a.y * CS + CS / 2);
          ctx.lineTo(F + b.x * CS + CS / 2, F + b.y * CS + CS / 2);
        }
        if (n > 1 && S.popped <= 1) {
          const a = posPool[0], b = posPool[1];
          if (Math.abs(a.x - b.x) <= 1.5 && Math.abs(a.y - b.y) <= 1.5) {
            ctx.moveTo(F + a.x * CS + CS / 2, F + a.y * CS + CS / 2);
            ctx.lineTo(F + b.x * CS + CS / 2, F + b.y * CS + CS / 2);
          }
        }
        ctx.stroke();
        for (let i = n - 1; i >= 1; i--) {
          if (i < S.popped) continue;
          const q = posPool[i];
          let vertical = q.dy !== 0;
          if (q.dx === 0 && q.dy === 0) { const a = posPool[i - 1]; vertical = Math.abs(a.y - q.y) > Math.abs(a.x - q.x); }
          let bulge = 0;
          for (const b of bulges) bulge = Math.max(bulge, 1 - Math.abs(i - (b + p)));
          const img = vertical ? cartV : cartH, sz = (CS + 4) * (1 + 0.2 * bulge);
          const tail = i === n - 1;
          forWrapped(q.x, q.y, (gx, gy) => {
            const x = F + gx * CS + CS / 2, y = F + gy * CS + CS / 2;
            ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
            if (tail) {
              ctx.fillStyle = Math.sin(S.t * 6) > 0 ? '#ff4d4d' : '#b33a3a';
              const bx = vertical ? 0 : -(q.dx || 1) * 11, by = vertical ? -(q.dy || 1) * 11 : 0;
              K.circle(ctx, x + bx, y + by, 2.6);
            }
          });
        }
        // head (the bot) eases round to face the way the train is going
        let da = Math.atan2(S.dir[1], S.dir[0]) - S.headAng;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        S.headAng += da * Math.min(1, S.dt * 18);
        headOpts.mood = S.state === 'dead' ? 'dead' : S.wowT > 0 ? 'wow' : 'happy';
        forWrapped(posPool[0].x, posPool[0].y, (gx, gy) => {
          paintHead(ctx, F + gx * CS + CS / 2, F + gy * CS + CS / 2, S.headAng, headOpts, S.t);
        });
        ctx.restore();

        fx.draw(ctx);

        if (S.state === 'ready' || S.goT > 0) {
          const ready = S.state === 'ready';
          const by = portrait ? 100 : 60;   // above the first battery, which sits ahead of the train
          ctx.globalAlpha = ready ? 1 : Math.min(1, S.goT * 2);
          ctx.fillStyle = 'rgba(11,20,27,0.72)'; K.rr(ctx, W / 2 - 220, by, 440, ready ? 108 : 76, 16);
          K.text(ctx, ready ? 'READY?' : 'GO!', W / 2, by + 38, { size: 44, color: ready ? C.safety : C.good });
          if (ready) K.text(ctx, api.isTouch ? 'Swipe or use the arrows to steer' : 'Steer with the arrow keys or WASD', W / 2, by + 80, { size: 22, body: true, color: '#b8c6cf' });
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        ctx.drawImage(vigL, 0, 0, W, H);
        ctx.drawImage(frameL, 0, 0, W, H);
        if (S.flash > 0) { ctx.globalAlpha = S.flash * 0.35; ctx.fillStyle = '#fff4d6'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      }

      function stepEffects(dt) {
        S.wowT = Math.max(0, S.wowT - dt);
        S.goT = Math.max(0, S.goT - dt);
        S.flash = Math.max(0, S.flash - dt * 2.5);
        if (food) food.t += dt;
        if (S.state === 'play') {
          S.puffT -= dt;
          if (S.puffT <= 0) {
            S.puffT = Math.max(0.18, interval() * 2.2);
            const h = segPos(0, K.clamp(S.stepT / interval(), 0, 1));
            const x = F + h.x * CS + CS / 2 - Math.cos(S.headAng) * 12, y = F + h.y * CS + CS / 2 - Math.sin(S.headAng) * 12;
            fx.burst(x, y, ['rgba(230,238,242,0.55)', 'rgba(191,246,255,0.45)'], 2, 30, { life: 0.5, gravity: 0, lift: 20, size: 4 });
          }
        }
        if (S.state === 'dead' && S.popped < snake.length) {
          S.popT -= dt;
          while (S.popT <= 0 && S.popped < snake.length) {
            S.popT += Math.min(0.06, 1 / snake.length);
            S.popped++;
            const s = snake[S.popped - 1];
            if (S.popped > 1) {
              fx.burst(px(s.c), py(s.r), [body, C.steel, '#ffd36b'], 8, 170, { life: 0.5 });
              if (S.popped % 2 === 0) api.tone(Math.max(90, 520 - S.popped * 14), 0.05, 'square', 0.03);
            }
          }
        }
        fx.update(dt); sh.update(dt);
      }

      placeFood(true);
      api.loop(dt => {
        S.t += dt; S.dt = dt;
        update(dt);
        stepEffects(dt);
        render();
      });
    }
  });
})();
