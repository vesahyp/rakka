/**
 * All sound is synthesized here with Web Audio: no files, no loading, and
 * the same procedural approach as the sprites. The sim never touches this;
 * it pushes names onto `state.sounds` and the game loop drains them into
 * `play()`. Music is a short kantele-like loop in a minor pentatonic scale.
 *
 * The context is created on the first user gesture (phones require it) and
 * everything is a no-op until then. Mute is remembered in localStorage.
 */
export type SoundName =
  | 'hit'
  | 'kill'
  | 'gem'
  | 'levelup'
  | 'chest'
  | 'chestbig'
  | 'evolve'
  | 'boss'
  | 'bosskill'
  | 'hurt'
  | 'death'
  | 'revive'
  | 'swarm'
  | 'pickup'
  | 'ember'
  | 'tap';

const MUTE_KEY = 'rakka.muted';

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private whine: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<SoundName, number>();
  private musicTimer = 0;
  private musicStep = 0;
  private musicOn = false;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* fine */
    }
  }

  /** Call from a user gesture. Safe to call many times. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    // One second of white noise for hits and wind.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* fine */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number; slide?: number; out?: GainNode | null; delay?: number } = {}): void {
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(opts.out ?? this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private burst(dur: number, opts: { gain?: number; hp?: number; lp?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = opts.hp ?? 400;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts.lp ?? 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Rate limits per sound, so a crowd does not become a wall of clicks. */
  private allow(name: SoundName, minGap: number): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -1e9;
    if (now - last < minGap) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  play(name: SoundName): void {
    if (!this.ctx || this.muted) return;
    const r = () => Math.random();
    switch (name) {
      case 'hit':
        if (!this.allow('hit', 45)) return;
        this.burst(0.05, { gain: 0.08, hp: 1200, lp: 5000 });
        break;
      case 'kill':
        if (!this.allow('kill', 60)) return;
        this.tone(320 + r() * 200, 0.09, { type: 'square', gain: 0.05, slide: 0.5 });
        this.burst(0.06, { gain: 0.05, hp: 300, lp: 2500 });
        break;
      case 'gem': {
        if (!this.allow('gem', 40)) return;
        // Rising blips as berries stream in.
        const n = ((this.lastPlayed.get('gem') ?? 0) / 40) % 12;
        this.tone(880 * Math.pow(2, (n % 8) / 12), 0.07, { type: 'sine', gain: 0.06 });
        break;
      }
      case 'pickup':
        this.tone(660, 0.12, { type: 'triangle', gain: 0.12 });
        this.tone(990, 0.16, { type: 'triangle', gain: 0.1, delay: 0.08 });
        break;
      case 'levelup':
        [0, 4, 7, 12].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.22, { type: 'triangle', gain: 0.14, delay: i * 0.06 }));
        break;
      case 'chest':
        [0, 7, 12].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.3, { type: 'triangle', gain: 0.14, delay: i * 0.1 }));
        break;
      case 'chestbig':
        [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.35, { type: 'triangle', gain: 0.14, delay: i * 0.08 }));
        break;
      case 'evolve':
        [0, 7, 12, 19, 24].forEach((s, i) => {
          this.tone(261 * Math.pow(2, s / 12), 0.5, { type: 'sawtooth', gain: 0.08, delay: i * 0.09 });
          this.tone(261 * Math.pow(2, s / 12) * 1.005, 0.5, { type: 'triangle', gain: 0.1, delay: i * 0.09 });
        });
        break;
      case 'boss':
        this.tone(55, 1.6, { type: 'sawtooth', gain: 0.22, attack: 0.05, slide: 0.7 });
        this.burst(1.2, { gain: 0.12, hp: 60, lp: 500 });
        break;
      case 'bosskill':
        this.burst(0.8, { gain: 0.2, hp: 80, lp: 1200 });
        [0, 3, 7, 12].forEach((s, i) => this.tone(196 * Math.pow(2, s / 12), 0.6, { type: 'triangle', gain: 0.14, delay: 0.2 + i * 0.12 }));
        break;
      case 'hurt':
        if (!this.allow('hurt', 120)) return;
        this.tone(140, 0.16, { type: 'square', gain: 0.1, slide: 0.6 });
        this.burst(0.1, { gain: 0.1, hp: 100, lp: 1500 });
        break;
      case 'death':
        [0, -3, -7, -12].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), 0.5, { type: 'sawtooth', gain: 0.1, delay: i * 0.22 }));
        this.burst(1.0, { gain: 0.1, hp: 60, lp: 800, delay: 0.3 });
        break;
      case 'revive':
        [0, 5, 9, 12, 16].forEach((s, i) => this.tone(440 * Math.pow(2, s / 12), 0.6, { type: 'sine', gain: 0.12, delay: i * 0.07 }));
        break;
      case 'swarm':
        this.tone(220, 0.8, { type: 'sawtooth', gain: 0.06, slide: 1.3 });
        this.tone(223, 0.8, { type: 'sawtooth', gain: 0.06, slide: 1.3 });
        break;
      case 'ember':
        this.burst(0.5, { gain: 0.25, hp: 200, lp: 4000 });
        this.tone(80, 0.5, { type: 'sine', gain: 0.2, slide: 0.5 });
        break;
      case 'tap':
        this.tone(700, 0.05, { type: 'square', gain: 0.04 });
        break;
    }
  }

  /** Mosquito whine: volume follows the number of swarm enemies nearby. */
  setSwarm(level: number): void {
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    if (!this.whine) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 560;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 900;
      lp.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.sfx);
      osc.start();
      lfo.start();
      this.whine = { osc, gain, lfo };
    }
    const target = Math.min(0.06, level * 0.004);
    this.whine.gain.gain.setTargetAtTime(this.musicOn ? target : 0, ctx.currentTime, 0.4);
  }

  // ---------------------------------------------------------------- music
  // Sixteen steps, a minor pentatonic on A, two voices: a plucked melody
  // and a low drone. Nothing is scheduled while stopped.
  private static SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
  private static PATTERN = [0, 2, 4, 2, 5, 4, 2, 0, 1, 2, 4, 7, 5, 4, 2, 1];

  startMusic(): void {
    this.musicOn = true;
    if (this.musicTimer) return;
    this.musicStep = 0;
    const tick = () => {
      if (!this.musicOn) {
        this.musicTimer = 0;
        return;
      }
      this.musicTimer = window.setTimeout(tick, 210);
      if (!this.ctx || this.muted) return;
      const step = this.musicStep++;
      const bar = Math.floor(step / 16);
      const i = step % 16;
      const deg = Audio.PATTERN[(i + bar * 3) % 16];
      const base = 220;
      const f = base * Math.pow(2, Audio.SCALE[deg % Audio.SCALE.length] / 12) * (bar % 4 === 3 ? 1.5 : 1);
      if (i % 2 === 0 || bar % 2 === 1) this.tone(f, 0.5, { type: 'triangle', gain: 0.09, out: this.music });
      if (i % 8 === 0) this.tone(base / 2, 1.6, { type: 'sine', gain: 0.12, attack: 0.02, out: this.music });
      if (i % 4 === 2) this.tone(base / 2 * Math.pow(2, 7 / 12), 0.9, { type: 'sine', gain: 0.06, attack: 0.02, out: this.music });
    };
    tick();
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.whine && this.ctx) this.whine.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }
}

export const audio = new Audio();
