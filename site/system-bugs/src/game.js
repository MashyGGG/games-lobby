import { GAME_CONFIG, DIRECTIONS } from './config.js';
import { EventBus } from './event-bus.js';
import { RuleEngine } from './rule-engine.js';
import { BugModule, BUG_DEFINITIONS } from './bug-modules.js';
import { cloneLevel, LEVELS, CHAPTERS } from './level-config.js';
import { SaveStore } from './save.js';
import { AudioSystem } from './audio.js';
import { Renderer } from './renderer.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

export class Game {
  constructor() {
    this.save = new SaveStore();
    this.audio = new AudioSystem(this.save.data.settings);
    this.renderer = new Renderer($('#game-canvas'));
    this.level = null; this.engine = null; this.player = null;
    this.selectedBugs = new Set(); this.injected = false; this.paused = false; this.touchStart = null;
    this.bindUi(); this.renderLevelSelect(); this.updateContinue();
  }

  bindUi() {
    $('#start-button').addEventListener('click', () => this.showLevels());
    $('#continue-button').addEventListener('click', () => this.startLevel(Math.min(this.save.data.unlocked, LEVELS.length)));
    $$('[data-action="home"]').forEach(button => button.addEventListener('click', () => this.showScreen('boot')));
    $$('[data-action="levels"]').forEach(button => button.addEventListener('click', () => this.showLevels()));
    $$('[data-action="settings"]').forEach(button => button.addEventListener('click', () => this.openSettings()));
    $$('[data-action="pause"]').forEach(button => button.addEventListener('click', () => this.openPause()));
    $$('[data-move]').forEach(button => button.addEventListener('click', () => this.move(button.dataset.move)));
    $('#inject-button').addEventListener('click', () => this.inject());
    $('#rules-toggle').addEventListener('click', () => {
      const list=$('#rule-list'); const hidden=list.classList.toggle('hidden'); $('#rules-toggle').setAttribute('aria-expanded', String(!hidden));
    });
    document.addEventListener('keydown', event => {
      const map={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
      if (map[event.key]) { event.preventDefault(); this.move(map[event.key]); }
      if (event.key === 'Escape' && this.level) this.openPause();
    });
    const canvas=$('#game-canvas');
    canvas.addEventListener('pointerdown', event => { this.touchStart={x:event.clientX,y:event.clientY}; canvas.setPointerCapture?.(event.pointerId); });
    canvas.addEventListener('pointerup', event => {
      if (!this.touchStart) return; const dx=event.clientX-this.touchStart.x, dy=event.clientY-this.touchStart.y; this.touchStart=null;
      if (Math.hypot(dx,dy)<18) return;
      this.move(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
    });
  }

  showScreen(id) { $$('.screen').forEach(screen=>screen.classList.toggle('active',screen.id===id)); }
  updateContinue() { $('#continue-button').classList.toggle('hidden', Object.keys(this.save.data.completed).length===0); }
  showLevels() { this.paused=true; this.level=null; this.renderLevelSelect(); this.showScreen('level-select'); }

  renderLevelSelect(chapter=CHAPTERS[0]) {
    $('#chapter-tabs').innerHTML=CHAPTERS.map(name=>`<button class="${name===chapter?'active':''}" data-chapter="${name}">${name}</button>`).join('');
    $$('[data-chapter]').forEach(button=>button.addEventListener('click',()=>this.renderLevelSelect(button.dataset.chapter)));
    $('#level-grid').innerHTML=LEVELS.filter(level=>level.chapter===chapter).map(level=>{
      const unlocked=Number(level.id)<=this.save.data.unlocked; const stars=this.save.data.completed[level.id]??0;
      return `<button class="level-card ${unlocked?'':'locked'}" data-level="${level.id}" ${unlocked?'':'disabled'}><b>${String(level.id).padStart(2,'0')}</b><span>${level.title}</span><span class="stars">${'◆'.repeat(stars)}${'◇'.repeat(3-stars)}</span></button>`;
    }).join('');
    $$('[data-level]').forEach(button=>button.addEventListener('click',()=>this.startLevel(button.dataset.level)));
  }

  startLevel(levelId) {
    this.level=cloneLevel(levelId); this.selectedBugs.clear(); this.injected=false; this.paused=false;
    this.player={id:'player',type:'player',x:this.level.start.x,y:this.level.start.y,active:true,stats:{...GAME_CONFIG.player,...this.level.initialStats}};
    const bus=new EventBus();
    this.engine=new RuleEngine({rules:this.level.rules,entities:this.level.entities,player:this.player,eventBus:bus,limits:GAME_CONFIG.limits});
    this.bindEvents(bus); this.renderer.setScene(this.level,this.player,this.level.entities);
    $('#level-code').textContent=`CASE ${String(levelId).padStart(2,'0')}`; $('#level-title').textContent=this.level.title;
    this.showScreen('game'); this.renderRules(); this.renderBugs(); this.renderStatus(); this.log(`> ${this.level.briefing}`);
    if (this.level.tutorial && !this.save.data.tutorialSeen[levelId]) this.openModal('新手协议',this.level.tutorial,[{label:'开始分析',primary:true,action:()=>{this.closeModal();this.save.markTutorial(levelId);}}]);
  }

  bindEvents(bus) {
    bus.on('ruleTriggered',({rule,executions})=>this.log(`RULE ${rule.id}${executions>1?' ×'+executions:''}`));
    bus.on('ruleSkipped',({rule})=>this.log(`BUG 绕过 ${rule.id}`,'warn'));
    bus.on('scheduled',({turns})=>{this.log(`终止已排队：${turns} 回合`,'warn');this.toast(`死亡判定延迟 ${turns} 回合`);});
    bus.on('signFlipped',()=>this.toast('数值符号已翻转'));
    bus.on('statChanged',({key,delta})=>{this.log(`${key.toUpperCase()} ${delta>=0?'+':''}${delta}`);this.audio.play(delta>0?'collect':'move');this.renderStatus();});
    bus.on('log',({text,tone})=>this.log(text,tone));
    bus.on('win',payload=>this.finish(true,payload.reason));
    bus.on('lose',payload=>this.finish(false,payload.reason));
  }

  renderRules() {
    const shown=this.engine.rules.filter(rule=>rule.visible!==false).slice(0,4);
    $('#rule-list').innerHTML=shown.map(rule=>`<article class="rule-card ${rule.runtime?.mutatedBy?'mutated':''}" title="${rule.label}"><b>${rule.runtime?.mutatedBy?'[BUG] ':''}${rule.id}</b><span>${rule.display}</span></article>`).join('');
  }

  renderBugs() {
    $('#bug-tray').innerHTML=this.level.bugs.map(choice=>{
      const def=BUG_DEFINITIONS[choice.module]; const selected=this.selectedBugs.has(choice.id);
      return `<button class="bug-card ${selected?'selected':''} ${this.injected?'used':''}" data-bug="${choice.id}" ${this.injected?'disabled':''}><b>${def.glyph} ${choice.title}</b><small>${choice.description}<br>副作用：${def.sideEffect}</small></button>`;
    }).join('');
    $$('[data-bug]').forEach(button=>button.addEventListener('click',()=>this.toggleBug(button.dataset.bug)));
    $('#budget-value').textContent=String(this.level.budget-this.selectedBugs.size);
    $('#inject-button').disabled=this.injected||this.selectedBugs.size===0;
  }

  toggleBug(id) {
    if (this.injected) return;
    if (this.selectedBugs.has(id)) this.selectedBugs.delete(id);
    else if (this.selectedBugs.size < this.level.budget) this.selectedBugs.add(id);
    else this.toast(`错误预算上限：${this.level.budget}`);
    this.renderBugs();
  }

  inject() {
    if (this.injected||!this.selectedBugs.size) return;
    for (const id of this.selectedBugs) {
      const injection=this.level.bugs.find(item=>item.id===id); BugModule.apply(this.engine.rules,injection);
      this.log(`INJECT ${injection.module} → ${injection.ruleId}`,'warn');
    }
    this.injected=true; this.audio.play('inject'); this.feedback([25,30,25]);
    if(!this.save.data.settings.reducedMotion)this.renderer.burst(this.player);
    this.renderRules(); this.renderBugs(); this.toast('异常已写入 · 移动权限开放');
  }

  move(directionName) {
    if (!this.level||this.paused||this.engine?.ended) return;
    if (!this.injected) { this.toast('请先选择并注入 BUG'); return; }
    const d=DIRECTIONS[directionName]; if (!d) return;
    const to={x:this.player.x+d.x,y:this.player.y+d.y};
    if (to.x<0||to.y<0||to.x>=this.level.width||to.y>=this.level.height) { this.audio.play('blocked');this.feedback(20);this.toast('越界请求被拒绝');return; }
    const context={from:{x:this.player.x,y:this.player.y},to,blocked:false}; this.engine.dispatch('tryMove',context);
    if (context.blocked) { this.audio.play('blocked');this.feedback(20);this.log('MOVE_DENIED');this.renderer.draw();return; }
    this.player.x=to.x;this.player.y=to.y;this.audio.play('move');
    const source=this.engine.entityAt(to); if(source) this.engine.dispatch('enter',{source,to});
    this.renderer.draw();
    if(!this.engine.ended) this.engine.advanceTurn();
    this.renderStatus();
  }

  renderStatus() {
    if(!this.player||!this.engine)return;
    $('#hp-value').textContent=this.player.stats.hp; $('#key-value').textContent=this.player.stats.keys; $('#turn-value').textContent=this.engine.turn;
    $('#budget-value').textContent=String(Math.max(0,this.level.budget-this.selectedBugs.size));
  }

  log(text,tone='') {
    const line=document.createElement('div'); if(tone)line.className=tone; line.textContent=text; const log=$('#event-log'); log.prepend(line);
    while(log.children.length>GAME_CONFIG.limits.maxLogLines)log.lastElementChild.remove();
  }

  toast(text) { const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),1500); }

