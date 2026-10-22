/* Code the Bot · a programming puzzle in the spirit of Lightbot.
 * Snap Forward and Turn blocks into a program (from level 6 also a reusable function, F1),
 * press Run, and watch your own bot follow it block by block to the charging pad. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;
  const W = 640, TOP = 50;
  let H = 480; // 440 on phones, set in start()
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const T_MOVE = 0.34, T_TURN = 0.28, T_CALL = 0.2, T_BUMP = 0.5, T_FALL = 0.85;

  // Map legend: S start · P charging pad · H start on the pad · B battery · . floor · # wall · space = pit.
  // dir: 0 north (up), 1 east, 2 south, 3 west. best = fewest blocks (Main + F1) that solve the level
  // inside its slot limits. Every level was checked with a brute-force solver.
  const LEVELS = [
    { name: 'First steps', dir: 1, main: 6, best: 4, map: ['S...P'],
      tip: 'Tap Forward four times, then press Run.' },
    { name: 'Corner', dir: 1, main: 8, best: 5, map: ['S..', '  .', '  P'],
      tip: 'Turn right spins your bot on the spot. It does not move.' },
    { name: 'Zigzag', dir: 1, main: 10, best: 8, map: ['S..  ', '  .  ', '  ..P'],
      tip: "Left and right are your bot's left and right. Watch its arrow." },
    { name: 'Turn around', dir: 1, main: 10, best: 8, map: ['#####', 'P.S.B'],
      tip: 'Honey cells! Grab every one, then end on the pad. Two turns face you the other way.' },
    { name: 'Battery loop', dir: 1, main: 12, best: 10, map: ['B..B', '.  .', 'S..P'],
      tip: 'The pad is close, but the honey cells come first.' },
    { name: 'Long hall', dir: 1, main: 4, f1: 4, best: 6, map: ['#########', 'S.......P'],
      tip: 'Main only fits 4 blocks. Fill F1 with Forwards, then put Run F1 in Main.' },
    { name: 'Stairs', dir: 1, main: 5, f1: 4, best: 8, map: ['    P', '   ..', '  .. ', ' ..  ', 'S.   '],
      tip: 'Spot the part that repeats. Build it once in F1, then run F1 again and again.' },
    { name: 'Snake', dir: 1, main: 11, f1: 4, best: 15, map: ['S....', '    B', '.....', 'B    ', '....P'],
      tip: 'Let F1 do the long straight runs. Put the turns in Main.' },
    { name: 'Crossroads', dir: 0, main: 5, f1: 8, best: 11, map: ['  B  ', '  .  ', 'B.H.B', '  .  ', '  B  '],
      tip: 'Your bot starts on its charger. Visit all four arms, then come home.' },
    { name: 'Side pockets', dir: 1, main: 4, f1: 8, best: 11, map: ['#B#B#B#', 'S.....P'],
      tip: 'One F1 can pop into a pocket, back out, and roll on to the next.' },
    { name: 'Mountain', dir: 1, main: 8, f1: 4, best: 11, map: ['   B   ', '  ...  ', ' .. .. ', 'S.   .P'],
      tip: 'The same F1 can climb down too. Try a turn first.' },
    { name: 'Diamond', dir: 1, main: 11, f1: 4, best: 14, map: ['  B  ', ' ... ', 'S. .B', ' P.. ', '  B  '],
      tip: 'Four slopes, one step pattern. Use everything you know.' }
  ];

  const COL = { F: '#f5c518', L: '#5ad1e6', R: '#ff8a5c', P: '#c3a6ff' };
  const NAME = { F: 'Forward', L: 'Turn left', R: 'Turn right', P: 'Run F1' };
  const KEY = { F: '↑', L: '←', R: '→', P: 'F' };
  const ICON = {
    F: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l7.6 8.6h-4.9v8.9H9.3v-8.9H4.4z" fill="currentColor"/></svg>',
    L: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.6 20.6v-6.4a5 5 0 0 0-5-5H8.4" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M10.2 3L3.2 9.2l7 6.2z" fill="currentColor"/></svg>',
    R: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.4 20.6v-6.4a5 5 0 0 1 5-5h5.2" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M13.8 3l7 6.2-7 6.2z" fill="currentColor"/></svg>',
    P: '<span class="f1">F1</span>'
  };
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.95 6.2 6.8.85-5 4.7 1.3 6.75L12 17.4l-6.05 3.3 1.3-6.75-5-4.7 6.8-.85z" fill="currentColor"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';

  const CSS = `
  .g-ctb { width: 100%; height: 100%; max-width: 1200px; display: grid; gap: 14px;
    grid-template-columns: minmax(0, 1fr) clamp(300px, 33%, 400px); grid-template-rows: minmax(0, 1fr); }
  .g-ctb .ctb-board { min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .g-ctb .ctb-board .game-canvas { flex: none; }
  .g-ctb .ctb-side { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 12px;
    background: #172733; border: 2px solid #223845; border-radius: 14px; align-self: center; max-height: 100%; }
  .g-ctb .ctb-side > * { flex: none; }
  .g-ctb .ctb-levels { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 3px; }
  .g-ctb .ctb-lv { height: 36px; min-width: 0; padding: 0; border: 0; border-radius: 6px; cursor: pointer;
    background: #0f1a23; box-shadow: inset 0 0 0 2px #223845; color: #c9d6dd;
    display: grid; align-content: center; justify-items: center; gap: 3px; font: 700 13px/1 var(--body); }
  .g-ctb .ctb-lv:hover:not(:disabled) { box-shadow: inset 0 0 0 2px #6f8796; }
  .g-ctb .ctb-lv.is-cur { background: #5ad1e6; color: #0f1a23; box-shadow: none; }
  .g-ctb .ctb-lv:disabled { cursor: default; color: #4a6272; }
  .g-ctb .ctb-lv i { display: flex; gap: 1px; color: #2b4353; }
  .g-ctb .ctb-lv i svg { width: 7px; height: 7px; display: block; }
  .g-ctb .ctb-lv i.lock svg { width: 10px; height: 10px; }
  .g-ctb .ctb-lv i .on { color: #f5c518; }
  .g-ctb .ctb-lv.is-cur i { color: rgba(15,26,35,.3); }
  .g-ctb .ctb-lv.is-cur i .on { color: #0f1a23; }
  .g-ctb .ctb-tip { margin: 0; padding: 8px 10px; border-radius: 8px; background: #0f1a23; border-left: 4px solid #5ad1e6;
    font: 500 14px/1.35 var(--body); color: #c9d6dd; min-height: 3.2em; }
  .g-ctb .ctb-tip b { color: #e6eef2; }
  .g-ctb .ctb-tip.bad { border-left-color: #ff6b3d; color: #ffd2c2; }
  .g-ctb .ctb-tip.good { border-left-color: #7cf08a; color: #d8ffdd; }
  .g-ctb .ctb-prog { padding: 8px 9px 9px; border-radius: 10px; background: #0f1a23; box-shadow: inset 0 0 0 2px #223845; cursor: pointer; }
  .g-ctb .ctb-prog.is-sel { box-shadow: inset 0 0 0 2px #f5c518; }
  .g-ctb .ctb-prog.is-shake { animation: ctb-shake .3s; }
  .g-ctb .ctb-head { display: flex; align-items: center; gap: 8px; min-height: 22px; }
  .g-ctb .ctb-head b { font: 400 14px/1 var(--display); color: #e6eef2; }
  .g-ctb .ctb-prog.is-sel .ctb-head b { color: #f5c518; }
  .g-ctb .ctb-head .n { font: 700 12px/1 var(--body); color: #6f8796; font-variant-numeric: tabular-nums; }
  .g-ctb .ctb-head .new { font: 700 10px/1 var(--body); letter-spacing: .1em; text-transform: uppercase; color: #0f1a23; background: #c3a6ff; padding: 3px 5px 2px; border-radius: 4px; }
  .g-ctb .ctb-clear { margin-left: auto; border: 0; border-radius: 6px; padding: 5px 9px; cursor: pointer;
    background: #223845; color: #c9d6dd; font: 700 12px/1 var(--body); }
  .g-ctb .ctb-clear:hover { background: #2b4353; }
  .g-ctb .ctb-slots { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .g-ctb .ctb-blk, .g-ctb .ctb-slot { width: 40px; height: 40px; border-radius: 8px; flex: none; }
  .g-ctb .ctb-slot { box-shadow: inset 0 0 0 2px #1f3440; }
  .g-ctb .ctb-prog.is-sel .ctb-slot.is-next { box-shadow: inset 0 0 0 2px #f5c518; animation: ctb-blink 1s steps(2) infinite; }
  .g-ctb .ctb-blk { border: 0; padding: 0; cursor: pointer; display: grid; place-items: center; color: #0f1a23;
    box-shadow: inset 0 -4px 0 rgba(0,0,0,.25); transition: transform 90ms; }
  .g-ctb .ctb-blk svg { width: 24px; height: 24px; }
  .g-ctb .ctb-blk:hover { transform: translateY(-2px); }
  .g-ctb .f1 { font: 400 13px/1 var(--display); letter-spacing: .02em; }
  .g-ctb .c-F { background: #f5c518; } .g-ctb .c-L { background: #5ad1e6; } .g-ctb .c-R { background: #ff8a5c; } .g-ctb .c-P { background: #c3a6ff; }
  .g-ctb .ctb-blk.is-now { outline: 3px solid #fff; outline-offset: 2px; transform: translateY(-3px); }
  .g-ctb .ctb-blk.is-call { outline: 3px dashed #c3a6ff; outline-offset: 2px; }
  .g-ctb .ctb-blk.is-bad { outline: 3px solid #ff4d4d; outline-offset: 2px; animation: ctb-shake .35s; }
  .g-ctb .ctb-blk.is-pop { animation: ctb-pop .18s ease-out; }
  .g-ctb .ctb-palette { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 6px; }
  .g-ctb .ctb-pal { display: grid; justify-items: center; gap: 4px; padding: 8px 2px 7px; border: 0; border-radius: 10px; cursor: pointer;
    background: #223845; color: #e6eef2; box-shadow: 0 4px 0 #0b141b; font: 700 12px/1 var(--body); min-width: 0; }
  .g-ctb .ctb-pal:hover { background: #2b4353; }
  .g-ctb .ctb-pal:active { transform: translateY(2px); box-shadow: 0 2px 0 #0b141b; }
  .g-ctb .ctb-pal .chip { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; color: #0f1a23; box-shadow: inset 0 -3px 0 rgba(0,0,0,.25); }
  .g-ctb .ctb-pal .chip svg { width: 21px; height: 21px; }
  .g-ctb .ctb-pal span { white-space: nowrap; }
  .g-ctb .ctb-pal kbd { font: 700 10px/1 var(--body); color: #6f8796; }
  .g-ctb .ctb-actions { display: flex; align-items: center; gap: 8px; }
  .g-ctb .ctb-act { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 18px;
    font: 400 16px/1 var(--display); border: 0; border-radius: 8px; cursor: pointer;
    background: #223845; color: #e6eef2; box-shadow: 0 4px 0 #0b141b; transition: transform 80ms, box-shadow 80ms, background-color 120ms; }
  .g-ctb .ctb-act svg { width: 18px; height: 18px; flex: none; }
  .g-ctb .ctb-act:hover { background: #2b4353; }
  .g-ctb .ctb-act:active { transform: translateY(2px); box-shadow: 0 2px 0 #0b141b; }
  .g-ctb .ctb-act.primary { background: #f5c518; color: #0f1a23; box-shadow: 0 4px 0 #a88404; }
  .g-ctb .ctb-act.primary:hover { background: #ffd43a; }
  .g-ctb .ctb-act.primary:active { box-shadow: 0 2px 0 #a88404; }
  .g-ctb .ctb-act.stop { background: #ff6b3d; color: #0f1a23; box-shadow: 0 4px 0 #a8401f; }
  .g-ctb .ctb-act.ghost { background: transparent; box-shadow: inset 0 0 0 2px #2b4353; }
  .g-ctb .ctb-act.ghost:hover { box-shadow: inset 0 0 0 2px #6f8796; }
  .g-ctb .ctb-run { min-width: 108px; }
  .g-ctb .ctb-reset { width: 46px; padding: 12px 0; }
  .g-ctb .ctb-reset svg { width: 20px; height: 20px; }
  .g-ctb .ctb-par { margin-left: auto; display: grid; justify-items: end; gap: 4px; font: 700 12px/1.1 var(--body); color: #8b9aa6; text-align: right; white-space: nowrap; }
  .g-ctb .ctb-par b { font: 700 15px/1 var(--body); color: #e6eef2; font-variant-numeric: tabular-nums; }
  .g-ctb .ctb-par .stars { display: inline-flex; gap: 1px; vertical-align: -2px; color: #f5c518; margin-right: 3px; }
  .g-ctb .ctb-par .stars svg { width: 12px; height: 12px; }
  .g-ctb.is-running .ctb-palette, .g-ctb.is-running .ctb-clear, .g-ctb.is-locked .ctb-palette { opacity: .45; pointer-events: none; }
  .g-ctb.is-running .ctb-slots, .g-ctb.is-locked .ctb-slots { pointer-events: none; }
  .g-ctb .is-hint { animation: ctb-glow 1.1s ease-in-out infinite; }
  @keyframes ctb-glow { 50% { box-shadow: 0 0 0 3px #f5c518, 0 0 18px rgba(245,197,24,.55); } }
  @keyframes ctb-blink { 50% { box-shadow: inset 0 0 0 2px #1f3440; } }
  @keyframes ctb-shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  @keyframes ctb-pop { from { transform: scale(.6); } to { transform: scale(1); } }
  @media (max-height: 700px) {
    .g-ctb .ctb-side { gap: 7px; padding: 10px; }
    .g-ctb .ctb-blk, .g-ctb .ctb-slot { width: 36px; height: 36px; }
    .g-ctb .ctb-tip { min-height: 0; font-size: 13px; padding: 6px 9px; }
    .g-ctb .ctb-pal { padding: 6px 2px; }
    .g-ctb .ctb-slots { margin-top: 5px; }
  }
  @media (max-width: 720px), (orientation: portrait) and (max-width: 1100px) {
    .g-ctb { height: auto; max-height: 100%; max-width: 680px; overflow-y: auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto; gap: 6px; align-content: start; }
    .g-ctb .ctb-board { display: block; }
    .g-ctb .ctb-side { overflow: visible; max-height: none; padding: 0; gap: 6px; background: none; border: 0; }
    .g-ctb .ctb-levels { order: 9; }
    .g-ctb .ctb-lv { height: 30px; font-size: 12px; gap: 2px; }
    .g-ctb .ctb-tip { font-size: 13px; padding: 5px 9px; min-height: 0; }
    .g-ctb .ctb-prog { padding: 5px 7px 6px; }
    .g-ctb .ctb-head { min-height: 20px; }
    .g-ctb .ctb-clear { padding: 4px 8px; }
    .g-ctb .ctb-slots { gap: 4px; margin-top: 4px; }
    .g-ctb .ctb-blk, .g-ctb .ctb-slot { width: 36px; height: 36px; }
    .g-ctb .ctb-blk svg { width: 22px; height: 22px; }
    .g-ctb .ctb-pal { padding: 5px 2px; font-size: 11px; gap: 3px; }
    .g-ctb .ctb-pal .chip { width: 26px; height: 26px; }
    .g-ctb .ctb-pal .chip svg { width: 18px; height: 18px; }
    .g-ctb .ctb-pal kbd { display: none; }
    .g-ctb .ctb-act { padding: 10px 14px; font-size: 15px; }
    .g-ctb .ctb-reset { width: 44px; padding: 10px 0; }
    .g-ctb .ctb-run { min-width: 96px; }
  }
  `;

  // ---------- level parsing ----------
  function parse(lv) {
    const h = lv.map.length, w = Math.max(...lv.map.map(r => r.length));
    const cells = [], bats = [];
    let start = null, pad = null;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = lv.map[y][x] || ' ';
        cells.push(ch === '#' ? '#' : ch === ' ' ? ' ' : '.');
        if (ch === 'S' || ch === 'H') start = { x, y };
        if (ch === 'P' || ch === 'H') pad = { x, y };
        if (ch === 'B') bats.push({ x, y });
      }
    }
    return { w, h, cells, start, pad, bats, dir: lv.dir, main: lv.main, f1: lv.f1 || 0, best: lv.best, name: lv.name, tip: lv.tip };
  }
  const cellAt = (L, x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? ' ' : L.cells[y * L.w + x]);
  const mod4 = n => ((n % 4) + 4) % 4;
  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  function geometry(L) {
    const availW = W - 40, availH = H - TOP - 26;
    const t = Math.floor(Math.min(92, availW / L.w, availH / (L.h + 0.28)));
    const th = Math.max(4, Math.round(t * 0.09)), rise = Math.round(t * 0.26);
    const ox = Math.round((W - t * L.w) / 2);
    const oy = Math.round(TOP + 10 + rise + (availH - t * (L.h + 0.28)) / 2);
    return { t, th, rise, ox, oy };
  }
  // centre of a tile's top face
  const tileX = (G, x) => G.ox + (x + 0.5) * G.t;
  const tileY = (G, y) => G.oy + y * G.t + (G.t - G.th) / 2;

  // ---------- drawing ----------
  function drawVoid(c, w, h, top) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0c161d'); g.addColorStop(1, '#081117');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(90,209,230,0.05)'; c.lineWidth = 1;
    for (let x = 16; x < w; x += 32) { c.beginPath(); c.moveTo(x + 0.5, top); c.lineTo(x + 0.5, h); c.stroke(); }
    for (let y = top + 16; y < h; y += 32) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke(); }
  }
  function drawTile(c, px, py, t, th) {
    c.fillStyle = 'rgba(0,0,0,0.45)'; K.rr(c, px + 6, py + 10, t - 6, t - 6, 6);
    c.fillStyle = '#172630'; K.rr(c, px + 2, py + 2, t - 4, t - 4, 6);
    const g = c.createLinearGradient(0, py, 0, py + t - th);
    g.addColorStop(0, '#3b5a6c'); g.addColorStop(1, '#2d4757');
    c.fillStyle = g; K.rr(c, px + 2, py + 2, t - 4, t - 4 - th, 6);
    c.fillStyle = 'rgba(255,255,255,0.1)'; K.rr(c, px + 7, py + 4.5, t - 14, 2.5, 1.2);
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1.2;
    K.rrPath(c, px + 8.5, py + 9.5, t - 17, t - 19 - th, 4); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    const r = Math.max(1.3, t * 0.024), a = 6.5, b = t - 6.5;
    K.circle(c, px + a, py + a, r); K.circle(c, px + b, py + a, r);
    K.circle(c, px + a, py + b - th, r); K.circle(c, px + b, py + b - th, r);
  }
  function drawWall(c, px, py, t, th, rise) {
    const x = px + 3, w = t - 6, top = py + 2 - rise, faceH = t - 4 - th;
    c.fillStyle = 'rgba(0,0,0,0.45)'; K.rr(c, px + 6, py + 10, t - 6, t - 6, 6);
    c.save(); K.rrPath(c, x, top + faceH - 6, w, rise + th + 6, [0, 0, 6, 6]); c.clip();
    K.hazard(c, x, top + faceH - 6, w, rise + th + 6, { stripe: Math.max(6, t * 0.13) });
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(x, top + faceH - 6, w, rise + th + 6);
    c.restore();
    const g = c.createLinearGradient(0, top, 0, top + faceH);
    g.addColorStop(0, '#5d7688'); g.addColorStop(1, '#465e6d');
    c.fillStyle = g; K.rr(c, x, top, w, faceH, 6);
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = Math.max(1.5, t * 0.035);
    K.rrPath(c, x + t * 0.1, top + t * 0.1, w - t * 0.2, faceH - t * 0.2, 3); c.stroke();
    c.beginPath();
    c.moveTo(x + t * 0.1, top + t * 0.1); c.lineTo(x + w - t * 0.1, top + faceH - t * 0.1);
    c.moveTo(x + w - t * 0.1, top + t * 0.1); c.lineTo(x + t * 0.1, top + faceH - t * 0.1);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)'; K.rr(c, x + 4, top + 3, w - 8, 2.5, 1.2);
  }
  function boltPath(c, cx, cy, s) {
    c.beginPath();
    c.moveTo(cx + 0.1 * s, cy - 0.5 * s); c.lineTo(cx - 0.3 * s, cy + 0.07 * s); c.lineTo(cx - 0.03 * s, cy + 0.07 * s);
    c.lineTo(cx - 0.13 * s, cy + 0.5 * s); c.lineTo(cx + 0.3 * s, cy - 0.09 * s); c.lineTo(cx + 0.03 * s, cy - 0.09 * s);
    c.closePath();
  }
  function drawPadBase(c, cx, cy, t) {
    const s = t * 0.74;
    c.save(); K.rrPath(c, cx - s / 2, cy - s / 2, s, s, t * 0.12); c.clip();
    K.hazard(c, cx - s / 2, cy - s / 2, s, s, { stripe: Math.max(5, t * 0.09) });
    c.restore();
    const i = s * 0.7;
    c.fillStyle = '#0f1a23'; K.rr(c, cx - i / 2, cy - i / 2, i, i, t * 0.08);
    c.fillStyle = 'rgba(245,197,24,0.35)'; boltPath(c, cx, cy, i * 0.8); c.fill();
  }
  function drawStartMark(c, cx, cy, t) {
    const s = t * 0.66;
    c.save(); c.strokeStyle = 'rgba(90,209,230,0.55)'; c.lineWidth = 2; c.setLineDash([5, 4]);
    K.rrPath(c, cx - s / 2, cy - s / 2, s, s, 8); c.stroke(); c.restore();
  }
  function drawBattery(c, cx, cy, t, time, i) {
    const bob = Math.sin(time * 3.2 + i * 1.7) * t * 0.035;
    c.fillStyle = 'rgba(124,240,138,0.18)';
    c.beginPath(); c.ellipse(cx, cy + t * 0.14, t * 0.24, t * 0.08, 0, 0, Math.PI * 2); c.fill();
    K.drawHive(c, cx, cy - t * 0.1 + bob, t * 0.48);
  }
  function drawArrow(c, cx, cy, ang, t, alpha, dist) {
    c.save(); c.translate(cx, cy); c.rotate(ang); c.globalAlpha = alpha;
    const d = dist, s = t * 0.13;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.moveTo(d + s + 2, 2); c.lineTo(d - s * 0.6 + 2, -s + 2); c.lineTo(d - s * 0.05 + 2, 2); c.lineTo(d - s * 0.6 + 2, s + 2); c.closePath(); c.fill();
    c.fillStyle = C.glow;
    c.beginPath(); c.moveTo(d + s, 0); c.lineTo(d - s * 0.6, -s); c.lineTo(d - s * 0.05, 0); c.lineTo(d - s * 0.6, s); c.closePath(); c.fill();
    c.restore();
  }
  function starPath(c, cx, cy, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
  }
  function drawStar(c, cx, cy, r, on) {
    starPath(c, cx + 2, cy + 3, r); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill();
    starPath(c, cx, cy, r);
    c.fillStyle = on ? C.safety : '#1c2f3c'; c.fill();
    c.lineWidth = 3; c.strokeStyle = on ? '#fff3b0' : '#39505e'; c.stroke();
    if (on) { starPath(c, cx - r * 0.12, cy - r * 0.14, r * 0.42); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill(); }
  }
  // a command block as a canvas icon (card art)
  function drawBlock(c, cmd, x, y, s) {
    c.fillStyle = COL[cmd]; K.rr(c, x, y, s, s, s * 0.2);
    c.fillStyle = 'rgba(0,0,0,0.22)'; K.rr(c, x, y + s * 0.82, s, s * 0.18, [0, 0, s * 0.2, s * 0.2]);
    c.fillStyle = '#0f1a23'; c.strokeStyle = '#0f1a23';
    const cx = x + s / 2, cy = y + s * 0.46, k = s / 24;
    c.save(); c.translate(cx, cy); c.scale(k, k); c.lineWidth = 3.4; c.lineCap = 'round';
    if (cmd === 'F') { c.beginPath(); c.moveTo(0, -8.5); c.lineTo(7.6, 0); c.lineTo(2.8, 0); c.lineTo(2.8, 8.5); c.lineTo(-2.8, 8.5); c.lineTo(-2.8, 0); c.lineTo(-7.6, 0); c.closePath(); c.fill(); }
    else if (cmd === 'L' || cmd === 'R') {
      if (cmd === 'R') c.scale(-1, 1);
      c.beginPath(); c.moveTo(6.6, 8.5); c.lineTo(6.6, 2); c.arcTo(6.6, -3, 1.6, -3, 5); c.lineTo(-3.6, -3); c.stroke();
      c.beginPath(); c.moveTo(-1.8, -9); c.lineTo(-8.8, -3); c.lineTo(-1.8, 3); c.closePath(); c.fill();
    } else { c.font = K.font(11); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('F1', 0, 1); }
    c.restore();
  }

  Arcade.register({
    id: 'code-the-bot',
    title: 'Code the Bee Bot',
    cat: 'puzzle',
    blurb: 'Program your robot to collect honey power and reach the hive gate.',
    rules: [
      'Build a program from Forward and Turn blocks, then press Run.',
      'End on the charging pad. From level 4, grab every honey cell first.',
      'Walls stop your bot and gaps make it fall. Fix your program and try again.',
      'From level 6, F1 lets you reuse a pattern. Fewer blocks earn more stars.'
    ],
    how: 'Click blocks to build · ↑ ← → add blocks · Backspace removes · Enter runs',
    accent: '#5ad1e6',
    usesPlayer: true,
    _levels: LEVELS,

    thumb(ctx, w, h, kit, player) {
      drawVoid(ctx, w, h, 0);
      const L = parse({ dir: 1, main: 6, best: 0, name: '', tip: '', map: ['#.B..', 'S. #.', '   .P'] });
      const G = { t: 44, th: 4, rise: 14, ox: 50, oy: 26 };
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        if (cellAt(L, x, y) === '.') drawTile(ctx, G.ox + x * G.t, G.oy + y * G.t, G.t, G.th);
      }
      drawPadBase(ctx, tileX(G, 4), tileY(G, 2), G.t);
      ctx.fillStyle = 'rgba(245,197,24,0.3)'; K.circle(ctx, tileX(G, 4), tileY(G, 2), 20);
      for (let y = 0; y < L.h; y++) {
        for (let x = 0; x < L.w; x++) if (cellAt(L, x, y) === '#') drawWall(ctx, G.ox + x * G.t, G.oy + y * G.t, G.t, G.th, G.rise);
        if (y === 0) drawBattery(ctx, tileX(G, 2), tileY(G, 0), G.t, 0.4, 0);
        if (y === 1) {
          drawArrow(ctx, tileX(G, 1), tileY(G, 1), -Math.PI / 2, G.t, 1, G.t * 0.62);
          kit.drawBot(ctx, tileX(G, 1), tileY(G, 1) + G.t * 0.26 - G.t * 0.46, G.t * 0.92,
            Object.assign({}, player, { t: 0.4, mood: 'happy', lookY: -1, shadow: true }));
        }
      }
      // the program strip
      ctx.fillStyle = 'rgba(15,26,35,0.92)'; K.rr(ctx, 30, 158, 260, 36, 9);
      ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 2; K.rrPath(ctx, 30, 158, 260, 36, 9); ctx.stroke();
      kit.text(ctx, 'MAIN', 58, 176, { size: 11, color: C.safety, shadow: false });
      ['F', 'L', 'F', 'F', 'R', 'P'].forEach((cmd, i) => drawBlock(ctx, cmd, 86 + i * 32, 163, 26));
      K.vignette(ctx, w, h, 0.35);
    },

    start(api) {
      const el = api.el;
      api.css(CSS);
      const fx = K.particles(), shake = K.shaker();
      const mq = window.matchMedia ? window.matchMedia('(max-width: 720px), (orientation: portrait) and (max-width: 1100px)') : { matches: false };
      H = mq.matches ? 440 : 480;

      // ---------- saved progress ----------
      const N = LEVELS.length;
      const raw = api.load(null) || {};
      const data = { stars: [], open: 0, progs: {} };
      for (let i = 0; i < N; i++) data.stars[i] = K.clamp(Math.round(Number(raw.stars && raw.stars[i]) || 0), 0, 3);
      data.open = K.clamp(Math.round(Number(raw.open) || 0), 0, N - 1);
      data.stars.forEach((s, i) => { if (s) data.open = Math.max(data.open, Math.min(N - 1, i + 1)); });
      if (raw.progs && typeof raw.progs === 'object') {
        for (const k in raw.progs) if (typeof raw.progs[k] === 'string' && /^[FLRP]*\|[FLR]*$/.test(raw.progs[k])) data.progs[k] = raw.progs[k];
      }
      const persist = () => api.save({ v: 1, stars: data.stars, open: data.open, progs: data.progs });

      // ---------- layout ----------
      const root = el('div', { class: 'g-ctb' });
      const boardWrap = el('div', { class: 'ctb-board' });
      const side = el('div', { class: 'ctb-side' });
      const levelsBox = el('div', { class: 'ctb-levels', role: 'group', 'aria-label': 'Levels' });
      const tipEl = el('p', { class: 'ctb-tip', 'aria-live': 'polite' });
      function makeRow(key, label) {
        const n = el('span', { class: 'n' });
        const tag = el('span', { class: 'new', hidden: true }, 'New');
        const clear = el('button', { type: 'button', class: 'ctb-clear', dataset: { act: 'clear', area: key }, 'aria-label': 'Clear ' + label }, 'Clear');
        const slots = el('div', { class: 'ctb-slots' });
        const box = el('div', { class: 'ctb-prog', dataset: { area: key } }, el('div', { class: 'ctb-head' }, el('b', null, label), n, tag, clear), slots);
        return { box, n, tag, clear, slots, els: [] };
      }
      const rows = { main: makeRow('main', 'Main'), f1: makeRow('f1', 'F1') };
      const palette = el('div', { class: 'ctb-palette' });
      const pal = {};
      for (const cmd of ['F', 'L', 'R', 'P']) {
        pal[cmd] = el('button', { type: 'button', class: 'ctb-pal', dataset: { act: 'add', cmd }, 'aria-label': 'Add ' + NAME[cmd] },
          el('span', { class: 'chip c-' + cmd, html: ICON[cmd] }), el('span', null, NAME[cmd]), api.isTouch ? null : el('kbd', null, KEY[cmd]));
      }
      const runBtn = el('button', { type: 'button', class: 'ctb-act primary ctb-run', dataset: { act: 'run' } });
      const resetBtn = el('button', { type: 'button', class: 'ctb-act ghost ctb-reset', dataset: { act: 'reset' }, title: 'Reset the bot', 'aria-label': 'Reset the bot', html: Arcade.ICON.again });
      const usedEl = el('b');
      const parEl = el('span');
      const actions = el('div', { class: 'ctb-actions' }, runBtn, resetBtn, el('div', { class: 'ctb-par' }, usedEl, parEl));
      side.append(levelsBox, tipEl, rows.main.box, rows.f1.box, palette, actions);
      root.append(boardWrap, side);
      api.stage.append(root);
      const cv = api.canvas(W, H, { parent: boardWrap });
      const ctx = cv.ctx;
      const vignette = K.layer(W, H, c => K.vignette(c, W, H, 0.32));

      function fitBoard() {
        const s = cv.el.style;
        if (mq.matches) { if (s.width) { s.width = ''; s.height = ''; } return; }
        const r = boardWrap.getBoundingClientRect();
        const k = Math.min(r.width / W, r.height / H);
        if (k > 0) {
          const nw = Math.floor(W * k) + 'px', nh = Math.floor(H * k) + 'px';
          if (s.width !== nw || s.height !== nh) { s.width = nw; s.height = nh; }
        }
      }
      fitBoard();
      api.on(window, 'resize', fitBoard);
      api.every(400, fitBoard);

      // ---------- game state ----------
      let idx = 0, L = null, G = null, layer = null, wallSprite = null, wallRows = [];
      let area = 'main';
      const prog = { main: [], f1: [] };
      const bot = { x: 0, y: 0, d: 1, q: 1, px: 0, py: 0, off: 0, fall: 0, mood: 'happy', arms: 'down', gone: false };
      let taken = [], got = 0;
      const trail = new Set();
      let run = null, dirty = false, locked = false, banner = null, winFx = null, time = 0;
      let lit = [], badEl = null;
      const sess = {};
      let score = 0;
      runBtn.innerHTML = Arcade.ICON.play + '<span>Run</span>';

      function say(text, kind) {
        tipEl.className = 'ctb-tip' + (kind ? ' ' + kind : '');
        tipEl.innerHTML = '';
        if (kind) tipEl.textContent = text;
        else tipEl.append(el('b', null, 'Level ' + (idx + 1) + ' · ' + L.name + '. '), text);
      }
      function progKey() { return prog.main.join('') + '|' + prog.f1.join(''); }
      function saveProg() { data.progs[idx] = progKey(); persist(); }

      function loadLevel(i) {
        idx = K.clamp(i, 0, N - 1);
        L = parse(LEVELS[idx]);
        G = geometry(L);
        layer = K.layer(W, H, drawStatic, 2);
        wallSprite = K.layer(G.t, G.t + G.rise, c => drawWall(c, 0, G.rise, G.t, G.th, G.rise), 2.5);
        wallRows = [];
        for (let y = 0; y < L.h; y++) {
          wallRows.push([]);
          for (let x = 0; x < L.w; x++) if (cellAt(L, x, y) === '#') wallRows[y].push(x);
        }
        const saved = data.progs[idx] || '|';
        const parts = saved.split('|');
        prog.main = parts[0].split('').filter(ch => 'FLRP'.includes(ch) && (ch !== 'P' || L.f1)).slice(0, L.main);
        prog.f1 = L.f1 ? parts[1].split('').filter(ch => 'FLR'.includes(ch)).slice(0, L.f1) : [];
        area = 'main';
        locked = false; winFx = null;
        fx.clear();
        rows.f1.box.hidden = !L.f1;
        rows.f1.tag.hidden = idx !== 5;
        palette.replaceChildren(pal.F, pal.L, pal.R);
        if (L.f1) palette.append(pal.P);
        palette.style.setProperty('--n', L.f1 ? 4 : 3);
        parEl.innerHTML = '<span class="stars">' + STAR + STAR + STAR + '</span>' + L.best + ' or fewer';
        resetBoard();
        say(L.tip);
        renderLevels();
        renderRows();
        root.classList.remove('is-locked');
        showStars();
      }
      function showStars() {
        let total = 0;
        data.stars.forEach(s => { total += s; });
        api.stat('Stars', total + '/' + N * 3);
      }

      function drawStatic(c) {
        drawVoid(c, W, H, TOP);
        c.fillStyle = '#132330'; c.fillRect(0, 0, W, TOP);
        c.fillStyle = '#223845'; c.fillRect(0, TOP - 3, W, 3);
        K.text(c, 'LEVEL ' + (idx + 1), 18, TOP / 2 + 1, { size: 22, color: C.safety, align: 'left' });
        c.font = K.font(22);
        const lw = c.measureText('LEVEL ' + (idx + 1)).width;
        K.text(c, L.name.toUpperCase(), 30 + lw, TOP / 2 + 2, { size: 16, body: true, color: C.muted, align: 'left', shadow: false });
        for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
          if (cellAt(L, x, y) === '.') drawTile(c, G.ox + x * G.t, G.oy + y * G.t, G.t, G.th);
        }
        drawPadBase(c, tileX(G, L.pad.x), tileY(G, L.pad.y), G.t);
        if (L.start.x !== L.pad.x || L.start.y !== L.pad.y) drawStartMark(c, tileX(G, L.start.x), tileY(G, L.start.y), G.t);
      }

      // ---------- UI rendering ----------
      function renderLevels() {
        levelsBox.replaceChildren(...LEVELS.map((lv, i) => {
          const isLocked = i > data.open, st = data.stars[i];
          const pips = isLocked ? '<i class="lock">' + LOCK + '</i>'
            : '<i>' + [0, 1, 2].map(k => '<span class="' + (k < st ? 'on' : '') + '">' + STAR + '</span>').join('') + '</i>';
          return el('button', {
            type: 'button', class: 'ctb-lv' + (i === idx ? ' is-cur' : ''), disabled: isLocked,
            dataset: { act: 'level', i: String(i) }, title: 'Level ' + (i + 1) + ': ' + lv.name,
            'aria-label': 'Level ' + (i + 1) + (isLocked ? ', locked' : ', ' + st + ' of 3 stars'),
            html: '<span>' + (i + 1) + '</span>' + pips
          });
        }));
      }
      function renderRows(popArea) {
        for (const key of ['main', 'f1']) {
          const r = rows[key], list = prog[key], lim = key === 'main' ? L.main : L.f1;
          r.slots.replaceChildren();
          r.els = [];
          for (let i = 0; i < lim; i++) {
            const cmd = list[i];
            const node = cmd
              ? el('button', { type: 'button', class: 'ctb-blk c-' + cmd + (popArea === key && i === list.length - 1 ? ' is-pop' : ''), dataset: { act: 'remove', area: key, i: String(i) }, 'aria-label': NAME[cmd] + '. Tap to remove.', html: ICON[cmd] })
              : el('span', { class: 'ctb-slot' + (i === list.length ? ' is-next' : '') });
            r.slots.append(node); r.els.push(node);
          }
          r.n.textContent = list.length + ' / ' + lim;
          r.box.classList.toggle('is-sel', area === key);
        }
        const n = prog.main.length + prog.f1.length;
        usedEl.textContent = n + (n === 1 ? ' block' : ' blocks');
        lit = []; badEl = null;
        hints();
      }
      function hints() {
        for (const b of [pal.F, runBtn, pal.P, rows.f1.box]) b.classList.remove('is-hint');
        if (run || locked) return;
        if (idx === 0 && !data.stars[0]) (prog.main.length < 4 ? pal.F : runBtn).classList.add('is-hint');
        if (idx === 5 && !data.stars[5] && !prog.f1.length && !prog.main.length) rows.f1.box.classList.add('is-hint');
      }
      function setRunning(on) {
        root.classList.toggle('is-running', on);
        runBtn.classList.toggle('primary', !on);
        runBtn.classList.toggle('stop', on);
        runBtn.innerHTML = on ? '<span>Stop</span>' : Arcade.ICON.play + '<span>Run</span>';
        hints();
      }
      function clearMarks() {
        for (const e of lit) e.classList.remove('is-now', 'is-call');
        lit = [];
        if (badEl) { badEl.classList.remove('is-bad'); badEl = null; }
      }
      function mark(step) {
        clearMarks();
        if (!step) return;
        const e = rows[step.area].els[step.i];
        if (e) { e.classList.add('is-now'); lit.push(e); }
        if (step.call >= 0 && step.area === 'f1') {
          const c = rows.main.els[step.call];
          if (c) { c.classList.add('is-call'); lit.push(c); }
        }
      }

      // ---------- board state ----------
      function resetBoard() {
        run = null; setRunning(false);
        bot.x = L.start.x; bot.y = L.start.y; bot.d = L.dir; bot.q = L.dir;
        bot.px = bot.x; bot.py = bot.y; bot.off = 0; bot.fall = 0; bot.gone = false;
        bot.mood = 'happy'; bot.arms = 'down';
        taken = L.bats.map(() => false); got = 0;
        trail.clear(); trail.add(bot.y * 100 + bot.x);
        banner = null; dirty = false;
        clearMarks();
      }
      function touch() {
        if (dirty) { resetBoard(); say(L.tip); }
      }
      const canEdit = () => !run && !locked && !api.over;
      function nope(text) { api.sfx('error'); say(text, 'bad'); }

      function add(cmd) {
        if (!canEdit()) return;
        if (cmd === 'P' && !L.f1) return;
        if (cmd === 'P' && area === 'f1') { nope('Run F1 goes in Main. Tap the Main row first.'); shakeRow('f1'); return; }
        const list = prog[area], lim = area === 'main' ? L.main : L.f1;
        if (list.length >= lim) {
          nope((area === 'main' ? 'Main' : 'F1') + ' is full. Tap a block to remove it' + (L.f1 && area === 'main' ? ', or use F1.' : '.'));
          shakeRow(area); return;
        }
        touch();
        list.push(cmd);
        api.tone({ F: 620, L: 520, R: 720, P: 820 }[cmd], 0.06, 'square', 0.035);
        if (tipEl.classList.contains('bad')) say(L.tip);
        renderRows(area); saveProg();
      }
      function removeAt(key, i) {
        if (!canEdit() || !prog[key][i]) return;
        touch();
        area = key;
        prog[key].splice(i, 1);
        api.tone(330, 0.07, 'square', 0.03, -120);
        renderRows(); saveProg();
      }
      function removeLast() {
        if (!canEdit()) return;
        if (!prog[area].length) { api.sfx('tick'); return; }
        removeAt(area, prog[area].length - 1);
      }
      function clearArea(key) {
        if (!canEdit()) return;
        area = key;
        if (prog[key].length) { touch(); prog[key] = []; api.sfx('zap'); saveProg(); }
        renderRows();
      }
      function selectArea(key) {
        if (!canEdit() || key === area || (key === 'f1' && !L.f1)) return;
        area = key; api.sfx('tick'); renderRows();
      }
      function shakeRow(key) {
        const b = rows[key].box;
        b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake');
      }
      function gotoLevel(i) {
        if (locked || api.over || i > data.open || i === idx) return;
        api.sfx('blip');
        loadLevel(i);
      }

      // ---------- running a program ----------
      function flatten() {
        const out = [];
        prog.main.forEach((c, i) => {
          out.push({ c, area: 'main', i, call: c === 'P' ? i : -1 });
          if (c === 'P') prog.f1.forEach((d, j) => out.push({ c: d, area: 'f1', i: j, call: i }));
        });
        return out;
      }
      function toggleRun() {
        if (locked || api.over) return;
        if (run) { resetBoard(); say(L.tip); api.sfx('click'); return; }
        if (!prog.main.length) {
          if (prog.f1.length) { nope('F1 only runs when Main uses it. Add Run F1 to Main.'); shakeRow('main'); }
          else nope('Add some blocks to Main first, then press Run.');
          return;
        }
        resetBoard();
        say('Running your program...', 'good');
        run = { steps: flatten(), k: -1, t: 0, dur: 0, kind: '' };
        setRunning(true);
        api.tone(440, 0.07, 'square', 0.04); api.tone(660, 0.09, 'square', 0.04, 0, 0.07);
        nextStep();
      }
      function nextStep() {
        run.k++;
        if (run.k >= run.steps.length) { mark(null); endRun(); return; }
        const s = run.steps[run.k];
        mark(s);
        run.t = 0;
        if (s.c === 'P') {
          run.kind = 'call'; run.dur = prog.f1.length ? T_CALL : T_CALL * 1.5;
          api.tone(700, 0.08, 'triangle', 0.045, 300);
          return;
        }
        if (s.c === 'L' || s.c === 'R') {
          run.kind = 'turn'; run.q0 = bot.q; run.q1 = bot.q + (s.c === 'L' ? -1 : 1); run.dur = T_TURN;
          api.tone(s.c === 'L' ? 400 : 480, 0.07, 'square', 0.03, s.c === 'L' ? -80 : 80);
          return;
        }
        const nx = bot.x + DX[bot.d], ny = bot.y + DY[bot.d];
        const cell = cellAt(L, nx, ny);
        if (cell === '#') { run.kind = 'bump'; run.dur = T_BUMP; run.hit = false; }
        else if (cell === ' ') { run.kind = 'fall'; run.dur = T_FALL; bot.mood = 'wow'; api.tone(620, 0.7, 'triangle', 0.05, -480, 0.2); }
        else { run.kind = 'move'; run.nx = nx; run.ny = ny; run.dur = T_MOVE; api.tone(260, 0.05, 'square', 0.025, 40); }
      }
      function updateRun(dt) {
        run.t += dt;
        const p = Math.min(1, run.t / run.dur);
        if (run.kind === 'move') {
          const e = ease(p);
          bot.px = bot.x + (run.nx - bot.x) * e; bot.py = bot.y + (run.ny - bot.y) * e;
        } else if (run.kind === 'turn') {
          bot.q = run.q0 + (run.q1 - run.q0) * ease(p);
        } else if (run.kind === 'bump') {
          const hitAt = 0.32;
          if (p < hitAt) bot.off = 0.3 * (p / hitAt) * (p / hitAt);
          else bot.off = 0.3 * (1 - (p - hitAt) / (1 - hitAt)) * (1 + 0.25 * Math.sin((p - hitAt) * 30));
          if (!run.hit && p >= hitAt) {
            run.hit = true;
            const hx = tileX(G, bot.x) + DX[bot.d] * G.t * 0.5, hy = tileY(G, bot.y) + DY[bot.d] * G.t * 0.5 - G.t * 0.2;
            fx.burst(hx, hy, [C.safety, '#fff3a0', C.hazard], 16, 240, { size: 3, life: 0.5 });
            shake.add(0.35); bot.mood = 'wow'; api.sfx('hit');
          }
        } else if (run.kind === 'fall') {
          bot.off = Math.min(1, p / 0.3) * 0.55;
          bot.fall = p < 0.3 ? 0 : (p - 0.3) / 0.7;
        }
        if (run.t >= run.dur) finishStep();
      }
      function finishStep() {
        const kind = run.kind;
        if (kind === 'move') {
          bot.x = run.nx; bot.y = run.ny; bot.px = bot.x; bot.py = bot.y;
          trail.add(bot.y * 100 + bot.x);
          L.bats.forEach((b, i) => {
            if (!taken[i] && b.x === bot.x && b.y === bot.y) {
              taken[i] = true; got++;
              const cx = tileX(G, b.x), cy = tileY(G, b.y) - G.t * 0.1;
              fx.burst(cx, cy, [C.good, '#c8ffd0', C.safety], 18, 200, { size: 3.5 });
              fx.float(got + ' / ' + L.bats.length, cx, cy - G.t * 0.35, C.good, { size: 18 });
              api.sfx('coin');
              if (got === L.bats.length) api.tone(880, 0.12, 'triangle', 0.04, 0, 0.12);
            }
          });
        } else if (kind === 'turn') {
          bot.q = run.q1; bot.d = mod4(run.q1);
        } else if (kind === 'bump') { bot.off = 0; fail('wall'); return; }
        else if (kind === 'fall') { bot.gone = true; fail('pit'); return; }
        nextStep();
      }
      function endRun() {
        const onPad = bot.x === L.pad.x && bot.y === L.pad.y;
        const left = L.bats.length - got;
        if (onPad && !left) solved();
        else fail(onPad ? 'bats' : 'short', left);
      }
      function fail(kind, left) {
        const step = run && run.steps[run.k];
        run = null; setRunning(false); dirty = true;
        bot.mood = 'sad';
        if (step && (kind === 'wall' || kind === 'pit')) {
          const e = rows[step.area].els[step.i];
          if (e) { e.classList.add('is-bad'); badEl = e; }
        }
        const plural = left === 1 ? 'honey cell' : 'honey cells';
        const M = {
          wall: ['BONK!', 'A wall is in the way.', 'Bonk! A wall is in the way. The red block is where it went wrong. Fix it and run again.'],
          pit: ['WHOOPS!', 'Your bot rolled off the edge.', 'Whoops! Your bot rolled off the edge. The red block is where it went wrong.'],
          short: ['NOT THERE YET', 'The program ended off the pad.', 'Your program ended before the charging pad. Add or change some blocks and run it again.'],
          bats: ['ALMOST!', left + ' ' + plural + ' left to grab.', 'You made it to the pad, but ' + left + ' ' + plural + (left === 1 ? ' is' : ' are') + ' still out there. Grab every honey cell first.']
        }[kind];
        banner = { title: M[0], sub: M[1], color: kind === 'bats' ? C.safety : C.hazard, t: 0 };
        say(M[2], 'bad');
        if (kind === 'pit') { shake.add(0.2); api.sfx('error'); }
        else if (kind !== 'wall') api.sfx('error');
      }
      function solved() {
        run = null; setRunning(false); dirty = true; locked = true;
        root.classList.add('is-locked');
        const blocks = prog.main.length + prog.f1.length;
        const stars = blocks <= L.best ? 3 : blocks <= L.best + 2 ? 2 : 1;
        bot.mood = 'happy'; bot.arms = 'up';
        data.stars[idx] = Math.max(data.stars[idx], stars);
        if (idx + 1 < N) data.open = Math.max(data.open, idx + 1);
        persist();
        showStars();
        sess[idx] = Math.max(sess[idx] || 0, stars);
        score = 0;
        for (const k in sess) score += 100 * sess[k];
        api.score(score);
        renderLevels();
        hints();
        const px = tileX(G, L.pad.x), py = tileY(G, L.pad.y);
        fx.burst(px, py, [C.safety, '#fff3a0', C.good], 30, 300, { size: 4, life: 0.9 });
        api.sfx('power');
        winFx = { stars, t: 0, popped: 0 };
        say('Charged! Solved with ' + blocks + ' blocks.', 'good');
        const last = idx === N - 1;
        const detail = 'Solved with ' + blocks + (blocks === 1 ? ' block: ' : ' blocks: ') + stars + ' of 3 stars.' +
          (stars < 3 ? ' Can you do it in ' + L.best + '?' : last ? ' You finished every level!' : '');
        api.after(1700, () => {
          const o = { score, title: 'Level ' + (idx + 1) + ' solved', detail, delay: 200 };
          const from = idx;
          if (!last) o.next = { label: 'Next level', run: () => loadLevel(from + 1) };
          api.win(o);
        });
      }

      // ---------- input ----------
      const focusStage = () => { try { api.stage.focus({ preventScroll: true }); } catch (e) { /* ignore */ } };
      api.on(root, 'click', e => {
        const b = e.target.closest('button');
        if (b && root.contains(b)) {
          if (e.detail > 0) { b.blur(); focusStage(); }
          const d = b.dataset;
          if (d.act === 'add') add(d.cmd);
          else if (d.act === 'remove') removeAt(d.area, Number(d.i));
          else if (d.act === 'clear') clearArea(d.area);
          else if (d.act === 'run') toggleRun();
          else if (d.act === 'reset') { if (!locked && !api.over) { resetBoard(); say(L.tip); api.sfx('click'); } }
          else if (d.act === 'level') gotoLevel(Number(d.i));
          return;
        }
        const row = e.target.closest('.ctb-prog');
        if (row && root.contains(row)) selectArea(row.dataset.area);
      });
      api.onKey((name, e) => {
        const onBtn = !!(e.target && e.target.tagName === 'BUTTON' && root.contains(e.target));
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
          if (onBtn) return;
          e.preventDefault(); toggleRun(); return;
        }
        if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); removeLast(); return; }
        if (e.repeat) return;
        if (name === 'up') add('F');
        else if (name === 'left') add('L');
        else if (name === 'right') add('R');
        else if (name === 'down') { if (L.f1) selectArea(area === 'main' ? 'f1' : 'main'); }
        else if (e.code === 'KeyF') add('P');
      });

      // ---------- render ----------
      function drawBotAt(t) {
        const ang = (bot.q - 1) * Math.PI / 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const bx = tileX(G, bot.px) + cos * bot.off * G.t, by = tileY(G, bot.py) + sin * bot.off * G.t;
        const up = Math.max(0, -sin);
        const running = !!run;
        if (bot.fall > 0) {
          const f = bot.fall, h = G.t * 0.92;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - f * 1.1);
          ctx.translate(bx, by + f * f * G.t * 0.9);
          ctx.rotate(f * 1.4 * (cos >= 0 ? 1 : -1));
          ctx.scale(1 - f * 0.75, 1 - f * 0.75);
          K.drawBot(ctx, 0, G.t * 0.26 - h * 0.5, h, Object.assign({}, api.player, { t, mood: 'wow', arms: 'up', look: cos, lookY: sin }));
          ctx.restore();
          return;
        }
        if (bot.gone) return;
        const arrowA = running || dirty ? 0.95 : 0.7 + Math.sin(t * 5) * 0.25;
        const dist = G.t * (0.44 + 0.22 * up);
        if (up < 0.3) drawArrow(ctx, bx, by, ang, G.t, arrowA, dist);
        const h = G.t * 0.92;
        const turning = run && run.kind === 'turn' ? Math.sin(Math.PI * Math.min(1, run.t / run.dur)) : 0;
        const walking = run && run.kind === 'move';
        const hop = walking ? Math.abs(Math.sin(Math.min(1, run.t / run.dur) * Math.PI)) * G.t * 0.05 : (running ? 0 : Math.sin(t * 2.2) * G.t * 0.012);
        ctx.save();
        ctx.translate(bx, by + G.t * 0.26);
        ctx.scale(1 - turning * 0.28, 1 + turning * 0.04);
        K.drawBot(ctx, 0, -h * 0.5 - hop, h, Object.assign({}, api.player, {
          t, mood: bot.mood, arms: bot.arms, look: cos, lookY: sin, walk: walking, flip: cos < -0.3, shadow: true
        }));
        ctx.restore();
        if (up >= 0.3) drawArrow(ctx, bx, by, ang, G.t, arrowA, dist);
      }

      function render(t) {
        ctx.save();
        shake.apply(ctx, 10);
        ctx.drawImage(layer, 0, 0, W, H);
        // tiles the bot has driven over
        ctx.fillStyle = 'rgba(90,209,230,0.13)';
        trail.forEach(k => {
          const x = k % 100, y = (k - x) / 100;
          K.rr(ctx, G.ox + x * G.t + 2, G.oy + y * G.t + 2, G.t - 4, G.t - 4 - G.th, 6);
        });
        // charging pad glow
        const ready = got === L.bats.length;
        const px = tileX(G, L.pad.x), py = tileY(G, L.pad.y);
        const pulse = 0.5 + 0.5 * Math.sin(t * (ready ? 5 : 2.5));
        ctx.save();
        ctx.globalAlpha = ready ? 0.55 + pulse * 0.4 : 0.25 + pulse * 0.2;
        ctx.fillStyle = ready ? C.safety : '#8a7420';
        boltPath(ctx, px, py, G.t * 0.41); ctx.fill();
        ctx.strokeStyle = ready ? C.good : C.safety; ctx.lineWidth = 2.5;
        ctx.globalAlpha *= 0.8;
        const ring = G.t * (0.4 + pulse * 0.06);
        K.rrPath(ctx, px - ring, py - ring, ring * 2, ring * 2, G.t * 0.16); ctx.stroke();
        ctx.restore();
        // walls, batteries and the bot, drawn back to front so nearer rows overlap farther ones
        const botKey = bot.py + 0.002;
        let drawn = false;
        for (let y = 0; y < L.h; y++) {
          if (!drawn && botKey < y) { drawBotAt(t); drawn = true; }
          const row = wallRows[y];
          for (let i = 0; i < row.length; i++) ctx.drawImage(wallSprite, G.ox + row[i] * G.t, G.oy + y * G.t - G.rise, G.t, G.t + G.rise);
          if (!drawn && botKey < y + 0.001) { drawBotAt(t); drawn = true; }
          for (let i = 0; i < L.bats.length; i++) {
            const b = L.bats[i];
            if (b.y === y && !taken[i]) drawBattery(ctx, tileX(G, b.x), tileY(G, b.y), G.t, t, i);
          }
        }
        if (!drawn) drawBotAt(t);
        fx.draw(ctx);
        ctx.restore();
        ctx.drawImage(vignette, 0, 0, W, H);
        // battery counter
        if (L.bats.length) {
          const txt = got + ' / ' + L.bats.length;
          ctx.font = K.font(20);
          const tw = ctx.measureText(txt).width;
          K.battery(ctx, W - 30 - tw, TOP / 2, 13, 22, got / L.bats.length || 0.001, ready ? C.good : C.safety);
          K.text(ctx, txt, W - 16, TOP / 2 + 1, { size: 20, color: ready ? C.good : C.ink, align: 'right' });
        }
        if (banner) drawBanner(t);
        if (winFx) drawWin();
      }
      function drawBanner() {
        const a = Math.min(1, banner.t * 5), slide = (1 - a) * 16;
        const bw = 440, bh = 74, bx = (W - bw) / 2, by = H - bh - 16 + slide;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(11,20,27,0.9)'; K.rr(ctx, bx, by, bw, bh, 12);
        ctx.strokeStyle = banner.color; ctx.lineWidth = 2.5; K.rrPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, 11); ctx.stroke();
        K.text(ctx, banner.title, W / 2, by + 26, { size: 24, color: banner.color });
        K.text(ctx, banner.sub, W / 2, by + 54, { size: 18, body: true, color: C.ink, shadow: false });
        ctx.restore();
      }
      function drawWin() {
        const w = winFx;
        if (api.over) w.fade = Math.min(1, (w.fade || 0) + 0.06);
        const a = Math.min(1, w.t * 4) * (1 - (w.fade || 0));
        if (a <= 0) return;
        const bw = 360, bh = 132, bx = (W - bw) / 2, by = (H - bh) / 2 + 10;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(11,20,27,0.88)'; K.rr(ctx, bx, by, bw, bh, 16);
        ctx.strokeStyle = C.good; ctx.lineWidth = 3; K.rrPath(ctx, bx + 1.5, by + 1.5, bw - 3, bh - 3, 15); ctx.stroke();
        K.text(ctx, 'CHARGED!', W / 2, by + 30, { size: 26, color: C.good });
        for (let i = 0; i < 3; i++) {
          const at = 0.35 + i * 0.28;
          if (w.t >= at && w.popped <= i) {
            w.popped = i + 1;
            if (i < w.stars) { api.tone(660 + i * 220, 0.14, 'square', 0.045); fx.burst(W / 2 + (i - 1) * 78, by + 86, [C.safety, '#fff3a0'], 12, 180, { size: 3 }); }
            else api.tone(220, 0.1, 'triangle', 0.04);
          }
          const pt = w.t - at;
          if (pt < 0) { drawStar(ctx, W / 2 + (i - 1) * 78, by + 86, 30, false); continue; }
          const s = pt < 0.18 ? 0.5 + pt / 0.18 * 0.7 : pt < 0.3 ? 1.2 - (pt - 0.18) / 0.12 * 0.2 : 1;
          ctx.save(); ctx.translate(W / 2 + (i - 1) * 78, by + 86); ctx.scale(s, s);
          drawStar(ctx, 0, 0, 30, i < w.stars);
          ctx.restore();
        }
        ctx.restore();
      }

      api.loop(dt => {
        time += dt;
        if (run) updateRun(dt);
        fx.update(dt); shake.update(dt);
        if (banner) banner.t += dt;
        if (winFx) winFx.t += dt;
        render(time);
      });

      // ---------- start at the first unsolved level ----------
      let first = data.stars.findIndex((s, i) => !s && i <= data.open);
      if (first < 0) first = data.stars.findIndex(s => s < 3);
      if (first < 0) first = 0;
      api.score(0);
      loadLevel(first);
    }
  });
})();
