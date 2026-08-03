// ============================================================================
// src/flow/index.ts — GameFlow: 進行ステートマシン・演出指揮。
// 「ガコン！くるん！レーンのうらがわ工場」 必須ループ13(+)ステップを実装する。
//
// 責務: FlowStep遷移 / input.setAllowed / カメラ演出(縦横で構図を変える) /
//       ヒント(robot視線→spotlight→gesture の3段階誘導) / 進行保存。
// MachineStateは読むだけ（書くのはsim）。演出用のRenderHintsはここで書く。
// ============================================================================
import type {
  FaultId, FlowStep, Interactable, Progress, RenderHints, SceneId,
} from '../core/types';
import { createDefaultHints } from '../core/types';
import { bus } from '../core/events';
import { loadProgress, saveProgress } from '../core/save';
import {
  BALL_EXIT, DOOR_HANDLE, FLAP, LANE_VIEW, ORIENTER, PANEL, PIT, RACK,
  SAFETY_LEVER, TABLE, TABLE_LEVER, WORLD,
} from '../core/geometry';

import type { CameraController } from '../core/camera';
import type { InputSystem } from '../core/input';
import type { LayoutManager } from '../core/layout';
import type { MachineSim } from '../sim';
import type { UIOverlay, UIAction } from '../ui';
import { setMuted, isMuted } from '../audio';
// render-machineのsetDecorationはCONTRACTS.mdの公式APIには未記載だが、
// 実装側が用意していれば「(あれば)」の指示通り呼び出す(契約逸脱要望として報告)。
import { setDecoration } from '../render/machine';

import {
  allNonFlapFixed, faultFocus, FAULT_GESTURE, firstUnfixedNonFlap, GestureKind,
  pickFaults, repairGateIds,
} from './faults';
import { DEFAULT_THRESHOLDS, FIND_FAULT_THRESHOLDS, IdleGuide } from './idle-guide';
import { computeCamera, type CameraRequest } from './camera-director';

type Pose = RenderHints['robot']['pose'];

const DECOR_ORDER: Progress['decoration'][] = ['classic', 'pink', 'rainbow', 'flower'];
const SPEED_ORDER = [0.5, 1, 1.5];

export class GameFlow {
  private sim: MachineSim;
  private cam: CameraController;
  private input: InputSystem;
  private ui: UIOverlay;
  private lm: LayoutManager;

  private step_: FlowStep = 'title';
  private scene_: SceneId = 'lane';
  readonly hints: RenderHints = createDefaultHints();

  private idle = new IdleGuide();
  private progress: Progress;
  private currentFaults: FaultId[] = [];
  private lastFaults: FaultId[] = [];
  private activeFaultId: FaultId | null = null;

  private clock = 0;
  private stepEnteredAt = 0;
  private machineEnteredAt = Infinity;
  private doorFullyOpenAt: number | null = null;
  private closeCoverTriggered = false;
  private orientedCount = 0;
  private tableLowShot = false;
  private tablePlacedAt: number | null = null;
  private ballReturnedAt: number | null = null;
  private kurunSaid = false;

  private strikeAt: number | null = null;
  private fullRunOrientShown = false;
  private fullRunReturnedAt: number | null = null;
  private firstFullRunShowcase = true;
  private showcasePoint: { x: number; y: number; zoom: number } | null = null;
  private showcaseExpireAt = 0;

  constructor(deps: {
    sim: MachineSim; cam: CameraController; input: InputSystem;
    ui: UIOverlay; lm: LayoutManager;
  }) {
    this.sim = deps.sim;
    this.cam = deps.cam;
    this.input = deps.input;
    this.ui = deps.ui;
    this.lm = deps.lm;

    this.progress = loadProgress();
    setMuted(this.progress.muted);

    this.ui.onAction = (a) => this.handleUIAction(a);
    this.registerApproachInteractable();
    this.lm.onChange(() => this.applyCamera(true));
    this.wireBus();

    this.goto('title');
    this.applyCamera(true);
  }

  get step(): FlowStep { return this.step_; }
  get scene(): SceneId { return this.scene_; }

