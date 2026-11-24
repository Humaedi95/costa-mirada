// city.js — builds the original city of Costa Mirada with three.js.
// A 480x480 grid city: roads every 60 units, buildings in the blocks,
// a beach + ocean on the west edge, palms, parks, streetlights and a
// day/dusk/night sun. Exports collision boxes and road helpers used by
// traffic, police, missions and the player. Original code for this game.
import * as THREE from 'three';

export const CITY_HALF = 240;
export const ROAD_STEP = 60;
export const ROAD_WIDTH = 14;

const ROAD_COORDS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [
  0xf2e3c6, 0xe8b4a0, 0xf6d98a, 0xa8c8d8, 0xd8a0b0, 0xb8d8b0,
  0xe8e0d0, 0xc8b8e0, 0xf0c8a0, 0x9fc8c0, 0xd8d0b8, 0xe0a8a8,
];

export function districtAt(x, z) {
  if (x < -180) return 'Marina Bay';
  if (z < -120) return 'Palm Heights';
  if (z > 120) return 'Dockside';
  if (x > 120) return 'Sunset Strip';
  if (Math.abs(x) < 60 && Math.abs(z) < 60) return 'Old Town Plaza';
  return 'Old Town';
}

export function buildCity(scene, seed = 20261124) {
  const rand = mulberry(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---- ground: grass/concrete base, sand strip, ocean ----
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8a9a7a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-10, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 560),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a8 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-275, 0, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const oceanMat = new THREE.MeshLambertMaterial({ color: 0x1e6f9e });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(300, 560), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-460, -0.4, 0);
  group.add(ocean);

  // ---- roads (dark asphalt strips) + center dashes ----
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  for (const c of ROAD_COORDS) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + ROAD_WIDTH, ROAD_WIDTH), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.01, c); rx.receiveShadow = true;
    group.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, CITY_HALF * 2 + ROAD_WIDTH), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(c, 0.01, 0); rz.receiveShadow = true;
    group.add(rz);
    for (let d = -CITY_HALF; d <= CITY_HALF; d += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.02, c);
      group.add(dash);
    }
  }

  // ---- sidewalks: light strips flanking every road ----
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (const c of ROAD_COORDS) {
    for (const off of [-9.5, 9.5]) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 5), walkMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(0, 0.005, c + off);
      group.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5, CITY_HALF * 2), walkMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(c + off, 0.005, 0);
      group.add(s2);
    }
  }

  // ---- buildings, one to four per block ----
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const winMat = new THREE.MeshLambertMaterial({ color: 0x223344, emissive: 0x0a1420 });
  const litWinMat = new THREE.MeshLambertMaterial({ color: 0xffd98a, emissive: 0xcc8822 });
  const litWindows = [];
  const buildingMats = PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c }));

  // Park / plaza blocks stay empty: (0,0) plaza, (-120,120) park, (120,-120) park.
  const emptyBlocks = new Set(['0,0', '-2,2', '2,-2']);
  let bIndex = 0;
  for (let bx = -4; bx < 4; bx++) {
    for (let bz = -4; bz < 4; bz++) {
      const key = `${bx},${bz}`;
      const x0 = bx * ROAD_STEP + ROAD_WIDTH / 2 + 3;
      const z0 = bz * ROAD_STEP + ROAD_WIDTH / 2 + 3;
      const x1 = (bx + 1) * ROAD_STEP - ROAD_WIDTH / 2 - 3;
      const z1 = (bz + 1) * ROAD_STEP - ROAD_WIDTH / 2 - 3;
      if (emptyBlocks.has(key)) {
        // Park: a few trees + a fountain disc in the plaza.
        const treeMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
        for (let t = 0; t < 6; t++) {
          const tx = x0 + rand() * (x1 - x0);
          const tz = z0 + rand() * (z1 - z0);
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 6),
            new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
          trunk.position.set(tx, 1.5, tz); group.add(trunk);
          const crown = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), treeMat);
          crown.position.set(tx, 4.4, tz); group.add(crown);
          colliders.push({ minX: tx - 0.6, maxX: tx + 0.6, minZ: tz - 0.6, maxZ: tz + 0.6 });
        }
        if (key === '0,0') {
          const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 20),
            new THREE.MeshLambertMaterial({ color: 0x9fc8d8 }));
          fountain.position.set(30, 0.6, 30); group.add(fountain);
          colliders.push({ minX: 22, maxX: 38, minZ: 22, maxZ: 38 });
        }
        continue;
      }
      const count = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const w = 12 + rand() * 16;
        const d = 12 + rand() * 16;
        const h = 8 + rand() * (rand() < 0.12 ? 42 : 22);
        const cx = x0 + w / 2 + rand() * Math.max(0.1, (x1 - x0) - w);
        const cz = z0 + d / 2 + rand() * Math.max(0.1, (z1 - z0) - d);
        const mat = buildingMats[bIndex % buildingMats.length];
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx, h / 2, cz);
        b.castShadow = true; b.receiveShadow = true;
        group.add(b);
        // Roof lip.
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
        roof.scale.set(w + 0.8, 0.8, d + 0.8);
        roof.position.set(cx, h + 0.4, cz);
        group.add(roof);
        // One row of lit windows on the front face (glow at dusk/night).
        // Kept to a single row per building to bound the draw-call count.
        const winRows = 1;
        for (let r = 0; r < winRows; r++) {
          for (let c2 = 0; c2 < 3; c2++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), rand() < 0.5 ? litWinMat : winMat);
            win.position.set(cx - w / 2 + (c2 + 0.5) * (w / 3), 3 + r * 5, cz + d / 2 + 0.06);
            group.add(win);
            litWindows.push(win);
          }
        }
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        bIndex++;
      }
    }
  }

  // ---- Rosa's garage (landmark, block x 0..60, z -60..0, low wide building) ----
  const garageMat = new THREE.MeshLambertMaterial({ color: 0xc85a3a });
  const garage = new THREE.Mesh(boxGeo, garageMat);
  garage.scale.set(26, 7, 18);
  garage.position.set(30, 3.5, -30);
  garage.castShadow = true; garage.receiveShadow = true;
  group.add(garage);
  const garageSign = new THREE.Mesh(new THREE.BoxGeometry(20, 2.4, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x664400 }));
  garageSign.position.set(30, 8.2, -20.6);
  group.add(garageSign);
  colliders.push({ minX: 17, maxX: 43, minZ: -39, maxZ: -21 });
  const garagePos = { x: 30, z: -8 }; // door front, on the road z=0 side

  // ---- palms along the beach road + a few on the strip ----
  const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const palmLeafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4a });
  const palmSpots = [];
  for (let z = -230; z <= 230; z += 30) palmSpots.push({ x: -228, z });
  for (let x = -180; x <= 180; x += 60) palmSpots.push({ x, z: -228 });
  for (const p of palmSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), palmTrunkMat);
    trunk.position.set(p.x, 3.5, p.z);
    trunk.rotation.z = (rand() - 0.5) * 0.12;
    group.add(trunk);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), palmLeafMat);
      const a = (l / 5) * Math.PI * 2;
      leaf.position.set(p.x + Math.cos(a) * 1.4, 7.2, p.z + Math.sin(a) * 1.4);
      leaf.rotation.z = Math.PI / 2.4 * Math.cos(a);
      leaf.rotation.x = -Math.PI / 2.4 * Math.sin(a);
      group.add(leaf);
    }
    colliders.push({ minX: p.x - 0.6, maxX: p.x + 0.6, minZ: p.z - 0.6, maxZ: p.z + 0.6 });
  }

  // ---- streetlights along main roads ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x000000 });
  const lamps = [];
  for (const c of [-180, -60, 60, 180]) {
    for (let d = -210; d <= 210; d += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 6), poleMat);
      pole.position.set(c + 10, 3.25, d);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat.clone());
      lamp.position.set(c + 10, 6.7, d);
      group.add(lamp);
      lamps.push(lamp);
    }
  }

  // ---- pier over the ocean (west edge) ----
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 8), pierMat);
  pier.position.set(-310, 0.6, 60);
  pier.castShadow = true;
  group.add(pier);
  colliders.push({ minX: -340, maxX: -280, minZ: 56, maxZ: 64 });

  // ---- lights: sun + hemisphere, driven by time of day ----
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.75);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0x9fc8e8, 320, 720);
  scene.background = new THREE.Color(0x87b8dd);

  let nightFactor = 0;
  function setTimeOfDay(h) {
    // h: 0..24. Sun elevation peaks at noon, sets ~18:30, night 20..6.
    const t = ((h - 6) / 12) * Math.PI; // 0 at 6:00, PI at 18:00
    const elev = Math.sin(t);
    const az = Math.cos(t);
    sun.position.set(az * 220, Math.max(8, elev * 220), 90);
    const day = THREE.MathUtils.clamp(elev, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev - 0.12) * 4, 0, 1) * (elev > -0.15 ? 1 : 0);
    nightFactor = THREE.MathUtils.clamp(1 - day * 1.4 - dusk * 0.4, 0, 1);
    sun.intensity = 0.25 + day * 1.5;
    sun.color.setHSL(0.08 + dusk * 0.02, 0.55, 0.55 + day * 0.25 - dusk * 0.1);
    hemi.intensity = 0.25 + day * 0.55;
    const sky = new THREE.Color();
    if (nightFactor > 0.6) sky.setHex(0x0a1626);
    else if (dusk > 0.4) sky.setHex(0xff8a4a);
    else sky.setHex(0x87b8dd);
    if (dusk > 0.2 && nightFactor < 0.6) sky.lerp(new THREE.Color(0xff9a5a), dusk * 0.6);
    scene.background = sky;
    scene.fog.color.copy(sky);
    for (const lamp of lamps) {
      lamp.material.emissive.setHex(nightFactor > 0.35 ? 0xffc860 : 0x000000);
    }
    for (const w of litWindows) {
      w.material = nightFactor > 0.35 ? litWinMat : winMat;
    }
    return { day, dusk, night: nightFactor };
  }

  return {
    group,
    colliders,
    roads: ROAD_COORDS,
    garagePos,
    spawnPos: { x: 0, z: 14 },
    beachPos: { x: -215, z: 60 },
    pierPos: { x: -300, z: 60 },
    plazaPos: { x: 30, z: 30 },
    setTimeOfDay,
    isNight: () => nightFactor > 0.5,
    // Nearest road coordinate on an axis (traffic snaps to roads).
    nearestRoad(v) {
      let best = ROAD_COORDS[0];
      for (const c of ROAD_COORDS) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
      return best;
    },
    // Push a circle (x,z,r) out of every building collider. Returns corrected pos.
    resolveCollision(x, z, r) {
      for (const c of colliders) {
        const nx = Math.max(c.minX, Math.min(x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - nx, dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * r;
            z = nz + (dz / d) * r;
          } else {
            // Center inside the box: push out along the smallest penetration axis.
            const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
            else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
          }
        }
      }
      // World bounds (ocean is walkable sand to x=-305, pier to -340).
      x = THREE.MathUtils.clamp(x, -338, 252);
      z = THREE.MathUtils.clamp(z, -252, 252);
      return { x, z };
    },
  };
}
