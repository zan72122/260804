/* violin + tool geometry, real thickness/arching/joints. units: cm */
import * as THREE from '../lib/three.module.min.js';

export const BL=35.6; // body length

/* ---------- outline (half, x=half width, y=0..1 along body) ---------- */
const SEGS=[
  [{x:0.00,y:0.000},{x:0.125,y:-0.008},{x:0.238,y:0.045},{x:0.236,y:0.160}],
  [{x:0.236,y:0.160},{x:0.234,y:0.250},{x:0.222,y:0.315},{x:0.207,y:0.348}],
  [{x:0.207,y:0.348},{x:0.148,y:0.368},{x:0.143,y:0.412},{x:0.147,y:0.470}],
  [{x:0.147,y:0.470},{x:0.151,y:0.526},{x:0.164,y:0.560},{x:0.220,y:0.585}],
  [{x:0.220,y:0.585},{x:0.238,y:0.628},{x:0.291,y:0.680},{x:0.293,y:0.795}],
  [{x:0.293,y:0.795},{x:0.295,y:0.925},{x:0.170,y:1.006},{x:0.000,y:1.000}],
];
function cubic(p0,c1,c2,p1,t){const u=1-t;return{
  x:u*u*u*p0.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*p1.x,
  y:u*u*u*p0.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*p1.y};}
function sampleHalf(perSeg){const out=[];for(const s of SEGS){for(let i=0;i<perSeg;i++)out.push(cubic(s[0],s[1],s[2],s[3],i/perSeg));}out.push(SEGS[SEGS.length-1][3]);return out;}
export function resample2(pts,n,closed){
  const d=[0];for(let i=1;i<pts.length;i++)d.push(d[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));
  const total=d[d.length-1],out=[];let j=0;
  for(let i=0;i<n;i++){const target=total*i/(closed?n:n-1);
    while(j<d.length-2&&d[j+1]<target)j++;
    const t=(target-d[j])/Math.max(1e-6,d[j+1]-d[j]);
    out.push({x:pts[j].x+(pts[j+1].x-pts[j].x)*t,y:pts[j].y+(pts[j+1].y-pts[j].y)*t});}
  return out;}
export function outlinePts(bl,n){ // closed loop, CCW seen from +z (top)
  const right=sampleHalf(16).map(p=>({x:p.x*bl,y:p.y*bl}));
  const left=right.slice(1,-1).reverse().map(p=>({x:-p.x,y:p.y}));
  return resample2(right.concat(left),n||160,true);
}
export function fSpine(bl,side,n){
  const s=side;
  const seg=[{x:0.055*s,y:0.400},{x:0.125*s,y:0.452},{x:0.036*s,y:0.568},{x:0.104*s,y:0.640}];
  const pts=[];for(let i=0;i<=n;i++)pts.push(cubic(seg[0],seg[1],seg[2],seg[3],i/n));
  return pts.map(p=>({x:p.x*bl,y:p.y*bl}));
}

