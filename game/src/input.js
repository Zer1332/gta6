// Keyboard and mouse input. Held keys steer and drive; one-shot presses (enter a car, punch,
// shoot, pause, mute, restart) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. Dragging the mouse orbits the camera.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

const FORWARD = new Set(['ArrowUp', 'KeyW']);
const BACK = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let orbitX = 0;
  let orbitY = 0;
  let dragging = false;
  let mouseDown = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || SPRINT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
    mouseDown = false;
  });

  // pointerdown on the window, not the canvas: the title and pause screens sit on top of the
  // canvas and would otherwise swallow the click that starts the game.
  window.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
    dragging = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitX += event.clientX - lastX;
    orbitY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  function has(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1..1 forward/back, -1..1 left/right, and whether sprint is held. */
    drive() {
      return {
        throttle: (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0),
        steer: (has(LEFT) ? 1 : 0) - (has(RIGHT) ? 1 : 0),
        sprint: has(SPRINT),
      };
    },
    /** Camera orbit dragged with the mouse, in pixels since the last read. */
    takeOrbit() {
      const orbit = { x: orbitX, y: orbitY };
      orbitX = 0;
      orbitY = 0;
      return orbit;
    },
    isMouseDown() {
      return mouseDown;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
