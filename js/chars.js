'use strict';
/* ============================================================
 * chars.js — おかし通りの住民。
 * ちいさくて丸い、パステル色の住民たち。
 * mood: 'idle' | 'walk' | 'excite' | 'cheer' | 'eat' | 'sit'
 * ============================================================ */

const RESIDENT_PALETTES = [
  { dress: '#F48FB1', dress2: '#E06792', hair: '#8D5A3B', skin: '#FFE3CE', acc: '#FFD166' },
  { dress: '#9FA8EF', dress2: '#7C86D9', hair: '#4A3A66', skin: '#FFDFC4', acc: '#F7A8FF' },
  { dress: '#7FD8BE', dress2: '#57BD9E', hair: '#E8B34B', skin: '#FFE8D6', acc: '#FF8FB0' },
  { dress: '#FFD166', dress2: '#F0B33F', hair: '#6B4423', skin: '#FFE3CE', acc: '#7FD8BE' },
  { dress: '#C9A7F5', dress2: '#A97FE0', hair: '#3E3148', skin: '#FFDFC4', acc: '#FFF3B0' },
  { dress: '#FF9E80', dress2: '#EF7A58', hair: '#7A4A2B', skin: '#FFE8D6', acc: '#9AB7FF' },
];

function makeResident(i) {
  return {
    pal: RESIDENT_PALETTES[i % RESIDENT_PALETTES.length],
    hairStyle: i % 3,        // 0=おだんご 1=ツイン 2=ぼぶ
    phase: (i * 1.37) % U.TAU,
  };
}

/**
 * 住民を描く。(x, y) は足元、h は身長。
 * opt: { mood, t, flip, sweet: {type} 手に持つお菓子, heartT }
 */
