// SOLMAR — input.js
// Keyboard + mouse (pointer lock) untuk jalan kaki, mengemudi, dan menembak.
// Menyimpan state mentah; logika game membaca dari sini tiap frame.

export function createInput() {
  const input = {
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    mouseClicked: false, // sekali per klik (dikonsumsi game tiap frame)
    locked: false,
    // Callback sekali tekan (bukan tahan) — diisi game.
    onPress: null,

    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.keys.add(e.code);
        if (this.onPress) this.onPress(e.code);
        if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => this.keys.clear());
      document.addEventListener('mousemove', (e) => {
        if (!this.locked) return;
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === canvas;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this.mouseDown = true;
        this.mouseClicked = true;
        if (!this.locked && !window.__SOLMAR_SHOT_MODE) {
          try {
            canvas.requestPointerLock();
          } catch (err) {}
        }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouseDown = false;
      });
      // Mencegah menu konteks mengganggu bidikan.
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    down(code) {
      return this.keys.has(code);
    },
    // WASD / panah sebagai vektor -1..1 (x: kanan, y: maju).
    moveVector() {
      let x = 0;
      let y = 0;
      if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
      if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      return { x, y };
    },
    consumeMouse() {
      const dx = this.mouseDX;
      const dy = this.mouseDY;
      this.mouseDX = 0;
      this.mouseDY = 0;
      return { dx, dy };
    },
    consumeClick() {
      const c = this.mouseClicked;
      this.mouseClicked = false;
      return c;
    },
    // Dipakai playtest/debug: meniru satu penekanan tombol.
    press(code) {
      if (this.onPress) this.onPress(code);
    },
  };
  return input;
}
