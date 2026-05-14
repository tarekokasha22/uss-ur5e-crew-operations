(function(){
window.GAME = window.GAME || {};
const S = GAME.save = {};

const KEY = 'usur5e_save_v1';
const SCHEMA_VERSION = 1;

const defaults = {
  version: SCHEMA_VERSION,
  dayStart: Date.now(),
  audioEnabled: true,
  achievements: [],
  clickedCrew: [],
  totalDays: 1,
  robotGraspFails: 0,
  konami: false,
  nightMode: false,
  missionDay: 1,
  hadChill: false,
  coffeeDispatched: false,
  coffeeDeliveries: 0,
  movesCompleted: 0,
  chillSessions: 0,
  allHandsUses: 0,
  decorSeenKeys: [],
};

let state = null;

S.load = function(){
  try {
    const raw = localStorage.getItem(KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed.version === SCHEMA_VERSION){
        state = Object.assign({}, defaults, parsed);
      } else {
        // migrate from older version
        state = Object.assign({}, defaults);
      }
    } else {
      state = Object.assign({}, defaults);
    }
  } catch(e){
    state = Object.assign({}, defaults);
  }
  // Update day count
  const dayMs = 24*60*60*1000;
  const savedDay = Math.floor((Date.now() - state.dayStart) / dayMs) + 1;
  if(savedDay > state.totalDays){
    state.totalDays = savedDay;
    state.missionDay = savedDay;
  }
  return state;
};

S.save = function(){
  if(!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){}
};

S.get = function(key){ return state ? state[key] : defaults[key]; };
S.set = function(key, val){ if(state){ state[key] = val; S.save(); } };

S.unlockAchievement = function(id){
  if(!state) return false;
  if(state.achievements.includes(id)) return false;
  state.achievements.push(id);
  S.save();
  return true;
};

S.hasAchievement = function(id){
  return state && state.achievements.includes(id);
};

S.markCrewClicked = function(id){
  if(!state) return;
  if(!state.clickedCrew.includes(id)){
    state.clickedCrew.push(id);
    S.save();
  }
};

S.getClickedCrewCount = function(){
  return state ? state.clickedCrew.length : 0;
};

S.reset = function(){
  localStorage.removeItem(KEY);
  state = Object.assign({}, defaults);
};

})();
