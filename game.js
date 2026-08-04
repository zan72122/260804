'use strict';
/* =========================================================
   スルッ！ぷうっ！ピカッ！ひかりのパイプ隊 — リッチ描画版
   シーンは 2D canvas に描き、Post(WebGL) がブルーム等を後がけする。
   ========================================================= */

/* ---------- キャンバス / 品質 ---------- */
const display=document.getElementById('c');
const scene=document.createElement('canvas');
let ctx=null;           // いま描いている 2D コンテキスト
let DPR=1, vw=0, vh=0;

const Quality={
  tier:2, ema:16, cool:2, up:0,
  dprCap(){return [1,1.5,2][this.tier];},
  pMul(){return [0.5,0.75,1][this.tier];},
  bloomDiv(){return [8,6,4][this.tier];},
  frame(dt){
    this.ema=this.ema*0.92+dt*1000*0.08; this.cool-=dt;
    if(this.ema>23&&this.tier>0&&this.cool<=0){this.tier--;this.cool=4;this.up=0;resize();}
    else if(this.ema<13.5&&this.tier<2){this.up+=dt;if(this.up>10&&this.cool<=0){this.tier++;this.cool=4;this.up=0;resize();}}
    else this.up=0;
  }
};
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,Quality.dprCap());
  vw=window.innerWidth; vh=window.innerHeight;
  const pw=Math.round(vw*DPR), ph=Math.round(vh*DPR);
  scene.width=pw; scene.height=ph;
  if(Post.enabled){ Post.resize(pw,ph,Quality.bloomDiv()); ctx=scene.getContext('2d'); }
  else { display.width=pw; display.height=ph; ctx=display.getContext('2d'); }
}

/* ---------- 乱数・ユーティリティ ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
let seed=3, rnd=mulberry32(seed);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,t)=>{t=clamp((t-a)/(b-a),0,1);return t*t*(3-2*t);}
const easeOutBack=t=>{const c=1.70158;t=clamp(t,0,1);return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
const TAU=Math.PI*2;
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function mixCol(c1,c2,t){return 'rgb('+Math.round(lerp(c1[0],c2[0],t))+','+Math.round(lerp(c1[1],c2[1],t))+','+Math.round(lerp(c1[2],c2[2],t))+')';}
function withCtx(c,fn){const o=ctx;ctx=c;fn();ctx=o;}
const FONT='"Hiragino Maru Gothic ProN","BIZ UDGothic","M PLUS Rounded 1c",sans-serif';

/* 立体感ヘルパー（光は左上から） */
function sphere(x,y,r,hi,base,sh){
  const g=ctx.createRadialGradient(x-r*0.35,y-r*0.42,r*0.08,x,y,r);
  g.addColorStop(0,hi);g.addColorStop(0.55,base);g.addColorStop(1,sh);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
}
function softShadow(x,y,rx,ry,a){
  ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);
  const g=ctx.createRadialGradient(0,0,0,0,0,rx);
  g.addColorStop(0,'rgba(20,10,20,'+a+')');g.addColorStop(1,'rgba(20,10,20,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,TAU);ctx.fill();ctx.restore();
}
function glow(x,y,r,col,a){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,col.replace('%a',a));g.addColorStop(1,col.replace('%a',0));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
}
const pGlow=(a)=>'rgba(186,140,255,%a)'.replace('%a',a);

/* ---------- サウンド（合成音・前版のまま） ---------- */
const Snd={
  ctx:null, master:null, muted:false, loops:{},
  init(){
    if(this.ctx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    this.ctx=new AC();
    this.master=this.ctx.createGain(); this.master.gain.value=0.75;
    this.master.connect(this.ctx.destination);
    const len=this.ctx.sampleRate; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    this.noiseBuf=buf;
    this.mkLoop('wheel',{type:'bandpass',freq:340,q:1.2});
    this.mkLoop('pump',{type:'lowpass',freq:500,q:0.7});
    this.mkLoop('water',{type:'lowpass',freq:800,q:0.6});
    const g=this.ctx.createGain(); g.gain.value=0; g.connect(this.master);
    [174,176.5,261.5].forEach(f=>{
      const o=this.ctx.createOscillator(); o.type='triangle'; o.frequency.value=f;
      const og=this.ctx.createGain(); og.gain.value=0.25; o.connect(og); og.connect(g); o.start();
    });
    this.loops.hum={gain:g};
  },
  mkLoop(name,f){
    const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
    const flt=this.ctx.createBiquadFilter(); flt.type=f.type; flt.frequency.value=f.freq; flt.Q.value=f.q;
    const g=this.ctx.createGain(); g.gain.value=0;
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start();
    this.loops[name]={gain:g,filter:flt};
  },
  loop(name,vol,freq){
    if(!this.ctx) return; const L=this.loops[name]; if(!L) return;
    L.gain.gain.setTargetAtTime(this.muted?0:vol,this.ctx.currentTime,0.08);
    if(freq&&L.filter) L.filter.frequency.setTargetAtTime(freq,this.ctx.currentTime,0.08);
  },
  allLoopsOff(){for(const k in this.loops) this.loops[k].gain.gain.setTargetAtTime(0,this.ctx?this.ctx.currentTime:0,0.1);},
  tone(freq,dur,type,vol,glideTo,when){
    if(!this.ctx||this.muted) return;
    const t0=this.ctx.currentTime+(when||0);
    const o=this.ctx.createOscillator(); o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30,glideTo),t0+dur);
    const g=this.ctx.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(vol||0.2,t0+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0+dur+0.05);
  },
  noiseHit(dur,freq,vol,type){
    if(!this.ctx||this.muted) return;
    const t0=this.ctx.currentTime;
    const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf;
    src.playbackRate.value=0.6+Math.random()*0.4;
    const flt=this.ctx.createBiquadFilter(); flt.type=type||'bandpass'; flt.frequency.value=freq; flt.Q.value=1;
    const g=this.ctx.createGain();
    g.gain.setValueAtTime(vol||0.2,t0);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start(t0); src.stop(t0+dur+0.05);
  },
  melody(notes,gap,type,vol){notes.forEach((f,i)=>{if(f)this.tone(f,gap*1.6,type||'sine',vol||0.18,0,i*gap);});},
  drip(){this.tone(950,0.14,'sine',0.14,420); this.tone(1400,0.05,'sine',0.05,900,0.11);},
  rustle(){this.noiseHit(0.18,1600,0.08);},
  kotto(){this.noiseHit(0.08,180,0.2,'lowpass'); this.tone(95,0.1,'sine',0.15,60);},
  click(){this.tone(1100,0.03,'square',0.05,900);},
  pita(){this.tone(430,0.12,'sine',0.16,760); this.noiseHit(0.06,900,0.06);},
  puff(){this.noiseHit(0.16,520,0.12,'lowpass');},
  found(){this.melody([880,1108,1480],0.09,'sine',0.2);},
  great(){this.melody([659,784,988,1319],0.11,'sine',0.2);},
  fanfare(){this.melody([523,659,784,1046,0,784,1046,1319],0.12,'triangle',0.2);},
  sparkle(){this.tone(1800+Math.random()*1200,0.12,'sine',0.05,3000);},
  glint(){this.melody([1568,2093],0.07,'sine',0.12);},
  whoosh(){this.noiseHit(0.35,700,0.1,'lowpass');},
  clunk(){this.noiseHit(0.12,140,0.25,'lowpass'); this.tone(70,0.15,'sine',0.2,50);},
};

/* ---------- ワールド ---------- */
const W=2600, HWORLD=1500, R=80;
const GROUND=430;
const X0=270, X1=2330;
const NS=170;
let samples=[], defects=[], clouds=[], grassTufts=[], butterflies=[];
let pipeLen=X1-X0;
let soilCol, soilCol2, skyTop, skyBot;
let skyCvs=null, soilCvs=null, shellCvs=null, shellBox=null, causticCvs=null, cloudCvses=[];

