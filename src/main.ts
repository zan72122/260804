/**
 * Boot, render loop and platform plumbing.
 *
 * The things that actually matter on an iPhone live here: a capped pixel
 * ratio, a frame-time watchdog that quietly drops the quality tier instead
 * of stuttering, correct behaviour when Safari suspends and restores the
 * tab, and orientation changes that never disturb the game state.
 */

import './style.css';
import * as THREE from 'three';
import { InputManager } from './core/input';
import { UI } from './ui/ui';
import { Game } from './game/game';
import {
  currentTier,
  degradeTier,
  quality,
  settings,
} from './core/settings';
import {
  ambienceLoop,
  gateLoop,
  initAudio,
  pumpLoop,
  reelLoop,
  resumeAudio,
  setVolume,
  stopSpeech,
  suspendAudio,
} from './core/audio';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: currentTier() !== 'low',
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = quality().shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const input = new InputManager(canvas);

let game: Game;

const ui = new UI(
  uiRoot,
  {
    onPumpDown: () => {
      initAudio();
      game.setPumping(true);
    },
    onPumpUp: () => game.setPumping(false),
    onReplaySame: () => game.restart(true),
    onReplayNew: () => game.restart(false),
    onSandbox: () => game.restart(true, true),
    onSettingsChanged: () => applySettings(),
  },
  5,
);

game = new Game(input, ui, (Math.random() * 0xffffff) | 0);

/* ------------------------------------------------------------------ *
 * sizing
 * ------------------------------------------------------------------ */

let vw = 1;
let vh = 1;

function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, quality().maxPixelRatio);
}

function resize(): void {
  // visualViewport is the honest size on iOS once the URL bar collapses
  const vv = window.visualViewport;
  vw = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  vh = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(vw, vh, false);
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  game.director.resize(vw, vh);
  ui.layout();
}

window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  // iOS reports the old size during the event; settle afterwards
  window.setTimeout(resize, 60);
  window.setTimeout(resize, 340);
});

function applySettings(): void {
  setVolume(settings.volume);
  if (settings.volume <= 0.01) stopSpeech();
  const q = quality();
  renderer.shadowMap.enabled = q.shadows;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(vw, vh, false);
  if (q.berries !== game.world.berries.n) game.rebuildForQuality();
}

/* ------------------------------------------------------------------ *
 * audio unlock — Safari needs a real gesture
 * ------------------------------------------------------------------ */

const unlock = (): void => {
  initAudio();
  setVolume(settings.volume);
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('touchend', unlock);
};
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('touchend', unlock, { passive: true });

/* ------------------------------------------------------------------ *
 * suspend / resume
 * ------------------------------------------------------------------ */

let hidden = false;
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  if (hidden) {
    gateLoop.stop();
    reelLoop.stop();
    pumpLoop.stop();
    ambienceLoop.stop();
    stopSpeech();
    suspendAudio();
  } else {
    resumeAudio();
    // a backgrounded tab produces one enormous dt on return; drop it
    last = performance.now();
    input.reset();
    resize();
  }
});
window.addEventListener('pagehide', () => {
  stopSpeech();
  suspendAudio();
});

/* ------------------------------------------------------------------ *
 * loop with a frame-time watchdog
 * ------------------------------------------------------------------ */

let last = performance.now();
let slowFrames = 0;
let fastFrames = 0;
let booted = false;
let bootFrames = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (hidden) {
    last = now;
    return;
  }
  // clamp: a long stall must never teleport the simulation
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;

  input.beginFrame(dt);
  game.update(dt, vw, vh);
  renderer.render(game.scene, game.director.camera);

  if (!booted) {
    bootFrames++;
    ui.bootProgress(Math.min(1, bootFrames / 4));
    if (bootFrames > 4) {
      booted = true;
      ui.hideBoot();
    }
    return;
  }

  // Watchdog: sustained slow frames step the tier down once, quietly.
  if (dt > 1 / 26) {
    slowFrames++;
    fastFrames = 0;
  } else {
    fastFrames++;
    if (fastFrames > 120) slowFrames = 0;
  }
  if (slowFrames > 90) {
    slowFrames = 0;
    if (degradeTier()) {
      const q = quality();
      renderer.shadowMap.enabled = q.shadows;
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(vw, vh, false);
    }
  }
}

resize();
requestAnimationFrame(frame);

/* Expose a tiny handle for automated play-through tests. */
declare global {
  interface Window {
    __game?: {
      step(): number;
      stepTime(): number;
      suction(): number;
      reel(): { x: number; z: number; heading: number; view: number; speed: number };
      water(): number;
      floating(): number;
      bed(): number;
      harvested(): number;
      setStep(n: number): void;
      restart(same: boolean, sandbox?: boolean): void;
      tier(): string;
      drawCalls(): number;
      perf(): { berryMs: number; tris: number; calls: number; berries: number };
    };
  }
}

window.__game = {
  step: () => game.currentStep as number,
  stepTime: () => game.elapsedInStep,
  suction: () => game.suctionProgress,
  reel: () => ({
    x: game.world.reel.pos.x,
    z: game.world.reel.pos.y,
    heading: game.world.reel.heading,
    view: game.world.reel.viewHeading,
    speed: game.world.reel.speed,
  }),
  water: () => game.world.water.level,
  floating: () => game.world.berries.floatingCount,
  bed: () => game.world.berries.bedCount,
  harvested: () => game.world.berries.harvested,
  setStep: (n: number) => game.debugJump(n),
  restart: (same: boolean, sandbox = false) => game.restart(same, sandbox),
  tier: () => currentTier(),
  drawCalls: () => renderer.info.render.calls,
  perf: () => ({
    berryMs: game.berryMs,
    tris: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    berries: game.world.berries.n,
  }),
};
