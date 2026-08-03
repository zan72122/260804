// ============================================================================
// LayoutManager — canvasのCSSサイズ/dprリサイズ、orientation判定、safe-area読取。
// ============================================================================
import type { Layout, Orientation, SafeArea } from './types';

const MAX_DPR = 2; // iPad Retinaでのfill-rate対策

function readSafeArea(probe: HTMLDivElement): SafeArea {
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const right = parseFloat(cs.paddingRight) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  const left = parseFloat(cs.paddingLeft) || 0;
  return { top, right, bottom, left };
}

export class LayoutManager {
  layout: Layout;
  private canvas: HTMLCanvasElement;
  private probe: HTMLDivElement;
  private listeners: Set<(l: Layout) => void> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // safe-area-inset-* をDOMから読むためのプローブ要素
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = '0';
    probe.style.height = '0';
    probe.style.pointerEvents = 'none';
    probe.style.visibility = 'hidden';
    probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
    probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
    document.body.appendChild(probe);
    this.probe = probe;

    this.layout = this.measure();
    this.applyCanvasSize(this.layout);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('scroll', this.onResize);
  }

  private measure(): Layout {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const orientation: Orientation = w > h ? 'landscape' : 'portrait';
    const safe = readSafeArea(this.probe);
    return { w, h, dpr, orientation, safe };
  }

  private applyCanvasSize(l: Layout): void {
    const bw = Math.max(1, Math.round(l.w * l.dpr));
    const bh = Math.max(1, Math.round(l.h * l.dpr));
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.canvas.style.width = `${l.w}px`;
    this.canvas.style.height = `${l.h}px`;
  }

  private onResize = (): void => {
    const l = this.measure();
    this.layout = l;
    this.applyCanvasSize(l);
    for (const fn of [...this.listeners]) fn(l);
  };

  onChange(fn: (l: Layout) => void): void {
    this.listeners.add(fn);
  }
}
