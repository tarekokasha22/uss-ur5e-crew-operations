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
  hoverChar: null,
  hoverDecor: null,
  lastTime: 0,
  acc: 0,
  pulseTick: 0,
  started: false,
  moveMode: false,
  selectedChar: null,
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
  for(var i=0; i<620; i++){
    STARS.push({
      x: Math.random() * L.LOGICAL_W,
      y: Math.random() * L.LOGICAL_H,
      r: Math.random() < 0.62 ? 1 : (Math.random() < 0.52 ? 2 : 3),
      bright: 0.2 + Math.random() * 0.8,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.012 + Math.random() * 0.045,
      hue: Math.random(),
    });
  }
  for(var j=0; j<180; j++){
    STARS_DEEP.push({
      x: Math.random() * L.LOGICAL_W,
      y: Math.random() * L.LOGICAL_H,
      r: 1,
      bright: 0.08 + Math.random() * 0.22,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.004 + Math.random() * 0.012,
    });
  }

  GAME.save.load();
  G.state.missionDay = GAME.save.get('missionDay') || 1;
  GAME.audio.enabled = GAME.save.get('audioEnabled') !== false;

  GAME.hud.init();
  GAME.ai.init();
  GAME.chatter.init();
  GAME.ai.initPositions();

  var ticker = document.getElementById('ticker-track');
  if(ticker){
    var mission = GAME.chatter.getMission(G.state.missionDay);
    ticker.innerHTML = GAME.chatter.buildTickerHTML(G.state.missionDay, mission);
  }

  updateDayNight();

  if((GAME.save.get('totalDays')||1) >= 3) GAME.hud.triggerAchievement('its_alive');

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
      GAME.hud.closeDossier();
      GAME.hud.closeSettings();
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
  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, L.LOGICAL_W, L.LOGICAL_H);

  // ── Milky-way style dust band ────────────────────────────────────
  try {
    var band = ctx.createLinearGradient(0, L.LOGICAL_H*0.2, L.LOGICAL_W*1.1, L.LOGICAL_H*0.95);
    band.addColorStop(0, 'rgba(30,40,90,0)');
    band.addColorStop(0.35, 'rgba(45,55,120,0.07)');
    band.addColorStop(0.52, 'rgba(80,90,160,0.11)');
    band.addColorStop(0.68, 'rgba(40,50,100,0.06)');
    band.addColorStop(1, 'rgba(20,25,60,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, L.LOGICAL_W, L.LOGICAL_H);
  } catch(e){}

  // ── Nebula glow ──────────────────────────────────────────────────
  try {
    var neb = ctx.createRadialGradient(L.LOGICAL_W*0.18, L.LOGICAL_H*0.85, 10, L.LOGICAL_W*0.18, L.LOGICAL_H*0.85, 480);
    neb.addColorStop(0,'rgba(120,40,180,0.18)');
    neb.addColorStop(0.5,'rgba(40,80,180,0.08)');
    neb.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = neb; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
    var neb2 = ctx.createRadialGradient(L.LOGICAL_W*0.85, L.LOGICAL_H*0.15, 10, L.LOGICAL_W*0.85, L.LOGICAL_H*0.15, 420);
    neb2.addColorStop(0,'rgba(0,160,200,0.14)');
    neb2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = neb2; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
    var neb3 = ctx.createRadialGradient(L.LOGICAL_W*0.48, L.LOGICAL_H*0.42, 20, L.LOGICAL_W*0.48, L.LOGICAL_H*0.42, 380);
    neb3.addColorStop(0,'rgba(255,80,140,0.06)');
    neb3.addColorStop(0.45,'rgba(100,40,120,0.05)');
    neb3.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = neb3; ctx.fillRect(0,0,L.LOGICAL_W,L.LOGICAL_H);
  } catch(e){}

  // ── Distant planet ───────────────────────────────────────────────
  try {
    var px = L.LOGICAL_W*0.92, py = L.LOGICAL_H*0.78, pr = 70;
    var pg = ctx.createRadialGradient(px-20, py-20, 5, px, py, pr);
    pg.addColorStop(0,'#5a3a78'); pg.addColorStop(0.6,'#2a1448'); pg.addColorStop(1,'#06030c');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
    // ring
    ctx.strokeStyle = 'rgba(180,140,220,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(px,py,pr*1.5,pr*0.35,-0.4,0,Math.PI*2); ctx.stroke();
  } catch(e){}

  // ── Second moonlet + asteroid crumbs ────────────────────────────
  try {
    var mx = L.LOGICAL_W*0.08, my = L.LOGICAL_H*0.22, mr = 22;
    var mg = ctx.createRadialGradient(mx-6, my-6, 2, mx, my, mr);
    mg.addColorStop(0,'#8899aa'); mg.addColorStop(0.7,'#3a4550'); mg.addColorStop(1,'#0a0c10');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,210,220,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(mx+4,my-3,mr+8,2.1,4.2); ctx.stroke();
    ctx.fillStyle = 'rgba(140,130,120,0.35)';
    for(var ai=0; ai<18; ai++){
      var ax = mx + Math.cos(ai*0.7)*38 + (ai%3)*4;
      var ay = my + Math.sin(ai*0.9)*28 + (ai%5);
      ctx.fillRect(Math.floor(ax), Math.floor(ay), 1+(ai%2), 1);
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

  // Subtle star glint over entire playfield (space light bleeding through hull)
  drawPlayfieldStarDust(tick);

  // ── Space depth through corridors (stars / dust visible in "windows") ──
  drawCorridorSpaceDepth(tick);

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

function drawCorridors(pulse, tick){
  var playH = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;

  // Vertical corridors (between columns)
  for(var col=0; col<L.COLS-1; col++){
    var cx = col * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W;
    // Subtle dark wash so hull machinery shows through
    ctx.fillStyle = 'rgba(2,5,10,0.55)';
    ctx.fillRect(cx, L.TOP_BAR, L.CORRIDOR_W, playH);
    // Open-deck grating (vertical shaft look)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for(var gy=L.TOP_BAR+3; gy<L.TOP_BAR+playH; gy+=4){
      ctx.fillRect(cx+1, gy, L.CORRIDOR_W-2, 2);
    }
    ctx.strokeStyle = 'rgba(35,70,100,0.4)';
    ctx.lineWidth = 1;
    for(var gx2=cx+2; gx2<cx+L.CORRIDOR_W-1; gx2+=3){
      ctx.beginPath();
      ctx.moveTo(gx2, L.TOP_BAR+2);
      ctx.lineTo(gx2, L.TOP_BAR+playH-2);
      ctx.stroke();
    }
    // Side handrails
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx+0.5, L.TOP_BAR+8);
    ctx.lineTo(cx+0.5, L.TOP_BAR+playH-8);
    ctx.moveTo(cx+L.CORRIDOR_W-0.5, L.TOP_BAR+8);
    ctx.lineTo(cx+L.CORRIDOR_W-0.5, L.TOP_BAR+playH-8);
    ctx.stroke();
    // Cyan conduit pipes (twin)
    ctx.fillStyle = '#001824';
    ctx.fillRect(cx+3, L.TOP_BAR, 2, playH);
    ctx.fillRect(cx+L.CORRIDOR_W-5, L.TOP_BAR, 2, playH);
    // Glow edges
    ctx.fillStyle = 'rgba(0,170,220,0.22)';
    ctx.fillRect(cx, L.TOP_BAR, 2, playH);
    ctx.fillRect(cx + L.CORRIDOR_W - 2, L.TOP_BAR, 2, playH);
    // Flowing energy particles in pipes
    for(var k=0;k<6;k++){
      var ph = ((tick*2 + k*40 + col*17) % (playH+40)) - 20;
      var py = L.TOP_BAR + ph;
      ctx.fillStyle = 'rgba(0,212,255,0.9)';
      ctx.fillRect(cx+3, py, 2, 6);
      ctx.fillStyle = 'rgba(120,240,255,0.6)';
      ctx.fillRect(cx+L.CORRIDOR_W-5, L.TOP_BAR + ((ph+playH/2)%(playH+40))-20, 2, 6);
    }
    // Rib/segment rivets
    for(var ry=L.TOP_BAR+12; ry<L.TOP_BAR+playH; ry+=24){
      ctx.fillStyle = 'rgba(80,140,180,0.45)';
      ctx.fillRect(cx+1, ry, L.CORRIDOR_W-2, 1);
      ctx.fillStyle = '#0a2030';
      ctx.fillRect(cx+1, ry+2, 1, 1); ctx.fillRect(cx+L.CORRIDOR_W-2, ry+2, 1, 1);
    }
    // Junction nodes
    for(var row=0; row<L.ROWS; row++){
      var dotY = L.TOP_BAR + row * (L.CELL_H + L.CORRIDOR_H) + Math.floor(L.CELL_H/2);
      var on = Math.sin(tick/40 + col + row) > 0.3;
      ctx.fillStyle = on ? '#00d4ff' : '#003355';
      ctx.fillRect(cx + Math.floor(L.CORRIDOR_W/2) - 3, dotY - 3, 6, 6);
      if(on){
        ctx.fillStyle = 'rgba(0,212,255,0.25)';
        ctx.fillRect(cx + Math.floor(L.CORRIDOR_W/2) - 6, dotY - 6, 12, 12);
      }
    }
  }

  // Horizontal corridors (between rows)
  for(var row2=0; row2<L.ROWS-1; row2++){
    var cy = L.TOP_BAR + row2 * (L.CELL_H + L.CORRIDOR_H) + L.CELL_H;
    ctx.fillStyle = 'rgba(2,5,10,0.55)';
    ctx.fillRect(0, cy, L.LOGICAL_W, L.CORRIDOR_H);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for(var gxh=4; gxh<L.LOGICAL_W; gxh+=5){
      ctx.fillRect(gxh, cy+1, 2, L.CORRIDOR_H-2);
    }
    ctx.strokeStyle = 'rgba(40,75,100,0.35)';
    ctx.lineWidth = 1;
    for(var gyh=cy+2; gyh<cy+L.CORRIDOR_H-1; gyh+=3){
      ctx.beginPath();
      ctx.moveTo(2, gyh);
      ctx.lineTo(L.LOGICAL_W-2, gyh);
      ctx.stroke();
    }
    // Twin conduit pipes
    ctx.fillStyle = '#001824';
    ctx.fillRect(0, cy+3, L.LOGICAL_W, 2);
    ctx.fillRect(0, cy+L.CORRIDOR_H-5, L.LOGICAL_W, 2);
    ctx.fillStyle = 'rgba(0,170,220,0.22)';
    ctx.fillRect(0, cy, L.LOGICAL_W, 2);
    ctx.fillRect(0, cy + L.CORRIDOR_H - 2, L.LOGICAL_W, 2);
    // Flowing energy
    for(var k2=0;k2<10;k2++){
      var phx = ((tick*3 + k2*60 + row2*23) % (L.LOGICAL_W+40)) - 20;
      ctx.fillStyle = 'rgba(0,212,255,0.9)';
      ctx.fillRect(phx, cy+3, 6, 2);
      ctx.fillStyle = 'rgba(120,240,255,0.6)';
      ctx.fillRect((phx+L.LOGICAL_W/2)%(L.LOGICAL_W+40)-20, cy+L.CORRIDOR_H-5, 6, 2);
    }
    // Hazard stripes near junctions
    for(var hx=0; hx<L.LOGICAL_W; hx+=48){
      ctx.fillStyle = 'rgba(255,180,0,0.10)';
      ctx.fillRect(hx, cy+Math.floor(L.CORRIDOR_H/2)-1, 24, 2);
    }
    // Junction dots at corridor intersections
    for(var col2=0; col2<L.COLS-1; col2++){
      var jx = col2 * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W + Math.floor(L.CORRIDOR_W/2);
      var jy = cy + Math.floor(L.CORRIDOR_H/2);
      ctx.fillStyle = 'rgba(0,212,255,0.5)';
      ctx.fillRect(jx-4, jy-4, 8, 8);
      ctx.fillStyle = '#aaffff';
      ctx.fillRect(jx-1, jy-1, 2, 2);
      ctx.strokeStyle = 'rgba(0,212,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(jx-7, jy-7, 14, 14);
    }
  }

  // Bright starfield in corridor voids (on top of corridor shading — reads as open space)
  var yTop = L.TOP_BAR;
  var playH2 = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;
  for(var colS = 0; colS < L.COLS - 1; colS++){
    var cxs = colS * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W;
    for(var si = 0; si < 260; si++){
      var sxx = cxs + 1 + ((si * 19 + colS * 131) % Math.max(1, L.CORRIDOR_W - 2));
      var syy = yTop + ((si * 37 + Math.floor(tick * 0.65) + colS * 41) % Math.max(1, playH2 - 2));
      var tw = 0.35 + 0.65 * Math.sin(tick * 0.07 + si * 0.13 + colS);
      var al = 0.35 + tw * 0.55;
      ctx.fillStyle = 'rgba(230, 242, 255,' + al.toFixed(3) + ')';
      ctx.fillRect(sxx, syy, (si % 11 === 0) ? 2 : 1, (si % 17 === 0) ? 2 : 1);
      if(si % 13 === 0){
        ctx.fillStyle = 'rgba(255, 250, 230,' + (al * 0.55).toFixed(3) + ')';
        ctx.fillRect(sxx, syy, 1, 1);
      }
    }
  }
  for(var rowS = 0; rowS < L.ROWS - 1; rowS++){
    var cys = yTop + rowS * (L.CELL_H + L.CORRIDOR_H) + L.CELL_H;
    for(var sj = 0; sj < 320; sj++){
      var sxx2 = ((sj * 23 + rowS * 79) % Math.max(1, L.LOGICAL_W - 2));
      var syy2 = cys + 1 + ((sj * 29) % Math.max(1, L.CORRIDOR_H - 2));
      var tw2 = 0.35 + 0.65 * Math.sin(tick * 0.08 + sj * 0.11);
      var al2 = 0.3 + tw2 * 0.5;
      ctx.fillStyle = 'rgba(210, 230, 255,' + al2.toFixed(3) + ')';
      ctx.fillRect(sxx2, syy2, (sj % 12 === 0) ? 2 : 1, 1);
    }
  }
}

// ── Twinkling stars / dust visible through corridor "slots" (on top of rooms) ──
function drawCorridorSpaceDepth(tick){
  if(!L) return;
  var playH = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;
  var t = tick * 0.04;
  ctx.save();
  // Vertical corridors
  for(var col=0; col<L.COLS-1; col++){
    var cx = col * (L.CELL_W + L.CORRIDOR_W) + L.CELL_W;
    for(var k=0; k<26; k++){
      var seed = col * 131 + k * 17;
      var sx = cx + 2 + (seed % Math.max(1, L.CORRIDOR_W - 6));
      var sy = L.TOP_BAR + ((seed * 47 + Math.floor(tick * 0.15)) % Math.max(1, playH - 8));
      var tw = 0.45 + 0.55 * Math.sin(t + seed * 0.07);
      var sz = tw > 0.85 ? 2 : 1;
      ctx.fillStyle = 'rgba(180,220,255,' + (0.28 + tw * 0.62).toFixed(3) + ')';
      ctx.fillRect(sx, sy, sz, sz);
      if(k % 5 === 0){
        ctx.fillStyle = 'rgba(255,210,150,' + (0.12 + tw * 0.35).toFixed(3) + ')';
        ctx.fillRect((sx + 7) % (L.CORRIDOR_W - 4) + cx, (sy + 40) % playH + L.TOP_BAR, 1, 1);
      }
    }
    // Rare meteor streak
    if(((tick + col * 97) % 400) < 2){
      var mx = cx + 1 + ((tick * 3 + col * 50) % (L.CORRIDOR_W - 8));
      var my = L.TOP_BAR + ((tick * 2 + col * 31) % playH);
      ctx.strokeStyle = 'rgba(200,230,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - 10, my + 5);
      ctx.stroke();
    }
  }
  // Horizontal corridors
  for(var row2=0; row2<L.ROWS-1; row2++){
    var cy = L.TOP_BAR + row2 * (L.CELL_H + L.CORRIDOR_H) + L.CELL_H;
    for(var k2=0; k2<22; k2++){
      var seed2 = row2 * 191 + k2 * 23;
      var sx2 = (seed2 * 37) % Math.max(1, L.LOGICAL_W - 4);
      var sy2 = cy + 2 + (seed2 % Math.max(1, L.CORRIDOR_H - 6));
      var tw2 = 0.45 + 0.55 * Math.sin(t * 1.1 + seed2 * 0.05);
      ctx.fillStyle = 'rgba(160,210,255,' + (0.22 + tw2 * 0.58).toFixed(3) + ')';
      ctx.fillRect(sx2, sy2, 1 + (tw2 > 0.8 ? 1 : 0), 1 + (tw2 > 0.8 ? 1 : 0));
    }
  }
  ctx.restore();
}

// Soft star speckle across whole ship interior (lighter blend = reads as space haze)
function drawPlayfieldStarDust(tick){
  if(!L) return;
  var x0 = 0, y0 = L.TOP_BAR, w = L.LOGICAL_W, h = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  for(var i = 0; i < 620; i++){
    var px = x0 + ((i * 251 + Math.floor(tick * 0.4)) % Math.max(1, w - 1));
    var py = y0 + ((i * 367) % Math.max(1, h - 1));
    var tw = 0.5 + 0.5 * Math.sin(tick * 0.045 + i * 0.19);
    var a = 0.04 + tw * 0.1;
    ctx.fillStyle = 'rgba(200, 225, 255,' + a.toFixed(3) + ')';
    ctx.fillRect(px, py, (i % 14 === 0) ? 2 : 1, 1);
    if(i % 19 === 0){
      ctx.fillStyle = 'rgba(255, 252, 240,' + (a * 1.15).toFixed(3) + ')';
      ctx.fillRect(px, py, 1, 1);
    }
  }
  ctx.restore();
}

// ─── HULL FRAME (outer ship structure) ────────────────────────────────
function drawHullFrame(tick){
  var playH = L.LOGICAL_H - L.TOP_BAR - L.BOTTOM_BAR;
  var x0 = 0, y0 = L.TOP_BAR, w = L.LOGICAL_W, h = playH;

  // Outer dark hull bevel
  ctx.strokeStyle = '#0a1828'; ctx.lineWidth = 6;
  ctx.strokeRect(x0+3, y0+3, w-6, h-6);
  ctx.strokeStyle = '#102840'; ctx.lineWidth = 2;
  ctx.strokeRect(x0+1, y0+1, w-2, h-2);
  // Inner glow line
  ctx.strokeStyle = 'rgba(0,170,220,0.45)'; ctx.lineWidth = 1;
  ctx.strokeRect(x0+7, y0+7, w-14, h-14);

  // Rivets along hull edges
  ctx.fillStyle = '#1a3850';
  for(var rx=x0+14; rx<x0+w-14; rx+=22){
    ctx.fillRect(rx, y0+4, 2, 2);
    ctx.fillRect(rx, y0+h-6, 2, 2);
  }
  for(var ry=y0+14; ry<y0+h-14; ry+=22){
    ctx.fillRect(x0+4, ry, 2, 2);
    ctx.fillRect(x0+w-6, ry, 2, 2);
  }

  // Corner mounting brackets
  var brSize = 22;
  ctx.fillStyle = '#0e2438';
  [[x0,y0],[x0+w-brSize,y0],[x0,y0+h-brSize],[x0+w-brSize,y0+h-brSize]].forEach(function(p,i){
    ctx.fillRect(p[0],p[1],brSize,brSize);
    ctx.strokeStyle = 'rgba(0,212,255,0.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(p[0]+2,p[1]+2,brSize-4,brSize-4);
    ctx.fillStyle = (Math.sin(tick/30+i)>0)?'#00d4ff':'#003a4e';
    ctx.fillRect(p[0]+brSize/2-1,p[1]+brSize/2-1,2,2);
    ctx.fillStyle = '#0e2438';
  });

  // Edge exhaust vents (left/right)
  for(var v=0; v<3; v++){
    var vy = y0 + 60 + v*(h-120)/2;
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, vy, 4, 30);
    ctx.fillStyle = 'rgba(255,140,40,'+(0.3+0.3*Math.sin(tick/20+v))+')';
    ctx.fillRect(x0, vy+4, 3, 22);
    ctx.fillRect(x0+w-4, vy, 4, 30);
    ctx.fillStyle = 'rgba(255,140,40,'+(0.3+0.3*Math.sin(tick/20+v+1))+')';
    ctx.fillRect(x0+w-3, vy+4, 3, 22);
  }
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
  var hr = new Date().getHours();
  G.state.gameHour = hr;
  var wasNight = G.state.isNight;
  // Night mode only during deep hours (2am–5am) so the game isn't dark at midnight
  G.state.isNight = (hr >= 2 && hr < 5);
  var night = document.getElementById('night-overlay');
  if(night) night.className = G.state.isNight ? 'visible' : '';
  if(!wasNight && G.state.isNight) document.dispatchEvent(new Event('nightmode-enter'));
}

// ─── UTIL ─────────────────────────────────────────────────────────────
function trunc(s, n){ return s.length>n ? s.slice(0,n-1)+'…' : s; }
function pickFrom(arr){ if(!arr||!arr.length) return '...'; return arr[Math.floor(Math.random()*arr.length)]; }

// ─── GLOBAL ACTIONS ───────────────────────────────────────────────────
GAME.openDossiers    = function(){ window.location.href = 'dossiers.html'; };
GAME.openSettings    = function(){ GAME.hud.openSettings(); };
GAME.closeSettings   = function(){ GAME.hud.closeSettings(); };
GAME.toggleAudio     = function(){ GAME.hud.toggleAudio(); };

// ─── START ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function(){ runBoot(); });

})();
