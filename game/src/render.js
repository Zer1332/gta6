// SOLMAR — the three.js stage: renderer, sunset lighting, fog and the
// third-person chase camera. The sun hangs low in the west all game long and
// drifts slowly, so the city keeps its golden-hour look while the light
// direction shifts. The camera follows behind Rook or his car, swings with
// the mouse, and pulls back and up while driving.
import * as THREE from 'three';
import { SOLMAR, SUNSET } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SUNSET.skyHorizon);
  scene.fog = new THREE.Fog(SUNSET.fog, 180, 700);

  const hemi = new THREE.HemisphereLight(SUNSET.hemiSky, SUNSET.hemiGround, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(SUNSET.sunColor, 2.1);
  sun.position.set(-180, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let dayT = 0.35;
  return {
    scene,
    camera,
    renderer,
    resize,
    // Slow golden-hour drift: the sun sinks a little, then climbs back.
    updateSun(dt) {
      dayT += dt * 0.004;
      const s = Math.sin(dayT * Math.PI);
      sun.position.set(-180 + s * 40, 120 - s * 45, 60);
      sun.intensity = 2.1 - s * 0.35;
    },
    // Chase camera: behind the target by yaw, a touch higher while driving.
    updateCamera(target, camYaw, camPitch, inCar, dt) {
      const dist = inCar ? 11.5 : 8;
      const height = inCar ? 4.4 : 3.4;
      const want = new THREE.Vector3(
        target.x + Math.sin(camYaw) * dist,
        target.y + height + camPitch * 4,
        target.z + Math.cos(camYaw) * dist,
      );
      camera.position.lerp(want, Math.min(1, dt * 7));
      camera.lookAt(target.x, target.y + 1.6, target.z);
    },
    // Fixed cinematic framing for the title screen.
    titleCamera(t) {
      camera.position.set(Math.sin(t * 0.08) * 190, 95, Math.cos(t * 0.08) * 190 - 40);
      camera.lookAt(0, 20, 40);
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
