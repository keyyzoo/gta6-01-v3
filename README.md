# gta6-01-v3

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/keyyzoo/gta6-01-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/keyyzoo/gta6-01-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Bay — an original open-world street story game built with three.js: drive and fight through a procedural city, steal cars, outrun the police, and run missions for a small crew. Playable in a desktop browser from static files, with zero network requests.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## About

An original open-world crime game built with three.js. No assets from any existing
game: the city, characters, vehicles, names, story, art and sound are all made for
this entry.

You are **Rook**, a courier with a fast car and no reputation. Marla, who runs the
smallest crew in Neon Bay, offers you one shot: run her jobs, earn her trust, and
climb from nobody to somebody — without ending up in a cell.

## How to play

Serve the `game/` folder with any static server (for example `node serve.ts`, then
open http://localhost:8080) and click **START ENGINE**.

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Shift | Sprint |
| E | Enter / exit a car (stealing a stranger's car raises your wanted level) |
| F | Punch |
| P / Esc | Pause |
| Q | Save game |
| M | Mute sound |

## Features

- **Procedural city** — a road grid of buildings, sidewalks, street lamps and trees,
  generated from a seed (`?seed=N` replays the same city)
- **On foot and driving** — walk the streets, steal parked and traffic cars, or drive
  your own car
- **Traffic and pedestrians** — cars cruise the roads, people walk the sidewalks
- **Wanted level and police** — commit crimes and police cars chase you; stay clean
  and the heat cools off
- **Three missions** — a pickup, a timed delivery, and a police escape, with a
  gold beacon marking each objective
- **Combat** — punch pedestrians (the police will notice)
- **HUD** — health, crew cash, wanted stars, speed, mission objective, and a live
  minimap
- **Save / load** — progress (cash, health, mission) is saved to localStorage;
  continue from the title screen
- **Procedural sound** — WebAudio engine hum, police siren, impacts, and a looping
  bass line; no audio files

## Tech

- `game/index.html` + `game/src/*.js` — the game (ES modules, no build step)
- `game/vendor/three.module.min.js` — three.js r160, vendored locally; the game
  makes zero network requests
- `main.ts` — Node 22 program that assembles `game/` and `screenshots/` into an
  output dossier (see the kit's starter for the plumbing)

## Screenshots

Staged with `?shot=start|drive|chase|mission&seed=1` — each frame is the real game
simulated forward from a fresh world, not a mock-up.
