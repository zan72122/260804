// ============================================================================
// MachineSim — 機械シミュレーション本体。MachineState を唯一書き換える。
// ガラガラッ(回収)・くるん(向き揃え)・ストン(10本配置)の心臓部。
// ============================================================================
import { bus } from '../core/events';
import type { InputSystem } from '../core/input';
import type {
  Ball, FaultId, MachineState, Pin,
} from '../core/types';
import {
  BALL_EXIT, BALL_PATH, BELT_CORNER_T, BELT_PATH, ELEVATOR, FLAP_T,
  LANE_VIEW, PIT, TABLE, TOP_PATH, ORIENTER_T,
  pathLength, pointOnPath,
} from '../core/geometry';
import {
  BASE_PIN_COUNT, PinExtra, clamp, createPool, distanceToPath,
  easeInOutQuad, easeOutBack, easeOutCubic, laneDeckPosition, lerp, makeExtra,
  rackSlotPosition, randRange, slotToRowCol, startTween, stepTween,
} from './pins';
import { FAULT_DEFS, makeFaultInstance } from './faults';
import { bowlDuration, bowlPosition, pickStanding } from './ballistics';
import { registerAllInteractables } from './interactions';

// ── 速度パラメータ（t/秒。距離依存分は経路長から比を出す） ─────────────
const BELT_LEN = pathLength(BELT_PATH);
const TOP_LEN = pathLength(TOP_PATH);
const BALL_LEN = pathLength(BALL_PATH);

const BELT_T_SPEED = 0.22;
const BELT_MIN_GAP_T = 70 / BELT_LEN;
const TOP_T_SPEED = 0.3;
const TOP_MIN_GAP_T = 65 / TOP_LEN;
const ELEV_T_SPEED = 1 / 1.3;
const BALL_T_SPEED = 0.24;

const ELEV_INTAKE_ANGLE = Math.atan2(ELEVATOR.intake[1] - ELEVATOR.cy, ELEVATOR.intake[0] - ELEVATOR.cx);
const ELEV_RELEASE_ANGLE_RAW = Math.atan2(ELEVATOR.release[1] - ELEVATOR.cy, ELEVATOR.release[0] - ELEVATOR.cx);
const ELEV_RELEASE_ANGLE = ELEV_RELEASE_ANGLE_RAW < ELEV_INTAKE_ANGLE
  ? ELEV_RELEASE_ANGLE_RAW + Math.PI * 2 : ELEV_RELEASE_ANGLE_RAW;

type BallMode = 'idle' | 'bowling' | 'toPit' | 'returning' | 'done';
type OrientStyle = 'kurun' | 'koron' | 'through';

interface OrientAnim {
  pin: number;
  t: number;
  dur: number;
  turns: number;
  fromRot: number;
  style: OrientStyle;
}

export class MachineSim {
  readonly state: MachineState;

  private pool: Pin[];
  private extra = new Map<number, PinExtra>();
  private liveOrder: number[] = [];

  private beltQueue: number[] = [];
  private elevQueue: number[] = [];
  private topQueue: number[] = [];
  private rackWaiting: number[] = [];
  private sweepQueueIds: number[] = [];

  private timers: { t: number; fn: () => void }[] = [];

  private freePlayOn = false;
  private fullRunActive = false;

  private jamPinId: number | null = null;
  private jamActive = false;
  private jamTimer = 0;
  private stallScheduled = false;
  private kotoAccum = 0;

  private orientAnim: OrientAnim | null = null;
  private orientIdleTimer = 0;

  private tenthPause: { pin: number; timer: number } | null = null;
  private placeTimer = 0;

  private ballMode: BallMode = 'idle';
  private ballT = 0;
  private ballDur = 1;
  private ballDirX = 0;
  private ballTimer = 0;
  private ballPaused = false;
  private pendingStrike = false;

  private tableLeverSpring = false;
  private lastRollerAngle: number | null = null;
  /** belt-trace(なぞり)でderailが0になった後、roller-spin(円でなぞる)の
      確認動作待ちかどうか。true中に貯まった回転量が一周分でbelt-derail確定修理。 */
  private rollerConfirmPending = false;
  private rollerConfirmAngle = 0;

  constructor() {
    this.pool = createPool();
    this.state = {
      powerOn: true, locked: false, door: 0, xray: false, simSpeed: 1, testMode: false,
      safetyLever: 0, tableLever: 0,
      belt: { run: false, offset: 0, derail: 0, vibrate: 0, rollerAngle: 0 },
      elevator: { run: false, angle: 0 },
      orienter: { guideOffset: 0, busyPin: null },
      rack: { slots: new Array(10).fill(null), stuckGate: null, gateOpen: new Array(10).fill(1) },
      table: { y: 0, phase: 'up', holding: [] },
      ballReturn: { flap: 0, flapStuck: false },
      sweep: { pos: 0, phase: 'idle' },
      pins: this.pool,
      ball: { zone: 'rack', t: 0, x: 0, y: 0, rot: 0, color: '#ef6c8e' },
      faults: [],
    };
    this.reset();
  }

