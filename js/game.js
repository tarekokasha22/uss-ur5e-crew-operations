(function(){
window.GAME = window.GAME || {};
var G = GAME;

var L; // set in startGame from GAME.LAYOUT
var CHAR_SCALE = 6;
var TICK = 1000/30;

// Starfield (generated once) — main layer + faint deep layer
var STARS = [];
var STARS_DEEP = [];

// Boot lines
var BOOT_LINES = [
  'BIOS v3.14.UR5e — GIU Robotics Lab',
  'Power-on self test: OK',
  'Loading ROS2 Humble...',
  'roscore: started',
  'Scanning crew manifest...',
  '  [01/14] Dr. Tolba ......... CAPTAIN',
  '  [02/14] Jomana ............ CHIEF',
  '  [03/14] Maryam ............ THE HAND',
  '  [04/14] Youssef Zaky ...... PATRON',
  '  [05/14] Tarek ............. NIGHTINGALE',
  '  [06/14] Abdelrahman ....... ECHO',
  '  [07/14] Mohamed ........... RESONANCE',
  '  [08/14] Carol ............. CONTROL',
  '  [09/14] Omar .............. AMP',
  '  [10/14] Seif .............. BURN',
  '  [11/14] Youssef Emad ...... RIVET',
  '  [12/14] Moaz .............. COMPILE',
  '  [13/14] Hemaly ............ SOLDER',
  '  [14/14] UR5e-01 ........... ROBOT',
  'CREW 14/14 OK',
  'DECRYPTING DOSSIERS... DONE',
  'MoveIt2: ARMED | Voice: LISTENING',
  'USS UR5e — ALL SYSTEMS NOMINAL',
  'WELCOME ABOARD, OPERATOR.',
];

G.state = {
  tick: 0,
  canvasW: 1440,
  canvasH: 810,
  isNight: false,
  gameHour: 8,
  missionDay: 1,
  /** Accumulated ms for slow in-universe SHIP TIME display (independent of wall clock). */
  shipSimMs: 0,
  hoverChar: null,
  hoverDecor: null,
  lastTime: 0,
  acc: 0,
  pulseTick: 0,
  started: false,
  moveMode: false,
  selectedChar: null,
  lastDecorHoverKey: null,
  /** After dossier-wall return: keep one updateDayNight from overwriting restored gameHour. */
  skipClockResyncOnce: false,
};

var BRIDGE_SNAP_KEY = 'uss_bridge_snapshot_v1';

GAME.captureBridgeSessionForDossiers = function(){
  try {
    if(!GAME.crew || !G.state || !GAME.ai) return;
    var snap = {
      v: 1,
      state: {
        tick: G.state.tick,
        isNight: !!G.state.isNight,
        gameHour: G.state.gameHour,
        missionDay: G.state.missionDay,
        shipSimMs: G.state.shipSimMs || 0,
        moveMode: !!G.state.moveMode,
        selectedCharId: G.state.selectedChar ? G.state.selectedChar.id : null,
        pulseTick: G.state.pulseTick,
        acc: G.state.acc || 0,
      },
      ai: {
        chillTimeActive: !!GAME.ai.chillTimeActive,
        chillBreakInviteIds: GAME.ai.chillBreakInviteIds ? GAME.ai.chillBreakInviteIds.slice() : null,
        _scenesFiredToday: GAME.ai._scenesFiredToday ? GAME.ai._scenesFiredToday.slice() : [],
        _lastHour: GAME.ai._lastHour,
        _chillCheckTimer: GAME.ai._chillCheckTimer,
        _jomanaWasInChill: !!GAME.ai._jomanaWasInChill,
        _chillRoomBanterTimer: GAME.ai._chillRoomBanterTimer,
        _lonelySeekTimer: GAME.ai._lonelySeekTimer,
        _chillCrowdTimer: GAME.ai._chillCrowdTimer,
        _exRobIx: GAME.ai._exRobIx,
        _exLobbyIx: GAME.ai._exLobbyIx,
        _exMedRoomIx: GAME.ai._exMedRoomIx,
        _exAnyIx: GAME.ai._exAnyIx,
        _messSnapSeq: GAME.ai._messSnapSeq,
        _transitMessIx: GAME.ai._transitMessIx,
      },
      crew: GAME.crew.map(function(c){
        var o = { id: c.id, room: c.room, state: c.state, timer: c.timer };
        if(c.pos) o.pos = { x: c.pos.x, y: c.pos.y };
        if(c.target) o.target = { x: c.target.x, y: c.target.y };
        if(c.kind === 'robot'){
          o.arm = c.arm ? { baseAngle: c.arm.baseAngle, foreAngle: c.arm.foreAngle, gripperOpen: !!c.arm.gripperOpen } : null;
          o.routeIndex = c.routeIndex;
          o.robotMsgTimer = c.robotMsgTimer;
          o.graspFailCount = c.graspFailCount;
          o.coffeeMode = !!c.coffeeMode;
          o.chillMode = !!c.chillMode;
        } else {
          o.sleeping = !!c.sleeping;
          o.homeRoom = c.homeRoom;
          o.playerControlled = !!c.playerControlled;
          o.playerOverrideUntil = c.playerOverrideUntil || 0;
          o.bubbleText = c.bubbleText;
          o.bubbleTimer = c.bubbleTimer || 0;
        }
        o.chillBubbleText = c.chillBubbleText;
        o.chillBubbleTimer = c.chillBubbleTimer || 0;
        o.animFrame = c.animFrame || 0;
        o.animTimer = c.animTimer || 0;
        o.facingLeft = !!c.facingLeft;
        return o;
      }),
    };
    sessionStorage.setItem(BRIDGE_SNAP_KEY, JSON.stringify(snap));
  } catch(e){
    console.warn('captureBridgeSessionForDossiers', e);
  }
};

GAME.tryRestoreBridgeSession = function(){
  try {
    if(typeof sessionStorage === 'undefined') return false;
    var raw = sessionStorage.getItem(BRIDGE_SNAP_KEY);
    if(!raw) return false;
    sessionStorage.removeItem(BRIDGE_SNAP_KEY);
    var snap = JSON.parse(raw);
    if(!snap || snap.v !== 1 || !snap.crew || !snap.state) return false;

    var st = snap.state;
    if(typeof st.tick === 'number') G.state.tick = st.tick;
    if(typeof st.gameHour === 'number') G.state.gameHour = st.gameHour;
    if(typeof st.missionDay === 'number'){
      G.state.missionDay = st.missionDay;
      if(GAME.save && GAME.save.set) GAME.save.set('missionDay', st.missionDay);
    }
    if(typeof st.shipSimMs === 'number') G.state.shipSimMs = st.shipSimMs;
    if(typeof st.pulseTick === 'number') G.state.pulseTick = st.pulseTick;
    if(typeof st.acc === 'number') G.state.acc = st.acc;
    G.state.isNight = !!st.isNight;
    G.state.moveMode = !!st.moveMode;
    G.state.selectedChar = null;
    if(st.selectedCharId){
      var sel = GAME.crew.find(function(x){ return x.id === st.selectedCharId; });
      if(sel) G.state.selectedChar = sel;
    }
    G.state.skipClockResyncOnce = true;

    var aiSnap = snap.ai || {};
    if(typeof aiSnap.chillTimeActive === 'boolean') GAME.ai.chillTimeActive = aiSnap.chillTimeActive;
    if(aiSnap.chillBreakInviteIds !== undefined) GAME.ai.chillBreakInviteIds = aiSnap.chillBreakInviteIds;
    if(Array.isArray(aiSnap._scenesFiredToday)) GAME.ai._scenesFiredToday = aiSnap._scenesFiredToday.slice();
    if(typeof aiSnap._lastHour === 'number') GAME.ai._lastHour = aiSnap._lastHour;
    if(typeof aiSnap._chillCheckTimer === 'number') GAME.ai._chillCheckTimer = aiSnap._chillCheckTimer;
    if(typeof aiSnap._jomanaWasInChill === 'boolean') GAME.ai._jomanaWasInChill = aiSnap._jomanaWasInChill;
    if(typeof aiSnap._chillRoomBanterTimer === 'number') GAME.ai._chillRoomBanterTimer = aiSnap._chillRoomBanterTimer;
    if(typeof aiSnap._lonelySeekTimer === 'number') GAME.ai._lonelySeekTimer = aiSnap._lonelySeekTimer;
    if(typeof aiSnap._chillCrowdTimer === 'number') GAME.ai._chillCrowdTimer = aiSnap._chillCrowdTimer;
    if(typeof aiSnap._exRobIx === 'number') GAME.ai._exRobIx = aiSnap._exRobIx;
    if(typeof aiSnap._exLobbyIx === 'number') GAME.ai._exLobbyIx = aiSnap._exLobbyIx;
    if(typeof aiSnap._exMedRoomIx === 'number') GAME.ai._exMedRoomIx = aiSnap._exMedRoomIx;
    if(typeof aiSnap._exAnyIx === 'number') GAME.ai._exAnyIx = aiSnap._exAnyIx;
    if(typeof aiSnap._messSnapSeq === 'number') GAME.ai._messSnapSeq = aiSnap._messSnapSeq;
    if(typeof aiSnap._transitMessIx === 'number') GAME.ai._transitMessIx = aiSnap._transitMessIx;

    var byId = {};
    GAME.crew.forEach(function(c){ byId[c.id] = c; });
    snap.crew.forEach(function(row){
      var c = byId[row.id];
      if(!c) return;
      if(row.room) c.room = row.room;
      if(row.pos) c.pos = { x: row.pos.x, y: row.pos.y };
      if(row.target) c.target = { x: row.target.x, y: row.target.y };
      else if(c.pos) c.target = { x: c.pos.x, y: c.pos.y };
      if(row.state) c.state = row.state;
      if(typeof row.timer === 'number') c.timer = row.timer;
      if(c.kind === 'robot'){
        if(row.arm) c.arm = { baseAngle: row.arm.baseAngle, foreAngle: row.arm.foreAngle, gripperOpen: !!row.arm.gripperOpen };
        if(typeof row.routeIndex === 'number') c.routeIndex = row.routeIndex;
        if(typeof row.robotMsgTimer === 'number') c.robotMsgTimer = row.robotMsgTimer;
        if(typeof row.graspFailCount === 'number') c.graspFailCount = row.graspFailCount;
        if(typeof row.coffeeMode === 'boolean') c.coffeeMode = row.coffeeMode;
        if(typeof row.chillMode === 'boolean') c.chillMode = row.chillMode;
      } else {
        if(typeof row.sleeping === 'boolean') c.sleeping = row.sleeping;
        if(row.homeRoom) c.homeRoom = row.homeRoom;
        if(typeof row.playerControlled === 'boolean') c.playerControlled = row.playerControlled;
        if(typeof row.playerOverrideUntil === 'number') c.playerOverrideUntil = row.playerOverrideUntil;
        if(row.bubbleText !== undefined) c.bubbleText = row.bubbleText;
        if(typeof row.bubbleTimer === 'number') c.bubbleTimer = row.bubbleTimer;
      }
      if(row.chillBubbleText !== undefined) c.chillBubbleText = row.chillBubbleText;
      if(typeof row.chillBubbleTimer === 'number') c.chillBubbleTimer = row.chillBubbleTimer;
      if(typeof row.animFrame === 'number') c.animFrame = row.animFrame;
      if(typeof row.animTimer === 'number') c.animTimer = row.animTimer;
      if(typeof row.facingLeft === 'boolean') c.facingLeft = row.facingLeft;
    });

    var night = document.getElementById('night-overlay');
    if(night) night.className = G.state.isNight ? 'visible' : '';

    var mb = document.getElementById('move-mode-btn');
    if(mb){
      mb.textContent = G.state.moveMode ? '🚀 MOVE: ON' : '🚀 MOVE CREW';
      mb.className = G.state.moveMode ? 'bottom-btn active' : 'bottom-btn';
    }
    var cb = document.getElementById('chill-btn');
    if(cb){
      if(GAME.ai.chillTimeActive){
        cb.textContent = '☕ BREAK: ON';
        cb.className = 'bottom-btn active';
      } else {
        cb.textContent = '☕ CHILL TIME';
        cb.className = 'bottom-btn';
      }
    }
    return true;
  } catch(e){
    try { if(typeof sessionStorage !== 'undefined') sessionStorage.removeItem(BRIDGE_SNAP_KEY); } catch(x){}
    console.warn('tryRestoreBridgeSession', e);
    return false;
  }
};

/**
 * Optional: extra mess-hall chill script blocks (same shape as entries in js/chatter.js C.CHILL_CONVOS).
 * Each item is an array of { id, text, delay } — id must match js/crew.js (e.g. tarek, omar, zaky, robot).
 * Merged once on first GAME.chatter.init(); use this if you prefer not to edit chatter.js.
 */
GAME.EXTRA_CHILL_CONVOS = GAME.EXTRA_CHILL_CONVOS || [];

var canvas, ctx;

// ─── BOOT ─────────────────────────────────────────────────────────────
function runBoot(){
  // Return from dossiers wall → skip BIOS animation, go straight to bridge
  try {
    if(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('uss_resume_bridge') === '1'){
      sessionStorage.removeItem('uss_resume_bridge');
      finishBoot();
      return;
    }
  } catch(e){}

  var bootScreen = document.getElementById('boot-screen');
  var bootText   = document.getElementById('boot-text');
  var fill       = document.getElementById('boot-progress-fill');
  if(!bootScreen){ finishBoot(); return; }

  var content = '';
  var total = BOOT_LINES.length;
  BOOT_LINES.forEach(function(line, i){
    setTimeout(function(){
      content += line + '\n';
      if(bootText) bootText.textContent = content;
      if(fill) fill.style.width = Math.round((i+1)/total*100) + '%';
      if(GAME.audio) GAME.audio.play('boot_beep');
    }, 200 + i * 200);
  });

  setTimeout(function(){
    if(GAME.audio) GAME.audio.play('boot_done');
    setTimeout(finishBoot, 400);
  }, 200 + BOOT_LINES.length * 200 + 300);
}

function finishBoot(){
  var bootScreen  = document.getElementById('boot-screen');
  var gameWrapper = document.getElementById('game-wrapper');
  if(bootScreen)  bootScreen.classList.add('hidden');
  if(gameWrapper) gameWrapper.classList.remove('hidden');
  G.state.started = true;
  try { startGame(); } catch(e){
    console.error('startGame crash:', e);
    var logEl = document.getElementById('mission-log');
    if(logEl){ var d=document.createElement('div'); d.style.color='#ff2244'; d.textContent='[ERROR] '+e.message; logEl.appendChild(d); }
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────
function startGame(){
  L = GAME.LAYOUT;

  canvas = document.getElementById('game-canvas');
  if(!canvas) throw new Error('game-canvas not found');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  canvas.width  = L.LOGICAL_W;
  canvas.height = L.LOGICAL_H;
  G.state.canvasW = L.LOGICAL_W;
  G.state.canvasH = L.LOGICAL_H;

  // Generate starfield (dense deep-space layer + slow parallax layer)
  for(var i=0; i<1500; i++){
    STARS.push({
      x: Math.random() * L.LOGICAL_W,
      y: Math.random() * L.LOGICAL_H,
      r: Math.random() < 0.75 ? 1 : (Math.random() < 0.60 ? 2 : (Math.random() < 0.5 ? 3 : 4)),
      bright: 0.2 + Math.random() * 0.9,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.06,
      hue: Math.random(),
    });
  }
  for(var j=0; j<800; j++){
    STARS_DEEP.push({
      x: Math.random() * L.LOGICAL_W,
      y: Math.random() * L.LOGICAL_H,
      r: 1,
      bright: 0.05 + Math.random() * 0.35,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.02,
    });
  }

  GAME.save.load();
  G.state.missionDay = GAME.save.get('missionDay') || 1;
  GAME.audio.enabled = GAME.save.get('audioEnabled') !== false;

  GAME.hud.init();
  GAME.ai.init();
  GAME.chatter.init();
  if(!GAME.tryRestoreBridgeSession()){
    GAME.ai.initPositions();
  }

  var ticker = document.getElementById('ticker-track');
  if(ticker){
    var mission = GAME.chatter.getMission(G.state.missionDay);
    ticker.innerHTML = GAME.chatter.buildTickerHTML(G.state.missionDay, mission);
  }

  updateDayNight();

  if((GAME.save.get('totalDays')||1) >= 3) GAME.hud.triggerAchievement('its_alive');

  if(typeof GAME.hud.initRoomLabels === 'function') GAME.hud.initRoomLabels();
  window.addEventListener('resize', function(){
    if(typeof GAME.hud.initRoomLabels === 'function') GAME.hud.initRoomLabels();
  });

  // Events
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mouseleave', function(){
    var tt = document.getElementById('tooltip');
    if(tt) tt.classList.remove('visible');
    G.state.hoverChar = null;
    G.state.hoverDecor = null;
  });

  document.getElementById('modal-overlay').addEventListener('click', function(e){
    if(e.target.id === 'modal-overlay') GAME.hud.closeDossier();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      if(GAME.hud && GAME.hud.closeKonamiCredits) GAME.hud.closeKonamiCredits();
      GAME.hud.closeDossier();
      GAME.hud.closeSettings();
      if(GAME.hud.closeOps) GAME.hud.closeOps();
      if(G.state.moveMode) GAME.toggleMoveMode();
    }
    if(e.key === 'm' || e.key === 'M') GAME.toggleMoveMode();
  });

  setInterval(updateDayNight, 60000);
  setInterval(function(){
    G.state.missionDay++;
    GAME.save.set('missionDay', G.state.missionDay);
    GAME.ai.resetDayScenes();
    var mission2 = GAME.chatter.getMission(G.state.missionDay);
    var t = document.getElementById('ticker-track');
    if(t) t.innerHTML = GAME.chatter.buildTickerHTML(G.state.missionDay, mission2);
    GAME.hud.addLog('SYS', 'Mission day ' + G.state.missionDay + ': ' + mission2, 'log-success');
  }, 30*60*1000);

  G.state.lastTime = performance.now();
  requestAnimationFrame(frame);
}

// ─── LOOP ─────────────────────────────────────────────────────────────
function frame(now){
  var dt = Math.min(now - G.state.lastTime, 150);
  G.state.lastTime = now;
  G.state.acc += dt;
  while(G.state.acc >= TICK){
    try { update(TICK); } catch(e){ console.warn('update err',e); }
    G.state.acc -= TICK;
  }
  try { render(); } catch(e){ console.warn('render err',e); }
  requestAnimationFrame(frame);
}

function update(dt){
  G.state.tick++;
  G.state.pulseTick += dt * 0.001;
  G.state.shipSimMs = (G.state.shipSimMs || 0) + dt;
  GAME.ai.update(dt, G.state.tick, G.state.isNight, G.state.gameHour);
  GAME.chatter.update(dt);
  GAME.hud.updateHUD(G.state.missionDay, G.state.gameHour, G.state.isNight);
}

// ─── RENDER ───────────────────────────────────────────────────────────
function render(){
  if(!L) return;
  var pulse = (Math.sin(G.state.pulseTick) + 1) / 2;
  var tick = G.state.tick;

  // Reset decor hitboxes each frame
  GAME.decorHitboxes = [];

  // ── Space background ─────────────────────────────────────────────
  ctx.fillStyle = '#01030a';
  ctx.fillRect(0, 0, L.LOGICAL_W, L.LOGICAL_H);

  // ── Milky-way dust band (wider, more vivid) ──────────────────────
  try {
    var band = ctx.createLinearGradient(0, L.LOGICAL_H*0.1, L.LOGICAL_W*1.1, L.LOGICAL_H*0.9);
    band.addColorStop(0,    'rgba(20,30,80,0)');
    band.addColorStop(0.25, 'rgba(70,90,200,0.18)');
    band.addColorStop(0.45, 'rgba(120,140,255,0.25)');
    band.addColorStop(0.6,  'rgba(80,100,220,0.18)');
    band.addColorStop(0.8,  'rgba(40,50,140,0.1)');
    band.addColorStop(1,    'rgba(10,15,50,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, L.LOGICAL_W, L.LOGICAL_H);
    // Second crossing band
    var band2 = ctx.createLinearGradient(L.LOGICAL_W, 0, 0, L.LOGICAL_H);
    band2.addColorStop(0,   'rgba(0,0,0,0)');
    band2.addColorStop(0.4, 'rgba(60,30,120,0.1)');
    band2.addColorStop(0.6, 'rgba(30,15,80,0.12)');
    band2.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = band2;
    ctx.fillRect(0, 0, L.LOGICAL_W, L.LOGICAL_H);
  } catch(e){}

  // ── Large Nebulae (5 overlapping clouds) ─────────────────────────
  try {
    // Purple nebula - bottom left
    var neb = ctx.createRadialGradient(L.LOGICAL_W*0.12, L.LOGICAL_H*0.88, 5, L.LOGICAL_W*0.18, L.LOGICAL_H*0.82, 600);
    neb.addColorStop(0,'rgba(180,60,255,0.3)'); neb.addColorStop(0.3,'rgba(120,30,220,0.18)'); neb.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=neb; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
    // Cyan nebula - top right
    var neb2 = ctx.createRadialGradient(L.LOGICAL_W*0.88, L.LOGICAL_H*0.08, 5, L.LOGICAL_W*0.82, L.LOGICAL_H*0.18, 550);
    neb2.addColorStop(0,'rgba(0,220,255,0.3)'); neb2.addColorStop(0.4,'rgba(0,140,220,0.15)'); neb2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=neb2; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
    // Pink nebula - center
    var neb3 = ctx.createRadialGradient(L.LOGICAL_W*0.5, L.LOGICAL_H*0.45, 10, L.LOGICAL_W*0.5, L.LOGICAL_H*0.45, 480);
    neb3.addColorStop(0,'rgba(255,80,180,0.15)'); neb3.addColorStop(0.4,'rgba(180,40,120,0.08)'); neb3.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=neb3; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
    // Orange nebula - bottom right
    var neb4 = ctx.createRadialGradient(L.LOGICAL_W*0.80, L.LOGICAL_H*0.78, 5, L.LOGICAL_W*0.78, L.LOGICAL_H*0.72, 400);
    neb4.addColorStop(0,'rgba(255,150,50,0.2)'); neb4.addColorStop(0.4,'rgba(200,80,20,0.1)'); neb4.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=neb4; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
    // Blue nebula - top left
    var neb5 = ctx.createRadialGradient(L.LOGICAL_W*0.08, L.LOGICAL_H*0.12, 5, L.LOGICAL_W*0.14, L.LOGICAL_H*0.20, 420);
    neb5.addColorStop(0,'rgba(60,130,255,0.22)'); neb5.addColorStop(0.4,'rgba(30,80,220,0.1)'); neb5.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=neb5; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
  } catch(e){}

  // ── Distant ringed planet (larger, more detail) ───────────────────
  try {
    var ppx = L.LOGICAL_W*0.91, ppy = L.LOGICAL_H*0.76, ppr = 90;
    // Atmosphere glow
    var patm = ctx.createRadialGradient(ppx, ppy, ppr*0.8, ppx, ppy, ppr*1.8);
    patm.addColorStop(0,'rgba(100,70,180,0)'); patm.addColorStop(1,'rgba(100,70,180,0.25)');
    ctx.fillStyle=patm; ctx.beginPath(); ctx.arc(ppx,ppy,ppr*1.8,0,Math.PI*2); ctx.fill();
    // Planet body
    var ppg = ctx.createRadialGradient(ppx-35, ppy-35, 6, ppx, ppy, ppr);
    ppg.addColorStop(0,'#9a60b0'); ppg.addColorStop(0.35,'#5a2488'); ppg.addColorStop(0.7,'#2a1040'); ppg.addColorStop(1,'#04020a');
    ctx.fillStyle=ppg; ctx.beginPath(); ctx.arc(ppx,ppy,ppr,0,Math.PI*2); ctx.fill();
    // Cloud bands
    ctx.fillStyle='rgba(180,140,255,0.15)'; ctx.beginPath(); ctx.ellipse(ppx,ppy-25,ppr*0.95,16,0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(120,90,200,0.12)'; ctx.beginPath(); ctx.ellipse(ppx,ppy+20,ppr*0.88,12,-0.05,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(160,100,220,0.08)'; ctx.beginPath(); ctx.ellipse(ppx,ppy+45,ppr*0.6,8,0,0,Math.PI*2); ctx.fill();
    // Ring system (5 rings for detail)
    ctx.save(); ctx.translate(ppx,ppy); ctx.scale(1,0.28); ctx.rotate(-0.1);
    ctx.strokeStyle='rgba(220,190,255,0.50)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,ppr*1.45,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(200,160,240,0.35)'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(0,0,ppr*1.65,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(150,110,220,0.20)'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(0,0,ppr*1.85,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(120,80,200,0.15)'; ctx.lineWidth=12; ctx.beginPath(); ctx.arc(0,0,ppr*2.10,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(80,50,140,0.10)'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(0,0,ppr*2.30,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    // Highlight
    ctx.fillStyle='rgba(220,180,255,0.25)'; ctx.beginPath(); ctx.arc(ppx-35,ppy-35,ppr*0.4,0,Math.PI*2); ctx.fill();
  } catch(e){}

  // ── Moonlet + asteroid belt ───────────────────────────────────────
  try {
    var mx=L.LOGICAL_W*0.07, my=L.LOGICAL_H*0.20, mr=28;
    var mg=ctx.createRadialGradient(mx-8,my-8,3,mx,my,mr);
    mg.addColorStop(0,'#aabbcc'); mg.addColorStop(0.65,'#445060'); mg.addColorStop(1,'#0a0c12');
    ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fill();
    // Crater detail
    ctx.fillStyle='rgba(0,0,0,0.20)'; ctx.beginPath(); ctx.arc(mx+8,my-4,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(mx-5,my+9,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(200,215,230,0.18)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(mx+5,my-4,mr+10,2.0,4.4); ctx.stroke();
    // Asteroid crumbs
    ctx.fillStyle='rgba(130,120,110,0.5)';
    for(var ai=0;ai<28;ai++){
      var aax=mx+Math.cos(ai*0.65)*52+(ai%4)*3, aay=my+Math.sin(ai*0.85)*34+(ai%6);
      ctx.fillRect(Math.floor(aax),Math.floor(aay),1+(ai%3===0?1:0),1);
    }
  } catch(e){}

  // ── Star cluster (top-center) ─────────────────────────────────────
  try {
    var scx=L.LOGICAL_W*0.5, scy=L.LOGICAL_H*0.06;
    for(var sc=0;sc<60;sc++){
      var sang=sc*0.42+0.1, sdist=4+sc*2.2+(sc%5)*3;
      var ssx=scx+Math.cos(sang)*sdist, ssy=scy+Math.sin(sang)*sdist*0.5;
      var ssa=0.3+0.5*Math.sin(tick*0.04+sc*0.3);
      ctx.fillStyle='rgba(220,235,255,'+ssa.toFixed(2)+')';
      ctx.fillRect(Math.floor(ssx),Math.floor(ssy),sc%7===0?2:1,1);
    }
    // Cluster core glow
    var scg=ctx.createRadialGradient(scx,scy,0,scx,scy,40);
    scg.addColorStop(0,'rgba(200,220,255,0.10)'); scg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=scg; ctx.fillRect(scx-50,scy-30,100,60);
  } catch(e){}

  // ── Animated comet streak ─────────────────────────────────────────
  try {
    var cometT = (tick * 1.8) % (L.LOGICAL_W + 300);
    var cx0 = cometT - 150, cy0 = L.LOGICAL_H*0.08 + cometT*0.06;
    if(cx0 > -200 && cx0 < L.LOGICAL_W+50) {
      var cg = ctx.createLinearGradient(cx0-80, cy0-30, cx0+8, cy0+3);
      cg.addColorStop(0,'rgba(180,220,255,0)'); cg.addColorStop(0.6,'rgba(200,230,255,0.35)'); cg.addColorStop(1,'rgba(255,255,255,0.75)');
      ctx.strokeStyle=cg; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx0-80,cy0-30); ctx.lineTo(cx0,cy0); ctx.stroke();
      // Head glow
      ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillRect(cx0,cy0,2,2);
      ctx.fillStyle='rgba(180,220,255,0.3)'; ctx.beginPath(); ctx.arc(cx0,cy0,5,0,Math.PI*2); ctx.fill();
    }
  } catch(e){}

  // ── Stars (distant layer first) ──────────────────────────────────
  STARS_DEEP.forEach(function(star){
    star.twinkle += star.speed;
    var a = star.bright * (0.55 + 0.45 * Math.sin(star.twinkle));
    ctx.fillStyle = 'rgba(160,190,255,' + a.toFixed(3) + ')';
    ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.r, star.r);
  });
  STARS.forEach(function(star){
    star.twinkle += star.speed;
    var alpha = star.bright * (0.6 + 0.4 * Math.sin(star.twinkle));
    var h = star.hue;
    var r = Math.floor(180 + h*60), g = Math.floor(200 + (1-h)*40), b = 255;
    ctx.fillStyle = 'rgba('+r+','+g+','+b+',' + alpha.toFixed(2) + ')';
    ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.r, star.r);
    if(star.r >= 2 && alpha > 0.55){
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha*0.35).toFixed(2) + ')';
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), 1, 1);
    }
    // Cross sparkle on brightest stars
    if(star.r >= 3 && alpha > 0.7){
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha*0.25).toFixed(2) + ')';
      ctx.fillRect(Math.floor(star.x)-2, Math.floor(star.y), 5, 1);
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y)-2, 1, 5);
    }
  });




  // ── Top and bottom bars ──────────────────────────────────────────
  ctx.fillStyle = '#030810';
  ctx.fillRect(0, 0, L.LOGICAL_W, L.TOP_BAR);
  ctx.fillStyle = '#030810';
  ctx.fillRect(0, L.LOGICAL_H - L.BOTTOM_BAR, L.LOGICAL_W, L.BOTTOM_BAR);

  // ── Hull plating background (machinery, pipes, rivets) ─────────
  drawHullBackground(tick);

  // ── Corridor passages (between rooms) ───────────────────────────
  drawCorridors(pulse, tick);

  // ── Rooms ────────────────────────────────────────────────────────
  GAME.rooms.forEach(function(room){
    var cell = GAME.getRoomCell(room);
    GAME.pixel.drawRoom(ctx, room, cell.x, cell.y, cell.w, cell.h, pulse, tick);
    GAME.pixel.drawDecor(ctx, room, cell.x, cell.y, cell.w, cell.h, tick);
  });



  // ── Outer ship hull frame (over rooms, under crew) ───────────────
  drawHullFrame(tick);

  // ── Characters ───────────────────────────────────────────────────
  GAME.crew.forEach(function(char){
    if(!char.pos) return;
    var x = Math.floor(char.pos.x);
    var y = Math.floor(char.pos.y);

    // Hover highlight
    if(G.state.hoverChar && G.state.hoverChar.id === char.id){
      ctx.fillStyle = 'rgba(0,255,136,0.15)';
      ctx.fillRect(x - CHAR_SCALE*2, y - CHAR_SCALE, CHAR_SCALE*10, CHAR_SCALE*12);
    }

    // Selected highlight (move mode)
    if(G.state.selectedChar && G.state.selectedChar.id === char.id){
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - CHAR_SCALE*2 - 2, y - CHAR_SCALE - 2, CHAR_SCALE*10 + 4, CHAR_SCALE*12 + 4);
      // Pulsing selection ring
      ctx.strokeStyle = 'rgba(0,255,136,' + (0.4 + 0.4*Math.sin(G.state.pulseTick*3)) + ')';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - CHAR_SCALE*3, y - CHAR_SCALE*2, CHAR_SCALE*12, CHAR_SCALE*14);
    }

    if(char.kind === 'robot'){
      GAME.pixel.drawRobot(ctx, char, x, y, tick);
    } else {
      var scale = (char.id === 'hemaly') ? CHAR_SCALE + 1 : CHAR_SCALE;
      GAME.pixel.drawCharacter(ctx, char, x - scale*3, y - scale*2, char.animFrame, scale);
      if(char.sleeping) GAME.pixel.drawZzz(ctx, x, y - 8, tick);
    }

    var scB = (char.id === 'hemaly') ? CHAR_SCALE + 1 : CHAR_SCALE;
    var bubbleAnchorX = x + 4;
    var bubbleAnchorY = char.kind === 'robot' ? y - 16 : y - scB * 4 - 8;
    if(char.chillBubbleText){
      var chillAccent = char.kind === 'robot' ? '#88eeff' : '#ffcc88';
      GAME.pixel.drawChillBubble(ctx, bubbleAnchorX, bubbleAnchorY, char.chillBubbleText, chillAccent);
    } else if(char.bubbleText){
      GAME.pixel.drawBubble(ctx, bubbleAnchorX, bubbleAnchorY,
        char.bubbleText,
        char.kind === 'robot' ? '#00d4ff' : '#00ff88');
    }
  });

  // ── Night overlay ────────────────────────────────────────────────
  if(G.state.isNight){
    ctx.fillStyle = 'rgba(0,0,20,0.35)';
    ctx.fillRect(0, L.TOP_BAR, L.LOGICAL_W, L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR);
  }

  // ── Move mode overlay ────────────────────────────────────────────
  if(G.state.moveMode){
    // Dim top bar with mode indicator
    ctx.fillStyle = 'rgba(0,255,136,0.06)';
    ctx.fillRect(0, 0, L.LOGICAL_W, L.TOP_BAR);

    // If a character is selected, highlight rooms as click targets
    if(G.state.selectedChar){
      GAME.rooms.forEach(function(room){
        var cell = GAME.getRoomCell(room);
        ctx.strokeStyle = 'rgba(0,255,136,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cell.x+3, cell.y+3, cell.w-6, cell.h-6);
      });
    }
  }
}

