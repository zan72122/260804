/* くるっ、キュッ、ポン！ヴァイオリン工房
   4歳向けヴァイオリン製作ゲーム — Canvas 2D + Web Audio
   iPhone/iPad Safari 縦横対応・一指操作・採点なし */
'use strict';

/* ================= canvas ================= */
const cv = document.getElementById('c');
const cx2 = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
window.addEventListener('resize', () => { resize(); });
window.addEventListener('orientationchange', () => { setTimeout(resize, 60); });
resize();
document.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive:false });
document.addEventListener('gesturestart', e => e.preventDefault());

/* ================= utils ================= */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const easeOut=t=>1-Math.pow(1-t,3);
const easeInOut=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const TAU=Math.PI*2;
function mulberry(seed){let s=seed>>>0;return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function cubic(p0,c1,c2,p1,t){const u=1-t;return{
  x:u*u*u*p0.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*p1.x,
  y:u*u*u*p0.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*p1.y};}
function sampleCubics(segs,perSeg){const out=[];for(const s of segs){for(let i=0;i<perSeg;i++){out.push(cubic(s[0],s[1],s[2],s[3],i/perSeg));}}out.push(segs[segs.length-1][3]);return out;}
function resample(pts,n){ // even spacing
  const d=[0];for(let i=1;i<pts.length;i++)d.push(d[i-1]+dist(pts[i-1],pts[i]));
  const total=d[d.length-1],out=[];let j=0;
  for(let i=0;i<n;i++){const target=total*i/(n-1);while(j<d.length-2&&d[j+1]<target)j++;
    const t=(target-d[j])/Math.max(1e-6,d[j+1]-d[j]);
    out.push({x:lerp(pts[j].x,pts[j+1].x,t),y:lerp(pts[j].y,pts[j+1].y,t)});}
  return out;}

/* ================= audio ================= */
const AudioSys = (()=>{
  let ac=null, master=null, sizzleNode=null, sizzleGain=null;
  function ctx(){ if(!ac){ const A=window.AudioContext||window.webkitAudioContext; if(!A) return null;
    ac=new A(); master=ac.createGain(); master.gain.value=0.85;
    const comp=ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);}
    if(ac.state==='suspended') ac.resume();
    return ac; }
  function noiseBuf(a){const len=a.sampleRate*1;const b=a.createBuffer(1,len,a.sampleRate);const ch=b.getChannelData(0);for(let i=0;i<len;i++)ch[i]=Math.random()*2-1;return b;}
  let nb=null;
  function env(g,t0,a,peak,d){g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);}
  function tone(freq,dur,type,peak,slideTo){const a=ctx();if(!a)return;const o=a.createOscillator(),g=a.createGain();
    o.type=type||'sine';o.frequency.value=freq;if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,a.currentTime+dur);
    env(g,a.currentTime,0.008,peak||0.2,dur);o.connect(g);g.connect(master);o.start();o.stop(a.currentTime+dur+0.1);}
  function noise(dur,fc,q,peak){const a=ctx();if(!a)return;nb=nb||noiseBuf(a);
    const s=a.createBufferSource();s.buffer=nb;s.loop=true;
    const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=fc;f.Q.value=q||1;
    const g=a.createGain();env(g,a.currentTime,0.01,peak||0.15,dur);
    s.connect(f);f.connect(g);g.connect(master);s.start();s.stop(a.currentTime+dur+0.1);}
  return {
    unlock(){ctx();},
    knock(){noise(0.08,300,1,0.3);tone(130,0.15,'sine',0.25,90);},
    tap(){tone(520,0.07,'triangle',0.12);},
    whoosh(){noise(0.12,900,1.2,0.08);},
    carve(){noise(0.09,1400,2,0.06);},
    pop(){tone(560,0.12,'sine',0.3,200);noise(0.03,2500,1,0.1);},
    snap(){tone(780,0.09,'sine',0.28,320);noise(0.03,3200,1,0.12);},
    chime(){const a=ctx();if(!a)return;[660,880,1320].forEach((f,i)=>{setTimeout(()=>tone(f,0.6,'triangle',0.16),i*90);});},
    grand(){const a=ctx();if(!a)return;[523,659,784,1046,1318].forEach((f,i)=>{setTimeout(()=>tone(f,1.0,'triangle',0.15),i*120);});},
    sizzleSet(level){const a=ctx();if(!a)return;
      if(!sizzleNode){nb=nb||noiseBuf(a);sizzleNode=a.createBufferSource();sizzleNode.buffer=nb;sizzleNode.loop=true;
        const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=4200;f.Q.value=0.8;
        sizzleGain=a.createGain();sizzleGain.gain.value=0;
        sizzleNode.connect(f);f.connect(sizzleGain);sizzleGain.connect(master);sizzleNode.start();}
      sizzleGain.gain.setTargetAtTime(clamp(level,0,0.22),a.currentTime,0.06);},
    pluck(freq,peak){const a=ctx();if(!a)return;
      const o=a.createOscillator(),o2=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();
      o.type='triangle';o2.type='sine';o.frequency.value=freq;o2.frequency.value=freq*2.01;
      f.type='lowpass';f.frequency.value=Math.min(6000,freq*6);
      env(g,a.currentTime,0.005,peak||0.22,0.55);
      o.connect(f);o2.connect(f);f.connect(g);g.connect(master);
      o.start();o2.start();o.stop(a.currentTime+0.8);o2.stop(a.currentTime+0.8);},
    bow(freq,dur,when,peak){const a=ctx();if(!a)return;const t0=a.currentTime+(when||0);
      const g=a.createGain();
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.linearRampToValueAtTime(peak||0.13,t0+0.22);
      g.gain.setValueAtTime(peak||0.13,t0+dur-0.35);
      g.gain.linearRampToValueAtTime(0.0001,t0+dur);
      const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=2100;f.Q.value=0.7;
      f.connect(g);g.connect(master);
      const lfo=a.createOscillator(),lg=a.createGain();lfo.frequency.value=5.3;lg.gain.value=freq*0.006;
      lfo.connect(lg);lfo.start(t0);lfo.stop(t0+dur);
      [-3,3].forEach(cents=>{const o=a.createOscillator();o.type='sawtooth';
        o.frequency.value=freq*Math.pow(2,cents/1200);lg.connect(o.frequency);
        o.connect(f);o.start(t0);o.stop(t0+dur);});}
  };
})();

/* ================= wood textures ================= */
function makeSpruce(seed){
  const c=document.createElement('canvas');c.width=512;c.height=1024;const g=c.getContext('2d');
  const rnd=mulberry(seed);
  const grad=g.createLinearGradient(0,0,512,0);
  grad.addColorStop(0,'#efd7a6');grad.addColorStop(0.5,'#f2dcae');grad.addColorStop(1,'#ecd29e');
  g.fillStyle=grad;g.fillRect(0,0,512,1024);
  let x=6;
  while(x<512){
    const wdt=1+rnd()*1.8, sp=6+rnd()*13, wob=rnd()*6, ph=rnd()*TAU;
    g.strokeStyle='rgba(160,120,60,'+(0.18+rnd()*0.22)+')';
    g.lineWidth=wdt;g.beginPath();
    for(let y=0;y<=1024;y+=16){const xx=x+Math.sin(y*0.004+ph)*wob;y===0?g.moveTo(xx,y):g.lineTo(xx,y);}
    g.stroke();x+=sp;
  }
  g.fillStyle='rgba(255,240,200,0.10)';g.fillRect(0,0,512,1024);
  return c;
}
function makeMaple(seed){
  const c=document.createElement('canvas');c.width=512;c.height=1024;const g=c.getContext('2d');
  const rnd=mulberry(seed);
  const grad=g.createLinearGradient(0,0,512,0);
  grad.addColorStop(0,'#e2b877');grad.addColorStop(0.5,'#eac388');grad.addColorStop(1,'#dfb271');
  g.fillStyle=grad;g.fillRect(0,0,512,1024);
  // 虎杢 flame: horizontal shimmer bands
  const freq=0.055+rnd()*0.015, ph=rnd()*TAU;
  for(let y=0;y<1024;y++){
    const s=Math.sin(y*freq+ph+Math.sin(y*0.011)*1.4);
    const a=Math.pow(Math.abs(s),1.6)*0.30;
    g.fillStyle=s>0?'rgba(255,235,190,'+a+')':'rgba(140,90,40,'+(a*0.85)+')';
    g.fillRect(0,y,512,1);
  }
  // faint vertical grain
  for(let i=0;i<26;i++){const x=rnd()*512;
    g.strokeStyle='rgba(150,100,50,0.07)';g.lineWidth=1+rnd()*2;
    g.beginPath();g.moveTo(x,0);g.lineTo(x+(rnd()*30-15),1024);g.stroke();}
  return c;
}
function makeEbony(){
  const c=document.createElement('canvas');c.width=128;c.height=512;const g=c.getContext('2d');
  const grad=g.createLinearGradient(0,0,128,0);
  grad.addColorStop(0,'#17120f');grad.addColorStop(0.5,'#241c16');grad.addColorStop(1,'#150f0c');
  g.fillStyle=grad;g.fillRect(0,0,128,512);
  return c;
}

/* ================= violin geometry ================= */
/* half outline, units: y 0..1 (body length), x = half width */
const SEGS=[
  [{x:0.00,y:0.000},{x:0.125,y:-0.008},{x:0.238,y:0.045},{x:0.236,y:0.160}],
  [{x:0.236,y:0.160},{x:0.234,y:0.250},{x:0.222,y:0.315},{x:0.207,y:0.348}],
  [{x:0.207,y:0.348},{x:0.148,y:0.368},{x:0.143,y:0.412},{x:0.147,y:0.470}],
  [{x:0.147,y:0.470},{x:0.151,y:0.526},{x:0.164,y:0.560},{x:0.220,y:0.585}],
  [{x:0.220,y:0.585},{x:0.238,y:0.628},{x:0.291,y:0.680},{x:0.293,y:0.795}],
  [{x:0.293,y:0.795},{x:0.295,y:0.925},{x:0.170,y:1.006},{x:0.000,y:1.000}],
];
function bodyPath(g,BL){
  g.beginPath();
  const segs=SEGS;
  g.moveTo(0,0);
  for(const s of segs) g.bezierCurveTo(s[1].x*BL,s[1].y*BL,s[2].x*BL,s[2].y*BL,s[3].x*BL,s[3].y*BL);
  for(let i=segs.length-1;i>=0;i--){const s=segs[i];
    g.bezierCurveTo(-s[2].x*BL,s[2].y*BL,-s[1].x*BL,s[1].y*BL,-s[0].x*BL,s[0].y*BL);}
  g.closePath();
}
function outlineLoopPts(BL,n){
  const right=sampleCubics(SEGS,14).map(p=>({x:p.x*BL,y:p.y*BL}));
  const left=right.slice(0,right.length-1).reverse().map(p=>({x:-p.x,y:p.y}));
  return resample(right.concat(left),n||160);
}
/* C-bout curve (right side waist) for rib bending: segs 2..3 */
function cBoutPts(scale,n){
  const pts=sampleCubics([SEGS[2],SEGS[3]],20).map(p=>({x:p.x*scale,y:(p.y-0.47)*scale}));
  return resample(pts,n||60);
}
/* f-hole spine, side=1 right / -1 left; local coords of body (0..BL) */
function fSpine(BL,side,n){
  const s=side;
  const segs=[[{x:0.058*s,y:0.392},{x:0.128*s,y:0.445},{x:0.040*s,y:0.575},{x:0.108*s,y:0.648}]];
  return resample(sampleCubics(segs,30).map(p=>({x:p.x*BL,y:p.y*BL})),n||40);
}
function drawFHole(g,BL,side,prog){ // prog 0..1
  const pts=fSpine(BL,side,40);
  const upTo=Math.max(2,Math.floor(pts.length*clamp(prog,0,1)));
  g.save();
  g.strokeStyle='#150e08';g.fillStyle='#150e08';
  g.lineCap='round';g.lineJoin='round';g.lineWidth=BL*0.020;
  g.beginPath();g.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<upTo;i++)g.lineTo(pts[i].x,pts[i].y);
  g.stroke();
  if(prog>0.05){g.beginPath();g.arc(pts[0].x,pts[0].y,BL*0.026,0,TAU);g.fill();}
  if(prog>=0.98){const e=pts[pts.length-1];g.beginPath();g.arc(e.x,e.y,BL*0.030,0,TAU);g.fill();
    // nicks
    const m=pts[Math.floor(pts.length*0.5)];
    g.lineWidth=BL*0.012;
    g.beginPath();g.moveTo(m.x-BL*0.020*side,m.y-BL*0.004);g.lineTo(m.x-BL*0.036*side,m.y-BL*0.004);g.stroke();
    g.beginPath();g.moveTo(m.x+BL*0.016*side,m.y+BL*0.012);g.lineTo(m.x+BL*0.030*side,m.y+BL*0.012);g.stroke();}
  g.restore();
}
/* varnish colors */
const VARNISH={
  amber:{mul:'rgba(206,138,32,0.62)',glow:'rgba(255,214,120,0.40)',name:'amber'},
  red:  {mul:'rgba(152,52,22,0.60)', glow:'rgba(255,150,90,0.34)', name:'red'},
  rose: {mul:'rgba(200,80,96,0.44)',glow:'rgba(255,170,190,0.36)',name:'rose'},
};

