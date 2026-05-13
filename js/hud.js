(function(){
window.GAME = window.GAME || {};
const H = GAME.hud = {};

// ─── ACHIEVEMENTS DATA ───────────────────────────────────────────────
H.ACHIEVEMENTS = {
  first_contact:       { title:'FIRST CONTACT',        sub:'You clicked a crew member.' },
  roll_call:           { title:'ROLL CALL',             sub:'All 14 crew files accessed.' },
  insomniac:           { title:'INSOMNIAC',             sub:'Opened a dossier at night. Suspicious.' },
  catastrophic_success:{ title:'CATASTROPHIC SUCCESS',  sub:'Witnessed 3 robot grasp fails.' },
  its_alive:           { title:"IT'S ALIVE",            sub:'Returned to the ship 3 days in a row.' },
  night_owl:           { title:'NIGHT OWL',             sub:'Still here after midnight?' },
  konami_master:       { title:'KONAMI MASTER',         sub:'You remembered. The ship remembers too.' },
};

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

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
  if(el.children.length > 80) el.removeChild(el.children[0]);
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
  div.innerHTML = `<span class="chat-name ${cls}">${name}</span> <span class="chat-msg">${text}</span> <span class="chat-time">${ts}</span>`;
  el.appendChild(div);
  if(el.children.length > 50) el.removeChild(el.children[0]);
  if(atBottom) el.scrollTop = el.scrollHeight;
};

// ─── TOAST NOTIFICATIONS ─────────────────────────────────────────────
H.showToast = function(text, type='info', title='[UR5e-01]'){
  const container = document.getElementById('toast-container');
  if(!container) return;

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

// ─── KONAMI EASTER EGG ───────────────────────────────────────────────
H.triggerKonami = function(){
  if(GAME.save.get('konami')) return;
  GAME.save.set('konami', true);
  GAME.audio.play('konami');
  H.triggerAchievement('konami_master');
  H.addLog('???', 'KONAMI CODE ACTIVATED. Good morning, operator.', 'log-success');

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('dossier-modal');
  if(!overlay || !modal) return;

  modal.innerHTML = `
    <div class="dossier-header">
      <span class="dossier-header-title">CLASSIFIED // KONAMI ACCESS GRANTED</span>
      <button class="dossier-close" onclick="GAME.hud.closeDossier()">✕ CLOSE</button>
    </div>
    <div class="dossier-body" style="text-align:center;padding:30px">
      <div style="font-family:'VT323',monospace;font-size:1.5rem;color:#00ff88;margin-bottom:20px;letter-spacing:0.2em">
        USS UR5e — CLASSIFIED CREDITS
      </div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.75rem;color:#2a1a08;line-height:2">
        <strong>ROS2 Humble</strong> — Compiled with love by the Voice Team<br>
        <strong>MoveIt2</strong> — Motion planned by Moaz & Hemaly<br>
        <strong>Hardware</strong> — Built and soldered by Hemaly<br>
        <strong>Voice System</strong> — Trained by Tarek, Abdelrahman, Mohamed<br>
        <strong>Operations</strong> — Controlled by Carol<br>
        <strong>Structure</strong> — Designed by Omar, Seif, Youssef Emad<br>
        <strong>Command</strong> — Jomana. (non-negotiable)<br>
        <strong>Logistics</strong> — Maryam (she already handled it)<br>
        <strong>Funding</strong> — Youssef Zaky (the plant thanks you)<br>
        <strong>Wisdom</strong> — Dr. Tolba (in MATLAB we trust)<br>
        <br>
        <em>Robot built, trained, and occasionally argued with.</em><br>
        <em>No robots were harmed. The robot is fine. The robot says hi.</em><br>
        <br>
        <strong style="color:#8b4513">GIU Robotics Project — Spring 2026</strong>
      </div>
    </div>
  `;
  overlay.classList.add('visible');
};

// ─── HUD BAR UPDATE ───────────────────────────────────────────────────
H.updateHUD = function(missionDay, gameHour, isNight){
  const dayEl = document.getElementById('hud-day');
  const uptimeEl = document.getElementById('hud-uptime');
  const crewEl = document.getElementById('hud-crew');
  const modeEl = document.getElementById('hud-mode');

  if(dayEl) dayEl.textContent = `DAY ${String(missionDay).padStart(3,'0')}`;
  if(uptimeEl) uptimeEl.textContent = `${String(gameHour).padStart(2,'0')}:${String(Math.floor((Date.now()/1000)%60)).padStart(2,'0')}`;
  if(crewEl) crewEl.textContent = `${GAME.crew.length}/${GAME.crew.length}`;
  if(modeEl){
    modeEl.textContent = isNight ? '🌙 NIGHT' : '☀ DAY';
    modeEl.className = `hud-stat-value ${isNight?'':'green'}`;
  }
};

})();
