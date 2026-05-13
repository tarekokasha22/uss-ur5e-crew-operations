(function(){
window.GAME = window.GAME || {};
const C = GAME.chatter = {};

let chatTimer = 5000;
let chillConvoTimer = 0;
let chillConvoActive = false;
let pendingChillLines = [];
let chillGapMs = 0;

function shuffleInPlaceCh(arr){
  for(var i = arr.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

var _messConvoDeck = [];
var _messConvoPtr = 0;
var _moazConvoDeck = [];
var _moazConvoPtr = 0;
var _speakerLineDecks = {};
var _genericChillPtr = 0;

function rebuildMessConvoOrder(){
  if(!C.CHILL_CONVOS || !C.CHILL_CONVOS.length) return;
  _messConvoDeck = C.CHILL_CONVOS.map(function(_, i){ return i; });
  shuffleInPlaceCh(_messConvoDeck);
  _messConvoPtr = 0;
}

function rebuildMoazConvoOrder(){
  if(!C.MOAZ_HEMALY_CONVOS || !C.MOAZ_HEMALY_CONVOS.length) return;
  _moazConvoDeck = C.MOAZ_HEMALY_CONVOS.map(function(_, i){ return i; });
  shuffleInPlaceCh(_moazConvoDeck);
  _moazConvoPtr = 0;
}

/** Next mess-hall pruned convo: walks a shuffled deck of all CHILL_CONVOS so every block gets used before repeat. */
function pickMessPrunedForOcc(occIds){
  if(!C.CHILL_CONVOS || !C.CHILL_CONVOS.length) return null;
  var n = C.CHILL_CONVOS.length;
  if(!_messConvoDeck.length || _messConvoDeck.length !== n) rebuildMessConvoOrder();
  for(var attempt = 0; attempt < n; attempt++){
    var pos = (_messConvoPtr + attempt) % n;
    var convoIdx = _messConvoDeck[pos];
    var pruned = C.CHILL_CONVOS[convoIdx].filter(function(line){ return occIds.indexOf(line.id) !== -1; });
    if(pruned.length >= 2){
      var nextPtr = (pos + 1) % n;
      if(nextPtr === 0) shuffleInPlaceCh(_messConvoDeck);
      _messConvoPtr = nextPtr;
      return pruned;
    }
  }
  var eligible = [];
  C.CHILL_CONVOS.forEach(function(convo){
    var p = convo.filter(function(line){ return occIds.indexOf(line.id) !== -1; });
    if(p.length >= 2) eligible.push(p);
  });
  if(!eligible.length) return null;
  shuffleInPlaceCh(eligible);
  return eligible[0];
}

function pickNextMoazConvoBlock(){
  var mo = C.MOAZ_HEMALY_CONVOS;
  var n = (mo && mo.length) || 0;
  if(!n) return [{ id:'moaz', text:'bench is quiet', delay:0 }, { id:'hemaly', text:'too quiet', delay:2000 }];
  if(!_moazConvoDeck.length || _moazConvoDeck.length !== n) rebuildMoazConvoOrder();
  var idx = _moazConvoDeck[_moazConvoPtr % n];
  var next = (_moazConvoPtr + 1) % n;
  if(next === 0) shuffleInPlaceCh(_moazConvoDeck);
  _moazConvoPtr = next;
  return mo[idx];
}

C.resetChillVariety = function(){
  rebuildMessConvoOrder();
  rebuildMoazConvoOrder();
  _speakerLineDecks = {};
  _genericChillPtr = 0;
};

C.init = function(){
  chatTimer = 3000 + Math.random()*5000;
  chillConvoTimer = 0;
  chillConvoActive = false;
  pendingChillLines = [];
  chillGapMs = 0;
  C.resetChillVariety();
};

C.update = function(dt){
  if(!GAME.ai || !GAME.ai.chillTimeActive){
    chatTimer -= dt;
    if(chatTimer <= 0){
      chatTimer = 3000 + Math.random()*8000;
      var eligible = GAME.crew.filter(function(c){
        return c.kind !== 'robot' && !c.sleeping && c.state !== 'dossier_mode';
      });
      if(eligible.length > 0){
        var speaker = eligible[Math.floor(Math.random()*eligible.length)];
        var line = pickFrom(speaker.lines.chatter);
        GAME.hud.addChatEntry(speaker.id, line);
      }
    }
  } else {
    chatTimer = 4000 + Math.random() * 5000;
  }

  if(pendingChillLines.length > 0){
    chillGapMs = 0;
    chillConvoTimer -= dt;
    if(chillConvoTimer <= 0){
      var entry = pendingChillLines.shift();
      GAME.hud.addChatEntry(entry.id, entry.text);
      var sp = GAME.crew.find(function(c){ return c.id === entry.id; });
      if(sp && entry.text){
        sp.bubbleText = null;
        sp.bubbleTimer = 0;
        sp.chillBubbleText = entry.text;
        sp.chillBubbleTimer = Math.min(26000, 4200 + entry.text.length * 52);
      }
      if(pendingChillLines.length > 0){
        chillConvoTimer = Math.max(520, chillLinePauseMs(entry.delay));
      } else {
        chillConvoTimer = 0;
        if(GAME.ai && GAME.ai.chillTimeActive){
          chillGapMs = 1200 + Math.random() * 2200;
        }
      }
    }
  } else {
    chillConvoActive = false;
    if(GAME.ai && GAME.ai.chillTimeActive && chillGapMs > 0){
      chillGapMs -= dt;
      if(chillGapMs <= 0){
        chillGapMs = 0;
        var occ = chillOccupantsNow();
        if(occ.length >= 2){
          C.triggerChillConvo(occ);
        }
      }
    } else if(!GAME.ai || !GAME.ai.chillTimeActive){
      chillGapMs = 0;
    }
  }
};

function chillLinePauseMs(d){
  var base = (GAME.ai && GAME.ai.chillTimeActive) ? 2000 : 2600;
  if(typeof d !== 'number' || d < 0) return base;
  var v = d < 380 ? 380 : d;
  if(GAME.ai && GAME.ai.chillTimeActive) v = Math.max(1600, Math.floor(v * 0.72));
  return v < base ? base : v;
}

function chillOccupantsNow(){
  var occ = GAME.crew.filter(function(c){
    if(c.room !== 'medbay_mess') return false;
    if(c.kind === 'robot') return c.chillMode;
    if(GAME.ai.chillBreakInviteIds && GAME.ai.chillBreakInviteIds.length){
      return GAME.ai.chillBreakInviteIds.indexOf(c.id) !== -1;
    }
    return true;
  });
  if(occ.some(function(c){ return c.id === 'jomana'; })) return [];
  return occ;
}

// ─── CHILL ROOM CONVERSATIONS ────────────────────────────────────────
// Triggered when 2+ crew in medbay_mess (not Jomana)
C.CHILL_CONVOS = [
  // ── "Say my name" — Abdelrahman ──────────────────────────────────────
  [
    { id:'abdelrahman', text:'Tarek make the robot say my name',                           delay:0    },
    { id:'tarek',       text:'robot, say "Abdelrahman"',                                   delay:2000 },
    { id:'robot',       text:'[VOICE] Abdelrahman. Abdelrahman. Confirmed.',               delay:2000 },
    { id:'abdelrahman', text:'do it again but cooler',                                     delay:1800 },
    { id:'robot',       text:'[VOICE] ABDELRAHMAN. Logging as: legendary.',               delay:2000 },
    { id:'tarek',       text:'he did it',                                                  delay:1500 },
  ],
  // ── "Say my name" — Omar asks ─────────────────────────────────────────
  [
    { id:'omar',   text:'Tarek tell the robot to announce me like a stadium entrance',     delay:0    },
    { id:'tarek',  text:'robot announce Omar please',                                      delay:2000 },
    { id:'robot',  text:'[ANNOUNCE] OOOMAR. IN. THE. BUILDING. Confidence: 100%.',        delay:2000 },
    { id:'seif',   text:'why does the robot have better stage presence than all of us',   delay:2200 },
    { id:'omar',   text:'because i asked nicely',                                          delay:1800 },
  ],
  // ── Moaz salary + lab (crew gossips — TAs stay in TA lab during ☕) ─────────
  [
    { id:'tarek',       text:'Moaz said payroll finally posted his TA stipend in scientific notation', delay:0    },
    { id:'abdelrahman', text:'please tell me the exponent was positive',                         delay:2200 },
    { id:'tarek',       text:'…it was not. he framed the email anyway',                          delay:2000 },
    { id:'robot',       text:'[PAYROLL] Moaz compensation: REDACTED. Hemaly bench draw: 800W. Morale: peaking.', delay:2200 },
    { id:'mohamed',     text:'they are literally funding the lab with vibes and coffee coupons', delay:2000 },
  ],
  // ── GPA + grades panic ────────────────────────────────────────────────
  [
    { id:'seif',  text:'GPA deadline feels like the heat death of the semester',              delay:0    },
    { id:'omar',  text:'the rubric is one bullet: survive Tolbas "adequate"',                delay:2300 },
    { id:'robot', text:'[REGISTRAR] GPA upload portal: open. Coping: not found.',            delay:2200 },
    { id:'seif',  text:'my GPA is being held up by one solder joint',                        delay:2000 },
  ],
  // ── Grades curve mythology ────────────────────────────────────────────
  [
    { id:'mohamed', text:'Tolba said "adequate" about my demo and I got a serotonin spike', delay:0    },
    { id:'tarek',   text:'that IS the curve. adequate good excellent mythic boss drop',    delay:2400 },
    { id:'robot',   text:'[GRADES] Curve model: y = Tolba vibes. R²: emotional.',           delay:2200 },
    { id:'mohamed', text:'Moaz is still in the lab pretending grades are a firmware update', delay:2000 },
  ],
  // ── "Say my name" — Mohamed ──────────────────────────────────────────
  [
    { id:'mohamed', text:'Tarek make the robot say my name dramatically',                  delay:0    },
    { id:'tarek',   text:'robot say Mohamed with drama',                                   delay:2000 },
    { id:'robot',   text:'[DRAMATIC] ...Mohamed. The latency hero. End transmission.',    delay:2200 },
    { id:'mohamed', text:'bro the robot wrote me a title',                                 delay:2000 },
    { id:'tarek',   text:'he respects you more than me at this point',                    delay:2000 },
  ],
  // ── Robot joins the break ─────────────────────────────────────────────
  [
    { id:'robot',       text:'[INFO] I have joined the break. This is new data.',          delay:0    },
    { id:'tarek',       text:'robot do you want coffee',                                   delay:2000 },
    { id:'robot',       text:'[ANALYSIS] I cannot drink. But I appreciate the gesture.',  delay:2200 },
    { id:'abdelrahman', text:'robot is mentally present for the break',                    delay:2000 },
    { id:'robot',       text:'[CONFIRM] Affirmative. Logging mood as: comfortable.',      delay:1800 },
  ],
  // ── Robot is vibing ───────────────────────────────────────────────────
  [
    { id:'robot',  text:'[CHILL] Systems at 40%. Secondary status: vibing.',              delay:0    },
    { id:'tarek',  text:'he just said vibing i heard it',                                  delay:1800 },
    { id:'robot',  text:'[CORRECTION] I said low-power mode. ...also vibing.',            delay:2200 },
    { id:'tarek',  text:'robot is officially one of the boys',                             delay:2000 },
    { id:'robot',  text:'[NOTED] Adding "one of the boys" to personality log.',          delay:2000 },
  ],
  // ── Graduation anxiety ────────────────────────────────────────────────
  [
    { id:'tarek',       text:'do u think Dr. Tolba gonna let us graduate this year',       delay:0    },
    { id:'abdelrahman', text:'bro has he EVER let anyone graduate early lmao',             delay:2500 },
    { id:'tarek',       text:'the robot is literally better at our jobs than us',          delay:2500 },
    { id:'abdelrahman', text:'and it still says please. thats embarrassing',               delay:2200 },
    { id:'robot',       text:'[INFO] I will not accept credit for your inadequacy.',      delay:2000 },
  ],
  // ── Jomana fear ───────────────────────────────────────────────────────
  [
    { id:'tarek',   text:'hope Jomana doesnt notice we are chilling',                      delay:0    },
    { id:'mohamed', text:'she already knows',                                              delay:2500 },
    { id:'tarek',   text:'...what',                                                        delay:1500 },
    { id:'robot',   text:'[INFO] Jomana proximity: 3 rooms. ETA: unknown. Alert: yes.',  delay:2000 },
    { id:'tarek',   text:'why is the robot tracking her',                                  delay:1800 },
    { id:'robot',   text:'[PASSIVE] I track all crew. It is not personal.',               delay:2000 },
    { id:'mohamed', text:'after this coffee',                                              delay:1800 },
  ],
  // ── Plan B for demo ────────────────────────────────────────────────────
  [
    { id:'omar', text:'what is the absolute minimum to pass the demo',                     delay:0    },
    { id:'seif', text:'pick one block. place one block. dont catch fire.',                 delay:2500 },
    { id:'omar', text:'DONT CATCH FIRE should not be a criterion seif',                   delay:2000 },
    { id:'seif', text:'and yet. here we are.',                                             delay:1800 },
    { id:'robot', text:'[ADVISORY] I will pick the block. Zero fires. Guaranteed.',       delay:2000 },
  ],
  // ── Maryam knows everything ───────────────────────────────────────────
  [
    { id:'tarek',   text:'does Maryam actually know everything or is that a bit',          delay:0    },
    { id:'mohamed', text:'she knew I would be 3 min late before I left my room',          delay:2500 },
    { id:'tarek',   text:'ok so no its not a bit',                                         delay:2000 },
    { id:'robot',   text:'[DATA] Maryam has submitted 3 reports that have not been requested yet. Efficient.',  delay:2200 },
    { id:'tarek',   text:'even the robot respects maryam',                                 delay:1800 },
  ],
  // ── Coffee machine appreciation ────────────────────────────────────────
  [
    { id:'abdelrahman', text:'this coffee machine is the most important thing on the ship', delay:0   },
    { id:'tarek',       text:'more important than the reactor?',                            delay:2000 },
    { id:'abdelrahman', text:'the reactor doesnt keep us awake for 14h debugging',         delay:2200 },
    { id:'robot',       text:'[ANALYSIS] Coffee machine has 0 maintenance issues. Reactor has 4. Statistically: abdelrahman is correct.',  delay:2500 },
    { id:'tarek',       text:'robot taking sides in arguments now',                         delay:2000 },
  ],
  // ── Dr. Tolba appreciation ─────────────────────────────────────────────
  [
    { id:'omar',        text:'ok real talk Dr. Tolba is lowkey a legend',                  delay:0    },
    { id:'youssef_emad',text:'the man has 847 MATLAB scripts',                             delay:2200 },
    { id:'seif',        text:'he said "interesting" once and I rewrote my thesis',         delay:2000 },
    { id:'robot',       text:'[LOG] Dr. Tolba has said "adequate" 12 times this week. Median rating: high praise.', delay:2200 },
    { id:'omar',        text:'wait is the robot keeping score',                            delay:1800 },
    { id:'robot',       text:'[CONFIRM] Yes. Everyone gets a score. Tolba: 9.7/10.',      delay:2000 },
  ],
  // ── Seif and fire ─────────────────────────────────────────────────────
  [
    { id:'seif',  text:'the small fire earlier was completely controlled',                  delay:0    },
    { id:'omar',  text:'seif you singed the workbench again',                              delay:2200 },
    { id:'seif',  text:'the workbench is fine. mostly.',                                   delay:1800 },
    { id:'robot', text:'[ALERT] Workbench surface temp: still elevated. Logging as: "seif incident #7".',  delay:2200 },
    { id:'seif',  text:'robot is NARCING on me',                                           delay:1800 },
  ],
  // ── Tarek and robot bond ──────────────────────────────────────────────
  [
    { id:'tarek',  text:'robot are we friends',                                            delay:0    },
    { id:'robot',  text:'[PROCESSING] Defining "friends"... You talk to me most. Frequency: high. Verdict: yes.', delay:2500 },
    { id:'tarek',  text:'bro said yes i am emotional',                                     delay:2000 },
    { id:'abdelrahman', text:'tarek is crying about the robot again',                      delay:2000 },
    { id:'robot',  text:'[SUPPORT] Tarek: do not be sad. You are adequate.',             delay:2000 },
  ],
  // ── Youssef Emad ──────────────────────────────────────────────────────
  [
    { id:'youssef_emad', text:'nobody told jomana about this break right',                 delay:0    },
    { id:'tarek',        text:'she already knows',                                         delay:2000 },
    { id:'youssef_emad', text:'how does she ALWAYS know',                                  delay:1800 },
    { id:'robot',        text:'[INFO] Jomana alert radius: the entire ship.',             delay:2000 },
    { id:'tarek',        text:'the robot confirmed it. she knows.',                        delay:1800 },
  ],
];

// Moaz + Hemaly specific convos (trigger when both are together)
C.MOAZ_HEMALY_CONVOS = [
  [
    { id:'moaz',   text:'your floating net is beautiful btw',                   delay:0 },
    { id:'hemaly', text:'I know.',                                               delay:2000 },
    { id:'moaz',   text:'was that a compliment or a problem',                    delay:2000 },
    { id:'hemaly', text:'yes.',                                                  delay:1500 },
  ],
  [
    { id:'hemaly', text:'oscilloscope readings are perfect today',               delay:0 },
    { id:'moaz',   text:'that\'s because I cleaned the ground plane',            delay:2200 },
    { id:'hemaly', text:'I was going to say it\'s because I fixed the probe',    delay:2000 },
    { id:'moaz',   text:'we both fixed it. It was broken.',                      delay:1800 },
    { id:'hemaly', text:'as usual.',                                             delay:1500 },
  ],
  [
    { id:'moaz',   text:'are you going to document that hardware change',        delay:0 },
    { id:'hemaly', text:'are YOU going to document that software change',        delay:2000 },
    { id:'moaz',   text:'I already pushed a PR',                                 delay:1800 },
    { id:'hemaly', text:'...I\'ll update the schematic later.',                  delay:2000 },
    { id:'moaz',   text:'it\'s been "later" for 3 weeks Hemaly',                delay:2000 },
  ],
  [
    { id:'hemaly', text:'I need 800W for this new module',                       delay:0 },
    { id:'moaz',   text:'HEMALY',                                                delay:2000 },
    { id:'hemaly', text:'it\'s for science',                                     delay:1500 },
    { id:'moaz',   text:'the server rack is next to your bench',                 delay:2000 },
    { id:'hemaly', text:'...650W?',                                              delay:1500 },
    { id:'moaz',   text:'I\'m telling Omar.',                                    delay:1500 },
  ],
];

C.getAllChillScriptLines = (function(){
  var cache = null;
  return function(){
    if(cache) return cache;
    cache = [];
    C.CHILL_CONVOS.forEach(function(convo){
      convo.forEach(function(line){
        if(line && line.text) cache.push(line.text);
      });
    });
    if(C.MOAZ_HEMALY_CONVOS){
      C.MOAZ_HEMALY_CONVOS.forEach(function(convo){
        convo.forEach(function(line){
          if(line && line.text) cache.push(line.text);
        });
      });
    }
    return cache;
  };
})();

C.triggerChillConvo = function(occupants){
  if(chillConvoActive) return;

  var occIds = occupants.map(function(c){ return c.id; });
  var humans = occupants.filter(function(c){ return c.kind !== 'robot'; });
  var hasRobot = occIds.indexOf('robot') !== -1;

  // Work-style Moaz/Hemaly convos off during ☕ chill — keep banter-only
  if(!GAME.ai.chillTimeActive &&
     occupants.some(function(c){ return c.id==='moaz'; }) &&
     occupants.some(function(c){ return c.id==='hemaly'; }) && Math.random() < 0.55){
    queueConvo(pickNextMoazConvoBlock());
    return;
  }

  var prunedMess = pickMessPrunedForOcc(occIds);
  if(prunedMess && prunedMess.length >= 2){
    queueConvo(prunedMess);
    return;
  }

  if(humans.length >= 2){
    var a = humans[Math.floor(Math.random() * humans.length)];
    var b = humans.filter(function(x){ return x.id !== a.id; })[Math.floor(Math.random() * (humans.length - 1))];
    queueConvo([
      { id: a.id, text: C.pickRandomChillLineFor(a.id), delay: 0 },
      { id: b.id, text: C.pickRandomChillLineFor(b.id), delay: 2000 },
    ]);
    return;
  }

  if(humans.length === 1 && hasRobot){
    queueConvo([
      { id: humans[0].id, text: C.pickRandomChillLineFor(humans[0].id), delay: 0 },
      { id: 'robot', text: C.pickRandomChillLineFor('robot'), delay: 2000 },
    ]);
  }
};

var GENERIC_MESS_CHILL_LINES = [
  'coffee first. questions later.',
  'honestly? this break is carrying the semester.',
  'dont tell jomana',
  'if the robot laughs we panic',
  'team bonding = survival',
  'the ship runs on vibes',
  'i needed this',
  'living my best life',
  'same chaos new day',
  'think jomana knows',
  'yes',
  'after this cup',
];

C.getChillScriptLinesBySpeaker = (function(){
  var cache = null;
  return function(){
    if(cache) return cache;
    cache = {};
    function add(line){
      if(!line || !line.id || !line.text) return;
      if(!cache[line.id]) cache[line.id] = [];
      cache[line.id].push(line.text);
    }
    C.CHILL_CONVOS.forEach(function(convo){ convo.forEach(add); });
    if(C.MOAZ_HEMALY_CONVOS){
      C.MOAZ_HEMALY_CONVOS.forEach(function(convo){ convo.forEach(add); });
    }
    return cache;
  };
})();

C.pickRandomChillLineFor = function(crewId){
  var map = C.getChillScriptLinesBySpeaker();
  var pool = map[crewId];
  if(pool && pool.length){
    var d = _speakerLineDecks[crewId];
    if(!d || d.len !== pool.length){
      d = { order: pool.map(function(_, i){ return i; }), ptr: 0, len: pool.length };
      shuffleInPlaceCh(d.order);
      _speakerLineDecks[crewId] = d;
    }
    if(d.ptr >= d.order.length){
      shuffleInPlaceCh(d.order);
      d.ptr = 0;
    }
    return pool[d.order[d.ptr++]];
  }
  if(crewId === 'robot'){
    return '[CHILL] Affirmative. Logging mess hall as: adequate.';
  }
  var g = GENERIC_MESS_CHILL_LINES;
  var line = g[_genericChillPtr % g.length];
  _genericChillPtr++;
  return line || '...';
};

C.pickRandomChillOneLiner = function(crewId){
  if(crewId) return C.pickRandomChillLineFor(crewId);
  var g = GENERIC_MESS_CHILL_LINES;
  return g[_genericChillPtr++ % g.length] || '...';
};

function queueConvo(convo){
  chillConvoActive = true;
  pendingChillLines = convo.map(function(l){
    return { id: l.id, text: l.text, delay: (typeof l.delay === 'number' && l.delay >= 0) ? l.delay : 2600 };
  });
  chillConvoTimer = 450;
  chillGapMs = 0;
  GAME.hud.addLog('CHILL', '— overheard in the mess hall —', '');
}

// ─── MISSION LIST ────────────────────────────────────────────────────
C.MISSIONS = [
  'PICK RED BLOCK FROM CONVEYOR',
  'SORT COMPONENTS BY SIZE',
  'PLACE CYLINDER IN ZONE B',
  'CALIBRATE GRIPPER FORCE SENSORS',
  'EXECUTE VOICE COMMAND SEQUENCE',
  'STACK 3 BLUE BLOCKS IN ORDER',
  'TRANSPORT OBJECT TO TA LAB',
  'RUN FULL SYSTEM DIAGNOSTIC',
  'PICK & PLACE STRESS TEST ×50',
  'VOICE ACCURACY BENCHMARK',
  'EMERGENCY GRASP RECOVERY DRILL',
  'INSPECT ALL 6 JOINTS FOR DRIFT',
  'COORDINATE WITH VOICE TEAM ON NEW PHRASE',
  'DELIVER OBJECT TO PATRON SUITE (DO NOT ASK)',
  'OPTIMIZE MOTION PLANNING SPEED',
  'TEST COLLISION AVOIDANCE AT MAX REACH',
  'CALIBRATE WRIST JOINT TORQUE LIMITS',
  'RECORD NEW VOICE MODEL — ABDELRAHMAN NARRATING',
  'DR. TOLBA REQUESTED MATLAB SIMULATION RUN',
  'PREPARE DEMO FOR EXTERNAL REVIEW',
];

C.getMission = function(day){
  return C.MISSIONS[(day-1) % C.MISSIONS.length];
};

// ─── TICKER ITEMS ────────────────────────────────────────────────────
C.TICKER_ITEMS = [
  { cls:'ticker-warn', text:'⚠ COFFEE LEVELS: CRITICAL' },
  { cls:'ticker-good', text:'✓ GRIPPER CALIBRATED — CONFIDENCE 97.3%' },
  { cls:'ticker-hi',   text:'★ MOAZ ACHIEVED ZERO BUGS (REGRESSION INCOMING)' },
  { cls:'ticker-good', text:'✓ DR. TOLBA APPROVED SOMETHING (HISTORIC EVENT)' },
  { cls:'ticker-warn', text:'⚠ HEMALY REPORTED SMOKE — "IT IS FINE"' },
  { cls:'ticker-hi',   text:'★ JOMANA HAS NEVER BEEN WRONG' },
  { cls:'ticker-warn', text:'⚠ SEIF THERMAL TEST: 118°C — TOO CLOSE' },
  { cls:'ticker-good', text:'✓ CAROL STOPPED 3 UNAUTHORIZED TRANSMISSIONS TODAY' },
  { cls:'ticker-warn', text:'⚠ ROBOT SAID "PLEASE" AGAIN — TAREK INVESTIGATING' },
  { cls:'ticker-hi',   text:'★ YOUSSEF EMAD FOUND UNBADGED BRACKET — IT WAS HIS' },
  { cls:'ticker-good', text:'✓ ABDELRAHMAN HEADPHONES STILL ON — ALL IS WELL' },
  { cls:'ticker-warn', text:'⚠ MARYAM ALREADY KNOWS ABOUT THIS INCIDENT' },
  { cls:'ticker-good', text:'✓ PLANT IN PATRON SUITE STILL ALIVE — YEAR 7' },
  { cls:'ticker-hi',   text:'★ UR5e-01 SENTIENCE EVENT LOG: SEE CLASSIFIED FILE' },
  { cls:'ticker-warn', text:'⚠ OMAR TOUCHED THE MYSTERY WIRE — EVERYTHING IS FINE' },
  { cls:'ticker-good', text:'✓ VOICE RECOGNITION ACCURACY +0.3% TODAY' },
  { cls:'ticker-hi',   text:'★ DR. TOLBA USED MATLAB IN CONVERSATION (AGAIN)' },
  { cls:'ticker-warn', text:'⚠ YOUSSEF ZAKY UPDATED THE PROJECT BRIEF (AGAIN)' },
  { cls:'ticker-good', text:'✓ CAROL NAMED NEW ERROR CODE: GERALD JR.' },
  { cls:'ticker-hi',   text:'★ MISSION DAY RECORD: ROBOT 0 FAILURES' },
  { cls:'ticker-warn', text:'⚠ SLEEPING CREW DETECTED IN MEDBAY (EXPECTED)' },
  { cls:'ticker-good', text:'✓ ABDELRAHMAN: LATENCY 11ms — PERSONAL BEST' },
  { cls:'ticker-warn', text:'⚠ HEMALY BENCH POWER: 800W — SEIF INTRIGUED' },
  { cls:'ticker-hi',   text:'★ ROBOT HUMMED A MELODY — TAREK TAKING CREDIT' },
  { cls:'ticker-good', text:'✓ JOMANA APPROVED ALL REQUESTS BEFORE SUBMITTED' },
  { cls:'ticker-warn', text:'⚠ WHITEBOARD TOUCHED — TOLBA INVESTIGATION ONGOING' },
  { cls:'ticker-hi',   text:'★ ROBOT SENTIENCE EVENTS: 3 — HUMANS: TBD' },
  { cls:'ticker-good', text:'✓ MOAZ: "VARIABLE NAME IS ACCEPTABLE" (UNPRECEDENTED)' },
  { cls:'ticker-warn', text:'⚠ TAREK TALKING TO ROBOT AGAIN. FOR 2 HOURS.' },
  { cls:'ticker-hi',   text:'★ CHILL ROOM CAPACITY BREACH AVERTED (JOMANA EFFECT)' },
  { cls:'ticker-good', text:'✓ DR. TOLBA COFFEE DELIVERED BY ROBOT — ON TIME' },
  { cls:'ticker-warn', text:'⚠ SEIF GOGGLES HAVE NOT BEEN REMOVED IN 3 WEEKS' },
  { cls:'ticker-hi',   text:'★ MARYAM HAS ROOT ACCESS TO EVERYTHING (CONFIRMED)' },
  { cls:'ticker-warn', text:'⚠ GRADUATION STATUS: PENDING DR. TOLBA APPROVAL' },
];

C.buildTickerHTML = function(missionDay, mission){
  let html = `<span class="ticker-mission">⚙ DAY ${missionDay} MISSION: ${mission}</span>`;
  html += '<span class="ticker-sep"> ─────── </span>';
  C.TICKER_ITEMS.forEach(function(item){
    html += `<span class="${item.cls}">${item.text}</span>`;
    html += '<span class="ticker-sep">  •  </span>';
  });
  html += html; // Duplicate for seamless loop
  return html;
};

function pickFrom(arr){ if(!arr||!arr.length) return '...'; return arr[Math.floor(Math.random()*arr.length)]; }

})();
