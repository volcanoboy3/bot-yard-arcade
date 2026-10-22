const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('../js/wardrobe-model');
test('50 unique paints have transparent rarity pricing and a valid free starter',()=>{
 const paints=M.catalogue.filter(x=>x.category==='paint');assert.equal(paints.length,50);assert.equal(new Set(paints.map(x=>x.patch.body)).size,50);assert.equal(new Set(M.catalogue.map(x=>x.id)).size,M.catalogue.length);assert.ok(M.valid(M.fresh()));
 for(let i=1;i<5;i++)assert.ok(paints[i*10].price>paints[(i-1)*10+1].price);
});
test('purchases require earned coins, re-equipping is free, and renaming is paid',()=>{
 const d=M.fresh();assert.equal(M.purchase(d,'paint-40').ok,false);assert.equal(d.balance,0);
 d.balance=d.earned=1000;assert.ok(M.purchase(d,'paint-40').ok);assert.equal(d.balance,350);assert.equal(d.spent,650);assert.ok(M.purchase(d,'paint-40').ok);assert.equal(d.balance,350);
 assert.ok(M.rename(d,'queen bee').ok);assert.equal(d.player.name,'QUEEN BEE');assert.equal(d.balance,330);assert.ok(M.valid(d));
 const before=JSON.stringify(d);assert.equal(M.purchase(d,'unknown').ok,false);assert.equal(JSON.stringify(d),before);
});
test('legacy players keep only their equipped look; invalid colours never become free items',()=>{
 const d=M.fresh({body:'#ff6fa8',head:'tv',base:'hover',eye:'#9dff9d',name:'Old Bot',hat:'crown'});assert.ok(M.valid(d));assert.ok(d.owned.includes('paint-5'));assert.ok(d.owned.includes('head-tv'));assert.ok(!d.owned.includes('hat-crown'));assert.equal(d.player.hat,'none');
});
test('drawn paints cost coins, detailed drawings cost more, and saved drawings can be reused',()=>{
 const simple=Array(256).fill(null);simple[0]='#ffffff';const detailed=Array.from({length:256},(_,i)=>i%2?'#aabbcc':'#123456');const a=M.drawing(simple),b=M.drawing(detailed);assert.ok(b.price>a.price);assert.equal(M.drawing([]),null);assert.equal(M.drawing(Array(256).fill('url(x)')),null);
 const d=M.fresh();assert.equal(M.buyDrawing(d,simple).ok,false);d.balance=d.earned=1000;assert.ok(M.buyDrawing(d,simple).ok);assert.ok(M.valid(d));const balance=d.balance;assert.ok(M.buyDrawing(d,simple).ok);assert.equal(d.balance,balance);assert.equal(d.customs.length,1);M.purchase(d,'paint-0');assert.ok(M.equipDrawing(d,'custom-0').ok);assert.equal(d.balance,balance);
});
test('edited balances, nonexistent gear and malformed saves fail validation',()=>{
 const d=M.fresh();d.balance=9999;assert.equal(M.valid(d),false);d.balance=0;d.player.hat='crown';assert.equal(M.valid(d),false);assert.equal(M.valid({}),false);
});
test('guard ignores scripts, allows human input and held keys, and pauses fast automation without taking coins',()=>{
 const g=new M.InputGuard();assert.equal(g.input('pointerdown',0,false),false);assert.equal(g.active(1),false);
 for(let i=0;i<80;i++)assert.equal(g.input('keydown',i*35,true,true),true);
 assert.ok(g.active(3000));assert.equal(g.active(20000),false);
 const fast=new M.InputGuard();let accepted=true;for(let i=0;i<24;i++)accepted=fast.input('pointerdown',i*20,true);assert.equal(accepted,false);assert.equal(fast.active(1000),false);assert.ok(fast.input('pointerdown',32000,true));
 const regular=new M.InputGuard();for(let i=0;i<45;i++)regular.input('pointerdown',i*100,true);assert.ok(regular.blockedUntil>4400);
 const human=new M.InputGuard();let t=0;for(let i=0;i<100;i++){t+=160+(i*37%130);assert.ok(human.input('pointerdown',t,true));}assert.equal(human.blockedUntil,0);
});
test('score checks allow ordinary play and large clicker totals but reject impossible scores',()=>{
 assert.ok(M.plausibleScore('robo-runner',1000,45));assert.ok(M.plausibleScore('robot-factory',1e30,2));assert.ok(!M.plausibleScore('robot-factory',Infinity,2));assert.ok(!M.plausibleScore('robo-runner',1e50,2));assert.ok(!M.plausibleScore('honey-island',226,100));
});
test('full character skins are paid looks, separate from the 50 paints',()=>{
 const skins=M.catalogue.filter(x=>x.category==='character');assert.equal(skins.length,21);assert.equal(M.catalogue.filter(x=>x.category==='paint').length,50);
 const d=M.fresh();assert.equal(M.purchase(d,'costume-bee').ok,false);d.balance=d.earned=1000;assert.ok(M.purchase(d,'costume-bee').ok);assert.equal(d.player.costume,'bee');assert.equal(d.balance,915);assert.ok(M.valid(d));
 const before=d.balance;assert.ok(M.purchase(d,'costume-bee').ok);assert.equal(d.balance,before);M.purchase(d,'paint-0');assert.equal(d.player.costume,'robot');M.purchase(d,'costume-bee');assert.equal(d.balance,before);
});
test('old signed wallet payloads migrate without losing coins, gear or drawings',()=>{
 const d=M.fresh();d.earned=d.balance=512;M.purchase(d,'head-tv');delete d.player.costume;d.owned=d.owned.filter(x=>!x.startsWith('costume-'));const owned=d.owned.slice(),balance=d.balance;
 assert.ok(M.valid(d));const migrated=M.migrate(d);assert.equal(migrated.balance,balance);assert.equal(migrated.player.head,'tv');assert.equal(migrated.player.costume,'robot');assert.ok(owned.every(id=>migrated.owned.includes(id)));assert.ok(M.valid(migrated));
 migrated.player.costume='queen-bee';assert.equal(M.valid(migrated),false);
});