/* ---------- arched plate: radial grid + edge band ---------- */
export function platePosZ(bl,arch,px,py){ // approximate surface height at plate point
  const C={x:0,y:bl*0.50};
  const dx=px-C.x,dy=py-C.y;
  // find outline radius along this direction (search)
  const loop=plateLoopCache(bl);
  let bestT=1,bd=1e9;
  for(const q of loop){const qa=Math.atan2(q.y-C.y,q.x-C.x),pa=Math.atan2(dy,dx);
    let da=Math.abs(qa-pa);da=Math.min(da,6.283-da);
    if(da<bd){bd=da;bestT=Math.hypot(q.x-C.x,q.y-C.y);}}
  const t=Math.min(1,Math.hypot(dx,dy)/bestT);
  return plateH(arch,t);
}
let _loopCache={};
function plateLoopCache(bl){const k=bl.toFixed(2);if(!_loopCache[k])_loopCache[k]=outlinePts(bl,96);return _loopCache[k];}
function plateH(arch,t){
  return 0.42+arch*Math.pow(Math.cos(Math.min(1,t)*Math.PI/2),1.35)
    -arch*0.10*Math.exp(-Math.pow((t-0.86)/0.09,2));
}
export function makePlateGeo(bl,{arch=1.55,rings=[0,0.18,0.34,0.5,0.64,0.76,0.855,0.925,0.97,1],N=128,down=false}={}){
  const loop=outlinePts(bl,N);
  const C={x:0,y:bl*0.50};
  const pos=[],uv=[],idx=[];
  const w=bl*0.62;
  const P=(x,y,z)=>{pos.push(x,y,down?-z:z);uv.push(x/w+0.5,y/bl);};
  // center vertex
  P(C.x,C.y,plateH(arch,0));
  // rings
  for(let r=0;r<rings.length;r++){
    const t=rings[r],z=plateH(arch,t);
    for(let i=0;i<N;i++){
      const q=loop[i];
      P(C.x+(q.x-C.x)*t,C.y+(q.y-C.y)*t,z);
    }
  }
  const ringStart=r=>1+r*N;
  // center fan
  for(let i=0;i<N;i++)idx.push(0,ringStart(0)+i,ringStart(0)+(i+1)%N);
  // ring bands
  for(let r=0;r<rings.length-1;r++){
    const a=ringStart(r),b=ringStart(r+1);
    for(let i=0;i<N;i++){const j=(i+1)%N;
      idx.push(a+i,b+i,b+j, a+i,b+j,a+j);}
  }
  // edge band: lip out + skirt down to glue plane
  const lipS=1.028, e0=rings.length-1;
  const base=pos.length/3;
  for(let i=0;i<N;i++){const q=loop[i];P(C.x+(q.x-C.x)*lipS,C.y+(q.y-C.y)*lipS,0.34);}
  for(let i=0;i<N;i++){const q=loop[i];P(C.x+(q.x-C.x)*lipS,C.y+(q.y-C.y)*lipS,0.0);}
  for(let i=0;i<N;i++){const q=loop[i];P(C.x+(q.x-C.x)*0.985,C.y+(q.y-C.y)*0.985,0.0);}
  const A=ringStart(e0),B0=base,B1=base+N,B2=base+2*N;
  for(let i=0;i<N;i++){const j=(i+1)%N;
    idx.push(A+i,B0+i,B0+j, A+i,B0+j,A+j);
    idx.push(B0+i,B1+i,B1+j, B0+i,B1+j,B0+j);
    idx.push(B1+i,B2+i,B2+j, B1+i,B2+j,B1+j);
  }
  const g=new THREE.BufferGeometry();
  if(down){ // reverse winding
    for(let i=0;i<idx.length;i+=3){const t2=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t2;}
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------- rib garland ribbon (with thickness), optional partial arc ---------- */
export function makeRibsGeo(bl,{height=3.05,thick=0.16,N=200,from=0,to=1,z0=0}={}){
  const loop=outlinePts(bl,N);
  // per-point outward normal
  const nrm=[];
  for(let i=0;i<N;i++){
    const a=loop[(i-1+N)%N],b=loop[(i+1)%N];
    let nx=(b.y-a.y),ny=-(b.x-a.x);
    const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
    // ensure outward (away from centroid)
    const cx=loop[i].x-0,cy=loop[i].y-bl*0.5;
    if(nx*cx+ny*cy<0){nx=-nx;ny=-ny;}
    nrm.push({x:nx,y:ny});
  }
  const i0=Math.floor(from*N),i1=Math.ceil(to*N);
  const count=i1-i0;
  const closed=(from<=0&&to>=1);
  const pos=[],uv=[],idx=[];
  const rows=[];
  for(let k=0;k<=count;k++){
    const i=((i0+k)%N+N)%N;
    const p=loop[i],n=nrm[i];
    const ox=p.x+n.x*thick/2, oy=p.y+n.y*thick/2;
    const ix=p.x-n.x*thick/2, iy=p.y-n.y*thick/2;
    const u=k/count*6;
    const b=pos.length/3;
    pos.push(ox,oy,z0, ox,oy,z0-height, ix,iy,z0-height, ix,iy,z0);
    uv.push(u,0, u,1, u,1, u,0);
    rows.push(b);
    if(closed&&k===count)break;
  }
  for(let k=0;k<count;k++){
    const a=rows[k],b=rows[k+1];
    idx.push(a,b,b+1, a,b+1,a+1);       // outer wall
    idx.push(a+2,b+2,b+3, a+2,b+3,a+3); // inner wall
    idx.push(a+3,b+3,b, a+3,b,a);       // top edge
    idx.push(a+1,b+1,b+2, a+1,b+2,a+2); // bottom edge
  }
  if(!closed){ // end caps
    const s=rows[0],e=rows[rows.length-1];
    idx.push(s,s+1,s+2, s,s+2,s+3);
    idx.push(e,e+2,e+1, e,e+3,e+2);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------- generic loft: sections of equal-length closed point rings ---------- */
export function loft(sections,{caps=true,uvV=null}={}){
  const n=sections[0].length;
  const pos=[],uv=[],idx=[];
  sections.forEach((sec,s)=>{
    sec.forEach((p,i)=>{
      pos.push(p.x,p.y,p.z);
      uv.push(i/n,uvV?uvV[s]:s/(sections.length-1));
    });
  });
  for(let s=0;s<sections.length-1;s++){
    const a=s*n,b=(s+1)*n;
    for(let i=0;i<n;i++){const j=(i+1)%n;
      idx.push(a+i,b+i,b+j, a+i,b+j,a+j);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const idxAll=idx.slice();
  if(caps){
    // fan caps (approximate centroid)
    const capFan=(start,flip)=>{
      let cx=0,cy=0,cz=0;
      for(let i=0;i<n;i++){cx+=pos[(start+i)*3];cy+=pos[(start+i)*3+1];cz+=pos[(start+i)*3+2];}
      const ci=pos.length/3;pos.push(cx/n,cy/n,cz/n);uv.push(0.5,flip?0:1);
      for(let i=0;i<n;i++){const j=(i+1)%n;
        if(flip)idxAll.push(ci,start+j,start+i);else idxAll.push(ci,start+i,start+j);}
    };
    capFan(0,false);
    capFan((sections.length-1)*n,true);
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  }
  g.setIndex(idxAll);
  g.computeVertexNormals();
  return g;
}
export function ringSection(cx,cy,cz,rx,rz,n,rot=0){
  const pts=[];
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+rot;
    pts.push(new THREE.Vector3(cx+Math.cos(a)*rx,cy,cz+Math.sin(a)*rz));}
  return pts;
}

/* ---------- sweep tube with varying radius along 3D path ---------- */
export function sweep(path,rFn,{seg=10,rx=1,rz=1,caps=true}={}){
  const sections=[];
  const up=new THREE.Vector3(0,0,1);
  for(let s=0;s<path.length;s++){
    const p=path[s];
    const t=(s<path.length-1)?path[s+1].clone().sub(p):p.clone().sub(path[s-1]);
    t.normalize();
    let n1=new THREE.Vector3().crossVectors(up,t);
    if(n1.lengthSq()<1e-6)n1.set(1,0,0);n1.normalize();
    const n2=new THREE.Vector3().crossVectors(t,n1).normalize();
    const r=rFn(s/(path.length-1));
    const ring=[];
    const N=seg;
    for(let i=0;i<N;i++){
      const a=i/N*Math.PI*2;
      ring.push(p.clone().addScaledVector(n1,Math.cos(a)*r*rx).addScaledVector(n2,Math.sin(a)*r*rz));
    }
    sections.push(ring);
  }
  return loft(sections,{caps});
}

/* ---------- bridge with real cutouts ---------- */
export function makeBridgeGeo(){
  const s=new THREE.Shape();
  const W2=2.05,H=3.15;
  s.moveTo(-W2,0);
  s.lineTo(-W2,0.55);s.quadraticCurveTo(-W2*0.72,0.72,-W2*0.62,1.15); // foot->waist notch
  s.quadraticCurveTo(-W2*0.92,1.5,-W2*0.72,1.95);                     // wing
  s.quadraticCurveTo(-W2*0.6,2.28,-W2*0.42,2.42);
  s.quadraticCurveTo(0,H*1.02-Math.abs(0)*0,W2*0.42,2.42);            // crown
  s.quadraticCurveTo(W2*0.6,2.28,W2*0.72,1.95);
  s.quadraticCurveTo(W2*0.92,1.5,W2*0.62,1.15);
  s.quadraticCurveTo(W2*0.72,0.72,W2,0.55);s.lineTo(W2,0);
  s.quadraticCurveTo(W2*0.6,0.12,W2*0.42,0);                          // right foot
  s.lineTo(W2*0.30,0);s.lineTo(W2*0.30,0.5);
  s.quadraticCurveTo(0,0.85,-W2*0.30,0.5);s.lineTo(-W2*0.30,0);       // arch between feet
  s.lineTo(-W2*0.42,0);s.quadraticCurveTo(-W2*0.6,0.12,-W2,0);
  // kidney holes
  const hL=new THREE.Path();
  hL.absellipse(-W2*0.42,1.55,0.30,0.42,0,Math.PI*2);
  const hR=new THREE.Path();
  hR.absellipse(W2*0.42,1.55,0.30,0.42,0,Math.PI*2);
  const hC=new THREE.Path();
  hC.absellipse(0,2.05,0.24,0.3,0,Math.PI*2);
  s.holes.push(hL,hR,hC);
  const g=new THREE.ExtrudeGeometry(s,{depth:0.42,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.04,bevelSegments:1,curveSegments:10});
  g.translate(0,0,-0.21);
  return g;
}

/* ---------- fingerboard (cambered, tapered) ---------- */
export function makeFingerboardGeo(len=20.5,w0=2.5,w1=3.35,th=0.55,camber=0.42){
  const sec=(y,w)=>{
    const pts=[];
    const M=9;
    for(let i=0;i<=M;i++){const x=-w/2+w*i/M;
      pts.push(new THREE.Vector3(x,y,th+camber*(1-Math.pow(2*i/M-1,2))));}
    pts.push(new THREE.Vector3(w/2,y,0));
    pts.push(new THREE.Vector3(-w/2,y,0));
    return pts;
  };
  return loft([sec(0,w0),sec(len*0.5,(w0+w1)/2),sec(len,w1)],{caps:true});
}

/* ---------- neck + heel ---------- */
export function makeNeckGeo(len=13.2){
  const sec=(y,w,d,drop)=>{ // D-shape: flat top (fingerboard side), round bottom
    const pts=[];const M=10;
    for(let i=0;i<=M;i++){const a=Math.PI*(i/M);
      pts.push(new THREE.Vector3(Math.cos(a)*w/2,y,-Math.sin(a)*d+drop));}
    return pts;
  };
  const sections=[
    sec(0,3.4,3.6,0),      // heel root (at body)
    sec(1.6,3.0,2.6,0),
    sec(len*0.45,2.55,1.9,0),
    sec(len*0.8,2.45,1.8,0),
    sec(len,2.5,1.9,0),
  ];
  return loft(sections,{caps:true});
}

/* ---------- scroll (volute sweep) + pegbox ---------- */
export function makeScrollGroup(mat){
  const grp=new THREE.Group();
  // spiral in YZ plane
  const path=[];
  const turns=2.35;
  for(let i=0;i<=64;i++){
    const th=i/64*turns*Math.PI*2;
    const r=1.62*Math.exp(-0.115*th);
    path.push(new THREE.Vector3(0,Math.sin(th+Math.PI*0.9)*r,Math.cos(th+Math.PI*0.9)*r+0.4));
  }
  const tube=new THREE.Mesh(sweep(path,t=>0.62*(1-t*0.68)+0.12,{seg:10,rx:1.65,rz:1}),mat);
  grp.add(tube);
  // eyes
  for(const s of[-1,1]){
    const eye=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.42,0.3,16),mat);
    eye.rotation.z=Math.PI/2;
    eye.position.set(s*0.62,path[64].y,path[64].z);
    grp.add(eye);
  }
  return grp;
}
export function makePegboxGroup(mat,ebMat){
  const grp=new THREE.Group();
  const L=4.6;
  for(const s of[-1,1]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(0.5,L,1.75),mat);
    wall.position.set(s*0.95,-L/2,0);
    wall.rotation.x=-0.06;
    grp.add(wall);
  }
  const floor=new THREE.Mesh(new THREE.BoxGeometry(2.0,L,0.5),mat);
  floor.position.set(0,-L/2,-0.62);floor.rotation.x=-0.06;
  grp.add(floor);
  return grp;
}
export function makePegGroup(mat){
  const grp=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.3,3.4,12),mat);
  shaft.rotation.z=Math.PI/2;
  grp.add(shaft);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.42,0.35,14),mat);
  collar.rotation.z=Math.PI/2;collar.position.x=1.55;
  grp.add(collar);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.85,16,12),mat);
  head.scale.set(0.42,1.25,0.8);
  head.position.x=2.15;
  grp.add(head);
  return grp;
}

