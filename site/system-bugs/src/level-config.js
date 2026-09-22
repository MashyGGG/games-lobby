const effect = {
  block: value => ({ type: 'blockMovement', value }),
  delta: (key, delta, target = 'player') => ({ type: 'statDelta', target, key, delta }),
  state: (target, key, value) => ({ type: 'setState', target, key, value }),
  despawn: (target = 'source') => ({ type: 'despawn', target }),
  win: message => ({ type: 'win', message }),
  lose: message => ({ type: 'lose', message }),
  kill: (target = 'player', message) => ({ type: 'kill', target, message }),
  log: (text, tone) => ({ type: 'log', text, tone })
};

const cond = {
  source: value => ({ type: 'sourceType', value }),
  at: (entityType, state) => ({ type: 'entityAt', position: 'to', entityType, state }),
  stat: (key, op, value, target = 'player') => ({ type: 'stat', target, key, op, value }),
  all: (...items) => ({ all: items })
};

const RULES = {
  wall: (type = 'wall', id = 'wall_block') => ({ id, label: `${type === 'wall' ? '墙体' : '脆弱块'}具有实体碰撞`, display: `玩家 → ${type === 'wall' ? '墙体' : '脆弱块'}：移动被阻止`, trigger: 'tryMove', priority: 10, condition: cond.at(type), effects: [effect.block(true)] }),
  exit: (extraCondition, id = 'exit_resolve') => ({ id, label: '抵达出口即完成校验', display: '玩家 → 出口：判定通关', trigger: 'enter', priority: 90, condition: extraCondition ? cond.all(cond.source('exit'), extraCondition) : cond.source('exit'), effects: [effect.win('规则链闭合，出口已授权')] }),
  hazardDamage: (amount = -3, id = 'hazard_damage') => ({ id, label: `危险区使 HP ${amount}`, display: `进入危险区 → HP ${amount}`, trigger: 'enter', priority: 10, condition: cond.source('hazard'), effects: [effect.delta('hp', amount)] }),
  hazardKill: (id = 'hazard_kill') => ({ id, label: '危险区立即终止玩家', display: '进入危险区 → 玩家死亡', trigger: 'enter', priority: 10, condition: cond.source('hazard'), effects: [effect.kill('player', '危险判定已执行')] }),
  death: (stat = 'hp', threshold = 0, id = 'death_check') => ({ id, label: `${stat.toUpperCase()}≤${threshold} 时死亡`, display: `${stat.toUpperCase()} ≤ ${threshold} → 进程终止`, trigger: 'statChanged', priority: 80, condition: cond.stat(stat, '<=', threshold), effects: [effect.lose(`${stat.toUpperCase()} 已越过安全阈值`)] }),
  debt: (stat = 'keys', id = 'debt_check') => ({ id, label: `${stat.toUpperCase()}<0 时死亡`, display: `${stat.toUpperCase()} < 0 → 进程终止`, trigger: 'statChanged', priority: 80, condition: cond.stat(stat, '<', 0), effects: [effect.lose('资源出现非法负值')] }),
  key: (amount = 1, id = 'key_collect') => ({ id, label: `钥匙拾取后 +${amount}`, display: `拾取钥匙 → KEY +${amount}`, trigger: 'enter', priority: 10, condition: cond.source('key'), effects: [effect.delta('keys', amount), effect.despawn()] }),
  battery: (amount = 1, id = 'battery_collect') => ({ id, label: `数据核提供 ${amount} 能量`, display: `拾取数据核 → ENERGY +${amount}`, trigger: 'enter', priority: 10, condition: cond.source('battery'), effects: [effect.delta('energy', amount), effect.despawn()] }),
  doorBlock: (type = 'door', id = 'door_block') => ({ id, label: '锁定门阻止移动', display: '玩家 → 锁定门：移动被阻止', trigger: 'tryMove', priority: 10, condition: cond.at(type, { key: 'open', value: false }), effects: [effect.block(true)] }),
  doorOpen: ({ cost = 1, key = 'keys', need = cost, type = 'door', id = 'door_open', extra = [] } = {}) => ({ id, label: `门开启后 ${key.toUpperCase()} -${cost}`, display: `${key.toUpperCase()} ≥ ${need} → 开门并 -${cost}`, trigger: 'tryMove', priority: 20, condition: cond.all(cond.at(type, { key: 'open', value: false }), cond.stat(key, '>=', need)), effects: [effect.delta(key, -cost), ...extra, effect.state('atTo', 'open', true), effect.block(false)] }),
  fragileBreak: (id = 'fragile_1') => ({ id: `break_${id}`, label: '脆弱块 HP≤0 时移除', display: '脆弱块 HP ≤ 0 → 清除', trigger: 'statChanged', priority: 60, condition: cond.stat('hp', '<=', 0, id), effects: [effect.despawn(id)] })
};

