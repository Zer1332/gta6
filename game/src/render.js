// The 3D view: a warm afternoon sun, a blue sky with a few flat clouds, a chase camera that
// trails the player or their car with damping, and a floating gold beacon over the mission
// target. No shadow maps (headless-safe): each figure and car gets a soft blob shadow instead.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 260, 520);

  // Sun: warm directional light from the south-west, high in the afternoon sky.
  const sun = new THREE.DirectionalLight(0xfff2cf, 2.6);
  sun.position.set(-120, 180, 120);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5c, 1.1);
  scene.add(hemi);

  // A few flat clouds drifting slowly.
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + j * 3, 8, 6), cloudMat);
      puff.position.set(j * 10 - 10, j * 1.5, 0);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(-260 + i * 80, 110 + (i % 3) * 12, -240 + (i % 2) * 120);
    scene.add(cloud);
    clouds.push(cloud);
  }

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  camera.position.set(0, 10, -14);

  // Mission beacon: a spinning gold ring and a light pillar over the target.
  const beacon = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.28, 8, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.gold }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  beacon.add(ring);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 21;
  beacon.add(pillar);
  beacon.visible = false;
  scene.add(beacon);

  // Blob shadows: one dark ellipse per figure or car, kept flat on the ground.
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(1, 20);
  function makeBlob(rx, rz) {
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(rx, rz, 1);
    scene.add(blob);
    return blob;
  }

  const cam = {
    yaw: 0,
    pitch: 0.32,
    distance: 10,
    height: 4,
    pos: new THREE.Vector3(0, 10, -14),
    look: new THREE.Vector3(0, 1, 0),
  };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /**
   * Frame the player: on foot the camera sits close behind; driving it pulls back and widens
   * the view with speed. `orbit` (from mouse drag) swings the yaw; it relaxes back behind the
   * direction of travel.
   */
  function frameCamera(target, dt, orbit) {
    if (orbit.x !== 0) cam.yaw -= orbit.x * 0.004;
    cam.pitch = Math.max(0.12, Math.min(0.7, cam.pitch + orbit.y * 0.002));
    const inCar = !!target.car;
    const speed = inCar ? Math.abs(target.car.speed) : target.speed;
    const wantDist = inCar ? 11 + speed * 0.08 : 8;
    const wantHeight = inCar ? 4.4 : 3.4;
    cam.distance += (wantDist - cam.distance) * Math.min(1, dt * 3);
    cam.height += (wantHeight - cam.height) * Math.min(1, dt * 3);
    // Ease the yaw back behind the heading when the player is moving: the camera sits at
    // target - forward(yaw) * distance, so yaw settles on the heading itself.
    if (speed > 1) {
      const behind = target.heading;
      let diff = behind - cam.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cam.yaw += diff * Math.min(1, dt * (inCar ? 1.6 : 2.4));
    }
    const cx = target.x - Math.sin(cam.yaw) * cam.distance;
    const cz = target.z - Math.cos(cam.yaw) * cam.distance;
    const cy = cam.height + Math.sin(cam.pitch) * cam.distance * 0.4;
    cam.pos.x += (cx - cam.pos.x) * Math.min(1, dt * 7);
    cam.pos.y += (cy - cam.pos.y) * Math.min(1, dt * 7);
    cam.pos.z += (cz - cam.pos.z) * Math.min(1, dt * 7);
    cam.look.x += (target.x - cam.look.x) * Math.min(1, dt * 9);
    cam.look.y += ((inCar ? 1.6 : 1.5) - cam.look.y) * Math.min(1, dt * 9);
    cam.look.z += (target.z - cam.look.z) * Math.min(1, dt * 9);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    camera.fov += ((inCar ? 62 + Math.min(10, speed * 0.25) : 62) - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    makeBlob,
    /** The camera's current yaw, so on-foot movement can follow the view. */
    yaw() {
      return cam.yaw;
    },
    setBeacon(x, z, visible) {
      beacon.visible = visible;
      if (visible) {
        beacon.position.set(x, 0, z);
        ring.rotation.z += 0.02;
      }
    },
    /** One frame: move the clouds, frame the camera, and draw. */
    draw(target, dt, orbit, time) {
      for (let i = 0; i < clouds.length; i += 1) {
        clouds[i].position.x += dt * (0.6 + (i % 3) * 0.3);
        if (clouds[i].position.x > 320) clouds[i].position.x = -320;
      }
      frameCamera(target, dt, orbit);
      renderer.render(scene, camera);
    },
    /** A still frame for a screenshot: no camera easing, one fixed pose. */
    drawStill(target, camYaw, camPitch, camDist, camHeight) {
      cam.yaw = camYaw;
      cam.pitch = camPitch;
      cam.distance = camDist;
      cam.height = camHeight;
      const cx = target.x - Math.sin(camYaw) * camDist;
      const cz = target.z - Math.cos(camYaw) * camDist;
      camera.position.set(cx, camHeight, cz);
      camera.lookAt(target.x, 1.5, target.z);
      camera.fov = 62;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
  };
}
