// main.js — Costa Mirada boot + game loop.
// Original code written for this game. Wires city, traffic, pedestrians,
// police, missions, HUD, audio and save into one third-person open world.
// ?scene=cover|onfoot|mission|dusk stages a moment for screenshots and
// sets window.__shotReady when it has rendered. No network requests.
import * as THREE from 'three';
import { buildCity, districtAt } from './city.js';
import { createPlayerCar, createTraffic, makeCarMesh, CAR_MODELS } from './vehicles.js';
import { createPedestrians, makePersonMesh } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissionManager, MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';

const params = new URLSearchParams(window.location.search);
const sceneParam = params.get('scene') || params.get('shot') || null;

// ---------- renderer / scene ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, -20);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- world ----------
const city = buildCity(scene);
const traffic = createTraffic(scene, city, 14);
const peds = createPedestrians(scene, city, 26);
const police = createPolice(scene, city);
const hud = createHud();
const audio = createAudio();
const input = createInput(renderer.domElement);
const player = createPlayer(scene, city);

// ---------- game state ----------
const save = loadSave() || defaultSave();
const S = {
  screen: 'menu', // menu | playing | paused | dead | win
  mode: 'story',
  money: save.money,
  day: save.day,
  time: save.timeOfDay,
  health: save.health,
  inCar: false,
  car: null,           // player car object
  parked: [],          // abandoned player cars {mesh, model, x, z, heading, health}
  enemies: [],         // {mesh, x, z, hp, cd, shootCd, alive}
  chase: null,         // {mesh, x, z, heading, speed, alongX, road, dir, caught}
  passenger: null,     // {mesh, x, z}
  taxi: { state: 'idle', timer: 30, dropoff: null },
  cashPickups: [],
  tracers: [],
  lastDamageAt: -99,
  elapsed: 0,
  autosaveAt: 0,
  shotFrames: 0,
  camOffset: 0,        // mouse orbit offset while driving
  camYaw: Math.PI,
};

function saveNow() {
  // Never clobber story progress: in free roam (missionIndex -1) keep the
  // saved mission index and completed list, and union new completions in.
  const idx = missions.missionIndex;
  const done = new Set(save.completed || []);
  for (let i = 0; i < idx; i++) done.add(i);
  const completed = [...done].sort((a, b) => a - b);
  const mission = idx < 0 ? (save.mission || 0) : idx;
  writeSave({
    ...save,
    mission,
    money: S.money, health: player.health, ammo: player.ammo,
    day: S.day, timeOfDay: S.time,
    playerPos: { x: player.x, z: player.z },
    completed,
  });
  save.mission = mission;
  save.completed = completed;
  save.money = S.money;
}

// ---------- markers / pickups ----------
const markerRingGeo = new THREE.TorusGeometry(1.2, 0.12, 8, 24);
function spawnCashPickups() {
  const spots = [
    [60, 60], [-60, -120], [120, -60], [-120, 60], [180, 60],
    [-60, 120], [60, -180], [0, 240], [-180, -60], [240, 120],
  ];
  for (const [x, z] of spots) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 16),
      new THREE.MeshBasicMaterial({ color: 0x39d353 }));
    disc.position.y = 0.8;
    const ring = new THREE.Mesh(markerRingGeo, new THREE.MeshBasicMaterial({ color: 0x7dff8a }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.8;
    g.add(disc, ring);
    g.position.set(x, 0, z);
    scene.add(g);
    S.cashPickups.push({ mesh: g, x, z, taken: false });
  }
}
spawnCashPickups();