// ─── DRAW CORRIDORS ───────────────────────────────────────────────────
// ─── HULL BACKGROUND (dense machinery filling all gaps) ───────────────
// Cached to an offscreen canvas — only built once.
var HULL_BG = null;
function buildHullBackground(){
  var off = document.createElement('canvas');
  off.width = L.LOGICAL_W; off.height = L.LOGICAL_H;
  var c = off.getContext('2d');
  var x0 = 0, y0 = L.TOP_BAR, w = L.LOGICAL_W, h = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;

  // Base plate + structural undergrid
  c.fillStyle = '#040608';
  c.fillRect(x0, y0, w, h);
  c.strokeStyle = 'rgba(0,60,90,0.12)';
  c.lineWidth = 1;
  for(var gx=x0; gx<x0+w; gx+=32){
    c.beginPath();
    c.moveTo(gx, y0); c.lineTo(gx+18, y0+h);
    c.stroke();
  }

  // Riveted hull plating (16x16 panels — denser greeble)
  var plate = 16;
  for(var py=y0; py<y0+h; py+=plate){
    for(var px=x0; px<x0+w; px+=plate){
      var v = ((px*7 + py*13) % 17) / 17;
      c.fillStyle = v < 0.5 ? '#0a0f16' : '#0c1218';
      c.fillRect(px, py, plate-1, plate-1);
      // panel seam highlight
      c.fillStyle = 'rgba(0,80,120,0.10)';
      c.fillRect(px, py, plate-1, 1);
      c.fillRect(px, py, 1, plate-1);
      // rivets at corners
      c.fillStyle = 'rgba(60,100,140,0.35)';
      c.fillRect(px+2, py+2, 1, 1);
      c.fillRect(px+plate-4, py+2, 1, 1);
      c.fillRect(px+2, py+plate-4, 1, 1);
      c.fillRect(px+plate-4, py+plate-4, 1, 1);
      if(((px+py) % 5) === 0){
        c.strokeStyle = 'rgba(0,212,255,0.07)';
        c.lineWidth = 1;
        c.strokeRect(px+3, py+3, plate-7, plate-7);
      }
    }
  }

  // Heavy I-beam columns (vertical hull stiffeners)
  for(var ib=0; ib<Math.ceil(w/140); ib++){
    var ix = x0 + 50 + ib * 140;
    c.fillStyle = '#080c12';
    c.fillRect(ix, y0, 10, h);
    c.fillStyle = '#121a24';
    c.fillRect(ix+1, y0, 8, h);
    c.fillStyle = '#0a1018';
    c.fillRect(ix, y0, 3, h);
    c.fillRect(ix+7, y0, 3, h);
    c.fillStyle = 'rgba(0,170,220,0.15)';
    for(var iy=y0+8; iy<y0+h; iy+=24){
      c.fillRect(ix+2, iy, 6, 2);
    }
  }

  // Diagonal pipe network spanning the hull
  c.strokeStyle = '#0a2030'; c.lineWidth = 6;
  for(var d=0; d<8; d++){
    c.beginPath();
    c.moveTo(x0 + d*200 - 100, y0);
    c.lineTo(x0 + d*200 + 300, y0+h);
    c.stroke();
  }
  c.strokeStyle = 'rgba(0,170,220,0.18)'; c.lineWidth = 1;
  for(var d2=0; d2<8; d2++){
    c.beginPath();
    c.moveTo(x0 + d2*200 - 100, y0);
    c.lineTo(x0 + d2*200 + 300, y0+h);
    c.stroke();
  }

  // Horizontal main pipes (3 of them)
  for(var hp=0; hp<3; hp++){
    var hpy = y0 + 40 + hp*(h-80)/2;
    c.fillStyle = '#0a1820'; c.fillRect(x0, hpy, w, 8);
    c.fillStyle = '#152838'; c.fillRect(x0, hpy, w, 1);
    c.fillStyle = '#000'; c.fillRect(x0, hpy+7, w, 1);
    c.fillStyle = 'rgba(0,170,220,0.4)'; c.fillRect(x0, hpy+3, w, 1);
    // pipe brackets
    for(var bx=x0+30; bx<x0+w; bx+=80){
      c.fillStyle = '#1a2838';
      c.fillRect(bx, hpy-2, 6, 12);
    }
  }

  // Transformer / junction boxes scattered
  for(var tb=0; tb<24; tb++){
    var tx = x0 + ((tb*157) % (w-30)) + 5;
    var ty = y0 + ((tb*89 + 30) % (h-30)) + 5;
    c.fillStyle = '#0e1a24'; c.fillRect(tx, ty, 18, 14);
    c.strokeStyle = '#1a3040'; c.lineWidth = 1;
    c.strokeRect(tx, ty, 18, 14);
    c.fillStyle = '#001a24'; c.fillRect(tx+2, ty+2, 14, 4);
    c.fillStyle = ['#00d4ff','#ffaa00','#ff4488','#88ff44'][tb%4];
    c.fillRect(tx+3, ty+8, 2, 2);
    c.fillStyle = '#003a4e'; c.fillRect(tx+7, ty+8, 8, 2);
    c.fillStyle = '#1a3040'; c.fillRect(tx+2, ty+12, 14, 1);
  }

  // Vent grilles (horizontal slits)
  for(var vg=0; vg<14; vg++){
    var vx = x0 + ((vg*211) % (w-40));
    var vy = y0 + ((vg*131 + 60) % (h-20));
    c.fillStyle = '#000';
    for(var s=0; s<4; s++){
      c.fillRect(vx, vy + s*3, 30, 1);
    }
    c.strokeStyle = '#1a2838'; c.lineWidth = 1;
    c.strokeRect(vx-1, vy-1, 32, 14);
  }

  // Cable bundles (short curved runs)
  c.lineWidth = 2;
  for(var cb=0; cb<30; cb++){
    var cbx = x0 + ((cb*173) % (w-60));
    var cby = y0 + ((cb*97 + 90) % (h-30));
    c.strokeStyle = ['#3a1a00','#001a3a','#1a001a','#0a2a0a'][cb%4];
    c.beginPath();
    c.moveTo(cbx, cby);
    c.bezierCurveTo(cbx+15, cby+5, cbx+30, cby-5, cbx+50, cby+8);
    c.stroke();
  }

  // Tiny stencil numbers (mech-warehouse vibe)
  c.fillStyle = 'rgba(0,170,220,0.25)';
  c.font = 'bold 8px monospace';
  for(var sn=0; sn<20; sn++){
    var snx = x0 + ((sn*239) % (w-40));
    var sny = y0 + ((sn*167 + 50) % (h-20));
    c.fillText('A-' + (sn*7+13).toString(36).toUpperCase(), snx, sny);
  }

  // Hazard chevrons in a few spots
  for(var hc=0; hc<6; hc++){
    var hcx = x0 + ((hc*317) % (w-60)) + 10;
    var hcy = y0 + ((hc*211 + 100) % (h-20));
    for(var ch=0; ch<5; ch++){
      c.fillStyle = ch%2===0 ? 'rgba(255,180,0,0.35)' : 'rgba(0,0,0,0.5)';
      c.fillRect(hcx + ch*8, hcy, 7, 4);
    }
  }

  // Distant space glints (static — reads as stars through hull / viewports)
  for(var hs=0; hs<520; hs++){
    var sxx = x0 + ((hs*127 + 11) % Math.max(1, w - 3));
    var syy = y0 + ((hs*83 + hs*hs) % Math.max(1, h - 3));
    if(((sxx + syy * 3) & 7) === 0) continue;
    var pal = hs % 5;
    var al = 0.06 + ((hs * 17) % 80) / 800;
    if(pal === 0){ c.fillStyle = 'rgba(255,230,200,'+al.toFixed(3)+')'; }
    else if(pal === 1){ c.fillStyle = 'rgba(180,240,255,'+al.toFixed(3)+')'; }
    else { c.fillStyle = 'rgba(200,210,255,'+al.toFixed(3)+')'; }
    c.fillRect(sxx, syy, (hs % 11 === 0) ? 2 : 1, 1);
  }

  return off;
}