/* ---------- tailpiece ---------- */
export function makeTailpieceGeo(){
  const s=new THREE.Shape();
  const w0=1.55,w1=0.85,L=11;
  s.moveTo(-w0,0);
  s.quadraticCurveTo(0,-0.45,w0,0);
  s.lineTo(w1,L*0.9);
  s.quadraticCurveTo(0,L*1.04,-w1,L*0.9);
  s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:0.42,bevelEnabled:true,bevelThickness:0.06,bevelSize:0.08,bevelSegments:2,curveSegments:8});
  return g;
}

/* ---------- bend strip: ribbon with thickness along morphing centerline ---------- */
export function bendStripSections(t,{len=32,R=8.6,height=3.05,thick=0.16,n=36,cx=0,cy=0,cz=0}={}){
  // straight vertical strip tangent to iron (at x=-R from arc center) morphing to arc around (cx,cz)
  const secs=[];
  const ease=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  for(let i=0;i<=n;i++){
    const u=i/n-0.5;
    const sx=cx-R, sz=cz+u*len;
    const a=Math.PI+u*2.05;
    const ax=cx+Math.cos(a)*R, az=cz+Math.sin(a)*R;
    const local=Math.max(0,Math.min(1,ease*1.9-Math.abs(u)*1.8));
    const px=sx+(ax-sx)*local, pz=sz+(az-sz)*local;
    // tangent for thickness dir
    secs.push({p:new THREE.Vector3(px,cy,pz)});
  }
  // compute per-section frames -> 4 corner pts (thickness along horizontal normal, height along y)
  const rings=[];
  for(let i=0;i<=n;i++){
    const p=secs[i].p;
    const q=secs[Math.min(n,i+1)].p, q0=secs[Math.max(0,i-1)].p;
    const tx=q.x-q0.x,tz=q.z-q0.z;
    const l=Math.hypot(tx,tz)||1;
    const nx=-tz/l,nz=tx/l;
    rings.push([
      new THREE.Vector3(p.x+nx*thick/2,p.y-height/2,p.z+nz*thick/2),
      new THREE.Vector3(p.x+nx*thick/2,p.y+height/2,p.z+nz*thick/2),
      new THREE.Vector3(p.x-nx*thick/2,p.y+height/2,p.z-nz*thick/2),
      new THREE.Vector3(p.x-nx*thick/2,p.y-height/2,p.z-nz*thick/2),
    ]);
  }
  return rings;
}
export function stripGeoFromRings(rings){
  return loft(rings,{caps:true});
}

