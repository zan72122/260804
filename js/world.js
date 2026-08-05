// ------------------------------------------------------------------
// world.js — builds the whole cinema: auditorium, screen, curtains,
// seats, projection booth, projector machine, speakers, lights.
// Real-world-ish proportions (meters). Returns refs used by main.js.
// ------------------------------------------------------------------
import * as THREE from '../vendor/three.module.min.js';

// ---------- canvas texture helpers --------------------------------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

function carpetTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a1f2b'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = Math.random();
      ctx.fillStyle = v < 0.5 ? '#4e1a25' : (v < 0.85 ? '#68283580' : '#7c303f66');
      ctx.fillRect(Math.random() * w, Math.random() * h, 2.5, 2.5);
    }
    ctx.strokeStyle = '#7a2f3d55'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(w * Math.random(), h * Math.random(), 40 + Math.random() * 40, 0, 7);
      ctx.stroke();
    }
  }, [8, 12]);
}

function wallTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3b2a4d'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#35254644' : '#44315944';
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    // subtle vertical panel seams
    ctx.strokeStyle = '#2e2140'; ctx.lineWidth = 4;
    for (let x = 0; x <= w; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  }, [6, 3]);
}

function curtainTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 16; i++) {
      const c = i % 2 === 0 ? '#8e1b2f' : '#6d1122';
      g.addColorStop(i / 16, c);
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { // velvet speckle
      ctx.fillStyle = Math.random() < 0.5 ? '#5e0e1d33' : '#a52a4033';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 6);
    }
  }, [3, 2]);
}

function grillTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#241d29'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0e0b12';
    for (let y = 4; y < h; y += 10)
      for (let x = 4; x < w; x += 10) {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      }
  }, [2, 2]);
}

function reelLabelTexture(theme) {
  return canvasTex(256, 256, (ctx, w, h) => {
    const bg = { ocean: '#1d9de0', meadow: '#4cae3e', space: '#7b47d6' }[theme];
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff22';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(w / 2, h / 2);
    if (theme === 'ocean') { // fish
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(6, 0, 52, 32, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-78, -30); ctx.lineTo(-78, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(32, -8, 7, 0, 7); ctx.fill();
    } else if (theme === 'meadow') { // flower
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 38, Math.sin(a) * 38, 26, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
    } else { // star
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 70 : 30;
        const a = i / 10 * Math.PI * 2 - Math.PI / 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  });
}

function blobShadowTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

function posterTexture(kind) {
  return canvasTex(128, 192, (ctx, w, h) => {
    const bgs = ['#ffb339', '#37c97e', '#7b8bff'];
    ctx.fillStyle = bgs[kind % 3]; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    if (kind % 3 === 0) { ctx.beginPath(); ctx.arc(w / 2, h * 0.4, 30, 0, 7); ctx.fill(); ctx.fillRect(20, h * 0.68, w - 40, 12); }
    if (kind % 3 === 1) { ctx.beginPath(); ctx.moveTo(w / 2, 30); ctx.lineTo(w - 20, h - 50); ctx.lineTo(20, h - 50); ctx.closePath(); ctx.fill(); }
    if (kind % 3 === 2) { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(30 + i * 34, h * 0.4 + i * 26, 16, 0, 7); ctx.fill(); } }
    ctx.strokeStyle = '#00000033'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  });
}

// dirt overlay for the lens — smudges get erased by rubbing
function makeDirtCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const x = 40 + Math.random() * 176, y = 40 + Math.random() * 176;
    const r = 16 + Math.random() * 30;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const tone = Math.random() < 0.5 ? '120,100,80' : '90,90,100';
    g.addColorStop(0, `rgba(${tone},0.85)`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // fingerprints: little arc clusters
  for (let i = 0; i < 5; i++) {
    const x = 60 + Math.random() * 136, y = 60 + Math.random() * 136;
    ctx.strokeStyle = 'rgba(100,90,85,0.5)'; ctx.lineWidth = 2;
    for (let rr = 4; rr < 18; rr += 4) {
      ctx.beginPath(); ctx.arc(x, y, rr, Math.random(), 2 + Math.random() * 3); ctx.stroke();
    }
  }
  return c;
}

// ---------- shared materials --------------------------------------
const M = {};
function initMaterials() {
  M.metalTeal = new THREE.MeshStandardMaterial({ color: 0x2e6b6a, roughness: 0.42, metalness: 0.75 });
  M.metalDark = new THREE.MeshStandardMaterial({ color: 0x30323c, roughness: 0.5, metalness: 0.8 });
  M.metalGold = new THREE.MeshStandardMaterial({ color: 0xc9a34a, roughness: 0.35, metalness: 0.9 });
  M.metalSilver = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.3, metalness: 0.9 });
  M.reelSteel = new THREE.MeshStandardMaterial({ color: 0x7d8791, roughness: 0.35, metalness: 0.85 });
  M.film = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide });
  M.woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 0.8 });
  M.seatRed = new THREE.MeshStandardMaterial({ color: 0xa32638, roughness: 0.85 });
  M.seatRedDark = new THREE.MeshStandardMaterial({ color: 0x7e1c2b, roughness: 0.9 });
  M.plastic = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
}

