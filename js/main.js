/* くるっ、キュッ、ポン！ヴァイオリン工房 — realtime 3D (three.js) */
import * as THREE from '../lib/three.module.min.js';
import {AudioSys} from './audio.js';
import * as TX from './textures.js';
import * as GEO from './geometry.js';
import {buildMaterials,buildWorld,VARNISH_COLORS} from './world.js';
import {buildViolin,BL,STRING_FREQS,PEGS} from './violin.js';

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
window.__BOOTS=(window.__BOOTS||0)+1;

/* ================= renderer ================= */
const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x241a10);
scene.fog=new THREE.Fog(0x241a10,420,900);
const camera=new THREE.PerspectiveCamera(45,1,2,1500);
let W=innerWidth,H=innerHeight;
function resize(){
  W=innerWidth;H=innerHeight;
  renderer.setSize(W,H);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  camera.aspect=W/H;camera.updateProjectionMatrix();
}
addEventListener('resize',()=>setTimeout(resize,60));
resize();
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

/* ================= world & violin ================= */
let SEED=12345;
let M=buildMaterials(SEED);
const world=buildWorld(scene,M);
const BY=world.benchY;
let V=buildViolin(M);
scene.add(V.group);

/* violin visibility helper */
function showParts(p){
  V.top.visible=!!p.top;
  V.back.visible=!!p.back;
  V.ribs.visible=!!p.ribs;
  V.group.children.forEach(()=>{});
  V.neck.visible=!!p.neck;
  V.tailpiece.visible=!!p.tail;
  V.bridge.visible=!!p.bridge;
  V.soundpost.visible=!!p.post;
  V.showStrings(p.strings||0);
  V.overlays.forEach(o=>o.visible=p.varnish!==false);
  // find saddle+inner: keep with body
  V.group.traverse(o=>{});
}
V.group.visible=false;

/* hanging finished violins on wall (background flavor) */
for(let i=0;i<2;i++){
  const hv=buildViolin(M);
  hv.setVarnishColor(i?'red':'amber');
  hv.fillVarnish();
  hv.top.visible=hv.back.visible=hv.ribs.visible=hv.neck.visible=true;
  hv.tailpiece.visible=true;hv.bridge.visible=true;hv.showStrings(4);
  for(let s=0;s<4;s++)hv.setString(s,1);
  hv.setFholeProgress(-1,1);hv.setFholeProgress(1,1);
  hv.group.rotation.set(Math.PI,Math.PI,0.06*(i?1:-1));
  hv.group.position.copy(world.hangSlots[i]);
  hv.group.position.y=world.hangSlots[i].y-16;
  hv.group.scale.setScalar(0.92);
  scene.add(hv.group);
}

