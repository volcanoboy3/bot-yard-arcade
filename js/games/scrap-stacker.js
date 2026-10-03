/* Scrap Stacker: a falling-block line clearer in the scrap yard.
 * 10×20 crusher well, 7-bag randomiser, SRS rotation with wall kicks, ghost piece,
 * hold, a three-piece preview (the crane holds the next one), soft and hard drop. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 520, H = 720;
  const COLS = 10, ROWS = 20, HID = 2, TOTAL = ROWS + HID;   // HID hidden rows above the well
  const CELL = 32;
  const WX = 22, WY = 64, WW = COLS * CELL, WH = ROWS * CELL;
  const PX = 366, PW = 138, PCX = PX + PW / 2;
  const BOX = { next: [40, 156], queue: [206, 96], hold: [312, 108], level: [430, 130] };
  const DAS = 0.16, ARR = 0.045, SOFT = 0.035, LOCK = 0.5, MAX_RESETS = 15, CLEAR_TIME = 0.42;
  const LINE_PTS = [0, 100, 300, 500, 800];
  const LINE_WORD = ['', 'CRUSH!', 'DOUBLE!', 'TRIPLE!', 'MEGA CRUSH!'];
  const SPARKS = ['#fff3a0', '#f5c518', '#ffffff', '#ff9d2e', '#5ad1e6'];
  const FOREMAN = { body: '#f5c518', eye: '#bff6ff', head: 'box', antenna: 'bolt', base: 'treads' };

  // Tetrominoes in SRS spawn orientation: [x, y] cells inside an n×n box.
  const SHAPES = [
    { id: 'I', n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#5ad1e6' },
    { id: 'O', n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#f5c518' },
    { id: 'T', n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#c3a6ff' },
    { id: 'S', n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#9fdc6b' },
    { id: 'Z', n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ff5a5a' },
    { id: 'J', n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#c9d4db' },
    { id: 'L', n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#ff8a5c' }
  ];
  // ROT[type][rot]: clockwise rotation inside the box, (x, y) → (n - 1 - y, x)
  const ROT = SHAPES.map(s => {
    const out = [s.cells];
    for (let r = 1; r < 4; r++) out.push(out[r - 1].map(([x, y]) => [s.n - 1 - y, x]));
    return out;
  });
  const BOUNDS = ROT.map(rots => {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const [x, y] of rots[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  });
  // SRS wall kicks with y pointing down. Key: from-state + to-state (0, 1 = R, 2, 3 = L).
  const KICK = {
    '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };
  const KICK_I = {
    '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };
  /** Seconds per row at a level: gentle at first, quick by level 10. */
  const gravity = lv => Math.max(0.05, 0.85 * Math.pow(0.83, lv - 1));

  /** One riveted scrap plate, s pixels square. v picks a wear pattern so the pile looks second-hand. */
  function plate(c, x, y, s, col, v) {
    const k = s / 32;
    c.save(); c.translate(x, y); c.scale(k, k);
    c.fillStyle = K.shade(col, -0.58); K.rr(c, 0, 0, 32, 32, 5);
    c.fillStyle = col; K.rr(c, 1.5, 1.5, 29, 29, 4);
    c.fillStyle = K.shade(col, 0.42); K.rr(c, 3, 2.5, 26, 3, 1.5);
    c.fillStyle = K.shade(col, 0.2); c.fillRect(2.5, 4.5, 3, 22);
    c.fillStyle = K.shade(col, -0.3); K.rr(c, 3, 26.5, 26, 3, 1.5);
    c.fillStyle = K.shade(col, -0.16); c.fillRect(26.5, 5, 3, 22);
    const dot = K.shade(col, -0.52), hi = K.shade(col, 0.65);
    for (const rx of [8, 24]) for (const ry of [8.5, 23.5]) {
      c.fillStyle = dot; K.circle(c, rx, ry, 2.4);
      c.fillStyle = hi; K.circle(c, rx - 0.7, ry - 0.7, 0.9);
    }
    if (v === 0) {
      c.strokeStyle = 'rgba(255,255,255,0.32)'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(12, 20); c.lineTo(20, 12); c.moveTo(15, 21); c.lineTo(19, 17); c.stroke();
    } else if (v === 1) {
      c.fillStyle = 'rgba(0,0,0,0.16)'; K.circle(c, 16, 16, 4.4);
      c.fillStyle = 'rgba(255,255,255,0.22)'; K.circle(c, 14.8, 14.6, 1.5);
    } else {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(11, 13.5, 10, 1.6); c.fillRect(11, 17.5, 10, 1.6);
    }
    c.restore();
  }

  /** Draw a piece in spawn orientation centred on cx, cy. cell(c, x, y, s, type, variant) draws one plate. */
  function drawPreview(c, type, cx, cy, s, cell) {
    const b = BOUNDS[type];
    const ox = cx - b.w * s / 2, oy = cy - b.h * s / 2;
    ROT[type][0].forEach(([x, y], i) => cell(c, ox + (x - b.x0) * s, oy + (y - b.y0) * s, s, type, i % 3));
  }
  const directCell = (c, x, y, s, type, v) => plate(c, x, y, s, SHAPES[type].color, v);

  /** Crane claw hanging from a cable, holding a piece of pw × ph pixels whose top is at hubY + 14. */
  function drawClaw(c, cx, cableTop, hubY, pw, ph, open, t) {
    c.strokeStyle = '#8b9aa6'; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cableTop); c.lineTo(cx, hubY - 8); c.stroke();
    const top = hubY + 14, grip = top + Math.min(ph, 30) * 0.62;
    const half = pw / 2 + 7 + open * 10;
    c.lineJoin = 'round';
    for (const sd of [-1, 1]) {
      c.strokeStyle = '#1b2a35'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(cx + sd * 11, hubY); c.lineTo(cx + sd * half, hubY + 9); c.lineTo(cx + sd * half, grip);
      c.lineTo(cx + sd * (half - 8 + open * 4), grip + 7); c.stroke();
      c.strokeStyle = '#8b9aa6'; c.lineWidth = 4.5; c.stroke();
    }
    c.fillStyle = '#2b4353'; K.rr(c, cx - 17, hubY - 9, 34, 18, 5);
    c.fillStyle = C.safety; K.rr(c, cx - 17, hubY - 9, 34, 5, [5, 5, 0, 0]);
    c.fillStyle = Math.sin(t * 6) > 0 ? '#ff4d4d' : '#6b2a2a'; K.circle(c, cx, hubY + 3, 3);
  }

  function panelBox(c, y, h, label) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; K.rr(c, PX - 1, y + 3, PW + 2, h + 1, 11);
    c.fillStyle = '#101c25'; K.rr(c, PX, y, PW, h, 10);
    c.strokeStyle = '#2b4353'; c.lineWidth = 2; K.rrPath(c, PX + 1, y + 1, PW - 2, h - 2, 9); c.stroke();
    if (label) K.text(c, label, PX + 12, y + 17, { size: 13, body: true, color: C.muted, align: 'left', shadow: false });
  }

  function drawBackground(c) {
    K.bgFactory(c, W, H);
    // gantry beam the crane rides on
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, 10);
    c.fillStyle = '#2b4353'; c.fillRect(0, 10, W, 18);
    c.fillStyle = '#3a566a'; c.fillRect(0, 10, W, 3);
    c.fillStyle = '#16242e'; c.fillRect(0, 28, W, 3);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = 14; x < W; x += 28) K.circle(c, x, 20, 1.8);

    // the crusher well
    const fx = WX - 10, fy = WY - 10, fw = WW + 20, fh = WH + 20;
    c.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(c, fx - 3, fy + 3, fw + 6, fh + 3, 12);
    c.fillStyle = '#39505e'; K.rr(c, fx, fy, fw, fh, 9);
    c.fillStyle = '#4a6474'; c.fillRect(fx + 3, fy + 9, 3, fh - 18);
    c.fillStyle = '#2b3f4b'; c.fillRect(fx + fw - 6, fy + 9, 3, fh - 18);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    for (let y = fy + 34; y < fy + fh - 12; y += 48) { K.circle(c, fx + 5, y, 1.8); K.circle(c, fx + fw - 5, y, 1.8); }
    c.fillStyle = '#081016'; c.fillRect(WX - 2, WY - 2, WW + 4, WH + 4);
    c.fillStyle = '#0b151c'; c.fillRect(WX, WY, WW, WH);
    c.strokeStyle = 'rgba(90,209,230,0.055)'; c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < COLS; i++) { const x = WX + i * CELL + 0.5; c.moveTo(x, WY); c.lineTo(x, WY + WH); }
    for (let j = 1; j < ROWS; j++) { const y = WY + j * CELL + 0.5; c.moveTo(WX, y); c.lineTo(WX + WW, y); }
    c.stroke();
    const g = c.createLinearGradient(0, WY, 0, WY + 90);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(WX, WY, WW, 90);
    K.hazard(c, fx + 4, fy + 1, fw - 8, 7, { stripe: 8 });

    // side panel
    panelBox(c, BOX.next[0], BOX.next[1], 'NEXT');
    panelBox(c, BOX.queue[0], BOX.queue[1], 'THEN');
    panelBox(c, BOX.hold[0], BOX.hold[1], 'HOLD');
    panelBox(c, BOX.level[0], BOX.level[1], null);
    const ly = BOX.level[0];
    K.text(c, 'LEVEL', PX + 12, ly + 17, { size: 13, body: true, color: C.muted, align: 'left', shadow: false });
    K.text(c, 'LINES', PX + 74, ly + 17, { size: 13, body: true, color: C.muted, align: 'left', shadow: false });
    K.text(c, 'NEXT LEVEL', PX + 12, ly + 80, { size: 11, body: true, color: '#4a6272', align: 'left', shadow: false });
    // conveyor rollers under the queue
    const beltY = BOX.queue[0] + BOX.queue[1] - 22;
    c.fillStyle = '#0a1117'; K.rr(c, PX + 8, beltY - 1, PW - 16, 14, 7);
    // foreman's platform
    c.fillStyle = '#16242e'; K.rr(c, PX + 10, 694, PW - 20, 18, 4);
    K.hazard(c, PX + 14, 698, PW - 28, 10, { stripe: 8 });
  }

  Arcade.register({
    id: 'scrap-stacker',
    title: 'Scrap Stacker',
    cat: 'puzzle',
    blurb: 'Stack falling scrap plates and crush full rows.',
    rules: [
      'Scrap plates drop into the crusher. Fill a whole row to crush it.',
      'Crush more rows at once for more points. Four at once is a Mega Crush.',
      'Every 10 rows the crusher speeds up. Keep the pile below the top.',
      'Hold a plate for later, and use the ghost outline to aim.'
    ],
    how: '← → move · ↑ or X turn · Z turn back · ↓ faster · Space drop · C hold · or tap, drag and swipe',
    accent: '#f5c518',
    usesPlayer: false,
    touch: [{ key: 'left' }, { key: 'right' }, { key: 'up', label: 'Turn' }, { key: 'down' }, { key: 'fire', label: 'Drop' }],

    thumb(ctx, w, h) {
      K.bgFactory(ctx, w, h);
      ctx.fillStyle = '#2b4353'; ctx.fillRect(0, 0, w, 12);
      ctx.fillStyle = '#3a566a'; ctx.fillRect(0, 0, w, 3);
      const s = 14, x0 = 96, y0 = 26, cols = 10, rows = 12;
      ctx.fillStyle = '#39505e'; K.rr(ctx, x0 - 7, y0 - 7, cols * s + 14, rows * s + 14, 6);
      ctx.fillStyle = '#0b151c'; ctx.fillRect(x0, y0, cols * s, rows * s);
      K.hazard(ctx, x0 - 5, y0 - 6, cols * s + 10, 4, { stripe: 5 });
      const map = { I: 0, O: 1, T: 2, S: 3, Z: 4, J: 5, L: 6 };
      const stack = [
        '..........', '..........', '..........', '..........', '..........', '..........',
        '.......T..', 'L.....TTT.', 'LOO.SSJJJ.', 'LOOSSZZTJ.', 'ZZTTTJLZJ.', 'SZZTJJLLL.'
      ];
      stack.forEach((row, r) => row.split('').forEach((ch, col) => {
        if (ch !== '.') plate(ctx, x0 + col * s, y0 + r * s, s, SHAPES[map[ch]].color, (r + col) % 3);
      }));
      // ghost of the I piece dropping into the gap
      ctx.fillStyle = K.alpha(SHAPES[0].color, 0.16); ctx.strokeStyle = K.alpha(SHAPES[0].color, 0.8); ctx.lineWidth = 1.5;
      for (let r = 8; r < 12; r++) { ctx.fillRect(x0 + 9 * s + 1, y0 + r * s + 1, s - 2, s - 2); ctx.strokeRect(x0 + 9 * s + 2, y0 + r * s + 2, s - 4, s - 4); }
      for (let r = 1; r < 5; r++) plate(ctx, x0 + 9 * s, y0 + r * s, s, SHAPES[0].color, r % 3);
      // crane holding the next piece
      drawClaw(ctx, 284, 12, 58, 3 * 14, 2 * 14, 0, 0.2);
      drawPreview(ctx, 3, 284, 72 + 14, 14, directCell);
      ctx.fillStyle = '#1b2a35'; K.rr(ctx, 266, 3, 36, 11, 3);
      // the foreman
      K.drawBot(ctx, 54, 140, 86, Object.assign({}, FOREMAN, { mood: 'happy', arms: 'up', t: 0.3, shadow: true }));
      K.text(ctx, 'MEGA', 284, 146, { size: 16, color: C.safety });
      K.text(ctx, 'CRUSH', 284, 166, { size: 16, color: C.safety });
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const bg = K.layer(W, H, drawBackground, 2);
      const sprites = SHAPES.map(s => [0, 1, 2].map(v => K.layer(CELL, CELL, c => plate(c, 0, 0, CELL, s.color, v), 3)));
      const dead = [0, 1, 2].map(v => K.layer(CELL, CELL, c => plate(c, 0, 0, CELL, '#5b6a74', v), 3));
      const spriteCell = (c, x, y, s, type, v) => c.drawImage(sprites[type][v], x, y, s, s);
      const fx = K.particles(), shake = K.shaker();

      const board = [], wear = [];
      for (let r = 0; r < TOTAL; r++) { board.push(new Array(COLS).fill(0)); wear.push(new Array(COLS).fill(0)); }
      let bag = [];
      const queue = [];
      let piece = null, blocked = null, hold = -1, canHold = true;
      let score = 0, lines = 0, level = 1;
      let gravT = 0, lockT = 0, resets = 0, lowest = 0;
      let dasDir = 0, dasT = 0;
      let phase = 'play', over = false;
      let clearRows = [], clearT = 0;
      let deadRow = TOTAL, deadT = 0;
      let t = 0, clawT = 0, beltT = 0, beltPhase = 0, cheerT = 0, cheer = 'happy', danger = false, holdFlash = 0;
      let msg = null, trail = null, drag = null;

      const hud = () => { api.score(score); api.stat('Level', level); api.stat('Lines', lines); };
      const addScore = n => { score += n; api.score(score); };

      function refill() {
        while (queue.length < 4) {
          if (!bag.length) bag = K.shuffle([0, 1, 2, 3, 4, 5, 6]);
          queue.push(bag.pop());
        }
      }
      function takeNext() { refill(); const type = queue.shift(); refill(); return type; }

      function fits(type, rot, x, y) {
        const cells = ROT[type][rot];
        for (let i = 0; i < 4; i++) {
          const bx = x + cells[i][0], by = y + cells[i][1];
          if (bx < 0 || bx >= COLS || by >= TOTAL) return false;
          if (by >= 0 && board[by][bx]) return false;
        }
        return true;
      }
      const grounded = () => !fits(piece.type, piece.rot, piece.x, piece.y + 1);

      function spawn(type) {
        const x = type === 1 ? 4 : 3, y = type === 0 ? HID - 1 : HID;
        piece = { type, rot: 0, x, y };
        gravT = 0; lockT = 0; resets = 0; lowest = y;
        if (!fits(type, 0, x, y)) { blocked = piece; piece = null; topOut(); }
      }
      function newPiece() { canHold = true; clawT = 1; beltT = 1; spawn(takeNext()); }

      // Lock delay: moving or turning on the ground buys time, up to MAX_RESETS times per piece.
      function settle() {
        if (piece.y > lowest) { lowest = piece.y; resets = 0; lockT = 0; }
        else if (lockT > 0 && resets < MAX_RESETS) { resets++; lockT = 0; }
      }
      function shift(dx) {
        if (!piece || phase !== 'play') return false;
        if (!fits(piece.type, piece.rot, piece.x + dx, piece.y)) return false;
        piece.x += dx; settle();
        api.tone(330, 0.025, 'square', 0.02);
        return true;
      }
      function rotate(dir) {
        if (!piece || phase !== 'play') return false;
        const from = piece.rot, to = (from + (dir > 0 ? 1 : 3)) % 4;
        const kicks = (piece.type === 0 ? KICK_I : KICK)['' + from + to];
        for (let i = 0; i < kicks.length; i++) {
          const nx = piece.x + kicks[i][0], ny = piece.y + kicks[i][1];
          if (piece.type === 1 && i > 0) break;   // the square never kicks
          if (fits(piece.type, to, nx, ny)) {
            piece.x = nx; piece.y = ny; piece.rot = to; settle();
            api.tone(dir > 0 ? 640 : 540, 0.04, 'square', 0.03, 140);
            return true;
          }
        }
        api.tone(160, 0.04, 'square', 0.02);
        return false;
      }
      function softStep() {
        if (!piece || phase !== 'play') return;
        if (fits(piece.type, piece.rot, piece.x, piece.y + 1)) { piece.y++; addScore(1); settle(); gravT = 0; }
      }
      function hardDrop() {
        if (!piece || phase !== 'play') return;
        const y0 = piece.y;
        while (fits(piece.type, piece.rot, piece.x, piece.y + 1)) piece.y++;
        const n = piece.y - y0;
        if (n > 0) { addScore(2 * n); trail = { type: piece.type, rot: piece.rot, x: piece.x, y0, y1: piece.y, t: 0.22 }; }
        shake.add(0.12);
        api.tone(150, 0.12, 'square', 0.05, -90);
        lock(true);
      }
      function holdPiece() {
        if (!piece || phase !== 'play') return;
        if (!canHold) { api.tone(190, 0.05, 'square', 0.025); return; }
        const cur = piece.type;
        canHold = false; holdFlash = 0.35;
        api.tone(480, 0.06, 'triangle', 0.05, 240);
        if (hold < 0) { hold = cur; clawT = 1; beltT = 1; spawn(takeNext()); } else { const h = hold; hold = cur; spawn(h); }
      }

      function lock(hard) {
        const cells = ROT[piece.type][piece.rot];
        let above = false;
        cells.forEach(([cx, cy], i) => {
          const bx = piece.x + cx, by = piece.y + cy;
          if (by < HID) above = true;
          if (by >= 0) { board[by][bx] = piece.type + 1; wear[by][bx] = i % 3; }
        });
        for (const [cx, cy] of cells) {
          const by = piece.y + cy;
          if (by + 1 >= TOTAL || board[by + 1][piece.x + cx]) {
            fx.burst(WX + (piece.x + cx) * CELL + CELL / 2, WY + (by - HID + 1) * CELL, ['#8b9aa6', '#56666f'], hard ? 4 : 2, hard ? 130 : 70, { lift: 40, life: 0.4, size: 2.5 });
          }
        }
        piece = null;
        if (!hard) api.tone(120, 0.08, 'square', 0.04, -40);
        const full = [];
        for (let r = 0; r < TOTAL; r++) if (board[r].every(v => v)) full.push(r);
        if (full.length) startClear(full);
        else if (above) topOut();
        else { updateDanger(); newPiece(); }
      }

      function startClear(full) {
        phase = 'clear'; clearRows = full; clearT = CLEAR_TIME;
        const n = Math.min(4, full.length);
        const pts = LINE_PTS[n] * level;
        score += pts; lines += full.length;
        msg = { text: LINE_WORD[n], sub: '+' + pts, t: 1.3, color: n >= 4 ? C.safety : n === 3 ? C.hazard : C.glow };
        for (const r of full) {
          const y = WY + (r - HID) * CELL + CELL / 2;
          for (let col = 0; col < COLS; col++) fx.burst(WX + col * CELL + CELL / 2, y, SPARKS, 3, 260, { lift: 70, life: 0.65, size: 3.5 });
        }
        api.sfx('zap');
        if (n >= 4) api.sfx('power');
        shake.add(n >= 4 ? 0.4 : 0.06 + 0.05 * n);
        cheer = n >= 4 ? 'wow' : 'happy'; cheerT = n >= 3 ? 1.6 : 1;
        const newLevel = 1 + Math.floor(lines / 10);
        if (newLevel > level) {
          level = newLevel;
          api.after(380, () => { api.sfx('levelup'); api.toast('LEVEL ' + level); });
        }
        hud();
      }
      function finishClear() {
        clearRows.slice().sort((a, b) => a - b).forEach(r => {
          board.splice(r, 1); wear.splice(r, 1);
          board.unshift(new Array(COLS).fill(0)); wear.unshift(new Array(COLS).fill(0));
        });
        clearRows = [];
        phase = 'play';
        updateDanger();
        for (let r = 0; r < HID; r++) if (board[r].some(v => v)) { topOut(); return; }
        newPiece();
      }
      function updateDanger() {
        let top = TOTAL;
        for (let r = 0; r < TOTAL; r++) if (board[r].some(v => v)) { top = r; break; }
        danger = top < HID + 5;
      }

      function topOut() {
        if (over) return;
        over = true; phase = 'over'; piece = null; cheerT = 0;
        deadRow = TOTAL; deadT = 0;
        shake.add(0.45);
        api.tone(90, 0.5, 'sawtooth', 0.05, -40);
        const detail = lines === 0
          ? 'No rows crushed this time. Fill a whole row to crush it.'
          : 'You crushed ' + lines + ' row' + (lines === 1 ? '' : 's') + ' and reached level ' + level + '.';
        api.gameOver({ score, title: 'Topped out', detail, delay: 1400 });
      }

      // ---------- input ----------
      api.onKey((name, e) => {
        if (over) return;
        const code = e.code || '';
        if (code === 'KeyZ') { if (!e.repeat) rotate(-1); return; }
        if (code === 'KeyX' || name === 'up') { if (!e.repeat) rotate(1); return; }
        if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') { if (!e.repeat) holdPiece(); return; }
        if (code === 'Space' || code === 'Pad-fire') { if (!e.repeat) hardDrop(); return; }
        if (name === 'left' || name === 'right') {
          if (e.repeat) return;
          const d = name === 'left' ? -1 : 1;
          dasDir = d; dasT = DAS;
          shift(d);
          return;
        }
        if (name === 'down' && !e.repeat) softStep();
      });

      // touch and mouse: tap to turn, drag sideways to move, drag down to soften, flick down to drop, flick up to hold
      const inHoldBox = p => p.x >= PX && p.x <= PX + PW && p.y >= BOX.hold[0] && p.y <= BOX.hold[0] + BOX.hold[1];
      api.on(cv.el, 'pointerdown', e => {
        if (over) return;
        K.capture(cv.el, e);
        const p = cv.toLocal(e);
        drag = { x0: p.x, y0: p.y, ax: p.x, ay: p.y, t0: e.timeStamp, moved: false };
      });
      api.on(cv.el, 'pointermove', e => {
        if (!drag || over) return;
        const p = cv.toLocal(e);
        if (Math.abs(p.x - drag.x0) > 14 || Math.abs(p.y - drag.y0) > 14) drag.moved = true;
        const step = CELL * 0.85;
        while (p.x - drag.ax >= step) { drag.ax += step; shift(1); }
        while (drag.ax - p.x >= step) { drag.ax -= step; shift(-1); }
        if (p.y < drag.ay) drag.ay = p.y;
        while (p.y - drag.ay >= step) { drag.ay += step; softStep(); }
      });
      api.on(cv.el, 'pointerup', e => {
        if (!drag || over) { drag = null; return; }
        const p = cv.toLocal(e);
        const dt = e.timeStamp - drag.t0, dx = p.x - drag.x0, dy = p.y - drag.y0;
        if (!drag.moved && dt < 400) { if (inHoldBox(p)) holdPiece(); else rotate(1); }
        else if (dy > 60 && dt < 320 && dy > Math.abs(dx) * 1.4) hardDrop();
        else if (dy < -60 && dt < 420 && -dy > Math.abs(dx) * 1.4) holdPiece();
        drag = null;
      });
      api.on(cv.el, 'pointercancel', () => { drag = null; });

      // ---------- update ----------
      function update(dt) {
        if (phase === 'clear') { clearT -= dt; if (clearT <= 0) finishClear(); return; }
        if (phase !== 'play' || !piece) return;
        const L = api.keys.left, R = api.keys.right;
        if (dasDir < 0 && !L) { dasDir = R ? 1 : 0; dasT = DAS; }
        else if (dasDir > 0 && !R) { dasDir = L ? -1 : 0; dasT = DAS; }
        else if (!dasDir && L !== R) { dasDir = L ? -1 : 1; dasT = DAS; }
        if (dasDir) {
          dasT -= dt;
          let guard = 4;
          while (dasT <= 0 && guard-- > 0) { if (!shift(dasDir)) { dasT = 0; break; } dasT += ARR; }
        }
        const soft = api.keys.down;
        const g = soft ? Math.min(SOFT, gravity(level)) : gravity(level);
        gravT += dt;
        while (gravT >= g) {
          gravT -= g;
          if (fits(piece.type, piece.rot, piece.x, piece.y + 1)) { piece.y++; if (soft) addScore(1); settle(); }
          else { gravT = 0; break; }
        }
        if (grounded()) { lockT += dt; if (lockT >= LOCK) lock(false); }
        else lockT = 0;
      }

      // ---------- drawing ----------
      function drawBoard() {
        for (let r = HID; r < TOTAL; r++) {
          if (phase === 'clear' && clearRows.indexOf(r) >= 0) continue;
          const row = board[r], y = WY + (r - HID) * CELL, grey = over && r >= deadRow;
          for (let col = 0; col < COLS; col++) {
            const v = row[col];
            if (v) ctx.drawImage(grey ? dead[wear[r][col]] : sprites[v - 1][wear[r][col]], WX + col * CELL, y, CELL, CELL);
          }
        }
      }
      function drawClearing() {
        const q = 1 - clearT / CLEAR_TIME;
        const sy = q < 0.45 ? 1 : Math.max(0, 1 - (q - 0.45) / 0.55);
        for (const r of clearRows) {
          if (r < HID) continue;
          const y = WY + (r - HID) * CELL, hgt = CELL * sy, top = y + (CELL - hgt) / 2;
          for (let col = 0; col < COLS; col++) {
            const v = board[r][col];
            if (v) ctx.drawImage(sprites[v - 1][wear[r][col]], WX + col * CELL, top, CELL, hgt);
          }
          const flash = q < 0.45 ? 0.5 + 0.45 * Math.sin(q * 60) : 0.9 * sy;
          ctx.fillStyle = 'rgba(255,255,236,' + flash.toFixed(3) + ')';
          ctx.fillRect(WX, top, WW, hgt);
          ctx.fillStyle = K.alpha(C.glow, 0.45 * (1 - q)); ctx.fillRect(WX, y + CELL / 2 - 6, WW, 12);
          ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - q)).toFixed(3) + ')'; ctx.fillRect(WX, y + CELL / 2 - 1.5, WW, 3);
        }
      }
      function drawGhost() {
        let gy = piece.y;
        while (fits(piece.type, piece.rot, piece.x, gy + 1)) gy++;
        if (gy === piece.y) return;
        const col = SHAPES[piece.type].color;
        ctx.fillStyle = K.alpha(col, 0.13); ctx.strokeStyle = K.alpha(col, 0.7); ctx.lineWidth = 2;
        for (const [cx, cy] of ROT[piece.type][piece.rot]) {
          const r = gy + cy;
          if (r < HID) continue;
          const x = WX + (piece.x + cx) * CELL, y = WY + (r - HID) * CELL;
          ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
          ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
        }
      }
      function drawPiece(p, tint) {
        ROT[p.type][p.rot].forEach(([cx, cy], i) => {
          const x = WX + (p.x + cx) * CELL, y = WY + (p.y + cy - HID) * CELL;
          ctx.drawImage(sprites[p.type][i % 3], x, y, CELL, CELL);
          if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, CELL, CELL); }
        });
      }
      function drawTrail() {
        const a = trail.t / 0.22, col = SHAPES[trail.type].color;
        for (const [cx, cy] of ROT[trail.type][trail.rot]) {
          const x = WX + (trail.x + cx) * CELL;
          const ya = WY + (trail.y0 + cy - HID) * CELL, yb = WY + (trail.y1 + cy - HID) * CELL;
          if (yb <= ya) continue;
          const g = ctx.createLinearGradient(0, ya, 0, yb);
          g.addColorStop(0, K.alpha(col, 0)); g.addColorStop(1, K.alpha(col, 0.4 * a));
          ctx.fillStyle = g; ctx.fillRect(x + 5, ya, CELL - 10, yb - ya);
        }
      }

      function drawPanel() {
        // crane trolley, cable, claw and the next piece
        const nt = queue[0], s = 26, b = BOUNDS[nt];
        const hubY = 92 + Math.sin(t * 2.2) * 2 - clawT * 14;
        ctx.fillStyle = '#1b2a35'; K.rr(ctx, PCX - 24, 10, 48, 16, 4);
        ctx.fillStyle = C.safety; K.rr(ctx, PCX - 24, 10, 48, 5, [4, 4, 0, 0]);
        ctx.fillStyle = C.steel; K.circle(ctx, PCX - 14, 29, 4); K.circle(ctx, PCX + 14, 29, 4);
        ctx.globalAlpha = 1 - clawT * 0.8;
        drawPreview(ctx, nt, PCX, hubY + 14 + b.h * s / 2, s, spriteCell);
        ctx.globalAlpha = 1;
        drawClaw(ctx, PCX, 30, hubY, b.w * s, b.h * s, Math.sin(clawT * Math.PI), t);

        // the queue on a conveyor belt
        const qy = BOX.queue[0], beltY = qy + BOX.queue[1] - 22;
        ctx.save();
        ctx.beginPath(); ctx.rect(PX + 4, qy + 4, PW - 8, BOX.queue[1] - 8); ctx.clip();
        ctx.fillStyle = '#1b2a35'; K.rr(ctx, PX + 10, beltY, PW - 20, 12, 6);
        ctx.fillStyle = '#39505e';
        const off = (beltPhase * 40) % 12;
        for (let x = PX + 12 - off; x < PX + PW - 12; x += 12) ctx.fillRect(x, beltY + 3, 5, 6);
        ctx.fillStyle = C.steel; K.circle(ctx, PX + 16, beltY + 6, 5); K.circle(ctx, PX + PW - 16, beltY + 6, 5);
        for (let k = 1; k <= 2; k++) {
          const type = queue[k], qs = 16, qb = BOUNDS[type];
          const cx = PX + (k === 1 ? 38 : 102) + beltT * 64;
          drawPreview(ctx, type, cx, beltY - 3 - qb.h * qs / 2, qs, spriteCell);
        }
        ctx.restore();

        // hold
        const hy = BOX.hold[0];
        if (holdFlash > 0) { ctx.fillStyle = K.alpha(C.glow, holdFlash * 0.5); K.rr(ctx, PX + 3, hy + 3, PW - 6, BOX.hold[1] - 6, 8); }
        if (hold >= 0) {
          ctx.globalAlpha = canHold ? 1 : 0.35;
          drawPreview(ctx, hold, PCX, hy + 64, 22, spriteCell);
          ctx.globalAlpha = 1;
        } else {
          K.text(ctx, 'EMPTY', PCX, hy + 64, { size: 13, body: true, color: '#3b5566', shadow: false });
        }
        const hint = api.isTouch ? 'TAP' : 'C';
        ctx.font = K.font(11, 'body');
        const kw = ctx.measureText(hint).width + 12;
        ctx.fillStyle = '#223845'; K.rr(ctx, PX + PW - 12 - kw, hy + 8, kw, 18, 4);
        K.text(ctx, hint, PX + PW - 12 - kw / 2, hy + 17.5, { size: 11, body: true, color: C.muted, shadow: false });

        // level, lines and the charge towards the next level
        const ly = BOX.level[0];
        K.text(ctx, String(level), PX + 12, ly + 50, { size: 28, color: C.safety, align: 'left' });
        K.text(ctx, String(lines), PX + 74, ly + 50, { size: 28, color: C.ink, align: 'left' });
        K.battery(ctx, PCX - 3, ly + 104, 106, 28, (lines % 10) / 10, C.good);

        // the foreman bot keeps an eye on the pile
        let mood = 'happy', arms = 'down';
        if (over) mood = 'sad';
        else if (cheerT > 0) { mood = cheer; arms = 'up'; }
        else if (danger) mood = 'wow';
        K.drawBot(ctx, PCX, 640, 100, Object.assign({}, FOREMAN, { mood, arms, t, look: -0.8, lookY: 0.2 }));
      }

      function render() {
        ctx.save();
        shake.apply(ctx, 12);
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.save();
        ctx.beginPath(); ctx.rect(WX, WY, WW, WH); ctx.clip();
        if (danger && !over) {
          const g = ctx.createLinearGradient(0, WY, 0, WY + 170);
          g.addColorStop(0, K.alpha(C.bad, 0.22 + 0.12 * Math.sin(t * 6))); g.addColorStop(1, K.alpha(C.bad, 0));
          ctx.fillStyle = g; ctx.fillRect(WX, WY, WW, 170);
        }
        drawBoard();
        if (trail) drawTrail();
        if (piece && phase === 'play') { drawGhost(); drawPiece(piece, null); }
        if (blocked) drawPiece(blocked, 'rgba(255,77,77,0.45)');
        if (phase === 'clear') drawClearing();
        ctx.restore();
        drawPanel();
        fx.draw(ctx);
        if (msg) {
          const a = Math.min(1, msg.t * 2.5), rise = (1.3 - msg.t) * 22;
          ctx.globalAlpha = a;
          K.text(ctx, msg.text, WX + WW / 2, WY + 250 - rise, { size: msg.text.length > 8 ? 30 : 36, color: msg.color });
          if (msg.sub) K.text(ctx, msg.sub, WX + WW / 2, WY + 292 - rise, { size: 24, body: true, color: C.ink });
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      refill();
      newPiece();
      hud();
      msg = { text: 'GO!', sub: '', t: 1.1, color: C.safety };

      api.loop(dt => {
        t += dt;
        clawT = Math.max(0, clawT - dt * 3.2);
        if (beltT > 0) { beltT = Math.max(0, beltT - dt * 3.5); beltPhase += dt; }
        cheerT = Math.max(0, cheerT - dt);
        holdFlash = Math.max(0, holdFlash - dt);
        if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
        if (trail) { trail.t -= dt; if (trail.t <= 0) trail = null; }
        if (!over) update(dt);
        else if (deadRow > 0) {
          deadT += dt;
          while (deadT > 0.03 && deadRow > 0) { deadT -= 0.03; deadRow--; }
        }
        fx.update(dt); shake.update(dt);
        render();
      });
    }
  });
})();
