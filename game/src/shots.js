// SOLMAR — shots.js
// Mode screenshot deterministik: ?shot=start|drive|chase|mission&seed=1
// Setiap mode menaruh kamera dan pemain di posisi tetap, tanpa keacakan
// di luar seed, supaya screenshot bisa diulang byte-per-byte suasananya.

export function applyShotMode(G, mode) {
  window.__SOLMAR_SHOT_MODE = true;
  const p = G.player;

  const setCamera = (x, y, z, lx, ly, lz) => {
    G.shotCamera = true;
    G.camera.position.set(x, y, z);
    G.camera.lookAt(lx, ly, lz);
  };

  if (mode === 'start') {
    G.state = 'start';
    G.hud.showStart();
    // Kamera orbit di atas plaza pusat, menghadap pusat kota saat senja.
    setCamera(55, 30, -70, 0, 8, 40);
    return;
  }

  // drive / chase / mission: game langsung berjalan, HUD tampil.
  G.state = 'playing';
  G.hud.showPlaying();

  // Jepret kamera third-person ke posisi ikutnya SEKALI, supaya frame
  // pertama mode shot sudah benar (bukan di tengah lerp dari titik awal).
  const snapFollowCamera = (dist, height) => {
    const fwdX = -Math.sin(p.yaw);
    const fwdZ = -Math.cos(p.yaw);
    G.camera.position.set(p.pos.x - fwdX * dist, p.pos.y + height, p.pos.z - fwdZ * dist);
    G.camera.lookAt(p.pos.x + fwdX * 6, p.pos.y + 1.6, p.pos.z + fwdZ * 6);
    G.shotCamera = false;
  };

  if (mode === 'drive') {
    // Rook di dalam mobil di jalan x=60, menghadap utara (ke dermaga).
    const car = G.parkedCars[1]; // sedan abu-abu
    car.pos.set(60, 0, 120);
    car.yaw = 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = 0;
    p.pos.set(60, 0, 120);
    p.car = car;
    car.isPlayerCar = true;
    car.parked = false;
    p.mesh.visible = false;
    p.yaw = 0;
    car.speed = 14;
    G.missions.start(); // HUD menunjukkan objektif First Gear
    snapFollowCamera(10.5, 4.2);
    return;
  }

  if (mode === 'chase') {
    // Wanted 3: dua mobil polisi tepat di belakang mobil Rook.
    const car = G.parkedCars[3];
    car.pos.set(60, 0, 100);
    car.yaw = 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = 0;
    p.pos.set(60, 0, 100);
    p.car = car;
    car.isPlayerCar = true;
    car.parked = false;
    p.mesh.visible = false;
    p.yaw = 0;
    car.speed = 16;
    G.police.setWanted(3);
    // Polisi menghadang di depan (roadblock) supaya terlihat di frame —
    // yang mengejar dari belakang berada di luar bidang kamera.
    // Dua mobil di depan jalan, satu lagi tetap mengejar dari belakang.
    G.police.cars.forEach((pc, i) => {
      if (i === 0) {
        pc.pos.set(56, 0, 80);
      } else if (i === 1) {
        pc.pos.set(66, 0, 72);
      } else {
        pc.pos.set(60, 0, 126);
      }
      pc.yaw = Math.PI;
      pc.mesh.position.copy(pc.pos);
      pc.mesh.rotation.y = Math.PI;
    });
    G.missions.start();
    snapFollowCamera(10.5, 4.2);
    return;
  }

  if (mode === 'mission') {
    // Misi 3 aktif di dermaga: 3 Vulture terlihat di depan Rook.
    // Rook berdiri di (330,262) menghadap selatan ke kelompok Vulture —
    // garis pandang dicek bebas gedung (collider dermaga).
    G.missions.index = 2;
    G.missions.start();
    p.pos.set(330, 0, 262);
    p.mesh.position.copy(p.pos);
    p.mesh.visible = true;
    // Hadap ke kelompok Vulture (310, 244).
    const dx = 310 - p.pos.x;
    const dz = 244 - p.pos.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = 0.05;
    snapFollowCamera(7.5, 3.4);
    return;
  }

  // Mode tak dikenal: kembali ke layar awal.
  G.state = 'start';
  G.hud.showStart();
  setCamera(55, 30, -70, 0, 8, 40);
}