/* ================= props ================= */
const props={};
{
  // wood boards (viewing scene)
  const mkBoard=(tex,x)=>{
    const mat=new THREE.MeshPhysicalMaterial({map:TX.tex(tex.albedo),roughness:1,
      roughnessMap:TX.tex(tex.rough,{srgb:false}),
      normalMap:TX.tex(TX.normalFromHeight(tex.height,1.4),{srgb:false})});
    const b=new THREE.Mesh(new THREE.BoxGeometry(15,56,2.6),mat);
    b.castShadow=true;b.receiveShadow=true;
    b.position.set(x,BY+26,-58);
    b.rotation.x=0.16;
    return b;
  };
  props.boardS=mkBoard(M.spruceSets,-92);
  props.boardM=mkBoard(M.mapleSets,-72);
  scene.add(props.boardS,props.boardM);

  // bending iron station
  const iron=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(10,2.2,8),M.metal);
  base.position.y=1.1;base.castShadow=true;iron.add(base);
  const column=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.7,24,24),M.ironHot);
  column.scale.z=0.8;
  column.position.y=14;column.castShadow=true;iron.add(column);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(2.9,2.9,1.2,24),M.metal);
  cap.scale.z=0.8;cap.position.y=26.2;iron.add(cap);
  iron.position.set(78,BY,-8);
  scene.add(iron);
  props.iron=iron;props.ironMat=M.ironHot;
  { // emissive: hot in the middle band only
    const ec=TX.cnv(16,64);const g=ec.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,64);
    gr.addColorStop(0,'#000');gr.addColorStop(0.40,'#2a1608');
    gr.addColorStop(0.52,'#a03c0e');gr.addColorStop(0.60,'#c8500f');
    gr.addColorStop(0.70,'#2a1408');gr.addColorStop(1,'#000');
    g.fillStyle=gr;g.fillRect(0,0,16,64);
    M.ironHot.emissiveMap=TX.tex(ec,{srgb:false});
    M.ironHot.emissive.setHex(0xffffff);
    M.ironHot.color.setHex(0x54423a);
  }
  const heatLight=new THREE.PointLight(0xff6a20,0,60,2);
  heatLight.position.set(78,BY+14,-8);
  scene.add(heatLight);
  props.heatLight=heatLight;

  // bend strip (rebuilt per frame)
  props.strip=new THREE.Mesh(new THREE.BufferGeometry(),M.mapleRib.clone());
  props.strip.material.map=TX.tex(M.mapleSets.albedo,{repeat:[2,0.2]});
  props.strip.castShadow=true;
  scene.add(props.strip);
  props.strip.visible=false;

  // mold slab with real pocket
  const molds=new THREE.Shape();
  molds.moveTo(-16,-24);molds.lineTo(16,-24);molds.lineTo(16,24);molds.lineTo(-16,24);molds.closePath();
  const hole=new THREE.Path();
  const loop=GEO.outlinePts(BL,80);
  loop.forEach((p,i)=>{const x=p.x*1.03,y=(p.y-BL*0.5)*1.03;
    i?hole.lineTo(x,y):hole.moveTo(x,y);});
  hole.closePath();
  molds.holes.push(hole);
  const moldGeo=new THREE.ExtrudeGeometry(molds,{depth:3.4,bevelEnabled:false});
  const mold=new THREE.Mesh(moldGeo,M.benchLeg);
  mold.rotation.x=-Math.PI/2;
  mold.position.set(-34,BY+0.2,-14);
  mold.castShadow=true;mold.receiveShadow=true;
  scene.add(mold);
  props.mold=mold;
  // mold floor (inside pocket)
  const mf=new THREE.Mesh(new THREE.PlaneGeometry(30,44),M.benchLeg);
  mf.rotation.x=-Math.PI/2;
  mf.position.set(-34,BY+0.4,-14);
  scene.add(mf);
  props.moldFloor=mf;

  // free C-rib piece (after bending)
  props.cRib=new THREE.Mesh(new THREE.BufferGeometry(),M.mapleRib);
  props.cRib.castShadow=true;
  scene.add(props.cRib);
  props.cRib.visible=false;

  // rib garland partial (grows in mold)
  props.garland=new THREE.Mesh(new THREE.BufferGeometry(),M.mapleRib);
  props.garland.castShadow=true;
  props.garland.rotation.x=-Math.PI/2;
  props.garland.position.set(-34,BY+3.6,-14+BL*0.5);
  scene.add(props.garland);
  props.garland.visible=false;

  // plate blank with paintable top face
  props.blankCanvas=TX.cnv(1024,1024);
  const bg=props.blankCanvas.getContext('2d');
  bg.drawImage(M.spruceSets.albedo,0,0,1024,1024);
  props.blankTex=TX.tex(props.blankCanvas);
  const sideMat=M.spruce;
  const topFaceMat=new THREE.MeshPhysicalMaterial({map:props.blankTex,roughness:0.9,
    normalMap:M.spruce.normalMap});
  props.blank=new THREE.Mesh(new THREE.BoxGeometry(26,2.3,42),
    [sideMat,sideMat,topFaceMat,sideMat,sideMat,sideMat]);
  props.blank.position.set(-34,BY+1.15,-11);
  props.blank.castShadow=true;props.blank.receiveShadow=true;
  scene.add(props.blank);
  props.blank.visible=false;

  // soundpost free piece
  props.freePost=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,4.2,10),M.postWood);
  props.freePost.castShadow=true;
  scene.add(props.freePost);
  props.freePost.visible=false;

  // interior light for post reveal (child of violin group)
  props.innerLight=new THREE.PointLight(0xffd9a0,0,26,2);
  props.innerLight.position.set(0,BL*0.5,-1.4);
  V.group.add(props.innerLight);

  // varnish jars trio on a stool near hanging spot
  const stool=new THREE.Group();
  const st=new THREE.Mesh(new THREE.CylinderGeometry(13,11,3,18),M.benchLeg);
  st.position.y=46;st.castShadow=true;stool.add(st);
  for(let i=0;i<3;i++){
    const a=i/3*Math.PI*2+0.5;
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.9,46,10),M.darkWood);
    leg.position.set(Math.cos(a)*8,23,Math.sin(a)*8);
    leg.rotation.z=Math.cos(a)*0.12;leg.rotation.x=-Math.sin(a)*0.12;
    leg.castShadow=true;stool.add(leg);
  }
  props.jarMeshes=[];
  ['amber','red','rose'].forEach((k,i)=>{
    const jg=new THREE.Group();
    const glassJar=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.8,8.5,14),M.glass);
    const liquid=new THREE.Mesh(new THREE.CylinderGeometry(3.0,3.4,6.6,14),
      new THREE.MeshPhysicalMaterial({color:VARNISH_COLORS[k].tint,roughness:0.15,transmission:0.4,thickness:2}));
    liquid.position.y=-0.6;
    jg.add(glassJar,liquid);
    jg.position.set(-8+i*8,52,i%2?3:-3);
    jg.userData.varnish=k;
    jg.traverse(o=>{o.userData.varnish=k;if(o.isMesh)o.castShadow=true;});
    stool.add(jg);
    props.jarMeshes.push(jg);
  });
  stool.position.set(-96,0,8);
  scene.add(stool);
  props.varnishStool=stool;

  // hanging wire for varnish
  props.wire=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,60,6),M.metal);
  props.wire.position.set(-70,205,-20);
  scene.add(props.wire);
  props.wire.visible=false;

  // bridge free piece
  props.freeBridge=new THREE.Mesh(GEO.makeBridgeGeo(),V.bridge.material);
  props.freeBridge.castShadow=true;
  scene.add(props.freeBridge);
  props.freeBridge.visible=false;

  // bow
  const bow=new THREE.Group();
  const stickPath=[];
  for(let i=0;i<=12;i++){const t=i/12;
    stickPath.push(new THREE.Vector3(-32+t*64,Math.sin(t*Math.PI)*1.4,0));}
  const stick=new THREE.Mesh(GEO.sweep(stickPath,t=>0.42-t*0.14,{seg:8}),M.darkWood);
  bow.add(stick);
  const hair=new THREE.Mesh(new THREE.BoxGeometry(62,0.18,0.5),
    new THREE.MeshStandardMaterial({color:0xf2ecdc,roughness:0.8}));
  hair.position.y=-1.5;bow.add(hair);
  const frog=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.2,1.1),M.ebony);
  frog.position.set(-28,-0.6,0);bow.add(frog);
  bow.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  scene.add(bow);
  props.bow=bow;
  bow.visible=false;

  // hands
  props.handTool=GEO.makeHandGroup(M.skin,M.linen);
  props.handTool.visible=false;
  scene.add(props.handTool);
  props.tools={};
  const knife=new THREE.Group();
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.9,4.4,0.16),M.metal);
  blade.position.y=-3.4;knife.add(blade);
  const kh=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.9,5.4,10),M.benchLeg);
  kh.position.y=0.6;knife.add(kh);
  const gouge=new THREE.Group();
  const gb=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.62,5.2,10,1,true,0,Math.PI),M.metal);
  gb.position.y=-3.2;gouge.add(gb);
  const gh=new THREE.Mesh(new THREE.SphereGeometry(1.35,12,10),M.benchLeg);
  gh.scale.set(1,1.6,1);gh.position.y=1.4;gouge.add(gh);
  const brush=new THREE.Group();
  const bh=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.62,7,10),M.benchLeg);
  bh.position.y=1;brush.add(bh);
  const ferr=new THREE.Mesh(new THREE.CylinderGeometry(0.66,0.72,1.4,10),M.brass);
  ferr.position.y=-2.9;brush.add(ferr);
  const brist=new THREE.Mesh(new THREE.ConeGeometry(0.8,2.8,10),M.darkWood);
  brist.rotation.x=Math.PI;brist.position.y=-4.9;brush.add(brist);
  props.tools.knife=knife;props.tools.gouge=gouge;props.tools.brush=brush;
  for(const k in props.tools){props.tools[k].visible=false;
    props.tools[k].traverse(o=>{if(o.isMesh)o.castShadow=true;});
    props.handTool.add(props.tools[k]);
    props.tools[k].position.set(0,1.2,-1.6);
  }

  // gallery stand
  const stand=new THREE.Group();
  const sb=new THREE.Mesh(new THREE.CylinderGeometry(16,19,3,20),M.darkWood);
  sb.position.y=1.5;sb.castShadow=true;stand.add(sb);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.2,96,12),M.darkWood);
  sp.position.y=50;sp.castShadow=true;stand.add(sp);
  for(const s of[-1,1]){
    const prong=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,10,8),M.darkWood);
    prong.position.set(s*5,72,3);prong.rotation.z=s*0.5;prong.rotation.x=-0.5;
    prong.castShadow=true;stand.add(prong);
  }
  stand.position.set(-60,0,18);
  scene.add(stand);
  props.stand=stand;
  props.galleryRoot=new THREE.Group();
  props.galleryRoot.position.set(-60,0,18);
  scene.add(props.galleryRoot);

  // ribbon + deco
  props.ribbon=GEO.makeRibbonGroup(M.satinPink);
  props.ribbon.visible=false;
  props.rainbowMat=new THREE.MeshPhysicalMaterial({roughness:0.35,clearcoat:0.6,sheen:1});
  {
    const rc=TX.cnv(64,64);const g=rc.getContext('2d');
    const cols=['#ff8a8a','#ffc46a','#fff06a','#8ae08a','#8ab8ff','#c78aff'];
    cols.forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*64/6,64,64/6);});
    props.rainbowMat.map=TX.tex(rc);
  }
  V.group.add(props.ribbon);
  props.ribbon.position.set(0,-19.2,2.6);
  props.ribbon.rotation.x=Math.PI/2;
  props.ribbon.scale.setScalar(1.4);

  props.deco=new THREE.Group();
  // fairy lights catenary + paper stars
  const lightPts=[];
  for(let i=0;i<=24;i++){const t=i/24;
    lightPts.push(new THREE.Vector3(-140+t*180,208-Math.sin(t*Math.PI)*-24-0,-40+Math.sin(t*7)*4));}
  for(let i=0;i<=24;i+=2){
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(1.1,8,6),
      new THREE.MeshStandardMaterial({color:0xfff0c0,emissive:0xffcf80,emissiveIntensity:1.6}));
    bulb.position.copy(lightPts[i]);
    bulb.position.y=208-Math.sin(i/24*Math.PI)*22;
    props.deco.add(bulb);
  }
  const starShape=new THREE.Shape();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;
    const r=i%2?1.4:3.2;
    i?starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r):starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
  starShape.closePath();
  const starGeo=new THREE.ExtrudeGeometry(starShape,{depth:0.2,bevelEnabled:false});
  for(let i=0;i<5;i++){
    const st2=new THREE.Mesh(starGeo,M.paper);
    st2.position.set(-120+i*40,196-(i%2)*10,-30);
    st2.rotation.z=(i%2?0.3:-0.2);
    const thread=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,18,4),M.metal);
    thread.position.set(-120+i*40,206-(i%2)*10,-30);
    props.deco.add(st2,thread);
  }
  props.deco.visible=false;
  scene.add(props.deco);
}