function genWorld(){
  rnd=mulberry32(seed*7349+1013);
  const midY=820+rnd()*60;
  const A=45+rnd()*40, B=22+rnd()*22;
  const k1=TAU/(950+rnd()*500), k2=TAU/(430+rnd()*260);
  const p1=rnd()*TAU, p2=rnd()*TAU;
  samples=[];
  for(let i=0;i<NS;i++){
    const x=X0+(X1-X0)*i/(NS-1);
    const y=midY+A*Math.sin(k1*x+p1)+B*Math.sin(k2*x+p2);
    samples.push({x,y,tx:1,ty:0,nx:0,ny:1,ang:0});
  }
  for(let i=0;i<NS;i++){
    const a=samples[Math.max(0,i-1)], b=samples[Math.min(NS-1,i+1)];
    let dx=b.x-a.x, dy=b.y-a.y; const L=Math.hypot(dx,dy)||1; dx/=L; dy/=L;
    const s=samples[i]; s.tx=dx; s.ty=dy; s.nx=-dy; s.ny=dx; s.ang=Math.atan2(dy,dx);
    if(s.ny<0){s.nx*=-1;s.ny*=-1;}
  }
  const kinds=['crack','root','gap'];
  for(let i=kinds.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
  const n=2+(rnd()<0.6?1:0);
  const base=[0.26,0.52,0.78];
  defects=[];
  for(let i=0;i<n;i++){
    defects.push({t:clamp(base[i]+(rnd()-0.5)*0.07,0.15,0.9), kind:kinds[i],
      found:false, foundAge:0, cueT:rnd()*2, phase:rnd()*TAU});
  }
  defects.sort((a,b)=>a.t-b.t);
  clouds=[]; for(let i=0;i<5;i++) clouds.push({x:rnd()*W, y:50+rnd()*160, s:0.7+rnd()*0.9, v:6+rnd()*8, k:i%3});
  grassTufts=[];
  for(let i=0;i<46;i++){
    const gx=-150+rnd()*(W+300);
    if((gx>X0-215&&gx<X0+25)||(gx>X1-25&&gx<X1+215)) continue; // ピットの うえは さける
    grassTufts.push({x:gx, h:14+rnd()*16, ph:rnd()*TAU});
  }
  butterflies=[{ph:rnd()*TAU,cx:W*0.3,cy:GROUND-160,col:'#ffb3d1'},{ph:rnd()*TAU+2,cx:W*0.65,cy:GROUND-220,col:'#a8d8ff'}];
  const soils=[[[138,98,66],[96,64,44]],[[130,102,62],[88,68,42]],[[142,92,76],[100,60,50]]];
  const sc=soils[Math.floor(rnd()*soils.length)]; soilCol=sc[0]; soilCol2=sc[1];
  const skies=[[[118,196,248],[206,240,255]],[[255,178,110],[255,228,188]],[[142,164,248],[224,214,255]]];
  const sk=skies[Math.floor(rnd()*skies.length)]; skyTop=sk[0]; skyBot=sk[1];
  prerenderAll();
}
function pathPoint(t){
  t=clamp(t,0,1); const f=t*(NS-1); const i=Math.floor(f); const fr=f-i;
  const a=samples[i], b=samples[Math.min(NS-1,i+1)];
  return {x:lerp(a.x,b.x,fr), y:lerp(a.y,b.y,fr), tx:lerp(a.tx,b.tx,fr), ty:lerp(a.ty,b.ty,fr),
          nx:lerp(a.nx,b.nx,fr), ny:lerp(a.ny,b.ny,fr), ang:lerp(a.ang,b.ang,fr)};
}
function offsetPath(off,step){
  step=step||1;
  ctx.beginPath();
  for(let i=0;i<NS;i+=step){
    const s=samples[i];
    const x=s.x+s.nx*off, y=s.y+s.ny*off;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
}

/* ---------- プリレンダー（質感の焼き込み） ---------- */
function prerenderAll(){
  const wr=mulberry32(seed*991+7);
  /* --- 空: グラデ + 丘 + 家並み --- */
  const SS=0.5;
  skyCvs=document.createElement('canvas');
  skyCvs.width=Math.ceil((W+400)*SS); skyCvs.height=Math.ceil(GROUND*SS);
  withCtx(skyCvs.getContext('2d'),()=>{
    ctx.scale(SS,SS); ctx.translate(200,0);
    const g=ctx.createLinearGradient(0,0,0,GROUND);
    g.addColorStop(0,mixCol(skyTop,skyTop,0)); g.addColorStop(1,mixCol(skyBot,skyBot,0));
    ctx.fillStyle=g; ctx.fillRect(-200,0,W+400,GROUND);
    // とおくの まち と おか（シルエット 2層）
    ctx.fillStyle='rgba(255,255,255,0.30)';
    ctx.beginPath(); ctx.moveTo(-200,GROUND);
    for(let x=-200;x<=W+200;x+=90) ctx.lineTo(x,GROUND-46-Math.sin(x*0.004+1)*26-wr()*8);
    ctx.lineTo(W+200,GROUND); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(120,160,140,0.34)';
    ctx.beginPath(); ctx.moveTo(-200,GROUND);
    for(let x=-200;x<=W+200;x+=60) ctx.lineTo(x,GROUND-18-Math.sin(x*0.006)*14);
    ctx.lineTo(W+200,GROUND); ctx.closePath(); ctx.fill();
    // ちいさな いえ と き
    for(let i=0;i<12;i++){
      const hx=-100+wr()*(W+200), hw=26+wr()*18, hh=20+wr()*14, hy=GROUND-8;
      if(wr()<0.55){
        ctx.fillStyle='rgba(90,110,130,0.45)';
        ctx.fillRect(hx,hy-hh,hw,hh);
        ctx.beginPath(); ctx.moveTo(hx-4,hy-hh); ctx.lineTo(hx+hw/2,hy-hh-14); ctx.lineTo(hx+hw+4,hy-hh); ctx.closePath();
        ctx.fillStyle='rgba(150,90,90,0.5)'; ctx.fill();
      } else {
        ctx.fillStyle='rgba(70,120,90,0.5)';
        ctx.beginPath(); ctx.arc(hx,hy-26,16+wr()*8,0,TAU); ctx.fill();
        ctx.fillStyle='rgba(100,70,50,0.5)'; ctx.fillRect(hx-3,hy-16,6,16);
      }
    }
  });
  /* --- 土: 断面テクスチャ --- */
  soilCvs=document.createElement('canvas');
  const SH=HWORLD-GROUND+300;
  soilCvs.width=Math.ceil((W+400)*SS); soilCvs.height=Math.ceil(SH*SS);
  withCtx(soilCvs.getContext('2d'),()=>{
    ctx.scale(SS,SS); ctx.translate(200,0);
    const g=ctx.createLinearGradient(0,0,0,SH);
    g.addColorStop(0,mixCol(soilCol,soilCol,0));
    g.addColorStop(0.5,mixCol(soilCol,soilCol2,0.6));
    g.addColorStop(1,mixCol(soilCol2,[40,26,22],0.5));
    ctx.fillStyle=g; ctx.fillRect(-200,0,W+400,SH);
    // ちそう（うっすら よこしま）
    for(let b=0;b<5;b++){
      const yy=90+b*190+wr()*60;
      ctx.fillStyle='rgba(0,0,0,'+(0.05+wr()*0.05)+')';
      ctx.beginPath(); ctx.moveTo(-200,yy);
      for(let x=-200;x<=W+200;x+=120) ctx.lineTo(x,yy+Math.sin(x*0.008+b*2)*14);
      for(let x=W+200;x>=-200;x-=120) ctx.lineTo(x,yy+42+Math.sin(x*0.008+b*2+1)*12);
      ctx.closePath(); ctx.fill();
    }
    // まだら
    for(let i=0;i<380;i++){
      const x=-180+wr()*(W+360), y=wr()*SH, r=6+wr()*26;
      ctx.fillStyle=wr()<0.5?'rgba(0,0,0,'+(0.03+wr()*0.06)+')':'rgba(255,230,200,'+(0.02+wr()*0.05)+')';
      ctx.beginPath(); ctx.ellipse(x,y,r,r*(0.5+wr()*0.4),wr()*3,0,TAU); ctx.fill();
    }
    // こいし（立体）
    for(let i=0;i<80;i++){
      const x=-160+wr()*(W+320), y=60+wr()*(SH-120), r=5+wr()*14;
      const gg=ctx.createRadialGradient(x-r*0.35,y-r*0.4,r*0.1,x,y,r);
      const tone=90+wr()*60;
      gg.addColorStop(0,'rgba('+(tone+55)+','+(tone+42)+','+(tone+28)+',0.8)');
      gg.addColorStop(1,'rgba('+(tone-35)+','+(tone-40)+','+(tone-42)+',0.85)');
      ctx.fillStyle=gg;
      ctx.beginPath(); ctx.ellipse(x,y,r,r*0.76,wr()*3,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(x+2,y+r*0.7,r*0.9,r*0.3,0,0,TAU); ctx.fill();
    }
    // ほそい ね
    ctx.strokeStyle='rgba(70,45,30,0.35)'; ctx.lineWidth=3; ctx.lineCap='round';
    for(let i=0;i<26;i++){
      let x=-100+wr()*(W+200), y=wr()*80;
      ctx.beginPath(); ctx.moveTo(x,y);
      for(let s2=0;s2<5;s2++){x+=(wr()-0.5)*50; y+=26+wr()*30; ctx.lineTo(x,y);}
      ctx.stroke();
    }
    // ちひょうの AO
    const ag=ctx.createLinearGradient(0,0,0,60);
    ag.addColorStop(0,'rgba(40,20,10,0.35)'); ag.addColorStop(1,'rgba(40,20,10,0)');
    ctx.fillStyle=ag; ctx.fillRect(-200,0,W+400,60);
  });
  /* --- 管シェル: 壁 + 円筒陰影 + 継手 + よごれ --- */
  let minY=1e9,maxY=-1e9;
  for(const s of samples){minY=Math.min(minY,s.y);maxY=Math.max(maxY,s.y);}
  shellBox={x:X0-60,y:minY-R-90,w:(X1-X0)+120,h:(maxY-minY)+2*(R+90)};
  shellCvs=document.createElement('canvas');
  shellCvs.width=Math.ceil(shellBox.w); shellCvs.height=Math.ceil(shellBox.h);
  withCtx(shellCvs.getContext('2d'),()=>{
    ctx.translate(-shellBox.x,-shellBox.y);
    ctx.lineCap='round'; ctx.lineJoin='round';
    // 土への おとしかげ（ハロー）
    for(const [wd,al] of [[(R+52)*2,0.10],[(R+38)*2,0.10],[(R+28)*2,0.12]]){
      ctx.strokeStyle='rgba(25,12,8,'+al+')'; ctx.lineWidth=wd; offsetPath(0,2); ctx.stroke();
    }
    // そとかべ ベース（コンクリート）
    ctx.strokeStyle='#4e463e'; ctx.lineWidth=(R+20)*2; offsetPath(0,1); ctx.stroke();
    // かべ 上面ハイライト / 下面シャドウ（法線オフセット経路）
    ctx.strokeStyle='rgba(168,152,128,0.85)'; ctx.lineWidth=13; offsetPath(-(R+12),1); ctx.stroke();
    ctx.strokeStyle='rgba(215,200,175,0.4)'; ctx.lineWidth=4; offsetPath(-(R+18),1); ctx.stroke();
    ctx.strokeStyle='rgba(20,12,8,0.55)'; ctx.lineWidth=13; offsetPath(R+13,1); ctx.stroke();
    // つぎての フランジ（くうどうで パンチされる ように さきに かく）
    for(let i=12;i<NS-6;i+=16){
      const s=samples[i];
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.ang);
      const fg=ctx.createLinearGradient(-8,0,8,0);
      fg.addColorStop(0,'#6e675e'); fg.addColorStop(0.5,'#847c70'); fg.addColorStop(1,'#4a443c');
      ctx.fillStyle=fg;
      rr(-8,-R-26,16,(R+26)*2,7); ctx.fill();
      for(const by of [-R-15,R+15]) sphere(0,by,4.2,'#c8beac','#847a66','#4a4234');
      ctx.restore();
    }
    // くうどう
    ctx.strokeStyle='#221c2b'; ctx.lineWidth=R*2; offsetPath(0,1); ctx.stroke();
    // くうどう内の 円筒陰影
    ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=26; offsetPath(-(R-14),1); ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=30; offsetPath(-(R-36),1); ctx.stroke();
    ctx.strokeStyle='rgba(146,136,178,0.13)'; ctx.lineWidth=22; offsetPath(R-18,1); ctx.stroke();
    ctx.strokeStyle='rgba(180,170,214,0.10)'; ctx.lineWidth=6; offsetPath(R-6,1); ctx.stroke();
    // 内側の 継ぎ目リング（おくゆき）
    for(let i=12;i<NS-6;i+=16){
      const s=samples[i];
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.ang);
      ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.ellipse(0,0,R*0.2,R*0.94,0,0,TAU); ctx.stroke();
      ctx.strokeStyle='rgba(150,140,180,0.14)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.ellipse(4,0,R*0.2,R*0.94,0,0,TAU); ctx.stroke();
      ctx.restore();
    }
    // よごれ・さび・こけ
    for(let i=0;i<40;i++){
      const t=0.03+wr()*0.94, p=pathPoint(t);
      const off=(wr()*2-1)*0.6;
      ctx.fillStyle=wr()<0.6?'rgba(70,52,34,'+(0.12+wr()*0.16)+')':'rgba(110,80,45,'+(0.10+wr()*0.12)+')';
      ctx.beginPath(); ctx.ellipse(p.x+p.nx*R*off,p.y+p.ny*R*off,8+wr()*20,5+wr()*10,p.ang,0,TAU); ctx.fill();
    }
    for(const d of defects){
      const p=pathPoint(d.t);
      for(let i=0;i<7;i++){
        ctx.fillStyle='rgba('+(70+wr()*40)+','+(120+wr()*40)+','+(60+wr()*30)+',0.5)';
        const ox=(wr()-0.5)*70, oy=-R+6+wr()*24;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.ang);
        ctx.beginPath(); ctx.arc(ox,oy,3+wr()*6,0,TAU); ctx.fill(); ctx.restore();
      }
    }
  });
  /* --- コースティクス タイル --- */
  causticCvs=document.createElement('canvas');
  causticCvs.width=causticCvs.height=160;
  withCtx(causticCvs.getContext('2d'),()=>{
    ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineCap='round';
    for(let i=0;i<16;i++){
      ctx.lineWidth=2+wr()*3;
      const x=wr()*160,y=wr()*160,r=14+wr()*26;
      ctx.beginPath(); ctx.arc(x,y,r,wr()*TAU,wr()*TAU+2+wr()*2.5); ctx.stroke();
      ctx.beginPath(); ctx.arc((x+80)%160,(y+80)%160,r,wr()*TAU,wr()*TAU+2+wr()*2); ctx.stroke();
    }
  });
  /* --- くも（立体パフ） --- */
  cloudCvses=[];
  for(let k=0;k<3;k++){
    const c=document.createElement('canvas'); c.width=300; c.height=150;
    withCtx(c.getContext('2d'),()=>{
      const puffs=[]; const pn=6+Math.floor(wr()*4);
      for(let i=0;i<pn;i++) puffs.push({x:50+wr()*200,y:60+wr()*40,r:26+wr()*26});
      for(const p of puffs){
        const g=ctx.createRadialGradient(p.x-p.r*0.3,p.y-p.r*0.45,p.r*0.1,p.x,p.y,p.r);
        g.addColorStop(0,'rgba(255,255,255,0.98)');
        g.addColorStop(0.7,'rgba(248,246,255,0.92)');
        g.addColorStop(1,'rgba(214,210,236,0.0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
      }
      ctx.fillStyle='rgba(190,186,220,0.30)';
      for(const p of puffs){ctx.beginPath();ctx.ellipse(p.x,p.y+p.r*0.55,p.r*0.8,p.r*0.26,0,0,TAU);ctx.fill();}
    });
    cloudCvses.push(c);
  }
}

/* ---------- 状態 ---------- */
let phase='title', phaseTime=0, pending=null, pendTimer=0, now=0;
let cam={x:W/2,y:760,s:0.3}, shake=0;
const robot={t:0.02,speed:0,aim:0};
let foundCount=0, waitingDefect=null, waitTimer=0;
let linerT=0, ropeTug=0, crankAng=0, crankTick=0;
let inflFront=0, inflStart=new Array(NS).fill(0), pitaMark=0, plunger=0, glossSweep=-1;
let cure=new Array(NS).fill(0), trainT=-0.06, trainSpeed=0, trainMax=-0.06, coverT=0, cureStep=0, stamps=[], stampNext=0.05, cureIdle=0;
let waterT=0, flowing=false, boatT=0, glintMark=new Set();
let particles=[], confetti=[];
let idleTime=0, banner=null, bannerAge=9;
let pulse=0;
/* キャラクター アニメ状態 */
const anim={
  blink:0, nextBlink:2.4, look:0, lookY:0, antA:0, antV:0, celeb:0,
  tilt:0, prevSpeed:0, wheelRot:0, bob:0,
  trBlink:0, trNext:3.2, mouth:0,
};

function setBanner(big,small){banner={big,small}; bannerAge=0;}
function phaseSwitch(next,delay){pending=next; pendTimer=delay;}
function resetRun(){
  genWorld();
  robot.t=0.02; robot.speed=0; robot.aim=0;
  foundCount=0; waitingDefect=null; waitTimer=0;
  linerT=0; ropeTug=0; crankAng=0;
  inflFront=0; inflStart=new Array(NS).fill(0); pitaMark=0; plunger=0; glossSweep=-1;
  cure=new Array(NS).fill(0); trainT=-0.06; trainMax=-0.06; trainSpeed=0; coverT=0; cureStep=0; stamps=[]; stampNext=0.05;
  waterT=0; flowing=false; boatT=0; glintMark=new Set();
  particles=[]; confetti=[]; pending=null;
  anim.celeb=0; anim.antA=0; anim.antV=0;
}

/* ---------- 入力 ---------- */
const pointer={down:false,x:0,y:0,px:0,py:0,vx:0,onButton:null,downX:0,downY:0,moved:0};
let activeId=null;
function toXY(e){const r=display.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
display.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(activeId!==null) return; activeId=e.pointerId;
  try{display.setPointerCapture(e.pointerId);}catch(_){}
  Snd.init(); if(Snd.ctx&&Snd.ctx.state==='suspended') Snd.ctx.resume();
  const p=toXY(e);
  pointer.down=true; pointer.x=pointer.px=pointer.downX=p.x; pointer.y=pointer.py=pointer.downY=p.y;
  pointer.vx=0; pointer.moved=0; idleTime=0;
  pointer.onButton=hitButton(p.x,p.y);
  if(pointer.onButton) onButtonDown(pointer.onButton);
  else onTap(p.x,p.y);
},{passive:false});
display.addEventListener('pointermove',e=>{
  if(e.pointerId!==activeId) return;
  const p=toXY(e);
  const dx=p.x-pointer.x;
  pointer.moved+=Math.abs(dx)+Math.abs(p.y-pointer.y);
  pointer.px=pointer.x; pointer.py=pointer.y; pointer.x=p.x; pointer.y=p.y;
  pointer.vx=pointer.vx*0.6+dx*0.4*60;
  idleTime=0;
},{passive:false});
function endPointer(e){
  if(e.pointerId!==activeId) return; activeId=null;
  pointer.down=false; pointer.vx=0; pointer.onButton=null;
}
display.addEventListener('pointerup',endPointer);
display.addEventListener('pointercancel',endPointer);
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());

function screenToWorld(sx,sy){return{x:(sx-vw/2)/cam.s+cam.x, y:(sy-vh/2)/cam.s+cam.y};}
function worldToScreen(wx,wy){return{x:(wx-cam.x)*cam.s+vw/2, y:(wy-cam.y)*cam.s+vh/2};}

