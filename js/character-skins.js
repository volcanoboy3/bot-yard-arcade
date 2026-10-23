/* Full robot and bee silhouettes; paid accessories remain on top of each skin. */
(function () {
  'use strict';
  const K=BotKit;
  function oval(c,x,y,rx,ry,color,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();}
  function box(c,x,y,w,h,r,color){c.fillStyle=color;K.rr(c,x,y,w,h,r);}
  function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function line(c,points,color,width=3){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  function hex(c,x,y,r,color){poly(c,Array.from({length:6},(_,i)=>[x+Math.cos(i*Math.PI/3)*r,y+Math.sin(i*Math.PI/3)*r]),color);}
  function ring(c,x,y,rx,ry,color,angle=0){c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.stroke();}
  function eyes(c,o){const look=K.clamp(o.look||0,-1,1)*1.8;for(const side of[-1,1]){const x=side*9+look;oval(c,x,-30,4.2,5.3,'#24333d');oval(c,x+.7,-30.4,2.3,2.8,o.eye||'#bff6ff');oval(c,x+1,-30.2,1.2,1.7,'#19323a');oval(c,x-.5,-31.8,.8,1,'#fffdf0');}c.strokeStyle='#29333c';c.lineWidth=2;c.beginPath();c.arc(0,-23,5,.1*Math.PI,.9*Math.PI);c.stroke();}
  function bee(c,id,o,t){
    for(const side of[-1,1]){oval(c,side*32,-10,17,27,'#e6faffcc',side*(.48+Math.sin(t*12)*.08));oval(c,side*35,12,12,19,'#a7e3ebc9',side*.7);line(c,[[side*23,-2],[side*41,-23]],'#87bac977',1);oval(c,side*29,9,8,19,'#3c3b48',side*.22);box(c,side<0?-23:5,33,18,13,6,'#3c3b48');}
    oval(c,0,11,29,31,'#ffcf47');c.save();c.beginPath();c.ellipse(0,11,29,31,0,0,Math.PI*2);c.clip();box(c,-32,1,64,8,0,'#353442');box(c,-32,22,64,8,0,'#353442');c.restore();
    oval(c,0,-29,25,24,'#ffcf47');for(const side of[-1,1]){line(c,[[side*10,-47],[side*16,-61]],'#343444',3);oval(c,side*17,-63,3.5,4,'#343444');}eyes(c,o);oval(c,-17,-19,4,2,'#eea28e99');oval(c,17,-19,4,2,'#eea28e99');
    box(c,-8,30,16,9,3,'#28454d');for(let i=0;i<3;i++)oval(c,-4+i*4,34,1.1,1.4,['#91eff0','#ffdd71','#ff9fc5'][i]);
    if(id==='queen-bee'){poly(c,[[-24,-49],[-26,-66],[-12,-57],[0,-74],[12,-57],[26,-66],[24,-49]],'#ffdb71');oval(c,0,-57,3,4,'#ed83ad');box(c,-20,-4,40,7,4,'#fff1b7');}
  }
  // Each chassis has its own machinery and silhouette, plus the animated robot face.
  const chassis={
    hive:['#e8b64e','hex','hex','treads','twin'],sentry:['#e9717a','tv','box','treads','twin'],
    'bee-drone':['#f4cd50','hex','hex','hover','twin'],scout:['#7bd9e8','box','box','legs','ball'],
    racer:['#ef9952','dome','round','wheels','none'],builder:['#eec14f','box','box','legs','none'],
    spring:['#8cce79','dome','round','legs','bolt'],radar:['#b69ade','tv','box','wheels','none'],
    repair:['#e4eee8','tv','box','legs','ball'],titan:['#a18bda','hex','hex','legs','none'],
    tank:['#7fba84','box','box','treads','ball'],solar:['#78c7b7','hex','hex','legs','ball'],
    saucer:['#b9cdd6','dome','round','hover','ball'],orbit:['#e0e9ef','box','round','hover','none'],
    guardian:['#6dadd6','hex','hex','legs','twin'],salvage:['#c78f64','tv','box','treads','none'],
    quantum:['#7886c5','hex','hex','hover','bolt'],crane:['#e8bd48','box','box','treads','none']
  };
  function mech(c,id,o,t){
    const [body,head,shell,base,antenna]=chassis[id];
    // Equipment mounted behind the chassis.
    if(id==='bee-drone')for(const s of[-1,1]){line(c,[[s*22,0],[s*34,-17]],'#67848e',5);oval(c,s*36,-20,14,22,'#b7eff49c',s*.45);ring(c,s*36,-20,14,22,'#769fae',s*.45);line(c,[[s*36,-32],[s*36,-8]],'#d9fcff',2);box(c,s*36-8,20,16,13,4,'#566d7b');oval(c,s*36,35,6,3,'#8df3ed');}
    if(id==='solar')for(const s of[-1,1]){box(c,s<0?-50:27,-29,23,51,3,'#e0c66f');box(c,s<0?-47:30,-26,17,45,1,'#355989');for(let i=0;i<5;i++)line(c,[[s<0?-47:30,-21+i*9],[s<0?-30:47,-21+i*9]],'#84bdd1',1);line(c,[[s*38,-25],[s*38,18]],'#84bdd1',1);}
    if(id==='orbit')for(const s of[-1,1]){box(c,s*30-7,-12,14,41,6,'#879fb1');box(c,s*30-5,25,10,8,2,'#91f2f2');}
    if(id==='titan')for(const s of[-1,1]){box(c,s*29-9,-9,18,50,4,'#57667f');poly(c,[[s*23,38],[s*35,38],[s*30,49]],'#8ee8f7');}
    if(id==='quantum'){ring(c,0,-2,46,21,'#b5aff1',-.5);ring(c,0,-2,46,21,'#83dee6',.5);}
    if(id==='crane'){line(c,[[-25,30],[-25,-67],[29,-67],[38,-57]],'#8b7042',8);line(c,[[-25,-63],[27,-63]],'#f9d567',5);line(c,[[34,-61],[34,-35]],'#a7b6be',2);ring(c,34,-30,6,6,'#d4e0df');box(c,30,-39,8,5,0,'#142833');}
    K.drawBot(c,0,-4.5,110,{...o,costume:'robot',body,head,shell,base,antenna,pattern:'solid',customPaint:null,hat:'none',back:'none',face:'none',badge:'none',shadow:false,flip:false});
    if(id==='hive'){for(const [x,y]of[[-12,4],[0,4],[12,4],[-6,15],[6,15]]){hex(c,x,y,6,'#775c32');hex(c,x,y,4,'#ffdf7c');}K.drawBee(c,35,-43+Math.sin(t*3)*3,20,t);}
    if(id==='sentry'){for(const s of[-1,1]){box(c,s*31-6,-9,12,20,3,'#694954');oval(c,s*31,-12,4,4,s<0?'#9ef3dd':'#ffd375');}poly(c,[[-19,20],[0,13],[19,20],[13,29],[-13,29]],'#b34a5d');}
    if(id==='scout'){line(c,[[24,-23],[35,-23]],'#738f9d',4);box(c,29,-34,16,22,5,'#356d85');oval(c,37,-24,6,6,'#a6f3f0');oval(c,37,-24,3,3,'#26495a');}
    if(id==='racer'){poly(c,[[-4,-43],[0,-65],[8,-44]],'#ffe4a8');for(const s of[-1,1]){oval(c,s*25,37,13,14,'#243b48');oval(c,s*25,37,8,9,'#ecab64');oval(c,s*25,37,4,5,'#526c80');}box(c,-4,-3,8,32,2,'#fff2cd');}
    if(id==='builder'){box(c,-25,-48,50,9,3,'#bd8b32');box(c,-20,-59,40,15,8,'#ffd961');box(c,-3,-61,6,17,2,'#f7e494');line(c,[[34,7],[42,22],[36,31]],'#e8c370',6);line(c,[[42,22],[48,17]],'#e8c370',5);box(c,-13,18,26,9,2,'#546777');}
    if(id==='spring')for(const s of[-1,1]){box(c,s*13-6,31,12,13,0,'#142833');const ys=Array.from({length:7},(_,i)=>[s*13+(i%2?6:-6),31+i*2]);line(c,ys,'#daf1bb',2);box(c,s*13-10,46,20,5,2,'#80bc70');}
    if(id==='radar'){line(c,[[0,-40],[0,-59]],'#a5bfce',4);c.save();c.translate(0,-62);c.rotate(-.25);poly(c,[[-23,-8],[23,-8],[14,4],[0,8],[-14,4]],'#d4e8ed');line(c,[[-23,-8],[23,-8]],'#8198ae',3);line(c,[[0,1],[0,-13]],'#8198ae',3);oval(c,0,-15,4,4,'#ffcf68');c.restore();}
    if(id==='repair'){box(c,-16,1,32,21,4,'#629c94');box(c,-3,3,6,17,1,'#d9f2d5');box(c,-9,9,18,6,1,'#d9f2d5');line(c,[[35,17],[42,-1]],'#c6d6d9',5);line(c,[[42,-1],[36,-8]],'#c6d6d9',4);line(c,[[42,-1],[49,-6]],'#c6d6d9',4);}
    if(id==='titan'){for(const s of[-1,1]){box(c,s*32-13,-17,26,23,5,'#696894');box(c,s*32-11,-15,22,5,2,'#c0aae7');box(c,s*35-8,9,16,24,4,'#8b83bb');}hex(c,0,10,14,'#555873');hex(c,0,10,9,'#b3f4f0');hex(c,0,10,4,'#f0ffff');}
    if(id==='tank'){box(c,-40,30,80,20,9,'#344e4b');for(let x=-28;x<=28;x+=14){oval(c,x,40,6,6,'#90aa8e');oval(c,x,40,2,2,'#304b4c');}box(c,12,4,32,11,3,'#5c885e');box(c,39,2,9,15,3,'#d5cb74');oval(c,45,9,3,4,'#3d5662');}
    if(id==='saucer'){oval(c,0,26,48,14,'#6d8b9b');oval(c,0,21,47,12,'#b8d7df');oval(c,0,18,29,7,'#91b5c5');for(const x of[-34,-17,0,17,34])oval(c,x,27-Math.abs(x)*.08,3,2.5,'#ffe17a');}
    if(id==='orbit'){ring(c,0,-28,29,27,'#a3c4d1');oval(c,-12,-40,9,4,'#d9f8fc66',-.5);ring(c,0,13,44,10,'#e7c96f',-.2);box(c,-10,1,20,15,3,'#6083a0');oval(c,0,8,4,4,'#9df3ed');}
    if(id==='guardian'){hex(c,-33,8,19,'#eac870');hex(c,-33,8,14,'#50869b');hex(c,-33,8,8,'#f7d66a');line(c,[[39,-36],[39,32]],'#91b8c9',5);hex(c,39,-39,7,'#d9f7eb');}
    if(id==='salvage'){line(c,[[-28,-30],[-35,-53],[-22,-61]],'#91a6a5',5);line(c,[[-28,-60],[-28,-47],[-18,-47],[-18,-60]],'#c4ceca',5);box(c,-31,-62,6,6,1,'#e97d77');box(c,-21,-62,6,6,1,'#81b5dc');line(c,[[32,7],[44,14],[38,29]],'#b8b9a3',5);for(const x of[-17,0,17])box(c,x-3,22,6,6,1,'#f0c978');}
    if(id==='quantum')for(let i=0;i<3;i++){const a=t*1.3+i*Math.PI*2/3,x=Math.cos(a)*43,y=Math.sin(a)*20-2;hex(c,x,y,7,'#91e6ed');hex(c,x,y,3,'#f0fbff');}
    if(id==='crane'){box(c,-21,0,42,20,3,'#b28b3f');for(let i=0;i<4;i++)poly(c,[[-20+i*11,1],[-14+i*11,1],[-22+i*11,19],[-28+i*11,19]],'#334b53');}
  }
  window.CharacterSkins=Object.freeze({draw(c,o,t){const id=o.costume;if(id==='bee'||id==='queen-bee')bee(c,id,o,t);else if(Object.prototype.hasOwnProperty.call(chassis,id))mech(c,id,o,t);else return false;return true;}});
})();