  // ── 公開API ──────────────────────────────────────────────────────
  get freePlay(): boolean { return this.freePlayOn; }

  reset(): void {
    this.timers = [];
    this.beltQueue = []; this.elevQueue = []; this.topQueue = []; this.rackWaiting = [];
    this.sweepQueueIds = [];
    this.jamPinId = null; this.jamActive = false; this.jamTimer = 0; this.stallScheduled = false;
    this.kotoAccum = 0; this.orientAnim = null; this.orientIdleTimer = 0; this.tenthPause = null;
    this.ballMode = 'idle'; this.ballPaused = false; this.fullRunActive = false;
    this.tableLeverSpring = false; this.placeTimer = 0; this.lastRollerAngle = null;
    this.rollerConfirmPending = false; this.rollerConfirmAngle = 0;
    this.extra.clear();
    this.liveOrder = [];

    const st = this.state;
    st.powerOn = true;
    st.locked = false;
    st.door = 0;
    st.testMode = false;
    st.safetyLever = 0;
    st.tableLever = 0;
    st.belt = { run: false, offset: 0, derail: 0, vibrate: 0, rollerAngle: 0 };
    st.elevator = { run: false, angle: 0 };
    st.orienter = { guideOffset: 0, busyPin: null };
    st.rack = { slots: new Array(10).fill(null), stuckGate: null, gateOpen: new Array(10).fill(1) };
    st.table = { y: 0, phase: 'up', holding: [] };
    st.ballReturn = { flap: 0, flapStuck: false };
    st.sweep = { pos: 0, phase: 'idle' };
    st.faults = [];

    for (const p of this.pool) {
      p.zone = 'gone'; p.t = 0; p.x = 0; p.y = 0; p.rot = 0; p.pose = 'upright';
      p.stuck = false; p.slot = -1; p.vx = 0; p.vy = 0; p.ring = undefined;
    }
    for (let i = 0; i < BASE_PIN_COUNT; i++) {
      const p = this.pool[i];
      p.zone = 'lane'; p.slot = i; p.pose = 'upright';
      const pos = laneDeckPosition(i);
      p.x = pos.x; p.y = pos.y; p.rot = 0;
      this.liveOrder.push(i);
    }
    const ballPos = LANE_VIEW.ballRack;
    st.ball = { zone: 'rack', t: 0, x: ballPos.x, y: ballPos.y, rot: 0, color: '#ef6c8e' };
  }

  update(dt: number): void {
    if (dt <= 0) return;
    dt = clamp(dt, 0, 0.05);
    const simDt = dt * clamp(this.state.simSpeed || 1, 0.1, 3);

    this.updateTimers(simDt);
    this.updateTweens(simDt);
    this.updateLeverSpring(simDt);
    this.updateSweep(simDt);
    this.updateScatter(simDt);
    this.updatePitFeed();
    this.updateBelt(simDt);
    this.updateElevator(simDt);
    this.updateTop(simDt);
    this.updateOrienter(simDt);
    this.updateRack(simDt);
    this.updateTable(simDt);
    this.updateBall(simDt);
  }

  bowl(dirX: number, power: number): void {
    this.startBowl(dirX, power, false);
  }

  startBreakdown(faults: FaultId[]): void {
    this.state.faults = faults.map((id) => makeFaultInstance(id));
    for (const f of this.state.faults) FAULT_DEFS[f.id].inject(this.state, f.meta);

    this.jamPinId = null;
    this.jamActive = faults.includes('pin-jam');
    this.jamTimer = 0;
    this.stallScheduled = false;
    if (faults.includes('belt-derail')) this.scheduleStall(1.0);

    // 通常投球(bowl)は演出上「9本倒れ1本残る」(ballistics.pickStanding)ため
    // pose==='lying'だけを掃くと毎回9本しか回収されず、rack.slots(10枠)が
    // count>=10に到達できず'rack:full'が永遠に発火しない(=table-drop以降
    // 完全に詰む)統合バグがあった。実機のピンセッターは倒れていない
    // 残りピンも含めて毎フレーム一旦すべて回収するため、lane上の全ピン
    // (直立していても)を対象にする。
    const fallen = this.state.pins.filter((p) => p.zone === 'lane');
    this.sweepQueueIds = fallen.map((p) => p.id);
    if (this.sweepQueueIds.length > 0) {
      this.state.sweep.phase = 'sweeping';
      this.state.sweep.pos = 0;
    } else {
      this.state.belt.run = true;
    }
  }

  setPower(on: boolean): void {
    this.state.powerOn = on;
    if (!on) {
      this.state.belt.run = false;
      this.state.elevator.run = false;
    }
  }

  setLocked(v: boolean): void {
    this.state.locked = v;
    this.state.safetyLever = v ? 1 : 0;
  }

  startTestFeed(): void {
    this.state.testMode = true;
    this.state.belt.run = true;
  }

