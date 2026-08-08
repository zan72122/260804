/*
 * Model turntable. Freezes the game, poses the hawk by hand and moves the
 * camera, so wing folds and flight poses can be judged without chasing them
 * through gameplay. The bird faces +Z, so a camera on +Z is head-on and `top`
 * looks straight down — the only view that tells the truth about planform.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:560,height:440}, deviceScaleFactor:2 });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:4173/',{waitUntil:'load'});
await p.waitForTimeout(4000);
await p.evaluate(()=>{ window.__poseHold = true; });

const POSE = {
  perched:  {spread:0,   flap:0,    cup:0, tail:0,   legs:1, bodyPitch:0,     tailPitch:0,  headYaw:0.55, ruffle:0.2},
  glide:    {spread:1,   flap:0,    cup:0, tail:0.5, legs:0, bodyPitch:-0.05, tailPitch:0,  headYaw:0,    ruffle:0},
  downbeat: {spread:1,   flap:-0.9, cup:0, tail:0.4, legs:0, bodyPitch:0.05,  tailPitch:0,  headYaw:0,    ruffle:0},
  flare:    {spread:1,   flap:0.1,  cup:1, tail:1,   legs:1, bodyPitch:0.7,   tailPitch:0.75, headYaw:0,  ruffle:0.4},
};
const VIEW = {
  headon: {a: 0,           h: 2.42, d: 1.75, fov: 34},
  side:   {a: Math.PI/2,   h: 2.42, d: 1.75, fov: 34},
  top:    {a: 0.001,       h: 4.25, d: 0.03, fov: 34},
};
const PLAN = {
  perched:  ['side', 'top'],
  glide:    ['headon', 'top', 'side'],
  downbeat: ['headon'],
  flare:    ['headon', 'side'],
};

for (const [pn, list] of Object.entries(PLAN)) {
  await p.evaluate((pose)=>{
    const g = window.__takajo;
    Object.assign(g.hawk.pose, pose);
    g.hawk.root.position.set(0, 2.4, 0);
    g.hawk.root.rotation.set(0, 0, 0);
    g.hawk.apply();
  }, POSE[pn]);
  for (const vn of list) {
    await p.evaluate((v)=>{
      window.__freeCam = { pos:[Math.sin(v.a)*v.d, v.h, Math.cos(v.a)*v.d], look:[0, 2.36, 0], fov: v.fov };
    }, VIEW[vn]);
    await p.waitForTimeout(1700);
    await p.screenshot({path:`${OUT}/${pn}-${vn}.png`});
    console.log('shot', pn, vn);
  }
}
await b.close();
