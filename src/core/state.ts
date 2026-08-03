// src/core/state.ts (A1 scaffold — 凍結)
import type { GamePhase, GameState } from './types';
import { createEscalator } from '../sim/escalator';
import { bus } from './events';

export function createInitialState(): GameState {
  return {
    phase: 'title',
    mode: 'play',
    view: 'exterior',
    location: 0,
    escalator: createEscalator(),
    fault: null,
    settings: {
      volume: 1,
      reducedMotion: false
    },
    fencePlaced: false,
    stopped: false,
    locked: false,
    plateOpen: 0,
    handleAttached: false,
    stepRemoved: 0,
    crankTotal: 0,
    testRunStage: 0,
    idleSeconds: 0,
    time: 0
  };
}

export function setPhase(state: GameState, phase: GamePhase): void {
  if (state.phase === phase) return;
  const from = state.phase;
  state.phase = phase;
  state.idleSeconds = 0;
  bus.emit('phase', { from, to: phase });
}
