// ============================================================================
// render-machine 共通ユーティリティ（数学・パス補助・グラデーションキャッシュ）
// ============================================================================

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0..1 のなめらかな山（0で0, 0.5で1, 1で0） */
export function hump(t: number): number {
  return Math.sin(clamp(t, 0, 1) * Math.PI);
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── グラデーションキャッシュ（CanvasGradientはcontext非依存で再利用可） ──
const gradCache = new Map<string, CanvasGradient>();

export function cachedLinear(
  ctx: CanvasRenderingContext2D, key: string,
  x0: number, y0: number, x1: number, y1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const hit = gradCache.get(key);
  if (hit) return hit;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  gradCache.set(key, g);
  return g;
}

export function cachedRadial(
  ctx: CanvasRenderingContext2D, key: string,
  x0: number, y0: number, r0: number, x1: number, y1: number, r1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const hit = gradCache.get(key);
  if (hit) return hit;
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  gradCache.set(key, g);
  return g;
}

/** decoration変更時など、動的グラデーション(虹)を作り直したい時にキーを捨てる */
export function invalidateGradient(key: string): void {
  gradCache.delete(key);
}

/** 折れ線の全長に沿って一定間隔で {x,y,angle} をサンプルするジェネレータ */
export function samplePath(
  path: ReadonlyArray<readonly [number, number]>, steps: number,
): Array<{ x: number; y: number; angle: number; t: number }> {
  const out: Array<{ x: number; y: number; angle: number; t: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({ ...pointOnPathLocal(path, t), t });
  }
  return out;
}

// pointOnPath相当をローカルに複製すると重複するのでgeometryのものを使う想定だが、
// belt変形などで座標をずらした一時パスに対しても使えるよう軽量版をここに置く。
function pointOnPathLocal(
  path: ReadonlyArray<readonly [number, number]>, t: number,
): { x: number; y: number; angle: number } {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  let target = clamp(t, 0, 1) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (target <= seg || i === path.length - 1) {
      const k = seg === 0 ? 0 : target / seg;
      return {
        x: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k,
        y: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k,
        angle: Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]),
      };
    }
    target -= seg;
  }
  const last = path[path.length - 1];
  return { x: last[0], y: last[1], angle: 0 };
}

export function perp(angle: number): { x: number; y: number } {
  return { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
}