/* draw a plate (top or back). tex canvas fills body. */
function drawPlate(g,BL,tex,opts){
  opts=opts||{};
  g.save();
  bodyPath(g,BL);
  g.save();g.clip();
  const w=BL*0.65;
  g.drawImage(tex,-w/2,-BL*0.03,w,BL*1.08);
  // arching: soft center highlight + edge shading
  let rg=g.createRadialGradient(0,BL*0.5,BL*0.05,0,BL*0.5,BL*0.55);
  rg.addColorStop(0,'rgba(255,250,230,0.20)');rg.addColorStop(0.7,'rgba(255,250,230,0)');
  rg.addColorStop(1,'rgba(80,50,20,0.28)');
  g.fillStyle=rg;g.fillRect(-w/2,-BL*0.05,w,BL*1.12);
  if(opts.varnish){
    const v=VARNISH[opts.varnish];
    g.globalCompositeOperation='multiply';
    g.fillStyle=v.mul;g.fillRect(-w/2,-BL*0.05,w,BL*1.12);
    // depth: edges soak darker, center stays luminous
    let vg=g.createRadialGradient(0,BL*0.5,BL*0.10,0,BL*0.5,BL*0.56);
    vg.addColorStop(0,'rgba(255,255,255,0)');
    vg.addColorStop(1,v.mul.replace(/[\d.]+\)$/,'0.5)'));
    g.fillStyle=vg;g.fillRect(-w/2,-BL*0.05,w,BL*1.12);
    g.globalCompositeOperation='screen';
    const gl=g.createLinearGradient(-w/2,0,w/2,BL);
    gl.addColorStop(0,'rgba(255,240,200,0)');
    gl.addColorStop(clamp(opts.gloss!=null?opts.gloss:0.45,0.02,0.98),v.glow);
    gl.addColorStop(1,'rgba(255,240,200,0)');
    g.fillStyle=gl;g.fillRect(-w/2,-BL*0.05,w,BL*1.12);
    g.globalCompositeOperation='source-over';
  }
  if(opts.alpha!=null){g.globalAlpha=1;}
  g.restore();
  // purfling + edge
  g.strokeStyle='rgba(40,24,12,0.85)';g.lineWidth=Math.max(1.2,BL*0.006);
  bodyPath(g,BL*0.965);g.save();g.translate(0,BL*0.017);g.stroke();g.restore();
  g.strokeStyle='rgba(60,35,15,0.9)';g.lineWidth=Math.max(1.5,BL*0.008);
  bodyPath(g,BL);g.stroke();
  g.restore();
}
/* rib garland: outline extruded */
function drawRibs(g,BL,tex,alpha){
  g.save();g.globalAlpha=alpha==null?1:alpha;
  g.strokeStyle='#c89858';g.lineWidth=BL*0.05;g.lineJoin='round';
  bodyPath(g,BL);g.stroke();
  g.strokeStyle='rgba(90,55,20,0.5)';g.lineWidth=BL*0.05;
  g.save();g.translate(0,BL*0.012);bodyPath(g,BL);g.stroke();g.restore();
  g.restore();
}

/* full violin front view. state: {varnish, fholes(bool), bridge, strings[0..4], fingerboard, tailpiece, gloss} */
function drawViolinFront(g,BL,st){
  st=st||{};
  // neck+scroll behind body
  if(st.neck!==false) drawNeck(g,BL,st);
  drawPlate(g,BL,st.tex||TEX.spruce,{varnish:st.varnish,gloss:st.gloss});
  if(st.fholes){drawFHole(g,BL,1,1);drawFHole(g,BL,-1,1);}
  if(st.fingerboard!==false&&st.neck!==false) drawFingerboard(g,BL);
  if(st.tailpiece!==false) drawTailpiece(g,BL);
  if(st.bridge) drawBridge(g,BL,1);
  if(st.strings) drawStrings(g,BL,st.strings,st.stringT||[1,1,1,1]);
}
function drawNeck(g,BL,st){
  g.save();
  const nw=BL*0.040;
  g.fillStyle='#caa05e';
  g.beginPath();
  g.moveTo(-nw,0.02*BL);g.lineTo(-nw*0.8,-0.42*BL);g.lineTo(nw*0.8,-0.42*BL);g.lineTo(nw,0.02*BL);g.closePath();g.fill();
  // pegbox + scroll
  g.translate(0,-0.44*BL);
  g.fillStyle='#c59a56';
  g.beginPath();g.moveTo(-nw*0.9,0);g.lineTo(-nw*0.75,-0.11*BL);g.lineTo(nw*0.75,-0.11*BL);g.lineTo(nw*0.9,0);g.closePath();g.fill();
  // scroll spiral
  g.strokeStyle='#8a6432';g.lineWidth=BL*0.020;g.lineCap='round';
  g.beginPath();g.arc(0,-0.135*BL,BL*0.030,Math.PI*0.5,Math.PI*2.2);g.stroke();
  g.beginPath();g.arc(0,-0.138*BL,BL*0.014,Math.PI*0.7,Math.PI*2.6);g.stroke();
  // pegs
  g.fillStyle='#241c16';
  PEG_OFFS.forEach(p=>{g.beginPath();g.arc(p.x*BL,p.y*BL,BL*0.020,0,TAU);g.fill();
    g.fillRect(p.x*BL-BL*0.008,p.y*BL-BL*0.030,BL*0.016,BL*0.026);});
  g.restore();
}
const PEG_OFFS=[{x:-0.075,y:-0.020},{x:-0.075,y:-0.070},{x:0.075,y:-0.040},{x:0.075,y:-0.090}]; // G D A E rel pegbox top(-0.44BL)
function pegPos(BL,i){const p=PEG_OFFS[i];return{x:p.x*BL,y:(p.y-0.44)*BL};}
function drawFingerboard(g,BL){
  g.save();
  g.fillStyle='#1d1712';
  g.beginPath();
  g.moveTo(-BL*0.030,-0.44*BL);g.lineTo(BL*0.030,-0.44*BL);
  g.lineTo(BL*0.048,0.30*BL);g.lineTo(-BL*0.048,0.30*BL);g.closePath();g.fill();
  const sh=g.createLinearGradient(-BL*0.05,0,BL*0.05,0);
  sh.addColorStop(0,'rgba(255,255,255,0.12)');sh.addColorStop(0.5,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(0,0,0,0.30)');
  g.fillStyle=sh;g.beginPath();
  g.moveTo(-BL*0.030,-0.44*BL);g.lineTo(BL*0.030,-0.44*BL);
  g.lineTo(BL*0.048,0.30*BL);g.lineTo(-BL*0.048,0.30*BL);g.closePath();g.fill();
  g.restore();
}
function drawTailpiece(g,BL){
  g.save();
  g.fillStyle='#241c16';
  g.beginPath();
  g.moveTo(-BL*0.024,0.955*BL);g.lineTo(BL*0.024,0.955*BL);
  g.lineTo(BL*0.046,0.775*BL);g.lineTo(-BL*0.046,0.775*BL);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,0.08)';
  g.beginPath();
  g.moveTo(-BL*0.020,0.94*BL);g.lineTo(BL*0.004,0.94*BL);
  g.lineTo(BL*0.018,0.79*BL);g.lineTo(-BL*0.032,0.79*BL);g.closePath();g.fill();
  g.restore();
}
function drawBridge(g,BL,alpha){
  g.save();g.globalAlpha=alpha;
  g.fillStyle='#e8d3a8';g.strokeStyle='#9a7c48';g.lineWidth=Math.max(1,BL*0.004);
  const y=0.545*BL,w=BL*0.115,h=BL*0.062;
  g.beginPath();
  g.moveTo(-w,y);g.lineTo(-w*0.85,y-h*0.55);g.lineTo(-w*0.45,y-h*0.72);
  g.lineTo(0,y-h);g.lineTo(w*0.45,y-h*0.72);g.lineTo(w*0.85,y-h*0.55);g.lineTo(w,y);g.closePath();
  g.fill();g.stroke();
  g.restore();
}
const STRING_X=[-0.027,-0.009,0.009,0.027]; // G D A E at bridge
function stringLane(BL,i){ // from tailpiece to peg
  const bx=STRING_X[i]*BL;
  return {
    tail:{x:bx*0.55,y:0.80*BL},
    bridge:{x:bx,y:0.49*BL},
    nut:{x:bx*0.6,y:-0.435*BL},
    peg:pegPos(BL,i)
  };
}
function drawStrings(g,BL,count,tension){
  g.save();g.lineCap='round';
  for(let i=0;i<count;i++){
    const l=stringLane(BL,i);
    const t=tension[i]!=null?tension[i]:1;
    const sag=(1-t)*BL*0.05;
    g.strokeStyle='rgba(235,240,245,'+(0.65+0.35*t)+')';
    g.lineWidth=Math.max(1.4,BL*(0.0075-i*0.001));
    g.beginPath();g.moveTo(l.tail.x,l.tail.y);
    g.quadraticCurveTo((l.tail.x+l.bridge.x)/2+sag,(l.tail.y+l.bridge.y)/2,l.bridge.x,l.bridge.y);
    g.quadraticCurveTo((l.bridge.x+l.nut.x)/2+sag,(l.bridge.y+l.nut.y)/2,l.nut.x,l.nut.y);
    g.stroke();
    // highlight
    g.strokeStyle='rgba(255,255,255,'+(0.25*t)+')';
    g.lineWidth=Math.max(0.5,BL*0.002);
    g.beginPath();g.moveTo(l.bridge.x,l.bridge.y);g.lineTo(l.nut.x,l.nut.y);g.stroke();
  }
  g.restore();
}

/* ================= particles & words ================= */
const parts=[];
function puff(x,y,color,n,spread,up){
  for(let i=0;i<(n||6);i++){
    parts.push({x,y,vx:(Math.random()-0.5)*(spread||40),vy:-(up||30)*(0.4+Math.random()),
      r:3+Math.random()*5,life:0.9+Math.random()*0.5,t:0,color:color||'rgba(255,255,255,0.5)',grav:up?-6:60});
  }
}
function shaving(x,y){
  parts.push({x,y,vx:(Math.random()-0.5)*80,vy:-40-Math.random()*60,r:2+Math.random()*3,
    life:0.8,t:0,color:'#e8cf9f',grav:300,shape:'curl'});
}
function sparkle(x,y,n){
  for(let i=0;i<(n||10);i++){const a=Math.random()*TAU,sp=30+Math.random()*90;
    parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:2+Math.random()*3,
      life:0.7+Math.random()*0.6,t:0,color:'#ffe9a0',grav:0,shape:'star'});}
}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.t+=dt;
    if(p.t>p.life){parts.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.grav||0)*dt;}
}
function drawParts(g){
  for(const p of parts){const a=1-p.t/p.life;g.save();g.globalAlpha=a;
    if(p.shape==='star'){g.fillStyle=p.color;g.translate(p.x,p.y);g.rotate(p.t*4);
      g.beginPath();for(let k=0;k<4;k++){g.rotate(Math.PI/2);g.moveTo(0,0);g.lineTo(0,-p.r*2.2);}
      g.strokeStyle=p.color;g.lineWidth=1.6;g.stroke();}
    else if(p.shape==='curl'){g.strokeStyle=p.color;g.lineWidth=2;
      g.beginPath();g.arc(p.x,p.y,p.r*2,p.t*6,p.t*6+2.4);g.stroke();}
    else{g.fillStyle=p.color;g.beginPath();g.arc(p.x,p.y,p.r*(0.6+a*0.6),0,TAU);g.fill();}
    g.restore();}
}
const words=[];
function say(text,x,y,size,color){words.push({text,x,y,size:size||34,color:color||'#fff',t:0,life:1.4});}
function updateWords(dt){for(let i=words.length-1;i>=0;i--){words[i].t+=dt;if(words[i].t>words[i].life)words.splice(i,1);}}
function drawWords(g){
  for(const w of words){const k=w.t/w.life,a=k<0.15?k/0.15:1-Math.max(0,(k-0.6)/0.4);
    g.save();g.globalAlpha=clamp(a,0,1);
    g.font='700 '+Math.round(w.size*(1+easeOut(Math.min(1,k*3))*0.25))+'px -apple-system,"Hiragino Maru Gothic ProN",sans-serif';
    g.textAlign='center';g.textBaseline='middle';
    g.lineWidth=w.size*0.22;g.strokeStyle='rgba(60,35,12,0.85)';g.lineJoin='round';
    g.strokeText(w.text,w.x,w.y-k*30);
    g.fillStyle=w.color;g.fillText(w.text,w.x,w.y-k*30);
    g.restore();}
}

