// SOLMAR — player.js
// Rook, sang sopir sewaan: berjalan kaki (WASD + mouse look, Shift lari,
// Space lompat), masuk/keluar mobil (E), nyawa 100 yang pulih setelah
// 5 detik tanpa damage, dan kamera third-person.

import { CONFIG } from './config.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  g.name = 'rook';
  // Badan: jaket cokelat khas Rook.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xd8a880 }),
  );
  head.position.y = 1.8;
  head.castShadow = true;
  g.add(head);
  // Topi.
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.32, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  );
  hat.position.y = 2.05;
  g.add(hat);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
  legL.position.set(-0.18, 0.4, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
  legR.position.set(0.18, 0.4, 0);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  // Pistol di tangan (terlihat saat bertarung).
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x141414 }),
  );
  gun.position.set(0.45, 1.25, 0.3);
  gun.visible = false;
  g.add(gun);
  g.userData.gun = gun;
  return g;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(-320, 0, -300);
    this.yaw = 0; // arah hadap badan
    this.camYaw = 0; // arah kamera (mouse)
    this.camPitch = -0.25;
    this.vy = 0;
    this.onGround = true;
    this.health = CONFIG.playerHealth;
    this.lastDamageAt = -99;
    this.inCar = null; // PlayerCar atau null
    this.walkPhase = 0;
    this.moving = false;
  }

  place(x, z, yaw = 0) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.camYaw = yaw;
    this.vy = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = yaw;
  }

  damage(amount, now) {
    if (this.inCar) return; // damage mobil dulu saat di dalam mobil
    this.health = Math.max(0, this.health - amount);
    this.lastDamageAt = now;
  }

  heal(dt, now) {
    if (now - this.lastDamageAt > CONFIG.healthRegenDelay && this.health > 0) {
      this.health = Math.min(CONFIG.playerHealth, this.health + CONFIG.healthRegenRate * dt);
    }
  }

  update(dt, input, city, now) {
    if (this.inCar) {
      // Posisi pemain mengikuti mobil; kamera diatur di main.js.
      this.pos.copy(this.inCar.mesh.position);
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const { dx, dy } = input.consumeMouse();
    this.camYaw -= dx * 0.0025;
    this.camPitch = Math.max(-1.1, Math.min(0.5, this.camPitch - dy * 0.0025));

    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
    this.moving = mx !== 0 || mz !== 0;
    if (this.moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      // Gerak relatif terhadap arah kamera.
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = (mx * cos - mz * sin) * speed * dt;
      const wz = (mx * sin + mz * cos) * speed * dt;
      let nx = this.pos.x + wx;
      let nz = this.pos.z + wz;
      const hit = city.collideCircle(nx, nz, 0.6);
      const clamped = city.clampToLand(hit.x, hit.z);
      this.pos.x = clamped.x;
      this.pos.z = clamped.z;
      // Badan menghadap arah gerak.
      this.yaw = Math.atan2(wx, wz);
      this.walkPhase += dt * speed * 1.6;
    }
    // Lompat + gravitasi sederhana.
    if (input.isDown('Space') && this.onGround) {
      this.vy = CONFIG.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    // Animasi kaki.
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.heal(dt, now);
  }

  // Posisi kamera third-person di belakang pemain/mobil.
  cameraTarget() {
    if (this.inCar) {
      const c = this.inCar.mesh.position;
      const h = this.inCar.heading;
      return {
        pos: new THREE.Vector3(c.x - Math.sin(h) * 10, 4.5, c.z - Math.cos(h) * 10),
        look: new THREE.Vector3(c.x + Math.sin(h) * 8, 1.5, c.z + Math.cos(h) * 8),
      };
    }
    const d = 6.5;
    const h = 3 + this.camPitch * 4;
    return {
      pos: new THREE.Vector3(
        this.pos.x - Math.sin(this.camYaw) * d,
        this.pos.y + h,
        this.pos.z - Math.cos(this.camYaw) * d,
      ),
      look: new THREE.Vector3(
        this.pos.x + Math.sin(this.camYaw) * 4,
        this.pos.y + 1.6,
        this.pos.z + Math.cos(this.camYaw) * 4,
      ),
    };
  }
}