  feedback(pattern) { if(this.save.data.settings.vibration&&navigator.vibrate)navigator.vibrate(pattern); }

  finish(won,reason) {
    this.paused=true; this.audio.play(won?'win':'lose'); this.feedback(won?[35,35,60]:[90,40,90]);
    if(!this.save.data.settings.reducedMotion)this.renderer.burst(this.player,won?GAME_CONFIG.colors.exit:GAME_CONFIG.colors.red,24);
    if(won){ const stars=Math.max(1,3-Math.max(0,this.selectedBugs.size-this.level.budget));this.save.complete(this.level.id,stars);this.updateContinue(); }
    const actions=won?
      [{label:'关卡列表',action:()=>{this.closeModal();this.showLevels();}},{label:Number(this.level.id)<LEVELS.length?'下一关':'查看档案',primary:true,action:()=>{const next=Math.min(LEVELS.length,Number(this.level.id)+1);this.closeModal();Number(this.level.id)<LEVELS.length?this.startLevel(next):this.showLevels();}}]:
      [{label:'关卡列表',action:()=>{this.closeModal();this.showLevels();}},{label:'重新开始',primary:true,action:()=>{const id=this.level.id;this.closeModal();this.startLevel(id);}}];
    this.openModal(won?'校验通过':'进程终止',reason,actions,won?'CASE RESOLVED':'SYSTEM HALT');
  }

