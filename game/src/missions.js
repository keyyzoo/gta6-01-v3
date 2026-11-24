// The story: three short jobs for Marla's crew in Neon Bay. All names and places are
// original. Each mission has a target point on the city grid, optional timer, and reward.
export const MISSIONS = [
  {
    id: 'pickup',
    title: 'JOB 1 — FIRST PICKUP',
    briefing: 'Marla trusts you with one package. Pick it up at the North Depot marker and bring it back into play. No police, no fuss.',
    target: { x: 72, z: -72 },
    timed: 0,
    reward: 150,
    complete: 'Package secured. Marla is watching — and smiling.',
  },
  {
    id: 'delivery',
    title: 'JOB 2 — HOT DELIVERY',
    briefing: 'A buyer waits at the South Docks. The package is hot: get it there in 90 seconds or the deal is dead.',
    target: { x: -120, z: 120 },
    timed: 90,
    reward: 300,
    complete: 'Delivered with seconds to spare. The crew starts saying your name.',
  },
  {
    id: 'heat',
    title: 'JOB 3 — LOSE THE HEAT',
    briefing: 'Someone talked. The police are on you. Lose them and reach the Hideout marker — alive — and the crew is yours.',
    target: { x: -24, z: 144 },
    timed: 0,
    reward: 500,
    wantedOnStart: 2,
    complete: 'You vanished into the night. Rook is crew now. Story complete — Neon Bay is yours.',
  },
];

export function missionState(index) {
  if (index >= MISSIONS.length) return null;
  const m = MISSIONS[index];
  return { index, id: m.id, title: m.title, briefing: m.briefing, target: { ...m.target }, timer: m.timed, reward: m.reward };
}