/* ---------- ボタン ---------- */
function buttons(){
  const r=Math.min(vw,vh)*0.11, m=r*1.9;
  const list=[];
  if(phase!=='title') list.push({id:'mute',x:vw-44,y:46,r:30,small:true});
  if(phase==='title') list.push({id:'play',x:vw/2,y:vh*0.72,r:Math.min(vw,vh)*0.14,label:'あそぶ'});
  if(phase==='liner') list.push({id:'winch',x:vw-m,y:vh-m,r,label:'ぐるぐる',hold:true});
  if(phase==='inflate') list.push({id:'pump',x:vw-m,y:vh-m,r,label:'ぷうっ',hold:true});
  if(phase==='cure'&&cureStep===1) list.push({id:'train',x:vw-m,y:vh-m,r,label:'すすめ',hold:true});
  if(phase==='flow'&&!flowing) list.push({id:'water',x:vw-m,y:vh-m,r,label:'みずを ながす'});
  if(phase==='done'&&phaseTime>1.2) list.push({id:'replay',x:vw/2,y:vh*0.78,r:Math.min(vw,vh)*0.12,label:'もういちど'});
  return list;
}
function hitButton(x,y){
  for(const b of buttons()){
    const hr=b.r*(b.small?1.2:1.5);
    if((x-b.x)*(x-b.x)+(y-b.y)*(y-b.y)<hr*hr) return b;
  }
  return null;
}
function onButtonDown(b){
  if(b.id==='mute'){Snd.muted=!Snd.muted; if(Snd.muted)Snd.allLoopsOff(); else Snd.click(); return;}
  if(b.id==='play'){Snd.great(); startGame(); return;}
  if(b.id==='water'){flowing=true; Snd.whoosh(); Snd.loop('water',0.12,900); setBanner('スーッ','きれいな みずが ながれるよ'); return;}
  if(b.id==='replay'){seed++; Snd.allLoopsOff(); resetRun(); phase='drive'; phaseTime=0; Snd.whoosh(); setBanner('スルッ！','カメラロボで しらべよう'); return;}
  Snd.click();
}
function startGame(){
  resetRun(); phase='drive'; phaseTime=0;
  setBanner('スルッ！','カメラロボで しらべよう');
}

/* ---------- タップ ---------- */
function onTap(sx,sy){
  if(phase!=='drive') return;
  const wpt=screenToWorld(sx,sy);
  for(const d of defects){
    if(d.found) continue;
    if(Math.abs(d.t-robot.t)>0.2) continue;
    const p=pathPoint(d.t);
    const dx=wpt.x-p.x, dy=wpt.y-p.y;
    if(dx*dx+dy*dy<140*140){
      d.found=true; d.foundAge=0; foundCount++;
      Snd.found(); pulse=1; anim.celeb=1.2;
      burst(p.x,p.y,'#ffd76a',Math.round(22*Quality.pMul()));
      if(foundCount>=defects.length){ setBanner('ぜんぶ みつけた！','すごい！ さいごまで すすもう'); Snd.great(); }
      else setBanner('みつけた！','まだ あるかな？');
      waitingDefect=null; waitTimer=0;
      return;
    }
  }
}

/* ---------- パーティクル ---------- */
function burst(x,y,col,n){
  for(let i=0;i<n;i++){
    const a=Math.random()*TAU, sp=60+Math.random()*220;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:0.7+Math.random()*0.5,age:0,col,r:4+Math.random()*7,kind:Math.random()<0.45?'star':'dot'});
  }
}
function dripFrom(d){
  const p=pathPoint(d.t);
  particles.push({x:p.x+p.nx*-R*0.9,y:p.y+p.ny*-R*0.9,vx:(Math.random()-0.5)*20,vy:30,life:0.8,age:0,col:'#9fd8ff',r:5,kind:'drop',g:600,
    floorY:p.y+p.ny*(R-8)});
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.age+=dt;
    if(p.age>p.life){particles.splice(i,1);continue;}
    p.vy+=(p.g!==undefined?p.g:300)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.kind==='drop'&&p.floorY&&p.y>=p.floorY){ // ぽちゃん
      particles.splice(i,1);
      for(let k=0;k<4;k++) particles.push({x:p.x,y:p.floorY,vx:(Math.random()-0.5)*90,vy:-60-Math.random()*70,life:0.4,age:0,col:'#bfe4ff',r:2.5,kind:'dot',g:500});
      particles.push({x:p.x,y:p.floorY,vx:0,vy:0,life:0.5,age:0,col:'#bfe4ff',r:4,kind:'ring',g:0});
    }
    if(p.kind==='bubble'&&p.surfY&&p.y<=p.surfY){particles.splice(i,1);continue;}
  }
  for(let i=confetti.length-1;i>=0;i--){
    const p=confetti[i]; p.age+=dt;
    if(p.age>p.life){confetti.splice(i,1);continue;}
    p.vy+=180*dt; p.vx*=Math.pow(0.6,dt);
    p.x+=p.vx*dt+Math.sin(p.age*5+p.rot)*30*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
  }
}

/* ---------- 更新 ---------- */
function nextUnfound(){for(const d of defects) if(!d.found) return d; return null;}

function update(dt){
  now+=dt; phaseTime+=dt; idleTime+=dt; bannerAge+=dt;
  pointer.vx*=Math.pow(0.02,dt);
  pulse=Math.max(0,pulse-dt*1.6);
  shake=Math.max(0,shake-dt*3);
  if(pending){pendTimer-=dt; if(pendTimer<=0){phase=pending; pending=null; phaseTime=0; onPhaseStart(phase);}}
  updateParticles(dt);
  updateAnim(dt);
  for(const c of clouds){c.x+=c.v*dt; if(c.x>W+260)c.x=-260;}
  for(const d of defects) if(d.found) d.foundAge+=dt;

  switch(phase){
    case 'title': break;
    case 'drive': updateDrive(dt); break;
    case 'liner': updateLiner(dt); break;
    case 'inflate': updateInflate(dt); break;
    case 'cure': updateCure(dt); break;
    case 'flow': case 'done': updateFlow(dt); break;
  }
  updateCamera(dt);
}
function updateAnim(dt){
  // まばたき
  anim.blink=Math.max(0,anim.blink-dt);
  anim.nextBlink-=dt;
  if(anim.nextBlink<=0){anim.blink=0.13; anim.nextBlink=1.8+Math.random()*3;}
  anim.trBlink=Math.max(0,anim.trBlink-dt);
  anim.trNext-=dt;
  if(anim.trNext<=0){anim.trBlink=0.12; anim.trNext=2+Math.random()*3;}
  // しっぽアンテナ（バネ）
  const drive=(robot.speed-anim.prevSpeed)*-260+(pointer.down?0:0);
  anim.prevSpeed=robot.speed;
  anim.antV+=(-90*anim.antA-7*anim.antV+drive)*dt;
  anim.antA+=anim.antV*dt; anim.antA=clamp(anim.antA,-0.9,0.9);
  // かたむき / バウンド
  anim.tilt+=((robot.speed*0.7)-anim.tilt)*Math.min(1,dt*5);
  anim.bob+=dt*(4+robot.speed*30);
  anim.wheelRot+=robot.speed*pipeLen*dt/13;
  anim.celeb=Math.max(0,anim.celeb-dt);
}
function onPhaseStart(p){
  Snd.allLoopsOff();
  if(p==='liner'){setBanner('するする','おおきな タイヤを おしてね'); Snd.whoosh();}
  if(p==='inflate'){setBanner('ぷうっ・ぴたっ','ポンプを おしつづけてね'); Snd.whoosh();}
  if(p==='cure'){setBanner('あんぜんカバー','ふたを しめるよ'); cureStep=0;}
  if(p==='flow'){setBanner('できたかな？','みずの ボタンを おしてね');}
  if(p==='done'){
    setBanner('やったね！','パイプが ぴかぴかに なったよ');
    Snd.fanfare();
    const n=Math.round(110*Quality.pMul());
    for(let i=0;i<n;i++){
      confetti.push({x:vw*Math.random(),y:-20-Math.random()*vh*0.3,vx:(Math.random()-0.5)*140,vy:50+Math.random()*130,
        rot:Math.random()*TAU,vr:(Math.random()-0.5)*9,life:3+Math.random()*2.5,age:0,
        col:['#ff8fb3','#ffd76a','#8fe3ff','#b7f7c2','#d9b8ff'][i%5],w:8+Math.random()*9,
        kind:i%7===0?'star':(i%5===0?'ribbon':'rect')});
    }
  }
}

/* --- 1. スルッ --- */
function updateDrive(dt){
  const nd=nextUnfound();
  if(pointer.down && !pointer.onButton){
    const targetT=clamp(pointer.vx/cam.s/pipeLen,-0.05,0.4);
    robot.speed+=(Math.max(0,targetT)-robot.speed)*Math.min(1,dt*8);
  } else robot.speed*=Math.pow(0.12,dt);
  if(foundCount>=defects.length && robot.t>0.96) robot.speed=Math.max(robot.speed,0.12);
  robot.t+=robot.speed*dt;
  const limit=nd?nd.t-0.05:1.07;
  if(robot.t>=limit){
    robot.t=limit;
    if(nd){ robot.speed=0;
      if(waitingDefect!==nd){waitingDefect=nd; waitTimer=0;}
      waitTimer+=dt;
    }
  }
  if(nd&&robot.t<nd.t-0.06){waitingDefect=null;waitTimer=0;}
  for(const d of defects){
    if(d.found) continue;
    const near=Math.abs(d.t-robot.t)<0.12;
    d.cueT-=dt;
    if(near&&d.cueT<=0){
      d.cueT=1.1+Math.random()*0.9;
      if(d.kind==='crack'){dripFrom(d);Snd.drip();}
      if(d.kind==='root'){Snd.rustle();}
      if(d.kind==='gap'){Snd.kotto(); shake=Math.min(1,shake+0.6);
        const p=pathPoint(d.t);
        for(let k=0;k<3;k++) particles.push({x:p.x+(Math.random()-0.5)*40,y:p.y+p.ny*(R-14),vx:(Math.random()-0.5)*40,vy:-30,life:0.6,age:0,col:'#8a7a66',r:3,kind:'dot',g:400});
      }
      const p=pathPoint(d.t);
      particles.push({x:p.x+(Math.random()-0.5)*40,y:p.y+(Math.random()-0.5)*40,vx:0,vy:-10,life:0.55,age:0,col:'#fff6c8',r:5,kind:'star',g:0});
    }
  }
  // ほこり（ヘッドライトの ビームに ただよう）
  if(robot.speed>0.02&&Math.random()<dt*22*Quality.pMul()){
    const p=robotPos();
    particles.push({x:p.x+Math.cos(p.ang)*(60+Math.random()*180),y:p.y+Math.sin(p.ang)*(60)+((Math.random()-0.5)*R*1.2),
      vx:(Math.random()-0.5)*14,vy:(Math.random()-0.5)*10,life:1.2,age:0,col:'#ffeebb',r:1.6+Math.random()*1.8,kind:'mote',g:0});
  }
  const hint=waitingDefect&&waitTimer>4;
  if(hint){
    const p=pathPoint(waitingDefect.t), rp=robotPos();
    const want=Math.atan2(p.y-rp.y,p.x-rp.x)-pathPoint(robot.t).ang;
    robot.aim+=(want-robot.aim)*Math.min(1,dt*3);
  } else robot.aim+=(0-robot.aim)*Math.min(1,dt*3);
  Snd.loop('wheel',clamp(robot.speed*2.2,0,0.16),260+robot.speed*2200);
  if(robot.t>=1.06&&!pending){Snd.loop('wheel',0); Snd.great(); phaseSwitch('liner',0.9);}
}
function robotPos(){const p=pathPoint(clamp(robot.t,0,1)); const off=robot.t>1?0:R-30;
  const ex=robot.t>1?(robot.t-1)*pipeLen:0;
  return {x:p.x+p.tx*ex,y:p.y+p.ny*off-(robot.t>1?(robot.t-1)*400:0),ang:p.ang};}

/* --- 3. するする --- */
function updateLiner(dt){
  const held=pointer.onButton&&pointer.onButton.id==='winch'&&pointer.down;
  if(held){
    linerT=Math.min(1,linerT+dt*0.2);
    crankAng+=dt*7; crankTick+=dt;
    if(crankTick>0.22){crankTick=0;Snd.click();}
    ropeTug=Math.min(1,ropeTug+dt*4);
  } else ropeTug=Math.max(0,ropeTug-dt*3);
  Snd.loop('wheel',held?0.08:0,180);
  if(linerT>=1&&!pending){Snd.great(); setBanner('とうちゃく！','つぎは くうきだ'); phaseSwitch('inflate',0.9);}
}

/* --- 4. ぷうっ・ぴたっ --- */
function updateInflate(dt){
  const held=pointer.onButton&&pointer.onButton.id==='pump'&&pointer.down;
  if(held){
    inflFront=Math.min(1,inflFront+dt*0.17);
    plunger=Math.min(1,plunger+dt*6);
    Snd.loop('pump',0.12,420);
  } else {plunger=Math.max(0,plunger-dt*4); Snd.loop('pump',0,300);}
  const fi=Math.floor(inflFront*(NS-1));
  for(let i=0;i<=fi;i++) if(!inflStart[i]) inflStart[i]=now;
  if(inflFront>pitaMark+0.1){pitaMark+=0.1; Snd.pita(); Snd.puff();
    const p=pathPoint(inflFront); burst(p.x,p.y,'#ffe9f0',Math.round(7*Quality.pMul()));}
  if(inflFront>=1){
    if(glossSweep<0){glossSweep=0; Snd.pita();}
    glossSweep+=dt*1.4;
    if(glossSweep>1.2&&!pending){Snd.great(); phaseSwitch('cure',0.8);}
  }
}
function inflR(i){
  if(!inflStart[i]) return 0;
  const e=Math.min(1,(now-inflStart[i])/0.55);
  return Math.min(R-3,lerp(14,R-7,easeOutBack(e)));
}