function drawResident(ctx, res, x, y, h, opt) {
  const t = opt.t || 0;
  const mood = opt.mood || 'idle';
  const pal = res.pal;
  const ph = res.phase;

  let bob = 0, jump = 0, lean = 0, armUp = 0, walkSw = 0;
  if (mood === 'idle') bob = Math.sin(t * 2.2 + ph) * h * 0.012;
  if (mood === 'walk') { bob = Math.abs(Math.sin(t * 5 + ph)) * h * 0.03; walkSw = Math.sin(t * 5 + ph); }
  if (mood === 'excite') { bob = Math.abs(Math.sin(t * 7 + ph)) * h * 0.035; lean = 0.06; armUp = 0.45 + Math.sin(t * 7) * 0.1; }
  if (mood === 'cheer') { jump = Math.abs(Math.sin(t * 5.2 + ph)) * h * 0.12; armUp = 1; }
  if (mood === 'eat') { bob = Math.sin(t * 3) * h * 0.008; }
  if (mood === 'sit') { bob = Math.sin(t * 2 + ph) * h * 0.008; }

  const yy = y - jump - bob;
  ctx.save();
  ctx.translate(x, yy);
  if (opt.flip) ctx.scale(-1, 1);
  if (lean) ctx.rotate(lean);

  const headR = h * 0.26;
  const bodyH = h * 0.46;
  const bodyW = h * 0.36;
  const headY = -h + headR * 1.15;
  const sitDrop = mood === 'sit' ? h * 0.16 : 0;

  // 接地影
  ctx.fillStyle = 'rgba(120,70,90,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, y - yy, h * 0.20 + jump * 0.3, h * 0.05, 0, 0, U.TAU);
  ctx.fill();

  ctx.translate(0, sitDrop);

  // 足
  ctx.fillStyle = pal.dress2;
  const footY = -h * 0.035;
  const fw = mood === 'walk' ? walkSw * h * 0.05 : 0;
  ctx.beginPath();
  ctx.ellipse(-h * 0.085 + fw, footY, h * 0.055, h * 0.038, 0, 0, U.TAU);
  ctx.ellipse(h * 0.085 - fw, footY, h * 0.055, h * 0.038, 0, 0, U.TAU);
  ctx.fill();

  // 体(ワンピース)
  const bg = ctx.createLinearGradient(-bodyW, 0, bodyW, 0);
  bg.addColorStop(0, pal.dress);
  bg.addColorStop(0.55, pal.dress);
  bg.addColorStop(1, pal.dress2);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.32, -bodyH - h * 0.10);
  ctx.quadraticCurveTo(-bodyW * 0.78, -bodyH * 0.35, -bodyW * 0.58, -h * 0.04);
  ctx.quadraticCurveTo(0, h * 0.015, bodyW * 0.58, -h * 0.04);
  ctx.quadraticCurveTo(bodyW * 0.78, -bodyH * 0.35, bodyW * 0.32, -bodyH - h * 0.10);
  ctx.closePath();
  ctx.fill();
  // すその明るいふち
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = h * 0.018;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.52, -h * 0.045);
  ctx.quadraticCurveTo(0, h * 0.005, bodyW * 0.52, -h * 0.045);
  ctx.stroke();
  // 胸のボタン/アクセント
  ctx.fillStyle = pal.acc;
  ctx.beginPath();
  ctx.arc(0, -bodyH * 0.78, h * 0.028, 0, U.TAU);
  ctx.fill();

  // 腕
  const shY = -bodyH - h * 0.065;
  const armL = h * 0.20;
  const drawArm = (side) => {
    let a;
    if (mood === 'cheer') a = -Math.PI * 0.72 * side + Math.sin(t * 10) * 0.12 * side;
    else if (mood === 'excite') a = (-Math.PI * (0.25 + armUp * 0.35)) * side;
    else if (mood === 'eat') a = -Math.PI * 0.58 * side;
    else if (mood === 'walk') a = (-Math.PI * 0.12 + walkSw * 0.35 * side) * side;
    else a = -Math.PI * 0.16 * side + Math.sin(t * 2.2 + ph) * 0.04;
    const ex = Math.cos(a) * armL * side, ey = Math.sin(Math.abs(a)) * -armL;
    ctx.strokeStyle = pal.dress;
    ctx.lineWidth = h * 0.062;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * bodyW * 0.30, shY);
    ctx.quadraticCurveTo(side * bodyW * 0.45, shY + h * 0.03, side * bodyW * 0.30 + ex, shY + (mood === 'eat' ? -h * 0.10 : ey * 0.5));
    ctx.stroke();
    // 手
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(side * bodyW * 0.30 + ex, shY + (mood === 'eat' ? -h * 0.10 : ey * 0.5), h * 0.035, 0, U.TAU);
    ctx.fill();
    return { hx: side * bodyW * 0.30 + ex, hy: shY + (mood === 'eat' ? -h * 0.10 : ey * 0.5) };
  };
  const armR = drawArm(1);
  drawArm(-1);

  // 手に持つお菓子
  if (opt.sweet) {
    ctx.save();
    ctx.translate(armR.hx, armR.hy - h * 0.03);
    drawMiniSweet(ctx, opt.sweet, h * 0.22);
    ctx.restore();
  }

  // 頭
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, U.TAU);
  ctx.fill();
  // 頬の丸み(下側にほんのり)
  ctx.fillStyle = 'rgba(240,160,140,0.14)';
  ctx.beginPath();
  ctx.ellipse(0, headY + headR * 0.42, headR * 0.72, headR * 0.4, 0, 0, U.TAU);
  ctx.fill();

  // 髪
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(0, headY - headR * 0.10, headR * 1.02, Math.PI * 0.96, Math.PI * 2.04);
  ctx.quadraticCurveTo(headR * 0.6, headY - headR * 0.55, 0, headY - headR * 0.5);
  ctx.quadraticCurveTo(-headR * 0.6, headY - headR * 0.55, -headR * 1.0, headY - headR * 0.06);
  ctx.closePath();
  ctx.fill();
  // 前髪の丸
  ctx.beginPath();
  ctx.arc(-headR * 0.45, headY - headR * 0.62, headR * 0.34, 0, U.TAU);
  ctx.arc(headR * 0.05, headY - headR * 0.74, headR * 0.36, 0, U.TAU);
  ctx.arc(headR * 0.5, headY - headR * 0.60, headR * 0.33, 0, U.TAU);
  ctx.fill();
  if (res.hairStyle === 0) { // おだんご
    ctx.beginPath();
    ctx.arc(0, headY - headR * 1.12, headR * 0.30, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = pal.acc;
    ctx.beginPath();
    ctx.arc(headR * 0.16, headY - headR * 1.22, headR * 0.10, 0, U.TAU);
    ctx.fill();
  } else if (res.hairStyle === 1) { // ツインテール
    const sway = Math.sin(t * 3 + ph) * headR * 0.06;
    ctx.beginPath();
    ctx.ellipse(-headR * 1.05, headY + headR * 0.25 + sway, headR * 0.24, headR * 0.5, 0.3, 0, U.TAU);
    ctx.ellipse(headR * 1.05, headY + headR * 0.25 - sway, headR * 0.24, headR * 0.5, -0.3, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = pal.acc;
    ctx.beginPath();
    ctx.arc(-headR * 0.92, headY - headR * 0.12, headR * 0.09, 0, U.TAU);
    ctx.arc(headR * 0.92, headY - headR * 0.12, headR * 0.09, 0, U.TAU);
    ctx.fill();
  } else { // ぼぶ+リボン
    ctx.beginPath();
    ctx.ellipse(-headR * 0.95, headY + headR * 0.3, headR * 0.22, headR * 0.34, 0.2, 0, U.TAU);
    ctx.ellipse(headR * 0.95, headY + headR * 0.3, headR * 0.22, headR * 0.34, -0.2, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = pal.acc;
    ctx.save();
    ctx.translate(headR * 0.55, headY - headR * 0.88);
    ctx.rotate(0.2);
    ctx.beginPath();
    ctx.ellipse(-headR * 0.14, 0, headR * 0.14, headR * 0.085, 0.5, 0, U.TAU);
    ctx.ellipse(headR * 0.14, 0, headR * 0.14, headR * 0.085, -0.5, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, headR * 0.055, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }
  // 髪のつや
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = h * 0.02;
  ctx.beginPath();
  ctx.arc(0, headY - headR * 0.12, headR * 0.78, Math.PI * 1.18, Math.PI * 1.55);
  ctx.stroke();

  // 目と口
  const eyeY = headY + headR * 0.10;
  const eyeX = headR * 0.40;
  const excite = mood === 'excite' || mood === 'cheer';
  if (mood === 'eat') {
    // とじた目(にっこり)+ ふくらんだ頬
    ctx.strokeStyle = '#4A3438';
    ctx.lineWidth = h * 0.022;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * eyeX, eyeY, headR * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    const puff = 1 + Math.abs(Math.sin(t * 9)) * 0.25;
    ctx.fillStyle = 'rgba(250,150,150,0.55)';
    ctx.beginPath();
    ctx.ellipse(-eyeX - headR * 0.18, eyeY + headR * 0.36, headR * 0.20 * puff, headR * 0.16 * puff, 0, 0, U.TAU);
    ctx.ellipse(eyeX + headR * 0.18, eyeY + headR * 0.36, headR * 0.20 * puff, headR * 0.16 * puff, 0, 0, U.TAU);
    ctx.fill();
    // むしゃむしゃ口
    ctx.fillStyle = '#8C4A50';
    ctx.beginPath();
    ctx.ellipse(0, eyeY + headR * 0.42, headR * 0.13, headR * 0.10 * (0.6 + Math.abs(Math.sin(t * 9)) * 0.5), 0, 0, U.TAU);
    ctx.fill();
  } else if (excite) {
    // きらきらの目
    ctx.fillStyle = '#4A3438';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * eyeX, eyeY, headR * 0.15, 0, U.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * eyeX - headR * 0.05, eyeY - headR * 0.05, headR * 0.06, 0, U.TAU);
      ctx.arc(s * eyeX + headR * 0.05, eyeY + headR * 0.04, headR * 0.032, 0, U.TAU);
      ctx.fill();
    }
    // 開いた口
    ctx.fillStyle = '#8C4A50';
    ctx.beginPath();
    ctx.ellipse(0, eyeY + headR * 0.40, headR * 0.16, headR * 0.14, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#F08080';
    ctx.beginPath();
    ctx.ellipse(0, eyeY + headR * 0.47, headR * 0.09, headR * 0.06, 0, 0, U.TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = '#4A3438';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * eyeX, eyeY, headR * 0.11, headR * 0.13, 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * eyeX - headR * 0.035, eyeY - headR * 0.045, headR * 0.038, 0, U.TAU);
      ctx.fill();
    }
    // にっこり口
    ctx.strokeStyle = '#8C4A50';
    ctx.lineWidth = h * 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, eyeY + headR * 0.28, headR * 0.14, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // ほっぺ
  ctx.fillStyle = 'rgba(250,140,150,0.4)';
  ctx.beginPath();
  ctx.ellipse(-eyeX - headR * 0.28, eyeY + headR * 0.22, headR * 0.13, headR * 0.09, 0, 0, U.TAU);
  ctx.ellipse(eyeX + headR * 0.28, eyeY + headR * 0.22, headR * 0.13, headR * 0.09, 0, 0, U.TAU);
  ctx.fill();

  ctx.restore();
}

/** 吹き出し(中にお菓子アイコン)。(x,y)=しっぽの先 */
function drawBubble(ctx, x, y, s, type, t) {
  const pulse = 1 + Math.sin(t * 3.2) * 0.03;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  const w = s * 1.5, h = s * 1.25;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = 'rgba(240,170,195,0.9)';
  ctx.lineWidth = s * 0.05;
  // しっぽ
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-s * 0.05, -s * 0.3, s * 0.22, -s * 0.42);
  ctx.lineTo(s * 0.5, -s * 0.42);
  ctx.closePath();
  ctx.fill();
  // 本体
  rr(ctx, -w * 0.5 + s * 0.3, -s * 0.42 - h, w, h, h * 0.32);
  ctx.fill();
  ctx.stroke();
  // 中のお菓子
  ctx.save();
  ctx.translate(s * 0.3, -s * 0.42 - h * 0.48);
  drawMiniSweet(ctx, type, s * 0.85);
  ctx.restore();
  // きらり
  drawSparkle(ctx, s * 0.3 + w * 0.34, -s * 0.42 - h * 0.78, s * 0.10, t * 1.5, 0.8 + Math.sin(t * 5) * 0.2, '#FFE9A8');
  ctx.restore();
}