  update(dt: number, time: number): void {
    this.clock = time;
    this.idle.update(dt);
    if (this.showcasePoint && this.clock > this.showcaseExpireAt) this.showcasePoint = null;
    this.decayCelebrate(dt);
    this.tickStep(dt);
    this.applyCamera(false);
    this.syncUIState();
  }

  // ── UIのローカル楽観状態を真値(sim.state/progress)で上書きする ──────────
  // ui は xray/速度/ミュート/装飾をタップ直後に見た目だけ先取りで更新するため、
  // 真の値(simが握るMachineState、flowが握るProgress)とズレうる。毎フレーム
  // 安価な代入で同期し直すことでズレを解消する。
  private syncUIState(): void {
    const speedIdx = SPEED_ORDER.indexOf(this.sim.state.simSpeed);
    this.ui.syncState({
      xray: this.sim.state.xray,
      speedLevel: (speedIdx >= 0 ? speedIdx : 1) as 0 | 1 | 2,
      muted: isMuted(),
      decorIdx: Math.max(0, DECOR_ORDER.indexOf(this.progress.decoration)),
    });
  }

  // ── 契約にない「奥へスワイプ/タップ」ナビゲーション専用Interactable ──────
  // approachはMachineStateに何も書き込まない純粋なシーン遷移ジェスチャーで、
  // flowだけがこの完了を知る必要があるため、flowが自前で登録する
  // （詳細は最終レポートの「契約逸脱」参照）。
  private registerApproachInteractable(): void {
    const approach: Interactable = {
      id: 'approach',
      scene: 'lane',
      priority: 1000,
      enabled: () => this.step_ === 'approach' && this.scene_ === 'lane',
      hit: (_x: number, y: number) => y < LANE_VIEW.backWallY + 260,
      onDown: () => {
        if (this.step_ === 'approach' && this.scene_ === 'lane') this.enterMachineFromApproach();
      },
    };
    this.input.register(approach);
  }

  private wireBus(): void {
    bus.on('pins:down', () => {
      if (this.step_ === 'bowl') this.goto('breakdown');
    });

    bus.on('fault:found', () => {
      if (this.step_ === 'find-fault') this.goto('fix');
    });

    bus.on('fault:fixed', () => {
      if (this.step_ !== 'find-fault' && this.step_ !== 'fix') return;
      this.activeFaultId = firstUnfixedNonFlap(this.sim.state);
      if (allNonFlapFixed(this.sim.state)) {
        this.goto('close-cover');
        return;
      }
      if (this.step_ === 'fix') {
        this.gate(repairGateIds(this.sim.state));
        this.idle.reset();
      }
    });

    bus.on('pin:oriented', () => {
      if (this.step_ === 'orient-pins' || this.step_ === 'rack-fill') {
        this.orientedCount += 1;
        // ピンプールは固定15本(free-drop用の予備込み)だが、通常周回で実際に
        // 流れているのはそのうち 'gone'(未使用/プール中)以外の本数だけ。
        // プール総数と比べると永久に満たされず先へ進めなかったバグの修正。
        const flowingCount = this.sim.state.pins.filter((p) => p.zone !== 'gone').length;
        if (this.step_ === 'orient-pins' && this.orientedCount >= flowingCount) {
          this.goto('rack-fill');
        }
      } else if (this.step_ === 'full-run' && this.scene_ === 'machine' && !this.fullRunOrientShown) {
        this.fullRunOrientShown = true;
        this.showcaseAt(ORIENTER.x, ORIENTER.y, 1.6);
      }
    });

    bus.on('rack:full', () => {
      if (this.step_ === 'orient-pins' || this.step_ === 'rack-fill') {
        this.goto('table-drop');
      } else if (this.step_ === 'full-run') {
        this.showcaseAt(RACK.x + RACK.w / 2, RACK.y + RACK.h / 2, 1.3);
      }
    });

    bus.on('table:placed', () => {
      if (this.step_ === 'table-drop') {
        bus.emit('voice', { id: 'ston' });
        this.tableLowShot = true;
        this.tablePlacedAt = this.clock;
      } else if (this.step_ === 'full-run') {
        this.showcaseAt(TABLE.x, TABLE.yDown, 1.2);
      }
    });

    bus.on('ball:returned', () => {
      if (this.step_ === 'ball-return') {
        bus.emit('voice', { id: 'ball-back' });
        this.ballReturnedAt = this.clock;
      } else if (this.step_ === 'full-run') {
        this.showcaseAt(BALL_EXIT.x, BALL_EXIT.y, 1.3);
        this.fullRunReturnedAt = this.clock;
      }
    });

    bus.on('strike', () => {
      if (this.step_ === 'full-run' && this.scene_ === 'lane') {
        this.hints.celebrate = 1;
        this.strikeAt = this.clock;
      }
    });
  }

