import { Game } from './game';
import { Rect } from './layout';
import { Phase } from './states';

/**
 * Test-only observability. Attached to window for Playwright; renders no UI
 * and is never referenced by gameplay code.
 */
export interface RailGameTestApi {
  getPhase(): Phase;
  getPhaseLog(): Phase[];
  getRailRms(): number;
  getRailRmsSpan(a: number, b: number): number;
  getInitialRms(): number;
  getZone(): { start: number; end: number };
  getCarPos(): number;
  getCarSpeed(): number;
  getSparkCount(): number;
  getSeed(): number;
  setSeed(seed: number): void;
  getHotspots(): Record<string, Rect>;
  getSignals(): {
    grindIntensity: number;
    whoosh: number;
    shake: number;
    trainBob: number;
    trainLaunched: boolean;
    audioStarts: number;
    masterGain: number;
    mistLevel: number;
    locked: boolean;
    unitsDocked: boolean[];
    leverProgress: number;
    revealedBefore: boolean;
    afterScanDone: boolean;
    settingsOpen: boolean;
  };
  getSettings(): { softLight: boolean; softMotion: boolean; softSound: boolean };
  getErrors(): string[];
  getViewport(): { w: number; h: number };
}

export function attachTestApi(game: Game, errors: string[]): void {
  const api: RailGameTestApi = {
    getPhase: () => game.phase,
    getPhaseLog: () => [...game.phaseLog],
    getRailRms: () => game.rail.rmsInZone(),
    getRailRmsSpan: (a, b) => game.rail.rmsInSpan(a, b),
    getInitialRms: () => game.rail.initialRms,
    getZone: () => ({ ...game.rail.zone }),
    getCarPos: () => game.carPos,
    getCarSpeed: () => game.carSpeed,
    getSparkCount: () => game.sparkCount(),
    getSeed: () => game.seed,
    setSeed: (seed: number) => {
      game.seed = seed >>> 0 || 1;
    },
    getHotspots: () => {
      const L = game.layout();
      const spots: Record<string, Rect> = { gear: L.gear };
      switch (game.phase) {
        case 'title':
          spots.play = L.play;
          break;
        case 'scanBefore':
        case 'scanAfter':
          spots.scan = L.scan;
          break;
        case 'prepUnits':
          spots.tray0 = L.tray0;
          spots.tray1 = L.tray1;
          spots.socket0 = game.socketRect(0);
          spots.socket1 = game.socketRect(1);
          break;
        case 'lower':
          spots.lever = L.lever;
          break;
        case 'grind':
          spots.lever = L.lever;
          spots.mist = L.mist;
          break;
        case 'testRun':
          spots.train = game.trainRect();
          break;
        case 'replay':
          spots.replaySame = L.replaySame;
          spots.replayNew = L.replayNew;
          break;
        case 'arrive':
          break;
      }
      if (game.settingsOpen) {
        spots.toggleLight = L.toggleLight;
        spots.toggleMotion = L.toggleMotion;
        spots.toggleSound = L.toggleSound;
        spots.closeSettings = L.closeSettings;
      }
      return spots;
    },
    getSignals: () => ({
      grindIntensity: game.audio.grindIntensity,
      whoosh: game.audio.whooshLevel,
      shake: game.shake,
      trainBob: game.train.bob,
      trainLaunched: game.train.launched,
      audioStarts: game.audio.startCount,
      masterGain: game.audio.masterGain,
      mistLevel: game.mistLevel,
      locked: game.locked,
      unitsDocked: [...game.unitsDocked],
      leverProgress: game.leverProgress,
      revealedBefore: game.revealedBefore,
      afterScanDone: game.afterScanDone,
      settingsOpen: game.settingsOpen,
    }),
    getSettings: () => ({ ...game.settings }),
    getErrors: () => [...errors],
    getViewport: () => ({ w: game.viewW, h: game.viewH }),
  };
  (window as unknown as { __railGameTest: RailGameTestApi }).__railGameTest = api;
}
