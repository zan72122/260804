/**
 * input.js — 4歳児向けの寛容なジェスチャ検出。
 * 使う操作は4種類だけ：タップ / スワイプ / ぐるぐる円運動 / 長押し。
 * 「正しくできない」ことがないよう、どの入力にも必ず前進の手ごたえを返す。
 */
export function createInput(el) {
  const st = {
    active: false, id: null,
    x: 0, y: 0, px: 0, py: 0, sx: 0, sy: 0,
    downAt: 0, moved: 0,
    dragAcc: 0,          // 累積ドラッグ距離(px)
    turnAcc: 0,          // 累積回転(rad)
    rawAcc: 0,           // 累積移動(px) …直線的にこすっても進むための保険
    speed: 0,            // 平滑化した指の速さ(px/s)
    holdT: 0,            // 押しっぱなしの時間(s)
    tapPending: false,
    idle: 0,             // 何も触っていない時間(s)
    cx: 0, cy: 0, prevAng: null, hasCentre: false,
    everTouched: false,
  };

  const norm = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e) {
    if (st.active) return;
    const p = norm(e);
    st.active = true; st.id = e.pointerId;
    st.x = st.px = st.sx = p.x; st.y = st.py = st.sy = p.y;
    st.downAt = performance.now(); st.moved = 0; st.holdT = 0;
    st.cx = p.x; st.cy = p.y; st.prevAng = null; st.hasCentre = true;
    st.idle = 0; st.everTouched = true;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function move(e) {
    if (!st.active || e.pointerId !== st.id) return;
    const p = norm(e);
    const dx = p.x - st.px, dy = p.y - st.py;
    const d = Math.hypot(dx, dy);
    if (d <= 0.01) return;
    st.x = p.x; st.y = p.y;
    st.moved += d;
    st.dragAcc += d;
    st.rawAcc += d;
    st.idle = 0;

    // 回転量：ゆっくり追従する中心のまわりの角度を積算する
    st.cx += (p.x - st.cx) * 0.055;
    st.cy += (p.y - st.cy) * 0.055;
    const rx = p.x - st.cx, ry = p.y - st.cy;
    const r = Math.hypot(rx, ry);
    if (r > 14) {
      const ang = Math.atan2(ry, rx);
      if (st.prevAng !== null) {
        let da = ang - st.prevAng;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 1.1) st.turnAcc += Math.abs(da) * Math.min(1, r / 55);
      }
      st.prevAng = ang;
    }
    st.px = p.x; st.py = p.y;
  }

  function up(e) {
    if (!st.active || (e.pointerId !== st.id && e.type !== 'pointercancel')) return;
    const dur = performance.now() - st.downAt;
    if (st.moved < 16 && dur < 420) st.tapPending = true;
    st.active = false; st.id = null; st.prevAng = null; st.holdT = 0;
  }

  el.addEventListener('pointerdown', down, { passive: true });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerup', up, { passive: true });
  el.addEventListener('pointercancel', up, { passive: true });
  el.addEventListener('pointerleave', up, { passive: true });
  // iOS のスクロール／バウンスを止める
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  el.addEventListener('touchmove', stop, { passive: false });
  el.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });

  let lastT = performance.now();
  const api = {
    state: st,
    /** 毎フレーム先頭で呼ぶ */
    tick(dt) {
      if (st.active) st.holdT += dt; else st.idle += dt;
      const inst = dt > 0 ? st.dragAcc / dt : 0;
      st.speed += (inst - st.speed) * Math.min(1, dt * 12);
    },
    /** 蓄積した回転量(回転数)を取り出してリセット */
    takeTurns() { const v = st.turnAcc / (Math.PI * 2); st.turnAcc = 0; return v; },
    takeDrag() { const v = st.dragAcc; st.dragAcc = 0; return v; },
    takeRaw() { const v = st.rawAcc; st.rawAcc = 0; return v; },
    takeTap() { const v = st.tapPending; st.tapPending = false; return v; },
    clear() { st.turnAcc = 0; st.dragAcc = 0; st.rawAcc = 0; st.tapPending = false; st.idle = 0; },
    get holding() { return st.active; },
    get holdT() { return st.holdT; },
    get idle() { return st.idle; },
    get speed() { return st.speed; },
    get pos() { return { x: st.x, y: st.y }; },
  };
  return api;
}
