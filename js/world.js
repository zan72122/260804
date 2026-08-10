/* workshop world: room / bench / window light / props. units: cm, y-up */
import * as THREE from '../lib/three.module.min.js';
import * as TX from './textures.js';
import * as GEO from './geometry.js';

export function buildMaterials(seed){
  const spruce=TX.spruceSet(seed);
  const maple=TX.mapleSet(seed+7);
  const ebony=TX.ebonySet();
  const bench=TX.benchSet();
  const floor=TX.floorSet();
  const plaster=TX.plasterSet();
  const metal=TX.metalSet();
  const outside=TX.outsideSet();
  const linen=TX.linenSet();
  const mk=(set,{rough=1,rep=[1,1],normal=1.4,clearcoat=0,ccRough=0.3,color=0xffffff,metalness=0}={})=>{
    const m=new THREE.MeshPhysicalMaterial({
      color,metalness,
      map:TX.tex(set.albedo,{repeat:rep}),
      roughnessMap:set.rough?TX.tex(set.rough,{srgb:false,repeat:rep}):null,
      roughness:rough,
      normalMap:set.height?TX.tex(TX.normalFromHeight(set.height,normal),{srgb:false,repeat:rep}):null,
      clearcoat,clearcoatRoughness:ccRough,
      side:THREE.DoubleSide,
    });
    return m;
  };
  const M={
    spruceSets:spruce, mapleSets:maple,
    spruce:mk(spruce,{normal:1.2}),
    maple:mk(maple,{normal:1.6}),
    mapleRib:mk(maple,{normal:1.6,rep:[3,1]}),
    ebony:mk(ebony,{rough:0.55,normal:0.8,clearcoat:0.5,ccRough:0.25}),
    benchTop:mk(bench,{normal:2.2,rep:[2,1]}),
    benchLeg:mk(bench,{normal:1.6,rep:[0.5,1],color:0xcfc0aa}),
    floor:mk(floor,{normal:2.0,rep:[4,4]}),
    wall:mk(plaster,{rough:0.95,normal:0.5,rep:[6,3]}),
    metal:new THREE.MeshStandardMaterial({color:0xb8bcc2,metalness:0.85,roughness:0.42,
      map:TX.tex(metal.albedo),roughnessMap:TX.tex(metal.rough,{srgb:false})}),
    brass:new THREE.MeshStandardMaterial({color:0xc99a4e,metalness:0.9,roughness:0.35}),
    ironHot:new THREE.MeshStandardMaterial({color:0x4a3b33,metalness:0.85,roughness:0.35,
      emissive:0xff5a18,emissiveIntensity:0.0}),
    glass:new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:0.06,
      transmission:0.92,thickness:0.4,transparent:true,opacity:0.55,ior:1.45}),
    outside:new THREE.MeshBasicMaterial({map:TX.tex(outside.albedo)}),
    skin:new THREE.MeshStandardMaterial({color:0xd9a77e,roughness:0.6}),
    linen:mk(linen,{rough:0.95,normal:1.0,rep:[2,2],color:0x8a5c50}),
    darkWood:new THREE.MeshStandardMaterial({color:0x3d2c1a,roughness:0.8}),
    stringMat:new THREE.MeshStandardMaterial({color:0xd8dce2,metalness:0.9,roughness:0.28}),
    chalk:new THREE.MeshBasicMaterial({color:0xfff4d8,transparent:true,opacity:0.85}),
    guideGlow:new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:0.9}),
    postWood:new THREE.MeshStandardMaterial({color:0xe8d5ac,roughness:0.85}),
    satinPink:new THREE.MeshPhysicalMaterial({color:0xf08bb0,roughness:0.35,clearcoat:0.6,ccRough:0.4,sheen:1,sheenColor:0xffd0e0}),
    paper:new THREE.MeshStandardMaterial({color:0xfff2c8,roughness:0.9,side:THREE.DoubleSide}),
  };
  return M;
}
export const VARNISH_COLORS={
  amber:{tint:0xc98a2a,cc:0.05},
  red:{tint:0x8e3a18,cc:0.06},
  rose:{tint:0xc06070,cc:0.08},
};
export function varnishOverlayMat(M,color,maskTexture){
  const v=VARNISH_COLORS[color];
  const m=new THREE.MeshPhysicalMaterial({
    color:v.tint,
    map:M.spruce.map,
    transparent:true,opacity:0.99,
    alphaMap:maskTexture,
    roughness:0.22,clearcoat:1.0,clearcoatRoughness:v.cc,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    depthWrite:false,
  });
  m.blending=THREE.NormalBlending;
  return m;
}

