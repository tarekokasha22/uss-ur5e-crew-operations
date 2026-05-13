(function(){
window.GAME = window.GAME || {};
const A = GAME.audio = {};

let ctx = null;
A.enabled = true;

function getCtx(){
  if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(freq, type, duration, gainVal=0.15, delay=0){
  if(!A.enabled) return;
  try{
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
    gain.gain.setValueAtTime(gainVal, ac.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
  } catch(e){ /* ignore */ }
}

function noise(duration, gainVal=0.06, delay=0){
  if(!A.enabled) return;
  try{
    const ac = getCtx();
    const bufSize = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i]=(Math.random()*2-1)*gainVal;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(gainVal, ac.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start(ac.currentTime + delay);
    src.stop(ac.currentTime + delay + duration + 0.05);
  } catch(e){ /* ignore */ }
}

// SFX catalogue
A.play = function(sfx){
  if(!A.enabled) return;
  switch(sfx){
    case 'boot_beep':
      // Ascending arpeggio
      [220,330,440,550,660,880].forEach((f,i)=>tone(f,'square',0.08,0.1,i*0.07));
      break;
    case 'boot_done':
      tone(880,'sine',0.1,0.15);
      tone(1100,'sine',0.15,0.15,0.1);
      tone(1320,'sine',0.25,0.15,0.22);
      break;
    case 'click':
      tone(660,'square',0.04,0.1);
      break;
    case 'robot_beep':
      tone(880,'square',0.05,0.08);
      tone(660,'square',0.05,0.08,0.07);
      break;
    case 'robot_error':
      tone(220,'sawtooth',0.12,0.12);
      tone(180,'sawtooth',0.12,0.12,0.12);
      noise(0.15,0.04,0.22);
      break;
    case 'dossier_stamp':
      noise(0.05,0.15);
      tone(120,'square',0.1,0.2,0.04);
      break;
    case 'notification':
      tone(1047,'sine',0.06,0.1);
      tone(1319,'sine',0.06,0.1,0.08);
      break;
    case 'achievement':
      [523,659,784,1047].forEach((f,i)=>tone(f,'sine',0.1,0.12,i*0.1));
      break;
    case 'alarm':
      tone(440,'sawtooth',0.15,0.15);
      tone(400,'sawtooth',0.15,0.15,0.15);
      tone(440,'sawtooth',0.15,0.15,0.3);
      break;
    case 'konami':
      [523,523,659,523,784,740,523,523,659,523,880,784].forEach((f,i)=>tone(f,'square',0.08,0.08,i*0.08));
      break;
    case 'hover':
      tone(1320,'sine',0.03,0.05);
      break;
    case 'night':
      tone(220,'sine',0.3,0.06);
      tone(165,'sine',0.3,0.04,0.1);
      break;
  }
};

A.toggle = function(){
  A.enabled = !A.enabled;
  if(A.enabled && ctx && ctx.state==='suspended') ctx.resume();
  return A.enabled;
};

// Resume audio context on first user interaction (browser policy)
function resumeCtx(){
  if(ctx && ctx.state==='suspended') ctx.resume();
}
document.addEventListener('click', resumeCtx, { once: true });
document.addEventListener('keydown', resumeCtx, { once: true });

})();