  /** カバー/扉を閉め戻す操作。閉じきったら試運転モードへ（'cover-close'用） */
  coverCloseInput(dragAmount: number): void {
    if (this.state.door <= 0) return;
    this.state.door = clamp(this.state.door - Math.abs(dragAmount) * 0.006, 0, 1);
    if (this.state.door <= 0.02) {
      this.state.door = 0;
      this.startTestFeed();
    }
  }

  dropTable(): void {
    if (this.state.table.phase !== 'up') return;
    const ids = this.state.rack.slots.filter((s): s is number => s !== null);
    if (ids.length === 0) return;
    for (let i = 0; i < 10; i++) this.state.rack.slots[i] = null;
    this.state.table.holding = ids;
    for (const id of ids) this.pinById(id).zone = 'table';
    this.state.table.phase = 'descending';
    this.state.table.y = 0;
    bus.emit('sfx', { id: 'table-down' });
  }

  startFullRun(): void {
    this.reset();
    this.fullRunActive = true;
    this.state.testMode = false;
    this.startBowl(0, 1, true);
  }

  setFreePlay(v: boolean): void {
    this.freePlayOn = v;
    if (v) {
      this.state.testMode = true;
      this.state.faults = [];
      this.jamPinId = null; this.jamActive = false; this.stallScheduled = false;
      this.state.rack.stuckGate = null;
      this.state.rack.gateOpen = this.state.rack.gateOpen.map(() => 1);
      this.state.orienter.guideOffset = 0;
      this.state.ballReturn.flapStuck = false;
      this.state.belt.derail = 0;
      this.state.belt.run = true;
      this.state.powerOn = true;
      this.state.locked = false;
    }
  }

  registerInteractables(input: InputSystem): void {
    registerAllInteractables(this, input);
  }

  /** 契約外の追加API（xray/simSpeedもsimのみが書けるため必要。統合時に契約へ追記依頼） */
  setSimSpeed(v: number): void { this.state.simSpeed = clamp(v, 0.25, 2); }
  setXray(v: boolean): void { this.state.xray = v; }

  // ── インタラクション用の公開ヘルパー（interactions.tsから呼ばれる） ──
  fixFault(id: FaultId): void {
    const f = this.state.faults.find((x) => x.id === id);
    if (!f || f.fixed) return;
    f.fixed = true;
    f.progress = 1;
    FAULT_DEFS[id].onFixed(this.state);
    bus.emit('fault:fixed', { id });
  }

  hasUnfixed(id: FaultId): boolean {
    return this.state.faults.some((f) => f.id === id && !f.fixed);
  }

  safetyLeverInput(dy: number): void {
    this.state.safetyLever = clamp(this.state.safetyLever + dy * 0.006, 0, 1);
    if (this.state.safetyLever >= 0.98 && !this.state.locked) {
      this.state.locked = true;
      bus.emit('sfx', { id: 'gakon' });
      bus.emit('camera:shake', { power: 0.25 });
    } else if (this.state.safetyLever <= 0.02 && this.state.locked) {
      this.state.locked = false;
    }
  }

  doorHandleInput(dx: number): void {
    const wasOpen = this.state.door >= 0.98;
    this.state.door = clamp(this.state.door + Math.abs(dx) * 0.006, 0, 1);
    if (!wasOpen && this.state.door >= 0.98) bus.emit('sfx', { id: 'paka' });
  }

  tableLeverInput(dy: number): void {
    this.state.tableLever = clamp(this.state.tableLever + dy * 0.006, 0, 1);
    if (this.state.tableLever >= 0.98 && !this.tableLeverSpring) {
      this.dropTable();
      this.tableLeverSpring = true;
    }
  }

  freeStuckPin(dragDist: number): void {
    if (this.jamPinId === null || dragDist < 40) return;
    const p = this.pinById(this.jamPinId);
    p.stuck = false;
    const freedId = this.jamPinId;
    this.jamPinId = null;
    this.jamActive = false;
    this.jamTimer = 0;
    this.state.belt.vibrate = 0;
    this.fixFault('pin-jam');
    bus.emit('pin:freed', { pin: freedId });
    bus.emit('sfx', { id: 'pachin' });
    const following = [...this.beltQueue]
      .filter((id) => this.pinById(id).t < p.t)
      .sort((a, b) => this.pinById(b).t - this.pinById(a).t)
      .slice(0, 5);
    following.forEach((id, i) => {
      this.schedule(0.3 * (i + 1), () => bus.emit('sfx', { id: 'koto', vol: 0.5 }));
    });
  }

  beltTraceInput(x: number, y: number, moveDist: number): void {
    if (this.state.belt.derail <= 0) return;
    if (distanceToPath(BELT_PATH, x, y) > 80) return;
    this.state.belt.derail = clamp(this.state.belt.derail - moveDist * 0.006, 0, 1);
    if (this.state.belt.derail <= 0.01 && !this.rollerConfirmPending) {
      this.state.belt.derail = 0;
      bus.emit('sfx', { id: 'pachin' });
      // ベルトは溝に戻ったが、まだ故障は確定修理しない。仕様どおり
      // ローラーを指で円になぞって「ベルト全体が連動する」ことを
      // 確認してから初めて belt-derail を fixFault する。
      this.rollerConfirmPending = true;
      this.rollerConfirmAngle = 0;
      this.lastRollerAngle = null;
    }
  }

