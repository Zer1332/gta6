// SOLMAR — input.js
// Keyboard + mouse: WASD, Shift lari, E masuk/keluar mobil, F interaksi,
// Space lompat/rem tangan, klik menembak, R isi ulang, 1/2 ganti senjata,
// P/Esc pause, M mute. Mouse look memakai pointer lock saat bermain.

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.onKey = null; // callback(code) untuk aksi sekali tekan
    this.onMouseDown = null;
    this.enabled = true;
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouseDown = true;
      if (this.onMouseDown) this.onMouseDown(e.button);
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('click', () => {
      if (!this.locked && this.enabled) {
        try {
          canvas.requestPointerLock();
        } catch (e) {
          /* pointer lock tidak tersedia di headless */
        }
      }
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Ambil dan nol-kan akumulasi gerakan mouse sejak frame lalu.
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
