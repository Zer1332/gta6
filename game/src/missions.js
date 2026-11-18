// SOLMAR — missions.js
// Tiga misi cerita berurutan: First Gear ($300), Sunset Run ($500, 90 detik),
// Dockside ($800). Penanda beacon di dunia + objektif di HUD + telepon Mara.
// Pengambilan paket misi 2 dibuat TOLERAN (pelajaran ronde 4 pertama):
// paket terambil otomatis bila pemain/mobil mendekat (radius 6m),
// tombol F juga bekerja dalam radius 10m — jadi tak ada lagi momen
// "F sudah ditekan tapi paket tak terambil".

export function createMissions(G) {
  const missions = {
    index: 0, // misi aktif (0..2); 3 = semua selesai (free roam)
    stage: 'idle', // idle | active | done
    stageDetail: '', // sub-tahap di dalam misi
    timer: 0,
    hasPackage: false,
    sedanTaken: false,
    beacon: null,
    beaconLight: null,
    markerPos: null,
    objective: 'Selesaikan panggilan Mara untuk mulai.',
    phoneShown: false,

    def() {
      return G.config.missions[this.index];
    },

    start() {
      if (this.index >= 3) return;
      const def = this.def();
      this.stage = 'active';
      this.stageDetail = this.index === 0 ? 'steal' : this.index === 1 ? 'pickup' : 'fight';
      this.timer = def.timeLimit || 0;
      this.hasPackage = false;
      this.sedanTaken = false;
      this.objective = def.name + ': ' + this.objectiveText();
      this.phoneShown = true;
      G.audio.phone();
      G.hud.showPhone(def.briefing, def.name);
      this.updateMarker();
      if (this.index === 2) {
        G.combat.spawnVultures(def.vulturePos);
      }
    },

    objectiveText() {
      if (this.index === 0) {
        return this.stageDetail === 'steal'
          ? 'Curi sedan biru di parkiran timur (E untuk masuk mobil)'
          : 'Antar sedan ke garasi Mara';
      }
      if (this.index === 1) {
        return this.stageDetail === 'pickup'
          ? 'Ambil paket di garasi Mara (mendekat / tekan F)'
          : 'Antar paket ke dermaga sebelum waktu habis';
      }
      if (this.index === 2) {
        return this.stageDetail === 'fight'
          ? 'Kalahkan 3 Vulture di dermaga (klik untuk menembak)'
          : 'Kembali ke Mara di garasi';
      }
      return 'Free roam — kota Solmar milikmu, Rook.';
    },

    // Posisi penanda misi saat ini (untuk beacon + minimap).
    updateMarker() {
      if (this.stage !== 'active') {
        this.markerPos = null;
        this.hideBeacon();
        return;
      }
      const def = this.def();
      if (this.index === 0) this.markerPos = this.stageDetail === 'steal' ? def.sedanPos : def.garagePos;
      else if (this.index === 1) this.markerPos = this.stageDetail === 'pickup' ? def.packagePos : def.dockPos;
      else if (this.index === 2) this.markerPos = this.stageDetail === 'fight' ? [310, 244] : def.returnPos;
      this.showBeacon(this.markerPos);
    },

    showBeacon([x, z]) {
      this.hideBeacon();
      const geo = new THREE.CylinderGeometry(0.5, 2.2, 42, 12, 1, true);
      const m = new THREE.MeshBasicMaterial({
        color: 0xffd23a,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.beacon = new THREE.Mesh(geo, m);
      this.beacon.position.set(x, 21, z);
      G.scene.add(this.beacon);
      this.beaconLight = new THREE.PointLight(0xffd23a, 12, 30);
      this.beaconLight.position.set(x, 4, z);
      G.scene.add(this.beaconLight);
    },

    hideBeacon() {
      if (this.beacon) G.scene.remove(this.beacon);
      if (this.beaconLight) G.scene.remove(this.beaconLight);
      this.beacon = null;
      this.beaconLight = null;
    },

    onSedanTaken() {
      if (this.index === 0 && this.stage === 'active' && this.stageDetail === 'steal') {
        this.stageDetail = 'deliver';
        this.objective = this.def().name + ': ' + this.objectiveText();
        this.updateMarker();
        G.hud.banner('Sedan didapat! Antar ke garasi Mara.', 3);
      }
    },

    // Dipanggil tiap frame saat misi 2 aktif: paket terambil otomatis
    // bila pemain (jalan kaki / di mobil) berada dalam radius pickup,
    // dan juga bila tombol F ditekan dalam radius 10m.
    tryPickup() {
      if (this.index !== 1 || this.stage !== 'active' || this.stageDetail !== 'pickup') return;
      const def = this.def();
      const d = Math.hypot(G.player.pos.x - def.packagePos[0], G.player.pos.z - def.packagePos[1]);
      if (d <= def.pickupRadius) {
        this.pickupPackage();
      }
    },
    tryPickupKey() {
      if (this.index !== 1 || this.stage !== 'active' || this.stageDetail !== 'pickup') return;
      const def = this.def();
      const d = Math.hypot(G.player.pos.x - def.packagePos[0], G.player.pos.z - def.packagePos[1]);
      if (d <= 10) this.pickupPackage();
    },
    pickupPackage() {
      this.hasPackage = true;
      this.stageDetail = 'deliver';
      this.objective = this.def().name + ': ' + this.objectiveText();
      this.updateMarker();
      G.audio.pickup();
      G.hud.banner('Paket diambil! Ke dermaga — 90 detik.', 3);
    },

    onVultureDown() {
      if (this.index !== 2 || this.stage !== 'active') return;
      if (G.combat.aliveCount() === 0) {
        this.stageDetail = 'return';
        this.objective = this.def().name + ': ' + this.objectiveText();
        this.updateMarker();
        G.hud.banner('Dermaga bersih! Kembali ke Mara.', 3);
      }
    },

    completeMission() {
      const def = this.def();
      G.player.money += def.reward;
      G.audio.cash();
      G.hud.banner(def.name + ' selesai! +$' + def.reward, 4);
      this.stage = 'done';
      this.index += 1;
      this.hideBeacon();
      G.combat.clearEnemies();
      G.saveGame();
      if (this.index >= 3) {
        this.objective = 'Semua misi selesai! Free roam — kota Solmar milikmu, Rook.';
        this.markerPos = null;
        G.hud.banner('Semua misi selesai! Free roam terbuka.', 5);
      } else {
        this.objective = 'Misi berikutnya: ' + G.config.missions[this.index].name + ' — tekan T untuk telepon Mara.';
        this.markerPos = null;
      }
    },

    failMission(reason) {
      G.hud.banner('Misi gagal: ' + reason + ' — tekan T untuk coba lagi.', 4);
      this.stage = 'idle';
      this.stageDetail = '';
      this.hasPackage = false;
      this.hideBeacon();
      G.combat.clearEnemies();
      this.markerPos = null;
      this.objective = 'Misi ' + this.def().name + ' gagal. Tekan T untuk telepon Mara dan coba lagi.';
    },

    // Telepon Mara (T): mulai misi berikutnya / ulangi misi yang gagal.
    callMara() {
      if (this.stage === 'active') return;
      if (this.index >= 3) {
        G.hud.showPhone('Mara: "Kerja bagus, Rook. Solmar sudah milikmu. Nikmati free roam."', 'Mara Solano');
        return;
      }
      this.start();
    },

    update(dt) {
      if (this.stage !== 'active') return;
      // Timer misi 2.
      if (this.index === 1 && this.timer > 0) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.failMission('waktu habis di Sunset Run');
          return;
        }
      }
      const p = G.player;

      if (this.index === 0) {
        const def = this.def();
        if (this.stageDetail === 'deliver' && p.car && p.car.missionSedan) {
          const d = Math.hypot(p.pos.x - def.garagePos[0], p.pos.z - def.garagePos[1]);
          if (d <= def.deliverRadius) {
            this.completeMission();
            return; // index berubah di completeMission — jangan lanjut ke cabang lain
          }
        }
      } else if (this.index === 1) {
        const def = this.def();
        this.tryPickup(); // auto-pickup toleran
        if (this.stage === 'active' && this.stageDetail === 'deliver') {
          const d = Math.hypot(p.pos.x - def.dockPos[0], p.pos.z - def.dockPos[1]);
          if (d <= def.deliverRadius) {
            this.completeMission();
            return;
          }
        }
      } else if (this.index === 2) {
        const def = this.def();
        if (this.stageDetail === 'return') {
          const d = Math.hypot(p.pos.x - def.returnPos[0], p.pos.z - def.returnPos[1]);
          if (d <= def.returnRadius) {
            this.completeMission();
            return;
          }
        }
      }
    },
  };
  return missions;
}