/* --- 5. ピカッ・じわっ --- */
function updateCure(dt){
  if(cureStep===0){
    const prev=coverT;
    coverT=Math.min(1,coverT+dt*0.9);
    if(prev<0.98&&coverT>=0.98){Snd.clunk(); setBanner('ピカッ・じわっ','ひかりの れっしゃで かためよう'); cureStep=1; cureIdle=0;}
    return;
  }
  if(cureStep===1){
    const held=pointer.onButton&&pointer.onButton.id==='train'&&pointer.down;
    if(held){trainSpeed+=(0.15-trainSpeed)*Math.min(1,dt*5); cureIdle=0;}
    else {trainSpeed*=Math.pow(0.2,dt); cureIdle+=dt;}
    if(cureIdle>4) trainSpeed=Math.max(trainSpeed,0.045);
    trainT+=trainSpeed*dt; trainMax=Math.max(trainMax,trainT);
    Snd.loop('hum',trainT>-0.02&&trainT<1.03?0.06:0);
    if(trainSpeed>0.02&&Math.random()<dt*26*Quality.pMul()){
      const p=pathPoint(clamp(trainT-0.02,0,1));
      particles.push({x:p.x+(Math.random()-0.5)*R,y:p.y+(Math.random()-0.5)*R,
        vx:-trainSpeed*800,vy:(Math.random()-0.5)*40,life:0.4+trainSpeed*2,age:0,
        col:Math.random()<0.5?'#c9a6ff':'#9fe8ff',r:3+Math.random()*4,kind:'star',g:0});
      if(Math.random()<0.25)Snd.sparkle();
    }
    for(let i=0;i<NS;i++){
      const s=i/(NS-1);
      if(s<trainMax-0.015&&cure[i]<1) cure[i]=Math.min(1,cure[i]+dt*1.7);
    }
    if(trainT>stampNext&&trainT<1){
      stampNext+=0.09;
      const p=pathPoint(trainT-0.03);
      stamps.push({x:p.x+p.nx*(Math.random()-0.5)*R*0.8,y:p.y+p.ny*(Math.random()-0.5)*R*0.8,
        kind:trainSpeed>0.1?'star':'flower',size:8+trainSpeed*70,a:0,rot:Math.random()*TAU});
    }
    for(const st of stamps) st.a=Math.min(1,st.a+dt*2);
    if(trainT>=1.06){cureStep=2; Snd.loop('hum',0);}
    return;
  }
  if(cureStep===2){
    for(let i=0;i<NS;i++) cure[i]=Math.min(1,cure[i]+dt*2.5);
    const prev=coverT;
    coverT=Math.max(0,coverT-dt*0.9);
    if(prev>0.02&&coverT<=0.02){Snd.clunk(); Snd.great(); phaseSwitch('flow',0.7);}
  }
}

/* --- 6. スーッ --- */
function updateFlow(dt){
  if(flowing&&waterT<1){
    waterT=Math.min(1,waterT+dt*0.16);
    boatT=Math.max(0,waterT-0.06);
    Snd.loop('water',0.12,700+waterT*400);
    for(const d of defects){
      if(waterT>d.t&&!glintMark.has(d)){
        glintMark.add(d); Snd.glint();
        const p=pathPoint(d.t); burst(p.x,p.y,'#bff0ff',Math.round(14*Quality.pMul()));
      }
    }
    if(waterT>=1&&phase==='flow'&&!pending) phaseSwitch('done',0.4);
  } else if(phase==='done'){
    boatT=Math.min(1.06,boatT+dt*0.1);
    Snd.loop('water',0.08,800);
  }
  // あわ
  if(waterT>0.05&&Math.random()<dt*10*Quality.pMul()){
    const t=Math.random()*Math.min(waterT,1);
    const p=pathPoint(t);
    particles.push({x:p.x+p.nx*R*0.5,y:p.y+p.ny*R*0.5,vx:(Math.random()-0.5)*10,vy:-26,life:2,age:0,
      col:'#e8f8ff',r:1.6+Math.random()*2.6,kind:'bubble',g:-30,surfY:p.y+p.ny*R*0.14});
  }
}

/* ---------- カメラ ---------- */
function updateCamera(dt){
  const fitS=Math.min(vw/(W*1.02), vh/(HWORLD*0.86));
  let tx,ty,ts;
  if(phase==='title'||phase==='liner'||phase==='inflate'||phase==='flow'||phase==='done'){
    tx=W/2; ty=GROUND+(HWORLD-GROUND)*0.42; ts=fitS;
  } else if(phase==='drive'){
    const p=robotPos(); ts=Math.max(fitS,vh/620)*(1+pulse*0.1);
    tx=p.x+140; ty=p.y-30;
  } else {
    if(cureStep===1){const p=pathPoint(clamp(trainT,0,1)); ts=Math.max(fitS,vh/780); tx=p.x+100; ty=p.y;}
    else {tx=W/2; ty=GROUND+(HWORLD-GROUND)*0.42; ts=fitS;}
  }
  tx=clamp(tx,vw/2/cam.s,W-vw/2/cam.s);
  const k=Math.min(1,dt*3.2);
  cam.x+=(tx-cam.x)*k; cam.y+=(ty-cam.y)*k; cam.s+=(ts-cam.s)*k;
}

/* ---------- 描画 ---------- */
function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,vw,vh);
  ctx.save();
  const shx=shake>0?(Math.random()-0.5)*shake*10:0, shy=shake>0?(Math.random()-0.5)*shake*8:0;
  ctx.translate(vw/2+shx,vh/2+shy); ctx.scale(cam.s,cam.s); ctx.translate(-cam.x,-cam.y);

  drawBackground();
  drawPits();
  ctx.drawImage(shellCvs,shellBox.x,shellBox.y,shellBox.w,shellBox.h);
  drawDefects();
  drawLiner();
  drawStamps();
  drawWater();
  drawCoversAndTrain();
  drawRobot();
  drawCuredTwinkles();
  drawWorldParticles();

  ctx.restore();
  drawUI();
}

