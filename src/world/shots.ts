/**
 * The ten-shot camera chain, authored twice: once for a tall phone held
 * upright, once for a wide tablet. The player never moves the camera.
 *
 * Portrait keeps the action column vertical (control low, change high, so a
 * finger never covers the ribbon). Landscape spreads the same beats sideways
 * so the room never looks stretched.
 */
import type { Shot, ShotName } from '../core/rig';
import { STATION } from './lab';

const M = STATION.microtome.x;
const B = STATION.bath.x;
const S = STATION.stain.x;
const C = STATION.scope.x;

export const PORTRAIT: Record<ShotName, Shot> = {
  establish: { pos: [M + 2.15, 2.75, 5.05], target: [M + 1.25, 0.70, -0.10], fov: 58, drift: 1.4 },
  posture: { pos: [M + 0.30, 1.10, 2.85], target: [M - 0.06, 0.60, 0.18], fov: 48, drift: 1.0 },
  action: { pos: [M + 0.42, 1.26, 3.10], target: [M + 0.06, 0.92, 0.05], fov: 46, drift: 0.5 },
  ribbonMacro: { pos: [M + 0.22, 1.46, 1.34], target: [M - 0.11, 1.27, 0.05], fov: 42, drift: 0.7 },
  ribbonPick: { pos: [M + 0.50, 1.70, 3.50], target: [M - 0.10, 1.20, 0.05], fov: 50, drift: 0.5 },
  bath: { pos: [B, 2.20, 1.58], target: [B, 0.34, -0.02], fov: 54, drift: 0.35 },
  pickup: { pos: [B, 1.72, 1.92], target: [B, 0.26, -0.04], fov: 52, drift: 0.4 },
  dewax: { pos: [S - 0.06, 1.86, 1.82], target: [S - 0.10, 0.42, -0.06], fov: 50, drift: 0.5 },
  stain: { pos: [S, 1.98, 1.95], target: [S, 0.42, -0.02], fov: 50, drift: 0.4 },
  mount: { pos: [S, 1.05, 2.05], target: [S - 0.02, 0.10, 0.82], fov: 50, drift: 0.4 },
  scope: { pos: [C + 0.92, 1.62, 2.42], target: [C + 0.08, 0.86, 0.0], fov: 46, drift: 0.5 },
  optical: { pos: [C + 0.62, 1.30, 2.35], target: [C + 0.30, 1.10, 0.10], fov: 48, drift: 0.25 },
};

export const LANDSCAPE: Record<ShotName, Shot> = {
  establish: { pos: [M + 2.55, 2.05, 4.10], target: [M + 2.05, 0.62, -0.20], fov: 50, drift: 1.4 },
  posture: { pos: [M + 0.28, 0.96, 2.10], target: [M - 0.06, 0.54, 0.18], fov: 48, drift: 1.0 },
  action: { pos: [M + 0.35, 1.00, 1.85], target: [M - 0.05, 0.62, 0.05], fov: 46, drift: 0.5 },
  ribbonMacro: { pos: [M - 0.18, 1.28, 1.26], target: [M - 0.48, 1.04, 0.05], fov: 42, drift: 0.7 },
  ribbonPick: { pos: [M - 0.01, 1.31, 2.15], target: [M - 0.52, 0.87, 0.05], fov: 46, drift: 0.5 },
  bath: { pos: [B, 1.62, 1.32], target: [B, 0.34, -0.02], fov: 48, drift: 0.35 },
  pickup: { pos: [B, 1.32, 1.58], target: [B, 0.26, -0.04], fov: 46, drift: 0.4 },
  dewax: { pos: [S - 0.06, 1.46, 1.50], target: [S - 0.10, 0.40, -0.06], fov: 50, drift: 0.5 },
  stain: { pos: [S, 1.52, 1.55], target: [S, 0.40, -0.02], fov: 48, drift: 0.4 },
  mount: { pos: [S, 0.88, 1.80], target: [S - 0.02, 0.08, 0.82], fov: 48, drift: 0.4 },
  scope: { pos: [C + 1.16, 1.42, 2.16], target: [C + 0.06, 0.82, 0.0], fov: 46, drift: 0.5 },
  optical: { pos: [C + 0.98, 0.98, 1.98], target: [C + 0.10, 0.82, 0.10], fov: 46, drift: 0.25 },
};

export const shotsFor = (portrait: boolean) => (portrait ? PORTRAIT : LANDSCAPE);
