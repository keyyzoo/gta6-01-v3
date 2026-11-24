// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over. Save/load lives in localStorage.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_CRIME, EVENT_HURT, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_OVER, EVENT_PICKUP, EVENT_PUNCH } from './world.js';
import { ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { MISSIONS, missionState } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const hud = document.getElementById('hud');
const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('over');
const moneyEl = document.getElementById('money');
const healthFill = document.getElementById('healthfill');
const wantedEl = document.getElementById('wanted');
const missionTitleEl = document.getElementById('missionTitle');
const missionTextEl = document.getElementById('missionText');
const speedEl = document.getElementById('speed');
const promptEl = document.getElementById('prompt');
const bannerEl = document.getElementById('banner');
const minimapCanvas = document.getElementById('minimap');
const btnContinue = document.getElementById('btnContinue');

const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, minimapCanvas);
renderer.buildBuildings(world.buildings);
renderer.buildProps(world.lamps, world.trees);
renderer.buildPeds(world.peds);
renderer.buildPickups(world.pickups);
const input = createInput();
const audio = createAudio();

let screen = 'title';
let bannerUntil = 0;
let lastMissionIndex = 0;

function announce(message) { statusEl.textContent = message; }

function showBanner(html, ms = 3800) {
  bannerEl.innerHTML = html;
  bannerEl.style.display = 'block';
  bannerUntil = performance.now() + ms;
}

function showScreen(next) {
  screen = next;
  titleEl.classList.toggle('hidden', next !== 'title');
  pauseEl.classList.toggle('hidden', next !== 'paused');
  overEl.classList.toggle('hidden', next !== 'over');
  hud.classList.toggle('on', next === 'play' || next === 'paused');
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGame() {
  try {
    const s = world.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: s.money, health: s.health,
      missionIndex: s.mission ? s.mission.index : MISSIONS.length,
      storyDone: s.storyDone, time: s.time,
      player: { x: s.player.x, z: s.player.z, angle: s.player.angle },
    }));
    return true;
  } catch { return false; }
}

function applySave(save) {
  const s = world.state;
  s.money = save.money ?? 0;
  s.health = save.health ?? 100;
  s.storyDone = !!save.storyDone;
  s.time = save.time ?? 0;
  const idx = save.missionIndex ?? 0;
  s.mission = idx >= MISSIONS.length ? null : missionState(idx);
  if (save.player) {
    s.player.x = save.player.x;
    s.player.z = save.player.z;
    s.player.angle = save.player.angle;
  }
  lastMissionIndex = s.mission ? s.mission.index : MISSIONS.length;
  if (s.mission && MISSIONS[s.mission.index] && MISSIONS[s.mission.index].wantedOnStart) {
    world.addWanted(MISSIONS[s.mission.index].wantedOnStart);
  }
}

function startGame(fromSave) {
  world.reset();
  if (fromSave) {
    const save = readSave();
    if (save) applySave(save);
  }
  lastMissionIndex = world.state.mission ? world.state.mission.index : MISSIONS.length;
  audio.resume();
  showScreen('play');
  announce('Playing. Follow the gold marker for your first job.');
}

function endGame() {
  showScreen('over');
  document.getElementById('overText').textContent =
    `Rook went down with $${world.state.money} in crew cash. The crew remembers the ones who try again.`;
  announce('Game over.');
}

function quitToTitle() {
  world.reset();
  lastMissionIndex = 0;
  btnContinue.style.display = readSave() ? '' : 'none';
  showScreen('title');
  announce('Neon Bay. Press Start to play.');
}

function updateHUD() {
  const s = world.state;
  moneyEl.textContent = `$${s.money}`;
  healthFill.style.width = `${Math.max(0, s.health)}%`;
  healthFill.style.background = s.health > 50
    ? 'linear-gradient(90deg,#37d67a,#a3e635)'
    : s.health > 25 ? 'linear-gradient(90deg,#f59e0b,#facc15)' : 'linear-gradient(90deg,#ef4444,#f87171)';
  let stars = '';
  for (let i = 0; i < 3; i += 1) {
    stars += i < s.wanted ? '&#9733;' : '<span class="off">&#9733;</span>';
  }
  wantedEl.innerHTML = stars;
  const car = s.car;
  const mph = car ? Math.round(Math.abs(car.speed) * 2.2) : 0;
  speedEl.innerHTML = `${s.player.inCar !== null ? mph : 0}<small>MPH</small>`;
  if (s.mission) {
    missionTitleEl.textContent = s.mission.title;
    const d = Math.round(Math.hypot(s.player.x - s.mission.target.x, s.player.z - s.mission.target.z));
    const timer = s.mission.timer > 0 ? ` — ${Math.ceil(s.mission.timer)}s left` : '';
    missionTextEl.textContent = `${s.mission.briefing} (${d}m${timer})`;
  } else if (s.storyDone) {
    missionTitleEl.textContent = 'FREE ROAM — CREW MADE';
    missionTextEl.textContent = 'All three jobs done. Neon Bay is yours: grab cash, steal cars, outrun the police.';
  } else {
    missionTitleEl.textContent = '';
    missionTextEl.textContent = '';
  }
  let prompt = '';
  if (s.player.inCar !== null) prompt = 'E — exit car';
  else {
    const near = world.nearestCar(6.5);
    if (near) prompt = near.owned === 'player' ? 'E — enter your car' : 'E — steal car (wanted +1)';
  }
  if (prompt) { promptEl.textContent = prompt; promptEl.style.display = 'block'; }
  else promptEl.style.display = 'none';
  if (bannerUntil && performance.now() > bannerUntil) {
    bannerEl.style.display = 'none';
    bannerUntil = 0;
  }
}

