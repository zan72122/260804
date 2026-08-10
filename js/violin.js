/* violin assembly with runtime APIs: f-hole cutting, varnish painting, string tension */
import * as THREE from '../lib/three.module.min.js';
import * as GEO from './geometry.js';
import * as TX from './textures.js';
import {varnishOverlayMat,VARNISH_COLORS} from './world.js';

const BL=GEO.BL;
export {BL};

const PLATE_W=BL*0.62;
export function plateUVpx(x,y,S=1024){return [ (x/PLATE_W+0.5)*S, (1-y/BL)*S ];}

export const STRING_FREQS=[196,293.66,440,659.25];
const BR_X=[-0.51,-0.17,0.17,0.51];
const NUT_X=[-0.28,-0.095,0.095,0.28];
const TAIL_X=[-0.36,-0.12,0.12,0.36];
export const PEGS=[ // body coords
  {x:-1.25,y:-14.7,side:-1},{x:-1.25,y:-16.4,side:-1},
  {x:1.25,y:-15.5,side:1},{x:1.25,y:-17.1,side:1}];

export function buildViolin(M){
  const grp=new THREE.Group();
  const V={group:grp};

  // ---- paintable top albedo + alpha ----
  const S=1024;
  const topAlbedo=TX.cnv(S,S);
  topAlbedo.getContext('2d').drawImage(M.spruceSets.albedo,0,0,S,S);
  drawPurfling(topAlbedo);
  const topAlpha=TX.cnv(S,S);
  const ag=topAlpha.getContext('2d');ag.fillStyle='#fff';ag.fillRect(0,0,S,S);
  V.topAlbedo=topAlbedo;V.topAlpha=topAlpha;

  const backAlbedo=TX.cnv(S,S);
  backAlbedo.getContext('2d').drawImage(M.mapleSets.albedo,0,0,S,S);
  drawPurfling(backAlbedo);

  const topMat=M.spruce.clone();
  topMat.map=TX.tex(topAlbedo);
  topMat.alphaMap=TX.tex(topAlpha,{srgb:false});
  topMat.alphaTest=0.5;
  V.topMat=topMat;
  const backMat=M.maple.clone();
  backMat.map=TX.tex(backAlbedo);

  // ---- plates & ribs ----
  const topGeo=GEO.makePlateGeo(BL,{arch:1.55});
  const backGeo=GEO.makePlateGeo(BL,{arch:1.35,down:true});
  V.top=new THREE.Mesh(topGeo,topMat);
  V.back=new THREE.Mesh(backGeo,backMat);
  V.back.position.z=-3.05;
  V.ribs=new THREE.Mesh(GEO.makeRibsGeo(BL),M.mapleRib);
  for(const m of[V.top,V.back,V.ribs]){m.castShadow=true;m.receiveShadow=true;grp.add(m);}

  // ---- varnish overlays (shared planar mask) ----
  const mask=TX.cnv(512,512);
  const mg=mask.getContext('2d');mg.fillStyle='#000';mg.fillRect(0,0,512,512);
  const maskTex=TX.tex(mask,{srgb:false});
  V.varnishMask=mask;V.varnishMaskTex=maskTex;
  V.overlays=[];
  const addOverlay=(srcMesh,geo,zOff=0)=>{
    const g2=planarUVLocal(geo);
    const ov=new THREE.Mesh(g2,varnishOverlayMat(M,'amber',maskTex));
    ov.position.copy(srcMesh.position);
    ov.renderOrder=2;
    grp.add(ov);
    V.overlays.push(ov);
    return ov;
  };
  addOverlay(V.top,topGeo);
  const ovBack=addOverlay(V.back,backGeo);
  addOverlay(V.ribs,GEO.makeRibsGeo(BL,{thick:0.22}));
  // top overlay must respect f-hole alpha: multiply handled by combined canvas? keep simple: overlay drawn with depthWrite false above; f-hole area sits above hole—acceptable at small size
  V.setVarnishColor=(name)=>{
    const v=VARNISH_COLORS[name];
    V.overlays.forEach(o=>{o.material.color.setHex(v.tint);o.material.clearcoatRoughness=v.cc;});
    V.varnishName=name;
  };
  V.varnishName='amber';

  // ---- neck / fingerboard / scroll / pegs ----
  const neck=new THREE.Group();
  const neckMesh=new THREE.Mesh(GEO.makeNeckGeo(),M.maple);
  neckMesh.castShadow=true;
  neck.add(neckMesh);
  const fb=new THREE.Mesh(GEO.makeFingerboardGeo(),M.ebony);
  fb.position.set(0,-6.6,1.55);
  fb.castShadow=true;
  neck.add(fb);
  const nut=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.5,0.5),M.ebony);
  nut.position.set(0,13.5,2.0);
  neck.add(nut);
  const pegbox=GEO.makePegboxGroup(M.maple,M.ebony);
  pegbox.position.set(0,18.6,1.1);
  pegbox.rotation.x=0.28;
  neck.add(pegbox);
  const scroll=GEO.makeScrollGroup(M.maple);
  scroll.position.set(0,19.6,1.6);
  scroll.rotation.x=0.3;
  scroll.scale.set(1,1,1);
  neck.add(scroll);
  scroll.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  V.pegs=[];
  PEGS.forEach((p,i)=>{
    const peg=GEO.makePegGroup(M.ebony);
    if(p.side<0)peg.rotation.z=Math.PI;
    peg.position.set(0, -p.y-13.2+13.2, 0); // placeholder; set below in neck coords
    // neck local: +y toward nut; body y=-14.7 -> neck local y = 14.7
    peg.position.set(0, -p.y, 1.0);
    peg.userData.side=p.side;
    neck.add(peg);
    V.pegs.push(peg);
  });
  neck.rotation.z=Math.PI;      // extend toward -Y body
  neck.rotation.x=-0.13;        // nut rises above top
  neck.position.set(0,0.6,1.05);
  V.neck=neck;
  grp.add(neck);

  // ---- tailpiece & saddle & endpin ----
  const tail=new THREE.Mesh(GEO.makeTailpieceGeo(),M.ebony);
  tail.rotation.x=0.16;
  tail.rotation.z=Math.PI;      // wide end toward bridge; length runs -Y
  tail.position.set(0,BL*0.985,2.8);
  tail.castShadow=true;
  V.tailpiece=tail;
  grp.add(tail);
  const saddle=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.8,0.8),M.ebony);
  saddle.position.set(0,BL*0.995,0.55);
  grp.add(saddle);

  // ---- bridge ----
  const bridge=new THREE.Mesh(GEO.makeBridgeGeo(),M.spruce.clone());
  bridge.material.map=null;bridge.material.color.setHex(0xdec089);
  bridge.geometry.rotateX(Math.PI/2);
  bridge.position.set(0,BL*0.545,1.52);
  bridge.castShadow=true;
  V.bridge=bridge;
  grp.add(bridge);

  // ---- strings ----
  V.strings=[];
  for(let i=0;i<4;i++){
    const sm=new THREE.Mesh(new THREE.BufferGeometry(),M.stringMat);
    sm.castShadow=false;
    grp.add(sm);
    V.strings.push(sm);
  }
  V.stringPts=(i,tension=1,fingerY=null)=>{
    const crown=1.52+2.9-Math.abs(BR_X[i])*0.5;
    const tailA=new THREE.Vector3(TAIL_X[i],BL*0.71,2.75);
    const brP=new THREE.Vector3(BR_X[i],BL*0.545,crown);
    const nutW=new THREE.Vector3(NUT_X[i],-12.9,2.15);
    const pg=PEGS[i];
    const pegP=new THREE.Vector3(pg.x*0.5,pg.y,1.4);
    return {tailA,brP,nutW,pegP};
  };
  V.setString=(i,tension)=>{
    const {tailA,brP,nutW,pegP}=V.stringPts(i);
    const sag=(1-tension)*1.5;
    const mid=brP.clone().lerp(nutW,0.5);mid.z-=sag;mid.x+=sag*0.3;
    const curve=new THREE.CatmullRomCurve3([tailA,brP,mid,nutW,pegP],false,'catmullrom',0.02);
    const r=0.05-i*0.005;
    const g=new THREE.TubeGeometry(curve,24,Math.max(0.028,r),6,false);
    V.strings[i].geometry.dispose();
    V.strings[i].geometry=g;
  };
  V.showStrings=(n)=>{V.strings.forEach((s,i)=>s.visible=i<n);};
  V.showStrings(0);

  // ---- soundpost ----
  const post=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,4.0,10),M.postWood);
  post.rotation.x=Math.PI/2;
  post.position.set(1.9,BL*0.575,-0.95);
  V.soundpost=post;
  post.visible=false;
  grp.add(post);

  // ---- interior shell darkener (subtle, seen through f-holes) ----
  const inner=new THREE.Mesh(GEO.makeRibsGeo(BL,{thick:0.01,height:2.9,z0:-0.05}),
    new THREE.MeshStandardMaterial({color:0x241608,roughness:0.95,side:THREE.BackSide}));
  grp.add(inner);
  // dark shadow plate right under the top: f-holes open into darkness
  const innerShadow=new THREE.Mesh(GEO.makePlateGeo(BL,{arch:1.1}),
    new THREE.MeshStandardMaterial({color:0x160d06,roughness:1}));
  innerShadow.scale.set(0.985,0.99,0.55);
  innerShadow.position.z=-1.35;
  grp.add(innerShadow);
  V.innerShadow=innerShadow;

  // ---- f-hole runtime carving ----
  V.fholeProg=[0,0];
  V.setFholeProgress=(side,prog)=>{
    const idx=side<0?0:1;
    V.fholeProg[idx]=prog;
    redrawFholes(V);
  };
  V.setTranslucent=(k)=>{ // k=0 solid, 1 = fully see-through-ish
    topMat.transparent=k>0;
    topMat.opacity=1-k*0.60;
    topMat.depthWrite=k<=0;
    topMat.alphaTest=k>0?0.05:0.5; // alphaTest must stay below opacity while ghosted
    V.overlays[0].visible=k<=0;
    if(V.innerShadow)V.innerShadow.visible=k<=0; // open the cavity for the peek inside
    topMat.needsUpdate=true;
  };
  const maskPx=(x,y)=>[(x/(BL*0.75)+0.5)*512,(1-((y-BL*0.5)/(BL*1.25)+0.5))*512];
  const punchFholesInMask=()=>{ // keep f-hole openings free of varnish overlay
    mg.save();
    mg.fillStyle='#000';mg.strokeStyle='#000';mg.lineCap='round';
    for(const side of[-1,1]){
      const spine=GEO.fSpine(BL,side,30);
      mg.lineWidth=(BL*0.014)/(BL*0.75)*512;
      mg.beginPath();
      spine.forEach((p,i)=>{const [px,py]=maskPx(p.x,p.y);i?mg.lineTo(px,py):mg.moveTo(px,py);});
      mg.stroke();
      const ends=[[spine[0],BL*0.018],[spine[spine.length-1],BL*0.022]];
      for(const [e,r] of ends){
        const [px,py]=maskPx(e.x,e.y);
        mg.beginPath();mg.arc(px,py,r/(BL*0.75)*512,0,6.283);mg.fill();
      }
    }
    mg.restore();
  };
  V.paintVarnish=(x,y,r)=>{
    const [u,v]=maskPx(x,y);
    mg.fillStyle='#fff';
    mg.beginPath();mg.arc(u,v,r,0,6.283);mg.fill();
    punchFholesInMask();
    maskTex.needsUpdate=true;
  };
  V.fillVarnish=()=>{mg.fillStyle='#fff';mg.fillRect(0,0,512,512);punchFholesInMask();maskTex.needsUpdate=true;};
  V.clearVarnish=()=>{mg.fillStyle='#000';mg.fillRect(0,0,512,512);maskTex.needsUpdate=true;};

  // visibility helpers for build stages
  V.stage=(s)=>{ // 'body','withNeck','full'
    const hasNeck=s!=='body';
    neck.visible=hasNeck;
    tail.visible=s==='full';
    saddle.visible=s==='full';
    bridge.visible=false;
    V.strings.forEach(m=>m.visible=false);
  };
  return V;
}
function planarUVLocal(geo){
  const g=geo.clone();
  const p=g.getAttribute('position');
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    uv[i*2]=(p.getX(i)/(BL*0.75))+0.5;
    uv[i*2+1]=((p.getY(i)-BL*0.5)/(BL*1.25))+0.5;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return g;
}

