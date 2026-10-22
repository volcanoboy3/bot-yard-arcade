/* Shared, deterministic clicker economy. Original tool IDs keep old saves working. */
(function (root) {
  'use strict';
  const originalMachines = [
    { id: 'arm',    name: 'Robot Arm',     cost: 15,       rate: 0.1,  desc: 'Bolts parts together' },
    { id: 'belt',   name: 'Conveyor Belt', cost: 100,      rate: 1,    desc: 'Keeps parts rolling' },
    { id: 'line',   name: 'Assembly Line', cost: 1100,     rate: 8,    desc: 'Stamps out robot bodies' },
    { id: 'weld',   name: 'Welding Bay',   cost: 12000,    rate: 47,   desc: 'Welds frames in a flash' },
    { id: 'boss',   name: 'AI Foreman',    cost: 130000,   rate: 260,  desc: 'Runs the whole floor' },
    { id: 'fusion', name: 'Fusion Plant',  cost: 1400000,  rate: 1400, desc: 'Endless clean power' },
    { id: 'nano',   name: 'Nano Swarm',    cost: 20000000, rate: 7800, desc: 'Tiny bots build big bots' }
  ];
  const originalTools = [
    { id: 'glove',  name: 'Power Glove',       cost: 100,     unlock: 30,      mult: 2, desc: '×2 robots per tap' },
    { id: 'driver', name: 'Turbo Screwdriver', cost: 750,     unlock: 400,     mult: 2, desc: '×2 robots per tap' },
    { id: 'rivet',  name: 'Rivet Blaster',     cost: 12000,   unlock: 6000,    mult: 3, desc: '×3 robots per tap' },
    { id: 'hammer', name: 'Mega Hammer',       cost: 200000,  unlock: 100000,  mult: 3, desc: '×3 robots per tap' },
    { id: 'wrench', name: 'Quantum Wrench',    cost: 3000000, unlock: 1500000, pct: 0.05, desc: 'Each tap adds 5% of per sec' }
  ];
  const beeMachines = [
    { id: 'hive', name: 'Robot Beehive', cost: 1e8, rate: 36000, bee: true, desc: 'Bee helpers assemble tiny robots' },
    { id: 'garden', name: 'Nectar Garden', cost: 2e9, rate: 420000, bee: true, desc: 'Flowers power the honey engines' },
    { id: 'queen', name: 'Queen Bee Core', cost: 5e10, rate: 5e6, bee: true, desc: 'Coordinates a mechanical colony' },
    { id: 'apiary', name: 'Planet Apiary', cost: 2e12, rate: 8e7, bee: true, desc: 'A whole planet of friendly bees' },
    { id: 'orbital', name: 'Orbital Honey Ring', cost: 2e14, rate: 1.5e9, bee: true, desc: 'Solar honey factories in orbit' }
  ];
  const chapters = ['Garden', 'Copper', 'Clover', 'Meadow', 'Amber', 'Orchard', 'Crystal', 'Moonflower', 'Sunflower', 'Cloud', 'Coral', 'Starlight', 'Aurora', 'Comet', 'Nebula', 'Galaxy', 'Cosmic', 'Infinity', 'Royal'];
  const types = [
    { label: 'Servo Gloves', mult: 1.8, desc: '×1.8 robots per tap' },
    { label: 'Bee Assembly Team', factory: 1.6, desc: '×1.6 ALL machine production' },
    { label: 'Honey Engines', bee: 1.5, desc: '×1.5 bee machine production · ×1.25 honey' },
    { label: 'Nectar Link', pct: 0.008, desc: 'Each tap adds 0.8% of robots per second' },
    { label: 'Royal Blueprints', factory: 1.35, mult: 1.25, desc: '×1.35 ALL production · ×1.25 tap power' }
  ];
  const upgrades = chapters.flatMap((chapter, tier) => types.map((type, kind) => {
    const cost = Math.ceil(1800 * Math.pow(13, tier) * [1, 1.45, 2.1, 3.1, 4.6][kind]);
    return Object.assign({}, type, { id: 'bee-' + tier + '-' + kind, name: chapter + ' ' + type.label,
      cost, unlock: Math.floor(cost * 0.35), honeyCost: kind === 2 ? Math.ceil(cost * 0.002) : 0, tier });
  }));
  function rates(machines, data, tools) {
    const bought = new Set(data.tools || []);
    let factory = 1, bee = 1, honey = 1, robots = 0, nectar = 0;
    for (const t of tools) if (bought.has(t.id)) {
      factory *= t.factory || 1; bee *= t.bee || 1;
      if (t.bee) honey *= 1.25;
    }
    for (const m of machines) {
      const count = data.owned[m.id] || 0;
      robots += count * m.rate * factory * (m.bee ? bee : 1);
      if (m.bee) nectar += count * m.rate * 0.02 * honey;
    }
    // The first garden upgrade brings a bee friend even before a hive is affordable.
    if (bought.has('bee-0-1')) nectar += honey;
    return { robots, honey: nectar };
  }
  function tapPower(data, tools, rate) {
    const bought = new Set(data.tools || []);
    let base = 1, pct = 0;
    for (const t of tools) if (bought.has(t.id)) { base *= t.mult || 1; pct += t.pct || 0; }
    return base + pct * rate;
  }
  const model = { machines: [...originalMachines, ...beeMachines], tools: [...originalTools, ...upgrades], beeMachines, upgrades, rates, tapPower };
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.BeeEconomy = model;
})(typeof window === 'object' ? window : globalThis);