const ENTITY_TYPES = {
  '#': 'wall', 'E': 'exit', 'X': 'hazard', 'K': 'key', 'D': 'door', 'C': 'battery', 'F': 'fragile', 'G': 'gate'
};

function parseMap(rows) {
  const counts = {};
  const entities = [];
  let start = { x: 0, y: 0 };
  rows.forEach((row, y) => [...row].forEach((char, x) => {
    if (char === 'P') { start = { x, y }; return; }
    const type = ENTITY_TYPES[char];
    if (!type) return;
    counts[type] = (counts[type] ?? 0) + 1;
    const entity = { id: `${type}_${counts[type]}`, type, x, y, active: true, state: {}, stats: {} };
    if (type === 'door' || type === 'gate') entity.state.open = false;
    if (type === 'fragile') entity.stats.hp = 3;
    entities.push(entity);
  }));
  return { start, entities };
}

const bug = (id, module, ruleId, patch, title, description) => ({ id, module, ruleId, patch, title, description });

function level(config) {
  const parsed = parseMap(config.map);
  return Object.freeze({
    budget: 1,
    initialStats: {},
    briefing: '读取规则，选择异常模块，再移动到出口。',
    ...config,
    start: parsed.start,
    entities: parsed.entities,
    width: 6,
    height: 8
  });
}

