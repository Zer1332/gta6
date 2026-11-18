// SOLMAR — render.js
// Renderer Three.js, pencahayaan senja, siklus siang-malam lambat,
// dan kamera third-person yang mengikuti Rook / mobilnya.

export function createRenderer(G) {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x2a2a3a);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, -14);

  // Senja: matahari rendah berwarna jingga + langit keunguan.
  const sun = new THREE.DirectionalLight(0xff9a4a, 1.6);
  sun.position.set(-180, 90, -120);
  G.scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8a6a9a, 0x2a2a20, 0.85);
  G.scene.add(hemi);
  const amb = new THREE.AmbientLight(0x404050, 0.5);
  G.scene.add(amb);
  // Kabut tipis warna senja supaya cakrawala menyatu.
  G.scene.fog = new THREE.Fog(0x3a2a4a, 120, 700);
  G.scene.background = new THREE.Color(0x4a3a5e);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    camera,
    sun,
    hemi,

    // Siklus siang-malam: matahari berputar pelan, warna bergeser jingga→ungu.
    update(dt) {
      G.dayTime += dt * 0.004; // satu putaran ~25 menit
      const t = G.dayTime % (Math.PI * 2);
      const elev = 0.35 + 0.25 * Math.sin(t);
      sun.position.set(Math.cos(t) * 220, 60 + elev * 120, -140);
      const warm = 0.6 + 0.4 * Math.sin(t);
      sun.color.setHSL(0.07 + 0.03 * warm, 0.85, 0.55 + 0.1 * warm);
      sun.intensity = 1.2 + 0.5 * Math.sin(t);
      G.scene.background.setHSL(0.75 - 0.08 * Math.sin(t), 0.35, 0.22 + 0.08 * Math.sin(t));
    },

    // Kamera third-person: di belakang pemain/mobil, ikut yaw + pitch.
    updateCamera(dt) {
      const p = G.player;
      if (G.shotCamera) return; // mode screenshot memakai kamera tetap
      const dist = p.car ? 10.5 : 7.5;
      const height = p.car ? 4.2 : 3.4;
      const fwdX = -Math.sin(p.yaw);
      const fwdZ = -Math.cos(p.yaw);
      const tx = p.pos.x - fwdX * dist;
      const tz = p.pos.z - fwdZ * dist;
      const ty = p.pos.y + height + p.pitch * 3;
      const k = 1 - Math.pow(0.001, dt); // lerp halus
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (ty - camera.position.y) * k;
      camera.position.z += (tz - camera.position.z) * k;
      // Lihat ke titik JAUH di depan (30 m), bukan 6 m: sinar bidik dari
      // kamera menembus tengah layar harus hampir horizontal supaya
      // melewati musuh di segala jarak. Titik lihat yang dekat membuat
      // sinar menukik ke tanah di depan musuh (paralaks third-person).
      camera.lookAt(p.pos.x + fwdX * 30, p.pos.y + 1.6 + p.pitch * 4, p.pos.z + fwdZ * 30);
    },

    render() {
      renderer.render(G.scene, camera);
    },
  };
}
