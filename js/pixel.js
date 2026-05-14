(function(){
window.GAME = window.GAME || {};
const P = GAME.pixel = {};

// ─── COLOUR HELPERS ─────────────────────────────────────────────────
function hex2rgb(h){
  const v=parseInt(h.slice(1),16);
  return [(v>>16)&255,(v>>8)&255,v&255];
}
function darken(hex,amt=0.5){
  const [r,g,b]=hex2rgb(hex);
  return `rgb(${Math.floor(r*amt)},${Math.floor(g*amt)},${Math.floor(b*amt)})`;
}
function lighten(hex,amt=1.35){
  const [r,g,b]=hex2rgb(hex);
  return `rgb(${Math.min(255,Math.floor(r*amt))},${Math.min(255,Math.floor(g*amt))},${Math.min(255,Math.floor(b*amt))})`;
}
function rgba(hex,a){
  const [r,g,b]=hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Room designation strip: icon + name + subtitle (fixed order from rooms.js, not random). */
function drawRoomDesignationPlaque(ctx, room, rx, plaqueY, rw, plaqueH, c){
  if(!room || !room.name || plaqueH < 10) return;
  const px = rx + 8;
  const pw = rw - 16;
  ctx.save();
  ctx.beginPath();
  if(typeof ctx.roundRect === 'function'){
    ctx.roundRect(px, plaqueY, pw, plaqueH, 4);
  } else {
    ctx.rect(px, plaqueY, pw, plaqueH);
  }
  const bg = ctx.createLinearGradient(px, plaqueY, px + pw, plaqueY + plaqueH);
  bg.addColorStop(0, 'rgba(4,8,16,0.94)');
  bg.addColorStop(0.5, rgba(c.bg, 0.88));
  bg.addColorStop(1, 'rgba(2,4,10,0.94)');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = rgba(c.border, 0.75);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = rgba(c.accent, 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 2, plaqueY + 2, pw - 4, plaqueH - 4);

  const icon = room.icon || '◆';
  const title = String(room.name);
  const sub = room.subtitle ? String(room.subtitle) : '';

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '13px monospace';
  ctx.fillStyle = rgba(c.glow, 0.95);
  ctx.fillText(icon, px + 8, plaqueY + plaqueH * 0.38);

  ctx.font = 'bold 11px "Share Tech Mono", monospace';
  ctx.fillStyle = lighten(c.accent, 1.15);
  const titleX = px + 30;
  ctx.fillText(title, titleX, plaqueY + plaqueH * 0.36);

  if(sub){
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = rgba(c.border, 0.92);
    ctx.fillText(sub, titleX, plaqueY + plaqueH * 0.78);
  }
  ctx.restore();
}

// Deep space + stars for room “viewport” wall band (always visible behind tint)
function drawWallSpaceBackdrop(ctx, rx, ry, rw, wallH, roomId, tick){
  const seed = (roomId || 'x').split('').reduce(function(a, ch){ return a + ch.charCodeAt(0); }, 0);
  let g;
  try {
    g = ctx.createLinearGradient(rx, ry + wallH, rx, ry);
    g.addColorStop(0, '#03050c');
    g.addColorStop(0.45, '#060a18');
    g.addColorStop(1, '#0a1028');
    ctx.fillStyle = g;
  } catch(e){
    ctx.fillStyle = '#050814';
  }
  ctx.fillRect(rx, ry, rw, wallH);
  try {
    const ng = ctx.createRadialGradient(rx + rw * 0.25, ry + wallH * 0.35, 0, rx + rw * 0.35, ry + wallH * 0.25, rw * 0.85);
    ng.addColorStop(0, 'rgba(40, 60, 140, 0.22)');
    ng.addColorStop(0.5, 'rgba(20, 30, 70, 0.08)');
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(rx, ry, rw, wallH);
  } catch(e){}
  const n = 145;
  for(let i = 0; i < n; i++){
    const sx = rx + 3 + ((seed + i * 97) % Math.max(1, rw - 6));
    const sy = ry + 3 + ((seed * 13 + i * 53) % Math.max(1, wallH - 6));
    const tw = 0.4 + 0.6 * Math.sin(tick * 0.055 + i * 0.27 + seed * 0.02);
    const sz = ((i + seed) % 9 === 0) ? 2 : 1;
    const a = (0.2 + ((i * 19) % 55) / 120) * tw;
    ctx.fillStyle = 'rgba(210, 230, 255,' + a.toFixed(3) + ')';
    ctx.fillRect(Math.floor(sx), Math.floor(sy), sz, sz);
    if((i + seed) % 11 === 0){
      ctx.fillStyle = 'rgba(255, 245, 220,' + (a * 0.75).toFixed(3) + ')';
      ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
    }
  }
}

// ─── DRAW CHARACTER (redesigned — more detail, better proportions) ────
// scale=6 → character ~36×84px; 4-frame walk animation
P.drawCharacter = function(ctx, char, worldX, worldY, frame, scale=6){
  const p = char.portrait;
  const s = scale;
  const x = Math.floor(worldX);
  const y = Math.floor(worldY);

  ctx.save();

  // Ground shadow (elliptical)
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(x+3*s, y+13*s, 3*s, Math.ceil(s*0.38), 0, 0, Math.PI*2);
  ctx.fill();

  // ── 4-frame walk cycle ────────────────────────────────────────────
  const wf = frame % 4;
  const legLOff = [0, s, s, 0][wf];
  const legROff = [s, 0, 0, s][wf];
  const armLOff = [s, Math.ceil(s/2), 0, Math.ceil(s/2)][wf];
  const armROff = [0, Math.ceil(s/2), s, Math.ceil(s/2)][wf];

  // ── Shoes ──────────────────────────────────────────────────────────
  const shoeCol = darken(p.pants || '#222', 0.50);
  ctx.fillStyle = shoeCol;
  ctx.fillRect(x+s,       y+12*s+legLOff, s+2, Math.ceil(s*1.1));
  ctx.fillRect(x+3*s+1,   y+12*s+legROff, s+2, Math.ceil(s*1.1));
  ctx.fillStyle = lighten(shoeCol, 1.3);
  ctx.fillRect(x+s,       y+12*s+legLOff, s+2, 1);
  ctx.fillRect(x+3*s+1,   y+12*s+legROff, s+2, 1);

  // ── Legs ───────────────────────────────────────────────────────────
  ctx.fillStyle = p.pants || '#222';
  ctx.fillRect(x+s,     y+9*s, s+1, 3*s + legLOff);
  ctx.fillRect(x+3*s+1, y+9*s, s+1, 3*s + legROff);
  ctx.fillStyle = lighten(p.pants || '#222', 1.12);
  ctx.fillRect(x+s,     y+9*s, 1, 3*s);
  ctx.fillRect(x+3*s+1, y+9*s, 1, 3*s);
  ctx.fillStyle = darken(p.pants || '#222', 0.72);
  ctx.fillRect(x+s+s,   y+9*s, 1, 3*s);
  ctx.fillRect(x+3*s+2, y+9*s, 1, 3*s);

  // ── Belt ───────────────────────────────────────────────────────────
  ctx.fillStyle = darken(p.pants || '#222', 0.58);
  ctx.fillRect(x+s, y+8*s+Math.ceil(s*0.65), 4*s, Math.ceil(s*0.45));
  ctx.fillStyle = '#888';
  ctx.fillRect(x+2*s+Math.ceil(s*0.2), y+8*s+Math.ceil(s*0.65), Math.ceil(s*0.9), Math.ceil(s*0.45));

  // ── Body / shirt ───────────────────────────────────────────────────
  ctx.fillStyle = p.shirt || '#333';
  ctx.fillRect(x+s, y+4*s, 4*s, 5*s);
  // Highlight left
  ctx.fillStyle = lighten(p.shirt || '#333', 1.18);
  ctx.fillRect(x+s, y+4*s, 1, 4*s);
  ctx.fillRect(x+s, y+4*s, 4*s, 1);
  // Shadow right
  ctx.fillStyle = darken(p.shirt || '#333', 0.72);
  ctx.fillRect(x+4*s, y+4*s, s, 5*s);
  ctx.fillRect(x+s, y+8*s, 3*s, s);
  // Collar
  ctx.fillStyle = p.skin;
  ctx.fillRect(x+2*s, y+4*s, 2*s, Math.ceil(s*0.55));
  // Button line
  ctx.fillStyle = darken(p.shirt || '#333', 0.68);
  ctx.fillRect(x+2*s+Math.ceil(s*0.4), y+5*s, 1, 3*s);

  // ── Arms ───────────────────────────────────────────────────────────
  // Left arm
  ctx.fillStyle = p.shirt || '#333';
  ctx.fillRect(x, y+4*s+armLOff, s, Math.ceil(s*2.4));
  ctx.fillStyle = lighten(p.shirt || '#333', 1.15);
  ctx.fillRect(x, y+4*s+armLOff, 1, Math.ceil(s*2.4));
  // Left hand
  ctx.fillStyle = p.skin;
  ctx.fillRect(x, y+4*s+armLOff+Math.ceil(s*2.4), s, Math.ceil(s*0.8));
  // Right arm
  ctx.fillStyle = p.shirt || '#333';
  ctx.fillRect(x+5*s, y+4*s+armROff, s, Math.ceil(s*2.4));
  ctx.fillStyle = darken(p.shirt || '#333', 0.78);
  ctx.fillRect(x+5*s+Math.ceil(s*0.6), y+4*s+armROff, Math.ceil(s*0.4), Math.ceil(s*2.4));
  // Right hand
  ctx.fillStyle = p.skin;
  ctx.fillRect(x+5*s, y+4*s+armROff+Math.ceil(s*2.4), s, Math.ceil(s*0.8));

  // ── Neck ───────────────────────────────────────────────────────────
  ctx.fillStyle = p.skin;
  ctx.fillRect(x+2*s, y+3*s, 2*s, s+1);
  ctx.fillStyle = darken(p.skin, 0.82);
  ctx.fillRect(x+3*s, y+3*s, s, s);

  // ── Head ───────────────────────────────────────────────────────────
  ctx.fillStyle = p.skin;
  ctx.fillRect(x+s, y, 4*s, 3*s);
  // Highlight top-left
  ctx.fillStyle = lighten(p.skin, 1.10);
  ctx.fillRect(x+s, y, 2*s, 1);
  ctx.fillRect(x+s, y, 1, 2*s);
  // Shadow right
  ctx.fillStyle = darken(p.skin, 0.84);
  ctx.fillRect(x+4*s, y, s, 3*s);
  ctx.fillRect(x+s, y+2*s, 1, s);

  // ── Hair ───────────────────────────────────────────────────────────
  if(p.hair && !p.features.includes('bald')){
    ctx.fillStyle = p.hair;
    if(p.features.includes('long_hair')){
      ctx.fillRect(x+s, y, 4*s, Math.ceil(s*1.2));
      ctx.fillRect(x, y+Math.ceil(s*0.4), s, 2*s+1);
      ctx.fillRect(x+5*s, y+Math.ceil(s*0.4), s, 2*s+1);
      ctx.fillRect(x, y+2*s, s, 2*s);
      // Hair highlight
      ctx.fillStyle = lighten(p.hair, 1.22);
      ctx.fillRect(x+2*s, y, s, 1);
    } else if(p.features.includes('hoodie')){
      ctx.fillRect(x+s, y, 4*s, Math.ceil(s*1.2));
      ctx.fillStyle = p.shirt;
      ctx.fillRect(x, y+Math.ceil(s*0.5), s, Math.ceil(s*1.2));
      ctx.fillRect(x+5*s, y+Math.ceil(s*0.5), s, Math.ceil(s*1.2));
    } else {
      ctx.fillRect(x+s, y, 4*s, Math.ceil(s*1.2));
      ctx.fillRect(x+s, y, 1, Math.ceil(s*1.5));
      ctx.fillStyle = lighten(p.hair, 1.25);
      ctx.fillRect(x+2*s, y, s, 1);
    }
  } else if(p.features.includes('bald')){
    ctx.fillStyle = lighten(p.skin, 1.16);
    ctx.fillRect(x+2*s, y, 2*s, Math.ceil(s*0.65));
    ctx.fillRect(x+2*s, y, s, 1);
  }

  // ── Eyebrows ───────────────────────────────────────────────────────
  const browCol = p.hair ? darken(p.hair, 0.85) : darken(p.skin, 0.62);
  if(!p.features.includes('bald')){
    ctx.fillStyle = browCol;
    ctx.fillRect(x+s+Math.ceil(s*0.3), y+Math.ceil(s*0.65), Math.ceil(s*1.0), Math.ceil(s*0.3));
    ctx.fillRect(x+3*s+Math.ceil(s*0.0), y+Math.ceil(s*0.65), Math.ceil(s*1.0), Math.ceil(s*0.3));
  }

  // ── Eyes ───────────────────────────────────────────────────────────
  ctx.fillStyle = '#111';
  ctx.fillRect(x+s+Math.ceil(s*0.45), y+s, Math.ceil(s*0.85), Math.ceil(s*0.85));
  ctx.fillRect(x+3*s+Math.ceil(s*0.05), y+s, Math.ceil(s*0.85), Math.ceil(s*0.85));
  ctx.fillStyle = '#fff';
  ctx.fillRect(x+s+Math.ceil(s*0.45)+Math.ceil(s*0.5), y+s, Math.ceil(s*0.35), Math.ceil(s*0.35));
  ctx.fillRect(x+3*s+Math.ceil(s*0.05)+Math.ceil(s*0.5), y+s, Math.ceil(s*0.35), Math.ceil(s*0.35));

  // ── Nose ───────────────────────────────────────────────────────────
  ctx.fillStyle = darken(p.skin, 0.80);
  ctx.fillRect(x+2*s+Math.ceil(s*0.35), y+s+Math.ceil(s*0.75), Math.ceil(s*0.35), Math.ceil(s*0.35));

  // ── Mouth ──────────────────────────────────────────────────────────
  ctx.fillStyle = darken(p.skin, 0.72);
  ctx.fillRect(x+2*s, y+2*s+Math.ceil(s*0.35), 2*s, Math.ceil(s*0.3));
  ctx.fillStyle = lighten(p.skin, 1.06);
  ctx.fillRect(x+2*s, y+2*s+Math.ceil(s*0.35), 2*s, 1);

  // ── Cheek blush ────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,110,90,0.13)';
  ctx.fillRect(x+s+Math.ceil(s*0.1), y+s+Math.ceil(s*0.75), Math.ceil(s*0.7), Math.ceil(s*0.4));
  ctx.fillRect(x+4*s+Math.ceil(s*0.05), y+s+Math.ceil(s*0.75), Math.ceil(s*0.7), Math.ceil(s*0.4));

  // ── Beard (Tolba) ──────────────────────────────────────────────────
  if(p.features.includes('beard')){
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x+s+Math.ceil(s*0.35), y+2*s, 3*s, Math.ceil(s*0.85));
    ctx.fillRect(x+s, y+s+Math.ceil(s*0.8), Math.ceil(s*0.5), Math.ceil(s*0.6));
    ctx.fillRect(x+4*s+Math.ceil(s*0.3), y+s+Math.ceil(s*0.8), Math.ceil(s*0.5), Math.ceil(s*0.6));
    ctx.fillStyle = '#888';
    ctx.fillRect(x+s+Math.ceil(s*0.5), y+2*s+Math.ceil(s*0.5), 2*s+Math.ceil(s*0.5), Math.ceil(s*0.35));
  }

  // ── Glasses (Moaz) ────────────────────────────────────────────────
  if(p.features.includes('glasses')){
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = Math.max(1, Math.ceil(s*0.28));
    ctx.strokeRect(x+s+Math.ceil(s*0.1), y+s-1, Math.ceil(s*1.8), Math.ceil(s*1.1));
    ctx.strokeRect(x+3*s+Math.ceil(s*0.1), y+s-1, Math.ceil(s*1.8), Math.ceil(s*1.1));
    ctx.beginPath();
    ctx.moveTo(x+3*s, y+s+Math.ceil(s*0.4));
    ctx.lineTo(x+3*s+Math.ceil(s*0.1), y+s+Math.ceil(s*0.4));
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,220,255,0.12)';
    ctx.fillRect(x+s+Math.ceil(s*0.1)+1, y+s, Math.ceil(s*1.8)-2, Math.ceil(s*1.1)-1);
    ctx.fillRect(x+3*s+Math.ceil(s*0.1)+1, y+s, Math.ceil(s*1.8)-2, Math.ceil(s*1.1)-1);
  }

  // ── Headset (Tarek / Carol) ────────────────────────────────────────
  if(p.features.includes('headset')){
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(x, y+s, s, s+2);
    ctx.fillRect(x+5*s, y+s, s, s+2);
    ctx.fillStyle = '#444';
    ctx.fillRect(x+s, y, 4*s, Math.ceil(s*0.45));
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y+s+Math.ceil(s*0.2), Math.ceil(s*0.55), Math.ceil(s*0.55));
    ctx.fillStyle = p.accent || '#39ff14';
    ctx.fillRect(x, y+s+1, Math.ceil(s*0.4), Math.ceil(s*0.4));
    // Mic boom
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y+s+s, Math.ceil(s*0.3), Math.ceil(s*0.8));
    ctx.fillRect(x, y+s+s+Math.ceil(s*0.8), Math.ceil(s*0.6), Math.ceil(s*0.3));
  }

  // ── Hard hat (Youssef Emad) ────────────────────────────────────────
  if(p.features.includes('hard_hat')){
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x+s, y-s, 4*s, Math.ceil(s*1.2));
    ctx.fillRect(x, y, Math.ceil(s*0.7), Math.ceil(s*0.5));
    ctx.fillRect(x+5*s+Math.ceil(s*0.2), y, Math.ceil(s*0.7), Math.ceil(s*0.5));
    ctx.fillStyle = '#cc9900';
    ctx.fillRect(x+s, y-s, 4*s, Math.ceil(s*0.35));
    ctx.fillStyle = 'rgba(255,240,100,0.4)';
    ctx.fillRect(x+2*s, y-s+Math.ceil(s*0.2), s, Math.ceil(s*0.3));
  }

  // ── Goggles (Seif) ────────────────────────────────────────────────
  if(p.features.includes('goggles')){
    ctx.fillStyle = '#2a1500';
    ctx.fillRect(x+s, y+s, 4*s, s+2);
    ctx.fillStyle = 'rgba(255,136,0,0.55)';
    ctx.fillRect(x+s+Math.ceil(s*0.25), y+s+Math.ceil(s*0.2), Math.ceil(s*0.95), Math.ceil(s*0.6));
    ctx.fillRect(x+3*s+Math.ceil(s*0.25), y+s+Math.ceil(s*0.2), Math.ceil(s*0.95), Math.ceil(s*0.6));
    ctx.fillStyle = 'rgba(255,200,100,0.3)';
    ctx.fillRect(x+s+Math.ceil(s*0.35), y+s+Math.ceil(s*0.25), Math.ceil(s*0.3), Math.ceil(s*0.3));
    ctx.fillRect(x+3*s+Math.ceil(s*0.35), y+s+Math.ceil(s*0.25), Math.ceil(s*0.3), Math.ceil(s*0.3));
    ctx.fillStyle = '#444';
    ctx.fillRect(x+2*s, y+s+Math.ceil(s*0.4), s, Math.ceil(s*0.3));
  }

  // ── Gold coat lapels (Dr. Tolba) ───────────────────────────────────
  if(p.features.includes('gold_coat')){
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x+s, y+4*s, Math.ceil(s*0.6), 4*s);
    ctx.fillRect(x+4*s+Math.ceil(s*0.35), y+4*s, Math.ceil(s*0.6), 4*s);
    ctx.fillStyle = '#aa8800';
    ctx.fillRect(x+s+Math.ceil(s*0.5), y+4*s, Math.ceil(s*0.1), 4*s);
    // Epaulettes
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x, y+4*s, s, Math.ceil(s*0.7));
    ctx.fillRect(x+5*s, y+4*s, s, Math.ceil(s*0.7));
    // Medal dot
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(x+2*s+Math.ceil(s*0.3), y+5*s+Math.ceil(s*0.3), Math.ceil(s*0.5), Math.ceil(s*0.5));
  }

  // ── Command sash (Jomana) ──────────────────────────────────────────
  if(p.features.includes('command_sash')){
    ctx.fillStyle = '#ff006e';
    ctx.fillRect(x+s, y+4*s, Math.ceil(s*0.6), 4*s);
    ctx.fillStyle = 'rgba(255,0,110,'+(0.5+0.5*Math.sin(Date.now()/600))+')';
    ctx.fillRect(x+s, y+4*s, Math.ceil(s*0.6), 4*s);
    ctx.fillStyle = '#ff44aa';
    ctx.fillRect(x+s+1, y+5*s, Math.ceil(s*0.5), Math.ceil(s*0.4));
    ctx.fillStyle = '#ffaadd';
    ctx.fillRect(x+s+1, y+5*s, Math.ceil(s*0.3), Math.ceil(s*0.2));
  }

  // ── Accent dot (role indicator) ────────────────────────────────────
  if(p.accent){
    ctx.fillStyle = p.accent;
    ctx.fillRect(x+5*s, y, s, Math.ceil(s*0.45));
    ctx.fillStyle = rgba(p.accent, 0.3);
    ctx.fillRect(x+5*s-1, y-1, s+2, Math.ceil(s*0.45)+2);
  }

  // ── Working tool flash ─────────────────────────────────────────────
  if(char.state === 'work' && char.kind !== 'robot'){
    ctx.fillStyle = p.accent || '#ffffff';
    ctx.globalAlpha = 0.55 + 0.45*Math.sin(Date.now()/180);
    ctx.fillRect(x+5*s+1, y+2*s, s, 2*s);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};



