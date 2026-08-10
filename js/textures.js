/* procedural PBR texture factory — albedo / height->normal / roughness, all canvas-generated */
import * as THREE from '../lib/three.module.min.js';

export function mulberry(seed){let s=seed>>>0;return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

export function tex(canvas,{srgb=true,repeat=[1,1],aniso=4}={}){
  const t=new THREE.CanvasTexture(canvas);
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(repeat[0],repeat[1]);
  t.anisotropy=aniso;
  return t;
}

/* Sobel height->normal. strength ~ 0.5..4 */
export function normalFromHeight(hc,strength=1.5){
  const w=hc.width,h=hc.height;
  const src=hc.getContext('2d').getImageData(0,0,w,h).data;
  const out=cnv(w,h);const g=out.getContext('2d');
  const img=g.createImageData(w,h);const d=img.data;
  const hp=(x,y)=>{x=(x+w)%w;y=(y+h)%h;return src[(y*w+x)*4]/255;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const tl=hp(x-1,y-1),t0=hp(x,y-1),tr=hp(x+1,y-1);
    const l=hp(x-1,y),r=hp(x+1,y);
    const bl=hp(x-1,y+1),b0=hp(x,y+1),br=hp(x+1,y+1);
    const dx=(tr+2*r+br-tl-2*l-bl)*strength;
    const dy=(bl+2*b0+br-tl-2*t0-tr)*strength;
    const len=Math.sqrt(dx*dx+dy*dy+1);
    const i=(y*w+x)*4;
    d[i]=((-dx/len)*0.5+0.5)*255;
    d[i+1]=((dy/len)*0.5+0.5)*255;
    d[i+2]=(1/len)*0.5*255+127;
    d[i+3]=255;
  }
  g.putImageData(img,0,0);
  return out;
}

function noiseFill(g,w,h,rnd,alpha,scale){
  for(let i=0;i<w*h/(scale*scale)*0.5;i++){
    const x=rnd()*w,y=rnd()*h,r=scale*(0.5+rnd());
    g.fillStyle='rgba('+(rnd()<0.5?'0,0,0':'255,255,255')+','+(alpha*rnd())+')';
    g.beginPath();g.arc(x,y,r,0,6.283);g.fill();
  }
}

/* ---------- spruce: fine straight grain (top plates) ---------- */
export function spruceSet(seed,W=1024,H=1024){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  const hc=cnv(W,H),hg=hc.getContext('2d');
  const grd=g.createLinearGradient(0,0,W,0);
  grd.addColorStop(0,'#e8d3a6');grd.addColorStop(0.45,'#eed9ae');grd.addColorStop(0.55,'#ecd7ab');grd.addColorStop(1,'#e4cf9f');
  g.fillStyle=grd;g.fillRect(0,0,W,H);
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  let x=2;
  while(x<W){
    const sp=5+rnd()*11, wob=rnd()*5, ph=rnd()*6.28, wdt=0.8+rnd()*1.6;
    const dark=0.22+rnd()*0.30;
    g.strokeStyle='rgba(146,104,52,'+dark+')';g.lineWidth=wdt;
    hg.strokeStyle='rgba(40,40,40,'+(dark*0.9)+')';hg.lineWidth=wdt+0.6;
    for(const ctx of [g,hg]){
      ctx.beginPath();
      for(let y=0;y<=H;y+=12){const xx=x+Math.sin(y*0.003+ph)*wob;y===0?ctx.moveTo(xx,y):ctx.lineTo(xx,y);}
      ctx.stroke();
    }
    // hair line beside (spruce早材/晩材)
    g.strokeStyle='rgba(210,180,120,'+(dark*0.5)+')';g.lineWidth=0.7;
    g.beginPath();
    for(let y=0;y<=H;y+=12){const xx=x+1.6+Math.sin(y*0.003+ph)*wob;y===0?g.moveTo(xx,y):g.lineTo(xx,y);}
    g.stroke();
    x+=sp;
  }
  // medullary flecks
  for(let i=0;i<260;i++){
    const fx=rnd()*W,fy=rnd()*H;
    g.fillStyle='rgba(255,244,214,'+(0.05+rnd()*0.09)+')';
    g.fillRect(fx,fy,1.2+rnd()*2.4,4+rnd()*10);
  }
  noiseFill(g,W,H,rnd,0.016,3);
  const r=cnv(W,H),rg=r.getContext('2d');
  rg.fillStyle='#8f8f8f';rg.fillRect(0,0,W,H); // mid rough (raw wood)
  noiseFill(rg,W,H,rnd,0.10,4);
  return {albedo:a,height:hc,rough:r};
}

/* ---------- maple with flame (back / ribs / neck) ---------- */
export function mapleSet(seed,W=1024,H=1024){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  const hc=cnv(W,H),hg=hc.getContext('2d');
  const grd=g.createLinearGradient(0,0,W,0);
  grd.addColorStop(0,'#dcae66');grd.addColorStop(0.5,'#e6bc78');grd.addColorStop(1,'#d8a860');
  g.fillStyle=grd;g.fillRect(0,0,W,H);
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  const freq=0.050+rnd()*0.02, ph=rnd()*6.28, ph2=rnd()*6.28;
  for(let y=0;y<H;y++){
    const s=Math.sin(y*freq+ph+Math.sin(y*0.011+ph2)*1.5);
    const k=Math.pow(Math.abs(s),1.5);
    g.fillStyle=s>0?'rgba(255,238,196,'+(k*0.34)+')':'rgba(122,76,30,'+(k*0.28)+')';
    g.fillRect(0,y,W,1);
    hg.fillStyle=s>0?'rgba(226,226,226,'+(k*0.5)+')':'rgba(30,30,30,'+(k*0.5)+')';
    hg.fillRect(0,y,W,1);
  }
  for(let i=0;i<20;i++){
    const x=rnd()*W;
    g.strokeStyle='rgba(140,92,40,0.09)';g.lineWidth=1+rnd()*2;
    g.beginPath();g.moveTo(x,0);g.lineTo(x+(rnd()*40-20),H);g.stroke();
  }
  noiseFill(g,W,H,rnd,0.014,3);
  const r=cnv(W,H),rg=r.getContext('2d');
  rg.fillStyle='#8a8a8a';rg.fillRect(0,0,W,H);
  // flame modulates roughness a touch (chatoyance hint)
  for(let y=0;y<H;y+=2){
    const s=Math.sin(y*freq+ph);
    rg.fillStyle=s>0?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)';
    rg.fillRect(0,y,W,2);
  }
  return {albedo:a,height:hc,rough:r};
}

