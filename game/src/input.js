// SOLMAR — keyboard and mouse. Keys are held in a set; edge presses (E, F, R,
// P, M, digits, Space-as-jump) are reported once through justPressed, which the
// main loop drains every frame. Mouse movement feeds the third-person camera
// while pointer lock is held; a plain click still fires the weapon when the
// pointer is not locked, so the game stays playable in a plain browser tab.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    get locked() { return locked; },
    down(code) { return keys.has(code); },
    justPressed(code) { return pressed.has(code); },
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    get mouseHeld() { return mouseDown; },
    lockPointer() {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    },
    unlockPointer() {
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    },
    // Steering and throttle as -1..1, read straight from the held keys.
    drive() {
      return {
        throttle: (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0),
        steer: (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0) - (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0),
        handbrake: this.down('Space'),
      };
    },
    walk() {
      let x = 0;
      let z = 0;
      if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
      if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      const len = Math.hypot(x, z) || 1;
      return { x: x / len, z: z / len, run: this.down('ShiftLeft') || this.down('ShiftRight') };
    },
    endFrame() { pressed.clear(); },
  };
}
