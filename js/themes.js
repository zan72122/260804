/* =========================================================
   themes.js — 4つの ほしぞら テーマ
   色は 0..1 の [r,g,b]
   ========================================================= */
(function (global) {
  'use strict';

  /* 星形（ひとで・ほし）を作る小道具 */
  function starShape(n, rOut, rIn) {
    var pts = [], edges = [];
    for (var i = 0; i < n * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / n;
      var r = (i % 2 === 0) ? rOut : rIn;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      edges.push([i, (i + 1) % (n * 2)]);
    }
    return { pts: pts, edges: edges };
  }

  function spiralShape(turns, n, r) {
    var pts = [], edges = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var a = t * Math.PI * 2 * turns;
      var rr = r * t;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      if (i > 0) edges.push([i - 1, i]);
    }
    return { pts: pts, edges: edges };
  }

  function fig(name, az, alt, scale, rot, pts, edges) {
    return { name: name, az: az, alt: alt, scale: scale, rot: rot || 0, pts: pts, edges: edges };
  }
  function figS(name, az, alt, scale, rot, shape) {
    return fig(name, az, alt, scale, rot, shape.pts, shape.edges);
  }

  /* ============ どうぶつの星座 ============ */
  var CAT = {
    pts: [[-1.15, 1.75], [-0.9, 0.8], [0.9, 0.8], [1.15, 1.75], [0, 0.05],
          [-0.35, -1.15], [0.55, -1.6], [1.65, -0.75], [-0.55, 0.35], [0.55, 0.35]],
    edges: [[0, 1], [1, 2], [2, 3], [1, 8], [8, 4], [2, 9], [9, 4], [4, 5], [5, 6], [6, 7]]
  };
  var RABBIT = {
    pts: [[-0.55, 2.05], [0.35, 2.15], [-0.3, 0.9], [0.2, 0.95], [-0.05, 0.3],
          [0.15, -0.85], [-0.75, -1.45], [1.0, -1.05]],
    edges: [[0, 2], [2, 4], [1, 3], [3, 4], [4, 5], [5, 6], [5, 7], [2, 3]]
  };
  var BEAR = {
    pts: [[-1.9, 0.35], [-1.05, 0.6], [-0.3, 0.5], [0.4, 0.2], [0.85, -0.4], [1.55, -0.5], [1.95, 0.15]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
  };
  var BIRD = {
    pts: [[0, 0], [-0.95, 0.65], [-2.0, 0.35], [0.95, 0.65], [2.0, 0.35], [0.15, 0.85], [-0.15, -0.95]],
    edges: [[0, 1], [1, 2], [0, 3], [3, 4], [0, 5], [0, 6]]
  };

  /* ============ うみの星空 ============ */
  var DOLPHIN = {
    pts: [[1.7, 0.15], [0.85, 0.55], [0.0, 0.7], [-0.1, 1.25], [-0.85, 0.4],
          [-1.45, 0.1], [-2.0, 0.65], [-2.0, -0.4], [0.2, -0.45], [1.35, -0.2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7], [5, 8], [8, 9], [9, 0]]
  };
  var FISH = {
    pts: [[1.3, 0], [0.25, 0.75], [-0.6, 0.2], [0.25, -0.75], [-1.55, 0.75], [-1.55, -0.75]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [2, 5], [4, 5]]
  };
  var CRAB = {
    pts: [[-0.85, 0.2], [0.85, 0.2], [-1.7, 0.95], [1.7, 0.95], [-1.05, -0.6],
          [-1.7, -1.05], [1.05, -0.6], [1.7, -1.05], [-0.3, 0.85], [0.3, 0.85]],
    edges: [[0, 1], [0, 2], [1, 3], [0, 4], [4, 5], [1, 6], [6, 7], [0, 8], [1, 9], [8, 9]]
  };

  /* ============ にじいろぎんが ============ */
  var BUTTERFLY = {
    pts: [[0, 0.6], [0, -0.7], [-1.5, 1.4], [-1.15, -0.15], [1.5, 1.4], [1.15, -0.15],
          [-0.35, 1.15], [0.35, 1.15]],
    edges: [[0, 1], [0, 2], [2, 3], [3, 1], [0, 4], [4, 5], [5, 1], [0, 6], [0, 7]]
  };
  var CROWN = {
    pts: [[-1.6, -0.6], [1.6, -0.6], [-1.6, 0.4], [-0.8, 1.3], [0, 0.35], [0.8, 1.3], [1.6, 0.4]],
    edges: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]]
  };
  var HEART = (function () {
    var pts = [], edges = [];
    for (var i = 0; i < 18; i++) {
      var t = i / 18 * Math.PI * 2;
      var x = 16 * Math.pow(Math.sin(t), 3) / 13;
      var y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 13;
      pts.push([x * 1.35, y * 1.35]);
      edges.push([i, (i + 1) % 18]);
    }
    return { pts: pts, edges: edges };
  })();

  /* ============ おつきさまとながれぼし ============ */
  var BOAT = {
    pts: [[-1.6, -0.4], [1.6, -0.4], [1.15, -1.1], [-1.15, -1.1], [0, -0.4], [0, 1.5],
          [0, 1.5], [1.25, 0.1], [0, 0.1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 7], [7, 8]]
  };
  var DIPPER = {
    pts: [[-1.9, 0.5], [-1.0, 0.75], [-0.25, 0.55], [0.45, 0.15], [0.9, -0.5], [1.6, -0.55], [1.95, 0.15]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
  };

  var THEMES = [
    {
      id: 'animal',
      name: 'どうぶつの ほしぞら',
      short: 'どうぶつ',
      icon: '🐱',
      seed: 20240401,
      disc: ['#ffd479', '#ff9ec4', '#ffe9b8'],
      accent: '#ffcf6e',
      sky: {
        zenith: [0.015, 0.02, 0.075],
        horizon: [0.09, 0.055, 0.14],
        nebula: [0.55, 0.30, 0.42],
        nebulaAmt: 0.55
      },
      star: {
        count: 2100,
        tints: [[1.0, 0.95, 0.85], [1.0, 0.86, 0.62], [0.98, 0.99, 1.0], [1.0, 0.78, 0.72]]
      },
      mw: { color: [0.95, 0.80, 0.62], intensity: 1.0, tilt: [0.92, 0.16, -0.36] },
      figures: [
        fig('ねこ', 30, 46, 7.2, -8, CAT.pts, CAT.edges),
        fig('うさぎ', 145, 34, 7.4, 6, RABBIT.pts, RABBIT.edges),
        fig('くま', 250, 52, 6.8, 10, BEAR.pts, BEAR.edges),
        fig('ことり', 335, 28, 6.4, -4, BIRD.pts, BIRD.edges)
      ],
      planets: [
        { color: [1.0, 0.72, 0.36], size: 1.0, ring: false, band: 0.5, alt: 22 },
        { color: [0.95, 0.55, 0.55], size: 0.8, ring: false, band: 0.2, alt: 34 },
        { color: [1.0, 0.92, 0.70], size: 1.25, ring: true, band: 0.7, alt: 16 }
      ],
      moon: false,
      shootRate: 0.11,
      floor: [0.30, 0.20, 0.30]
    },

    {
      id: 'sea',
      name: 'うみの ほしぞら',
      short: 'うみ',
      icon: '🐬',
      seed: 77712,
      disc: ['#68e2ff', '#2f7bff', '#bff4ff'],
      accent: '#6fe4ff',
      sky: {
        zenith: [0.005, 0.022, 0.06],
        horizon: [0.02, 0.10, 0.15],
        nebula: [0.20, 0.60, 0.72],
        nebulaAmt: 0.7
      },
      star: {
        count: 2300,
        tints: [[0.80, 0.95, 1.0], [0.62, 0.86, 1.0], [1.0, 1.0, 1.0], [0.55, 1.0, 0.95]]
      },
      mw: { color: [0.55, 0.90, 1.0], intensity: 1.15, tilt: [-0.62, 0.20, 0.76] },
      figures: [
        figS('ひとで', 42, 30, 7.0, 0, starShape(5, 1.5, 0.62)),
        fig('いるか', 150, 48, 6.8, -6, DOLPHIN.pts, DOLPHIN.edges),
        fig('さかな', 255, 32, 7.6, 8, FISH.pts, FISH.edges),
        fig('かに', 330, 44, 7.2, 0, CRAB.pts, CRAB.edges)
      ],
      planets: [
        { color: [0.45, 0.85, 1.0], size: 1.05, ring: false, band: 0.35, alt: 20 },
        { color: [0.35, 0.55, 0.95], size: 0.85, ring: true, band: 0.5, alt: 33 },
        { color: [0.70, 1.0, 0.92], size: 0.95, ring: false, band: 0.15, alt: 14 }
      ],
      moon: false,
      shootRate: 0.13,
      floor: [0.10, 0.28, 0.38]
    },

    {
      id: 'rainbow',
      name: 'にじいろ ぎんが',
      short: 'にじいろ',
      icon: '🌈',
      seed: 31415,
      disc: ['#ff8ad6', '#8affd0', '#ffe98a'],
      accent: '#ff9ee0',
      sky: {
        zenith: [0.035, 0.012, 0.075],
        horizon: [0.10, 0.03, 0.14],
        nebula: [0.75, 0.35, 0.85],
        nebulaAmt: 0.78
      },
      star: {
        count: 2500,
        rainbow: true,
        tints: [[1.0, 0.6, 0.85], [0.65, 0.9, 1.0], [1.0, 0.95, 0.6], [0.7, 1.0, 0.75], [0.85, 0.7, 1.0]]
      },
      mw: { color: [1.0, 0.62, 0.95], intensity: 1.05, tilt: [0.70, 0.13, 0.70], rainbow: true },
      figures: [
        figS('うずまき', 35, 52, 6.6, 0, spiralShape(1.55, 18, 1.9)),
        fig('ちょうちょ', 140, 36, 7.6, 0, BUTTERFLY.pts, BUTTERFLY.edges),
        fig('おうかん', 245, 44, 7.4, 0, CROWN.pts, CROWN.edges),
        figS('ハート', 325, 30, 7.4, 0, HEART)
      ],
      planets: [
        { color: [1.0, 0.55, 0.85], size: 1.0, ring: true, band: 0.6, alt: 24 },
        { color: [0.55, 1.0, 0.85], size: 0.9, ring: false, band: 0.3, alt: 36 },
        { color: [1.0, 0.9, 0.5], size: 1.15, ring: false, band: 0.55, alt: 15 }
      ],
      moon: false,
      shootRate: 0.16,
      floor: [0.35, 0.15, 0.40]
    },

    {
      id: 'moon',
      name: 'おつきさまと ながれぼし',
      short: 'おつきさま',
      icon: '🌙',
      seed: 909090,
      disc: ['#e9f1ff', '#8fa7d8', '#ffffff'],
      accent: '#cfe0ff',
      sky: {
        zenith: [0.008, 0.012, 0.045],
        horizon: [0.045, 0.06, 0.13],
        nebula: [0.35, 0.42, 0.70],
        nebulaAmt: 0.45
      },
      star: {
        count: 1900,
        tints: [[1.0, 1.0, 1.0], [0.85, 0.90, 1.0], [1.0, 0.97, 0.88], [0.72, 0.82, 1.0]]
      },
      mw: { color: [0.72, 0.80, 1.0], intensity: 0.95, tilt: [0.34, 0.18, 0.92] },
      figures: [
        figS('おおきなほし', 40, 40, 7.4, 0, starShape(5, 1.55, 0.6)),
        fig('ふね', 145, 32, 7.6, 0, BOAT.pts, BOAT.edges),
        fig('ひしゃく', 250, 50, 6.8, -8, DIPPER.pts, DIPPER.edges),
        figS('こぼし', 330, 26, 5.4, 18, starShape(5, 1.5, 0.6))
      ],
      planets: [
        { color: [0.90, 0.92, 1.0], size: 0.9, ring: false, band: 0.2, alt: 20 },
        { color: [1.0, 0.85, 0.65], size: 0.85, ring: true, band: 0.45, alt: 32 },
        { color: [0.70, 0.78, 1.0], size: 1.0, ring: false, band: 0.25, alt: 13 }
      ],
      moon: true,
      shootRate: 0.42,
      floor: [0.16, 0.20, 0.34]
    }
  ];

  global.THEMES = THEMES;
})(window);
