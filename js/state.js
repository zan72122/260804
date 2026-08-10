// OWNER: orchestrator — FROZEN. Shared state shape. See CONTRACT.md for field ownership.
export function createState() {
  return {
    phase: 'play', // 'play' | 'lift' | 'celebrate'
    time: 0, w: 0, h: 0, dpr: 1,
    pointer: { x: 0, y: 0, down: false, vx: 0, vy: 0, speed: 0 },
    tool: { x: 0, y: 0, angle: 0, caramel: 0, dipping: false },
    layout: null,
    camera: { x: 0, y: 0, zoom: 1 },
    nest: { fullness: 0, ready: false, lift: 0, x: 0, y: 0 },
  };
}
