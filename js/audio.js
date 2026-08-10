/* Web Audio — unlocked on first touch */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const AudioSys=(()=>{
  let ac=null,master=null,sizzleNode=null,sizzleGain=null,nb=null;
  function ctx(){if(!ac){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;
    ac=new A();master=ac.createGain();master.gain.value=0.85;
    const comp=ac.createDynamicsCompressor();master.connect(comp);comp.connect(ac.destination);}
    if(ac.state==='suspended')ac.resume();
    return ac;}
  function noiseBuf(a){const len=a.sampleRate;const b=a.createBuffer(1,len,a.sampleRate);
    const ch=b.getChannelData(0);for(let i=0;i<len;i++)ch[i]=Math.random()*2-1;return b;}
  function env(g,t0,a,peak,d){g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);}
  function tone(freq,dur,type,peak,slideTo){const a=ctx();if(!a)return;
    const o=a.createOscillator(),g=a.createGain();
    o.type=type||'sine';o.frequency.value=freq;
    if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,a.currentTime+dur);
    env(g,a.currentTime,0.008,peak||0.2,dur);
    o.connect(g);g.connect(master);o.start();o.stop(a.currentTime+dur+0.1);}
  function noise(dur,fc,q,peak){const a=ctx();if(!a)return;nb=nb||noiseBuf(a);
    const s=a.createBufferSource();s.buffer=nb;s.loop=true;
    const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=fc;f.Q.value=q||1;
    const g=a.createGain();env(g,a.currentTime,0.01,peak||0.15,dur);
    s.connect(f);f.connect(g);g.connect(master);s.start();s.stop(a.currentTime+dur+0.1);}
  return{
    unlock(){ctx();},
    knock(){noise(0.08,300,1,0.3);tone(130,0.15,'sine',0.25,90);},
    tap(){tone(520,0.07,'triangle',0.10);},
    whoosh(){noise(0.12,900,1.2,0.08);},
    carve(){noise(0.09,1400,2,0.06);},
    pop(){tone(560,0.12,'sine',0.3,200);noise(0.03,2500,1,0.1);},
    snap(){tone(780,0.09,'sine',0.28,320);noise(0.03,3200,1,0.12);},
    chime(){[660,880,1320].forEach((f,i)=>setTimeout(()=>tone(f,0.6,'triangle',0.14),i*90));},
    grand(){[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>tone(f,1.0,'triangle',0.13),i*120));},
    sizzleSet(level){const a=ctx();if(!a)return;
      if(!sizzleNode){nb=nb||noiseBuf(a);
        sizzleNode=a.createBufferSource();sizzleNode.buffer=nb;sizzleNode.loop=true;
        const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=4200;f.Q.value=0.8;
        sizzleGain=a.createGain();sizzleGain.gain.value=0;
        sizzleNode.connect(f);f.connect(sizzleGain);sizzleGain.connect(master);sizzleNode.start();}
      sizzleGain.gain.setTargetAtTime(clamp(level,0,0.22),a.currentTime,0.06);},
    pluck(freq,peak){const a=ctx();if(!a)return;
      const o=a.createOscillator(),o2=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();
      o.type='triangle';o2.type='sine';o.frequency.value=freq;o2.frequency.value=freq*2.01;
      f.type='lowpass';f.frequency.value=Math.min(6000,freq*6);
      env(g,a.currentTime,0.005,peak||0.22,0.55);
      o.connect(f);o2.connect(f);f.connect(g);g.connect(master);
      o.start();o2.start();o.stop(a.currentTime+0.8);o2.stop(a.currentTime+0.8);},
    bow(freq,dur,when,peak){const a=ctx();if(!a)return;const t0=a.currentTime+(when||0);
      const g=a.createGain();
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.linearRampToValueAtTime(peak||0.13,t0+0.22);
      g.gain.setValueAtTime(peak||0.13,t0+dur-0.35);
      g.gain.linearRampToValueAtTime(0.0001,t0+dur);
      const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=2100;f.Q.value=0.7;
      f.connect(g);g.connect(master);
      const lfo=a.createOscillator(),lg=a.createGain();lfo.frequency.value=5.3;lg.gain.value=freq*0.006;
      lfo.connect(lg);lfo.start(t0);lfo.stop(t0+dur);
      [-3,3].forEach(cents=>{const o=a.createOscillator();o.type='sawtooth';
        o.frequency.value=freq*Math.pow(2,cents/1200);lg.connect(o.frequency);
        o.connect(f);o.start(t0);o.stop(t0+dur);});}
  };
})();