/* ================= FX pools ================= */
const fx={steam:[],shave:[],glint:[]};
{
  const softC=TX.cnv(64,64);{const g=softC.getContext('2d');
    const r=g.createRadialGradient(32,32,2,32,32,30);
    r.addColorStop(0,'rgba(255,255,255,0.85)');r.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r;g.fillRect(0,0,64,64);}
  const softT=new THREE.CanvasTexture(softC);
  for(let i=0;i<36;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:softT,transparent:true,opacity:0,depthWrite:false}));
    s.scale.setScalar(3);scene.add(s);
    fx.steam.push({s,life:0,t:0,v:new THREE.Vector3()});
  }
  const glintC=TX.cnv(64,64);{const g=glintC.getContext('2d');
    g.strokeStyle='rgba(255,236,180,0.95)';g.lineWidth=4;g.lineCap='round';
    g.beginPath();g.moveTo(32,6);g.lineTo(32,58);g.moveTo(6,32);g.lineTo(58,32);g.stroke();
    g.strokeStyle='rgba(255,236,180,0.5)';g.lineWidth=2;
    g.beginPath();g.moveTo(14,14);g.lineTo(50,50);g.moveTo(50,14);g.lineTo(14,50);g.stroke();}
  const glintT=new THREE.CanvasTexture(glintC);
  for(let i=0;i<40;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glintT,transparent:true,opacity:0,
      depthWrite:false,blending:THREE.AdditiveBlending}));
    s.scale.setScalar(2);scene.add(s);
    fx.glint.push({s,life:0,t:0,v:new THREE.Vector3()});
  }
  const shaveGeo=new THREE.TorusGeometry(0.9,0.22,5,10,4.2);
  const shaveMat=new THREE.MeshStandardMaterial({color:0xe8d3a2,roughness:0.9,side:THREE.DoubleSide});
  for(let i=0;i<26;i++){
    const m=new THREE.Mesh(shaveGeo,shaveMat);
    m.visible=false;scene.add(m);
    fx.shave.push({m,life:0,t:0,v:new THREE.Vector3(),rv:new THREE.Vector3()});
  }
}
function spawnSteam(p){
  const it=fx.steam.find(o=>o.t>=o.life);
  if(!it)return;
  it.t=0;it.life=1.2+Math.random()*0.8;
  it.s.position.copy(p).add(new THREE.Vector3((Math.random()-0.5)*2,0,(Math.random()-0.5)*2));
  it.v.set((Math.random()-0.5)*2,6+Math.random()*4,(Math.random()-0.5)*2);
}
function spawnGlint(p,spread=8){
  const it=fx.glint.find(o=>o.t>=o.life);
  if(!it)return;
  it.t=0;it.life=0.7+Math.random()*0.7;
  it.s.position.copy(p).add(new THREE.Vector3((Math.random()-0.5)*spread,(Math.random()-0.5)*spread,(Math.random()-0.5)*spread));
  it.v.set((Math.random()-0.5)*6,2+Math.random()*5,(Math.random()-0.5)*6);
}
function spawnShave(p){
  const it=fx.shave.find(o=>o.t>=o.life);
  if(!it)return;
  it.t=0;it.life=1.0+Math.random()*0.5;
  it.m.visible=true;
  it.m.position.copy(p);
  it.m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
  it.v.set((Math.random()-0.5)*14,8+Math.random()*10,(Math.random()-0.5)*14);
  it.rv.set(Math.random()*8,Math.random()*8,Math.random()*8);
}
function updateFX(dt){
  for(const it of fx.steam){
    if(it.t>=it.life){it.s.material.opacity=0;continue;}
    it.t+=dt;
    it.s.position.addScaledVector(it.v,dt);
    const k=it.t/it.life;
    it.s.material.opacity=0.20*(1-k);
    it.s.scale.setScalar(4.5+k*9);
  }
  for(const it of fx.glint){
    if(it.t>=it.life){it.s.material.opacity=0;continue;}
    it.t+=dt;
    it.s.position.addScaledVector(it.v,dt);
    const k=it.t/it.life;
    it.s.material.opacity=0.9*(1-k);
    it.s.scale.setScalar(1.4+Math.sin(k*Math.PI)*2.2);
  }
  for(const it of fx.shave){
    if(it.t>=it.life){it.m.visible=false;continue;}
    it.t+=dt;
    it.v.y-=60*dt;
    it.m.position.addScaledVector(it.v,dt);
    it.m.rotation.x+=it.rv.x*dt;it.m.rotation.y+=it.rv.y*dt;
    if(it.m.position.y<BY+0.4){it.m.position.y=BY+0.4;it.v.set(0,0,0);it.rv.set(0,0,0);}
  }
}

/* ================= guide dots (world-space glow) ================= */
const guide={dots:[],n:0,pulse:0};
{
  const geo=new THREE.SphereGeometry(0.55,8,6);
  for(let i=0;i<36;i++){
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:0.5,depthWrite:false}));
    m.visible=false;m.renderOrder=3;
    scene.add(m);
    guide.dots.push(m);
  }
}
function setGuidePath(worldPts){
  const n=Math.min(guide.dots.length,worldPts?worldPts.length:0);
  guide.n=n;
  guide.dots.forEach((d,i)=>{
    if(i<n){d.visible=true;d.position.copy(worldPts[Math.floor(i*(worldPts.length-1)/Math.max(1,n-1))]);}
    else d.visible=false;
  });
}
function clearGuide(){guide.dots.forEach(d=>d.visible=false);guide.n=0;}

/* ================= HUD ================= */
const hud={
  dots:document.getElementById('dots'),
  word:document.getElementById('word'),
  finger:document.getElementById('finger'),
  title:document.getElementById('title'),
  gallery:document.getElementById('galleryUI'),
};
const STEP_COUNT=11;
for(let i=0;i<STEP_COUNT;i++){hud.dots.appendChild(document.createElement('i'));}
function setStep(i){
  [...hud.dots.children].forEach((el,k)=>{
    el.className=k<i?'done':k===i?'cur':'';
  });
}
let wordTimer=0;
function say(text){
  hud.word.textContent=text;
  hud.word.classList.add('show');
  wordTimer=1.3;
}
/* ghost finger follows projected guide */
const ghost={pts:null,t:0};
function setGhostPath(screenPtsFn){ghost.fn=screenPtsFn;ghost.t=0;}
function clearGhost(){ghost.fn=null;hud.finger.style.opacity=0;}

/* ================= input / picking ================= */
const ray=new THREE.Raycaster();
const ptrV=new THREE.Vector2();
function screenRay(x,y){
  ptrV.set(x/W*2-1,-(y/H)*2+1);
  ray.setFromCamera(ptrV,camera);
  return ray;
}
function hitPlane(x,y,plane,out){
  screenRay(x,y);
  return ray.ray.intersectPlane(plane,out||new THREE.Vector3());
}
const _pv=new THREE.Vector3();
function project(v){ // world -> css px
  _pv.copy(v).project(camera);
  return {x:(_pv.x*0.5+0.5)*W,y:(-_pv.y*0.5+0.5)*H};
}
let ptr={down:false,x:0,y:0,id:null};
canvas.addEventListener('pointerdown',e=>{
  AudioSys.unlock();
  if(ptr.down)return;
  ptr.down=true;ptr.id=e.pointerId;ptr.x=e.clientX;ptr.y=e.clientY;
  if(cur&&cur.down)cur.down(ptr.x,ptr.y);
});
canvas.addEventListener('pointermove',e=>{
  if(!ptr.down||e.pointerId!==ptr.id)return;
  ptr.x=e.clientX;ptr.y=e.clientY;
  if(cur&&cur.move)cur.move(ptr.x,ptr.y);
});
function upH(e){if(e.pointerId!==ptr.id)return;
  ptr.down=false;ptr.id=null;
  if(cur&&cur.up)cur.up(ptr.x,ptr.y);}
canvas.addEventListener('pointerup',upH);
canvas.addEventListener('pointercancel',upH);

/* screen-space trace engine */
function makeTrace(worldPts,radiusPx){
  return {worldPts,i:0,radius:radiusPx,done:false,
    prog(){return this.i/(this.worldPts.length-1);},
    curWorld(){return this.worldPts[Math.min(this.i,this.worldPts.length-1)];},
    feed(px,py){
      if(this.done)return 0;
      const look=Math.min(this.worldPts.length-1,this.i+14);
      let best=-1,bd=this.radius;
      for(let j=this.i;j<=look;j++){
        const s=project(this.worldPts[j]);
        const d=Math.hypot(s.x-px,s.y-py);
        if(d<bd){bd=d;best=j;}
      }
      let adv=0;
      if(best>this.i){adv=best-this.i;this.i=best;}
      if(this.i>=this.worldPts.length-1)this.done=true;
      return adv;
    }};
}
const traceR=()=>Math.min(W,H)*0.16;

/* ================= camera director ================= */
const camCur={pos:new THREE.Vector3(0,140,220),look:new THREE.Vector3(0,100,-20),fov:46};
let camTarget=null;
function setCam(t){camTarget=t;}
function updateCam(dt,time){
  if(camTarget){
    const p=(H>=W)?camTarget.p:(camTarget.pl||camTarget.p);
    const l=(H>=W)?camTarget.l:(camTarget.ll||camTarget.l);
    const f=(H>=W)?(camTarget.f||46):(camTarget.fl||camTarget.f||44);
    const k=window.__SNAPCAM?1:1-Math.pow(0.0018,dt);
    camCur.pos.lerp(new THREE.Vector3(...p),k);
    camCur.look.lerp(new THREE.Vector3(...l),k);
    camCur.fov=lerp(camCur.fov,f,k);
  }
  // subtle breathing parallax
  const bx=Math.sin(time*0.4)*0.7,by=Math.sin(time*0.31+1)*0.5;
  camera.position.copy(camCur.pos).add(new THREE.Vector3(bx,by,0));
  camera.lookAt(camCur.look);
  if(Math.abs(camera.fov-camCur.fov)>0.01){camera.fov=camCur.fov;camera.updateProjectionMatrix();}
}