function drawHullBackground(tick){
  if(!HULL_BG){ try { HULL_BG = buildHullBackground(); } catch(e){ return; } }
  ctx.drawImage(HULL_BG, 0, 0);

  // Animated cyan node blinks on top of static layer
  var x0=0, y0=L.TOP_BAR, w=L.LOGICAL_W, h=L.LOGICAL_H-L.TOP_BAR-L.BOTTOM_BAR;
  for(var b=0; b<10; b++){
    var bx = x0 + ((b*263) % (w-10)) + 5;
    var by = y0 + ((b*179 + 40) % (h-10)) + 5;
    var on = Math.sin(tick/25 + b*0.7) > 0.4;
    if(on){
      ctx.fillStyle = 'rgba(0,212,255,0.8)';
      ctx.fillRect(bx, by, 2, 2);
      ctx.fillStyle = 'rgba(0,212,255,0.25)';
      ctx.fillRect(bx-2, by-2, 6, 6);
    }
  }
  // Twinkling hull starlets (animated)
  for(var tw=0; tw<36; tw++){
    var tx = x0 + ((tw*311 + 19) % (w - 4)) + 2;
    var ty = y0 + ((tw*167 + tick) % (h - 4)) + 2;
    var twA = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(tick * 0.08 + tw * 0.9));
    ctx.fillStyle = 'rgba(220,235,255,' + twA.toFixed(3) + ')';
    ctx.fillRect(tx, ty, 1, 1);
    if(twA > 0.28){
      ctx.fillStyle = 'rgba(255,255,255,' + (twA * 0.45).toFixed(3) + ')';
      ctx.fillRect(tx, ty, 1, 1);
    }
  }
}

