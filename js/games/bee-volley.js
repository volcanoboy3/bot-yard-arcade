/* A short robot-and-bee sports match: first to five, best of three rounds. */
(function () {
  'use strict';
  const K = BotKit, W = 800, H = 500, FLOOR = 450, NET = 305;
  const rival = { body: '#ffc949', eye: '#fff8c4', head: 'dome', antenna: 'twin', base: 'legs' };
  function court(c, t) {
    c.fillStyle = '#173747'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 80, 0, FLOOR); g.addColorStop(0, '#234e62'); g.addColorStop(1, '#528b89'); c.fillStyle = g; c.fillRect(0, 80, W, FLOOR - 80);
    for (let i = 0; i < 9; i++) { K.drawFlower(c, 35 + i * 91, 465, 22, i % 2 ? '#ffd1df' : '#fff4c0'); K.drawBee(c, 30 + i * 91, 100 + Math.sin(t * 2 + i) * 10, 19, t + i); }
    c.fillStyle = '#cfb980'; c.fillRect(0, FLOOR, W, 9); c.fillStyle = '#2a5555'; c.fillRect(0, FLOOR + 9, W, 41);
    c.fillStyle = '#f6db9d'; K.rr(c, W / 2 - 5, NET, 10, FLOOR - NET, 4);
    c.strokeStyle = '#c9f3e25'; c.lineWidth = 2;
    for (let y = NET + 8; y < FLOOR; y += 12) { c.beginPath(); c.moveTo(390, y); c.lineTo(410, y); c.stroke(); }
  }
  Arcade.register({
    id: 'bee-volley', length: 'Quick match · best of 3 rounds', title: 'Bee Volley', cat: 'versus', accent: '#ffcf63', usesPlayer: true,
    blurb: 'A quick beach match with a bee ball. First to 5 points, best of 3 rounds.',
    rules: ['Move your robot under the bee ball and jump to bounce it across the net.', 'A ball landing on your side gives Bee-Bot a point. First to 5 wins a round.', 'Win 2 rounds to take the match. Moving into a hit changes your shot.'],
    how: '← → or A / D move · Space to jump · Touch buttons below the court',
    touch: ['left', 'right', { key: 'fire', label: 'Jump' }],
    thumb(c, w, h, kit, p) { c.save(); c.scale(w / W, h / H); court(c, .3); K.drawBot(c, 190, 360, 110, { ...p, arms: 'up' }); K.drawBot(c, 620, 365, 100, { ...rival, arms: 'up' }); K.drawBee(c, 380, 210, 60, .4); K.text(c, 'BEST OF 3', 400, 45, { size: 36, color: '#ffe5a0' }); c.restore(); },
    start(api) {
      const cv = api.canvas(W, H), c = cv.ctx;
      let t = 0, round = 1, rounds = [0, 0], points = [0, 0], phase = 'serve', timer = 1.5, banner = 'ROUND 1 · FIRST TO 5', server = 0, jumpHeld = false;
      const p = { x: 170, y: FLOOR - 30, vy: 0, vx: 0 }, cpu = { x: 630, y: FLOOR - 30, vy: 0, vx: 0 }, b = { x: 180, y: 140, vx: 0, vy: 0 };
      const fx = K.particles();
      function serve() { phase = 'play'; b.x = server ? 610 : 190; b.y = 145; b.vx = server ? -265 : 265; b.vy = -240; api.sfx('blip'); }
      function sync() { api.score(rounds[0] * 100 + points[0]); api.stat('Round', round + '/3'); api.stat('Rounds', rounds[0] + ' – ' + rounds[1]); api.stat('Points', points[0] + ' – ' + points[1]); }
      function nextRound() { round++; points = [0, 0]; phase = 'serve'; timer = 1.7; banner = 'ROUND ' + round + ' · FIRST TO 5'; p.x = 170; cpu.x = 630; p.y = cpu.y = FLOOR - 30; p.vy = cpu.vy = 0; sync(); }
      function endRound() {
        const winner = points[0] >= 5 ? 0 : 1; rounds[winner]++; phase = 'done'; sync();
        const finished = rounds[winner] === 2;
        const options = { score: rounds[0] * 100 + points[0], scoreLabel: 'Match score', title: finished ? (winner === 0 ? 'Honey Cup champions!' : 'Bee-Bot takes the cup') : (winner === 0 ? 'You win round ' + round : 'Bee-Bot wins round ' + round),
          detail: 'Round: ' + points[0] + '–' + points[1] + '. Rounds: ' + rounds[0] + '–' + rounds[1] + '.' + (finished ? ' Play again for a new best-of-three match.' : ' First to 2 rounds wins the match.'),
          ...(finished ? {} : { next: { label: 'Play round ' + (round + 1), run: nextRound } }) };
        if (winner === 0) api.win(options); else api.gameOver(options);
      }
      function point(who) { points[who]++; server = who; phase = 'point'; timer = 1.5; banner = who === 0 ? 'YOUR POINT!' : 'BEE-BOT SCORES'; api.sfx(who === 0 ? 'coin' : 'hit'); fx.burst(b.x, FLOOR, ['#ffdb77', '#fff4c6'], 24, 180); sync(); }
      function person(a, dt, direction, jump) {
        a.vx = direction * 330; a.x += a.vx * dt; a.x = K.clamp(a.x, a === p ? 33 : 435, a === p ? 365 : W - 33);
        if (jump && a.y >= FLOOR - 30 - .01) { a.vy = -525; api.sfx('jump'); }
        a.vy += 1150 * dt; a.y += a.vy * dt;
        if (a.y > FLOOR - 30) { a.y = FLOOR - 30; a.vy = 0; }
      }
      function hit(a, dir) {
        const dx = b.x - a.x, dy = b.y - (a.y - 13), dist = Math.hypot(dx, dy);
        if (dist > 45 || dist < .001) return;
        const nx = dx / dist, ny = dy / dist;
        if (b.vx * nx + (b.vy - a.vy) * ny >= 0) return;
        b.x = a.x + nx * 46; b.y = a.y - 13 + ny * 46;
        b.vx = K.clamp(dx * 7 + a.vx * .24 + dir * 120, -440, 440);
        b.vy = -Math.max(350, 420 - Math.abs(dx) * 1.8); api.sfx('blip');
        fx.burst(b.x, b.y, ['#fff4c6', '#ffca65'], 7, 90);
      }
      sync();
      api.loop(dt => {
        t += dt; fx.update(dt);
        if (!api.over && phase !== 'done') {
          const jump = api.keys.fire && !jumpHeld; jumpHeld = api.keys.fire;
          person(p, dt, Number(api.keys.right) - Number(api.keys.left), jump);
          const target = b.vx > 0 && b.x > 330 ? K.clamp(b.x + b.vx * .12, 450, 760) : 610;
          const dir = Math.abs(target - cpu.x) > 15 ? Math.sign(target - cpu.x) * .76 : 0;
          const cpuJump = phase === 'play' && b.x > 420 && Math.abs(b.x - cpu.x) < 85 && b.y > 210 && b.y < 340 && b.vy > -70;
          person(cpu, dt, dir, cpuJump);
          if (phase === 'serve' || phase === 'point') {
            timer -= dt;
            if (timer <= 0) { if (points[0] >= 5 || points[1] >= 5) endRound(); else serve(); }
          } else if (phase === 'play') {
            // Small physics steps prevent tunneling through the net or a jumping robot.
            for (let i = 0; i < 3 && phase === 'play'; i++) {
              const step = dt / 3, oldX = b.x, oldY = b.y;
              b.vy += 700 * step; b.x += b.vx * step; b.y += b.vy * step;
              if (b.x < 13 || b.x > W - 13) { b.x = K.clamp(b.x, 13, W - 13); b.vx *= -1; }
              if (b.y < 13) { b.y = 13; b.vy = Math.abs(b.vy); }
              if (Math.abs(b.x - 400) < 18 && b.y > NET - 13) {
                if (oldY <= NET - 13 && b.vy > 0) { b.y = NET - 14; b.vy = -Math.abs(b.vy) * .8; }
                else { b.x = oldX < 400 ? 381 : 419; b.vx = (oldX < 400 ? -1 : 1) * Math.max(110, Math.abs(b.vx)); }
              }
              hit(p, 1); hit(cpu, -1);
              if (b.y >= FLOOR - 12) point(b.x < 400 ? 1 : 0);
            }
          }
        }
        court(c, t);
        K.text(c, 'YOU  ' + points[0] + ' : ' + points[1] + '  BEE-BOT', W / 2, 28, { size: 24, color: '#fff0c6' });
        K.text(c, 'ROUND ' + round + ' · ROUNDS ' + rounds[0] + '–' + rounds[1], W / 2, 59, { size: 15, body: true, color: '#b6d4d8' });
        K.drawBot(c, p.x, p.y, 75, { ...api.player, t, walk: Math.abs(p.vx) > 0, arms: 'up', shadow: true });
        K.drawBot(c, cpu.x, cpu.y, 75, { ...rival, t, walk: Math.abs(cpu.vx) > 0, arms: 'up', shadow: true });
        if (phase === 'play') K.drawBee(c, b.x, b.y, 30, t);
        if (phase === 'serve' || phase === 'point') { K.text(c, banner, W / 2, 176, { size: 29, color: '#ffe29a' }); if (phase === 'serve') K.text(c, 'Move under the bee ball. Jump to return it!', W / 2, 216, { size: 19, body: true, color: '#e9f8ef' }); }
        fx.draw(c);
      });
    }
  });
})();