/* ================= hint system ================= */
const Hint={mode:null,pts:null,t:0,idleT:0,
  path(pts){this.mode='path';this.pts=pts;this.t=0;},
  drag(a,b){this.mode='path';this.pts=[a,{x:lerp(a.x,b.x,0.5),y:lerp(a.y,b.y,0.5)},b];this.t=0;},
  circle(c,r){this.mode='circle';this.pts=[c];this.r=r;this.t=0;},
  tap(p){this.mode='tap';this.pts=[p];this.t=0;},
  none(){this.mode=null;},
  update(dt){this.t+=dt;},
  draw(g){
    if(!this.mode||!this.pts)return;
    const cyc=2.2,k=(this.t%cyc)/cyc;
    let p,target;
    if(this.mode==='path'){
      target=this.pts[this.pts.length-1];
      const n=this.pts.length-1,f=easeInOut(clamp(k*1.35,0,1))*n,i=Math.min(n-1,Math.floor(f)),ft=f-i;
      p={x:lerp(this.pts[i].x,this.pts[Math.min(n,i+1)].x,ft),y:lerp(this.pts[i].y,this.pts[Math.min(n,i+1)].y,ft)};
      // path preview
      g.save();g.strokeStyle='rgba(255,255,255,0.35)';g.lineWidth=10;g.lineCap='round';g.setLineDash([2,22]);
      g.beginPath();g.moveTo(this.pts[0].x,this.pts[0].y);
      for(const q of this.pts)g.lineTo(q.x,q.y);g.stroke();g.restore();
    }else if(this.mode==='circle'){
      const c=this.pts[0],a=k*TAU*1.2-Math.PI/2;
      p={x:c.x+Math.cos(a)*this.r,y:c.y+Math.sin(a)*this.r};target=c;
      g.save();g.strokeStyle='rgba(255,255,255,0.35)';g.lineWidth=8;g.setLineDash([2,20]);
      g.beginPath();g.arc(c.x,c.y,this.r,0,TAU);g.stroke();g.restore();
    }else{p=this.pts[0];target=p;}
    // pulsing glow at target
    const pulse=0.5+0.5*Math.sin(this.t*4);
    g.save();
    const rg=g.createRadialGradient(target.x,target.y,2,target.x,target.y,34+pulse*14);
    rg.addColorStop(0,'rgba(255,244,180,0.55)');rg.addColorStop(1,'rgba(255,244,180,0)');
    g.fillStyle=rg;g.beginPath();g.arc(target.x,target.y,50+pulse*14,0,TAU);g.fill();
    g.restore();
    // ghost finger
    if(this.mode==='tap'){const s=1+0.25*Math.sin(this.t*6);drawHandCursor(g,p.x,p.y+18*(1-s),s);}
    else drawHandCursor(g,p.x,p.y,1);
  }
};
function drawHandCursor(g,x,y,s){
  g.save();g.translate(x,y);g.scale(s,s);g.globalAlpha=0.9;
  g.fillStyle='#ffd9b8';g.strokeStyle='rgba(120,70,40,0.7)';g.lineWidth=2;
  g.beginPath();g.ellipse(4,20,13,15,0.3,0,TAU);g.fill();g.stroke();
  g.beginPath();g.ellipse(0,2,6.5,12,0,0,TAU);g.fill();g.stroke();
  g.restore();
}

/* ================= luthier character ================= */
function drawLuthier(g,x,y,s,opt){
  opt=opt||{};
  g.save();g.translate(x,y);g.scale(s,s);
  // body/apron
  g.fillStyle='#8c5a3c';g.beginPath();g.ellipse(0,95,58,70,0,Math.PI,0);g.fill();
  g.fillStyle='#4e6e58';g.beginPath();g.ellipse(0,100,44,60,0,Math.PI,0);g.fill();
  g.strokeStyle='#3c5644';g.lineWidth=5;g.beginPath();g.moveTo(-28,52);g.lineTo(-16,80);g.moveTo(28,52);g.lineTo(16,80);g.stroke();
  // head
  g.fillStyle='#f2c49a';g.beginPath();g.arc(0,0,42,0,TAU);g.fill();
  // hair bun (gray)
  g.fillStyle='#cfc6ba';g.beginPath();g.arc(0,-30,30,Math.PI,0);g.fill();
  g.beginPath();g.arc(30,-28,12,0,TAU);g.fill();
  // ears
  g.fillStyle='#f2c49a';g.beginPath();g.arc(-40,4,8,0,TAU);g.arc(40,4,8,0,TAU);g.fill();
  // glasses + eyes (視線)
  const lx=clamp((opt.lookX||0),-1,1)*4,ly=clamp((opt.lookY||0.4),-1,1)*3;
  g.strokeStyle='#7a5a3a';g.lineWidth=3;
  g.beginPath();g.arc(-15,0,11,0,TAU);g.stroke();g.beginPath();g.arc(15,0,11,0,TAU);g.stroke();
  g.beginPath();g.moveTo(-4,0);g.lineTo(4,0);g.stroke();
  g.fillStyle='#3a2a1c';
  g.beginPath();g.arc(-15+lx,ly,4.5,0,TAU);g.fill();g.beginPath();g.arc(15+lx,ly,4.5,0,TAU);g.fill();
  // rosy cheeks + smile
  g.fillStyle='rgba(240,150,130,0.5)';g.beginPath();g.arc(-26,14,7,0,TAU);g.arc(26,14,7,0,TAU);g.fill();
  g.strokeStyle='#a06040';g.lineWidth=3;g.lineCap='round';
  g.beginPath();g.arc(0,14,12,0.25*Math.PI,0.75*Math.PI);g.stroke();
  // mustache
  g.strokeStyle='#cfc6ba';g.lineWidth=5;
  g.beginPath();g.arc(-8,10,8,Math.PI*1.1,Math.PI*1.9);g.stroke();
  g.beginPath();g.arc(8,10,8,Math.PI*1.1,Math.PI*1.9);g.stroke();
  g.restore();
}
/* adult hand holding a tool at point p; ang = tool angle. tool tip = p */
function drawToolHand(g,p,ang,tool,s){
  s=(s||1)*1.35;
  g.save();g.translate(p.x,p.y);g.rotate(ang||0);g.scale(s,s);
  // sleeve first (behind)
  g.fillStyle='#4e6e58';g.beginPath();g.ellipse(10,-74,16,15,0.3,0,TAU);g.fill();
  if(tool==='knife'){
    g.fillStyle='#dde3e8';g.strokeStyle='#9aa2ab';g.lineWidth=1.5;
    g.beginPath();g.moveTo(0,2);g.lineTo(10,-30);g.lineTo(-2,-30);g.closePath();g.fill();g.stroke();
    g.fillStyle='#6e4a26';g.beginPath();
    g.roundRect?g.roundRect(-6,-58,13,30,5):g.fillRect(-6,-58,13,30);g.fill();
  }else if(tool==='gouge'){
    g.fillStyle='#ccd2d8';g.strokeStyle='#98a0a8';g.lineWidth=1.5;
    g.beginPath();g.moveTo(0,3);g.quadraticCurveTo(10,-12,5,-34);g.lineTo(-5,-34);g.quadraticCurveTo(-7,-14,0,3);g.fill();g.stroke();
    g.fillStyle='#6e4a26';g.beginPath();g.ellipse(0,-48,10,20,0,0,TAU);g.fill();
  }else if(tool==='brush'){
    g.fillStyle='#5a4630';g.beginPath();g.moveTo(-8,-20);g.quadraticCurveTo(0,6,8,-20);g.closePath();g.fill();
    g.fillStyle='#98a4b0';g.fillRect(-8,-30,16,10);
    g.fillStyle='#caa268';g.beginPath();
    g.roundRect?g.roundRect(-4.5,-64,9,36,4):g.fillRect(-4.5,-64,9,36);g.fill();
  }
  // hand
  g.fillStyle='#f2c49a';g.strokeStyle='rgba(120,70,40,0.6)';g.lineWidth=2;
  g.beginPath();g.ellipse(1,-46,13,16,0.25,0,TAU);g.fill();g.stroke();
  g.beginPath();g.ellipse(-6,-38,5,8,0.5,0,TAU);g.fill();
  g.restore();
}

/* ================= trace engine ================= */
function makeTrace(pts,radius){
  return {pts,i:0,radius,done:false,
    prog(){return this.i/(this.pts.length-1);},
    cur(){return this.pts[Math.min(this.i,this.pts.length-1)];},
    feed(p){
      if(this.done)return 0;
      const look=Math.min(this.pts.length-1,this.i+16);
      let best=-1,bd=this.radius;
      for(let j=this.i;j<=look;j++){const d=dist(p,this.pts[j]);if(d<bd){bd=d;best=j;}}
      let adv=0;
      if(best>this.i){adv=best-this.i;this.i=best;}
      if(this.i>=this.pts.length-1)this.done=true;
      return adv;
    }};
}

/* ================= game state ================= */
const G={
  seed:12345,
  varnish:'amber',
  ribbon:0,     // 0 none 1 pink 2 rainbow
  deco:0,       // 0 none 1 flowers 2 stars
  builds:0,
};
let TEX={};
function rebuildTex(){
  TEX.spruce=makeSpruce(G.seed);
  TEX.maple=makeMaple(G.seed+7);
  TEX.ebony=makeEbony();
}
rebuildTex();

/* layout */
function layout(){
  const portrait=H>=W;
  return {
    portrait,
    cx: portrait? W*0.5 : W*0.60,
    cy: H*0.52,
    S: Math.min(W,H),
    benchY: H*0.80,
  };
}

/* background workshop */
function drawBG(g,L,warm){
  const w=W,h=H;
  const grd=g.createLinearGradient(0,0,0,h);
  grd.addColorStop(0,warm?'#6e4f33':'#5b4128');
  grd.addColorStop(0.6,warm?'#8a6743':'#6e5133');
  grd.addColorStop(1,'#4a3520');
  g.fillStyle=grd;g.fillRect(0,0,w,h);
  // window glow
  const rg=g.createRadialGradient(w*0.75,h*0.12,10,w*0.75,h*0.12,Math.max(w,h)*0.55);
  rg.addColorStop(0,'rgba(255,230,170,'+(warm?0.30:0.18)+')');rg.addColorStop(1,'rgba(255,230,170,0)');
  g.fillStyle=rg;g.fillRect(0,0,w,h);
  // bench
  g.fillStyle='#7a5936';g.fillRect(0,L.benchY,w,h-L.benchY);
  g.fillStyle='rgba(0,0,0,0.15)';g.fillRect(0,L.benchY,w,8);
  for(let x=0;x<w;x+=90){g.strokeStyle='rgba(60,40,20,0.25)';g.lineWidth=3;
    g.beginPath();g.moveTo(x,L.benchY+6);g.lineTo(x+20,h);g.stroke();}
  if(!L.portrait){
    // shelf props on left/top
    g.fillStyle='#5f4527';g.fillRect(w*0.02,h*0.06,w*0.20,h*0.02);
    for(let i=0;i<3;i++){g.fillStyle=['#b8862e','#8f4e22','#c56070'][i];
      g.beginPath();g.roundRect?g.roundRect(w*0.035+i*w*0.06,h*0.06-h*0.055,w*0.035,h*0.05,6):g.fillRect(w*0.035+i*w*0.06,h*0.06-h*0.055,w*0.035,h*0.05);g.fill();}
    // hanging violin silhouette
    g.save();g.translate(w*0.30,h*0.10);g.scale(0.35,0.35);g.fillStyle='rgba(40,25,12,0.55)';
    bodyPath(g,120);g.fill();g.restore();
  }
}

/* step dots */
const STEP_COUNT=11;
function drawStepDots(g,idx){
  const n=STEP_COUNT,r=5,gap=18;
  const x0=W/2-(n-1)*gap/2,y=Math.max(18,H*0.03)+8;
  for(let i=0;i<n;i++){
    g.beginPath();g.arc(x0+i*gap,y,i===idx?r+2:r,0,TAU);
    g.fillStyle=i<idx?'#ffd97a':i===idx?'#fff3c0':'rgba(255,255,255,0.25)';
    g.fill();
  }
}

/* ================= scene framework ================= */
let scenes={},sceneOrder=['title','wood','bend','mold','plate','fhole','box','post','varnish','bridge','strings','bow','gallery'];
let cur=null,curName='',fade=0,fadeDir=0,nextName=null,sceneT=0;
function go(name){nextName=name;fadeDir=1;}
function setScene(name){
  curName=name;cur=scenes[name];sceneT=0;Hint.none();
  words.length=0;parts.length=0;
  if(cur.enter)cur.enter();
}
function stepIndex(){const i=sceneOrder.indexOf(curName)-1;return clamp(i,0,STEP_COUNT-1);}

/* pointer */
let ptr={down:false,x:0,y:0,id:null};
cv.addEventListener('pointerdown',e=>{
  AudioSys.unlock();
  if(ptr.down)return;
  ptr.down=true;ptr.id=e.pointerId;ptr.x=e.clientX;ptr.y=e.clientY;
  Hint.idleT=0;
  if(cur&&cur.down)cur.down(ptr.x,ptr.y);
});
cv.addEventListener('pointermove',e=>{
  if(!ptr.down||e.pointerId!==ptr.id)return;
  ptr.x=e.clientX;ptr.y=e.clientY;
  if(cur&&cur.move)cur.move(ptr.x,ptr.y);
});
function upHandler(e){
  if(e.pointerId!==ptr.id)return;
  ptr.down=false;ptr.id=null;
  if(cur&&cur.up)cur.up(ptr.x,ptr.y);
}
cv.addEventListener('pointerup',upHandler);
cv.addEventListener('pointercancel',upHandler);

/* ================= scenes ================= */