// ─── CORRIDOR PASSAGES ────────────────────────────────────────────────
function drawCorridors(pulse, tick){
  var playH = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;
  
  // Vertical corridors
  for(var col=0; col<L.COLS-1; col++){
    var cx = col * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W;
    
    // Space depth under floor
    ctx.fillStyle = 'rgba(0,2,5,0.6)';
    ctx.fillRect(cx, L.TOP_BAR, L.CORRIDOR_W, playH);
    for(var st=0; st<40; st++){
      var sx = cx + 2 + ((st*31+tick*0.2)% (L.CORRIDOR_W-4));
      var sy = L.TOP_BAR + ((st*73+tick*2)% playH);
      var sa = 0.2 + 0.6*Math.sin(tick*0.05 + st);
      ctx.fillStyle = 'rgba(180,220,255,'+sa.toFixed(2)+')';
      ctx.fillRect(sx,sy, st%5===0?2:1, st%5===0?2:1);
    }
    
    // Glass floor tiles
    ctx.fillStyle = 'rgba(10,22,34,0.4)';
    for(var ty=L.TOP_BAR; ty<L.TOP_BAR+playH; ty+=16){
      ctx.fillRect(cx+2, ty+2, L.CORRIDOR_W-4, 12);
      // Bevel depth
      ctx.fillStyle = 'rgba(3,8,14,0.7)';
      ctx.fillRect(cx+L.CORRIDOR_W-2, ty+2, 1, 12);
      ctx.fillRect(cx+2, ty+14, L.CORRIDOR_W-4, 1);
      ctx.fillStyle = 'rgba(10,22,34,0.4)';
    }
    // Chevron markings
    ctx.fillStyle = 'rgba(255,200,0,0.15)';
    for(var cy=L.TOP_BAR+20; cy<L.TOP_BAR+playH-20; cy+=40){
      ctx.beginPath();
      ctx.moveTo(cx+L.CORRIDOR_W/2, cy);
      ctx.lineTo(cx+8, cy+10);
      ctx.lineTo(cx+L.CORRIDOR_W-8, cy+10);
      ctx.fill();
    }
    // Overhead piping shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(cx+L.CORRIDOR_W/2-3, L.TOP_BAR, 6, playH);
    // Overhead pipe
    ctx.fillStyle = '#102838';
    ctx.fillRect(cx+L.CORRIDOR_W/2-2, L.TOP_BAR, 4, playH);
    ctx.fillStyle = 'rgba(0,180,240,0.3)';
    ctx.fillRect(cx+L.CORRIDOR_W/2-1, L.TOP_BAR, 1, playH);
    // Pipe energy pulse
    for(var e=0; e<3; e++){
      var ep = (tick*2 + e*80 + col*40) % playH;
      ctx.fillStyle = 'rgba(0,255,255,0.8)';
      ctx.fillRect(cx+L.CORRIDOR_W/2-1, L.TOP_BAR+ep, 2, 8);
    }
    // Side walls
    ctx.fillStyle = '#040810';
    ctx.fillRect(cx, L.TOP_BAR, 4, playH);
    ctx.fillRect(cx+L.CORRIDOR_W-4, L.TOP_BAR, 4, playH);
    // Door frames / junction arches
    for(var row=0; row<L.ROWS; row++){
      var y = L.TOP_BAR + row * (L.CELL_H + L.CORRIDOR_H) + L.CELL_H/2;
      ctx.fillStyle = '#111';
      ctx.fillRect(cx, y-15, 2, 30);
      ctx.fillRect(cx+L.CORRIDOR_W-2, y-15, 2, 30);
      var flash = Math.sin(tick/30 + row + col)>0;
      ctx.fillStyle = flash ? 'rgba(0,255,100,0.6)' : 'rgba(255,50,50,0.6)';
      ctx.fillRect(cx, y-12, 2, 4);
      ctx.fillRect(cx+L.CORRIDOR_W-2, y-12, 2, 4);
    }
  }
  
  // Horizontal corridors
  for(var row2=0; row2<L.ROWS-1; row2++){
    var cy2 = L.TOP_BAR + row2 * (L.CELL_H + L.CORRIDOR_H) + L.CELL_H;
    
    // Space depth under floor
    ctx.fillStyle = 'rgba(0,2,5,0.6)';
    ctx.fillRect(0, cy2, L.LOGICAL_W, L.CORRIDOR_H);
    for(var st2=0; st2<60; st2++){
      var sx2 = ((st2*43+tick*1.5)% L.LOGICAL_W);
      var sy2 = cy2 + 2 + ((st2*19+tick*0.1)% (L.CORRIDOR_H-4));
      var sa2 = 0.2 + 0.6*Math.sin(tick*0.06 + st2);
      ctx.fillStyle = 'rgba(180,220,255,'+sa2.toFixed(2)+')';
      ctx.fillRect(sx2,sy2, st2%4===0?2:1, 1);
    }
    
    // Glass floor tiles
    ctx.fillStyle = 'rgba(10,22,34,0.4)';
    for(var tx=0; tx<L.LOGICAL_W; tx+=16){
      ctx.fillRect(tx+2, cy2+2, 12, L.CORRIDOR_H-4);
      ctx.fillStyle = 'rgba(3,8,14,0.7)';
      ctx.fillRect(tx+14, cy2+2, 1, L.CORRIDOR_H-4);
      ctx.fillRect(tx+2, cy2+L.CORRIDOR_H-2, 12, 1);
      ctx.fillStyle = 'rgba(10,22,34,0.4)';
    }
    // Chevron markings
    ctx.fillStyle = 'rgba(255,200,0,0.15)';
    for(var hx=20; hx<L.LOGICAL_W-20; hx+=40){
      ctx.beginPath();
      ctx.moveTo(hx, cy2+L.CORRIDOR_H/2);
      ctx.lineTo(hx+10, cy2+8);
      ctx.lineTo(hx+10, cy2+L.CORRIDOR_H-8);
      ctx.fill();
    }
    // Overhead pipe
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, cy2+L.CORRIDOR_H/2-3, L.LOGICAL_W, 6);
    ctx.fillStyle = '#102838';
    ctx.fillRect(0, cy2+L.CORRIDOR_H/2-2, L.LOGICAL_W, 4);
    ctx.fillStyle = 'rgba(0,180,240,0.3)';
    ctx.fillRect(0, cy2+L.CORRIDOR_H/2-1, L.LOGICAL_W, 1);
    // Energy pulse
    for(var e2=0; e2<6; e2++){
      var ep2 = (tick*2 + e2*80 + row2*40) % L.LOGICAL_W;
      ctx.fillStyle = 'rgba(0,255,255,0.8)';
      ctx.fillRect(ep2, cy2+L.CORRIDOR_H/2-1, 8, 2);
    }
    // Side walls
    ctx.fillStyle = '#040810';
    ctx.fillRect(0, cy2, L.LOGICAL_W, 4);
    ctx.fillRect(0, cy2+L.CORRIDOR_H-4, L.LOGICAL_W, 4);
    // Door frames / junction arches
    for(var col2=0; col2<L.COLS; col2++){
      var x = col2 * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W/2;
      ctx.fillStyle = '#111';
      ctx.fillRect(x-15, cy2, 30, 2);
      ctx.fillRect(x-15, cy2+L.CORRIDOR_H-2, 30, 2);
    }
    
    // Intersection Nodes
    for(var col3=0; col3<L.COLS-1; col3++){
      var nx = col3 * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W;
      ctx.fillStyle = '#08121a';
      ctx.fillRect(nx, cy2, L.CORRIDOR_W, L.CORRIDOR_H);
      ctx.strokeStyle = '#040810'; ctx.lineWidth = 2;
      ctx.strokeRect(nx+4, cy2+4, L.CORRIDOR_W-8, L.CORRIDOR_H-8);
      ctx.fillStyle = '#00d4ff';
      ctx.fillRect(nx+L.CORRIDOR_W/2-2, cy2+L.CORRIDOR_H/2-2, 4, 4);
      if(Math.sin(tick/20 + col3 + row2)>0.5){
        ctx.fillStyle = 'rgba(0,212,255,0.3)';
        ctx.fillRect(nx+L.CORRIDOR_W/2-8, cy2+L.CORRIDOR_H/2-8, 16, 16);
      }
    }
  }
}

