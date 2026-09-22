export const GAME_CONFIG = Object.freeze({
  version: '0.1.0',
  saveKey: 'system_bug_save_v1',
  grid: { columns: 6, rows: 8, canvasWidth: 720, canvasHeight: 960, padding: 42 },
  player: { hp: 3, keys: 0, energy: 0 },
  limits: { maxEntities: 64, maxLogLines: 4, maxScheduledEffects: 16, maxParticles: 36 },
  colors: {
    background: '#07141c', grid: '#17313a', player: '#57f5d0', wall: '#35515c',
    exit: '#ffc857', hazard: '#ff5e6c', key: '#9f86ff', door: '#bf8d48',
    pickup: '#62b6ff', fragile: '#ea7cff', ghost: '#6f9295'
  },
  scoring: { baseStars: 3, retryPenalty: 0, overBudgetPenalty: 1 },
  audio: { masterVolume: 0.18 }
});

export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
});