  rollerSpinBegin(): void { this.lastRollerAngle = null; }

  rollerSpinInput(x: number, y: number): void {
    const ROLLER_X = 860, ROLLER_Y = 975;
    const ang = Math.atan2(y - ROLLER_Y, x - ROLLER_X);
    if (this.lastRollerAngle !== null) {
      let d = ang - this.lastRollerAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.state.belt.rollerAngle += d;
      this.state.belt.offset += Math.abs(d) * 60;
      if (this.rollerConfirmPending && this.hasUnfixed('belt-derail')) {
        this.rollerConfirmAngle += Math.abs(d);
        // 4歳児向けに寛容: ほぼ一周(約320度)でOKとする
        if (this.rollerConfirmAngle >= Math.PI * 2 * 0.89) {
          this.rollerConfirmPending = false;
          this.fixFault('belt-derail');
          bus.emit('sfx', { id: 'chime' });
        }
      }
    }
    this.lastRollerAngle = ang;
  }

  orientSwipeInput(dx: number, dy: number, speed: number): void {
    const bp = this.state.orienter.busyPin;
    if (bp === null || this.orientAnim) return;
    const turns = clamp(1 + speed * 0.015, 1, 2);
    const dur = lerp(0.7, 0.4, clamp(speed * 0.04, 0, 1));
    const pitch = lerp(0.9, 1.35, clamp(speed * 0.04, 0, 1));
    this.performOrient(bp, turns, dur, pitch);
  }

  guideFixInput(dx: number): void {
    if (!this.hasUnfixed('guide-shift')) return;
    this.state.orienter.guideOffset = clamp(this.state.orienter.guideOffset - Math.abs(dx) * 0.008, 0, 1);
    if (this.state.orienter.guideOffset <= 0.02) {
      this.state.orienter.guideOffset = 0;
      this.fixFault('guide-shift');
      bus.emit('sfx', { id: 'pachin' });
    }
  }

  rackGateInput(): void {
    if (!this.hasUnfixed('rack-gate')) return;
    const slot = this.state.rack.stuckGate;
    if (slot === null) return;
    this.state.rack.gateOpen[slot] = 1;
    this.fixFault('rack-gate');
    bus.emit('sfx', { id: 'pachin' });
  }

  flapInput(dy: number): void {
    this.state.ballReturn.flap = clamp(this.state.ballReturn.flap + Math.abs(dy) * 0.01, 0, 1);
    if (this.state.ballReturn.flap >= 0.95 && this.state.ballReturn.flapStuck) {
      this.fixFault('flap-stuck');
      this.ballPaused = false;
      bus.emit('sfx', { id: 'roll-under' });
    }
  }

  addFreeDropPin(): void {
    if (!this.freePlayOn) return;
    let id = this.pool.findIndex((p) => p.zone === 'gone');
    if (id === -1) {
      const oldest = this.liveOrder.shift();
      if (oldest === undefined) return;
      this.purgeFromQueues(oldest);
      this.pinById(oldest).zone = 'gone';
      id = oldest;
    }
    const p = this.pinById(id);
    p.stuck = false; p.slot = -1;
    this.sendToPit(p);
    this.liveOrder.push(id);
    bus.emit('sfx', { id: 'garagara' });
  }

  // ── 内部: プール/補助データ ──────────────────────────────────────
  private pinById(id: number): Pin {
    return this.pool[id];
  }

  private extraOf(id: number): PinExtra {
    let e = this.extra.get(id);
    if (!e) { e = makeExtra(); this.extra.set(id, e); }
    return e;
  }

  private schedule(delay: number, fn: () => void): void {
    this.timers.push({ t: delay, fn });
  }

  private purgeFromQueues(id: number): void {
    const rm = (arr: number[]): number[] => arr.filter((x) => x !== id);
    this.beltQueue = rm(this.beltQueue);
    this.elevQueue = rm(this.elevQueue);
    this.topQueue = rm(this.topQueue);
    this.rackWaiting = rm(this.rackWaiting);
    if (this.jamPinId === id) { this.jamPinId = null; this.jamActive = false; }
    if (this.state.orienter.busyPin === id) { this.state.orienter.busyPin = null; this.orientAnim = null; }
    for (let i = 0; i < 10; i++) if (this.state.rack.slots[i] === id) this.state.rack.slots[i] = null;
    if (this.tenthPause && this.tenthPause.pin === id) this.tenthPause = null;
  }

  private updateTimers(dt: number): void {
    if (this.timers.length === 0) return;
    const remain: { t: number; fn: () => void }[] = [];
    for (const tm of this.timers) {
      tm.t -= dt;
      if (tm.t <= 0) tm.fn(); else remain.push(tm);
    }
    this.timers = remain;
  }

  private updateTweens(dt: number): void {
    for (const [id, ex] of this.extra) {
      if (!ex.tween) continue;
      stepTween(ex, this.pinById(id), dt);
    }
  }

