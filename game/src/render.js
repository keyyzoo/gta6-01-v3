// Three.js rendering: builds the Neon Bay city once, then syncs meshes to the world
// state every frame. No game rules live here.
import * as THREE from 'three';
import { BLOCK, CITY, GRID, PALETTE, PITCH } from './config.js';

function windowTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const lit = ((x * 7 + y * 13 + seed * 31) % 10) < 4;
      g.fillStyle = lit ? '#ffd76a' : '#20263d';
      g.fillRect(x, y, 7, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(canvas, minimapCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 320);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0x8fa3ff, 0x1a1410, 0.9));
  const sun = new THREE.DirectionalLight(0xffe0b3, 1.1);
  sun.position.set(80, 120, 40);
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x6a7dff, 0.35);
  moon.position.set(-60, 80, -80);
  scene.add(moon);

  const texA = windowTexture(1);
  const texB = windowTexture(5);
  const texC = windowTexture(9);

  // ---- static city ----
  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 80, CITY * 2 + 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  for (let i = -GRID - 1; i <= GRID; i += 1) {
    const line = i * PITCH + PITCH / 2;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 40, 14), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, line);
    scene.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(14, CITY * 2 + 40), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(line, 0.02, 0);
    scene.add(v);
    // Centre dashes.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x8a8f9e });
    for (let d = -CITY; d < CITY; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.04, line);
      scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(line, 0.04, d);
      scene.add(dash2);
    }
  }

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 2, 0.3, BLOCK + 2), sidewalkMat);
      slab.position.set(i * PITCH, 0.15, j * PITCH);
      scene.add(slab);
    }
  }

  let buildingMeshes = [];
  function buildBuildings(buildings) {
    for (const b of buildings) {
      const tex = [texA, texB, texC][b.h % 3];
      const mat = new THREE.MeshLambertMaterial({ color: b.color, map: tex });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.h / 2 + 0.3, b.z);
      scene.add(mesh);
      buildingMeshes.push(mesh);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.6, 0.5, b.d + 0.6),
        new THREE.MeshLambertMaterial({ color: 0x14161f }),
      );
      roof.position.set(b.x, b.h + 0.55, b.z);
      scene.add(roof);
      buildingMeshes.push(roof);
    }
  }

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x22242e });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  function buildProps(lamps, trees) {
    for (const l of lamps) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), lampMat);
      pole.position.set(l.x, 2.5, l.z);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlowMat);
      bulb.position.set(l.x, 5.1, l.z);
      scene.add(bulb);
    }
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x1e6b34 });
    for (const t of trees) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), trunkMat);
      trunk.position.set(t.x, 1.1, t.z);
      scene.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 7), leafMat);
      leaves.position.set(t.x, 3.2, t.z);
      scene.add(leaves);
    }
  }

  // ---- dynamic objects ----
  const carGroups = new Map();
  function makeCarMesh(color, isPolice) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.0),
      new THREE.MeshLambertMaterial({ color: 0x10131f }),
    );
    cabin.position.set(0, 1.15, -0.2);
    g.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
    }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    for (const wx of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
      hl.position.set(wx, 0.6, 2.22);
      g.add(hl);
    }
    if (isPolice) {
      const bar = new THREE.Group();
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.x = -0.4;
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      blue.position.x = 0.4;
      bar.add(red); bar.add(blue);
      bar.position.y = 1.6;
      bar.name = 'lightbar';
      g.add(bar);
    }
    return g;
  }

  function syncCars(cars) {
    const seen = new Set();
    for (const car of cars) {
      seen.add(car.id);
      let g = carGroups.get(car.id);
      if (!g) {
        g = makeCarMesh(car.color, car.kind === 'police');
        scene.add(g);
        carGroups.set(car.id, g);
      }
      g.position.set(car.x, 0, car.z);
      g.rotation.y = car.angle;
      const bar = g.getObjectByName('lightbar');
      if (bar) bar.visible = Math.floor(performance.now() / 250) % 2 === 0;
    }
    for (const [id, g] of carGroups) {
      if (!seen.has(id)) { scene.remove(g); carGroups.delete(id); }
    }
  }

  // Player: yellow-jacket courier.
  const playerGroup = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 4, 8), new THREE.MeshLambertMaterial({ color: PALETTE.player }));
  pBody.position.y = 1.05;
  playerGroup.add(pBody);
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  pHead.position.y = 2.0;
  playerGroup.add(pHead);
  const pCap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  pCap.position.y = 2.22;
  playerGroup.add(pCap);
  scene.add(playerGroup);

  // Pedestrians: one mesh each, recoloured per ped.
  const pedMeshes = [];
  function buildPeds(peds) {
    for (const p of peds) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.8, 4, 8), new THREE.MeshLambertMaterial({ color: p.color }));
      body.position.y = 0.95;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc98d5f }));
      head.position.y = 1.8;
      g.add(head);
      scene.add(g);
      pedMeshes.push(g);
    }
  }
  function syncPeds(peds) {
    for (let i = 0; i < peds.length && i < pedMeshes.length; i += 1) {
      const p = peds[i];
      const g = pedMeshes[i];
      if (p.downTimer > 0) {
        g.rotation.z = Math.PI / 2;
        g.position.set(p.x, 0.35, p.z);
      } else {
        g.rotation.z = 0;
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.angle;
        g.position.y = Math.abs(Math.sin(p.x * 2 + p.z * 2)) * 0.05;
      }
    }
  }

  // Cash pickups: small spinning green bundles.
  const pickupMeshes = [];
  const pickupMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x1a7a3a });
  function buildPickups(pickups) {
    for (const pk of pickups) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.6), pickupMat);
      m.position.set(pk.x, 0.5, pk.z);
      scene.add(m);
      pickupMeshes.push(m);
    }
  }

  // Mission beacon: gold column + ring at the target.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 8, 26);
  let firstFrame = true;

  function sync(world, dt, time) {
    syncCars(world.cars);
    syncPeds(world.peds);
    const p = world.state.player;
    if (p.inCar !== null) {
      playerGroup.visible = false;
    } else {
      playerGroup.visible = true;
      playerGroup.position.set(p.x, 0, p.z);
      playerGroup.rotation.y = p.angle;
      playerGroup.position.y = p.moving ? Math.abs(Math.sin(time * 10)) * 0.08 : 0;
    }
    for (let i = 0; i < world.pickups.length; i += 1) {
      const pk = world.pickups[i];
      const m = pickupMeshes[i];
      if (!m) continue;
      m.visible = !pk.taken;
      if (!pk.taken) { m.rotation.y = time * 2 + i; m.position.y = 0.5 + Math.sin(time * 3 + i) * 0.15; }
    }
    const mission = world.state.mission;
    if (mission) {
      beacon.visible = true;
      ring.visible = true;
      beacon.position.set(mission.target.x, 15, mission.target.z);
      ring.position.set(mission.target.x, 0.3 + Math.sin(time * 2) * 0.2, mission.target.z);
      ring.rotation.z = time * 0.8;
    } else {
      beacon.visible = false;
      ring.visible = false;
    }
    // Chase camera behind the player's facing.
    const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
    const dist = p.inCar !== null ? 13.5 : 10.5;
    const height = p.inCar !== null ? 7 : 6;
    const wantPos = new THREE.Vector3(p.x - fx * dist, height, p.z - fz * dist);
    const wantLook = new THREE.Vector3(p.x + fx * 5, 1.6, p.z + fz * 5);
    if (firstFrame) { camPos.copy(wantPos); camTarget.copy(wantLook); firstFrame = false; }
    const k = 1 - Math.exp(-5 * dt);
    camPos.lerp(wantPos, k);
    camTarget.lerp(wantLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }

  // ---- 2D minimap ----
  const mm = minimapCanvas.getContext('2d');
  function drawMinimap(world) {
    const S = 180;
    const scale = S / (CITY * 2 + 30);
    const toX = (x) => (x + CITY + 15) * scale;
    const toZ = (z) => (z + CITY + 15) * scale;
    mm.fillStyle = '#0d1020';
    mm.fillRect(0, 0, S, S);
    mm.strokeStyle = '#3a3f4d';
    mm.lineWidth = 5;
    for (let i = -GRID - 1; i <= GRID; i += 1) {
      const line = i * PITCH + PITCH / 2;
      mm.beginPath(); mm.moveTo(toX(-CITY - 15), toZ(line)); mm.lineTo(toX(CITY + 15), toZ(line)); mm.stroke();
      mm.beginPath(); mm.moveTo(toX(line), toZ(-CITY - 15)); mm.lineTo(toX(line), toZ(CITY + 15)); mm.stroke();
    }
    mm.fillStyle = '#2e4a6b';
    for (const b of world.buildings) mm.fillRect(toX(b.x - b.w / 2), toZ(b.z - b.d / 2), b.w * scale, b.d * scale);
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      mm.fillStyle = '#2ecc71';
      mm.fillRect(toX(pk.x) - 2, toZ(pk.z) - 2, 4, 4);
    }
    const mission = world.state.mission;
    if (mission) {
      mm.fillStyle = '#ffd23f';
      const mx = toX(mission.target.x), mz = toZ(mission.target.z);
      mm.beginPath();
      mm.moveTo(mx, mz - 7); mm.lineTo(mx + 6, mz); mm.lineTo(mx, mz + 7); mm.lineTo(mx - 6, mz);
      mm.closePath(); mm.fill();
    }
    mm.fillStyle = '#ffffff';
    for (const car of world.cars) {
      if (car.kind === 'traffic') mm.fillRect(toX(car.x) - 1.5, toZ(car.z) - 1.5, 3, 3);
    }
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    if (blink) {
      mm.fillStyle = '#2f6df6';
      for (const car of world.state.police) mm.fillRect(toX(car.x) - 2.5, toZ(car.z) - 2.5, 5, 5);
    }
    const p = world.state.player;
    mm.save();
    mm.translate(toX(p.x), toZ(p.z));
    mm.rotate(Math.atan2(Math.sin(p.angle), -Math.cos(p.angle)) + Math.PI);
    mm.fillStyle = '#ffd23f';
    mm.beginPath();
    mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(-5, 5);
    mm.closePath(); mm.fill();
    mm.restore();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { buildBuildings, buildProps, buildPeds, buildPickups, sync, drawMinimap };
}