/* ---- title ---- */
scenes.title={
  enter(){},
  update(dt){Hint.tap({x:W/2,y:H*0.72});},
  draw(g){
    const L=layout();drawBG(g,L,true);
    // big violin silhouette center with shine
    g.save();g.translate(W/2,H*0.30);
    const BL=L.S*0.34;
    g.save();g.translate(0,-BL*0.1);
    drawViolinFront(g,BL,{tex:TEX.spruce,varnish:'amber',fholes:true,bridge:true,strings:4,gloss:0.4+0.2*Math.sin(sceneT)});
    g.restore();g.restore();
    g.save();
    g.textAlign='center';g.textBaseline='middle';
    g.font='800 '+Math.round(L.S*0.055)+'px -apple-system,"Hiragino Maru Gothic ProN",sans-serif';
    g.lineJoin='round';g.lineWidth=L.S*0.016;g.strokeStyle='rgba(60,35,12,0.9)';
    const ty=H*0.62;
    g.strokeText('くるっ、キュッ、ポン！',W/2,ty);
    g.fillStyle='#ffe9b0';g.fillText('くるっ、キュッ、ポン！',W/2,ty);
    g.font='700 '+Math.round(L.S*0.043)+'px -apple-system,"Hiragino Maru Gothic ProN",sans-serif';
    g.strokeText('ヴァイオリンこうぼう',W/2,ty+L.S*0.062);
    g.fillStyle='#ffd0e0';g.fillText('ヴァイオリンこうぼう',W/2,ty+L.S*0.062);
    g.restore();
    drawLuthier(g,L.portrait?W*0.82:W*0.16,H*0.84,L.S*0.0016,{lookX:0,lookY:-0.5});
  },
  down(){AudioSys.chime();go('wood');},
  auto(){return {type:'tap',at:{x:W/2,y:H*0.72}};}
};

/* ---- wood viewing ---- */
scenes.wood={
  tappedS:false,tappedM:false,wS:0,wM:0,
  enter(){this.tappedS=false;this.tappedM=false;this.wS=0;this.wM=0;},
  boards(L){
    const bw=L.S*0.26,bh=L.S*0.55;
    if(L.portrait)return[{x:W*0.30-bw/2,y:H*0.30-bh/2,w:bw,h:bh,tex:TEX.spruce},
                         {x:W*0.70-bw/2,y:H*0.30-bh/2,w:bw,h:bh,tex:TEX.maple}];
    return[{x:L.cx-bw*1.25,y:L.cy-bh/2,w:bw,h:bh,tex:TEX.spruce},
           {x:L.cx+bw*0.25,y:L.cy-bh/2,w:bw,h:bh,tex:TEX.maple}];
  },
  update(dt){
    this.wS=Math.max(0,this.wS-dt*4);this.wM=Math.max(0,this.wM-dt*4);
    const L=layout(),b=this.boards(L);
    if(!this.tappedS)Hint.tap({x:b[0].x+b[0].w/2,y:b[0].y+b[0].h/2});
    else if(!this.tappedM)Hint.tap({x:b[1].x+b[1].w/2,y:b[1].y+b[1].h/2});
    else Hint.none();
    if(this.tappedS&&this.tappedM&&sceneT>this.doneAt+0.7)go('bend');
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const b=this.boards(L);
    const names=['スプルース','メイプル'];
    b.forEach((bd,i)=>{
      g.save();
      const wob=(i===0?this.wS:this.wM)*Math.sin(sceneT*30)*0.06;
      g.translate(bd.x+bd.w/2,bd.y+bd.h/2);g.rotate(wob);
      g.shadowColor='rgba(0,0,0,0.4)';g.shadowBlur=18;g.shadowOffsetY=10;
      g.drawImage(bd.tex,-bd.w/2,-bd.h/2,bd.w,bd.h);
      g.shadowColor='transparent';
      g.strokeStyle='rgba(80,50,20,0.8)';g.lineWidth=4;g.strokeRect(-bd.w/2,-bd.h/2,bd.w,bd.h);
      const done=i===0?this.tappedS:this.tappedM;
      if(done){g.fillStyle='rgba(255,235,150,0.15)';g.fillRect(-bd.w/2,-bd.h/2,bd.w,bd.h);}
      g.restore();
      g.save();g.textAlign='center';
      g.font='700 '+Math.round(L.S*0.032)+'px -apple-system,"Hiragino Maru Gothic ProN",sans-serif';
      g.lineWidth=6;g.strokeStyle='rgba(60,35,12,0.8)';g.lineJoin='round';
      g.strokeText(names[i],bd.x+bd.w/2,bd.y+bd.h+L.S*0.05);
      g.fillStyle='#ffeec8';g.fillText(names[i],bd.x+bd.w/2,bd.y+bd.h+L.S*0.05);
      g.restore();
    });
    drawLuthier(g,L.portrait?W*0.5:W*0.14,L.portrait?H*0.83:H*0.72,L.S*0.0016,
      {lookX:this.tappedS?0.6:-0.6,lookY:-0.4});
    drawStepDots(g,stepIndex());
  },
  down(x,y){
    const L=layout(),b=this.boards(L);
    b.forEach((bd,i)=>{
      if(x>bd.x-20&&x<bd.x+bd.w+20&&y>bd.y-20&&y<bd.y+bd.h+20){
        AudioSys.knock();
        if(i===0){this.tappedS=true;this.wS=1;say('コンコン♪',bd.x+bd.w/2,bd.y+bd.h*0.3,L.S*0.045);}
        else{this.tappedM=true;this.wM=1;say('いいおと！',bd.x+bd.w/2,bd.y+bd.h*0.3,L.S*0.045);}
        if(this.tappedS&&this.tappedM&&!this.doneAt)this.doneAt=sceneT;
      }
    });
    if(this.tappedS&&this.tappedM&&this.doneAt===undefined)this.doneAt=sceneT;
  },
  enter2(){},
  auto(){
    const L=layout(),b=this.boards(L);
    if(!this.tappedS)return{type:'tap',at:{x:b[0].x+b[0].w/2,y:b[0].y+b[0].h/2}};
    if(!this.tappedM)return{type:'tap',at:{x:b[1].x+b[1].w/2,y:b[1].y+b[1].h/2}};
    return{type:'wait'};
  }
};
scenes.wood.doneAt=undefined;

/* ---- rib bending (signature 1) ---- */
scenes.bend={
  t:0,guide:null,trace:null,doneT:0,saidJu:false,
  enter(){
    this.t=0;this.doneT=0;this.saidJu=false;
    const L=layout();
    // guide: arc tangent to the iron's left surface (wood wraps the hot iron)
    const ac=this.arcC(L),R=L.S*0.26;
    const pts=[];
    for(let i=0;i<=40;i++){const a=Math.PI-1.025+2.05*(i/40);
      pts.push({x:ac.x+Math.cos(a)*R,y:ac.y+Math.sin(a)*R});}
    this.guide=pts;
    this.trace=makeTrace(pts,L.S*0.30);
  },
  ironPos(L){return{x:L.cx+L.S*0.10,y:L.cy};},
  arcC(L){const c=this.ironPos(L);return{x:c.x+L.S*(0.26-0.062-0.017),y:c.y};},
  update(dt){
    const bend=this.trace.prog();
    if(this.t<bend)this.t=Math.min(bend,this.t+dt*1.5);
    AudioSys.sizzleSet(ptr.down&&!this.trace.done?0.10+bend*0.08:0);
    if(this.trace.done&&!this.doneT){this.doneT=sceneT;AudioSys.sizzleSet(0);AudioSys.chime();
      const L=layout();say('くるーん！',L.cx,L.cy-L.S*0.2,L.S*0.06,'#ffe9a0');}
    if(this.doneT&&sceneT>this.doneT+1.1){AudioSys.sizzleSet(0);go('mold');}
    if(!this.trace.done)Hint.path(this.guide.slice(Math.max(0,this.trace.i-2)));
    else Hint.none();
    // steam
    if(ptr.down&&!this.trace.done&&Math.random()<0.4){
      const p=this.trace.cur();puff(p.x,p.y,'rgba(255,255,255,0.35)',2,30,60);}
  },
  stripPts(L){
    // interpolate straight strip -> C curve hugging the iron's left surface
    const t=easeInOut(this.t);
    const ac=this.arcC(L),R=L.S*0.26;
    const len=L.S*0.62,n=40,out=[];
    for(let i=0;i<=n;i++){
      const u=i/n-0.5; // -0.5..0.5
      const straight={x:ac.x-R,y:ac.y+u*len};
      const a=Math.PI+u*2.05; // wrap angle
      const curved={x:ac.x+Math.cos(a)*R,y:ac.y+Math.sin(a)*R};
      const local=clamp(t*1.9-Math.abs(u)*1.8,0,1);
      out.push({x:lerp(straight.x,curved.x,local),y:lerp(straight.y,curved.y,local)});
    }
    return out;
  },
  draw(g){
    const L=layout();drawBG(g,L,true);
    const c=this.ironPos(L);
    // luthier behind iron
    drawLuthier(g,L.portrait?W*0.78:W*0.16,L.portrait?H*0.16:H*0.40,L.S*0.0015,
      {lookX:-0.6,lookY:0.5});
    // bending iron: heated cylinder on a stand
    g.save();
    g.translate(c.x,c.y);
    const ih=L.S*0.30,ir=L.S*0.062;
    // stand
    g.fillStyle='#4a3a28';g.fillRect(-ir*0.45,ih*0.5,ir*0.9,L.S*0.10);
    g.fillStyle='#3a2d1e';g.beginPath();
    g.ellipse(0,ih*0.5+L.S*0.10,ir*1.8,L.S*0.016,0,0,TAU);g.fill();
    const grd=g.createLinearGradient(-ir,0,ir,0);
    grd.addColorStop(0,'#6e4030');grd.addColorStop(0.35,'#c96a3e');grd.addColorStop(0.55,'#ef9a5e');grd.addColorStop(1,'#7e442c');
    g.fillStyle=grd;
    g.beginPath();g.roundRect?g.roundRect(-ir,-ih/2,ir*2,ih,ir):g.fillRect(-ir,-ih/2,ir*2,ih);g.fill();
    // metal cap
    g.fillStyle='#8a8f96';
    g.beginPath();g.ellipse(0,-ih/2+ir*0.4,ir*0.9,ir*0.4,0,0,TAU);g.fill();
    // heat glow
    const heat=0.5+0.3*Math.sin(sceneT*3);
    const rg=g.createRadialGradient(0,0,ir*0.3,0,0,ir*3.4);
    rg.addColorStop(0,'rgba(255,140,60,'+0.28*heat+')');rg.addColorStop(1,'rgba(255,140,60,0)');
    g.fillStyle=rg;g.beginPath();g.arc(0,0,ir*3.4,0,TAU);g.fill();
    g.restore();
    // heat shimmer lines
    for(let i=0;i<3;i++){
      const yy=c.y-L.S*0.24-i*14,ph=sceneT*3+i;
      g.strokeStyle='rgba(255,200,140,0.25)';g.lineWidth=3;g.beginPath();
      for(let k=0;k<=16;k++){const xx=c.x-24+k*3;g[k?'lineTo':'moveTo'](xx,yy+Math.sin(k*0.8+ph)*4);}
      g.stroke();
    }
    // ghost of final C shape (where the wood will go)
    if(!this.trace.done){
      const keep=this.t;this.t=1;const ghost=this.stripPts(L);this.t=keep;
      g.save();g.lineCap='round';
      g.strokeStyle='rgba(255,250,230,0.16)';g.lineWidth=L.S*0.034;
      g.beginPath();g.moveTo(ghost[0].x,ghost[0].y);for(const p of ghost)g.lineTo(p.x,p.y);g.stroke();
      g.strokeStyle='rgba(255,250,230,0.55)';g.lineWidth=3;
      g.setLineDash([L.S*0.014,L.S*0.020]);
      g.beginPath();g.moveTo(ghost[0].x,ghost[0].y);for(const p of ghost)g.lineTo(p.x,p.y);g.stroke();
      g.restore();
    }
    // the strip: thin flamed-maple ribbon
    const pts=this.stripPts(L);
    g.save();
    g.strokeStyle='#caa06a';g.lineWidth=L.S*0.034;g.lineCap='round';g.lineJoin='round';
    g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(const p of pts)g.lineTo(p.x,p.y);g.stroke();
    g.strokeStyle='#e6c68e';g.lineWidth=L.S*0.024;
    g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(const p of pts)g.lineTo(p.x,p.y);g.stroke();
    // wood grain: one darker line offset along the strip
    g.strokeStyle='rgba(150,100,45,0.5)';g.lineWidth=2.5;
    g.beginPath();
    for(let i=1;i<pts.length-1;i++){
      const a=pts[i-1],b2=pts[i+1];
      const dx=b2.x-a.x,dy=b2.y-a.y,dl=Math.hypot(dx,dy)||1;
      const nx=-dy/dl,ny=dx/dl,off=L.S*0.006;
      const px=pts[i].x+nx*off,py=pts[i].y+ny*off;
      i===1?g.moveTo(px,py):g.lineTo(px,py);
    }
    g.stroke();
    g.restore();
    // luthier's hand steadies the lowest end of the strip
    let hold=pts[0];for(const p of pts)if(p.y>hold.y)hold=p;
    g.save();
    g.fillStyle='#f2c49a';g.strokeStyle='rgba(120,70,40,0.6)';g.lineWidth=2;
    g.beginPath();g.ellipse(hold.x-4,hold.y+14,13,15,0.3,0,TAU);g.fill();g.stroke();
    g.fillStyle='#4e6e58';g.beginPath();g.ellipse(hold.x-14,hold.y+34,15,14,0.3,0,TAU);g.fill();
    g.restore();
    drawStepDots(g,stepIndex());
  },
  down(x,y){this.feedPt(x,y);},
  move(x,y){
    this.feedPt(x,y);
    if(!this.saidJu&&this.trace.i>2){this.saidJu=true;const L=layout();
      say('ジュッ……',this.trace.cur().x,this.trace.cur().y-60,L.S*0.05,'#ffd9b0');}
  },
  feedPt(x,y){this.trace.feed({x,y});},
  up(){AudioSys.sizzleSet(0);},
  auto(){
    if(this.trace&&!this.trace.done)return{type:'trace',pts:this.guide.slice(Math.max(0,this.trace.i-1))};
    return{type:'wait'};
  }
};