// ---------- missions ----------
const missions = createMissionManager({
  scene,
  setObjective: (name, text) => hud.setObjective(name, text),
  showDialog: (who, text) => hud.showDialog(who, text),
  toast: (t) => hud.toast(t),
  addMoney: (n) => {
    S.money += n;
    hud.toast(`+$${n} — mission pay`, 3000);
    audio.cash();
    saveNow();
  },
  setWanted: (n) => police.setWanted(n),
  getWanted: () => police.wanted,
  spawnEnemies: (x, z, count, radius) => spawnEnemies(x, z, count, radius || 10),
  spawnChaseCar: (x, z) => spawnChaseCar(x, z),
  spawnPassenger: (x, z) => spawnPassenger(x, z),
  removePassenger: () => removePassenger(),
  onMissionComplete: (idx, m) => {
    audio.missionComplete();
    hud.toast(`Mission complete: ${m.name} — $${m.reward}`, 4200);
    hud.setObjective('COSTA MIRADA', 'Mission complete! Next job coming up…');
    saveNow();
    // Brief breather, then the next mission starts automatically.
    setTimeout(() => {
      if (S.screen === 'playing' && S.mode === 'story') missions.startNext();
    }, 4500);
  },
  onStoryComplete: () => {
    S.screen = 'win';
    document.getElementById('win-text').textContent =
      `All 10 missions done. You earned $${S.money.toLocaleString('en-US')} and the whole city knows the name Leo Marín.`;
    document.getElementById('win-screen').classList.remove('hidden');
    hud.showHud(false);
    audio.missionComplete();
    saveNow();
  },
  onMissionFailed: (reason) => {
    audio.fail();
    hud.toast(`Mission failed: ${reason}`, 4000);
    hud.setObjective('COSTA MIRADA', 'Mission failed — press P, then Restart mission.');
  },
});

function spawnEnemies(x, z, count, radius) {
  clearEnemies();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const ex = x + Math.cos(a) * radius;
    const ez = z + Math.sin(a) * radius;
    const mesh = makePersonMesh(0x8a1a1a, 0xd8a078);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    gun.position.set(0.42, 1.05, 0.25);
    mesh.add(gun);
    mesh.position.set(ex, 0, ez);
    scene.add(mesh);
    S.enemies.push({ mesh, x: ex, z: ez, hp: 50, cd: 0, shootCd: 1 + i * 0.5, alive: true });
  }
}
function clearEnemies() {
  for (const e of S.enemies) scene.remove(e.mesh);
  S.enemies = [];
}

function spawnChaseCar(x, z) {
  if (S.chase) scene.remove(S.chase.mesh);
  const model = CAR_MODELS[5]; // Turbo GT, black
  const mesh = makeCarMesh(model);
  const road = city.nearestRoad(z);
  const chase = {
    mesh, model, x, z, heading: Math.PI / 2, speed: 20,
    alongX: true, road, along: x, dir: 1, caught: false,
    getPos() { return { x: chase.x, z: chase.z }; },
  };
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  S.chase = chase;
  return chase;
}

function spawnPassenger(x, z) {
  removePassenger();
  const mesh = makePersonMesh(0xe8c85a, 0xb07850);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  S.passenger = { mesh, x, z };
}
function removePassenger() {
  if (S.passenger) { scene.remove(S.passenger.mesh); S.passenger = null; }
}

