// vehicles.js — low-poly cars built from boxes, arcade driving physics
// for the player, and simple road-following AI for traffic.
// Original code written for this game. Units: meters, seconds.
import * as THREE from 'three';

const CAR_MODELS = [
  { name: 'Coral Coupe', color: 0xd84040, top: 34, accel: 16, grip: 2.6 },
  { name: 'Sunset Sedan', color: 0x3a6fd8, top: 30, accel: 14, grip: 2.4 },
  { name: 'Palm Taxi', color: 0xf2c230, top: 28, accel: 13, grip: 2.3 },
  { name: 'Beach Buggy', color: 0x40c8a0, top: 26, accel: 15, grip: 2.8 },
  { name: 'Night Van', color: 0x8a8a96, top: 24, accel: 11, grip: 2.0 },
  { name: 'Turbo GT', color: 0x222226, top: 40, accel: 19, grip: 3.0 },
  { name: 'Cream Cruiser', color: 0xf2e8d0, top: 27, accel: 12, grip: 2.2 },
];

export function makeCarMesh(model, isPolice = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a22 : model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.58, 2.1), glass);
  cabin.position.set(0, 1.12, -0.25); cabin.castShadow = true;
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.0), paint);
  hood.position.set(0, 0.9, 1.65);
  g.add(hood);
  // Headlights + taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    hl.position.set(sx, 0.62, 2.21); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
    tl.position.set(sx, 0.62, -2.21); g.add(tl);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.52, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.52),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.52, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.52),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.52, -0.25); g.add(blue);
    g.userData.lightBar = { red, blue };
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

// ---- Player-driven car: arcade bicycle-ish model ----
export function createPlayerCar(scene, model, x, z, heading) {
  const mesh = makeCarMesh(model);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh, model, heading, speed: 0, health: 100,
    x, z,
    update(dt, input, city, onCrash) {
      const throttle = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 0.55 : 0);
      const steer = (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0);
      const braking = input.isDown('brake');
      const maxSpeed = model.top;
      const maxReverse = 10;
      if (throttle > 0) car.speed += model.accel * throttle * dt;
      else if (throttle < 0) car.speed += model.accel * throttle * dt * 1.4;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      if (braking) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
      car.speed = THREE.MathUtils.clamp(car.speed, -maxReverse, maxSpeed);
      const steerFactor = THREE.MathUtils.clamp(Math.abs(car.speed) / 8, 0, 1);
      car.heading += steer * model.grip * 0.55 * steerFactor * dt * Math.sign(car.speed || 1) * -1;
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const before = { x: car.x, z: car.z };
      const fixed = city.resolveCollision(nx, nz, 2.2);
      car.x = fixed.x; car.z = fixed.z;
      if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 4) {
        if (onCrash) onCrash(Math.abs(car.speed));
        car.speed *= 0.45;
        car.health -= 2;
      }
      // Keep off the ocean (sand is fine, water is not).
      if (car.x < -308) { car.x = -308; car.speed *= 0.5; }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      mesh.rotation.z = -steer * 0.04 * steerFactor;
      for (const w of mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      return { moved: Math.abs(car.x - before.x) + Math.abs(car.z - before.z) };
    },
  };
  return car;
}

// ---- Traffic: cars that follow the road grid, turn at intersections ----
export function createTraffic(scene, city, count = 14, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cars = [];
  const group = new THREE.Group();
  group.name = 'traffic';
  scene.add(group);

  function randomRoadCar() {
    const model = CAR_MODELS[Math.floor(rnd() * CAR_MODELS.length)];
    const mesh = makeCarMesh(model);
    group.add(mesh);
    const alongX = rnd() < 0.5;
    const road = city.roads[Math.floor(rnd() * city.roads.length)];
    const along = (rnd() * 2 - 1) * 230;
    const dir = rnd() < 0.5 ? 1 : -1;
    const lane = (rnd() < 0.5 ? -3.2 : 3.2);
    const car = {
      mesh, model,
      alongX, road, along, dir, lane,
      speed: 8 + rnd() * 7,
      baseSpeed: 8 + rnd() * 7,
      x: 0, z: 0, heading: 0,
      stopped: 0,
    };
    return car;
  }
  for (let i = 0; i < count; i++) cars.push(randomRoadCar());

  function place(car) {
    if (car.alongX) {
      car.x = car.along; car.z = car.road + car.lane;
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = car.road + car.lane; car.z = car.along;
      car.heading = car.dir > 0 ? 0 : Math.PI;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  return {
    cars,
    update(dt, playerPos, playerSpeed) {
      for (const car of cars) {
        // Slow down for the player car ahead (crude: distance check).
        let target = car.baseSpeed;
        if (playerPos) {
          const dx = car.x - playerPos.x, dz = car.z - playerPos.z;
          const d = Math.hypot(dx, dz);
          if (d < 12 && Math.abs(playerSpeed) < 4) target = 0;
          else if (d < 20) target = car.baseSpeed * 0.4;
        }
        car.speed += (target - car.speed) * Math.min(1, dt * 2);
        car.along += car.dir * car.speed * dt;
        // At an intersection, sometimes turn onto the crossing road.
        const near = city.nearestRoad(car.along);
        if (Math.abs(car.along - near) < 1.2 && car.speed > 0.5 && rnd() < 0.25) {
          car.alongX = !car.alongX;
          car.road = near;
          car.along = near;
          car.lane = (rnd() < 0.5 ? -3.2 : 3.2);
          car.dir = rnd() < 0.5 ? 1 : -1;
        }
        if (car.along > 245) car.along = -245;
        if (car.along < -245) car.along = 245;
        place(car);
        for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      }
    },
    // Nearest traffic car to a point (for stealing / collisions).
    nearest(x, z, maxDist = 8) {
      let best = null, bd = maxDist;
      for (const c of cars) {
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd) { bd = d; best = c; }
      }
      return best ? { car: best, dist: bd } : null;
    },
    remove(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
      group.remove(car.mesh);
    },
    spawnNear(x, z) {
      const car = randomRoadCar();
      car.road = city.nearestRoad(z);
      car.alongX = true;
      car.along = THREE.MathUtils.clamp(x + 40, -230, 230);
      cars.push(car);
      place(car);
      return car;
    },
  };
}

export { CAR_MODELS };