// ─── DRAW ROBOT (UR5e arm) ──────────────────────────────────────────
P.drawRobot = function(ctx, robot, worldX, worldY, tick){
  const x = Math.floor(worldX);
  const y = Math.floor(worldY);
  const arm = robot.arm;
  const s = 4;

  ctx.save();

  // Base mount
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(x-s, y+10*s, 8*s, 2*s);
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(x, y+8*s, 6*s, 2*s);

  // Glowing base ring
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5 + 0.3*Math.sin(tick/20);
  ctx.strokeRect(x-s, y+10*s, 8*s, 2*s);
  ctx.globalAlpha = 1;

  // Base joint
  const baseAngle = arm.baseAngle || 0;
  ctx.translate(x+3*s, y+8*s);
  ctx.rotate(baseAngle);

  // First arm segment
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(-s, -5*s, 2*s, 5*s);
  ctx.fillStyle = '#999';
  ctx.fillRect(-s, -5*s, Math.ceil(s*0.4), 5*s);

  // Joint circle
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.arc(0, -5*s, s, 0, Math.PI*2);
  ctx.fill();

  // Elbow
  ctx.translate(0, -5*s);
  ctx.rotate(arm.foreAngle || 0.3);

  // Second segment
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(-Math.ceil(s*0.7), -4*s, Math.ceil(s*1.4), 4*s);
  ctx.fillStyle = '#777';
  ctx.fillRect(-Math.ceil(s*0.7), -4*s, Math.ceil(s*0.35), 4*s);

  // Wrist
  ctx.translate(0, -4*s);
  ctx.fillStyle = '#666';
  ctx.fillRect(-s, -s, 2*s, s);

  // Gripper
  if(arm.gripperOpen){
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(-2*s, -2*s, s, s);
    ctx.fillRect(s, -2*s, s, s);
  } else {
    ctx.fillStyle = '#00aacc';
    ctx.fillRect(-s, -2*s, s, s);
    ctx.fillRect(0, -2*s, s, s);
  }

  // Glow ring when active
  if(robot.state === 'picking' || robot.state === 'placing'){
    ctx.globalAlpha = 0.3 + 0.3*Math.sin(Date.now()/120);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 3*s, 0, Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

// ─── DRAW PORTRAIT (dossier) ────────────────────────────────────────
P.drawPortrait = function(ctx, char, size){
  const p = char.portrait;
  const s = Math.floor(size / 14); // slightly smaller scale for more detail
  const w = size, h = size;

  ctx.clearRect(0,0,w,h);
  
  // High fidelity background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0a0a0f');
  bgGrad.addColorStop(1, '#020406');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0,0,w,h);

  // Subtle grid overlay
  ctx.strokeStyle = 'rgba(0,255,136,0.04)';
  ctx.lineWidth = 1;
  for(let i=0;i<w;i+=s*2){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
  for(let i=0;i<h;i+=s*2){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }

  if(char.kind==='robot'){
    ctx.fillStyle='#333'; ctx.fillRect(3*s,4*s,8*s,8*s);
    ctx.fillStyle='#555'; ctx.fillRect(4*s,2*s,6*s,4*s);
    ctx.fillStyle='#222'; ctx.fillRect(2*s,5*s,2*s,5*s); ctx.fillRect(10*s,5*s,2*s,5*s);
    ctx.fillRect(4*s,12*s,2*s,2*s); ctx.fillRect(8*s,12*s,2*s,2*s);
    ctx.fillStyle='#00d4ff';
    ctx.fillRect(5*s,3*s,s+1,s+1);
    ctx.fillRect(8*s,3*s,s+1,s+1);
    ctx.fillStyle='rgba(0,212,255,0.1)'; ctx.fillRect(0,0,w,h);
    return;
  }

  const cx = Math.floor(w/2);
  const px = cx - 3*s; // portrait anchor left
  
  // ── Shoulders & Shirt ────────────────────────────────────────────────
  ctx.fillStyle = p.shirt || '#333';
  ctx.fillRect(px - 2*s, 10*s, 10*s, 4*s);
  // Shirt Highlight
  ctx.fillStyle = lighten(p.shirt || '#333', 1.15);
  ctx.fillRect(px - 2*s, 10*s, 1, 4*s);
  ctx.fillRect(px - 2*s, 10*s, 10*s, 1);
  // Shirt shadow
  ctx.fillStyle = darken(p.shirt || '#333', 0.6);
  ctx.fillRect(px + 6*s, 10*s, 2*s, 4*s);
  // Collar
  ctx.fillStyle = p.skin;
  ctx.fillRect(px + s, 9*s, 4*s, s);

  // ── Neck ─────────────────────────────────────────────────────────────
  ctx.fillStyle = p.skin;
  ctx.fillRect(px + s, 7*s, 4*s, 2*s);
  ctx.fillStyle = darken(p.skin, 0.82);
  ctx.fillRect(px + 3*s, 7*s, 2*s, 2*s);

  // ── Head ─────────────────────────────────────────────────────────────
  ctx.fillStyle = p.skin;
  ctx.fillRect(px, 2*s, 6*s, 5*s);
  // Head Highlight
  ctx.fillStyle = lighten(p.skin, 1.1);
  ctx.fillRect(px, 2*s, 3*s, 1);
  ctx.fillRect(px, 2*s, 1, 3*s);
  // Head Shadow
  ctx.fillStyle = darken(p.skin, 0.84);
  ctx.fillRect(px + 5*s, 2*s, s, 5*s);

  // ── Hair ─────────────────────────────────────────────────────────────
  if(p.hair && !p.features.includes('bald')){
    ctx.fillStyle = p.hair;
    if(p.features.includes('long_hair')){
      ctx.fillRect(px, s, 6*s, 2*s);
      ctx.fillRect(px - s, 2*s, s, 5*s);
      ctx.fillRect(px + 6*s, 2*s, s, 5*s);
      ctx.fillRect(px - s, 7*s, 2*s, 3*s);
      // Highlight
      ctx.fillStyle = lighten(p.hair, 1.25);
      ctx.fillRect(px + 2*s, s, 2*s, 1);
    } else if(p.features.includes('hoodie')){
      ctx.fillRect(px, s, 6*s, 2*s);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(px - s, s+s, s, 6*s);
      ctx.fillRect(px + 6*s, s+s, s, 6*s);
    } else {
      ctx.fillRect(px, s, 6*s, 2*s);
      ctx.fillRect(px - s, s+s, s, 2*s);
      // Highlight
      ctx.fillStyle = lighten(p.hair, 1.25);
      ctx.fillRect(px + 2*s, s, 2*s, 1);
    }
  } else if(p.features.includes('bald')){
    ctx.fillStyle = lighten(p.skin, 1.15);
    ctx.fillRect(px + 2*s, 2*s, 3*s, Math.ceil(s*0.8));
    ctx.fillRect(px + 2*s, 2*s, s, 2);
  }

  // ── Eyebrows ─────────────────────────────────────────────────────────
  const browCol = p.hair ? darken(p.hair, 0.85) : darken(p.skin, 0.62);
  if(!p.features.includes('bald')){
    ctx.fillStyle = browCol;
    ctx.fillRect(px + s, 3*s, Math.ceil(s*1.5), Math.ceil(s*0.6));
    ctx.fillRect(px + 4*s, 3*s, Math.ceil(s*1.5), Math.ceil(s*0.6));
  }

  // ── Eyes ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#111';
  ctx.fillRect(px + s, 4*s, Math.ceil(s*1.5), Math.ceil(s*1.5));
  ctx.fillRect(px + 4*s, 4*s, Math.ceil(s*1.5), Math.ceil(s*1.5));
  ctx.fillStyle = '#fff';
  ctx.fillRect(px + s + Math.ceil(s*0.8), 4*s, Math.ceil(s*0.6), Math.ceil(s*0.6));
  ctx.fillRect(px + 4*s + Math.ceil(s*0.8), 4*s, Math.ceil(s*0.6), Math.ceil(s*0.6));

  // ── Nose ─────────────────────────────────────────────────────────────
  ctx.fillStyle = darken(p.skin, 0.8);
  ctx.fillRect(px + 3*s, 5*s, Math.ceil(s*0.8), Math.ceil(s*0.8));

  // ── Cheek blush ──────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,110,90,0.15)';
  ctx.fillRect(px + Math.ceil(s*0.5), 5*s + Math.ceil(s*0.5), Math.ceil(s*1.2), s);
  ctx.fillRect(px + 4*s + Math.ceil(s*0.5), 5*s + Math.ceil(s*0.5), Math.ceil(s*1.2), s);

  // ── Mouth ────────────────────────────────────────────────────────────
  ctx.fillStyle = darken(p.skin, 0.72);
  ctx.fillRect(px + 2*s, 6*s, 2*s, Math.ceil(s*0.6));
  ctx.fillStyle = lighten(p.skin, 1.06);
  ctx.fillRect(px + 2*s, 6*s, 2*s, 1);

  // ── Props ────────────────────────────────────────────────────────────
  if(p.features.includes('beard')){
    ctx.fillStyle = '#aaa';
    ctx.fillRect(px + Math.ceil(s*0.5), 6*s, 5*s, s+s);
    ctx.fillRect(px, 5*s, s, s+s);
    ctx.fillRect(px + 5*s, 5*s, s, s+s);
    ctx.fillStyle = '#888';
    ctx.fillRect(px + s, 7*s, 4*s, Math.ceil(s*0.6));
  }
  if(p.features.includes('glasses')){
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = Math.max(1, Math.ceil(s*0.35));
    ctx.strokeRect(px + Math.ceil(s*0.5), 4*s - 1, 2*s, Math.ceil(s*1.5));
    ctx.strokeRect(px + 3*s + Math.ceil(s*0.5), 4*s - 1, 2*s, Math.ceil(s*1.5));
    ctx.beginPath(); ctx.moveTo(px + 2*s + Math.ceil(s*0.5), 4*s + Math.ceil(s*0.5)); ctx.lineTo(px + 3*s + Math.ceil(s*0.5), 4*s + Math.ceil(s*0.5)); ctx.stroke();
    ctx.fillStyle = 'rgba(150,220,255,0.12)';
    ctx.fillRect(px + Math.ceil(s*0.5) + 1, 4*s, 2*s - 2, Math.ceil(s*1.5) - 1);
    ctx.fillRect(px + 3*s + Math.ceil(s*0.5) + 1, 4*s, 2*s - 2, Math.ceil(s*1.5) - 1);
  }
  if(p.features.includes('headset')){
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(px - s, 3*s, s, 3*s); ctx.fillRect(px + 6*s, 3*s, s, 3*s);
    ctx.fillStyle = '#444';
    ctx.fillRect(px, 2*s, 6*s, Math.ceil(s*0.6));
    ctx.fillStyle = p.accent || '#39ff14';
    ctx.fillRect(px - s, 3*s + 1, Math.ceil(s*0.6), Math.ceil(s*0.6));
    // Mic boom
    ctx.fillStyle = '#333';
    ctx.fillRect(px - s, 5*s, Math.ceil(s*0.5), Math.ceil(s*1.5));
    ctx.fillRect(px - s, 5*s + Math.ceil(s*1.5), s, Math.ceil(s*0.6));
  }
  if(p.features.includes('hard_hat')){
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(px - s, 0, 8*s, 2*s);
    ctx.fillRect(px - 2*s, s+s, 10*s, s);
  }
  if(p.features.includes('goggles')){
    ctx.fillStyle = '#2a1500'; ctx.fillRect(px, 3*s, 6*s, 2*s);
    ctx.fillStyle = 'rgba(255,136,0,0.55)';
    ctx.fillRect(px + Math.ceil(s*0.5), 3*s + Math.ceil(s*0.4), 2*s, Math.ceil(s*1.2));
    ctx.fillRect(px + 3*s + Math.ceil(s*0.5), 3*s + Math.ceil(s*0.4), 2*s, Math.ceil(s*1.2));
    ctx.fillStyle = 'rgba(255,200,100,0.3)';
    ctx.fillRect(px + s, 4*s, Math.ceil(s*0.6), Math.ceil(s*0.6));
    ctx.fillRect(px + 4*s, 4*s, Math.ceil(s*0.6), Math.ceil(s*0.6));
  }
  if(p.features.includes('gold_coat')){
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(px - s, 10*s, s, 4*s); ctx.fillRect(px + 6*s, 10*s, s, 4*s);
  }
  if(p.features.includes('command_sash')){
    ctx.fillStyle = '#ff006e'; ctx.fillRect(px - s, 10*s, 2*s, 4*s);
  }
  
  // ── Overlay accents ──────────────────────────────────────────────────
  if(p.accent){
    ctx.fillStyle = p.accent; ctx.fillRect(w - 2*s, 0, 2*s, 5*s);
    ctx.fillStyle = rgba(p.accent, 0.3); ctx.fillRect(0, h - 2*s, w, 2*s);
  }
};

// ─── DRAW ROOM (floor tiles + wall panel + border) ────────────────────
P.drawRoom = function(ctx, room, rx, ry, rw, rh, pulse, tick){
  const c = room.colors;
  const wallH = Math.floor(rh * 0.30);  // top 30% = wall panel
  const floorY = ry + wallH;
  const floorH = rh - wallH;

  ctx.save();

  // ── Wall panel (top section) — starfield first, then ship tint ───────
  drawWallSpaceBackdrop(ctx, rx, ry, rw, wallH, room.id, tick);
  ctx.fillStyle = rgba(c.bg, 0.40);
  ctx.fillRect(rx, ry, rw, wallH);
  // Side bulkhead depth (thick hull walls)
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(rx, ry, 5, wallH);
  ctx.fillRect(rx+rw-5, ry, 5, wallH);
  ctx.fillStyle = rgba(c.border, 0.10);
  ctx.fillRect(rx+1, ry, 2, wallH);
  ctx.fillRect(rx+rw-3, ry, 2, wallH);
  // Vertical structural ribs
  for(let rib=1; rib<6; rib++){
    const rpx = rx + Math.floor(rw * rib / 6);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(rpx, ry + 5, 4, wallH - 10);
    ctx.fillStyle = rgba(c.border, 0.09);
    ctx.fillRect(rpx+1, ry + 7, 2, wallH - 14);
    ctx.fillStyle = rgba(c.accent, 0.15);
    ctx.fillRect(rpx+1, ry + wallH - 10, 2, 2);
    ctx.fillRect(rpx+1, ry + 8, 2, 2);
  }

  // Horizontal panel lines on wall
  ctx.strokeStyle = rgba(c.border, 0.30);
  ctx.lineWidth = 1;
  const panelRows = 4;
  for(let i=1;i<panelRows;i++){
    const py = ry + Math.floor(wallH * i / panelRows);
    ctx.beginPath(); ctx.moveTo(rx+6, py); ctx.lineTo(rx+rw-6, py); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(rx+6, py, rw-12, 1);
  }
  // Vertical panel dividers on wall
  const panelCols = 7;
  for(let i=1;i<panelCols;i++){
    const px = rx + Math.floor(rw * i / panelCols);
    ctx.beginPath(); ctx.moveTo(px, ry+2); ctx.lineTo(px, ry+wallH-2); ctx.stroke();
  }
  // Wall access hatches (bolted)
  const hatchSeed = (room.id||'').split('').reduce(function(a,ch){ return a+ch.charCodeAt(0); }, 0);
  for(let hi=0; hi<3; hi++){
    const hx = rx + 12 + ((hatchSeed + hi*47) % Math.max(8, rw - 56));
    const hy = ry + 8 + ((hi * 19 + hatchSeed) % Math.max(6, wallH - 36));
    ctx.fillStyle = rgba(c.bg, 0.62);
    ctx.fillRect(hx, hy, 22, 18);
    ctx.strokeStyle = rgba(c.border, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(hx, hy, 22, 18);
    for(let bx=0; bx<3; bx++){
      for(let by=0; by<2; by++){
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(hx+4+bx*7, hy+4+by*8, 2, 2);
      }
    }
  }

  // Small vent slots on wall
  ctx.fillStyle = rgba(c.border, 0.35);
  for(let v=0; v<6; v++){
    const vx = rx + 10 + v * Math.floor((rw-20)/5);
    ctx.fillRect(vx, ry + wallH - 10, 12, 2);
    ctx.fillRect(vx, ry + wallH - 6, 12, 2);
    ctx.fillRect(vx, ry + wallH - 2, 12, 1);
  }
  // Cable conduit trunking (wall, horizontal segments)
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(rx+8, ry + wallH - 14, rw-16, 5);
  ctx.strokeStyle = rgba(c.border, 0.25);
  ctx.strokeRect(rx+8, ry + wallH - 14, rw-16, 5);
  for(let ci=0; ci<Math.floor((rw-20)/14); ci++){
    ctx.fillStyle = rgba(c.glow, ((tick+ci+hatchSeed)%24)<12 ? 0.35 : 0.12);
    ctx.fillRect(rx+10+ci*14, ry+wallH-12, 6, 2);
  }

  // Wall–floor divider strip
  ctx.fillStyle = darken(c.bg, 0.40);
  ctx.fillRect(rx, floorY-2, rw, 5);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, floorY+3); ctx.lineTo(rx+rw, floorY+3); ctx.stroke();

  // ── Floor tiles ──────────────────────────────────────────────────────
  const tileSize = 20;
  const tileA = darken(c.bg, 0.82);
  const tileB = darken(c.bg, 0.92);
  const grout = darken(c.bg, 0.45);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx+1, floorY+4, rw-2, floorH-5);
  ctx.clip();

  for(let ty = floorY+4; ty < ry+rh; ty += tileSize){
    for(let tx = rx; tx < rx+rw; tx += tileSize){
      const col = Math.floor((tx - rx) / tileSize);
      const row = Math.floor((ty - (floorY+4)) / tileSize);
      ctx.fillStyle = (col + row) % 2 === 0 ? tileA : tileB;
      ctx.fillRect(tx+1, ty+1, tileSize-2, tileSize-2);
      // deck plate edge bevel
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(tx+1, ty+1, tileSize-2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(tx+1, ty+tileSize-2, tileSize-2, 1);
    }
  }
  // Grout lines
  ctx.strokeStyle = grout;
  ctx.lineWidth = 1;
  for(let tx = rx; tx <= rx+rw; tx += tileSize){
    ctx.beginPath(); ctx.moveTo(tx, floorY+4); ctx.lineTo(tx, ry+rh); ctx.stroke();
  }
  for(let ty = floorY+4; ty <= ry+rh; ty += tileSize){
    ctx.beginPath(); ctx.moveTo(rx, ty); ctx.lineTo(rx+rw, ty); ctx.stroke();
  }
  ctx.restore();

  // ── Industrial deck overlay (diamond tread + welds + drains) ────────
  {
    const rid = (room.id || '?').split('').reduce(function(a, ch){ return a + ch.charCodeAt(0); }, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx + 3, floorY + 4, rw - 6, floorH - 6);
    ctx.clip();
    ctx.beginPath();
    for(let gx = rx + 4; gx < rx + rw - 4; gx += 11){
      for(let gy = floorY + 6; gy < ry + rh - 6; gy += 11){
        ctx.moveTo(gx, gy); ctx.lineTo(gx + 4, gy + 4);
        ctx.moveTo(gx + 4, gy); ctx.lineTo(gx, gy + 4);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for(let wn = 0; wn < 32; wn++){
      const wx = rx + 16 + ((wn * 41 + rid) % Math.max(1, rw - 32));
      const wy = floorY + 14 + ((wn * 59 + rid * 2) % Math.max(1, floorH - 28));
      ctx.fillRect(wx, wy, 2, 1);
      ctx.fillRect(wx + 1, wy + 1, 1, 1);
    }
    const drains = [
      [rx + 22, ry + rh - 26],
      [rx + rw - 34, ry + rh - 24],
      [rx + Math.floor(rw / 2) - 6, floorY + 14],
    ];
    drains.forEach(function(d, di){
      const cx0 = d[0] + 5, cy0 = d[1] + 5, rr = 5 + (di % 2);
      ctx.fillStyle = '#040508';
      ctx.beginPath();
      ctx.arc(cx0, cy0, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,110,130,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      for(let rr2 = 0; rr2 < 4; rr2++){
        ctx.beginPath();
        ctx.moveTo(cx0 + Math.cos(rr2 * 1.57) * 1.5, cy0 + Math.sin(rr2 * 1.57) * 1.5);
        ctx.lineTo(cx0 + Math.cos(rr2 * 1.57) * (rr - 1), cy0 + Math.sin(rr2 * 1.57) * (rr - 1));
        ctx.stroke();
      }
    });
    // Low deck stanchions (support posts)
    [rx + 14, rx + rw - 20].forEach(function(px0){
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(px0, floorY + 28, 5, floorH - 44);
      ctx.fillStyle = rgba(c.border, 0.35);
      ctx.fillRect(px0 + 1, floorY + 30, 3, floorH - 48);
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(px0 - 1, floorY + 26, 7, 3);
      ctx.fillRect(px0 - 1, ry + rh - 18, 7, 3);
    });
    ctx.restore();
  }

  // ── Radial ambient glow (Brighter, richer) ──────────────────────────
  try {
    const grd = ctx.createRadialGradient(rx+rw/2, ry+rh/2, 0, rx+rw/2, ry+rh/2, rw*0.75);
    grd.addColorStop(0, rgba(c.glow, 0.25));
    grd.addColorStop(0.5, rgba(c.glow, 0.10));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(rx, ry, rw, rh);
    // Pulse layer
    const pgrd = ctx.createRadialGradient(rx+rw/2, ry+rh/2, 0, rx+rw/2, ry+rh/2, rw*0.5);
    pgrd.addColorStop(0, rgba(c.accent, 0.15 * pulse));
    pgrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pgrd;
    ctx.fillRect(rx, ry, rw, rh);
  } catch(e){}

  // ── Edge depth shadows (left/right walls) ────────────────────────────
  const makeH = ctx.createLinearGradient(rx, 0, rx+24, 0);
  makeH.addColorStop(0, 'rgba(0,0,0,0.5)');
  makeH.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = makeH;
  ctx.fillRect(rx, floorY, 24, floorH);

  const makeH2 = ctx.createLinearGradient(rx+rw, 0, rx+rw-24, 0);
  makeH2.addColorStop(0, 'rgba(0,0,0,0.5)');
  makeH2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = makeH2;
  ctx.fillRect(rx+rw-24, floorY, 24, floorH);

  // Bottom shadow
  const makeV = ctx.createLinearGradient(0, ry+rh, 0, ry+rh-18);
  makeV.addColorStop(0, 'rgba(0,0,0,0.30)');
  makeV.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = makeV;
  ctx.fillRect(rx, ry+rh-18, rw, 18);

  // ── Wall-mounted monitors + status strip (richer details) ───────────
  const monW = 24, monH = 16, monGap = 5;
  const monRowY = ry + 12;
  const monStart = rx + 14;
  const monCount = Math.floor((rw - 28) / (monW + monGap));
  for(let mi = 0; mi < monCount; mi++){
    const mx = monStart + mi * (monW + monGap);
    const my = monRowY;
    // bezel
    ctx.fillStyle = '#020408';
    ctx.fillRect(mx, my, monW, monH);
    ctx.strokeStyle = darken(c.bg, 0.10);
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, monW, monH);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(mx+1, my+1, monW-2, 1);
    
    // screen
    const screenOn = Math.sin(tick/25 + mi*1.1) > -0.5;
    if(screenOn){
      const sbg = ctx.createLinearGradient(mx, my, mx, my+monH);
      sbg.addColorStop(0, rgba(c.glow, 0.6));
      sbg.addColorStop(1, rgba(c.glow, 0.2));
      ctx.fillStyle = sbg;
      ctx.fillRect(mx+1, my+1, monW-2, monH-2);
      
      // Animated graphs / text
      ctx.fillStyle = c.accent;
      const t1 = tick/10 + mi*7;
      ctx.fillRect(mx+2, my+3, Math.floor((monW-4)*(0.3+0.4*Math.sin(t1))), 1);
      ctx.fillRect(mx+2, my+6, Math.floor((monW-4)*(0.5+0.3*Math.cos(t1*1.3))), 1);
      ctx.fillRect(mx+2, my+9, Math.floor((monW-4)*(0.4+0.5*Math.sin(t1*0.8))), 1);
      // Status dot
      ctx.fillStyle = Math.sin(t1*2)>0 ? '#fff' : '#ff0044';
      ctx.fillRect(mx+monW-4, my+monH-4, 2, 2);
    } else {
      ctx.fillStyle = darken(c.bg, 0.45);
      ctx.fillRect(mx+1, my+1, monW-2, monH-2);
    }
    // mount stem
    ctx.fillStyle = '#000';
    ctx.fillRect(mx + monW/2 - 2, my + monH, 4, 4);
    ctx.fillStyle = darken(c.bg, 0.20);
    ctx.fillRect(mx + monW/2 - 1, my + monH, 2, 4);
  }
  
  // Databanks / Sub-panels under monitors
  const subH = 8;
  const subMy = monRowY + monH + 5;
  for(let si = 0; si < Math.min(10, monCount + 3); si++){
    const smx = rx + 8 + si * Math.floor((rw - 16) / 10);
    ctx.fillStyle = '#04060a';
    ctx.fillRect(smx, subMy, 14, subH);
    ctx.strokeStyle = rgba(c.border, 0.45);
    ctx.strokeRect(smx, subMy, 14, subH);
    const bars = 4;
    for(let b=0; b<bars; b++){
      const on = Math.sin(tick/12 + si*3 + b) > 0;
      ctx.fillStyle = on ? rgba(c.glow, 0.8) : rgba(c.glow, 0.1);
      ctx.fillRect(smx + 2 + b*3, subMy + 2, 2, 4);
    }
  }

  // Room titles are drawn in HTML (#room-labels-layer) so they stay crisp above all canvas layers.

  // ── Vertical LED strips on side walls (enhanced) ─────────────────────
  const ledTop = floorY + 8;
  const ledBot = ry + rh - 16;
  const ledH = ledBot - ledTop;
  // Left strip
  ctx.fillStyle = '#000';
  ctx.fillRect(rx+2, ledTop, 5, ledH);
  ctx.strokeStyle = rgba(c.border,0.3); ctx.strokeRect(rx+2, ledTop, 5, ledH);
  for(let li=0; li<Math.floor(ledH/6); li++){
    const ly = ledTop + li*6;
    const on = Math.sin(tick/12 + li*0.4) > -0.2;
    ctx.fillStyle = on ? c.accent : darken(c.accent, 0.4);
    ctx.fillRect(rx+4, ly+1, 2, 3);
    if(on){
      ctx.fillStyle = rgba(c.accent, 0.4);
      ctx.fillRect(rx+1, ly, 7, 5);
    }
  }
  // Right strip
  ctx.fillStyle = '#000';
  ctx.fillRect(rx+rw-7, ledTop, 5, ledH);
  ctx.strokeStyle = rgba(c.border,0.3); ctx.strokeRect(rx+rw-7, ledTop, 5, ledH);
  for(let li2=0; li2<Math.floor(ledH/6); li2++){
    const ly2 = ledTop + li2*6;
    const on2 = Math.sin(tick/12 + li2*0.4 + 2) > -0.2;
    ctx.fillStyle = on2 ? c.accent : darken(c.accent, 0.4);
    ctx.fillRect(rx+rw-5, ly2+1, 2, 3);
    if(on2){
      ctx.fillStyle = rgba(c.accent, 0.4);
      ctx.fillRect(rx+rw-8, ly2, 7, 5);
    }
  }
  
  // ── Floor Scanning Laser Grid ─────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx+8, floorY+8, rw-16, floorH-16);
  ctx.clip();
  const scanY = floorY + 8 + (tick*1.5 % (floorH-16));
  const sGrad = ctx.createLinearGradient(0, scanY-10, 0, scanY+10);
  sGrad.addColorStop(0, 'rgba(0,0,0,0)');
  sGrad.addColorStop(0.5, rgba(c.accent, 0.3));
  sGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sGrad;
  ctx.fillRect(rx+8, scanY-10, rw-16, 20);
  ctx.fillStyle = rgba(c.accent, 0.8);
  ctx.fillRect(rx+8, scanY, rw-16, 1);
  ctx.restore();

  // ── Floor circuit traces (subtle cyan grid lines) ───────────────────
  ctx.strokeStyle = rgba(c.glow, 0.18);
  ctx.lineWidth = 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx+8, floorY+8, rw-16, floorH-16);
  ctx.clip();
  // L-shaped trace
  ctx.beginPath();
  ctx.moveTo(rx+20, floorY+20);
  ctx.lineTo(rx+rw-30, floorY+20);
  ctx.lineTo(rx+rw-30, ry+rh-25);
  ctx.stroke();
  // diagonal trace
  ctx.beginPath();
  ctx.moveTo(rx+30, floorY+30);
  ctx.lineTo(rx+rw-50, floorY+30);
  ctx.stroke();
  // node dots on traces
  ctx.fillStyle = rgba(c.glow, 0.5);
  ctx.fillRect(rx+20-1, floorY+20-1, 3, 3);
  ctx.fillRect(rx+rw-30-1, floorY+20-1, 3, 3);
  ctx.fillRect(rx+rw-30-1, ry+rh-25-1, 3, 3);
  ctx.restore();

  // ── Power conduit running along bottom of wall panel ────────────────
  ctx.fillStyle = '#000';
  ctx.fillRect(rx+8, floorY-6, rw-16, 4);
  ctx.fillStyle = rgba(c.glow, 0.45);
  for(let pc=0; pc<Math.floor((rw-16)/12); pc++){
    const px = rx + 10 + pc*12;
    const on = ((tick + pc*4) % 40) < 20;
    ctx.fillStyle = on ? c.accent : darken(c.accent, 0.4);
    ctx.fillRect(px, floorY-5, 8, 2);
  }


  // ── Ceiling pipes (run across wall area) ─────────────────────────────
  const pipeY1 = ry + 6;
  const pipeY2 = ry + 12;
  ctx.fillStyle = darken(c.bg, 0.30);
  ctx.fillRect(rx+10, pipeY1, rw-20, 3);
  ctx.fillStyle = darken(c.bg, 0.22);
  ctx.fillRect(rx+10, pipeY1+3, rw-20, 1);
  ctx.fillStyle = rgba(c.glow, 0.45);
  ctx.fillRect(rx+10, pipeY2, rw-20, 2);
  // pipe brackets
  for(let bx = rx+24; bx < rx+rw-24; bx += 60){
    ctx.fillStyle = darken(c.bg, 0.20);
    ctx.fillRect(bx, ry+4, 5, 11);
  }
  // Energy nodes flowing along pipe
  for(let p=0;p<3;p++){
    const px = rx + 14 + ((tick*2 + p*120) % (rw-28));
    ctx.fillStyle = rgba(c.accent, 0.9);
    ctx.fillRect(px, pipeY2, 6, 2);
  }
  // Hanging light fixtures (Brighter, more volumetric)
  const lightCount = 4;
  for(let li=0; li<lightCount; li++){
    const lx = rx + Math.floor(rw*(li+1)/(lightCount+1));
    ctx.fillStyle = darken(c.bg, 0.40);
    ctx.fillRect(lx-1, ry+15, 2, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(lx-2, ry+21, 4, 2);
    
    const fOn = Math.sin(tick/20 + li) > -0.8; // Flicker
    if(fOn){
      ctx.fillStyle = rgba(c.glow, 0.6 + 0.3*Math.sin(tick/10+li));
      ctx.beginPath(); ctx.arc(lx, ry+24, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx-1, ry+23, 2, 2);
      
      // Volumetric light cone
      try {
        const cone = ctx.createLinearGradient(lx, ry+25, lx, floorY+40);
        cone.addColorStop(0, rgba(c.glow, 0.35));
        cone.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(lx-2, ry+25); ctx.lineTo(lx+2, ry+25);
        ctx.lineTo(lx+18, floorY+40); ctx.lineTo(lx-18, floorY+40);
        ctx.closePath(); ctx.fill();
      } catch(e){}
    }
  }

  // ── Floor grates (decorative strips at edges) ────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(rx+4, ry+rh-11, 48, 7);
  ctx.fillRect(rx+rw-52, ry+rh-11, 48, 7);
  ctx.strokeStyle = rgba(c.border, 0.45); ctx.lineWidth = 1;
  for(let g=0; g<9; g++){
    ctx.beginPath();
    ctx.moveTo(rx+5+g*5, ry+rh-11); ctx.lineTo(rx+5+g*5, ry+rh-4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rx+rw-51+g*5, ry+rh-11); ctx.lineTo(rx+rw-51+g*5, ry+rh-4);
    ctx.stroke();
  }
  // Caution strip along deck edge (under wall)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(rx+4, floorY+2, rw-8, 6);
  for(let cz = 0; cz < Math.floor((rw-8)/10); cz++){
    ctx.fillStyle = (cz % 2 === 0) ? 'rgba(255,200,0,0.5)' : 'rgba(30,25,10,0.7)';
    ctx.fillRect(rx+4+cz*10, floorY+2, 10, 6);
  }

  // ── Wall corner rivets + edge bolt rows ─────────────────────────────
  ctx.fillStyle = rgba(c.accent, 0.8);
  [[rx+5,ry+5],[rx+rw-7,ry+5],[rx+5,floorY-7],[rx+rw-7,floorY-7]].forEach(function(pt){
    ctx.fillRect(pt[0], pt[1], 2, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(pt[0], pt[1], 1, 1); ctx.fillStyle = rgba(c.accent, 0.8);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for(let eb = 10; eb < rw - 10; eb += 9){
    ctx.fillRect(rx + eb, ry + 3, 1, 1);
    ctx.fillRect(rx + eb, floorY - 5, 1, 1);
  }

  // ── Ambient sparks & dust (more prominent) ──────────────────────────
  if((tick + (rx|0)) % 60 < 8){
    const sx = rx + 20 + (tick*7 % (rw-40));
    const sy = floorY + 10 + ((tick*4) % (floorH-20));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy, 2, 2);
    ctx.fillStyle = 'rgba(255,220,100,0.8)';
    ctx.fillRect(sx-1, sy-1, 4, 4);
    ctx.fillStyle = 'rgba(255,150,50,0.4)';
    ctx.fillRect(sx-3, sy-3, 8, 8);
  }
  for(let p=0; p<4; p++){
    const dx = rx + 10 + ((tick*1.3 + p*137) % (rw-20));
    const dy = floorY + 10 + ((tick*0.8 + p*73) % (floorH-20));
    ctx.fillStyle = 'rgba(150,200,255,0.15)';
    ctx.fillRect(dx, dy, 2, 2);
  }


  // ── Border & special treatments ──────────────────────────────────────
  if(room.isCaptain){
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 12 + 6*pulse;
    ctx.strokeRect(rx+1, ry+1, rw-2, rh-2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,204,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx+5, ry+5, rw-10, rh-10);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★', rx + rw - 14, monRowY + 8);
    ctx.textAlign = 'left';
  } else {
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 5 + 4*pulse;
    ctx.strokeRect(rx+1, ry+1, rw-2, rh-2);
    ctx.shadowBlur = 0;
    // Inner structural frame
    ctx.strokeStyle = rgba(c.border, 0.22);
    ctx.lineWidth = 1;
    ctx.strokeRect(rx+5, ry+5, rw-10, rh-10);
  }

  // Corner brackets
  const blen = 12;
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 2;
  [[rx,ry],[rx+rw,ry],[rx,ry+rh],[rx+rw,ry+rh]].forEach(([cx2,cy2],i)=>{
    const sx=i%2===0?1:-1, sy=i<2?1:-1;
    ctx.beginPath();
    ctx.moveTo(cx2+sx*blen, cy2); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2+sy*blen);
    ctx.stroke();
  });

  // Pulse flash
  if(pulse > 0.75){
    ctx.strokeStyle = rgba(c.border, 0.25);
    ctx.lineWidth = 3;
    ctx.strokeRect(rx+1, ry+1, rw-2, rh-2);
  }

  ctx.restore();
};

// ─── DRAW DECOR ─────────────────────────────────────────────────────
// Stores hitboxes into GAME.decorHitboxes for hover detection
P.drawDecor = function(ctx, room, rx, ry, rw, rh, tick){
  if(!GAME.decorHitboxes) GAME.decorHitboxes = [];
  const c = room.colors;
  const decor = room.decor || [];

  // Slot grid: 3 columns × 2 rows within room
  const marginX = 16, marginY = 36;
  const cols = 3;
  const slotW = Math.floor((rw - marginX*2) / cols);
  const slotH = Math.floor((rh - marginY - 55) / 2); // leave bottom 55px for crew walking
  const gapX = 4;

  decor.slice(0, 6).forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = rx + marginX + col * (slotW + gapX);
    const sy = ry + marginY + row * (slotH + 6);
    const sw = slotW - gapX;
    const sh = slotH - 4;

    // Store hitbox for hover detection
    GAME.decorHitboxes.push({ sx, sy, sw, sh, id: d, roomId: room.id });

    ctx.save();
    drawDecorItem(ctx, d, sx, sy, sw, sh, c, tick);
    ctx.restore();
  });
};

function drawDecorItem(ctx, id, sx, sy, sw, sh, c, tick){
  const blink = Math.sin(tick/40) > 0.6;
  const pulse2 = (Math.sin(tick/25) + 1) / 2;

  switch(id){

    // ── BRIDGE ────────────────────────────────────────────────────────
    case 'console_large': {
      ctx.fillStyle='#0a0a1a'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#111'; ctx.fillRect(sx+3,sy+4,sw-6,sh-16);
      // Screen content
      ctx.fillStyle=blink?c.accent:c.border;
      for(let ln=0;ln<4;ln++) ctx.fillRect(sx+6, sy+8+ln*6, Math.floor((sw-12)*(0.4+0.6*Math.random())), 2);
      // Controls bottom
      ctx.fillStyle='#222'; ctx.fillRect(sx,sy+sh-12,sw,12);
      for(let b=0;b<5;b++){
        ctx.fillStyle = b===2?c.accent:'#333';
        ctx.fillRect(sx+6+b*Math.floor((sw-12)/5), sy+sh-9, Math.floor((sw-12)/5)-2, 6);
      }
      break;
    }
    case 'screens_side': {
      for(let sc=0;sc<3;sc++){
        ctx.fillStyle='#060610'; ctx.fillRect(sx+sc*Math.floor(sw/3)+2, sy+3, Math.floor(sw/3)-4, sh-6);
        ctx.fillStyle=sc===1?c.border:rgba(c.accent,0.7);
        ctx.fillRect(sx+sc*Math.floor(sw/3)+4, sy+6, Math.floor(sw/3)-8, sh-14);
        // scanline
        ctx.fillStyle='rgba(0,0,0,0.3)';
        const scanY = (tick*2 % (sh-14));
        ctx.fillRect(sx+sc*Math.floor(sw/3)+4, sy+6+scanY, Math.floor(sw/3)-8, 2);
      }
      break;
    }
    case 'command_chair': {
      // Chair back
      ctx.fillStyle='#880020'; ctx.fillRect(sx+Math.floor(sw*0.2),sy+4,Math.floor(sw*0.6),Math.floor(sh*0.55));
      // Seat
      ctx.fillStyle='#660018'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+Math.floor(sh*0.55),Math.floor(sw*0.8),Math.floor(sh*0.3));
      // Armrests
      ctx.fillStyle='#444';
      ctx.fillRect(sx+4, sy+Math.floor(sh*0.5), 8, Math.floor(sh*0.2));
      ctx.fillRect(sx+sw-12, sy+Math.floor(sh*0.5), 8, Math.floor(sh*0.2));
      // Highlight
      ctx.fillStyle='rgba(255,0,80,0.2)'; ctx.fillRect(sx+Math.floor(sw*0.2),sy+4,Math.floor(sw*0.3),Math.floor(sh*0.2));
      break;
    }
    case 'tactical_map': {
      ctx.fillStyle='#000a14'; ctx.fillRect(sx,sy,sw,sh);
      // Star map dots
      ctx.fillStyle='rgba(100,150,255,0.6)';
      for(let st=0;st<12;st++){
        const mx=(st*37+11)%sw, my=(st*53+7)%sh;
        ctx.fillRect(sx+mx, sy+my, st<4?2:1, st<4?2:1);
      }
      // Ship position blip
      ctx.fillStyle=blink?c.accent:'transparent';
      ctx.fillRect(sx+Math.floor(sw/2)-2, sy+Math.floor(sh/2)-2, 4, 4);
      ctx.strokeStyle=c.accent; ctx.lineWidth=1;
      ctx.strokeRect(sx+Math.floor(sw/2)-6, sy+Math.floor(sh/2)-6, 12, 12);
      break;
    }
    case 'status_board': {
      ctx.fillStyle='#f0ead0'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#8b6914'; ctx.lineWidth=1; ctx.strokeRect(sx,sy,sw,sh);
      ctx.fillStyle='#2a1a08';
      ctx.font='bold 7px monospace'; ctx.textAlign='left';
      const rows2=['STATUS: OK','CREW: 14/14','ROBOT: ON','ROS2: LIVE'];
      rows2.forEach((r,i)=>{ ctx.fillStyle=i===0?'#008800':'#2a1a08'; ctx.fillText(r,sx+4,sy+12+i*10); });
      ctx.textAlign='left';
      break;
    }
    case 'mission_clock': {
      ctx.fillStyle='#080810'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#001a00'; ctx.fillRect(sx+4,sy+4,sw-8,sh-8);
      ctx.fillStyle='#00ff44';
      ctx.font=`bold ${Math.floor(sh*0.38)}px VT323, monospace`;
      ctx.textAlign='center';
      const now=new Date();
      ctx.fillText(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, sx+sw/2, sy+sh-8);
      ctx.textAlign='left';
      break;
    }

    // ── CAPTAIN'S CABIN ───────────────────────────────────────────────
    case 'desk_ornate': {
      ctx.fillStyle='#3a2000'; ctx.fillRect(sx,sy+Math.floor(sh*0.4),sw,Math.floor(sh*0.6));
      ctx.fillStyle='#4a2800'; ctx.fillRect(sx+3,sy+Math.floor(sh*0.35),sw-6,Math.floor(sh*0.12));
      // Papers & stuff on desk
      ctx.fillStyle='#f0e8c0'; ctx.fillRect(sx+6,sy+Math.floor(sh*0.1),Math.floor(sw*0.35),Math.floor(sh*0.28));
      ctx.fillStyle='#e0d0a0'; ctx.fillRect(sx+Math.floor(sw*0.45),sy+Math.floor(sh*0.08),Math.floor(sw*0.3),Math.floor(sh*0.3));
      // Pen
      ctx.fillStyle='#222'; ctx.fillRect(sx+Math.floor(sw*0.78),sy+Math.floor(sh*0.05),3,Math.floor(sh*0.32));
      break;
    }
    case 'bookshelf': {
      ctx.fillStyle='#2a1800'; ctx.fillRect(sx,sy,sw,sh);
      const colors=['#cc4400','#2244cc','#44cc22','#cccc00','#cc00cc','#00cccc','#cc8800','#4444cc'];
      const bw=Math.floor(sw/8)-1;
      colors.forEach((col,i)=>{
        const bh=Math.floor(sh*0.5+Math.random()*sh*0.35);
        ctx.fillStyle=col; ctx.fillRect(sx+2+i*(bw+1), sy+sh-bh-4, bw, bh);
        ctx.fillStyle=darken(col,0.6); ctx.fillRect(sx+2+i*(bw+1), sy+sh-bh-4, 2, bh);
      });
      // Shelf lines
      ctx.fillStyle='#3a2000'; ctx.fillRect(sx,sy+sh-4,sw,4);
      ctx.fillRect(sx,sy,4,sh); ctx.fillRect(sx+sw-4,sy,4,sh);
      break;
    }
    case 'coffe_pot': {
      // Coffee machine/pot
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(sx+Math.floor(sw*0.2),sy+4,Math.floor(sw*0.6),Math.floor(sh*0.8));
      ctx.fillStyle='#663300'; ctx.fillRect(sx+Math.floor(sw*0.25),sy+Math.floor(sh*0.35),Math.floor(sw*0.5),Math.floor(sh*0.35));
      ctx.fillStyle=blink?'#ff6600':'#993300';
      ctx.fillRect(sx+Math.floor(sw*0.35),sy+8,Math.floor(sw*0.3),6);
      // Steam
      if(blink){ ctx.fillStyle='rgba(255,200,200,0.5)'; ctx.fillRect(sx+Math.floor(sw*0.45),sy-4,4,6); }
      break;
    }
    case 'whiteboard': {
      ctx.fillStyle='#eeeedd'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#8b6914'; ctx.lineWidth=2; ctx.strokeRect(sx,sy,sw,sh);
      // Equations
      ctx.fillStyle='#2244aa';
      ctx.font='6px monospace'; ctx.textAlign='left';
      ['J = ∫ F·ds', 'θ = arctan(y/x)', 'τ = r × F', '∇²φ = 0'].forEach((eq,i)=>{
        ctx.fillText(eq, sx+5, sy+12+i*10);
      });
      // Erased smudge
      ctx.fillStyle='rgba(240,240,220,0.5)'; ctx.fillRect(sx+Math.floor(sw*0.55),sy+6,Math.floor(sw*0.35),Math.floor(sh*0.3));
      break;
    }
    case 'diploma_wall': {
      ctx.fillStyle='#c8a060'; ctx.fillRect(sx,sy,sw,sh);
      // Two framed diplomas
      [[sx+4,sy+4],[sx+Math.floor(sw/2)+2,sy+4]].forEach(([fx,fy])=>{
        const fw=Math.floor(sw/2)-8, fh=Math.floor(sh*0.85);
        ctx.fillStyle='#f0e6c0'; ctx.fillRect(fx,fy,fw,fh);
        ctx.strokeStyle='#8b6914'; ctx.lineWidth=1; ctx.strokeRect(fx,fy,fw,fh);
        ctx.fillStyle='#2a1a08'; ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('CERT.',fx+fw/2,fy+fh/2);
      });
      ctx.textAlign='left';
      break;
    }
    case 'globe': {
      const cx2=sx+Math.floor(sw/2), cy2=sy+Math.floor(sh*0.48);
      const r=Math.min(Math.floor(sw*0.38),Math.floor(sh*0.4));
      ctx.fillStyle='#001a40'; ctx.beginPath(); ctx.arc(cx2,cy2,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#0044aa'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(cx2,cy2,r,0,Math.PI*2); ctx.stroke();
      // Meridians
      ctx.strokeStyle='rgba(0,100,200,0.4)'; ctx.lineWidth=1;
      for(let m=-1;m<=1;m++){
        ctx.beginPath(); ctx.moveTo(cx2,cy2-r); ctx.lineTo(cx2+m*r*0.7,cy2+r); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx2,cy2,r*0.5,0,Math.PI*2); ctx.stroke();
      // Stand
      ctx.fillStyle='#3a2000'; ctx.fillRect(cx2-8,cy2+r-2,16,6);
      break;
    }

    // ── COMMS ARRAY ───────────────────────────────────────────────────
    case 'switchboard': {
      ctx.fillStyle='#0a0a18'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#111'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      // Switches and dials
      const switchCount=Math.floor(sw/8);
      for(let b=0;b<switchCount;b++){
        const active=(tick+b*7)%30<15;
        ctx.fillStyle=active?c.accent:'#222';
        ctx.fillRect(sx+4+b*8, sy+8, 5, 8);
        ctx.fillStyle='#555';
        ctx.fillRect(sx+4+b*8, active?sy+12:sy+8, 5, 4);
      }
      // VU meter bars
      for(let v=0;v<5;v++){
        const h2=Math.floor((sh-24)*(0.3+0.7*Math.abs(Math.sin(tick/15+v))));
        ctx.fillStyle=v<3?'#00cc44':v===3?'#ffcc00':'#ff2244';
        ctx.fillRect(sx+4+v*Math.floor((sw-8)/5), sy+sh-4-h2, Math.floor((sw-8)/5)-2, h2);
      }
      break;
    }
    case 'multi_screens': {
      for(let sc=0;sc<3;sc++){
        ctx.fillStyle='#080808'; ctx.fillRect(sx+sc*Math.floor(sw/3)+1, sy+2, Math.floor(sw/3)-2, sh-4);
        ctx.fillStyle=sc===1?c.border:rgba(c.accent,0.5);
        ctx.fillRect(sx+sc*Math.floor(sw/3)+3, sy+5, Math.floor(sw/3)-6, sh-12);
        // waveform on middle screen
        if(sc===1){
          ctx.strokeStyle='#ff9944'; ctx.lineWidth=1; ctx.beginPath();
          for(let xx=0;xx<Math.floor(sw/3)-8;xx++) ctx.lineTo(sx+sc*Math.floor(sw/3)+4+xx, sy+sh/2+Math.sin((tick/8)+xx*0.5)*8);
          ctx.stroke();
        }
      }
      break;
    }
    case 'antenna_dish': {
      const cx2=sx+Math.floor(sw/2);
      // Dish
      ctx.strokeStyle='#888'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx2, sy+Math.floor(sh*0.6), Math.floor(sw*0.38), Math.PI, 0); ctx.stroke();
      // Support arm
      ctx.fillStyle='#666'; ctx.fillRect(cx2-2, sy+6, 4, Math.floor(sh*0.55));
      // Signal rings
      ctx.strokeStyle=blink?c.accent:'rgba(255,150,60,0.3)';
      ctx.lineWidth=1;
      [8,14,20].forEach(r=>{ ctx.beginPath(); ctx.arc(cx2,sy+8,r,Math.PI*1.2,Math.PI*1.8); ctx.stroke(); });
      break;
    }
    case 'blinking_lights': {
      ctx.fillStyle='#0a0a12'; ctx.fillRect(sx,sy,sw,sh);
      const lc=Math.floor(sw/10);
      for(let l=0;l<lc;l++){
        for(let r=0;r<3;r++){
          const on=(tick+l+r*3)%20<10;
          ctx.fillStyle=on?(['#ff2244','#ffcc00','#00ff88'][r]):'#222';
          ctx.fillRect(sx+4+l*Math.floor((sw-8)/lc), sy+6+r*Math.floor((sh-12)/3), 6, Math.floor((sh-12)/3)-2);
        }
      }
      break;
    }
    case 'signal_monitor': {
      ctx.fillStyle='#080818'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#001018'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      // Frequency graph
      ctx.strokeStyle='#ff9944'; ctx.lineWidth=1; ctx.beginPath();
      ctx.moveTo(sx+4, sy+sh/2);
      for(let xx=0;xx<sw-8;xx++){
        const y2=sy+sh/2 + Math.sin((tick/6)+xx*0.15)*12 * Math.sin(xx*0.08);
        ctx.lineTo(sx+4+xx, y2);
      }
      ctx.stroke();
      // Frequency label
      ctx.fillStyle=c.accent; ctx.font='7px monospace'; ctx.textAlign='center';
      ctx.fillText('2.4 GHz', sx+sw/2, sy+sh-4);
      ctx.textAlign='left';
      break;
    }
    case 'headset_hook': {
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(sx+Math.floor(sw*0.3),sy,Math.floor(sw*0.1),sh);
      ctx.strokeStyle='#444'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sx+Math.floor(sw*0.35),sy+12,10,Math.PI,0); ctx.stroke();
      ctx.fillStyle='#333'; ctx.fillRect(sx+Math.floor(sw*0.22),sy+10,6,5);
      ctx.fillRect(sx+Math.floor(sw*0.42),sy+10,6,5);
      ctx.fillStyle='#555'; ctx.fillRect(sx+Math.floor(sw*0.31),sy+12,8,4);
      break;
    }

    // ── PATRON'S SUITE ────────────────────────────────────────────────
    case 'luxury_desk': {
      ctx.fillStyle='#4a2800'; ctx.fillRect(sx,sy+Math.floor(sh*0.4),sw,Math.floor(sh*0.6));
      ctx.fillStyle='#5a3200'; ctx.fillRect(sx+4,sy+Math.floor(sh*0.35),sw-8,Math.floor(sh*0.12));
      ctx.fillStyle='#ffcc00'; ctx.fillRect(sx+4,sy+Math.floor(sh*0.35),4,Math.floor(sh*0.12)); // gold inlay
      // Computer / tablet
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(sx+Math.floor(sw*0.5),sy+6,Math.floor(sw*0.4),Math.floor(sh*0.3));
      ctx.fillStyle='#003344'; ctx.fillRect(sx+Math.floor(sw*0.52),sy+8,Math.floor(sw*0.36),Math.floor(sh*0.24));
      break;
    }
    case 'plant_large': {
      // Pot
      ctx.fillStyle='#4a2800'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.65),Math.floor(sw*0.4),Math.floor(sh*0.35));
      // Soil
      ctx.fillStyle='#3a1a00'; ctx.fillRect(sx+Math.floor(sw*0.32),sy+Math.floor(sh*0.65),Math.floor(sw*0.36),6);
      // Stems
      ctx.strokeStyle='#1a4400'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx+Math.floor(sw*0.5),sy+Math.floor(sh*0.65)); ctx.lineTo(sx+Math.floor(sw*0.35),sy+Math.floor(sh*0.2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+Math.floor(sw*0.5),sy+Math.floor(sh*0.65)); ctx.lineTo(sx+Math.floor(sw*0.65),sy+Math.floor(sh*0.15)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+Math.floor(sw*0.5),sy+Math.floor(sh*0.55)); ctx.lineTo(sx+Math.floor(sw*0.2),sy+Math.floor(sh*0.35)); ctx.stroke();
      // Leaves
      [[sx+Math.floor(sw*0.25),sy+Math.floor(sh*0.12)],[sx+Math.floor(sw*0.55),sy+Math.floor(sh*0.06)],[sx+Math.floor(sw*0.1),sy+Math.floor(sh*0.27)]].forEach(([lx,ly])=>{
        ctx.fillStyle='#116611';
        ctx.beginPath(); ctx.ellipse(lx,ly,10,6,0.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#228822';
        ctx.beginPath(); ctx.ellipse(lx,ly,5,3,0.4,0,Math.PI*2); ctx.fill();
      });
      break;
    }
    case 'awards_shelf': {
      ctx.fillStyle='#3a2000'; ctx.fillRect(sx,sy+Math.floor(sh*0.6),sw,Math.floor(sh*0.4));
      ctx.fillStyle='#2a1800'; ctx.fillRect(sx,sy+Math.floor(sh*0.58),sw,4);
      // Trophies / plaques
      const tc=3;
      for(let t=0;t<tc;t++){
        const tx=sx+6+t*Math.floor((sw-12)/tc);
        ctx.fillStyle='#ffcc00';
        ctx.fillRect(tx, sy+Math.floor(sh*0.2), Math.floor((sw-12)/tc)-4, Math.floor(sh*0.38));
        ctx.fillStyle='#cc9900';
        ctx.fillRect(tx+Math.floor(((sw-12)/tc-4)/3), sy+Math.floor(sh*0.1), Math.floor(((sw-12)/tc-4)/3), Math.floor(sh*0.12)); // trophy cup
      }
      break;
    }
    case 'coffee_premium': {
      // Premium espresso machine
      ctx.fillStyle='#111'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+4,Math.floor(sw*0.8),Math.floor(sh*0.85));
      ctx.fillStyle='#333'; ctx.fillRect(sx+Math.floor(sw*0.15),sy+8,Math.floor(sw*0.7),Math.floor(sh*0.35));
      // Spouts
      ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw*0.25),sy+Math.floor(sh*0.42),6,10);
      ctx.fillRect(sx+Math.floor(sw*0.6),sy+Math.floor(sh*0.42),6,10);
      // Indicator light
      ctx.fillStyle=blink?'#00ff88':'#003322';
      ctx.fillRect(sx+Math.floor(sw*0.45),sy+12,8,8);
      break;
    }
    case 'trophy_case': {
      ctx.fillStyle='#1a1400'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#ffcc00'; ctx.lineWidth=1; ctx.strokeRect(sx+2,sy+2,sw-4,sh-4);
      ctx.fillStyle='rgba(255,204,0,0.05)'; ctx.fillRect(sx+2,sy+2,sw-4,sh-4);
      ctx.fillStyle='#ffcc00'; ctx.font='bold 14px monospace'; ctx.textAlign='center';
      ctx.fillText('🏆', sx+sw/2, sy+sh/2+5);
      ctx.font='6px monospace';
      ctx.fillStyle='#cc9900'; ctx.fillText('GIU 2026', sx+sw/2, sy+sh-5);
      ctx.textAlign='left';
      break;
    }
    case 'reading_lamp': {
      // Lamp stand
      ctx.fillStyle='#5a3800'; ctx.fillRect(sx+Math.floor(sw*0.45),sy+Math.floor(sh*0.45),6,Math.floor(sh*0.55));
      ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.9),Math.floor(sw*0.4),6);
      // Shade
      ctx.fillStyle='#cc8800';
      ctx.beginPath();
      ctx.moveTo(sx+Math.floor(sw*0.2),sy+Math.floor(sh*0.45));
      ctx.lineTo(sx+Math.floor(sw*0.8),sy+Math.floor(sh*0.45));
      ctx.lineTo(sx+Math.floor(sw*0.6),sy+Math.floor(sh*0.15));
      ctx.lineTo(sx+Math.floor(sw*0.4),sy+Math.floor(sh*0.15));
      ctx.closePath(); ctx.fill();
      // Light glow
      ctx.fillStyle=`rgba(255,220,100,${0.15+0.1*pulse2})`;
      ctx.fillRect(sx,sy+Math.floor(sh*0.45),sw,Math.floor(sh*0.55));
      break;
    }

    // ── TA LAB ────────────────────────────────────────────────────────
    case 'workbench_pcb': {
      ctx.fillStyle='#1a1200'; ctx.fillRect(sx,sy+Math.floor(sh*0.5),sw,Math.floor(sh*0.5));
      ctx.fillStyle='#001a00'; ctx.fillRect(sx+4,sy+6,sw-8,Math.floor(sh*0.42));
      ctx.fillStyle='#00ff44';
      // PCB traces
      ctx.strokeStyle='#00cc33'; ctx.lineWidth=1;
      for(let tr=0;tr<4;tr++){
        ctx.beginPath(); ctx.moveTo(sx+8,sy+12+tr*7); ctx.lineTo(sx+sw-8,sy+12+tr*7); ctx.stroke();
      }
      // Solder points
      for(let sp=0;sp<8;sp++){
        ctx.fillStyle='#888'; ctx.fillRect(sx+8+sp*Math.floor((sw-16)/8), sy+14+sp%2*7, 3, 3);
      }
      // Component (IC chip)
      ctx.fillStyle='#111'; ctx.fillRect(sx+Math.floor(sw*0.35),sy+Math.floor(sh*0.15),Math.floor(sw*0.3),Math.floor(sh*0.2));
      ctx.fillStyle='#666';
      for(let p2=0;p2<4;p2++) ctx.fillRect(sx+Math.floor(sw*0.32),sy+Math.floor(sh*0.18)+p2*4,Math.floor(sw*0.04),2);
      break;
    }
    case 'oscilloscope': {
      ctx.fillStyle='#0a120a'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#001408'; ctx.fillRect(sx+5,sy+5,sw-20,sh-20);
      // Waveform
      ctx.strokeStyle='#00ff88'; ctx.lineWidth=1.5; ctx.beginPath();
      ctx.moveTo(sx+7, sy+sh/2);
      for(let xx=0;xx<sw-27;xx++) ctx.lineTo(sx+7+xx, sy+sh/2-14 + Math.sin((tick/8)+xx*0.2)*12);
      ctx.stroke();
      // Grid lines
      ctx.strokeStyle='rgba(0,255,136,0.15)'; ctx.lineWidth=0.5;
      for(let g=1;g<3;g++){
        ctx.beginPath(); ctx.moveTo(sx+5,sy+5+g*(sh-20)/3); ctx.lineTo(sx+sw-15,sy+5+g*(sh-20)/3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx+5+g*(sw-20)/3,sy+5); ctx.lineTo(sx+5+g*(sw-20)/3,sy+sh-15); ctx.stroke();
      }
      // Controls panel (right)
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(sx+sw-14,sy+3,12,sh-6);
      for(let k=0;k<4;k++){ ctx.fillStyle='#333'; ctx.fillRect(sx+sw-12,sy+6+k*10,8,7); }
      break;
    }
    case 'server_rack': {
      ctx.fillStyle='#0a0a0a'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.strokeRect(sx,sy,sw,sh);
      const slotH2=Math.floor(sh/5);
      for(let sl=0;sl<5;sl++){
        ctx.fillStyle='#111'; ctx.fillRect(sx+3,sy+3+sl*slotH2,sw-6,slotH2-2);
        ctx.fillStyle=(tick+sl*7)%30<15?c.accent:'#333';
        ctx.fillRect(sx+sw-12,sy+6+sl*slotH2,5,slotH2-8);
        // Drive lights
        ctx.fillStyle=sl<3?'#00ff44':'#444'; ctx.fillRect(sx+6,sy+6+sl*slotH2,4,slotH2-8);
      }
      break;
    }
    case 'code_screen': {
      ctx.fillStyle='#0a0a16'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#0f0f24'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      const codeColors=['#cc66ff','#44ffaa','#ff9944','#ffffff','#4488ff'];
      const codeLines=['def pick():', '  arm.move()', '  grasp(42N)', 'plan_path()', '→ OK 0.34s'];
      codeLines.forEach((ln,i)=>{
        ctx.fillStyle=codeColors[i]; ctx.font='6px monospace';
        ctx.fillText(ln, sx+5, sy+10+i*10);
      });
      // Cursor blink
      if(blink){ ctx.fillStyle='#fff'; ctx.fillRect(sx+5,sy+10+codeLines.length*10-8,5,8); }
      break;
    }
    case 'soldering_station': {
      // Iron
      ctx.fillStyle='#222'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.2),6,Math.floor(sh*0.6));
      ctx.fillStyle='#cc4400'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.2),6,8);
      ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw*0.3)-2,sy+Math.floor(sh*0.8),10,4);
      // Base station
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(sx+Math.floor(sw*0.05),sy+Math.floor(sh*0.75),Math.floor(sw*0.9),Math.floor(sh*0.2));
      ctx.fillStyle='#cc4400'; ctx.fillRect(sx+Math.floor(sw*0.08),sy+Math.floor(sh*0.78),8,8);
      // Smoke
      if(pulse2>0.5){
        ctx.fillStyle=`rgba(200,200,200,${(pulse2-0.5)*0.6})`;
        ctx.fillRect(sx+Math.floor(sw*0.31),sy+Math.floor(sh*0.12),4,10);
      }
      break;
    }
    case 'multimeter': {
      ctx.fillStyle='#1a0a00'; ctx.fillRect(sx+Math.floor(sw*0.15),sy+4,Math.floor(sw*0.7),Math.floor(sh*0.9));
      ctx.fillStyle='#002211'; ctx.fillRect(sx+Math.floor(sw*0.2),sy+8,Math.floor(sw*0.6),Math.floor(sh*0.35));
      ctx.fillStyle='#00ff88'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText('3.3V', sx+sw/2, sy+Math.floor(sh*0.3));
      ctx.textAlign='left';
      // Dial
      ctx.strokeStyle='#666'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sx+Math.floor(sw*0.5),sy+Math.floor(sh*0.65),Math.floor(sh*0.18),0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(sx+Math.floor(sw*0.5),sy+Math.floor(sh*0.65),Math.floor(sh*0.18),0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5;
      const dialAngle=tick/20;
      ctx.beginPath(); ctx.moveTo(sx+Math.floor(sw*0.5),sy+Math.floor(sh*0.65));
      ctx.lineTo(sx+Math.floor(sw*0.5)+Math.cos(dialAngle)*Math.floor(sh*0.16), sy+Math.floor(sh*0.65)+Math.sin(dialAngle)*Math.floor(sh*0.16)); ctx.stroke();
      break;
    }

    // ── VOICE SYNTH BOOTH ─────────────────────────────────────────────
    case 'microphone': {
      const mx=sx+Math.floor(sw/2);
      // Stand base
      ctx.fillStyle='#333'; ctx.fillRect(mx-12,sy+Math.floor(sh*0.85),24,5);
      ctx.fillRect(mx-2,sy+Math.floor(sh*0.25),4,Math.floor(sh*0.62));
      // Mic head
      ctx.fillStyle='#888';
      ctx.beginPath(); ctx.arc(mx,sy+Math.floor(sh*0.2),Math.floor(sw*0.25),0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#555';
      ctx.beginPath(); ctx.arc(mx,sy+Math.floor(sh*0.2),Math.floor(sw*0.18),0,Math.PI*2); ctx.fill();
      // Mesh lines
      ctx.strokeStyle='#777'; ctx.lineWidth=0.5;
      for(let ln=-2;ln<=2;ln++) ctx.strokeRect(mx-Math.floor(sw*0.18)+Math.abs(ln)*2,sy+Math.floor(sh*0.2)-Math.floor(sh*0.14)+Math.abs(ln),Math.floor(sw*0.36)-Math.abs(ln)*4,Math.floor(sh*0.28)-Math.abs(ln)*2);
      // Pop filter
      if(blink){ ctx.strokeStyle='rgba(0,255,136,0.4)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(mx+20,sy+Math.floor(sh*0.2),15,0,Math.PI*2); ctx.stroke(); }
      break;
    }
    case 'mixing_board': {
      ctx.fillStyle='#111'; ctx.fillRect(sx,sy,sw,sh);
      // Faders
      const fc=Math.floor(sw/8);
      for(let f=0;f<fc;f++){
        ctx.fillStyle='#222'; ctx.fillRect(sx+2+f*8,sy+6,6,sh-12);
        const faderPos=Math.floor((sh-22)*(0.2+0.8*Math.abs(Math.sin(tick/30+f))));
        ctx.fillStyle='#888'; ctx.fillRect(sx+1+f*8,sy+8+faderPos,8,6);
        ctx.fillStyle='#ccc'; ctx.fillRect(sx+2+f*8,sy+10+faderPos,6,2);
      }
      break;
    }
    case 'waveform_screen': {
      ctx.fillStyle='#080810'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#001008'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      // Waveform
      ctx.strokeStyle=c.border; ctx.lineWidth=1.5; ctx.beginPath();
      ctx.moveTo(sx+5, sy+sh/2);
      for(let xx=0;xx<sw-10;xx++){
        const amp=8*Math.sin(xx*0.3)*Math.sin(tick/10+xx*0.1);
        ctx.lineTo(sx+5+xx, sy+sh/2+amp);
      }
      ctx.stroke();
      // Labels
      ctx.fillStyle=rgba(c.accent,0.6); ctx.font='6px monospace';
      ctx.fillText('LIVE', sx+6, sy+12);
      ctx.fillText('97.3%', sx+sw-30, sy+12);
      break;
    }
    case 'sound_foam': {
      // Acoustic foam panel with wedge pattern
      ctx.fillStyle='#1a2a1a'; ctx.fillRect(sx,sy,sw,sh);
      const fc2=Math.floor(sw/8);
      const fr=Math.floor(sh/8);
      for(let fc3=0;fc3<fc2;fc3++) for(let fr2=0;fr2<fr;fr2++){
        ctx.fillStyle=(fc3+fr2)%2===0?'#1a2a1a':'#223322';
        ctx.beginPath();
        ctx.moveTo(sx+fc3*8, sy+fr2*8);
        ctx.lineTo(sx+fc3*8+8, sy+fr2*8+4);
        ctx.lineTo(sx+fc3*8+8, sy+fr2*8+8);
        ctx.lineTo(sx+fc3*8, sy+fr2*8+4);
        ctx.fill();
      }
      break;
    }
    case 'headset_rack': {
      ctx.fillStyle='#111'; ctx.fillRect(sx,sy,sw,sh);
      // Hooks on wall
      for(let h=0;h<3;h++){
        ctx.strokeStyle='#555'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(sx+10+h*Math.floor((sw-12)/3),sy+12,8,Math.PI,0); ctx.stroke();
        // Headset hanging
        ctx.fillStyle='#333'; ctx.fillRect(sx+2+h*Math.floor((sw-12)/3),sy+12,6,5);
        ctx.fillRect(sx+16+h*Math.floor((sw-12)/3),sy+12,6,5);
        ctx.strokeStyle='#444'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(sx+10+h*Math.floor((sw-12)/3),sy+12,10,Math.PI,0); ctx.stroke();
      }
      break;
    }
    case 'studio_light': {
      const lx=sx+Math.floor(sw/2), ly=sy+8;
      // Mount
      ctx.fillStyle='#222'; ctx.fillRect(lx-3,sy,6,15);
      // Light housing
      ctx.fillStyle='#333'; ctx.fillRect(lx-16,ly,32,20);
      // LED grid
      for(let lx2=0;lx2<4;lx2++) for(let ly2=0;ly2<2;ly2++){
        ctx.fillStyle=blink?'#ffffaa':'#886600';
        ctx.fillRect(lx-14+lx2*8,ly+3+ly2*8,5,5);
      }
      // Light cone
      ctx.fillStyle=`rgba(255,255,180,${0.06+0.04*pulse2})`;
      ctx.beginPath(); ctx.moveTo(lx-16,ly+20); ctx.lineTo(lx+16,ly+20); ctx.lineTo(lx+30,sy+sh); ctx.lineTo(lx-30,sy+sh); ctx.closePath(); ctx.fill();
      break;
    }

    // ── CHIEF'S OFFICE ────────────────────────────────────────────────
    case 'desk_exec': {
      ctx.fillStyle='#2a0040'; ctx.fillRect(sx,sy+Math.floor(sh*0.45),sw,Math.floor(sh*0.55));
      ctx.fillStyle='#cc44ff'; ctx.fillRect(sx+3,sy+Math.floor(sh*0.42),sw-6,3);
      // Monitor
      ctx.fillStyle='#111'; ctx.fillRect(sx+Math.floor(sw*0.4),sy+6,Math.floor(sw*0.5),Math.floor(sh*0.35));
      ctx.fillStyle='#1a0040'; ctx.fillRect(sx+Math.floor(sw*0.42),sy+8,Math.floor(sw*0.46),Math.floor(sh*0.28));
      // Clipboard
      ctx.fillStyle='#f0e8c0'; ctx.fillRect(sx+6,sy+Math.floor(sh*0.05),Math.floor(sw*0.3),Math.floor(sh*0.35));
      ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw*0.14),sy+4,Math.floor(sw*0.12),8);
      break;
    }
    case 'filing_cabinet': {
      ctx.fillStyle='#1a1a28'; ctx.fillRect(sx,sy,sw,sh);
      for(let dr=0;dr<3;dr++){
        const dh=Math.floor(sh/3)-2;
        ctx.fillStyle='#222'; ctx.fillRect(sx+3,sy+3+dr*(dh+2),sw-6,dh);
        ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw/2)-8,sy+7+dr*(dh+2),16,5);
        // Color tab
        ctx.fillStyle=['#ff4466','#4488ff','#44cc44'][dr];
        ctx.fillRect(sx+sw-10,sy+4+dr*(dh+2),6,dh-2);
      }
      break;
    }
    case 'clipboard_wall': {
      ctx.fillStyle='#c8a060'; ctx.fillRect(sx,sy,sw,sh);
      const cpCount=4;
      for(let cp=0;cp<cpCount;cp++){
        const cpx=sx+4+(cp%2)*Math.floor(sw/2);
        const cpy=sy+4+Math.floor(cp/2)*Math.floor(sh/2);
        const cpw=Math.floor(sw/2)-8, cph=Math.floor(sh/2)-8;
        ctx.fillStyle='#f0e8c0'; ctx.fillRect(cpx,cpy,cpw,cph);
        ctx.fillStyle='#888'; ctx.fillRect(cpx+cpw/2-6,cpy-2,12,6);
        // Lines
        ctx.fillStyle='#888';
        for(let l=0;l<3;l++) ctx.fillRect(cpx+3,cpy+8+l*7,cpw-6,1);
        // Check marks (some)
        if(cp<2){ ctx.fillStyle='#008800'; ctx.font='8px monospace'; ctx.fillText('✓',cpx+3,cpy+cph-4); }
      }
      ctx.textAlign='left';
      break;
    }
    case 'org_chart': {
      ctx.fillStyle='#f0e6c0'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#8b6914'; ctx.lineWidth=1; ctx.strokeRect(sx,sy,sw,sh);
      // Boxes
      const bw2=Math.floor(sw*0.3), bh2=10;
      ctx.fillStyle='#2a1a08'; ctx.fillRect(sx+Math.floor(sw*0.35),sy+6,bw2,bh2);
      ctx.fillRect(sx+Math.floor(sw*0.05),sy+24,bw2,bh2);
      ctx.fillRect(sx+Math.floor(sw*0.65),sy+24,bw2,bh2);
      ctx.fillRect(sx+Math.floor(sw*0.05),sy+42,bw2,bh2);
      ctx.fillRect(sx+Math.floor(sw*0.65),sy+42,bw2,bh2);
      // Lines
      ctx.strokeStyle='#8b6914'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(sx+Math.floor(sw*0.5),sy+16); ctx.lineTo(sx+Math.floor(sw*0.5),sy+24);
      ctx.moveTo(sx+Math.floor(sw*0.5),sy+20); ctx.lineTo(sx+Math.floor(sw*0.2),sy+20);
      ctx.lineTo(sx+Math.floor(sw*0.2),sy+24);
      ctx.moveTo(sx+Math.floor(sw*0.5),sy+20); ctx.lineTo(sx+Math.floor(sw*0.8),sy+20);
      ctx.lineTo(sx+Math.floor(sw*0.8),sy+24);
      ctx.stroke();
      break;
    }
    case 'paper_stack': {
      for(let p2=4;p2>=0;p2--){
        ctx.fillStyle=`hsl(50,${20+p2*5}%,${70+p2*3}%)`;
        ctx.fillRect(sx+8+p2*2, sy+Math.floor(sh*0.2)+p2*3, sw-16-p2*4, Math.floor(sh*0.65));
      }
      ctx.fillStyle='#888';
      for(let l=0;l<4;l++) ctx.fillRect(sx+14,sy+Math.floor(sh*0.28)+l*10,sw-28,1);
      // URGENT stamp
      ctx.fillStyle='rgba(200,0,0,0.7)'; ctx.font='bold 7px monospace'; ctx.textAlign='center';
      ctx.fillText('URGENT',sx+sw/2,sy+Math.floor(sh*0.7));
      ctx.textAlign='left';
      break;
    }
    case 'schedule_board': {
      ctx.fillStyle='#1a0030'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#cc44ff'; ctx.lineWidth=1; ctx.strokeRect(sx+2,sy+2,sw-4,sh-4);
      ctx.fillStyle='#cc44ff'; ctx.font='bold 7px monospace'; ctx.textAlign='center';
      ctx.fillText('SCHEDULE', sx+sw/2, sy+12);
      ctx.textAlign='left';
      ctx.fillStyle='rgba(204,68,255,0.7)';
      ['09:00 BRIEF','11:00 LAB','14:00 DEMO','16:00 DR.T'].forEach((e2,i)=>{
        ctx.fillText(e2, sx+5, sy+22+i*10);
      });
      break;
    }

    // ── MEDBAY / MESS ─────────────────────────────────────────────────
    case 'mess_table': {
      // Table
      ctx.fillStyle='#1a2a20'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+Math.floor(sh*0.5),Math.floor(sw*0.8),Math.floor(sh*0.35));
      ctx.fillStyle='#223530'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+Math.floor(sh*0.5),Math.floor(sw*0.8),4);
      // Plates/cups
      ctx.fillStyle='#ddd'; ctx.fillRect(sx+Math.floor(sw*0.15),sy+Math.floor(sh*0.36),Math.floor(sw*0.2),Math.floor(sh*0.15));
      ctx.fillStyle='#cc4400'; ctx.fillRect(sx+Math.floor(sw*0.15),sy+Math.floor(sh*0.36),Math.floor(sw*0.2),3); // food
      ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw*0.55),sy+Math.floor(sh*0.36),Math.floor(sw*0.12),Math.floor(sh*0.15));
      // Chairs suggestion
      ctx.fillStyle='#0a1a12'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+Math.floor(sh*0.78),Math.floor(sw*0.35),Math.floor(sh*0.18));
      ctx.fillRect(sx+Math.floor(sw*0.55),sy+Math.floor(sh*0.78),Math.floor(sw*0.35),Math.floor(sh*0.18));
      break;
    }
    case 'coffee_machine_big': {
      ctx.fillStyle='#111'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+4,Math.floor(sw*0.8),Math.floor(sh*0.88));
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(sx+Math.floor(sw*0.15),sy+8,Math.floor(sw*0.7),Math.floor(sh*0.38));
      // Water tank
      ctx.fillStyle='#003366'; ctx.fillRect(sx+Math.floor(sw*0.62),sy+10,Math.floor(sw*0.2),Math.floor(sh*0.32));
      // Brewing indicator
      ctx.fillStyle=blink?'#ff6600':'#331a00';
      ctx.fillRect(sx+Math.floor(sw*0.28),sy+12,Math.floor(sw*0.22),8);
      // Spout
      ctx.fillStyle='#555'; ctx.fillRect(sx+Math.floor(sw*0.35),sy+Math.floor(sh*0.48),Math.floor(sw*0.12),12);
      // Cup
      ctx.fillStyle='#ddd'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.62),Math.floor(sw*0.18),Math.floor(sh*0.2));
      ctx.fillStyle='#663300'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.62),Math.floor(sw*0.18),4);
      break;
    }
    case 'medbay_bed': {
      ctx.fillStyle='#002a14'; ctx.fillRect(sx,sy+Math.floor(sh*0.35),sw,Math.floor(sh*0.65));
      ctx.fillStyle='#004422'; ctx.fillRect(sx+4,sy+Math.floor(sh*0.35),sw-8,4);
      // Bed surface
      ctx.fillStyle='#eef8ee'; ctx.fillRect(sx+8,sy+Math.floor(sh*0.4),sw-16,Math.floor(sh*0.4));
      // Pillow
      ctx.fillStyle='#ffffff'; ctx.fillRect(sx+8,sy+Math.floor(sh*0.4),Math.floor(sw*0.3),Math.floor(sh*0.15));
      // Medical cross
      ctx.fillStyle='#ff4444';
      ctx.fillRect(sx+Math.floor(sw*0.75),sy+8,6,16);
      ctx.fillRect(sx+Math.floor(sw*0.7),sy+13,16,6);
      break;
    }
    case 'snack_shelf': {
      ctx.fillStyle='#1a2a1a'; ctx.fillRect(sx,sy,sw,sh);
      // Shelf boards
      ctx.fillStyle='#2a3a2a';
      ctx.fillRect(sx,sy+Math.floor(sh*0.3),sw,4);
      ctx.fillRect(sx,sy+Math.floor(sh*0.65),sw,4);
      // Items
      const items=[['#cc4400',8],['#ffcc00',10],['#4488ff',7],['#cc44cc',9],['#44cc44',8]];
      items.forEach(([col,h2],i)=>{
        ctx.fillStyle=col;
        ctx.fillRect(sx+4+i*Math.floor((sw-8)/items.length), sy+Math.floor(sh*0.65)-h2-4, Math.floor((sw-8)/items.length)-2, h2);
      });
      const items2=[['#ffaa44',9],['#aaddff',7],['#ffcc44',10]];
      items2.forEach(([col,h2],i)=>{
        ctx.fillStyle=col;
        ctx.fillRect(sx+4+i*Math.floor((sw-8)/items2.length), sy+Math.floor(sh*0.3)-h2-4, Math.floor((sw-8)/items2.length)-2, h2);
      });
      break;
    }
    case 'water_dispenser': {
      // Bottle
      ctx.fillStyle='rgba(180,220,255,0.5)'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+4,Math.floor(sw*0.4),Math.floor(sh*0.5));
      ctx.strokeStyle='#aaccff'; ctx.lineWidth=1; ctx.strokeRect(sx+Math.floor(sw*0.3),sy+4,Math.floor(sw*0.4),Math.floor(sh*0.5));
      // Body
      ctx.fillStyle='#aaa'; ctx.fillRect(sx+Math.floor(sw*0.2),sy+Math.floor(sh*0.5),Math.floor(sw*0.6),Math.floor(sh*0.45));
      // Tap
      ctx.fillStyle='#444'; ctx.fillRect(sx+Math.floor(sw*0.35),sy+Math.floor(sh*0.7),Math.floor(sw*0.1),12);
      ctx.fillStyle='#00aaff'; ctx.fillRect(sx+Math.floor(sw*0.38),sy+Math.floor(sh*0.78),4,4);
      break;
    }
    case 'first_aid': {
      ctx.fillStyle='#ffffff'; ctx.fillRect(sx+Math.floor(sw*0.15),sy+4,Math.floor(sw*0.7),Math.floor(sh*0.85));
      ctx.strokeStyle='#cc0000'; ctx.lineWidth=2; ctx.strokeRect(sx+Math.floor(sw*0.15),sy+4,Math.floor(sw*0.7),Math.floor(sh*0.85));
      ctx.fillStyle='#cc0000';
      ctx.fillRect(sx+Math.floor(sw*0.42),sy+Math.floor(sh*0.2),Math.floor(sw*0.16),Math.floor(sh*0.55));
      ctx.fillRect(sx+Math.floor(sw*0.22),sy+Math.floor(sh*0.38),Math.floor(sw*0.56),Math.floor(sh*0.2));
      break;
    }

    // ── ENGINEERING BAY ───────────────────────────────────────────────
    case 'power_board': {
      ctx.fillStyle='#140800'; ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle='#ff6600'; ctx.lineWidth=1; ctx.strokeRect(sx+2,sy+2,sw-4,sh-4);
      // Circuit breakers
      const bc=Math.floor(sw/12);
      for(let b=0;b<bc;b++){
        const on=(tick+b*5)%40>5;
        ctx.fillStyle=on?'#ff6600':'#440000';
        ctx.fillRect(sx+4+b*12,sy+8,8,12);
        ctx.fillStyle='#888'; ctx.fillRect(sx+6+b*12,sy+10,4,on?3:6); // switch pos
      }
      // Main breaker
      ctx.fillStyle=blink?'#ff2244':'#880000';
      ctx.fillRect(sx+Math.floor(sw*0.4),sy+sh-18,Math.floor(sw*0.2),14);
      ctx.fillStyle='#fff'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText('MAIN',sx+sw/2,sy+sh-7);
      ctx.textAlign='left';
      break;
    }
    case 'tool_rack': {
      ctx.fillStyle='#1a0a00'; ctx.fillRect(sx,sy,sw,sh);
      // Pegboard
      ctx.fillStyle='#2a1400'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      // Tool silhouettes
      const tools=[
        {x:0.1,w:0.06,h:0.7,col:'#888'},  // screwdriver
        {x:0.22,w:0.08,h:0.65,col:'#666'}, // wrench
        {x:0.36,w:0.1,h:0.55,col:'#999'},  // pliers
        {x:0.52,w:0.06,h:0.75,col:'#888'}, // screwdriver 2
        {x:0.65,w:0.12,h:0.5,col:'#777'},  // hammer
        {x:0.82,w:0.07,h:0.6,col:'#555'},  // chisel
      ];
      tools.forEach(t=>{
        ctx.fillStyle=t.col;
        ctx.fillRect(sx+Math.floor(sw*t.x),sy+Math.floor(sh*(1-t.h)/2),Math.floor(sw*t.w),Math.floor(sh*t.h));
      });
      break;
    }
    case 'blueprint_table': {
      ctx.fillStyle='#1a1200'; ctx.fillRect(sx,sy+Math.floor(sh*0.4),sw,Math.floor(sh*0.6));
      ctx.fillStyle='#1a3a6a'; ctx.fillRect(sx+4,sy+Math.floor(sh*0.05),sw-8,Math.floor(sh*0.38));
      // Blueprint lines
      ctx.strokeStyle='#4488ff'; ctx.lineWidth=0.8;
      for(let l=0;l<4;l++){
        ctx.beginPath(); ctx.moveTo(sx+6,sy+Math.floor(sh*0.12)+l*8); ctx.lineTo(sx+sw-6,sy+Math.floor(sh*0.12)+l*8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx+6+l*Math.floor((sw-12)/3),sy+Math.floor(sh*0.08)); ctx.lineTo(sx+6+l*Math.floor((sw-12)/3),sy+Math.floor(sh*0.38)); ctx.stroke();
      }
      // Robot arm outline
      ctx.strokeStyle='#88aaff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(sx+sw/2,sy+Math.floor(sh*0.38)); ctx.lineTo(sx+sw/2,sy+Math.floor(sh*0.18)); ctx.lineTo(sx+sw/2+10,sy+Math.floor(sh*0.1)); ctx.stroke();
      break;
    }
    case 'fuse_box': {
      ctx.fillStyle='#0a0800'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#1a1400'; ctx.fillRect(sx+4,sy+4,sw-8,sh-8);
      ctx.strokeStyle='#ff6600'; ctx.lineWidth=1; ctx.strokeRect(sx,sy,sw,sh);
      for(let f=0;f<6;f++){
        const fc2=f%3, fr2=Math.floor(f/3);
        const ok=f!==3; // one blown fuse
        ctx.fillStyle=ok?'#888':'#ff2244';
        ctx.fillRect(sx+6+fc2*Math.floor((sw-12)/3),sy+8+fr2*Math.floor((sh-16)/2),Math.floor((sw-12)/3)-2,Math.floor((sh-16)/2)-2);
      }
      break;
    }
    case 'warning_lights': {
      ctx.fillStyle='#0a0800'; ctx.fillRect(sx,sy,sw,sh);
      const wl=3;
      for(let w2=0;w2<wl;w2++){
        const active=(tick+w2*10)%30<15;
        // Strobe light housing
        ctx.fillStyle='#222'; ctx.fillRect(sx+4+w2*Math.floor((sw-8)/wl),sy+8,Math.floor((sw-8)/wl)-4,Math.floor(sh*0.55));
        ctx.fillStyle=active?'#ff4400':'#220000';
        ctx.fillRect(sx+6+w2*Math.floor((sw-8)/wl),sy+10,Math.floor((sw-8)/wl)-8,Math.floor(sh*0.45));
        if(active){
          ctx.fillStyle=`rgba(255,80,0,0.15)`;
          ctx.fillRect(sx,sy+Math.floor(sh*0.55),sw,Math.floor(sh*0.45));
        }
      }
      break;
    }
    case 'welding_rig': {
      // Gas tanks
      ctx.fillStyle='#1a3a1a'; ctx.fillRect(sx+4,sy+Math.floor(sh*0.2),Math.floor(sw*0.22),Math.floor(sh*0.75));
      ctx.fillStyle='#3a0000'; ctx.fillRect(sx+Math.floor(sw*0.3),sy+Math.floor(sh*0.2),Math.floor(sw*0.22),Math.floor(sh*0.75));
      // Nozzle / torch
      ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw*0.55),sy+Math.floor(sh*0.3),Math.floor(sw*0.4),8);
      ctx.fillRect(sx+Math.floor(sw*0.88),sy+Math.floor(sh*0.28),8,12);
      // Welding spark
      if(blink){
        ctx.fillStyle='rgba(255,200,50,0.8)'; ctx.fillRect(sx+Math.floor(sw*0.9),sy+Math.floor(sh*0.24),4,4);
        ctx.fillStyle='rgba(255,100,0,0.5)'; ctx.fillRect(sx+Math.floor(sw*0.85),sy+Math.floor(sh*0.22),8,8);
      }
      break;
    }

    // ── REACTOR CORE ─────────────────────────────────────────────────
    case 'reactor_cylinder': {
      const rx2=sx+Math.floor(sw/2), ry2=sy+Math.floor(sh*0.1);
      const crad=Math.min(Math.floor(sw*0.32),Math.floor(sh*0.38));
      // Outer shell
      ctx.fillStyle='#1a0000'; ctx.beginPath(); ctx.arc(rx2,ry2+crad,crad+4,0,Math.PI*2); ctx.fill();
      // Glow core
      const coreCol=`rgba(${200+Math.floor(55*Math.sin(tick/20))},0,0,0.9)`;
      ctx.fillStyle=coreCol; ctx.beginPath(); ctx.arc(rx2,ry2+crad,crad,0,Math.PI*2); ctx.fill();
      // Pulse rings
      for(let ring=1;ring<=2;ring++){
        ctx.strokeStyle=`rgba(255,0,0,${0.2-ring*0.08+pulse2*0.1})`;
        ctx.lineWidth=2; ctx.beginPath(); ctx.arc(rx2,ry2+crad,crad+ring*8+pulse2*4,0,Math.PI*2); ctx.stroke();
      }
      // Center cross
      ctx.strokeStyle='#ff8888'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(rx2-6,ry2+crad); ctx.lineTo(rx2+6,ry2+crad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx2,ry2+crad-6); ctx.lineTo(rx2,ry2+crad+6); ctx.stroke();
      break;
    }
    case 'cooling_pipes': {
      // Horizontal pipes
      for(let p2=0;p2<3;p2++){
        ctx.fillStyle='#334'; ctx.fillRect(sx,sy+6+p2*Math.floor(sh/3),sw,8);
        ctx.fillStyle='#445'; ctx.fillRect(sx,sy+7+p2*Math.floor(sh/3),sw,3);
        // Coolant flow animation
        ctx.fillStyle=`rgba(0,150,255,0.4)`;
        const off=(tick*3+p2*20)%(sw+20)-10;
        ctx.fillRect(sx+off,sy+8+p2*Math.floor(sh/3),20,2);
      }
      // Joints
      for(let j=0;j<4;j++){
        ctx.fillStyle='#556';
        ctx.beginPath(); ctx.arc(sx+Math.floor(sw/4*j)+Math.floor(sw/8),sy+Math.floor(sh/2),6,0,Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'warning_tape': {
      // Diagonal hazard stripes
      ctx.fillStyle='#1a0000'; ctx.fillRect(sx,sy,sw,sh);
      const stripe=12;
      for(let s2=-(sh);s2<sw+sh;s2+=stripe*2){
        ctx.fillStyle='#ffcc00';
        ctx.beginPath();
        ctx.moveTo(sx+s2,sy); ctx.lineTo(sx+s2+stripe,sy);
        ctx.lineTo(sx+s2+stripe-sh,sy+sh); ctx.lineTo(sx+s2-sh,sy+sh);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(sx,sy,sw,sh);
      break;
    }
    case 'status_monitor': {
      ctx.fillStyle='#080810'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#001400'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      ctx.fillStyle='#00ff44'; ctx.font='7px monospace'; ctx.textAlign='left';
      ['TEMP: 847°K','PRES: 2.1 atm','STATUS: OK','FLUX: 0.94','SAFE: YES'].forEach((ln,i)=>{
        ctx.fillStyle=i===0?'#ff4444':'#00ff44';
        ctx.fillText(ln, sx+5, sy+10+i*10);
      });
      break;
    }
    case 'pressure_gauge': {
      const cx2=sx+Math.floor(sw/2), cy2=sy+Math.floor(sh*0.5);
      const rad=Math.min(Math.floor(sw*0.38),Math.floor(sh*0.4));
      ctx.fillStyle='#eee'; ctx.beginPath(); ctx.arc(cx2,cy2,rad+2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ccc'; ctx.beginPath(); ctx.arc(cx2,cy2,rad,0,Math.PI*2); ctx.fill();
      // Gauge arc
      ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx2,cy2,rad-4,Math.PI*0.8,Math.PI*2.2); ctx.stroke();
      ctx.strokeStyle='#ff2244'; ctx.lineWidth=3;
      const pAngle=Math.PI*0.8+(Math.PI*1.4)*(0.6+0.3*Math.sin(tick/30));
      ctx.beginPath(); ctx.moveTo(cx2,cy2);
      ctx.lineTo(cx2+Math.cos(pAngle)*(rad-6), cy2+Math.sin(pAngle)*(rad-6)); ctx.stroke();
      ctx.fillStyle='#333'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('BAR', cx2, cy2+rad+8);
      ctx.textAlign='left';
      break;
    }
    case 'hazard_sign': {
      ctx.fillStyle='#ffcc00'; ctx.fillRect(sx+Math.floor(sw*0.1),sy+Math.floor(sh*0.1),Math.floor(sw*0.8),Math.floor(sh*0.8));
      // Triangle
      ctx.fillStyle='#ff2200';
      ctx.beginPath();
      ctx.moveTo(sx+sw/2, sy+Math.floor(sh*0.15));
      ctx.lineTo(sx+Math.floor(sw*0.88), sy+Math.floor(sh*0.82));
      ctx.lineTo(sx+Math.floor(sw*0.12), sy+Math.floor(sh*0.82));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffcc00'; ctx.font='bold 14px monospace'; ctx.textAlign='center';
      ctx.fillText('!', sx+sw/2, sy+Math.floor(sh*0.72));
      ctx.textAlign='left';
      break;
    }

    // ── CARGO HOLD ────────────────────────────────────────────────────
    case 'robot_dock': {
      ctx.fillStyle='#004466'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#005577'; ctx.fillRect(sx+4,sy+4,sw-8,sh-8);
      ctx.strokeStyle='#00d4ff'; ctx.lineWidth=1.5;
      ctx.strokeRect(sx+4,sy+4,sw-8,sh-8);
      // Dock markings
      ctx.strokeStyle='rgba(0,212,255,0.4)'; ctx.lineWidth=1;
      ctx.strokeRect(sx+10,sy+10,sw-20,sh-20);
      // Center cross
      ctx.beginPath(); ctx.moveTo(sx+sw/2,sy+10); ctx.lineTo(sx+sw/2,sy+sh-10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+10,sy+sh/2); ctx.lineTo(sx+sw-10,sy+sh/2); ctx.stroke();
      // Pulsing circle
      ctx.strokeStyle=`rgba(0,212,255,${0.3+0.3*pulse2})`;
      ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx+sw/2,sy+sh/2,12,0,Math.PI*2); ctx.stroke();
      break;
    }
    case 'conveyor_belt': {
      ctx.fillStyle='#222'; ctx.fillRect(sx,sy+Math.floor(sh*0.4),sw,Math.floor(sh*0.35));
      ctx.fillStyle='#333'; ctx.fillRect(sx,sy+Math.floor(sh*0.38),sw,Math.floor(sh*0.04));
      ctx.fillRect(sx,sy+Math.floor(sh*0.72),sw,Math.floor(sh*0.04));
      // Belt segments
      const beltOff=(tick*2)%20;
      for(let bs=-(20);bs<sw+20;bs+=20){
        ctx.fillStyle='#3a3a3a';
        ctx.fillRect(sx+bs+beltOff,sy+Math.floor(sh*0.4),18,Math.floor(sh*0.33));
      }
      // Objects on belt
      ctx.fillStyle='#0044aa'; ctx.fillRect(sx+Math.floor(sw*0.2)+(tick*2%sw-sw/4+sw/2)%sw,sy+Math.floor(sh*0.32),16,16);
      // Rollers
      ctx.fillStyle='#555';
      ctx.beginPath(); ctx.arc(sx+8,sy+Math.floor(sh*0.565),8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+sw-8,sy+Math.floor(sh*0.565),8,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'crates': {
      const cw2=Math.floor(sw*0.28), ch2=Math.floor(sh*0.38);
      const crateData=[[0,Math.floor(sh*0.55),'#2244aa'],[Math.floor(sw*0.35),Math.floor(sh*0.55),'#aa4422'],[Math.floor(sw*0.7),Math.floor(sh*0.55),'#22aa44'],[Math.floor(sw*0.17),Math.floor(sh*0.15),'#aaaa22']];
      crateData.forEach(([cx3,cy3,col])=>{
        ctx.fillStyle=col; ctx.fillRect(sx+cx3,sy+cy3,cw2,ch2);
        ctx.strokeStyle=darken(col,0.6); ctx.lineWidth=1; ctx.strokeRect(sx+cx3,sy+cy3,cw2,ch2);
        // Crate lines
        ctx.beginPath(); ctx.moveTo(sx+cx3+cw2/2,sy+cy3); ctx.lineTo(sx+cx3+cw2/2,sy+cy3+ch2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx+cx3,sy+cy3+ch2/2); ctx.lineTo(sx+cx3+cw2,sy+cy3+ch2/2); ctx.stroke();
      });
      break;
    }
    case 'pickup_zones': {
      ctx.fillStyle='#001220'; ctx.fillRect(sx,sy,sw,sh);
      // Zone A and B
      [['A','#00d4ff',0.1],['B','#00ff88',0.55]].forEach(([label,col,ox])=>{
        ctx.strokeStyle=col; ctx.lineWidth=1.5;
        ctx.strokeRect(sx+Math.floor(sw*ox),sy+6,Math.floor(sw*0.38),sh-12);
        ctx.strokeStyle=rgba(col,0.3); ctx.lineWidth=0.5;
        ctx.strokeRect(sx+Math.floor(sw*ox)+4,sy+10,Math.floor(sw*0.3),sh-20);
        ctx.fillStyle=col; ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText(label, sx+Math.floor(sw*(ox+0.19)), sy+sh/2+4);
      });
      ctx.textAlign='left';
      break;
    }
    case 'charging_port': {
      ctx.fillStyle='#001830'; ctx.fillRect(sx,sy,sw,sh);
      // Port socket
      ctx.fillStyle='#002244'; ctx.fillRect(sx+Math.floor(sw*0.2),sy+Math.floor(sh*0.3),Math.floor(sw*0.6),Math.floor(sh*0.4));
      ctx.strokeStyle='#00d4ff'; ctx.lineWidth=1.5; ctx.strokeRect(sx+Math.floor(sw*0.2),sy+Math.floor(sh*0.3),Math.floor(sw*0.6),Math.floor(sh*0.4));
      // Charging bolt icon
      ctx.fillStyle=blink?'#00d4ff':'rgba(0,212,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(sx+sw/2+4,sy+Math.floor(sh*0.35));
      ctx.lineTo(sx+sw/2-4,sy+Math.floor(sh*0.5));
      ctx.lineTo(sx+sw/2+1,sy+Math.floor(sh*0.5));
      ctx.lineTo(sx+sw/2-4,sy+Math.floor(sh*0.65));
      ctx.lineTo(sx+sw/2+4,sy+Math.floor(sh*0.5));
      ctx.lineTo(sx+sw/2-1,sy+Math.floor(sh*0.5));
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'block_storage': {
      ctx.fillStyle='#0a1a22'; ctx.fillRect(sx,sy,sw,sh);
      const colors3=['#0044aa','#aa0000','#00aa00','#aaaa00','#aa00aa','#00aaaa'];
      const bc3=3, br3=2;
      for(let bc4=0;bc4<bc3;bc4++) for(let br4=0;br4<br3;br4++){
        const bx3=sx+4+bc4*Math.floor((sw-8)/bc3);
        const by3=sy+6+br4*Math.floor((sh-12)/br3);
        const bw3=Math.floor((sw-8)/bc3)-4, bh3=Math.floor((sh-12)/br3)-4;
        ctx.fillStyle=colors3[(bc4+br4*3)%6]; ctx.fillRect(bx3,by3,bw3,bh3);
        ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(bx3,by3,bw3,bh3);
      }
      break;
    }

    // ── AIRLOCK / OBSERVATION ─────────────────────────────────────────
    case 'space_window': {
      ctx.fillStyle='#00010a'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#050520'; ctx.fillRect(sx+4,sy+4,sw-8,sh-8);
      // Stars
      for(let st=0;st<30;st++){
        const stx=(st*37+tick*0.05)%((sw-12))+2;
        const sty=(st*53+7)%(sh-12)+2;
        const bright=0.4+0.6*((st*7)%10)/10;
        ctx.fillStyle=`rgba(255,255,255,${bright})`;
        ctx.fillRect(sx+4+stx%((sw-12)), sy+4+sty, st<8?2:1, st<8?2:1);
      }
      // Nebula haze
      ctx.fillStyle='rgba(40,20,80,0.3)';
      ctx.beginPath(); ctx.ellipse(sx+sw*0.6, sy+sh*0.3, sw*0.25, sh*0.2, 0.3, 0, Math.PI*2); ctx.fill();
      // Distant planet
      ctx.fillStyle='rgba(80,60,180,0.6)';
      ctx.beginPath(); ctx.arc(sx+Math.floor(sw*0.75),sy+Math.floor(sh*0.35),Math.floor(sh*0.18),0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(120,100,220,0.4)';
      ctx.beginPath(); ctx.arc(sx+Math.floor(sw*0.75),sy+Math.floor(sh*0.35),Math.floor(sh*0.12),0,Math.PI*2); ctx.fill();
      // Frame
      ctx.strokeStyle='#4466ff'; ctx.lineWidth=2; ctx.strokeRect(sx+4,sy+4,sw-8,sh-8);
      break;
    }
    case 'airlock_door': {
      ctx.fillStyle='#0a1020'; ctx.fillRect(sx,sy,sw,sh);
      // Door panels
      const dw=Math.floor(sw*0.42);
      ctx.fillStyle='#1a2a3a'; ctx.fillRect(sx+4,sy+4,dw,sh-8);
      ctx.fillRect(sx+sw-4-dw,sy+4,dw,sh-8);
      // Warning stripes
      for(let s2=0;s2<sh;s2+=12){
        ctx.fillStyle=s2%24<12?'#ffcc00':'#ff2200';
        ctx.fillRect(sx+4,sy+4+s2,6,Math.min(12,sh-8-s2));
        ctx.fillRect(sx+sw-10,sy+4+s2,6,Math.min(12,sh-8-s2));
      }
      // Center seal
      ctx.strokeStyle='#4466ff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(sx+sw/2,sy+4); ctx.lineTo(sx+sw/2,sy+sh-4); ctx.stroke();
      // Handle
      ctx.fillStyle='#888'; ctx.fillRect(sx+Math.floor(sw*0.42),sy+Math.floor(sh*0.4),Math.floor(sw*0.16),Math.floor(sh*0.2));
      ctx.fillStyle=blink?'#ff2244':'#440000'; ctx.fillRect(sx+Math.floor(sw*0.45),sy+Math.floor(sh*0.44),Math.floor(sw*0.1),8);
      break;
    }
    case 'star_view': {
      ctx.fillStyle='#000108'; ctx.fillRect(sx,sy,sw,sh);
      // Star field with different sizes
      for(let st=0;st<40;st++){
        const stx=(st*41+17)%(sw-4)+2;
        const sty=(st*61+23)%(sh-4)+2;
        const sz=st<5?3:st<15?2:1;
        const br=0.3+0.7*((st*13)%10)/10;
        ctx.fillStyle=st<5?`rgba(200,220,255,${br})`:`rgba(255,255,255,${br})`;
        ctx.fillRect(sx+stx,sy+sty,sz,sz);
      }
      // Milky way band
      ctx.fillStyle='rgba(100,120,200,0.08)';
      ctx.fillRect(sx,sy+Math.floor(sh*0.3),sw,Math.floor(sh*0.35));
      break;
    }
    case 'telescope': {
      // Mount base
      ctx.fillStyle='#2a2a3a'; ctx.fillRect(sx+Math.floor(sw*0.35),sy+Math.floor(sh*0.7),Math.floor(sw*0.3),Math.floor(sh*0.3));
      // Tripod
      ctx.strokeStyle='#333'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx+sw/2,sy+Math.floor(sh*0.7)); ctx.lineTo(sx+Math.floor(sw*0.2),sy+sh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+sw/2,sy+Math.floor(sh*0.7)); ctx.lineTo(sx+Math.floor(sw*0.8),sy+sh); ctx.stroke();
      // Telescope tube
      ctx.fillStyle='#444';
      ctx.save();
      ctx.translate(sx+sw/2,sy+Math.floor(sh*0.55));
      ctx.rotate(-0.5);
      ctx.fillRect(-6,-Math.floor(sh*0.4),12,Math.floor(sh*0.5));
      ctx.fillStyle='#555'; ctx.fillRect(-8,-Math.floor(sh*0.42),16,8);
      ctx.fillStyle='#00d4ff'; ctx.fillRect(-4,-Math.floor(sh*0.4)-2,8,6); // lens
      ctx.restore();
      break;
    }
    case 'observation_bench': {
      ctx.fillStyle='#0a1430'; ctx.fillRect(sx,sy+Math.floor(sh*0.6),sw,Math.floor(sh*0.4));
      ctx.fillStyle='#0f1c3a'; ctx.fillRect(sx+4,sy+Math.floor(sh*0.6)-4,sw-8,8); // edge
      // Cushions
      ctx.fillStyle='#1a2a4a';
      ctx.fillRect(sx+8,sy+Math.floor(sh*0.64),Math.floor(sw*0.35),Math.floor(sh*0.28));
      ctx.fillRect(sx+Math.floor(sw*0.55),sy+Math.floor(sh*0.64),Math.floor(sw*0.35),Math.floor(sh*0.28));
      // Legs
      ctx.fillStyle='#333';
      ctx.fillRect(sx+6,sy+Math.floor(sh*0.88),8,Math.floor(sh*0.12));
      ctx.fillRect(sx+sw-14,sy+Math.floor(sh*0.88),8,Math.floor(sh*0.12));
      break;
    }
    case 'deep_scanner': {
      ctx.fillStyle='#000a18'; ctx.fillRect(sx,sy,sw,sh);
      ctx.fillStyle='#00001a'; ctx.fillRect(sx+3,sy+3,sw-6,sh-6);
      // Radar sweep
      const sweepAngle=(tick/30) % (Math.PI*2);
      const cx2=sx+Math.floor(sw/2), cy2=sy+Math.floor(sh/2);
      const rad=Math.min(Math.floor(sw*0.4),Math.floor(sh*0.4));
      ctx.strokeStyle='rgba(0,255,136,0.3)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(cx2,cy2,rad,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx2,cy2,rad*0.66,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx2,cy2,rad*0.33,0,Math.PI*2); ctx.stroke();
      // Sweep line
      ctx.strokeStyle='rgba(0,255,136,0.6)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx2,cy2);
      ctx.lineTo(cx2+Math.cos(sweepAngle)*rad, cy2+Math.sin(sweepAngle)*rad); ctx.stroke();
      // Blips
      ctx.fillStyle='#00ff88';
      ctx.fillRect(cx2+Math.floor(Math.cos(1.2)*rad*0.7),cy2+Math.floor(Math.sin(1.2)*rad*0.7),3,3);
      ctx.fillRect(cx2+Math.floor(Math.cos(3.8)*rad*0.4),cy2+Math.floor(Math.sin(3.8)*rad*0.4),2,2);
      break;
    }

    // ── FALLBACK ──────────────────────────────────────────────────────
    default: {
      ctx.fillStyle=rgba(c.border,0.2); ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeStyle=rgba(c.border,0.4); ctx.lineWidth=1; ctx.strokeRect(sx,sy,sw,sh);
      ctx.fillStyle=c.accent; ctx.font='8px monospace'; ctx.textAlign='center';
      ctx.fillText(id.slice(0,8), sx+sw/2, sy+sh/2+3);
      ctx.textAlign='left';
    }
  }
}

// ─── DRAW ZZZ ────────────────────────────────────────────────────────
P.drawZzz = function(ctx, x, y, tick){
  ctx.save();
  ctx.fillStyle = 'rgba(150,200,255,0.9)';
  ctx.font = 'bold 12px VT323, monospace';
  const yOff = -Math.floor((tick/30) % 12);
  ctx.fillText('z', x, y+yOff);
  ctx.font = 'bold 16px VT323, monospace';
  ctx.fillText('Z', x+8, y+yOff-8);
  ctx.restore();
};

// ─── DRAW SPEECH BUBBLE (auto word-wrap, up to 4 lines) ──────────────
P.drawBubble = function(ctx, x, y, text, color='#00ff88'){
  ctx.save();
  ctx.font = 'bold 15px VT323, monospace';

  const maxLineW = 320;
  const padX = 10, padY = 6, lineH = 19;

  // Word-wrap
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(function(w){
    const test = cur ? cur + ' ' + w : w;
    if(ctx.measureText(test).width > maxLineW - padX*2){
      if(cur) lines.push(cur);
      cur = w;
    } else { cur = test; }
  });
  if(cur) lines.push(cur);

  // Bubble dimensions
  let bw = padX * 2;
  lines.forEach(function(l){ const lw = ctx.measureText(l).width + padX*2; if(lw > bw) bw = lw; });
  bw = Math.min(bw, maxLineW);
  const bh = lines.length * lineH + padY * 2;

  // Clamp to canvas (logical 1440px)
  const bx = Math.max(4, Math.min(x - Math.floor(bw/2), 1434 - bw));
  const by = Math.max(4, y - bh - 6);

  ctx.fillStyle = 'rgba(3,8,16,0.97)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);

  // Tail
  const tx = Math.max(bx+8, Math.min(x, bx+bw-8));
  ctx.fillStyle = 'rgba(3,8,16,0.97)';
  ctx.beginPath();
  ctx.moveTo(tx-4, by+bh); ctx.lineTo(tx+4, by+bh); ctx.lineTo(tx, by+bh+5);
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx-4, by+bh); ctx.lineTo(tx, by+bh+5); ctx.lineTo(tx+4, by+bh);
  ctx.stroke();

  ctx.fillStyle = color;
  lines.forEach(function(line, i){
    ctx.fillText(line, bx + padX, by + padY + (i + 1) * lineH - 2);
  });
  ctx.restore();
};

/** Big speech bubble for scripted ☕ chill lines — anchored above character (tail toward anchor). */
P.drawChillBubble = function(ctx, anchorX, anchorY, text, accent){
  if(!text) return;
  ctx.save();
  ctx.font = 'bold 17px VT323, monospace';
  var maxLineW = 440;
  var padX = 12, padY = 8, lineH = 22;
  var border = accent || '#ffcc88';
  var words = String(text).split(' ');
  var lines = [];
  var cur = '';
  words.forEach(function(w){
    var test = cur ? cur + ' ' + w : w;
    if(ctx.measureText(test).width > maxLineW - padX * 2){
      if(cur) lines.push(cur);
      cur = w;
    } else { cur = test; }
  });
  if(cur) lines.push(cur);
  if(lines.length > 10){
    lines = lines.slice(0, 10);
    lines[9] = lines[9].length > 48 ? lines[9].slice(0, 46) + '…' : lines[9];
  }
  var bw = padX * 2;
  lines.forEach(function(l){
    var lw = ctx.measureText(l).width + padX * 2;
    if(lw > bw) bw = lw;
  });
  bw = Math.min(bw, maxLineW);
  var bh = lines.length * lineH + padY * 2;
  var bx = Math.max(6, Math.min(anchorX - Math.floor(bw / 2), 1430 - bw));
  var topBar = (typeof window !== 'undefined' && window.GAME && GAME.LAYOUT && GAME.LAYOUT.TOP_BAR) ? GAME.LAYOUT.TOP_BAR : 55;
  var by = Math.max(topBar + 4, anchorY - bh - 10);

  ctx.fillStyle = 'rgba(12,10,6,0.96)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(255,200,100,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);

  var tx = Math.max(bx + 10, Math.min(anchorX, bx + bw - 10));
  ctx.fillStyle = 'rgba(12,10,6,0.96)';
  ctx.beginPath();
  ctx.moveTo(tx - 5, by + bh); ctx.lineTo(tx + 5, by + bh); ctx.lineTo(tx, by + bh + 7);
  ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx - 5, by + bh); ctx.lineTo(tx, by + bh + 7); ctx.lineTo(tx + 5, by + bh);
  ctx.stroke();

  ctx.fillStyle = '#ffe8cc';
  lines.forEach(function(line, i){
    ctx.fillText(line, bx + padX, by + padY + (i + 1) * lineH - 3);
  });
  ctx.restore();
};

})();