function drawPurfling(canvas){
  const g=canvas.getContext('2d');
  const S=canvas.width;
  const loop=GEO.outlinePts(BL,200);
  const toPx=(x,y,scale)=>{
    const cx=0,cy=BL*0.5;
    const px=((cx+(x-cx)*scale)/PLATE_W+0.5)*S;
    const py=(1-(cy+(y-cy)*scale)/BL)*S;
    return [px,py];
  };
  // edge darkening
  g.save();
  g.strokeStyle='rgba(70,42,16,0.55)';g.lineWidth=S*0.012;
  g.beginPath();
  loop.forEach((p,i)=>{const [px,py]=toPx(p.x,p.y,0.995);i?g.lineTo(px,py):g.moveTo(px,py);});
  g.closePath();g.stroke();
  // purfling: black-white-black inlay
  g.strokeStyle='rgba(24,14,6,0.9)';g.lineWidth=S*0.006;
  g.beginPath();
  loop.forEach((p,i)=>{const [px,py]=toPx(p.x,p.y,0.955);i?g.lineTo(px,py):g.moveTo(px,py);});
  g.closePath();g.stroke();
  g.strokeStyle='rgba(235,220,190,0.65)';g.lineWidth=S*0.002;
  g.beginPath();
  loop.forEach((p,i)=>{const [px,py]=toPx(p.x,p.y,0.955);i?g.lineTo(px,py):g.moveTo(px,py);});
  g.closePath();g.stroke();
  g.restore();
}

