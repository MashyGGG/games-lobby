import { GAME_CONFIG } from './config.js';

export class AudioSystem {
  constructor(settings) { this.settings = settings; this.context = null; }
  ensureContext() {
    if (!this.context) this.context = new (globalThis.AudioContext ?? globalThis.webkitAudioContext)();
    if (this.context.state === 'suspended') this.context.resume();
  }
  tone(frequency, duration = 0.08, type = 'square', offset = 0) {
    if (!this.settings.sound || !(globalThis.AudioContext || globalThis.webkitAudioContext)) return;
    this.ensureContext();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(GAME_CONFIG.audio.masterVolume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
  play(name) {
    const cues = {
      move: () => this.tone(180, .035, 'square'),
      blocked: () => this.tone(90, .09, 'sawtooth'),
      inject: () => { this.tone(280, .08); this.tone(560, .1, 'square', .07); },
      collect: () => { this.tone(520, .06, 'sine'); this.tone(760, .08, 'sine', .05); },
      win: () => [420, 620, 840].forEach((f, i) => this.tone(f, .16, 'triangle', i * .1)),
      lose: () => { this.tone(170, .2, 'sawtooth'); this.tone(80, .3, 'square', .13); }
    };
    cues[name]?.();
  }
  suspend() { if (this.context?.state === 'running') this.context.suspend(); }
  resume() { if (this.settings.sound && this.context?.state === 'suspended') this.context.resume(); }
}
