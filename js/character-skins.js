/* Full character silhouettes. The classic robot renderer still handles paint and parts. */
(function () {
  'use strict';
  const K=BotKit;
  function oval(c,x,y,rx,ry,color,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();}
  function box(c,x,y,w,h,r,color){c.fillStyle=color;K.rr(c,x,y,w,h,r);}
  function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function line(c,points,color,width=3){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  function star(c,x,y,r,color){poly(c,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.43:r;return[x+Math.cos(a)*d,y+Math.sin(a)*d];}),color);}
  function feet(c,color,o,t){const step=o.walk?Math.sin(t*12)*2.5:0;box(c,-23,33+step,18,13,6,color);box(c,5,33-step,18,13,6,color);}
  function arms(c,color){oval(c,-29,9,8,19,color,-.22);oval(c,29,9,8,19,color,.22);}
  function chest(c,color){box(c,-24,-5,48,43,18,color);}
  function eyes(c,o,y=-30,gap=9,light=false){
    const look=K.clamp(o.look||0,-1,1)*1.8;
    for(const side of [-1,1]){
      const x=side*gap+look;
      if(o.mood==='dead'){line(c,[[x-3,y-3],[x+3,y+3]],'#25333b',2);line(c,[[x+3,y-3],[x-3,y+3]],'#25333b',2);}
      else{oval(c,x,y,4.2,5.3,light?'#f4fcff':'#24333d');oval(c,x+.7,y-.4,2.3,2.8,o.eye||'#bff6ff');oval(c,x+1,y-.2,1.2,1.7,'#19323a');oval(c,x-.5,y-1.8,.8,1,'#fffdf0');}
    }
    c.strokeStyle=light?'#f7f7d2':'#29333c';c.lineWidth=2;c.beginPath();
    if(o.mood==='sad'||o.mood==='angry')c.arc(0,y+13,5,Math.PI*1.15,Math.PI*1.85);
    else c.arc(0,y+7,5,.1*Math.PI,.9*Math.PI);
    c.stroke();
  }
  function chip(c,y=23){box(c,-8,y-4,16,9,3,'#28454d');for(let i=0;i<3;i++)oval(c,-4+i*4,y,1.1,1.4,['#91eff0','#ffdd71','#ff9fc5'][i]);}
  function ear(c,x,color,inside,tall=false){
    if(tall){oval(c,x,-55,8,21,color,x<0?-.12:.12);oval(c,x,-57,3,14,inside,x<0?-.12:.12);}
    else{poly(c,[[x-10,-40],[x,-65],[x+11,-39]],color);poly(c,[[x-5,-43],[x,-56],[x+6,-42]],inside);}
  }
  function beeWings(c,t,color='#e6faff'){
    for(const side of [-1,1]){oval(c,side*32,-10,17,27,color,side*(.48+Math.sin(t*12)*.08));oval(c,side*35,12,12,19,'#a7e3ebc9',side*.7);line(c,[[side*23,-2],[side*41,-23]],'#87bac977',1);}
  }
  function insect(c,id,o,t){
    const queen=id==='queen-bee',lady=id==='ladybug',butterfly=id==='butterfly';
    const body=lady?'#f35767':butterfly?'#9564ce':'#ffcf47';
    if(butterfly){for(const side of[-1,1]){oval(c,side*30,-13,25,32,'#b884eb',side*.5);oval(c,side*30,20,22,23,'#ef9acb',-side*.4);oval(c,side*34,-15,13,18,'#6cdad6',side*.4);oval(c,side*33,22,9,10,'#ffd569');}}
    else beeWings(c,t,lady?'#d7eef666':'#e6faffcc');
    feet(c,'#3c3b48',o,t);arms(c,'#3c3b48');
    oval(c,0,11,butterfly?18:29,31,body);
    if(lady){line(c,[[0,-14],[0,40]],'#34313f',3);for(const[x,y]of[[-16,-2],[16,-2],[-18,18],[18,18],[-9,31],[9,31]])oval(c,x,y,4.5,5,'#302f3a');}
    else if(!butterfly){c.save();c.beginPath();c.ellipse(0,11,29,31,0,0,Math.PI*2);c.clip();box(c,-32,1,64,8,0,'#353442');box(c,-32,22,64,8,0,'#353442');c.restore();}
    oval(c,0,-29,25,24,body);
    for(const side of[-1,1]){line(c,[[side*10,-47],[side*16,-61]],'#343444',3);oval(c,side*17,-63,3.5,4,'#343444');}
    eyes(c,o);oval(c,-17,-19,4,2,'#eea28e99');oval(c,17,-19,4,2,'#eea28e99');
    chip(c,34);
    if(queen){poly(c,[[-24,-49],[-26,-66],[-12,-57],[0,-74],[12,-57],[26,-66],[24,-49]],'#ffdb71');oval(c,0,-57,3,4,'#ed83ad');box(c,-20,-4,40,7,4,'#fff1b7');}
  }
  function animal(c,id,o,t){
    const color={cat:'#8d9cba',fox:'#ef9752',bear:'#bc8c59',frog:'#87ce6e',bunny:'#e4e7f3',panda:'#f0f2e9'}[id];
    if(id==='cat'){c.strokeStyle=color;c.lineWidth=10;c.beginPath();c.moveTo(18,28);c.bezierCurveTo(53,40,48,-10,35,-7);c.stroke();}
    if(id==='fox'){oval(c,29,20,16,29,'#ef9752',.8);oval(c,40,3,12,12,'#fff0d1',.7);}
    if(id==='bunny')oval(c,27,27,10,10,'#fffdf2');
    feet(c,id==='panda'?'#3b4049':color,o,t);arms(c,id==='panda'?'#3b4049':color);chest(c,color);oval(c,0,16,16,19,id==='frog'?'#c9e891':'#fff0dc');
    if(id==='cat'||id==='fox'){ear(c,-16,color,'#efb2ac');ear(c,16,color,'#efb2ac');}
    if(id==='bunny'){ear(c,-14,color,'#efa5c4',true);ear(c,14,color,'#efa5c4',true);}
    if(id==='bear'||id==='panda')for(const x of[-21,21]){oval(c,x,-48,10,11,id==='panda'?'#343943':color);oval(c,x,-48,5,6,id==='panda'?'#565965':'#e7bb92');}
    if(id==='frog'){for(const x of[-15,15])oval(c,x,-47,12,12,color);oval(c,0,-27,29,22,color);eyes(c,o,-43,15);}
    else{
      oval(c,0,-29,27,24,color);
      if(id==='panda')for(const x of[-10,10])oval(c,x,-31,8,10,'#3b4049',x<0?.4:-.4);
      if(['fox','bear','cat','bunny'].includes(id)){oval(c,-7,-17,9,7,'#fff0dc');oval(c,7,-17,9,7,'#fff0dc');oval(c,0,-20,3,2.2,id==='bunny'?'#d788a7':'#4b383c');}
      eyes(c,o,-32,10,id==='panda');
      if(id==='cat')for(const side of[-1,1])for(const dy of[-2,3])line(c,[[side*13,-18+dy],[side*29,-20+dy]],'#3d4e61',1.4);
    }
    if(id==='bear'){box(c,-13,6,26,24,7,'#dca044');box(c,-15,4,30,7,3,'#744e32');K.drawBee(c,0,19,14,t);}
    else chip(c,28);
  }
  function reptile(c,id,o,t){
    const dragon=id==='dragon',color=dragon?'#9e76d1':'#73b77c';
    poly(c,[[15,25],[48,39],[37,11],[28,18]],color);
    if(dragon)for(const side of[-1,1]){poly(c,[[side*21,-4],[side*48,-27],[side*47,18],[side*28,28]],'#7955aa');poly(c,[[side*25,1],[side*43,-18],[side*40,14]],'#d6abeb');}
    feet(c,color,o,t);arms(c,color);chest(c,color);oval(c,0,15,16,22,'#f1d493');
    for(const y of[6,15,24])line(c,[[-12,y],[12,y]],'#c8ac7d',1.4);
    for(const side of[-1,1])poly(c,[[side*10,-43],[side*17,-66],[side*25,-39]],'#efdb9e');
    oval(c,0,-30,27,24,color);oval(c,7,-14,23,12,dragon?'#bc97e0':'#a9d99a');
    eyes(c,o,-33);for(const x of[4,17])oval(c,x,-17,1.7,2,'#415948');
    if(dragon){poly(c,[[-13,-11],[-9,-4],[-6,-11]],'#fff3d0');poly(c,[[12,-10],[16,-4],[19,-10]],'#fff3d0');}
    else for(let i=0;i<4;i++)poly(c,[[-24,-2+i*10],[-36,2+i*10],[-24,8+i*10]],'#d8d981');
    chip(c,32);
  }
  function garden(c,id,o,t){
    if(id==='hive'){
      feet(c,'#70563e',o,t);arms(c,'#bd9147');
      for(let i=0;i<6;i++)box(c,-33+i*3,25-i*13,66-i*6,19,10,i%2?'#d5a041':'#f4c05d');
      oval(c,0,24,10,12,'#715038');eyes(c,o,-21,10);K.drawBee(c,35,-22+Math.sin(t*3)*3,21,t);return;
    }
    const green='#6fae72';feet(c,green,o,t);arms(c,id==='mushroom'?'#e8d6b6':green);chest(c,id==='mushroom'?'#e8d6b6':green);
    if(id==='flower'){
      for(let i=0;i<12;i++){const a=i*Math.PI/6;oval(c,Math.cos(a)*29,-29+Math.sin(a)*29,9,18,i%2?'#ffd158':'#f2b341',a-Math.PI/2);}
      oval(c,0,-29,23,23,'#855c3e');eyes(c,o,-32,9,true);for(const side of[-1,1])oval(c,side*28,8,10,22,'#87c384',side*.8);
    }else if(id==='mushroom'){
      oval(c,0,-23,23,25,'#f3dfbc');oval(c,0,-45,40,22,'#d96970');box(c,-39,-45,78,14,7,'#df7478');
      for(const[x,y,r]of[[-20,-51,7],[4,-57,8],[22,-46,6],[-4,-39,5]])oval(c,x,y,r,r*.75,'#fff0d7');eyes(c,o,-23);
    }else{
      box(c,-24,-55,48,91,22,'#7ebd83');
      for(const side of[-1,1]){box(c,side<0?-43:29,-21,14,34,7,'#7ebd83');box(c,side<0?-43:29,-36,14,24,7,'#7ebd83');}
      for(const x of[-14,0,14])line(c,[[x,-49],[x,32]],'#a7dba3',1.5);
      for(let i=0;i<10;i++){const x=-17+(i%3)*16,y=-42+Math.floor(i/3)*22;line(c,[[x-3,y-2],[x+3,y+2]],'#f7efc0',1.3);}
      eyes(c,o,-29);K.drawFlower(c,6,-57,23,'#f4a8c5');
    }
    chip(c,27);
  }
  function adventurer(c,id,o,t){
    if(id==='astronaut'){
      box(c,-34,-7,68,39,9,'#78909c');feet(c,'#e0e5e0',o,t);arms(c,'#e0e5e0');chest(c,'#eef0df');
      oval(c,0,-29,31,30,'#eff0e1');oval(c,0,-29,25,23,'#355568');oval(c,-8,-37,13,6,'#a6e4f755',-.4);eyes(c,o,-32,9,true);
      box(c,-14,7,28,16,4,'#5f8197');for(const x of[-7,0,7])oval(c,x,15,2,2,'#ffc973');line(c,[[-25,0],[-13,0]],'#d2955f',3);chip(c,30);
    }else if(id==='knight'){
      feet(c,'#9caebc',o,t);arms(c,'#9caebc');chest(c,'#b8c8d0');
      poly(c,[[-25,-45],[0,-57],[25,-45],[27,-14],[0,-7],[-27,-14]],'#adbfc9');box(c,-20,-36,40,15,5,'#344755');
      for(let x=-14;x<18;x+=7)line(c,[[x,-34],[x,-23]],'#d5e3e5',2);poly(c,[[0,-54],[1,-73],[24,-68],[9,-61]],'#e69479');
      poly(c,[[-46,-2],[-25,-2],[-26,24],[-35,35],[-45,24]],'#e6bf62');K.drawBee(c,-35,10,17,t);
      line(c,[[39,-34],[39,30]],'#dce8e8',6);line(c,[[31,16],[47,16]],'#d7ae5f',4);chip(c,21);
    }else if(id==='pirate'){
      feet(c,'#5b4a47',o,t);arms(c,'#c59c78');chest(c,'#d76766');box(c,-10,-3,20,34,5,'#f2e2ba');
      for(const y of[5,15,25])line(c,[[-10,y],[10,y]],'#4a647a',2);oval(c,0,-27,25,24,'#dcb28a');
      poly(c,[[-37,-43],[-27,-60],[-10,-53],[0,-64],[13,-53],[29,-60],[38,-42]],'#35404b');line(c,[[-33,-43],[33,-43]],'#e0bb68',3);
      oval(c,0,-52,4,4,'#f9edd2');line(c,[[-6,-47],[6,-57]],'#f9edd2',2);eyes(c,o,-30);oval(c,10,-30,7,7,'#29363e');line(c,[[-22,-39],[22,-22]],'#29363e',2);chip(c,32);
    }else{
      feet(c,'#5a578e',o,t);arms(c,'#7770b5');poly(c,[[-19,-9],[19,-9],[33,40],[-33,40]],'#8272ba');
      oval(c,0,-28,24,24,'#edcfac');eyes(c,o,-30);poly(c,[[-31,-43],[-5,-78],[17,-69],[25,-43]],'#63528f');line(c,[[-32,-43],[32,-43]],'#bba3e2',5);
      for(const[x,y,r]of[[-12,9,5],[13,25,5],[-3,-57,5]])star(c,x,y,r,'#f8dc84');
      line(c,[[43,-33],[39,41]],'#b89667',5);oval(c,43,-39,9,10,'#96e8e5');K.drawBee(c,43,-39,14,t);chip(c,30);
    }
  }
  window.CharacterSkins=Object.freeze({
    draw(c,o,t){
      const id=o.costume;
      if(!id||id==='robot')return false;
      if(['bee','queen-bee','ladybug','butterfly'].includes(id))insect(c,id,o,t);
      else if(['cat','fox','bear','frog','bunny','panda'].includes(id))animal(c,id,o,t);
      else if(['dragon','dinosaur'].includes(id))reptile(c,id,o,t);
      else if(['hive','flower','mushroom','cactus'].includes(id))garden(c,id,o,t);
      else if(['astronaut','knight','pirate','wizard'].includes(id))adventurer(c,id,o,t);
      else return false;
      return true;
    }
  });
})();