/* ---------- simple hand + forearm (kept small on screen) ---------- */
export function makeHandGroup(skinMat,sleeveMat){
  const grp=new THREE.Group();
  const palm=new THREE.Mesh(new THREE.SphereGeometry(1.05,14,10),skinMat);
  palm.scale.set(1.0,1.25,0.55);
  grp.add(palm);
  for(let i=0;i<4;i++){
    const f=new THREE.Mesh(new THREE.CapsuleGeometry(0.28,1.3,3,8),skinMat);
    f.position.set(-0.7+i*0.46,1.35,-0.15);
    f.rotation.x=0.9;
    grp.add(f);
    const f2=new THREE.Mesh(new THREE.CapsuleGeometry(0.25,0.8,3,8),skinMat);
    f2.position.set(-0.7+i*0.46,1.9,-0.85);
    f2.rotation.x=1.9;
    grp.add(f2);
  }
  const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(0.3,1.1,3,8),skinMat);
  thumb.position.set(1.05,0.3,-0.3);
  thumb.rotation.set(1.2,0,-0.7);
  grp.add(thumb);
  const wrist=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.8,1.2,12),skinMat);
  wrist.position.set(0,-1.45,0.05);
  grp.add(wrist);
  const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.5,5.5,14),sleeveMat);
  sleeve.position.set(0,-4.5,0.1);
  grp.add(sleeve);
  grp.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  return grp;
}

/* ---------- gallery ribbon bow ---------- */
export function makeRibbonGroup(mat){
  const grp=new THREE.Group();
  for(const s of[-1,1]){
    const loop=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.42,10,24,Math.PI*1.5),mat);
    loop.scale.set(1,0.62,0.5);
    loop.position.x=s*1.28;
    loop.rotation.z=s>0?-0.5:Math.PI+0.5;
    grp.add(loop);
    const tailPath=[];
    for(let i=0;i<=10;i++){const t=i/10;
      tailPath.push(new THREE.Vector3(s*(0.3+t*1.5+Math.sin(t*3)*0.2),-t*3.2,Math.sin(t*6)*0.25));}
    const tail=new THREE.Mesh(sweep(tailPath,()=>0.34,{seg:6,rx:1.7,rz:0.4}),mat);
    grp.add(tail);
  }
  const knot=new THREE.Mesh(new THREE.SphereGeometry(0.62,12,10),mat);
  knot.scale.set(1.1,0.85,0.7);
  grp.add(knot);
  return grp;
}
