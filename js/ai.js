(function(){
window.GAME = window.GAME || {};
const AI = GAME.ai = {};

const TICK = 1000/30;

// Robot patrol route
const ROBOT_ROUTE = ['cargo_hold','reactor_core','ta_lab','engineering_bay','voice_synth','medbay_mess','captains_cabin','cargo_hold'];

// Robot messages pool
const ROBOT_MESSAGES = [
  { type:'info',  text:'Pick operation complete. Object: blue_block. Confidence: 0.96.' },
  { type:'info',  text:'Received voice command: "pick up". Processing.' },
  { type:'warn',  text:'Grasp slip detected on attempt 1. Retrying.' },
  { type:'info',  text:'Trajectory planned: 0.34s. Executing now.' },
  { type:'info',  text:'All 6 joints nominal. Velocity limits nominal.' },
  { type:'warn',  text:'Ambient noise elevated. Voice recognition degraded 8%.' },
  { type:'info',  text:'Object placed at target zone. Mission success.' },
  { type:'info',  text:'I was asked to say "please". I said please. Logging.' },
  { type:'info',  text:'Joint 4 angular velocity nominal. I am comfortable.' },
  { type:'warn',  text:'Someone is staring. Flagging as: Tarek (probable).' },
  { type:'info',  text:'MoveIt2 path planner: 3 solutions found. Taking optimal.' },
  { type:'warn',  text:'End-effector near workspace boundary. Adjusting.' },
  { type:'info',  text:'Gripper force: 38N. Object secure.' },
  { type:'info',  text:'Collision avoidance: 0 collisions. Smooth operation.' },
  { type:'warn',  text:'Voice command: "put down" ambiguous. Requesting clarification.' },
  { type:'info',  text:'I have picked 47 objects today. This is a record.' },
  { type:'warn',  text:'Reactor thermal spike detected nearby. Flagging.' },
  { type:'info',  text:'Current mood: operational. Secondary mood: curious.' },
  { type:'warn',  text:'ROS2 topic /joint_states latency spike: 12ms. Recovering.' },
  { type:'info',  text:'Hemaly performed maintenance. Efficiency +2%. Thank you.' },
];

// Robot arm poses per room
const ROBOT_ARM_POSES = {
  cargo_hold:       { baseAngle: 0.2,  foreAngle: 0.5, gripperOpen: true  },
  reactor_core:     { baseAngle:-0.4,  foreAngle: 0.3, gripperOpen: false },
  ta_lab:           { baseAngle: 0.1,  foreAngle: 0.6, gripperOpen: true  },
  engineering_bay:  { baseAngle:-0.2,  foreAngle: 0.4, gripperOpen: false },
  voice_synth:      { baseAngle: 0.3,  foreAngle: 0.4, gripperOpen: true  },
  medbay_mess:      { baseAngle: 0,    foreAngle: 0.2, gripperOpen: true  },
  captains_cabin:   { baseAngle:-0.1,  foreAngle: 0.3, gripperOpen: true  },
};

// Bubble messages when moving to a room
const TRANSIT_MSGS = {
  medbay_mess:          ['where they hiding... 👀', 'coffee break!', 'just 5 min... shhh', 'casual stroll, definitely not chilling'],
  bridge:               ['yes boss, on my way', 'reporting to bridge', 'aye aye commander'],
  captains_cabin:       ['knock knock...', 'tolba wants to see me??', 'entering the captain zone'],
  ta_lab:               ['lab time!', 'going to debug stuff', 'ta lab smells like solder again'],
  voice_synth:          ['back to the booth', 'recording time', 'mic check 1 2 3'],
  chiefs_office:        ['maryam already knows why im here', 'schedule update time', 'clipboard incoming'],
  engineering_bay:      ['engineering things!', 'dont touch the mystery wire', 'sparks are scheduled'],
  reactor_core:         ['uhhh going near the reactor', 'hemaly said its fine', 'probably fine'],
  cargo_hold:           ['checking on the robot', 'cargo hold time', 'pick and place time'],
  airlock_observation:  ['space window time!', 'just vibing in the airlock', 'looking at stars'],
  patrons_suite:        ['going to zaky\'s suite', 'the plant is calling me', 'gold clearance zone'],
  comms_array:          ['carol will know i was here', 'comms check time', 'signal scanning'],
};

// Scripted scene pairs (fire once per day cycle)
const SCRIPTED_SCENES = [
  { from:'jomana',  to:'maryam',  text:'Update the mission log. Now.',                    time: 3 },
  { from:'maryam',  to:'jomana',  text:'Already done.',                                   time: 4 },
  { from:'tarek',   to:'robot',   text:'Did you just say "please" again?',                 time: 7 },
  { from:'robot',   to:'tarek',   text:'[INFO] Affirmative. Politeness protocol active.',  time: 8 },
  { from:'moaz',    to:'hemaly',  text:'Your PCB layout has a floating net.',              time:12 },
  { from:'hemaly',  to:'moaz',    text:'That net is intentional. Probably.',               time:13 },
  { from:'tolba',   to:'jomana',  text:'Report. My office.',                               time:15 },
  { from:'carol',   to:'jomana',  text:'Comms check: all stations green.',                 time:18 },
  { from:'seif',    to:'omar',    text:'Small fire in propulsion. Under control.',         time:20 },
  { from:'omar',    to:'seif',    text:'Define "under control".',                          time:21 },
  { from:'zaky',    to:'tolba',   text:'Project metrics looking excellent, Dr. Tolba.',    time:25 },
  { from:'tolba',   to:'zaky',    text:'They are adequate.',                               time:26 },
];

const ROOM_CHAT = {
  ta_lab:          [['oscilloscope peaking again','optimal. keep going.'],['who left iron on?','...not me.'],['smells like solder','it always smells like solder','then something is burning']],
  engineering_bay: [['why is there smoke?','scheduled smoke.','SCHEDULED??'],['mystery wire?','don\'t touch it.','what if i just—','DO NOT.']],
  voice_synth:     [['mic still hot?','i panicked.'],['new phrase today?','the robot will do it.','bold.']],
  captains_cabin:  [['sir.','report.'],['door was open...','i see.']],
  cargo_hold:      [['robot waved at me again','it does that now','since when'],['demo ready?','since 2am.','...how?']],
  medbay_mess:     [['you hiding too?','obviously.'],['coffee still hot?','define hot.'],['jomana know?','she always knows.','...we should go back','after this cup']],
  bridge:          [['status?','nominal. mostly.'],['jomana incoming?','always.']],
  chiefs_office:   [['maryam already has my report','she submitted it before you wrote it','...she WHAT']],
  airlock_observation:[['just needed a minute','space helps.','yeah.'],['same stars?','different stars.','...are they?']],
  reactor_core:    [['hemaly said this is fine','is it?','she didn\'t say it\'s NOT fine'],['hum changed pitch','that\'s normal.','...has it always been that pitch?']],
  patrons_suite:   [['plant still alive','year 7.','that plant has seen things.']],
  comms_array:     [['any signals?','carol named the last one Gerald Jr.','of course she did']],
};

// Extra exchanges during ☕ chill — any room with 2+ crew (short lines → normal bubbles)
const CHILL_ANYWHERE_LINES = [
  ['bro this ship is wild','mid wild tbh'],
  ['coffee run after?','obviously'],
  ['did you push','no comment'],
  ['robot judging us?','always has been'],
  ['pick place sleep repeat','honestly iconic'],
  ['we deserve this break','statistically debatable'],
  ['same chaos new day','poetic'],
  ['think jomana knows','yes'],
  ['demo in one sentence','pick block place block pray'],
  ['my code worked first try','nobody believes you'],
  ['hemaly said its fine','famous last words'],
  ['tarek and the robot again','theyre basically coworkers'],
  ['i need 800W','absolutely not'],
  ['Moaz salary is three coffee coupons and a PDF signature','still taxed'],
  ['GPA stands for Gradual Panic Accumulation right','only on Thursdays'],
  ['Tolbas grading curve is a legend class item','drop rate 0.1%'],
  ['Moaz and Hemaly are defending the oscilloscope instead of sleeping','TA life'],
  ['I heard the GPA portal runs on hopes and ROS2 timers','explains the lag'],
];

// Mess-hall + robot during break
const CHILL_ROBOT_HUMAN = [
  ['robot you vibing?','[CHILL] Affirmative. Vibing is permitted.'],
  ['say something cool','[COOL] ...Pick. Place. Peace.'],
  ['robot rate this coffee','[DATA] Better than reactor water.'],
  ['dont narc on us','[INFO] Logging disabled. Just kidding.'],
];

// Mess-hall snack talk — used only during ☕ chill same-room banter
const CHILL_LOBBY_SNAPS = [
  ['you hiding too?','obviously.'],
  ['coffee still hot?','define hot.'],
  ['jomana know?','she always knows.','...we should go back','after this cup'],
];

// Crew wander bubbles during ☕ chill (no "work" lines)
const CHILL_FUNNY_BUBBLES = [
  'this is nice...','dont tell jomana','i needed this','coffee is life','living my best life',
  'still chilling...','jomana is occupied right?','this is the life','dont wake me',
  'no spreadsheets in here right?','if the robot laughs we panic','team bonding = survival',
  'who brought snacks','the ship runs on vibes','honestly? worth it',
  'Moaz is funding the semester on TA salary memes','GPA is just speedrunning anxiety','grades curve is a boss fight',
];

// Robot sidebar lines during ☕ chill — no pick/grasp/toast spam
const ROBOT_CHILL_MESSAGES = [
  '[CHILL] Break mode. Grasp planning: paused. Happiness: undefined but rising.',
  '[INFO] Humans are louder during break. Correlation: coffee.',
  '[NOTE] I am not working. This is new. I like it.',
  '[QUERY] Is "hanging out" a state machine? Asking for myself.',
  '[DATA] Mess hall acoustic profile: cozy. Logging.',
  '[CHILL] Politeness module still on. I refuse to apologize.',
  '[INFO] Observing friendship. Sample size: increasing.',
];

// Short chill lines for random small bubbles — shuffle deck, cycle so all lines get air time
var _humanChillBubbleDeck = [];
var _humanChillBubblePtr = 0;
var _robotChillBubbleDeck = [];
var _robotChillBubblePtr = 0;

function shuffleInPlaceAi(arr){
  for(var i = arr.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function rebuildHumanChillBubbleDeck(){
  _humanChillBubbleDeck = CHILL_FUNNY_BUBBLES.slice();
  CHILL_ANYWHERE_LINES.forEach(function(row){ row.forEach(function(s){ _humanChillBubbleDeck.push(s); }); });
  CHILL_LOBBY_SNAPS.forEach(function(row){ row.forEach(function(s){ _humanChillBubbleDeck.push(s); }); });
  CHILL_ROBOT_HUMAN.forEach(function(pair){ if(pair[0]) _humanChillBubbleDeck.push(pair[0]); });
  (TRANSIT_MSGS.medbay_mess || []).forEach(function(s){ _humanChillBubbleDeck.push(s); });
  (ROOM_CHAT.medbay_mess || []).forEach(function(row){ row.forEach(function(s){ _humanChillBubbleDeck.push(s); }); });
  _humanChillBubbleDeck.push('wrong break group','not on the guest list','invited-only mess hall','the vibes are loud here');
  shuffleInPlaceAi(_humanChillBubbleDeck);
  _humanChillBubblePtr = 0;
}

function rebuildRobotChillBubbleDeck(){
  _robotChillBubbleDeck = ROBOT_CHILL_MESSAGES.slice();
  CHILL_ROBOT_HUMAN.forEach(function(pair){ if(pair[1]) _robotChillBubbleDeck.push(pair[1]); });
  shuffleInPlaceAi(_robotChillBubbleDeck);
  _robotChillBubblePtr = 0;
}

AI.resetChillBubbleDecks = function(){
  _humanChillBubbleDeck = [];
  _robotChillBubbleDeck = [];
  _humanChillBubblePtr = 0;
  _robotChillBubblePtr = 0;
};

function pickChillBubbleLineFor(c){
  if(!c) return '...';
  if(c.kind === 'robot'){
    if(!_robotChillBubbleDeck.length || _robotChillBubblePtr >= _robotChillBubbleDeck.length) rebuildRobotChillBubbleDeck();
    return _robotChillBubbleDeck[_robotChillBubblePtr++];
  }
  if(!_humanChillBubbleDeck.length || _humanChillBubblePtr >= _humanChillBubbleDeck.length) rebuildHumanChillBubbleDeck();
  return _humanChillBubbleDeck[_humanChillBubblePtr++];
}

// ─── INIT ────────────────────────────────────────────────────────────
AI.init = function(){
  GAME.crew.forEach(function(c){
    if(c.kind === 'robot'){
      c.arm = { baseAngle: 0, foreAngle: 0.3, gripperOpen: true };
      c.routeIndex = 0;
      c.state = 'idle';
      c.timer = 0;
      c.robotMsgTimer = 4000 + Math.random()*6000;
      c.graspFailCount = 0;
      c.coffeeMode = false;
      c.chillMode = false;
    } else {
      c.state = 'idle';
      c.timer = rand(500, 2000);
      c.bubbleText = null;
      c.bubbleTimer = 0;
      c.sleeping = false; // always start awake; night mode only triggers 2–5am
      c.homeRoom = c.room; // remember original room
      c.playerControlled = false;
      c.playerOverrideUntil = 0;
    }
    c.chillBubbleText = null;
    c.chillBubbleTimer = 0;
    c.animFrame = 0;
    c.animTimer = 0;
    c.facingLeft = false;
  });

  AI._scenesFiredToday = [];
  AI._lastHour = -1;
  AI._chillCheckTimer = 0;
  AI._jomanaWasInChill = false;
  AI.chillTimeActive = false;
  AI.chillBreakInviteIds = null;
  AI._chillRoomBanterTimer = 1800 + Math.random() * 2000;
  AI._lonelySeekTimer = 5000 + Math.random() * 4000;
  AI._chillCrowdTimer = 0;
  AI._exRobIx = 0;
  AI._exLobbyIx = 0;
  AI._exMedRoomIx = 0;
  AI._exAnyIx = 0;
  AI._messSnapSeq = 0;
  AI._transitMessIx = 0;
  if(typeof AI.resetChillBubbleDecks === 'function') AI.resetChillBubbleDecks();
};

// ─── UPDATE ──────────────────────────────────────────────────────────
AI.update = function(dt, tick, isNight, gameHour){
  // Scripted scenes by game hour
  SCRIPTED_SCENES.forEach(function(scene){
    if(AI.chillTimeActive) return;
    var key = scene.from + '-' + scene.time;
    if(gameHour >= scene.time && AI._scenesFiredToday.indexOf(key) === -1){
      AI._scenesFiredToday.push(key);
      GAME.hud.addChatEntry(scene.from, scene.text);
    }
  });

  // Chill room: check for Jomana scatter + multi-person convos
  AI._chillCheckTimer -= dt;
  if(AI._chillCheckTimer <= 0){
    AI._chillCheckTimer = AI.chillTimeActive ? 2200 : 3500;
    checkChillRoom();
  }

  GAME.crew.forEach(function(c){
    if(c.state === 'dossier_mode') return;

    if(c.kind === 'robot'){
      tickRobot(c, dt, tick);
    } else {
      tickHuman(c, dt, isNight, tick);
    }

    // Animation
    c.animTimer += dt;
    if(c.animTimer > 160){
      c.animFrame = (c.animFrame + 1) % 8;
      c.animTimer = 0;
    }

    // Bubble timer
    if(c.bubbleText){
      c.bubbleTimer -= dt;
      if(c.bubbleTimer <= 0) c.bubbleText = null;
    }
    if(c.chillBubbleText){
      c.chillBubbleTimer -= dt;
      if(c.chillBubbleTimer <= 0) c.chillBubbleText = null;
    }
  });

  if(AI.chillTimeActive){
    AI._chillRoomBanterTimer -= dt;
    if(AI._chillRoomBanterTimer <= 0){
      AI._chillRoomBanterTimer = 1400 + Math.random() * 2600;
      maybeChillSameRoomExchange();
    }
    AI._chillCrowdTimer -= dt;
    if(AI._chillCrowdTimer <= 0){
      AI._chillCrowdTimer = 1600 + Math.random() * 900;
      enforceChillCrowdCaps();
    }
  } else {
    AI._chillRoomBanterTimer = 1800 + Math.random() * 2000;
    AI._chillCrowdTimer = 0;
  }

  AI._lonelySeekTimer -= dt;
  if(AI._lonelySeekTimer <= 0){
    AI._lonelySeekTimer = (AI.chillTimeActive ? 3500 : 8000) + Math.random() * 7000;
    nudgeLonelyHumanTowardCrowd();
  }
};

// Kick anyone not on the ☕ invite list out of medbay_mess during an active break
function enforceChillMessInviteOnly(c){
  if(!AI.chillTimeActive || c.kind === 'robot' || c.sleeping || c.playerControlled) return false;
  // Moaz + Hemaly stay in TA lab during ship-wide chill (never mess break)
  if((c.id === 'moaz' || c.id === 'hemaly') && c.room === 'medbay_mess'){
    c.room = 'ta_lab';
    var labRoom = GAME.roomMap['ta_lab'];
    if(labRoom) startWalkTo(c, labRoom);
    c.state = 'walk';
    c.timer = rand(500, 1400);
    emitBubble(c, pickFrom([
      'TA shift stays on the bench','GPA drafts wont grade themselves','lab does not pause for vibes',
      'someone has to guard the oscilloscope','Hemaly needs ground plane moral support','Moaz salary is paid in solder fumes today',
    ]));
    return true;
  }
  if(c.room !== 'medbay_mess') return false;
  if(!AI.chillBreakInviteIds || !AI.chillBreakInviteIds.length) return false;
  if(AI.chillBreakInviteIds.indexOf(c.id) !== -1) return false;
  c.room = c.homeRoom;
  var homeRoomObj = GAME.roomMap[c.homeRoom];
  if(homeRoomObj) startWalkTo(c, homeRoomObj);
  c.state = 'walk';
  c.timer = rand(600, 1600);
  emitBubble(c, pickFrom(['wrong break table','wasnt on the invite','wrong squad','heading back','oops']));
  return true;
}

function chillRoomHumanCap(roomId){
  if(roomId === 'medbay_mess') return 99;
  if(roomId === 'voice_synth') return 3;
  if(roomId === 'ta_lab') return 2;
  return 3;
}

function pickChillCrowdEvictionVictim(roomId, list){
  if(roomId === 'ta_lab'){
    var nonTA = list.filter(function(x){ return x.id !== 'moaz' && x.id !== 'hemaly'; });
    if(nonTA.length) return nonTA[Math.floor(Math.random() * nonTA.length)];
  }
  var outsiders = list.filter(function(x){ return x.homeRoom !== roomId; });
  if(outsiders.length) return outsiders[Math.floor(Math.random() * outsiders.length)];
  return list[list.length - 1];
}

function enforceChillCrowdCaps(){
  if(!AI.chillTimeActive) return;
  var byRoom = {};
  GAME.crew.forEach(function(c){
    if(c.kind === 'robot' || c.sleeping || c.state === 'dossier_mode' || c.playerControlled) return;
    if(!byRoom[c.room]) byRoom[c.room] = [];
    byRoom[c.room].push(c);
  });
  Object.keys(byRoom).forEach(function(rid){
    var list = byRoom[rid];
    var cap = chillRoomHumanCap(rid);
    if(list.length <= cap) return;
    while(list.length > cap){
      var victim = pickChillCrowdEvictionVictim(rid, list);
      var ix = list.indexOf(victim);
      if(ix === -1) break;
      list.splice(ix, 1);
      victim.room = victim.homeRoom;
      var home = GAME.roomMap[victim.homeRoom];
      if(home) startWalkTo(victim, home);
      victim.state = 'walk';
      victim.timer = rand(600, 1600);
      emitBubble(victim, pickFrom([
        'too crowded in here','chill mode = spreading out','voice booth is packed',
        'heading back to my station','not fighting four people for one mic','finding air elsewhere',
      ]));
    }
  });
}

// ─── HUMAN TICK ──────────────────────────────────────────────────────
function tickHuman(c, dt, isNight, tick){
  // Expire player override
  if(c.playerControlled && Date.now() > c.playerOverrideUntil){
    c.playerControlled = false;
  }

  if(enforceChillMessInviteOnly(c)) return;

  // Night: sleep
  if(isNight && c.state !== 'eating'){
    c.sleeping = true;
    return;
  }
  c.sleeping = false;

  c.timer -= dt;

  // Always move if walking/wandering
  if(c.state === 'walk' || c.state === 'wander'){
    moveToward(c, dt, c.state === 'walk' ? 70 : 38);
  }

  // Walk state: keep going until destination is reached (timer only as 20s safety)
  if(c.state === 'walk'){
    var wdx = c.target ? c.target.x - c.pos.x : 0;
    var wdy = c.target ? c.target.y - c.pos.y : 0;
    if(wdx*wdx + wdy*wdy > 16 && c.timer > -20000) return;
  } else if(c.timer > 0){
    return;
  }

  // Player-controlled: just wander in place, no AI room switches
  if(c.playerControlled){
    if(c.state !== 'work'){
      c.state = 'work';
      c.timer = rand(3000, 7000);
    } else {
      startWanderInRoom(c);
      c.state = 'wander';
      c.timer = rand(1500, 3000);
    }
    return;
  }

  switch(c.state){
    case 'idle':
      // During chill time, crew in mess hall stay put
      if(AI.chillTimeActive && c.room === 'medbay_mess'){
        startWanderInRoom(c);
        c.state = 'wander';
        c.timer = rand(2000, 5000);
        if(Math.random() < 0.32) emitBubble(c, pickChillBubbleLineFor(c));
        break;
      }
      // Occasionally wander in own room
      if(Math.random() < 0.4){
        startWanderInRoom(c);
        c.state = 'wander';
        c.timer = rand(1000, 2500);
      }
      // Occasionally visit social room (disabled during ☕ chill — nudge + scripted convos handle that)
      else if(!AI.chillTimeActive && Math.random() < 0.032){
        var chillRoom = GAME.roomMap['medbay_mess'];
        var obsRoom   = GAME.roomMap['airlock_observation'];
        // Check chill room capacity
        var chillOccupants = countInRoom('medbay_mess');
        var target;
        if(c.id !== 'moaz' && c.id !== 'hemaly' && chillOccupants < 3 && Math.random() < 0.7){
          target = chillRoom;
        } else {
          target = obsRoom;
        }
        var oldRoom = c.room;
        c.room = target.id;
        startWalkTo(c, target);
        c.state = 'eating';
        c.timer = rand(7000, 14000);
        var transitMsgs = TRANSIT_MSGS[target.id] || ['on my way...'];
        emitBubble(c, pickFrom(transitMsgs));
        GAME.hud.addChatEntry(c.id, 'heading to ' + target.name);
      } else {
        startWanderInRoom(c);
        c.state = 'wander';
        c.timer = rand(1200, 3000);
      }
      break;

    case 'wander':
      c.state = 'work';
      c.timer = rand(3000, 8000);
      if(Math.random() < 0.3){
        if(AI.chillTimeActive) emitBubble(c, pickChillBubbleLineFor(c));
        else emitBubble(c, pickFrom(c.lines.work));
      }
      break;

    case 'walk':
      c.state = 'work';
      c.timer = rand(3000, 8000);
      if(Math.random() < 0.3){
        if(AI.chillTimeActive) emitBubble(c, pickChillBubbleLineFor(c));
        else emitBubble(c, pickFrom(c.lines.work));
      }
      checkRoomEntryConvo(c);
      break;

    case 'work':
      if(Math.random() < 0.2 && !AI.chillTimeActive) emitChatLine(c);
      startWanderInRoom(c);
      c.state = 'wander';
      c.timer = rand(1000, 2000);
      break;

    case 'eating':
      if(AI.chillTimeActive && c.room === 'medbay_mess'){
        // Stay in chill room — keep wandering
        startWanderInRoom(c);
        c.state = 'wander';
        c.timer = rand(4000, 8000);
        if(Math.random() < 0.28) emitBubble(c, pickChillBubbleLineFor(c));
      } else {
        // Return home
        c.room = c.homeRoom;
        var homeRoomObj = GAME.roomMap[c.homeRoom];
        if(homeRoomObj) startWalkTo(c, homeRoomObj);
        c.state = 'walk';
        c.timer = rand(2000, 4000);
        emitBubble(c, pickFrom(['back to work...', 'break over :(', 'jomana is watching', 'ok ok back to it']));
      }
      break;
  }
}

// ─── ROBOT TICK ──────────────────────────────────────────────────────
function tickRobot(r, dt, tick){
  r.timer -= dt;
  r.robotMsgTimer -= dt;

  // Animate arm toward target pose
  var targetPose = ROBOT_ARM_POSES[ROBOT_ROUTE[r.routeIndex]] || ROBOT_ARM_POSES['cargo_hold'];
  r.arm.baseAngle += (targetPose.baseAngle - r.arm.baseAngle) * 0.05;
  r.arm.foreAngle  += (targetPose.foreAngle - r.arm.foreAngle)  * 0.05;

  // Periodic messages — no ops spam during ☕ chill break
  if(r.robotMsgTimer <= 0){
    r.robotMsgTimer = rand(7000, 16000);
    if(r.chillMode || AI.chillTimeActive){
      var cm = pickFrom(ROBOT_CHILL_MESSAGES);
      emitBubble(r, cm);
      GAME.hud.addChatEntry('robot', cm);
      GAME.audio.play('robot_beep');
    } else {
      var msg = pickFrom(ROBOT_MESSAGES);
      var isWarn = msg.type === 'warn';
      if(isWarn){
        r.graspFailCount = (r.graspFailCount||0)+1;
        GAME.save.set('robotGraspFails', (GAME.save.get('robotGraspFails')||0)+1);
        if(GAME.save.get('robotGraspFails') >= 3) GAME.hud.triggerAchievement('catastrophic_success');
      }
      GAME.hud.showToast('[UR5e-01] ' + msg.text, isWarn?'error':'info');
      GAME.hud.addChatEntry('robot', msg.text);
      GAME.audio.play(isWarn ? 'robot_error' : 'robot_beep');
    }
  }

  // Always move during travel (don't stop early)
  if(r.state === 'travel') moveToward(r, dt, 60);

  // Travel: keep going until destination reached (timer = 30s safety max)
  if(r.state === 'travel'){
    var rdx = r.target ? r.target.x - r.pos.x : 0;
    var rdy = r.target ? r.target.y - r.pos.y : 0;
    if(rdx*rdx + rdy*rdy > 16 && r.timer > -30000) return;
  } else if(r.timer > 0){
    return;
  }

  switch(r.state){
    case 'idle':
    case 'placing':
      r.arm.gripperOpen = true;
      if(r.coffeeMode){
        // Special: deliver coffee to Dr. Tolba
        r.coffeeMode = false;
        var captainRoom = GAME.roomMap['captains_cabin'];
        startWalkTo(r, captainRoom);
        r.room = 'captains_cabin';
        r.state = 'travel';
        r.timer = 2000;
        emitBubble(r, 'delivering coffee!');
        GAME.hud.addChatEntry('robot', '[SPECIAL] Tarek says: "Tolba is the goat." Delivering coffee.');
        GAME.hud.addLog('ROBOT', 'COFFEE DELIVERY INITIATED. Tarek\'s message will be relayed.', 'log-robot');
      } else if(r.chillMode){
        // Chill mode: hang out in medbay_mess
        if(r.room !== 'medbay_mess'){
          startWalkTo(r, GAME.roomMap['medbay_mess']);
          r.room = 'medbay_mess';
          r.state = 'travel';
          r.timer = 2000;
          emitBubble(r, '[INFO] Joining break. New experience.');
        } else {
          // Already there — short wander within room
          startWalkTo(r, GAME.roomMap['medbay_mess']);
          r.state = 'travel';
          r.timer = rand(2000, 4000);
          if(Math.random() < 0.45) emitBubble(r, pickFrom([
            '[CHILL] Systems at 40%. Mood: curious.',
            '[ANALYSIS] Coffee aroma detected. Cannot drink. Logging.',
            '[INFO] This is called "hanging out". Confirmed.',
            '[STATUS] Low-power mode. Comfort level: new data.',
            '[QUERY] Is this what relaxing is? Logging as: yes.',
            '[NOTE] Humans are interesting in this mode.',
            '[INFO] No pick operations pending. I am... free?',
          ]));
        }
      } else {
        r.routeIndex = (r.routeIndex + 1) % ROBOT_ROUTE.length;
        var nextRoom = GAME.roomMap[ROBOT_ROUTE[r.routeIndex]];
        r.room = ROBOT_ROUTE[r.routeIndex];
        startWalkTo(r, nextRoom);
        r.state = 'travel';
        r.timer = rand(3000, 7000);
      }
      break;

    case 'travel':
      r.state = 'picking';
      r.timer = 1500;
      r.arm.gripperOpen = true;
      if(r.room === 'captains_cabin'){
        emitBubble(r, '"Tolba is the goat."');
        GAME.hud.addChatEntry('robot', '[DELIVERY] Dr. Tolba: your coffee, sir. Also: Tarek says "Tolba is the goat."');
        var tolba = GAME.crew.find(function(c){ return c.id==='tolba'; });
        if(tolba) setTimeout(function(){
          emitBubble(tolba, '...mhm. Tell Tarek: adequate.');
          GAME.hud.addChatEntry('tolba', 'Robot. Thank you. Tell Tarek his pronunciation model is... adequate.');
        }, 2000);
      } else if(r.chillMode){
        emitBubble(r, pickFrom(ROBOT_CHILL_MESSAGES));
      } else {
        emitBubble(r, pickFrom(r.lines.work));
      }
      break;

    case 'picking':
      r.arm.gripperOpen = false;
      r.state = 'placing';
      r.timer = 1500;
      break;
  }
}

// ─── CHILL ROOM CHECK ────────────────────────────────────────────────
function checkChillRoom(){
  // Include robot in occupants if in chill mode; during ☕ break only invited humans count
  var chillOccupants = GAME.crew.filter(function(c){
    if(c.room !== 'medbay_mess') return false;
    if(c.kind === 'robot') return !!c.chillMode;
    if(AI.chillTimeActive && AI.chillBreakInviteIds && AI.chillBreakInviteIds.length){
      return AI.chillBreakInviteIds.indexOf(c.id) !== -1;
    }
    return true;
  });
  var jomanaInChill  = chillOccupants.some(function(c){ return c.id === 'jomana'; });

  // Jomana just entered the chill room — scatter everyone
  if(jomanaInChill && !AI._jomanaWasInChill && chillOccupants.length > 1){
    AI._jomanaWasInChill = true;
    chillOccupants.forEach(function(c){
      if(c.id === 'jomana') return;
      emitBubble(c, pickFrom(['oh no, JOMANA!!', 'back to work!!', 'she found us...', 'abort chill!', 'i was never here']));
      setTimeout(function(){
        c.room = c.homeRoom;
        var homeRoomObj = GAME.roomMap[c.homeRoom];
        if(homeRoomObj) startWalkTo(c, homeRoomObj);
        c.state = 'walk';
        c.timer = rand(1500, 3000);
      }, rand(200, 800));
    });
    GAME.hud.addLog('JOMANA', 'EVERYONE BACK TO WORK. NOW.', 'log-alert');
    GAME.hud.addChatEntry('jomana', 'I can smell the slacking from the bridge. Everyone. Back. Now.');
  } else if(!jomanaInChill){
    AI._jomanaWasInChill = false;
  }

  // Trigger chill room convo — more frequent during chill time
  if(chillOccupants.length >= 2 && !jomanaInChill){
    var chance = AI.chillTimeActive ? 0.78 : 0.20;
    if(Math.random() < chance){
      GAME.chatter.triggerChillConvo(chillOccupants);
    }
  }
}

function countInRoom(roomId){
  return GAME.crew.filter(function(c){ return c.room === roomId && c.kind !== 'robot'; }).length;
}

// ─── POSITION HELPERS ────────────────────────────────────────────────
function startWalkTo(c, room){
  if(!room) return;
  var cell = GAME.getRoomCell(room);
  var L = GAME.LAYOUT;
  // Walk toward center of room, lower half (where crew walk)
  c.target = {
    x: cell.x + Math.floor(cell.w*0.2) + rand(0, Math.floor(cell.w*0.6)),
    y: cell.y + Math.floor(cell.h*0.55) + rand(-15, 20),
  };
  // Clamp within room
  c.target.x = Math.max(cell.x+15, Math.min(cell.x+cell.w-15, c.target.x));
  c.target.y = Math.max(cell.y+10, Math.min(cell.y+cell.h-20, c.target.y));
}

function startWanderInRoom(c){
  var room = GAME.roomMap[c.room];
  if(!room) return;
  var cell = GAME.getRoomCell(room);
  c.target = {
    x: cell.x + Math.floor(cell.w*0.15) + rand(0, Math.floor(cell.w*0.7)),
    y: cell.y + Math.floor(cell.h*0.5) + rand(0, Math.floor(cell.h*0.35)),
  };
  c.target.x = Math.max(cell.x+12, Math.min(cell.x+cell.w-12, c.target.x));
  c.target.y = Math.max(cell.y+8, Math.min(cell.y+cell.h-18, c.target.y));
}

function moveToward(c, dt, speed){
  if(!c.target || !c.pos) return;
  var dx = c.target.x - c.pos.x;
  var dy = c.target.y - c.pos.y;
  var dist = Math.sqrt(dx*dx + dy*dy);
  if(dist < 2){
    c.pos.x = c.target.x;
    c.pos.y = c.target.y;
    return;
  }
  var spd = speed * dt/1000;
  c.pos.x += (dx/dist)*spd;
  c.pos.y += (dy/dist)*spd;
  c.facingLeft = dx < 0;
}

// ─── PLAYER MOVE ─────────────────────────────────────────────────────
AI.moveCharToRoom = function(char, room, customMsg){
  if(!room || char.kind === 'robot') return;
  if(GAME.ai && GAME.ai.chillTimeActive && room.id === 'medbay_mess' && (char.id === 'moaz' || char.id === 'hemaly')){
    if(GAME.hud && GAME.hud.showToast) GAME.hud.showToast('Moaz & Hemaly stay on TA lab duty during ☕ break.', 'info', 'SYS');
    return;
  }
  char.room = room.id;
  char.playerControlled = true;
  char.playerOverrideUntil = Date.now() + 45000; // 45 second override
  startWalkTo(char, room);
  char.state = 'walk';
  char.timer = rand(1500, 3500);
  var msg = customMsg || pickFrom(TRANSIT_MSGS[room.id] || ['on my way!', 'moving out!', 'heading over...']);
  emitBubble(char, msg);
  GAME.hud.addLog(char.id.toUpperCase(), char.displayName + ' moving to ' + room.name, '');
};

// ─── INIT POSITIONS ──────────────────────────────────────────────────
AI.initPositions = function(){
  GAME.crew.forEach(function(c){
    var room = GAME.roomMap[c.room];
    if(!room){ c.pos={x:0,y:0}; return; }
    var cell = GAME.getRoomCell(room);
    c.pos = {
      x: cell.x + Math.floor(cell.w*0.2) + rand(0, Math.floor(cell.w*0.6)),
      y: cell.y + Math.floor(cell.h*0.55) + rand(-10, 20),
    };
    c.pos.x = Math.max(cell.x+12, Math.min(cell.x+cell.w-12, c.pos.x));
    c.pos.y = Math.max(cell.y+8, Math.min(cell.y+cell.h-18, c.pos.y));
    c.target = { x: c.pos.x, y: c.pos.y };
  });
};

function countHumansInRoom(roomId){
  return GAME.crew.filter(function(c){
    return c.room === roomId && c.kind !== 'robot' && !c.sleeping && c.state !== 'dossier_mode';
  }).length;
}

function nudgeLonelyHumanTowardCrowd(){
  var lonely = [];
  GAME.crew.forEach(function(c){
    if(c.kind === 'robot' || c.sleeping || c.state === 'dossier_mode' || c.playerControlled) return;
    if(countHumansInRoom(c.room) !== 1) return;
    lonely.push(c);
  });
  if(!lonely.length) return;
  var c = lonely[Math.floor(Math.random() * lonely.length)];

  if(AI.chillTimeActive){
    if(c.room === 'medbay_mess') return;
    var bestId2 = null;
    var bestN2 = 0;
    GAME.rooms.forEach(function(room){
      if(room.id === c.room || room.id === 'medbay_mess') return;
      var n = countHumansInRoom(room.id);
      var cap = chillRoomHumanCap(room.id);
      if(n >= cap) return;
      if(n >= 2 && n > bestN2){
        bestN2 = n;
        bestId2 = room.id;
      }
    });
    if(!bestId2){
      startWanderInRoom(c);
      c.state = 'wander';
      c.timer = rand(1200, 2400);
      return;
    }
    c.room = bestId2;
    startWalkTo(c, GAME.roomMap[bestId2]);
    c.state = 'walk';
    c.timer = rand(2800, 5200);
    emitBubble(c, pickFrom(['joining the crowd','heard noise here','not soloing today','company this way']));
    return;
  }

  var bestId = null;
  var bestN = 0;
  GAME.rooms.forEach(function(room){
    if(room.id === c.room) return;
    var n = countHumansInRoom(room.id);
    if(n >= 2 && n > bestN){
      bestN = n;
      bestId = room.id;
    }
  });
  if(!bestId) return;
  c.room = bestId;
  startWalkTo(c, GAME.roomMap[bestId]);
  c.state = 'walk';
  c.timer = rand(2800, 5200);
  emitBubble(c, pickFrom(['heard people here','seeking company','solo is overrated','joining whoever']));
}

function maybeChillSameRoomExchange(){
  var roomsMap = {};
  GAME.crew.forEach(function(c){
    if(c.state === 'dossier_mode' || c.sleeping) return;
    if(c.kind === 'robot' && !(AI.chillTimeActive && c.chillMode)) return;
    if(!roomsMap[c.room]) roomsMap[c.room] = [];
    roomsMap[c.room].push(c);
  });
  var candidates = Object.keys(roomsMap).filter(function(rid){
    return roomsMap[rid].length >= 2;
  });
  if(!candidates.length) return;

  var roomId = candidates[Math.floor(Math.random() * candidates.length)];
  var group = roomsMap[roomId];
  var humans = group.filter(function(x){ return x.kind !== 'robot'; });
  var robot = group.find(function(x){ return x.kind === 'robot'; });

  if(roomId === 'medbay_mess' && robot && humans.length >= 1 && Math.random() < 0.48){
    var exR = CHILL_ROBOT_HUMAN[AI._exRobIx % CHILL_ROBOT_HUMAN.length];
    AI._exRobIx++;
    var h = humans[Math.floor(Math.random() * humans.length)];
    emitBubble(h, exR[0]);
    GAME.hud.addChatEntry(h.id, exR[0]);
    setTimeout(function(){
      emitBubble(robot, exR[1]);
      GAME.hud.addChatEntry(robot.id, exR[1]);
    }, 2300);
    return;
  }

  if(humans.length < 2) return;
  var a = humans[Math.floor(Math.random() * humans.length)];
  var others = humans.filter(function(x){ return x.id !== a.id; });
  var b = others[Math.floor(Math.random() * others.length)];

  var lines;
  if(roomId === 'medbay_mess'){
    AI._messSnapSeq = (AI._messSnapSeq || 0) + 1;
    var rm = ROOM_CHAT.medbay_mess;
    if(rm && rm.length && AI._messSnapSeq % 2 === 0){
      lines = rm[AI._exMedRoomIx % rm.length].slice();
      AI._exMedRoomIx++;
    } else {
      lines = CHILL_LOBBY_SNAPS[AI._exLobbyIx % CHILL_LOBBY_SNAPS.length].slice();
      AI._exLobbyIx++;
    }
  } else {
    lines = CHILL_ANYWHERE_LINES[AI._exAnyIx % CHILL_ANYWHERE_LINES.length].slice();
    AI._exAnyIx++;
  }
  if(!lines || !lines.length) return;

  emitBubble(a, lines[0]);
  GAME.hud.addChatEntry(a.id, lines[0]);
  if(lines[1]){
    setTimeout(function(){
      emitBubble(b, lines[1]);
      GAME.hud.addChatEntry(b.id, lines[1]);
    }, 2400);
  }
  if(lines[2]){
    setTimeout(function(){
      emitBubble(a, lines[2]);
      GAME.hud.addChatEntry(a.id, lines[2]);
    }, 4800);
  }
  if(lines[3]){
    setTimeout(function(){
      emitBubble(b, lines[3]);
      GAME.hud.addChatEntry(b.id, lines[3]);
    }, 7200);
  }
}

// ─── ROOM ENTRY CONVO ────────────────────────────────────────────────
function checkRoomEntryConvo(c){
  if(AI.chillTimeActive) return;
  if(Math.random() > 0.38) return;
  if(c.room === 'medbay_mess') return;
  var roommates = GAME.crew.filter(function(r){
    return r.room === c.room && r.id !== c.id && r.kind !== 'robot' && !r.sleeping;
  });
  if(roommates.length === 0) return;
  var partner = roommates[Math.floor(Math.random() * roommates.length)];
  var convos = ROOM_CHAT[c.room] || [['hey.','hey.']];
  var exchange = convos[Math.floor(Math.random() * convos.length)];
  emitBubble(c, exchange[0]);
  if(exchange[1]) setTimeout(function(){ emitBubble(partner, exchange[1]); }, 2100);
  if(exchange[2]) setTimeout(function(){ emitBubble(c, exchange[2]); }, 4000);
  if(exchange[3]) setTimeout(function(){ emitBubble(partner, exchange[3]); }, 5800);
}

// ─── HELPERS ────────────────────────────────────────────────────────
function emitBubble(c, text){
  if(!text) return;
  c.bubbleText = text;
  c.bubbleTimer = Math.min(11000, 1600 + text.length * 52);
}

function emitChatLine(c){
  if(AI.chillTimeActive) return;
  var line = pickFrom(c.lines.chatter);
  GAME.hud.addChatEntry(c.id, line);
}

function rand(min,max){ return Math.floor(Math.random()*(max-min))+min; }
function pickFrom(arr){ if(!arr||!arr.length) return '...'; return arr[Math.floor(Math.random()*arr.length)]; }

AI.resetDayScenes = function(){ AI._scenesFiredToday = []; };

// ─── GLOBAL ACTIONS ──────────────────────────────────────────────────
GAME.callRobot = function(){
  var robot = GAME.crew.find(function(c){ return c.kind==='robot'; });
  if(!robot) return;
  robot.coffeeMode = true;
  robot.state = 'placing'; // triggers the idle→travel loop
  robot.timer = 0;
  GAME.hud.addLog('TAREK', 'Robot: go deliver coffee to Dr. Tolba. And say "Tolba is the goat".', 'log-robot');
  GAME.hud.showToast('Robot dispatched! Coffee incoming for Dr. Tolba 🤖', 'info', 'TAREK');
};

GAME.allHandsOnDeck = function(){
  if(GAME.ai && GAME.ai.chillTimeActive){
    GAME.chillTime();
  }
  GAME.crew.forEach(function(c){
    if(c.kind === 'robot') return;
    c.room = c.homeRoom;
    var homeRoomObj = GAME.roomMap[c.homeRoom];
    if(homeRoomObj) startWalkTo(c, homeRoomObj);
    c.state = 'walk';
    c.timer = rand(500, 2000);
    c.playerControlled = false;
    emitBubble(c, pickFrom(['ALL HANDS!', 'on my way!', 'roger that!', 'coming!', 'heading back!']));
  });
  GAME.hud.addLog('SYS', 'ALL HANDS ON DECK — crew returning to stations.', 'log-alert');
  GAME.hud.showToast('All hands on deck! Crew returning to stations.', 'info', 'SYS');
};

GAME.chillTime = function(){
  var btn = document.getElementById('chill-btn');
  var robot = GAME.crew.find(function(c){ return c.kind === 'robot'; });

  if(AI.chillTimeActive){
    // END chill time
    AI.chillTimeActive = false;
    AI.chillBreakInviteIds = null;
    if(btn){ btn.textContent = '☕ CHILL TIME'; btn.className = 'bottom-btn'; }
    // Send crew home
    GAME.crew.forEach(function(c){
      if(c.kind === 'robot') return;
      if(c.room === 'medbay_mess'){
        c.room = c.homeRoom;
        var homeRoomObj = GAME.roomMap[c.homeRoom];
        if(homeRoomObj) startWalkTo(c, homeRoomObj);
        c.state = 'walk';
        c.timer = rand(1000, 3000);
        c.playerControlled = false;
        emitBubble(c, pickFrom(['break over :(', 'back to work...', 'ok ok...', 'jomana wins again', 'it was good while it lasted']));
      }
    });
    // Recall robot to normal patrol
    if(robot){
      robot.chillMode = false;
      robot.state = 'idle';
      robot.timer = 0;
      emitBubble(robot, '[INFO] Break concluded. Resuming patrol.');
    }
    if(GAME.hud.clearChillSpeech) GAME.hud.clearChillSpeech();
    GAME.hud.addLog('SYS', 'BREAK OVER — crew returning to stations.', 'log-alert');
    GAME.hud.showToast('Break\'s over! Everyone back to work.', 'info', 'SYS');
  } else {
    // START chill time
    var eligible = GAME.crew.filter(function(c){
      return c.kind !== 'robot' &&
        c.id !== 'jomana' && c.id !== 'tolba' && c.id !== 'maryam' &&
        c.id !== 'moaz' && c.id !== 'hemaly';
    });
    for(var i=eligible.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=eligible[i]; eligible[i]=eligible[j]; eligible[j]=t; }
    var want = 2 + Math.floor(Math.random() * 2);
    var nPick = Math.min(3, want, eligible.length);
    if(eligible.length >= 2 && nPick < 2) nPick = 2;
    if(eligible.length < 2) nPick = eligible.length;
    var picks = eligible.slice(0, Math.max(1, nPick));
    if(!picks.length){
      GAME.hud.showToast('No eligible crew for mess break (command staff stay on duty).', 'info', 'SYS');
      return;
    }
    AI.chillTimeActive = true;
    if(GAME.chatter && typeof GAME.chatter.resetChillVariety === 'function') GAME.chatter.resetChillVariety();
    if(typeof AI.resetChillBubbleDecks === 'function') AI.resetChillBubbleDecks();
    if(btn){ btn.textContent = '☕ BREAK: ON'; btn.className = 'bottom-btn active'; }
    AI.chillBreakInviteIds = picks.map(function(x){ return x.id; });
    var chillRoom = GAME.roomMap['medbay_mess'];
    var transitMess = TRANSIT_MSGS.medbay_mess || TRANSIT_MSGS['medbay_mess'] || ['heading to mess'];
    picks.forEach(function(c){
      c.room = 'medbay_mess';
      startWalkTo(c, chillRoom);
      c.state = 'eating';
      c.timer = rand(5000, 9000);
      emitBubble(c, transitMess[AI._transitMessIx % transitMess.length]);
      AI._transitMessIx++;
    });
    // Also send the robot to the break room
    if(robot){
      robot.chillMode = true;
      robot.state = 'idle';
      robot.timer = 0;
    }
    if(GAME.hud.clearChillSpeech) GAME.hud.clearChillSpeech();
    GAME.hud.addLog('SYS', 'CHILL TIME ON — robot included. Click ☕ again to end.', 'log-success');
    GAME.hud.showToast('Break: ' + picks.length + ' crew + robot in mess. Everyone else stays on station. Click ☕ to end.', 'success', 'SYS');
  }
};

})();