/* ================= game state ================= */
const G={varnish:'amber',ribbon:0,deco:0,builds:0};
let scenes={},cur=null,curName='',sceneT=0,nextName=null,fadeK=0,fadeDir=0;
function go(name){nextName=name;fadeDir=1;}
function setScene(name){
  curName=name;cur=scenes[name];sceneT=0;
  clearGuide();clearGhost();
  hud.title.classList.remove('show');
  hud.gallery.classList.remove('show');
  props.handTool.visible=false;
  for(const k in props.tools)props.tools[k].visible=false;
  if(cur.enter)cur.enter();
}
const sceneOrder=['title','wood','bend','mold','plate','fhole','box','post','varnish','bridge','strings','bow','gallery'];
function stepIndex(){return clamp(sceneOrder.indexOf(curName)-1,0,STEP_COUNT-1);}

/* violin placement helpers (cx = body center world x) */
function ensureInScene(){if(V.group.parent!==scene){scene.add(V.group);}}
function resetViolinState(){
  V.top.position.z=0;
  V.overlays[0].position.z=0;
  V.neck.position.set(0,0.6,0.55);
  V.setTranslucent(0);
  props.innerLight&&(props.innerLight.intensity=0);
}
function placeViolinLying(cx,py,zTop){ // top up, tail toward camera (+Z); body z = zTop..zTop+BL
  ensureInScene();resetViolinState();
  V.group.visible=true;
  V.group.rotation.set(-Math.PI/2,0,Math.PI);
  V.group.position.set(cx,py,zTop);
}
function placeViolinVertical(px,py,pz,lean=0){ // neck up, facing +Z; py = body top edge height
  ensureInScene();resetViolinState();
  V.group.visible=true;
  V.group.rotation.set(Math.PI+lean,Math.PI,0);
  V.group.position.set(px,py,pz);
}
function placePlateFlat(px,py,pz){ // plate lying, length toward -Z from pz
  ensureInScene();
  V.group.visible=true;
  V.group.rotation.set(-Math.PI/2,0,0);
  V.group.position.set(px,py,pz);
}
const L2W=(x,y,z)=>V.group.localToWorld(new THREE.Vector3(x,y,z));

/* ================= scenes ================= */
scenes.title={
  enter(){
    setCam({p:[-60,112,132],l:[-60,90,16],f:47,pl:[-20,116,160],ll:[-50,92,0],fl:44});
    hud.title.classList.add('show');
    // finished violin displayed on stand
    resetViolinState();
    V.group.visible=true;
    showParts({top:true,back:true,ribs:true,neck:true,tail:true,bridge:false});
    V.bridge.visible=true;
    V.showStrings(4);for(let i=0;i<4;i++)V.setString(i,1);
    V.setFholeProgress(-1,1);V.setFholeProgress(1,1);
    V.fillVarnish();V.setVarnishColor(G.varnish);
    props.galleryRoot.add(V.group);
    V.group.rotation.set(Math.PI,Math.PI,0);
    V.group.position.set(0,96,4);
    props.galleryRoot.rotation.y=0;
  },
  update(dt){
    props.galleryRoot.rotation.y=Math.sin(sceneT*0.3)*0.3;
  },
  down(){AudioSys.chime();go('wood');},
  auto(){return {type:'tap',at:{x:W/2,y:H*0.6}};}
};

scenes.wood={
  enter(){
    props.galleryRoot.remove(V.group);scene.add(V.group);
    V.group.visible=false;
    V.clearVarnish();
    V.fholeProg=[0,0];V.setFholeProgress(-1,0);
    setCam({p:[-82,118,24],l:[-82,108,-57],f:48,pl:[-58,116,46],ll:[-80,106,-57],fl:46});
    this.tS=false;this.tM=false;this.doneAt=0;
    this.wob=[0,0];
  },
  update(dt){
    this.wob[0]=Math.max(0,this.wob[0]-dt*3);
    this.wob[1]=Math.max(0,this.wob[1]-dt*3);
    props.boardS.rotation.z=Math.sin(sceneT*28)*0.05*this.wob[0];
    props.boardM.rotation.z=Math.sin(sceneT*28)*0.05*this.wob[1];
    const t=!this.tS?props.boardS:!this.tM?props.boardM:null;
    if(t){
      setGuidePath(null);
      setGhostPath(()=>[project(t.position.clone().add(new THREE.Vector3(0,6,4)))]);
    }else clearGhost();
    if(this.tS&&this.tM&&sceneT>this.doneAt+0.8)go('bend');
  },
  down(x,y){
    screenRay(x,y);
    for(const [b,key,idx] of [[props.boardS,'tS',0],[props.boardM,'tM',1]]){
      if(ray.intersectObject(b,false).length){
        AudioSys.knock();
        this[key]=true;this.wob[idx]=1;
        say(idx?'いいおと！':'コンコン♪');
        if(this.tS&&this.tM&&!this.doneAt)this.doneAt=sceneT;
      }
    }
  },
  auto(){
    const t=!this.tS?props.boardS:!this.tM?props.boardM:null;
    if(t){const s=project(t.position.clone().add(new THREE.Vector3(0,4,2)));
      return {type:'tap',at:s};}
    return {type:'wait'};
  }
};

/* -------- bend (signature 1) -------- */
const BEND={ix:78,iz:-8,R:8.6,len:16,stripY:BY+14};
BEND.ax=BEND.ix+(BEND.R-2.7-0.15);
scenes.bend={
  enter(){
    setCam({p:[80,134,32],l:[79,103,-9],f:46,pl:[56,128,44],ll:[76,102,-9],fl:44});
    this.t=0;this.doneT=0;this.saidJu=false;
    // guide arc (horizontal at strip mid height)
    const pts=[];
    for(let i=0;i<=36;i++){
      const a=Math.PI-1.02+2.04*(i/36);
      pts.push(new THREE.Vector3(BEND.ax+Math.cos(a)*(BEND.R+2.2),BEND.stripY,BEND.iz+Math.sin(a)*(BEND.R+2.2)));
    }
    this.guidePts=pts;
    this.trace=makeTrace(pts,traceR()*1.6);
    props.strip.visible=true;
    this.rebuild();
    props.ironMat.emissiveIntensity=0.9;
  },
  rebuild(){
    const rings=GEO.bendStripSections(this.t,{len:BEND.len,R:BEND.R,height:5.0,thick:0.3,n:30,
      cx:BEND.ax,cy:BEND.stripY,cz:BEND.iz});
    props.strip.geometry.dispose();
    props.strip.geometry=GEO.stripGeoFromRings(rings);
  },
  update(dt){
    const bend=this.trace.prog();
    if(this.t<bend){this.t=Math.min(bend,this.t+dt*1.4);this.rebuild();}
    AudioSys.sizzleSet(ptr.down&&!this.trace.done?0.10+bend*0.08:0);
    props.ironMat.emissiveIntensity=0.9+0.3*Math.sin(sceneT*3)+(ptr.down?0.5:0);
    props.heatLight.intensity=26+Math.sin(sceneT*3)*8+(ptr.down?30:0);
    if(ptr.down&&!this.trace.done&&Math.random()<0.5){
      spawnSteam(this.trace.curWorld());
    }
    if(!this.trace.done){
      setGuidePath(this.guidePts.slice(this.trace.i));
      setGhostPath(()=>this.guidePts.slice(this.trace.i).map(p=>project(p)));
    }else if(!this.doneT){
      this.doneT=sceneT;AudioSys.sizzleSet(0);AudioSys.chime();
      say('くるーん！');
      clearGuide();clearGhost();
      for(let i=0;i<8;i++)spawnGlint(new THREE.Vector3(BEND.ax-BEND.R,BEND.stripY,BEND.iz),6);
    }
    if(this.doneT&&sceneT>this.doneT+1.2){
      props.ironMat.emissiveIntensity=0.15;
      props.heatLight.intensity=8;
      go('mold');
    }
  },
  down(x,y){this.trace.feed(x,y);},
  move(x,y){
    this.trace.feed(x,y);
    if(!this.saidJu&&this.trace.i>2){this.saidJu=true;say('ジュッ……');}
  },
  up(){AudioSys.sizzleSet(0);},
  auto(){
    if(this.trace&&!this.trace.done)
      return {type:'trace',pts:this.guidePts.slice(Math.max(0,this.trace.i-1)).map(p=>project(p))};
    return {type:'wait'};
  }
};