function drawBackground(){
  // そら（プリレンダー）+ たいよう + くも
  ctx.drawImage(skyCvs,-200,0,W+400,GROUND);
  const sunX=W*0.82, sunY=110;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  glow(sunX,sunY,190,'rgba(255,236,150,%a)',0.5);
  ctx.save(); ctx.translate(sunX,sunY); ctx.rotate(now*0.05);
  ctx.fillStyle='rgba(255,240,170,0.035)';
  for(let i=0;i<8;i++){
    ctx.rotate(TAU/8);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-26,-195); ctx.lineTo(26,-195); ctx.closePath(); ctx.fill();
  }
  ctx.restore(); ctx.restore();
  sphere(sunX,sunY,54,'#fffbe8','#ffe58a','#ffc94d');
  if(phase==='done'){ // ごほうびの にじ
    ctx.save(); ctx.globalAlpha=Math.min(0.5,phaseTime*0.25);
    const cols=['#ff9d9d','#ffd39d','#fff2a8','#b8eab2','#a8cff0','#c8b2ea'];
    for(let i=0;i<6;i++){
      ctx.strokeStyle=cols[i]; ctx.lineWidth=13;
      ctx.beginPath(); ctx.arc(W*0.4,GROUND+180,470-i*13,Math.PI*1.05,Math.PI*1.85); ctx.stroke();
    }
    ctx.restore();
  }
  for(const c of clouds) ctx.drawImage(cloudCvses[c.k],c.x-150*c.s,c.y-75*c.s,300*c.s,150*c.s);
  // ちょうちょ
  for(const bf of butterflies){
    const t=now*0.7+bf.ph;
    const x=bf.cx+Math.sin(t*0.7)*140+Math.sin(t*1.7)*40;
    const y=bf.cy+Math.sin(t*1.1)*46;
    const flap=Math.sin(now*14+bf.ph)*0.9;
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(t)*0.3);
    ctx.fillStyle=bf.col;
    ctx.save(); ctx.scale(Math.max(0.2,Math.cos(flap)),1);
    ctx.beginPath(); ctx.ellipse(-7,-3,8,11,-0.5,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6,6,6,8,0.4,0,TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.scale(-Math.max(0.2,Math.cos(flap)),1);
    ctx.beginPath(); ctx.ellipse(-7,-3,8,11,-0.5,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6,6,6,8,0.4,0,TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle='#5a4a52'; ctx.beginPath(); ctx.ellipse(0,0,2.2,7,0,0,TAU); ctx.fill();
    ctx.restore();
  }
  // つち（プリレンダー）
  ctx.drawImage(soilCvs,-200,GROUND,W+400,HWORLD-GROUND+300);
  // しばふ の ふち
  const gg=ctx.createLinearGradient(0,GROUND-18,0,GROUND+8);
  gg.addColorStop(0,'#95dd7a'); gg.addColorStop(0.6,'#66b455'); gg.addColorStop(1,'#4c8a42');
  ctx.fillStyle=gg; ctx.fillRect(-200,GROUND-16,W+400,24);
  // くさ の たば（ゆれる）
  for(const gt of grassTufts){
    const sway=Math.sin(now*1.6+gt.ph)*3;
    ctx.strokeStyle='#5aa34a'; ctx.lineWidth=3.4; ctx.lineCap='round';
    for(let b=-1;b<=1;b++){
      ctx.beginPath(); ctx.moveTo(gt.x+b*4,GROUND-12);
      ctx.quadraticCurveTo(gt.x+b*5+sway*0.5,GROUND-12-gt.h*0.6,gt.x+b*7+sway,GROUND-12-gt.h+(b===0?4:0));
      ctx.stroke();
    }
  }
  // おはな
  for(let i=0;i<7;i++){
    const fx=(i*397)%W;
    if(Math.abs(fx-X0)<200||Math.abs(fx-X1)<200) continue;
    drawFlowerSmall(fx,GROUND-22,7,i%2?'#ff9ec4':'#ffd76a');
  }
  drawSign(X0-80,GROUND); drawSign(X1+280,GROUND);
  drawCone(X0-190,GROUND); drawCone(X1+95,GROUND);
  drawWorker(X1+190,GROUND,now);
  drawWorm();
  // ちちゅうの ふゆう ちり
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let i=0;i<Math.round(26*Quality.pMul());i++){
    const x=((i*611)%W)+Math.sin(now*0.4+i)*30;
    const y=GROUND+120+((i*367)%(HWORLD-GROUND-240))+Math.cos(now*0.3+i*2)*20;
    ctx.fillStyle='rgba(255,240,210,'+(0.03+0.03*Math.sin(now+i))+')';
    ctx.beginPath(); ctx.arc(x,y,2.4,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawFlowerSmall(x,y,r,col){
  const sway=Math.sin(now*1.4+x)*2;
  ctx.strokeStyle='#4c8a42'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(x,y+12); ctx.quadraticCurveTo(x+sway*0.4,y+4,x+sway,y-2); ctx.stroke();
  for(let i=0;i<5;i++){
    const a=i*TAU/5+0.3;
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.ellipse(x+sway+Math.cos(a)*r,y-2+Math.sin(a)*r,r*0.72,r*0.5,a,0,TAU); ctx.fill();
  }
  sphere(x+sway,y-2,r*0.5,'#fff8d0','#ffe89a','#e8b84a');
}
function drawSign(x,y){
  softShadow(x,y+3,66,14,0.3);
  const g=ctx.createLinearGradient(x,y-92,x,y-36);
  g.addColorStop(0,'#f5efe0'); g.addColorStop(1,'#d8cdb4');
  ctx.fillStyle=g; rr(x-82,y-92,164,54,12); ctx.fill();
  ctx.strokeStyle='#a8987a'; ctx.lineWidth=4; rr(x-82,y-92,164,54,12); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=2; rr(x-77,y-87,154,44,9); ctx.stroke();
  for(const px of [x-66,x+58]){
    const pg=ctx.createLinearGradient(px,0,px+9,0);
    pg.addColorStop(0,'#9a6a44'); pg.addColorStop(0.5,'#7c5233'); pg.addColorStop(1,'#5e3c24');
    ctx.fillStyle=pg; ctx.fillRect(px,y-38,9,38);
  }
  ctx.fillStyle='#e2543e'; ctx.font='bold 26px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('こうじちゅう',x,y-64);
}
function drawCone(x,y){
  softShadow(x,y+2,26,8,0.3);
  const g=ctx.createLinearGradient(x-16,0,x+16,0);
  g.addColorStop(0,'#ff8a4a'); g.addColorStop(0.45,'#ffb066'); g.addColorStop(1,'#d85a20');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.moveTo(x-6,y-52); ctx.lineTo(x+6,y-52); ctx.lineTo(x+18,y-4); ctx.lineTo(x-18,y-4); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.moveTo(x-9.5,y-38); ctx.lineTo(x+9.5,y-38); ctx.lineTo(x+12.5,y-26); ctx.lineTo(x-12.5,y-26); ctx.closePath(); ctx.fill();
  const bg=ctx.createLinearGradient(x-26,0,x+26,0);
  bg.addColorStop(0,'#e07030'); bg.addColorStop(1,'#b84c16');
  ctx.fillStyle=bg; rr(x-26,y-6,52,7,3); ctx.fill();
}
function drawWorker(x,y,t){
  const wave=Math.sin(t*2.4)*0.5+0.6;
  softShadow(x,y+2,30,9,0.3);
  ctx.save(); ctx.translate(x,y);
  // あし
  ctx.strokeStyle='#3f4a66'; ctx.lineWidth=11; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,-30); ctx.lineTo(-9,-4); ctx.moveTo(8,-30); ctx.lineTo(9,-4); ctx.stroke();
  // ベスト
  const vg=ctx.createLinearGradient(-18,-70,18,-30);
  vg.addColorStop(0,'#ffb054'); vg.addColorStop(1,'#e88428');
  ctx.fillStyle=vg; rr(-17,-66,34,40,10); ctx.fill();
  ctx.fillStyle='#f6e94a'; ctx.fillRect(-17,-56,34,5); ctx.fillRect(-17,-44,34,5);
  // うで（かた ほう ふる）
  ctx.strokeStyle='#e88428'; ctx.lineWidth=9;
  ctx.beginPath(); ctx.moveTo(-14,-60); ctx.lineTo(-24,-44); ctx.stroke();
  ctx.save(); ctx.translate(14,-62); ctx.rotate(-1.6-wave);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(20,0); ctx.stroke();
  sphere(24,0,5,'#ffe4c8','#f2c49a','#c8926a');
  ctx.restore();
  sphere(-26,-42,5,'#ffe4c8','#f2c49a','#c8926a');
  // かお
  sphere(0,-78,13,'#ffe8d0','#f6c9a0','#d09a70');
  ctx.fillStyle='#463a34';
  const bl=anim.blink>0?0.2:1;
  ctx.beginPath(); ctx.ellipse(-4.5,-79,1.8,2.6*bl,0,0,TAU); ctx.ellipse(4.5,-79,1.8,2.6*bl,0,0,TAU); ctx.fill();
  ctx.strokeStyle='#463a34'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.arc(0,-74,4,0.3,Math.PI-0.3); ctx.stroke();
  // ヘルメット
  const hg=ctx.createLinearGradient(-14,-100,10,-82);
  hg.addColorStop(0,'#fff2a8'); hg.addColorStop(0.5,'#ffd83e'); hg.addColorStop(1,'#e2a818');
  ctx.fillStyle=hg;
  ctx.beginPath(); ctx.arc(0,-86,14,Math.PI,0); ctx.fill();
  rr(-17,-88,34,5,2); ctx.fill();
  ctx.restore();
}
let wormCycle=0;
function drawWorm(){
  wormCycle=(now*0.09)%1;
  const up=smooth(0.1,0.25,wormCycle)*(1-smooth(0.7,0.9,wormCycle));
  if(up<=0.01) return;
  const x=W*0.44, y=GROUND+4;
  ctx.fillStyle='rgba(30,16,12,0.75)';
  ctx.beginPath(); ctx.ellipse(x,y,16,6,0,0,TAU); ctx.fill();
  const h=up*40, sway=Math.sin(now*3)*4*up;
  ctx.strokeStyle='#e89ab2'; ctx.lineWidth=15; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x,y);
  ctx.quadraticCurveTo(x+sway,y-h*0.6,x+sway*1.6,y-h);
  ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(x-3,y-4);
  ctx.quadraticCurveTo(x+sway-3,y-h*0.6,x+sway*1.6-3,y-h+2);
  ctx.stroke();
  ctx.fillStyle='#463a34';
  ctx.beginPath(); ctx.arc(x+sway*1.6-3,y-h,1.7,0,TAU); ctx.arc(x+sway*1.6+3,y-h,1.7,0,TAU); ctx.fill();
}
function drawPits(){
  const p0=pathPoint(0), p1=pathPoint(1);
  for(const [bx,by] of [[X0-190,p0.y],[X1-10,p1.y]]){
    const depth=by-GROUND+R+70;
    // コンクリートの かべ
    const g=ctx.createLinearGradient(bx,GROUND,bx+200,GROUND);
    g.addColorStop(0,'#3a3346'); g.addColorStop(0.5,'#241f30'); g.addColorStop(1,'#3a3346');
    ctx.fillStyle=g; rr(bx,GROUND,200,depth,24); ctx.fill();
    const eg=ctx.createLinearGradient(0,GROUND,0,GROUND+40);
    eg.addColorStop(0,'rgba(0,0,0,0.5)'); eg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=eg; rr(bx,GROUND,200,40,24); ctx.fill();
    ctx.strokeStyle='#6a6284'; ctx.lineWidth=7; rr(bx,GROUND,200,depth,24); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=3; rr(bx+5,GROUND+5,190,depth-10,20); ctx.stroke();
    // ふちどり（じめん とのつなぎ）
    ctx.fillStyle='#8d8ba6'; rr(bx-8,GROUND-8,216,12,6); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)'; rr(bx-8,GROUND-8,216,4,2); ctx.fill();
  }
  // はしご
  for(const px of [X0-160,X1+40]){
    ctx.strokeStyle='#8a7434'; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(px,GROUND+6); ctx.lineTo(px,GROUND+200);
    ctx.moveTo(px+36,GROUND+6); ctx.lineTo(px+36,GROUND+200); ctx.stroke();
    ctx.strokeStyle='#d8b858'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(px-2,GROUND+6); ctx.lineTo(px-2,GROUND+200);
    ctx.moveTo(px+34,GROUND+6); ctx.lineTo(px+34,GROUND+200); ctx.stroke();
    for(let y=GROUND+30;y<GROUND+200;y+=34){
      ctx.strokeStyle='#c9a63e'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(px,y); ctx.lineTo(px+36,y); ctx.stroke();
    }
  }
  // ライナーの リール（ひだり）
  const drumY=p0.y-6, drumR=56*(1-linerT*0.55);
  ctx.strokeStyle='#5c5470'; ctx.lineWidth=8;
  ctx.beginPath(); ctx.moveTo(X0-140,drumY+66); ctx.lineTo(X0-105,drumY);
  ctx.moveTo(X0-70,drumY+66); ctx.lineTo(X0-105,drumY); ctx.stroke();
  if(drumR>18){
    sphere(X0-105,drumY,drumR,'#ffc9da','#ec9db8','#b86a8a');
    ctx.strokeStyle='rgba(150,80,110,0.5)'; ctx.lineWidth=4;
    for(let i=1;i<4;i++){ctx.beginPath();ctx.arc(X0-105,drumY,drumR*i/4,0,TAU);ctx.stroke();}
    ctx.save(); ctx.translate(X0-105,drumY); ctx.rotate(-linerT*9);
    ctx.strokeStyle='rgba(255,235,242,0.6)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(drumR*0.9,0); ctx.stroke(); ctx.restore();
  }
  sphere(X0-105,drumY,10,'#d8d4e8','#8d89a8','#4a4560');
  // ウインチ（みぎ）
  const wy=p1.y-10;
  const wg=ctx.createLinearGradient(X1+50,wy-18,X1+50,wy+40);
  wg.addColorStop(0,'#7a8cb4'); wg.addColorStop(1,'#44536e');
  ctx.fillStyle=wg; rr(X1+52,wy-16,96,54,12); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=3; rr(X1+52,wy-16,96,54,12); ctx.stroke();
  ctx.save(); ctx.translate(X1+100,wy+8); ctx.rotate(crankAng);
  sphere(0,0,30,'#ffe89a','#f2c14a','#b88a20');
  ctx.strokeStyle='#8a6414'; ctx.lineWidth=6;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*TAU/4)*26,Math.sin(i*TAU/4)*26);ctx.stroke();}
  sphere(26,0,7,'#ffd8c8','#e2543e','#8a2c1c');
  ctx.restore();
  // ポンプ（ひだり・くうき いこう）
  if(phase==='inflate'||phase==='cure'||phase==='flow'||phase==='done'){
    const py=p0.y+R+26;
    softShadow(X0-108,py+30,58,12,0.35);
    const bg=ctx.createLinearGradient(X0-150,py-30,X0-150,py+30);
    bg.addColorStop(0,'#9ad4ec'); bg.addColorStop(0.5,'#5ba8c8'); bg.addColorStop(1,'#39708a');
    ctx.fillStyle=bg; rr(X0-152,py-30,88,62,14); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=3; rr(X0-148,py-26,80,26,10); ctx.stroke();
    // プランジャー
    const pg=ctx.createLinearGradient(X0-126,0,X0-92,0);
    pg.addColorStop(0,'#6a9cb4'); pg.addColorStop(0.5,'#3d7690'); pg.addColorStop(1,'#2a5468');
    ctx.fillStyle=pg; rr(X0-126,py-60+plunger*20,34,36,9); ctx.fill();
    ctx.fillStyle='#e2543e'; rr(X0-134,py-66+plunger*20,50,10,5); ctx.fill();
    // あつりょくけい
    sphere(X0-42,py-38,17,'#ffffff','#e8e8f0','#a8a8bc');
    ctx.strokeStyle='#666'; ctx.lineWidth=1.6;
    for(let i=0;i<5;i++){
      const a=Math.PI*0.75+i*Math.PI*0.375;
      ctx.beginPath(); ctx.moveTo(X0-42+Math.cos(a)*12,py-38+Math.sin(a)*12);
      ctx.lineTo(X0-42+Math.cos(a)*15,py-38+Math.sin(a)*15); ctx.stroke();
    }
    const needle=Math.PI*0.75+ (plunger*0.8+inflFront*0.7+Math.sin(now*10)*plunger*0.05)*Math.PI;
    ctx.strokeStyle='#e2543e'; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.moveTo(X0-42,py-38); ctx.lineTo(X0-42+Math.cos(needle)*12,py-38+Math.sin(needle)*12); ctx.stroke();
    // ホース
    ctx.strokeStyle='#39708a'; ctx.lineWidth=11; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(X0-64,py); ctx.quadraticCurveTo(X0-16,py,X0-4,pathPoint(0).y); ctx.stroke();
    ctx.strokeStyle='rgba(160,220,240,0.5)'; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.moveTo(X0-64,py-3); ctx.quadraticCurveTo(X0-16,py-3,X0-4,pathPoint(0).y-3); ctx.stroke();
  }
}

/* ---------- ふぐあい ---------- */
function coveredAt(t){
  const i=Math.floor(clamp(t,0,1)*(NS-1));
  return inflR(i)>R*0.6;
}
function drawDefects(){
  for(const d of defects){
    if(coveredAt(d.t)) continue;
    const p=pathPoint(d.t);
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.ang);
    if(d.kind==='crack'){
      // ひびわれ（ふかみのある きれつ）
      ctx.strokeStyle='#0c0812'; ctx.lineWidth=9; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(-36,-R-4);
      ctx.lineTo(-14,-R+16); ctx.lineTo(4,-R+2); ctx.lineTo(20,-R+22); ctx.lineTo(40,-R+8);
      ctx.stroke();
      ctx.strokeStyle='rgba(120,100,150,0.5)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(-36,-R-7);
      ctx.lineTo(-14,-R+13); ctx.lineTo(4,-R-1); ctx.lineTo(20,-R+19); ctx.lineTo(40,-R+5);
      ctx.stroke();
      // しみだす みず の ぬれた ひかり
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const wa=0.25+0.15*Math.sin(now*2+d.phase);
      ctx.strokeStyle='rgba(140,200,255,'+wa+')'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(4,-R+4); ctx.quadraticCurveTo(6,-R+18,4,-R+30); ctx.stroke();
      ctx.restore();
    } else if(d.kind==='root'){
      const sway=Math.sin(now*2+d.phase)*6;
      for(let i=-1;i<=1;i++){
        // ね（円筒の 陰影 2度がき）
        ctx.strokeStyle='#2c5c28'; ctx.lineWidth=10; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(i*18,-R-6);
        ctx.quadraticCurveTo(i*18+sway,-R+40,i*26+sway*1.6,-R+74+i*8);
        ctx.stroke();
        ctx.strokeStyle='#58a848'; ctx.lineWidth=4.5;
        ctx.beginPath(); ctx.moveTo(i*18-2,-R-6);
        ctx.quadraticCurveTo(i*18+sway-2,-R+40,i*26+sway*1.6-2,-R+72+i*8);
        ctx.stroke();
      }
      // はっぱ
      for(const [lx,ly,la] of [[sway,-R+66,0.4],[-20+sway,-R+48,-0.5],[16+sway*1.3,-R+56,0.9]]){
        ctx.save(); ctx.translate(lx,ly); ctx.rotate(la+Math.sin(now*2+d.phase)*0.1);
        const lg=ctx.createLinearGradient(0,-14,0,10);
        lg.addColorStop(0,'#8ad46a'); lg.addColorStop(1,'#4c9440');
        ctx.fillStyle=lg;
        ctx.beginPath(); ctx.ellipse(0,0,8,14,0,0,TAU); ctx.fill();
        ctx.strokeStyle='rgba(30,70,26,0.6)'; ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(0,12); ctx.stroke();
        ctx.restore();
      }
    } else {
      // ずれ（くいちがった つぎて + がれき）
      const sh=Math.sin(now*1.4+d.phase)*1.5;
      ctx.strokeStyle='#0e0a16'; ctx.lineWidth=12; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,-R-18); ctx.lineTo(10+sh,-R*0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10+sh,R*0.2); ctx.lineTo(0,R+18); ctx.stroke();
      ctx.strokeStyle='rgba(150,130,110,0.6)'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.ellipse(13+sh,0,R*0.22,R*0.94,0,0,TAU); ctx.stroke();
      ctx.strokeStyle='rgba(40,28,20,0.7)'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.ellipse(6+sh,0,R*0.22,R*0.94,0,0,TAU); ctx.stroke();
      // がれき
      for(const [gx,gr] of [[-14,7],[2,5],[16,8],[30,4]]){
        sphere(gx+sh*0.4,R-10,gr,'#a8917a','#6e5a48','#3c2e22');
      }
    }
    ctx.restore();
    if(d.found){
      const a=Math.min(1,d.foundAge*2);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const rr2=R*1.15+Math.sin(now*3)*6;
      ctx.strokeStyle='rgba(255,214,90,'+(0.7*a)+')'; ctx.lineWidth=9;
      ctx.beginPath(); ctx.arc(p.x,p.y,rr2,0,TAU); ctx.stroke();
      ctx.strokeStyle='rgba(255,240,180,'+(0.4*a)+')'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(p.x,p.y,rr2-8,0,TAU); ctx.stroke();
      // まわる きらり
      for(let i=0;i<3;i++){
        const sa=now*1.6+i*TAU/3;
        drawStarShape(p.x+Math.cos(sa)*rr2,p.y+Math.sin(sa)*rr2,7,'rgba(255,240,170,'+(0.8*a)+')');
      }
      ctx.restore();
      drawCheckSticker(p.x,p.y-R-52,26*a);
    }
  }
}
function drawStarShape(x,y,r,col){
  ctx.fillStyle=col;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const rad=i%2===0?r:r*0.38, a=i*TAU/8-Math.PI/2;
    const px=x+Math.cos(a)*rad, py=y+Math.sin(a)*rad;
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.fill();
}
function drawCheckSticker(x,y,r){
  if(r<2) return;
  softShadow(x,y+r*0.4,r*1.2,r*0.5,0.25);
  sphere(x,y,r,'#b8f0a0','#6cc860','#3d8a3a');
  ctx.strokeStyle='#fff'; ctx.lineWidth=r*0.28; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(x-r*0.42,y+r*0.05); ctx.lineTo(x-r*0.1,y+r*0.38); ctx.lineTo(x+r*0.48,y-r*0.32); ctx.stroke();
}

