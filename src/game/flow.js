// 一つの作品を最初から最後まで作る流れ。
import * as THREE from 'three';
import { Plank } from '../world/workpiece.js';
import { PlaceStep, MeasureStep, PencilStep, ClampStep, SawStep, SandStep } from './steps_cut.js';
import { AssembleStep, NailStep, PaintStep, DecorateStep, FinaleStep } from './steps_build.js';
import { tween, wait, easeOutCubic, easeInOutCubic, lerp } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** 切り落とした端材を片づける */
function scrapAway(game, offcut) {
  const from = offcut.group.position.clone();
  const to = V(0.78, -0.1, 0.34);
  tween({
    from: 0, to: 1, dur: 0.8, ease: easeInOutCubic,
    onUpdate: (v) => {
      offcut.group.position.lerpVectors(from, to, v);
      offcut.group.position.y += Math.sin(v * Math.PI) * 0.12;
      offcut.group.rotation.z = v * 1.4;
      offcut.group.rotation.x = v * 0.8;
      const s = 1 - v * 0.6;
      offcut.group.scale.setScalar(Math.max(0.001, s));
    },
    onDone: () => {
      game.audio.thunk(0.4);
      offcut.group.parent && offcut.group.parent.remove(offcut.group);
    },
  });
}

/** 出来た部品を作業台の奥へよける */
function moveAside(game, piece, i, total) {
  const from = piece.group.position.clone();
  const to = V(lerp(-0.34, 0.34, total <= 1 ? 0.5 : i / (total - 1)), piece.thick / 2, -0.30);
  return tween({
    from: 0, to: 1, dur: 0.7, ease: easeInOutCubic,
    onUpdate: (v) => {
      piece.group.position.lerpVectors(from, to, v);
      piece.group.position.y += Math.sin(v * Math.PI) * 0.06;
      piece.group.rotation.y = lerp(piece.group.rotation.y, 0, v);
    },
    onDone: () => game.audio.thunk(0.5),
  });
}

export async function runProject(game, project) {
  game.hud.setStepsVisible(true);
  game.hud.setGoalImage(game.thumbs[project.id] || null);
  const pieces = {};

  for (let i = 0; i < project.cuts.length; i++) {
    if (game.aborted) return null;
    const cut = project.cuts[i];
    const plank = new Plank({ len: cut.stock.len, thick: cut.stock.thick, wide: cut.stock.wide, wood: game.wood });
    game.scene.add(plank.group);
    const markX = -cut.stock.len / 2 + cut.mark;

    await new PlaceStep(game, { plank }).run();
    if (game.aborted) return null;
    await new MeasureStep(game, { plank, markX }).run();
    if (game.aborted) return null;
    await new PencilStep(game, { plank, markX }).run();
    if (game.aborted) return null;
    await new ClampStep(game, { plank }).run();
    if (game.aborted) return null;

    const saw = new SawStep(game, { plank, markX });
    await saw.run();
    if (game.aborted) return null;
    const { keeper, offcut } = saw.result;

    await new SandStep(game, { plank: keeper }).run();
    if (game.aborted) return null;
    scrapAway(game, offcut);
    pieces['cut' + i] = keeper;
    await moveAside(game, keeper, i, project.cuts.length);
  }

  if (game.aborted) return null;
  await new AssembleStep(game, { project, pieces }).run();
  if (game.aborted) return null;
  await new NailStep(game, { project }).run();
  if (game.aborted) return null;
  await new PaintStep(game, { project }).run();
  if (game.aborted) return null;
  await new DecorateStep(game, { project }).run();
  if (game.aborted) return null;

  const fin = new FinaleStep(game, { project });
  await fin.run();
  return fin.choice || 'other';
}