/* ---- mold ---- */
scenes.mold={
  rib:null,snapped:false,garland:0,doneT:0,
  enter(){
    const L=layout();
    this.snapped=false;this.garland=0;this.doneT=0;
    this.rib={x:L.portrait?W*0.75:W*0.85,y:H*0.78,held:false};
  },
  moldC(L){return{x:L.cx-L.S*0.05,y:L.cy-L.S*0.02,BL:L.S*0.5};},
  target(L){const m=this.moldC(L);return{x:m.x+0.165*m.BL,y:m.y+(0.47-0.5)*m.BL+m.BL*0.0};},
  update(dt){
    const L=layout();
    if(!this.snapped){
      Hint.drag({x:this.rib.x,y:this.rib.y},this.target(L));
      if(dist(this.rib,this.target(L))<L.S*0.11){
        this.snapped=true;AudioSys.snap();sparkle(this.target(L).x,this.target(L).y,12);
        say('キュッ！',this.target(L).x,this.target(L).y-50,L.S*0.05,'#ffe9a0');
      }
    }else{
      Hint.none();
      this.garland=Math.min(1,this.garland+dt*1.1);
      if(this.garland>=1&&!this.doneT){this.doneT=sceneT;AudioSys.chime();}
      if(this.doneT&&sceneT>this.doneT+0.9)go('plate');
    }
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const m=this.moldC(L);
    // mold: dark violin-shaped block
    g.save();g.translate(m.x,m.y-m.BL*0.5);
    g.fillStyle='#4a3925';bodyPath(g,m.BL);g.fill();
    g.strokeStyle='rgba(255,235,170,0.3)';g.lineWidth=3;bodyPath(g,m.BL);g.stroke();
    // rib garland growing from waist
    if(this.snapped){
      const pts=outlineLoopPts(m.BL,200);
      // start index near right waist(=index ~?), grow both directions
      let si=0,bd=1e9;const tw={x:0.146*m.BL,y:0.468*m.BL};
      pts.forEach((p,i)=>{const d=dist(p,tw);if(d<bd){bd=d;si=i;}});
      const n=Math.floor(this.garland*pts.length/1);
      g.strokeStyle='#cf9f5e';g.lineWidth=m.BL*0.05;g.lineCap='round';
      g.beginPath();
      for(let k=-n/2;k<=n/2;k++){
        const i=((si+Math.round(k))%pts.length+pts.length)%pts.length;
        const p=pts[i];
        k===-n/2?g.moveTo(p.x,p.y):g.lineTo(p.x,p.y);
      }
      g.stroke();
    }
    g.restore();
    // free rib (C shape)
    if(!this.snapped){
      g.save();g.translate(this.rib.x,this.rib.y);
      const cp=cBoutPts(L.S*0.5,30);
      g.strokeStyle='#e9c98c';g.lineWidth=L.S*0.026;g.lineCap='round';
      g.beginPath();g.moveTo(cp[0].x,cp[0].y);for(const p of cp)g.lineTo(p.x,p.y);g.stroke();
      g.restore();
    }
    drawLuthier(g,L.portrait?W*0.18:W*0.14,L.portrait?H*0.14:H*0.40,L.S*0.0014,
      {lookX:0.7,lookY:0.3});
    drawStepDots(g,stepIndex());
  },
  down(x,y){
    if(!this.snapped&&dist({x,y},this.rib)<layout().S*0.22){this.rib.held=true;AudioSys.tap();}
  },
  move(x,y){if(this.rib.held&&!this.snapped){this.rib.x=x;this.rib.y=y;}},
  up(){this.rib.held=false;},
  auto(){
    const L=layout();
    if(!this.snapped)return{type:'drag',from:{x:this.rib.x,y:this.rib.y},to:this.target(L)};
    return{type:'wait'};
  }
};

/* ---- plate carving (trace outline) ---- */
scenes.plate={
  trace:null,BL:0,c:null,doneT:0,backT:0,
  enter(){
    const L=layout();
    this.BL=L.S*0.52;
    this.c={x:L.cx,y:L.cy-this.BL*0.5};
    const pts=outlineLoopPts(this.BL,170).map(p=>({x:p.x+this.c.x,y:p.y+this.c.y}));
    this.trace=makeTrace(pts,L.S*0.14);
    this.doneT=0;this.backT=0;this.carveSnd=0;
  },
  update(dt){
    const L=layout();
    if(!this.trace.done){
      Hint.path(this.trace.pts.slice(this.trace.i,Math.min(this.trace.pts.length,this.trace.i+40)));
    }else{
      Hint.none();
      if(!this.doneT){this.doneT=sceneT;AudioSys.pop();
        say('おもていた！',this.c.x,this.c.y+this.BL*0.5,L.S*0.05,'#ffe9a0');}
      this.backT=Math.min(1,this.backT+dt*1.4);
      if(this.backT>=1&&!this.saidBack){this.saidBack=true;AudioSys.pop();
        say('うらいたも！',this.c.x+L.S*0.18,this.c.y+this.BL*0.35,L.S*0.045,'#ffd9b0');}
      if(this.doneT&&sceneT>this.doneT+1.6){this.saidBack=false;go('fhole');}
    }
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const bw=this.BL*0.72,bh=this.BL*1.12;
    // back plate (maple) sliding behind when done
    if(this.backT>0){
      g.save();g.translate(this.c.x+lerp(L.S*0.5,L.S*0.14,easeOut(this.backT)),this.c.y+this.BL*0.06);
      g.globalAlpha=this.backT;
      drawPlate(g,this.BL*0.98,TEX.maple,{});
      g.restore();
    }
    g.save();g.translate(this.c.x,this.c.y);
    if(!this.trace.done){
      // rough board
      g.save();
      g.shadowColor='rgba(0,0,0,0.35)';g.shadowBlur=16;g.shadowOffsetY=8;
      g.drawImage(TEX.spruce,-bw/2,-this.BL*0.06,bw,bh);
      g.shadowColor='transparent';
      g.strokeStyle='rgba(90,60,25,0.8)';g.lineWidth=4;g.strokeRect(-bw/2,-this.BL*0.06,bw,bh);
      g.restore();
      g.save();g.translate(-this.c.x,-this.c.y);
      // full outline guide (chalk line)
      g.strokeStyle='rgba(255,252,235,0.45)';g.lineWidth=9;g.lineCap='round';g.setLineDash([1,18]);
      g.beginPath();
      this.trace.pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
      g.closePath();g.stroke();g.setLineDash([]);
      // carved groove so far
      g.strokeStyle='rgba(70,40,15,0.9)';g.lineWidth=7;g.lineCap='round';
      g.beginPath();
      for(let i=0;i<=this.trace.i;i++){const p=this.trace.pts[i];i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);}
      g.stroke();
      g.restore();
    }else{
      drawPlate(g,this.BL,TEX.spruce,{});
    }
    g.restore();
    // gouge tool follows
    if(!this.trace.done){
      const p=this.trace.cur();
      drawToolHand(g,p,0.4,'gouge',1.15);
    }
    drawLuthier(g,L.portrait?W*0.15:W*0.13,L.portrait?H*0.12:H*0.35,L.S*0.0013,
      {lookX:0.5,lookY:0.6});
    drawStepDots(g,stepIndex());
  },
  down(x,y){this.feed(x,y);},
  move(x,y){this.feed(x,y);},
  feed(x,y){
    const adv=this.trace.feed({x,y});
    if(adv>0){this.carveSnd+=adv;
      if(this.carveSnd>6){this.carveSnd=0;AudioSys.carve();}
      const p=this.trace.cur();if(Math.random()<0.5)shaving(p.x,p.y);}
  },
  auto(){
    if(this.trace&&!this.trace.done)return{type:'trace',pts:this.trace.pts.slice(Math.max(0,this.trace.i-1))};
    return{type:'wait'};
  }
};

/* ---- f-holes (signature 2) ---- */
scenes.fhole={
  BL:0,c:null,traces:null,cur:0,doneT:0,
  enter(){
    const L=layout();
    this.BL=L.S*0.72; // zoomed in
    this.c={x:L.cx,y:L.cy-this.BL*0.52};
    const mk=side=>{
      const pts=fSpine(this.BL,side,60).map(p=>({x:p.x+this.c.x,y:p.y+this.c.y}));
      return makeTrace(resample(pts,60),L.S*0.13);
    };
    this.traces=[mk(-1),mk(1)];
    this.cur=0;this.doneT=0;
  },
  update(dt){
    const L=layout();
    const t=this.traces[this.cur];
    if(t&&!t.done){
      Hint.path(t.pts.slice(t.i,Math.min(t.pts.length,t.i+30)));
    }else if(this.cur===0&&this.traces[0].done){
      this.cur=1;AudioSys.chime();
      sparkle(this.traces[0].pts[this.traces[0].pts.length-1].x,this.traces[0].pts[this.traces[0].pts.length-1].y,8);
      say('スーッ……',this.c.x-this.BL*0.09,this.c.y+this.BL*0.35,L.S*0.05,'#ffd9b0');
    }
    if(this.traces[1].done&&!this.doneT){
      this.doneT=sceneT;AudioSys.chime();AudioSys.grand();
      const e=this.traces[1].pts[this.traces[1].pts.length-1];
      sparkle(e.x,e.y,14);
      say('ｆのかたち！',this.c.x,this.c.y+this.BL*0.72,L.S*0.06,'#ffe9a0');
      Hint.none();
    }
    if(this.doneT&&sceneT>this.doneT+1.8)go('box');
  },
  draw(g){
    const L=layout();drawBG(g,L);
    g.save();g.translate(this.c.x,this.c.y);
    drawPlate(g,this.BL,TEX.spruce,{});
    g.translate(-this.c.x,-this.c.y);
    g.restore();
    // guide spines (both f, thick soft lines)
    g.save();g.lineCap='round';
    this.traces.forEach((t,ti)=>{
      if(t.done)return;
      const act=ti===this.cur;
      g.strokeStyle=act?'rgba(255,252,235,0.30)':'rgba(255,252,235,0.20)';
      g.lineWidth=this.BL*0.030;
      g.beginPath();t.pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke();
      g.strokeStyle=act?'rgba(255,252,235,0.85)':'rgba(255,252,235,0.35)';
      g.lineWidth=this.BL*0.012;g.setLineDash([2,this.BL*0.022]);
      g.beginPath();t.pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke();
      g.setLineDash([]);
    });
    g.restore();
    // f-holes progressive, drawn in plate coords
    g.save();g.translate(this.c.x,this.c.y);
    drawFHole(g,this.BL,-1,this.traces[0].prog());
    drawFHole(g,this.BL,1,this.traces[1].prog());
    g.restore();
    // knife follows current
    const t=this.traces[this.cur];
    if(t&&!t.done){drawToolHand(g,t.cur(),0.3,'knife',1.1);}
    drawLuthier(g,L.portrait?W*0.15:W*0.13,L.portrait?H*0.12:H*0.35,L.S*0.0013,
      {lookX:this.cur===0?-0.4:0.4,lookY:0.7});
    drawStepDots(g,stepIndex());
  },
  down(x,y){this.feed(x,y);},
  move(x,y){this.feed(x,y);},
  feed(x,y){
    const t=this.traces[this.cur];
    if(t&&!t.done){const adv=t.feed({x,y});
      if(adv>0&&Math.random()<0.4){AudioSys.carve();shaving(t.cur().x,t.cur().y);}}
  },
  auto(){
    const t=this.traces&&this.traces[this.cur];
    if(t&&!t.done)return{type:'trace',pts:t.pts.slice(Math.max(0,t.i-1))};
    return{type:'wait'};
  }
};

/* ---- box assembly ---- */
scenes.box={
  plate:null,snapped:false,doneT:0,squeeze:0,
  enter(){
    const L=layout();
    this.snapped=false;this.doneT=0;this.squeeze=0;
    this.plate={x:L.portrait?W*0.5:L.cx+L.S*0.02,y:L.portrait?H*0.20:H*0.22,held:false};
  },
  bodyC(L){return{x:L.cx,y:L.cy+L.S*0.06,BL:L.S*0.46};},
  update(dt){
    const L=layout(),b=this.bodyC(L);
    const target={x:b.x,y:b.y-b.BL*0.5+b.BL*0.5};
    if(!this.snapped){
      Hint.drag({x:this.plate.x,y:this.plate.y},{x:b.x,y:b.y});
      if(dist(this.plate,{x:b.x,y:b.y})<L.S*0.12){
        this.snapped=true;AudioSys.pop();
        say('ポン！',b.x,b.y-b.BL*0.55,L.S*0.06,'#ffe9a0');
        sparkle(b.x,b.y-b.BL*0.2,10);
      }
    }else{
      Hint.none();
      this.squeeze=Math.min(1,this.squeeze+dt*2);
      if(this.squeeze>=1&&!this.doneT){this.doneT=sceneT;AudioSys.chime();
        say('ネックもついた！',b.x,b.y+b.BL*0.62,L.S*0.045,'#ffd9b0');}
      if(this.doneT&&sceneT>this.doneT+1.2)go('post');
    }
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const b=this.bodyC(L);
    // rib garland + back on bench
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    drawPlate(g,b.BL,TEX.maple,{});   // back
    drawRibs(g,b.BL,null,1);
    g.restore();
    if(this.snapped){
      // top closing with squeeze bounce
      const sq=1+Math.sin(this.squeeze*Math.PI)*0.06;
      g.save();g.translate(b.x,b.y-b.BL*0.5);g.scale(1,sq);
      drawPlate(g,b.BL,TEX.spruce,{});
      drawFHole(g,b.BL,-1,1);drawFHole(g,b.BL,1,1);
      g.restore();
      if(this.squeeze>0.5){
        g.save();g.translate(b.x,b.y-b.BL*0.5);
        g.globalAlpha=Math.min(1,(this.squeeze-0.5)*3);
        drawNeck(g,b.BL,{});drawFingerboard(g,b.BL);
        g.restore();
      }
    }else{
      // floating top plate
      g.save();g.translate(this.plate.x,this.plate.y);
      g.scale(0.9,0.9);
      g.shadowColor='rgba(0,0,0,0.35)';g.shadowBlur=14;g.shadowOffsetY=10;
      g.translate(0,-b.BL*0.45);
      drawPlate(g,b.BL,TEX.spruce,{});
      drawFHole(g,b.BL,-1,1);drawFHole(g,b.BL,1,1);
      g.restore();
    }
    drawLuthier(g,L.portrait?W*0.16:W*0.13,L.portrait?H*0.13:H*0.38,L.S*0.0013,
      {lookX:0.5,lookY:0.4});
    drawStepDots(g,stepIndex());
  },
  down(x,y){
    if(!this.snapped&&dist({x,y},this.plate)<layout().S*0.3){this.plate.held=true;AudioSys.tap();}
  },
  move(x,y){if(this.plate.held&&!this.snapped){this.plate.x=x;this.plate.y=y;}},
  up(){this.plate.held=false;},
  auto(){
    const L=layout(),b=this.bodyC(L);
    if(!this.snapped)return{type:'drag',from:{x:this.plate.x,y:this.plate.y},to:{x:b.x,y:b.y}};
    return{type:'wait'};
  }
};

