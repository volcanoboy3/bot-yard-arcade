/* Bot Yard Arcade · hub.js
 * The arcade floor: the bot builder, category filters and one card per game. */
(function () {
  'use strict';
  const A = window.Arcade, kit = A.kit, el = A.el;
  const $ = id => document.getElementById(id);

  // Curated floor order: categories interleave so the first screen shows variety.
  const ORDER = [
    'scrap-yard-bot', 'robo-runner', 'code-the-bot', 'bot-invaders', 'flappy-drone',
    'bot-2048', 'laser-dodge', 'connect-bot', 'brick-bot', 'circuit-connect',
    'battery-snake', 'rock-paper-robot', 'scrap-stacker', 'copy-bot', 'whack-a-bot',
    'bomb-squad', 'robo-pong', 'bot-match', 'type-zapper', 'robot-factory'
  ];
  const rank = def => { const i = ORDER.indexOf(def.id); return i < 0 ? 999 : i; };
  const games = A.games.slice().sort((a, b) => rank(a) - rank(b));

  // ---------- sound toggle ----------
  const hubSound = $('hub-sound');
  function syncSound() {
    hubSound.innerHTML = A.sound.muted ? A.ICON.soundOff : A.ICON.soundOn;
    hubSound.setAttribute('aria-pressed', String(A.sound.muted));
    hubSound.setAttribute('aria-label', A.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  hubSound.addEventListener('click', () => {
    A.sound.setMuted(!A.sound.muted);
    if (!A.sound.muted) { A.sound.unlock(); A.sound.sfx('blip'); }
  });
  A.on('muted', syncSound);
  syncSound();

  // ---------- game cards ----------
  const grid = $('grid');
  const cards = {};
  const GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';

  function fallbackThumb(c, def) {
    kit.bgFactory(c, 320, 200, { floor: 168 });
    kit.drawBot(c, 160, 110, 110, { body: def.accent || kit.C.safety, mood: 'happy', shadow: true });
  }
  function drawThumb(def, cv) {
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const k = cv.width / 320;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.save();
    try {
      if (typeof def.thumb === 'function') def.thumb(c, 320, 200, kit, A.player);
      else fallbackThumb(c, def);
    } catch (e) {
      console.error('[' + def.id + '] thumb', e);
      c.restore(); c.save(); fallbackThumb(c, def);
    }
    c.restore();
  }

  const openGame = id => e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    e.preventDefault();
    A.play(id);
  };

  for (const def of games) {
    const cv = el('canvas', { width: 640, height: 400, 'aria-hidden': 'true' });
    const led = el('span', { class: 'led', 'aria-hidden': 'true' });
    const best = el('span', { class: 'best' });
    const node = el('a', {
      class: 'machine', href: '#' + def.id, dataset: { cat: def.cat },
      style: { '--accent': def.accent || kit.C.safety },
      on: { click: openGame(def.id) }
    },
      el('div', { class: 'screen' }, cv, led),
      el('div', { class: 'plate' },
        el('div', { class: 'plate-top' },
          el('span', { class: 'cat' }, A.CATS[def.cat]),
          def.usesPlayer ? el('span', { class: 'you' }, 'Stars your bot') : null),
        el('h3', null, def.title),
        el('p', null, def.blurb || ''),
        el('div', { class: 'plate-foot' }, best, el('span', { class: 'go', html: 'Play ' + GO }))));
    node.style.setProperty('--accent', def.accent || kit.C.safety);
    grid.append(node);
    cards[def.id] = { def, node, cv, led, best };
  }

  function refreshCard(id) {
    const card = cards[id];
    if (!card) return;
    const b = A.best(id);
    card.best.className = 'best' + (b ? '' : ' is-empty');
    card.best.innerHTML = 'Best <b>' + (b ? A.fmt(b) : '—') + '</b>';
    const played = A.plays(id) > 0;
    card.led.classList.toggle('is-on', played);
    card.node.setAttribute('aria-label', card.def.title + '. ' + A.CATS[card.def.cat] + '. ' + (b ? 'Best score ' + A.fmt(b) + '.' : 'Not played yet.'));
  }
  function refreshStats() {
    $('stat-games').textContent = games.length;
    $('stat-you').textContent = games.filter(g => g.usesPlayer).length;
    $('stat-records').textContent = games.filter(g => A.best(g.id) > 0).length;
  }
  function drawAllThumbs() { for (const id in cards) drawThumb(cards[id].def, cards[id].cv); }
  games.forEach(g => refreshCard(g.id));
  refreshStats();
  drawAllThumbs();

  A.on('best', ({ id }) => { refreshCard(id); refreshStats(); });
  A.on('start', id => refreshCard(id));
  A.on('close', () => { games.forEach(g => refreshCard(g.id)); refreshStats(); startBay(); });
  A.on('open', () => stopBay());

  // ---------- filters ----------
  const filterBox = $('filters');
  const counts = {};
  games.forEach(g => { counts[g.cat] = (counts[g.cat] || 0) + 1; });
  const FILTERS = [['all', 'All', games.length]].concat(
    Object.keys(A.CATS).filter(k => counts[k]).map(k => [k, A.CATS[k], counts[k]]));
  let filter = A.store.get('filter', 'all');
  if (!FILTERS.some(f => f[0] === filter)) filter = 'all';
  const filterButtons = FILTERS.map(([key, label, n]) => {
    const b = el('button', { type: 'button', 'aria-pressed': 'false', on: { click: () => setFilter(key) } }, label, el('span', null, String(n)));
    b.dataset.key = key;
    filterBox.append(b);
    return b;
  });
  function setFilter(key) {
    filter = key;
    A.store.set('filter', key);
    filterButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === key)));
    for (const id in cards) cards[id].node.hidden = !(key === 'all' || cards[id].def.cat === key);
  }
  setFilter(filter);

  // ---------- hero buttons ----------
  const first = $('hero-first');
  if (A.byId['scrap-yard-bot']) first.addEventListener('click', openGame('scrap-yard-bot'));
  else first.hidden = true;
  $('hero-random').addEventListener('click', () => {
    const unplayed = games.filter(g => !A.plays(g.id));
    const pool = unplayed.length ? unplayed : games;
    if (pool.length) A.play(kit.pick(pool).id);
  });
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // ---------- the assembly bay ----------
  const OPTS = {
    head: [['box', 'Box'], ['dome', 'Dome'], ['tv', 'Screen']],
    antenna: [['ball', 'Ball'], ['bolt', 'Bolt'], ['twin', 'Twin'], ['dish', 'Dish'], ['none', 'None']],
    base: [['wheels', 'Wheels'], ['treads', 'Treads'], ['legs', 'Legs'], ['hover', 'Hover']]
  };
  const EYES = [['#bff6ff', 'Ice'], ['#9dff9d', 'Green'], ['#ffd36b', 'Amber'], ['#ff9ad5', 'Pink']];
  const PLATING_NAMES = ['Cyan', 'Safety yellow', 'Orange', 'Green', 'Lilac', 'Pink', 'Silver', 'Red'];
  const NAME_A = ['BOLT', 'ZIP', 'GEAR', 'SPARK', 'RIVET', 'COG', 'BYTE', 'VOLT', 'CHIP', 'NOVA', 'ATOM', 'TURBO', 'PIXEL', 'DYNA', 'SPROCKET'];
  const controls = [];

  function segGroup(box, key, list) {
    for (const [value, label] of list) {
      const b = el('button', { type: 'button', on: { click: () => setPart(key, value) } }, label);
      b.dataset.key = key; b.dataset.value = value;
      box.append(b); controls.push(b);
    }
  }
  function swatchGroup(box, key, list) {
    for (const [value, label] of list) {
      const b = el('button', { type: 'button', class: 'swatch', 'aria-label': label, title: label, on: { click: () => setPart(key, value) } });
      b.style.setProperty('--c', value);
      b.dataset.key = key; b.dataset.value = value;
      box.append(b); controls.push(b);
    }
  }
  swatchGroup($('opt-body'), 'body', kit.PLATING.map((c, i) => [c, PLATING_NAMES[i] || c]));
  segGroup($('opt-head'), 'head', OPTS.head);
  segGroup($('opt-antenna'), 'antenna', OPTS.antenna);
  segGroup($('opt-base'), 'base', OPTS.base);
  swatchGroup($('opt-eye'), 'eye', EYES);

  const nameInput = $('bot-name');
  function syncBay() {
    const p = A.player;
    controls.forEach(b => b.setAttribute('aria-pressed', String(p[b.dataset.key] === b.dataset.value)));
    if (document.activeElement !== nameInput) nameInput.value = p.name;
    $('bay-unit').textContent = p.name || 'BOLT-7';
  }
  let wave = 0;
  function setPart(key, value) {
    A.setPlayer({ [key]: value });
    A.sound.unlock(); A.sound.sfx('click');
    wave = 1.2;
  }
  nameInput.addEventListener('input', () => {
    const clean = nameInput.value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 10);
    if (clean !== nameInput.value) nameInput.value = clean;
    A.setPlayer({ name: clean.trim() || 'BOLT-7' });
  });
  nameInput.addEventListener('blur', () => { nameInput.value = A.player.name; });
  $('bot-random').addEventListener('click', () => {
    A.setPlayer({
      body: kit.pick(kit.PLATING),
      eye: kit.pick(EYES)[0],
      head: kit.pick(OPTS.head)[0],
      antenna: kit.pick(OPTS.antenna)[0],
      base: kit.pick(OPTS.base)[0],
      name: kit.pick(NAME_A) + '-' + kit.randi(1, 99)
    });
    A.sound.unlock(); A.sound.sfx('talk');
    wave = 1.6;
  });
  A.on('player', () => {
    syncBay();
    for (const id in cards) if (cards[id].def.usesPlayer) drawThumb(cards[id].def, cards[id].cv);
  });
  syncBay();

  // bay canvas: the bot on a lit platform, eyes following the pointer
  const bayCanvas = $('bay-canvas');
  const bay = bayCanvas.getContext('2d');
  const BW = 200, BH = 200;
  let look = { x: 0, y: 0 }, lookTarget = { x: 0, y: 0 };
  let bayRaf = 0, bayVisible = true, lastT = performance.now(), bayT = 0;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bayBg = kit.layer(BW, BH, c => {
    const g = c.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
    c.fillStyle = g; c.fillRect(0, 0, BW, BH);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1.5;
    for (let x = 0; x <= BW; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 160); c.stroke(); }
    c.beginPath(); c.moveTo(0, 70); c.lineTo(BW, 70); c.stroke();
    const spot = c.createRadialGradient(100, 150, 10, 100, 120, 110);
    spot.addColorStop(0, 'rgba(245,197,24,0.16)'); spot.addColorStop(1, 'rgba(245,197,24,0)');
    c.fillStyle = spot; c.fillRect(0, 0, BW, BH);
    c.fillStyle = '#0d171e'; c.fillRect(0, 160, BW, 40);
    c.fillStyle = '#2b4353'; c.fillRect(0, 160, BW, 3);
    kit.hazard(c, 0, 176, BW, 10, { stripe: 10 });
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 176, BW, 10);
    c.fillStyle = '#4a6272'; c.font = kit.font(8.5, 'body'); c.textAlign = 'left';
    c.fillText('BAY 07 · UNIT TEST', 8, 196);
  }, 2);

  function drawBay(t) {
    bay.setTransform(bayCanvas.width / BW, 0, 0, bayCanvas.height / BH, 0, 0);
    bay.drawImage(bayBg, 0, 0, BW, BH);
    const bob = reduceMotion ? 0 : Math.sin(t * 2) * 1.2;
    kit.drawBot(bay, 100, 104 + bob, 118, Object.assign({}, A.player, {
      t: reduceMotion ? 0 : t, look: look.x, lookY: look.y, shadow: true,
      arms: wave > 0 ? 'wave' : 'down', mood: wave > 0 ? 'happy' : 'happy'
    }));
  }
  function bayFrame(now) {
    bayRaf = requestAnimationFrame(bayFrame);
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    bayT += dt;
    wave = Math.max(0, wave - dt);
    look.x += (lookTarget.x - look.x) * Math.min(1, dt * 8);
    look.y += (lookTarget.y - look.y) * Math.min(1, dt * 8);
    drawBay(bayT);
  }
  function startBay() {
    if (bayRaf || !bayVisible || document.hidden || !A.debug || A.debug.game) return;
    lastT = performance.now();
    bayRaf = requestAnimationFrame(bayFrame);
  }
  function stopBay() { cancelAnimationFrame(bayRaf); bayRaf = 0; }
  window.addEventListener('pointermove', e => {
    const r = bayCanvas.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    lookTarget.x = kit.clamp((e.clientX - cx) / 260, -1, 1);
    lookTarget.y = kit.clamp((e.clientY - cy) / 260, -1, 1);
  }, { passive: true });
  bayCanvas.addEventListener('click', () => { wave = 1.4; A.sound.unlock(); A.sound.sfx('talk'); });
  if (window.IntersectionObserver) {
    new IntersectionObserver(entries => {
      bayVisible = entries[0].isIntersecting;
      if (bayVisible) startBay(); else stopBay();
    }).observe(bayCanvas);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopBay(); else startBay(); });
  drawBay(0);
  startBay();

  // ---------- fonts, then routing ----------
  function whenFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const load = Promise.all([
      document.fonts.load('16px "Bungee"'),
      document.fonts.load('700 16px "Chakra Petch"'),
      document.fonts.load('500 16px "Chakra Petch"')
    ]).catch(() => {});
    return Promise.race([load, new Promise(r => setTimeout(r, 2500))]);
  }
  whenFonts().then(() => {
    drawAllThumbs();
    drawBay(bayT);
    const dev = A.devParams.get('dev');
    if (dev && A.byId[dev]) A.debug.start(dev, A.devParams.get('mode'));
  });
  A.route();
})();
