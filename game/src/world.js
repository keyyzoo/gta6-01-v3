// The game's rules and state, with no drawing and no browser in it: the city grid,
// the player on foot and in cars, traffic, pedestrians, police, wanted level, cash
// pickups and the three missions. step() advances one fixed step and returns events
// as bit flags, so the caller can react (sound, banner, save) without the world
// knowing about screens. Nothing here allocates after createWorld returns.
import {
  BLOCK, CAR, CITY, GRID, MAX_WANTED, PALETTE, PITCH, PED_COUNT, PLAYER,
  ROAD, TRAFFIC_COUNT, WANTED_DECAY_SECONDS,
} from './config.js';
import { pick, range } from './random.js';
import { MISSIONS, missionState } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_CRIME = 1;
export const EVENT_HURT = 2;
export const EVENT_PUNCH = 4;
export const EVENT_CRASH = 8;
export const EVENT_PICKUP = 16;
export const EVENT_MISSION_DONE = 32;
export const EVENT_MISSION_FAIL = 64;
export const EVENT_OVER = 128;

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x7f8c8d, 0x8e44ad, 0x16a085, 0xe67e22, 0xecf0f1];
const PED_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xd35400];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
function roadLine(n) { return n * PITCH + PITCH / 2; }

function resolveCircleVsBuildings(x, z, radius, buildings) {
  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    const hw = b.w / 2, hd = b.d / 2;
    const cx = clamp(x, b.x - hw, b.x + hw);
    const cz = clamp(z, b.z - hd, b.z + hd);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * radius;
      z = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const px = hw + radius - Math.abs(x - b.x);
      const pz = hd + radius - Math.abs(z - b.z);
      if (px < pz) x = b.x + (x >= b.x ? hw + radius : -hw - radius);
      else z = b.z + (z >= b.z ? hd + radius : -hd - radius);
    }
    return { x, z, hit: true };
  }
  return { x, z, hit: false };
}

