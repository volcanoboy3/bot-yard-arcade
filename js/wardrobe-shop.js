(function () {
  'use strict';
  window.mountBeeShop=function (root,A,preview) {
    const M=BeeWardrobe,el=A.el,shop=A.wardrobe;
    let state=shop.snapshot(),tab='paint',selected='paint-0',busy=false,eraser=false,painting=false,lastCell=null;
    let pixels=Array(256).fill(null),history=[];
    const summary=el('p',{class:'bs-summary'}),tabs=el('div',{class:'bs-tabs',role:'tablist','aria-label':'Robot customisation'}),items=el('div',{class:'bs-items paints',role:'tabpanel'});
    const title=el('strong'),detail=el('p'),buy=el('button',{type:'button',class:'bs-buy'}),status=el('p',{class:'bs-status',role:'status'});
    const selection=el('div',{class:'bs-selection'},title,detail,buy);
    const fair=el('p',{class:'bs-fair'},'Bee deliveries arrive at random after about 20–35 seconds of active play. No coins for idle time, menus or offline factories. Coins and owned items save in this browser.');
    const notice=el('p',{class:'bs-note'},'Free preview · Owned items are free to equip again');
    const repair=el('button',{class:'bs-tool',type:'button',hidden:true},'Repair coin save');
    root.append(summary,tabs,notice,items,selection,status,repair,fair);
    const tabButtons=[];
    for(const [id,label] of [['paint','50 paints'],['shape','Shapes'],['accessory','Accessories'],['parts','Parts'],['name','Name'],['draw','Draw paint']]) {
      const b=el('button',{type:'button',role:'tab','aria-selected':'false'},label);
      b.addEventListener('click',()=>{tab=id;renderItems();});tabs.append(b);tabButtons.push({id,b});
    }
    function basePlayer(){return state.player||A.player;}
    function previewItem(item){
      const p={...basePlayer(),...(item?item.patch:{})};
      if(item&&item.slot==='paint')p.paintPixels=null;
      preview(p);
    }
    async function act(fn){
      if(busy)return;busy=true;buy.disabled=true;
      try{const result=await fn();status.textContent=result.message;A.sound.unlock();A.sound.sfx(result.ok?'coin':'error');if(result.ok&&tab==='draw')renderItems();}
      catch{status.textContent='Could not complete that purchase. Please try again.';}
      finally{busy=false;state=shop.snapshot();renderSelection();}
    }
    function renderSelection(){
      summary.replaceChildren(el('span',{class:'bs-coins'},state.ready&&!state.problem?state.balance+' bee coins':'Coin wallet loading…'),el('br'),state.problem||'Play any game for surprise coins. No real money.');
      repair.hidden=!state.problem;
      const usable=state.ready&&!state.problem&&!busy;
      if(tab==='draw') {
        const art=M.drawing(pixels),owned=art&&state.customs?.some(x=>x.pixels.every((c,i)=>c===art.pixels[i]));title.textContent='Your own robot paint';detail.textContent=art?art.colors+(art.colors===1?' colour · ':' colours · ')+art.price+' coins · More colours and detail cost more.':'Draw on the 16×16 canvas. Use up to 32 colours. Your price appears before you buy.';
        buy.textContent=owned?'Equip drawing · owned':art?'Unlock my drawing · '+art.price+' coins':'Draw something first';buy.disabled=!usable||!art||(!owned&&state.balance<art.price);
        preview({...basePlayer(),pattern:'custom',paintPixels:pixels});return;
      }
      if(tab==='name') {
        title.textContent='Give your robot a name';detail.textContent='Changing the name costs 20 coins. Letters, numbers, spaces and hyphens; up to 14 characters.';
        buy.textContent='Save name · 20 coins';const input=items.querySelector('input');buy.disabled=!usable||state.balance<20||!M.cleanName(input?.value)||M.cleanName(input?.value)===basePlayer().name;return;
      }
      const item=M.byId[selected];
      if(!item){title.textContent='Choose something to preview';detail.textContent='Every colour, shape and accessory has a price.';buy.disabled=true;buy.textContent='Choose an item';return;}
      const owned=state.owned?.includes(item.id);
      title.textContent=item.name+' · '+item.tier;
      detail.textContent=owned?'You own this. Equip it whenever you like.':'Preview only. Unlock to wear this in your games.';
      buy.textContent=owned?'Equip · owned':'Unlock & equip · '+item.price+' coins';
      buy.disabled=!usable||(!owned&&state.balance<item.price);
      items.querySelectorAll('[data-item]').forEach(b=>{b.classList.toggle('selected',b.dataset.item===selected);const owned=!!state.owned?.includes(b.dataset.item);b.classList.toggle('owned',owned);b.setAttribute('aria-pressed',String(b.dataset.item===selected));const item=M.byId[b.dataset.item];b.setAttribute('aria-label',item.name+', '+item.tier+', '+(owned?'owned':item.price+' coins'));b.querySelector('.bs-price').textContent=owned?'Owned':M.byId[b.dataset.item].price+' coins';});
      previewItem(item);
    }
    function renderItems(){
      tabButtons.forEach(({id,b})=>b.setAttribute('aria-selected',String(tab===id)));
      items.replaceChildren();items.className='bs-items'+(tab==='paint'?' paints':'');
      items.style.display=tab==='draw'||tab==='name'?'block':'';
      if(tab==='name') {
        const input=el('input',{class:'bs-name',maxLength:14,value:basePlayer().name,'aria-label':'New robot name',autocomplete:'off',spellcheck:false});
        input.addEventListener('input',()=>{preview({...basePlayer(),name:M.cleanName(input.value)||basePlayer().name});renderSelection();});items.append(input);preview(basePlayer());
      } else if(tab==='draw') renderPainter();
      else {
        const list=M.catalogue.filter(x=>x.category===tab);
        if(!list.some(x=>x.id===selected)) selected=list[0]?.id;
        for(const item of list) {
          const visual=item.slot==='paint'?el('span',{class:'bs-swatch',style:{'--c':item.patch.body},'aria-hidden':'true'}):el('span',null,({shape:'⬡',accessory:'✿',parts:'⚙'})[item.category]);
          const b=el('button',{type:'button',class:'bs-item',dataset:{item:item.id,tier:item.tier},'aria-label':item.name+', '+item.tier+', '+(state.owned?.includes(item.id)?'owned':item.price+' coins')},visual,el('span',null,item.name),el('span',{class:'bs-price'},state.owned?.includes(item.id)?'Owned':item.price+' coins'));
          b.addEventListener('click',()=>{selected=item.id;renderSelection();});if(item.slot==='paint')b.querySelector('.bs-swatch').style.setProperty('--c',item.patch.body);items.append(b);
        }
      }
      renderSelection();
    }
    buy.addEventListener('click',()=>{
      if(tab==='name'){const name=items.querySelector('input')?.value;act(()=>shop.rename(name));}
      else if(tab==='draw')act(()=>shop.draw(pixels.slice()));else act(()=>shop.buy(selected));
    });
    function renderPainter(){
      const color=el('input',{type:'color',value:'#f5c518','aria-label':'Drawing colour'}),erase=el('button',{class:'bs-tool',type:'button'},'Eraser'),undo=el('button',{class:'bs-tool',type:'button'},'Undo'),clear=el('button',{class:'bs-tool',type:'button'},'Clear');
      const canvas=el('canvas',{width:256,height:256,'aria-label':'16 by 16 pixel paint canvas. Drag to draw.'}),c=canvas.getContext('2d');
      const library=el('div',{class:'bs-library'});
      for(const [i,item] of (state.customs||[]).entries()) {
        const button=el('button',{type:'button'},'Wear drawing '+(i+1));button.addEventListener('click',()=>{pixels=item.pixels.slice();act(()=>shop.equipDrawing(item.id));});library.append(button);
      }
      items.append(el('div',{class:'bs-editor'},el('div',{class:'bs-tools'},color,erase,undo,clear),canvas,library));
      const draw=()=>{c.clearRect(0,0,256,256);for(let i=0;i<256;i++)if(pixels[i]){c.fillStyle=pixels[i];c.fillRect((i%16)*16,Math.floor(i/16)*16,16,16);}c.strokeStyle='#ffffff1a';c.lineWidth=1;for(let i=0;i<=16;i++){c.beginPath();c.moveTo(i*16,0);c.lineTo(i*16,256);c.moveTo(0,i*16);c.lineTo(256,i*16);c.stroke();}renderSelection();};
      const mark=(x,y)=>{if(x>=0&&y>=0&&x<16&&y<16)pixels[y*16+x]=eraser?null:color.value;};
      const point=e=>{const r=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(15,Math.floor((e.clientX-r.left)/r.width*16))),y=Math.max(0,Math.min(15,Math.floor((e.clientY-r.top)/r.height*16)));if(lastCell){const dx=x-lastCell.x,dy=y-lastCell.y,n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=n;i++)mark(Math.round(lastCell.x+dx*i/Math.max(1,n)),Math.round(lastCell.y+dy*i/Math.max(1,n)));}else mark(x,y);lastCell={x,y};draw();};
      canvas.addEventListener('pointerdown',e=>{e.preventDefault();history.push(pixels.slice());if(history.length>30)history.shift();painting=true;lastCell=null;BotKit.capture(canvas,e);point(e);});
      canvas.addEventListener('pointermove',e=>{if(painting)point(e);});
      for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{painting=false;lastCell=null;});
      erase.addEventListener('click',()=>{eraser=!eraser;erase.textContent=eraser?'Brush':'Eraser';});
      color.addEventListener('input',()=>{eraser=false;erase.textContent='Eraser';});
      undo.addEventListener('click',()=>{if(history.length)pixels=history.pop();draw();});
      clear.addEventListener('click',()=>{history.push(pixels.slice());pixels=Array(256).fill(null);draw();});draw();
    }
    repair.addEventListener('click',()=>{
      repair.hidden=true;status.textContent='A fresh wallet starts at 0 coins with starter gear. Your game progress and scores stay.';
      const yes=el('button',{class:'bs-tool',type:'button'},'Start fresh coin wallet'),no=el('button',{class:'bs-tool',type:'button'},'Keep current save');
      const row=el('div',{class:'bs-tools'},yes,no);root.insertBefore(row,fair);
      yes.addEventListener('click',()=>{row.remove();act(()=>shop.repair());});no.addEventListener('click',()=>{row.remove();repair.hidden=false;});
    });
    A.on('wallet',s=>{state=s;renderSelection();});
    shop.ready.then(()=>{state=shop.snapshot();renderItems();if(state.problem)status.textContent=state.problem;});
    renderItems();
  };
})();