/* ---- soundpost (signature 3) ---- */
scenes.post={
  post:null,inside:false,snapped:false,doneT:0,lensT:0,
  enter(){
    const L=layout();
    this.inside=false;this.snapped=false;this.doneT=0;this.lensT=0;
    this.post={x:L.portrait?W*0.80:W*0.86,y:H*0.72,held:false};
  },
  bodyC(L){return{x:L.cx,y:L.cy,BL:L.S*0.56};},
  fholeMid(L){const b=this.bodyC(L);const pts=fSpine(b.BL,1,20);
    const m=pts[10];return{x:b.x+m.x,y:b.y-b.BL*0.5+m.y};},
  target(L){const b=this.bodyC(L);return{x:b.x+0.055*b.BL,y:b.y-b.BL*0.5+0.565*b.BL};},
  update(dt){
    const L=layout();
    if(!this.snapped){
      const fm=this.fholeMid(L),tg=this.target(L);
      if(!this.inside){
        Hint.path([{x:this.post.x,y:this.post.y},fm,tg]);
        if(dist(this.post,fm)<L.S*0.10){this.inside=true;AudioSys.whoosh();
          say('スッ……なかへ',fm.x,fm.y-60,L.S*0.045,'#cfe8ff');}
      }else{
        Hint.path([{x:this.post.x,y:this.post.y},tg]);
        if(dist(this.post,tg)<L.S*0.09){
          this.snapped=true;AudioSys.snap();sparkle(tg.x,tg.y,14);
          say('たった！',tg.x,tg.y-70,L.S*0.06,'#ffe9a0');
          Hint.none();
        }
      }
    }else{
      this.lensT=Math.min(1,this.lensT+dt*1.6);
      if(this.lensT>=1&&!this.doneT){this.doneT=sceneT;AudioSys.chime();}
      if(this.doneT&&sceneT>this.doneT+1.6)go('varnish');
    }
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const b=this.bodyC(L);
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    // back visible through translucent top
    drawPlate(g,b.BL,TEX.maple,{});
    g.fillStyle='rgba(30,18,8,0.45)';bodyPath(g,b.BL*0.97);g.fill(); // interior dark
    g.restore();
    // post if inside: behind top
    if(this.inside&&!this.snapped)this.drawPost(g,L,0.8);
    if(this.snapped){
      const tg=this.target(L);
      g.save();g.translate(tg.x,tg.y);
      g.fillStyle='rgba(240,220,180,0.9)';
      g.fillRect(-L.S*0.012,-L.S*0.08,L.S*0.024,L.S*0.16);
      g.restore();
    }
    // pulsing target spot inside (visible through translucent top)
    if(!this.snapped){
      const tg=this.target(L),pulse=0.4+0.3*Math.sin(sceneT*4);
      g.save();
      const trg=g.createRadialGradient(tg.x,tg.y,2,tg.x,tg.y,L.S*0.06);
      trg.addColorStop(0,'rgba(190,230,255,'+(0.5*pulse+0.2)+')');trg.addColorStop(1,'rgba(190,230,255,0)');
      g.fillStyle=trg;g.beginPath();g.arc(tg.x,tg.y,L.S*0.06,0,TAU);g.fill();
      g.strokeStyle='rgba(190,230,255,'+(0.4+0.3*pulse)+')';g.lineWidth=3;g.setLineDash([6,8]);
      g.beginPath();g.arc(tg.x,tg.y,L.S*0.035,0,TAU);g.stroke();g.setLineDash([]);
      g.restore();
    }
    // translucent top
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    g.globalAlpha=0.42;
    drawPlate(g,b.BL,TEX.spruce,{});
    g.globalAlpha=1;
    drawFHole(g,b.BL,-1,1);drawFHole(g,b.BL,1,1);
    // f-hole openings glow (they are real holes)
    const fm=fSpine(b.BL,1,20)[10];
    const rg=g.createRadialGradient(fm.x,fm.y,2,fm.x,fm.y,b.BL*0.08);
    rg.addColorStop(0,'rgba(255,240,190,0.35)');rg.addColorStop(1,'rgba(255,240,190,0)');
    g.fillStyle=rg;g.beginPath();g.arc(fm.x,fm.y,b.BL*0.09,0,TAU);g.fill();
    g.restore();
    // target ring repeated faintly above the top so it always reads
    if(!this.snapped&&this.inside){
      const tg=this.target(L),pulse=0.4+0.3*Math.sin(sceneT*4);
      g.save();g.strokeStyle='rgba(190,230,255,'+(0.35+0.3*pulse)+')';g.lineWidth=3;
      g.setLineDash([6,8]);g.beginPath();g.arc(tg.x,tg.y,L.S*0.04,0,TAU);g.stroke();
      g.restore();
    }
    // post outside: in front
    if(!this.inside&&!this.snapped)this.drawPost(g,L,1);
    // cutaway lens after snap
    if(this.snapped&&this.lensT>0){
      const lx=L.portrait?W*0.5:L.cx,ly=L.portrait?H*0.82:H*0.80,lr=L.S*0.15*easeOut(this.lensT);
      g.save();
      g.beginPath();g.arc(lx,ly,lr,0,TAU);
      g.fillStyle='#2a1c10';g.fill();
      g.clip();
      // cross-section: top arch above, back arch below, post standing
      g.strokeStyle='#e8cf9f';g.lineWidth=lr*0.16;
      g.beginPath();g.moveTo(lx-lr,ly-lr*0.35);g.quadraticCurveTo(lx,ly-lr*0.7,lx+lr,ly-lr*0.35);g.stroke();
      g.strokeStyle='#dcb26e';
      g.beginPath();g.moveTo(lx-lr,ly+lr*0.45);g.quadraticCurveTo(lx,ly+lr*0.75,lx+lr,ly+lr*0.45);g.stroke();
      g.fillStyle='#f0dcb4';
      g.fillRect(lx+lr*0.18-lr*0.07,ly-lr*0.5,lr*0.14,lr*1.05);
      g.restore();
      g.strokeStyle='rgba(255,235,170,0.8)';g.lineWidth=4;
      g.beginPath();g.arc(lx,ly,lr,0,TAU);g.stroke();
      if(this.lensT>0.6)sparkleOnce(g,lx+lr*0.18,ly-lr*0.1,sceneT);
    }
    drawLuthier(g,L.portrait?W*0.16:W*0.13,L.portrait?H*0.13:H*0.38,L.S*0.0013,
      {lookX:0.6,lookY:0.3});
    drawStepDots(g,stepIndex());
  },
  drawPost(g,L,alpha){
    g.save();g.translate(this.post.x,this.post.y);g.globalAlpha=alpha;
    g.rotate(this.inside?0.08:0.5);
    g.fillStyle='#f0dcb4';g.strokeStyle='rgba(120,80,40,0.6)';g.lineWidth=2;
    g.fillRect(-L.S*0.013,-L.S*0.085,L.S*0.026,L.S*0.17);
    g.strokeRect(-L.S*0.013,-L.S*0.085,L.S*0.026,L.S*0.17);
    // soft glow so it reads as "the piece to move"
    if(!this.snapped){
      const rg=g.createRadialGradient(0,0,4,0,0,L.S*0.09);
      rg.addColorStop(0,'rgba(255,240,190,0.35)');rg.addColorStop(1,'rgba(255,240,190,0)');
      g.fillStyle=rg;g.beginPath();g.arc(0,0,L.S*0.09,0,TAU);g.fill();
    }
    g.restore();
  },
  down(x,y){
    if(!this.snapped&&dist({x,y},this.post)<layout().S*0.22){this.post.held=true;AudioSys.tap();}
  },
  move(x,y){
    if(this.post.held&&!this.snapped){
      this.post.x=lerp(this.post.x,x,0.5);this.post.y=lerp(this.post.y,y,0.5);
    }
  },
  up(){this.post.held=false;},
  auto(){
    const L=layout();
    if(!this.snapped){
      if(!this.inside)return{type:'drag',from:{x:this.post.x,y:this.post.y},to:this.fholeMid(L),then:this.target(L)};
      return{type:'drag',from:{x:this.post.x,y:this.post.y},to:this.target(L)};
    }
    return{type:'wait'};
  }
};
function sparkleOnce(g,x,y,t){
  const a=0.5+0.5*Math.sin(t*6);
  g.save();g.globalAlpha=a;g.strokeStyle='#ffe9a0';g.lineWidth=2;
  g.translate(x,y);g.rotate(t*2);
  g.beginPath();for(let k=0;k<4;k++){g.rotate(Math.PI/2);g.moveTo(0,4);g.lineTo(0,12);}g.stroke();
  g.restore();
}

/* ---- varnish ---- */
scenes.varnish={
  cover:0,doneT:0,mask:null,mg:null,brush:null,glossT:0,
  enter(){
    this.cover=0;this.doneT=0;this.glossT=0;this.brush=null;
    this.mask=document.createElement('canvas');
    this.mask.width=256;this.mask.height=512;
    this.mg=this.mask.getContext('2d');
    this.mg.clearRect(0,0,256,512);
  },
  bodyC(L){return{x:L.cx,y:L.cy+L.S*0.04,BL:L.S*0.46};},
  jars(L){
    const y=Math.max(H*0.10,60),r=L.S*0.052,gap=L.S*0.16;
    const x0=(L.portrait?W*0.5:L.cx)-gap;
    return['amber','red','rose'].map((k,i)=>({k,x:x0+i*gap,y,r}));
  },
  update(dt){
    const L=layout(),b=this.bodyC(L);
    if(this.doneT){Hint.none();
      this.glossT=Math.min(1,this.glossT+dt*1.2);
      if(sceneT>this.doneT+1.6)go('bridge');
      return;}
    if(this.cover<0.02)Hint.drag({x:b.x,y:b.y-b.BL*0.4},{x:b.x,y:b.y+b.BL*0.4});
    else Hint.none();
    if(this.cover>=1&&!this.doneT){
      this.doneT=sceneT;AudioSys.chime();
      this.mg.fillStyle='#fff';this.mg.fillRect(0,0,256,512);
      say('ぴかぴか！',b.x,b.y-b.BL*0.6,L.S*0.055,'#ffe9a0');
      sparkle(b.x,b.y-b.BL*0.2,12);sparkle(b.x,b.y+b.BL*0.2,12);
    }
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const b=this.bodyC(L);
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    // white violin
    drawViolinFront(g,b.BL,{tex:TEX.spruce,fholes:true});
    // varnish masked overlay
    g.save();
    bodyPath(g,b.BL);g.clip();
    const off=document.createElement('canvas');off.width=256;off.height=512;
    const og=off.getContext('2d');
    og.fillStyle=VARNISH[G.varnish].mul.replace(/[\d.]+\)$/,'0.9)');
    og.fillRect(0,0,256,512);
    og.globalCompositeOperation='destination-in';
    og.drawImage(this.mask,0,0);
    g.globalCompositeOperation='multiply';
    g.drawImage(off,-b.BL*0.325,-b.BL*0.03,b.BL*0.65,b.BL*1.08);
    g.globalCompositeOperation='source-over';
    if(this.glossT>0){
      g.globalCompositeOperation='screen';
      const gl=g.createLinearGradient(-b.BL*0.3,0,b.BL*0.3,b.BL);
      const gp=clamp(this.glossT,0.02,0.98);
      gl.addColorStop(Math.max(0,gp-0.15),'rgba(255,240,200,0)');
      gl.addColorStop(gp,VARNISH[G.varnish].glow);
      gl.addColorStop(Math.min(1,gp+0.15),'rgba(255,240,200,0)');
      g.fillStyle=gl;g.fillRect(-b.BL*0.35,-b.BL*0.05,b.BL*0.7,b.BL*1.15);
      g.globalCompositeOperation='source-over';
    }
    g.restore();
    g.restore();
    // jars
    const jars=this.jars(L);
    for(const j of jars){
      g.save();
      const sel=G.varnish===j.k;
      if(sel){g.shadowColor='#ffe9a0';g.shadowBlur=18;}
      g.fillStyle=['#d69628','#9e3a1a','#cd546e'][['amber','red','rose'].indexOf(j.k)];
      g.beginPath();g.arc(j.x,j.y,j.r,0,TAU);g.fill();
      g.shadowColor='transparent';
      g.strokeStyle=sel?'#fff3c0':'rgba(255,255,255,0.4)';g.lineWidth=sel?5:2.5;
      g.beginPath();g.arc(j.x,j.y,j.r,0,TAU);g.stroke();
      // jar lid
      g.fillStyle='rgba(70,45,20,0.9)';g.fillRect(j.x-j.r*0.5,j.y-j.r-8,j.r,8);
      g.restore();
    }
    // brush follows finger
    if(this.brush)drawToolHand(g,this.brush,-0.3,'brush',1.15);
    drawLuthier(g,L.portrait?W*0.16:W*0.13,L.portrait?H*0.16:H*0.40,L.S*0.0013,
      {lookX:0.5,lookY:0.4});
    drawStepDots(g,stepIndex());
  },
  down(x,y){
    const L=layout();
    for(const j of this.jars(L)){
      if(dist({x,y},j)<j.r*1.8){G.varnish=j.k;AudioSys.tap();
        say('このいろ！',j.x,j.y+j.r*2.4,L.S*0.04);return;}
    }
    this.paint(x,y,x,y);
  },
  move(x,y){this.paint(this.brush?this.brush.x:x,this.brush?this.brush.y:y,x,y);},
  up(){this.brush=null;},
  paint(x0,y0,x,y){
    if(this.doneT)return;
    const L=layout(),b=this.bodyC(L);
    this.brush={x,y};
    // to mask coords
    const mx=(x-(b.x-b.BL*0.325))/(b.BL*0.65)*256;
    const my=(y-(b.y-b.BL*0.5-b.BL*0.03))/(b.BL*1.08)*512;
    this.mg.strokeStyle='#fff';this.mg.lineCap='round';this.mg.lineWidth=64;
    const mx0=(x0-(b.x-b.BL*0.325))/(b.BL*0.65)*256;
    const my0=(y0-(b.y-b.BL*0.5-b.BL*0.03))/(b.BL*1.08)*512;
    this.mg.beginPath();this.mg.moveTo(mx0,my0);this.mg.lineTo(mx,my);this.mg.stroke();
    const d=Math.hypot(mx-mx0,my-my0);
    if(d>0.5){this.cover+=d/2200;
      if(Math.random()<0.15)AudioSys.whoosh();}
    this.cover=Math.min(1,this.cover+0.0004);
  },
  auto(){
    const L=layout(),b=this.bodyC(L);
    if(!this.doneT)return{type:'scrub',from:{x:b.x-b.BL*0.15,y:b.y-b.BL*0.42},to:{x:b.x+b.BL*0.15,y:b.y+b.BL*0.42}};
    return{type:'wait'};
  }
};

