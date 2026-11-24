// input.js — keyboard + mouse state for Costa Mirada.
// Original code written for this game. Tracks held keys, edge-triggered
// presses, mouse look deltas and shooting clicks. No dependencies.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed by takePressed()
  let mouseDX = 0, mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'brake',
    KeyE: 'enter',
    KeyF: 'punch',
    KeyR: 'respawn',
    KeyP: 'pause',
    KeyM: 'mute',
    KeyH: 'horn',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const a = KEYMAP[e.code];
    if (a) { keys.add(a); pressed.add(a); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) keys.delete(a);
  });
  window.addEventListener('blur', () => { keys.clear(); });

  document.addEventListener('mousemove', (e) => {
    if (locked) { mouseDX += e.movementX || 0; mouseDY += e.movementY || 0; }
  });
  document.addEventListener('mousedown', (e) => {
    // Only canvas clicks count as shooting — menu buttons must not fire.
    if (e.button === 0 && e.target === canvas) { mouseDown = true; mouseClicked = true; }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });

  return {
    isDown(action) { return keys.has(action); },
    // Consume edge presses since last call; returns a Set of action names.
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    isMouseDown() { return mouseDown; },
    isLocked() { return locked; },
    lockPointer() {
      try { canvas.requestPointerLock(); } catch { /* pointer lock unavailable */ }
    },
    unlockPointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    setVirtual(action, down) {
      if (down) keys.add(action); else keys.delete(action);
    },
  };
}