/* -------- mold -------- */
scenes.mold={
  enter(){
    setCam({p:[-33,162,44],l:[-34,92,-12],f:46,pl:[-56,150,56],ll:[-34,92,-12],fl:44});
    props.strip.visible=false;
    props.mold.visible=true;props.moldFloor.visible=true;
    props.cRib.visible=true;
    const rings=GEO.bendStripSections(1,{len:BEND.len,R:BEND.R,height:5.0,thick:0.3,n:30,cx:0,cy:0,cz:0});
    props.cRib.geometry.dispose();
    props.cRib.geometry=GEO.stripGeoFromRings(rings);
    props.cRib.position.set(-34,BY+2.8,16);
    props.cRib.rotation.y=0.5;
    this.snapped=false;this.g=0;this.doneT=0;
    this.dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-(BY+2));
    this.target=new THREE.Vector3(-34+5.2,BY+2,-14+BL*0.5-BL*0.47);
  },
  update(dt){
    if(!this.snapped){
      setGuidePath([props.cRib.position.clone(),this.target.clone().add(new THREE.Vector3(0,3,0))]);
      setGhostPath(()=>[project(props.cRib.position),project(this.target)]);
      if(props.cRib.position.distanceTo(this.target)<7){
        this.snapped=true;AudioSys.snap();
        say('キュッ！');
        for(let i=0;i<8;i++)spawnGlint(this.target,5);
        props.cRib.visible=false;
        props.garland.visible=true;
        clearGuide();clearGhost();
      }
    }else{
      this.g=Math.min(1,this.g+dt*0.9);
      const span=this.g;
      const from=0.235-span/2,to=0.235+span/2;
      props.garland.geometry.dispose();
      props.garland.geometry=GEO.makeRibsGeo(BL,{from:Math.max(-0.5,from),to:Math.min(1.3,to),thick:0.18});
      if(this.g>=1&&!this.doneT){this.doneT=sceneT;AudioSys.chime();}
      if(this.doneT&&sceneT>this.doneT+0.9)go('plate');
    }
  },
  down(x,y){
    if(this.snapped)return;
    const s=project(props.cRib.position);
    if(Math.hypot(s.x-x,s.y-y)<Math.min(W,H)*0.3){this.held=true;AudioSys.tap();}
  },
  move(x,y){
    if(this.held&&!this.snapped){
      const p=new THREE.Vector3();
      if(hitPlane(x,y,this.dragPlane,p)){
        props.cRib.position.lerp(new THREE.Vector3(p.x,BY+2,p.z),0.5);
      }
    }
  },
  up(){this.held=false;},
  auto(){
    if(!this.snapped)return {type:'drag',from:project(props.cRib.position),to:project(this.target)};
    return {type:'wait'};
  }
};

/* -------- plate carve -------- */
const BLANK={x:-34,zTop:6}; // body y -> world z = zTop - y
scenes.plate={
  enter(){
    props.strip.visible=false;props.cRib.visible=false;
    setCam({p:[-34,152,34],l:[-34,94,-12],f:46,pl:[-54,142,52],ll:[-34,94,-12],fl:44});
    props.garland.visible=false;
    props.mold.visible=false;props.moldFloor.visible=false; // mold set aside
    props.blank.visible=true;
    // chalk outline onto blank canvas
    const g=props.blankCanvas.getContext('2d');
    g.drawImage(M.spruceSets.albedo,0,0,1024,1024);
    g.save();
    g.strokeStyle='rgba(88,56,28,0.75)';g.lineWidth=6;g.setLineDash([16,10]);
    g.beginPath();
    const loop=GEO.outlinePts(BL,160);
    loop.forEach((p,i)=>{
      const [px,py]=this.toPx(p.x,p.y);
      i?g.lineTo(px,py):g.moveTo(px,py);
    });
    g.closePath();g.stroke();g.restore();
    props.blankTex.needsUpdate=true;
    // world guide points
    this.loop=GEO.outlinePts(BL,150);
    const wpts=this.loop.map(p=>new THREE.Vector3(BLANK.x+p.x,BY+2.6,BLANK.zTop-p.y));
    this.trace=makeTrace(wpts,traceR());
    this.doneT=0;this.carveAcc=0;this.lastPx=null;
  },
  toPx(x,y){ // body coords -> blank top canvas px (u:x world→canvas x, v:z world→canvas y)
    const wx=x, wz=BLANK.zTop-y;
    return [ (wx-(BLANK.x-13))/26*1024, (1-((wz-(-32))/42))*1024 ];
  },
  update(dt){
    if(!this.trace.done){
      setGuidePath(this.trace.worldPts.slice(this.trace.i,this.trace.i+34));
      setGhostPath(()=>this.trace.worldPts.slice(this.trace.i,this.trace.i+30).map(p=>project(p)));
      props.handTool.visible=true;
      props.tools.gouge.visible=true;
      const cw=this.trace.curWorld();
      props.handTool.position.lerp(cw.clone().add(new THREE.Vector3(1.5,7.5,2)),0.4);
      props.handTool.rotation.set(0.5,0,-0.3);
    }else{
      if(!this.doneT){
        this.doneT=sceneT;AudioSys.pop();
        say('おもていた！');
        props.blank.visible=false;
        props.handTool.visible=false;props.tools.gouge.visible=false;
        V.group.visible=true;
        showParts({top:true});
        placePlateFlat(BLANK.x,BY+2.3,BLANK.zTop);
        for(let i=0;i<10;i++)spawnShave(new THREE.Vector3(BLANK.x,BY+4,-12));
        clearGuide();clearGhost();
      }
      if(this.doneT&&sceneT>this.doneT+1.4)go('fhole');
    }
  },
  feed(x,y){
    const adv=this.trace.feed(x,y);
    if(adv>0){
      this.carveAcc+=adv;
      if(this.carveAcc>5){this.carveAcc=0;AudioSys.carve();}
      const cw=this.trace.curWorld();
      if(Math.random()<0.5)spawnShave(cw);
      // dark groove into canvas
      const g=props.blankCanvas.getContext('2d');
      const i=this.trace.i;
      const p=this.loop[Math.min(i,this.loop.length-1)];
      const [px,py]=this.toPx(p.x,p.y);
      if(this.lastPx){
        g.strokeStyle='rgba(52,30,12,0.95)';g.lineWidth=7;g.lineCap='round';
        g.beginPath();g.moveTo(this.lastPx[0],this.lastPx[1]);g.lineTo(px,py);g.stroke();
      }
      this.lastPx=[px,py];
      props.blankTex.needsUpdate=true;
    }
  },
  down(x,y){this.feed(x,y);},
  move(x,y){this.feed(x,y);},
  auto(){
    if(this.trace&&!this.trace.done)
      return {type:'trace',pts:this.trace.worldPts.slice(Math.max(0,this.trace.i-1)).map(p=>project(p))};
    return {type:'wait'};
  }
};

