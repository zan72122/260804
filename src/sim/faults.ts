// src/sim/faults.ts
// 所有: A5 (flow)
//
// 故障4種(roller/chainGuide/handrail/sensor)の FaultInstance 実装。
// - hotspots/onHotspot: repair フェーズでの修理ジェスチャー
// - render: ワールド座標で 壊れ状態 -> 修理進捗 -> 修理済み を描き分け
// - modelEffect: wobbleAmp を毎フレーム escalator に適用(修理で0へ)
//
// 工具箱(ピンク)や外した部品置き場、柵、notice の💥マークなど「小道具」の
// 描画もここで行う(flow.ts の所有物の一部。P2改修: 上質玩具ルック+誇張演出)。

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

// ---------------------------------------------------------------------------
// 共通の小さな描画ヘルパ(上質玩具ルック: 太い輪郭・角丸・グラデ+ハイライト)
// ---------------------------------------------------------------------------
function pulse01(time: number, freq: number): number {
  return 0.5 + 0.5 * Math.sin(time * freq);
}

// ドロップ先ガイド(磁石感の予告): 対象と同形の半透明シルエット+やわらかい脈動リング
type GuideShape = 'roller' | 'chainGuide' | 'step' | 'fence';

function drawPulseRing(ctx: CanvasRenderingContext2D, baseR: number, p: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.22 * p;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 + 3 * p;
  ctx.beginPath();
  ctx.arc(0, 0, baseR + p * 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDropGuide(ctx: CanvasRenderingContext2D, shape: GuideShape, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  const p = pulse01(time, 3.1);
  switch (shape) {
    case 'roller': {
      ctx.globalAlpha = 0.3;
      const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 30);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#8fd8ff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      drawPulseRing(ctx, 36, p, '#ffd166');
      break;
    }
    case 'chainGuide': {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#c98a3f';
      ctx.beginPath();
      ctx.roundRect(-26, -10, 52, 20, 6);
      ctx.fill();
      drawPulseRing(ctx, 38, p, '#ffd166');
      break;
    }
    case 'step': {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#b8c0cc';
      ctx.beginPath();
      ctx.roundRect(-34, -10, 68, 20, 6);
      ctx.fill();
      drawPulseRing(ctx, 48, p, '#ffd166');
      break;
    }
    case 'fence': {
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#ff8fb3';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-32, 6);
      ctx.lineTo(32, 6);
      ctx.stroke();
      drawPulseRing(ctx, 44, p, '#ffd166');
      break;
    }
  }
  ctx.restore();
}

// ずれ矢印ゴースト: from -> to の向きへふわっと明滅する矢印(修理方向のヒント)
function drawArrowGhost(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  time: number,
  color: string
): void {
  const a = Math.atan2(toY - fromY, toX - fromX);
  const len = dist(fromX, fromY, toX, toY);
  if (len < 4) return;
  const p = pulse01(time, 2.4);
  ctx.save();
  ctx.translate(fromX, fromY);
  ctx.rotate(a);
  ctx.globalAlpha = 0.35 + 0.3 * p;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const headX = len * (0.55 + 0.15 * p);
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(headX, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headX + 14, 0);
  ctx.lineTo(headX - 6, -9);
  ctx.lineTo(headX - 6, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 小さな衝撃線(火花なし): 壊れ物の脇にシュッシュッと出す誇張表現
function drawImpactLines(ctx: CanvasRenderingContext2D, r: number, intensity: number, time: number): void {
  if (intensity <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = 0.55 * intensity;
  ctx.strokeStyle = '#8d95a3';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = -0.9 + i * 0.9 + Math.sin(time * 14 + i) * 0.08;
    const x1 = Math.cos(a) * (r + 4);
    const y1 = Math.sin(a) * (r + 4);
    const x2 = Math.cos(a) * (r + 14);
    const y2 = Math.sin(a) * (r + 14);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

// もこもこ雲(センサーのほこり)
function drawDustCloud(ctx: CanvasRenderingContext2D, alpha: number, time: number): void {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const puffs = [
    { x: -12, y: -4, r: 12 },
    { x: 6, y: -10, r: 14 },
    { x: 16, y: 2, r: 11 },
    { x: -4, y: 8, r: 13 },
    { x: -18, y: 8, r: 9 },
    { x: 10, y: 12, r: 9 }
  ];
  ctx.fillStyle = '#aab0ba';
  for (let i = 0; i < puffs.length; i++) {
    const puff = puffs[i];
    const bob = Math.sin(time * 1.6 + i * 1.3) * 2.5;
    const g = ctx.createRadialGradient(puff.x - 3, puff.y - 3 + bob, 1, puff.x, puff.y + bob, puff.r);
    g.addColorStop(0, '#c9cdd4');
    g.addColorStop(1, '#8b929e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y + bob, puff.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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
        this.renderChainGuide(ctx, state);
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

    // repair 中: ドロップ先(磁石予告)ガイドをこのフェーズのホットスポットから描く
    if (state.phase === 'repair' && !this.fixed) {
      this.renderRepairGuides(ctx, state);
    }
  }

  // repair フェーズの「ドロップ先ガイド」(半透明シルエット+脈動リング)と
  // ずれ矢印ゴースト(修理の向きを予告)。実際のホットスポット座標(hotspots())から
  // そのまま導出するので、座標のズレは絶対に起きない。
  private renderRepairGuides(ctx: CanvasRenderingContext2D, state: GameState): void {
    const time = state.time;
    for (const h of this.hotspots(state)) {
      if (h.kind === 'drag' && h.dropX !== undefined && h.dropY !== undefined) {
        const shape: GuideShape = this.kind === 'roller' ? 'roller' : 'chainGuide';
        drawDropGuide(ctx, shape, h.dropX, h.dropY, time);
        if (this.kind === 'chainGuide') {
          drawArrowGhost(ctx, h.x, h.y, h.dropX, h.dropY, time, '#ffb347');
        } else if (this.kind === 'roller' && this.progress < 0.5) {
          // 古ローラー→リサイクル箱への案内矢印
          drawArrowGhost(ctx, h.x, h.y, h.dropX, h.dropY, time, '#9aa3af');
        }
      }
    }
  }

  private renderRoller(ctx: CanvasRenderingContext2D, state: GameState): void {
    const R = 30; // 大型化(旧:18)
    const wobble = this.fixed ? 0 : (1 - Math.min(this.progress, 0.5) * 2) * 9;
    const jitter = wobble > 0 ? Math.sin(state.time * 22) * wobble : 0;
    if (wobble > 0) {
      drawImpactLines(ctx, R, wobble / 9, state.time);
    }
    if (this.progress >= 0.5) {
      // 古ローラーは既に外れている: 台座(ソケット)だけ大きく描く
      ctx.save();
      ctx.strokeStyle = '#9aa3af';
      ctx.lineWidth = 5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, jitter, R - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(154,163,175,0.25)';
      ctx.beginPath();
      ctx.arc(0, jitter, R - 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.progress < 1) {
      ctx.save();
      const grad = ctx.createRadialGradient(-6, jitter - 6, 3, 0, jitter, R);
      grad.addColorStop(0, this.fixed ? '#e8fbff' : '#d7dce3');
      grad.addColorStop(1, this.fixed ? '#8fd8e8' : '#5c6470');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#454b55';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, jitter, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // ゴムのリブ模様
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#2f333b';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (R - 10), jitter + Math.sin(a) * (R - 10));
        ctx.lineTo(Math.cos(a) * R, jitter + Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // 新品ローラー: 大きくピカピカ(ハイライト+キラ)
      ctx.save();
      const shine = 0.5 + 0.5 * Math.sin(state.time * 4);
      const grad = ctx.createRadialGradient(-8, -8, 3, 0, 0, R + 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, '#bdeeff');
      grad.addColorStop(1, '#5cc7ec');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#2f9fc9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 大きな弧ハイライト
      ctx.globalAlpha = shine * 0.7;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-3, -3, R - 6, -1.0, -0.1);
      ctx.stroke();
      ctx.restore();
      // キラキラ(小さな星の点滅)
      this.drawSparkles(ctx, state.time, R + 14);
    }
  }

  private drawSparkles(ctx: CanvasRenderingContext2D, time: number, radius: number): void {
    const sparkleCount = 3;
    for (let i = 0; i < sparkleCount; i++) {
      const phase = time * 2.2 + i * 2.1;
      const tw = (Math.sin(phase) + 1) / 2;
      if (tw < 0.55) continue;
      const a = i * 2.4 + time * 0.6;
      const sx = Math.cos(a) * radius;
      const sy = Math.sin(a) * radius * 0.7 - 6;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = (tw - 0.55) / 0.45;
      ctx.fillStyle = '#fffde7';
      const s = 5 + tw * 3;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.28, -s * 0.28);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.28, s * 0.28);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.28, s * 0.28);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.28, -s * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderChainGuide(ctx: CanvasRenderingContext2D, state: GameState): void {
    ctx.save();
    const tiltAmt = this.fixed ? 0 : 1 - this.progress;
    if (!this.fixed && tiltAmt > 0.01) {
      drawImpactLines(ctx, 30, tiltAmt, state.time);
    }
    if (!this.fixed) {
      // 大きく傾く(誇張): 旧オフセット x0.55 -> より大胆に
      ctx.translate(CHAIN_GUIDE_OFFSET.x * tiltAmt * 1.15, CHAIN_GUIDE_OFFSET.y * tiltAmt * 1.15);
      ctx.rotate(tiltAmt * 0.62);
      ctx.fillStyle = '#dba05a';
    } else {
      ctx.fillStyle = '#8fd88f';
    }
    // 本体(大型化: 36x12 -> 56x22)+ リベット
    ctx.strokeStyle = '#4c525c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, -11, 56, 22, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (const dx of [-18, 0, 18]) {
      ctx.beginPath();
      ctx.arc(dx, -11 + 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderHandrail(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    // だらんと垂れる曲線を太く(旧12 -> 20)
    ctx.lineWidth = 20;
    ctx.strokeStyle = this.fixed ? '#5ec8e8' : '#e07a7a';
    const sx = HANDRAIL_START_OFFSET.x;
    const sy = HANDRAIL_START_OFFSET.y * (this.fixed ? 0.15 : 1);
    const ex = HANDRAIL_END_OFFSET.x * this.progress;
    const ey = HANDRAIL_END_OFFSET.y * this.progress;
    const sag = this.fixed ? 6 : 34 * (1 - this.progress); // 未修理ほど大きくだらん
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 + sag, ex, ey);
    ctx.stroke();
    // 内側にハイライト筋(太くしたベルトの質感)
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 3);
    ctx.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 + sag - 3, ex, ey - 3);
    ctx.stroke();
    ctx.restore();
  }

  private renderSensor(ctx: CanvasRenderingContext2D, state: GameState): void {
    const R = 22; // 大型化(旧14)
    ctx.save();
    ctx.fillStyle = this.fixed ? '#ffe9a8' : '#3a3f47';
    ctx.strokeStyle = this.fixed ? '#e8b23a' : '#20242b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (this.fixed) {
      const pulse = 0.4 + 0.4 * Math.sin(state.time * 5);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(0, 0, R + 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const dustAlpha = Math.max(0, 0.9 - this.progress * 0.95);
      drawDustCloud(ctx, dustAlpha, state.time);
    }
    ctx.restore();
  }

  // --- flow 所有の共通プロップ描画(工具箱・柵・スイッチ・鍵・取っ手・ステップ等) ---
  private renderProps(ctx: CanvasRenderingContext2D, state: GameState): void {
    const phase = state.phase;

    // notice フェーズ: 異常箇所の目印として大きく脈動する💥マーク(ワールド描画)
    if (phase === 'notice') {
      this.renderNoticeAlert(ctx, state);
    }

    // 工具箱(かわいいピンクの工具箱): roller 修理中に表示。ふた・留め金・ハンドル・
    // 星のワッペン付き。ふたが開いて新品部品がちらっと見える。
    if (phase === 'repair' && this.kind === 'roller' && !this.fixed) {
      this.drawToolbox(ctx, state.time);
    }

    // ローラー交換の目印: 外す前は捨て場(removedRollerBin)を大きなリサイクル箱で、
    // 外した後は新品置き場(toolboxNewRoller)にピカピカのローラーを表示
    // (ドラッグの取っ掛かり + ドロップ先ガイド)。
    if (phase === 'repair' && this.kind === 'roller' && !this.fixed) {
      if (this.progress < 0.5) {
        this.drawRecycleBin(ctx, COORDS.removedRollerBin.x, COORDS.removedRollerBin.y, state.time);
      } else {
        this.drawNewRollerSpot(ctx, COORDS.toolboxNewRoller.x, COORDS.toolboxNewRoller.y, state.time);
      }
    }

    // 柵: safety フェーズおよびそれ以降(closePlateまでロボが回収する想定)は設置済み位置に表示
    if (state.fencePlaced && (phase === 'safety' || phase === 'openPlate' || phase === 'removeStep' || phase === 'inspect' || phase === 'repair' || phase === 'crankCheck' || phase === 'restoreStep')) {
      this.drawFenceInstalled(ctx, COORDS.fenceDrop.x, COORDS.fenceDrop.y);
    } else if (phase === 'safety' && !state.fencePlaced) {
      this.drawFenceParked(ctx, COORDS.fenceParked.x, COORDS.fenceParked.y);
      this.drawFenceDropGuide(ctx, state.time);
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

    // 隙間へ戻すドロップ先ガイド(同形シルエット+脈動リング): restoreStep、
    // および stepPlay で抜いた直後(戻す操作待ち)に表示。
    if (
      (phase === 'restoreStep' || (phase === 'removeStep' && state.mode === 'stepPlay' && state.stepRemoved >= 1)) &&
      state.escalator.removedStep !== null
    ) {
      const gap = state.escalator.pathPoint(stepGapT(state.escalator));
      drawDropGuide(ctx, 'step', gap.x, gap.y, state.time);
    }

    // 抜いたステップ: removedStep が設定されている間、駐機台(かわいい台車)の上に乗せて描く
    // (crankCheckで回した分だけ隙間もループ上を移動するため、stepGapT で現在位置を追跡する)
    if (state.escalator.removedStep !== null || state.stepRemoved > 0.02) {
      const easeT = this.easeOvershoot(state.stepRemoved);
      const model = state.escalator;
      const from = model.pathPoint(stepGapT(model));
      const parked = stepParkedFor(model);
      const x = from.x + (parked.x - from.x) * easeT;
      const y = from.y + (parked.y - from.y) * easeT;
      // 駐機台(台車+毛布)は「戻す前の待機中」に見せたいので、ある程度置き場へ
      // 近づいてから(easeT大きめ)描く。動いている最中は邪魔にならないよう省く。
      if (easeT > 0.6) {
        this.drawParkingPad(ctx, parked.x, parked.y, Math.min(1, (easeT - 0.6) / 0.4));
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#dfe4ea';
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-34, -10, 68, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, -4);
      ctx.lineTo(28, -4);
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

  // notice: 異常に気付く合図。ふわっと脈動する💥マーク+暖色リング(ワールド座標、
  // カメラは flow.ts 側で確実にフレームインするよう調整済み)。
  private renderNoticeAlert(ctx: CanvasRenderingContext2D, state: GameState): void {
    const time = state.time;
    const p = pulse01(time, 5.2);
    const bounce = Math.sin(time * 5.2) * 6;
    ctx.save();
    ctx.translate(COORDS.noticeAlert.x, COORDS.noticeAlert.y + bounce);
    // やわらかい警告リング(遠くからでも視認できるように大きめ)
    ctx.globalAlpha = 0.22 + 0.2 * p;
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(0, 0, 52 + p * 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffca28';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 40 + p * 10, 0, Math.PI * 2);
    ctx.stroke();
    // 本体マーク
    ctx.globalAlpha = 1;
    const scale = 1 + p * 0.22;
    ctx.scale(scale, scale);
    ctx.font = '58px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💥', 0, 2);
    ctx.restore();
  }

  // かわいい工具箱: ふた・留め金・ハンドル・星のワッペン付き。ふたが少し開いて
  // 中の新品部品がちらっと見える(親近感+「ここから部品が出てくる」わかりやすさ)。
  private drawToolbox(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    ctx.translate(COORDS.toolbox.x, COORDS.toolbox.y);

    const w = 108;
    const h = 62;
    const lidOpen = 0.22 + 0.05 * Math.sin(time * 1.6); // ほんの少し呼吸するように開閉

    // 本体
    const bodyGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    bodyGrad.addColorStop(0, '#ffb3d3');
    bodyGrad.addColorStop(1, '#ff8fbe');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#e0679f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2 + 8, w, h - 8, 14);
    ctx.fill();
    ctx.stroke();

    // 中の新品部品が見えるスリット(ふたの隙間から覗く光+シルエット)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 8, -h / 2 + 10, w - 16, 14, 6);
    ctx.clip();
    ctx.fillStyle = '#fff6ea';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(127,216,255,0.9)';
    ctx.beginPath();
    ctx.arc(-6, -h / 2 + 17, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,232,0.9)';
    ctx.beginPath();
    ctx.arc(16, -h / 2 + 17, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ハンドル
    ctx.strokeStyle = '#c94f85';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -h / 2 - 2, 16, Math.PI, 0);
    ctx.stroke();

    // 留め金
    ctx.fillStyle = '#ffe1ee';
    ctx.strokeStyle = '#c94f85';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-9, -h / 2 + 6, 18, 14, 4);
    ctx.fill();
    ctx.stroke();

    // ふた(斜めに少し開いた三角の縁取りで「パカッ」感)
    ctx.save();
    ctx.translate(-w / 2 + 6, -h / 2 + 10);
    ctx.rotate(-lidOpen);
    const lidGrad = ctx.createLinearGradient(0, -10, 0, 6);
    lidGrad.addColorStop(0, '#ffd6e8');
    lidGrad.addColorStop(1, '#ff9fc7');
    ctx.fillStyle = lidGrad;
    ctx.strokeStyle = '#e0679f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(0, -10, w - 12, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 星のワッペン
    this.drawStar(ctx, w / 2 - 20, 6, 10, '#fff2a8', '#e8b23a');

    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const a1 = a0 + Math.PI / 5;
      const p0 = { x: Math.cos(a0) * r, y: Math.sin(a0) * r };
      const p1 = { x: Math.cos(a1) * r * 0.45, y: Math.sin(a1) * r * 0.45 };
      if (i === 0) ctx.moveTo(p0.x, p0.y);
      else ctx.lineTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 大きなリサイクル箱(古ローラーの捨て場)。♻️感のある緑の箱+点線ガイド+矢印ゴースト。
  private drawRecycleBin(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    ctx.save();
    ctx.translate(x, y);

    const p = pulse01(time, 3);
    // 点線ガイド(磁石の予告円)
    ctx.save();
    ctx.strokeStyle = '#6fb89c';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, 56 + p * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const w = 78;
    const h = 58;
    const bodyGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    bodyGrad.addColorStop(0, '#8fe3cc');
    bodyGrad.addColorStop(1, '#5cbfa4');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#3f9481';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2 + 10, w, h - 10, 10);
    ctx.fill();
    ctx.stroke();

    // ふた(開いて中が見える)
    ctx.fillStyle = '#bdf1e2';
    ctx.strokeStyle = '#3f9481';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 4, -h / 2, w + 8, 14, 6);
    ctx.fill();
    ctx.stroke();

    // ♻️っぽい三角矢印マーク
    ctx.save();
    ctx.translate(0, 6);
    ctx.strokeStyle = '#f4fbf8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.arc(0, 0, 14, -0.5, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14 * Math.cos(0.9), 14 * Math.sin(0.9));
      ctx.lineTo(14 * Math.cos(0.9) + 6, 14 * Math.sin(0.9) - 2);
      ctx.moveTo(14 * Math.cos(0.9), 14 * Math.sin(0.9));
      ctx.lineTo(14 * Math.cos(0.9) - 2, 14 * Math.sin(0.9) + 6);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    ctx.restore();
  }

  private drawNewRollerSpot(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    ctx.save();
    ctx.translate(x, y);
    const shine = 0.5 + 0.5 * Math.sin(time * 4);
    const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 24);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#bdeeff');
    g.addColorStop(1, '#5cc7ec');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#2f9fc9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = shine * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-2, -2, 17, -1.0, -0.1);
    ctx.stroke();
    ctx.restore();
    this.drawSparkles(ctx, time, 34);
  }

  // ピンクのかわいい安全柵: 丸い頭の縦棒+旗付き(設置済み・大きめ)
  private drawFenceInstalled(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    const postH = 44;
    const spread = 42;

    // 台座
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, 4, spread + 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawFencePost(ctx, -spread, postH, false);
    this.drawFencePost(ctx, spread, postH, true);

    // 横バー2本(太いピンク+白のストライプ感)
    for (const barY of [-postH * 0.55, -postH * 0.18]) {
      ctx.strokeStyle = '#ff8fb3';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-spread, barY);
      ctx.lineTo(spread, barY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-spread, barY - 2);
      ctx.lineTo(spread, barY - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFencePost(ctx: CanvasRenderingContext2D, x: number, postH: number, withFlag: boolean): void {
    ctx.save();
    ctx.translate(x, 0);
    // 支柱
    ctx.fillStyle = '#f2f4f7';
    ctx.strokeStyle = '#c7cdd6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-5, -postH, 10, postH + 6, 5);
    ctx.fill();
    ctx.stroke();
    // 丸い頭
    ctx.fillStyle = '#ff8fb3';
    ctx.strokeStyle = '#e0679f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -postH - 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (withFlag) {
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#e0a92f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -postH + 2);
      ctx.lineTo(28, -postH + 10);
      ctx.lineTo(4, -postH + 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 待機置き場の柵(小さめ・畳んだ見た目でつまみやすさを示す)
  private drawFenceParked(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.6, 0.6);
    ctx.globalAlpha = 0.95;
    this.drawFencePostMini(ctx, -34);
    this.drawFencePostMini(ctx, 34);
    ctx.strokeStyle = '#ff8fb3';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-34, -20);
    ctx.lineTo(34, -20);
    ctx.stroke();
    ctx.restore();
  }

  private drawFencePostMini(ctx: CanvasRenderingContext2D, x: number): void {
    ctx.save();
    ctx.translate(x, 0);
    ctx.fillStyle = '#f2f4f7';
    ctx.strokeStyle = '#c7cdd6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-5, -30, 10, 34, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff8fb3';
    ctx.strokeStyle = '#e0679f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -32, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawFenceDropGuide(ctx: CanvasRenderingContext2D, time: number): void {
    drawDropGuide(ctx, 'fence', COORDS.fenceDrop.x, COORDS.fenceDrop.y, time);
  }

  // 抜いたステップの駐機台(かわいい台車+毛布)。ステップが上に乗る場所を
  // 一目でわかるようにする。
  private drawParkingPad(ctx: CanvasRenderingContext2D, x: number, y: number, appear: number): void {
    if (appear <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = appear;

    // 毛布(波打つ縁+ドット柄)
    ctx.fillStyle = '#ffd9ec';
    ctx.strokeStyle = '#f2a8cf';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-44, -2, 88, 22, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9fc7';
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * 11, 9, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 台車の車輪
    ctx.fillStyle = '#8892a0';
    ctx.strokeStyle = '#525a66';
    ctx.lineWidth = 2;
    for (const wx of [-30, 30]) {
      ctx.beginPath();
      ctx.arc(wx, 20, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
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
        ctx.scale(0.75, 0.75);
        this.drawFencePostMini(ctx, -34);
        this.drawFencePostMini(ctx, 34);
        ctx.strokeStyle = '#ff8fb3';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-34, -20);
        ctx.lineTo(34, -20);
        ctx.stroke();
        break;
      case 'fault:rollerOld': {
        const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 28);
        g.addColorStop(0, '#e7ebef');
        g.addColorStop(1, '#8892a0');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#525a66';
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      }
      case 'fault:rollerNew': {
        const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 28);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#7fd8ff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2f9fc9';
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      }
      case 'fault:chainGuide':
        ctx.fillStyle = '#dba05a';
        ctx.strokeStyle = '#4c525c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-26, -10, 52, 20, 5);
        ctx.fill();
        ctx.stroke();
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
