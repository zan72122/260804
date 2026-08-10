// input — 一指タッチ入力 → core 呼び出し（Agent-INPUT 所有）
(function () {
  'use strict';

  var DRAG_THRESHOLD = 28; // px (CSS)

  function init(canvas, game) {
    if (!canvas) return;

    var activePointerId = null;
    var audioUnlocked = false;
    var lastPoint = null; // {x, y} CSS px of last successful cut (or initial down point)

    function emitAudioUnlockOnce() {
      if (audioUnlocked) return;
      audioUnlocked = true;
      try {
        if (window.NBus && typeof window.NBus.emit === 'function') {
          window.NBus.emit('audio:unlock', {});
        }
      } catch (e) {
        console.error('audio:unlock emit error', e);
      }
    }

    function toLocal(x, y) {
      try {
        if (window.NerikiriRender && typeof window.NerikiriRender.screenToLocal === 'function') {
          return window.NerikiriRender.screenToLocal(x, y);
        }
      } catch (e) {
        console.error('screenToLocal error', e);
      }
      return null;
    }

    function doTap(x, y) {
      var local = toLocal(x, y);
      if (!local) return false;
      try {
        if (game && typeof game.tapAt === 'function') {
          return !!game.tapAt(local.angle, local.radius, x, y);
        }
      } catch (e) {
        console.error('tapAt error', e);
      }
      return false;
    }

    function clientToCanvasPoint(evt) {
      var rect;
      try {
        rect = canvas.getBoundingClientRect();
      } catch (e) {
        rect = { left: 0, top: 0 };
      }
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    function onPointerDown(evt) {
      if (activePointerId !== null) return; // 2本目以降は無視
      if (evt.pointerType === 'mouse' && evt.button !== undefined && evt.button !== 0) return;

      activePointerId = evt.pointerId;

      try {
        if (canvas.setPointerCapture) canvas.setPointerCapture(evt.pointerId);
      } catch (e) {
        // 無視（対応外環境）
      }

      emitAudioUnlockOnce();

      var pt = clientToCanvasPoint(evt);
      var success = doTap(pt.x, pt.y);
      lastPoint = success ? pt : pt; // 未成立でも次のドラッグ間引き基準は down 地点

      if (evt.cancelable) {
        try { evt.preventDefault(); } catch (e) {}
      }
    }

    function onPointerMove(evt) {
      if (activePointerId === null || evt.pointerId !== activePointerId) return;
      // 押下中のみ反応（ボタン押下チェック。pointerdown後capture済みなのでbuttons確認）
      if (evt.buttons === 0) return;

      var pt = clientToCanvasPoint(evt);
      if (!lastPoint) {
        lastPoint = pt;
        return;
      }
      var dx = pt.x - lastPoint.x;
      var dy = pt.y - lastPoint.y;
      var distSq = dx * dx + dy * dy;
      if (distSq >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        var success = doTap(pt.x, pt.y);
        if (success) {
          lastPoint = pt;
        }
      }

      if (evt.cancelable) {
        try { evt.preventDefault(); } catch (e) {}
      }
    }

    function endPointer(evt) {
      if (activePointerId === null || evt.pointerId !== activePointerId) return;
      try {
        if (canvas.releasePointerCapture) canvas.releasePointerCapture(evt.pointerId);
      } catch (e) {}
      activePointerId = null;
      lastPoint = null;
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    // iOS Safari 対策: スクロール・ダブルタップズーム・長押しメニュー抑止
    function preventTouch(evt) {
      if (evt.cancelable) {
        try { evt.preventDefault(); } catch (e) {}
      }
    }
    canvas.addEventListener('touchstart', preventTouch, { passive: false });
    canvas.addEventListener('touchmove', preventTouch, { passive: false });
    canvas.addEventListener('gesturestart', preventTouch, { passive: false });
    canvas.addEventListener('contextmenu', function (evt) {
      evt.preventDefault();
    });
  }

  window.NerikiriInput = { init: init };
})();
