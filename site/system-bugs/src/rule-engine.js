const clone = value => JSON.parse(JSON.stringify(value));
const OPS = { '==': (a,b) => a === b, '!=': (a,b) => a !== b, '>': (a,b) => a > b, '>=': (a,b) => a >= b, '<': (a,b) => a < b, '<=': (a,b) => a <= b };

export class RuleEngine {
  constructor({ rules, entities, player, eventBus, limits = {} }) {
    this.rules = clone(rules).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    this.entities = entities;
    this.player = player;
    this.bus = eventBus;
    this.turn = 0;
    this.scheduled = [];
    this.maxScheduled = limits.maxScheduledEffects ?? 16;
    this.ended = false;
  }

  rulesFor(trigger) { return this.rules.filter(rule => rule.enabled !== false && rule.trigger === trigger); }
  entityAt(pos) { return this.entities.find(entity => entity.active !== false && entity.x === pos?.x && entity.y === pos?.y); }
  entityById(id) { return id === 'player' ? this.player : this.entities.find(entity => entity.id === id && entity.active !== false); }

  evaluate(condition, context) {
    if (!condition || condition.type === 'always') return true;
    if (condition.all) return condition.all.every(item => this.evaluate(item, context));
    if (condition.any) return condition.any.some(item => this.evaluate(item, context));
    if (condition.not) return !this.evaluate(condition.not, context);
    switch (condition.type) {
      case 'sourceType': return context.source?.type === condition.value;
      case 'sourceId': return context.source?.id === condition.value;
      case 'entityAt': {
        const entity = this.entityAt(context[condition.position ?? 'to']);
        if (!entity) return false;
        return (!condition.entityType || entity.type === condition.entityType) &&
          (!condition.entityId || entity.id === condition.entityId) &&
          (!condition.state || entity.state?.[condition.state.key] === condition.state.value);
      }
      case 'stat': {
        const target = this.resolveTarget(condition.target ?? 'player', context, {});
        return Boolean(target) && OPS[condition.op ?? '>='](target.stats?.[condition.key] ?? 0, condition.value);
      }
      case 'turn': return OPS[condition.op ?? '>='](this.turn, condition.value);
      default: return false;
    }
  }

  shouldSkipCollision(rule, context) {
    if (!rule.runtime?.collisionOffIds?.length && !rule.runtime?.collisionOffTypes?.length) return false;
    const target = this.entityAt(context.to) ?? context.source;
    return Boolean(target) && (rule.runtime.collisionOffIds?.includes(target.id) || rule.runtime.collisionOffTypes?.includes(target.type));
  }

  dispatch(trigger, context = {}) {
    if (this.ended) return context;
    for (const rule of this.rulesFor(trigger)) {
      if (!this.evaluate(rule.condition, context)) continue;
      if (this.shouldSkipCollision(rule, context)) {
        this.bus.emit('ruleSkipped', { rule, reason: 'CollisionOff' });
        continue;
      }
      let executions = rule.runtime?.executionMultiplier ?? 1;
      if (rule.runtime?.doubleUses !== undefined) {
        if (rule.runtime.doubleUses <= 0) executions = 1;
        else if (Number.isFinite(rule.runtime.doubleUses)) rule.runtime.doubleUses -= 1;
      }
      this.bus.emit('ruleTriggered', { rule, executions });
      for (let n = 0; n < executions; n += 1) {
        for (const effect of rule.effects) this.applyEffect(effect, context, rule);
      }
    }
    return context;
  }

  resolveTarget(reference, context, runtime) {
    const mapped = runtime.referenceMap?.[reference] ?? reference;
    if (mapped === 'player') return this.player;
    if (mapped === 'source') return context.source;
    if (mapped === 'atTo') return this.entityAt(context.to);
    return this.entityById(mapped);
  }

  applyEffect(effect, context, rule) {
    if (this.ended) return;
    const runtime = rule.runtime ?? {};
    if ((effect.type === 'lose' || effect.type === 'kill') && runtime.delayTurns > 0 && !context.fromSchedule) {
      if (this.scheduled.length < this.maxScheduled) {
        this.scheduled.push({ due: this.turn + runtime.delayTurns, effect: clone(effect), context: { sourceId: context.source?.id }, ruleId: rule.id });
        this.bus.emit('scheduled', { turns: runtime.delayTurns, rule });
      }
      return;
    }
    switch (effect.type) {
      case 'blockMovement': context.blocked = effect.value; break;
      case 'statDelta': {
        const target = this.resolveTarget(effect.target ?? 'player', context, runtime);
        if (!target) break;
        target.stats ??= {};
        let delta = effect.delta;
        if ((runtime.signFlipRemaining ?? 0) > 0) {
          delta *= -1;
          runtime.signFlipRemaining -= 1;
          this.bus.emit('signFlipped', { rule, delta });
        }
        target.stats[effect.key] = (target.stats[effect.key] ?? 0) + delta;
        this.bus.emit('statChanged', { target, key: effect.key, delta, value: target.stats[effect.key], rule });
        this.dispatch('statChanged', { target, source: context.source, key: effect.key });
        break;
      }
      case 'setState': {
        const target = this.resolveTarget(effect.target, context, runtime);
        if (target) { target.state ??= {}; target.state[effect.key] = effect.value; }
        break;
      }
      case 'despawn': {
        const target = this.resolveTarget(effect.target ?? 'source', context, runtime);
        if (target && target !== this.player) target.active = false;
        break;
      }
      case 'kill': {
        const target = this.resolveTarget(effect.target ?? 'player', context, runtime);
        if (target === this.player) this.end(false, effect.message ?? '进程被规则终止');
        else if (target) target.active = false;
        break;
      }
      case 'win': this.end(true, effect.message ?? '规则目标已满足'); break;
      case 'lose': this.end(false, effect.message ?? '世界状态不可恢复'); break;
      case 'log': this.bus.emit('log', { text: effect.text, tone: effect.tone }); break;
      default: throw new Error(`Unknown effect type: ${effect.type}`);
    }
  }

  advanceTurn() {
    this.turn += 1;
    const dueNow = this.scheduled.filter(item => item.due <= this.turn);
    this.scheduled = this.scheduled.filter(item => item.due > this.turn);
    for (const item of dueNow) {
      const rule = this.rules.find(candidate => candidate.id === item.ruleId);
      const source = item.context.sourceId ? this.entityById(item.context.sourceId) : undefined;
      if (rule) this.applyEffect(item.effect, { source, fromSchedule: true }, rule);
    }
    this.dispatch('turnEnd', {});
  }

  end(won, reason) {
    if (this.ended) return;
    this.ended = true;
    this.bus.emit(won ? 'win' : 'lose', { reason, turn: this.turn });
  }
}
