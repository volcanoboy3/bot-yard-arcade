/* Catalogue, purchase rules and non-punitive input checks; no DOM dependencies. */
(function (root) {
  'use strict';
  const tiers = ['Garden', 'Striped', 'Blossom', 'Honeycomb', 'Royal'];
  const prices = [25, 65, 150, 320, 650];
  const names = ['Cyan','Honey','Coral','Clover','Lilac','Rose','Silver','Cherry','Ocean','Cream',
    'Copper','Lemon','Mint','Peach','Grape','Sky','Pumpkin','Jade','Berry','Sand',
    'Fuchsia','Orchid','Lagoon','Apricot','Sage','Periwinkle','Flamingo','Pearl','Marigold','Teal',
    'Amber','Forest','Iris','Cobalt','Tangerine','Lavender','Crimson','Seafoam','Bronze','Buttercup',
    'Galaxy','Aurora','Starlight','Moonstone','Sunburst','Emerald','Ruby','Sapphire','Amethyst','Queen'];
  const colors = ['#5ad1e6','#f5c518','#ff8a5c','#9fdc6b','#c3a6ff','#ff6fa8','#c9d4db','#ff5a5a','#3c80da','#fff0b8',
    '#ce885c','#f7e858','#7de8b6','#ffb891','#a279d9','#8bd8ff','#f18a24','#4fbd90','#bc5c97','#d9bc8d',
    '#ec54b8','#bc91e8','#38bfca','#ffc482','#acc59a','#a1b5f2','#f9899f','#e8eee2','#ffc044','#259caa',
    '#f3ad36','#388968','#8070c6','#4564d6','#ff9b40','#b3a2ef','#c54b64','#8fe0cb','#b68b5c','#f4dc86',
    '#6451a3','#55c6b6','#b7c6fa','#c9c3df','#ffd476','#30aa7d','#d14463','#458bf0','#a450d2','#f8d176'];
  const catalogue = colors.map((body, i) => ({ id: 'paint-' + i, category: 'paint', slot: 'paint', name: names[i], tier: tiers[Math.floor(i / 10)], price: i === 0 ? 0 : prices[Math.floor(i / 10)], value: String(i), patch: { body, pattern: ['solid','stripes','petals','honeycomb','royal'][Math.floor(i / 10)], customPaint: null } }));
  function group(category, slot, values) { values.forEach(([value, name, price, tier]) => catalogue.push({ id: slot + '-' + value, category, slot, value, name, price, tier: tier || (price >= 300 ? 'Royal' : price >= 100 ? 'Rare' : 'Garden'), patch: { [slot]: value } })); }
  group('shape','head',[['box','Box head',0],['dome','Dome head',75],['tv','Screen head',140],['hex','Honeycomb head',320]]);
  group('shape','shell',[['box','Classic body',0],['round','Round body',95],['hex','Hexagon body',240]]);
  group('parts','antenna',[['ball','Signal ball',0],['bolt','Lightning antenna',65],['twin','Bee feelers',100],['dish','Satellite dish',140],['none','No antenna',0]]);
  group('parts','base',[['wheels','Wheels',0],['treads','Treads',90],['legs','Walking legs',120],['hover','Hover engine',340]]);
  group('parts','eye',[['#bff6ff','Ice eyes',0],['#9dff9d','Clover eyes',40],['#ffd36b','Honey eyes',60],['#ff9ad5','Blossom eyes',90]]);
  group('accessory','hat',[['none','No hat',0],['flower','Flower crown',85],['cap','Bee cap',120],['keeper','Beekeeper hat',200],['crown','Queen crown',500]]);
  group('accessory','back',[['none','No backpack',0],['wings','Bee wings',180],['jetpack','Honey jetpack',400]]);
  group('accessory','face',[['none','No glasses',0],['goggles','Bee goggles',100],['shades','Royal shades',280]]);
  group('accessory','badge',[['none','No badge',0],['bee','Bee friend badge',60],['flower','Flower badge',75],['star','Royal star',300]]);
  const byId = Object.fromEntries(catalogue.map(x => [x.id, x]));
  const defaults = { name:'BOLT-7', body:colors[0], pattern:'solid', customPaint:null, head:'box', shell:'box', antenna:'ball', base:'wheels', eye:'#bff6ff', hat:'none', back:'none', face:'none', badge:'none' };
  const cleanName = name => String(name || '').toUpperCase().replace(/[^A-Z0-9 -]/g,'').slice(0,14).trim();
  function fresh(legacy) {
    const d = { v:1, earned:0, spent:0, balance:0, owned:catalogue.filter(x => !x.price).map(x => x.id), customs:[], player:{...defaults}, lastRewardAt:0, created:Date.now(), revision:0 };
    // Keep the one look an existing player already wears, rather than charging them for it again.
    if (legacy && typeof legacy === 'object') {
      d.player.name = cleanName(legacy.name) || defaults.name;
      for (const slot of ['head','antenna','base','eye']) { const item = catalogue.find(x => x.slot === slot && x.value === legacy[slot]); if (item) { d.owned.push(item.id); Object.assign(d.player,item.patch); } }
      const paint = catalogue.find(x => x.slot === 'paint' && Number(x.value)<8 && x.patch.body.toLowerCase() === String(legacy.body).toLowerCase());
      if (paint) { d.owned.push(paint.id); Object.assign(d.player,paint.patch); }
    }
    d.owned = [...new Set(d.owned)]; return d;
  }
  function drawing(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== 256 || pixels.some(c => c !== null && !/^#[0-9a-f]{6}$/i.test(c))) return null;
    const clean = pixels.map(c => c && c.toLowerCase()), colors = new Set(clean.filter(Boolean));
    if (!colors.size || colors.size > 32) return null;
    let edges = 0, coverage = 0;
    for (let i = 0; i < 256; i++) { if (clean[i]) coverage++; if (i % 16 && clean[i] !== clean[i-1]) edges++; if (i >= 16 && clean[i] !== clean[i-16]) edges++; }
    return { pixels:clean, price:Math.min(900,100 + colors.size * 12 + Math.ceil(edges / 4) + Math.ceil(coverage / 8)), colors:colors.size };
  }
  function valid(d) {
    if (!d || d.v !== 1 || ![d.earned,d.spent,d.balance,d.revision,d.lastRewardAt,d.created].every(n => Number.isSafeInteger(n) && n >= 0) || d.earned > 1e8 || d.balance !== d.earned-d.spent || d.balance < 0) return false;
    if (!Array.isArray(d.owned) || new Set(d.owned).size !== d.owned.length || d.owned.some(id => !byId[id]) || !Array.isArray(d.customs) || d.customs.length > 40 || d.customs.some((x,i) => x.id !== 'custom-'+i || !drawing(x.pixels))) return false;
    const p = d.player;
    if (!p || cleanName(p.name) !== p.name || !p.name) return false;
    const paint = p.customPaint ? d.customs.find(x => x.id === p.customPaint) : catalogue.find(x => x.slot === 'paint' && x.patch.body === p.body && x.patch.pattern === p.pattern && d.owned.includes(x.id));
    if (!paint) return false;
    for (const slot of ['head','shell','antenna','base','eye','hat','back','face','badge']) if (!catalogue.some(x => x.slot === slot && x.value === p[slot] && d.owned.includes(x.id))) return false;
    return true;
  }
  function purchase(d, id) {
    const item = byId[id]; if (!item) return { ok:false, message:'Unknown item.' };
    const owned = d.owned.includes(id), price = owned ? 0 : item.price;
    if (d.balance < price) return { ok:false, message:'Play to earn '+(price-d.balance)+' more coins.' };
    d.balance -= price; d.spent += price;
    if (!owned) d.owned.push(id);
    Object.assign(d.player,item.patch); return { ok:true, message:owned ? item.name+' equipped!' : item.name+' unlocked and equipped!' };
  }
  function rename(d, name) {
    name = cleanName(name);
    if (!name) return { ok:false, message:'Choose a name with letters or numbers.' };
    if (name === d.player.name) return { ok:true, message:'That is already your name.' };
    if (d.balance < 20) return { ok:false, message:'Renaming costs 20 coins.' };
    d.balance -= 20; d.spent += 20; d.player.name = name; return { ok:true, message:'Your robot is now '+name+'!' };
  }
  function buyDrawing(d, pixels) {
    const art = drawing(pixels); if (!art) return { ok:false, message:'Draw something using up to 32 colours.' };
    const existing=d.customs.find(x=>x.pixels.every((c,i)=>c===art.pixels[i]));
    if(existing)return equipDrawing(d,existing.id);
    if (d.customs.length >= 40) return { ok:false, message:'Your 40 custom paint slots are full.' };
    if (d.balance < art.price) return { ok:false, message:'This drawing costs '+art.price+' coins. Keep playing!' };
    const item = { id:'custom-'+d.customs.length, pixels:art.pixels };
    d.customs.push(item); d.spent += art.price; d.balance -= art.price; Object.assign(d.player,{customPaint:item.id,pattern:'custom'});
    return { ok:true, message:'Your own paint unlocked and equipped!' };
  }
  function equipDrawing(d, id) { const item = d.customs.find(x => x.id === id); if (!item) return {ok:false,message:'Drawing not owned.'}; Object.assign(d.player,{customPaint:id,pattern:'custom'}); return {ok:true,message:'Custom paint equipped!'}; }
  class InputGuard {
    constructor() { this.taps=[]; this.rhythm=[]; this.blockedUntil=0; this.lastActivity=-Infinity; this.lastPointer=null; }
    input(kind, now, trusted, repeat=false, point=null) {
      if (!trusted) return false;
      if (kind==='move') {
        if (!point) return true;
        const last=this.lastPointer; this.lastPointer=point;
        if (last && Math.hypot(point.x-last.x,point.y-last.y)<3) return true;
        this.lastActivity=now; return true;
      }
      if (now < this.blockedUntil) return false;
      this.lastActivity=now;
      if (repeat || kind==='release') return true;
      this.rhythm.push(now); if(this.rhythm.length>45)this.rhythm.shift();
      if(this.rhythm.length===45) {
        const intervals=this.rhythm.slice(1).map((t,i)=>t-this.rhythm[i]);
        const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
        const variation=Math.sqrt(intervals.reduce((a,b)=>a+(b-mean)**2,0)/intervals.length)/Math.max(1,mean);
        if(mean<150&&variation<.015) {this.blockedUntil=now+30000;this.rhythm=[];return false;}
      }
      this.taps=this.taps.filter(t=>now-t<1000); this.taps.push(now);
      // Sustained impossible tap rates pause rewards and ignore excess actions, never ban saves.
      if (this.taps.length>22) { this.blockedUntil=now+30000; this.taps=[]; return false; }
      return true;
    }
    active(now) { return now >= this.blockedUntil && now-this.lastActivity < 12000; }
  }
  function plausibleScore(id,n,seconds) {
    if(!Number.isFinite(n)||n<0)return false;
    if(id==='robot-factory')return true;
    if(id==='honey-island')return n<=225;
    return n<=Math.max(50000,Math.max(0,seconds)*20000);
  }
  const model={plausibleScore,catalogue,byId,tiers,defaults,fresh,valid,purchase,rename,drawing,buyDrawing,equipDrawing,InputGuard,cleanName};
  for(const item of catalogue){Object.freeze(item.patch);Object.freeze(item);}
  Object.freeze(catalogue);Object.freeze(byId);Object.freeze(defaults);Object.freeze(tiers);Object.freeze(InputGuard.prototype);Object.freeze(model);
  if(typeof module==='object'&&module.exports) module.exports=model; else Object.defineProperty(root,'BeeWardrobe',{value:model});
})(typeof window==='object'?window:globalThis);
