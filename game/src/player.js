// player.js — Leo Marín on foot: third-person movement, camera-relative
// WASD, sprint, punch and hitscan shooting. Original code for this game.
import * as THREE from 'three';
import { makePersonMesh } from './pedestrians.js';

export function createPlayer(scene, city) {
  // Leo: white tee, dark jeans, distinct from generic peds.
  const mesh = makePersonMesh(0xf2f2f2, 0xc89068);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.46),
    new THREE.MeshLambertMaterial({ color: 0xd84040 }));
  cap.position.y = 1.8;
  mesh.add(cap);
  scene.add(mesh);

  const player = {
    mesh,
    x: 0, z: 14, heading: Math.PI, camYaw: Math.PI,
    health: 100, ammo: 24,
    speed: 0, moving: false,
    punchCd: 0, punchAnim: 0, shootCd: 0,
    onPoliceRam: null, onCopPunch: null, onBusted: null,
    reset(x, z, heading = Math.PI) {
      player.x = x; player.z = z; player.heading = heading;
      player.camYaw = heading;
      player.health = 100;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
    },
    update(dt, input, city, ctx, pressed = null) {
      // ctx: { inCar, onPunch(hit), onShoot(), enemies, peds, police }
      // pressed: edge-triggered keys already consumed by the main loop
      // (pass it in so a press is never eaten twice).
      player.punchCd -= dt;
      player.shootCd -= dt;
      player.punchAnim = Math.max(0, player.punchAnim - dt * 4);
      const fwd = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
      const strafe = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      const sprint = input.isDown('sprint');
      const speed = sprint ? 9.5 : 5.2;
      const mx = Math.sin(player.camYaw) * fwd + Math.cos(player.camYaw) * strafe;
      const mz = Math.cos(player.camYaw) * fwd - Math.sin(player.camYaw) * strafe;
      const len = Math.hypot(mx, mz);
      player.moving = len > 0.01;
      if (player.moving) {
        const nx = player.x + (mx / len) * speed * dt;
        const nz = player.z + (mz / len) * speed * dt;
        const fixed = city.resolveCollision(nx, nz, 0.55);
        player.x = fixed.x; player.z = fixed.z;
        player.heading = Math.atan2(mx / len, mz / len);
      }
      // Mouse look rotates the camera yaw; player faces movement direction.
      const mouse = input.takeMouse();
      if (mouse.dx !== 0) player.camYaw -= mouse.dx * 0.0032;
      mesh.position.set(player.x, 0, player.z);
      mesh.rotation.y = player.heading;
      // Walk / punch animation.
      const arms = mesh.userData.arms;
      if (player.punchAnim > 0) {
        arms[1].rotation.x = -1.6 * player.punchAnim;
      } else if (player.moving) {
        const ph = performance.now() * 0.012;
        arms[0].rotation.x = Math.sin(ph) * 0.6;
        arms[1].rotation.x = -Math.sin(ph) * 0.6;
        mesh.position.y = Math.abs(Math.sin(ph)) * 0.06;
      } else {
        arms[0].rotation.x = 0; arms[1].rotation.x = 0;
        mesh.position.y = 0;
      }
      // Punch (F): hits nearest enemy/ped/cop in front within 2.2m.
      const pressedKeys = pressed || input.takePressed();
      if (pressedKeys.has('punch') && player.punchCd <= 0) {
        player.punchCd = 0.45;
        player.punchAnim = 1;
        ctx.onPunch?.(player);
      }
      // Shoot: click (or hold) fires a hitscan ray from the camera.
      if ((input.takeClick() || input.isMouseDown()) && player.shootCd <= 0 && player.ammo > 0) {
        player.shootCd = 0.28;
        player.ammo -= 1;
        ctx.onShoot?.(player);
      }
      return { pressed };
    },
    takeDamage(amount) {
      player.health = Math.max(0, player.health - amount);
      return player.health <= 0;
    },
    heal(amount) { player.health = Math.min(100, player.health + amount); },
  };
  return player;
}