// ---------- combat ----------
const raycaster = new THREE.Raycaster();
function addTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
  scene.add(line);
  S.tracers.push({ line, ttl: 0.09 });
}
function shootFrom(origin, dir, shooter) {
  raycaster.set(origin, dir);
  raycaster.far = 90;
  const targets = [];
  for (const e of S.enemies) if (e.alive) targets.push(e.mesh);
  for (const c of police.cars) targets.push(c.mesh);
  for (const c of police.cops) targets.push(c.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  let end = origin.clone().add(dir.clone().multiplyScalar(70));
  if (hits.length) {
    const hit = hits[0];
    end = hit.point.clone();
    // Walk up to the enemy / cop / police car owner.
    let obj = hit.object;
    while (obj && !obj.userData.owner) obj = obj.parent;
    const owner = obj?.userData.owner;
    if (owner?.kind === 'enemy') damageEnemy(owner.ref, 34);
    else if (owner?.kind === 'cop') { police.addHeat(25); hud.toast('You shot a cop! +wanted'); }
    else if (owner?.kind === 'policeCar') police.addHeat(15);
  }
  addTracer(origin, end);
  audio.shoot();
}
// Tag meshes with owners for raycast hits.
function tagEnemies() {
  for (const e of S.enemies) e.mesh.userData.owner = { kind: 'enemy', ref: e };
  for (const c of police.cops) c.mesh.userData.owner = { kind: 'cop', ref: c };
  for (const c of police.cars) c.mesh.userData.owner = { kind: 'policeCar', ref: c };
}

function damageEnemy(e, dmg) {
  if (!e.alive) return;
  e.hp -= dmg;
  e.mesh.position.y = 0.15;
  setTimeout(() => { if (e.alive) e.mesh.position.y = 0; }, 90);
  if (e.hp <= 0) {
    e.alive = false;
    scene.remove(e.mesh);
    S.enemies = S.enemies.filter((x) => x !== e);
    missions.reportKill();
    if (Math.random() < 0.5) { player.ammo += 6; hud.toast('+6 ammo'); }
    S.money += 20;
    audio.pickup();
  }
}

function punchTarget() {
  // Nearest damageable thing in front of the player, within 2.4m.
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  let best = null, bd = 2.6;
  const consider = (x, z, ref, kind) => {
    const dx = x - player.x, dz = z - player.z;
    const d = Math.hypot(dx, dz);
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (d < bd && dot > 0.2) { bd = d; best = { ref, kind }; }
  };
  for (const e of S.enemies) if (e.alive) consider(e.x, e.z, e, 'enemy');
  for (const p of peds.peds) consider(p.x, p.z, p, 'ped');
  for (const c of police.cops) consider(c.x, c.z, c, 'cop');
  audio.punch();
  if (!best) return;
  if (best.kind === 'enemy') damageEnemy(best.ref, 26);
  else if (best.kind === 'ped') {
    peds.remove(best.ref);
    police.addHeat(12);
    hud.toast('Hey! Watch it!');
  } else if (best.kind === 'cop') {
    police.addHeat(25);
    hud.toast('You hit a cop!');
  }
}

// ---------- cars: steal / exit / parked ----------
function nearestStealable() {
  let best = null, bd = 5.5;
  const near = traffic.nearest(player.x, player.z, bd);
  if (near) { best = { kind: 'traffic', car: near.car, dist: near.dist }; bd = near.dist; }
  for (const p of S.parked) {
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < bd) { bd = d; best = { kind: 'parked', car: p, dist: d }; }
  }
  return best;
}

function enterCar() {
  const target = nearestStealable();
  if (!target) return;
  let model, x, z, heading;
  if (target.kind === 'traffic') {
    model = target.car.model; x = target.car.x; z = target.car.z; heading = target.car.heading;
    traffic.remove(target.car);
    police.addHeat(12);
    S.money += 0;
    hud.toast('Car stolen! The cops noticed…');
    save.carsStolen = (save.carsStolen || 0) + 1;
  } else {
    model = target.car.model; x = target.car.x; z = target.car.z; heading = target.car.heading;
    scene.remove(target.car.mesh);
    S.parked = S.parked.filter((p) => p !== target.car);
  }
  S.car = createPlayerCar(scene, model, x, z, heading);
  S.inCar = true;
  player.mesh.visible = false;
  audio.unlock();
  input.lockPointer();
}

function exitCar() {
  if (!S.car) return;
  const car = S.car;
  const sideX = car.x + Math.cos(car.heading) * 2.4;
  const sideZ = car.z - Math.sin(car.heading) * 2.4;
  const fixed = city.resolveCollision(sideX, sideZ, 0.6);
  player.x = fixed.x; player.z = fixed.z;
  player.heading = car.heading;
  player.camYaw = car.heading;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  // Leave the car parked where it is; it can be re-entered.
  S.parked.push({ mesh: car.mesh, model: car.model, x: car.x, z: car.z, heading: car.heading });
  S.car = null;
  S.inCar = false;
  input.unlockPointer();
}

