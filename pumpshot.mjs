import { chromium } from '@playwright/test';
const size = process.argv[2] === 'p' ? {width:390,height:844} : {width:844,height:390};
const tag = process.argv[2] || 'l';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('[err]', String(e).slice(0,300)));
await p.setViewportSize(size);
await p.goto('http://127.0.0.1:4173/?tier=mid');
await p.waitForFunction(()=>!!window.__game);
await p.waitForTimeout(2500);
await p.evaluate(()=>window.__game.setStep(6));
await p.waitForTimeout(1500);
const btn = await p.locator('button[aria-label="すいこむ"]').boundingBox();
await p.mouse.move(btn.x+btn.width/2, btn.y+btn.height/2);
await p.mouse.down();
for (const [name, target] of [['w1',0.15],['w2',0.45],['w3',0.78],['w4',0.97]]) {
  await p.waitForFunction(t=>window.__game.suction()>t, target, {timeout:600000, polling:400}).catch(()=>{});
  await p.waitForTimeout(600);
  await p.screenshot({path:`test-results/pump/${tag}-${name}.png`});
  console.log(name, await p.evaluate(()=>({s:window.__game.suction(), bed:window.__game.bed(), fl:window.__game.floating()})));
}
await p.mouse.up();
await p.waitForFunction(()=>window.__game.step()===7, null, {timeout:300000, polling:500}).catch(()=>{});
await p.waitForTimeout(4000);
await p.screenshot({path:`test-results/pump/${tag}-done.png`});
await b.close();
