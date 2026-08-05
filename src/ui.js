/**
 * がめんの うえに かさねる ぶぶん（HUD・オノマトペ・ゆびヒント）
 */
import * as THREE from 'three';

export class UI {
  constructor(camera) {
    this.camera = camera;
    this.popups = document.getElementById('popups');
    this.hud = document.getElementById('hud');
    this.taskIcon = document.getElementById('taskIcon');
    this.taskText = document.getElementById('taskText');
    this.meterFill = document.getElementById('meterFill');
    this.meterIcon = document.getElementById('meterIcon');
    this.hint = document.getElementById('hint');
    this.startScreen = document.getElementById('start');
    this.clearScreen = document.getElementById('clear');
    this.soundBtn = document.getElementById('soundBtn');

    this._v = new THREE.Vector3();
    this.hintWorld = null;
    this._lastTask = '';
    // キャンバスの じっさいの おおきさ（iOS の アドレスバー たいさく）
    this.view = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  setViewport(rect) { this.view = rect; }

  worldToScreen(p) {
    this._v.copy(p).project(this.camera);
    const v = this.view;
    return {
      x: v.x + (this._v.x * 0.5 + 0.5) * v.w,
      y: v.y + (-this._v.y * 0.5 + 0.5) * v.h,
      visible: this._v.z < 1,
    };
  }

  setTask(icon, text) {
    if (this._lastTask === icon + text) return;
    this._lastTask = icon + text;
    this.taskIcon.textContent = icon;
    this.taskText.textContent = text;
    const card = document.getElementById('task');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }

  setMeter(fraction, icon) {
    this.meterFill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    if (icon) this.meterIcon.textContent = icon;
  }

  showHud(on = true) { this.hud.classList.toggle('hidden', !on); this.soundBtn.classList.toggle('hidden', !on); }

  /** オノマトペを だす */
  popup(text, worldPos, cls = '') {
    const s = this.worldToScreen(worldPos);
    if (!s.visible) return;
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    this.popups.appendChild(el);
    setTimeout(() => el.remove(), 1250);
  }

  showHintAt(worldPos) {
    this.hintWorld = worldPos;
    this.hint.classList.remove('hidden');
  }
  hideHint() {
    this.hintWorld = null;
    this.hint.classList.add('hidden');
  }
  updateHint() {
    if (!this.hintWorld) return;
    const s = this.worldToScreen(this.hintWorld);
    if (!s.visible) { this.hint.style.opacity = '0'; return; }
    this.hint.style.opacity = '1';
    this.hint.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
  }

  hideOverlay(el, cb) {
    el.classList.add('out');
    setTimeout(() => { el.classList.add('hidden'); el.classList.remove('out'); if (cb) cb(); }, 400);
  }
  showOverlay(el) { el.classList.remove('hidden', 'out'); }
}
