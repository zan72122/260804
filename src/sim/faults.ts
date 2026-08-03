// src/sim/faults.ts
// 所有: A5 (flow)
//
// 故障4種(roller/chainGuide/handrail/sensor)の FaultInstance 実装。
// - hotspots/onHotspot: repair フェーズでの修理ジェスチャー
// - render: ワールド座標で 壊れ状態 -> 修理進捗 -> 修理済み を描き分け
// - modelEffect: wobbleAmp を毎フレーム escalator に適用(修理で0へ)
//
// 工具箱(ピンク)や外した部品置き場の描画もここで行う(flow.ts の所有物の一部)。

import type {
  EscalatorModel,
  FaultInstance,
  FaultKind,
  GameState,
  Hotspot,
  HotspotEvent,
  LoopName
} from '../core/types';
import { bus } from '../core/events';
import { COORDS, stepGapT, stepParkedFor } from '../game/coords';
import { input } from '../input/gestures';

export const FAULT_KINDS: FaultKind[] = ['roller', 'chainGuide', 'handrail', 'sensor'];

const ANOMALY_LOOP: Record<FaultKind, LoopName> = {
  roller: 'kotokoto',
  chainGuide: 'kachikachi',
  handrail: 'zuruzuru',
  sensor: 'jiji'
};

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// chainGuide のずれオフセット(アンカーからの相対位置)
const CHAIN_GUIDE_OFFSET = { x: 26, y: -16 };
// handrail: 外れたベルトの始点オフセット、ローラーへ掛け直す終点オフセット
const HANDRAIL_START_OFFSET = { x: -30, y: 34 };
const HANDRAIL_END_OFFSET = { x: 34, y: -6 };

class FaultInstanceImpl implements FaultInstance {
  kind: FaultKind;
  anomalyLoop: LoopName;
  anchorT: number;
  fixed = false;
  progress = 0;

  constructor(kind: FaultKind) {
    this.kind = kind;
    this.anomalyLoop = ANOMALY_LOOP[kind];
    this.anchorT = 0.5;
  }

  private anchorPoint(model: EscalatorModel) {
    return model.pathPoint(this.anchorT);
  }

