const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/bee-economy.js');
const M = require('../js/island-model.js');

test('factory has 95 new upgrades, preserving room for the five original tools', () => {
  assert.equal(B.upgrades.length, 95);
  assert.equal(B.tools.length, 100);
  assert.equal(B.machines.length, 12);
  for (const id of ['glove','driver','rivet','hammer','wrench']) assert.ok(B.tools.some(t => t.id === id));
  assert.equal(new Set(B.upgrades.map(t => t.id)).size, 95);
  assert.equal(new Set(B.upgrades.map(t => t.name)).size, 95);
  assert.ok(B.upgrades.every(t => Number.isFinite(t.cost) && t.unlock <= t.cost));
  assert.equal(B.beeMachines.length, 5);
});
test('factory research changes production, tapping and honey without erasing old machine income', () => {
  const machines = [{ id: 'arm', rate: .1 }, ...B.beeMachines];
  const d = { owned: { arm: 10, hive: 1 }, tools: [] };
  const before = B.rates(machines, d, B.upgrades);
  d.tools = B.upgrades.map(t => t.id);
  const after = B.rates(machines, d, B.upgrades);
  assert.ok(after.robots > before.robots * 1000);
  assert.ok(after.honey > before.honey * 10);
  assert.ok(B.tapPower(d, B.upgrades, after.robots) > after.robots * .1);
  assert.ok(Number.isFinite(after.robots));
});
test('island handles broken saves and round-trips a developed colony', () => {
  const d = M.fresh(); M.build(d, 6, 6, 'grove'); d.swarm = 2;
  const copy = M.load(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(copy, d);
  const bad = M.load({ wood: -5, alloy: null, honey: 'bad', tool: Infinity, tiles: { '999,999': true }, buildings: { '6,6': { type: 'unknown', level: 900 } }, player: { x: -1, y: 30 } });
  assert.equal(bad.wood, 0); assert.equal(bad.tool, 0); assert.equal(M.count(bad), 9);
  assert.deepEqual(bad.player, { x: 7, y: 7 });
  assert.deepEqual(bad.buildings, {});
});
test('expansion is adjacent, paid, and cannot charge twice for the same tile', () => {
  const d = M.fresh(); const before = { wood: d.wood, alloy: d.alloy };
  assert.equal(M.claim(d, 0, 0), false);
  assert.equal(M.claim(d, 7, 5), true);
  assert.equal(M.count(d), 10);
  assert.equal(d.wood, before.wood - 15); assert.equal(d.alloy, before.alloy - 7);
  const bank = d.wood; assert.equal(M.claim(d, 7, 5), false); assert.equal(d.wood, bank);
  assert.equal(M.path(d, d.player, { x: 7, y: 5 }).length, 2);
  assert.deepEqual(M.path(d, d.player, { x: 0, y: 0 }), []);
});
test('buildings produce each resource, upgrades increase yield, offline work caps at four hours', () => {
  const d = M.fresh(); for (const r of M.RES) d[r] = 1e9;
  while (M.count(d) < 25) { outer: for (let y = 0; y < M.SIZE; y++) for (let x = 0; x < M.SIZE; x++) if (M.frontier(d, x, y)) { M.claim(d, x, y); break outer; } }
  const cells = Object.keys(d.tiles).filter(k => k !== '7,7');
  Object.keys(M.BUILDINGS).forEach((type, i) => { const [x, y] = cells[i].split(',').map(Number); assert.ok(M.build(d, x, y, type)); });
  const rate = M.rates(d); assert.ok(M.RES.every(r => rate[r] > 0));
  const [x, y] = cells[0].split(',').map(Number); M.build(d, x, y, 'grove'); assert.ok(M.rates(d).wood > rate.wood);
  const start = d.honey; M.tick(d, 1000000); assert.ok(Math.abs(d.honey - start - rate.honey * 14400) < .001);
});
test('all 225 tiles, building upgrades and all 30 missions are reachable', () => {
  const d = M.fresh(); for (const r of M.RES) d[r] = 1e12;
  for (let i = 0; i < 300 && M.count(d) < M.LIMIT; i++) {
    outer: for (let y = 0; y < M.SIZE; y++) for (let x = 0; x < M.SIZE; x++) if (M.frontier(d, x, y)) { assert.ok(M.claim(d, x, y)); break outer; }
  }
  assert.equal(M.count(d), 225);
  for (const k of Object.keys(d.tiles).filter(k => k !== '7,7')) { const [x, y] = k.split(',').map(Number); assert.ok(M.build(d, x, y, 'hive')); }
  for (let level = 0; level < 20; level++) assert.ok(M.research(d, 'tool'));
  assert.equal(M.research(d, 'tool'), false);
  M.tick(d, 14400); // lifetime honey comes from actual production.
  for (let i = 0; i < 30; i++) { assert.ok(M.mission(d).ready, 'Mission ' + (i + 1)); assert.ok(M.complete(d)); }
  assert.equal(M.mission(d), null); assert.equal(M.complete(d), false);
  for (let level = 1; level < 10; level++) assert.ok(M.build(d, 0, 0, 'hive'));
  assert.equal(M.build(d, 0, 0, 'hive'), false);
  assert.ok(M.RES.every(r => d[r] >= 0));
});

// This is a progression playthrough, not a formula copy: buy research and productive
// machines while continuously tapping. It catches both instant completion and dead ends.
test('100-upgrade campaign supports sustained play and remains completable', () => {
  const d = { bank: 0, total: 0, honey: 0, owned: {}, tools: [] };
  let seconds = 0;
  for (; seconds < 7 * 86400 && d.tools.length < 100; seconds++) {
    const rates = B.rates(B.machines, d, B.tools), tap = B.tapPower(d, B.tools, rates.robots);
    const gain = rates.robots + tap * 2;
    d.bank += gain; d.total += gain; d.honey += rates.honey + Math.max(1, tap * .01) * 2;
    for (const t of B.tools) if (!d.tools.includes(t.id) && d.total >= t.unlock && d.bank >= t.cost && d.honey >= (t.honeyCost || 0)) {
      d.bank -= t.cost; d.honey -= t.honeyCost || 0; d.tools.push(t.id);
    }
    let best = null;
    for (const machine of B.machines) {
      const cost = Math.ceil(machine.cost * 1.15 ** (d.owned[machine.id] || 0));
      const efficiency = cost / machine.rate;
      if (cost < d.bank * .3 && (!best || efficiency < best.efficiency)) best = { machine, cost, efficiency };
    }
    if (best) { d.bank -= best.cost; d.owned[best.machine.id] = (d.owned[best.machine.id] || 0) + 1; }
  }
  assert.equal(d.tools.length, 100);
  assert.ok(seconds > 2 * 3600, 'A fresh campaign should take more than a quick session');
  assert.ok(Number.isFinite(d.total));
});
