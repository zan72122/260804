/** How deep does the claw actually get, relative to the box, on an end grab? */
import { makeGame, runUntilIdle } from './physics-sim.mjs';
import { makeRound, resetRoundCounter, BAR } from '../src/config.js';
const DT=1/60;
resetRoundCounter();
for (let r=0;r<6;r++){
  for(let i=0;i<r;i++) makeRound();
  const round=makeRound();
  const {g,p}=await makeGame(round);
  const e=g.prizeEnds();
  g.setAim(e.left.x+0.038, e.c.z-0.85*e.dz);
  for(let i=0;i<50;i++) g.update(DT);
  const b=p.prizeState();
  const boxTop=b.pos.y+round.box.h/2, boxBot=b.pos.y-round.box.h/2;
  g.grab();
  let closeTip=null, minTip=9, phase='';
  for(let i=0;i<1500;i++){
    g.update(DT);
    if (g.phase==='close'){ minTip=Math.min(minTip,p.lowestTipY()); if(phase!=='close') closeTip=p.lowestTipY(); }
    phase=g.phase;
    if(!g.busy) break;
  }
  const a=p.prizeState();
  console.log(`r${r+1} boxTop=${boxTop.toFixed(3)} boxBot=${boxBot.toFixed(3)} tipAtClose=${closeTip.toFixed(3)} deepestTip=${minTip.toFixed(3)}`+
    ` -> ${minTip<boxBot?'UNDER the box':'above the bottom'}  dx=${((a.pos.x-b.pos.x)*100).toFixed(1)}cm dyaw=${((p.prizeYaw()*180/Math.PI)).toFixed(0)}`);
  resetRoundCounter();
}