/* ---------- ebony ---------- */
export function ebonySet(seed=7,W=512,H=512){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  g.fillStyle='#191310';g.fillRect(0,0,W,H);
  for(let i=0;i<70;i++){
    const x=rnd()*W;
    g.strokeStyle='rgba('+(rnd()<0.5?'8,5,4':'52,40,30')+','+(0.25+rnd()*0.3)+')';
    g.lineWidth=0.8+rnd()*2;
    g.beginPath();g.moveTo(x,0);g.lineTo(x+(rnd()*24-12),H);g.stroke();
  }
  const hcv=cnv(W,H),hg=hcv.getContext('2d');
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  noiseFill(hg,W,H,rnd,0.05,2);
  const r=cnv(W,H),rg=r.getContext('2d');
  rg.fillStyle='#4a4a4a';rg.fillRect(0,0,W,H); // polished
  noiseFill(rg,W,H,rnd,0.06,3);
  return {albedo:a,height:hcv,rough:r};
}

/* ---------- worn bench top ---------- */
export function benchSet(seed=31,W=1024,H=1024){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  const hc=cnv(W,H),hg=hc.getContext('2d');
  const grd=g.createLinearGradient(0,0,0,H);
  grd.addColorStop(0,'#8a6a44');grd.addColorStop(0.5,'#94724a');grd.addColorStop(1,'#84643e');
  g.fillStyle=grd;g.fillRect(0,0,W,H);
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  // plank joints along X (bench boards run lengthwise)
  for(let i=1;i<4;i++){
    const y=H*i/4+(rnd()*20-10);
    g.strokeStyle='rgba(30,18,8,0.55)';g.lineWidth=2.5;
    g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();
    hg.strokeStyle='rgba(0,0,0,0.8)';hg.lineWidth=3;
    hg.beginPath();hg.moveTo(0,y);hg.lineTo(W,y);hg.stroke();
  }
  // long grain
  for(let i=0;i<160;i++){
    const y=rnd()*H;
    g.strokeStyle='rgba('+(rnd()<0.6?'60,38,18':'150,116,74')+','+(0.10+rnd()*0.16)+')';
    g.lineWidth=0.8+rnd()*1.8;
    g.beginPath();g.moveTo(0,y);
    g.bezierCurveTo(W*0.3,y+rnd()*8-4,W*0.7,y+rnd()*8-4,W,y+rnd()*6-3);
    g.stroke();
  }
  // wear: darker glue/oil patches
  for(let i=0;i<26;i++){
    const x=rnd()*W,y=rnd()*H,r0=30+rnd()*110;
    const rad=g.createRadialGradient(x,y,2,x,y,r0);
    const dark=rnd()<0.7;
    rad.addColorStop(0,dark?'rgba(40,24,10,'+(0.12+rnd()*0.2)+')':'rgba(210,190,150,'+(0.06+rnd()*0.1)+')');
    rad.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=rad;g.beginPath();g.arc(x,y,r0,0,6.283);g.fill();
  }
  // scratches + dents
  for(let i=0;i<120;i++){
    const x=rnd()*W,y=rnd()*H,len=8+rnd()*70,ang=rnd()*6.28;
    g.strokeStyle='rgba('+(rnd()<0.5?'35,20,8':'190,165,120')+','+(0.15+rnd()*0.25)+')';
    g.lineWidth=0.7+rnd()*1.2;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(ang)*len,y+Math.sin(ang)*len);g.stroke();
    hg.strokeStyle='rgba(20,20,20,'+(0.3+rnd()*0.4)+')';hg.lineWidth=1+rnd()*1.5;
    hg.beginPath();hg.moveTo(x,y);hg.lineTo(x+Math.cos(ang)*len,y+Math.sin(ang)*len);hg.stroke();
  }
  for(let i=0;i<40;i++){ // dents
    const x=rnd()*W,y=rnd()*H,r0=2+rnd()*6;
    hg.fillStyle='rgba(30,30,30,0.5)';hg.beginPath();hg.arc(x,y,r0,0,6.283);hg.fill();
    g.fillStyle='rgba(40,26,12,0.25)';g.beginPath();g.arc(x,y,r0,0,6.283);g.fill();
  }
  const r=cnv(W,H),rg=r.getContext('2d');
  rg.fillStyle='#9a9a9a';rg.fillRect(0,0,W,H);
  for(let i=0;i<30;i++){ // polished wear spots are smoother
    const x=rnd()*W,y=rnd()*H,r0=40+rnd()*90;
    const rad=rg.createRadialGradient(x,y,2,x,y,r0);
    rad.addColorStop(0,'rgba(70,70,70,'+(0.3+rnd()*0.3)+')');
    rad.addColorStop(1,'rgba(0,0,0,0)');
    rg.fillStyle=rad;rg.beginPath();rg.arc(x,y,r0,0,6.283);rg.fill();
  }
  return {albedo:a,height:hc,rough:r};
}