  // ── ステップ遷移 ──────────────────────────────────────────────────
  private goto(step: FlowStep): void {
    this.step_ = step;
    this.stepEnteredAt = this.clock;
    this.idle.setThresholds(DEFAULT_THRESHOLDS);
    this.idle.reset();
    bus.emit('flow', { step });

    switch (step) {
      case 'title': this.enterTitle(); break;
      case 'bowl': this.enterBowl(); break;
      case 'breakdown': this.enterBreakdown(); break;
      case 'approach': this.enterApproach(); break;
      case 'power-off': this.enterPowerOff(); break;
      case 'safety-lock': this.enterSafetyLock(); break;
      case 'open-door': this.enterOpenDoor(); break;
      case 'find-fault': this.enterFindFault(); break;
      case 'fix': this.enterFix(); break;
      case 'close-cover': this.enterCloseCover(); break;
      case 'orient-pins': this.enterOrientPins(); break;
      case 'rack-fill': this.enterRackFill(); break;
      case 'table-drop': this.enterTableDrop(); break;
      case 'ball-return': this.enterBallReturn(); break;
      case 'unlock': this.enterUnlock(); break;
      case 'full-run': this.enterFullRun(); break;
      case 'celebrate': this.enterCelebrate(); break;
      case 'replay-menu': this.enterReplayMenu(); break;
      case 'free-play': this.enterFreePlay(); break;
    }
  }

  private enterTitle(): void {
    this.scene_ = 'lane';
    this.ui.show('title');
    this.gate(['start']);
    this.hints.robot = {
      x: LANE_VIEW.centerX, y: LANE_VIEW.nearY - 120,
      pose: 'idle', lookX: LANE_VIEW.centerX, lookY: LANE_VIEW.deckY, visible: true,
    };
    this.hints.spotlight = null;
    this.hints.gesture = null;
  }

  private enterBowl(): void {
    this.scene_ = 'lane';
    this.ui.show('hud');
    this.gate(['ball-swipe']);
  }

  private enterBreakdown(): void {
    this.scene_ = 'lane';
    this.gate([]);
    this.sim.startBreakdown(this.currentFaults);
    this.lastFaults = this.currentFaults;
    bus.emit('voice', { id: 'look-back' });
  }

  private enterApproach(): void {
    this.scene_ = 'lane';
    this.machineEnteredAt = Infinity;
    this.gate(['approach']);
  }

  private enterMachineFromApproach(): void {
    this.scene_ = 'machine';
    this.machineEnteredAt = this.clock;
    this.gate([]);
  }

  private enterPowerOff(): void {
    this.gate([]);
    this.sim.setPower(false);
  }

  private enterSafetyLock(): void {
    this.gate(['safety-lever']);
  }

  private enterOpenDoor(): void {
    this.doorFullyOpenAt = null;
    this.gate(['door-handle']);
  }

  private enterFindFault(): void {
    this.activeFaultId = firstUnfixedNonFlap(this.sim.state);
    const ids = repairGateIds(this.sim.state);
    if (ids.length === 0) { this.goto('close-cover'); return; }
    this.idle.setThresholds(FIND_FAULT_THRESHOLDS);
    this.gate(ids);
    bus.emit('voice', { id: 'stuck' });
  }

  private enterFix(): void {
    this.activeFaultId = firstUnfixedNonFlap(this.sim.state);
    const ids = repairGateIds(this.sim.state);
    if (ids.length === 0 || this.activeFaultId === null) { this.goto('close-cover'); return; }
    this.gate(ids);
  }