export const LEVELS = Object.freeze([
  level({
    id: '1', chapter: '单 Bug 教学', title: '不存在的墙', tutorial: '先选中“碰撞注销”，点击注入。随后用方向键或在棋盘上滑动。',
    briefing: '只有一面墙，但它完整封锁了出口。注销指定墙体的碰撞。',
    map: ['......','......','......','.P#E..','......','......','......','......'],
    rules: [RULES.wall(), RULES.exit()],
    bugs: [bug('b1', 'CollisionOff', 'wall_block', { entityIds: ['wall_1'] }, '注销 WALL_1', '穿过它；也失去它提供的隔离')]
  }),
  level({
    id: '2', chapter: '单 Bug 教学', title: '负债门', tutorial: '“符号翻转”只影响目标规则的下一次数值变化。注意副作用不会被撤销。',
    briefing: '门允许零钥匙尝试，但扣费会令 KEY 变为非法负值。', initialStats: { keys: 0 },
    map: ['......','......','......','.P.D.E','......','......','......','......'],
    rules: [RULES.doorBlock(), RULES.doorOpen({ cost: 1, need: 0 }), RULES.debt(), RULES.exit()],
    bugs: [bug('b2', 'SignFlip', 'door_open', { uses: 1 }, '翻转开门扣费', 'KEY -1 变为 +1；仅生效一次')]
  }),
  level({
    id: '3', chapter: '单 Bug 教学', title: '一次，不够', tutorial: '“重复执行”会重复整条规则：收益和代价都可能发生两次。',
    briefing: '闸门需要 2 能量，场上只有一个提供 1 能量的数据核。',
    map: ['......','......','......','.P.CGE','......','......','......','......'],
    rules: [RULES.battery(), RULES.doorBlock('gate', 'gate_block'), RULES.doorOpen({ cost: 2, key: 'energy', need: 2, type: 'gate', id: 'gate_open' }), RULES.exit()],
    bugs: [bug('b3', 'DoubleExecute', 'battery_collect', { uses: 1 }, '重复数据核结算', 'ENERGY +1 执行两次；清除也执行两次')]
  }),
  level({
    id: '4', chapter: '单 Bug 教学', title: '迟到的终止', tutorial: '延迟不会取消死亡，只给你一个短窗口。出口判定必须先发生。',
    briefing: '危险带无法绕行。把终止推迟 2 回合，在倒计时前抵达出口。',
    map: ['......','......','......','.PXE..','......','......','......','......'],
    rules: [RULES.hazardKill(), RULES.exit()],
    bugs: [bug('b4', 'DelayedDeath', 'hazard_kill', { turns: 2 }, '延迟危险判定', '2 回合后仍会终止玩家')]
  }),
  level({
    id: '5', chapter: '单 Bug 教学', title: '错误收件人', tutorial: '引用重定向改变效果接收者。观察谁会替你承受完整效果。',
    briefing: '把危险区的伤害从玩家重定向到挡路的脆弱块。',
    map: ['......','......','......','.PXFE.','......','......','......','......'],
    rules: [RULES.hazardDamage(), RULES.death(), RULES.fragileBreak(), RULES.wall('fragile','fragile_block'), RULES.exit()],
    bugs: [bug('b5', 'ReferenceSwap', 'hazard_damage', { from: 'player', to: 'fragile_1' }, '重定向伤害', '脆弱块替玩家承受 -3 HP')]
  }),
  level({
    id: '6', chapter: '二选一', title: '防火墙', briefing: '两种异常都合法，但只有局部注销能打开路径。',
    map: ['......','..#...','..#...','.P#E..','......','......','......','......'],
    rules: [RULES.wall(), RULES.exit()],
    bugs: [
      bug('b6a', 'CollisionOff', 'wall_block', { entityIds: ['wall_3'] }, '注销中段墙', '指定 WALL_3 可穿透'),
      bug('b6b', 'DoubleExecute', 'exit_resolve', { uses: 1 }, '重复出口判定', '抵达出口后执行两次；不会打开路径')
    ]
  }),
  level({
    id: '7', chapter: '二选一', title: '治疗性伤害', briefing: '出口只接收 HP≥4。危险区通常扣除 1 HP。',
    map: ['......','......','......','.PX.E.','......','......','......','......'],
    rules: [RULES.hazardDamage(-1), RULES.death(), RULES.exit(cond.stat('hp', '>=', 4))],
    bugs: [
      bug('b7a', 'SignFlip', 'hazard_damage', { uses: 1 }, '翻转首次伤害', 'HP -1 变为 HP +1'),
      bug('b7b', 'DelayedDeath', 'death_check', { turns: 2 }, '延迟低血量死亡', '不会满足出口的 HP 条件')
    ]
  }),
  level({
    id: '8', chapter: '二选一', title: '复制权限', briefing: '一把钥匙、两点门禁。选择影响资源来源，而不是消费端。',
    map: ['......','......','......','.PK.DE','......','......','......','......'],
    rules: [RULES.key(), RULES.doorBlock(), RULES.doorOpen({ cost: 2, need: 2 }), RULES.exit()],
    bugs: [
      bug('b8a', 'DoubleExecute', 'key_collect', { uses: 1 }, '重复钥匙拾取', '唯一钥匙结算两次'),
      bug('b8b', 'SignFlip', 'door_open', { uses: 1 }, '翻转门禁消费', '仍需先满足 KEY≥2')
    ]
  }),
  level({
    id: '9', chapter: '二选一', title: '四拍窗口', briefing: '死亡立即发生，出口在危险区之后三步。',
    map: ['......','......','......','.PX..E','......','......','......','......'],
    rules: [RULES.hazardKill(), RULES.exit()],
    bugs: [
      bug('b9a', 'DelayedDeath', 'hazard_kill', { turns: 4 }, '延迟 4 回合', '倒计时结束仍会终止'),
      bug('b9b', 'DoubleExecute', 'exit_resolve', { uses: 1 }, '重复出口', '无法穿过危险区')
    ]
  }),
  level({
    id: '10', chapter: '二选一', title: '借来的坐标', briefing: '脆弱块封路。一次危险伤害恰好能清除它。',
    map: ['......','......','......','.PX.FE','......','......','......','......'],
    rules: [RULES.hazardDamage(), RULES.death(), RULES.fragileBreak(), RULES.wall('fragile','fragile_block'), RULES.exit()],
    bugs: [
      bug('b10a', 'ReferenceSwap', 'hazard_damage', { from: 'player', to: 'fragile_1' }, '伤害 → 脆弱块', '玩家不受伤，脆弱块被清除'),
      bug('b10b', 'SignFlip', 'hazard_damage', { uses: 1 }, '伤害 → 治疗', '能存活，但脆弱块仍在')
    ]
  }),
  level({
    id: '11', chapter: '组合规则', title: '双重通行税', budget: 2, briefing: '穿过专用墙后，出口还会扣除 1 信用；负信用立即终止。', initialStats: { credits: 0 },
    map: ['......','......','......','.P#E..','......','......','......','......'],
    rules: [RULES.wall(), { id:'exit_toll', label:'进入出口扣除 1 信用', display:'进入出口 → CREDIT -1', trigger:'enter', priority:5, condition:cond.source('exit'), effects:[effect.delta('credits',-1)] }, RULES.debt('credits'), RULES.exit()],
    bugs: [
      bug('b11a', 'CollisionOff', 'wall_block', { entityIds:['wall_1'] }, '注销通道墙', '允许穿过 WALL_1'),
      bug('b11b', 'SignFlip', 'exit_toll', { uses:1 }, '翻转出口税', 'CREDIT -1 变为 +1'),
      bug('b11c', 'DoubleExecute', 'exit_toll', { uses:1 }, '重复出口税', '负信用会更严重')
    ]
  }),
  level({
    id: '12', chapter: '组合规则', title: '带电逃生', budget: 2, briefing: '复制能量开启闸门，再借死亡延迟越过危险带。',
    map: ['......','......','......','PCG.XE','......','......','......','......'],
    rules: [RULES.battery(), RULES.doorBlock('gate','gate_block'), RULES.doorOpen({cost:2,key:'energy',need:2,type:'gate',id:'gate_open'}), RULES.hazardKill(), RULES.exit()],
    bugs: [
      bug('b12a','DoubleExecute','battery_collect',{uses:1},'重复能量结算','获得 2 ENERGY'),
      bug('b12b','DelayedDeath','hazard_kill',{turns:2},'延迟危险终止','争取抵达出口的一回合'),
      bug('b12c','SignFlip','gate_open',{uses:1},'翻转闸门消费','无法满足开启前置条件')
    ]
  }),
  level({
    id: '13', chapter: '组合规则', title: '拆墙信号', budget: 2, briefing: '让伤害清除脆弱块，再注销实体墙的碰撞。',
    map: ['......','......','......','PXF#E.','......','......','......','......'],
    rules: [RULES.hazardDamage(), RULES.death(), RULES.fragileBreak(), RULES.wall('fragile','fragile_block'), RULES.wall(), RULES.exit()],
    bugs: [
      bug('b13a','ReferenceSwap','hazard_damage',{from:'player',to:'fragile_1'},'伤害 → 脆弱块','清除第一重阻挡'),
      bug('b13b','CollisionOff','wall_block',{entityIds:['wall_1']},'注销实体墙','穿过第二重阻挡'),
      bug('b13c','DelayedDeath','death_check',{turns:2},'延迟 HP 死亡','脆弱块仍会挡路')
    ]
  }),
  level({
    id: '14', chapter: '组合规则', title: '握手两次', budget: 2, briefing: '出口要求 SYNC≥2。门每次握手消耗 1 KEY 并增加 1 SYNC。', initialStats:{keys:1,sync:0},
    map: ['......','......','......','.P.D.E','......','......','......','......'],
    rules: [RULES.doorBlock(), RULES.doorOpen({cost:1,need:1,id:'door_open',extra:[effect.delta('sync',1)]}), RULES.debt(), RULES.exit(cond.stat('sync','>=',2))],
    bugs: [
      bug('b14a','DoubleExecute','door_open',{uses:1},'重复门禁握手','消费与同步均执行两次'),
      bug('b14b','SignFlip','door_open',{uses:1},'翻转首次消费','第一笔 KEY -1 变为 +1'),
      bug('b14c','CollisionOff','door_block',{entityIds:['door_1']},'注销门体碰撞','绕过握手但 SYNC 不足')
    ]
  }),
  level({
    id: '15', chapter: '组合规则', title: '最终异常预算', budget: 2, briefing: '出口要求 2 ENERGY；危险区之后还有一个脆弱块。',
    map: ['......','......','......','PCXFE.','......','......','......','......'],
    rules: [RULES.battery(), RULES.hazardDamage(), RULES.death(), RULES.fragileBreak(), RULES.wall('fragile','fragile_block'), RULES.exit(cond.stat('energy','>=',2))],
    bugs: [
      bug('b15a','DoubleExecute','battery_collect',{uses:1},'重复数据核','满足出口能量校验'),
      bug('b15b','ReferenceSwap','hazard_damage',{from:'player',to:'fragile_1'},'伤害 → 脆弱块','存活并清除道路'),
      bug('b15c','SignFlip','hazard_damage',{uses:1},'翻转伤害','能存活，但脆弱块仍在')
    ]
  })
]);

export const LEVEL_BY_ID = new Map(LEVELS.map(item => [item.id, item]));
export const CHAPTERS = Object.freeze([...new Set(LEVELS.map(item => item.chapter))]);

export function cloneLevel(levelId) {
  const source = LEVEL_BY_ID.get(String(levelId));
  if (!source) throw new Error(`Unknown level: ${levelId}`);
  return JSON.parse(JSON.stringify(source));
}