/* ---------- floor planks ---------- */
export function floorSet(seed=77,W=1024,H=1024){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  const hc=cnv(W,H),hg=hc.getContext('2d');
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  const rows=6;
  for(let i=0;i<rows;i++){
    const y0=H*i/rows,hh=H/rows;
    const tone=0.85+rnd()*0.3;
    g.fillStyle='rgb('+Math.round(122*tone)+','+Math.round(88*tone)+','+Math.round(56*tone)+')';
    g.fillRect(0,y0,W,hh);
    for(let k=0;k<40;k++){
      const y=y0+rnd()*hh;
      g.strokeStyle='rgba('+(rnd()<0.6?'52,34,16':'160,124,80')+','+(0.12+rnd()*0.18)+')';
      g.lineWidth=0.8+rnd()*2;
      g.beginPath();g.moveTo(0,y);g.bezierCurveTo(W*0.3,y+rnd()*6-3,W*0.7,y+rnd()*6-3,W,y+rnd()*4-2);g.stroke();
    }
    // butt joint
    const bx=rnd()*W;
    g.strokeStyle='rgba(25,14,6,0.6)';g.lineWidth=2;
    g.beginPath();g.moveTo(bx,y0);g.lineTo(bx,y0+hh);g.stroke();
    hg.strokeStyle='rgba(0,0,0,0.7)';hg.lineWidth=2.5;
    hg.beginPath();hg.moveTo(bx,y0);hg.lineTo(bx,y0+hh);hg.stroke();
    // gaps between planks
    g.strokeStyle='rgba(20,10,4,0.75)';g.lineWidth=3;
    g.beginPath();g.moveTo(0,y0);g.lineTo(W,y0);g.stroke();
    hg.strokeStyle='rgba(0,0,0,0.9)';hg.lineWidth=4;
    hg.beginPath();hg.moveTo(0,y0);hg.lineTo(W,y0);hg.stroke();
  }
  noiseFill(g,W,H,rnd,0.02,4);
  const r=cnv(W,H),rg=r.getContext('2d');
  rg.fillStyle='#a8a8a8';rg.fillRect(0,0,W,H);
  noiseFill(rg,W,H,rnd,0.1,5);
  return {albedo:a,height:hc,rough:r};
}

