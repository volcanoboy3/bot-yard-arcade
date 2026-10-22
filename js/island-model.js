/* Honey Island: saveable world and economy, independent of rendering. */
(function (root) {
  'use strict';
  const SIZE = 15, CENTER = 7, LIMIT = SIZE * SIZE;
  const BUILDINGS = {
    grove: { name: 'Timber Grove', resource: 'wood', rate: 1.2, cost: { wood: 18, alloy: 4 }, unlock: 9, color: '#5cba83' },
    mine: { name: 'Robot Mine', resource: 'alloy', rate: .8, cost: { wood: 24, alloy: 8 }, unlock: 9, color: '#a6bfd3' },
    flowers: { name: 'Flower Garden', resource: 'nectar', rate: 1.3, cost: { wood: 20, alloy: 6 }, unlock: 9, color: '#ffadd0' },
    hive: { name: 'Bee Sanctuary', resource: 'honey', rate: .65, cost: { wood: 55, alloy: 20, nectar: 15 }, unlock: 12, color: '#ffc44e' },
    workshop: { name: 'Chip Workshop', resource: 'chips', rate: .12, cost: { wood: 90, alloy: 65, honey: 12 }, unlock: 20, color: '#82dbe7' }
  };
  const RES = ['wood', 'alloy', 'nectar', 'honey', 'chips'];
  const BIOMES = ['Clover Cove', 'Honey Meadows', 'Copper Orchard', 'Crystal Grove', 'Moonflower Coast', 'Royal Sanctuary'];
  const key = (x, y) => x + ',' + y;
  function inside(x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE; }
  function terrain(x, y) {
    if (x === CENTER && y === CENTER) return 'camp';
    const n = (x * 31 + y * 17 + x * y * 7) % 11;
    return n < 4 ? 'forest' : n < 7 ? 'rock' : n < 10 ? 'flowers' : 'meadow';
  }
  function fresh() {
    const d = { version: 1, wood: 65, alloy: 35, nectar: 0, honey: 0, chips: 0, totalHoney: 0,
      tiles: {}, buildings: {}, tool: 0, swarm: 0, quest: 0, player: { x: CENTER, y: CENTER }, savedAt: Date.now() };
    for (let y = 6; y <= 8; y++) for (let x = 6; x <= 8; x++) d.tiles[key(x, y)] = true;
    return d;
  }
  function load(raw) {
    const d = fresh();
    if (!raw || typeof raw !== 'object') return d;
    const num = (v, cap = 1e100) => Number.isFinite(v) && v >= 0 ? Math.min(v, cap) : 0;
    for (const r of RES) d[r] = num(raw[r]);
    d.totalHoney = Math.max(d.honey, num(raw.totalHoney));
    for (const k of Object.keys(raw.tiles || {})) { const [x, y] = k.split(',').map(Number); if (inside(x, y) && raw.tiles[k]) d.tiles[key(x, y)] = true; }
    for (const [k, b] of Object.entries(raw.buildings || {})) if (d.tiles[k] && b && BUILDINGS[b.type] && k !== '7,7') d.buildings[k] = { type: b.type, level: Math.max(1, Math.floor(num(b.level, 10))) };
    d.tool = Math.floor(num(raw.tool, 20)); d.swarm = Math.floor(num(raw.swarm, 20)); d.quest = Math.floor(num(raw.quest, 30));
    if (raw.player && inside(raw.player.x, raw.player.y) && d.tiles[key(raw.player.x, raw.player.y)]) d.player = { x: raw.player.x, y: raw.player.y };
    d.savedAt = num(raw.savedAt, Date.now()) || Date.now();
    return d;
  }
  const count = d => Object.keys(d.tiles).length;
  function frontier(d, x, y) { return inside(x, y) && !d.tiles[key(x, y)] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => d.tiles[key(x + a, y + b)]); }
  function landCost(d) {
    const n = count(d) - 9;
    return { wood: Math.ceil(15 + Math.pow(n, 1.45) * .65), alloy: Math.ceil(7 + Math.pow(n, 1.35) * .35), honey: n < 16 ? 0 : Math.ceil(Math.pow(n - 15, 1.15) * .28) };
  }
  function afford(d, cost) { return RES.every(r => d[r] >= (cost[r] || 0)); }
  function spend(d, cost) { if (!afford(d, cost)) return false; for (const r of RES) d[r] -= cost[r] || 0; return true; }
  function claim(d, x, y) {
    if (!frontier(d, x, y) || !spend(d, landCost(d))) return false;
    d.tiles[key(x, y)] = true;
    if (Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER)) >= 5) d.chips += 3;
    return true;
  }
  function buildCost(d, x, y, type) {
    const b = d.buildings[key(x, y)], def = BUILDINGS[type];
    if (!def) return {};
    const factor = b ? Math.pow(2, b.level) : 1;
    return Object.fromEntries(Object.entries(def.cost).map(([r, n]) => [r, Math.ceil(n * factor)]));
  }
  function build(d, x, y, type) {
    const k = key(x, y), b = d.buildings[k], def = BUILDINGS[type];
    if (!d.tiles[k] || k === '7,7' || !def || count(d) < def.unlock || (b && (b.type !== type || b.level >= 10))) return false;
    if (!spend(d, buildCost(d, x, y, type))) return false;
    d.buildings[k] = { type, level: b ? b.level + 1 : 1 }; return true;
  }
  function rates(d) {
    const out = Object.fromEntries(RES.map(r => [r, 0]));
    for (const b of Object.values(d.buildings)) {
      const def = BUILDINGS[b.type];
      out[def.resource] += def.rate * Math.pow(1.65, b.level - 1) * (def.resource === 'honey' || def.resource === 'nectar' ? 1 + d.swarm * .3 : 1);
    }
    return out;
  }
  function tick(d, seconds) {
    seconds = Math.max(0, Math.min(seconds, 4 * 3600));
    const r = rates(d);
    for (const resource of RES) d[resource] += r[resource] * seconds;
    d.totalHoney += r.honey * seconds;
  }
  function harvest(d, x, y) {
    if (!d.tiles[key(x, y)]) return null;
    const type = terrain(x, y), r = { forest: 'wood', rock: 'alloy', flowers: 'nectar', meadow: 'wood', camp: 'wood' }[type];
    const amount = (type === 'rock' ? 2 : 3) * (1 + d.tool * 1.8);
    d[r] += amount;
    if (type === 'flowers' && d.swarm) { d.honey += d.swarm; d.totalHoney += d.swarm; }
    return { resource: r, amount };
  }
  function techCost(d, type) {
    const level = d[type];
    return type === 'tool' ? { wood: Math.ceil(45 * Math.pow(1.65, level)), alloy: Math.ceil(25 * Math.pow(1.65, level)), chips: level < 2 ? 0 : Math.ceil(level * 1.5) }
      : { nectar: Math.ceil(35 * Math.pow(1.65, level)), honey: Math.ceil(8 * Math.pow(1.65, level)), chips: level < 2 ? 0 : level };
  }
  function research(d, type) { if (!['tool', 'swarm'].includes(type) || d[type] >= 20 || !spend(d, techCost(d, type))) return false; d[type]++; return true; }
  function mission(d) {
    if (d.quest >= 30) return null;
    const chapter = Math.floor(d.quest / 5), step = d.quest % 5, target = [12, 25, 49, 81, 144, 225][chapter];
    const titles = [BIOMES[chapter] + ': reclaim land', 'Make room for a colony', 'Honey for the queen', 'Equip your explorer', 'Send the supply ship'];
    const cost = { wood: 80 * Math.pow(3.2, chapter), alloy: 40 * Math.pow(3.2, chapter), honey: 10 * Math.pow(3.4, chapter), chips: chapter * chapter * 3 };
    const current = [count(d), Object.keys(d.buildings).length, Math.floor(d.totalHoney), d.tool, 0][step];
    const goal = [target, Math.floor(target * .28), target * (chapter + 1) * 6, (chapter + 1) * 2, 1][step];
    const detail = [goal + ' land tiles', goal + ' buildings', goal + ' lifetime honey', 'Tool level ' + goal, 'Load wood, alloy, honey and chips'][step];
    return { chapter, step, title: titles[step], current, goal, detail, cost: step === 4 ? cost : null, ready: step === 4 ? afford(d, cost) : current >= goal };
  }
  function complete(d) {
    const m = mission(d); if (!m || !m.ready) return false;
    if (m.cost) spend(d, m.cost);
    const scale = Math.pow(3, m.chapter);
    d.wood += 65 * scale; d.alloy += 35 * scale; d.honey += 12 * scale; d.totalHoney += 12 * scale; d.chips += 3 * (m.chapter + 1); d.quest++;
    return true;
  }
  // Breadth-first paths let taps navigate around water rather than walking through it.
  function path(d, from, to) {
    const dest = key(to.x, to.y), start = key(from.x, from.y), todo = [start], prev = new Map([[start, null]]);
    if (!d.tiles[dest]) return [];
    for (let i = 0; i < todo.length; i++) {
      const k = todo[i]; if (k === dest) break;
      const [x, y] = k.split(',').map(Number);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = key(x + a, y + b); if (d.tiles[n] && !prev.has(n)) { prev.set(n, k); todo.push(n); } }
    }
    if (!prev.has(dest)) return [];
    const out = []; for (let k = dest; k !== start; k = prev.get(k)) { const [x, y] = k.split(',').map(Number); out.unshift({ x, y }); } return out;
  }
  const model = { SIZE, CENTER, LIMIT, BUILDINGS, RES, BIOMES, key, inside, terrain, fresh, load, count, frontier, landCost, afford, spend, claim, buildCost, build, rates, tick, harvest, techCost, research, mission, complete, path };
  if (typeof module === 'object' && module.exports) module.exports = model; else root.HoneyIsland = model;
})(typeof window === 'object' ? window : globalThis);
