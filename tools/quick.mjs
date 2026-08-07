/* 状態を指定して 1 枚だけ撮る高速イテレーション用 */
import { chromium } from 'playwright';
import fs from 'fs';
const OUT='/tmp/claude-0/-home-user-260804/22733108-75c0-5bd5-987e-4304adc8d2d3/scratchpad/shots';
fs.mkdirSync(OUT,{recursive:true});
const scene = process.argv[2]||'drill';
const view = process.argv[3]||'land';
const V={land:{width:1024,height:640},port:{width:430,height:860}};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage({viewport:V[view],deviceScaleFactor:1});
p.on('pageerror',e=>console.log('ERR:',e.message));
await p.goto('http://127.0.0.1:8080/index.html');
await p.waitForFunction(()=>!!window.__tbm);
const sim=(s)=>p.evaluate(n=>{const g=window.__tbm;for(let i=0;i<Math.round(n*60);i++)g.update(1/60);},s);
const st=()=>p.evaluate(()=>window.__tbm.state);
await p.locator('#startBtn').dispatchEvent('pointerdown');
await p.evaluate(()=>{document.getElementById('title').style.display='none';});
await p.evaluate(()=>{const g=window.__tbm;g.onLever(1);g.onLeverDone();}); await sim(3.2);
if(scene!=='idle'){
  await p.evaluate(()=>window.__tbm.setDigging(true));
  if(scene==='drillA') await sim(1.2);
  else if(scene==='drillB'){ for(let i=0;i<40&&await st()==='drill';i++) await sim(0.3); await sim(0.1); }
  else { for(let i=0;i<40&&await st()==='drill';i++) await sim(0.3); await sim(2.4); }
}
if(['erect','key','ring','reveal'].includes(scene)){
  await p.evaluate(()=>{const g=window.__tbm;g.onJack(1);g.onJackDone();});
  const n = scene==='erect'?3:5;
  for(let i=0;i<n;i++){
    for(let k=0;k<40&&await st()!=='erectMove';k++) await sim(0.2);
    await p.evaluate(()=>{const g=window.__tbm;if(g.held)g.pointerAngle=g.held.spec.angle*Math.PI/180;});
    await sim(0.9);
    await p.evaluate(()=>{window.__tbm.pointerAngle=null;}); await sim(1.0);
  }
  if(scene==='erect'){ for(let k=0;k<30&&await st()!=='erectMove';k++) await sim(0.2); await sim(0.4); }
  if(scene==='key'){ for(let k=0;k<40&&await st()!=='keyPush';k++) await sim(0.2); }
  if(scene==='ring'||scene==='reveal'){ for(let k=0;k<40&&await st()!=='keyPush';k++) await sim(0.2);
    await p.evaluate(()=>window.__tbm.pushKey()); await sim(1.0); }
  if(scene==='reveal'){
    for(let r=0;r<3;r++){
      await sim(2.2);
      await p.evaluate(()=>window.__tbm.setDigging(true));
      for(let k=0;k<80&&await st()==='drill';k++) await sim(0.3);
      await sim(1.8);
      await p.evaluate(()=>{const g=window.__tbm;g.onJack(1);g.onJackDone();});
      for(let i=0;i<6;i++){
        for(let k=0;k<40&&!['erectMove','keyPush'].includes(await st());k++) await sim(0.2);
        if(await st()==='keyPush'){ await p.evaluate(()=>window.__tbm.pushKey()); await sim(1.0); break; }
        await p.evaluate(()=>{const g=window.__tbm;if(g.held)g.pointerAngle=g.held.spec.angle*Math.PI/180;});
        await sim(0.9);
        await p.evaluate(()=>{window.__tbm.pointerAngle=null;}); await sim(1.0);
      }
    }
    await sim(2.2); await sim(4.5);
  }
}
await p.waitForTimeout(60);
await p.screenshot({path:`${OUT}/q-${view}-${scene}.png`});
console.log(scene, view, await st());
await b.close();
