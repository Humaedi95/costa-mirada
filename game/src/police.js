// police.js — wanted stars + Costa Mirada police AI.
// Original code written for this game. Wanted 0..5: police cars spawn and
// chase, ram, and (on foot) try to bust the player. Lose them by hiding
// out of sight; a payphone-style "cool down" drains stars over time.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

export function createPolice(scene, city) {
  const group = new THREE.Group();
  group.name = 'police';
  scene.add(group);
  const cars = [];
  const cops = [];
  let wanted = 0;
  let heat = 0;          // 0..100, drives star count
  let loseTimer = 0;     // seconds out of sight while wanted
  let bustTimer = 0;

  function spawnCar(x, z) {
    const mesh = makeCarMesh(null, true);
    group.add(mesh);
    const car = {
      mesh, x, z, heading: 0, speed: 0, top: 33 + wanted * 1.5,
      sirenPhase: Math.random() * 10,
    };
    mesh.position.set(x, 0, z);
    cars.push(car);
    return car;
  }

  function spawnCop(x, z) {
    const mesh = makePersonMesh(0x1a2a5a, 0xc89878);
    // Police cap + badge: dark blue torso already; add a cap brim box.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x0a1428 }));
    cap.position.y = 1.82;
    mesh.add(cap);
    group.add(mesh);
    const cop = { mesh, x, z, heading: 0, speed: 3.4, punchCd: 0 };
    mesh.position.set(x, 0, z);
    cops.push(cop);
    return cop;
  }

  function desiredUnits() {
    if (wanted === 0) return 0;
    if (wanted <= 2) return wanted;      // 1-2 cars
    if (wanted <= 4) return wanted - 1;  // 2-3 cars
    return 4;
  }

  function addHeat(amount) {
    heat = THREE.MathUtils.clamp(heat + amount, 0, 100);
    const stars = heat <= 0 ? 0 : heat < 18 ? 1 : heat < 38 ? 2 : heat < 58 ? 3 : heat < 80 ? 4 : 5;
    if (stars !== wanted) wanted = stars;
  }

  return {
    get wanted() { return wanted; },
    get heat() { return heat; },
    addHeat,
    setWanted(n) { wanted = THREE.MathUtils.clamp(n, 0, 5); heat = n * 20; },
    clearWanted() { wanted = 0; heat = 0; loseTimer = 0; },
    cars, cops,
    update(dt, player, playerInCar, audio) {
      // Spawn / despawn to match wanted level.
      const want = desiredUnits();
      while (cars.length < want) {
        const a = Math.random() * Math.PI * 2;
        spawnCar(player.x + Math.cos(a) * 55, player.z + Math.sin(a) * 55);
      }
      while (cars.length > want) {
        const c = cars.pop();
        group.remove(c.mesh);
      }
      // On foot at 1-2 stars, a cop may chase on foot instead of a car.
      if (wanted >= 1 && !playerInCar && cops.length === 0 && cars.length > 0) {
        const c = cars[0];
        spawnCop(c.x + 3, c.z + 3);
      }
      if (playerInCar || wanted === 0) {
        while (cops.length) { const c = cops.pop(); group.remove(c.mesh); }
      }

      let anyClose = false;
      // Police cars: steer toward the player, ram on contact.
      for (const car of cars) {
        const dx = player.x - car.x, dz = player.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 90) anyClose = true;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += THREE.MathUtils.clamp(dh, -2.4 * dt, 2.4 * dt);
        const wantSpeed = dist > 8 ? car.top : car.top * 0.5;
        car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        const fixed = city.resolveCollision(nx, nz, 2.2);
        car.x = fixed.x; car.z = fixed.z;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        car.sirenPhase += dt;
        const bar = car.mesh.userData.lightBar;
        if (bar) {
          const on = Math.sin(car.sirenPhase * 9) > 0;
          bar.red.material.color.setHex(on ? 0xff2020 : 0x550000);
          bar.blue.material.color.setHex(on ? 0x101080 : 0x2040ff);
        }
        for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
        // Ram: if very close, damage the player / their car.
        if (dist < 3.4) {
          player.onPoliceRam?.(dt, car);
        }
      }
      // Foot cops: run at the player, punch, and bust if the player is slow.
      for (const cop of cops) {
        const dx = player.x - cop.x, dz = player.z - cop.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 90) anyClose = true;
        cop.heading = Math.atan2(dx, dz);
        cop.punchCd -= dt;
        if (dist > 1.6) {
          cop.x += Math.sin(cop.heading) * cop.speed * dt;
          cop.z += Math.cos(cop.heading) * cop.speed * dt;
        } else if (cop.punchCd <= 0) {
          cop.punchCd = 1.1;
          player.onCopPunch?.(8);
        }
        const fixed = city.resolveCollision(cop.x, cop.z, 0.5);
        cop.x = fixed.x; cop.z = fixed.z;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        // Busted: cop stays glued to a slow, hurt player for a while.
        if (dist < 2.2 && player.health < 45) {
          bustTimer += dt;
          if (bustTimer > 2.5) {
            bustTimer = 0;
            player.onBusted?.();
          }
        } else {
          bustTimer = Math.max(0, bustTimer - dt);
        }
      }
      // Wanted decay: out of sight for a while, stars drain.
      if (wanted > 0) {
        if (!anyClose) {
          loseTimer += dt;
          if (loseTimer > 6) {
            heat -= dt * 4;
            if (heat <= 0) { wanted = 0; heat = 0; }
            else {
              const stars = heat < 18 ? 1 : heat < 38 ? 2 : heat < 58 ? 3 : heat < 80 ? 4 : 5;
              wanted = stars;
            }
          }
        } else {
          loseTimer = 0;
        }
      }
      if (audio) audio.setSiren(cars.length > 0);
    },
    // Roadblock: two police cars parked across the road ahead (mission use).
    roadblock(x, z, heading) {
      const a = spawnCar(x - 4, z);
      const b = spawnCar(x + 4, z);
      a.heading = heading; b.heading = heading;
      a.speed = 0; b.speed = 0;
      return [a, b];
    },
    clearAll() {
      while (cars.length) { const c = cars.pop(); group.remove(c.mesh); }
      while (cops.length) { const c = cops.pop(); group.remove(c.mesh); }
      wanted = 0; heat = 0;
    },
  };
}
