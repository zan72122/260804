/**
 * 画面まわりの表示。
 * 文字は全部ひらがな。押せるものは大きく、押せないものは何も置かない。
 */
import * as THREE from 'three';
import { STEPS } from '../game/game.js';
import { clamp } from '../core/util.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('ui');
    this.taskCard = document.getElementById('task-card');
    this.taskIcon = document.getElementById('task-icon');
    this.taskText = document.getElementById('task-text');
    this.stepsEl = document.getElementById('steps');
    this.finger = document.getElementById('finger');
    this.titleScreen = document.getElementById('title');
    this.clearScreen = document.getElementById('clear');
    this.hudEl = document.getElementById('hud');

    this.stepEls = [];
    for (let i = 0; i < STEPS.length; i++) {
      const el = document.createElement('div');
      el.className = 'step';
      el.innerHTML = `<span class="step-fill"></span><span class="step-icon">${STEPS[i].icon}</span>`;
      this.stepsEl.appendChild(el);
      this.stepEls.push(el);
    }

    this._v = new THREE.Vector3();
    this._fingerShown = false;
  }

  showHud() {
    this.hudEl.classList.remove('hidden');
  }

  setTask(index, task) {
    this.taskIcon.textContent = task.icon;
    this.taskText.textContent = task.text;
    this.taskCard.classList.remove('pop');
    // リフローを挟んでアニメーションを再生し直す
    void this.taskCard.offsetWidth;
    this.taskCard.classList.add('pop');
    this.stepEls.forEach((el, i) => {
      el.classList.toggle('current', i === index);
      el.classList.toggle('done', index < 0 || i < index);
    });
  }

  setProgress(index, p) {
    const v = clamp(p, 0, 1);
    this.stepEls.forEach((el, i) => {
      const fill = i < index || index < 0 ? 1 : i === index ? v : 0;
      el.style.setProperty('--p', fill.toFixed(3));
      if (fill >= 0.999) el.classList.add('done');
    });
  }

  showFinger(worldPos, camera, urgency = 1) {
    this._v.copy(worldPos).project(camera);
    if (this._v.z > 1) { this.hideFinger(); return; }
    const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    this.finger.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    this.finger.style.opacity = (0.35 + urgency * 0.65).toFixed(2);
    if (!this._fingerShown) {
      this.finger.classList.add('on');
      this._fingerShown = true;
    }
  }

  hideFinger() {
    if (this._fingerShown) {
      this.finger.classList.remove('on');
      // showFinger でインラインの opacity を書いているので、こちらも上書きする
      this.finger.style.opacity = '0';
      this._fingerShown = false;
    }
  }

  showTitle() {
    this.titleScreen.classList.remove('gone');
    this.clearScreen.classList.add('gone');
    this.hudEl.classList.add('hidden');
  }

  hideTitle() {
    this.titleScreen.classList.add('gone');
  }

  showClear() {
    this.clearScreen.classList.remove('gone');
  }

  hideClear() {
    this.clearScreen.classList.add('gone');
  }
}
