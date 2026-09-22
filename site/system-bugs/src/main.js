import { Game } from './game.js';

globalThis.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  globalThis.__SYSTEM_BUG__ = game;
  setTimeout(() => { document.querySelector('#boot-log').textContent = '15 个规则沙盒已隔离 · 等待操作员'; }, 450);
});