// ─── HULL FRAME / 3D SHIP BODY ────────────────────────────────────────
function darkenHex(col){ return col.replace(/[0-9a-f]{2}/gi,function(c){ var n=parseInt(c,16); return ('0'+Math.max(0,n-120).toString(16)).slice(-2); }); }

function drawHullFrame(tick){
  var playH = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;
  var W = L.LOGICAL_W;
  var x0 = 0, y0 = L.TOP_BAR, w = W, h = playH;

  // Base outer armor bevel (thicker and darker)
  ctx.strokeStyle = '#040a12'; ctx.lineWidth = 14;
  ctx.strokeRect(x0+7, y0+7, w-14, h-14);
  ctx.strokeStyle = '#081422'; ctx.lineWidth = 8;
  ctx.strokeRect(x0+4, y0+4, w-8, h-8);
  ctx.strokeStyle = 'rgba(0,180,255,0.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(x0+12, y0+12, w-24, h-24);

  // TOP HULL — armored nose plate (with lots of details)
  ctx.fillStyle = '#060e18'; ctx.fillRect(x0, y0, w, 14);
  for(var tp=0; tp<w; tp+=40){
    ctx.fillStyle = tp%80===0 ? '#0a1824' : '#080e1c';
    ctx.fillRect(x0+tp, y0, 38, 12);
    ctx.fillStyle='rgba(0,200,255,0.2)'; ctx.fillRect(x0+tp, y0, 38, 2);
    ctx.fillStyle='rgba(80,180,220,0.6)';
    ctx.fillRect(x0+tp+4, y0+4, 3, 3); ctx.fillRect(x0+tp+32, y0+4, 3, 3);
    ctx.fillStyle='#000'; ctx.fillRect(x0+tp+4, y0+7, 3, 1); ctx.fillRect(x0+tp+32, y0+7, 3, 1);
  }
  
  // Sensor arrays & comms dishes top-center
  var sa=w/2;
  ctx.fillStyle='#0a1830'; ctx.fillRect(sa-60, y0-12, 120, 14);
  ctx.fillStyle='rgba(0,220,255,0.7)'; ctx.fillRect(sa-58, y0-10, 116, 2);
  [-45,-25,-5,15,35].forEach(function(ax,ai){
    // Antenna spires
    ctx.fillStyle='#1a3050'; ctx.fillRect(sa+ax-2, y0-24+ai%2*6, 4, 18);
    // Blinking lights
    var active = Math.sin(tick/15+ai*1.2)>0.2;
    ctx.fillStyle = active ? (ai%2===0?'#ff1133':'#00ffbb') : (ai%2===0?'#440011':'#003311');
    ctx.fillRect(sa+ax-2, y0-24+ai%2*6, 4, 4);
    if(active){
      ctx.fillStyle = ai%2===0?'rgba(255,17,51,0.3)':'rgba(0,255,187,0.3)';
      ctx.fillRect(sa+ax-6, y0-28+ai%2*6, 12, 12);
    }
  });

  // BOTTOM HULL — engine pods (larger, extremely bright)
  var ey = y0+h;
  ctx.fillStyle='#060e18'; ctx.fillRect(x0, ey-12, w, 16);
  var CW=L.CELL_W, CRW=L.CORRIDOR_W, podW=72, podH=48;
  [0,1,2,3].forEach(function(pi){
    var podX = pi*(CW+CRW)+CW*0.5-podW/2;
    // Engine mount block
    var pgh=ctx.createLinearGradient(podX,ey-4,podX,ey+podH);
    pgh.addColorStop(0,'#2a3848'); pgh.addColorStop(0.3,'#162432'); pgh.addColorStop(1,'#040810');
    ctx.fillStyle=pgh; ctx.fillRect(podX,ey-4,podW,podH);
    ctx.strokeStyle='rgba(0,200,255,0.7)'; ctx.lineWidth=2;
    ctx.strokeRect(podX+4,ey+2,podW-8,podH-10);
    ctx.fillStyle='#000'; ctx.fillRect(podX+10,ey+8,podW-20,podH-18);
    // Super bright core glow
    var ei=0.75+0.25*Math.sin(tick/8+pi*0.9);
    try{
      var eg=ctx.createRadialGradient(podX+podW/2,ey+12,2,podX+podW/2,ey+12,(podW-20)*0.8);
      eg.addColorStop(0,'rgba(200,240,255,'+ei.toFixed(2)+')');
      eg.addColorStop(0.3,'rgba(80,180,255,'+(ei*0.8).toFixed(2)+')');
      eg.addColorStop(0.7,'rgba(0,80,220,'+(ei*0.4).toFixed(2)+')');
      eg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=eg; ctx.fillRect(podX+10,ey+6,podW-20,podH-14);
    }catch(e2){}
    // Particle exhaust plumes
    for(var ep=0;ep<12;ep++){
      var py2=ey+podH+((tick*5+ep*10+pi*40)%45);
      var pa=(1-py2/(ey+podH+45))*0.8*ei;
      ctx.fillStyle='rgba(120,200,255,'+Math.max(0,pa).toFixed(3)+')';
      ctx.fillRect(podX+podW/2-10+(ep%3)*8,ey+podH-4+ep*4,6,6);
    }
    // Hazard tape on engines
    for(var hz=0; hz<podW; hz+=12){
      ctx.fillStyle = 'rgba(255,200,0,0.8)';
      ctx.beginPath(); ctx.moveTo(podX+hz, ey-4); ctx.lineTo(podX+hz+6, ey-4); ctx.lineTo(podX+hz+10, ey); ctx.lineTo(podX+hz+4, ey); ctx.fill();
    }
    // Label
    ctx.fillStyle='rgba(0,220,255,0.6)'; ctx.font='bold 8px monospace'; ctx.textAlign='center';
    ctx.fillText('ENG-'+(pi+1),podX+podW/2,ey+1);
    ctx.textAlign='left';
  });

  // SIDE WINGS — Left
  ctx.fillStyle='#08101c'; ctx.fillRect(x0,y0+14,16,h-28);
  ctx.fillStyle='rgba(0,180,240,0.3)'; ctx.fillRect(x0+14,y0+16,2,h-32);
  for(var wr=y0+40;wr<y0+h-40;wr+=32){
    ctx.fillStyle='#12243a'; ctx.fillRect(x0,wr,16,6);
    ctx.fillStyle='rgba(0,200,255,0.4)'; ctx.fillRect(x0,wr,16,2);
  }
  // Windows
  [0,1,2,3].forEach(function(wp){
    var wpy=y0+80+wp*(h-160)/3, gw=0.5+0.4*Math.sin(tick/20+wp);
    ctx.fillStyle='#000408'; ctx.fillRect(x0+2,wpy-6,10,12);
    ctx.fillStyle='rgba(0,220,255,'+gw.toFixed(2)+')'; ctx.fillRect(x0+4,wpy-4,6,8);
    ctx.strokeStyle='rgba(0,200,255,0.8)'; ctx.lineWidth=2; ctx.strokeRect(x0+2,wpy-6,10,12);
  });

  // SIDE WINGS — Right
  ctx.fillStyle='#08101c'; ctx.fillRect(x0+w-16,y0+14,16,h-28);
  ctx.fillStyle='rgba(0,180,240,0.3)'; ctx.fillRect(x0+w-16,y0+16,2,h-32);
  for(var wr2=y0+40;wr2<y0+h-40;wr2+=32){
    ctx.fillStyle='#12243a'; ctx.fillRect(x0+w-16,wr2,16,6);
    ctx.fillStyle='rgba(0,200,255,0.4)'; ctx.fillRect(x0+w-16,wr2,16,2);
  }
  [0,1,2,3].forEach(function(wp2){
    var wpy2=y0+80+wp2*(h-160)/3, gw2=0.5+0.4*Math.sin(tick/20+wp2+1);
    ctx.fillStyle='#000408'; ctx.fillRect(x0+w-12,wpy2-6,10,12);
    ctx.fillStyle='rgba(0,220,255,'+gw2.toFixed(2)+')'; ctx.fillRect(x0+w-10,wpy2-4,6,8);
    ctx.strokeStyle='rgba(0,200,255,0.8)'; ctx.lineWidth=2; ctx.strokeRect(x0+w-12,wpy2-6,10,12);
  });

  // HEAVY CORNER BRACKETS
  var brSize=36;
  var navColors=['#ff1133','#ff1133','#00ffaa','#ffffff'];
  [[x0,y0],[x0+w-brSize,y0],[x0,y0+h-brSize],[x0+w-brSize,y0+h-brSize]].forEach(function(p,i){
    ctx.fillStyle='#0a1828'; ctx.fillRect(p[0],p[1],brSize,brSize);
    ctx.strokeStyle='rgba(0,230,255,0.8)'; ctx.lineWidth=2;
    ctx.strokeRect(p[0]+4,p[1]+4,brSize-8,brSize-8);
    // Hazard stripes
    ctx.fillStyle = 'rgba(255,200,0,0.7)';
    ctx.beginPath(); ctx.moveTo(p[0]+4,p[1]+4); ctx.lineTo(p[0]+12,p[1]+4); ctx.lineTo(p[0]+4,p[1]+12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p[0]+brSize-4,p[1]+brSize-4); ctx.lineTo(p[0]+brSize-12,p[1]+brSize-4); ctx.lineTo(p[0]+brSize-4,p[1]+brSize-12); ctx.fill();
    
    // Blinking corner light
    var navOn=Math.sin(tick/12+i*1.5)>0;
    ctx.fillStyle=navOn?navColors[i]:'#111';
    ctx.fillRect(p[0]+brSize/2-3,p[1]+brSize/2-3,6,6);
    if(navOn){
      ctx.fillStyle='rgba('+parseInt(navColors[i].slice(1,3),16)+','+parseInt(navColors[i].slice(3,5),16)+','+parseInt(navColors[i].slice(5,7),16)+',0.4)';
      ctx.fillRect(p[0]+brSize/2-10,p[1]+brSize/2-10,20,20);
    }
  });

  // INNER GLOW FRAME & WIRING
  ctx.strokeStyle='rgba(0,220,255,0.2)'; ctx.lineWidth=2;
  ctx.strokeRect(x0+18,y0+18,w-36,h-36);
  // Red emergency wire
  ctx.strokeStyle='rgba(255,50,50,0.5)'; ctx.lineWidth=1;
  ctx.strokeRect(x0+21,y0+21,w-42,h-42);
}