export function buildWorld(scene) {
  initMaterials();
  const refs = { interactive: {}, anim: {} };
  const shadowTex = blobShadowTexture();
  const blob = (r, x, y, z, opacity = 1) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2, r * 2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    scene.add(m);
    return m;
  };

  // ================= ROOM =================
  const ROOM_W = 16, ROOM_H = 8, Z_SCREEN = -15.5, Z_BACK = 11;
  const carpet = carpetTexture(), wallTex = wallTexture();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, Z_BACK - Z_SCREEN),
    new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (Z_BACK + Z_SCREEN) / 2);
  scene.add(floor);

  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m); return m;
  };
  mkWall(ROOM_W, ROOM_H, 0, ROOM_H / 2, Z_SCREEN, 0);                       // front (screen) wall
  mkWall(ROOM_W, ROOM_H, 0, ROOM_H / 2, Z_BACK, Math.PI);                   // back wall
  mkWall(Z_BACK - Z_SCREEN, ROOM_H, -ROOM_W / 2, ROOM_H / 2, (Z_BACK + Z_SCREEN) / 2, Math.PI / 2);
  mkWall(Z_BACK - Z_SCREEN, ROOM_H, ROOM_W / 2, ROOM_H / 2, (Z_BACK + Z_SCREEN) / 2, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, Z_BACK - Z_SCREEN),
    new THREE.MeshStandardMaterial({ color: 0x241a30, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM_H, (Z_BACK + Z_SCREEN) / 2);
  scene.add(ceil);

  // wall posters with little frames (depth cue along the side walls)
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      const z = -10 + i * 6;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 1.4), M.metalGold);
      frame.position.set(s * (ROOM_W / 2 - 0.05), 4.4, z);
      scene.add(frame);
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8),
        new THREE.MeshStandardMaterial({ map: posterTexture(i + (s > 0 ? 1 : 0)), roughness: 0.9 }));
      poster.position.set(s * (ROOM_W / 2 - 0.11), 4.4, z);
      poster.rotation.y = -s * Math.PI / 2;
      scene.add(poster);
    }
  }

  // ================= STAGE + SCREEN =================
  const stage = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.5, 2.6), M.woodDark);
  stage.position.set(0, 0.25, Z_SCREEN + 1.3);
  scene.add(stage);
  // stage front edge trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.06, 0.06), M.metalGold);
  trim.position.set(0, 0.53, Z_SCREEN + 2.6);
  scene.add(trim);

  const SCREEN_W = 10, SCREEN_H = 5.6, SCREEN_Y = 3.6, Z_SCR = Z_SCREEN + 0.25;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.5, SCREEN_H + 0.5, 0.18), M.metalDark);
  frame.position.set(0, SCREEN_Y, Z_SCR - 0.06);
  scene.add(frame);

  const screenMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.92 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
  screen.position.set(0, SCREEN_Y, Z_SCR + 0.04);
  scene.add(screen);
  refs.screen = screen;
  refs.screenMat = screenMat;
  refs.screenSpec = { w: SCREEN_W, h: SCREEN_H, y: SCREEN_Y, z: Z_SCR };

  // focus test light: white rectangle whose edges blur/sharpen (shader)
  const focusMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uBlur: { value: 1 }, uOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv; uniform float uBlur; uniform float uOn;
      void main(){
        float b = mix(0.012, 0.30, uBlur);
        vec2 d = min(vUv, 1.0-vUv);
        float m = smoothstep(0.0, b, d.x) * smoothstep(0.0, b, d.y);
        // doubled ghost image while out of focus
        vec2 uv2 = vUv + vec2(uBlur*0.06, uBlur*0.03);
        vec2 d2 = min(uv2, 1.0-uv2);
        float m2 = smoothstep(0.0, b, max(d2.x,0.0)) * smoothstep(0.0, b, max(d2.y,0.0));
        float v = clamp(m*0.75 + m2*0.35, 0.0, 1.0);
        gl_FragColor = vec4(1.0, 0.98, 0.92, v * uOn * 0.9);
      }`,
  });
  const focusPlane = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W * 0.86, SCREEN_H * 0.86), focusMat);
  focusPlane.position.set(0, SCREEN_Y, Z_SCR + 0.06);
  scene.add(focusPlane);
  refs.focusMat = focusMat;

  // movie plane (lit up at showtime)
  const movieMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, fog: false, toneMapped: false });
  const moviePlane = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W * 0.97, SCREEN_H * 0.97), movieMat);
  moviePlane.position.set(0, SCREEN_Y, Z_SCR + 0.08);
  scene.add(moviePlane);
  refs.moviePlane = moviePlane;
  refs.movieMat = movieMat;

  // ================= CURTAINS =================
  const curtTex = curtainTexture();
  const curtainMat = new THREE.MeshStandardMaterial({ map: curtTex, roughness: 0.9, side: THREE.DoubleSide });
  function curtainPanel(side) { // side -1 left, +1 right
    const W = 6.0, H = 6.6, SEG = 48;
    const geo = new THREE.PlaneGeometry(W, H, SEG, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / W) * Math.PI * 9) * 0.16);   // vertical folds
    }
    geo.computeVertexNormals();
    geo.translate(-side * W / 2, 0, 0); // origin at the outer edge, panel extends toward center
    const mesh = new THREE.Mesh(geo, curtainMat);
    mesh.position.set(side * 5.9, SCREEN_Y + 0.25, Z_SCR + 0.55);
    mesh.scale.x = 0.22; // starts gathered open
    scene.add(mesh);
    return mesh;
  }
  refs.curtainL = curtainPanel(-1);
  refs.curtainR = curtainPanel(1);

  // pelmet (top valance) with scalloped bottom
  const pelShape = new THREE.Shape();
  pelShape.moveTo(-6.2, 0);
  pelShape.lineTo(-6.2, 1.3); pelShape.lineTo(6.2, 1.3); pelShape.lineTo(6.2, 0);
  for (let i = 6; i >= -6; i--) pelShape.quadraticCurveTo(i + 0.5, 0.55, i, 0);
  const pelmet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(pelShape, { depth: 0.3, bevelEnabled: false }), curtainMat);
  pelmet.position.set(0, SCREEN_Y + SCREEN_H / 2 + 0.35, Z_SCR + 0.5);
  scene.add(pelmet);
  const pelTrim = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.12, 0.4), M.metalGold);
  pelTrim.position.set(0, SCREEN_Y + SCREEN_H / 2 + 0.38, Z_SCR + 0.55);
  scene.add(pelTrim);

  // gold tassel pull-rope (tap target for the curtain step)
  const tassel = new THREE.Group();
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.5, 8), M.metalGold);
  rope.position.y = 1.75;
  tassel.add(rope);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), M.metalGold);
  knob.position.y = -0.05; tassel.add(knob);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 16), M.metalGold);
  skirt.position.y = -0.35; tassel.add(skirt);
  tassel.position.set(5.6, 3.3, Z_SCR + 0.9);
  scene.add(tassel);
  refs.tassel = tassel;

  // ================= SEATS =================
  const seats = [];
  const crooked = [];
  const seatRows = 5, perSide = 3;
  for (let r = 0; r < seatRows; r++) {
    const z = -9 + r * 2, y = r * 0.18;
    // riser step
    if (r > 0) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(10.5, y, 2),
        new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
      step.position.set(0, y / 2, z + 0.5);
      scene.add(step);
    }
    for (let sside = 0; sside < 2; sside++) {
      for (let i = 0; i < perSide; i++) {
        const x = (sside === 0 ? -1 : 1) * (1.35 + i * 1.15);
        const g = new THREE.Group();
        // pedestal + legs
        const ped = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.45), M.metalDark);
        ped.position.y = 0.16; g.add(ped);
        // seat cushion — pivot group so it can flip up
        const cushionPivot = new THREE.Group();
        cushionPivot.position.set(0, 0.42, 0.16);
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.55), M.seatRed);
        cushion.position.set(0, 0.02, -0.24);
        cushionPivot.add(cushion);
        g.add(cushionPivot);
        // backrest
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.14), M.seatRedDark);
        back.position.set(0, 0.72, 0.28);
        back.rotation.x = -0.12;
        g.add(back);
        // armrests
        for (const s2 of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), M.woodDark);
          arm.position.set(s2 * 0.36, 0.58, 0.05);
          g.add(arm);
        }
        g.position.set(x, y, z);
        scene.add(g);
        blob(0.55, x, y + 0.012, z + 0.05, 0.8);
        const seat = { group: g, cushionPivot, fixed: true };
        seats.push(seat);
      }
    }
  }
  // pick 5 crooked seats (deterministic spread)
  [2, 7, 13, 18, 25].forEach(idx => {
    const s = seats[idx % seats.length];
    s.fixed = false;
    s.cushionPivot.rotation.x = -1.45;         // cushion flipped up
    s.group.rotation.y = (idx % 2 ? 1 : -1) * 0.22;
    crooked.push(s);
  });
  refs.seats = seats;
  refs.crooked = crooked;

  // aisle floor guide lights
  const aisleDots = [];
  for (let r = 0; r < 6; r++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x2a5cff, emissiveIntensity: 0.4 }));
    for (const s of [-1, 1]) {
      const dd = d.clone();
      dd.material = d.material;
      dd.position.set(s * 0.95, (r > 0 ? (r - 1) * 0.18 : 0) + 0.02, -9.6 + r * 2);
      scene.add(dd); aisleDots.push(dd);
    }
  }
  refs.aisleDots = aisleDots;

  // ================= SPEAKERS (flank the screen) =================
  const grill = grillTexture();
  const speakers = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 1.0), M.woodDark);
    cab.position.y = 1.7; g.add(cab);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2),
      new THREE.MeshStandardMaterial({ map: grill, roughness: 0.9 }));
    face.position.set(0, 1.7, 0.51); g.add(face);
    const rings = [];
    for (const [ry, rr] of [[2.6, 0.42], [1.35, 0.55], [0.55, 0.3]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.05, 8, 24), M.metalSilver);
      ring.position.set(0, ry, 0.52); g.add(ring); rings.push(ring);
    }
    g.position.set(s * 6.6, 0.5, Z_SCREEN + 1.05);
    g.rotation.y = -s * 0.28;
    scene.add(g);
    blob(1.3, s * 6.6, 0.53, Z_SCREEN + 1.5, 0.9);
    speakers.push({ group: g, rings });
  }
  refs.speakers = speakers;

  // ================= PROJECTION BOOTH =================
  const BOOTH_Y = 2.5, BOOTH_Z0 = 6.2;
  const booth = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, BOOTH_Y, Z_BACK - BOOTH_Z0),
    new THREE.MeshStandardMaterial({ color: 0x2c2038, roughness: 0.95 }));
  booth.position.set(0, BOOTH_Y / 2, (Z_BACK + BOOTH_Z0) / 2);
  scene.add(booth);
  // booth floor carpet on top
  const bFloor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, Z_BACK - BOOTH_Z0),
    new THREE.MeshStandardMaterial({ color: 0x39284a, roughness: 0.95 }));
  bFloor.rotation.x = -Math.PI / 2;
  bFloor.position.set(0, BOOTH_Y + 0.001, (Z_BACK + BOOTH_Z0) / 2);
  scene.add(bFloor);
  // balcony rail
  const railTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ROOM_W - 1, 10), M.metalGold);
  railTop.rotation.z = Math.PI / 2;
  railTop.position.set(0, BOOTH_Y + 0.85, BOOTH_Z0 + 0.1);
  scene.add(railTop);
  for (let i = 0; i <= 14; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8), M.metalGold);
    post.position.set(-7.5 + i * (15 / 14), BOOTH_Y + 0.43, BOOTH_Z0 + 0.1);
    scene.add(post);
  }
  // side stairs
  for (let i = 0; i < 7; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.36, 0.8), M.woodDark);
    st.position.set(-6.8, 0.18 + i * 0.36, BOOTH_Z0 - 2.8 + i * 0.45);
    scene.add(st);
  }

  // ================= PROJECTOR =================
  const proj = new THREE.Group();
  const TABLE = { x: 0, y: BOOTH_Y, z: 8.2 };
  // pedestal
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.58, 1.2), M.metalDark);
  pedestal.position.set(0, 0.29, 0);
  proj.add(pedestal);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.5), M.woodDark);
  tableTop.position.set(0, 0.62, 0);
  proj.add(tableTop);
  const TY = 0.66; // table surface (local y)

  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 1.15), M.metalTeal);
  body.position.set(0, TY + 0.36, 0.05);
  proj.add(body);
  // body edge trims + rivets
  for (const dy of [0.04, 0.68]) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.05, 1.17), M.metalDark);
    tr.position.set(0, TY + dy, 0.05);
    proj.add(tr);
  }
  for (let i = 0; i < 5; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), M.metalSilver);
    riv.position.set(0.283, TY + 0.12 + i * 0.12, -0.42);
    proj.add(riv);
    const riv2 = riv.clone(); riv2.position.z = 0.5; proj.add(riv2);
  }
  // vent slits on the side
  for (let i = 0; i < 4; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.5), M.metalDark);
    v.position.set(-0.283, TY + 0.2 + i * 0.11, 0.2);
    proj.add(v);
  }
  // lamp house (rear top) with cooling fins
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.4), M.metalTeal);
  lamp.position.set(0, TY + 0.85, 0.42);
  proj.add(lamp);
  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.34), M.metalDark);
    fin.position.set(0, TY + 0.74 + i * 0.06, 0.42);
    proj.add(fin);
  }

  // lens barrel (points to screen, -z)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 24), M.metalDark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, TY + 0.46, -0.75);
  proj.add(barrel);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.12, 24), M.metalDark);
  hood.rotation.x = Math.PI / 2;
  hood.position.set(0, TY + 0.46, -1.03);
  proj.add(hood);
  // focus ring (gold, knurled)
  const focusRing = new THREE.Group();
  const ringT = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.035, 12, 28), M.metalGold);
  focusRing.add(ringT);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const kn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), M.metalDark);
    kn.position.set(Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0);
    kn.rotation.z = a;
    focusRing.add(kn);
  }
  focusRing.position.set(0, TY + 0.46, -0.88);
  proj.add(focusRing);
  refs.focusRing = focusRing;

  // lens glass + glint + dirt overlay
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.125, 28),
    new THREE.MeshStandardMaterial({ color: 0x9db7d6, roughness: 0.08, metalness: 0.9,
      emissive: 0x223448, emissiveIntensity: 0.5 }));
  glass.position.set(0, TY + 0.46, -1.095);
  glass.rotation.y = Math.PI; // face -z... circle faces +z; flip to face forward camera side
  proj.add(glass);
  const dirtCanvas = makeDirtCanvas();
  const dirtTex = new THREE.CanvasTexture(dirtCanvas);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(0.125, 28),
    new THREE.MeshBasicMaterial({ map: dirtTex, transparent: true, depthWrite: false }));
  dirt.position.set(0, TY + 0.46, -1.10);
  dirt.rotation.y = Math.PI;
  proj.add(dirt);
  refs.lensGlass = glass;
  refs.lensDirt = { mesh: dirt, canvas: dirtCanvas, tex: dirtTex };

  // reel arms
  function mkArm(z, tilt) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.16), M.metalTeal);
    arm.position.set(0.12, TY + 0.95, z);
    arm.rotation.x = tilt;
    proj.add(arm);
  }
  mkArm(-0.42, 0.28);
  mkArm(0.62, -0.28);

  // reels: spoked wheel + wound film
  function mkReel(z, woundR, labelTheme) {
    const g = new THREE.Group();
    const mat = labelTheme ? new THREE.MeshStandardMaterial({
      map: reelLabelTexture(labelTheme), roughness: 0.4, metalness: 0.3 }) : M.metalSilver;
    for (const sx of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.015, 28), mat);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = sx * 0.045;
      g.add(plate);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 30), M.metalSilver);
      rim.rotation.y = Math.PI / 2;
      rim.position.x = sx * 0.045;
      g.add(rim);
    }
    for (let i = 0; i < 5; i++) { // holes suggestion: spokes
      const a = i / 5 * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), M.metalSilver);
      sp.position.set(0, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
      sp.rotation.x = -a;
      g.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), M.metalDark);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    const wound = new THREE.Mesh(new THREE.CylinderGeometry(woundR, woundR, 0.07, 26), M.film);
    wound.rotation.z = Math.PI / 2;
    g.add(wound);
    g.userData.wound = wound;
    return g;
  }
  const supplyReel = mkReel(-0.42, 0.3, null);
  supplyReel.position.set(0.3, TY + 1.42, -0.62);
  proj.add(supplyReel);
  const takeupReel = mkReel(0.62, 0.09, null);
  takeupReel.position.set(0.3, TY + 1.42, 0.82);
  proj.add(takeupReel);
  refs.supplyReel = supplyReel;
  refs.takeupReel = takeupReel;
  supplyReel.visible = false; // appears when the child picks a reel

  // rollers + film gate on the film plane (local x = 0.30)
  const rollerPts = [
    new THREE.Vector3(0.3, TY + 0.86, -0.72),
    new THREE.Vector3(0.3, TY + 0.24, -0.55),
    new THREE.Vector3(0.3, TY + 0.24, 0.55),
    new THREE.Vector3(0.3, TY + 0.86, 0.75),
  ];
  for (const p of rollerPts) {
    const ro = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 16), M.metalSilver);
    ro.rotation.z = Math.PI / 2;
    ro.position.copy(p);
    proj.add(ro);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), M.metalDark);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(p.x - 0.06, p.y, p.z);
    proj.add(pin);
  }
  // film gate: little frame behind the lens
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.16), M.metalGold);
  gate.position.set(0.3, TY + 0.5, -0.64);
  proj.add(gate);

  // film path curve (local coords; converted to world after placement)
  const filmLocal = [
    new THREE.Vector3(0.3, TY + 1.42, -0.95),   // off supply reel front
    new THREE.Vector3(0.3, TY + 1.05, -0.85),
    new THREE.Vector3(0.3, TY + 0.86, -0.78),   // roller 1
    new THREE.Vector3(0.3, TY + 0.5, -0.66),    // through gate
    new THREE.Vector3(0.3, TY + 0.24, -0.6),    // roller 2
    new THREE.Vector3(0.3, TY + 0.18, 0.0),
    new THREE.Vector3(0.3, TY + 0.24, 0.6),     // roller 3
    new THREE.Vector3(0.3, TY + 0.86, 0.8),     // roller 4
    new THREE.Vector3(0.3, TY + 1.2, 0.85),
    new THREE.Vector3(0.3, TY + 1.42, 0.82),    // take-up hub
  ];

  // control panel + start button
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.3), M.metalDark);
  panel.position.set(-0.32, TY + 0.72, -0.28);
  panel.rotation.z = 0.35;
  proj.add(panel);
  const btnBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 20), M.metalSilver);
  btnBase.position.set(-0.35, TY + 0.78, -0.28);
  btnBase.rotation.z = 0.35;
  proj.add(btnBase);
  const startBtnMat = new THREE.MeshStandardMaterial({
    color: 0xd42b3f, roughness: 0.35, emissive: 0x550000, emissiveIntensity: 0.6 });
  const startBtn = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), startBtnMat);
  startBtn.position.set(-0.36, TY + 0.8, -0.28);
  startBtn.rotation.z = 0.35;
  proj.add(startBtn);
  refs.startBtn = startBtn;
  refs.startBtnMat = startBtnMat;
  // two decorative knobs
  for (let i = 0; i < 2; i++) {
    const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.04, 12), M.metalGold);
    kb.position.set(-0.34, TY + 0.7, -0.12 + i * 0.14);
    kb.rotation.z = 0.35;
    proj.add(kb);
  }

  proj.position.set(TABLE.x, TABLE.y, TABLE.z);
  scene.add(proj);
  blob(0.9, TABLE.x, TABLE.y + 0.01, TABLE.z, 0.9);
  refs.projector = proj;

  // world-space film curve
  const filmWorld = filmLocal.map(p => p.clone().add(new THREE.Vector3(TABLE.x, TABLE.y, TABLE.z)));
  const filmCurve = new THREE.CatmullRomCurve3(filmWorld, false, 'catmullrom', 0.15);
  refs.filmCurve = filmCurve;

  // pre-built ribbon geometry, revealed by draw range
  const SAMPLES = 240, HALF_W = 0.032;
  const ribbonGeo = new THREE.BufferGeometry();
  {
    const pts = filmCurve.getSpacedPoints(SAMPLES);
    const verts = new Float32Array((SAMPLES + 1) * 2 * 3);
    for (let i = 0; i <= SAMPLES; i++) {
      const p = pts[i];
      verts.set([p.x - HALF_W, p.y, p.z, p.x + HALF_W, p.y, p.z], i * 6);
    }
    const idx = [];
    for (let i = 0; i < SAMPLES; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    ribbonGeo.setIndex(idx);
    ribbonGeo.computeVertexNormals();
  }
  const ribbon = new THREE.Mesh(ribbonGeo, M.film);
  ribbon.geometry.setDrawRange(0, 0);
  ribbon.frustumCulled = false;
  scene.add(ribbon);
  refs.ribbon = { mesh: ribbon, samples: SAMPLES };

  // glowing film-end drag handle
  const handle = new THREE.Group();
  const hTip = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.02, 0.16), M.film);
  handle.add(hTip);
  const hGlow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.5, depthWrite: false }));
  handle.add(hGlow);
  handle.visible = false;
  scene.add(handle);
  refs.filmHandle = handle;
  refs.filmHandleGlow = hGlow;

  // ================= REEL SHELF (3 movie reels) =================
  const shelf = new THREE.Group();
  const shelfTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.75), M.woodDark);
  shelfTop.position.y = 0.62;
  shelf.add(shelfTop);
  for (const sx of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.6), M.woodDark);
    leg.position.set(sx, 0.31, 0);
    shelf.add(leg);
  }
  const shelfReels = [];
  const themes = ['ocean', 'meadow', 'space'];
  themes.forEach((th, i) => {
    const r = mkReel(0, 0.3, th);
    r.rotation.y = Math.PI / 2; // face +z (toward camera spot)
    r.position.set(-0.62 + i * 0.62, 1.1, 0);
    shelf.add(r);
    shelfReels.push({ group: r, theme: th });
  });
  shelf.position.set(-1.85, BOOTH_Y, 9.2);
  scene.add(shelf);
  refs.shelf = shelf;
  refs.shelfReels = shelfReels;

  // ================= AMP + PLUG + CABLE =================
  const amp = new THREE.Group();
  const ampBox = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.5), M.woodDark);
  ampBox.position.y = 0.31;
  amp.add(ampBox);
  const ampFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5),
    new THREE.MeshStandardMaterial({ map: grill, roughness: 0.9 }));
  ampFace.position.set(0, 0.31, 0.251);
  amp.add(ampFace);
  // VU-style dial
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20),
    new THREE.MeshStandardMaterial({ color: 0xf2e2b0, emissive: 0x332200, emissiveIntensity: 0.4 }));
  dial.position.set(0.18, 0.5, 0.252);
  amp.add(dial);
  // socket on top: gold ring + dark hole
  const socket = new THREE.Group();
  const sockRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 22),
    new THREE.MeshStandardMaterial({ color: 0xc9a34a, metalness: 0.9, roughness: 0.3,
      emissive: 0xa07820, emissiveIntensity: 0.5 }));
  sockRing.rotation.x = -Math.PI / 2;
  socket.add(sockRing);
  const sockHole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
  socket.add(sockHole);
  socket.position.set(-0.12, 0.635, 0.05);
  amp.add(socket);
  amp.position.set(1.9, BOOTH_Y, 9.0);
  amp.rotation.y = -0.35;
  scene.add(amp);
  blob(0.55, 1.9, BOOTH_Y + 0.01, 9.0, 0.85);
  refs.amp = amp;
  refs.socket = socket;

  // plug: chunky jack the child drags
  const plug = new THREE.Group();
  const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.14, 14),
    new THREE.MeshStandardMaterial({ color: 0xd4442b, roughness: 0.5 }));
  plugBody.position.y = 0.1;
  plug.add(plugBody);
  const plugTip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10), M.metalGold);
  plugTip.position.y = -0.0;
  plug.add(plugTip);
  const plugCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4442b, roughness: 0.5 }));
  plugCap.position.y = 0.17;
  plug.add(plugCap);
  plug.position.set(0.85, BOOTH_Y + 0.07, 9.55);
  plug.rotation.z = Math.PI / 2 * 0.9; // lying on the floor
  scene.add(plug);
  refs.plug = plug;

  // cable tube (rebuilt as the plug moves)
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.7 });
  const cableAnchor = new THREE.Vector3(0.28, BOOTH_Y + 0.75, 9.0); // projector rear
  let cable = null;
  function updateCable() {
    if (cable) { cable.geometry.dispose(); scene.remove(cable); }
    const end = plug.position.clone();
    const mid = cableAnchor.clone().lerp(end, 0.5);
    mid.y = Math.min(cableAnchor.y, end.y) - 0.25 + 0.1;
    mid.y = Math.max(BOOTH_Y + 0.03, mid.y);
    const cur = new THREE.QuadraticBezierCurve3(cableAnchor, mid, end);
    cable = new THREE.Mesh(new THREE.TubeGeometry(cur, 20, 0.022, 6), cableMat);
    scene.add(cable);
  }
  updateCable();
  refs.updateCable = updateCable;

  // ================= LIGHTS =================
  const hemi = new THREE.HemisphereLight(0xcabffc, 0x2a1f33, 0.55);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.32);
  scene.add(amb);
  const house = new THREE.PointLight(0xffd9a0, 55, 40, 1.9);
  house.position.set(0, 7.2, -3);
  scene.add(house);
  const boothLight = new THREE.PointLight(0xffe6c0, 14, 12, 1.8);
  boothLight.position.set(0.5, 5.6, 8.6);
  scene.add(boothLight);
  refs.lights = { hemi, amb, house, boothLight };

  // wall sconces: warm shells, a few with real point lights
  const sconceBulbs = [];
  const sconceLights = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const z = -12 + i * 5.4;
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, 0.42, 12, 1, true, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xc9a34a, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }));
      shell.position.set(s * (ROOM_W / 2 - 0.12), 4.6, z);
      shell.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(shell);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfff2cf, emissive: 0xffc86e, emissiveIntensity: 1.6 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), bulbMat);
      bulb.position.set(s * (ROOM_W / 2 - 0.2), 4.66, z);
      scene.add(bulb);
      sconceBulbs.push(bulbMat);
      if (i % 2 === 0) {
        const pl = new THREE.PointLight(0xffc98a, 9, 9, 1.9);
        pl.position.set(s * (ROOM_W / 2 - 0.5), 4.7, z);
        scene.add(pl);
        sconceLights.push(pl);
      }
    }
  }
  refs.sconceBulbs = sconceBulbs;
  refs.sconceLights = sconceLights;

  // ceiling lamp discs
  const ceilLampMats = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfff6e0, emissive: 0xffe1a8, emissiveIntensity: 1.2 });
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 20), mat);
    d.position.set(0, 7.94, -10 + i * 6);
    scene.add(d);
    ceilLampMats.push(mat);
  }
  refs.ceilLampMats = ceilLampMats;

  // projection beam: spotlight + visible cones + dust
  const spot = new THREE.SpotLight(0xfff4d6, 0, 45, 0.15, 0.5, 0.6);
  spot.position.set(0, BOOTH_Y + TY + 0.46, TABLE.z - 1.1);
  spot.target.position.set(0, SCREEN_Y, Z_SCR);
  spot.visible = false;
  scene.add(spot); scene.add(spot.target);
  refs.spot = spot;

  const lensPos = new THREE.Vector3(0, BOOTH_Y + TY + 0.46, TABLE.z - 1.12);
  const scrPosFull = new THREE.Vector3(0, SCREEN_Y, Z_SCR);
  // stop the visible cone a bit short of the screen so its rim never overlaps the picture
  const scrPos = lensPos.clone().lerp(scrPosFull, 0.91);
  const beamLen = lensPos.distanceTo(scrPos);
  const beamGroup = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff7dc, transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const beamMat2 = beamMat.clone(); beamMat2.opacity = 0;
  const cone1 = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 0.09, beamLen, 20, 1, true), beamMat);
  const cone2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.05, beamLen, 16, 1, true), beamMat2);
  beamGroup.add(cone1); beamGroup.add(cone2);
  // orient: cylinder axis y → align to lens→screen direction
  const dir = scrPos.clone().sub(lensPos);
  beamGroup.position.copy(lensPos.clone().add(scrPos).multiplyScalar(0.5));
  beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  scene.add(beamGroup);
  refs.beam = { group: beamGroup, mat1: beamMat, mat2: beamMat2 };

  // dust motes inside the beam
  const DUST_N = 160;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_N * 3);
  const dustSeed = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    const t = Math.random();
    const p = lensPos.clone().lerp(scrPos, t);
    const r = 0.1 + t * 1.4;
    dustPos[i * 3] = p.x + (Math.random() - 0.5) * r;
    dustPos[i * 3 + 1] = p.y + (Math.random() - 0.5) * r * 0.6;
    dustPos[i * 3 + 2] = p.z;
    dustSeed[i] = Math.random() * 10;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xfff2cc, size: 0.035, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  refs.dust = { points: dust, mat: dustMat, seed: dustSeed, lensPos, scrPos };

  // light glowing from the screen during the show
  const screenGlow = new THREE.PointLight(0x9fb8ff, 0, 26, 1.6);
  screenGlow.position.set(0, SCREEN_Y, Z_SCR + 2.5);
  scene.add(screenGlow);
  refs.screenGlow = screenGlow;

  // small light spilling out of the booth window
  refs.boothZ = BOOTH_Z0;
  refs.roomSpec = { w: ROOM_W, h: ROOM_H, zScreen: Z_SCREEN, zBack: Z_BACK, boothY: BOOTH_Y, table: TABLE, tableY: TY };

  return refs;
}
