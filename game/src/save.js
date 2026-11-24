// save.js — localStorage save/load for Costa Mirada.
// Original code written for this game. One key, one JSON blob, defensive
// parsing so a corrupt save never breaks the menu.
export const SAVE_KEY = 'costa-mirada-save-v1';

export function defaultSave() {
  return {
    mission: 0,            // next mission index (0..9), 10 = story complete
    money: 250,
    health: 100,
    ammo: 24,
    day: 1,
    timeOfDay: 12.0,       // hours, 0..24
    playerPos: null,       // {x, z} or null = garage spawn
    completed: [],         // mission indices finished
    bestRaceMs: null,
    totalEarned: 0,
    carsStolen: 0,
    wanted: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
