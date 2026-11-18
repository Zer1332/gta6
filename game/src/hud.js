// SOLMAR — hud.js
// HUD: bar nyawa, uang, bintang wanted, objektif misi, kecepatan, amunisi,
// crosshair, minimap (canvas 2D di pojok kanan atas), banner, panggilan
// telepon Mara, layar awal, pause, dan game over.

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    const ids = [
      'hud', 'health-fill', 'health-num', 'money', 'wanted', 'objective',
      'speed', 'ammo', 'weapon', 'timer', 'banner', 'phone', 'phone-text',
      'start-screen', 'pause-screen', 'gameover-screen', 'gameover-stats',
      'crosshair', 'damage-flash', 'minimap', 'mission-list', 'interact',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mapCtx = this.el.minimap.getContext('2d');
    this.bannerTimer = null;
    this.phoneTimer = null;
  }

  showHud(show) {
    this.el.hud.style.display = show ? 'block' : 'none';
  }

  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    this.el['health-fill'].style.width = `${pct}%`;
    this.el['health-num'].textContent = Math.ceil(pct);
    this.el['health-fill'].style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
  }

  setMoney(money) {
    this.el.money.textContent = `$${Math.floor(money).toLocaleString('en-US')}`;
  }

  setWanted(wanted) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
    this.el.wanted.textContent = stars;
    this.el.wanted.style.color = wanted > 0 ? '#ffd24a' : '#888888';
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(kmh)} km/h` : '';
  }

  setAmmo(ammo, mag, weapon, reloading) {
    this.el.ammo.textContent = reloading ? 'RELOAD...' : `${ammo} / ${mag}`;
    this.el.weapon.textContent = weapon === 'pistol' ? 'PISTOL' : 'SMG';
  }

  setTimer(seconds) {
    if (seconds === null || seconds === undefined) {
      this.el.timer.style.display = 'none';
      return;
    }
    this.el.timer.style.display = 'block';
    this.el.timer.textContent = `⏱ ${seconds}s`;
    this.el.timer.style.color = seconds <= 15 ? '#ff5040' : '#ffffff';
  }

  showCrosshair(show) {
    this.el.crosshair.style.display = show ? 'block' : 'none';
  }

  showInteract(text) {
    if (!text) {
      this.el.interact.style.display = 'none';
      return;
    }
    this.el.interact.style.display = 'block';
    this.el.interact.textContent = text;
  }

  showBanner(text, ms = 3500) {
    this.el.banner.textContent = text;
    this.el.banner.style.display = 'block';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      this.el.banner.style.display = 'none';
    }, ms);
  }

  showPhone(text, ms = 6000) {
    this.el['phone-text'].textContent = text;
    this.el.phone.style.display = 'block';
    clearTimeout(this.phoneTimer);
    this.phoneTimer = setTimeout(() => {
      this.el.phone.style.display = 'none';
    }, ms);
  }

  flashDamage() {
    this.el['damage-flash'].style.opacity = '0.45';
    setTimeout(() => {
      this.el['damage-flash'].style.opacity = '0';
    }, 150);
  }

  showStart(missionsDone) {
    this.el['start-screen'].style.display = 'flex';
    const items = ['1. First Gear — curi sedan, antar ke garasi ($300)',
      '2. Sunset Run — antar paket ke dermaga, 90 detik ($500)',
      '3. Dockside — kalahkan 3 Vulture di dermaga ($800)'];
    this.el['mission-list'].innerHTML = items
      .map((t, i) => `<li>${missionsDone[i] ? '✓ ' : ''}${t}</li>`)
      .join('');
  }

  hideStart() {
    this.el['start-screen'].style.display = 'none';
  }

  showPause(show) {
    this.el['pause-screen'].style.display = show ? 'flex' : 'none';
  }

  showGameOver(stats) {
    this.el['gameover-stats'].innerHTML = stats;
    this.el['gameover-screen'].style.display = 'flex';
  }

  hideGameOver() {
    this.el['gameover-screen'].style.display = 'none';
  }

  // Minimap: jalan grid, pemain (panah), penanda misi, polisi, mobil.
  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / 900; // kota 800 + margin
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20, 24, 30, 0.85)';
    ctx.fillRect(0, 0, S, S);
    // Air di timur.
    ctx.fillStyle = '#1e5f7a';
    const [wx] = toMap(405, 0);
    ctx.fillRect(wx, 0, S - wx, S);
    // Jalan.
    ctx.strokeStyle = '#5a5a62';
    ctx.lineWidth = 3;
    for (let c = -400; c <= 400; c += 100) {
      const [x1, y1] = toMap(c, -400);
      const [x2, y2] = toMap(c, 400);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [hx1, hy1] = toMap(-400, c);
      const [hx2, hy2] = toMap(400, c);
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();
    }
    // Dermaga.
    ctx.fillStyle = '#6a4a2a';
    const [px, py] = toMap(400, 142);
    ctx.fillRect(px, py, (70) * scale, 16 * scale);
    // Mobil lalu lintas (titik abu-abu).
    ctx.fillStyle = '#c0c0c8';
    for (const c of this.game.traffic.cars) {
      const [mx, my] = toMap(c.mesh.position.x, c.mesh.position.z);
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
    // Polisi (titik biru-merah).
    ctx.fillStyle = '#4080ff';
    for (const c of this.game.police.cars) {
      const [mx, my] = toMap(c.mesh.position.x, c.mesh.position.z);
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Penanda misi (bintang kuning berdenyut).
    if (this.game.missions.markerPos) {
      const [mx, my] = toMap(this.game.missions.markerPos.x, this.game.missions.markerPos.z);
      const r = 4 + Math.sin(this.game.now * 4) * 1.5;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Pemain: panah hijau menghadap arah kamera/mobil.
    const p = this.game.player.pos;
    const [mx, my] = toMap(p.x, p.z);
    const heading = this.game.player.inCar ? this.game.player.inCar.heading : this.game.player.camYaw;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // Bingkai + utara.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 14, 14);
  }
}