// ─── MOUSE ────────────────────────────────────────────────────────────
function canvasPt(e){
  var rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (L.LOGICAL_W / rect.width),
    y: (e.clientY - rect.top)  * (L.LOGICAL_H / rect.height),
  };
}

function charAt(px, py){
  var best = null, bestD = 62;
  var sc = typeof CHAR_SCALE !== 'undefined' ? CHAR_SCALE : 6;
  GAME.crew.forEach(function(c){
    if(!c.pos) return;
    var cx = c.pos.x + sc * 3;
    var cy = c.pos.y + sc * 4;
    var dx = px - cx;
    var dy = py - cy;
    var d = Math.sqrt(dx*dx + dy*dy);
    if(d < bestD){ bestD = d; best = c; }
  });
  return best;
}

function roomAt(px, py){
  for(var i=0; i<GAME.rooms.length; i++){
    var room = GAME.rooms[i];
    var cell = GAME.getRoomCell(room);
    if(px >= cell.x && px <= cell.x+cell.w && py >= cell.y && py <= cell.y+cell.h){
      return room;
    }
  }
  return null;
}

function decorAt(px, py){
  if(!GAME.decorHitboxes) return null;
  for(var i=0; i<GAME.decorHitboxes.length; i++){
    var hb = GAME.decorHitboxes[i];
    if(px >= hb.sx && px <= hb.sx+hb.sw && py >= hb.sy && py <= hb.sy+hb.sh){
      return hb;
    }
  }
  return null;
}

