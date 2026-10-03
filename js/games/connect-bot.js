/* Connect Bot · Connect Four against CONNECT-4X, a robot that plans with minimax and
 * alpha-beta pruning. The search runs in small slices between frames, so the robot can
 * "think" on screen without freezing the game. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;
  const W = 640, H = 748, CELL = 72, FR = 14;
  const BX = (W - 7 * CELL) / 2, BY = 270;      // top-left of the 7×6 grid of holes
  const HOVER_Y = BY - FR - 32;                  // where discs wait above the board
  const DISC_R = CELL * 0.4, HOLE_R = CELL * 0.42;
  const POINTS = { easy: 100, medium: 250, hard: 500 };
  const MIN_THINK = { easy: 0.7, medium: 0.9, hard: 1.0 };
  const CPU_BOT = { head: 'box', antenna: 'twin', base: 'treads', eye: '#ffd36b' };
  const WARM = ['#ff8a5c', '#ff5a5a', '#ff6fa8'];

  // ---------- the brain ----------
  const ORDER = [3, 2, 4, 1, 5, 0, 6];            // centre first: the best columns get searched first
  const DC = [1, 0, 1, 1], DR = [0, 1, 1, -1];
  const WIN = 100000;
  const WINDOWS = (function () {
    const out = [];
    for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) for (let d = 0; d < 4; d++) {
      const ec = c + 3 * DC[d], er = r + 3 * DR[d];
      if (ec > 6 || er < 0 || er > 5) continue;
      for (let k = 0; k < 4; k++) out.push((c + k * DC[d]) * 6 + r + k * DR[d]);
    }
    return Int8Array.from(out);
  })();
  const NW = WINDOWS.length / 4;
  const WS = [0, 1, 4, 24, 0];

  function lineAt(b, c, r, p) {           // the longest line of p through (c, r), as cell indexes
    let bestLine = null;
    for (let d = 0; d < 4; d++) {
      const line = [c * 6 + r];
      let cc = c + DC[d], rr = r + DR[d];
      while (cc >= 0 && cc < 7 && rr >= 0 && rr < 6 && b[cc * 6 + rr] === p) { line.push(cc * 6 + rr); cc += DC[d]; rr += DR[d]; }
      cc = c - DC[d]; rr = r - DR[d];
      while (cc >= 0 && cc < 7 && rr >= 0 && rr < 6 && b[cc * 6 + rr] === p) { line.unshift(cc * 6 + rr); cc -= DC[d]; rr -= DR[d]; }
      if (line.length >= 4 && (!bestLine || line.length > bestLine.length)) bestLine = line;
    }
    return bestLine;
  }
  function winsAt(b, c, r, p) {
    for (let d = 0; d < 4; d++) {
      let n = 1, cc = c + DC[d], rr = r + DR[d];
      while (cc >= 0 && cc < 7 && rr >= 0 && rr < 6 && b[cc * 6 + rr] === p) { n++; cc += DC[d]; rr += DR[d]; }
      cc = c - DC[d]; rr = r - DR[d];
      while (cc >= 0 && cc < 7 && rr >= 0 && rr < 6 && b[cc * 6 + rr] === p) { n++; cc -= DC[d]; rr -= DR[d]; }
      if (n >= 4) return true;
    }
    return false;
  }
  function canWin(b, h, c, p) {
    const r = h[c];
    if (r >= 6) return false;
    b[c * 6 + r] = p;
    const w = winsAt(b, c, r, p);
    b[c * 6 + r] = 0;
    return w;
  }
  function threats(b, h, p) {
    let n = 0;
    for (let c = 0; c < 7; c++) if (canWin(b, h, c, p)) n++;
    return n;
  }
  function evaluate(b, p) {
    const o = 3 - p;
    let s = 0;
    for (let w = 0, i = 0; w < NW; w++, i += 4) {
      let np = 0, no = 0;
      for (let k = 0; k < 4; k++) { const v = b[WINDOWS[i + k]]; if (v === p) np++; else if (v === o) no++; }
      if (!no) s += WS[np]; else if (!np) s -= WS[no];
    }
    for (let r = 0; r < 6; r++) { const v = b[18 + r]; if (v === p) s += 3; else if (v === o) s -= 3; }
    return s;
  }

  // One fixed-depth negamax search with alpha-beta, written with an explicit stack so it can
  // stop after a slice of nodes and carry on next frame.
  function Search(b, h, count, me, depth, rootMoves) {
    const D = depth + 2;
    const alpha = new Float64Array(D), beta = new Float64Array(D), best = new Float64Array(D);
    const moves = new Int8Array(D * 7), nm = new Int8Array(D), mi = new Int8Array(D), played = new Int8Array(D);
    let sp = 0, mode = 0, ret = 0, cnt = count;
    alpha[0] = -Infinity; beta[0] = Infinity;
    const self = { done: false, move: -1, value: 0, nodes: 0 };
    self.run = function (limit) {
      let n = 0;
      while (n < limit) {
        if (mode === 0) {                                   // enter the node at ply sp
          n++; self.nodes++;
          const p = sp % 2 === 0 ? me : 3 - me;
          if (cnt >= 42) { ret = 0; mode = 2; continue; }
          if (sp > 0) {
            let won = false;
            for (let k = 0; k < 7; k++) if (canWin(b, h, ORDER[k], p)) { won = true; break; }
            if (won) { ret = WIN - sp; mode = 2; continue; }   // side to move wins now; sooner is better
          }
          if (sp >= depth) { ret = evaluate(b, p); mode = 2; continue; }
          const ord = sp === 0 ? rootMoves : ORDER, base = sp * 7;
          let m = 0;
          for (let k = 0; k < ord.length; k++) if (h[ord[k]] < 6) moves[base + m++] = ord[k];
          nm[sp] = m; mi[sp] = 0; best[sp] = -Infinity;
          if (!m) { ret = 0; mode = 2; continue; }
          mode = 1;
        } else if (mode === 1) {                            // try the next move at ply sp
          if (mi[sp] >= nm[sp]) { ret = best[sp]; mode = 2; continue; }
          const c = moves[sp * 7 + mi[sp]];
          b[c * 6 + h[c]] = sp % 2 === 0 ? me : 3 - me; h[c]++; cnt++;
          played[sp] = c;
          alpha[sp + 1] = -beta[sp]; beta[sp + 1] = -alpha[sp];
          sp++; mode = 0;
        } else {                                            // hand ret back to the parent
          if (sp === 0) { self.done = true; self.value = ret; return true; }
          sp--;
          const c = played[sp];
          h[c]--; b[c * 6 + h[c]] = 0; cnt--;
          const v = -ret;
          if (v > best[sp]) { best[sp] = v; if (sp === 0) self.move = c; }
          if (v > alpha[sp]) alpha[sp] = v;
          mi[sp]++;
          if (alpha[sp] >= beta[sp]) { ret = best[sp]; mode = 2; } else mode = 1;
        }
      }
      return false;
    };
    return self;
  }

  // Picks CONNECT-4X's move. Hard deepens one ply at a time until ~400 ms of search is spent.
  function Brain(grid, heights, count, level) {
    const b = Int8Array.from(grid), h = Int8Array.from(heights);
    const me = 2, you = 1;
    const legal = ORDER.filter(c => h[c] < 6);
    const self = { done: true, move: legal[0], depth: 0, reason: 'search', step: () => true };
    for (const c of legal) if (canWin(b, h, c, me)) { self.move = c; self.reason = 'win'; return self; }
    if (level !== 'easy') {
      for (const c of legal) if (canWin(b, h, c, you)) { self.move = c; self.reason = 'block'; return self; }
    }
    if (level === 'easy' && Math.random() < 0.4) { self.move = K.pick(legal); self.reason = 'random'; return self; }
    // centre-first order, with mirror-image columns in random order so games vary
    const rootOrder = legal.slice();
    for (let i = 1; i + 1 < rootOrder.length; i += 2) {
      if (Math.abs(rootOrder[i] - 3) === Math.abs(rootOrder[i + 1] - 3) && Math.random() < 0.5) {
        const t = rootOrder[i]; rootOrder[i] = rootOrder[i + 1]; rootOrder[i + 1] = t;
      }
    }
    const left = 42 - count;
    const maxDepth = Math.min(left, level === 'easy' ? 2 : level === 'medium' ? 4 : 42);
    const minDepth = level === 'hard' ? Math.min(7, left) : maxDepth;
    const budget = level === 'hard' ? 400 : Infinity;
    let depth = level === 'hard' ? 1 : maxDepth, search = null, spent = 0;
    self.done = false;
    self.step = function (sliceMs) {
      const t0 = performance.now();
      while (!self.done && performance.now() - t0 < sliceMs) {
        if (!search) search = Search(b, h, count, me, depth, rootOrder);
        if (search.run(1200)) {
          self.move = search.move; self.value = search.value; self.depth = depth;
          const i = rootOrder.indexOf(search.move);           // search the best move first next time
          if (i > 0) { rootOrder.splice(i, 1); rootOrder.unshift(search.move); }
          search = null;
          if (depth >= maxDepth || Math.abs(self.value) > WIN - 100) self.done = true;
          else depth++;
        }
        if (!self.done && depth > minDepth && spent + performance.now() - t0 > budget) self.done = true;
      }
      spent += performance.now() - t0;
      return self.done;
    };
    return self;
  }

  // ---------- drawing ----------
  function boltPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x + 0.12 * s, y - 0.5 * s); c.lineTo(x - 0.32 * s, y + 0.08 * s); c.lineTo(x - 0.03 * s, y + 0.08 * s);
    c.lineTo(x - 0.14 * s, y + 0.5 * s); c.lineTo(x + 0.32 * s, y - 0.1 * s); c.lineTo(x + 0.03 * s, y - 0.1 * s);
    c.closePath();
  }
  function drawDisc(c, x, y, r, color, emblem) {
    c.fillStyle = K.shade(color, -0.45); K.circle(c, x, y + r * 0.07, r);
    c.fillStyle = color; K.circle(c, x, y, r * 0.97);
    c.strokeStyle = K.shade(color, -0.25); c.lineWidth = r * 0.1;
    c.beginPath(); c.arc(x, y, r * 0.7, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.42, r * 0.34, r * 0.16, -0.5, 0, Math.PI * 2); c.fill();
    if (emblem === 'bolt') {
      c.fillStyle = K.shade(color, -0.5); boltPath(c, x + r * 0.03, y + r * 0.04, r * 0.9); c.fill();
      c.fillStyle = K.shade(color, 0.55); boltPath(c, x, y, r * 0.9); c.fill();
    } else {
      K.gear(c, x, y + r * 0.03, r * 0.5, { teeth: 8, color: K.shade(color, -0.5), hole: K.shade(color, -0.1) });
      K.gear(c, x, y, r * 0.48, { teeth: 8, color: K.shade(color, 0.45), hole: color });
    }
  }
  function drawBackground(c) {
    K.bgFactory(c, W, H);
    // a steel ledge the two robots stand on
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 190, W, 9);
    c.fillStyle = '#2b4353'; c.fillRect(0, 178, W, 12);
    c.fillStyle = '#3b5a6b'; c.fillRect(0, 178, W, 3);
    K.hazard(c, 0, 190, W, 7, { stripe: 9 });
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 190, W, 7);
    // board legs and the dark panel behind the holes
    c.fillStyle = '#1b2a35';
    K.rr(c, BX - FR + 18, BY + 6 * CELL + FR - 8, 26, 30, 4);
    K.rr(c, BX + 7 * CELL + FR - 44, BY + 6 * CELL + FR - 8, 26, 30, 4);
    c.fillStyle = '#0a1117';
    K.rr(c, BX - 4, BY - 4, 7 * CELL + 8, 6 * CELL + 8, 10);
    c.fillStyle = 'rgba(90,209,230,0.04)';
    for (let i = 0; i < 7; i++) c.fillRect(BX + i * CELL + CELL / 2 - 1, BY, 2, 6 * CELL);
    for (let i = 0; i < 7; i++) K.text(c, String(i + 1), BX + i * CELL + CELL / 2, BY + 6 * CELL + FR + 16, { size: 13, body: true, color: '#6f8796', shadow: false });
  }
  function drawBoardFace(c) {
    const x = BX - FR, y = BY - FR, w = 7 * CELL + FR * 2, h = 6 * CELL + FR * 2;
    c.fillStyle = 'rgba(0,0,0,0.35)'; K.rr(c, x + 6, y + 10, w, h, 16);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#46677a'); g.addColorStop(1, '#2e4958');
    c.fillStyle = g; K.rr(c, x, y, w, h, 16);
    c.fillStyle = 'rgba(255,255,255,0.14)'; K.rr(c, x + 10, y + 4, w - 20, 3, 1.5);
    c.fillStyle = 'rgba(0,0,0,0.18)'; K.rr(c, x, y + h - 10, w, 10, [0, 0, 16, 16]);
    for (let cc = 0; cc < 7; cc++) for (let r = 0; r < 6; r++) {
      const cx = BX + cc * CELL + CELL / 2, cy = BY + r * CELL + CELL / 2;
      c.fillStyle = 'rgba(0,0,0,0.3)'; K.circle(c, cx, cy + 2, HOLE_R + 4);
      c.fillStyle = 'rgba(255,255,255,0.08)'; K.circle(c, cx, cy - 1.5, HOLE_R + 3);
    }
    c.fillStyle = 'rgba(255,255,255,0.22)';
    for (let cc = 0; cc <= 7; cc++) for (let r = 0; r <= 6; r++) {
      if ((cc === 0 || cc === 7) && (r === 0 || r === 6)) continue;
      K.circle(c, BX + cc * CELL, BY + r * CELL, 2.2);
    }
    for (const [rx, ry] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; K.circle(c, rx, ry + 1, 4);
      c.fillStyle = '#8b9aa6'; K.circle(c, rx, ry, 3.5);
    }
    c.globalCompositeOperation = 'destination-out';
    for (let cc = 0; cc < 7; cc++) for (let r = 0; r < 6; r++) K.circle(c, BX + cc * CELL + CELL / 2, BY + r * CELL + CELL / 2, HOLE_R);
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(0,0,0,0.32)'; c.lineWidth = 3;
    for (let cc = 0; cc < 7; cc++) for (let r = 0; r < 6; r++) {
      c.beginPath(); c.arc(BX + cc * CELL + CELL / 2, BY + r * CELL + CELL / 2, HOLE_R - 1.5, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    }
  }
  function bubble(c, x, y, w, h, tailX, tailY, text, color, t) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; K.rr(c, x + 3, y + 4, w, h, 12);
    c.fillStyle = '#e6eef2';
    K.rr(c, x, y, w, h, 12);
    c.beginPath(); c.moveTo(x + 14, y + h - 18); c.lineTo(tailX, tailY); c.lineTo(x + 30, y + h - 1); c.closePath(); c.fill();
    c.fillStyle = color || '#172733';
    c.font = K.font(19, 'body'); c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(text, x + 16, y + h / 2 + 1);
  }

  Arcade.register({
    id: 'connect-bot',
    title: 'Connect Bot',
    cat: 'versus',
    blurb: 'Line up four discs before the robot does.',
    rules: [
      'Drop discs into the columns. Four in a row wins: across, up or diagonal.',
      'CONNECT-4X plans ahead, so block its lines before they reach four.',
      'Win to keep the run going. You take turns going first.',
      'Easy wins score 100, Medium 250, Hard 500. A draw scores 50.'
    ],
    how: 'Click or tap a column · ← → then Space, Enter or ↓ to drop · keys 1 to 7',
    accent: '#ff5a5a',
    usesPlayer: true,
    modes: [
      { id: 'easy', label: 'Easy', note: 'Makes mistakes' },
      { id: 'medium', label: 'Medium', note: 'Plays well' },
      { id: 'hard', label: 'Hard', note: 'Thinks ahead' }
    ],
    _brain: { Brain, evaluate, canWin, winsAt },
    _live: null,   // read-only view of the running game, for automated tests

    thumb(ctx, w, h, kit, player) {
      kit.bgFactory(ctx, w, h, { floor: 186 });
      const yours = player.body, cpu = WARM.includes(player.body) ? C.safety : C.hazard;
      const cell = 20, bx = 90, by = 50;
      ctx.fillStyle = '#0a1117'; K.rr(ctx, bx - 2, by - 2, 7 * cell + 4, 6 * cell + 4, 6);
      const pos = ['.......', '.......', '...y...', '..yoo..', '.yooy..', 'yooyoy.'];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        const ch = pos[r][c];
        if (ch !== '.') drawDisc(ctx, bx + c * cell + cell / 2, by + r * cell + cell / 2, cell * 0.4, ch === 'y' ? yours : cpu, ch === 'y' ? 'bolt' : 'gear');
      }
      const fw = 7 * cell + 16, fh = 6 * cell + 16;
      const face = kit.layer(fw, fh, c => {
        const g = c.createLinearGradient(0, 0, 0, fh);
        g.addColorStop(0, '#46677a'); g.addColorStop(1, '#2e4958');
        c.fillStyle = g; K.rr(c, 0, 0, fw, fh, 9);
        c.globalCompositeOperation = 'destination-out';
        for (let r = 0; r < 6; r++) for (let cc = 0; cc < 7; cc++) K.circle(c, 8 + cc * cell + cell / 2, 8 + r * cell + cell / 2, cell * 0.42);
      }, 3);
      ctx.drawImage(face, bx - 8, by - 8, fw, fh);
      ctx.save();
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,243,160,0.5)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(bx + cell / 2, by + 5 * cell + cell / 2); ctx.lineTo(bx + 3 * cell + cell / 2, by + 2 * cell + cell / 2); ctx.stroke();
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      drawDisc(ctx, bx + 4 * cell + cell / 2, by - 22, cell * 0.4, yours, 'bolt');
      kit.drawBot(ctx, 44, 132, 88, Object.assign({}, CPU_BOT, { body: cpu, mood: 'angry', t: 0.3, shadow: true }));
      kit.drawBot(ctx, 278, 134, 84, Object.assign({}, player, { mood: 'happy', arms: 'up', t: 0.3, flip: true, shadow: true }));
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const fx = K.particles(), shake = K.shaker();
      const level = POINTS[api.mode] ? api.mode : 'medium';
      const warm = WARM.includes(api.player.body);
      const YOU = api.player.body, CPU = warm ? C.safety : C.hazard;
      const cpuBot = Object.assign({}, CPU_BOT, { body: CPU });
      const bg = K.layer(W, H, drawBackground, 2);
      const face = K.layer(W, H, drawBoardFace, 2);
      const discs = {
        1: K.layer(CELL, CELL, c => drawDisc(c, CELL / 2, CELL / 2, DISC_R, YOU, 'bolt'), 2.5),
        2: K.layer(CELL, CELL, c => drawDisc(c, CELL / 2, CELL / 2, DISC_R, CPU, 'gear'), 2.5)
      };
      const vignette = K.layer(W, H, c => K.vignette(c, W, H, 0.35));

      const grid = new Int8Array(42), heights = new Int8Array(7);
      let count = 0, phase = 'idle', hover = 3, drop = null, brain = null, winLine = null, lastCell = -1;
      let thinkT = 0, aimT = 0, aimFrom = 0, cpuX = 0, turnOwner = 1;
      let score = 0, wins = 0, draws = 0, gameNo = 0, time = 0, tickT = 0;
      let cpuMood = 'neutral', youMood = 'happy', cpuArms = 'down', youArms = 'down';
      let say = { text: '', t: 0, color: '' };
      let pointerCol = -1;

      const colX = c => BX + c * CELL + CELL / 2;
      const rowY = r => BY + (5 - r) * CELL + CELL / 2;
      function speak(text, color, noisy) {
        if (say.text === text) return;
        say = { text, t: 0, color: color || '' };
        if (noisy) api.sfx('talk');
      }
      const LINES = {
        youFirst: ['Your move, human.', 'Ready when you are.', 'Show me your best move.'],
        cpuFirst: ['I will go first this time.', 'My turn to start.'],
        think: ['Hmm', 'Calculating', 'Let me think', 'Scanning columns'],
        angry: ['Hey! I see that!', 'Not so fast!', 'Nice try!'],
        uhoh: ['Uh oh...', 'Two threats? Unfair!'],
        smug: ['Beat that!', 'Heh heh. Your move.', 'Watch out!'],
        calm: ['Your move.', 'Go on.', 'Your turn, human.'],
        blocked: ['Blocked!', 'Nope! Blocked.'],
        cpuWin: ['Four in a row! Beep boop!', 'Victory protocol engaged!'],
        youWin: ['Error... you win.', 'Does not compute!'],
        draw: ['A draw? Recalculating...']
      };

      function newGame() {
        gameNo++;
        grid.fill(0); heights.fill(0);
        count = 0; drop = null; brain = null; winLine = null; lastCell = -1;
        fx.clear();
        youMood = 'happy'; youArms = 'down'; cpuMood = 'neutral'; cpuArms = 'down';
        const youStart = gameNo % 2 === 1;
        api.stat('Wins', wins);
        if (youStart) { speak(K.pick(LINES.youFirst)); playerTurn(); }
        else {
          speak(K.pick(LINES.cpuFirst), '', true);
          phase = 'idle'; turnOwner = 2;
          api.after(700, () => { if (phase === 'idle' && gameNo) cpuTurn(); });
        }
        api.toast(youStart ? 'You go first' : 'CONNECT-4X goes first');
      }
      function playerTurn() {
        phase = 'player'; turnOwner = 1;
        if (heights[hover] >= 6) hover = ORDER.find(c => heights[c] < 6);
      }
      function cpuTurn() {
        phase = 'think'; turnOwner = 2; thinkT = 0; tickT = 0;
        cpuX = colX(hover);
        brain = Brain(grid, heights, count, level);
        const youThreats = threats(grid, heights, 1);
        if (youThreats >= 2) { cpuMood = 'wow'; speak(K.pick(LINES.uhoh), '', true); }
        else if (youThreats === 1) { cpuMood = 'angry'; speak(K.pick(LINES.angry), '', true); }
        else { cpuMood = 'neutral'; speak(K.pick(LINES.think)); }
      }
      function tryDrop(c) {
        if (phase !== 'player' || api.over || c < 0 || c > 6) return;
        hover = c;
        if (heights[c] >= 6) { api.sfx('error'); shake.add(0.12); return; }
        startDrop(c, 1, HOVER_Y);
      }
      function startDrop(c, p, fromY) {
        const r = heights[c];
        grid[c * 6 + r] = p; heights[c]++; count++;
        drop = { c, r, p, y: fromY, vy: 60, ty: rowY(r), bounces: 0 };
        phase = 'drop';
      }
      function landed() {
        const { c, r, p } = drop;
        drop = null;
        lastCell = c * 6 + r;
        const line = lineAt(grid, c, r, p);
        if (line) { gameWon(p, line); return; }
        let full = true;
        for (let k = 0; k < 7; k++) if (heights[k] < 6) full = false;
        if (full) { gameDrawn(); return; }
        if (p === 1) cpuTurn();
        else {
          const cpuThreats = threats(grid, heights, 2);
          if (brain && brain.reason === 'block') { cpuMood = 'happy'; speak(K.pick(LINES.blocked), '', true); }
          else if (cpuThreats) { cpuMood = 'happy'; speak(K.pick(LINES.smug)); }
          else { cpuMood = 'neutral'; speak(K.pick(LINES.calm)); }
          youMood = cpuThreats ? 'wow' : 'happy';
          playerTurn();
        }
      }
      function gameWon(p, line) {
        phase = 'end';
        winLine = line;
        const color = p === 1 ? YOU : CPU;
        for (const i of line) {
          const c = (i / 6) | 0, r = i % 6;
          fx.burst(colX(c), rowY(r), [color, '#fff3a0', C.ink], 14, 260, { size: 3.5, life: 0.9 });
        }
        if (p === 1) {
          wins++;
          score += POINTS[level];
          api.score(score); api.stat('Wins', wins);
          cpuMood = 'sad'; cpuArms = 'down'; youMood = 'happy'; youArms = 'up';
          speak(K.pick(LINES.youWin), '', true);
          api.sfx('power');
          fx.float('+' + POINTS[level], colX(3), BY - 10, C.safety, { size: 26, life: 1.4 });
          const nextStarts = (gameNo + 1) % 2 === 1 ? 'you go first.' : 'CONNECT-4X goes first.';
          api.after(1700, () => api.win({
            score,
            title: 'You beat CONNECT-4X!',
            detail: (wins === 1 ? 'Your first win of the run.' : 'That is ' + wins + ' wins in a row.') + ' Next game, ' + nextStarts,
            next: { label: 'Next game', run: newGame }
          }));
        } else {
          cpuMood = 'happy'; cpuArms = 'up'; youMood = 'sad'; youArms = 'down';
          speak(K.pick(LINES.cpuWin), '', true);
          api.sfx('zap');
          shake.add(0.3);
          api.after(1900, () => api.gameOver({
            score,
            title: 'CONNECT-4X wins',
            detail: wins ? 'You won ' + wins + (wins === 1 ? ' game' : ' games') + (draws ? ' and drew ' + draws : '') + ' before it connected four.'
              : 'It connected four this time. Block its lines and try again!'
          }));
        }
      }
      function gameDrawn() {
        phase = 'end';
        draws++;
        score += 50;
        api.score(score);
        cpuMood = 'wow'; youMood = 'wow';
        speak(K.pick(LINES.draw), '', true);
        api.toast('Draw! +50');
        api.sfx('blip');
        api.after(2300, () => { if (phase === 'end') newGame(); });
      }

      // ---------- input ----------
      const colFrom = p => (p.y < 150 ? -1 : Math.floor((p.x - BX) / CELL));
      api.on(cv.el, 'pointermove', e => {
        const p = cv.toLocal(e), c = colFrom(p);
        if (e.pointerType === 'mouse' || e.buttons) { if (c >= 0 && c < 7 && c !== hover) { hover = c; if (e.pointerType !== 'mouse') api.sfx('tick'); } }
        pointerCol = c;
      });
      api.on(cv.el, 'pointerdown', e => {
        const p = cv.toLocal(e), c = colFrom(p);
        K.capture(cv.el, e);
        pointerCol = c;
        if (c >= 0 && c < 7) hover = c;
      });
      api.on(cv.el, 'pointerup', e => {
        const p = cv.toLocal(e), c = colFrom(p);
        if (c >= 0 && c < 7 && c === hover) tryDrop(c);
      });
      api.onKey((name, e) => {
        if (phase !== 'player') {
          if (name === 'left' || name === 'right') hover = K.clamp(hover + (name === 'left' ? -1 : 1), 0, 6);
          return;
        }
        if (name === 'left' || name === 'right') {
          hover = K.clamp(hover + (name === 'left' ? -1 : 1), 0, 6);
          api.sfx('tick');
          return;
        }
        if (name === 'fire' || name === 'down' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          if (e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
          if (!e.repeat) tryDrop(hover);
          return;
        }
        const m = /^(?:Digit|Numpad)([1-7])$/.exec(e.code || '');
        if (m && !e.repeat) tryDrop(Number(m[1]) - 1);
      });

      // ---------- update ----------
      function update(dt) {
        if (phase === 'drop' && drop) {
          drop.vy += 3200 * dt;
          drop.y += drop.vy * dt;
          if (drop.y >= drop.ty) {
            drop.y = drop.ty;
            if (drop.bounces === 0) {
              api.tone(200 + drop.r * 45, 0.09, 'square', 0.05);
              api.tone(120, 0.06, 'triangle', 0.05);
              fx.burst(colX(drop.c), drop.ty + DISC_R * 0.8, ['#8b9aa6', '#c9d4db'], 6, 90, { size: 2.5, life: 0.35, lift: 40 });
            }
            if (drop.vy < 260 || drop.bounces >= 2) landed();
            else { drop.vy = -drop.vy * 0.28; drop.bounces++; }
          }
        } else if (phase === 'think') {
          thinkT += dt;
          if (!brain.done) brain.step(8);
          const sweep = Math.sin(thinkT * 2.6);
          cpuX = K.lerp(cpuX, colX(3) + sweep * CELL * 2.6, Math.min(1, dt * 5));
          tickT -= dt;
          if (tickT <= 0) { tickT = 0.22; api.tone(900 + Math.random() * 500, 0.03, 'square', 0.018); }
          if (brain.done && thinkT >= MIN_THINK[level]) { phase = 'aim'; aimT = 0; aimFrom = cpuX; }
        } else if (phase === 'aim') {
          aimT += dt;
          const k = Math.min(1, aimT / 0.32);
          cpuX = K.lerp(aimFrom, colX(brain.move), 1 - Math.pow(1 - k, 3));
          if (k >= 1) { api.tone(520, 0.05, 'square', 0.03); startDrop(brain.move, 2, HOVER_Y); }
        }
      }

      // ---------- render ----------
      function drawWaitingDisc(x, p, alpha) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(discs[p], x - CELL / 2, HOVER_Y - CELL / 2, CELL, CELL);
        ctx.globalAlpha = 1;
      }
      function render() {
        ctx.save();
        shake.apply(ctx, 9);
        ctx.drawImage(bg, 0, 0, W, H);
        // discs sit behind the board face and show through the holes
        for (let c = 0; c < 7; c++) for (let r = 0; r < heights[c]; r++) {
          if (drop && drop.c === c && drop.r === r) continue;
          const p = grid[c * 6 + r];
          ctx.drawImage(discs[p], colX(c) - CELL / 2, rowY(r) - CELL / 2, CELL, CELL);
        }
        if (drop) ctx.drawImage(discs[drop.p], colX(drop.c) - CELL / 2, drop.y - CELL / 2, CELL, CELL);
        ctx.drawImage(face, 0, 0, W, H);
        // hover column and the disc waiting to drop
        if (phase === 'player') {
          const full = heights[hover] >= 6;
          ctx.fillStyle = full ? 'rgba(255,77,77,0.08)' : 'rgba(255,255,255,0.07)';
          K.rr(ctx, colX(hover) - CELL / 2 + 3, BY - 6, CELL - 6, 6 * CELL + 12, 12);
          const bob = Math.sin(time * 5) * 3;
          ctx.save(); ctx.translate(0, bob);
          drawWaitingDisc(colX(hover), 1, full ? 0.4 : 0.95);
          ctx.restore();
          if (!full) {
            const ty = rowY(heights[hover]);
            ctx.strokeStyle = K.alpha(YOU, 0.55 + Math.sin(time * 6) * 0.25); ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
            ctx.beginPath(); ctx.arc(colX(hover), ty, DISC_R - 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          }
        } else if (phase === 'think' || phase === 'aim') {
          drawWaitingDisc(cpuX, 2, 0.95);
        }
        // the last disc played gets a brief ring
        if (lastCell >= 0 && !winLine && phase === 'player') {
          const c = (lastCell / 6) | 0, r = lastCell % 6;
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.sin(time * 4) * 0.15) + ')'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(colX(c), rowY(r), DISC_R + 1, 0, Math.PI * 2); ctx.stroke();
        }
        if (winLine) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 7);
          const a = winLine[0], b = winLine[winLine.length - 1];
          ctx.save();
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,243,160,' + (0.35 + pulse * 0.3) + ')'; ctx.lineWidth = 16;
          ctx.beginPath(); ctx.moveTo(colX((a / 6) | 0), rowY(a % 6)); ctx.lineTo(colX((b / 6) | 0), rowY(b % 6)); ctx.stroke();
          ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 4;
          ctx.stroke();
          for (const i of winLine) {
            ctx.strokeStyle = C.safety; ctx.lineWidth = 4 + pulse * 3;
            ctx.beginPath(); ctx.arc(colX((i / 6) | 0), rowY(i % 6), DISC_R + 3 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
        }
        fx.draw(ctx);
        drawRobots();
        ctx.restore();
        ctx.drawImage(vignette, 0, 0, W, H);
      }
      function plate(x, y, w, name, color, active, label) {
        const glow = active ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
        ctx.fillStyle = active ? 'rgba(245,197,24,' + (0.1 + glow * 0.1) + ')' : 'rgba(11,20,27,0.78)';
        K.rr(ctx, x - w / 2, y - 16, w, 32, 9);
        ctx.strokeStyle = active ? C.safety : '#2b4353'; ctx.lineWidth = 2;
        K.rrPath(ctx, x - w / 2 + 1, y - 15, w - 2, 30, 8); ctx.stroke();
        drawDisc(ctx, x - w / 2 + 18, y, 10, color, color === YOU ? 'bolt' : 'gear');
        K.text(ctx, name, x - w / 2 + 34, y + 1, { size: 15, body: true, color: C.ink, align: 'left', shadow: false });
        if (label) K.text(ctx, label, x, y + 27, { size: 13, color: active ? C.safety : C.muted, shadow: false });
      }
      function drawRobots() {
        const thinking = phase === 'think' || phase === 'aim';
        const look = thinking ? Math.sin(time * 7) : phase === 'player' ? (colX(hover) - 84) / 260 : 0.5;
        K.drawBot(ctx, 84, 116, 124, Object.assign({}, cpuBot, {
          t: time, mood: cpuMood, arms: cpuArms === 'up' ? (Math.sin(time * 6) > 0 ? 'up' : 'wave') : cpuArms,
          look, lookY: thinking ? -0.4 : 0.6, shadow: true
        }));
        if (thinking) {
          K.gear(ctx, 40, 50, 12, { teeth: 8, color: C.gold, rot: time * 4, hole: '#132330' });
          K.gear(ctx, 27, 67, 8, { teeth: 6, color: C.steel, rot: -time * 6, hole: '#132330' });
        }
        K.drawBot(ctx, 556, 126, 104, Object.assign({}, api.player, {
          t: time, mood: youMood, arms: youArms === 'up' ? (Math.sin(time * 6) > 0 ? 'up' : 'wave') : 'down',
          look: phase === 'player' ? (colX(hover) - 556) / 260 : -0.6, lookY: 0.5, flip: true, shadow: true
        }));
        const cpuActive = turnOwner === 2 && phase !== 'end', youActive = phase === 'player';
        plate(235, 138, 152, 'CONNECT-4X', CPU, cpuActive, thinking ? 'THINKING' : '');
        plate(405, 138, 152, (api.player.name || 'YOU').slice(0, 10), YOU, youActive, youActive ? 'YOUR TURN' : '');
        if (say.text) {
          let text = say.text;
          if (thinking && LINES.think.includes(text)) text += '.'.repeat(1 + Math.floor(time * 3) % 3);
          ctx.font = K.font(19, 'body');
          const tw = Math.min(300, ctx.measureText(say.text + '...').width) + 32;
          const a = Math.min(1, say.t * 6), s = 0.85 + 0.15 * a;
          ctx.save(); ctx.globalAlpha = a;
          ctx.translate(150, 74); ctx.scale(s, s); ctx.translate(-150, -74);
          bubble(ctx, 150, 26, tw, 48, 124, 84, text, cpuMood === 'angry' ? '#b8321a' : '#172733');
          ctx.restore();
        }
      }

      Arcade.byId['connect-bot']._live = { get phase() { return phase; }, grid, heights, get count() { return count; }, get gameNo() { return gameNo; } };
      api.loop(dt => {
        time += dt;
        say.t += dt;
        update(dt);
        fx.update(dt); shake.update(dt);
        render();
      });
      api.score(0);
      newGame();
    }
  });
})();