  private enterCloseCover(): void {
    this.closeCoverTriggered = false;
    this.gate(['cover-close']);
  }

  private enterOrientPins(): void {
    this.orientedCount = 0;
    this.gate(['orient-swipe']);
    if (!this.kurunSaid) {
      bus.emit('voice', { id: 'kurun' });
      this.kurunSaid = true;
    }
  }

  private enterRackFill(): void {
    this.gate(['orient-swipe']);
  }

  private enterTableDrop(): void {
    this.tableLowShot = false;
    this.tablePlacedAt = null;
    this.gate(['table-lever']);
    bus.emit('voice', { id: 'ten-ready' });
  }

  private enterBallReturn(): void {
    this.ballReturnedAt = null;
    this.gate(['flap']);
  }

  private enterUnlock(): void {
    this.gate(['safety-lever', 'door-handle']);
  }

  private enterFullRun(): void {
    this.scene_ = 'lane';
    this.strikeAt = null;
    this.fullRunOrientShown = false;
    this.fullRunReturnedAt = null;
    this.showcasePoint = null;
    this.gate([]);
    this.sim.startFullRun();
  }

  private enterCelebrate(): void {
    this.gate([]);
    this.firstFullRunShowcase = false;
  }

  private enterReplayMenu(): void {
    this.scene_ = 'lane';
    this.ui.show('replay');
    this.gate(['replay-same', 'replay-new', 'free-play', 'go-bowling']);
  }

  private enterFreePlay(): void {
    this.sim.setFreePlay(true);
    this.ui.show('freeplay');
    this.gate('all');
  }