  openPause() {
    if(!this.level)return;this.paused=true;
    this.openModal('执行已暂停','世界状态已冻结。可继续、重新载入本关或返回档案。',[
      {label:'返回档案',action:()=>{this.closeModal();this.showLevels();}},
      {label:'重新开始',action:()=>{const id=this.level.id;this.closeModal();this.startLevel(id);}},
      {label:'继续',primary:true,action:()=>{this.paused=false;this.closeModal();}}
    ]);
  }

  openSettings() {
    const render=()=>{
      const s=this.save.data.settings;
      this.openModal('终端设置',`<div class="setting-row"><span>合成音效</span><button data-setting="sound">${s.sound?'开启':'关闭'}</button></div><div class="setting-row"><span>触觉反馈</span><button data-setting="vibration">${s.vibration?'开启':'关闭'}</button></div><div class="setting-row"><span>减少动效</span><button data-setting="reducedMotion">${s.reducedMotion?'开启':'关闭'}</button></div>`,[{label:'完成',primary:true,action:()=>this.closeModal()}],'SETTINGS',true);
      $$('[data-setting]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.setting;this.save.updateSetting(key,!this.save.data.settings[key]);render();}));
    };render();
  }

  openModal(title,body,actions,kicker='SYSTEM MESSAGE',html=false) {
    $('#modal-title').textContent=title; $('#modal-kicker').textContent=kicker;
    if(html)$('#modal-body').innerHTML=body;else $('#modal-body').textContent=body;
    const target=$('#modal-actions');target.innerHTML='';
    actions.forEach(spec=>{const button=document.createElement('button');button.textContent=spec.label;if(spec.primary)button.className='primary';button.addEventListener('click',spec.action);target.append(button);});
    $('#modal').classList.remove('hidden');
  }
  closeModal() { $('#modal').classList.add('hidden'); }
}