/* -------- f-holes (signature 2) -------- */
scenes.fhole={
  enter(){
    setCam({p:[-34,124,12],l:[-34,95,-13],f:40,pl:[-46,120,24],ll:[-34,95,-13],fl:38});
    props.blank.visible=false;
    props.mold.visible=false;props.moldFloor.visible=false;
    placePlateFlat(BLANK.x,BY+2.3,BLANK.zTop);
    showParts({top:true});
    this.cur=0;this.doneT=0;
    this.mk=side=>{
      const sp=GEO.fSpine(BL,side,48);
      const wpts=sp.map(p=>L2W(p.x,p.y,2.4));
      return makeTrace(wpts,traceR()*0.9);
    };
    this.traces=[this.mk(-1),this.mk(1)];
    this.lastTexUp=0;
  },
  update(dt){
    const t=this.traces[this.cur];
    if(t&&!t.done){
      setGuidePath(t.worldPts.slice(t.i,t.i+26));
      setGhostPath(()=>t.worldPts.slice(t.i,t.i+24).map(p=>project(p)));
      props.handTool.visible=true;props.tools.knife.visible=true;
      props.tools.gouge.visible=false;
      const cw=t.curWorld();
      props.handTool.position.lerp(cw.clone().add(new THREE.Vector3(1.2,7.2,1.5)),0.4);
      props.handTool.rotation.set(0.45,0,-0.25);
    }
    if(this.cur===0&&this.traces[0].done){
      this.cur=1;AudioSys.chime();
      say('スーッ……');
      V.setFholeProgress(-1,1);
    }
    if(this.traces[1].done&&!this.doneT){
      this.doneT=sceneT;
      V.setFholeProgress(1,1);
      AudioSys.chime();AudioSys.grand();
      say('ｆのかたち！');
      props.handTool.visible=false;props.tools.knife.visible=false;
      clearGuide();clearGhost();
      const e=this.traces[1].worldPts[this.traces[1].worldPts.length-1];
      for(let i=0;i<10;i++)spawnGlint(e,6);
      setCam({p:[-34,134,28],l:[-34,95,-13],f:44,pl:[-50,128,40],ll:[-34,95,-13],fl:42});
    }
    if(this.doneT&&sceneT>this.doneT+1.8)go('box');
  },
  feed(x,y){
    const t=this.traces[this.cur];
    if(t&&!t.done){
      const adv=t.feed(x,y);
      if(adv>0){
        if(Math.random()<0.4){AudioSys.carve();spawnShave(t.curWorld());}
        const now=performance.now();
        if(now-this.lastTexUp>90||t.done){
          this.lastTexUp=now;
          V.setFholeProgress(this.cur===0?-1:1,t.prog());
        }
      }
    }
  },
  down(x,y){this.feed(x,y);},
  move(x,y){this.feed(x,y);},
  auto(){
    const t=this.traces&&this.traces[this.cur];
    if(t&&!t.done)
      return {type:'trace',pts:t.worldPts.slice(Math.max(0,t.i-1)).map(p=>project(p))};
    return {type:'wait'};
  }
};

/* -------- box assembly -------- */
scenes.box={
  enter(){
    setCam({p:[30,144,40],l:[30,96,-18],f:45,pl:[-2,148,34],ll:[30,94,-20],fl:43});
    placeViolinLying(30,BY+5.2,-26);
    showParts({back:true,ribs:true});
    V.top.visible=true;
    this.hover=17;this.snapped=false;this.doneT=0;this.neckK=0;
    V.top.position.z=this.hover;   // local z = world up
    V.overlays[0].position.z=this.hover;
    this.dragPlane=new THREE.Plane(new THREE.Vector3(0,0,1),16);
  },
  update(dt){
    if(!this.snapped){
      const topW=L2W(0,BL*0.5,this.hover);
      const tgt=L2W(0,BL*0.5,2);
      setGuidePath([topW,tgt]);
      setGhostPath(()=>[project(topW),project(tgt)]);
      if(this.hover<2.5){
        this.snapped=true;AudioSys.pop();
        say('ポン！');
        V.top.position.z=0;V.overlays[0].position.z=0;
        for(let i=0;i<10;i++)spawnGlint(L2W(0,BL*0.5,3),10);
        clearGuide();clearGhost();
      }
    }else{
      this.neckK=Math.min(1,this.neckK+dt*1.6);
      V.neck.visible=true;
      V.neck.position.y=0.6-(1-this.neckK)*14;
      V.tailpiece.visible=this.neckK>=1;
      if(this.neckK>=1&&!this.doneT){
        this.doneT=sceneT;AudioSys.chime();say('ネックもついた！');
        V.neck.position.y=0.6;
      }
      if(this.doneT&&sceneT>this.doneT+1.2)go('post');
    }
  },
  down(x,y){this.held=true;AudioSys.tap();},
  move(x,y){
    if(this.held&&!this.snapped){
      const p=new THREE.Vector3();
      if(hitPlane(x,y,this.dragPlane,p)){
        this.hover=clamp((p.y-(BY+7)),0,18);
        V.top.position.z=this.hover;
        V.overlays[0].position.z=this.hover;
      }
    }
  },
  up(){this.held=false;},
  auto(){
    if(!this.snapped){
      const from=project(L2W(0,BL*0.5,this.hover));
      const to=project(L2W(0,BL*0.5,0).add(new THREE.Vector3(0,-6,0)));
      return {type:'drag',from,to};
    }
    return {type:'wait'};
  }
};

/* -------- soundpost (signature 3) -------- */
scenes.post={
  enter(){
    placeViolinVertical(30,BY+26,-22,-0.9); // reclined ~50° on the cushion
    showParts({top:true,back:true,ribs:true,neck:true});
    V.setTranslucent(1);
    setCam({p:[30,154,52],l:[30,102,-14],f:45,pl:[4,144,62],ll:[30,102,-14],fl:43});
    props.freePost.visible=true;
    props.freePost.position.set(36,BY+2.2,6);
    props.freePost.rotation.z=0.5;
    this.inside=false;this.snapped=false;this.doneT=0;
    this.fholeW=L2W(-3.0,BL*0.52,1.4);
    this.targetW=L2W(-1.9,BL*0.575,0);
    // drag on the violin's face plane (post slides along the top)
    const n=L2W(0,BL*0.5,2).sub(L2W(0,BL*0.5,0)).normalize();
    this.dragPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(n,this.fholeW.clone().add(n.clone().multiplyScalar(1.5)));
  },
  update(dt){
    if(!this.snapped){
      if(!this.inside){
        setGuidePath([props.freePost.position.clone(),this.fholeW,this.targetW]);
        setGhostPath(()=>[project(props.freePost.position),project(this.fholeW),project(this.targetW)]);
        if(props.freePost.position.distanceTo(this.fholeW)<5){
          this.inside=true;AudioSys.whoosh();say('スッ……なかへ');
          props.freePost.material=props.freePost.material.clone();
          props.freePost.material.transparent=true;props.freePost.material.opacity=0.55;
        }
      }else{
        setGuidePath([props.freePost.position.clone(),this.targetW]);
        setGhostPath(()=>[project(props.freePost.position),project(this.targetW)]);
        props.innerLight.intensity=12;
        if(props.freePost.position.distanceTo(this.targetW)<4.5){
          this.snapped=true;AudioSys.snap();say('たった！');
          props.freePost.visible=false;
          V.soundpost.visible=true;
          for(let i=0;i<10;i++)spawnGlint(this.targetW,4);
          clearGuide();clearGhost();
          setCam({p:[2,114,34],l:[4,112,-6],f:38,pl:[-6,114,44],ll:[4,112,-6],fl:37});
        }
      }
    }else{
      props.innerLight.intensity=lerp(props.innerLight.intensity,30,dt*3);
      if(!this.doneT&&sceneT>0&&props.innerLight.intensity>25){this.doneT=sceneT;AudioSys.chime();}
      if(this.doneT&&sceneT>this.doneT+1.6){
        V.setTranslucent(0);
        props.innerLight.intensity=0;
        go('varnish');
      }
    }
  },
  down(x,y){
    const s=project(props.freePost.position);
    if(Math.hypot(s.x-x,s.y-y)<Math.min(W,H)*0.3){
      this.held=true;AudioSys.tap();
    }
  },
  move(x,y){
    if(this.held&&!this.snapped){
      const p=new THREE.Vector3();
      if(hitPlane(x,y,this.dragPlane,p)){
        props.freePost.position.lerp(p,0.4);
        props.freePost.rotation.z=this.inside?0.08:0.4;
      }
    }
  },
  up(){this.held=false;},
  auto(){
    if(!this.snapped){
      if(!this.inside)return {type:'drag',from:project(props.freePost.position),to:project(this.fholeW),then:project(this.targetW)};
      return {type:'drag',from:project(props.freePost.position),to:project(this.targetW)};
    }
    return {type:'wait'};
  }
};

