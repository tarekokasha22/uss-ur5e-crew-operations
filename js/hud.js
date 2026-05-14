(function(){
window.GAME = window.GAME || {};
const H = GAME.hud = {};

// ─── ACHIEVEMENTS DATA ───────────────────────────────────────────────
H.ACHIEVEMENTS = {
  first_contact:       { title:'FIRST CONTACT',        sub:'You clicked a crew member.' },
  triple_file:         { title:'TRIPLE FILE',          sub:'Opened 3 classified dossiers. The ship trusts you slightly less.' },
  seven_windows:       { title:'SEVEN WINDOWS',      sub:'Seven crew files accessed. Maryam has been notified.' },
  roll_call:           { title:'ROLL CALL',             sub:'All 14 crew files accessed.' },
  insomniac:           { title:'INSOMNIAC',             sub:'Opened a dossier at night. Suspicious.' },
  catastrophic_success:{ title:'CATASTROPHIC SUCCESS',  sub:'Witnessed 3 robot grasp fails.' },
  its_alive:           { title:"IT'S ALIVE",            sub:'Returned to the ship 3 days in a row.' },
  night_owl:           { title:'NIGHT OWL',             sub:'Still here after midnight?' },
  coffee_run:          { title:'COFFEE RUN',            sub:'Dispatched UR5e-01 on the Tolba coffee protocol.' },
  captain_coffee:      { title:"CAPTAIN'S CUP",        sub:'Robot completed delivery. Tolba rated it: adequate.' },
  mess_hall_initiate:  { title:'MORALE EVENT',          sub:'First sanctioned ☕ chill — logs will never recover.' },
  chill_repeat:        { title:'RECREATION LOOP',       sub:'Started ☕ chill 3 times. HR has questions.' },
  morale_hazard:       { title:'MORALE HAZARD',         sub:'Five chill sessions. The mess hall is now a jurisdiction.' },
  traffic_five:        { title:'TRAFFIC CONTROL',       sub:'5 manual crew relocations. You are officially traffic.' },
  traffic_twentyfive:  { title:'DECK ARCHITECT',        sub:'25 relocations. The ship is your spreadsheet now.' },
  recall_three:        { title:'GENERAL QUARTERS',      sub:'ALL HANDS 3 times. Jomana approves the panic.' },
  first_orbit:         { title:'FIRST ORBIT',           sub:'2 minutes on station — the ship noticed you.' },
  deep_space_watch:    { title:'DEEP SPACE WATCH',      sub:'10 minutes logged. Coffee debt: incalculable.' },
  systems_tour:        { title:'SYSTEMS TOUR',          sub:'Tagged 10 unique deck fixtures. You read the labels. Respect.' },
  coffee_fleet:        { title:'COFFEE FLEET',          sub:'Three Tolba coffee runs completed. The robot has seniority now.' },
  konami_master:       { title:'KONAMI MASTER',         sub:'You remembered. The ship remembers too.' },
};

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Max DOM nodes per feed (0 = unlimited). Crew comms keeps full history for long sessions.
H.COMMS_FEED_MAX = 0;
H.MISSION_LOG_MAX = 0;

H.init = function(){
  H._feed = [];
  H._toastQueue = [];
  H._achievementShown = new Set();
  H._logLines = [];
  H._konamiBuffer = [];
  H._konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

  // Konami
  document.addEventListener('keydown', e => {
    H._konamiBuffer.push(e.key);
    if(H._konamiBuffer.length > H._konamiCode.length) H._konamiBuffer.shift();
    if(H._konamiBuffer.join(',') === H._konamiCode.join(',')){
      H.triggerKonami();
    }
  });

  // Night achievement
  document.addEventListener('nightmode-enter', () => {
    H.triggerAchievement('night_owl');
    GAME.audio.play('night');
  });

  H.addLog('SYS', 'USS UR5e booting up...', 'log-robot');
  H.addLog('SYS', 'Crew manifest loaded: 14/14', 'log-success');
  H.addLog('SYS', 'All systems nominal.', 'log-success');
  H.addLog('CAP', 'Today\'s briefing: pick block, place block. Excel.', '');
  H.addLog('ROS2', 'roscore online. Topics: 47 active.', 'log-robot');

  // Periodic log entries
  setInterval(() => {
    if(GAME.ai && GAME.ai.chillTimeActive) return;
    const msgs = [
      ['ROS2', '/joint_states topic: 50Hz nominal.', 'log-robot'],
      ['SYS',  'Power draw nominal on all rails.', ''],
      ['WARN', 'Coffee machine usage above average.', 'log-alert'],
      ['ROS2', 'MoveIt2 planner: ready.', 'log-robot'],
      ['SYS',  'Night cycle adjusted.', ''],
      ['CAROL','Signal scan: all clear. For now.', ''],
      ['ROS2', 'voice_commander node: listening.', 'log-robot'],
      ['SYS',  'Structural integrity: 100%.', 'log-success'],
      ['WARN', 'Hemaly bench power spike: logged.', 'log-alert'],
      ['ROS2', 'Odometry: trajectory smooth.', 'log-robot'],
    ];
    const m = msgs[Math.floor(Math.random()*msgs.length)];
    H.addLog(m[0], m[1], m[2]);
  }, 6000);
};

H.addLog = function(src, text, cls=''){
  const el = document.getElementById('mission-log');
  if(!el) return;
  const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const div = document.createElement('div');
  div.className = `log-entry ${cls}`;
  div.innerHTML = `<span class="log-time">[${ts}]</span> <strong>${src}:</strong> ${text}`;
  el.appendChild(div);
  if(H.MISSION_LOG_MAX > 0 && el.children.length > H.MISSION_LOG_MAX) el.removeChild(el.children[0]);
  if(stick) el.scrollTop = el.scrollHeight;
};

// ─── CHAT FEED ───────────────────────────────────────────────────────
H.addChatEntry = function(crewId, text){
  const el = document.getElementById('comms-feed');
  if(!el) return;

  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 56;

  const crew = GAME.crew.find(c => c.id === crewId);
  const name = crew ? crew.displayName : crewId;
  const cls = crew ? crew.chatClass : '';
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const div = document.createElement('div');
  div.className = 'chat-entry';
  div.innerHTML = `<span class="chat-name ${cls}">${escapeHtml(name)}</span> <span class="chat-msg">${escapeHtml(text)}</span> <span class="chat-time">${ts}</span>`;
  el.appendChild(div);
  if(H.COMMS_FEED_MAX > 0 && el.children.length > H.COMMS_FEED_MAX) el.removeChild(el.children[0]);
  if(atBottom) el.scrollTop = el.scrollHeight;
};

// ─── TOAST NOTIFICATIONS ─────────────────────────────────────────────
H.showToast = function(text, type='info', title='[UR5e-01]'){
  const container = document.getElementById('toast-container');
  if(!container) return;

  const banner = document.getElementById('alert-banner');
  if(banner){
    if(type === 'error'){
      banner.textContent = '⚠ ' + (title ? title + ': ' : '') + String(text).slice(0, 120);
      banner.classList.add('visible');
      clearTimeout(H._alertBannerTimer);
      H._alertBannerTimer = setTimeout(function(){
        banner.classList.remove('visible');
      }, 5200);
    } else {
      clearTimeout(H._alertBannerTimer);
      banner.classList.remove('visible');
    }
  }

  const existing = container.querySelectorAll('.toast');
  if(existing.length >= 3){
    const oldest = existing[0];
    oldest.classList.add('fade-out');
    setTimeout(() => oldest.remove(), 400);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div class="toast-title">${escapeHtml(title)}</div><div class="toast-body">${escapeHtml(text)}</div>`;
  container.appendChild(toast);

  const ms = Math.min(14000, 4500 + String(text).length * 55);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, ms);
};

/** Clears large “chill script” bubbles on all crew (canvas-drawn near each character). */
H.clearChillSpeech = function(){
  if(!GAME || !GAME.crew) return;
  GAME.crew.forEach(c => {
    c.chillBubbleText = null;
    c.chillBubbleTimer = 0;
  });
};

// ─── ACHIEVEMENT SYSTEM ──────────────────────────────────────────────
H.triggerAchievement = function(id){
  if(H._achievementShown && H._achievementShown.has(id)) return;
  if(GAME.save.hasAchievement(id)) return;

  if(H._achievementShown) H._achievementShown.add(id);
  const unlocked = GAME.save.unlockAchievement(id);
  if(!unlocked) return;

  const ach = H.ACHIEVEMENTS[id];
  if(!ach) return;

  const popup = document.getElementById('achievement-popup');
  if(!popup) return;
  popup.innerHTML = `<div class="ach-title">🏆 ACHIEVEMENT UNLOCKED: ${escapeHtml(ach.title)}</div><div class="ach-sub">${escapeHtml(ach.sub)}</div>`;
  popup.classList.add('visible');
  GAME.audio.play('achievement');
  H.addLog('ACH', `Achievement unlocked: ${ach.title}`, 'log-success');

  const achMs = Math.min(12000, 5000 + (ach.sub ? ach.sub.length : 0) * 45);
  setTimeout(() => popup.classList.remove('visible'), achMs);
};

// ─── DOSSIER MODAL ────────────────────────────────────────────────────
H.openDossier = function(charId){
  const char = GAME.crew.find(c => c.id === charId);
  if(!char) return;

  GAME.audio.play('dossier_stamp');
  GAME.save.markCrewClicked(char.id);

  // First contact achievement
  H.triggerAchievement('first_contact');

  // Roll call achievement
  if(GAME.save.getClickedCrewCount() >= GAME.crew.length){
    H.triggerAchievement('roll_call');
  }

  const dossN = GAME.save.getClickedCrewCount();
  if(dossN >= 3) H.triggerAchievement('triple_file');
  if(dossN >= 7) H.triggerAchievement('seven_windows');

  // Night insomniac
  if(GAME.state && GAME.state.isNight){
    H.triggerAchievement('insomniac');
  }

  // It's alive (3+ total days)
  if(GAME.save.get('totalDays') >= 3){
    H.triggerAchievement('its_alive');
  }

  // Pause char AI
  char.state = 'dossier_mode';

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('dossier-modal');
  if(!overlay || !modal) return;

  modal.innerHTML = buildDossierHTML(char);
  overlay.classList.add('visible');

  // Render portrait canvas
  requestAnimationFrame(() => {
    const c = document.getElementById('dossier-portrait-canvas');
    if(c){
      const ctx = c.getContext('2d');
      GAME.pixel.drawPortrait(ctx, char, 100);
    }
  });
};

H.closeDossier = function(){
  const overlay = document.getElementById('modal-overlay');
  if(overlay) overlay.classList.remove('visible');

  // Resume all chars from dossier_mode
  GAME.crew.forEach(c => {
    if(c.state === 'dossier_mode'){
      c.state = 'idle';
      c.timer = 500;
    }
  });
};

function buildDossierHTML(char){
  const d = char.dossier;
  const isInsomniac = GAME.state && GAME.state.isNight;

  let statsHTML = char.stats.map(s =>
    `<div class="stat-row"><span class="stat-label">${s.label}</span><span class="stat-value">${s.value}</span></div>`
  ).join('');

  let skillsHTML = d.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');

  let bioText = d.bio;
  if(isInsomniac && char.secretNote){
    bioText += `<br><br><em style="color:#8b4513">[NIGHT-ONLY] ${char.secretNote}</em>`;
  }

  return `
    <div class="dossier-header">
      <span class="dossier-header-title">CLASSIFIED PERSONNEL FILE — ${char.clearance}</span>
      <button class="dossier-close" onclick="GAME.hud.closeDossier()">✕ CLOSE</button>
    </div>
    <div class="dossier-body">
      <div class="dossier-top">
        <div class="dossier-portrait-wrap">
          <canvas id="dossier-portrait-canvas" width="100" height="100"></canvas>
        </div>
        <div class="dossier-stamps">
          <div class="stamp stamp-red">TOP SECRET</div>
          <div class="stamp stamp-blue">${char.clearance}</div>
          ${isInsomniac?'<div class="stamp stamp-green">NIGHT ACCESS</div>':''}
        </div>
        <div class="dossier-id">
          <div class="dossier-codename">${char.codename}</div>
          <div class="dossier-realname">REAL NAME: ${char.displayName}</div>
          <div class="dossier-specialist">${char.specialistTitle}</div>
          <div class="dossier-clearance">CLEARANCE: ${char.clearance}</div>
          <div style="font-size:0.7rem;color:#4a3018;margin-top:4px;font-family:'Share Tech Mono',monospace">
            ${char.role}
          </div>
        </div>
      </div>
      <hr class="dossier-divider">
      <div class="dossier-section-label">OPERATIVE BIO</div>
      <div class="dossier-bio">${bioText}</div>
      <hr class="dossier-divider">
      <div class="dossier-section-label">PERFORMANCE METRICS</div>
      <div class="dossier-stats">${statsHTML}</div>
      <hr class="dossier-divider">
      <div class="dossier-section-label">CERTIFIED SKILL SET</div>
      <div class="dossier-skills">${skillsHTML}</div>
      <hr class="dossier-divider">
      <div class="dossier-section-label">QUIRK ON FILE</div>
      <div class="dossier-quirk">"${d.quirk}"</div>
      <div class="dossier-note">${d.note}</div>
    </div>
  `;
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────────
H.openSettings = function(){
  const m = document.getElementById('settings-modal');
  if(m) m.classList.add('visible');
  H.updateSettingsUI();
};

H.closeSettings = function(){
  const m = document.getElementById('settings-modal');
  if(m) m.classList.remove('visible');
};

H.updateSettingsUI = function(){
  const audioBtn = document.getElementById('audio-toggle');
  if(audioBtn){
    audioBtn.textContent = GAME.audio.enabled ? 'ON' : 'OFF';
    audioBtn.className = `toggle-btn ${GAME.audio.enabled?'on':''}`;
  }
};

H.toggleAudio = function(){
  const on = GAME.audio.toggle();
  H.updateSettingsUI();
  if(on) GAME.audio.play('click');
};

// ─── KONAMI / CLASSIFIED CREDITS (button + keyboard) — own modal, repeatable ──
H.closeKonamiCredits = function(){
  const km = document.getElementById('konami-modal');
  if(km) km.classList.remove('visible');
};

H.showKonamiCredits = function(){
  try { GAME.hud.closeDossier(); } catch(e){}
  try { GAME.audio.play('konami'); } catch(e){}

  const firstEver = !GAME.save.get('konami');
  if(firstEver){
    GAME.save.set('konami', true);
    H.triggerAchievement('konami_master');
    H.addLog('???', 'KONAMI ACCESS — classified credits loaded.', 'log-success');
  }

  const wrap = document.getElementById('konami-modal');
  const inner = document.getElementById('konami-dialog-content');
  if(!wrap || !inner){
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('dossier-modal');
    if(overlay && modal){
      modal.innerHTML = '<div class="dossier-header"><span class="dossier-header-title">CLASSIFIED // KONAMI</span><button class="dossier-close" onclick="GAME.hud.closeDossier()">✕ CLOSE</button></div><div class="dossier-body" style="padding:20px;text-align:center;color:#2a1a08">Konami UI missing — reload the page.</div>';
      overlay.classList.add('visible');
    }
    return;
  }

  inner.innerHTML =
    '<div class="konami-topbar">' +
    '<span>CLASSIFIED // KONAMI</span>' +
    '<button type="button" class="konami-close" onclick="GAME.hud.closeKonamiCredits()">✕ CLOSE</button>' +
    '</div>' +
    '<div class="konami-body">' +
    '<h3>USS UR5e — CLASSIFIED CREDITS</h3>' +
    '<div class="konami-credits">' +
    '<strong>ROS2 Humble</strong> — Voice team build pipeline<br>' +
    '<strong>MoveIt2</strong> — Motion planned by Moaz &amp; Hemaly<br>' +
    '<strong>Hardware</strong> — Hemaly bench reality<br>' +
    '<strong>Voice stack</strong> — Tarek, Abdelrahman, Mohamed<br>' +
    '<strong>Comms</strong> — Carol (Gerald Jr. is still in the logs)<br>' +
    '<strong>Structure</strong> — Omar, Seif, Youssef Emad<br>' +
    '<strong>Command</strong> — Jomana (non-negotiable)<br>' +
    '<strong>Logistics</strong> — Maryam (already filed this credit scroll)<br>' +
    '<strong>Patron lane</strong> — Youssef Zaky &amp; the 7-year plant<br>' +
    '<strong>Wisdom</strong> — Dr. Tolba (MATLAB is a way of life)<br><br>' +
    '<em>UR5e-01 says: pick, place, peace.</em><br><br>' +
    '<strong style="color:#00ff88">GIU Robotics — USS UR5e Crew Operations</strong>' +
    '</div></div>';

  wrap.classList.add('visible');
};

H.triggerKonami = function(){
  H.showKonamiCredits();
};

// ─── HUD BAR UPDATE ───────────────────────────────────────────────────
H.updateHUD = function(missionDay, gameHour, isNight){
  const dayEl = document.getElementById('hud-day');
  const uptimeEl = document.getElementById('hud-uptime');
  const crewEl = document.getElementById('hud-crew');
  const modeEl = document.getElementById('hud-mode');

  if(dayEl) dayEl.textContent = `DAY ${String(missionDay).padStart(3,'0')}`;
  if(uptimeEl){
    const acc = (GAME.state && GAME.state.shipSimMs) || 0;
    const totalM = Math.floor(acc / 9000);
    const sh = (8 + Math.floor(totalM / 60)) % 24;
    const smin = totalM % 60;
    uptimeEl.textContent = `${String(sh).padStart(2,'0')}:${String(smin).padStart(2,'0')}`;
  }
  if(crewEl) crewEl.textContent = `${GAME.crew.length}/${GAME.crew.length}`;
  if(modeEl){
    modeEl.textContent = isNight ? '🌙 NIGHT' : '☀ DAY';
    modeEl.className = `hud-stat-value ${isNight?'':'green'}`;
  }

  const achIds = Object.keys(H.ACHIEVEMENTS);
  let unlocked = 0;
  achIds.forEach(function(id){ if(GAME.save.hasAchievement(id)) unlocked++; });
  const kpiAch = document.getElementById('kpi-ach');
  const kpiDos = document.getElementById('kpi-dossier');
  const kpiRob = document.getElementById('kpi-robot');
  if(kpiAch) kpiAch.textContent = 'ACH ' + unlocked + '/' + achIds.length;
  if(kpiDos) kpiDos.textContent = 'DOSSIER ' + (typeof GAME.save.getClickedCrewCount === 'function' ? GAME.save.getClickedCrewCount() : 0) + '/14';
  if(kpiRob) kpiRob.textContent = 'GRASP FAILS ' + (GAME.save.get('robotGraspFails') || 0);

  if(GAME.state && GAME.state.shipSimMs >= 120000) H.triggerAchievement('first_orbit');
  if(GAME.state && GAME.state.shipSimMs >= 600000) H.triggerAchievement('deep_space_watch');
};

// ─── ROOM NAME OVERLAY (HTML — always readable above canvas) ────────
H.initRoomLabels = function(){
  const layer = document.getElementById('room-labels-layer');
  if(!layer || !GAME.rooms || !GAME.LAYOUT || !GAME.getRoomCell) return;
  const L = GAME.LAYOUT;
  layer.innerHTML = '';
  GAME.rooms.forEach(function(room){
    const cell = GAME.getRoomCell(room);
    const el = document.createElement('div');
    el.className = 'room-chip';
    const glow = (room.colors && room.colors.glow) ? room.colors.glow : '#00d4ff';
    el.style.setProperty('--room-glow', glow);
    el.style.setProperty('--room-accent', (room.colors && room.colors.accent) ? room.colors.accent : glow);
    if(room.colors && room.colors.border) el.style.borderColor = room.colors.border;
    const icon = room.icon ? String(room.icon) : '◆';
    const sub = room.subtitle ? escapeHtml(room.subtitle) : '';
    el.innerHTML =
      '<span class="room-chip-icon" aria-hidden="true">' + escapeHtml(icon) + '</span>' +
      '<div class="room-chip-text">' +
      '<span class="room-chip-title">' + escapeHtml(room.name) + '</span>' +
      (sub ? '<span class="room-chip-sub">' + sub + '</span>' : '') +
      '</div>';
    const pctLeft = ((cell.x + cell.w / 2) / L.LOGICAL_W) * 100;
    const pctTop = ((cell.y + 8) / L.LOGICAL_H) * 100;
    el.style.left = pctLeft + '%';
    el.style.top = pctTop + '%';
    layer.appendChild(el);
  });
};

// ─── OPS CENTER (guide + achievements + KPIs) ───────────────────────
H.openOps = function(){
  if(GAME.hud.closeKonamiCredits) GAME.hud.closeKonamiCredits();
  const m = document.getElementById('ops-modal');
  if(!m) return;
  m.classList.add('visible');
  H.switchOpsTab('guide');
  try {
    H.refreshOpsPanels();
  } catch(err){
    console.warn('openOps', err);
  }
};

H.closeOps = function(){
  const m = document.getElementById('ops-modal');
  if(m) m.classList.remove('visible');
};

H.switchOpsTab = function(which){
  document.querySelectorAll('.ops-tab').forEach(function(t){
    t.classList.toggle('active', t.getAttribute('data-ops') === which);
  });
  document.querySelectorAll('.ops-panel').forEach(function(p){
    p.classList.toggle('active', p.id === 'ops-panel-' + which);
  });
};

H.refreshOpsPanels = function(){
  const list = document.getElementById('ops-ach-list');
  if(list){
    let html = '';
    Object.keys(H.ACHIEVEMENTS).forEach(function(id){
      const a = H.ACHIEVEMENTS[id];
      const ok = GAME.save.hasAchievement(id);
      html += '<div class="ops-ach-row' + (ok ? ' unlocked' : '') + '">' +
        '<span class="ops-ach-mark">' + (ok ? '●' : '○') + '</span>' +
        '<div><div class="ops-ach-title">' + escapeHtml(a.title) + '</div>' +
        '<div class="ops-ach-sub">' + escapeHtml(a.sub) + '</div></div></div>';
    });
    list.innerHTML = html;
  }
  const kpi = document.getElementById('ops-kpi-body');
  if(kpi){
    const achN = Object.keys(H.ACHIEVEMENTS).filter(function(id){ return GAME.save.hasAchievement(id); }).length;
    const doss = typeof GAME.save.getClickedCrewCount === 'function' ? GAME.save.getClickedCrewCount() : 0;
    const fails = GAME.save.get('robotGraspFails') || 0;
    const days = GAME.save.get('totalDays') || 1;
    const md = (GAME.state && GAME.state.missionDay) || GAME.save.get('missionDay') || 1;
    const moves = GAME.save.get('movesCompleted') || 0;
    const chills = GAME.save.get('chillSessions') || 0;
    const recalls = GAME.save.get('allHandsUses') || 0;
    const coffees = GAME.save.get('coffeeDeliveries') || 0;
    const decorN = (GAME.save.get('decorSeenKeys') && GAME.save.get('decorSeenKeys').length) || 0;
    kpi.innerHTML =
      '<table class="ops-kpi-table">' +
      '<tr><td>Mission day (sim)</td><td>' + md + '</td></tr>' +
      '<tr><td>Calendar days aboard</td><td>' + days + '</td></tr>' +
      '<tr><td>Achievements</td><td>' + achN + ' / ' + Object.keys(H.ACHIEVEMENTS).length + '</td></tr>' +
      '<tr><td>Dossiers opened (unique)</td><td>' + doss + ' / 14</td></tr>' +
      '<tr><td>Robot grasp fails (log)</td><td>' + fails + '</td></tr>' +
      '<tr><td>Tolba coffee runs completed</td><td>' + coffees + '</td></tr>' +
      '<tr><td>Unique fixtures inspected (hover)</td><td>' + decorN + '</td></tr>' +
      '<tr><td>MOVE CREW relocations</td><td>' + moves + '</td></tr>' +
      '<tr><td>☕ Chill sessions started</td><td>' + chills + '</td></tr>' +
      '<tr><td>ALL HANDS uses</td><td>' + recalls + '</td></tr>' +
      '<tr><td>Ship clock</td><td>~9s real time = 1 ship minute</td></tr>' +
      '</table>';
  }
};

})();