function handleMissionEvents(events, prevMissionIndex) {
  if (events & EVENT_MISSION_DONE) {
    const done = MISSIONS[prevMissionIndex];
    audio.missionDone();
    saveGame();
    if (done) showBanner(`JOB COMPLETE — +$${done.reward}<small>${done.complete}</small>`, 4500);
    const m = world.state.mission;
    if (m && MISSIONS[m.index] && MISSIONS[m.index].wantedOnStart) world.addWanted(MISSIONS[m.index].wantedOnStart);
    lastMissionIndex = m ? m.index : MISSIONS.length;
    announce(`Job complete. ${done ? done.complete : ''}`);
  }
  if (events & EVENT_MISSION_FAIL) {
    showBanner('TOO SLOW — THE DEAL IS DEAD<small>The buyer walked. Try the job again.</small>');
    lastMissionIndex = world.state.mission ? world.state.mission.index : MISSIONS.length;
    announce('Mission failed. Try again.');
  }
}

function runShot(name) {
  const staged = stageShot(name, world, renderer);
  lastMissionIndex = world.state.mission ? world.state.mission.index : MISSIONS.length;
  showScreen(staged.screen === 'title' ? 'title' : 'play');
  updateHUD();
  let painted = 0;
  function paint() {
    renderer.sync(world, STEP, world.state.time + painted * STEP);
    renderer.drawMinimap(world);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  btnContinue.style.display = readSave() ? '' : 'none';
  showScreen('title');
  announce('Neon Bay. Press Start to play.');
  let accumulator = 0;
  let last = performance.now();

  function step() {
    const prevMissionIndex = world.state.mission ? world.state.mission.index : MISSIONS.length;
    const events = world.step(STEP, input.axis());
    if (events & EVENT_PICKUP) { audio.pickup(); }
    if (events & EVENT_PUNCH) { audio.punch(); }
    if (events & EVENT_CRASH) { audio.crash(); }
    if (events & EVENT_HURT) { audio.hurt(); }
    if (events & EVENT_CRIME) { /* wanted stars already show it */ }
    handleMissionEvents(events, prevMissionIndex);
    if (events & EVENT_OVER) endGame();
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      showBanner(muted ? 'SOUND OFF' : 'SOUND ON', 1200);
    }
    if (screen === 'title' || screen === 'over') {
      if (actions & ACTION_ENTER) startGame(false);
    } else if (screen === 'play') {
      if (actions & ACTION_PAUSE) { showScreen('paused'); announce('Paused.'); }
      else if (actions & ACTION_SAVE) {
        if (saveGame()) showBanner('GAME SAVED', 1500);
      } else if (actions & ACTION_ENTER) {
        if (world.state.player.inCar !== null) { if (world.exitCar()) audio.door(); }
        else if (world.enterCar()) audio.door();
      } else if (actions & ACTION_PUNCH) {
        world.punch();
      }
      while (accumulator >= STEP && screen === 'play') {
        step();
        accumulator -= STEP;
      }
      if (screen === 'play') {
        audio.setEngine(world.state.car ? Math.abs(world.state.car.speed) / 34 : 0, world.state.player.inCar !== null);
        audio.setSiren(world.state.wanted > 0, world.state.time);
        updateHUD();
        renderer.drawMinimap(world);
      }
    } else if (screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_ENTER)) { showScreen('play'); announce('Playing.'); }
      accumulator = 0;
    }
    if (screen === 'title') {
      // Living backdrop: traffic and pedestrians move behind the title card.
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sprint: false });
        accumulator -= STEP;
      }
    }
    renderer.sync(world, Math.min((now - last) / 1000 || STEP, STEP), world.state.time);
  }

  document.getElementById('btnStart').addEventListener('click', () => startGame(false));
  btnContinue.addEventListener('click', () => startGame(true));
  document.getElementById('btnResume').addEventListener('click', () => { showScreen('play'); });
  document.getElementById('btnSave').addEventListener('click', () => { if (saveGame()) showBanner('GAME SAVED', 1500); });
  document.getElementById('btnQuit').addEventListener('click', quitToTitle);
  document.getElementById('btnRetry').addEventListener('click', () => startGame(false));
  document.getElementById('btnOverTitle').addEventListener('click', quitToTitle);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') { showScreen('paused'); announce('Paused.'); }
  });
  requestAnimationFrame(frame);
}

// Test hook: live state for automated checks (no personal data).
window.__game = {
  get screen() { return screen; },
  get state() { return world.state; },
  get cars() { return world.cars.length; },
  get peds() { return world.peds.length; },
  start: () => startGame(false),
};

if (shot) runShot(shot);
else runGame();
