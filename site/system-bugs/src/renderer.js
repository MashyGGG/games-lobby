import { GAME_CONFIG } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.level = null;
    this.player = null;
    this.entities = [];
    this.particles = [];
    this.raf = 0;
  }

  setScene(level, player, entities) {
    this.level = level; this.player = player; this.entities = entities; this.draw();
  }

  metrics() {
    const { canvasWidth: w, canvasHeight: h, padding } = GAME_CONFIG.grid;
    const cell = Math.min((w - padding * 2) / this.level.width, (h - padding * 2) / this.level.height);
    return { w, h, cell, ox: (w - cell * this.level.width) / 2, oy: (h - cell * this.level.height) / 2 };
  }

  draw() {
    if (!this.level) return;
    const c = this.ctx;
    const { w, h, cell, ox, oy } = this.metrics();
    c.fillStyle = GAME_CONFIG.colors.background; c.fillRect(0, 0, w, h);
    c.lineWidth = 1; c.strokeStyle = GAME_CONFIG.colors.grid;
    for (let x = 0; x <= this.level.width; x += 1) { c.beginPath(); c.moveTo(ox + x*cell, oy); c.lineTo(ox + x*cell, oy + this.level.height*cell); c.stroke(); }
    for (let y = 0; y <= this.level.height; y += 1) { c.beginPath(); c.moveTo(ox, oy + y*cell); c.lineTo(ox + this.level.width*cell, oy + y*cell); c.stroke(); }
    for (const entity of this.entities) if (entity.active !== false) this.drawEntity(entity, cell, ox, oy);
    this.drawPlayer(this.player, cell, ox, oy);
    this.drawParticles();
  }

  center(entity, cell, ox, oy) { return { x: ox + (entity.x + .5) * cell, y: oy + (entity.y + .5) * cell }; }

  drawEntity(entity, cell, ox, oy) {
    const c = this.ctx; const p = this.center(entity, cell, ox, oy); const s = cell * .62;
    c.save(); c.translate(p.x, p.y); c.lineWidth = Math.max(3, cell * .035);
    switch (entity.type) {
      case 'wall':
        c.fillStyle = GAME_CONFIG.colors.wall; c.fillRect(-s/2, -s/2, s, s);
        c.strokeStyle = '#78909a'; c.beginPath(); c.moveTo(-s/2,0); c.lineTo(s/2,0); c.moveTo(0,-s/2); c.lineTo(0,s/2); c.stroke(); break;
      case 'exit':
        c.strokeStyle = GAME_CONFIG.colors.exit; c.strokeRect(-s/2,-s/2,s,s); c.strokeRect(-s*.32,-s*.32,s*.64,s*.64); break;
      case 'hazard':
        c.fillStyle = GAME_CONFIG.colors.hazard; c.beginPath(); c.moveTo(0,-s*.55); c.lineTo(s*.55,s*.45); c.lineTo(-s*.55,s*.45); c.closePath(); c.fill(); c.fillStyle='#07141c'; c.fillRect(-s*.05,-s*.2,s*.1,s*.35); break;
      case 'key':
        c.strokeStyle = GAME_CONFIG.colors.key; c.beginPath(); c.arc(-s*.18,0,s*.22,0,Math.PI*2); c.moveTo(0,0); c.lineTo(s*.48,0); c.lineTo(s*.48,s*.18); c.moveTo(s*.28,0); c.lineTo(s*.28,s*.18); c.stroke(); break;
      case 'door': case 'gate':
        c.strokeStyle = GAME_CONFIG.colors.door; c.globalAlpha = entity.state.open ? .25 : 1;
        c.strokeRect(-s*.44,-s*.55,s*.88,s*1.1); c.beginPath(); c.moveTo(-s*.44,-s*.25); c.lineTo(s*.44,-s*.25); c.moveTo(-s*.44,s*.1); c.lineTo(s*.44,s*.1); c.stroke(); break;
      case 'battery':
        c.fillStyle = GAME_CONFIG.colors.pickup; c.rotate(Math.PI/4); c.fillRect(-s*.3,-s*.3,s*.6,s*.6); c.fillStyle='#07141c'; c.fillRect(-s*.07,-s*.2,s*.14,s*.4); c.fillRect(-s*.2,-s*.07,s*.4,s*.14); break;
      case 'fragile':
        c.strokeStyle = GAME_CONFIG.colors.fragile; c.strokeRect(-s/2,-s/2,s,s); c.beginPath(); c.moveTo(-s*.3,-s*.45); c.lineTo(s*.05,-s*.06); c.lineTo(-s*.08,s*.16); c.lineTo(s*.32,s*.48); c.stroke(); break;
    }
    c.restore();
  }

  drawPlayer(player, cell, ox, oy) {
    const c = this.ctx; const p = this.center(player, cell, ox, oy); const s = cell*.5;
    c.save(); c.translate(p.x,p.y); c.fillStyle=GAME_CONFIG.colors.player; c.shadowColor=GAME_CONFIG.colors.player; c.shadowBlur=16;
    c.beginPath(); c.moveTo(0,-s*.55); c.lineTo(s*.55,0); c.lineTo(0,s*.55); c.lineTo(-s*.55,0); c.closePath(); c.fill(); c.shadowBlur=0;
    c.fillStyle='#07141c'; c.fillRect(-s*.2,-s*.05,s*.12,s*.12); c.fillRect(s*.08,-s*.05,s*.12,s*.12); c.restore();
  }

  burst(entity, color = GAME_CONFIG.colors.red, count = 12) {
    if (!this.level) return;
    const { cell, ox, oy } = this.metrics(); const p = this.center(entity, cell, ox, oy);
    const allowed = Math.min(count, GAME_CONFIG.limits.maxParticles - this.particles.length);
    for (let i=0; i<allowed; i+=1) this.particles.push({ x:p.x,y:p.y,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,life:22,color });
    this.animate();
  }

  drawParticles() {
    const c=this.ctx;
    for (const p of this.particles) { c.globalAlpha=Math.max(0,p.life/22); c.fillStyle=p.color; c.fillRect(p.x,p.y,5,5); c.globalAlpha=1; }
  }

  animate() {
    if (this.raf) return;
    const tick=()=>{
      for (const p of this.particles) { p.x+=p.vx; p.y+=p.vy; p.vy+=.14; p.life-=1; }
      this.particles=this.particles.filter(p=>p.life>0); this.draw();
      if (this.particles.length) this.raf=requestAnimationFrame(tick); else this.raf=0;
    };
    this.raf=requestAnimationFrame(tick);
  }
}