/* ---------- plaster wall ---------- */
export function plasterSet(seed=91,W=512,H=512){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  g.fillStyle='#b6a58c';g.fillRect(0,0,W,H);
  for(let i=0;i<1600;i++){
    const x=rnd()*W,y=rnd()*H,r0=1+rnd()*4;
    g.fillStyle='rgba('+(rnd()<0.5?'90,78,60':'205,192,168')+','+(rnd()*0.08)+')';
    g.beginPath();g.arc(x,y,r0,0,6.283);g.fill();
  }
  // stains near bottom
  for(let i=0;i<8;i++){
    const x=rnd()*W,y=H*0.6+rnd()*H*0.4,r0=30+rnd()*80;
    const rad=g.createRadialGradient(x,y,4,x,y,r0);
    rad.addColorStop(0,'rgba(96,80,58,'+(0.06+rnd()*0.09)+')');
    rad.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=rad;g.beginPath();g.arc(x,y,r0,0,6.283);g.fill();
  }
  const hcv=cnv(W,H),hg=hcv.getContext('2d');
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  for(let i=0;i<2600;i++){
    const x=rnd()*W,y=rnd()*H,r0=0.5+rnd()*1.6;
    hg.fillStyle='rgba('+(rnd()<0.5?'96,96,96':'150,150,150')+','+(rnd()*0.35)+')';
    hg.beginPath();hg.arc(x,y,r0,0,6.283);hg.fill();
  }
  return {albedo:a,height:hcv};
}