function redrawFholes(V){
  const S=V.topAlpha.width;
  const ag=V.topAlpha.getContext('2d');
  ag.fillStyle='#fff';ag.fillRect(0,0,S,S);
  const alb=V.topAlbedo.getContext('2d');
  for(const side of[-1,1]){
    const prog=V.fholeProg[side<0?0:1];
    if(prog<=0)continue;
    const spine=GEO.fSpine(BL,side,40);
    const n=Math.max(2,Math.floor(spine.length*Math.min(1,prog)));
    const w=BL*0.012;
    const px=p=>plateUVpx(p.x,p.y,S);
    // AO rim in albedo (soft dark halo, drawn progressively — carve shadow)
    alb.save();
    alb.strokeStyle='rgba(60,36,14,0.25)';
    alb.lineCap='round';alb.lineWidth=(w*2.4)/PLATE_W*S;
    alb.beginPath();
    for(let i=0;i<n;i++){const [x,y]=px(spine[i]);i?alb.lineTo(x,y):alb.moveTo(x,y);}
    alb.stroke();
    alb.restore();
    // alpha cut
    ag.save();
    ag.strokeStyle='#000';ag.fillStyle='#000';
    ag.lineCap='round';ag.lineWidth=w/PLATE_W*S;
    ag.beginPath();
    for(let i=0;i<n;i++){const [x,y]=px(spine[i]);i?ag.lineTo(x,y):ag.moveTo(x,y);}
    ag.stroke();
    const [ex0,ey0]=px(spine[0]);
    ag.beginPath();ag.arc(ex0,ey0,(BL*0.0165)/PLATE_W*S,0,6.283);ag.fill();
    if(prog>=0.98){
      const e=spine[spine.length-1];
      const [ex,ey]=px(e);
      ag.beginPath();ag.arc(ex,ey,(BL*0.020)/PLATE_W*S,0,6.283);ag.fill();
      const m=spine[Math.floor(spine.length*0.5)];
      const [mx,my]=px(m);
      ag.lineWidth=(BL*0.008)/PLATE_W*S;
      ag.beginPath();ag.moveTo(mx-(BL*0.014*side)/PLATE_W*S,my);ag.lineTo(mx-(BL*0.026*side)/PLATE_W*S,my);ag.stroke();
      ag.beginPath();ag.moveTo(mx+(BL*0.012*side)/PLATE_W*S,my+5);ag.lineTo(mx+(BL*0.024*side)/PLATE_W*S,my+5);ag.stroke();
    }
    ag.restore();
  }
  V.topMat.map.needsUpdate=true;
  V.topMat.alphaMap.needsUpdate=true;
}