export function createWorld(random) {
  // ---- city generation (seeded, so a seed replays the same Neon Bay) ----
  const buildings = [];
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const cx = i * PITCH, cz = j * PITCH;
      const centreBoost = 1 - (Math.abs(i) + Math.abs(j)) / (GRID * 2);
      const count = random() < 0.45 ? 1 : 2;
      for (let k = 0; k < count; k += 1) {
        const w = range(random, 10, count === 1 ? 24 : 13);
        const d = range(random, 10, count === 1 ? 24 : 13);
        const ox = count === 1 ? 0 : (k === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (k === 0 ? -7 : 7);
        buildings.push({
          x: cx + ox, z: cz + oz, w, d,
          h: Math.round(range(random, 8, 14 + centreBoost * 30)),
          color: pick(random, PALETTE.building),
          lit: Math.floor(range(random, 4, 18)),
        });
      }
    }
  }
  const lamps = [];
  const trees = [];
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const cx = i * PITCH, cz = j * PITCH;
      lamps.push({ x: cx + BLOCK / 2 + 1, z: cz + BLOCK / 2 + 1 });
      if (random() < 0.6) trees.push({ x: cx + range(random, -14, 14), z: cz + range(random, -14, 14) });
    }
  }

  const cars = [];
  const peds = [];
  const pickups = [];
  let nextCarId = 1;

  function makeCar(x, z, angle, kind, color, owned) {
    const car = { id: nextCarId, x, z, angle, speed: 0, kind, color, owned: owned || 'civilian', axis: 'x', dir: 1, road: 0, down: false };
    nextCarId += 1;
    cars.push(car);
    return car;
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    pickups.length = 0;
    nextCarId = 1;
    state.money = 0;
    state.health = 100;
    state.wanted = 0;
    state.crimeTimer = 0;
    state.time = 0;
    state.storyDone = false;
    state.gameOver = false;
    state.mission = missionState(0);
    state.missionBanner = '';
    state.player.x = 24;
    state.player.z = 28;
    state.player.angle = Math.PI;
    state.player.speed = 0;
    state.player.inCar = null;
    state.player.punchTimer = 0;
    state.player.hurtTimer = 0;
    state.player.moving = false;
    state.police.length = 0;
    state.car = null;

    // The player's own car, parked by the kerb near spawn — free, no wanted level.
    state.car = makeCar(28, 24, Math.PI, 'parked', 0xffd23f, 'player');
    // Parked civilian cars along the roads.
    for (let n = 0; n < 10; n += 1) {
      const along = roadLine(Math.floor(range(random, -3, 4)));
      const across = roadLine(Math.floor(range(random, -3, 4)));
      const horizontal = random() < 0.5;
      makeCar(
        horizontal ? range(random, -140, 140) : along + (random() < 0.5 ? 5.5 : -5.5),
        horizontal ? across + (random() < 0.5 ? 5.5 : -5.5) : range(random, -140, 140),
        horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
        'parked', pick(random, CAR_COLORS),
      );
    }
    // Moving traffic on the road grid.
    for (let n = 0; n < TRAFFIC_COUNT; n += 1) spawnTraffic(true);
    // Pedestrians on the sidewalks.
    for (let n = 0; n < PED_COUNT; n += 1) {
      const p = newPed();
      p.x = range(random, -150, 150);
      p.z = range(random, -150, 150);
      peds.push(p);
    }
    // Cash bundles lying around the city.
    for (let n = 0; n < 8; n += 1) {
      pickups.push({ x: roadLine(Math.floor(range(random, -3, 4))) + range(random, -4, 4), z: roadLine(Math.floor(range(random, -3, 4))) + range(random, -4, 4), taken: false });
    }
  }

  function newPed() {
    return {
      x: 0, z: 0, angle: 0, speed: range(random, 1.2, 2.4),
      tx: 0, tz: 0, downTimer: 0, color: pick(random, PED_COLORS), hasTarget: false,
    };
  }

  function spawnTraffic(anywhere) {
    const horizontal = random() < 0.5;
    const road = roadLine(Math.floor(range(random, -GRID, GRID + 1)));
    const dir = random() < 0.5 ? 1 : -1;
    const car = makeCar(
      horizontal ? (anywhere ? range(random, -150, 150) : -170 * dir) : road + (dir > 0 ? 3.5 : -3.5),
      horizontal ? road + (dir > 0 ? -3.5 : 3.5) : (anywhere ? range(random, -150, 150) : -170 * dir),
      horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      'traffic', pick(random, CAR_COLORS),
    );
    car.axis = horizontal ? 'x' : 'z';
    car.dir = dir;
    car.road = road;
    car.speed = range(random, 7, 11);
    return car;
  }

  function pedTarget(p) {
    const bi = Math.floor(range(random, -GRID, GRID + 1));
    const bj = Math.floor(range(random, -GRID, GRID + 1));
    const side = Math.floor(random() * 4);
    const along = range(random, -BLOCK / 2 + 1, BLOCK / 2 - 1);
    const edge = BLOCK / 2 + 1.5;
    if (side === 0) { p.tx = bi * PITCH + along; p.tz = bj * PITCH - edge; }
    else if (side === 1) { p.tx = bi * PITCH + along; p.tz = bj * PITCH + edge; }
    else if (side === 2) { p.tx = bi * PITCH - edge; p.tz = bj * PITCH + along; }
    else { p.tx = bi * PITCH + edge; p.tz = bj * PITCH + along; }
    p.hasTarget = true;
  }

  const state = {
    money: 0, health: 100, wanted: 0, crimeTimer: 0, time: 0,
    storyDone: false, gameOver: false, mission: null, missionBanner: '',
    player: { x: 24, z: 28, angle: Math.PI, speed: 0, inCar: null, punchTimer: 0, hurtTimer: 0, moving: false },
    car: null, police: [],
  };

  function addWanted(n) {
    if (state.wanted >= MAX_WANTED) return;
    state.wanted = Math.min(MAX_WANTED, state.wanted + n);
    state.crimeTimer = 0;
  }

  function nearestCar(maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const car of cars) {
      if (car.kind === 'police') continue;
      if (state.player.inCar === car.id) continue;
      const d = dist2(state.player.x, state.player.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    if (state.player.inCar !== null) return false;
    const car = nearestCar(6.5);
    if (!car) return false;
    if (car.owned !== 'player' && car.kind !== 'traffic') addWanted(1);
    else if (car.owned !== 'player') addWanted(1);
    car.kind = 'player';
    car.speed = 0;
    state.player.inCar = car.id;
    state.car = car;
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.angle = car.angle;
    return true;
  }

  function exitCar() {
    const car = state.car;
    if (!car || state.player.inCar === null) return false;
    if (Math.abs(car.speed) > 3) return false;
    car.kind = 'parked';
    car.speed = 0;
    const side = { x: car.x + Math.cos(car.angle) * 2.6, z: car.z - Math.sin(car.angle) * 2.6 };
    const r = resolveCircleVsBuildings(side.x, side.z, PLAYER.radius, buildings);
    state.player.x = clamp(r.x, -CITY, CITY);
    state.player.z = clamp(r.z, -CITY, CITY);
    state.player.inCar = null;
    state.car = null;
    return true;
  }

  function punch() {
    if (state.player.punchTimer > 0 || state.player.inCar !== null) return EVENT_NONE;
    state.player.punchTimer = PLAYER.punchCooldown;
    let hit = false;
    for (const p of peds) {
      if (p.downTimer > 0) continue;
      if (dist2(state.player.x, state.player.z, p.x, p.z) < PLAYER.punchRange * PLAYER.punchRange) {
        p.downTimer = 3;
        const a = Math.atan2(p.x - state.player.x, p.z - state.player.z);
        p.x += Math.sin(a) * 1.5;
        p.z += Math.cos(a) * 1.5;
        hit = true;
      }
    }
    if (hit) { addWanted(1); return EVENT_PUNCH | EVENT_CRIME; }
    return EVENT_PUNCH;
  }

  function spawnPolice() {
    const a = range(random, 0, Math.PI * 2);
    const x = clamp(state.player.x + Math.sin(a) * 70, -CITY, CITY);
    const z = clamp(state.player.z + Math.cos(a) * 70, -CITY, CITY);
    const car = makeCar(x, z, 0, 'police', PALETTE.police);
    car.speed = 14;
    state.police.push(car);
    return car;
  }

  function updateTraffic(dt) {
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      if (car.kind !== 'traffic') continue;
      const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
      car.x += fx * car.speed * dt;
      car.z += fz * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const along = car.axis === 'x' ? car.x : car.z;
      const nearestLine = Math.round((along - PITCH / 2) / PITCH) * PITCH + PITCH / 2;
      if (Math.abs(along - nearestLine) < 1.2 && random() < 0.02) {
        const turnLeft = random() < 0.5;
        const newDir = turnLeft ? 1 : -1;
        if (car.axis === 'x') {
          car.axis = 'z';
          car.x = nearestLine + (car.dir > 0 ? 3.5 : -3.5);
          car.angle = newDir > 0 ? 0 : Math.PI;
          car.road = car.z;
        } else {
          car.axis = 'x';
          car.z = nearestLine + (car.dir > 0 ? -3.5 : 3.5);
          car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.road = car.x;
        }
        car.dir = newDir;
      }
      if (Math.abs(car.x) > CITY + 12 || Math.abs(car.z) > CITY + 12) {
        cars.splice(i, 1);
        const idx = state.police.indexOf(car);
        if (idx !== -1) state.police.splice(idx, 1);
        spawnTraffic(false);
      }
    }
  }

  function updatePeds(dt) {
    for (const p of peds) {
      if (p.downTimer > 0) { p.downTimer -= dt; continue; }
      if (!p.hasTarget) pedTarget(p);
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1) { p.hasTarget = false; continue; }
      p.angle = Math.atan2(dx, dz);
      p.x += (dx / d) * p.speed * dt;
      p.z += (dz / d) * p.speed * dt;
      const r = resolveCircleVsBuildings(p.x, p.z, 0.6, buildings);
      p.x = r.x; p.z = r.z;
    }
  }

  function updatePolice(dt) {
    // Keep one police car per wanted star.
    while (state.police.length < state.wanted) spawnPolice();
    while (state.police.length > state.wanted) {
      const car = state.police.pop();
      const i = cars.indexOf(car);
      if (i !== -1) cars.splice(i, 1);
    }
    let events = EVENT_NONE;
    for (const car of state.police) {
      const dx = state.player.x - car.x, dz = state.player.z - car.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const target = 13 + state.wanted * 1.5;
      car.speed += clamp(target - car.speed, -10 * dt, 8 * dt);
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      const r = resolveCircleVsBuildings(car.x, car.z, CAR.radius, buildings);
      if (r.hit) car.speed *= 0.5;
      car.x = clamp(r.x, -CITY, CITY);
      car.z = clamp(r.z, -CITY, CITY);
      if (d < 3.2) {
        if (state.player.inCar !== null && state.car) {
          state.car.speed *= 0.92;
          state.car.x += Math.sin(car.angle) * 2 * dt * 10;
          state.car.z += Math.cos(car.angle) * 2 * dt * 10;
        } else if (state.player.hurtTimer <= 0) {
          state.health -= 10;
          state.player.hurtTimer = 0.9;
          state.player.x += (dx / (d || 1)) * -2;
          state.player.z += (dz / (d || 1)) * -2;
          events |= EVENT_HURT;
        }
      }
    }
    return events;
  }

  function updatePlayerCar(dt, input) {
    const car = state.car;
    if (!car) return EVENT_NONE;
    let events = EVENT_NONE;
    const forward = input.y;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
    else car.speed -= Math.sign(car.speed) * CAR.drag * 8 * dt;
    if (Math.abs(car.speed) < 0.2 && forward === 0) car.speed = 0;
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steer = input.x * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * CAR.turnRate * clamp(Math.abs(car.speed) / 12, 0, 1) * dt;
    const prevSpeed = car.speed;
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    const r = resolveCircleVsBuildings(car.x, car.z, CAR.radius, buildings);
    if (r.hit) {
      if (Math.abs(prevSpeed) > 12) events |= EVENT_CRASH;
      car.speed *= 0.4;
    }
    car.x = clamp(r.x, -CITY, CITY);
    car.z = clamp(r.z, -CITY, CITY);
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.angle = car.angle;
    // Ram pedestrians.
    for (const p of peds) {
      if (p.downTimer > 0) continue;
      if (dist2(car.x, car.z, p.x, p.z) < 2.4 * 2.4) {
        p.downTimer = 3;
        addWanted(1);
        car.speed *= 0.7;
        events |= EVENT_CRASH | EVENT_CRIME;
      }
    }
    // Bump traffic cars.
    for (const other of cars) {
      if (other === car || other.kind !== 'traffic') continue;
      const d2 = dist2(car.x, car.z, other.x, other.z);
      if (d2 < 4.2 * 4.2) {
        const d = Math.sqrt(d2) || 1;
        const push = (4.2 - d) / 2;
        const nx = (car.x - other.x) / d, nz = (car.z - other.z) / d;
        car.x += nx * push; car.z += nz * push;
        other.x -= nx * push; other.z -= nz * push;
        car.speed *= 0.85;
        if (Math.abs(prevSpeed) > 10) events |= EVENT_CRASH;
      }
    }
    return events;
  }

  function updatePlayerFoot(dt, input) {
    let events = EVENT_NONE;
    const p = state.player;
    if (input.x !== 0) p.angle += input.x * 2.8 * dt;
    const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    p.moving = input.y !== 0;
    const move = input.y * speed;
    p.x += Math.sin(p.angle) * move * dt;
    p.z += Math.cos(p.angle) * move * dt;
    const r = resolveCircleVsBuildings(p.x, p.z, PLAYER.radius, buildings);
    p.x = clamp(r.x, -CITY, CITY);
    p.z = clamp(r.z, -CITY, CITY);
    return events;
  }

  function step(dt, input) {
    let events = EVENT_NONE;
    state.time += dt;
    const p = state.player;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;

    events |= p.inCar !== null ? updatePlayerCar(dt, input) : updatePlayerFoot(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    events |= updatePolice(dt);

    // Wanted level cools down when the player stays clean.
    if (state.wanted > 0) {
      state.crimeTimer += dt;
      if (state.crimeTimer >= WANTED_DECAY_SECONDS) {
        state.wanted -= 1;
        state.crimeTimer = 0;
      }
    }
    // Slow health regen while the police are not after you.
    if (state.wanted === 0 && state.health > 0 && state.health < 100) {
      state.health = Math.min(100, state.health + 2 * dt);
    }
    // Cash pickups.
    for (const pk of pickups) {
      if (pk.taken) continue;
      if (dist2(p.x, p.z, pk.x, pk.z) < 2.6 * 2.6) {
        pk.taken = true;
        state.money += 25;
        events |= EVENT_PICKUP;
      }
    }
    // Missions.
    if (state.mission) {
      const m = state.mission;
      if (m.timer > 0) {
        m.timer -= dt;
        if (m.timer <= 0) {
          state.mission = missionState(m.index);
          events |= EVENT_MISSION_FAIL;
        }
      }
      if (state.mission === m && dist2(p.x, p.z, m.target.x, m.target.z) < 7 * 7) {
        state.money += m.reward;
        const doneIndex = m.index;
        if (doneIndex + 1 < MISSIONS.length) state.mission = missionState(doneIndex + 1);
        else { state.mission = null; state.storyDone = true; }
        if (doneIndex + 1 === 3 || (doneIndex === 2 && state.storyDone)) {
          // Final job: clear the heat as a reward for finishing the story.
          state.wanted = 0;
          state.crimeTimer = 0;
        }
        events |= EVENT_MISSION_DONE;
      }
    }
    if (state.health <= 0 && !state.gameOver) {
      state.health = 0;
      state.gameOver = true;
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return {
    state, buildings, lamps, trees, cars, peds, pickups,
    reset, step, enterCar, exitCar, punch, nearestCar, addWanted,
  };
}
