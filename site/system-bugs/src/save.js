import { GAME_CONFIG } from './config.js';

const defaultSave = () => ({ version: 1, unlocked: 1, completed: {}, settings: { sound: true, vibration: true, reducedMotion: false }, tutorialSeen: {} });

export class SaveStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; this.data = this.load(); }
  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(GAME_CONFIG.saveKey));
      return parsed?.version === 1 ? { ...defaultSave(), ...parsed, settings: { ...defaultSave().settings, ...parsed.settings } } : defaultSave();
    } catch { return defaultSave(); }
  }
  persist() {
    try { this.storage?.setItem(GAME_CONFIG.saveKey, JSON.stringify(this.data)); } catch { /* private mode: session continues */ }
  }
  complete(levelId, stars) {
    this.data.completed[levelId] = Math.max(stars, this.data.completed[levelId] ?? 0);
    this.data.unlocked = Math.max(this.data.unlocked, Number(levelId) + 1);
    this.persist();
  }
  markTutorial(key) { this.data.tutorialSeen[key] = true; this.persist(); }
  updateSetting(key, value) { this.data.settings[key] = value; this.persist(); }
  reset() { this.data = defaultSave(); this.persist(); }
}