/* ---------- ライナー ---------- */
const COL_SOFT=[252,196,180], COL_CURED=[202,238,250];
function drawLiner(){
  if(phase==='title'||phase==='drive') return;
  // おりたたみ リボン
  if(linerT>0.001){
    const endT=linerT;
    const thick=18;
    const pts=[];
    for(let i=0;i<NS;i++){
      const s=i/(NS-1);
      if(s>endT) break;
      if(inflStart[i]) continue;
      const sm=samples[i];
      const amp=9*(0.4+0.6*smooth(endT-0.3,endT,s))*(phase==='liner'?1:0.4);
      const wob=Math.sin(s*52-now*6)*amp+(ropeTug*Math.sin(now*22+s*30)*2);
      pts.push({x:sm.x+sm.nx*wob,y:sm.y+sm.ny*wob,nx:sm.nx,ny:sm.ny,ty:sm.ty,tx:sm.tx});
    }
    if(pts.length>1){
      // したの おとしかげ
      ctx.strokeStyle='rgba(10,5,15,0.35)'; ctx.lineWidth=thick*2+8; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath();
      pts.forEach((p,i)=>{const x=p.x+4,y=p.y+7;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.stroke();
      // ほんたい
      ctx.strokeStyle='#f2aec4'; ctx.lineWidth=thick*2;
      ctx.beginPath();
      pts.forEach((p,i)=>{i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});
      ctx.stroke();
      // うえの ハイライト / したの シャドウ
      ctx.strokeStyle='rgba(255,230,240,0.8)'; ctx.lineWidth=6;
      ctx.beginPath();
      pts.forEach((p,i)=>{const x=p.x-p.nx*(thick*0.55),y=p.y-p.ny*(thick*0.55);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.stroke();
      ctx.strokeStyle='rgba(150,70,100,0.5)'; ctx.lineWidth=5;
      ctx.beginPath();
      pts.forEach((p,i)=>{const x=p.x+p.nx*(thick*0.6),y=p.y+p.ny*(thick*0.6);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.stroke();
      // おりめ
      ctx.strokeStyle='rgba(180,110,140,0.45)'; ctx.lineWidth=2.4;
      for(let i=2;i<pts.length-2;i+=4){
        const p=pts[i];
        ctx.beginPath();
        ctx.moveTo(p.x-p.nx*thick*0.8,p.y-p.ny*thick*0.8);
        ctx.quadraticCurveTo(p.x+p.tx*5,p.y+p.ty*5,p.x+p.nx*thick*0.8,p.y+p.ny*thick*0.8);
        ctx.stroke();
      }
    }
    // ノーズ + ロープ
    if(phase==='liner'&&linerT<1){
      const p=pathPoint(linerT);
      // ロープ（2ほんどり）
      ctx.strokeStyle='#8a6a34'; ctx.lineWidth=6; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(p.x,p.y);
      for(let s=linerT;s<=1;s+=0.03){const q=pathPoint(s);ctx.lineTo(q.x,q.y);}
      const p1=pathPoint(1); ctx.quadraticCurveTo(X1+40,p1.y+18,X1+100,p1.y-2);
      ctx.stroke();
      ctx.strokeStyle='rgba(230,200,140,0.8)'; ctx.lineWidth=2; ctx.setLineDash([7,7]);
      ctx.beginPath(); ctx.moveTo(p.x,p.y);
      for(let s=linerT;s<=1;s+=0.03){const q=pathPoint(s);ctx.lineTo(q.x,q.y);}
      ctx.quadraticCurveTo(X1+40,p1.y+18,X1+100,p1.y-2);
      ctx.stroke(); ctx.setLineDash([]);
      sphere(p.x,p.y,22,'#ffd8e4','#e493ae','#a85878');
      ctx.strokeStyle='#8a4a64'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(p.x,p.y,14,0,TAU); ctx.stroke();
    }
  }
  // ふくらんだ チューブ
  for(let i=0;i<NS-1;i++){
    const r1=inflR(i), r2=inflR(i+1);
    if(r1<=0&&r2<=0) continue;
    const a=samples[i], b=samples[i+1];
    const qm=(cure[i]+cure[i+1])/2;
    const ra=Math.max(r1,14), rb2=Math.max(r2,14);
    ctx.beginPath();
    ctx.moveTo(a.x-a.nx*ra,a.y-a.ny*ra);
    ctx.lineTo(b.x-b.nx*rb2,b.y-b.ny*rb2);
    ctx.lineTo(b.x+b.nx*rb2,b.y+b.ny*rb2);
    ctx.lineTo(a.x+a.nx*ra,a.y+a.ny*ra);
    ctx.closePath();
    ctx.fillStyle=mixCol(COL_SOFT,COL_CURED,qm);
    ctx.fill();
    // 硬化ずみは うっすら 虹いろの シーン
    if(qm>0.85){
      ctx.fillStyle='hsla('+(180+Math.sin(i*0.35)*36)+',70%,80%,0.13)';
      ctx.fill();
    }
  }
  // 円筒の 陰影（うちがわ あかるみ・ふち シャドウ・つや）
  ctx.lineCap='round';
  let runStart=-1;
  for(let seg=0;seg<NS;seg++){
    const r1=seg<NS?inflR(seg):0;
    if(r1>R*0.5&&runStart<0) runStart=seg;
    if((r1<=R*0.5||seg===NS-1)&&runStart>=0){
      const runEnd=r1>R*0.5?seg:seg-1;
      if(runEnd>runStart){
        const rAvg=R-7;
        // ふちの まるみ（上下 シャドウ）
        for(const [off,wd,col] of [
          [-(rAvg-8),16,'rgba(150,120,140,0.30)'],
          [ (rAvg-8),16,'rgba(150,110,130,0.22)'],
          [-(rAvg*0.42),rAvg*0.9,'rgba(255,255,255,0.14)'],
        ]){
          ctx.strokeStyle=col; ctx.lineWidth=wd;
          ctx.beginPath();
          for(let i=runStart;i<=runEnd;i++){
            const s=samples[i], rr3=Math.min(inflR(i),rAvg);
            const x=s.x+s.nx*off*(rr3/rAvg), y=s.y+s.ny*off*(rr3/rAvg);
            i===runStart?ctx.moveTo(x,y):ctx.lineTo(x,y);
          }
          ctx.stroke();
        }
        // かたまった つや すじ（ながれる ハイライト）
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.lineWidth=7;
        ctx.beginPath();
        let has=false;
        for(let i=runStart;i<=runEnd;i++){
          const q=cure[i]; if(q<0.75) {has=false; continue;}
          const s=samples[i], rr3=inflR(i);
          const shimmer=0.22+0.13*Math.sin(i*0.4-now*2.2);
          ctx.strokeStyle='rgba(255,255,255,'+shimmer+')';
          const x=s.x-s.nx*rr3*0.55, y=s.y-s.ny*rr3*0.55;
          has?ctx.lineTo(x,y):ctx.moveTo(x,y); has=true;
        }
        ctx.stroke(); ctx.restore();
      }
      runStart=-1;
    }
  }
  // ふくらみの さきっぽ
  if(phase==='inflate'&&inflFront>0.01&&inflFront<1){
    const p=pathPoint(inflFront);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    glow(p.x,p.y,60,'rgba(255,230,240,%a)',0.5);
    ctx.restore();
    for(let i=0;i<3;i++){
      sphere(p.x+p.tx*i*20,p.y+Math.sin(now*8+i)*6,15-i*4,'#fff6fa','#ffdce8','#e8a8c0');
    }
  }
  if(glossSweep>=0&&glossSweep<=1){
    const p=pathPoint(glossSweep);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    glow(p.x,p.y,R*2.2,'rgba(255,255,255,%a)',0.5);
    ctx.restore();
  }
}
function drawStamps(){
  for(const st of stamps){
    ctx.save(); ctx.globalAlpha=st.a*0.9; ctx.translate(st.x,st.y); ctx.rotate(st.rot);
    if(st.kind==='star'){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      glow(0,0,st.size*1.8,'rgba(255,220,120,%a)',0.4); ctx.restore();
      drawStarShape(0,0,st.size,'#ffd76a');
      drawStarShape(-st.size*0.12,-st.size*0.14,st.size*0.6,'#fff2b8');
    } else {
      for(let i=0;i<5;i++){
        const a=i*TAU/5;
        const pg=ctx.createRadialGradient(Math.cos(a)*st.size*0.6,Math.sin(a)*st.size*0.6,0,Math.cos(a)*st.size*0.7,Math.sin(a)*st.size*0.7,st.size*0.62);
        pg.addColorStop(0,'#ffd3e2'); pg.addColorStop(1,'#f490b4');
        ctx.fillStyle=pg;
        ctx.beginPath(); ctx.ellipse(Math.cos(a)*st.size*0.68,Math.sin(a)*st.size*0.68,st.size*0.5,st.size*0.36,a,0,TAU); ctx.fill();
      }
      sphere(0,0,st.size*0.34,'#fff8d8','#ffe08a','#d8a83a');
    }
    ctx.restore();
  }
}

/* ---------- みず ---------- */
function buildWaterPath(end){
  ctx.beginPath();
  for(let i=0;i<=end;i++){
    const s=samples[i], wv=Math.sin(i*0.6-now*5)*4+Math.sin(i*1.3-now*8)*1.6;
    const y=R*0.12+wv;
    const px=s.x+s.nx*y, py=s.y+s.ny*y;
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  for(let i=end;i>=0;i--){
    const s=samples[i];
    ctx.lineTo(s.x+s.nx*R*0.82,s.y+s.ny*R*0.82);
  }
  ctx.closePath();
}
function drawWater(){
  if(waterT<=0.005) return;
  const end=Math.floor(clamp(waterT,0,1)*(NS-1));
  if(end<2) return;
  // ほんたい（ふかみの グラデ — 全体に たてグラデ）
  let minY=1e9,maxY=-1e9;
  for(let i=0;i<=end;i++){const s=samples[i];minY=Math.min(minY,s.y);maxY=Math.max(maxY,s.y+R);}
  const g=ctx.createLinearGradient(0,minY,0,maxY);
  g.addColorStop(0,'rgba(120,214,255,0.82)');
  g.addColorStop(1,'rgba(28,120,200,0.88)');
  buildWaterPath(end);
  ctx.fillStyle=g; ctx.fill();
  // コースティクス（うごく ひかりの あみ）
  if(Quality.tier>0){
    ctx.save();
    buildWaterPath(end); ctx.clip();
    ctx.globalCompositeOperation='lighter';
    const pat=ctx.createPattern(causticCvs,'repeat');
    for(const [spd,al,sc] of [[26,0.08,1],[-17,0.06,1.6]]){
      ctx.save(); ctx.globalAlpha=al;
      ctx.translate(now*spd,Math.sin(now*0.8)*4); ctx.scale(sc,sc);
      ctx.fillStyle=pat;
      ctx.fillRect((X0-300-now*spd)/sc,(minY-80)/sc,(X1-X0+600)/sc,(maxY-minY+160)/sc);
      ctx.restore();
    }
    ctx.restore();
  }
  // すいめん（フォーム + ハイライト）
  ctx.lineCap='round';
  ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=4.5;
  ctx.beginPath();
  for(let i=0;i<=end;i++){
    const s=samples[i], wv=Math.sin(i*0.6-now*5)*4+Math.sin(i*1.3-now*8)*1.6;
    const px=s.x+s.nx*(R*0.12+wv), py=s.y+s.ny*(R*0.12+wv);
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle='rgba(200,240,255,0.35)'; ctx.lineWidth=9;
  ctx.stroke(); ctx.restore();
  // せんたん の しぶき
  if(waterT<1){
    const p=pathPoint(waterT);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    glow(p.x,p.y+p.ny*R*0.4,46,'rgba(200,240,255,%a)',0.5);
    ctx.restore();
  }
  // はっぱの ふね + はもん
  if(boatT>0.01&&boatT<1.04){
    const p=pathPoint(clamp(boatT,0,1));
    const bx=p.x+p.nx*R*0.1, by=p.y+p.ny*R*0.1+Math.sin(now*4)*3;
    for(let i=0;i<2;i++){
      const ra=((now*0.7+i*0.5)%1);
      ctx.strokeStyle='rgba(255,255,255,'+(0.4*(1-ra))+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(bx-p.tx*20*ra,by,18*ra+6,6*ra+2,p.ang,0,TAU); ctx.stroke();
    }
    ctx.save(); ctx.translate(bx,by); ctx.rotate(p.ang+Math.sin(now*3)*0.12);
    const lg=ctx.createLinearGradient(-20,-8,20,8);
    lg.addColorStop(0,'#9ade6e'); lg.addColorStop(1,'#4c9c3c');
    ctx.fillStyle=lg;
    ctx.beginPath();
    ctx.moveTo(-24,0);
    ctx.quadraticCurveTo(-6,-15,24,-3);
    ctx.quadraticCurveTo(4,13,-24,0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(40,90,30,0.7)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-20,0); ctx.quadraticCurveTo(0,-2,22,-3); ctx.stroke();
    for(let i=0;i<3;i++){
      ctx.beginPath(); ctx.moveTo(-12+i*10,-1); ctx.lineTo(-8+i*10,-7+i); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------- カバー と ひかりの れっしゃ ---------- */
function drawCoversAndTrain(){
  if(coverT>0.01){
    for(const [t,dir] of [[0,-1],[1,1]]){
      const p=pathPoint(t);
      ctx.save(); ctx.translate(p.x+dir*8,p.y); ctx.rotate(p.ang);
      const slide=(1-coverT)*R*2.4*dir;
      const mg=ctx.createLinearGradient(-16+slide,0,16+slide,0);
      mg.addColorStop(0,'#a8b0d8'); mg.addColorStop(0.5,'#7a84bc'); mg.addColorStop(1,'#565e94');
      ctx.fillStyle=mg;
      rr(-16+slide,-R-14,32,(R+14)*2,10); ctx.fill();
      ctx.strokeStyle='#3d4374'; ctx.lineWidth=4;
      rr(-16+slide,-R-14,32,(R+14)*2,10); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-10+slide,-R-8); ctx.lineTo(-10+slide,R+8); ctx.stroke();
      // たて（シールド もんしょう）
      ctx.save(); ctx.translate(slide,0);
      const sg=ctx.createLinearGradient(0,-14,0,16);
      sg.addColorStop(0,'#ffe89a'); sg.addColorStop(1,'#e2a828');
      ctx.fillStyle=sg;
      ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(10,-8); ctx.lineTo(10,4);
      ctx.quadraticCurveTo(10,13,0,17); ctx.quadraticCurveTo(-10,13,-10,4);
      ctx.lineTo(-10,-8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#8a6414'; ctx.lineWidth=2; ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
  }
  if(phase==='cure'&&trainT>-0.05&&trainT<1.08){
    const lead=clamp(trainT,0,1);
    const p=pathPoint(lead);
    // ステータスひかり（むらさきの おおきな グロー + リング）
    ctx.save(); ctx.globalCompositeOperation='lighter';
    glow(p.x,p.y,R*2.8,'rgba(178,130,255,%a)',0.4);
    glow(p.x,p.y,R*1.4,'rgba(160,200,255,%a)',0.3);
    ctx.strokeStyle='rgba(200,160,255,'+(0.35+0.15*Math.sin(now*9))+')'; ctx.lineWidth=12;
    ctx.beginPath(); ctx.ellipse(p.x,p.y,R*0.3,R*1.02,p.ang,0,TAU); ctx.stroke();
    ctx.restore();
    // 3りょう が それぞれ みちに そって はしる
    for(let carN=2;carN>=0;carN--){
      const ct=clamp(trainT-carN*0.034,-0.02,1);
      const cp=pathPoint(Math.max(0,ct));
      const ride=R-32;
      const cx=cp.x+cp.nx*ride, cy=cp.y+cp.ny*ride;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(cp.ang);
      softShadow(0,30,36,10,0.4);
      // くるま
      for(const wx of [-17,17]){
        sphere(wx,26,10,'#6a628c','#463f64','#241f38');
        ctx.save(); ctx.translate(wx,26); ctx.rotate(anim.wheelRot+trainT*60);
        ctx.fillStyle='#8d85b4';
        for(let i=0;i<3;i++){ctx.rotate(TAU/3);ctx.fillRect(-1.4,-8,2.8,5);}
        ctx.restore();
      }
      // ボディ
      const bg=ctx.createLinearGradient(0,-28,0,28);
      if(carN===0){bg.addColorStop(0,'#a894e8');bg.addColorStop(0.5,'#8471d4');bg.addColorStop(1,'#5a4aa8');}
      else{bg.addColorStop(0,'#beaef0');bg.addColorStop(0.5,'#9b8ce0');bg.addColorStop(1,'#6a5ab8');}
      ctx.fillStyle=bg;
      rr(-28,-26,56,52,15); ctx.fill();
      ctx.strokeStyle='rgba(40,28,80,0.6)'; ctx.lineWidth=3; rr(-28,-26,56,52,15); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(-20,-19); ctx.quadraticCurveTo(0,-24,20,-19); ctx.stroke();
      // ランプ（ガラスドーム + フレア）
      const flick=0.7+0.3*Math.sin(now*14+carN*2);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      glow(0,0,30,'rgba(210,170,255,%a)',0.7*flick);
      ctx.restore();
      sphere(0,0,13,'rgba(240,225,255,0.95)','rgba(190,150,255,0.9)','rgba(120,80,200,0.9)');
      ctx.fillStyle='rgba(255,255,255,'+(0.85*flick)+')';
      ctx.beginPath(); ctx.arc(-3,-4,4.5,0,TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle='rgba(255,240,255,'+(0.5*flick)+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-19,0); ctx.lineTo(19,0); ctx.moveTo(0,-19); ctx.lineTo(0,19); ctx.stroke();
      ctx.restore();
      // れんけつき
      if(carN<2){
        ctx.strokeStyle='#463f64'; ctx.lineWidth=6;
        ctx.beginPath(); ctx.moveTo(-28,8); ctx.lineTo(-40,8); ctx.stroke();
      }
      // かお（せんとうしゃ）
      if(carN===0){
        const bl=anim.trBlink>0?0.15:1;
        ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.ellipse(17,-9,6.5,7*bl,0,0,TAU); ctx.fill();
        ctx.fillStyle='#332b55';
        ctx.beginPath(); ctx.ellipse(19,-9,3.4,4*bl,0,0,TAU); ctx.fill();
        ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.arc(20,-11,1.3,0,TAU); ctx.fill();
        ctx.strokeStyle='#332b55'; ctx.lineWidth=2.6; ctx.lineCap='round';
        const smile=0.2+trainSpeed*3;
        ctx.beginPath(); ctx.arc(15,6,6,0.2,Math.PI*(0.5+clamp(smile,0.2,0.45))); ctx.stroke();
        ctx.fillStyle='rgba(255,150,170,0.5)';
        ctx.beginPath(); ctx.arc(8,2,3.4,0,TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}
function drawCuredTwinkles(){
  if(phase!=='cure'&&phase!=='flow'&&phase!=='done') return;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let i=0;i<NS;i+=6){
    if(cure[i]<1) continue;
    const tw=Math.sin(now*3+i*2.7);
    if(tw<0.72) continue;
    const s=samples[i];
    const ox=Math.sin(i*13.7)*R*0.7, oy=Math.cos(i*7.3)*R*0.5;
    drawStarShape(s.x+ox*0.6,s.y+oy*0.6,4+(tw-0.72)*16,'rgba(255,255,255,'+((tw-0.72)*2.4)+')');
  }
  ctx.restore();
}

/* ---------- ロボ「コロン」 ---------- */
function drawRobot(){
  if(phase!=='title'&&phase!=='drive'&&phase!=='done'){
    drawRobotBody(X1+248,GROUND-4,0,0.85,'watch');
    return;
  }
  if(phase==='done'){
    const hop=Math.abs(Math.sin(now*5))*-20;
    drawRobotBody(X1+248,GROUND-4+hop,0,0.9,'happy');
    return;
  }
  if(phase==='title') return;
  const p=robotPos();
  drawRobotBody(p.x,p.y,p.ang,1,'drive');
}
function drawRobotBody(x,y,ang,scale,mood){
  ctx.save(); ctx.translate(x,y); ctx.rotate(ang+((mood==='drive')?anim.tilt*0.25:0)); ctx.scale(scale,scale);
  const bob=Math.sin(anim.bob)*(mood==='drive'?1.5:1);
  ctx.translate(0,bob*0.6);
  // ヘッドライト
  if(mood==='drive'&&phase==='drive'){
    ctx.save(); ctx.rotate(robot.aim);
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createLinearGradient(30,0,360,0);
    g.addColorStop(0,'rgba(255,240,170,0.55)'); g.addColorStop(0.6,'rgba(255,236,150,0.16)'); g.addColorStop(1,'rgba(255,236,150,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.moveTo(28,-9); ctx.lineTo(360,-84); ctx.lineTo(360,84); ctx.lineTo(28,9); ctx.closePath(); ctx.fill();
    glow(30,0,36,'rgba(255,244,190,%a)',0.8);
    // てらされた かべ
    const hit=pathPoint(clamp(robot.t+0.09,0,1));
    ctx.restore(); ctx.save(); ctx.globalCompositeOperation='lighter';
    glow(hit.x-x,hit.y-y,R*1.1,'rgba(255,240,180,%a)',0.22);
    ctx.restore(); ctx.save(); ctx.rotate(robot.aim);
    ctx.restore();
  }
  softShadow(0,34,44,10,0.45);
  // キャタピラ ふう ホイール
  for(const wx of [-24,24]){
    sphere(wx,26,13,'#5c6078','#3a3f52','#1f2230');
    ctx.save(); ctx.translate(wx,26); ctx.rotate(anim.wheelRot);
    ctx.fillStyle='#7a7f9a';
    for(let i=0;i<4;i++){ctx.rotate(TAU/4);ctx.fillRect(-2,-11,4,6);}
    ctx.restore();
    sphere(wx,26,4.5,'#9a9fb8','#5c6078','#32364a');
  }
  // ボディ（オレンジの まるい きょうたい）
  const bg=ctx.createLinearGradient(0,-26,0,30);
  bg.addColorStop(0,'#ffd27a'); bg.addColorStop(0.45,'#ffb64f'); bg.addColorStop(1,'#e08a28');
  ctx.fillStyle=bg; rr(-42,-24,84,52,18); ctx.fill();
  ctx.strokeStyle='#c47c1e'; ctx.lineWidth=3.5; rr(-42,-24,84,52,18); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-32,-16); ctx.quadraticCurveTo(0,-24,32,-16); ctx.stroke();
  // わきの パネル
  ctx.fillStyle='rgba(255,255,255,0.25)'; rr(-36,-6,16,22,6); ctx.fill();
  ctx.fillStyle='#e08a28';
  ctx.beginPath(); ctx.arc(-28,0,2.6,0,TAU); ctx.arc(-28,8,2.6,0,TAU); ctx.fill();
  // カメラの め（ガラスドーム）
  const look=mood==='drive'?clamp(robot.aim*10,-6,6):(mood==='happy'?0:2);
  sphere(16,-2,19,'#ffffff','#eef2fa','#b8c4dc');
  ctx.strokeStyle='#c47c1e'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(16,-2,19,0,TAU); ctx.stroke();
  const bl=anim.blink>0?0.12:1;
  if(mood==='happy'&&anim.celeb<=0){
    // にこにこ め
    ctx.strokeStyle='#2e3140'; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(16+look,0,8,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
  } else {
    ctx.fillStyle='#2e3140';
    ctx.beginPath(); ctx.ellipse(19+look,-2+(mood==='drive'?Math.abs(robot.aim)*7:0),8.5,9.5*bl,0,0,TAU); ctx.fill();
    ctx.fillStyle='#5a7de0';
    ctx.beginPath(); ctx.ellipse(19+look,-2,5,6*bl,0,0,TAU); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(21.5+look,-5.5,2.8,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(17+look,1,1.4,0,TAU); ctx.fill();
  }
  // ガラスの てり
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(9,-10,5,3,0.7,0,TAU); ctx.fill();
  // ほっぺ と くち
  ctx.fillStyle='rgba(255,140,120,0.45)';
  ctx.beginPath(); ctx.arc(-8,8,4.4,0,TAU); ctx.fill();
  ctx.strokeStyle='#2e3140'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath();
  if(mood==='happy'||anim.celeb>0) ctx.arc(-8,4,9,0.15,Math.PI-0.15);
  else ctx.arc(-8,9,6,0.3,Math.PI-0.3);
  ctx.stroke();
  // アンテナ（バネ）
  const aa=anim.antA+(mood==='happy'?Math.sin(now*8)*0.2:0);
  ctx.strokeStyle='#c47c1e'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-20,-24);
  ctx.quadraticCurveTo(-24+aa*10,-36,-26+aa*18,-45);
  ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  glow(-27+aa*18,-49,13,'rgba(255,120,140,%a)',0.5+0.3*Math.sin(now*6));
  ctx.restore();
  sphere(-27+aa*18,-49,6.5,'#ffb8c4','#ff6f7d','#c23a4a');
  ctx.restore();
}

/* ---------- パーティクル 描画 ---------- */
function drawWorldParticles(){
  for(const p of particles){
    const a=1-p.age/p.life;
    ctx.globalAlpha=a;
    if(p.kind==='star'){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      drawStarShape(p.x,p.y,p.r*1.6,p.col);
      ctx.restore();
    } else if(p.kind==='mote'){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=p.col;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
      ctx.restore();
    } else if(p.kind==='ring'){
      ctx.strokeStyle=p.col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r+p.age*40,(p.r+p.age*40)*0.4,0,0,TAU); ctx.stroke();
    } else if(p.kind==='drop'){
      ctx.fillStyle=p.col;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r*0.66,p.r,0,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(p.x-p.r*0.2,p.y-p.r*0.3,p.r*0.26,0,TAU); ctx.fill();
    } else if(p.kind==='bubble'){
      ctx.strokeStyle='rgba(240,252,255,0.8)'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(p.x-p.r*0.3,p.y-p.r*0.35,p.r*0.3,0,TAU); ctx.fill();
    } else {
      ctx.fillStyle=p.col;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
    }
  }
  ctx.globalAlpha=1;
}

/* ---------- UI ---------- */
function drawUI(){
  const base=Math.min(vw,vh);
  for(const c of confetti){
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    if(c.kind==='star'){
      drawStarShape(0,0,c.w*0.7,c.col);
    } else if(c.kind==='ribbon'){
      ctx.strokeStyle=c.col; ctx.lineWidth=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,-c.w);
      ctx.quadraticCurveTo(c.w*0.8,0,0,c.w);
      ctx.quadraticCurveTo(-c.w*0.8,c.w*2,0,c.w*3);
      ctx.stroke();
    } else {
      const flip=Math.sin(c.age*6+c.rot);
      ctx.scale(1,Math.max(0.2,Math.abs(flip)));
      ctx.fillStyle=c.col; ctx.fillRect(-c.w/2,-c.w/3,c.w,c.w*0.66);
      ctx.fillStyle='rgba(0,0,0,0.18)';
      if(flip<0) ctx.fillRect(-c.w/2,-c.w/3,c.w,c.w*0.66);
    }
    ctx.restore();
  }
  if(banner&&bannerAge<3.4){
    const a=Math.min(1,bannerAge*4)*Math.min(1,(3.4-bannerAge)*2);
    const pop=easeOutBack(Math.min(1,bannerAge*3));
    ctx.save(); ctx.globalAlpha=a;
    const bw=Math.min(vw*0.8,560)*pop, bh=base*0.19*pop;
    const bx=vw/2-bw/2, by=18;
    ctx.save();
    ctx.shadowColor='rgba(40,20,60,0.4)'; ctx.shadowBlur=18; ctx.shadowOffsetY=6;
    const cg=ctx.createLinearGradient(0,by,0,by+bh);
    cg.addColorStop(0,'rgba(255,255,255,0.97)'); cg.addColorStop(1,'rgba(255,242,228,0.95)');
    rr(bx,by,bw,bh,bh*0.4); ctx.fillStyle=cg; ctx.fill();
    ctx.restore();
    const eg=ctx.createLinearGradient(bx,0,bx+bw,0);
    eg.addColorStop(0,'#ffca6a'); eg.addColorStop(0.5,'#ff9eb8'); eg.addColorStop(1,'#a4c8ff');
    ctx.strokeStyle=eg; ctx.lineWidth=5; rr(bx,by,bw,bh,bh*0.4); ctx.stroke();
    ctx.fillStyle='#5a4632'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold '+Math.round(bh*0.4)+'px '+FONT;
    ctx.fillText(banner.big,vw/2,by+bh*0.37);
    ctx.font=Math.round(bh*0.19)+'px '+FONT;
    ctx.fillStyle='#8a7357';
    ctx.fillText(banner.small,vw/2,by+bh*0.74);
    ctx.restore();
  }
  if(phase==='drive'&&defects.length){
    let x=30;
    for(let i=0;i<defects.length;i++){
      const r=base*0.032;
      if(i<foundCount) drawCheckSticker(x+r,44,r);
      else {
        ctx.globalAlpha=0.45;
        sphere(x+r,44,r,'#ffffff','#d8dce8','#a0a8bc');
        ctx.strokeStyle='#5a616e'; ctx.lineWidth=r*0.22;
        ctx.beginPath(); ctx.arc(x+r-r*0.15,44-r*0.15,r*0.42,0,TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+r+r*0.18,44+r*0.2); ctx.lineTo(x+r+r*0.5,44+r*0.52); ctx.stroke();
        ctx.globalAlpha=1;
      }
      x+=base*0.078;
    }
  }
  for(const b of buttons()) drawButton(b);
  if(phase==='title') drawTitle();
  drawHint(base);
}
function drawButton(b){
  const held=pointer.down&&pointer.onButton&&pointer.onButton.id===b.id;
  const r=b.r*(held?0.9:1);
  ctx.save();
  if(!b.small){
    const ring=1+Math.sin(now*3)*0.05;
    ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(b.x,b.y,r*1.18*ring,0,TAU); ctx.stroke();
    ctx.save();
    ctx.shadowColor='rgba(30,15,45,0.45)'; ctx.shadowBlur=16; ctx.shadowOffsetY=7;
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(b.x,b.y,r,0,TAU); ctx.fill();
    ctx.restore();
  }
  const cols={
    play:['#ffe49a','#ffcf5e','#d89a20'], replay:['#ffe49a','#ffcf5e','#d89a20'],
    winch:['#ffb8cc','#ff8fb3','#d05a82'], pump:['#a8dcf2','#7cc7e8','#4590b4'],
    train:['#c4b2f2','#a58fe8','#6a54b8'], water:['#9ed8ff','#69c8ff','#3390cc'],
    mute:['#ffffff','#f0f0f4','#c0c4d0'],
  }[b.id]||['#ffffff','#e8e8f0','#b8b8c8'];
  sphere(b.x,b.y+ (held?2:0),r,cols[0],cols[1],cols[2]);
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(b.x-r*0.24,b.y-r*0.4,r*0.4,r*0.22,0.3,0,TAU); ctx.fill();
  drawButtonIcon(b,r*(held?0.94:1));
  if(b.label){
    ctx.font='bold '+Math.round(r*0.32)+'px '+FONT;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(60,30,20,0.5)'; ctx.lineWidth=5; ctx.lineJoin='round';
    ctx.strokeText(b.label,b.x,b.y+r*1.45);
    ctx.fillText(b.label,b.x,b.y+r*1.45);
  }
  ctx.restore();
}
function drawButtonIcon(b,r){
  const x=b.x,y=b.y;
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle='#fff'; ctx.strokeStyle='#fff';
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=4; ctx.shadowOffsetY=2;
  if(b.id==='play'){
    ctx.beginPath(); ctx.moveTo(-r*0.26,-r*0.4); ctx.lineTo(r*0.44,0); ctx.lineTo(-r*0.26,r*0.4); ctx.closePath(); ctx.fill();
  } else if(b.id==='replay'){
    ctx.lineWidth=r*0.16;
    ctx.beginPath(); ctx.arc(0,0,r*0.34,-0.4,Math.PI*1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.34+r*0.14,-r*0.16); ctx.lineTo(r*0.34-r*0.16,-r*0.14); ctx.lineTo(r*0.4,r*0.18); ctx.closePath(); ctx.fill();
  } else if(b.id==='winch'){
    ctx.rotate(crankAng);
    ctx.lineWidth=r*0.13;
    ctx.beginPath(); ctx.arc(0,0,r*0.44,0,TAU); ctx.stroke();
    for(let i=0;i<5;i++){ctx.rotate(TAU/5);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-r*0.44);ctx.stroke();}
    ctx.beginPath(); ctx.arc(0,0,r*0.12,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.44,0,r*0.12,0,TAU); ctx.fill();
  } else if(b.id==='pump'){
    for(const [px,py,pr] of [[-r*0.18,-r*0.05,r*0.24],[r*0.16,-r*0.16,r*0.19],[r*0.12,r*0.2,r*0.16]]){
      ctx.beginPath(); ctx.arc(px,py,pr,0,TAU); ctx.fill();
    }
    ctx.lineWidth=r*0.09;
    ctx.beginPath(); ctx.moveTo(-r*0.52,-r*0.3); ctx.lineTo(-r*0.34,-r*0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.55,0); ctx.lineTo(-r*0.4,0); ctx.stroke();
  } else if(b.id==='train'){
    ctx.beginPath(); ctx.arc(0,-r*0.08,r*0.3,Math.PI*0.95,Math.PI*2.05); ctx.fill();
    rr(-r*0.14,r*0.16,r*0.28,r*0.2,r*0.05); ctx.fill();
    ctx.lineWidth=r*0.08;
    for(let i=0;i<5;i++){
      const a=-Math.PI*0.9+i*Math.PI*0.2- Math.PI*0.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*r*0.42,-r*0.08+Math.sin(a)*r*0.42);
      ctx.lineTo(Math.cos(a)*r*0.58,-r*0.08+Math.sin(a)*r*0.58);
      ctx.stroke();
    }
  } else if(b.id==='water'){
    ctx.beginPath();
    ctx.moveTo(0,-r*0.42);
    ctx.bezierCurveTo(r*0.34,-r*0.02,r*0.3,r*0.18,0,r*0.36);
    ctx.bezierCurveTo(-r*0.3,r*0.18,-r*0.34,-r*0.02,0,-r*0.42);
    ctx.fill();
    ctx.fillStyle='rgba(120,190,240,0.8)';
    ctx.beginPath(); ctx.ellipse(-r*0.08,r*0.05,r*0.07,r*0.12,0.4,0,TAU); ctx.fill();
  } else if(b.id==='mute'){
    ctx.fillStyle='#5a616e'; ctx.strokeStyle='#5a616e';
    ctx.beginPath();
    ctx.moveTo(-12,-5); ctx.lineTo(-4,-5); ctx.lineTo(5,-12); ctx.lineTo(5,12); ctx.lineTo(-4,5); ctx.lineTo(-12,5);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth=2.6;
    if(Snd.muted){
      ctx.strokeStyle='#e2543e';
      ctx.beginPath(); ctx.moveTo(-14,-14); ctx.lineTo(16,14); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(7,0,7,-0.9,0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(7,0,11,-0.8,0.8); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawTitle(){
  const base=Math.min(vw,vh);
  ctx.fillStyle='rgba(43,35,56,0.35)'; ctx.fillRect(0,0,vw,vh);
  const bw=Math.min(vw*0.9,720), bh=base*0.42, bx=vw/2-bw/2, by=vh*0.12;
  ctx.save();
  ctx.shadowColor='rgba(30,15,45,0.5)'; ctx.shadowBlur=24; ctx.shadowOffsetY=10;
  const cg=ctx.createLinearGradient(0,by,0,by+bh);
  cg.addColorStop(0,'rgba(255,255,255,0.97)'); cg.addColorStop(1,'rgba(255,240,224,0.95)');
  rr(bx,by,bw,bh,40); ctx.fillStyle=cg; ctx.fill();
  ctx.restore();
  const eg=ctx.createLinearGradient(bx,0,bx+bw,0);
  eg.addColorStop(0,'#ffca6a'); eg.addColorStop(0.5,'#ff9eb8'); eg.addColorStop(1,'#a4c8ff');
  ctx.strokeStyle=eg; ctx.lineWidth=7; rr(bx,by,bw,bh,40); ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='bold '+Math.round(bh*0.155)+'px '+FONT;
  ctx.fillStyle='#5a4632';
  ctx.fillText('スルッ！ぷうっ！ピカッ！',vw/2,by+bh*0.22);
  ctx.font='bold '+Math.round(bh*0.225)+'px '+FONT;
  const tg=ctx.createLinearGradient(0,by+bh*0.36,0,by+bh*0.64);
  tg.addColorStop(0,'#ff9048'); tg.addColorStop(1,'#e2543e');
  ctx.save();
  ctx.strokeStyle='#fff'; ctx.lineWidth=Math.round(bh*0.05); ctx.lineJoin='round';
  ctx.strokeText('ひかりのパイプたい',vw/2,by+bh*0.5);
  ctx.fillStyle=tg;
  ctx.fillText('ひかりのパイプたい',vw/2,by+bh*0.5);
  ctx.restore();
  // タイトルの きらきら
  for(let i=0;i<5;i++){
    const tw=Math.sin(now*2.4+i*1.9);
    if(tw>0.2) drawStarShape(bx+bw*(0.08+i*0.21),by+bh*(i%2?0.14:0.86),8*tw,'rgba(255,214,106,'+tw+')');
  }
  ctx.font=Math.round(bh*0.093)+'px '+FONT;
  ctx.fillStyle='#8a7357';
  ctx.fillText('ふるい パイプを なおす おしごとゲーム',vw/2,by+bh*0.75);
  ctx.font=Math.round(bh*0.082)+'px '+FONT;
  ctx.fillText('おうちのひとと いっしょに あそんでね',vw/2,by+bh*0.9);
  ctx.save(); ctx.translate(vw/2-bw*0.34,by+bh+base*0.11+Math.sin(now*3)*8); ctx.scale(base/620,base/620);
  drawRobotBody(0,0,0,1.6,'happy');
  ctx.restore();
  if(vh>vw){
    ctx.font=Math.round(base*0.045)+'px '+FONT;
    ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.fillText('よこむきが おすすめだよ',vw/2,vh-26);
  }
}
function drawHandHint(x,y,s){
  const bob=Math.sin(now*4)*8;
  ctx.save(); ctx.translate(x,y+bob); ctx.rotate(-0.3);
  ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=3;
  const ring=(now*1.4)%1;
  ctx.globalAlpha=1-ring;
  ctx.beginPath(); ctx.arc(0,-s*1.1,s*(0.5+ring*0.9),0,TAU); ctx.stroke();
  ctx.globalAlpha=1;
  ctx.shadowColor='rgba(30,15,45,0.4)'; ctx.shadowBlur=8; ctx.shadowOffsetY=4;
  // ゆび
  const g=ctx.createLinearGradient(-s*0.5,0,s*0.5,0);
  g.addColorStop(0,'#ffffff'); g.addColorStop(1,'#e2e2ec');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(-s*0.16,-s*0.2);
  ctx.lineTo(-s*0.16,-s*1.05);
  ctx.arc(0,-s*1.05,s*0.16,Math.PI,0);
  ctx.lineTo(s*0.16,-s*0.2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,s*0.16,s*0.42,s*0.5,0,0,TAU); ctx.fill();
  ctx.strokeStyle='#b0b0c4'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-s*0.16,-s*0.2); ctx.lineTo(-s*0.16,-s*1.05); ctx.stroke();
  ctx.restore();
}
function drawHint(base){
  if(idleTime<6) return;
  if(phase==='drive'){
    const nd=nextUnfound();
    if(waitingDefect){
      const p=pathPoint(waitingDefect.t);
      const sp=worldToScreen(p.x,p.y);
      drawHandHint(sp.x+10,sp.y+base*0.14,base*0.055);
    } else if(nd||robot.t<1){
      const x=vw*0.5+Math.sin(now*2.4)*vw*0.12;
      drawHandHint(x,vh*0.66,base*0.055);
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=5; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(vw*0.4,vh*0.72); ctx.lineTo(vw*0.6,vh*0.72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vw*0.6-14,vh*0.72-9); ctx.lineTo(vw*0.6,vh*0.72); ctx.lineTo(vw*0.6-14,vh*0.72+9); ctx.stroke();
    }
  } else {
    const acts=buttons().filter(b=>!b.small);
    for(const b of acts) drawHandHint(b.x+8,b.y-b.r-base*0.02,base*0.05);
  }
}

/* ---------- メインループ ---------- */
let last=performance.now();
function frame(t){
  const dt=Math.min(0.05,(t-last)/1000); last=t;
  Quality.frame(dt);
  update(dt); draw();
  if(Post.enabled) Post.render(scene);
  requestAnimationFrame(frame);
}
Post.init(display);
resize();
window.addEventListener('resize',resize);
genWorld();
requestAnimationFrame(frame);

/* ---------- テスト用フック ---------- */
window.__game={
  get phase(){return phase;}, get cureStep(){return cureStep;},
  get foundCount(){return foundCount;}, get defects(){return defects;},
  get robotT(){return robot.t;}, get linerT(){return linerT;},
  get inflFront(){return inflFront;}, get trainT(){return trainT;},
  get waterT(){return waterT;}, get postEnabled(){return Post.enabled;},
  get qualityTier(){return Quality.tier;},
  buttons, worldToScreen, pathPoint,
};

/* ---------- PWA ---------- */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
