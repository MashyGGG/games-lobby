import { GAME_CONFIG, DIRECTIONS } from '../config.js';
import { EventBus } from '../event-bus.js';
import { RuleEngine } from '../rule-engine.js';
import { BugModule } from '../bug-modules.js';
import { cloneLevel } from '../level-config.js';

export class GameSession {
  constructor({ levelId, eventBus = new EventBus(), limits = GAME_CONFIG.limits, playerDefaults = GAME_CONFIG.player } = {}) {
    this.level = cloneLevel(levelId);
    this.bus = eventBus;
    this.player = {
      id: 'player', type: 'player', x: this.level.start.x, y: this.level.start.y, active: true,
      stats: { ...playerDefaults, ...this.level.initialStats }
    };
    this.engine = new RuleEngine({ rules: this.level.rules, entities: this.level.entities, player: this.player, eventBus, limits });
    this.selectedBugs = new Set();
    this.injected = false;
    this.paused = false;
  }

  get remainingBudget() { return Math.max(0, this.level.budget - this.selectedBugs.size); }

  toggleBug(id) {
    if (this.injected) return { ok: false, reason: 'alreadyInjected' };
    const choice = this.level.bugs.find(item => item.id === id);
    if (!choice) return { ok: false, reason: 'unknownBug' };
    if (this.selectedBugs.has(id)) {
      this.selectedBugs.delete(id);
      return { ok: true, selected: false, remainingBudget: this.remainingBudget };
    }
    if (this.remainingBudget <= 0) return { ok: false, reason: 'budgetExceeded', remainingBudget: 0 };
    this.selectedBugs.add(id);
    return { ok: true, selected: true, remainingBudget: this.remainingBudget };
  }

  inject() {
    if (this.injected) return { ok: false, reason: 'alreadyInjected', applied: [] };
    if (this.selectedBugs.size === 0) return { ok: false, reason: 'nothingSelected', applied: [] };
    const applied = [];
    for (const id of this.selectedBugs) {
      const injection = this.level.bugs.find(item => item.id === id);
      if (!injection) continue;
      BugModule.apply(this.engine.rules, injection);
      applied.push(injection);
    }
    this.injected = true;
    return { ok: true, applied };
  }

  move(directionName) {
    if (this.paused) return { ok: false, reason: 'paused' };
    if (this.engine.ended) return { ok: false, reason: 'ended' };
    if (!this.injected) return { ok: false, reason: 'notInjected' };
    const direction = DIRECTIONS[directionName];
    if (!direction) return { ok: false, reason: 'unknownDirection' };
    const to = { x: this.player.x + direction.x, y: this.player.y + direction.y };
    if (to.x < 0 || to.y < 0 || to.x >= this.level.width || to.y >= this.level.height) {
      return { ok: false, reason: 'outOfBounds', to };
    }
    const context = { from: { x: this.player.x, y: this.player.y }, to, blocked: false };
    this.engine.dispatch('tryMove', context);
    if (context.blocked) return { ok: false, reason: 'blocked', to };
    this.player.x = to.x;
    this.player.y = to.y;
    const source = this.engine.entityAt(to);
    if (source) this.engine.dispatch('enter', { source, to });
    if (!this.engine.ended) this.engine.advanceTurn();
    return { ok: true, moved: true, to, source, ended: this.engine.ended };
  }

  pause() { this.paused = true; }
  resume() { if (!this.engine.ended) this.paused = false; }

  snapshot() {
    return {
      levelId: this.level.id,
      player: { x: this.player.x, y: this.player.y, stats: { ...this.player.stats } },
      selectedBugs: [...this.selectedBugs],
      injected: this.injected,
      paused: this.paused,
      turn: this.engine.turn,
      ended: this.engine.ended,
      remainingBudget: this.remainingBudget
    };
  }
}