/* ---- bridge ---- */
scenes.bridge={
  piece:null,snapped:false,doneT:0,
  enter(){
    const L=layout();
    this.snapped=false;this.doneT=0;
    this.piece={x:L.portrait?W*0.80:W*0.86,y:H*0.76,held:false};
  },
  bodyC(L){return{x:L.cx,y:L.cy+L.S*0.04,BL:L.S*0.46};},
  target(L){const b=this.bodyC(L);return{x:b.x,y:b.y-b.BL*0.5+0.545*b.BL-b.BL*0.03};},
  update(dt){
    const L=layout();
    if(!this.snapped){
      Hint.drag({x:this.piece.x,y:this.piece.y},this.target(L));
      if(dist(this.piece,this.target(L))<L.S*0.09){
        this.snapped=true;AudioSys.pop();sparkle(this.target(L).x,this.target(L).y,10);
        say('コトン！',this.target(L).x,this.target(L).y-60,L.S*0.055,'#ffe9a0');
        Hint.none();
      }
    }else if(!this.doneT){this.doneT=sceneT;AudioSys.chime();}
    if(this.doneT&&sceneT>this.doneT+1.0)go('strings');
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const b=this.bodyC(L);
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    drawViolinFront(g,b.BL,{tex:TEX.spruce,varnish:G.varnish,fholes:true,gloss:0.45});
    // bridge shadow target
    if(!this.snapped){
      const pulse=0.4+0.3*Math.sin(sceneT*4);
      g.save();g.globalAlpha=pulse;g.fillStyle='#3a2510';
      g.translate(0,0.545*b.BL);
      g.beginPath();g.ellipse(0,0,b.BL*0.12,b.BL*0.03,0,0,TAU);g.fill();
      g.restore();
    }else{
      drawBridge(g,b.BL,1);
    }
    g.restore();
    // free bridge piece
    if(!this.snapped){
      g.save();g.translate(this.piece.x,this.piece.y);
      g.shadowColor='rgba(0,0,0,0.3)';g.shadowBlur=10;g.shadowOffsetY=6;
      drawBridgeAt(g,this.bodyC(L).BL);
      g.restore();
    }
    drawLuthier(g,L.portrait?W*0.16:W*0.13,L.portrait?H*0.13:H*0.38,L.S*0.0013,
      {lookX:0.5,lookY:0.4});
    drawStepDots(g,stepIndex());
  },
  down(x,y){
    if(!this.snapped&&dist({x,y},this.piece)<layout().S*0.2){this.piece.held=true;AudioSys.tap();}
  },
  move(x,y){if(this.piece.held&&!this.snapped){this.piece.x=x;this.piece.y=y;}},
  up(){this.piece.held=false;},
  auto(){
    const L=layout();
    if(!this.snapped)return{type:'drag',from:{x:this.piece.x,y:this.piece.y},to:this.target(L)};
    return{type:'wait'};
  }
};
function drawBridgeAt(g,BL){
  g.save();g.translate(0,-0.545*BL);drawBridge(g,BL,1);g.restore();
}

/* ---- strings + pegs (signature 4a) ---- */
const STRING_FREQS=[196,293.66,440,659.25];
scenes.strings={
  idx:0,phase:'string',dragY:0,dragging:false,rot:0,lastAng:null,
  tension:[0,0,0,0],strung:0,doneT:0,pluckAcc:0,
  enter(){
    this.idx=0;this.phase='string';this.strung=0;this.doneT=0;
    this.tension=[0,0,0,0];this.rot=0;this.lastAng=null;this.dragging=false;this.dragY=0;
  },
  bodyC(L){return{x:L.cx,y:L.cy+L.S*0.16,BL:L.S*0.40};},
  lane(L,i){const b=this.bodyC(L);const l=stringLane(b.BL,i);
    const o=p=>({x:p.x+b.x,y:p.y+b.y-b.BL*0.5});
    return{tail:o(l.tail),bridge:o(l.bridge),nut:o(l.nut),peg:o(pegPos(b.BL,i))};},
  update(dt){
    const L=layout();
    if(this.doneT){if(sceneT>this.doneT+1.0)go('bow');Hint.none();return;}
    const lane=this.lane(L,this.idx);
    if(this.phase==='string'){
      Hint.drag(lane.tail,lane.nut);
    }else{
      Hint.circle(lane.peg,L.S*0.09);
    }
  },
  draw(g){
    const L=layout();drawBG(g,L);
    const b=this.bodyC(L);
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    drawViolinFront(g,b.BL,{tex:TEX.spruce,varnish:G.varnish,fholes:true,bridge:true,
      strings:this.strung,stringT:this.tension,gloss:0.45});
    g.restore();
    // current string being drawn
    const lane=this.lane(L,Math.min(3,this.idx));
    if(this.phase==='string'&&this.dragging){
      g.save();g.strokeStyle='rgba(230,235,240,0.8)';g.lineWidth=2.5;g.lineCap='round';
      g.beginPath();g.moveTo(lane.tail.x,lane.tail.y);
      g.quadraticCurveTo(lane.tail.x+20,lerp(lane.tail.y,this.dragY,0.5),
        lerp(lane.tail.x,lane.nut.x,clamp((lane.tail.y-this.dragY)/(lane.tail.y-lane.nut.y),0,1)),this.dragY);
      g.stroke();g.restore();
    }
    // peg highlight while tuning
    if(this.phase==='peg'){
      const p=lane.peg;
      g.save();
      g.translate(p.x,p.y);g.rotate(this.rot);
      g.fillStyle='#2e241c';
      g.beginPath();g.ellipse(0,0,L.S*0.030,L.S*0.020,0,0,TAU);g.fill();
      g.fillStyle='#4a3a2c';g.fillRect(-L.S*0.005,-L.S*0.030,L.S*0.010,L.S*0.06);
      g.restore();
    }
    drawLuthier(g,L.portrait?W*0.16:W*0.13,L.portrait?H*0.13:H*0.36,L.S*0.0013,
      {lookX:0.4,lookY:this.phase==='string'?0.5:-0.6});
    drawStepDots(g,stepIndex());
    // string count stars
    for(let i=0;i<4;i++){
      const x=W*0.5+(i-1.5)*30,y=H-Math.max(24,H*0.045);
      g.fillStyle=i<this.strung&&this.tension[i]>=1?'#ffd97a':'rgba(255,255,255,0.25)';
      g.beginPath();g.arc(x,y,7,0,TAU);g.fill();
    }
  },
  down(x,y){
    if(this.doneT)return;
    const L=layout(),lane=this.lane(L,this.idx);
    if(this.phase==='string'){
      if(dist({x,y},lane.tail)<L.S*0.22){this.dragging=true;this.dragY=y;AudioSys.tap();}
    }else{
      this.lastAng=Math.atan2(y-lane.peg.y,x-lane.peg.x);
    }
  },
  move(x,y){
    if(this.doneT)return;
    const L=layout(),lane=this.lane(L,this.idx);
    if(this.phase==='string'&&this.dragging){
      this.dragY=y;
      if(y<lane.nut.y+L.S*0.05){
        // string attached
        this.dragging=false;this.strung=this.idx+1;this.tension[this.idx]=0.15;
        AudioSys.pluck(STRING_FREQS[this.idx]*0.6,0.15);
        say('シュルル…',lane.bridge.x,lane.bridge.y-40,L.S*0.04,'#dfe8ff');
        this.phase='peg';this.rot=0;this.lastAng=null;
      }
    }else if(this.phase==='peg'&&this.lastAng!=null){
      const a=Math.atan2(y-lane.peg.y,x-lane.peg.x);
      let d=a-this.lastAng;
      while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;
      this.lastAng=a;
      const abs=Math.min(Math.abs(d),0.25);
      this.rot+=abs;
      const NEED=5.2;
      this.tension[this.idx]=clamp(0.15+this.rot/NEED*0.85,0,1);
      this.pluckAcc+=abs;
      if(this.pluckAcc>0.55){
        this.pluckAcc=0;
        const f=STRING_FREQS[this.idx]*lerp(0.6,1,this.tension[this.idx]);
        AudioSys.pluck(f,0.18);
      }
      if(this.tension[this.idx]>=1){
        AudioSys.pluck(STRING_FREQS[this.idx],0.3);
        sparkle(lane.peg.x,lane.peg.y,10);
        say(['ソ！','レ！','ラ！','ミ！'][this.idx],lane.peg.x,lane.peg.y-60,L.S*0.055,'#ffe9a0');
        this.idx++;
        if(this.idx>=4){this.doneT=sceneT;AudioSys.chime();}
        else this.phase='string';
        this.lastAng=null;
      }
    }
  },
  up(){this.dragging=false;this.lastAng=null;},
  auto(){
    const L=layout();
    if(this.doneT)return{type:'wait'};
    const lane=this.lane(L,this.idx);
    if(this.phase==='string')return{type:'drag',from:lane.tail,to:{x:lane.nut.x,y:lane.nut.y-L.S*0.02}};
    return{type:'circle',center:lane.peg,r:L.S*0.09,turns:2.2};
  }
};