  private updateLeverSpring(dt: number): void {
    if (!this.tableLeverSpring) return;
    this.state.tableLever = Math.max(0, this.state.tableLever - dt * 1.2);
    if (this.state.tableLever <= 0.001) { this.state.tableLever = 0; this.tableLeverSpring = false; }
  }

  // ── ボウリング（投球〜ノックダウン） ────────────────────────────────
  private startBowl(dirX: number, power: number, strike: boolean): void {
    this.ballMode = 'bowling';
    this.ballT = 0;
    this.ballDur = bowlDuration(power);
    this.ballDirX = clamp(dirX, -1, 1);
    this.pendingStrike = strike;
    const ball = this.state.ball;
    ball.zone = 'lane';
    ball.t = 0;
    const start = bowlPosition(0, this.ballDirX);
    ball.x = start.x; ball.y = start.y; ball.rot = 0;
    bus.emit('sfx', { id: 'roll' });
  }

  private knockPins(strike: boolean): void {
    const standing = new Set(pickStanding(strike));
    let count = 0;
    for (const p of this.state.pins) {
      if (p.zone !== 'lane' || p.pose !== 'upright') continue;
      if (standing.has(p.slot)) continue;
      p.pose = 'lying';
      p.rot = randRange(-Math.PI, Math.PI);
      p.vx = randRange(-70, 70);
      p.vy = randRange(-40, 20);
      count++;
    }
    bus.emit('sfx', { id: 'pins-crash' });
    bus.emit('camera:shake', { power: strike ? 0.3 : 0.22 });
    bus.emit('pins:down', { count });
    if (strike) bus.emit('strike', {});
  }

  // ── スイープ（倒れたピン→ピット） ──────────────────────────────────
  private updateSweep(dt: number): void {
    const sw = this.state.sweep;
    if (sw.phase === 'sweeping') {
      sw.pos = clamp(sw.pos + dt / 1.1, 0, 1);
      if (sw.pos >= 1) {
        for (const id of this.sweepQueueIds) this.sendToPit(this.pinById(id));
        this.sweepQueueIds = [];
        bus.emit('sfx', { id: 'garagara' });
        bus.emit('camera:shake', { power: 0.18 });
        this.state.belt.run = true;
        sw.phase = 'returning';
      }
    } else if (sw.phase === 'returning') {
      sw.pos = clamp(sw.pos - dt / 0.8, 0, 1);
      if (sw.pos <= 0) { sw.pos = 0; sw.phase = 'idle'; }
    }
  }

  private sendToPit(p: Pin): void {
    const tx = PIT.x + randRange(-PIT.w / 2 + 34, PIT.w / 2 - 34);
    const ty = PIT.y + randRange(-PIT.h / 2 + 22, PIT.h / 2 - 22);
    const rot = randRange(-Math.PI, Math.PI);
    p.zone = 'pit'; p.t = 0; p.slot = -1; p.pose = 'lying';
    p.x = tx; p.y = ty - 60; p.rot = rot * 0.3;
    const ex = this.extraOf(p.id);
    startTween(ex, p, tx, ty, rot, 0.35, easeOutCubic);
    p.vx = randRange(-30, 30);
    p.vy = randRange(-10, 10);
  }

  private updateScatter(dt: number): void {
    for (const p of this.state.pins) {
      if ((p.zone !== 'lane' && p.zone !== 'pit') || p.pose === 'upright') continue;
      if (Math.abs(p.vx) < 0.5 && Math.abs(p.vy) < 0.5) continue;
      const ex = this.extraOf(p.id);
      if (ex.tween) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.86; p.vy *= 0.86;
      if (Math.abs(p.vx) < 0.5) p.vx = 0;
      if (Math.abs(p.vy) < 0.5) p.vy = 0;
    }
  }

  // ── ピット → ベルト自動供給 ─────────────────────────────────────
  private updatePitFeed(): void {
    if (!this.state.belt.run) return;
    for (const p of this.state.pins) {
      if (p.zone !== 'pit') continue;
      if (this.beltQueue.includes(p.id)) continue;
      const ex = this.extraOf(p.id);
      if (ex.tween) continue;
      const last = this.beltQueue.length > 0 ? this.pinById(this.beltQueue[this.beltQueue.length - 1]) : null;
      if (last && last.t < BELT_MIN_GAP_T) continue;
      p.zone = 'belt'; p.t = 0; p.pose = 'lying';
      ex.orientedDone = false;
      this.beltQueue.push(p.id);
      this.positionOnBelt(p);
      break;
    }
  }

  private positionOnBelt(p: Pin): void {
    const pos = pointOnPath(BELT_PATH, p.t);
    p.x = pos.x; p.y = pos.y; p.rot = pos.angle;
  }

  private scheduleStall(delay: number): void {
    if (this.stallScheduled) return;
    this.stallScheduled = true;
    this.schedule(delay, () => this.machineStall());
  }

  private machineStall(): void {
    bus.emit('sfx', { id: 'whirr' });
    this.schedule(0.55, () => bus.emit('sfx', { id: 'sputter' }));
    this.schedule(1.05, () => {
      bus.emit('sfx', { id: 'gata' });
      bus.emit('camera:shake', { power: 0.4 });
      this.state.belt.run = false;
      this.state.elevator.run = false;
      this.state.belt.vibrate = 0;
    });
  }

