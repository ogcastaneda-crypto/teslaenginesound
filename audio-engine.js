/**
 * Tesla Sound Engine - Web Audio API Synthesizer (v2 Enhanced)
 * Presets: V8, V10, Rotary, Cyber EV, Harley, Moto Sport, F1, Tractor, Lancha
 */
class EngineAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.isRunning = false;

    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.dryGain    = null;

    this.oscNodes        = [];
    this.fmCarrier       = null;
    this.fmModulator     = null;
    this.fmModGain       = null;
    this.cylinderLFO     = null;
    this.cylinderLFOGain = null;
    this.oscMixGain      = null;

    this.mainFilter   = null;
    this.exhaustFilter = null;

    this.intakeNoiseNode = null;
    this.intakeFilter    = null;
    this.intakeFilter2   = null;
    this.intakeGain      = null;

    this.distortionNode = null;

    this.currentPreset  = 'v8_muscle';
    this.masterVolume   = 0.8;
    this.idleVolume     = 0.5;
    this.popFxEnabled   = true;

    this.currentRPM      = 800;
    this.currentThrottle = 0;
    this.lastPopTime     = 0;

    this.presets = {
      // ── MOTORES ORIGINALES ────────────────────────────────────────────────
      v8_muscle: {
        cylinders: 8, idleRPM: 750,
        harmonics: [[1.0,0.9],[0.5,0.7],[2.0,0.5],[3.0,0.25],[4.0,0.12]],
        filterBaseFreq: 220, filterThrottleMult: 1800,
        filterQIdle: 3.0, filterQThrottle: 1.2,
        distortionAmount: 280,
        fmDepthIdle: 8,  fmDepthThrottle: 80,  fmRatio: 0.5,
        lfoRate: 12, lfoDepthIdle: 0.06, lfoDepthThrottle: 0.02,
        reverbMix: 0.18,
        intakeFreqIdle: 900,  intakeFreqThrottle: 3200,
        popIntense: 1.4, popCountMax: 3,
      },
      v10_exotic: {
        cylinders: 10, idleRPM: 900,
        harmonics: [[1.0,0.85],[0.5,0.4],[2.0,0.6],[3.0,0.35],[4.0,0.2],[5.0,0.08]],
        filterBaseFreq: 320, filterThrottleMult: 3500,
        filterQIdle: 2.5, filterQThrottle: 0.8,
        distortionAmount: 160,
        fmDepthIdle: 5,  fmDepthThrottle: 55,  fmRatio: 0.75,
        lfoRate: 15, lfoDepthIdle: 0.04, lfoDepthThrottle: 0.015,
        reverbMix: 0.12,
        intakeFreqIdle: 1400, intakeFreqThrottle: 5000,
        popIntense: 1.0, popCountMax: 2,
      },
      rotary_turbo: {
        cylinders: 6, idleRPM: 1000,
        harmonics: [[1.0,0.7],[2.0,0.8],[3.0,0.5],[4.0,0.3],[6.0,0.15]],
        filterBaseFreq: 500, filterThrottleMult: 5500,
        filterQIdle: 4.0, filterQThrottle: 0.6,
        distortionAmount: 380,
        fmDepthIdle: 15, fmDepthThrottle: 200, fmRatio: 1.5,
        lfoRate: 20, lfoDepthIdle: 0.08, lfoDepthThrottle: 0.03,
        reverbMix: 0.22,
        intakeFreqIdle: 2200, intakeFreqThrottle: 7000,
        popIntense: 2.0, popCountMax: 5,
      },
      cyber_hyper: {
        cylinders: 12, idleRPM: 600,
        harmonics: [[1.0,0.6],[0.25,0.5],[2.0,0.3],[4.0,0.4],[8.0,0.2]],
        filterBaseFreq: 100, filterThrottleMult: 6000,
        filterQIdle: 1.5, filterQThrottle: 0.4,
        distortionAmount: 60,
        fmDepthIdle: 2,  fmDepthThrottle: 30,  fmRatio: 3.0,
        lfoRate: 8, lfoDepthIdle: 0.02, lfoDepthThrottle: 0.01,
        reverbMix: 0.30,
        intakeFreqIdle: 3000, intakeFreqThrottle: 10000,
        popIntense: 0.3, popCountMax: 1,
      },

      // ── NUEVOS PRESETS ────────────────────────────────────────────────────
      harley: {
        // V-Twin con offset 45° → el "potato potato" característico
        cylinders: 2, idleRPM: 700,
        harmonics: [
          [0.5, 1.0],  // Sub dominante = rumble profundo
          [1.0, 0.9],  // Fundamental
          [1.5, 0.35], // Armónico impar (grit)
          [2.0, 0.22],
          [3.0, 0.10],
        ],
        filterBaseFreq: 160, filterThrottleMult: 900,
        filterQIdle: 5.5, filterQThrottle: 1.8,
        distortionAmount: 380,
        fmDepthIdle: 25, fmDepthThrottle: 140, fmRatio: 0.875, // 315/360 ≈ offset V-twin
        lfoRate: 11, lfoDepthIdle: 0.22, lfoDepthThrottle: 0.07, // Pulsación muy marcada
        reverbMix: 0.28,
        intakeFreqIdle: 350, intakeFreqThrottle: 1400,
        popIntense: 3.0, popCountMax: 2,
      },
      moto_sport: {
        // Inline-4 de alta revolución (tipo Kawasaki Ninja / CBR)
        cylinders: 4, idleRPM: 1400,
        harmonics: [
          [1.0, 0.70],
          [2.0, 0.65],
          [3.0, 0.45],
          [4.0, 0.28],
          [5.0, 0.14],
          [6.0, 0.06],
        ],
        filterBaseFreq: 900, filterThrottleMult: 7000,
        filterQIdle: 2.0, filterQThrottle: 0.5,
        distortionAmount: 110,
        fmDepthIdle: 5,  fmDepthThrottle: 35,  fmRatio: 1.0,
        lfoRate: 23, lfoDepthIdle: 0.04, lfoDepthThrottle: 0.012,
        reverbMix: 0.10,
        intakeFreqIdle: 2500, intakeFreqThrottle: 9000,
        popIntense: 0.7, popCountMax: 2,
      },
      f1: {
        // V8 de F1 — idle a ~5000 RPM, screaming a altas vueltas
        cylinders: 8, idleRPM: 5000,
        harmonics: [
          [1.0, 0.55],
          [2.0, 0.80], // 2do armónico prominente
          [3.0, 0.55],
          [4.0, 0.38],
          [6.0, 0.22],
          [8.0, 0.10],
        ],
        filterBaseFreq: 2500, filterThrottleMult: 10000,
        filterQIdle: 1.2, filterQThrottle: 0.4,
        distortionAmount: 80,
        fmDepthIdle: 8,  fmDepthThrottle: 30,  fmRatio: 2.0,
        lfoRate: 28, lfoDepthIdle: 0.025, lfoDepthThrottle: 0.008,
        reverbMix: 0.08,
        intakeFreqIdle: 6000, intakeFreqThrottle: 18000,
        popIntense: 0.4, popCountMax: 1,
      },
      tractor: {
        // Diesel 2 cilindros — el "tuk tuk" legendario
        cylinders: 2, idleRPM: 500,
        harmonics: [
          [0.5, 1.0],  // Sub muy dominante
          [1.0, 0.85],
          [1.5, 0.30], // Armónico impar (carácter diesel)
          [2.0, 0.15],
        ],
        filterBaseFreq: 70, filterThrottleMult: 350,
        filterQIdle: 7.0, filterQThrottle: 2.5,
        distortionAmount: 550,
        fmDepthIdle: 45, fmDepthThrottle: 220, fmRatio: 0.25,
        lfoRate: 8, lfoDepthIdle: 0.32, lfoDepthThrottle: 0.14, // Pulsación fortísima
        reverbMix: 0.35,
        intakeFreqIdle: 180, intakeFreqThrottle: 700,
        popIntense: 0.8, popCountMax: 1,
      },
      lancha: {
        // Motor fuera de borda 2T — burbujeo + aceleración explosiva
        cylinders: 2, idleRPM: 1800,
        harmonics: [
          [1.0, 0.80],
          [2.0, 0.65],
          [3.0, 0.40],
          [4.0, 0.20],
        ],
        filterBaseFreq: 280, filterThrottleMult: 2800,
        filterQIdle: 4.5, filterQThrottle: 1.2,
        distortionAmount: 230,
        fmDepthIdle: 18, fmDepthThrottle: 110, fmRatio: 0.66,
        lfoRate: 20, lfoDepthIdle: 0.10, lfoDepthThrottle: 0.04,
        reverbMix: 0.40, // Más reverb — sensación al aire libre / agua
        intakeFreqIdle: 1200, intakeFreqThrottle: 4500,
        popIntense: 0.5, popCountMax: 1,
      },
    };
  }

  // ─── INIT ────────────────────────────────────────────────────────────────
  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
  }

  // ─── START ───────────────────────────────────────────────────────────────
  start() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.isRunning) return;

    const cfg = this.presets[this.currentPreset];
    const now = this.ctx.currentTime;

    // Compresor
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value      = 12;
    this.compressor.ratio.value     = 4;
    this.compressor.attack.value    = 0.003;
    this.compressor.release.value   = 0.25;

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, now);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Reverb
    this.reverbNode = this._createSyntheticReverb(1.4, 0.5);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = cfg.reverbMix;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0 - cfg.reverbMix;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.dryGain.connect(this.compressor);

    // Distorsión tanh
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve     = this._makeTanhCurve(cfg.distortionAmount);
    this.distortionNode.oversample = '4x';
    this.distortionNode.connect(this.dryGain);
    this.distortionNode.connect(this.reverbNode);

    // Filtro principal LP resonante
    this.mainFilter = this.ctx.createBiquadFilter();
    this.mainFilter.type = 'lowpass';
    this.mainFilter.frequency.setValueAtTime(cfg.filterBaseFreq, now);
    this.mainFilter.Q.setValueAtTime(cfg.filterQIdle, now);
    this.mainFilter.connect(this.distortionNode);

    // Filtro highpass DC
    this.exhaustFilter = this.ctx.createBiquadFilter();
    this.exhaustFilter.type = 'highpass';
    this.exhaustFilter.frequency.value = 40;
    this.exhaustFilter.Q.value = 0.5;
    this.exhaustFilter.connect(this.mainFilter);

    // LFO de pulsación de cilindros
    this.cylinderLFO = this.ctx.createOscillator();
    this.cylinderLFO.type = 'sine';
    this.cylinderLFO.frequency.setValueAtTime(cfg.lfoRate, now);
    this.cylinderLFOGain = this.ctx.createGain();
    this.cylinderLFOGain.gain.setValueAtTime(cfg.lfoDepthIdle, now);
    this.cylinderLFO.connect(this.cylinderLFOGain);

    // FM Synthesis
    const baseFreq = this._firingFreq(cfg.idleRPM, cfg.cylinders);
    this.fmModulator = this.ctx.createOscillator();
    this.fmModulator.type = 'sine';
    this.fmModulator.frequency.setValueAtTime(baseFreq * cfg.fmRatio, now);
    this.fmModGain = this.ctx.createGain();
    this.fmModGain.gain.setValueAtTime(cfg.fmDepthIdle, now);
    this.fmModulator.connect(this.fmModGain);

    this.fmCarrier = this.ctx.createOscillator();
    this.fmCarrier.type = 'sawtooth';
    this.fmCarrier.frequency.setValueAtTime(baseFreq, now);
    this.fmModGain.connect(this.fmCarrier.frequency);

    const fmCarrierGain = this.ctx.createGain();
    fmCarrierGain.gain.value = 0.5;
    this.fmCarrier.connect(fmCarrierGain);

    // Mezcla de osciladores armónicos
    this.oscMixGain = this.ctx.createGain();
    this.oscMixGain.gain.setValueAtTime(this.idleVolume * 0.4, now);
    this.cylinderLFOGain.connect(this.oscMixGain.gain); // LFO modula el gain

    this.oscNodes = [];
    cfg.harmonics.forEach(([mult, level]) => {
      const osc = this.ctx.createOscillator();
      osc.type = mult <= 1.0 ? 'sawtooth' : mult <= 2.0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * mult, now);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(level, now);
      osc.connect(g);
      g.connect(this.oscMixGain);
      this.oscNodes.push({ osc, gain: g, mult, baseLevel: level });
      osc.start(now);
    });

    fmCarrierGain.connect(this.oscMixGain);
    this.oscMixGain.connect(this.exhaustFilter);

    // Ruido rosa de admisión (dual bandpass)
    this.intakeNoiseNode = this._createPinkNoiseNode();
    this.intakeFilter    = this.ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.frequency.value = cfg.intakeFreqIdle;
    this.intakeFilter.Q.value = 2.0;
    this.intakeFilter2   = this.ctx.createBiquadFilter();
    this.intakeFilter2.type = 'bandpass';
    this.intakeFilter2.frequency.value = cfg.intakeFreqIdle * 1.5;
    this.intakeFilter2.Q.value = 3.5;
    this.intakeGain = this.ctx.createGain();
    this.intakeGain.gain.value = 0.04;
    this.intakeNoiseNode.connect(this.intakeFilter);
    this.intakeNoiseNode.connect(this.intakeFilter2);
    this.intakeFilter.connect(this.intakeGain);
    this.intakeFilter2.connect(this.intakeGain);
    this.intakeGain.connect(this.compressor);

    // Arrancar todos los nodos
    this.cylinderLFO.start(now);
    this.fmModulator.start(now);
    this.fmCarrier.start(now);
    this.intakeNoiseNode.start(now);

    this.isRunning = true;
    this.update(cfg.idleRPM, 0, 0);
  }

  // ─── STOP ────────────────────────────────────────────────────────────────
  stop() {
    if (!this.isRunning) return;
    const nodesToStop = [
      this.cylinderLFO, this.fmModulator, this.fmCarrier, this.intakeNoiseNode,
      ...this.oscNodes.map(n => n.osc)
    ];
    nodesToStop.forEach(n => { try { n.stop(); } catch(e) {} });
    this.isRunning = false;
    this.oscNodes  = [];
  }

  // ─── UPDATE EN TIEMPO REAL ────────────────────────────────────────────────
  update(rpm, throttle = 0, acceleration = 0) {
    if (!this.isRunning || !this.ctx) return;

    this.currentRPM      = Math.max(650, Math.min(9000, rpm));
    this.currentThrottle = Math.max(0,   Math.min(1, throttle));

    const cfg     = this.presets[this.currentPreset];
    const now     = this.ctx.currentTime;
    const t       = this.currentThrottle;
    const ramp    = 0.06;
    const baseFreq = this._firingFreq(this.currentRPM, cfg.cylinders);
    const rpmNorm  = (this.currentRPM - 650) / (9000 - 650);

    // Frecuencias de armónicos
    this.oscNodes.forEach(({ osc, gain, mult, baseLevel }) => {
      osc.frequency.setTargetAtTime(baseFreq * mult, now, ramp);
      const brightness = mult > 1.5
        ? baseLevel * (0.4 + 0.6 * rpmNorm + 0.4 * t)
        : baseLevel;
      gain.gain.setTargetAtTime(brightness, now, ramp);
    });

    // FM
    this.fmModulator.frequency.setTargetAtTime(baseFreq * cfg.fmRatio, now, ramp);
    this.fmCarrier.frequency.setTargetAtTime(baseFreq, now, ramp);
    const fmDepth = cfg.fmDepthIdle + (cfg.fmDepthThrottle - cfg.fmDepthIdle) * t;
    this.fmModGain.gain.setTargetAtTime(fmDepth, now, ramp);

    // LFO — CRÍTICO: limitar a 28 Hz para que sea perceptual, no tonal
    const lfoFreq  = Math.min(baseFreq, 28);
    const lfoDepth = cfg.lfoDepthIdle + (cfg.lfoDepthThrottle - cfg.lfoDepthIdle) * t;
    this.cylinderLFO.frequency.setTargetAtTime(lfoFreq, now, ramp);
    this.cylinderLFOGain.gain.setTargetAtTime(lfoDepth, now, ramp);

    // Filtro principal
    const targetFilterFreq = cfg.filterBaseFreq
      + (t * cfg.filterThrottleMult)
      + (rpmNorm * cfg.filterThrottleMult * 0.5);
    const targetQ = cfg.filterQIdle + (cfg.filterQThrottle - cfg.filterQIdle) * t;
    this.mainFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);
    this.mainFilter.Q.setTargetAtTime(Math.max(0.3, targetQ), now, 0.08);

    // Gain de mezcla
    const mixGainVal = (0.3 + t * 0.7) * this.idleVolume * 0.4;
    this.oscMixGain.gain.setTargetAtTime(mixGainVal, now, ramp);

    // Ruido de admisión
    const intakeFreq = cfg.intakeFreqIdle + t * (cfg.intakeFreqThrottle - cfg.intakeFreqIdle);
    this.intakeFilter.frequency.setTargetAtTime(intakeFreq, now, 0.1);
    this.intakeFilter2.frequency.setTargetAtTime(intakeFreq * 1.4, now, 0.1);
    const intakeVol = 0.02 + t * 0.12 + rpmNorm * 0.04;
    this.intakeGain.gain.setTargetAtTime(intakeVol, now, 0.05);

    // Pops de escape
    if (this.popFxEnabled && acceleration < -1.0
        && this.currentRPM > 2500 && this.currentThrottle < 0.15) {
      this._triggerExhaustPop(cfg.popIntense, cfg.popCountMax);
    }
  }

  // ─── EXHAUST POPS ─────────────────────────────────────────────────────────
  _triggerExhaustPop(intensity = 1.0, countMax = 3) {
    const now = this.ctx.currentTime;
    if (now - this.lastPopTime < 0.08) return;
    this.lastPopTime = now;
    const popCount = 1 + Math.floor(Math.random() * countMax);
    for (let i = 0; i < popCount; i++) {
      this._singlePop(now + i * (0.05 + Math.random() * 0.07), intensity);
    }
  }

  _singlePop(startTime, intensity) {
    // Capa 1: impacto
    const cDur = 0.003;
    const cBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * cDur), this.ctx.sampleRate);
    const cd   = cBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.1));
    }
    const cSrc = this.ctx.createBufferSource(); cSrc.buffer = cBuf;
    const cG   = this.ctx.createGain();
    cG.gain.setValueAtTime(0.6 * intensity * this.masterVolume, startTime);
    cG.gain.exponentialRampToValueAtTime(0.001, startTime + cDur);
    cSrc.connect(cG); cG.connect(this.compressor); cSrc.start(startTime);

    // Capa 2: cola de crujido
    const tDur = 0.05 + Math.random() * 0.04;
    const tBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * tDur), this.ctx.sampleRate);
    const td   = tBuf.getChannelData(0);
    for (let i = 0; i < td.length; i++) {
      td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (td.length * 0.3));
    }
    const tSrc = this.ctx.createBufferSource(); tSrc.buffer = tBuf;
    const tFilt = this.ctx.createBiquadFilter();
    tFilt.type = 'bandpass'; tFilt.frequency.value = 300 + Math.random() * 500; tFilt.Q.value = 1.5;
    const tG = this.ctx.createGain();
    tG.gain.setValueAtTime(0.3 * intensity * this.masterVolume, startTime);
    tG.gain.exponentialRampToValueAtTime(0.001, startTime + tDur);
    tSrc.connect(tFilt); tFilt.connect(tG); tG.connect(this.compressor); tSrc.start(startTime);
  }

  // ─── UTILITIES ────────────────────────────────────────────────────────────
  _createSyntheticReverb(durationSec, decay) {
    const len = Math.ceil(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 10);
      }
    }
    const conv = this.ctx.createConvolver(); conv.buffer = buf; return conv;
  }

  _createPinkNoiseNode() {
    const bufSz = 3 * this.ctx.sampleRate;
    const buf   = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
    const data  = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < bufSz; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; return src;
  }

  _makeTanhCurve(amount) {
    const n   = 44100;
    const cur = new Float32Array(n);
    const k   = amount / 100;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      cur[i]  = Math.tanh(k * x) / Math.tanh(k);
    }
    return cur;
  }

  _firingFreq(rpm, cylinders) {
    return Math.max(10, (rpm / 60) * (cylinders / 2));
  }

  // ─── SETTERS ──────────────────────────────────────────────────────────────
  setPreset(name) {
    if (this.presets[name]) {
      this.currentPreset = name;
      if (this.isRunning) { this.stop(); this.start(); }
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setIdleVolume(val) { this.idleVolume = Math.max(0.1, Math.min(1, val)); }
  setPopFx(enabled)  { this.popFxEnabled = enabled; }
}

window.EngineAudioSynthesizer = EngineAudioSynthesizer;
