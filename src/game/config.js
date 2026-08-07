// Physical layout of the play space, in metres. Everything else derives from
// these numbers, so the counter, the grid, the drag height and the camera all
// agree on one world.

export const BOARD = {
  cols: 7,
  rows: 5,
  cell: 0.113,          // 11.3 cm — a tomato sits comfortably inside one
  centerX: 0,
  centerZ: -0.03,
  surfaceY: 0.928,      // top face of the prep tray
};

export const COUNTER = {
  width: 1.62,
  depth: 0.96,
  topY: 0.92,           // standing-height market counter
  slab: 0.055,
  centerZ: -0.02,
};

/** World position of the centre of a grid cell. */
export function cellPos(col, row, out = { x: 0, y: 0, z: 0 }) {
  const w = BOARD.cols * BOARD.cell, d = BOARD.rows * BOARD.cell;
  out.x = BOARD.centerX - w / 2 + (col + 0.5) * BOARD.cell;
  out.y = BOARD.surfaceY;
  out.z = BOARD.centerZ - d / 2 + (row + 0.5) * BOARD.cell;
  return out;
}

/** Nearest grid cell to a world point, or null if outside the tray. */
export function posToCell(x, z, pad = 0.5) {
  const w = BOARD.cols * BOARD.cell, d = BOARD.rows * BOARD.cell;
  const col = Math.floor((x - (BOARD.centerX - w / 2)) / BOARD.cell);
  const row = Math.floor((z - (BOARD.centerZ - d / 2)) / BOARD.cell);
  if (col < -pad || row < -pad || col > BOARD.cols - 1 + pad || row > BOARD.rows - 1 + pad) return null;
  const c = Math.max(0, Math.min(BOARD.cols - 1, col));
  const r = Math.max(0, Math.min(BOARD.rows - 1, row));
  return { col: c, row: r };
}

/** Cells the producers permanently occupy (corners of the tray). */
export const PRODUCER_CELLS = [
  { col: 0, row: 0 },
  { col: BOARD.cols - 1, row: 0 },
  { col: 0, row: BOARD.rows - 1 },
  { col: BOARD.cols - 1, row: BOARD.rows - 1 },
];

/** Where the three customers stand, on the far side of the counter. */
// Spread wide and set back, so the gaps between them stay open onto the
// terrace and the town below — occlusion is a depth cue, a wall is not.
export const CUSTOMER_SLOTS = [
  { x: -0.88, z: -1.2, ry: 0.3 },
  { x: 0.04, z: -1.46, ry: 0.0 },
  { x: 0.94, z: -1.2, ry: -0.3 },
];

export const DRAG_LIFT = 0.075;   // how high a picked item floats above the tray