  private updateBelt(dt: number): void {
    const st = this.state.belt;
    if (st.run && st.derail <= 0) st.offset = (st.offset + dt * 140) % 1000;
    if (st.derail > 0) st.vibrate = Math.max(st.vibrate, 0.5);

    if (this.jamPinId !== null) {
      this.jamTimer += dt;
      st.vibrate = Math.max(st.vibrate, Math.min(1, this.jamTimer / 0.6));
      this.kotoAccum -= dt;
      if (this.kotoAccum <= 0) {
        this.kotoAccum = randRange(0.7, 1.1);
        bus.emit('sfx', { id: 'koto', vol: 0.6 });
      }
    }

    const ids = [...this.beltQueue].sort((a, b) => this.pinById(b).t - this.pinById(a).t);
    for (let i = 0; i < ids.length; i++) {
      const p = this.pinById(ids[i]);
      if (p.stuck) { this.positionOnBelt(p); continue; }
      // pin-jamが未確定の間、先頭の候補ピンは「詰まり形成中」としてrun停止/
      // derail(ベルト空転)の影響を受けず角まで進む。pin-jamはbelt-derailと
      // 同時発生し得るが、derailの修理(belt-trace)はpower-off後のfixステップ
      // でしか行えないため、derailブロックに従うと角に到達するピンが
      // 永遠に現れず、詰まりピンが見つからずゲームが進行不能になっていた
      // (統合バグ: pin-jamとbelt-derailの併発でsoft-lock)。
      // 「壊れた瞬間には既に詰まっていた」という前提で、この1本だけは
      // 常時進行させて確定的にjamを形成する。
      const isJamCandidate = this.jamActive && this.jamPinId === null
        && this.hasUnfixed('pin-jam') && p.t < BELT_CORNER_T;
      if (!isJamCandidate && (!st.run || st.derail > 0)) { this.positionOnBelt(p); continue; }
      const ahead = i > 0 ? this.pinById(ids[i - 1]) : null;
      const jitter = this.extraOf(p.id).speedJitter;
      let nt = p.t + dt * BELT_T_SPEED * jitter;
      if (ahead) nt = Math.min(nt, ahead.t - BELT_MIN_GAP_T);

      if (isJamCandidate && nt >= BELT_CORNER_T) {
        nt = BELT_CORNER_T;
        p.stuck = true;
        this.jamPinId = p.id;
        this.jamTimer = 0;
        this.scheduleStall(2.3);
      }
      nt = clamp(nt, 0, 1);
      p.t = nt;
      if (p.t >= 1 && !p.stuck) {
        this.beltQueue.splice(this.beltQueue.indexOf(p.id), 1);
        this.enterElevator(p);
      } else {
        this.positionOnBelt(p);
      }
    }
  }

  private enterElevator(p: Pin): void {
    p.zone = 'elevator'; p.t = 0;
    this.elevQueue.push(p.id);
    this.positionOnElevator(p);
  }

  private positionOnElevator(p: Pin): void {
    const angle = lerp(ELEV_INTAKE_ANGLE, ELEV_RELEASE_ANGLE, p.t);
    p.x = ELEVATOR.cx + Math.cos(angle) * ELEVATOR.r * 0.9;
    p.y = ELEVATOR.cy + Math.sin(angle) * ELEVATOR.r * 0.9;
    p.rot = angle + Math.PI / 2;
  }

  private updateElevator(dt: number): void {
    const st = this.state.elevator;
    st.run = this.state.belt.run || this.elevQueue.length > 0;
    if (st.run) st.angle = (st.angle + dt * 1.4) % (Math.PI * 2);
    if (!st.run) return;
    const ids = [...this.elevQueue];
    for (const id of ids) {
      const p = this.pinById(id);
      const jitter = this.extraOf(id).speedJitter;
      p.t = clamp(p.t + dt * ELEV_T_SPEED * jitter, 0, 1);
      this.positionOnElevator(p);
      if (p.t >= 1) {
        this.elevQueue = this.elevQueue.filter((x) => x !== id);
        this.enterTop(p);
      }
    }
  }

  private enterTop(p: Pin): void {
    p.zone = 'top'; p.t = 0;
    this.topQueue.push(p.id);
    this.positionOnTop(p);
  }

  private positionOnTop(p: Pin): void {
    const pos = pointOnPath(TOP_PATH, p.t);
    p.x = pos.x; p.y = pos.y;
    p.rot = this.extraOf(p.id).orientedDone ? 0 : pos.angle;
  }