function spawnParkedStarters() {
  const spots = [
    { model: CAR_MODELS[1], x: 8, z: 0, heading: Math.PI / 2 },
    { model: CAR_MODELS[0], x: -8, z: -60, heading: 0 },
    { model: CAR_MODELS[3], x: -210, z: 120, heading: Math.PI },
  ];
  for (const s of spots) {
    const mesh = makeCarMesh(s.model);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.heading;
    scene.add(mesh);
    S.parked.push({ mesh, model: s.model, x: s.x, z: s.z, heading: s.heading });
  }
}
spawnParkedStarters();

// ---------- screens ----------
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const deadScreen = document.getElementById('dead-screen');
const winScreen = document.getElementById('win-screen');

function fillMissionList() {
  const done = save.completed || [];
  const html = MISSIONS.map((m, i) =>
    `<div>${done.includes(i) || i < (save.mission || 0) ? '✓' : `${i + 1}.`} ${m.name} — $${m.reward}</div>`).join('');
  document.getElementById('mission-list').innerHTML = `<b>10 STORY MISSIONS</b><br>${html}`;
}
fillMissionList();
const hasSave = !!loadSave() && (loadSave().mission > 0 || loadSave().money > 250);
document.getElementById('btn-continue').style.display = hasSave ? '' : 'none';

function showScreen(name) {
  startScreen.classList.toggle('hidden', name !== 'menu');
  pauseScreen.classList.toggle('hidden', name !== 'paused');
  deadScreen.classList.toggle('hidden', name !== 'dead');
  winScreen.classList.toggle('hidden', name !== 'win');
  hud.showHud(name === 'playing');
  if (name !== 'playing') input.unlockPointer();
}

function startGame(mode) {
  S.mode = mode;
  S.screen = 'playing';
  audio.unlock();
  audio.startMusic();
  showScreen('playing');
  player.reset(save.playerPos?.x ?? city.spawnPos.x, save.playerPos?.z ?? city.spawnPos.z);
  player.health = save.health || 100;
  player.ammo = save.ammo ?? 24;
  S.money = save.money ?? 250;
  S.day = save.day || 1;
  S.time = save.timeOfDay ?? 12;
  S.health = player.health;
  if (mode === 'story') {
    missions.startMission(save.mission || 0);
  } else if (mode === 'continue') {
    if ((save.mission || 0) < 10) missions.startMission(save.mission || 0);
    else hud.setObjective('COSTA MIRADA', 'Story complete — free roam. Enjoy the city!');
  } else {
    missions.stop();
    hud.setObjective('COSTA MIRADA', 'Free roam — explore, steal cars, lose the cops.');
  }
  hud.setCash(S.money);
  hud.setHealth(player.health);
  input.lockPointer();
}

document.getElementById('btn-start').addEventListener('click', () => {
  clearSave();
  save.mission = 0; save.money = 250; save.completed = [];
  startGame('story');
});
document.getElementById('btn-continue').addEventListener('click', () => startGame('continue'));
document.getElementById('btn-freeroam').addEventListener('click', () => startGame('freeroam'));
document.getElementById('btn-resume').addEventListener('click', () => {
  S.screen = 'playing'; showScreen('playing'); input.lockPointer();
});
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  clearEnemies();
  police.clearAll();
  player.health = 100;
  S.screen = 'playing';
  showScreen('playing');
  missions.restartCurrent();
});
document.getElementById('btn-quit-menu').addEventListener('click', () => {
  saveNow();
  S.screen = 'menu';
  fillMissionList();
  showScreen('menu');
});
document.getElementById('btn-retry').addEventListener('click', () => {
  player.health = 100;
  player.reset(city.garagePos.x, city.garagePos.z + 6);
  police.clearAll();
  S.screen = 'playing';
  showScreen('playing');
});
document.getElementById('btn-dead-menu').addEventListener('click', () => {
  saveNow(); S.screen = 'menu'; showScreen('menu');
});
document.getElementById('btn-win-freeroam').addEventListener('click', () => {
  missions.stop();
  S.screen = 'playing';
  showScreen('playing');
  hud.setObjective('COSTA MIRADA', 'Story complete — free roam. Enjoy the city!');
});
document.getElementById('btn-win-menu').addEventListener('click', () => {
  saveNow(); S.screen = 'menu'; showScreen('menu');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.screen === 'playing' && !sceneParam) {
    S.screen = 'paused';
    document.getElementById('pause-stats').textContent =
      `Mission ${missions.missionIndex + 1}/10 · $${S.money} · Day ${S.day}`;
    showScreen('paused');
  }
});
renderer.domElement.addEventListener('click', () => {
  if (S.screen === 'playing' && !S.inCar) input.lockPointer();
});

