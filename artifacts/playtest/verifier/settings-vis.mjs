// Settings toggle on/off readability + gear-tap-again behavior.
import { launch, shot, hotspots, center, tap, signals } from './helpers.mjs';

const { browser, page, errors } = await launch({ width: 390, height: 844 });
try {
  let hs = await hotspots(page);
  await tap(page, center(hs.gear).x, center(hs.gear).y);
  await page.waitForTimeout(300);
  await shot(page, 'settings-all-off');
  hs = await hotspots(page);
  await tap(page, center(hs.toggleLight).x, center(hs.toggleLight).y);
  await page.waitForTimeout(300);
  await shot(page, 'settings-light-on');
  // does tapping the gear again close the overlay?
  await tap(page, center(hs.gear).x, center(hs.gear).y);
  await page.waitForTimeout(200);
  console.log('after 2nd gear tap, settingsOpen:', (await signals(page)).settingsOpen);
  console.log('settings:', JSON.stringify(await page.evaluate(() => window.__railGameTest.getSettings())));
  // reset light toggle and close
  hs = await hotspots(page);
  if ((await signals(page)).settingsOpen) {
    await tap(page, center(hs.toggleLight).x, center(hs.toggleLight).y);
    await tap(page, center(hs.closeSettings).x, center(hs.closeSettings).y);
  }
  console.log('final settingsOpen:', (await signals(page)).settingsOpen);
} finally {
  console.log('page errors:', JSON.stringify(errors));
  await browser.close();
}