  private updateTop(dt: number): void {
    const guideBlocked = this.hasUnfixed('guide-shift');
    const ids = [...this.topQueue].sort((a, b) => this.pinById(b).t - this.pinById(a).t);
    for (let i = 0; i < ids.length; i++) {
      const p = this.pinById(ids[i]);
      const ex = this.extraOf(p.id);
      if (this.state.orienter.busyPin === p.id) { this.positionOnTop(p); continue; }

      const ahead = i > 0 ? this.pinById(ids[i - 1]) : null;
      let nt = p.t + dt * TOP_T_SPEED * ex.speedJitter;
      if (ahead) nt = Math.min(nt, ahead.t - TOP_MIN_GAP_T);
      let cap = 1;
      if (!ex.orientedDone) {
        cap = ORIENTER_T;
        if (guideBlocked && p.t < ORIENTER_T - 0.02) cap = ORIENTER_T - 0.05;
      }
      nt = clamp(Math.min(nt, cap), 0, 1);
      p.t = nt;

      if (!ex.orientedDone && nt >= ORIENTER_T && this.state.orienter.busyPin === null) {
        this.beginOrient(p);
      } else if (ex.orientedDone && nt >= 1) {
        this.topQueue.splice(this.topQueue.indexOf(p.id), 1);
        this.tryEnterRack(p);
      } else {
        this.positionOnTop(p);
      }
    }
  }

  // ── 選別機（くるん） ────────────────────────────────────────────
  private beginOrient(p: Pin): void {
    this.state.orienter.busyPin = p.id;
    this.orientIdleTimer = 0;
    const willInvert = Math.random() < 0.2;
    if (p.pose !== 'upright') p.pose = willInvert ? 'inverted' : 'lying';
    if (!this.state.testMode) {
      this.schedule(0.3 + Math.random() * 0.25, () => {
        if (this.state.orienter.busyPin === p.id) this.performOrient(p.id, 1, 0.55, 1.0);
      });
    }
  }

  private performOrient(pinId: number, turns: number, dur: number, pitch: number): void {
    const p = this.pinById(pinId);
    const style: OrientStyle = p.pose === 'inverted' ? 'kurun' : p.pose === 'lying' ? 'koron' : 'through';
    this.orientAnim = { pin: pinId, t: 0, dur, turns, fromRot: p.rot, style };
    if (style === 'koron') {
      bus.emit('sfx', { id: 'koron', pitch });
      this.schedule(0.12, () => bus.emit('sfx', { id: 'kurun', pitch }));
    } else if (style === 'kurun') {
      bus.emit('sfx', { id: 'kurun', pitch });
    }
  }

  private updateOrienter(dt: number): void {
    const bp = this.state.orienter.busyPin;
    if (bp === null) return;
    const p = this.pinById(bp);
    const pos = pointOnPath(TOP_PATH, ORIENTER_T);
    if (this.orientAnim && this.orientAnim.pin === bp) {
      const oa = this.orientAnim;
      oa.t += dt;
      const k = clamp(oa.t / oa.dur, 0, 1);
      p.rot = oa.fromRot + oa.turns * Math.PI * 2 * easeOutCubic(k);
      p.x = pos.x; p.y = pos.y;
      if (k >= 1) {
        p.pose = 'upright';
        p.rot = 0;
        this.extraOf(p.id).orientedDone = true;
        this.state.orienter.busyPin = null;
        bus.emit('pin:oriented', { pin: p.id, style: oa.style });
        this.orientAnim = null;
        this.orientIdleTimer = 0;
      }
    } else {
      this.orientIdleTimer += dt;
      p.x = pos.x; p.y = pos.y;
      if (this.freePlayOn && this.orientIdleTimer > 3.5) {
        this.performOrient(bp, 1, 0.5, 1.0);
      }
    }
  }

  // ── ラック格納 ──────────────────────────────────────────────────
  private positionAtRackEntry(p: Pin, offsetIndex = 0): void {
    const pos = pointOnPath(TOP_PATH, 1);
    p.x = pos.x - offsetIndex * 22;
    p.y = pos.y;
    p.rot = 0;
  }

  private tryEnterRack(p: Pin): void {
    const rack = this.state.rack;
    const filled = rack.slots.filter((s) => s !== null).length;
    if (filled >= 10 || rack.stuckGate === filled || this.tenthPause) {
      this.rackWaiting.push(p.id);
      this.positionAtRackEntry(p, this.rackWaiting.length - 1);
      return;
    }
    if (filled === 9) {
      this.tenthPause = { pin: p.id, timer: 0.5 };
      this.positionAtRackEntry(p);
      return;
    }
    this.placeInRack(p, filled);
  }

  private placeInRack(p: Pin, slot: number): void {
    p.zone = 'rack'; p.slot = slot; p.pose = 'upright';
    this.state.rack.slots[slot] = p.id;
    const target = rackSlotPosition(slot);
    startTween(this.extraOf(p.id), p, target.x, target.y, 0, 0.28, easeOutBack);
    bus.emit('sfx', { id: 'kachi' });
    const count = this.state.rack.slots.filter((s) => s !== null).length;
    bus.emit('rack:slot', { slot, count });
    if (count >= 10) {
      bus.emit('rack:full', {});
      if (this.fullRunActive || this.freePlayOn) this.schedule(0.7, () => this.dropTable());
    }
  }

