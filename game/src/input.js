// Keyboard input: held keys plus edge-triggered actions consumed once per frame.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_SAVE = 16;

export function createInput() {
  const keys = new Set();
  let actions = 0;
  const map = {
    KeyE: ACTION_ENTER, KeyF: ACTION_PUNCH, KeyP: ACTION_PAUSE,
    Escape: ACTION_PAUSE, KeyM: ACTION_MUTE, KeyQ: ACTION_SAVE,
  };
  function onDown(event) {
    if (event.repeat) { keys.add(event.code); return; }
    keys.add(event.code);
    if (map[event.code]) actions |= map[event.code];
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onUp(event) { keys.delete(event.code); }
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', () => keys.clear());

  function axis() {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    return { x, y, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }
  function takeActions() { const a = actions; actions = 0; return a; }
  function setKey(code, down) { if (down) keys.add(code); else keys.delete(code); }
  function clear() { keys.clear(); actions = 0; }
  return { axis, takeActions, setKey, clear, keys };
}