// ---------- per-frame updates ----------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
let smoothCamPos = new THREE.Vector3(0, 8, -20);

function updateCamera(dt) {
  const px = S.inCar && S.car ? S.car.x : player.x;
  const pz = S.inCar && S.car ? S.car.z : player.z;
  let yaw;
  if (S.inCar && S.car) {
    // Chase cam behind the car; mouse adds a temporary orbit offset.
    const m = input.takeMouse();
    S.camOffset = THREE.MathUtils.clamp(S.camOffset - m.dx * 0.003, -1.2, 1.2);
    S.camOffset *= Math.pow(0.4, dt); // decay back to center
    yaw = S.car.heading + S.camOffset;
  } else {
    yaw = player.camYaw;
  }
  const dist = S.inCar ? 13.5 : 9;
  const height = S.inCar ? 5.2 : 4.2;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  camTarget.set(px - fx * dist, height, pz - fz * dist);
  smoothCamPos.lerp(camTarget, Math.min(1, dt * 6));
  camera.position.copy(smoothCamPos);
  camera.lookAt(px + fx * 5, 1.8, pz + fz * 5);
}

function updatePlaying(dt) {
  S.elapsed += dt;
  S.time += dt / 90; // 1 game hour per 90 real seconds
  if (S.time >= 24) { S.time -= 24; S.day += 1; }
  city.setTimeOfDay(S.time);

  const pressed = input.takePressed();
  if (pressed.has('pause')) {
    S.screen = 'paused';
    document.getElementById('pause-stats').textContent =
      `Mission ${Math.min(10, missions.missionIndex + 1)}/10 · $${S.money} · Day ${S.day} · ${districtAt(player.x, player.z)}`;
    showScreen('paused');
    saveNow();
    return;
  }
  if (pressed.has('mute')) {
    const m = audio.toggleMute();
    hud.toast(m ? 'Sound muted' : 'Sound on');
  }
  if (pressed.has('horn') && S.inCar) audio.horn();

  // Enter / exit car.
  if (pressed.has('enter')) {
    if (S.inCar) exitCar();
    else enterCar();
  }
  if (pressed.has('respawn') && S.inCar && S.car) {
    S.car.x = city.nearestRoad(S.car.x);
    S.car.z = city.nearestRoad(S.car.z);
    S.car.speed = 0;
  }

  // Player / car.
  let speedKmh = 0;
  if (S.inCar && S.car) {
    S.car.update(dt, input, city, (impactSpeed) => {
      audio.crash();
      player.health -= 1;
    });
    speedKmh = S.car.speed * 3.6;
    // Run over pedestrians while speeding.
    if (Math.abs(S.car.speed) > 6) {
      const hit = peds.nearest(S.car.x, S.car.z, 2.4);
      if (hit) {
        peds.remove(hit.ped);
        police.addHeat(15);
        audio.crash();
        hud.toast('You hit a pedestrian!');
      }
    }
    if (S.car.health <= 0) {
      hud.toast('Your car is wrecked!');
      audio.crash();
      exitCar();
    }
  } else {
    player.update(dt, input, city, {
      onPunch: () => punchTarget(),
      onShoot: () => {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const origin = camera.position.clone();
        shootFrom(origin, dir, player);
        police.addHeat(6);
      },
    }, pressed);
  }

  // Police callbacks (ram / punch / busted).
  player.onPoliceRam = (dt2, car) => {
    if (S.inCar && S.car) {
      S.car.health -= 12 * dt2;
      S.car.speed *= 0.98;
    } else {
      if (player.takeDamage(14 * dt2)) die();
    }
  };
  player.onCopPunch = (dmg) => {
    audio.punch();
    if (player.takeDamage(dmg)) die();
  };
  player.onBusted = () => {
    S.money = Math.max(0, S.money - 150);
    hud.toast('BUSTED! You lost $150 bail.', 4000);
    police.clearAll();
    player.reset(city.garagePos.x, city.garagePos.z + 6);
    player.health = 100;
    saveNow();
  };

  // World systems.
  const playerPos = { x: S.inCar && S.car ? S.car.x : player.x, z: S.inCar && S.car ? S.car.z : player.z };
  traffic.update(dt, playerPos, S.inCar && S.car ? S.car.speed : 0);
  // Pedestrians flee only while a fight is actually happening nearby.
  const danger = S.enemies.length ? playerPos : null;
  peds.update(dt, danger, danger ? 26 : 0);
  police.update(dt, {
    ...playerPos,
    health: player.health,
    onPoliceRam: player.onPoliceRam,
    onCopPunch: player.onCopPunch,
    onBusted: player.onBusted,
  }, S.inCar, audio);
  tagEnemies();

  // Enemies AI.
  for (const e of [...S.enemies]) {
    if (!e.alive) continue;
    const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
    const dist = Math.hypot(dx, dz);
    e.cd -= dt; e.shootCd -= dt;
    if (dist < 34) {
      const heading = Math.atan2(dx, dz);
      if (dist > 2) {
        e.x += Math.sin(heading) * 3.4 * dt;
        e.z += Math.cos(heading) * 3.4 * dt;
        const fixed = city.resolveCollision(e.x, e.z, 0.5);
        e.x = fixed.x; e.z = fixed.z;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = heading;
      if (dist < 2.1 && e.cd <= 0) {
        e.cd = 1.1;
        audio.punch();
        if (player.takeDamage(7)) die();
      } else if (dist > 7 && dist < 26 && e.shootCd <= 0 && !S.inCar) {
        e.shootCd = 2.2;
        const from = new THREE.Vector3(e.x, 1.3, e.z);
        const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
        addTracer(from, to);
        audio.shoot();
        if (Math.random() < 0.45 && player.takeDamage(5)) die();
      }
    }
  }

  // Chase car AI: flee along roads away from the player.
  if (S.chase && !S.chase.caught) {
    const c = S.chase;
    const awayX = c.x - playerPos.x, awayZ = c.z - playerPos.z;
    const wantAlongX = Math.abs(awayX) > Math.abs(awayZ);
    if (wantAlongX !== c.alongX) {
      c.alongX = wantAlongX;
      c.road = wantAlongX ? city.nearestRoad(c.z) : city.nearestRoad(c.x);
      c.along = wantAlongX ? c.x : c.z;
      c.dir = wantAlongX ? Math.sign(awayX) || 1 : Math.sign(awayZ) || 1;
    }
    c.speed = 22;
    c.along += c.dir * c.speed * dt;
    if (c.along > 245) c.along = -245;
    if (c.along < -245) c.along = 245;
    if (c.alongX) { c.x = c.along; c.z = c.road + 3.2; c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { c.x = c.road + 3.2; c.z = c.along; c.heading = c.dir > 0 ? 0 : Math.PI; }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }

  // Cash pickups.
  for (const pk of S.cashPickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt;
    pk.mesh.position.y = Math.sin(S.elapsed * 2 + pk.x) * 0.15;
    if (Math.hypot(playerPos.x - pk.x, playerPos.z - pk.z) < 2.6) {
      pk.taken = true;
      pk.mesh.visible = false;
      S.money += 50;
      audio.pickup();
      hud.toast('+$50 cash found!');
    }
  }

  // Taxi side activity (free roam only).
  if (S.mode === 'freeroam' || !missions.active) {
    if (S.taxi.state === 'idle') {
      S.taxi.timer -= dt;
      if (S.taxi.timer <= 0 && !S.passenger) {
        spawnPassenger(30, 30);
        S.taxi.state = 'waiting';
        hud.toast('Taxi fare waiting at Old Town Plaza!');
      }
    } else if (S.taxi.state === 'waiting') {
      if (S.inCar && Math.hypot(playerPos.x - 30, playerPos.z - 30) < 7) {
        removePassenger();
        S.taxi.state = 'driving';
        const spots = [{ x: 180, z: -180 }, { x: -215, z: -120 }, { x: 120, z: 180 }];
        S.taxi.dropoff = spots[Math.floor(Math.random() * spots.length)];
        hud.toast('Passenger aboard — drive to the marker!');
        audio.pickup();
      }
    } else if (S.taxi.state === 'driving' && S.taxi.dropoff) {
      if (S.inCar && Math.hypot(playerPos.x - S.taxi.dropoff.x, playerPos.z - S.taxi.dropoff.z) < 8) {
        S.money += 120;
        audio.cash();
        hud.toast('+$120 taxi fare!');
        S.taxi.state = 'idle';
        S.taxi.timer = 45;
        S.taxi.dropoff = null;
      }
    }
  }

  // Tracers fade.
  for (const t of [...S.tracers]) {
    t.ttl -= dt;
    t.line.material.opacity = Math.max(0, t.ttl / 0.09);
    if (t.ttl <= 0) { scene.remove(t.line); S.tracers = S.tracers.filter((x) => x !== t); }
  }

  // Health regen when calm.
  if (police.wanted === 0 && S.elapsed - S.lastDamageAt > 6 && player.health < 100 && player.health > 0) {
    player.health = Math.min(100, player.health + 2 * dt);
  }

  // Missions.
  missions.update(dt, {
    x: playerPos.x, z: playerPos.z, inCar: S.inCar,
  });

  // Engine sound.
  audio.setEngine(S.inCar && S.car ? Math.abs(S.car.speed) / 40 : 0, S.inCar);

  // HUD.
  hud.setWanted(police.wanted);
  hud.setCash(S.money);
  hud.setClock(S.day, S.time);
  hud.setHealth(player.health);
  hud.setSpeed(speedKmh, S.inCar && S.car ? S.car.model.name : '');
  hud.setAmmo(player.ammo, !S.inCar);
  hud.showCrosshair(!S.inCar);
  hud.setObjective(missions.currentName(), missions.currentText());
  const marker = missions.markerPos();
  const dist = marker ? Math.round(Math.hypot(playerPos.x - marker.x, playerPos.z - marker.z)) : 0;
  const taxiMark = S.taxi.state === 'driving' ? S.taxi.dropoff : (S.taxi.state === 'waiting' ? { x: 30, z: 30 } : null);
  hud.setObjectiveDist(marker ? `${dist}m to objective · ${districtAt(playerPos.x, playerPos.z)}`
    : taxiMark ? `${Math.round(Math.hypot(playerPos.x - taxiMark.x, playerPos.z - taxiMark.z))}m to taxi fare · ${districtAt(playerPos.x, playerPos.z)}`
    : districtAt(playerPos.x, playerPos.z));
  const near = S.inCar ? null : nearestStealable();
  hud.showInteract(near ? 'Press E — steal car' : null);
  hud.drawMinimap({
    playerX: playerPos.x, playerZ: playerPos.z,
    heading: S.inCar && S.car ? S.car.heading : player.camYaw,
    marker: marker || taxiMark,
    police: police.cars.map((c) => ({ x: c.x, z: c.z })),
    traffic: traffic.cars.slice(0, 14).map((c) => ({ x: c.x, z: c.z })),
    enemies: S.enemies.map((e) => ({ x: e.x, z: e.z })),
    chase: S.chase && !S.chase.caught ? { x: S.chase.x, z: S.chase.z } : null,
    passenger: S.passenger ? { x: S.passenger.x, z: S.passenger.z } : null,
  });

  updateCamera(dt);

  // Autosave.
  if (S.elapsed - S.autosaveAt > 20) { S.autosaveAt = S.elapsed; saveNow(); }
  if (S.screen === 'playing' && sceneParam) {
    S.shotFrames++;
    if (S.shotFrames > 100) window.__shotReady = true;
  }
}

function die() {
  if (S.screen !== 'playing') return;
  S.lastDamageAt = S.elapsed;
  S.screen = 'dead';
  S.money = Math.max(0, S.money - 100);
  document.getElementById('dead-text').textContent =
    `The streets of Costa Mirada got the better of you. You lost $100 at the hospital.`;
  showScreen('dead');
  audio.fail();
  police.clearAll();
  saveNow();
}

// ---------- screenshot staging ----------
function stageScene(name) {
  // Start a real game, then pose it for the shot.
  startGame('freeroam');
  S.screen = 'playing';
  showScreen('playing');
  document.getElementById('loading').classList.add('hidden');
  const placeCar = (modelIdx, x, z, heading) => {
    if (S.car) { scene.remove(S.car.mesh); S.car = null; }
    S.car = createPlayerCar(scene, CAR_MODELS[modelIdx], x, z, heading);
    S.inCar = true;
    player.mesh.visible = false;
  };
  if (name === 'cover' || name === 'play') {
    // High-speed chase: wanted 3 stars, police on the tail, mission live.
    placeCar(5, 0, -40, 0);
    S.car.speed = 26;
    S.time = 16.5;
    police.setWanted(3);
    missions.startMission(3); // Hot Pursuit — chase marker visible
    player.camYaw = 0;
  } else if (name === 'onfoot') {
    player.reset(30, 44, Math.PI * 0.15);
    player.camYaw = Math.PI * 0.15;
    S.time = 12.0;
    hud.setObjective('COSTA MIRADA', 'Free roam — explore Costa Mirada.');
  } else if (name === 'mission') {
    player.reset(-200, 78, Math.PI * 0.4);
    player.camYaw = Math.PI * 0.4;
    S.time = 15.0;
    missions.startMission(4); // Beach Brawl — enemies on the sand
    player.ammo = 60;
  } else if (name === 'dusk' || name === 'end') {
    placeCar(0, -180, 60, Math.PI / 2);
    S.car.speed = 18;
    S.time = 18.6;
    police.setWanted(1);
    hud.setObjective('COSTA MIRADA', 'Sunset drive along Marina Bay.');
  }
  city.setTimeOfDay(S.time);
  hud.setWanted(police.wanted);
  hud.setCash(S.money);
  hud.setClock(S.day, S.time);
  hud.setHealth(player.health);
  updateCamera(0.5);
}

// ---------- main loop ----------
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (S.screen === 'playing') updatePlaying(dt);
  else if (S.screen === 'menu') {
    // Slow cinematic orbit behind the menu.
    S.time += dt / 240;
    city.setTimeOfDay(S.time);
    const t = performance.now() * 0.00004;
    camera.position.set(Math.sin(t) * 130, 55, Math.cos(t) * 130);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
}

// ---------- boot ----------
document.getElementById('loading').classList.add('hidden');
if (sceneParam) {
  const map = { start: 'onfoot', play: 'cover', end: 'dusk' };
  stageScene(map[sceneParam] || sceneParam);
} else {
  S.screen = 'menu';
  showScreen('menu');
}
city.setTimeOfDay(S.time);
requestAnimationFrame(frame);
