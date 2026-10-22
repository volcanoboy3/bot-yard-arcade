(function () {
  'use strict';
  const K = BotKit, M = HoneyIsland, W = 800, H = 500, TILE = 64;
  const labels = { wood: 'Wood', alloy: 'Alloy', nectar: 'Nectar', honey: 'Honey', chips: 'Chips' };
  const number = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.floor(n).toLocaleString();
  const costText = cost => Object.entries(cost).filter(([, n]) => n > 0).map(([r, n]) => number(n) + ' ' + labels[r].toLowerCase()).join(' · ');
  function tree(c, x, y) { c.fillStyle = '#896045'; c.fillRect(x - 3, y - 2, 6, 25); c.fillStyle = '#23654b'; K.circle(c, x, y - 7, 18); c.fillStyle = '#419466'; K.circle(c, x - 5, y - 12, 13); }
  function tileArt(c, x, y, type, t) {
    if (type === 'forest' || type === 'grove') tree(c, x, y);
    else if (type === 'rock' || type === 'mine') {
      c.fillStyle = '#8599ae'; c.beginPath(); c.moveTo(x - 21, y + 14); c.lineTo(x - 13, y - 11); c.lineTo(x + 5, y - 19); c.lineTo(x + 22, y + 12); c.closePath(); c.fill();
      c.fillStyle = '#c0d5d7'; c.beginPath(); c.moveTo(x - 13, y - 11); c.lineTo(x + 5, y - 19); c.lineTo(x, y + 6); c.closePath(); c.fill();
      if (type === 'mine') { c.fillStyle = '#283e50'; K.rr(c, x - 8, y, 16, 16, 5); }
    } else if (type === 'flowers') { for (let i = 0; i < 3; i++) K.drawFlower(c, x - 16 + i * 16, y + (i % 2) * 8, 18, i % 2 ? '#f9afd5' : '#fff4c7'); }
    else if (type === 'hive') { K.drawHive(c, x, y, 46); K.drawBee(c, x + Math.sin(t * 2) * 22, y - 20, 17, t); }
    else if (type === 'workshop') { c.fillStyle = '#4b8094'; K.rr(c, x - 22, y - 18, 44, 38, 6); c.fillStyle = '#1c414f'; K.rr(c, x - 13, y - 9, 26, 19, 3); c.fillStyle = '#85f4b8'; c.fillRect(x - 8, y - 3, 7, 5); c.fillRect(x + 3, y - 3, 7, 5); }
    else if (type === 'camp') { c.fillStyle = '#daf3df'; K.rr(c, x - 22, y - 19, 44, 39, 5); c.fillStyle = '#31849b'; c.beginPath(); c.moveTo(x - 29, y - 13); c.lineTo(x, y - 36); c.lineTo(x + 29, y - 13); c.closePath(); c.fill(); c.fillStyle = '#233f4d'; K.rr(c, x - 7, y + 3, 14, 17, 3); }
  }
  Arcade.register({
    id: 'honey-island', length: 'Long adventure · saves your island', title: 'Honey Island', cat: 'builder', accent: '#97dfa4', usesPlayer: true,
    blurb: 'A long island adventure. Explore 225 tiles, build a bee colony and finish 30 missions.',
    rules: ['Your robot lands on a tiny island with a bee friend. Gather wood and alloy, then reclaim neighboring water tiles.', 'Build groves, mines, flower gardens, bee sanctuaries and chip workshops. Upgrade buildings and research better tools.', 'Explore six regions and finish 30 missions. No timer! Progress saves in this browser; buildings work for up to 4 hours away.'],
    how: 'WASD / arrows to explore · Hold Space to gather · Tap a tile to walk there · Use the colony panel',
    thumb(c, w, h, kit, p) {
      c.fillStyle = '#174e68'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#83bf91' : '#70af85'; K.rr(c, 38 + x * 60, 24 + y * 50, 59, 49, 6); }
      tree(c, 70, 63); tree(c, 246, 112); K.drawHive(c, 190, 107, 57);
      K.drawBot(c, 125, 108, 77, Object.assign({}, p, { mood: 'happy', shadow: true })); K.drawBee(c, 185, 45, 35, .2);
      K.drawFlower(c, 70, 151, 23); K.drawFlower(c, 218, 48, 23, '#ffacd0');
    },
    start(api) {
      const el = api.el, d = M.load(api.load(null));
      const away = Math.min(4 * 3600, Math.max(0, (Date.now() - d.savedAt) / 1000));
      M.tick(d, away);
      const save = () => { d.savedAt = Date.now(); api.save(d); };
      api.css(`
        .hi-layout{width:100%;height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:14px;color:#e6eef2}
        .hi-main{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:10px;min-height:0}
        .hi-res{display:flex;flex-wrap:wrap;gap:6px}.hi-res span{flex:1;min-width:65px;padding:8px;border:1px solid #395a61;background:#17343c;border-radius:9px;font:600 12px/1.3 var(--body)}.hi-res b{display:block;color:#ffda7a;font-size:17px}
        .hi-map{position:relative;min-height:0;display:flex;justify-content:center}.hi-map canvas{width:min(100%,calc(160dvh - 480px));height:auto;background:#164c65}
        .hi-bar{display:flex;gap:7px;flex-wrap:wrap}.hi-btn{border:1px solid #42606a;background:#223f4a;border-radius:9px;color:#e6eef2;padding:10px 12px;font:700 13px/1.3 var(--body);cursor:pointer;touch-action:manipulation}.hi-btn:hover:enabled{background:#35616a}.hi-btn:disabled{opacity:.45;cursor:default}.hi-btn.primary{background:#ffd16a;color:#233942;border-color:#ffd16a}.hi-btn small{display:block;font-size:11px;font-weight:500}.hi-gather{flex:1;user-select:none;touch-action:none}
        .hi-side{overflow:auto;touch-action:pan-y;overscroll-behavior:contain;min-height:0;display:flex;flex-direction:column;gap:10px;background:#142c36;border:1px solid #34535e;padding:12px;border-radius:13px}.hi-side h3{margin:0;color:#b6ebc0;font:19px var(--display)}.hi-side p{margin:0;font:500 13px/1.5 var(--body)}.hi-side h4{margin:3px 0;font:700 12px var(--body);letter-spacing:.08em;text-transform:uppercase;color:#86bac3}.hi-block{display:grid;gap:7px;padding-bottom:12px;border-bottom:1px solid #34535e}.hi-building{display:grid;gap:6px}.hi-message{min-height:34px;color:#ffdb8a;font:600 13px/1.4 var(--body)}.hi-hint{color:#a4c3c9}.hi-progress{width:100%;accent-color:#9de6a5;height:9px}
        @media(max-width:800px){.hi-layout{display:flex;flex-direction:column;overflow:auto;touch-action:pan-y;overscroll-behavior:contain}.hi-main{flex:none}.hi-side{overflow:visible;flex:none}.hi-map canvas{width:100%}.hi-res span{padding:5px;min-width:48px;font-size:10px}.hi-res b{font-size:14px}.hi-btn{padding:9px;font-size:12px}}
      `);
      const resources = {}, resBar = el('div', { class: 'hi-res', 'aria-label': 'Island resources' });
      for (const r of M.RES) { const n = el('b'); resources[r] = n; resBar.append(el('span', null, labels[r], n)); }
      const map = el('div', { class: 'hi-map' });
      const gather = el('button', { type: 'button', class: 'hi-btn primary hi-gather' }, 'Gather · hold Space or this button');
      const zoom = el('button', { type: 'button', class: 'hi-btn' }, 'Map zoom');
      const home = el('button', { type: 'button', class: 'hi-btn' }, 'Walk home');
      const message = el('div', { class: 'hi-message', role: 'status' });
      const land = el('h3'), region = el('p', { class: 'hi-hint' });
      const selectedTitle = el('h4'), selectedText = el('p'), actions = el('div', { class: 'hi-building' });
      const missionTitle = el('h4'), missionText = el('p'), missionProgress = el('progress', { class: 'hi-progress', max: 1, value: 0 });
      const claimReward = el('button', { type: 'button', class: 'hi-btn primary' }, 'Complete mission');
      const techs = el('div', { class: 'hi-building' });
      const side = el('aside', { class: 'hi-side' }, land, region,
        el('div', { class: 'hi-block' }, selectedTitle, selectedText, actions),
        el('div', { class: 'hi-block' }, missionTitle, missionText, missionProgress, claimReward),
        el('div', { class: 'hi-block' }, el('h4', null, 'Explorer research'), techs),
        el('p', { class: 'hi-hint' }, 'Buildings produce automatically. Every building can reach level 10. Explore the outer coasts for bonus chips. Saves stay in this browser.'));
      const root = el('div', { class: 'hi-layout' }, el('div', { class: 'hi-main' }, resBar, map, el('div', { class: 'hi-bar' }, gather, zoom, home), message), side);
      api.stage.append(root);
      const cv = api.canvas(W, H, { parent: map }), c = cv.ctx;
      let selected = { ...d.player }, path = [], z = window.innerWidth < 800 ? 1.5 : .85, camera = { x: 0, y: 0 }, t = 0, moveClock = 0, harvestClock = 0, held = false, refreshClock = 0, noticeClock = 0;
      let visual = { ...d.player };
      function notify(text) { message.textContent = text; noticeClock = 5; }
      function mutate(ok, text) { if (ok) { api.sfx('coin'); notify(text); save(); } else { api.sfx('error'); notify('Gather more resources for this project.'); } refresh(); }
      function harvest() {
        if (api.over || harvestClock > 0 || path.length) return;
        const got = M.harvest(d, d.player.x, d.player.y); harvestClock = .4;
        notify('+' + number(got.amount) + ' ' + labels[got.resource] + ' · ' + M.terrain(d.player.x, d.player.y));
        api.sfx('tick'); refresh();
      }
      function select(x, y) {
        if (!M.inside(x, y)) return;
        selected = { x, y };
        if (d.tiles[M.key(x, y)]) path = M.path(d, d.player, selected);
        refresh();
      }
      let actionButtons = [], selectionKey = '';
      function refresh() {
        const rate = M.rates(d);
        for (const r of M.RES) { resources[r].textContent = number(d[r]); resources[r].parentElement.title = rate[r].toFixed(2) + ' per second'; }
        const n = M.count(d); land.textContent = 'Your island · ' + n + '/225';
        const ring = Math.max(Math.abs(d.player.x - 7), Math.abs(d.player.y - 7));
        region.textContent = M.BIOMES[Math.min(5, Math.max(0, ring - 2))] + ' · Auto-saved';
        api.score(n); api.stat('Missions', d.quest + '/30');
        const k = M.key(selected.x, selected.y), b = d.buildings[k], unlocked = d.tiles[k];
        const newKey = k + ':' + (b ? b.type + b.level : '') + ':' + n + ':' + d.tool + ':' + d.swarm;
        if (newKey !== selectionKey) {
          selectionKey = newKey; actionButtons = []; actions.replaceChildren();
          selectedTitle.textContent = 'Tile ' + (selected.x + 1) + ', ' + (selected.y + 1) + ' · ' + (unlocked ? M.terrain(selected.x, selected.y) : 'ocean');
          const add = (label, cost, run, locked) => {
            const btn = el('button', { type: 'button', class: 'hi-btn' }, label, cost ? el('small', null, costText(cost)) : null);
            btn.addEventListener('click', () => { if (!api.over) run(); }); actions.append(btn); actionButtons.push({ btn, cost, locked });
          };
          if (!unlocked) {
            selectedText.textContent = M.frontier(d, selected.x, selected.y) ? 'Reclaim this shore to expand your island.' : 'Choose water beside your land to expand.';
            if (M.frontier(d, selected.x, selected.y)) add('Reclaim land', M.landCost(d), () => { const ok = M.claim(d, selected.x, selected.y); if (ok) path = M.path(d, d.player, selected); mutate(ok, 'New land! Your island is growing.'); });
          } else if (k === '7,7') selectedText.textContent = 'Home base. Hold Gather for emergency wood. Select land to build, or water along the shore to expand.';
          else if (b) {
            selectedText.textContent = M.BUILDINGS[b.type].name + ' · level ' + b.level + '/10';
            if (b.level < 10) add('Upgrade ' + M.BUILDINGS[b.type].name, M.buildCost(d, selected.x, selected.y, b.type), () => mutate(M.build(d, selected.x, selected.y, b.type), 'Building upgraded!'));
          } else {
            selectedText.textContent = 'Walk here to gather. Or build a permanent producer on this tile.';
            for (const [type, def] of Object.entries(M.BUILDINGS)) add(def.name + (n < def.unlock ? ' · needs ' + def.unlock + ' land' : ''), def.cost, () => mutate(M.build(d, selected.x, selected.y, type), def.name + ' built!'), n < def.unlock);
          }
          techs.replaceChildren();
          for (const type of ['tool', 'swarm']) {
            const cost = M.techCost(d, type), label = type === 'tool' ? 'Gathering tools' : 'Bee helpers';
            const btn = el('button', { type: 'button', class: 'hi-btn' }, label + ' · ' + d[type] + '/20', el('small', null, d[type] >= 20 ? 'Max level' : costText(cost)));
            btn.addEventListener('click', () => { if (!api.over) mutate(M.research(d, type), label + ' upgraded!'); });
            techs.append(btn); actionButtons.push({ btn, cost, locked: d[type] >= 20 });
          }
        }
        for (const a of actionButtons) a.btn.disabled = !!a.locked || (a.cost && !M.afford(d, a.cost));
        const m = M.mission(d);
        missionTitle.textContent = m ? 'Mission ' + (d.quest + 1) + '/30 · ' + m.title : 'A home for robots and bees';
        missionText.textContent = m ? m.detail + (m.cost ? ': ' + costText(m.cost) : ' · ' + number(m.current) + '/' + number(m.goal)) : 'All 30 missions complete! Finish exploring, upgrade your colony and build your dream island.';
        missionProgress.value = m ? (m.cost ? (m.ready ? 1 : 0) : Math.min(1, m.current / m.goal)) : 1;
        claimReward.hidden = !m; claimReward.disabled = !m || !m.ready;
        claimReward.textContent = m && m.step === 4 ? 'Send ship & claim reward' : 'Complete mission & claim reward';
      }
      api.on(claimReward, 'click', () => { if (!api.over) mutate(M.complete(d), 'Mission complete! Supplies and research chips delivered.'); });
      api.on(zoom, 'click', () => { z = z === .85 ? .45 : z === .45 ? 1.5 : .85; zoom.textContent = z === .45 ? 'Zoom: whole island' : z === 1.5 ? 'Zoom: close' : 'Map zoom'; });
      api.on(home, 'click', () => select(7, 7));
      api.on(gather, 'pointerdown', e => { if (api.over) return; e.preventDefault(); K.capture(gather, e); held = true; harvest(); });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) api.on(gather, event, () => { held = false; });
      api.on(gather, 'click', e => { if (e.detail === 0) harvest(); });
      api.on(window, 'blur', () => { held = false; });
      api.on(cv.el, 'pointerdown', e => { if (api.over) return; const p = cv.toLocal(e); select(Math.floor((p.x + camera.x) / (TILE * z)), Math.floor((p.y + camera.y) / (TILE * z))); });
      api.on(document, 'visibilitychange', () => { if (document.hidden) { held = false; save(); } });
      api.on(window, 'pagehide', save);
      function render(dt) {
        visual.x = K.lerp(visual.x, d.player.x, Math.min(1, dt * 14)); visual.y = K.lerp(visual.y, d.player.y, Math.min(1, dt * 14));
        const scale = TILE * z;
        camera.x = (visual.x + .5) * scale - W / 2; camera.y = (visual.y + .5) * scale - H / 2;
        if (z === .45) { camera.x = (M.SIZE * scale - W) / 2; camera.y = (M.SIZE * scale - H) / 2; }
        c.fillStyle = '#164d66'; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#24647a'; c.lineWidth = 2;
        for (let row = 0; row < 14; row++) { c.beginPath(); for (let x = 0; x <= W; x += 12) { const y = row * 42 + Math.sin(x * .025 + t + row) * 4; if (x) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
        c.save(); c.translate(-camera.x, -camera.y); c.scale(z, z);
        for (let y = 0; y < M.SIZE; y++) for (let x = 0; x < M.SIZE; x++) {
          const k = M.key(x, y), open = d.tiles[k], front = !open && M.frontier(d, x, y), px = x * TILE, py = y * TILE;
          if (!open && !front) continue;
          if (open) {
            const ring = Math.max(Math.abs(x - 7), Math.abs(y - 7));
            c.fillStyle = ['#80b995', '#80b995', '#80b995', '#9bc687', '#b9b18b', '#91b9bc', '#a8b1d0', '#e0c98f'][ring];
            K.rr(c, px + 1, py + 1, TILE - 2, TILE - 2, 7);
            c.fillStyle = '#ffffff12'; c.fillRect(px + 8, py + 7, TILE - 16, 2);
            const b = d.buildings[k]; tileArt(c, px + 32, py + 30, b ? b.type : M.terrain(x, y), t);
            if (b) K.text(c, String(b.level), px + 53, py + 54, { size: 13, color: '#fff4c7', shadow: true });
          } else {
            c.strokeStyle = '#bfeacf55'; c.lineWidth = 1.5; c.setLineDash([5, 5]); K.rrPath(c, px + 5, py + 5, TILE - 10, TILE - 10, 8); c.stroke(); c.setLineDash([]);
            K.text(c, '+', px + 32, py + 32, { size: 24, color: '#b9dfc6', shadow: false });
          }
          if (selected.x === x && selected.y === y) { c.strokeStyle = '#ffdf83'; c.lineWidth = 3; K.rrPath(c, px + 2, py + 2, TILE - 4, TILE - 4, 8); c.stroke(); }
        }
        const rx = (visual.x + .5) * TILE, ry = (visual.y + .5) * TILE;
        K.drawBot(c, rx, ry - 7, 43, Object.assign({}, api.player, { t, walk: path.length > 0 || moveClock > 0, shadow: true, mood: 'happy' }));
        K.drawBee(c, rx + 30 + Math.sin(t * 2) * 8, ry - 30 + Math.cos(t * 3) * 5, 22, t);
        c.restore();
        K.text(c, 'HONEY ISLAND', 18, 22, { align: 'left', size: 16, color: '#ffdf83' });
        K.text(c, 'Tap a shore + to expand', W - 18, H - 18, { align: 'right', size: 15, body: true, color: '#dbf5ed' });
      }
      refresh(); save(); render(.05);
      notify(away > 60 ? 'Welcome back! Your colony produced supplies while you were away.' : 'Welcome, explorer! Gather on land, build a grove and mine, then select a shore +.');
      api.loop(dt => {
        if (api.over) { held = false; return; }
        t += dt; M.tick(d, dt); moveClock -= dt; harvestClock -= dt; refreshClock -= dt; noticeClock -= dt;
        const dx = Number(api.keys.right) - Number(api.keys.left), dy = Number(api.keys.down) - Number(api.keys.up);
        if (moveClock <= 0) {
          if (dx || dy) {
            const next = { x: d.player.x + (dx ? dx : 0), y: d.player.y + (dx ? 0 : dy) }; path = [];
            if (d.tiles[M.key(next.x, next.y)]) { d.player = next; selected = { ...next }; refresh(); } moveClock = .16;
          } else if (path.length) { d.player = path.shift(); moveClock = .14; }
        }
        if ((api.keys.fire || held) && harvestClock <= 0) harvest();
        if (refreshClock <= 0) { refreshClock = .25; refresh(); }
        if (noticeClock <= 0) message.textContent = 'Select land to build. Select a shore + to reclaim it. Hold Gather for resources.';
        render(dt);
      });
      api.every(4000, save); api.every(5000, () => api.record(M.count(d)));
      return () => { save(); api.record(M.count(d)); };
    }
  });
})();
