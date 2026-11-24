// pedestrians.js — sidewalk walkers with simple wander + flee behavior.
// Original code written for this game. Low-poly capsule people, varied
// shirt colors, walk along sidewalks and cross roads at intersections.
import * as THREE from 'three';

const SHIRTS = [0xe85a5a, 0x5a8ae8, 0x5ac85a, 0xe8c85a, 0xc85ae8, 0x5ad8d8, 0xe8e8e8, 0x3a3a3a, 0xff8a3a];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x6a7a8a];

export function makePersonMesh(shirtColor, skinColor = 0xd8a078) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(Math.random() * PANTS.length)] });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.75, 0.26), pants);
  legs.position.y = 0.38; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), shirt);
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62; g.add(head);
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.36, 1.05, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.36, 1.05, 0); g.add(armR);
  g.userData.arms = [armL, armR];
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createPedestrians(scene, city, count = 26, seed = 99) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const group = new THREE.Group();
  group.name = 'pedestrians';
  scene.add(group);
  const peds = [];

  function spawnOne() {
    const mesh = makePersonMesh(SHIRTS[Math.floor(rnd() * SHIRTS.length)]);
    group.add(mesh);
    const road = city.roads[Math.floor(rnd() * city.roads.length)];
    const alongX = rnd() < 0.5;
    const ped = {
      mesh,
      x: alongX ? (rnd() * 2 - 1) * 230 : road + (rnd() < 0.5 ? -9.5 : 9.5),
      z: alongX ? road + (rnd() < 0.5 ? -9.5 : 9.5) : (rnd() * 2 - 1) * 230,
      heading: rnd() * Math.PI * 2,
      speed: 1.2 + rnd() * 1.1,
      walkPhase: rnd() * 10,
      flee: 0,
      alive: true,
      alongX,
    };
    mesh.position.set(ped.x, 0, ped.z);
    return ped;
  }
  for (let i = 0; i < count; i++) peds.push(spawnOne());

  return {
    peds,
    update(dt, dangerPos, dangerRadius = 0) {
      for (const p of peds) {
        if (!p.alive) continue;
        // Flee from gunfire / speeding cars.
        if (dangerPos && dangerRadius > 0) {
          const d = Math.hypot(p.x - dangerPos.x, p.z - dangerPos.z);
          if (d < dangerRadius) {
            p.flee = 2.5;
            p.heading = Math.atan2(p.x - dangerPos.x, p.z - dangerPos.z);
          }
        }
        let speed = p.speed;
        if (p.flee > 0) { p.flee -= dt; speed = 4.2; }
        p.x += Math.sin(p.heading) * speed * dt;
        p.z += Math.cos(p.heading) * speed * dt;
        p.walkPhase += dt * speed * 4;
        // Wander: occasionally change direction, stay in bounds.
        if (Math.abs(p.x) > 240 || Math.abs(p.z) > 240 || rnd() < dt * 0.08) {
          p.heading = rnd() * Math.PI * 2;
          p.x = THREE.MathUtils.clamp(p.x, -245, 245);
          p.z = THREE.MathUtils.clamp(p.z, -245, 245);
        }
        // Keep out of buildings.
        const fixed = city.resolveCollision(p.x, p.z, 0.5);
        p.x = fixed.x; p.z = fixed.z;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
        // Walk swing.
        const swing = Math.sin(p.walkPhase) * 0.5;
        p.mesh.userData.arms[0].rotation.x = swing;
        p.mesh.userData.arms[1].rotation.x = -swing;
        p.mesh.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.05;
      }
    },
    // Nearest living ped to a point (for punching / mission targets).
    nearest(x, z, maxDist = 3) {
      let best = null, bd = maxDist;
      for (const p of peds) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? { ped: best, dist: bd } : null;
    },
    remove(ped) {
      ped.alive = false;
      group.remove(ped.mesh);
      const i = peds.indexOf(ped);
      if (i >= 0) peds.splice(i, 1);
    },
    count() { return peds.length; },
  };
}