  // ── 毎フレームのステップ挙動(カメラ以外): ポーリング完了判定 + ヒント ──
  private tickStep(_dt: number): void {
    const state = this.sim.state;
    switch (this.step_) {
      case 'title':
        break;

      case 'bowl': {
        this.idle.watch(state.ball.x + state.ball.y * 3);
        const robot = { x: LANE_VIEW.ballRack.x - 80, y: LANE_VIEW.ballRack.y - 40 };
        const target = { x: LANE_VIEW.centerX, y: LANE_VIEW.nearY - 40 };
        this.guide(target, robot, 'idle', { kind: 'swipe', dir: -Math.PI / 2 });
        break;
      }

      case 'breakdown': {
        const robot = { x: LANE_VIEW.centerX + 140, y: LANE_VIEW.deckY + 40 };
        const target = { x: LANE_VIEW.centerX, y: LANE_VIEW.backWallY };
        this.hints.robot = { x: robot.x, y: robot.y, pose: 'point', lookX: target.x, lookY: target.y, visible: true };
        this.hints.spotlight = null;
        this.hints.gesture = null;
        if (this.clock - this.stepEnteredAt > 2.0) this.goto('approach');
        break;
      }

      case 'approach': {
        if (this.scene_ === 'lane') {
          const robot = { x: LANE_VIEW.centerX + 140, y: LANE_VIEW.deckY + 40 };
          const target = { x: LANE_VIEW.centerX, y: LANE_VIEW.backWallY + 40 };
          this.guide(target, robot, 'point', { kind: 'swipe', dir: -Math.PI / 2 });
        } else {
          this.hints.spotlight = null;
          this.hints.gesture = null;
          if (this.clock - this.machineEnteredAt > 0.4) this.goto('power-off');
        }
        break;
      }

      case 'power-off': {
        this.hints.robot = {
          x: PANEL.x - 60, y: PANEL.y + 40, pose: 'work', lookX: PANEL.x, lookY: PANEL.y, visible: true,
        };
        this.hints.spotlight = null;
        this.hints.gesture = null;
        if (this.clock - this.stepEnteredAt > 1.2) this.goto('safety-lock');
        break;
      }

      case 'safety-lock': {
        this.idle.watch(state.safetyLever);
        const robot = { x: PANEL.x - 80, y: PANEL.y + 60 };
        const target = { x: SAFETY_LEVER.x, y: SAFETY_LEVER.y };
        this.guide(target, robot, 'point', { kind: 'drag', dir: Math.PI / 2 });
        if (state.locked) {
          bus.emit('voice', { id: 'lock-ok' });
          this.goto('open-door');
        }
        break;
      }

      case 'open-door': {
        this.idle.watch(state.door);
        const robot = { x: DOOR_HANDLE.x - 80, y: DOOR_HANDLE.y + 40 };
        const target = { x: DOOR_HANDLE.x, y: DOOR_HANDLE.y };
        this.guide(target, robot, 'point', { kind: 'drag', dir: 0 });
        if (state.door >= 0.98) {
          if (this.doorFullyOpenAt === null) this.doorFullyOpenAt = this.clock;
          else if (this.clock - this.doorFullyOpenAt > 1.4) { this.doorFullyOpenAt = null; this.goto('find-fault'); }
        } else {
          this.doorFullyOpenAt = null;
        }
        break;
      }

      case 'find-fault': {
        const target = this.activeFaultId
          ? faultFocus(state, this.activeFaultId)
          : { x: WORLD.w * 0.5, y: WORLD.h * 0.4 };
        const robot = { x: WORLD.w * 0.62, y: WORLD.h * 0.28 };
        this.guide(target, robot, 'idle', { kind: 'tap', dir: 0 });
        // 開いた扉の中を少し見せてから「発見」演出(fixステップの寄りカメラ)へ。
        // 契約上 sim/ui のどちらも 'fault:found' を発火しない設計だったため
        // (bus.on('fault:found',...)が永久に呼ばれず find-fault → fix へ
        // 遷移できなかった)、時間経過での自動発火はflowの責務として自前で行う。
        if (this.activeFaultId && this.clock - this.stepEnteredAt > 1.6) {
          bus.emit('fault:found', { id: this.activeFaultId });
        }
        break;
      }

      case 'fix': {
        const target = this.activeFaultId
          ? faultFocus(state, this.activeFaultId)
          : { x: WORLD.w * 0.5, y: WORLD.h * 0.4 };
        const robot = { x: target.x + 120, y: target.y - 80 };
        let gesture = this.activeFaultId ? FAULT_GESTURE[this.activeFaultId] : { kind: 'tap' as GestureKind, dir: 0 };
        // belt-derailはベルトなぞり(belt-trace)完了後、ローラーを円でなぞる
        // (roller-spin)確認が残る。derail<=0はその「トレース済み・確認待ち」
        // を示す(sim側の唯一の真実state.belt.derailで判定、新規フィールド不要)。
        if (this.activeFaultId === 'belt-derail' && state.belt.derail <= 0) {
          gesture = { kind: 'circle', dir: 0 };
        }
        this.guide(target, robot, 'idle', gesture);
        break;
      }

      case 'close-cover': {
        this.idle.watch(state.door);
        const robot = { x: DOOR_HANDLE.x - 80, y: DOOR_HANDLE.y + 40 };
        const target = { x: DOOR_HANDLE.x, y: DOOR_HANDLE.y };
        this.guide(target, robot, 'point', { kind: 'drag', dir: Math.PI });
        if (state.door <= 0.02 && !this.closeCoverTriggered) {
          this.closeCoverTriggered = true;
          this.sim.setPower(true);
          this.sim.startTestFeed();
          this.goto('orient-pins');
        }
        break;
      }

      case 'orient-pins': {
        this.idle.watch(this.orientedCount);
        const robot = { x: ORIENTER.x - 120, y: ORIENTER.y - 60 };
        const target = { x: ORIENTER.x, y: ORIENTER.y };
        this.guide(target, robot, 'idle', { kind: 'swipe', dir: 0 });
        break;
      }

      case 'rack-fill': {
        const robot = { x: RACK.x + RACK.w / 2, y: RACK.y - 60 };
        const target = { x: RACK.x + RACK.w / 2, y: RACK.y + RACK.h / 2 };
        this.hints.robot = { x: robot.x, y: robot.y, pose: 'idle', lookX: target.x, lookY: target.y, visible: true };
        this.hints.spotlight = null;
        this.hints.gesture = null;
        break;
      }

      case 'table-drop': {
        this.idle.watch(state.table.y);
        const robot = { x: TABLE_LEVER.x - 80, y: TABLE_LEVER.y + 40 };
        const target = { x: TABLE_LEVER.x, y: TABLE_LEVER.y };
        this.guide(target, robot, 'point', { kind: 'drag', dir: Math.PI / 2 });
        if (this.tablePlacedAt !== null && this.clock - this.tablePlacedAt > 1.6) {
          this.tablePlacedAt = null;
          this.goto('ball-return');
        }
        break;
      }

      case 'ball-return': {
        const robot = { x: FLAP.x - 100, y: FLAP.y - 80 };
        const target = { x: FLAP.x, y: FLAP.y };
        this.guide(target, robot, 'idle', { kind: 'swipe', dir: -Math.PI / 2 });
        if (this.ballReturnedAt !== null && this.clock - this.ballReturnedAt > 1.2) {
          this.ballReturnedAt = null;
          this.goto('unlock');
        }
        break;
      }

      case 'unlock': {
        this.idle.watch(state.safetyLever + state.door);
        const robot = { x: PANEL.x - 80, y: PANEL.y + 60 };
        const target = { x: SAFETY_LEVER.x, y: SAFETY_LEVER.y };
        this.guide(target, robot, 'point', { kind: 'drag', dir: -Math.PI / 2 });
        if (!state.locked && state.door <= 0.02) {
          this.scene_ = 'lane';
          this.goto('full-run');
        }
        break;
      }

      case 'full-run': {
        if (this.scene_ === 'lane') {
          this.hints.robot = {
            x: LANE_VIEW.centerX + 200, y: LANE_VIEW.nearY - 80,
            pose: 'idle', lookX: LANE_VIEW.centerX, lookY: LANE_VIEW.deckY, visible: true,
          };
          if (this.strikeAt !== null && this.clock - this.strikeAt > 1.6) {
            this.strikeAt = null;
            this.scene_ = 'machine';
            this.showcaseAt(PIT.x, PIT.y, 1.5);
          }
        } else {
          this.hints.robot = {
            x: WORLD.w * 0.65, y: WORLD.h * 0.25, pose: 'work',
            lookX: this.showcasePoint?.x ?? WORLD.w / 2,
            lookY: this.showcasePoint?.y ?? WORLD.h / 2,
            visible: true,
          };
          if (this.fullRunReturnedAt !== null && this.clock - this.fullRunReturnedAt > 1.2) {
            this.fullRunReturnedAt = null;
            this.goto('celebrate');
          }
        }
        this.hints.spotlight = null;
        this.hints.gesture = null;
        break;
      }

      case 'celebrate': {
        this.hints.robot.pose = 'happy';
        this.hints.spotlight = null;
        this.hints.gesture = null;
        if (this.clock - this.stepEnteredAt > 2.2) this.finishRunAndGotoReplay();
        break;
      }

      case 'replay-menu': {
        this.hints.robot = {
          x: LANE_VIEW.centerX, y: LANE_VIEW.nearY - 200,
          pose: 'happy', lookX: LANE_VIEW.centerX, lookY: LANE_VIEW.deckY, visible: true,
        };
        this.hints.spotlight = null;
        this.hints.gesture = null;
        break;
      }

      case 'free-play': {
        this.hints.robot.visible = false;
        this.hints.spotlight = null;
        this.hints.gesture = null;
        break;
      }
    }
  }

