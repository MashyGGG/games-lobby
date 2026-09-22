export const BUG_DEFINITIONS = Object.freeze({
  CollisionOff: {
    name: '碰撞注销', glyph: 'CL//0',
    summary: '指定对象不再阻挡移动',
    sideEffect: '同类阻挡规则仍可能保护危险区域'
  },
  SignFlip: {
    name: '符号翻转', glyph: '+/−',
    summary: '指定规则的下一次数值变化反号',
    sideEffect: '整条规则本次的数值效果都会反转'
  },
  DoubleExecute: {
    name: '重复执行', glyph: '×2',
    summary: '指定事件的效果执行两次',
    sideEffect: '奖励与代价会一起重复'
  },
  DelayedDeath: {
    name: '延迟死亡', glyph: 'DLY',
    summary: '死亡效果延后指定回合',
    sideEffect: '倒计时不会因离开危险而取消'
  },
  ReferenceSwap: {
    name: '引用重定向', glyph: 'REF',
    summary: '把效果目标改为另一实体',
    sideEffect: '目标承受该规则的全部效果'
  }
});

const clone = value => JSON.parse(JSON.stringify(value));

export class BugModule {
  static apply(rules, injection) {
    const rule = rules.find(item => item.id === injection.ruleId);
    if (!rule) throw new Error(`Bug target rule not found: ${injection.ruleId}`);
    rule.runtime ??= {};
    const patch = clone(injection.patch ?? {});

    switch (injection.module) {
      case 'CollisionOff':
        rule.runtime.collisionOffIds = [...new Set([...(rule.runtime.collisionOffIds ?? []), ...(patch.entityIds ?? [])])];
        rule.runtime.collisionOffTypes = [...new Set([...(rule.runtime.collisionOffTypes ?? []), ...(patch.entityTypes ?? [])])];
        break;
      case 'SignFlip':
        rule.runtime.signFlipRemaining = patch.uses ?? 1;
        break;
      case 'DoubleExecute':
        rule.runtime.executionMultiplier = patch.multiplier ?? 2;
        rule.runtime.doubleUses = patch.uses ?? Infinity;
        break;
      case 'DelayedDeath':
        rule.runtime.delayTurns = patch.turns ?? 2;
        break;
      case 'ReferenceSwap':
        rule.runtime.referenceMap = { ...(rule.runtime.referenceMap ?? {}), [patch.from ?? 'player']: patch.to };
        break;
      default:
        throw new Error(`Unknown Bug module: ${injection.module}`);
    }
    rule.runtime.mutatedBy = injection.module;
    return rule;
  }
}
