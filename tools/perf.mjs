/* Draw-call and triangle budget check, since the target is a phone GPU. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
for (const q of ['', '?quality=low']) {
  const p = await b.newPage({ viewport:{width:393,height:852}, deviceScaleFactor:2 });
  await p.goto('http://127.0.0.1:4173/' + q, { waitUntil:'load' });
  await p.waitForTimeout(4000);
  const i = await p.evaluate(() => window.__takajo._force.info());
  console.log((q || '?quality=high').padEnd(16), JSON.stringify(i.render));
  await p.close();
}
await b.close();