function onMouseMove(e){
  var pt = canvasPt(e);
  var ch = charAt(pt.x, pt.y);
  var dc = decorAt(pt.x, pt.y);
  var tt = document.getElementById('tooltip');

  G.state.hoverChar  = ch;
  G.state.hoverDecor = dc;

  if(!tt) return;

  if(ch){
    var line = pickFrom(ch.lines.hover);
    if(!tt.classList.contains('visible')) GAME.audio.play('hover');
    var moveTip = G.state.moveMode ? '<div style="font-size:0.6rem;color:#00ff88;margin-top:3px">[MOVE MODE] Click to select</div>' : '';
    tt.innerHTML = '<div class="tt-name">'+ch.displayName+'</div><div class="tt-role">'+ch.role+'</div><div class="tt-line">'+line+'</div>'+moveTip;
    tt.classList.add('visible');
    tt.style.left = (e.clientX+16)+'px';
    tt.style.top  = (e.clientY-10)+'px';
  } else if(dc){
    var label = (GAME.DECOR_LABELS && GAME.DECOR_LABELS[dc.id]) || dc.id;
    tt.innerHTML = '<div class="tt-name" style="color:#ffbb66">'+label+'</div><div class="tt-role">'+((GAME.roomMap[dc.roomId]||{}).name||dc.roomId)+'</div>';
    tt.classList.add('visible');
    tt.style.left = (e.clientX+16)+'px';
    tt.style.top  = (e.clientY-10)+'px';

    var dkey = dc.roomId + '/' + dc.id;
    if(dkey !== G.state.lastDecorHoverKey){
      G.state.lastDecorHoverKey = dkey;
      var seen = GAME.save.get('decorSeenKeys');
      if(!Array.isArray(seen)) seen = [];
      if(seen.indexOf(dkey) === -1){
        seen.push(dkey);
        if(seen.length > 80) seen = seen.slice(-80);
        GAME.save.set('decorSeenKeys', seen);
        if(seen.length >= 10 && GAME.hud && GAME.hud.triggerAchievement){
          GAME.hud.triggerAchievement('systems_tour');
        }
      }
    }
  } else {
    tt.classList.remove('visible');
  }
}

