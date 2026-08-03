import { test, expect } from '@playwright/test';
import { setup, playTo, tapHot, signals, expectNoErrors, avgLuminance, waitPhase } from './helpers';

/**
 * A13: the softer light / motion / sound settings actually change behaviour
 * and survive a reload (localStorage).
 */

test('accessibility toggles work and persist', async ({ page }, testInfo) => {
  const ctx = await setup(page, testInfo, 'settings');

  // audio starts once, on the very first gesture
  await tapHot(page, 'play');
  await waitPhase(page, 'scanBefore', 25000);
  expect((await signals(page)).audioStarts).toBe(1);
  const loudGain = (await signals(page)).masterGain;
  expect(loudGain).toBeGreaterThan(0.5);

  // reveal the wave, park in prepUnits (static glowing scene)
  await playTo(page, 'prepUnits');
  await page.waitForTimeout(400);
  const brightLum = await avgLuminance(page);
  await ctx.shot('full-light');

  // open settings, soften everything
  await tapHot(page, 'gear');
  await ctx.shot('settings-open');
  await tapHot(page, 'toggleLight');
  await tapHot(page, 'toggleMotion');
  await tapHot(page, 'toggleSound');
  const s = await page.evaluate(() => (window as any).__railGameTest.getSettings());
  expect(s).toEqual({ softLight: true, softMotion: true, softSound: true });
  await tapHot(page, 'closeSettings');
  expect((await signals(page)).settingsOpen).toBe(false);

  // soft sound: master gain eased down
  await page.waitForTimeout(1200);
  const softGain = (await signals(page)).masterGain;
  expect(softGain).toBeLessThan(0.4);

  // soft light: the same static scene renders dimmer
  await page.waitForTimeout(300);
  const dimLum = await avgLuminance(page);
  await ctx.shot('soft-light');
  expect(dimLum).toBeLessThan(brightLum - 0.001);

  // persists across reload
  await page.reload();
  await page.waitForFunction(() => (window as any).__railGameTest?.getPhase() === 'title');
  const persisted = await page.evaluate(() => (window as any).__railGameTest.getSettings());
  expect(persisted).toEqual({ softLight: true, softMotion: true, softSound: true });
  const stored = await page.evaluate(() => localStorage.getItem('railgrinder.v1.settings'));
  expect(JSON.parse(stored!)).toEqual({ softLight: true, softMotion: true, softSound: true });

  // toggle back off and confirm the round-trip
  await tapHot(page, 'gear');
  await tapHot(page, 'toggleLight');
  await tapHot(page, 'toggleMotion');
  await tapHot(page, 'toggleSound');
  await tapHot(page, 'closeSettings');
  const restored = await page.evaluate(() => (window as any).__railGameTest.getSettings());
  expect(restored).toEqual({ softLight: false, softMotion: false, softSound: false });

  expectNoErrors(ctx.errors);
});