  // ── 誘導ヒント(robot視線→spotlight→gesture) ─────────────────────────
  private guide(
    target: { x: number; y: number },
    robot: { x: number; y: number },
    pose: Pose,
    gesture: { kind: GestureKind; dir: number },
    spotlightR = 140,
  ): void {
    const stage = this.idle.stage;
    this.hints.robot = {
      x: robot.x, y: robot.y,
      pose: stage === 'none' ? pose : 'point',
      lookX: target.x, lookY: target.y,
      visible: true,
    };
    this.hints.spotlight = (stage === 'spotlight' || stage === 'gesture')
      ? {
        x: target.x, y: target.y, r: spotlightR,
        strength: Math.min(1, 0.4 + (this.idle.seconds - this.idle.thresholds.spotlight) / 1.5),
      }
      : null;
    this.hints.gesture = stage === 'gesture'
      ? { x: target.x, y: target.y, dir: gesture.dir, kind: gesture.kind }
      : null;
  }

  private decayCelebrate(dt: number): void {
    if (this.step_ === 'celebrate') { this.hints.celebrate = 1; return; }
    this.hints.celebrate = Math.max(0, this.hints.celebrate - dt * 0.5);
  }

  private showcaseAt(x: number, y: number, zoom: number): void {
    if (!this.firstFullRunShowcase) return;
    this.showcasePoint = { x, y, zoom };
    this.showcaseExpireAt = this.clock + 1.3;
  }

