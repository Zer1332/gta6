// SOLMAR — hud.js
// Semua DOM: bar nyawa, uang, bintang wanted, objektif, kecepatan, amunisi,
// minimap canvas, crosshair, banner, telepon Mara, layar awal/pause/game over.

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: {
      start: $('start-screen'),
      hud: $('hud'),
      hpFill: $('hp-fill'),
      hpText: $('hp-text'),
      money: $('money'),
      stars: $('stars'),
      objective: $('objective'),
      timer: $('timer'),
      speed: $('speed'),
      ammo: $('ammo'),
      weapon: $('weapon'),
      minimap: $('minimap'),
      crosshair: $('crosshair'),
      banner: $('banner'),
      phone: $('phone'),
      phoneText: $('phone-text'),
      phoneName: $('phone-name'),
      pause: $('pause-screen'),
      gameover: $('gameover-screen'),
      gameoverStats: $('gameover-stats'),
      damage: $('damage-flash'),
      hitmarker: $('hitmarker'),
      prompt: $('prompt'),
      muteBtn: $('mute-btn'),
    },
    bannerUntil: 0,
    phoneUntil: 0,
    mmCtx: null,

    init() {
      if (this.el.minimap) this.mmCtx = this.el.minimap.getContext('2d');
      if (this.el.muteBtn) {
        this.el.muteBtn.addEventListener('click', () => G.toggleMute());
      }
    },

    banner(text, secs) {
      if (!this.el.banner) return;
      this.el.banner.textContent = text;
      this.el.banner.style.opacity = '1';
      this.bannerUntil = G.time + (secs || 3);
    },

    showPhone(text, name) {
      if (!this.el.phone) return;
      this.el.phoneText.textContent = text;
      this.el.phoneName.textContent = name || 'Mara Solano';
      this.el.phone.style.display = 'block';
      this.phoneUntil = G.time + 6;
    },

    flashDamage() {
      if (!this.el.damage) return;
      this.el.damage.style.opacity = '0.55';
      setTimeout(() => {
        this.el.damage.style.opacity = '0';
      }, 180);
    },

    hitmarker() {
      if (!this.el.hitmarker) return;
      this.el.hitmarker.style.opacity = '1';
      setTimeout(() => {
        this.el.hitmarker.style.opacity = '0';
      }, 120);
    },

    showStart() {
      this.el.start.style.display = 'flex';
      this.el.hud.style.display = 'none';
      this.el.pause.style.display = 'none';
      this.el.gameover.style.display = 'none';
    },

    showPlaying() {
      this.el.start.style.display = 'none';
      this.el.hud.style.display = 'block';
      this.el.pause.style.display = 'none';
      this.el.gameover.style.display = 'none';
    },

    showPause() {
      this.el.pause.style.display = 'flex';
    },

    showGameOver(statsText) {
      this.el.gameoverStats.textContent = statsText;
      this.el.gameover.style.display = 'flex';
      this.el.hud.style.display = 'none';
    },

    update() {
      const p = G.player;
      const m = G.missions;
      if (this.el.hpFill) this.el.hpFill.style.width = Math.max(0, p.hp) + '%';
      if (this.el.hpText) this.el.hpText.textContent = Math.ceil(Math.max(0, p.hp)) + ' HP';
      if (this.el.money) this.el.money.textContent = '$' + p.money;
      if (this.el.stars) {
        let s = '';
        for (let i = 0; i < 5; i++) s += i < G.police.wanted ? '★' : '☆';
        this.el.stars.textContent = s;
        this.el.stars.style.color = G.police.wanted > 0 ? '#ff4444' : '#888';
      }
      if (this.el.objective) this.el.objective.textContent = m.objective;
      if (this.el.timer) {
        this.el.timer.textContent =
          m.stage === 'active' && m.index === 1 && m.timer > 0 ? '⏱ ' + Math.ceil(m.timer) + ' dtk' : '';
      }
      if (this.el.speed) {
        const v = p.car ? Math.abs(p.car.speed) * 3.6 : 0;
        this.el.speed.textContent = p.car ? Math.round(v) + ' km/j' : '';
      }
      if (this.el.ammo) {
        const w = G.combat.weapon();
        this.el.ammo.textContent = G.combat.reloading
          ? 'Isi ulang…'
          : p.ammo[p.weapon] + ' / ' + p.reserve[p.weapon];
      }
      if (this.el.weapon) this.el.weapon.textContent = G.combat.weapon().name;
      if (this.el.crosshair) {
        this.el.crosshair.style.display = G.state === 'playing' && !p.car ? 'block' : 'none';
      }
      if (this.el.banner && G.time > this.bannerUntil) this.el.banner.style.opacity = '0';
      if (this.el.phone && G.time > this.phoneUntil) this.el.phone.style.display = 'none';
      // Prompt interaksi kontekstual.
      if (this.el.prompt) {
        let txt = '';
        if (G.state === 'playing' && !p.car) {
          const car = G.nearestCar(4.5);
          if (car) txt = 'E — Masuk mobil' + (car.missionSedan ? ' (sedan target)' : '');
          else if (m.stage === 'active' && m.index === 1 && m.stageDetail === 'pickup') {
            const def = m.def();
            const d = Math.hypot(p.pos.x - def.packagePos[0], p.pos.z - def.packagePos[1]);
            if (d <= 10) txt = 'F — Ambil paket (atau mendekat)';
          }
        } else if (G.state === 'playing' && p.car) {
          txt = 'E — Keluar mobil';
        }
        this.el.prompt.textContent = txt;
        this.el.prompt.style.display = txt ? 'block' : 'none';
      }
      this.drawMinimap();
    },

    drawMinimap() {
      const ctx = this.mmCtx;
      if (!ctx) return;
      const W = 180;
      const H = 180;
      const S = G.config.worldSize;
      const toX = (x) => ((x + S / 2) / S) * W;
      const toY = (z) => ((z + S / 2) / S) * H;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#16241a';
      ctx.fillRect(0, 0, W, H);
      // Laut.
      ctx.fillStyle = '#1a4a6a';
      ctx.fillRect(0, toY(G.config.waterZ), W, H - toY(G.config.waterZ));
      // Jalan grid.
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      for (let c = -340; c <= 340; c += 60) {
        ctx.beginPath();
        ctx.moveTo(toX(c), 0);
        ctx.lineTo(toX(c), H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, toY(c));
        ctx.lineTo(W, toY(c));
        ctx.stroke();
      }
      const dot = (x, z, color, r) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2);
        ctx.fill();
      };
      // Penanda misi.
      if (G.missions.markerPos) dot(G.missions.markerPos[0], G.missions.markerPos[1], '#ffd23a', 5);
      // Polisi.
      for (const c of G.police.cars) dot(c.pos.x, c.pos.z, '#3a6aff', 3);
      // Vulture.
      for (const e of G.combat.enemies) if (e.alive) dot(e.pos.x, e.pos.z, '#ff2222', 3.5);
      // Lalu lintas.
      for (const c of G.traffic) dot(c.pos.x, c.pos.z, '#999', 1.6);
      // Pemain: panah putih.
      const p = G.player;
      ctx.save();
      ctx.translate(toX(p.pos.x), toY(p.pos.z));
      ctx.rotate(Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) + Math.PI);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
  return hud;
}