  private updateRack(dt: number): void {
    if (this.tenthPause) {
      this.tenthPause.timer -= dt;
      const p = this.pinById(this.tenthPause.pin);
      this.positionAtRackEntry(p);
      if (this.tenthPause.timer <= 0) {
        const pinId = this.tenthPause.pin;
        this.tenthPause = null;
        this.placeInRack(this.pinById(pinId), 9);
      }
    }
    if (this.rackWaiting.length > 0) {
      const filled = this.state.rack.slots.filter((s) => s !== null).length;
      if (filled < 10 && this.state.rack.stuckGate !== filled && !this.tenthPause) {
        const id = this.rackWaiting[0];
        if (filled === 9) {
          this.tenthPause = { pin: id, timer: 0.5 };
          this.rackWaiting.shift();
        } else {
          this.rackWaiting.shift();
          this.placeInRack(this.pinById(id), filled);
        }
      } else {
        this.rackWaiting.forEach((id, i) => this.positionAtRackEntry(this.pinById(id), i));
      }
    }
  }

  // ── ピンテーブル（ストン） ───────────────────────────────────────
  private positionHeldPins(y: number): void {
    const k = easeInOutQuad(y);
    const yy = lerp(TABLE.yUp, TABLE.yDown, k);
    for (const id of this.state.table.holding) {
      const p = this.pinById(id);
      const { row, col, rowSize } = slotToRowCol(p.slot);
      p.x = TABLE.x + (col - (rowSize - 1) / 2) * 46 + (row - 1.5) * 4;
      p.y = yy;
      p.rot = 0;
    }
  }

  private updateTable(dt: number): void {
    const t = this.state.table;
    if (t.phase === 'descending') {
      t.y = clamp(t.y + dt / 1.5, 0, 1);
      this.positionHeldPins(t.y);
      if (t.y >= 1) {
        t.phase = 'placing';
        this.placeTimer = 0.45;
        for (const id of t.holding) {
          const p = this.pinById(id);
          p.zone = 'placed';
          p.pose = 'upright';
          const target = laneDeckPosition(p.slot);
          p.x = target.x; p.y = target.y; p.rot = 0;
        }
        bus.emit('sfx', { id: 'ston' });
        bus.emit('table:placed', {});
      }
    } else if (t.phase === 'placing') {
      this.placeTimer -= dt;
      if (this.placeTimer <= 0) { t.phase = 'rising'; t.holding = []; }
    } else if (t.phase === 'rising') {
      t.y = clamp(t.y - dt / 1.1, 0, 1);
      if (t.y <= 0) { t.y = 0; t.phase = 'up'; }
    }
  }

  // ── ボール（投球〜リターン） ──────────────────────────────────────
  private positionBall(): void {
    const ball = this.state.ball;
    const pos = pointOnPath(BALL_PATH, ball.t);
    ball.x = pos.x; ball.y = pos.y;
  }

  private updateBall(dt: number): void {
    const ball: Ball = this.state.ball;
    if (this.ballMode === 'bowling') {
      this.ballT += dt;
      const k = clamp(this.ballT / this.ballDur, 0, 1);
      const pos = bowlPosition(k, this.ballDirX);
      ball.x = pos.x; ball.y = pos.y; ball.t = k;
      ball.rot += dt * 14;
      if (k >= 1) {
        this.knockPins(this.pendingStrike);
        this.ballMode = 'toPit';
        this.ballTimer = 0.4;
      }
      return;
    }
    if (this.ballMode === 'toPit') {
      this.ballTimer -= dt;
      if (this.ballTimer <= 0) {
        ball.zone = 'pit';
        ball.x = PIT.x; ball.y = PIT.y + 30; ball.rot = 0;
        this.ballMode = 'returning';
        ball.t = 0;
        this.ballPaused = false;
        bus.emit('sfx', { id: 'roll-under' });
        if (this.fullRunActive) this.schedule(0.5, () => this.startBreakdown([]));
      }
      return;
    }
    if (this.ballMode === 'returning') {
      if (this.ballPaused) return;
      const nt = ball.t + dt * BALL_T_SPEED;
      if (nt >= FLAP_T && this.hasUnfixed('flap-stuck')) {
        ball.t = FLAP_T;
        this.ballPaused = true;
        bus.emit('sfx:stop', { id: 'roll-under' });
        this.positionBall();
        return;
      }
      ball.t = clamp(nt, 0, 1);
      ball.rot += dt * 10;
      this.positionBall();
      if (ball.t >= 1) {
        ball.zone = 'returned';
        ball.t = 0; // render-laneがpop-inイージングの駆動にball.tを再利用するため0から再スタート
        ball.x = BALL_EXIT.x; ball.y = BALL_EXIT.y; ball.rot = 0;
        this.ballMode = 'done';
        bus.emit('sfx:stop', { id: 'roll-under' });
        bus.emit('sfx', { id: 'pon' });
        bus.emit('ball:returned', {});
        this.fullRunActive = false;
      }
      return;
    }
    if (this.ballMode === 'done' && ball.t < 1) {
      ball.t = clamp(ball.t + dt / 0.5, 0, 1);
    }
  }
}
