/* ------------------------------------------------------------------
   geo.js — 実寸ジオメトリの生成（単位はメートル）
   板・箱・アーチ・ドーム・ピール・器など、厚みと重さを持つ形を作る。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const G = (PZ.geo = {});
  const TAU = Math.PI * 2;

  /* アーチ（半円頭）の輪郭 */
  G.archPath = function (w, h) {
    const r = w / 2;
    const p = new THREE.Path();
    p.moveTo(-r, 0);
    p.lineTo(-r, h - r);
    p.absarc(0, h - r, r, Math.PI, 0, true);
    p.lineTo(r, 0);
    p.lineTo(-r, 0);
    return p;
  };

  G.archShape = function (w, h) {
    const r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(-r, 0);
    s.lineTo(-r, h - r);
    s.absarc(0, h - r, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.lineTo(-r, 0);
    return s;
  };

  /* 角の丸い矩形シェイプ */
  G.roundShape = function (w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };

  /* 穴あきの厚い壁。outer が 'arch' なら外形も半円頭にする。
     形の原点は「床の高さ」＝ y=0 に置く。 */
  G.holedWall = function (opt) {
    const outer = opt.outerArch
      ? G.archShape(opt.w, opt.h)
      : (function () {
        const s = G.roundShape(opt.w, opt.h, 0.03);
        s.getPoints(); return s;
      })();
    if (!opt.outerArch) {
      // roundShape は中心原点なので、床基準に移す
      const pts = outer.getPoints(48);
      const s2 = new THREE.Shape();
      pts.forEach((p, i) => { const y = p.y + opt.h / 2; if (i === 0) s2.moveTo(p.x, y); else s2.lineTo(p.x, y); });
      s2.closePath();
      outer.curves = s2.curves;
    }
    const hole = G.archPath(opt.holeW, opt.holeH);
    const hp = new THREE.Path();
    hole.getPoints(56).forEach((p, i) => {
      const y = p.y + (opt.holeY || 0);
      if (i === 0) hp.moveTo(p.x, y); else hp.lineTo(p.x, y);
    });
    hp.closePath();
    outer.holes.push(hp);
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: opt.thick, bevelEnabled: true, bevelThickness: 0.010,
      bevelSize: 0.010, bevelSegments: 2, curveSegments: 28
    });
    g.computeVertexNormals();
    return g;
  };

  /* 窯口をぐるりと囲むレンガのアーチ帯 */
  G.archBand = function (innerW, innerH, band, thick) {
    const outer = G.archShape(innerW + band * 2, innerH + band);
    const hole = G.archPath(innerW, innerH);
    const hp = new THREE.Path();
    hole.getPoints(56).forEach((p, i) => {
      if (i === 0) hp.moveTo(p.x, p.y); else hp.lineTo(p.x, p.y);
    });
    hp.closePath();
    outer.holes.push(hp);
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: thick, bevelEnabled: true, bevelThickness: 0.012,
      bevelSize: 0.014, bevelSegments: 2, curveSegments: 28
    });
    g.computeVertexNormals();
    return g;
  };

  /* 面取りした箱 */
  G.box = function (w, h, d, r) {
    const s = G.roundShape(w, h, r || 0.02);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: d, bevelEnabled: true, bevelThickness: 0.008,
      bevelSize: 0.008, bevelSegments: 2, curveSegments: 6
    });
    g.translate(0, 0, -d / 2);
    g.computeVertexNormals();
    return g;
  };

  /* ドーム（半球の殻）。inside=true で内側を向く */
  G.dome = function (r, inside, squash) {
    const g = new THREE.SphereGeometry(r, 48, 24, 0, TAU, 0, Math.PI / 2);
    if (squash) g.scale(1, squash, 1);
    if (inside) g.scale(-1, 1, 1);
    g.computeVertexNormals();
    return g;
  };

  /* ピールのブレード（先が薄く、手元が厚い） */
  G.peelBlade = function (r, thick) {
    const s = new THREE.Shape();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI;    // 前半分（丸い先端）
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.lineTo(-r * 0.30, r);
    s.lineTo(-r * 1.05, r * 0.42);
    s.lineTo(-r * 1.05, -r * 0.42);
    s.lineTo(-r * 0.30, -r);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45,
      bevelSize: thick * 0.9, bevelSegments: 2, curveSegments: 16
    });
    g.rotateX(-Math.PI / 2);      // 水平に寝かせる
    g.translate(0, -thick / 2, 0);
    g.computeVertexNormals();
    return g;
  };

  /* 器（ろくろ回し） */
  G.bowl = function (rTop, rBase, h, inside) {
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = U.lerp(rBase, rTop, Math.pow(t, 0.62));
      pts.push(new THREE.Vector2(r, t * h));
    }
    pts.push(new THREE.Vector2(rTop - 0.006, h));
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const r = U.lerp(rBase, rTop, Math.pow(t, 0.62)) - 0.008;
      pts.push(new THREE.Vector2(Math.max(0.001, r), t * h + 0.006));
    }
    const g = new THREE.LatheGeometry(pts, 40);
    g.computeVertexNormals();
    return g;
  };

  /* 皿 */
  G.plate = function (r, h) {
    const pts = [];
    pts.push(new THREE.Vector2(0, 0));
    pts.push(new THREE.Vector2(r * 0.62, 0));
    pts.push(new THREE.Vector2(r * 0.86, h * 0.42));
    pts.push(new THREE.Vector2(r, h));
    pts.push(new THREE.Vector2(r * 0.99, h * 1.12));
    pts.push(new THREE.Vector2(r * 0.82, h * 0.62));
    pts.push(new THREE.Vector2(r * 0.55, h * 0.16));
    pts.push(new THREE.Vector2(0, h * 0.14));
    const g = new THREE.LatheGeometry(pts, 44);
    g.computeVertexNormals();
    return g;
  };

  /* 粉袋（ゆがんだ布） */
  G.sack = function (w, h, d) {
    const g = new THREE.CylinderGeometry(w * 0.52, w * 0.6, h, 14, 6);
    const p = g.attributes.position;
    const nf = U.mulberry32(5);
    const seed = [];
    for (let i = 0; i < 40; i++) seed.push(nf());
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 5 + y * 9) * 0.05 + Math.sin(a * 3 - y * 4) * 0.04;
      const taper = y > h * 0.3 ? 1 - (y / h - 0.3) * 0.5 : 1;
      p.setX(i, x * k * taper);
      p.setZ(i, z * k * taper * (d / w));
    }
    g.computeVertexNormals();
    return g;
  };

  /* 薪（少しいびつな円柱） */
  G.log = function (r, len, seed) {
    const g = new THREE.CylinderGeometry(r, r * 0.92, len, 9, 3);
    const rn = U.mulberry32(seed || 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.9 + rn() * 0.2;
      p.setX(i, x * k); p.setZ(i, z * k);
      p.setY(i, y + (rn() - 0.5) * len * 0.03);
    }
    g.rotateZ(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  };

  /* 具材の形 */
  G.topping = function (type) {
    let g;
    switch (type) {
      case 'cheese':
        g = new THREE.SphereGeometry(0.5, 12, 8);
        g.scale(1, 0.55, 1);
        break;
      case 'tomato':
        g = new THREE.CylinderGeometry(0.5, 0.48, 0.24, 20, 1);
        break;
      case 'basil': {
        const s = new THREE.Shape();
        s.moveTo(0, -0.55);
        s.bezierCurveTo(0.42, -0.3, 0.4, 0.34, 0, 0.58);
        s.bezierCurveTo(-0.4, 0.34, -0.42, -0.3, 0, -0.55);
        g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 10 });
        g.rotateX(-Math.PI / 2);
        // 葉を少し反らせる
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          p.setY(i, p.getY(i) + (x * x + z * z * 0.4) * 0.5);
        }
        g.computeVertexNormals();
        break;
      }
      case 'corn':
        g = new THREE.SphereGeometry(0.5, 10, 7);
        g.scale(1, 0.7, 0.72);
        break;
      case 'olive':
        g = new THREE.TorusGeometry(0.34, 0.17, 8, 16);
        g.rotateX(Math.PI / 2);
        break;
      case 'broccoli': {
        g = new THREE.SphereGeometry(0.5, 10, 8);
        const p = g.attributes.position;
        const rn = U.mulberry32(9);
        for (let i = 0; i < p.count; i++) {
          const k = 0.82 + rn() * 0.36;
          p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k * 0.8); p.setZ(i, p.getZ(i) * k);
        }
        g.computeVertexNormals();
        break;
      }
      case 'mushroom':
        g = new THREE.SphereGeometry(0.5, 12, 8, 0, TAU, 0, Math.PI * 0.55);
        g.scale(1, 0.8, 1);
        break;
      default: // pepper 類：輪切り
        g = new THREE.TorusGeometry(0.36, 0.13, 8, 18);
        g.rotateX(Math.PI / 2);
        g.scale(1, 0.8, 1);
    }
    g.computeVertexNormals();
    return g;
  };

  /* 案内用の矢羽根 */
  G.chevron = function (w, l, t) {
    const s = new THREE.Shape();
    s.moveTo(0, l * 0.5);
    s.lineTo(w * 0.5, -l * 0.1);
    s.lineTo(w * 0.5 - t, -l * 0.5);
    s.lineTo(0, l * 0.1);
    s.lineTo(-w * 0.5 + t, -l * 0.5);
    s.lineTo(-w * 0.5, -l * 0.1);
    s.closePath();
    const g = new THREE.ShapeGeometry(s, 4);
    g.rotateX(-Math.PI / 2);
    return g;
  };

})();