  hotspots(state: GameState): Hotspot[] {
    if (this.fixed) return [];
    const model = state.escalator;
    const p = this.anchorPoint(model);

    switch (this.kind) {
      case 'roller': {
        if (this.progress < 0.5) {
          return [
            {
              id: 'fault:rollerOld',
              kind: 'drag',
              x: p.x,
              y: p.y,
              r: 75,
              dropX: COORDS.removedRollerBin.x,
              dropY: COORDS.removedRollerBin.y,
              dropR: COORDS.removedRollerBin.r,
              sticky: true
            }
          ];
        }
        return [
          {
            id: 'fault:rollerNew',
            kind: 'drag',
            x: COORDS.toolboxNewRoller.x,
            y: COORDS.toolboxNewRoller.y,
            r: COORDS.toolboxNewRoller.r,
            dropX: p.x,
            dropY: p.y,
            dropR: 90,
            sticky: true
          }
        ];
      }
      case 'chainGuide': {
        const gx = p.x + CHAIN_GUIDE_OFFSET.x;
        const gy = p.y + CHAIN_GUIDE_OFFSET.y;
        return [
          {
            id: 'fault:chainGuide',
            kind: 'drag',
            x: gx,
            y: gy,
            r: 70,
            dropX: p.x,
            dropY: p.y,
            dropR: 85,
            sticky: true
          }
        ];
      }
      case 'handrail': {
        const sx = p.x + HANDRAIL_START_OFFSET.x;
        const sy = p.y + HANDRAIL_START_OFFSET.y;
        const ex = p.x + HANDRAIL_END_OFFSET.x;
        const ey = p.y + HANDRAIL_END_OFFSET.y;
        const path: { x: number; y: number }[] = [];
        const N = 8;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          // 少したるませた曲線経路(太い経路)
          const bow = Math.sin(u * Math.PI) * 22;
          path.push({ x: sx + (ex - sx) * u, y: sy + (ey - sy) * u + bow });
        }
        return [
          {
            id: 'fault:handrail',
            kind: 'trace',
            x: sx,
            y: sy,
            r: 80,
            path
          }
        ];
      }
      case 'sensor': {
        return [
          {
            id: 'fault:sensor',
            kind: 'rub',
            x: p.x,
            y: p.y,
            r: 90
          }
        ];
      }
    }
  }

  onHotspot(ev: HotspotEvent, _state: GameState): void {
    if (this.fixed) return;

    switch (this.kind) {
      case 'roller': {
        // drag成功: input(A3)はdropから150px以内で 'activated' をdrop座標にスナップして発火する。
        // 'released' はドロップ失敗(磁石範囲外)なので何もしない = 誤操作で詰まらない。
        if (ev.id === 'fault:rollerOld' && ev.type === 'activated') {
          this.progress = 0.5;
          bus.emit('sfx', { name: 'pop' });
        } else if (ev.id === 'fault:rollerNew' && ev.type === 'activated') {
          this.progress = 1;
          this.fixed = true;
          bus.emit('sfx', { name: 'snap' });
        }
        break;
      }
      case 'chainGuide': {
        if (ev.id === 'fault:chainGuide' && ev.type === 'activated') {
          this.progress = 1;
          this.fixed = true;
          bus.emit('sfx', { name: 'kachi' });
        }
        break;
      }
      case 'handrail': {
        if (ev.id === 'fault:handrail' && (ev.type === 'progress' || ev.type === 'activated')) {
          const t = ev.t ?? this.progress;
          if (t > this.progress) this.progress = t;
          if (this.progress >= 0.95) {
            this.progress = 1;
            this.fixed = true;
            bus.emit('sfx', { name: 'snap' });
          }
        }
        break;
      }
      case 'sensor': {
        if (ev.id === 'fault:sensor' && (ev.type === 'progress' || ev.type === 'activated')) {
          const t = ev.t ?? this.progress + 0.15;
          if (t > this.progress) this.progress = t;
          bus.emit('sfx', { name: 'wipe' });
          if (this.progress >= 0.95) {
            this.progress = 1;
            this.fixed = true;
          }
        }
        break;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, state: GameState): void {
    this.renderProps(ctx, state);

    if (state.view === 'exterior') return;
    const model = state.escalator;
    const p = this.anchorPoint(model);

    ctx.save();
    ctx.translate(p.x, p.y);
    switch (this.kind) {
      case 'roller':
        this.renderRoller(ctx, state);
        break;
      case 'chainGuide':
        this.renderChainGuide(ctx);
        break;
      case 'handrail':
        this.renderHandrail(ctx);
        break;
      case 'sensor':
        this.renderSensor(ctx, state);
        break;
    }
    ctx.restore();

    // inspect フェーズ: まだタップされる前は目印としてうっすら発光+微振動
    if (state.phase === 'inspect') {
      ctx.save();
      const glow = 0.35 + 0.25 * Math.sin(state.time * 6);
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderRoller(ctx: CanvasRenderingContext2D, state: GameState): void {
    const wobble = this.fixed ? 0 : (1 - Math.min(this.progress, 0.5) * 2) * 5;
    const jitter = wobble > 0 ? Math.sin(state.time * 22) * wobble : 0;
    if (this.progress >= 0.5) {
      // 古ローラーは既に外れている: 台座だけ描く
      ctx.save();
      ctx.strokeStyle = '#9aa3af';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, jitter, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.progress < 1) {
      ctx.save();
      const grad = ctx.createRadialGradient(-4, jitter - 4, 2, 0, jitter, 18);
      grad.addColorStop(0, this.fixed ? '#e8fbff' : '#c7cdd6');
      grad.addColorStop(1, this.fixed ? '#8fd8e8' : '#5c6470');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, jitter, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // 新品ローラー: ピカピカ
      ctx.save();
      const shine = 0.5 + 0.5 * Math.sin(state.time * 4);
      const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 18);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#7fd8ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = shine * 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, -0.6, 0.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderChainGuide(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (!this.fixed) {
      ctx.translate(CHAIN_GUIDE_OFFSET.x * (1 - this.progress), CHAIN_GUIDE_OFFSET.y * (1 - this.progress));
      ctx.rotate((1 - this.progress) * 0.4);
      ctx.fillStyle = '#c98a3f';
    } else {
      ctx.fillStyle = '#8fd88f';
    }
    ctx.fillRect(-18, -6, 36, 12);
    ctx.strokeStyle = '#5a5f68';
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -6, 36, 12);
    ctx.restore();
  }

  private renderHandrail(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = this.fixed ? '#5ec8e8' : '#e07a7a';
    const sx = HANDRAIL_START_OFFSET.x;
    const sy = HANDRAIL_START_OFFSET.y * (this.fixed ? 0.15 : 1);
    const ex = HANDRAIL_END_OFFSET.x * this.progress;
    const ey = HANDRAIL_END_OFFSET.y * this.progress;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 + 20 * (1 - this.progress), ex, ey);
    ctx.stroke();
    ctx.restore();
  }

  private renderSensor(ctx: CanvasRenderingContext2D, state: GameState): void {
    ctx.save();
    ctx.fillStyle = this.fixed ? '#ffe9a8' : '#3a3f47';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    if (this.fixed) {
      const pulse = 0.4 + 0.4 * Math.sin(state.time * 5);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const dustAlpha = Math.max(0, 0.75 - this.progress * 0.8);
      ctx.globalAlpha = dustAlpha;
      ctx.fillStyle = '#9aa0a6';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + state.time * 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- flow 所有の共通プロップ描画(工具箱・柵・スイッチ・鍵・取っ手・ステップ等) ---
  private renderProps(ctx: CanvasRenderingContext2D, state: GameState): void {
    const phase = state.phase;

    // 工具箱(ピンク): roller 修理中 or 誰かが道具を使う場面で表示
    if (phase === 'repair' && this.kind === 'roller' && !this.fixed) {
      ctx.save();
      ctx.translate(COORDS.toolbox.x, COORDS.toolbox.y);
      ctx.fillStyle = '#ff9fc7';
      ctx.strokeStyle = '#e0679f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-34, -20, 68, 40, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd6e8';
      ctx.beginPath();
      ctx.roundRect(-34, -24, 68, 12, 6);
      ctx.fill();
      ctx.restore();
    }

    // ローラー交換の目印: 外す前は捨て場(removedRollerBin)を点線で、外した後は
    // 新品置き場(toolboxNewRoller)にピカピカのローラーを表示(ドラッグの取っ掛かり)。
    if (phase === 'repair' && this.kind === 'roller' && !this.fixed) {
      if (this.progress < 0.5) {
        this.drawDashedTarget(ctx, COORDS.removedRollerBin.x, COORDS.removedRollerBin.y, 30, '#9aa3af');
      } else {
        this.drawRoundIcon(ctx, COORDS.toolboxNewRoller.x, COORDS.toolboxNewRoller.y, 17, '#7fd8ff');
      }
    }

    // 柵: safety フェーズおよびそれ以降(closePlateまでロボが回収する想定)は設置済み位置に表示
    if (state.fencePlaced && (phase === 'safety' || phase === 'openPlate' || phase === 'removeStep' || phase === 'inspect' || phase === 'repair' || phase === 'crankCheck' || phase === 'restoreStep')) {
      ctx.save();
      ctx.translate(COORDS.fenceDrop.x, COORDS.fenceDrop.y);
      ctx.strokeStyle = '#ff8fb3';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(40, 0);
      ctx.moveTo(-40, -30);
      ctx.lineTo(-40, 0);
      ctx.moveTo(40, -30);
      ctx.lineTo(40, 0);
      ctx.stroke();
      ctx.restore();
    } else if (phase === 'safety' && !state.fencePlaced) {
      ctx.save();
      ctx.translate(COORDS.fenceParked.x, COORDS.fenceParked.y);
      ctx.strokeStyle = '#ff8fb3';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-30, 10);
      ctx.lineTo(30, 10);
      ctx.stroke();
      ctx.restore();
    }

    // 停止スイッチ/鍵: safety フェーズで対象になっているものだけ強調
    if (phase === 'safety') {
      if (!state.stopped) {
        this.drawRoundIcon(ctx, COORDS.stopSwitch.x, COORDS.stopSwitch.y, 26, '#e5484d');
      }
      if (state.stopped && !state.locked) {
        this.drawRoundIcon(ctx, COORDS.lockIcon.x, COORDS.lockIcon.y, 22, '#f2b705');
      }
    }

    // 床板の取っ手: openPlate / closePlate で表示
    if (phase === 'openPlate' || phase === 'closePlate') {
      this.drawRoundIcon(ctx, COORDS.plateHandle.x, COORDS.plateHandle.y, 20, '#8ecae6');
    }

    // ステップハンドル: removeStep でまだ未装着なら表示
    if (phase === 'removeStep' && !state.handleAttached) {
      this.drawRoundIcon(ctx, COORDS.stepHandleSpot.x, COORDS.stepHandleSpot.y, 20, '#ffd166');
    }

    // 抜いたステップ: removedStep が設定されている間、画面端に描く
    // (crankCheckで回した分だけ隙間もループ上を移動するため、stepGapT で現在位置を追跡する)
    if (state.escalator.removedStep !== null || state.stepRemoved > 0.02) {
      const easeT = this.easeOvershoot(state.stepRemoved);
      const model = state.escalator;
      const from = model.pathPoint(stepGapT(model));
      const parked = stepParkedFor(model);
      const x = from.x + (parked.x - from.x) * easeT;
      const y = from.y + (parked.y - from.y) * easeT;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#b8c0cc';
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-34, -10, 68, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // クランクホイール: crankCheck(freeObserve含む)で表示
    if (phase === 'crankCheck') {
      ctx.save();
      ctx.translate(COORDS.crankWheel.x, COORDS.crankWheel.y);
      const spin = state.escalator.loopT * Math.PI * 2;
      ctx.rotate(spin);
      ctx.strokeStyle = '#ff9fc7';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd6e8';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 46, Math.sin(a) * 46, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    this.renderDragGhost(ctx);
  }

  // ドラッグ中のオブジェクトが指(ポインタ)に追従して見えるように、input(A3)の
  // dragVisual()(磁石吸着の補間込み座標)を絶対ワールド座標でそのまま描く。
  // これが無いとドラッグ中は何も動いて見えず、4歳児には「掴めているか」分からない。
  private renderDragGhost(ctx: CanvasRenderingContext2D): void {
    const dv = input.dragVisual();
    if (!dv) return;
    ctx.save();
    ctx.translate(dv.x, dv.y);
    ctx.globalAlpha = 0.92;
    switch (dv.id) {
      case 'fence':
        ctx.strokeStyle = '#ff8fb3';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-34, 4);
        ctx.lineTo(34, 4);
        ctx.moveTo(-34, -26);
        ctx.lineTo(-34, 4);
        ctx.moveTo(34, -26);
        ctx.lineTo(34, 4);
        ctx.stroke();
        break;
      case 'fault:rollerOld': {
        const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
        g.addColorStop(0, '#e7ebef');
        g.addColorStop(1, '#8892a0');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#525a66';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'fault:rollerNew': {
        const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#7fd8ff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2f9fc9';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'fault:chainGuide':
        ctx.fillStyle = '#c98a3f';
        ctx.strokeStyle = '#5a5f68';
        ctx.lineWidth = 2;
        ctx.fillRect(-18, -6, 36, 12);
        ctx.strokeRect(-18, -6, 36, 12);
        break;
      case 'stepReturn':
        ctx.fillStyle = '#dfe4ea';
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-34, -10, 68, 20, 6);
        ctx.fill();
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
  }

  private drawDashedTarget(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 7]);
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawRoundIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  private easeOvershoot(x: number): number {
    const c = x < 0 ? 0 : x > 1 ? 1 : x;
    // 軽いオーバーシュート感を出す簡易イージング
    return c * c * (2.7 * c - 1.7);
  }

  modelEffect(model: EscalatorModel): void {
    const target = this.fixed ? 0 : Math.max(0.15, this.progress < 1 ? 1 - this.progress * 0.4 : 0);
    // 徐々に近づける(急変防止)
    model.wobbleAmp += (target - model.wobbleAmp) * 0.15;
    if (this.fixed && model.wobbleAmp < 0.01) model.wobbleAmp = 0;
  }
}

export function createFault(kind: FaultKind, _model: EscalatorModel): FaultInstance {
  return new FaultInstanceImpl(kind);
}