  // ── 入力ゲート ────────────────────────────────────────────────────
  private gate(ids: string[] | 'all'): void {
    if (ids === 'all') { this.input.setAllowed('all'); return; }
    const extra = this.ui.mode === 'none' ? [] : ['toggle-mute', 'cycle-decor'];
    this.input.setAllowed([...ids, ...extra]);
  }

  // ── カメラ ────────────────────────────────────────────────────────
  private applyCamera(instant: boolean): void {
    const layout = this.lm.layout;
    const state = this.sim.state;
    const req: CameraRequest = {
      step: this.step_,
      scene: this.scene_,
      orientation: layout.orientation,
      layout,
      state,
      faultFocusPoint: this.activeFaultId ? faultFocus(state, this.activeFaultId) : null,
      tableLowShot: this.tableLowShot,
      showcase: this.showcasePoint,
      laneBallY: state.ball.zone === 'lane' ? state.ball.y : LANE_VIEW.nearY,
    };
    const c = computeCamera(req, this.cam);
    if (instant) this.cam.snap(c.x, c.y, c.zoom);
    else this.cam.focus(c.x, c.y, c.zoom, c.lerp);
  }

  // ── UIアクション ──────────────────────────────────────────────────
  private handleUIAction(a: UIAction): void {
    switch (a) {
      case 'start':
        if (this.step_ === 'title') this.beginNewGame();
        break;
      case 'replay-same':
        if (this.step_ === 'replay-menu') this.startReplay(true);
        break;
      case 'replay-new':
        if (this.step_ === 'replay-menu') this.startReplay(false);
        break;
      case 'free-play':
        if (this.step_ === 'replay-menu') this.goto('free-play');
        break;
      case 'go-bowling':
        if (this.step_ === 'replay-menu') this.startGoBowling();
        break;
      case 'toggle-xray':
        if (this.step_ === 'free-play') this.sim.setXray(!this.sim.state.xray);
        break;
      case 'cycle-speed':
        if (this.step_ === 'free-play') this.cycleSimSpeed();
        break;
      case 'exit-free':
        if (this.step_ === 'free-play') { this.sim.setFreePlay(false); this.goto('replay-menu'); }
        break;
      case 'toggle-mute':
        setMuted(!isMuted());
        this.progress.muted = isMuted();
        saveProgress(this.progress);
        break;
      case 'cycle-decor':
        this.cycleDecoration();
        break;
    }
  }

  private cycleSimSpeed(): void {
    const idx = SPEED_ORDER.indexOf(this.sim.state.simSpeed);
    this.sim.setSimSpeed(SPEED_ORDER[(idx + 1 + SPEED_ORDER.length) % SPEED_ORDER.length]);
  }

  private cycleDecoration(): void {
    const idx = DECOR_ORDER.indexOf(this.progress.decoration);
    this.progress.decoration = DECOR_ORDER[(idx + 1) % DECOR_ORDER.length];
    saveProgress(this.progress);
    setDecoration(this.progress.decoration);
  }

  private beginNewGame(): void {
    this.sim.reset();
    this.currentFaults = pickFaults(!this.progress.clearedOnce);
    this.goto('bowl');
  }

  private startReplay(same: boolean): void {
    this.sim.reset();
    this.currentFaults = same && this.lastFaults.length > 0 ? this.lastFaults : pickFaults(false);
    this.goto('bowl');
  }

  private startGoBowling(): void {
    this.sim.reset();
    this.goto('full-run');
  }

  private finishRunAndGotoReplay(): void {
    this.progress.clearedOnce = true;
    this.progress.playCount += 1;
    this.progress.freePlayUnlocked = true;
    saveProgress(this.progress);
    this.goto('replay-menu');
  }
}