/* ---------- scratched metal ---------- */
export function metalSet(seed=13,W=512,H=512){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  g.fillStyle='#8d9298';g.fillRect(0,0,W,H);
  for(let i=0;i<420;i++){
    const y=rnd()*H;
    g.strokeStyle='rgba('+(rnd()<0.5?'60,62,66':'200,206,212')+','+(0.06+rnd()*0.12)+')';
    g.lineWidth=0.6+rnd()*1.2;
    g.beginPath();g.moveTo(0,y);g.lineTo(W,y+rnd()*8-4);g.stroke();
  }
  const r=cnv(W,H),rg=r.getContext('2d');
  rg.fillStyle='#6a6a6a';rg.fillRect(0,0,W,H);
  for(let i=0;i<200;i++){
    const y=rnd()*H;
    rg.strokeStyle='rgba('+(rnd()<0.5?'40,40,40':'150,150,150')+',0.15)';
    rg.lineWidth=1;
    rg.beginPath();rg.moveTo(0,y);rg.lineTo(W,y+rnd()*6-3);rg.stroke();
  }
  return {albedo:a,rough:r};
}

/* ---------- view outside window: bright soft garden ---------- */
export function outsideSet(seed=3,W=512,H=512){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  const grd=g.createLinearGradient(0,0,0,H);
  grd.addColorStop(0,'#dfeef8');grd.addColorStop(0.55,'#cfe4ea');grd.addColorStop(0.62,'#a8c890');grd.addColorStop(1,'#78a35e');
  g.fillStyle=grd;g.fillRect(0,0,W,H);
  for(let i=0;i<50;i++){ // soft foliage blobs
    const x=rnd()*W,y=H*0.35+rnd()*H*0.6,r0=18+rnd()*50;
    const rad=g.createRadialGradient(x,y,2,x,y,r0);
    const gcol=rnd()<0.5?'120,160,90':'90,130,66';
    rad.addColorStop(0,'rgba('+gcol+',0.5)');rad.addColorStop(1,'rgba('+gcol+',0)');
    g.fillStyle=rad;g.beginPath();g.arc(x,y,r0,0,6.283);g.fill();
  }
  for(let i=0;i<24;i++){ // sun sparkle
    const x=rnd()*W,y=rnd()*H*0.6,r0=4+rnd()*10;
    const rad=g.createRadialGradient(x,y,1,x,y,r0);
    rad.addColorStop(0,'rgba(255,252,235,0.8)');rad.addColorStop(1,'rgba(255,252,235,0)');
    g.fillStyle=rad;g.beginPath();g.arc(x,y,r0,0,6.283);g.fill();
  }
  return {albedo:a};
}

/* ---------- linen cloth ---------- */
export function linenSet(seed=5,W=256,H=256){
  const rnd=mulberry(seed);
  const a=cnv(W,H),g=a.getContext('2d');
  g.fillStyle='#cfc4ae';g.fillRect(0,0,W,H);
  for(let x=0;x<W;x+=2){g.fillStyle='rgba(90,80,62,'+(0.05+(x%4?0:0.05))+')';g.fillRect(x,0,1,H);}
  for(let y=0;y<H;y+=2){g.fillStyle='rgba(90,80,62,'+(0.05+(y%4?0:0.05))+')';g.fillRect(0,y,W,1);}
  const hcv=cnv(W,H),hg=hcv.getContext('2d');
  hg.fillStyle='#808080';hg.fillRect(0,0,W,H);
  for(let x=0;x<W;x+=2){hg.fillStyle='rgba(40,40,40,0.3)';hg.fillRect(x,0,1,H);}
  for(let y=0;y<H;y+=2){hg.fillStyle='rgba(160,160,160,0.2)';hg.fillRect(0,y,W,1);}
  return {albedo:a,height:hcv};
}

/* blob contact shadow texture */
export function blobShadow(W=256){
  const a=cnv(W,W),g=a.getContext('2d');
  const rad=g.createRadialGradient(W/2,W/2,W*0.05,W/2,W/2,W*0.5);
  rad.addColorStop(0,'rgba(0,0,0,0.55)');
  rad.addColorStop(0.6,'rgba(0,0,0,0.25)');
  rad.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rad;g.fillRect(0,0,W,W);
  return a;
}
