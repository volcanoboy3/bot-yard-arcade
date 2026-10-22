(function () {
  'use strict';
  const K = BotKit, W = 800, H = 500;
  Arcade.register({
    id: 'nectar-derby', length: 'Quick match · three 30-second rounds', title: 'Nectar Derby', cat: 'versus', accent: '#ffacd3', usesPlayer: true,
    blurb: 'Race Bee-Bot for flowers in three fast 30-second rounds. Bring nectar home to score!',
    rules: ['Collect glowing flowers, then return to your cyan hive to bank nectar. You can carry 5 at once.', 'Bee-Bot races for the same flowers and banks at the gold hive. Pink blooms are worth 3!', 'Each round lasts 30 seconds. Play 3 rounds; the most total banked nectar wins.'],
    how: 'WASD / arrows · Or drag anywhere in the garden to steer · Return to the cyan hive to bank',
    touch: ['left', 'right', 'up', 'down'],
    thumb(c, w, h, kit, p) { c.fillStyle = '#254d49'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) K.drawFlower(c, 35 + (i * 43) % 260, 40 + (i * 67) % 130, 26, i % 3 ? '#fff1b8' : '#ffacd3'); K.drawBot(c, 90, 110, 84, { ...p, shadow: true }); K.drawBee(c, 227, 100, 55, .2); K.text(c, '30 SEC / ROUND', w / 2, h - 19, { size: 16, color: '#fff3c2' }); },
    start(api) {
      const cv = api.canvas(W, H), c = cv.ctx;
      let t = 0, remaining = 30, round = 1, ended = false, bank = [0, 0], total = [0, 0], flowers = [], target = null, drag = false;
      const p = { x: 72, y: 250, bag: 0 }, cpu = { x: 728, y: 250, bag: 0 }, fx = K.particles();
      function spawn() {
        let point;
        for (let tries = 0; tries < 25; tries++) { point = { x: K.rand(140, 660), y: K.rand(110, 438), value: Math.random() < .18 ? 3 : 1 }; if (flowers.every(f => Math.hypot(f.x - point.x, f.y - point.y) > 32)) break; }
        flowers.push(point);
      }
      function sync() { api.score(total[0] + bank[0]); api.stat('Round', round + '/3'); api.stat('Nectar', bank[0] + ' – ' + bank[1]); api.stat('Bag', p.bag + '/5'); api.stat('Seconds', Math.ceil(remaining)); }
      function next() { round++; bank = [0, 0]; remaining = 30; ended = false; p.x = 72; p.y = 250; cpu.x = 728; cpu.y = 250; p.bag = cpu.bag = 0; flowers = []; target = null; drag = false; for (let i = 0; i < 14; i++) spawn(); sync(); }
      function finish() {
        ended = true; drag = false; target = null; total[0] += bank[0]; total[1] += bank[1];
        const final = round === 3, win = final ? total[0] >= total[1] : bank[0] >= bank[1];
        const options = { score: total[0], scoreLabel: 'Banked nectar', title: final ? (total[0] === total[1] ? 'A sweet tie!' : win ? 'Garden champions!' : 'Bee-Bot wins the derby') : 'Round ' + round + ' complete!',
          detail: 'This round: ' + bank[0] + '–' + bank[1] + '. Total: ' + total[0] + '–' + total[1] + '. Unbanked nectar stays in the garden.' + (final ? '' : ' Next round gets a fresh garden.'), ...(final ? {} : { next: { label: 'Start round ' + (round + 1), run: next } }) };
        if (win) api.win(options); else api.gameOver(options);
      }
      const pointer = e => { target = cv.toLocal(e); target.x = K.clamp(target.x, 30, W - 30); target.y = K.clamp(target.y, 90, H - 30); };
      api.on(cv.el, 'pointerdown', e => { if (api.over) return; drag = true; K.capture(cv.el, e); pointer(e); });
      api.on(cv.el, 'pointermove', e => { if (drag && !api.over) pointer(e); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) api.on(cv.el, ev, () => { drag = false; });
      api.on(window, 'blur', () => { drag = false; target = null; });
      function move(a, x, y, speed, dt) { const length = Math.hypot(x, y); if (length) { const step = Math.min(length, speed * dt); a.x += x / length * step; a.y += y / length * step; } a.x = K.clamp(a.x, 25, W - 25); a.y = K.clamp(a.y, 90, H - 30); }
      function collect(a, side) {
        for (let i = flowers.length - 1; i >= 0; i--) if (a.bag < 5 && Math.hypot(a.x - flowers[i].x, a.y - flowers[i].y) < 27) {
          a.bag = Math.min(5, a.bag + flowers[i].value); fx.burst(flowers[i].x, flowers[i].y, ['#ffcf5f', '#ffc1de'], 8, 70); flowers.splice(i, 1); spawn(); if (!side) api.sfx('tick');
        }
        if (a.bag && Math.hypot(a.x - (side ? 728 : 72), a.y - 250) < 55) { bank[side] += a.bag; fx.float('+' + a.bag, a.x, a.y - 35, '#ffe09a'); a.bag = 0; if (!side) api.sfx('coin'); }
      }
      for (let i = 0; i < 14; i++) spawn(); sync();
      api.loop(dt => {
        t += dt; fx.update(dt);
        if (!api.over && !ended) {
          remaining = Math.max(0, remaining - dt);
          const dx = Number(api.keys.right) - Number(api.keys.left), dy = Number(api.keys.down) - Number(api.keys.up);
          if (dx || dy) { target = null; move(p, dx * 1000, dy * 1000, 250, dt); } else if (target) move(p, target.x - p.x, target.y - p.y, 250, dt);
          let aim = { x: 728, y: 250 };
          if (cpu.bag < 5 && !(remaining < 3 && cpu.bag > 0)) {
            let best = Infinity;
            for (const f of flowers) { const value = Math.hypot(f.x - cpu.x, f.y - cpu.y) / (f.value === 3 ? 1.3 : 1); if (value < best) { best = value; aim = f; } }
          }
          move(cpu, aim.x - cpu.x, aim.y - cpu.y, 155 + round * 12, dt);
          collect(p, 0); collect(cpu, 1); sync();
          if (remaining <= 0) finish();
        }
        c.fillStyle = '#224d48'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#2b5b51'; for (let i = 0; i < 60; i++) K.circle(c, (i * 139) % W, 90 + (i * 97) % 410, 4);
        c.fillStyle = '#172f36'; K.rr(c, 12, 10, W - 24, 64, 12);
        K.text(c, 'ROUND ' + round + '/3', 35, 33, { size: 18, align: 'left', color: '#ffe09a' });
        K.text(c, Math.ceil(remaining) + ' SEC', W - 30, 33, { size: 23, align: 'right', color: remaining < 6 ? '#ffac9b' : '#ffe09a' });
        K.text(c, 'YOU ' + bank[0] + '  :  ' + bank[1] + ' BEE-BOT', W / 2, 32, { size: 21, color: '#edf6de' });
        K.text(c, 'Bag ' + p.bag + '/5 · Bank at the cyan hive!', W / 2, 59, { size: 14, body: true, color: '#b6d6cc' });
        for (const [x, color, label] of [[72, '#75e1ee', 'YOU'], [728, '#ffcd58', 'BEE-BOT']]) { K.ring(c, x, 250, 54, 3, color); c.fillStyle = K.alpha(color, .12); K.circle(c, x, 250, 52); K.drawHive(c, x, 250, 50); K.text(c, label, x, 323, { size: 14, color }); }
        for (const f of flowers) { K.drawFlower(c, f.x, f.y, f.value === 3 ? 32 : 25, f.value === 3 ? '#ffacd3' : '#fff2be'); if (f.value === 3) K.text(c, '3', f.x, f.y - 21, { size: 12, color: '#ffcee6' }); }
        K.drawBot(c, p.x, p.y - 8, 50, { ...api.player, shadow: true, t, walk: !ended }); K.drawBee(c, p.x + 26, p.y - 29, 20, t);
        K.drawBot(c, cpu.x, cpu.y - 8, 50, { body: '#ffc94c', head: 'dome', antenna: 'twin', t, walk: !ended, shadow: true }); K.drawBee(c, cpu.x + 25, cpu.y - 30, 20, t);
        if (p.bag) K.text(c, String(p.bag), p.x, p.y - 48, { size: 16, color: '#80e9f4' });
        fx.draw(c);
      });
    }
  });
})();
