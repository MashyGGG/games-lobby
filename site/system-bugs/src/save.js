import { GAME_CONFIG } from './config.js';

export const SAVE_SCHEMA_VERSION = 1;

export const createDefaultSave = () => ({
  version: SAVE_SCHEMA_VERSION,
  unlocked: 1,
  completed: {},
  settings: { sound: true, vibration: true, reducedMotion: false },
  tutorialSeen: {}
});

export function migrateSave(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createDefaultSave();
  const source = { ...value };
  if (source.version == null || source.version === 0) {
    source.version = 1;
    if (typeof source.muted === 'boolean') {
      source.settings = { ...(source.settings ?? {}), sound: !source.muted };
      delete source.muted;
    }
  }
  if (source.version !== SAVE_SCHEMA_VERSION) return createDefaultSave();
  const defaults = createDefaultSave();
  return {
    ...defaults,
    ...source,
    version: SAVE_SCHEMA_VERSION,
    unlocked: Math.max(1, Number(source.unlocked) || 1),
    completed: source.completed && typeof source.completed === 'object' && !Array.isArray(source.completed) ? source.completed : {},
    settings: { ...defaults.settings, ...(source.settings ?? {}) },
    tutorialSeen: source.tutorialSeen && typeof source.tutorialSeen === 'object' && !Array.isArray(source.tutorialSeen) ? source.tutorialSeen : {}
  };
}

export class SaveStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; this.data = this.load(); }
  load() {
    try {
      const raw = this.storage?.getItem(GAME_CONFIG.saveKey);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return migrateSave(parsed);
    } catch { return createDefaultSave(); }
  }
  persist() {
    try { this.storage?.setItem(GAME_CONFIG.saveKey, JSON.stringify(this.data)); return true; } catch { return false; }
  }
  complete(levelId, stars) {
    this.data.completed[levelId] = Math.max(stars, this.data.completed[levelId] ?? 0);
    this.data.unlocked = Math.max(this.data.unlocked, Number(levelId) + 1);
    this.persist();
  }
  markTutorial(key) { this.data.tutorialSeen[key] = true; this.persist(); }
  updateSetting(key, value) { this.data.settings[key] = value; this.persist(); }
  reset() { this.data = createDefaultSave(); this.persist(); }
}
