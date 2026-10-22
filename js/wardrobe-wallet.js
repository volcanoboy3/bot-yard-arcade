/* A local signed wallet. This deters edited saves; it is not a server anti-cheat. */
(function () {
  'use strict';
  const M=BeeWardrobe, SAVE='botyard:wardrobe-v1', encoder=new TextEncoder();
  const clone=x=>JSON.parse(JSON.stringify(x));
  const random=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return Math.floor(a[0]/4294967296*n);};
  function db() { return new Promise((resolve,reject)=>{const req=indexedDB.open('botyard-wallet',1);req.onupgradeneeded=()=>req.result.createObjectStore('keys');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); }
  async function signingKey() {
    const database=await db();
    try {
      const existing=await new Promise((resolve,reject)=>{const req=database.transaction('keys').objectStore('keys').get('hmac');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      if(existing) return existing;
      const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
      await new Promise((resolve,reject)=>{const tx=database.transaction('keys','readwrite');tx.objectStore('keys').put(key,'hmac');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      return key;
    } finally {database.close();}
  }
  const lock=fn=>navigator.locks?navigator.locks.request('botyard-coin-wallet',fn):fn();
  window.createBeeWallet=function (legacy, changed, reward) {
    let key=null,data=null,problem='',queue=Promise.resolve(),pending=false,active=0,next=20+random(16),lastFrame=performance.now();
    const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('botyard-coins'):null;
    function snapshot() {
      if(!data) return {ready:false,problem};
      const p={...data.player};
      if(p.customPaint) p.paintPixels=data.customs.find(x=>x.id===p.customPaint)?.pixels.slice() || null;
      return {ready:true,problem,balance:data.balance,earned:data.earned,owned:[...data.owned],customs:clone(data.customs),player:p};
    }
    const publish=()=>changed(snapshot());
    async function read() {
      const raw=localStorage.getItem(SAVE); if(!raw) return null;
      let envelope; try {envelope=JSON.parse(raw);}catch{throw Error('Your coin save could not be verified.');}
      if(!envelope || !Array.isArray(envelope.signature) || envelope.signature.length!==32 || !envelope.signature.every(n=>Number.isInteger(n)&&n>=0&&n<=255) || !M.valid(envelope.data)) throw Error('Your coin save could not be verified.');
      const okay=await crypto.subtle.verify('HMAC',key,new Uint8Array(envelope.signature),encoder.encode(JSON.stringify(envelope.data)));
      if(!okay) throw Error('Your coin save was changed outside the game.');
      return M.migrate(envelope.data);
    }
    async function write(d) {
      if(!M.valid(d)) throw Error('The coin transaction was not valid.');
      const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(JSON.stringify(d)))));
      localStorage.setItem(SAVE,JSON.stringify({data:d,signature}));
      data=d; problem='';publish();if(channel)channel.postMessage('changed');
    }
    const ready=lock(async()=>{try{key=await signingKey();data=await read();if(!data)await write(M.fresh(legacy));else publish();}catch(e){problem=e.message||'Coin saving is unavailable in this browser.';publish();}});
    function transaction(fn) {
      const job=async()=>{await ready;if(problem||!key)return {ok:false,message:problem||'Coin shop is loading.'};
        return lock(async()=>{try{
          const current=await read();if(!current)throw Error('The coin save is missing. Reload before spending coins.');
          const copy=clone(current),result=fn(copy);
          if(result.ok){copy.revision++;await write(copy);}else{data=current;publish();}
          return result;
        }catch(e){problem=e.message;publish();return {ok:false,message:problem};}});
      };
      const result=queue.then(job,job);queue=result.catch(()=>{});return result;
    }
    async function refresh() {await ready;if(!key)return;await lock(async()=>{try{const latest=await read();if(!latest)throw Error('The coin save is missing.');data=latest;problem='';publish();}catch(e){problem=e.message;publish();}});}
    if(channel)channel.onmessage=refresh;
    window.addEventListener('storage',e=>{if(e.key===SAVE)refresh();});
    const shop={
      ready,snapshot,
      buy:id=>transaction(d=>M.purchase(d,id)),
      rename:name=>transaction(d=>M.rename(d,name)),
      draw:pixels=>transaction(d=>M.buyDrawing(d,pixels)),
      equipDrawing:id=>transaction(d=>M.equipDrawing(d,id)),
      async repair(){await ready;return lock(async()=>{try{if(!key)key=await signingKey();await write(M.fresh(null));return {ok:true,message:'Fresh wallet created. Play to earn coins.'};}catch(e){return {ok:false,message:e.message};}});}
    };
    return {shop,
      advance(dt,eligible){
        const now=performance.now(),real=Math.max(0,Math.min(.1,(now-lastFrame)/1000));lastFrame=now;
        if(!data||problem||!eligible||pending||document.hidden)return;
        active+=Math.min(Math.max(0,dt),real);
        if(active<next)return;
        active=0;next=20+random(16);pending=true;
        transaction(d=>{
          const now=Date.now();
          if(now<d.lastRewardAt||now-d.lastRewardAt<15000)return {ok:false,message:'Another tab just received a bee delivery.'};
          const amount=5+random(8);
          if(d.earned+amount>1e8)return {ok:false,message:'Coin collection limit reached.'};
          d.balance+=amount;d.earned+=amount;d.lastRewardAt=now;
          return {ok:true,amount};
        }).then(result=>{if(result.ok)reward(result.amount);}).finally(()=>{pending=false;});
      }
    };
  };
})();
