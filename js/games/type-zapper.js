/* Type Zapper: rogue drones float down carrying words. Type a word and the turret robot
 * locks on and zaps that drone, letter by letter, before it reaches the shield line.
 * On phones a hidden text field inside the stage brings up the keyboard. */
(function () {
  'use strict';
  const K = window.BotKit;
  const C = K.C;

  const W = 800, H = 500;
  const BARRIER = 392, FLOOR = 440, TX = 400, TY = 466, BARREL = 60;
  const ZAP = '#9fdc6b';
  const WORDS = {
    short: ('bot gear bolt wire chip beep zap nut cog volt fan arm bug led amp fix fuse code data disk jet key lamp ' +
      'lens link oil pin plug pump rod tank tool cell bit byte beam dial grid hub ion spin unit fuel cam bulb coil ' +
      'dock hex kit log node port ray scan zip buzz hum ping axle weld saw').split(' '),
    medium: ('robot laser motor power servo magnet rocket button signal sensor spark radar cable meter pixel solar ' +
      'turbo clamp drill rover gizmo piston socket switch engine beacon charge widget drone alarm blink orbit pilot ' +
      'relay steel timer wrench valve crane boost screen energy hammer cursor laptop tablet modem remote rivet ' +
      'spring rotor metal').split(' '),
    long: ('circuit battery program android machine gadget computer antenna charger console control crystal digital ' +
      'factory gravity hologram keyboard magnetic network printer scanner science speaker station upgrade voltage ' +
      'robotics joystick microchip sprocket conveyor engineer inventor generator terminal gearbox toolbox ' +
      'spaceship satellite electric hardware software monitor reactor blueprint').split(' ')
  };
  const DRONE_COLORS = ['#c3a6ff', '#ff6fa8', '#ff8a5c', '#ff5a5a', '#f5c518'];
  const HEADS = ['box', 'dome', 'tv'];

  /** Share of short, medium and long words in a wave. */
  function mixFor(n) {
    if (n <= 1) return [1, 0, 0];
    if (n === 2) return [0.7, 0.3, 0];
    if (n === 3) return [0.4, 0.55, 0.05];
    if (n === 4) return [0.25, 0.55, 0.2];
    if (n === 5) return [0.15, 0.5, 0.35];
    return [0.1, 0.4, 0.5];
  }
  const speedFor = (n, len) => (20 + 5 * n) * (1.12 - 0.03 * len) * K.rand(0.9, 1.1);
  const intervalFor = n => Math.max(1, 2.9 - 0.25 * n);
  const maxOnFor = n => Math.min(8, 3 + Math.floor(n / 2));
  const multFor = combo => Math.min(5, 1 + Math.floor(combo / 12));

  // ---------- drawing helpers (shared with the card art) ----------
  function drawDrone(c, d, t, s) {
    const x = d.x, y = d.y;
    c.strokeStyle = C.steel; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y - s * 0.33); c.lineTo(x, y - s * 0.52); c.stroke();
    const bw = s * 0.5 * Math.abs(Math.cos(t * 26 + d.ph)) + 3;
    c.fillStyle = 'rgba(205,220,230,0.85)';
    c.beginPath(); c.ellipse(x, y - s * 0.54, bw, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.steel; K.circle(c, x, y - s * 0.54, 3.2);
    K.drawBot(c, x, y, s, { body: d.color, eye: '#ff4d4d', head: d.head, antenna: 'none', base: 'hover', mood: 'angry', arms: 'none', t: t + d.ph });
  }

  /** The word banner a drone carries. Typed letters glow green. */
  function drawLabel(c, d, fs, labelOff, locked, danger) {
    c.font = K.font(fs, 'body');
    const tw = c.measureText(d.word).width;
    const lh = fs + 14, w = tw + 24;
    let x = d.x;
    if (d.err > 0) x += Math.sin(d.err * 70) * 5;
    const y = d.y + labelOff;
    c.strokeStyle = 'rgba(139,154,166,0.7)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(d.x - 7, d.y + labelOff * 0.72); c.lineTo(x - w / 2 + 12, y); c.moveTo(d.x + 7, d.y + labelOff * 0.72); c.lineTo(x + w / 2 - 12, y); c.stroke();
    c.fillStyle = locked ? 'rgba(24,36,14,0.94)' : 'rgba(9,16,22,0.9)';
    K.rr(c, x - w / 2, y, w, lh, 8);
    c.strokeStyle = d.err > 0 ? C.bad : locked ? C.safety : danger ? C.hazard : 'rgba(111,135,150,0.65)';
    c.lineWidth = locked || d.err > 0 ? 3 : 2;
    K.rrPath(c, x - w / 2, y, w, lh, 8); c.stroke();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    const tx = x - tw / 2, ty = y + lh / 2 + 1;
    if (d.typed > 0) {
      const done = d.word.slice(0, d.typed);
      c.fillStyle = ZAP; c.fillText(done, tx, ty);
      c.fillStyle = C.ink; c.fillText(d.word.slice(d.typed), tx + c.measureText(done).width, ty);
    } else {
      c.fillStyle = C.ink; c.fillText(d.word, tx, ty);
    }
  }

  function drawReticle(c, x, y, r, t) {
    c.save(); c.translate(x, y); c.rotate(t * 1.6);
    c.strokeStyle = C.safety; c.lineWidth = 3; c.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      c.rotate(Math.PI / 2);
      c.beginPath(); c.moveTo(r - 9, r); c.lineTo(r, r); c.lineTo(r, r - 9); c.stroke();
    }
    c.restore();
  }

  /** The turret robot: a dome with a visor face and a laser barrel. ang 0 points straight up. */
  function drawTurret(c, x, y, ang, t, heat, hurt, look, dead) {
    c.save(); c.translate(x, y - 8); c.rotate(ang);
    c.fillStyle = '#26404f'; K.rr(c, -9, -BARREL + 8, 18, BARREL - 6, 5);
    c.fillStyle = '#4a6474'; c.fillRect(-5, -BARREL + 10, 4, BARREL - 14);
    c.fillStyle = C.steel; K.rr(c, -12, -BARREL, 24, 12, 4);
    c.fillStyle = dead ? '#33434e' : heat > 0 ? '#f4ffe8' : K.alpha(ZAP, 0.9); K.circle(c, 0, -BARREL, heat > 0 ? 6 : 4.5);
    c.restore();
    c.fillStyle = '#16242e'; K.rr(c, x - 48, y + 2, 96, 14, 6);
    c.fillStyle = dead ? '#56666f' : ZAP;
    c.beginPath(); c.arc(x, y + 4, 38, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.24)'; c.beginPath(); c.ellipse(x - 15, y - 20, 10, 5, -0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 38, y - 1, 76, 5);
    c.fillStyle = C.dark; K.rr(c, x - 24, y - 26, 48, 19, 8);
    const eye = hurt > 0 ? C.bad : C.eye, ex = look * 5, blink = dead || (t % 3.1) < 0.1;
    for (const sd of [-1, 1]) {
      const cx = x + sd * 9 + ex;
      if (blink) { c.fillStyle = dead ? '#6f8796' : eye; c.fillRect(cx - 4, y - 17.5, 8, 2); continue; }
      c.fillStyle = K.alpha(eye, 0.25); K.circle(c, cx, y - 16.5, 6.5);
      c.fillStyle = eye; K.circle(c, cx, y - 16.5, 4.2);
    }
    const leds = ['#ff5a5a', C.safety, C.good];
    for (let i = 0; i < 3; i++) { c.fillStyle = !dead && (Math.floor(t * 3) + i) % 3 ? leds[i] : '#33434e'; K.circle(c, x - 10 + i * 10, y + 9, 2.6); }
  }

  function hexShield(c, x, y, r, on) {
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
    c.fillStyle = on ? C.glow : '#16242e'; c.fill();
    c.strokeStyle = on ? '#bff6ff' : '#2b4353'; c.lineWidth = 2; c.stroke();
    if (on) { c.fillStyle = 'rgba(255,255,255,0.35)'; K.circle(c, x - r * 0.3, y - r * 0.3, r * 0.22); }
  }

  function drawBarrier(c, y, x0, x1, t, alpha, col) {
    c.fillStyle = K.alpha(col, 0.12 * alpha); c.fillRect(x0, y - 9, x1 - x0, 18);
    c.fillStyle = K.alpha(col, 0.85 * alpha); c.fillRect(x0, y - 2, x1 - x0, 4);
    c.fillStyle = 'rgba(255,255,255,' + (0.55 * alpha).toFixed(3) + ')';
    for (let x = x0 + ((t * 120) % 44); x < x1 - 10; x += 44) c.fillRect(x, y - 1, 14, 2);
  }

  function drawBackground(c) {
    K.bgFactory(c, W, H);
    // ceiling vents the drones slip out of
    c.fillStyle = '#0c151c'; c.fillRect(0, 0, W, 14);
    for (let x = 50; x < W - 60; x += 180) {
      c.fillStyle = '#060b0f'; K.rr(c, x, 3, 110, 20, 4);
      c.fillStyle = '#1b2a35';
      for (let k = 0; k < 6; k++) c.fillRect(x + 8 + k * 17, 7, 11, 12);
    }
    // floor
    c.fillStyle = '#0d171e'; c.fillRect(0, FLOOR, W, H - FLOOR);
    c.fillStyle = '#2b4353'; c.fillRect(0, FLOOR, W, 4);
    K.hazard(c, 0, H - 9, W, 9, { stripe: 10 });
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, H - 9, W, 9);
    // turret platform
    c.fillStyle = '#1b2a35';
    c.beginPath(); c.moveTo(TX - 90, H); c.lineTo(TX - 66, TY + 10); c.lineTo(TX + 66, TY + 10); c.lineTo(TX + 90, H); c.closePath(); c.fill();
    c.fillStyle = '#2b4353'; c.fillRect(TX - 66, TY + 10, 132, 3);
    // shield emitter posts
    for (const x of [14, W - 14]) {
      c.fillStyle = '#1b2a35'; K.rr(c, x - 9, BARRIER - 26, 18, FLOOR - BARRIER + 26, 4);
      c.fillStyle = '#2b4353'; K.rr(c, x - 6, BARRIER - 22, 12, FLOOR - BARRIER + 20, 3);
    }
    K.text(c, 'SHIELDS', 22, 458, { size: 12, body: true, color: C.muted, align: 'left', shadow: false });
  }

  Arcade.register({
    id: 'type-zapper',
    title: 'Type Zapper',
    cat: 'brain',
    blurb: 'Type the words to zap the drones before they land.',
    rules: [
      'Rogue drones float down carrying words. Type a word to zap its drone.',
      'Your first letter locks on to the closest matching drone. Backspace lets go.',
      'A drone that reaches the shield line knocks out one of your 3 shields.',
      'Every wave is faster and brings longer words.'
    ],
    how: 'Type the words · Backspace to switch target · on a phone, tap the screen to open the keyboard',
    accent: '#9fdc6b',
    usesPlayer: false,

    thumb(ctx, w, h) {
      K.bgFactory(ctx, w, h);
      ctx.fillStyle = '#0c151c'; ctx.fillRect(0, 0, w, 8);
      ctx.fillStyle = '#0d171e'; ctx.fillRect(0, 172, w, 28);
      ctx.fillStyle = '#2b4353'; ctx.fillRect(0, 172, w, 3);
      drawBarrier(ctx, 156, 6, w - 6, 0.3, 1, C.glow);
      const drones = [
        { word: 'robot', x: 96, y: 58, color: '#c3a6ff', head: 'tv', ph: 0.3, typed: 2, err: 0 },
        { word: 'zap', x: 228, y: 25, color: '#ff8a5c', head: 'dome', ph: 1.2, typed: 0, err: 0 },
        { word: 'gear', x: 272, y: 102, color: '#ff6fa8', head: 'box', ph: 2.1, typed: 0, err: 0 }
      ];
      ctx.save(); ctx.translate(160, 186); ctx.scale(0.62, 0.62); ctx.translate(-TX, -TY);
      const ang = Math.atan2(96 - 160, -(58 - 181));
      drawTurret(ctx, TX, TY, ang, 0.5, 1, 0, -0.8);
      ctx.restore();
      const mx = 160 + Math.sin(ang) * BARREL * 0.62, my = 186 - 5 - Math.cos(ang) * BARREL * 0.62;
      ctx.strokeStyle = K.alpha(ZAP, 0.4); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(96, 58); ctx.stroke();
      ctx.strokeStyle = '#f4ffe8'; ctx.lineWidth = 2.5; ctx.stroke();
      for (const d of drones) drawDrone(ctx, d, 0.4, 40);
      for (const d of drones) drawLabel(ctx, d, 15, 22, d.typed > 0, false);
      drawReticle(ctx, 96, 58, 26, 0.2);
      ctx.fillStyle = '#f4ffe8'; K.circle(ctx, 96, 58, 5);
      for (let k = 0; k < 3; k++) hexShield(ctx, 18 + k * 20, 187, 7, k < 2);
    },

    start(api) {
      const cv = api.canvas(W, H), ctx = cv.ctx;
      const bg = K.layer(W, H, drawBackground, 2);
      const fx = K.particles(), shake = K.shaker();
      const FS = api.isTouch ? 34 : 24, LH = FS + 14, DS = api.isTouch ? 56 : 50, LABEL_OFF = Math.round(DS * 0.56);

      let drones = [], target = null;
      let wave = 0, toSpawn = 0, spawnT = 0, between = 0, readyT = -1, started = false, over = false;
      let shields = 3, score = 0, combo = 0, zapped = 0, correct = 0, wrong = 0;
      let t = 0, aim = 0, heat = 0, turretErr = 0, redFlash = 0, barrierHit = 0, multShown = 1;
      let msg = null, focused = false, kbUsed = false;
      const beams = [], rings = [], recent = [], smoke = [];

      const hud = () => { api.score(score); };
      api.stat('Wave', 1);
      api.stat('Shields', shields);
      hud();

      // ---------- phone keyboard: a hidden field inside the stage ----------
      const input = api.el('input', {
        type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false',
        enterkeyhint: 'done', 'aria-label': 'Type the drone words here',
        style: {
          position: 'absolute', left: '50%', top: '0', width: '2px', height: '2px', opacity: '0', border: '0',
          padding: '0', margin: '0', fontSize: '16px', background: 'transparent', color: 'transparent',
          caretColor: 'transparent', pointerEvents: 'none'
        }
      });
      api.stage.appendChild(input);
      const SENT = ' ';   // a placeholder character, so Backspace always has something to delete
      let lastVal = SENT;
      function resetInput() {
        input.value = SENT; lastVal = SENT;
        try { input.setSelectionRange(1, 1); } catch (e) { /* field not focused yet */ }
      }
      resetInput();
      let openedAt = -1;
      function openKeyboard() {
        if (!api.isTouch || over) return;
        const already = document.activeElement === input;
        if (already && api.time - openedAt < 0.5) return;   // this tap already opened it
        if (already) input.blur();                          // Android: re-focus to bring a dismissed keyboard back
        openedAt = api.time;
        try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
        resetInput();
      }
      // A tap fires a compatibility mousedown after the touch, which would move focus to the stage
      // and close the keyboard again. Cancelling pointerdown suppresses those mouse events.
      api.on(cv.el, 'pointerdown', e => { if (api.isTouch && e.pointerType !== 'mouse') e.preventDefault(); });
      api.on(cv.el, 'touchend', openKeyboard);
      api.on(cv.el, 'click', openKeyboard);
      api.on(input, 'focus', () => { focused = true; begin(); });
      api.on(input, 'blur', () => { focused = false; });
      api.on(input, 'input', e => {
        const v = input.value;
        kbUsed = true;
        if (!api.over && started && !over) {
          let i = 0;
          while (i < v.length && i < lastVal.length && v[i] === lastVal[i]) i++;
          const added = v.slice(i);
          if (v.length < lastVal.length && !added.trim()) release();
          for (const ch of added.toLowerCase()) if (ch >= 'a' && ch <= 'z') typeChar(ch);
        }
        if (e.isComposing) lastVal = v; else resetInput();
      });
      api.on(input, 'compositionend', resetInput);

      // desktop keyboard (Android often reports 'Unidentified' here, so the field above covers phones)
      api.onKey((name, e) => {
        if (e.target === input || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key || '';
        if (k === 'Backspace') { e.preventDefault(); release(); return; }
        if (k.length === 1) {
          const ch = k.toLowerCase();
          if (ch >= 'a' && ch <= 'z') typeChar(ch);
        }
      });

      // ---------- waves ----------
      function begin() { if (!started && readyT < 0 && !over) readyT = 1.3; }
      function startWave(n) {
        wave = n; toSpawn = 5 + 2 * n; spawnT = 0.6; between = 0;
        api.toast('WAVE ' + n);
        api.stat('Wave', n);
        api.sfx('power');
      }
      function waveClear() {
        const bonus = 50 * wave;
        score += bonus; hud();
        msg = { text: 'WAVE ' + wave + ' CLEAR', sub: '+' + bonus, t: 2.2, color: ZAP };
        api.sfx('levelup');
        between = 2.4;
      }
      function pickWord() {
        const m = mixFor(wave), r = Math.random();
        const list = r < m[0] ? WORDS.short : r < m[0] + m[1] ? WORDS.medium : WORDS.long;
        const onScreen = drones.map(d => d.word), firsts = drones.map(d => d.word[0]);
        for (let k = 0; k < 24; k++) {
          const w = K.pick(list);
          if (onScreen.indexOf(w) >= 0 || recent.indexOf(w) >= 0) continue;
          if (k < 16 && firsts.indexOf(w[0]) >= 0) continue;
          recent.push(w); if (recent.length > 14) recent.shift();
          return w;
        }
        return K.pick(list.filter(w => onScreen.indexOf(w) < 0));
      }
      function spawnDrone() {
        const word = pickWord();
        ctx.font = K.font(FS, 'body');
        const half = ctx.measureText(word).width / 2 + 12 + 18;
        let bestX = W / 2, bestD = -1;
        for (let k = 0; k < 12; k++) {
          const x = K.rand(half + 14, W - half - 14);
          let dmin = 9999;
          for (const o of drones) if (o.y < 170) dmin = Math.min(dmin, Math.abs(o.x0 - x));
          if (dmin > bestD) { bestD = dmin; bestX = x; }
        }
        drones.push({
          word, x0: bestX, x: bestX, y: -DS * 0.62, vy: speedFor(wave, word.length),
          color: K.pick(DRONE_COLORS), head: K.pick(HEADS), ph: Math.random() * 6,
          wf: K.rand(0.8, 1.5), wa: K.rand(6, 14), t: 0, typed: 0, err: 0, dead: false
        });
      }

      // ---------- typing ----------
      function release() {
        if (target) { target.typed = 0; target = null; api.tone(300, 0.05, 'triangle', 0.035, -120); }
      }
      function typeChar(ch) {
        if (over || !started || !drones.length) return;
        if (!target || target.dead) {
          target = null;
          let best = null;
          for (const d of drones) if (!d.dead && d.word[0] === ch && (!best || d.y > best.y)) best = d;
          if (!best) { miss(null); return; }
          target = best; best.typed = 0;
        }
        if (target.word[target.typed] === ch) hit(target); else miss(target);
      }
      function aimAt(d) { return K.clamp(Math.atan2(d.x - TX, -(d.y - (TY - 8))), -1.4, 1.4); }
      function hit(d) {
        d.typed++; correct++; combo++;
        score += 10;
        aim = aimAt(d); heat = 0.1;
        const mx = TX + Math.sin(aim) * BARREL, my = TY - 8 - Math.cos(aim) * BARREL;
        beams.push({ x1: mx, y1: my, x2: d.x, y2: d.y, t: 0.12 });
        fx.burst(d.x, d.y, [ZAP, '#f4ffe8'], 5, 140, { lift: 20, life: 0.3, size: 2.5 });
        d.y -= 3;
        api.tone(620 + Math.min(10, d.typed) * 60, 0.05, 'square', 0.03, 260);
        if (d.typed >= d.word.length) destroy(d);
        const mult = multFor(combo);
        if (mult > multShown) { api.toast('COMBO ×' + mult, { color: ZAP }); }
        multShown = mult;
        hud();
      }
      function miss(d) {
        wrong++;
        if (combo >= 12) fx.float('Combo lost', TX, TY - 70, C.muted, { size: 15 });
        combo = 0; multShown = 1;
        if (d) d.err = 0.3; else turretErr = 0.3;
        api.sfx('error');
        shake.add(0.05);
      }
      function destroy(d) {
        d.dead = true; zapped++;
        if (target === d) target = null;
        const mult = multFor(combo), bonus = d.word.length * 10 * mult;
        score += bonus;
        fx.burst(d.x, d.y, [d.color, '#fff3a0', '#ff9d2e', '#ffffff'], 26, 300);
        fx.burst(d.x, d.y, ['#39505e', C.steel], 8, 180);
        fx.float('+' + bonus + (mult > 1 ? ' ×' + mult : ''), d.x, d.y - 26, mult > 1 ? C.safety : C.ink, { size: 20 });
        rings.push({ x: d.x, y: d.y, t: 0, color: ZAP });
        api.tone(190, 0.22, 'sawtooth', 0.045, -130); api.sfx('coin');
        shake.add(0.08);
      }
      function crash(d) {
        d.dead = true;
        if (target === d) target = null;
        shields--; combo = 0; multShown = 1;
        fx.burst(d.x, BARRIER, [C.bad, '#ff9d2e', '#fff3a0'], 30, 320);
        fx.burst(d.x, BARRIER, ['#39505e', C.steel], 10, 200);
        rings.push({ x: d.x, y: BARRIER, t: 0, color: C.bad });
        shake.add(0.45); redFlash = 0.35; barrierHit = 0.6;
        api.sfx('hit');
        api.stat('Shields', shields);
        if (shields <= 0) lose();
        else if (shields === 1) api.toast('LAST SHIELD!', { color: C.hazard });
      }
      function lose() {
        over = true; target = null;
        fx.burst(TX, TY - 20, [ZAP, C.hazard, '#fff3a0', C.steel], 40, 360);
        try { input.blur(); } catch (e) { /* ignore */ }
        const total = correct + wrong, acc = total ? Math.round(correct / total * 100) : 100;
        const detail = zapped
          ? 'You zapped ' + zapped + ' drone' + (zapped === 1 ? '' : 's') + ' and reached wave ' + wave + ' with ' + acc + '% accuracy.'
          : 'No drones zapped this time. Type the word under a drone to zap it.';
        api.gameOver({ score, title: 'Shields down', detail, delay: 1400 });
      }

      // ---------- update ----------
      function update(dt) {
        if (readyT > 0) {
          readyT -= dt;
          if (readyT <= 0) { readyT = 0; started = true; startWave(1); }
        }
        if (!started) return;
        if (between > 0) { between -= dt; if (between <= 0) startWave(wave + 1); }
        else if (toSpawn > 0) {
          spawnT -= dt;
          if (spawnT <= 0 && drones.length < maxOnFor(wave)) { spawnDrone(); toSpawn--; spawnT = intervalFor(wave) * K.rand(0.8, 1.2); }
        } else if (!drones.length) waveClear();
        for (const d of drones) {
          if (d.dead) continue;
          d.t += dt;
          d.y += d.vy * dt;
          d.x = d.x0 + Math.sin(d.t * d.wf + d.ph) * d.wa;
          if (d.err > 0) d.err -= dt;
          if (d.y + LABEL_OFF + LH >= BARRIER) { crash(d); if (over) break; }
        }
        drones = drones.filter(d => !d.dead);
      }

      // ---------- drawing ----------
      function drawTapPrompt(big) {
        const a = 0.8 + 0.2 * Math.sin(t * 4);
        const y = big ? 205 : 42, w = big ? 420 : 300, h = big ? 132 : 50;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(9,16,22,0.9)'; K.rr(ctx, W / 2 - w / 2, y - h / 2, w, h, 14);
        ctx.strokeStyle = C.safety; ctx.lineWidth = 3; K.rrPath(ctx, W / 2 - w / 2, y - h / 2, w, h, 14); ctx.stroke();
        if (big) {
          ctx.fillStyle = '#223845'; K.rr(ctx, W / 2 - 42, y - 50, 84, 44, 8);
          ctx.fillStyle = C.ink;
          for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) K.rr(ctx, W / 2 - 36 + k * 12.4, y - 44 + r * 12, 9, 9, 2);
          K.rr(ctx, W / 2 - 22, y - 20, 44, 8, 2);
          K.text(ctx, 'Tap here to type', W / 2, y + 30, { size: 34, color: C.safety });
        } else {
          K.text(ctx, 'Tap here to type', W / 2, y + 1, { size: 24, color: C.safety });
        }
        ctx.globalAlpha = 1;
      }

      function render(dt) {
        ctx.save();
        shake.apply(ctx, 12);
        ctx.drawImage(bg, 0, 0, W, H);
        // shield line
        if (shields > 0) {
          const low = shields === 1;
          const flick = low ? (Math.sin(t * 22) > 0.2 ? 1 : 0.45) : 1;
          const col = barrierHit > 0 ? C.bad : low ? C.hazard : C.glow;
          drawBarrier(ctx, BARRIER, 22, W - 22, t, flick * (0.55 + 0.15 * shields), col);
          for (const x of [14, W - 14]) { ctx.fillStyle = K.alpha(col, 0.9 * flick); K.circle(ctx, x, BARRIER, 6); }
        }
        // the small keyboard hint sits behind the drones so it never hides a word
        if (api.isTouch && !over && started && (!focused || !kbUsed)) drawTapPrompt(false);
        // drones, then their word banners, the locked one on top
        for (const d of drones) drawDrone(ctx, d, t, DS);
        for (const d of drones) if (d !== target) drawLabel(ctx, d, FS, LABEL_OFF, false, d.y + LABEL_OFF + LH > BARRIER - 90);
        if (target) {
          drawLabel(ctx, target, FS, LABEL_OFF, true, false);
          drawReticle(ctx, target.x, target.y, DS * 0.62, t);
        }
        for (let k = beams.length - 1; k >= 0; k--) {
          const b = beams[k];
          b.t -= dt;
          if (b.t <= 0) { beams.splice(k, 1); continue; }
          const a = b.t / 0.12;
          ctx.lineCap = 'round';
          ctx.strokeStyle = K.alpha(ZAP, 0.35 * a); ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
          ctx.strokeStyle = 'rgba(244,255,232,' + (0.95 * a).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = 'rgba(244,255,232,' + a.toFixed(3) + ')'; K.circle(ctx, b.x2, b.y2, 3 + 6 * a);
        }
        // turret robot
        let want = target ? aimAt(target) : Math.sin(t * 0.7) * 0.35;
        aim += (want - aim) * Math.min(1, dt * 12);
        drawTurret(ctx, TX, TY, over ? 0.5 : aim, t, heat, turretErr + redFlash, over ? 0 : K.clamp(aim, -1, 1), over);
        for (let k = rings.length - 1; k >= 0; k--) {
          const r = rings[k];
          r.t += dt;
          if (r.t > 0.35) { rings.splice(k, 1); continue; }
          K.ring(ctx, r.x, r.y, 12 + r.t * 200, 4 * (1 - r.t / 0.35), K.alpha(r.color, 1 - r.t / 0.35));
        }
        for (let k = smoke.length - 1; k >= 0; k--) {
          const p = smoke[k];
          p.life -= dt;
          if (p.life <= 0) { smoke.splice(k, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          const a = p.life / 1.2;
          ctx.fillStyle = 'rgba(150,162,172,' + (0.42 * a).toFixed(3) + ')';
          K.circle(ctx, p.x, p.y, p.r * (1.8 - a * 0.8));
        }
        fx.draw(ctx);
        // floor readouts
        for (let k = 0; k < 3; k++) hexShield(ctx, 34 + k * 30, 480, 11, k < shields);
        K.text(ctx, 'WAVE ' + Math.max(1, wave), W - 22, 460, { size: 16, color: C.ink, align: 'right' });
        const mult = multFor(combo);
        K.text(ctx, 'COMBO ' + combo + (mult > 1 ? '  ×' + mult : ''), W - 22, 482, { size: 14, body: true, color: combo ? ZAP : C.muted, align: 'right', shadow: false });
        if (readyT > 0) K.text(ctx, 'GET READY', W / 2, 200, { size: 40, color: C.safety });
        if (msg) {
          ctx.globalAlpha = Math.min(1, msg.t * 2);
          K.text(ctx, msg.text, W / 2, 190, { size: 38, color: msg.color });
          K.text(ctx, msg.sub, W / 2, 232, { size: 24, body: true, color: C.ink });
          ctx.globalAlpha = 1;
        }
        if (api.isTouch && !over && !started && !focused && readyT < 0) drawTapPrompt(true);
        if (redFlash > 0) { ctx.fillStyle = K.alpha(C.bad, redFlash * 0.45); ctx.fillRect(0, 0, W, H); }
        ctx.restore();
      }

      if (!api.isTouch) begin();
      else {
        // start() runs inside the Start / Play again click, so focusing now can open the keyboard at once
        openedAt = 0;
        try { input.focus({ preventScroll: true }); } catch (e) { /* the player can still tap */ }
        resetInput();
      }

      api.loop(dt => {
        t += dt;
        heat = Math.max(0, heat - dt);
        turretErr = Math.max(0, turretErr - dt);
        redFlash = Math.max(0, redFlash - dt);
        barrierHit = Math.max(0, barrierHit - dt);
        if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
        if (!over) update(dt);
        else if (Math.random() < dt * 6) smoke.push({ x: TX + K.rand(-16, 16), y: TY - 26, r: K.rand(6, 10), vx: K.rand(-10, 10), vy: K.rand(-44, -28), life: 1.2 });
        fx.update(dt); shake.update(dt);
        render(dt);
      });

      return () => { try { input.blur(); } catch (e) { /* already gone */ } };
    }
  });
})();
