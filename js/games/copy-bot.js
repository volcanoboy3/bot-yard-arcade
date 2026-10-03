/* Copy Bot: a Simon-style memory game.
 * A big friendly robot plays a tune on the four buttons on its chest. Copy it back.
 * Every round adds one step and the tune gets a little faster. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;
  const W = 600, H = 720, OY = 30;                // the robot is drawn OY lower than its own coordinates
  const CX = 300, CY = 452;                       // centre of the chest dial (robot coordinates)
  const R_IN = 62, R_OUT = 170, OFF = 8, CR = 9;  // wedge radii, gap offset, corner radius
  const COLS = [C.good, C.bad, C.safety, C.glow]; // up, right, down, left
  const NAMES = ['green', 'red', 'yellow', 'blue'];
  const NOTES = [659.25, 554.37, 440, 329.63];    // E5, C#5, A4, E4: an A major chord
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const BODY = '#c3ced6', EYE = '#bff6ff';
  const PRAISE = ['NICE!', 'GREAT!', 'SUPER!', 'PERFECT!', 'AWESOME!'];

  const midAngle = i => -Math.PI / 2 + i * Math.PI / 2;
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const DIM = COLS.map(c => rgb(K.shade(c, -0.38))), BRIGHT = COLS.map(c => rgb(K.shade(c, 0.22)));
  function mixCol(i, t) {
    const a = DIM[i], b = BRIGHT[i];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  // ---------- the static scene ----------
  const FLOOR = 662 + OY;
  function drawWall(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 2;
    for (let x = 60; x < W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, FLOOR); c.stroke(); }
    for (let y = 60; y < FLOOR; y += 120) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 60; x < W; x += 80) for (let y = 60; y < FLOOR; y += 120) { K.circle(c, x + 6, y + 6, 2); K.circle(c, x + 74, y + 6, 2); }
    // spotlight behind the robot
    const sp = c.createRadialGradient(CX, 380 + OY, 40, CX, 400 + OY, 360);
    sp.addColorStop(0, 'rgba(124,240,138,0.10)'); sp.addColorStop(1, 'rgba(124,240,138,0)');
    c.fillStyle = sp; c.fillRect(0, 0, W, H);
    // floor
    c.fillStyle = '#0d171e'; c.fillRect(0, FLOOR, W, H - FLOOR);
    c.fillStyle = '#2b4353'; c.fillRect(0, FLOOR, W, 4);
    K.hazard(c, 0, FLOOR + 10, W, 12, { stripe: 12 });
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, FLOOR + 10, W, 12);
  }
  /** The robot's parts that never move, in robot coordinates. */
  function drawBodyStatic(c) {
    // shadow + treads
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(CX, 668, 210, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.dark; K.rr(c, 126, 620, 348, 50, 24);
    c.fillStyle = C.steelDark; K.rr(c, 136, 628, 328, 34, 17);
    for (const x of [166, 232, 300, 368, 434]) { c.fillStyle = C.steel; K.circle(c, x, 645, 12); c.fillStyle = C.dark; K.circle(c, x, 645, 4.5); }
    c.fillStyle = 'rgba(255,255,255,0.14)';
    for (let x = 140; x < 460; x += 14) { c.fillRect(x, 621, 6, 3); c.fillRect(x, 666, 6, 3); }
    // neck
    c.fillStyle = C.steel; K.rr(c, 270, 222, 60, 34, 8);
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 230; y < 254; y += 7) c.fillRect(270, y, 60, 2.5);
    // torso
    c.fillStyle = BODY; K.rr(c, 86, 246, 428, 396, 46);
    c.fillStyle = 'rgba(0,0,0,0.16)'; K.rr(c, 86, 560, 428, 82, [0, 0, 46, 46]);
    c.fillStyle = 'rgba(255,255,255,0.35)'; K.rr(c, 120, 254, 360, 7, 4);
    for (const [x, y] of [[112, 272], [488, 272], [112, 614], [488, 614]]) {
      c.fillStyle = 'rgba(0,0,0,0.25)'; K.circle(c, x + 1, y + 1.5, 5);
      c.fillStyle = '#e6eef2'; K.circle(c, x, y, 5);
    }
    // dial bezel
    c.fillStyle = 'rgba(0,0,0,0.25)'; K.circle(c, CX + 3, CY + 5, 190);
    c.fillStyle = '#56707f'; K.circle(c, CX, CY, 190);
    c.fillStyle = '#0f1a23'; K.circle(c, CX, CY, 180);
    K.ring(c, CX, CY, 186, 2, 'rgba(255,255,255,0.25)');
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + Math.PI / 12;
      c.fillStyle = '#2b4353'; K.circle(c, CX + Math.cos(a) * 185, CY + Math.sin(a) * 185, 2.4);
    }
  }

  function wedgePath(c, i, rIn, rOut, off) {
    const mid = midAngle(i), a0 = mid - Math.PI / 4, a1 = mid + Math.PI / 4;
    const ox = CX + Math.cos(mid) * off, oy = CY + Math.sin(mid) * off;
    c.beginPath();
    c.arc(ox, oy, rOut, a0, a1);
    c.arc(ox, oy, rIn, a1, a0, true);
    c.closePath();
  }

  /** One chest button. lit 0..1 (robot or player lighting it), press 0..1 (sink). */
  function drawWedge(c, i, lit, press, showKeys) {
    const col = COLS[i];
    const off = OFF + CR * 1.4 - press * 3, rIn = R_IN + CR, rOut = R_OUT - CR * 1.5 - press * 3;
    c.save();
    c.lineJoin = 'round';
    if (lit > 0.01) {
      wedgePath(c, i, rIn, rOut, off);
      c.strokeStyle = K.alpha(col, 0.3 * lit); c.lineWidth = CR * 2 + 22; c.stroke();
    }
    wedgePath(c, i, rIn, rOut, off);
    const fill = mixCol(i, Math.min(1, lit));
    c.fillStyle = fill; c.strokeStyle = fill; c.lineWidth = CR * 2;
    c.fill(); c.stroke();
    // shine along the outer edge
    const mid = midAngle(i);
    c.strokeStyle = 'rgba(255,255,255,' + (0.16 + lit * 0.3).toFixed(3) + ')'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.arc(CX + Math.cos(mid) * off, CY + Math.sin(mid) * off, rOut - 4, mid - 0.45, mid + 0.25); c.stroke();
    // key label: an arrow chevron and the number key
    const ink = lit > 0.5 ? 'rgba(15,26,35,0.8)' : 'rgba(255,255,255,0.85)';
    const ax = CX + Math.cos(mid) * 140, ay = CY + Math.sin(mid) * 140;
    c.save(); c.translate(ax, ay); c.rotate(mid);
    c.fillStyle = ink;
    c.beginPath(); c.moveTo(11, 0); c.lineTo(-6, -12); c.lineTo(-6, 12); c.closePath(); c.fill();
    c.restore();
    if (showKeys) {
      const nx = CX + Math.cos(mid) * 102, ny = CY + Math.sin(mid) * 102;
      c.font = K.font(26, 'body'); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = ink; c.fillText(String(i + 1), nx, ny + 1);
    }
    c.restore();
  }

  function drawArm(c, sx, sy, ang) {
    c.save(); c.translate(sx, sy); c.rotate(ang);
    c.fillStyle = C.steel; K.rr(c, -10, 0, 20, 96, 10);
    c.fillStyle = 'rgba(0,0,0,0.16)'; K.rr(c, 3, 2, 7, 92, 4);
    c.fillStyle = C.steelDark; K.rr(c, -12, 44, 24, 11, 5);
    c.translate(0, 96);
    c.strokeStyle = C.steel; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-6, 6); c.lineTo(-13, 24); c.moveTo(6, 6); c.lineTo(13, 24); c.stroke();
    c.fillStyle = BODY; K.circle(c, 0, 0, 14);
    c.fillStyle = 'rgba(255,255,255,0.4)'; K.circle(c, -4, -4, 4);
    c.restore();
    c.fillStyle = BODY; K.circle(c, sx, sy, 21);
    c.fillStyle = 'rgba(0,0,0,0.15)'; K.circle(c, sx, sy + 4, 14);
    c.fillStyle = C.steel; K.circle(c, sx, sy, 7);
  }

  function drawEye(c, x, y, r, st, side) {
    c.fillStyle = K.alpha(EYE, 0.16); K.circle(c, x, y, r + 7);
    if (st.mood === 'happy') {
      c.strokeStyle = EYE; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y + 9, r * 0.72, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      return;
    }
    if (st.blink) { c.fillStyle = EYE; K.rr(c, x - r, y - 2.5, r * 2, 5, 2.5); return; }
    c.fillStyle = EYE; K.circle(c, x, y, r);
    const px = x + st.lookX * r * 0.42, py = y + st.lookY * r * 0.42;
    c.fillStyle = '#10202b'; K.circle(c, px, py, r * 0.46);
    c.fillStyle = 'rgba(255,255,255,0.85)'; K.circle(c, px - r * 0.16, py - r * 0.16, r * 0.14);
    if (st.mood === 'sad') {
      const inner = -side, d = r + 4;
      c.fillStyle = C.dark;
      c.beginPath();
      c.moveTo(x - inner * d, y - d); c.lineTo(x + inner * d, y - d);
      c.lineTo(x + inner * d, y - r * 0.85); c.lineTo(x - inner * d, y + r * 0.1);
      c.closePath(); c.fill();
    }
  }

  function drawHead(c, st) {
    c.save();
    c.translate(CX, 232 + st.headY); c.rotate(st.tilt); c.translate(-CX, -232);
    // twin antennas at the corners keep the middle free for the status line
    c.strokeStyle = C.steel; c.lineWidth = 6; c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(CX + s * 98, 112); c.lineTo(CX + s * 120, 80); c.stroke();
      const bx = CX + s * 123, by = 74;
      const col = st.ant || '#ff4d4d';
      if (st.antGlow > 0.02) { c.fillStyle = K.alpha(col, 0.28 * st.antGlow); K.circle(c, bx, by, 24); }
      c.fillStyle = col; K.circle(c, bx, by, 12);
      c.fillStyle = 'rgba(255,255,255,0.55)'; K.circle(c, bx - 4, by - 4, 3.5);
    }
    // ears
    for (const s of [-1, 1]) {
      c.fillStyle = C.steelDark; K.rr(c, CX + s * 128 - 11, 146, 22, 44, 9);
      c.fillStyle = C.steel; K.circle(c, CX + s * 134, 168, 7);
    }
    c.fillStyle = BODY; K.rr(c, CX - 125, 104, 250, 128, 34);
    c.fillStyle = 'rgba(255,255,255,0.35)'; K.rr(c, CX - 95, 110, 190, 6, 3);
    c.fillStyle = 'rgba(0,0,0,0.12)'; K.rr(c, CX - 125, 204, 250, 28, [0, 0, 34, 34]);
    // visor
    c.fillStyle = C.dark; K.rr(c, CX - 104, 124, 208, 74, 26);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.moveTo(CX - 80, 126); c.lineTo(CX - 40, 126); c.lineTo(CX - 76, 196); c.lineTo(CX - 100, 196); c.closePath(); c.fill();
    drawEye(c, CX - 46, 161, 25, st, -1);
    drawEye(c, CX + 46, 161, 25, st, 1);
    // cheeks
    if (st.mood === 'happy') { c.fillStyle = 'rgba(255,111,168,0.45)'; K.circle(c, CX - 84, 212, 9); K.circle(c, CX + 84, 212, 9); }
    // mouth
    c.strokeStyle = C.dark; c.fillStyle = C.dark; c.lineWidth = 6; c.lineCap = 'round';
    const my = 216;
    if (st.sing > 0.05) {
      c.beginPath(); c.ellipse(CX, my, 10 + st.sing * 4, 3 + st.sing * 8, 0, 0, Math.PI * 2); c.fill();
    } else if (st.mood === 'happy') {
      c.beginPath(); c.arc(CX, my - 12, 20, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    } else if (st.mood === 'sad') {
      c.beginPath(); c.arc(CX, my + 14, 16, 1.25 * Math.PI, 1.75 * Math.PI); c.stroke();
    } else {
      c.beginPath(); c.arc(CX, my - 8, 14, 0.3 * Math.PI, 0.7 * Math.PI); c.stroke();
    }
    c.restore();
  }

  function drawHub(c, st) {
    c.fillStyle = '#56707f'; K.circle(c, CX, CY, 54);
    c.fillStyle = '#0f1a23'; K.circle(c, CX, CY, 49);
    const n = st.segs ? st.segs.length : 0;
    if (n) {
      const step = Math.PI * 2 / n, gap = Math.min(0.09, step * 0.18);
      c.lineWidth = 6; c.lineCap = 'butt';
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + i * step + gap, a1 = a0 + step - gap * 2;
        c.strokeStyle = st.segs[i] >= 0 ? COLS[st.segs[i]] : '#26394a';
        c.beginPath(); c.arc(CX, CY, 41, a0, a1); c.stroke();
      }
    }
    K.text(c, String(st.round), CX, CY + 2, { size: st.round > 99 ? 24 : 32, color: st.hubCol || C.ink });
  }

  function drawRobot(c, st) {
    drawArm(c, 86, 300, st.armL);
    drawArm(c, 514, 300, st.armR);
    for (let i = 0; i < 4; i++) drawWedge(c, i, st.lit[i], st.press[i], st.keys);
    drawHub(c, st);
    drawHead(c, st);
  }

  Arcade.register({
    id: 'copy-bot',
    title: 'Copy Bot',
    cat: 'brain',
    blurb: 'Watch the robot play a tune of lights, then copy it.',
    rules: [
      'The robot lights up its buttons in order. Press them back in the same order.',
      'Each round adds one more step, and the tune gets faster.',
      'One wrong button ends the game. Your score is your longest copy.'
    ],
    how: 'Tap or click the buttons · keys 1 to 4 or the arrow keys',
    accent: '#7cf08a',
    usesPlayer: false,

    thumb(ctx, w, h) {
      ctx.save();
      const s = 0.44;
      ctx.translate(w / 2 - CX * s, -30);
      ctx.scale(s, s);
      drawWall(ctx);
      ctx.translate(0, OY);
      drawBodyStatic(ctx);
      drawRobot(ctx, {
        armL: 2.4, armR: -0.3, lit: [1, 0, 0, 0], press: [0, 0, 0, 0], keys: true,
        mood: 'neutral', lookX: 0, lookY: -1, blink: false, headY: 0, tilt: 0, sing: 0.8,
        ant: C.good, antGlow: 1, round: 6, segs: [0, 3, 1, 2, 0, -1], hubCol: C.ink
      });
      ctx.restore();
      // music notes drifting from the lit button
      const note = (x, y, col, sc) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(6, -24); ctx.lineTo(16, -18); ctx.stroke();
        ctx.restore();
      };
      note(42, 70, C.good, 1.1); note(270, 60, C.safety, 1); note(282, 150, C.glow, 0.9); note(40, 160, C.bad, 0.9);
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const bg = K.layer(W, H, c => { drawWall(c); c.translate(0, OY); drawBodyStatic(c); }, Math.min(2.5, Math.max(1.5, cv.k || 2)));
      const fx = K.particles(), shake = K.shaker();
      const showKeys = !api.isTouch;
      const best0 = api.best || 0;
      const S = {
        t: 0, phase: 'intro', timer: 1.1, seq: [], idx: 0, step: 0, lightOn: false,
        longest: 0, round: 0, onT: 0.5, gapT: 0.16,
        status: 'ROUND 1', statusCol: C.safety, sub: 'Watch the robot, then copy it', pop: 1,
        failAt: -1, record: false,
        lookX: 0, lookY: 0.2, lookTX: 0, lookTY: 0.2, lookHold: 0, nextGlance: 2,
        blinkT: 3, headY: 0, headTY: 0, tilt: 0, armL: 0.28, armR: -0.28, beat: 0,
        mood: 'neutral', sing: 0, ant: '#ff4d4d', antGlow: 0,
        pressT: [0, 0, 0, 0], waitT: 0, waitSub: ''
      };
      const lit = [0, 0, 0, 0], press = [0, 0, 0, 0];
      const segs = [];
      const st = { lit, press, keys: showKeys, segs };
      api.stat('Round', 1);
      api.score(0);

      function setStatus(text, col, sub) {
        if (text !== S.status) S.pop = 0;
        S.status = text; S.statusCol = col; S.sub = sub || '';
      }
      function playNote(i, dur) {
        api.tone(NOTES[i], dur, 'triangle', 0.07);
        api.tone(NOTES[i] * 2, dur * 0.7, 'square', 0.012);
      }
      function lookAt(i, hold) {
        S.lookTX = DIRS[i][0]; S.lookTY = DIRS[i][1]; S.lookHold = hold;
      }
      function sparkle(i, n, power) {
        const m = midAngle(i);
        fx.burst(CX + Math.cos(m) * 118, CY + Math.sin(m) * 118, [COLS[i], '#ffffff'], n, power, { gravity: 240, size: 4, life: 0.6, lift: 20 });
      }

      function nextRound() {
        let n = K.randi(0, 3);
        const L = S.seq.length;
        if (L >= 2 && S.seq[L - 1] === n && S.seq[L - 2] === n) n = (n + K.randi(1, 3)) % 4;   // never three of a kind in a row
        S.seq.push(n);
        S.round = S.seq.length;
        S.onT = Math.max(0.2, 0.52 * Math.pow(0.935, S.round - 1));
        S.gapT = Math.max(0.09, 0.17 * Math.pow(0.95, S.round - 1));
        segs.length = 0;
        for (let i = 0; i < S.round; i++) segs.push(-1);
        api.stat('Round', S.round);
        S.phase = 'intro'; S.timer = S.round === 1 ? 1.1 : 0.55;
        if (S.round > 1) setStatus('ROUND ' + S.round, C.safety, 'Now ' + S.round + ' steps');
        if (S.round === 5 || S.round === 9 || S.round === 13 || S.round === 17) api.toast('Speeding up!');
      }

      function press_(i) {
        if (api.over) return;
        if (S.phase === 'watch' || S.phase === 'intro') {
          if (S.sub !== 'Wait for your turn') { S.waitSub = S.sub; S.sub = 'Wait for your turn'; S.waitT = 0.9; api.tone(300, 0.05, 'triangle', 0.03); }
          return;
        }
        if (S.phase !== 'input') return;
        press[i] = 1; lit[i] = 1;
        S.pressT[i] = 0.22;
        lookAt(i, 0.35);
        const want = S.seq[S.idx];
        if (i !== want) { fail(i, want); return; }
        playNote(i, 0.28);
        sparkle(i, 8, 160);
        segs[S.idx] = i;
        S.idx++;
        S.beat = 1;
        if (S.idx >= S.seq.length) success();
        else setStatus('YOUR TURN', C.good, 'Step ' + (S.idx + 1) + ' of ' + S.seq.length);
      }

      function success() {
        S.longest = S.seq.length;
        api.score(S.longest);
        S.phase = 'success'; S.timer = 1.15;
        S.mood = 'happy';
        setStatus(PRAISE[Math.min(PRAISE.length - 1, Math.floor(Math.random() * (2 + S.longest / 4)))], C.good, 'You copied ' + S.longest + (S.longest === 1 ? ' step' : ' steps'));
        [329.63, 440, 554.37, 659.25, 880].forEach((f, k) => api.tone(f, 0.12, 'square', 0.035, 0, 0.3 + k * 0.06));
        api.after(320, () => {
          for (let i = 0; i < 4; i++) sparkle(i, 10, 260);
          fx.burst(CX + 123, 74, [C.good, '#ffffff'], 10, 180, { gravity: 200 });
          fx.burst(CX - 123, 74, [C.good, '#ffffff'], 10, 180, { gravity: 200 });
        });
        if (!S.record && best0 > 0 && S.longest > best0) { S.record = true; api.toast('New record!', { color: C.good }); }
        else if (S.longest === 10 || S.longest === 15 || S.longest === 20) api.toast(S.longest + ' in a row!');
      }

      function fail(i, want) {
        S.phase = 'fail'; S.timer = 1.7; S.failAt = want;
        S.mood = 'sad'; S.headTY = 12;
        shake.add(0.45);
        api.tone(98, 0.55, 'sawtooth', 0.06, -30);
        api.sfx('error');
        fx.burst(CX, 150, ['#ff6b3d', '#ffd36b', '#ffffff'], 18, 260, { gravity: 500 });
        const m = midAngle(i);
        fx.burst(CX + Math.cos(m) * 118, CY + Math.sin(m) * 118, ['#ff6b3d', '#3a3f44'], 14, 220);
        setStatus('OOPS!', C.hazard, 'It was the ' + NAMES[want] + ' button');
      }

      function finishGame() {
        const n = S.longest;
        const title = n === 0 ? 'Missed the first one' : n <= 3 ? 'Warming up' : n <= 6 ? 'Good copying!' : n <= 10 ? 'Great memory!' : n <= 15 ? 'Super memory!' : 'Copy champion!';
        const detail = n === 0
          ? 'The first light was the ' + NAMES[S.failAt] + ' button. Watch it, then press the same one.'
          : 'You copied a ' + n + '-step tune, then slipped on round ' + (n + 1) + '.';
        api.gameOver({ score: n, scoreLabel: 'Longest copy', title, detail, delay: 500 });
      }

      // ---------- input ----------
      function wedgeAt(p) {
        const dx = p.x - CX, dy = p.y - OY - CY, r = Math.hypot(dx, dy);
        if (r < R_IN - 4 || r > R_OUT + 28) return -1;
        const a = Math.atan2(dy, dx), q = Math.PI / 4;
        if (a >= -3 * q && a < -q) return 0;
        if (a >= -q && a < q) return 1;
        if (a >= q && a < 3 * q) return 2;
        return 3;
      }
      api.on(cv.el, 'pointerdown', e => {
        const i = wedgeAt(cv.toLocal(e));
        if (i >= 0) press_(i);
      });
      api.on(cv.el, 'pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        cv.el.style.cursor = wedgeAt(cv.toLocal(e)) >= 0 && S.phase === 'input' ? 'pointer' : 'default';
      });
      const DIR_KEYS = { up: 0, right: 1, down: 2, left: 3 };
      const NUM_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
      api.onKey((name, e) => {
        if (e.repeat) return;
        const i = name in DIR_KEYS ? DIR_KEYS[name] : NUM_KEYS[e.code];
        if (i == null) return;
        press_(i);
      });

      // ---------- update ----------
      function update(dt) {
        S.pop = Math.min(1, S.pop + dt * 5);
        if (S.waitT > 0) { S.waitT -= dt; if (S.waitT <= 0 && S.sub === 'Wait for your turn') S.sub = S.waitSub || ''; }
        for (let i = 0; i < 4; i++) {
          if (S.pressT[i] > 0) S.pressT[i] -= dt;
          else press[i] = Math.max(0, press[i] - dt * 8);
        }
        switch (S.phase) {
          case 'intro':
            S.timer -= dt;
            if (S.timer <= 0) {
              S.phase = 'watch'; S.step = 0; S.lightOn = false; S.timer = 0.25;
              S.mood = 'neutral'; S.headTY = 0;
              setStatus('WATCH…', C.glow, 'Remember the lights');
            }
            break;
          case 'watch':
            S.timer -= dt;
            if (S.timer <= 0) {
              if (S.lightOn) {
                S.lightOn = false; S.step++;
                if (S.step >= S.seq.length) {
                  S.phase = 'input'; S.idx = 0;
                  for (let i = 0; i < segs.length; i++) segs[i] = -1;
                  S.lookTX = 0; S.lookTY = 0.25;
                  setStatus('YOUR TURN', C.good, 'Step 1 of ' + S.seq.length);
                  api.tone(880, 0.05, 'square', 0.03);
                } else S.timer = S.gapT;
              } else {
                const b = S.seq[S.step];
                S.lightOn = true; S.timer = S.onT;
                lit[b] = 1;
                segs[S.step] = b;
                playNote(b, S.onT + 0.08);
                lookAt(b, S.onT + S.gapT);
                S.ant = COLS[b]; S.antGlow = 1; S.sing = 1; S.beat = 1;
                sparkle(b, 6, 120);
              }
            }
            break;
          case 'success':
            S.timer -= dt;
            if (S.timer <= 0) { S.mood = 'neutral'; nextRound(); }
            break;
          case 'fail': {
            S.timer -= dt;
            // flash the button that was wanted, three times
            const k = 1.7 - S.timer;
            lit[S.failAt] = k > 0.2 && Math.floor((k - 0.2) / 0.22) % 2 === 0 && k < 1.5 ? 1 : lit[S.failAt];
            if (S.timer <= 0) { S.phase = 'over'; finishGame(); }
            break;
          }
        }
        // lights fade unless held on by playback
        for (let i = 0; i < 4; i++) {
          const held = (S.phase === 'watch' && S.lightOn && S.seq[S.step] === i) || S.pressT[i] > 0;
          if (!held) lit[i] = Math.max(0, lit[i] - dt * (S.phase === 'watch' ? 18 : 7));
        }
        // face and body
        if (S.lookHold > 0) S.lookHold -= dt;
        else if (S.phase === 'input' || S.phase === 'intro' || S.phase === 'success') {
          S.nextGlance -= dt;
          if (S.nextGlance <= 0) { S.nextGlance = K.rand(1.5, 3.5); S.lookTX = K.rand(-0.35, 0.35); S.lookTY = K.rand(0, 0.4); }
        }
        if (S.phase === 'fail' || S.phase === 'over') { S.lookTX = 0; S.lookTY = 0.7; }
        const ease = Math.min(1, dt * 14);
        S.lookX += (S.lookTX - S.lookX) * ease; S.lookY += (S.lookTY - S.lookY) * ease;
        S.headY += (S.headTY - S.headY) * Math.min(1, dt * 8);
        S.tilt += ((S.phase === 'fail' || S.phase === 'over' ? -0.12 : S.lookX * 0.07) - S.tilt) * Math.min(1, dt * 8);
        S.blinkT -= dt; if (S.blinkT < -0.12) S.blinkT = K.rand(2.5, 4.5);
        S.sing = Math.max(0, S.sing - dt * 3);
        S.antGlow = Math.max(0, S.antGlow - dt * 2.2);
        S.beat = Math.max(0, S.beat - dt * 5);
        const t = S.t;
        let aL = 0.28 + Math.sin(t * 1.6) * 0.04, aR = -0.28 - Math.sin(t * 1.6 + 1) * 0.04;
        if (S.mood === 'happy') { aL = 2.72 + Math.sin(t * 13) * 0.2; aR = -2.72 - Math.sin(t * 13 + 1.3) * 0.2; }
        else if (S.mood === 'sad') { aL = 0.06; aR = -0.06; }
        aL += S.beat * 0.22; aR -= S.beat * 0.22;
        S.armL += (aL - S.armL) * Math.min(1, dt * 12); S.armR += (aR - S.armR) * Math.min(1, dt * 12);
      }

      function render() {
        ctx.save();
        shake.apply(ctx, 16);
        ctx.drawImage(bg, 0, 0, W, H);
        st.armL = S.armL; st.armR = S.armR;
        st.mood = S.mood; st.lookX = S.lookX; st.lookY = S.lookY;
        st.blink = S.blinkT < 0 && S.mood !== 'happy'; st.headY = S.headY - S.beat * 3; st.tilt = S.tilt;
        st.sing = S.sing; st.ant = S.phase === 'fail' || S.phase === 'over' ? C.hazard : S.antGlow > 0.05 ? S.ant : (Math.sin(S.t * 3) > 0 ? '#ff4d4d' : '#ffb3b3');
        st.antGlow = S.phase === 'fail' || S.phase === 'over' ? 0.6 : S.antGlow;
        st.round = S.round; st.hubCol = S.phase === 'success' ? C.good : S.phase === 'fail' || S.phase === 'over' ? C.hazard : C.ink;
        ctx.save(); ctx.translate(0, OY);
        drawRobot(ctx, st);
        fx.draw(ctx);
        ctx.restore();
        // status line
        const p = S.pop, sc = 0.7 + 0.3 * p + Math.sin(p * Math.PI) * 0.12;
        K.text(ctx, S.status, W / 2, 38, { size: Math.round(38 * sc), color: S.statusCol });
        if (S.sub) K.text(ctx, S.sub, W / 2, 80, { size: 22, body: true, color: '#aebdc6', shadow: false });
        ctx.restore();
      }

      nextRound();
      api.loop(dt => {
        S.t += dt;
        update(dt);
        fx.update(dt);
        shake.update(dt);
        render();
      });
    }
  });
})();
