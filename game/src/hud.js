// SOLMAR — the HUD: DOM panels over the 3D view. Health bar, cash, wanted
// stars, mission objective, speed, ammo, crosshair, a 2D minimap canvas in
// the top-right corner, plus the title screen, pause screen, phone-call toast
// and game-over screen. The minimap draws the road grid, the player arrow,
// the mission marker, police cars and traffic as dots.
import { SOLMAR } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  function setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '☆';
    el('wanted').textContent = s;
    el('wanted').classList.toggle('hot', n >= 3);
  }

  return {
    showScreen(name) {
      for (const s of ['screen-title', 'screen-pause', 'screen-over']) {
        el(s).classList.toggle('hidden', s !== `screen-${name}`);
      }
      el('hud').classList.toggle('hidden', name !== 'play');
      if (name === 'title') el('screen-title').classList.remove('hidden');
    },
    setTitleStats(money, done, best) {
      el('title-stats').textContent = `Uang: $${money}  ·  Misi selesai: ${done}/3  ·  Uang terbanyak: $${best}`;
    },
    setObjective(text) {
      el('objective').textContent = text || 'Jelajahi Solmar. Tekan F untuk mulai misi pertama.';
    },
    setMoney(v) { el('money').textContent = `$${Math.floor(v)}`; },
    setHealth(v) {
      el('health-fill').style.width = `${Math.max(0, Math.min(100, v))}%`;
      el('health-num').textContent = `${Math.ceil(v)}`;
    },
    setSpeed(kmh) { el('speed').textContent = `${Math.round(kmh)} km/h`; },
    setAmmo(weapon, mag, reserve) {
      el('ammo').textContent = `${weapon.toUpperCase()}  ${mag} / ${reserve}`;
    },
    setStars,
    setTimer(seconds) {
      const t = el('timer');
      if (seconds > 0) {
        t.classList.remove('hidden');
        t.textContent = `⏱ ${Math.ceil(seconds)} dtk`;
        t.classList.toggle('hot', seconds < 20);
      } else t.classList.add('hidden');
    },
    banner(title, sub) {
      const b = el('banner');
      b.querySelector('.banner-title').textContent = title;
      b.querySelector('.banner-sub').textContent = sub || '';
      b.classList.remove('hidden');
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
      window.clearTimeout(b._t);
      b._t = window.setTimeout(() => b.classList.add('hidden'), 3800);
    },
    toast(title, text) {
      const t = el('phone');
      t.querySelector('.phone-name').textContent = title;
      t.querySelector('.phone-text').textContent = text;
      t.classList.remove('hidden');
      window.clearTimeout(t._t);
      t._t = window.setTimeout(() => t.classList.add('hidden'), 5000);
    },
    showOver(title, stats) {
      el('over-title').textContent = title;
      el('over-stats').textContent = stats;
      this.showScreen('over');
    },
    setCrosshair(visible) {
      el('crosshair').classList.toggle('hidden', !visible);
    },
    drawMinimap(world) {
      const w = minimap.width;
      const h = minimap.height;
      const half = SOLMAR.cityHalf;
      const px = (x) => ((x + half) / (half * 2)) * w;
      const pz = (z) => ((z + half) / (half * 2)) * h;
      mctx.clearRect(0, 0, w, h);
      mctx.fillStyle = 'rgba(20,26,34,0.85)';
      mctx.fillRect(0, 0, w, h);
      // Water at the bottom edge.
      mctx.fillStyle = '#1d5f7a';
      mctx.fillRect(0, pz(SOLMAR.waterZ), w, h - pz(SOLMAR.waterZ));
      // Roads.
      mctx.strokeStyle = 'rgba(220,220,220,0.5)';
      mctx.lineWidth = 1;
      for (let c = -half; c <= half; c += SOLMAR.roadGap) {
        mctx.beginPath(); mctx.moveTo(px(c), 0); mctx.lineTo(px(c), h); mctx.stroke();
        mctx.beginPath(); mctx.moveTo(0, pz(c)); mctx.lineTo(w, pz(c)); mctx.stroke();
      }
      // Traffic dots.
      mctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const car of world.traffic) {
        if (!car.alive) continue;
        mctx.fillRect(px(car.x) - 1.5, pz(car.z) - 1.5, 3, 3);
      }
      // Police dots.
      mctx.fillStyle = '#ff4040';
      for (const car of world.police.cars) {
        mctx.beginPath();
        mctx.arc(px(car.x), pz(car.z), 3.5, 0, Math.PI * 2);
        mctx.fill();
      }
      // Mission marker: pulsing yellow diamond.
      const marker = world.missions.marker;
      if (marker) {
        const pulse = 5 + Math.sin(performance.now() * 0.006) * 2;
        mctx.fillStyle = '#ffd24c';
        mctx.beginPath();
        mctx.moveTo(px(marker.x), pz(marker.z) - pulse);
        mctx.lineTo(px(marker.x) + pulse, pz(marker.z));
        mctx.lineTo(px(marker.x), pz(marker.z) + pulse);
        mctx.lineTo(px(marker.x) - pulse, pz(marker.z));
        mctx.closePath();
        mctx.fill();
      }
      // Player arrow.
      const p = world.player;
      const pxp = p.inCar ? p.inCar.x : p.x;
      const pzp = p.inCar ? p.inCar.z : p.z;
      const heading = p.inCar ? p.inCar.heading : p.heading;
      mctx.save();
      mctx.translate(px(pxp), pz(pzp));
      mctx.rotate(heading);
      mctx.fillStyle = '#4fc3f7';
      mctx.beginPath();
      mctx.moveTo(0, -7);
      mctx.lineTo(5, 6);
      mctx.lineTo(0, 3);
      mctx.lineTo(-5, 6);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    },
  };
}