/* ---- first bow (signature 4b, max reward) ---- */
scenes.bow={
  played:false,playT:0,doneT:0,
  enter(){this.played=false;this.playT=0;this.doneT=0;},
  bodyC(L){return{x:L.cx,y:L.cy+L.S*0.14,BL:L.S*0.40};},
  bowRest(L){const b=this.bodyC(L);return{x:b.x+L.S*(L.portrait?0.28:0.24),y:b.y-b.BL*0.05};},
  update(dt){
    const L=layout();
    if(!this.played){Hint.tap(this.bowRest(L));}
    else{
      Hint.none();
      this.playT+=dt;
      if(this.playT>0.2&&Math.random()<0.35){
        const b=this.bodyC(L);
        sparkle(b.x+(Math.random()-0.5)*b.BL*0.6,b.y-b.BL*0.5+Math.random()*b.BL,3);
      }
      if(this.playT>3.4&&!this.doneT){this.doneT=sceneT;AudioSys.grand();
        say('できた！！',L.cx,L.cy-L.S*0.28,L.S*0.08,'#ffe9a0');}
      if(this.doneT&&sceneT>this.doneT+1.6)go('gallery');
    }
  },
  draw(g){
    const L=layout();
    drawBG(g,L,this.played);
    const b=this.bodyC(L);
    if(this.played){
      // radiant glow behind violin
      const k=Math.min(1,this.playT/1.5);
      const rg=g.createRadialGradient(b.x,b.y,10,b.x,b.y,L.S*0.7);
      rg.addColorStop(0,'rgba(255,235,170,'+0.35*k+')');rg.addColorStop(1,'rgba(255,235,170,0)');
      g.fillStyle=rg;g.fillRect(0,0,W,H);
    }
    g.save();g.translate(b.x,b.y-b.BL*0.5);
    drawViolinFront(g,b.BL,{tex:TEX.spruce,varnish:G.varnish,fholes:true,bridge:true,
      strings:4,stringT:[1,1,1,1],gloss:this.played?(0.2+0.5*Math.abs(Math.sin(this.playT))):0.45});
    g.restore();
    // bow
    if(!this.played){
      const p=this.bowRest(L);
      g.save();g.translate(p.x,p.y);g.rotate(-1.1);
      drawBow(g,L.S*0.45);
      g.restore();
    }else{
      // bow stroke animation across strings
      const k=Math.min(1,this.playT/3.0);
      const sweep=Math.sin(k*Math.PI*1.5);
      const bx=b.x+sweep*b.BL*0.22;
      const by=b.y-b.BL*0.5+0.50*b.BL;
      g.save();g.translate(bx,by);g.rotate(-0.5+sweep*0.1);
      drawBow(g,L.S*0.5);
      // hand on the frog
      g.fillStyle='#f2c49a';g.strokeStyle='rgba(120,70,40,0.6)';g.lineWidth=2;
      g.beginPath();g.ellipse(-L.S*0.25+6,8,15,18,0.3,0,TAU);g.fill();g.stroke();
      g.fillStyle='#4e6e58';g.beginPath();g.ellipse(-L.S*0.25-8,30,17,16,0.3,0,TAU);g.fill();
      g.restore();
    }
    drawLuthier(g,L.portrait?W*0.20:W*0.15,L.portrait?H*0.14:H*0.34,L.S*0.0015,
      {lookX:0.5,lookY:0.5});
    drawStepDots(g,stepIndex());
  },
  down(x,y){
    const L=layout();
    if(!this.played&&dist({x,y},this.bowRest(L))<L.S*0.28){
      this.played=true;this.playT=0;
      // the first real sound: arpeggio then dyad
      AudioSys.bow(196,0.9,0.0,0.10);
      AudioSys.bow(293.66,0.9,0.55,0.11);
      AudioSys.bow(440,1.0,1.1,0.12);
      AudioSys.bow(659.25,1.9,1.65,0.12);
      AudioSys.bow(440,1.9,1.65,0.08);
      say('～♪',L.cx,L.cy-L.S*0.2,L.S*0.07,'#cfe8ff');
    }
  },
  auto(){
    const L=layout();
    if(!this.played)return{type:'tap',at:this.bowRest(L)};
    return{type:'wait'};
  }
};
function drawBow(g,len){
  g.save();
  g.strokeStyle='#6a4520';g.lineWidth=6;g.lineCap='round';
  g.beginPath();g.moveTo(-len/2,0);g.quadraticCurveTo(0,-len*0.06,len/2,0);g.stroke();
  g.strokeStyle='rgba(240,240,235,0.9)';g.lineWidth=2.5;
  g.beginPath();g.moveTo(-len/2,6);g.lineTo(len/2,4);g.stroke();
  g.fillStyle='#241c16';g.fillRect(-len/2-8,-6,16,18);
  g.restore();
}

/* ---- gallery ---- */
scenes.gallery={
  yaw:0,vyaw:0,lastX:null,
  enter(){this.yaw=0;this.vyaw=0.8;this.lastX=null;G.builds++;},
  update(dt){
    if(!ptr.down){this.yaw+=this.vyaw*dt;this.vyaw*=Math.pow(0.4,dt);}
    if(sceneT>4&&Math.abs(this.vyaw)<0.05&&!ptr.down)this.vyaw=0.3;
    Hint.none();
  },
  buttons(L){
    const r=Math.max(24,L.S*0.045),y=H-Math.max(40,H*0.08);
    const items=[
      {k:'amber',x:W*0.5-r*7},{k:'red',x:W*0.5-r*4.4},{k:'rose',x:W*0.5-r*1.8},
      {k:'ribbon',x:W*0.5+r*1.8},{k:'deco',x:W*0.5+r*4.4},{k:'again',x:W*0.5+r*7.4}
    ];
    return items.map(it=>({...it,y,r}));
  },
  draw(g){
    const L=layout();
    drawBG(g,L,true);
    // case backdrop decoration
    if(G.deco>0)drawDeco(g,L);
    const b={x:L.portrait?W*0.5:L.cx,y:L.cy+L.S*0.10,BL:L.S*0.42};
    // stand
    g.fillStyle='rgba(40,25,10,0.5)';
    g.beginPath();g.ellipse(b.x,b.y+b.BL*0.56,b.BL*0.4,b.BL*0.06,0,0,TAU);g.fill();
    const cosY=Math.cos(this.yaw);
    const showBack=cosY<0;
    const sx=Math.max(0.12,Math.abs(cosY));
    g.save();g.translate(b.x,b.y-b.BL*0.5);g.scale(sx,1);
    if(showBack){
      drawPlate(g,b.BL,TEX.maple,{varnish:G.varnish,gloss:0.35+0.3*Math.sin(this.yaw*2)});
      drawNeck(g,b.BL,{});
    }else{
      drawViolinFront(g,b.BL,{tex:TEX.spruce,varnish:G.varnish,fholes:true,bridge:true,
        strings:4,stringT:[1,1,1,1],gloss:0.35+0.3*Math.sin(this.yaw*2)});
    }
    g.restore();
    // ribbon on scroll
    if(G.ribbon>0){
      const ry=b.y-b.BL*0.5-0.575*b.BL;
      drawRibbon(g,b.x,ry,L.S*0.05,G.ribbon===2);
    }
    // luthier proud
    drawLuthier(g,L.portrait?W*0.82:W*0.14,L.portrait?H*0.16:H*0.42,L.S*0.0014,
      {lookX:L.portrait?-0.5:0.7,lookY:0});
    // buttons
    for(const bt of this.buttons(L)){
      g.save();
      g.beginPath();g.arc(bt.x,bt.y,bt.r,0,TAU);
      g.fillStyle='rgba(50,32,14,0.75)';g.fill();
      g.strokeStyle='rgba(255,235,170,0.6)';g.lineWidth=2.5;g.stroke();
      if(bt.k==='amber'||bt.k==='red'||bt.k==='rose'){
        g.fillStyle=['#d69628','#9e3a1a','#cd546e'][['amber','red','rose'].indexOf(bt.k)];
        g.beginPath();g.arc(bt.x,bt.y,bt.r*0.62,0,TAU);g.fill();
        if(G.varnish===bt.k){g.strokeStyle='#fff3c0';g.lineWidth=4;
          g.beginPath();g.arc(bt.x,bt.y,bt.r*0.8,0,TAU);g.stroke();}
      }else if(bt.k==='ribbon'){
        drawRibbon(g,bt.x,bt.y,bt.r*0.55,G.ribbon===2);
        if(G.ribbon===0){g.strokeStyle='rgba(255,255,255,0.5)';g.lineWidth=2;
          g.beginPath();g.moveTo(bt.x-bt.r*0.5,bt.y+bt.r*0.5);g.lineTo(bt.x+bt.r*0.5,bt.y-bt.r*0.5);g.stroke();}
      }else if(bt.k==='deco'){
        g.fillStyle='#ffd97a';
        drawStar(g,bt.x-6,bt.y-4,7);
        g.fillStyle='#ff9ec0';
        drawFlower(g,bt.x+7,bt.y+6,7);
      }else{ // again
        g.strokeStyle='#ffe9a0';g.lineWidth=4;g.lineCap='round';
        g.beginPath();g.arc(bt.x,bt.y,bt.r*0.5,0.4,TAU-0.8);g.stroke();
        g.beginPath();g.moveTo(bt.x+bt.r*0.5-6,bt.y-bt.r*0.35);
        g.lineTo(bt.x+bt.r*0.5+4,bt.y-bt.r*0.45);g.lineTo(bt.x+bt.r*0.5,bt.y-bt.r*0.1);g.closePath();
        g.fillStyle='#ffe9a0';g.fill();
      }
      g.restore();
    }
    drawStepDots(g,STEP_COUNT-1);
  },
  down(x,y){
    const L=layout();
    for(const bt of this.buttons(L)){
      if(dist({x,y},bt)<bt.r*1.4){
        AudioSys.tap();
        if(bt.k==='again'){
          G.seed=(G.seed*1103515245+12345)>>>0;rebuildTex();AudioSys.chime();
          go('wood');return;
        }
        if(bt.k==='ribbon'){G.ribbon=(G.ribbon+1)%3;}
        else if(bt.k==='deco'){G.deco=(G.deco+1)%3;}
        else{G.varnish=bt.k;}
        return;
      }
    }
    this.lastX=x;
  },
  move(x,y){
    if(this.lastX!=null){
      const d=(x-this.lastX)/Math.max(200,W*0.4);
      this.yaw+=d*3;this.vyaw=d*40;this.lastX=x;
    }
  },
  up(){this.lastX=null;},
  auto(){
    return{type:'drag',from:{x:W*0.3,y:H*0.45},to:{x:W*0.75,y:H*0.45}};
  }
};
function drawStar(g,x,y,r){
  g.save();g.translate(x,y);g.beginPath();
  for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5,a2=a+TAU/10;
    g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.lineTo(Math.cos(a2)*r*0.45,Math.sin(a2)*r*0.45);}
  g.closePath();g.fill();g.restore();
}
function drawFlower(g,x,y,r){
  g.save();g.translate(x,y);
  for(let i=0;i<5;i++){const a=i*TAU/5;
    g.beginPath();g.ellipse(Math.cos(a)*r*0.6,Math.sin(a)*r*0.6,r*0.45,r*0.3,a,0,TAU);g.fill();}
  g.fillStyle='#ffe9a0';g.beginPath();g.arc(0,0,r*0.3,0,TAU);g.fill();
  g.restore();
}
function drawRibbon(g,x,y,s,rainbow){
  g.save();g.translate(x,y);
  const colors=rainbow?['#ff8a8a','#ffc46a','#fff06a','#8ae08a','#8ab8ff','#c78aff']:['#ff9ec0'];
  for(let i=0;i<2;i++){
    const dir=i?1:-1;
    g.fillStyle=colors[i%colors.length];
    g.beginPath();
    g.moveTo(0,0);
    g.quadraticCurveTo(dir*s*1.4,-s*0.9,dir*s*1.7,0);
    g.quadraticCurveTo(dir*s*1.4,s*0.9,0,0);
    g.fill();
    if(rainbow){
      g.fillStyle=colors[(i+2)%colors.length];
      g.beginPath();g.moveTo(0,0);
      g.quadraticCurveTo(dir*s*1.0,-s*0.5,dir*s*1.2,0);
      g.quadraticCurveTo(dir*s*1.0,s*0.5,0,0);g.fill();
    }
    // tails
    g.fillStyle=colors[(i+1)%colors.length];
    g.beginPath();g.moveTo(0,s*0.1);
    g.lineTo(dir*s*0.5,s*1.5);g.lineTo(dir*s*0.9,s*1.3);g.lineTo(dir*s*0.3,s*0.05);
    g.closePath();g.fill();
  }
  g.fillStyle=rainbow?'#fff':'#ff6fa8';
  g.beginPath();g.arc(0,0,s*0.35,0,TAU);g.fill();
  g.restore();
}
function drawDeco(g,L){
  const rnd=mulberry(99);
  for(let i=0;i<26;i++){
    const x=rnd()*W,y=rnd()*H*0.75,r=6+rnd()*10;
    g.save();g.globalAlpha=0.35+rnd()*0.3;
    if(G.deco===1){g.fillStyle=['#ff9ec0','#ffc46a','#c78aff'][i%3];drawFlower(g,x,y,r);}
    else{g.fillStyle=['#ffd97a','#fff3c0','#8ab8ff'][i%3];drawStar(g,x,y,r);}
    g.restore();
  }
}

/* ================= main loop ================= */
let lastT=0;
function frame(ts){
  const dt=Math.min(0.05,(ts-lastT)/1000)||0.016;lastT=ts;
  sceneT+=dt;
  const g=cx2;
  g.setTransform(DPR,0,0,DPR,0,0);
  if(cur){
    try{
      if(cur.update)cur.update(dt);
      Hint.update(dt);
      updateParts(dt);updateWords(dt);
      cur.draw(g);
      drawParts(g);drawWords(g);
      Hint.draw(g);
    }catch(err){console.error('frame error',err);}
  }
  // fade transition
  if(fadeDir!==0){
    fade+=fadeDir*dt*2.6;
    if(fade>=1){fade=1;fadeDir=-1;setScene(nextName);nextName=null;}
    if(fade<=0){fade=0;fadeDir=0;}
    g.fillStyle='rgba(30,18,8,'+clamp(fade,0,1)+')';
    g.fillRect(0,0,W,H);
  }
  requestAnimationFrame(frame);
}
setScene('title');
requestAnimationFrame(frame);

/* ================= automation / debug API ================= */
window.__VW={
  get scene(){return curName;},
  get transitioning(){return fadeDir!==0;},
  auto(){return cur&&cur.auto?cur.auto():{type:'wait'};},
  state(){return {scene:curName,builds:G.builds,varnish:G.varnish,ribbon:G.ribbon,deco:G.deco};},
  go(name){if(scenes[name])go(name);}
};
