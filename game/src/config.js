// Every tuning number in one place.
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay.save.v1';

// City: blocks of BLOCK size, roads of ROAD width, pitch between block centres.
export const BLOCK = 34;
export const ROAD = 14;
export const PITCH = BLOCK + ROAD; // 48
export const GRID = 3; // block indices -3..3, city spans about +/-168
export const CITY = GRID * PITCH + BLOCK / 2; // ~161, half-extent of drivable area

export const PLAYER = {
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  radius: 0.9,
  punchRange: 2.4,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 34,
  maxReverse: 10,
  turnRate: 2.1,
  drag: 0.35,
  radius: 1.9,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const MAX_WANTED = 3;
export const WANTED_DECAY_SECONDS = 15;

export const PALETTE = {
  sky: 0x0e1430,
  fog: 0x0e1430,
  ground: 0x1a1d29,
  road: 0x23262f,
  sidewalk: 0x3a3f4d,
  building: [0x2e4a6b, 0x4a2e5e, 0x5e3a2e, 0x2e5e4a, 0x6b5a2e, 0x3a3f5e, 0x5e2e3a],
  windowLit: 0xffd23f,
  windowDark: 0x1c2440,
  lamp: 0xffe9a8,
  player: 0xffd23f,
  police: 0x2f6df6,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