/* -------- varnish -------- */
scenes.varnish={
  enter(){
    placeViolinVertical(-70,150+BL*0.5,-18,0);
    showParts({top:true,back:true,ribs:true,neck:true});
    props.wire.visible=true;
    setCam({p:[-70,146,62],l:[-70,150,-18],f:46,pl:[-46,144,74],ll:[-70,148,-18],fl:44});
    this.cover=0;this.doneT=0;
    V.setVarnishColor(G.varnish);
    const fz=L2W(0,BL*0.5,1).z;
    this.plane=new THREE.Plane(new THREE.Vector3(0,0,1),-(fz+1));
    this.lastP=null;
  },
  update(dt){
    if(this.doneT){
      if(sceneT>this.doneT+1.5){props.wire.visible=false;go('bridge');}
      return;
    }
    if(this.cover<0.02){
      const a=L2W(0,4,2.5),b=L2W(0,BL-3,2.5);
      setGuidePath([a,b]);
      setGhostPath(()=>[project(a),project(b)]);
    }else{clearGuide();clearGhost();}
    if(this.cover>=1&&!this.doneT){
      this.doneT=sceneT;AudioSys.chime();
      V.fillVarnish();
      say('ぴかぴか！');
      for(let i=0;i<12;i++)spawnGlint(L2W(0,BL*0.5,3),14);
      props.handTool.visible=false;props.tools.brush.visible=false;
    }
  },
  paint(x,y){
    const p=new THREE.Vector3();
    if(!hitPlane(x,y,this.plane,p))return;
    props.handTool.visible=true;props.tools.brush.visible=true;
    props.handTool.position.lerp(p.clone().add(new THREE.Vector3(1.5,8,2)),0.5);
    props.handTool.rotation.set(0.3,0,-0.2);
    const lp=V.group.worldToLocal(p.clone());
    V.paintVarnish(lp.x,lp.y,34);
    if(this.lastP){
      const d=p.distanceTo(this.lastP);
      if(d>0.5){this.cover+=d/240;if(Math.random()<0.12)AudioSys.whoosh();}
    }
    this.lastP=p.clone();
  },
  down(x,y){
    // jar tap?
    screenRay(x,y);
    const hits=ray.intersectObjects(props.jarMeshes,true);
    if(hits.length){
      const k=hits[0].object.userData.varnish;
      if(k){G.varnish=k;V.setVarnishColor(k);AudioSys.tap();say('このいろ！');return;}
    }
    this.paint(x,y);
  },
  move(x,y){this.paint(x,y);},
  up(){this.lastP=null;},
  auto(){
    if(!this.doneT){
      const a=project(L2W(-3,5,2.5)),b=project(L2W(3,BL-4,2.5));
      return {type:'scrub',from:a,to:b};
    }
    return {type:'wait'};
  }
};

/* -------- bridge -------- */
scenes.bridge={
  enter(){
    placeViolinLying(30,BY+5.2,-26);
    showParts({top:true,back:true,ribs:true,neck:true,tail:true});
    setCam({p:[30,140,36],l:[30,96,-18],f:44,pl:[-2,146,32],ll:[30,94,-20],fl:42});
    props.freeBridge.visible=true;
    props.freeBridge.position.set(38,BY+2,2);
    props.freeBridge.rotation.set(-Math.PI/2,0,0.4);
    this.snapped=false;this.doneT=0;
    this.targetW=L2W(0,BL*0.545,1.6);
    this.dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-(BY+8));
  },
  update(dt){
    if(!this.snapped){
      setGuidePath([props.freeBridge.position.clone(),this.targetW]);
      setGhostPath(()=>[project(props.freeBridge.position),project(this.targetW)]);
      if(props.freeBridge.position.distanceTo(this.targetW)<6){
        this.snapped=true;AudioSys.pop();say('コトン！');
        props.freeBridge.visible=false;
        V.bridge.visible=true;
        for(let i=0;i<8;i++)spawnGlint(this.targetW,4);
        clearGuide();clearGhost();
      }
    }else if(!this.doneT){this.doneT=sceneT;AudioSys.chime();}
    if(this.doneT&&sceneT>this.doneT+1.0)go('strings');
  },
  down(x,y){
    const s=project(props.freeBridge.position);
    if(Math.hypot(s.x-x,s.y-y)<Math.min(W,H)*0.3){
      this.held=true;AudioSys.tap();
      props.freeBridge.rotation.set(0,0,0); // standing while carried
    }
  },
  move(x,y){
    if(this.held&&!this.snapped){
      const p=new THREE.Vector3();
      if(hitPlane(x,y,this.dragPlane,p))props.freeBridge.position.lerp(p,0.45);
    }
  },
  up(){this.held=false;},
  auto(){
    if(!this.snapped)return {type:'drag',from:project(props.freeBridge.position),to:project(this.targetW)};
    return {type:'wait'};
  }
};

/* -------- strings + pegs (signature 4a) -------- */
scenes.strings={
  enter(){
    placeViolinLying(30,BY+5.2,-26);
    showParts({top:true,back:true,ribs:true,neck:true,tail:true});
    V.bridge.visible=true;
    setCam({p:[30,144,40],l:[30,94,-22],f:44,pl:[-2,146,32],ll:[30,93,-24],fl:42});
    this.idx=0;this.phase='string';this.doneT=0;
    this.tension=[0,0,0,0];this.rot=0;this.lastAng=null;this.pluckAcc=0;
    this.tempString=new THREE.Mesh(new THREE.BufferGeometry(),M.stringMat);
    scene.add(this.tempString);
    this.dragT=0;
  },
  lanePts(i){
    const pts=V.stringPts(i);
    return {
      tail:L2W(pts.tailA.x,pts.tailA.y,pts.tailA.z),
      bridge:L2W(pts.brP.x,pts.brP.y,pts.brP.z),
      nut:L2W(pts.nutW.x,pts.nutW.y,pts.nutW.z),
      peg:L2W(PEGS[i].x*1.8,PEGS[i].y,1.2),
    };
  },
  update(dt){
    if(this.doneT){
      if(sceneT>this.doneT+1.0){scene.remove(this.tempString);go('bow');}
      return;
    }
    const i=Math.min(3,this.idx);
    const lane=this.lanePts(i);
    if(this.phase==='string'){
      setGuidePath([lane.tail,lane.bridge,lane.nut]);
      setGhostPath(()=>[project(lane.tail),project(lane.nut)]);
      // temp string from tail toward dragT
      if(this.dragT>0){
        const end=lane.tail.clone().lerp(lane.nut,this.dragT);
        const curve=new THREE.CatmullRomCurve3([lane.tail,lane.tail.clone().lerp(end,0.5).add(new THREE.Vector3(0,-this.dragT<0.9?1.2:0,0)),end]);
        this.tempString.geometry.dispose();
        this.tempString.geometry=new THREE.TubeGeometry(curve,12,0.06,6,false);
        this.tempString.visible=true;
      }else this.tempString.visible=false;
    }else{
      this.tempString.visible=false;
      setGuidePath(null);
      const pegS=project(lane.peg);
      const r=Math.min(W,H)*0.09;
      setGhostPath(()=>{
        const t=(performance.now()/1200)%1;
        const a=t*Math.PI*2;
        return [{x:pegS.x+Math.cos(a)*r,y:pegS.y+Math.sin(a)*r}];
      });
    }
  },
  down(x,y){
    if(this.doneT)return;
    const i=Math.min(3,this.idx);
    const lane=this.lanePts(i);
    if(this.phase==='string'){
      const s=project(lane.tail);
      if(Math.hypot(s.x-x,s.y-y)<traceR()*1.4){this.dragging=true;AudioSys.tap();}
    }else{
      const s=project(lane.peg);
      this.lastAng=Math.atan2(y-s.y,x-s.x);
    }
  },
  move(x,y){
    if(this.doneT)return;
    const i=Math.min(3,this.idx);
    const lane=this.lanePts(i);
    if(this.phase==='string'&&this.dragging){
      const sT=project(lane.tail),sN=project(lane.nut);
      const dx=sN.x-sT.x,dy=sN.y-sT.y;
      const t=((x-sT.x)*dx+(y-sT.y)*dy)/(dx*dx+dy*dy);
      this.dragT=clamp(t,0,1);
      if(this.dragT>0.96){
        this.dragging=false;this.dragT=0;
        this.tension[i]=0.15;
        V.showStrings(i+1);
        V.setString(i,0.15);
        AudioSys.pluck(STRING_FREQS[i]*0.6,0.15);
        say('シュルル…');
        this.phase='peg';this.rot=0;this.lastAng=null;
      }
    }else if(this.phase==='peg'&&this.lastAng!=null){
      const s=project(lane.peg);
      const a=Math.atan2(y-s.y,x-s.x);
      let d=a-this.lastAng;
      while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
      this.lastAng=a;
      const abs=Math.min(Math.abs(d),0.25);
      this.rot+=abs;
      V.pegs[i].rotation.x+=abs*1.5;
      const NEED=5.2;
      this.tension[i]=clamp(0.15+this.rot/NEED*0.85,0,1);
      V.setString(i,this.tension[i]);
      this.pluckAcc+=abs;
      if(this.pluckAcc>0.55){
        this.pluckAcc=0;
        AudioSys.pluck(STRING_FREQS[i]*lerp(0.6,1,this.tension[i]),0.18);
      }
      if(this.tension[i]>=1){
        AudioSys.pluck(STRING_FREQS[i],0.3);
        say(['ソ！','レ！','ラ！','ミ！'][i]);
        for(let k=0;k<6;k++)spawnGlint(lane.peg,3);
        this.idx++;
        if(this.idx>=4){this.doneT=sceneT;AudioSys.chime();clearGhost();clearGuide();}
        else this.phase='string';
        this.lastAng=null;
      }
    }
  },
  up(){this.dragging=false;this.lastAng=null;},
  auto(){
    if(this.doneT)return {type:'wait'};
    const i=Math.min(3,this.idx);
    const lane=this.lanePts(i);
    if(this.phase==='string')
      return {type:'drag',from:project(lane.tail),to:project(lane.nut)};
    const s=project(lane.peg);
    return {type:'circle',center:s,r:Math.min(W,H)*0.09,turns:2.2};
  }
};