function onClick(e){
  var pt = canvasPt(e);

  if(G.state.moveMode){
    var ch = charAt(pt.x, pt.y);

    if(G.state.selectedChar){
      // Character already selected — clicking same char deselects; clicking anywhere else moves
      if(ch && ch.id === G.state.selectedChar.id){
        G.state.selectedChar = null;
        GAME.hud.addLog('MOVE', 'Deselected ' + ch.displayName, '');
      } else {
        // Move to the room at click point (priority: room destination beats nearby char)
        var targetRoom = roomAt(pt.x, pt.y);
        if(targetRoom){
          GAME.audio.play('click');
          GAME.ai.moveCharToRoom(G.state.selectedChar, targetRoom);
          G.state.selectedChar = null;
        } else if(ch && ch.kind !== 'robot'){
          // Clicked outside any room on a different character — switch selection
          G.state.selectedChar = ch;
          GAME.audio.play('click');
          GAME.hud.addLog('MOVE', 'Selected: ' + ch.displayName + ' — click a room to move them.', '');
        }
      }
    } else {
      // Nothing selected — pick a character
      if(ch && ch.kind !== 'robot'){
        G.state.selectedChar = ch;
        GAME.audio.play('click');
        GAME.hud.addLog('MOVE', 'Selected: ' + ch.displayName + ' — click a room to move them.', '');
      }
    }
  } else {
    // Normal mode: click character → open dossier
    var ch2 = charAt(pt.x, pt.y);
    if(ch2){
      GAME.audio.play('click');
      var tt2 = document.getElementById('tooltip');
      if(tt2) tt2.classList.remove('visible');
      GAME.hud.openDossier(ch2.id);
    }
  }
}

// ─── MOVE MODE TOGGLE ─────────────────────────────────────────────────
GAME.toggleMoveMode = function(){
  G.state.moveMode = !G.state.moveMode;
  G.state.selectedChar = null;
  var btn = document.getElementById('move-mode-btn');
  if(btn){
    btn.textContent = G.state.moveMode ? '🚀 MOVE: ON' : '🚀 MOVE CREW';
    btn.className = G.state.moveMode ? 'bottom-btn active' : 'bottom-btn';
  }
  if(G.state.moveMode){
    GAME.hud.addLog('SYS', 'MOVE MODE ON — click a crew member, then click a room.', 'log-success');
  } else {
    GAME.hud.addLog('SYS', 'MOVE MODE OFF.', '');
  }
};

// ─── DAY/NIGHT ────────────────────────────────────────────────────────
function updateDayNight(){
  if(G.state.skipClockResyncOnce){
    G.state.skipClockResyncOnce = false;
  } else {
    G.state.gameHour = new Date().getHours();
  }
  var wasNight = G.state.isNight;
  // Default: always day lighting for the bridge view. (Optional real-night window removed — use Settings if we add a toggle later.)
  G.state.isNight = false;
  var night = document.getElementById('night-overlay');
  if(night) night.className = G.state.isNight ? 'visible' : '';
  if(!wasNight && G.state.isNight) document.dispatchEvent(new Event('nightmode-enter'));
}

// ─── UTIL ─────────────────────────────────────────────────────────────
function trunc(s, n){ return s.length>n ? s.slice(0,n-1)+'…' : s; }
function pickFrom(arr){ if(!arr||!arr.length) return '...'; return arr[Math.floor(Math.random()*arr.length)]; }

// ─── GLOBAL ACTIONS ───────────────────────────────────────────────────
GAME.openDossiers = function(){
  if(typeof GAME.captureBridgeSessionForDossiers === 'function') GAME.captureBridgeSessionForDossiers();
  window.location.href = 'dossiers.html';
};
GAME.openSettings    = function(){ GAME.hud.openSettings(); };
GAME.closeSettings   = function(){ GAME.hud.closeSettings(); };
GAME.toggleAudio     = function(){ GAME.hud.toggleAudio(); };

// ─── START ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function(){ runBoot(); });

})();