/* planar UV in body local xy (for varnish overlays across all parts) */
export function planarUV(geo,w,h,cx=0,cy=GEO.BL*0.5){
  const g=geo.clone();
  const p=g.getAttribute('position');
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    uv[i*2]=(p.getX(i)-cx)/w+0.5;
    uv[i*2+1]=(p.getY(i)-cy)/h+0.5;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return g;
}

export function buildWorld(scene,M){
  const world={};
  const BENCH_Y=92;
  world.benchY=BENCH_Y;

  // ---- room ----
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(560,460),M.floor);
  floor.rotation.x=-Math.PI/2;floor.position.set(0,0,60);
  floor.receiveShadow=true;scene.add(floor);
  const backWall=new THREE.Mesh(new THREE.PlaneGeometry(560,280),M.wall);
  backWall.position.set(0,140,-70);backWall.receiveShadow=true;scene.add(backWall);
  const sideWall=new THREE.Mesh(new THREE.PlaneGeometry(460,280),M.wall);
  sideWall.rotation.y=Math.PI/2;sideWall.position.set(-260,140,60);sideWall.receiveShadow=true;scene.add(sideWall);
  const sideWallR=sideWall.clone();sideWallR.rotation.y=-Math.PI/2;sideWallR.position.x=260;scene.add(sideWallR);

  // ---- window on back wall ----
  const win=new THREE.Group();
  const WX=-118,WY=165,WW=95,WH=115;
  const outside=new THREE.Mesh(new THREE.PlaneGeometry(WW*1.4,WH*1.4),M.outside);
  outside.position.set(0,0,-14);win.add(outside);
  const frameMat=new THREE.MeshStandardMaterial({color:0xe8e0d0,roughness:0.7});
  const fr=(w,h,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,6),frameMat);
    m.position.set(x,y,z);m.castShadow=true;win.add(m);return m;};
  fr(WW+12,8,0,WH/2+3,0);fr(WW+12,8,0,-WH/2-3,0);
  fr(8,WH+14,-WW/2-3,0,0);fr(8,WH+14,WW/2+3,0,0);
  fr(4.5,WH,0,0,-1);fr(WW,4.5,0,WH/6,-1);fr(WW,4.5,0,-WH/6,-1);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(WW,WH),M.glass);
  glass.position.z=-2;win.add(glass);
  const sill=new THREE.Mesh(new THREE.BoxGeometry(WW+22,6,14),frameMat);
  sill.position.set(0,-WH/2-9,4);sill.castShadow=true;sill.receiveShadow=true;win.add(sill);
  win.position.set(WX,WY,-69);
  scene.add(win);

  // ---- bench ----
  const bench=new THREE.Group();
  const topGeo=new THREE.BoxGeometry(250,9,64);
  const top=new THREE.Mesh(topGeo,M.benchTop);
  top.position.set(0,BENCH_Y-4.5,-18);
  top.castShadow=true;top.receiveShadow=true;bench.add(top);
  // worn front edge chamfer strip
  const edge=new THREE.Mesh(new THREE.BoxGeometry(250,2.4,3),M.benchLeg);
  edge.position.set(0,BENCH_Y-8.2,13.2);edge.rotation.x=0.5;bench.add(edge);
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(9,BENCH_Y-9,9),M.benchLeg);
    leg.position.set(sx*110,(BENCH_Y-9)/2,-18+sz*22);
    leg.castShadow=true;leg.receiveShadow=true;bench.add(leg);
  }
  const stretcher=new THREE.Mesh(new THREE.BoxGeometry(228,7,44),M.benchLeg);
  stretcher.position.set(0,26,-18);stretcher.castShadow=true;stretcher.receiveShadow=true;
  bench.add(stretcher);
  // stuff on lower shelf
  const crate=new THREE.Mesh(new THREE.BoxGeometry(34,20,26),M.darkWood);
  crate.position.set(-70,40,-20);crate.castShadow=true;bench.add(crate);
  scene.add(bench);
  world.bench=bench;

  // ---- back shelf with jars ----
  const shelf=new THREE.Group();
  const board=new THREE.Mesh(new THREE.BoxGeometry(150,4,22),M.benchLeg);
  board.castShadow=true;board.receiveShadow=true;shelf.add(board);
  for(const bx of[-60,0,60]){
    const br=new THREE.Mesh(new THREE.BoxGeometry(4,14,18),M.darkWood);
    br.position.set(bx,-9,0);shelf.add(br);
  }
  const jarColors=[0xc98a2a,0x8e3a18,0xc06070,0x6b4f2a];
  world.jars=[];
  jarColors.forEach((c,i)=>{
    const jg=new THREE.Group();
    const glassJar=new THREE.Mesh(new THREE.CylinderGeometry(5,5.5,13,16),M.glass);
    const liquid=new THREE.Mesh(new THREE.CylinderGeometry(4.4,4.9,10,16),
      new THREE.MeshPhysicalMaterial({color:c,roughness:0.15,transmission:0.35,thickness:2}));
    liquid.position.y=-1;
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(5.2,5.2,2.2,16),M.darkWood);
    lid.position.y=7.5;
    jg.add(glassJar,liquid,lid);
    jg.position.set(-52+i*34,8.6,0);
    jg.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    shelf.add(jg);
    world.jars.push(jg);
  });
  shelf.position.set(70,152,-58);
  scene.add(shelf);

  // ---- tool rack on wall ----
  const rack=new THREE.Group();
  const rail=new THREE.Mesh(new THREE.BoxGeometry(110,5,4),M.darkWood);
  rack.add(rail);
  for(let i=0;i<6;i++){
    const t=new THREE.Group();
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.9,10,10),M.benchLeg);
    handle.position.y=-7;
    const blade=new THREE.Mesh(new THREE.BoxGeometry(1.6,12,0.5),M.metal);
    blade.position.y=-17;
    t.add(handle,blade);
    t.position.x=-45+i*18;
    t.rotation.z=(i%2?0.04:-0.05);
    t.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    rack.add(t);
  }
  rack.position.set(-10,145,-66);
  scene.add(rack);

  // ---- two finished violins hanging on wall ----
  world.hangSlots=[];
  for(let i=0;i<2;i++){
    const peg=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,8,8),M.darkWood);
    peg.rotation.x=Math.PI/2;
    peg.position.set(120+i*52,206,-66);
    peg.castShadow=true;
    scene.add(peg);
    world.hangSlots.push(new THREE.Vector3(120+i*52,200,-62));
  }

  // ---- lamp (practical light) ----
  const lamp=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(7,9,3,16),M.metal);
  base.castShadow=true;lamp.add(base);
  const arm1=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,34,8),M.metal);
  arm1.position.set(0,17,0);arm1.rotation.z=0.35;arm1.castShadow=true;lamp.add(arm1);
  const arm2=new THREE.Mesh(new THREE.CylinderGeometry(1,1,30,8),M.metal);
  arm2.position.set(-12,38,-2);arm2.rotation.z=-0.9;arm2.castShadow=true;lamp.add(arm2);
  const shade=new THREE.Mesh(new THREE.ConeGeometry(9,11,20,1,true),
    new THREE.MeshStandardMaterial({color:0x2f5233,metalness:0.4,roughness:0.4,side:THREE.DoubleSide}));
  shade.position.set(-26,44,-3);shade.rotation.z=0.8;shade.castShadow=true;lamp.add(shade);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(2.6,10,8),
    new THREE.MeshStandardMaterial({color:0xfff2cc,emissive:0xffd9a0,emissiveIntensity:2.2}));
  bulb.position.set(-27.5,41.5,-3);lamp.add(bulb);
  lamp.position.set(96,BENCH_Y,-34);
  scene.add(lamp);
  const lampLight=new THREE.PointLight(0xffc47d,900,220,2);
  lampLight.position.set(96-28,BENCH_Y+40,-36);
  lampLight.castShadow=true;
  lampLight.shadow.mapSize.set(512,512);
  lampLight.shadow.bias=-0.01;
  scene.add(lampLight);
  world.lampLight=lampLight;

  // ---- global lights ----
  const hemi=new THREE.HemisphereLight(0xbcccdd,0x53422c,0.55);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff0d8,3.2);
  sun.position.set(WX-70,260,90);
  sun.target.position.set(20,BENCH_Y,-16);
  scene.add(sun);scene.add(sun.target);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  const sc=sun.shadow.camera;
  sc.left=-160;sc.right=160;sc.top=140;sc.bottom=-120;sc.near=50;sc.far=700;
  sun.shadow.bias=-0.0018;sun.shadow.normalBias=0.6;
  scene.add(sun);
  world.sun=sun;
  const fill=new THREE.DirectionalLight(0x9fb4c8,0.5);
  fill.position.set(120,140,220);
  scene.add(fill);

  // ---- dust motes in the light ----
  const dustGeo=new THREE.BufferGeometry();
  const NP=90,pp=new Float32Array(NP*3),sp=new Float32Array(NP);
  for(let i=0;i<NP;i++){
    pp[i*3]=-140+Math.random()*180;
    pp[i*3+1]=60+Math.random()*140;
    pp[i*3+2]=-60+Math.random()*120;
    sp[i]=Math.random();
  }
  dustGeo.setAttribute('position',new THREE.BufferAttribute(pp,3));
  const dustTexC=TX.cnv(32,32);{const g=dustTexC.getContext('2d');
    const r=g.createRadialGradient(16,16,1,16,16,15);
    r.addColorStop(0,'rgba(255,244,220,0.9)');r.addColorStop(1,'rgba(255,244,220,0)');
    g.fillStyle=r;g.fillRect(0,0,32,32);}
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({
    map:new THREE.CanvasTexture(dustTexC),size:1.1,transparent:true,opacity:0.5,
    depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
  scene.add(dust);
  world.dust=dust;world._dustSeed=sp;
  world.update=(t,dt)=>{
    const p=dust.geometry.attributes.position;
    for(let i=0;i<NP;i++){
      p.array[i*3]+=Math.sin(t*0.5+sp[i]*9)*0.02;
      p.array[i*3+1]+=Math.sin(t*0.3+sp[i]*7)*0.015-0.008;
      if(p.array[i*3+1]<40)p.array[i*3+1]=200;
    }
    p.needsUpdate=true;
  };

  // ---- blob contact shadow helper ----
  const blobTex=new THREE.CanvasTexture(TX.blobShadow());
  world.makeBlob=(w,l)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),
      new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}));
    m.rotation.x=-Math.PI/2;
    m.renderOrder=1;
    return m;
  };

  // ---- cushion (violin rest on bench) ----
  const cushion=new THREE.Mesh(new THREE.BoxGeometry(30,4,54),M.linen);
  cushion.position.set(30,BENCH_Y+2,-14);
  cushion.receiveShadow=true;cushion.castShadow=true;
  scene.add(cushion);
  world.cushion=cushion;

  return world;
}