/* -------- first bow (signature 4b) -------- */
scenes.bow={
  enter(){
    placeViolinLying(30,BY+5.2,-26);
    showParts({top:true,back:true,ribs:true,neck:true,tail:true});
    V.bridge.visible=true;
    V.showStrings(4);for(let i=0;i<4;i++)V.setString(i,1);
    setCam({p:[30,130,42],l:[29,100,-14],f:44,pl:[-2,140,36],ll:[29,96,-18],fl:42});
    props.bow.visible=true;
    props.bow.position.set(33,BY+13,4);
    props.bow.rotation.set(0.15,0.35,-0.55);
    this.played=false;this.playT=0;this.doneT=0;
  },
  update(dt){
    if(!this.played){
      setGhostPath(()=>[project(props.bow.position)]);
      props.bow.position.y=BY+13+Math.sin(sceneT*2)*0.8;
    }else{
      this.playT+=dt;
      const k=Math.min(1,this.playT/3.0);
      const sweep=Math.sin(k*Math.PI*1.5);
      // bow across strings above bridge
      const c=L2W(0,BL*0.545-1.5,5.6);
      props.bow.position.set(c.x+sweep*7,c.y+1.2,c.z);
      props.bow.rotation.set(0.12,0.12,-0.06+sweep*0.06);
      // hand on frog
      props.handTool.visible=true;
      props.handTool.position.copy(props.bow.position).add(new THREE.Vector3(-26+sweep*2,-1,3));
      props.handTool.rotation.set(1.2,0,0.4);
      if(this.playT>0.2&&Math.random()<0.4)
        spawnGlint(L2W((Math.random()-0.5)*8,BL*(0.2+Math.random()*0.6),4),6);
      world.lampLight.intensity=lerp(world.lampLight.intensity,1500,dt*0.8);
      if(this.playT>3.4&&!this.doneT){
        this.doneT=sceneT;AudioSys.grand();say('できた！！');
      }
      if(this.doneT&&sceneT>this.doneT+1.6){
        props.bow.visible=false;props.handTool.visible=false;
        world.lampLight.intensity=900;
        go('gallery');
      }
    }
  },
  down(x,y){
    if(this.played)return;
    const s=project(props.bow.position);
    if(Math.hypot(s.x-x,s.y-y)<traceR()*1.6){
      this.played=true;this.playT=0;
      clearGhost();
      AudioSys.bow(196,0.9,0.0,0.10);
      AudioSys.bow(293.66,0.9,0.55,0.11);
      AudioSys.bow(440,1.0,1.1,0.12);
      AudioSys.bow(659.25,1.9,1.65,0.12);
      AudioSys.bow(440,1.9,1.65,0.08);
      say('～♪');
    }
  },
  auto(){
    if(!this.played)return {type:'tap',at:project(props.bow.position)};
    return {type:'wait'};
  }
};

/* -------- gallery -------- */
scenes.gallery={
  enter(){
    G.builds++;
    resetViolinState();
    scene.remove(V.group);
    props.galleryRoot.add(V.group);
    V.group.rotation.set(Math.PI,Math.PI,0);
    V.group.position.set(0,96,4);
    props.galleryRoot.rotation.y=0;
    this.vyaw=0.5;this.lastX=null;
    setCam({p:[-60,98,112],l:[-60,82,18],f:42,pl:[-30,102,120],ll:[-58,82,18],fl:41});
    hud.gallery.classList.add('show');
    updateGalleryUI();
    props.ribbon.visible=G.ribbon>0;
    props.deco.visible=G.deco>0;
  },
  update(dt){
    if(!ptr.down){props.galleryRoot.rotation.y+=this.vyaw*dt;this.vyaw*=Math.pow(0.4,dt);}
    if(sceneT>4&&Math.abs(this.vyaw)<0.05&&!ptr.down)this.vyaw=0.25;
  },
  down(x,y){this.lastX=x;},
  move(x,y){
    if(this.lastX!=null){
      const d=(x-this.lastX)/Math.max(200,W*0.4);
      props.galleryRoot.rotation.y+=d*3;
      this.vyaw=d*40;this.lastX=x;
    }
  },
  up(){this.lastX=null;},
  leave(){
    hud.gallery.classList.remove('show');
  },
  auto(){return {type:'drag',from:{x:W*0.3,y:H*0.45},to:{x:W*0.75,y:H*0.45}};}
};
function updateGalleryUI(){
  hud.gallery.querySelectorAll('button[data-v]').forEach(b=>{
    b.classList.toggle('sel',b.dataset.v===G.varnish);
  });
}
hud.gallery.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  AudioSys.tap();
  if(b.dataset.v){G.varnish=b.dataset.v;V.setVarnishColor(G.varnish);updateGalleryUI();}
  else if(b.dataset.a==='ribbon'){
    G.ribbon=(G.ribbon+1)%3;
    props.ribbon.visible=G.ribbon>0;
    props.ribbon.traverse(o=>{if(o.isMesh)o.material=G.ribbon===2?props.rainbowMat:M.satinPink;});
  }
  else if(b.dataset.a==='deco'){G.deco=(G.deco+1)%2;props.deco.visible=G.deco>0;}
  else if(b.dataset.a==='again'){
    AudioSys.chime();
    // fresh wood grain
    SEED=(SEED*1103515245+12345)>>>0;
    props.galleryRoot.remove(V.group);scene.add(V.group);
    V.clearVarnish();
    V.fholeProg=[0,0];V.setFholeProgress(-1,0);
    V.showStrings(0);
    go('wood');
  }
});

/* ================= main loop ================= */
let lastT=0;
function frame(ts){
  const dt=Math.min(0.1,(ts-lastT)/1000)||0.016;
  lastT=ts;
  sceneT+=dt;
  try{
    if(cur&&cur.update)cur.update(dt);
    updateCam(dt,ts/1000);
    updateFX(dt);
    world.update(ts/1000,dt);
    // guide pulse
    const pk=0.8+0.35*Math.sin(ts/1000*5);
    guide.dots.forEach((d,i)=>{if(d.visible)d.scale.setScalar(pk*(1-i/guide.dots.length*0.4));});
    // ghost finger
    if(ghost.fn){
      const pts=ghost.fn();
      if(pts&&pts.length){
        ghost.t=(ghost.t+dt/2.2)%1;
        const f=Math.min(pts.length-1,Math.floor(ghost.t*pts.length));
        hud.finger.style.opacity=0.85;
        hud.finger.style.left=pts[f].x+'px';
        hud.finger.style.top=pts[f].y+'px';
      }
    }
    if(wordTimer>0){wordTimer-=dt;if(wordTimer<=0)hud.word.classList.remove('show');}
    setStep(stepIndex());
  }catch(err){console.error('frame',err);}
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
/* fade transition via HUD overlay-less: use renderer clear + simple fade plane */
const fadeDiv=document.createElement('div');
fadeDiv.style.cssText='position:fixed;inset:0;background:#1a120a;pointer-events:none;opacity:0;transition:none;';
document.body.appendChild(fadeDiv);
setInterval(()=>{
  if(fadeDir!==0){
    fadeK+=fadeDir*0.09;
    if(fadeK>=1){fadeK=1;fadeDir=-1;
      if(cur&&cur.leave)cur.leave();
      setScene(nextName);nextName=null;}
    if(fadeK<=0){fadeK=0;fadeDir=0;}
    fadeDiv.style.opacity=clamp(fadeK,0,1);
  }
},33);

setScene('title');
requestAnimationFrame(frame);

/* ================= automation API ================= */
window.__DBG={scene,camera,V,props,world,THREE,setCam,camCur,get cur(){return cur;}};
window.__VW={
  get scene(){return curName;},
  get transitioning(){return fadeDir!==0;},
  auto(){return cur&&cur.auto?cur.auto():{type:'wait'};},
  state(){return {scene:curName,builds:G.builds,varnish:G.varnish,ribbon:G.ribbon,deco:G.deco};},
  go(name){if(scenes[name])go(name);}
};
