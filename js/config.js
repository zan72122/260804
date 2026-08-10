// NCFG — 共有定数（ディレクター所有）。全モジュールはここから読む。
(function () {
  'use strict';
  window.NCFG = {
    // 色テーマ（キャンディ型スウォッチ = swatch）
    THEMES: [
      { id: 'sakura',  name: 'さくら',  base: '#f6b8c8', deep: '#e88aa6', tip: '#fdeef3', shibe: '#f4cf6a', swatch: '#f2a7bd' },
      { id: 'shiro',   name: 'しろもも', base: '#f9eef0', deep: '#f0c6cf', tip: '#ffffff', shibe: '#f4cf6a', swatch: '#f7e6e9' },
      { id: 'fuji',    name: 'ふじ',    base: '#cdb6e2', deep: '#a98cc9', tip: '#efe6f8', shibe: '#f6d97e', swatch: '#bfa3da' },
      { id: 'tanpopo', name: 'たんぽぽ', base: '#f7dfa0', deep: '#eec46a', tip: '#fdf5df', shibe: '#e8a24a', swatch: '#f3d78e' },
    ],
    // リング定義: 外→内。r=花びら中心半径(world), n=花びら数, offset=角度オフセット(rad)
    RINGS: [
      { r: 0.78, n: 10, offset: 0 },
      { r: 0.46, n: 7, offset: 0.3 },
    ],
    CENTER_TAPS: 3,
    ANCHOR_ANGLE: Math.PI / 2, // 次スロットをここ(画面下)へ回す
    TIMING: {
      liftSec: 0.55,     // 花びら立ち上がり時間
      rotEase: 4.5,      // 回転イージング係数(1/s)
      cutCooldown: 0.18, // 連続カット最小間隔(s)
      finishSec: 1.4,    // flower:complete → reveal までの秒数
      revealSec: 1.6,    // revealT が 0→1 になる秒数
    },
    CAMERA: {
      zoomByStage: [1.0, 1.12, 1.24], // activeRing 0/1/2
      zoomReveal: 0.82,
      ease: 3.0,
      // 練り切り中心: 画面中央から上へのオフセット(短辺比)
      centerYShift: -0.04,
      // scale = min(w,h) * baseScale * zoom (px per world unit)
      baseScale: 0.30,
    },
    AUDIO: { masterGain: 0.35 },
  };
})();
