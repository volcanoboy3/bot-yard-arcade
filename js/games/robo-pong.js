/* Robo Pong: first to 5 points against PONG-O-TRON, a robot that upgrades after every match
 * you win. Both robots watch from their control booths and react to every point.
 * Your score is how many matches you win in a row. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 800, H = 500;
  const TOP = 36, BOT = 464;                    // inner edges of the rails
  const BOOTH = 96;                             // control booth at each end
  const PAD_W = 14, PAD_H = 86;
  const PX = BOOTH + 28, CX = W - BOOTH - 28;   // paddle centres
  const R = 9, TRAIL = 10, WIN = 5;
  const BOT_Y = 206, BOT_H = 118, CONSOLE_Y = 256;
  const CPU = { name: 'PONG-O-TRON', body: '#ff5a5a', eye: '#ffe27a', head: 'tv', antenna: 'twin', base: 'treads' };

  // PONG-O-TRON's brain for match m: slow, late and sloppy at first, sharp by match 5.
  // Its aim error follows a bell curve that never shrinks to zero, so it can always be beaten.
  function cpuLevel(m) {
    const k = Math.min(1, (m - 1) / 4), extra = Math.max(0, m - 5);
    return {
      speed: Math.min(540, 250 + 220 * k + 12 * extra),          // top paddle speed, px/s
      react: Math.max(0.06, 0.24 - 0.15 * k - 0.006 * extra),    // seconds between looks at the ball
      sigma: Math.max(16, 44 - 17 * k - 1.6 * extra),            // spread of its aim error, px
      predict: 0.2 + 0.8 * k,                                    // how well it reads wall bounces
      aim: 0.8 * k                                               // how hard it angles its returns
    };
  }
  function gauss() {
    const g = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    return K.clamp(g, -3, 3);
  }

  // ---------- scenery ----------
  function drawCourt(c) {
    c.fillStyle = '#0b141b'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, TOP, 0, BOT);
    g.addColorStop(0, '#142633'); g.addColorStop(1, '#1b2e3b');
    c.fillStyle = g; c.fillRect(BOOTH, TOP, W - 2 * BOOTH, BOT - TOP);
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1.5;
    c.beginPath();
    for (let x = BOOTH + 38; x < W - BOOTH; x += 38) { c.moveTo(x, TOP); c.lineTo(x, BOT); }
    for (let y = TOP + 36; y < BOT; y += 36) { c.moveTo(BOOTH, y); c.lineTo(W - BOOTH, y); }
    c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(PX - 3, TOP + 6, 6, BOT - TOP - 12); c.fillRect(CX - 3, TOP + 6, 6, BOT - TOP - 12);
    c.fillStyle = K.alpha(C.glow, 0.28);
    for (let y = TOP + 12; y < BOT - 12; y += 26) K.rr(c, W / 2 - 3, y, 6, 14, 3);
    c.strokeStyle = K.alpha(C.glow, 0.15); c.lineWidth = 3;
    c.beginPath(); c.arc(W / 2, H / 2, 62, 0, Math.PI * 2); c.stroke();
    // rails
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, TOP); c.fillRect(0, BOT, W, H - BOT);
    K.hazard(c, BOOTH, TOP - 7, W - 2 * BOOTH, 7, { stripe: 10 });
    K.hazard(c, BOOTH, BOT, W - 2 * BOOTH, 7, { stripe: 10 });
    c.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = BOOTH + 20; x < W - BOOTH; x += 60) { K.circle(c, x, 14, 2.2); K.circle(c, x, H - 14, 2.2); }
    // booth interiors
    for (const x0 of [0, W - BOOTH]) {
      c.fillStyle = '#0f1b24'; c.fillRect(x0, TOP, BOOTH, BOT - TOP);
      c.fillStyle = 'rgba(255,255,255,0.03)';
      c.fillRect(x0 + 31, TOP, 2, BOT - TOP); c.fillRect(x0 + 63, TOP, 2, BOT - TOP);
      const lg = c.createLinearGradient(0, TOP, 0, TOP + 120);
      lg.addColorStop(0, 'rgba(90,209,230,0.12)'); lg.addColorStop(1, 'rgba(90,209,230,0)');
      c.fillStyle = lg; c.fillRect(x0, TOP, BOOTH, 120);
    }
  }
  function fitText(c, str, maxW, size) {
    let s = size;
    c.font = K.font(s, 'body');
    while (s > 9 && c.measureText(str).width > maxW) { s--; c.font = K.font(s, 'body'); }
    return s;
  }
  function drawBoothFront(c, player) {
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : W - BOOTH, cx = x0 + BOOTH / 2;
      const col = side < 0 ? player.body : CPU.body;
      c.fillStyle = '#16252f'; K.rr(c, x0 + 6, CONSOLE_Y, BOOTH - 12, 74, 8);
      c.fillStyle = '#2b4353'; K.rr(c, x0 + 6, CONSOLE_Y, BOOTH - 12, 9, [8, 8, 0, 0]);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x0 + 12, CONSOLE_Y + 2, BOOTH - 24, 1.5);
      c.fillStyle = '#0a1117'; K.rr(c, x0 + 15, CONSOLE_Y + 17, BOOTH - 30, 20, 4);
      c.strokeStyle = K.alpha(col, 0.7); c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = x0 + 19 + i * ((BOOTH - 38) / 12), y = CONSOLE_Y + 27 + Math.sin(i * 1.3 + side) * 5;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
      c.fillStyle = C.steel; c.fillRect(cx + 16, CONSOLE_Y + 46, 3, 14);
      c.fillStyle = col; K.circle(c, cx + 17.5, CONSOLE_Y + 45, 5);
      c.fillStyle = 'rgba(255,255,255,0.4)'; K.circle(c, cx + 16, CONSOLE_Y + 43.5, 1.6);
      c.fillStyle = '#0a1117'; K.rr(c, x0 + 14, CONSOLE_Y + 56, BOOTH - 28, 8, 3);
      // glass pane facing the court
      const gx = side < 0 ? BOOTH - 6 : W - BOOTH;
      c.fillStyle = K.alpha(C.glow, 0.14); c.fillRect(gx, TOP, 6, BOT - TOP);
      c.fillStyle = K.alpha(C.eye, 0.5); c.fillRect(gx + (side < 0 ? 4 : 1), TOP, 1.5, BOT - TOP);
      c.fillStyle = '#2b4353'; c.fillRect(gx - (side < 0 ? 2 : 0), TOP, 8, 6); c.fillRect(gx - (side < 0 ? 2 : 0), BOT - 6, 8, 6);
      // name plate
      const name = side < 0 ? String(player.name || 'YOU').toUpperCase() : CPU.name;
      c.fillStyle = '#0a1117'; K.rr(c, x0 + 7, TOP + 10, BOOTH - 14, 24, 6);
      c.fillStyle = col; c.fillRect(x0 + 7, TOP + 30, BOOTH - 14, 4);
      const size = fitText(c, name, BOOTH - 22, 13);
      K.text(c, name, cx, TOP + 21, { size, body: true, color: C.ink, shadow: false });
    }
  }
  function drawPaddle(c, x, y, col, glow) {
    const top = y - PAD_H / 2, left = x - PAD_W / 2;
    c.fillStyle = K.alpha(col, 0.16 + glow * 2.5); K.rr(c, left - 6, top - 6, PAD_W + 12, PAD_H + 12, 12);
    c.fillStyle = K.shade(col, -0.45); K.rr(c, left, top, PAD_W, PAD_H, 6);
    c.fillStyle = col; K.rr(c, left, top, PAD_W - 3, PAD_H - 3, 6);
    c.fillStyle = 'rgba(255,255,255,0.42)'; K.rr(c, left + 3, top + 8, 2.5, PAD_H - 18, 1.25);
    c.fillStyle = K.shade(col, -0.3); c.fillRect(left, y - 13, PAD_W - 3, 3); c.fillRect(left, y + 10, PAD_W - 3, 3);
    c.fillStyle = C.eye; K.circle(c, x - 1.5, y, 2.2);
  }
  function drawBallAt(c, x, y, glow) {
    if (glow) c.drawImage(glow, x - 26, y - 26, 52, 52);
    c.fillStyle = '#eafcff'; K.circle(c, x, y, R * 0.78);
    c.fillStyle = '#ffffff'; K.circle(c, x - 2.2, y - 2.2, R * 0.32);
    K.drawBee(c,x,y,R*2.1,0);
  }

  let GLOW = null;
  function glowSprite() {
    if (!GLOW) {
      GLOW = K.layer(52, 52, c => {
        const g = c.createRadialGradient(26, 26, 2, 26, 26, 26);
        g.addColorStop(0, 'rgba(191,246,255,0.95)'); g.addColorStop(0.35, 'rgba(90,209,230,0.42)'); g.addColorStop(1, 'rgba(90,209,230,0)');
        c.fillStyle = g; c.fillRect(0, 0, 52, 52);
      }, 2);
    }
    return GLOW;
  }

  Arcade.register({
    id: 'robo-pong', length: 'Quick matches · first to 5',
    title: 'Robo Bee Pong',
    cat: 'versus',
    blurb: 'Rally a glowing bee ball against PONG-O-TRON.',
    rules: [
      'Knock the ball past PONG-O-TRON. First to 5 points wins the match.',
      'Hit the ball with the edge of your paddle, or while moving, to angle it.',
      'Every match you win upgrades the robot. How many can you win in a row?'
    ],
    how: 'Move the mouse or drag · ↑ ↓ or W / S',
    accent: '#5ad1e6',
    usesPlayer: true,

    thumb(ctx, w, h, kit, player) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#142633'); g.addColorStop(1, '#1b2e3b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 10; x < w; x += 30) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 20; y < h; y += 30) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      ctx.fillStyle = kit.alpha(C.glow, 0.3);
      for (let y = 20; y < h - 16; y += 18) kit.rr(ctx, w / 2 - 2, y, 4, 10, 2);
      ctx.strokeStyle = kit.alpha(C.glow, 0.15); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(w / 2, h / 2 + 4, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#0c151c'; ctx.fillRect(0, 0, w, 12); ctx.fillRect(0, h - 12, w, 12);
      kit.hazard(ctx, 0, 10, w, 5, { stripe: 8 }); kit.hazard(ctx, 0, h - 14, w, 5, { stripe: 8 });
      kit.drawBot(ctx, 42, 98, 104, Object.assign({}, player, { mood: 'happy', arms: 'up', look: 1, t: 0.3 }));
      kit.drawBot(ctx, w - 42, 98, 104, Object.assign({}, CPU, { mood: 'angry', look: 1, flip: true, t: 0.3 }));
      for (const [x0, col] of [[2, player.body], [w - 84, CPU.body]]) {
        ctx.fillStyle = '#16252f'; kit.rr(ctx, x0, 136, 82, 46, 7);
        ctx.fillStyle = '#2b4353'; kit.rr(ctx, x0, 136, 82, 7, [7, 7, 0, 0]);
        ctx.fillStyle = '#0a1117'; kit.rr(ctx, x0 + 9, 149, 64, 16, 3);
        ctx.strokeStyle = kit.alpha(col, 0.8); ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const x = x0 + 13 + i * 5.6, y = 157 + Math.sin(i * 1.4) * 4; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      ctx.save(); ctx.translate(108, 112); ctx.scale(0.7, 0.7); drawPaddle(ctx, 0, 0, player.body, 0); ctx.restore();
      ctx.save(); ctx.translate(w - 108, 70); ctx.scale(0.7, 0.7); drawPaddle(ctx, 0, 0, CPU.body, 0); ctx.restore();
      const bx = 188, by = 78;
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = kit.alpha(C.glow, 0.07 + i * 0.05);
        kit.circle(ctx, bx - (7 - i) * 10, by + (7 - i) * 4.5, 6 * (0.4 + i * 0.09));
      }
      const gl = ctx.createRadialGradient(bx, by, 2, bx, by, 20);
      gl.addColorStop(0, 'rgba(191,246,255,0.95)'); gl.addColorStop(1, 'rgba(90,209,230,0)');
      ctx.fillStyle = gl; kit.circle(ctx, bx, by, 20);
      ctx.fillStyle = '#eafcff'; kit.circle(ctx, bx, by, 6.5);
      kit.text(ctx, '3', w / 2 - 22, 34, { size: 22, color: player.body });
      kit.text(ctx, ':', w / 2, 33, { size: 18, color: C.ink });
      kit.text(ctx, '2', w / 2 + 22, 34, { size: 22, color: CPU.body });
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const court = K.layer(W, H, drawCourt, 2);
      const front = K.layer(W, H, c => drawBoothFront(c, api.player), 2);
      const vignette = K.layer(W, H, c => K.vignette(c, W, H, 0.3), 1);
      const glow = glowSprite();
      const fx = K.particles(), sh = K.shaker();
      const pBot = Object.assign({}, api.player, { t: 0, mood: 'happy', arms: 'down', look: 1, lookY: 0 });
      const cBot = Object.assign({}, CPU, { t: 0, mood: 'neutral', arms: 'down', look: 1, lookY: 0, flip: true });
      const tx = new Float32Array(TRAIL), ty = new Float32Array(TRAIL);

      const S = {
        t: 0, phase: 'count', phaseT: 0, count: 0, go: 0, banner: null,
        match: 1, won: 0, pp: 0, cp: 0, rally: 0, ai: cpuLevel(1),
        py: H / 2, pvy: 0, ptarget: null, down: false, rel: null,
        cy: H / 2, cvy: 0, cpuTarget: H / 2, cpuClock: 0, cpuErr: 0, cpuAim: 0,
        bx: W / 2, by: H / 2, dx: 1, dy: 0, speed: 330, startSpeed: 330, maxSpeed: 760,
        serveTo: 'cpu', ti: 0, tn: 0,
        pMood: 'happy', pArms: 'down', cMood: 'neutral', cArms: 'down', pHurt: 0, cHurt: 0,
        pHit: 0, cHit: 0, crack: null
      };

      // ---------- input ----------
      // The paddle follows the pointer's y. A drag that starts above or below the court (phones in
      // portrait have room there) steers relative to where it began, so a finger need not cover the court.
      // A see-through layer over the whole stage takes the touches, so the browser never pans.
      const pad = api.el('div', { style: { position: 'absolute', inset: '0', touchAction: 'none' } });
      api.stage.appendChild(pad);
      api.on(pad, 'pointerdown', e => {
        S.down = true; K.capture(pad, e);
        const p = cv.toLocal(e);
        if (e.pointerType === 'mouse' || (p.y >= 0 && p.y <= H)) { S.rel = null; S.ptarget = p.y; }
        else S.rel = { y0: p.y, p0: S.py };
      });
      api.on(pad, 'pointermove', e => {
        if (e.pointerType !== 'mouse' && !S.down) return;
        const p = cv.toLocal(e);
        if (!S.rel) { S.ptarget = p.y; return; }
        let y = S.rel.p0 + (p.y - S.rel.y0);
        const lo = TOP + PAD_H / 2, hi = BOT - PAD_H / 2;
        if (y < lo) { S.rel.y0 -= lo - y; y = lo; } else if (y > hi) { S.rel.y0 += y - hi; y = hi; }
        S.ptarget = y;
      });
      const release = () => { S.down = false; S.rel = null; };
      api.on(pad, 'pointerup', release);
      api.on(pad, 'pointercancel', release);

      // ---------- match flow ----------
      function startCount() {
        S.phase = 'count'; S.count = 1.8; S.banner = null;
        S.bx = W / 2; S.by = H / 2 + K.rand(-90, 90); S.tn = 0;
      }
      function serve() {
        S.phase = 'play'; S.rally = 0; S.go = 0.5;
        S.speed = S.startSpeed;
        const dir = S.serveTo === 'cpu' ? 1 : -1, a = K.rand(-0.42, 0.42);
        S.dx = Math.cos(a) * dir; S.dy = Math.sin(a);
        S.pArms = 'down'; S.cArms = 'down';
        S.pMood = 'happy'; S.cMood = S.match >= 3 ? 'angry' : 'neutral';
        if (dir > 0) rollCpu();
        api.sfx('blip');
      }
      function rollCpu() {
        const heat = 0.75 + 0.5 * (S.speed - S.startSpeed) / (S.maxSpeed - S.startSpeed);  // fast rallies rattle it
        S.cpuErr = gauss() * S.ai.sigma * heat;
        S.cpuAim = S.ai.aim > 0.05 ? (S.py < H / 2 ? 1 : -1) * S.ai.aim * K.rand(0.25, 0.7) * (PAD_H / 2) : 0;
        S.cpuClock = S.ai.react;
      }
      function point(who) {
        S.phase = 'point'; S.phaseT = 1.3;
        const hitLeft = who === 'cpu';
        const gx = hitLeft ? BOOTH - 3 : W - BOOTH + 3;
        S.crack = { x: gx, y: K.clamp(S.by, TOP + 20, BOT - 20), dir: hitLeft ? 1 : -1, t: 1.3 };
        fx.burst(gx, S.by, [C.glow, '#ffffff', hitLeft ? pBot.body : CPU.body], 30, 340, { life: 0.7 });
        sh.add(0.35);
        if (who === 'player') {
          S.pp++;
          S.pMood = 'happy'; S.pArms = 'up'; S.cMood = 'angry'; S.cHurt = 0.5;
          S.banner = { text: 'POINT!', color: C.good };
          api.sfx('coin');
        } else {
          S.cp++;
          S.cMood = 'happy'; S.cArms = 'up'; S.pMood = 'sad'; S.pHurt = 0.5;
          S.banner = { text: 'PONG-O-TRON SCORES', color: C.hazard };
          api.sfx('hit');
        }
        S.serveTo = who === 'player' ? 'cpu' : 'player';
      }
      function afterPoint() {
        if (S.pp >= WIN) matchWon();
        else if (S.cp >= WIN) matchLost();
        else startCount();
      }
      function matchWon() {
        S.phase = 'done'; S.won++; S.banner = null;
        api.score(S.won);
        S.pMood = 'happy'; S.pArms = 'wave'; S.cMood = 'sad'; S.cArms = 'down';
        api.win({
          score: S.won, scoreLabel: 'Matches won', title: 'Match won!',
          detail: 'You beat PONG-O-TRON ' + S.pp + ' to ' + S.cp + ', so it is upgrading to level ' + (S.match + 1) + '.',
          next: { label: 'Next match', run: nextMatch }
        });
      }
      function matchLost() {
        S.phase = 'done'; S.banner = null;
        S.pMood = 'sad'; S.pArms = 'down'; S.cMood = 'happy'; S.cArms = 'up';
        const detail = S.won === 0
          ? 'PONG-O-TRON won ' + S.cp + ' to ' + S.pp + ', so try hitting with the edge of your paddle to angle the ball.'
          : 'You won ' + S.won + ' match' + (S.won === 1 ? '' : 'es') + ' in a row before PONG-O-TRON beat you ' + S.cp + ' to ' + S.pp + '.';
        api.gameOver({ score: S.won, scoreLabel: 'Matches won', title: 'PONG-O-TRON wins', detail, delay: 900 });
      }
      function nextMatch() {
        S.match++; S.ai = cpuLevel(S.match);
        S.startSpeed = Math.min(470, 330 + 22 * (S.match - 1));
        S.maxSpeed = Math.min(1000, 760 + 40 * (S.match - 1));
        S.pp = 0; S.cp = 0; S.serveTo = 'cpu';
        S.pMood = 'happy'; S.pArms = 'down'; S.cMood = S.match >= 3 ? 'angry' : 'neutral'; S.cArms = 'down';
        api.stat('Match', S.match);
        api.toast('MATCH ' + S.match);
        api.sfx('power');
        startCount();
      }

      // ---------- physics ----------
      function predictY(xLine) {
        if (S.dx <= 0) return S.by;
        const y = S.by + S.dy * ((xLine - S.bx) / S.dx);
        const top = TOP + R, span = BOT - R - top;
        let m = (y - top) % (2 * span);
        if (m < 0) m += 2 * span;
        return top + (m > span ? 2 * span - m : m);
      }
      function bounce(dirX, padY, padVy, byPlayer) {
        const off = K.clamp((S.by - padY) / (PAD_H / 2 + R), -1, 1);
        const ang = off * 0.92;
        let dx = Math.cos(ang) * dirX, dy = Math.sin(ang) + K.clamp(padVy / 1500, -0.35, 0.35);
        const len = Math.hypot(dx, dy);
        dx /= len; dy /= len;
        if (Math.abs(dx) < 0.5) { dx = 0.5 * dirX; dy = (dy < 0 ? -1 : 1) * Math.sqrt(0.75); }
        S.dx = dx; S.dy = dy;
        S.speed = Math.min(S.maxSpeed, S.speed * 1.045 + 7);
        S.rally++;
        fx.burst(S.bx, S.by, [byPlayer ? pBot.body : CPU.body, '#ffffff', C.glow], 12, 220, { life: 0.4, lift: 0, gravity: 0 });
        sh.add(0.06);
        if (byPlayer) { S.pHit = 0.15; api.tone(520 + Math.min(S.rally, 20) * 14, 0.06, 'square', 0.045); rollCpu(); }
        else { S.cHit = 0.15; api.tone(390 + Math.min(S.rally, 20) * 10, 0.06, 'square', 0.04); }
        if (S.rally === 10 || S.rally === 20 || S.rally === 30) fx.float('RALLY ' + S.rally + '!', W / 2, 90, C.safety, { size: 20, life: 1.2, speed: 30 });
      }
      function moveBall(dt) {
        const x0 = S.bx, y0 = S.by, step = S.speed * dt;
        S.bx += S.dx * step; S.by += S.dy * step;
        if (S.by < TOP + R) { S.by = 2 * (TOP + R) - S.by; S.dy = Math.abs(S.dy); api.tone(260, 0.04, 'square', 0.025); }
        else if (S.by > BOT - R) { S.by = 2 * (BOT - R) - S.by; S.dy = -Math.abs(S.dy); api.tone(260, 0.04, 'square', 0.025); }
        const pf = PX + PAD_W / 2 + R;
        if (S.dx < 0 && x0 >= pf && S.bx < pf) {
          const yAt = y0 + (S.by - y0) * (x0 - pf) / (x0 - S.bx);
          if (Math.abs(yAt - S.py) <= PAD_H / 2 + R * 0.75) { S.bx = pf; S.by = K.clamp(yAt, TOP + R, BOT - R); bounce(1, S.py, S.pvy, true); return; }
        }
        const cf = CX - PAD_W / 2 - R;
        if (S.dx > 0 && x0 <= cf && S.bx > cf) {
          const yAt = y0 + (S.by - y0) * (cf - x0) / (S.bx - x0);
          if (Math.abs(yAt - S.cy) <= PAD_H / 2 + R * 0.75) { S.bx = cf; S.by = K.clamp(yAt, TOP + R, BOT - R); bounce(-1, S.cy, S.cvy, false); return; }
        }
        if (S.bx - R < BOOTH) point('cpu');
        else if (S.bx + R > W - BOOTH) point('player');
      }
      function updatePlayer(dt) {
        const dir = (api.keys.down ? 1 : 0) - (api.keys.up ? 1 : 0);
        const prev = S.py;
        if (dir) { S.ptarget = null; S.py += dir * 560 * dt; }
        else if (S.ptarget != null) S.py += K.clamp(S.ptarget - S.py, -1800 * dt, 1800 * dt);
        S.py = K.clamp(S.py, TOP + PAD_H / 2, BOT - PAD_H / 2);
        S.pvy += ((S.py - prev) / Math.max(dt, 0.001) - S.pvy) * 0.5;
      }
      function updateCpu(dt) {
        S.cpuClock -= dt;
        if (S.cpuClock <= 0) {
          S.cpuClock = S.ai.react;
          if (S.phase === 'play' && S.dx > 0) {
            S.cpuTarget = K.lerp(S.by, predictY(CX - PAD_W / 2 - R), S.ai.predict) + S.cpuErr - S.cpuAim;
          } else S.cpuTarget = K.lerp(H / 2, S.by, 0.3);
        }
        const want = K.clamp((S.cpuTarget - S.cy) * 9, -S.ai.speed, S.ai.speed);
        S.cvy += (want - S.cvy) * Math.min(1, dt * 14);
        S.cy = K.clamp(S.cy + S.cvy * dt, TOP + PAD_H / 2, BOT - PAD_H / 2);
      }
      function update(dt) {
        updatePlayer(dt);
        updateCpu(dt);
        if (S.phase === 'count') {
          const before = Math.ceil(S.count / 0.6);
          S.count -= dt;
          const now = Math.ceil(S.count / 0.6);
          if (S.count <= 0) serve();
          else if (now !== before) api.sfx('tick');
        } else if (S.phase === 'play') {
          moveBall(dt);
          tx[S.ti] = S.bx; ty[S.ti] = S.by; S.ti = (S.ti + 1) % TRAIL;
          if (S.tn < TRAIL) S.tn++;
        } else if (S.phase === 'point') {
          S.phaseT -= dt;
          if (S.phaseT <= 0) afterPoint();
        }
      }

      // ---------- drawing ----------
      function drawBots(c) {
        const lookX = S.phase === 'play' || S.phase === 'count' ? S.bx : W / 2;
        const lookY = S.phase === 'play' || S.phase === 'count' ? S.by : BOT_Y;
        pBot.t = S.t; pBot.mood = S.pMood; pBot.arms = S.pArms;
        pBot.look = K.clamp((lookX - BOOTH / 2) / 240, -1, 1);
        pBot.lookY = K.clamp((lookY - BOT_Y + 24) / 150, -1, 1);
        cBot.t = S.t + 1.7; cBot.mood = S.cMood; cBot.arms = S.cArms;
        cBot.look = K.clamp((W - BOOTH / 2 - lookX) / 240, -1, 1);
        cBot.lookY = pBot.lookY;
        const pj = S.pHurt > 0 ? Math.sin(S.t * 70) * 5 * S.pHurt : 0;
        const cj = S.cHurt > 0 ? Math.sin(S.t * 70) * 5 * S.cHurt : 0;
        K.drawBot(c, BOOTH / 2 + pj, BOT_Y, BOT_H, pBot);
        K.drawBot(c, W - BOOTH / 2 + cj, BOT_Y, BOT_H, cBot);
      }
      function drawConsoleLights(c) {
        for (const side of [-1, 1]) {
          const x0 = side < 0 ? 0 : W - BOOTH;
          for (let i = 0; i < 4; i++) {
            const on = (Math.floor(S.t * 3 + i * 1.7 + side) % 3) !== 0;
            c.fillStyle = on ? (i % 2 ? C.good : C.safety) : '#33434e';
            K.circle(c, x0 + 19 + i * 9, CONSOLE_Y + 60, 2.2);
          }
        }
      }
      function drawCrack(c) {
        const k = S.crack;
        if (!k) return;
        c.globalAlpha = K.clamp(k.t, 0, 1);
        c.strokeStyle = '#dffbff'; c.lineWidth = 1.6; c.lineCap = 'round';
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = -1.2 + i * 0.48, len = 16 + (i % 3) * 9;
          c.moveTo(k.x, k.y);
          c.lineTo(k.x - k.dir * Math.cos(a) * len * 0.25, k.y + Math.sin(a) * len);
        }
        c.stroke();
        c.fillStyle = 'rgba(223,251,255,0.35)'; K.circle(c, k.x, k.y, 6);
        c.globalAlpha = 1;
      }
      function drawBall(c) {
        for (let i = 0; i < S.tn; i++) {
          const idx = (S.ti - S.tn + i + TRAIL) % TRAIL, a = (i + 1) / (S.tn + 1);
          c.globalAlpha = a * 0.4;
          c.fillStyle = C.glow; K.circle(c, tx[idx], ty[idx], R * (0.3 + 0.6 * a));
        }
        c.globalAlpha = 1;
        drawBallAt(c, S.bx, S.by, glow);
      }
      function drawHud(c) {
        K.text(c, String(S.pp), BOOTH / 2, 392, { size: 62, color: pBot.body });
        K.text(c, String(S.cp), W - BOOTH / 2, 392, { size: 62, color: CPU.body });
        K.text(c, 'LV ' + S.match, W - BOOTH / 2, 434, { size: 14, body: true, color: C.muted, shadow: false });
        K.text(c, 'YOU', BOOTH / 2, 434, { size: 14, body: true, color: C.muted, shadow: false });
        K.text(c, 'MATCH ' + S.match + ' · FIRST TO ' + WIN, W / 2, 18, { size: 15, body: true, color: C.muted, shadow: false });
        if (S.phase === 'count') {
          const n = Math.max(1, Math.ceil(S.count / 0.6));
          const f = S.count / 0.6 - (n - 1);
          c.save();
          c.translate(W / 2, H / 2 - 70);
          c.scale(0.8 + f * 0.4, 0.8 + f * 0.4);
          K.text(c, String(n), 0, 0, { size: 76, color: C.safety });
          c.restore();
          if (S.pp === 0 && S.cp === 0) K.text(c, S.match === 1 ? 'FIRST TO 5 WINS' : 'PONG-O-TRON LEVEL ' + S.match, W / 2, H / 2 + 70, { size: 20, body: true, color: C.ink });
        }
        if (S.go > 0) {
          c.globalAlpha = K.clamp(S.go * 3, 0, 1);
          K.text(c, 'GO!', W / 2, H / 2 - 70, { size: 60, color: C.good });
          c.globalAlpha = 1;
        }
        if (S.banner && S.phase === 'point') {
          c.globalAlpha = K.clamp(S.phaseT * 3, 0, 1);
          K.text(c, S.banner.text, W / 2, H / 2 - 60, { size: 34, color: S.banner.color });
          K.text(c, S.pp + '  :  ' + S.cp, W / 2, H / 2 - 12, { size: 30, color: C.ink });
          c.globalAlpha = 1;
        }
      }
      function render() {
        ctx.fillStyle = '#0b141b'; ctx.fillRect(0, 0, W, H);
        ctx.save();
        sh.apply(ctx, 10);
        ctx.drawImage(court, 0, 0, W, H);
        drawBots(ctx);
        ctx.drawImage(front, 0, 0, W, H);
        drawConsoleLights(ctx);
        drawCrack(ctx);
        drawPaddle(ctx, PX, S.py, pBot.body, S.pHit);
        drawPaddle(ctx, CX, S.cy, CPU.body, S.cHit);
        if (S.phase === 'play') drawBall(ctx);
        else if (S.phase === 'count') {
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(S.t * 12);
          drawBallAt(ctx, S.bx, S.by, glow);
          ctx.globalAlpha = 1;
        }
        fx.draw(ctx);
        drawHud(ctx);
        ctx.restore();
        ctx.drawImage(vignette, 0, 0, W, H);
      }

      api.score(0);
      api.stat('Match', 1);
      api.toast('MATCH 1');
      startCount();
      api.loop(dt => {
        S.t += dt;
        if (S.phase !== 'done') update(dt);
        else { updatePlayer(dt); updateCpu(dt); }
        S.go = Math.max(0, S.go - dt);
        S.pHurt = Math.max(0, S.pHurt - dt); S.cHurt = Math.max(0, S.cHurt - dt);
        S.pHit = Math.max(0, S.pHit - dt); S.cHit = Math.max(0, S.cHit - dt);
        if (S.crack) { S.crack.t -= dt; if (S.crack.t <= 0) S.crack = null; }
        fx.update(dt); sh.update(dt);
        render();
      });
    }
  });
})();
