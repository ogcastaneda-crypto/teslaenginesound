/**
 * Tesla Sound Engine - Web Audio API Synthesizer (v3 - Acoustic Realism)
 * 
 * Incorpora:
 * - Doble formante resonante de tubo de escape y cámara de combustión
 * - Inestabilidad mecánica sutil (jitter analógico y micro-vibración)
 * - Frecuencias de firing calibradas acústicamente
 * - Distorsión cálida simétrica y no lineal
 * - Descompresión y pops dinámicos
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

    // Resonancia acústica de escape (cuerpo de carrocería / tubo)
    this.bodyResonator1  = null;
    this.bodyResonator2  = null;
    this.bodyGain        = null;

    this.mainFilter      = null;
    this.exhaustFilter   = null;

    this.intakeNoiseNode = null;
    this.intakeFilter    = null;
    this.intakeFilter2   = null;
    this.intakeGain      = null;

    this.distortionNode  = null;

    this.currentPreset   = 'v8_muscle';
    this.masterVolume    = 0.8;
    this.idleVolume      = 0.5;
    this.popFxEnabled    = true;

    this.currentRPM      = 800;
    this.currentThrottle = 0;
    this.lastPopTime     = 0;

    this.presets = {
      v8_muscle: {
        cylinders: 8, idleRPM: 750,
        harmonics: [
          [1.0, 0.85], [0.5, 0.95], [1.5, 0.35], [2.0, 0.45], [3.0, 0.20], [4.0, 0.08]
        ],
        filterBaseFreq: 190, filterThrottleMult: 1400,
        filterQIdle: 2.2, filterQThrottle: 0.9,
        distortionAmount: 220,
        fmDepthIdle: 6, fmDepthThrottle: 45, fmRatio: 0.5,
        lfoRate: 12, lfoDepthIdle: 0.08, lfoDepthThrottle: 0.02,
        reverbMix: 0.20,
        resonatorFreq1: 130, resonatorFreq2: 260, // Cuerpo grave V8
        intakeFreqIdle: 750, intakeFreqThrottle: 2800,
        popIntense: 1.4, popCountMax: 3,
      },
      v10_exotic: {
        cylinders: 10, idleRPM: 850,
        harmonics: [
          [1.0, 0.80], [0.5, 0.30], [1.5, 0.25], [2.0, 0.60], [3.0, 0.35], [4.0, 0.20], [5.0, 0.10]
        ],
        filterBaseFreq: 260, filterThrottleMult: 2800,
        filterQIdle: 2.0, filterQThrottle: 0.7,
        distortionAmount: 140,
        fmDepthIdle: 4, fmDepthThrottle: 30, fmRatio: 0.75,
        lfoRate: 15, lfoDepthIdle: 0.05, lfoDepthThrottle: 0.015,
        reverbMix: 0.16,
        resonatorFreq1: 220, resonatorFreq2: 440,
        intakeFreqIdle: 1100, intakeFreqThrottle: 4200,
        popIntense: 1.0, popCountMax: 2,
      },
      rotary_turbo: {
        cylinders: 6, idleRPM: 950,
        harmonics: [
          [1.0, 0.75], [2.0, 0.70], [3.0, 0.45], [4.0, 0.28], [6.0, 0.12]
        ],
        filterBaseFreq: 380, filterThrottleMult: 4200,
        filterQIdle: 2.8, filterQThrottle: 0.6,
        distortionAmount: 260,
        fmDepthIdle: 10, fmDepthThrottle: 110, fmRatio: 1.5,
        lfoRate: 18, lfoDepthIdle: 0.06, lfoDepthThrottle: 0.02,
        reverbMix: 0.22,
        resonatorFreq1: 280, resonatorFreq2: 620,
        intakeFreqIdle: 1800, intakeFreqThrottle: 5500,
        popIntense: 1.8, popCountMax: 4,
      },
      cyber_hyper: {
        cylinders: 12, idleRPM: 600,
        harmonics: [
          [1.0, 0.60], [0.25, 0.45], [2.0, 0.30], [4.0, 0.35], [8.0, 0.15]
        ],
        filterBaseFreq: 110, filterThrottleMult: 4500,
        filterQIdle: 1.5, filterQThrottle: 0.4,
        distortionAmount: 50,
        fmDepthIdle: 2, fmDepthThrottle: 20, fmRatio: 3.0,
        lfoRate: 8, lfoDepthIdle: 0.02, lfoDepthThrottle: 0.01,
        reverbMix: 0.28,
        resonatorFreq1: 90, resonatorFreq2: 1200,
        intakeFreqIdle: 2400, intakeFreqThrottle: 8000,
        popIntense: 0.3, popCountMax: 1,
      },
      harley: {
        cylinders: 2, idleRPM: 680,
        harmonics: [
          [0.5, 1.00], [1.0, 0.85], [1.5, 0.40], [2.0, 0.25], [3.0, 0.10]
        ],
        filterBaseFreq: 150, filterThrottleMult: 800,
        filterQIdle: 4.0, filterQThrottle: 1.5,
        distortionAmount: 290,
        fmDepthIdle: 18, fmDepthThrottle: 90, fmRatio: 0.875,
        lfoRate: 9, lfoDepthIdle: 0.25, lfoDepthThrottle: 0.08,
        reverbMix: 0.26,
        resonatorFreq1: 85, resonatorFreq2: 190,
        intakeFreqIdle: 300, intakeFreqThrottle: 1200,
        popIntense: 2.2, popCountMax: 2,
      },
      moto_sport: {
        cylinders: 4, idleRPM: 1300,
        harmonics: [
          [1.0, 0.70], [2.0, 0.60], [3.0, 0.40], [4.0, 0.25], [5.0, 0.12]
        ],
        filterBaseFreq: 650, filterThrottleMult: 5000,
        filterQIdle: 1.8, filterQThrottle: 0.5,
        distortionAmount: 90,
        fmDepthIdle: 4, fmDepthThrottle: 24, fmRatio: 1.0,
        lfoRate: 20, lfoDepthIdle: 0.035, lfoDepthThrottle: 0.01,
        reverbMix: 0.12,
        resonatorFreq1: 340, resonatorFreq2: 850,
        intakeFreqIdle: 2000, intakeFreqThrottle: 7000,
        popIntense: 0.6, popCountMax: 2,
      },
      f1: {
        cylinders: 8, idleRPM: 4200,
        harmonics: [
          [1.0, 0.50], [2.0, 0.75], [3.0, 0.50], [4.0, 0.35], [6.0, 0.18]
        ],
        filterBaseFreq: 1800, filterThrottleMult: 8000,
        filterQIdle: 1.1, filterQThrottle: 0.4,
        distortionAmount: 70,
        fmDepthIdle: 6, fmDepthThrottle: 22, fmRatio: 2.0,
        lfoRate: 26, lfoDepthIdle: 0.02, lfoDepthThrottle: 0.008,
        reverbMix: 0.10,
        resonatorFreq1: 600, resonatorFreq2: 1600,
        intakeFreqIdle: 4500, intakeFreqThrottle: 14000,
        popIntense: 0.4, popCountMax: 1,
      },
      tractor: {
        cylinders: 2, idleRPM: 480,
        harmonics: [
          [0.5, 1.00], [1.0, 0.80], [1.5, 0.30], [2.0, 0.15]
        ],
        filterBaseFreq: 65, filterThrottleMult: 300,
        filterQIdle: 5.0, filterQThrottle: 2.0,
        distortionAmount: 380,
        fmDepthIdle: 35, fmDepthThrottle: 150, fmRatio: 0.25,
        lfoRate: 7, lfoDepthIdle: 0.30, lfoDepthThrottle: 0.12,
        reverbMix: 0.32,
        resonatorFreq1: 60, resonatorFreq2: 130,
        intakeFreqIdle: 160, intakeFreqThrottle: 600,
        popIntense: 0.8, popCountMax: 1,
      },
      lancha: {
        cylinders: 2, idleRPM: 1600,
        harmonics: [
          [1.0, 0.75], [2.0, 0.60], [3.0, 0.35], [4.0, 0.18]
        ],
        filterBaseFreq: 240, filterThrottleMult: 2200,
        filterQIdle: 3.5, filterQThrottle: 1.0,
        distortionAmount: 180,
        fmDepthIdle: 14, fmDepthThrottle: 80, fmRatio: 0.66,
        lfoRate: 18, lfoDepthIdle: 0.09, lfoDepthThrottle: 0.035,
        reverbMix: 0.38,
        resonatorFreq1: 180, resonatorFreq2: 420,
        intakeFreqIdle: 950, intakeFreqThrottle: 3800,
        popIntense: 0.5, popCountMax: 1,
      },
    };
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.isRunning) return;

    const cfg = this.presets[this.currentPreset];
    const now = this.ctx.currentTime;

    // Compresor multibanda / master
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value      = 10;
    this.compressor.ratio.value     = 4.5;
    this.compressor.attack.value    = 0.004;
    this.compressor.release.value   = 0.20;

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, now);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Reverb acústico
    this.reverbNode = this._createSyntheticReverb(1.2, 0.55);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = cfg.reverbMix;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0 - cfg.reverbMix;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.dryGain.connect(this.compressor);

    // Resonadores de cuerpo (dan calidez metálica y profundidad de escape)
    this.bodyResonator1 = this.ctx.createBiquadFilter();
    this.bodyResonator1.type = 'peaking';
    this.bodyResonator1.frequency.value = cfg.resonatorFreq1 || 140;
    this.bodyResonator1.Q.value = 3.0;
    this.bodyResonator1.gain.value = 4.5;

    this.bodyResonator2 = this.ctx.createBiquadFilter();
    this.bodyResonator2.type = 'peaking';
    this.bodyResonator2.frequency.value = cfg.resonatorFreq2 || 320;
    this.bodyResonator2.Q.value = 2.5;
    this.bodyResonator2.gain.value = 3.0;

    this.bodyResonator1.connect(this.bodyResonator2);
    this.bodyResonator2.connect(this.dryGain);
    this.bodyResonator2.connect(this.reverbNode);

    // Distorsión no lineal cálida
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve     = this._makeTanhCurve(cfg.distortionAmount);
    this.distortionNode.oversample = '4x';
    this.distortionNode.connect(this.bodyResonator1);

    // Filtro principal LP resonante
    this.mainFilter = this.ctx.createBiquadFilter();
    this.mainFilter.type = 'lowpass';
    this.mainFilter.frequency.setValueAtTime(cfg.filterBaseFreq, now);
    this.mainFilter.Q.setValueAtTime(cfg.filterQIdle, now);
    this.mainFilter.connect(this.distortionNode);

    // Filtro highpass
    this.exhaustFilter = this.ctx.createBiquadFilter();
    this.exhaustFilter.type = 'highpass';
    this.exhaustFilter.frequency.value = 38;
    this.exhaustFilter.Q.value = 0.5;
    this.exhaustFilter.connect(this.mainFilter);

    // LFO de pulsación de cilindros
    this.cylinderLFO = this.ctx.createOscillator();
    this.cylinderLFO.type = 'sine';
    this.cylinderLFO.frequency.setValueAtTime(cfg.lfoRate, now);
    this.cylinderLFOGain = this.ctx.createGain();
    this.cylinderLFOGain.gain.setValueAtTime(cfg.lfoDepthIdle, now);
    this.cylinderLFO.connect(this.cylinderLFOGain);

    // FM Synthesis (añade textura mecánica de detonación)
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
    fmCarrierGain.gain.value = 0.45;
    this.fmCarrier.connect(fmCarrierGain);

    // Mezcla de osciladores armónicos
    this.oscMixGain = this.ctx.createGain();
    this.oscMixGain.gain.setValueAtTime(this.idleVolume * 0.45, now);
    this.cylinderLFOGain.connect(this.oscMixGain.gain);

    this.oscNodes = [];
    cfg.harmonics.forEach(([mult, level]) => {
      const osc = this.ctx.createOscillator();
      // Ondas con más riqueza armónica que suenan a pulso de escape y no a sintetizador
      osc.type = mult <= 0.6 ? 'triangle' : mult <= 1.5 ? 'sawtooth' : 'square';
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

    // Ruido de admisión aerodinámico
    this.intakeNoiseNode = this._createPinkNoiseNode();
    this.intakeFilter    = this.ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.frequency.value = cfg.intakeFreqIdle;
    this.intakeFilter.Q.value = 1.8;
    this.intakeFilter2   = this.ctx.createBiquadFilter();
    this.intakeFilter2.type = 'bandpass';
    this.intakeFilter2.frequency.value = cfg.intakeFreqIdle * 1.5;
    this.intakeFilter2.Q.value = 2.8;
    this.intakeGain = this.ctx.createGain();
    this.intakeGain.gain.value = 0.035;
    this.intakeNoiseNode.connect(this.intakeFilter);
    this.intakeNoiseNode.connect(this.intakeFilter2);
    this.intakeFilter.connect(this.intakeGain);
    this.intakeFilter2.connect(this.intakeGain);
    this.intakeGain.connect(this.compressor);

    // Iniciar osciladores base
    this.cylinderLFO.start(now);
    this.fmModulator.start(now);
    this.fmCarrier.start(now);
    this.intakeNoiseNode.start(now);

    this.isRunning = true;
    this.update(cfg.idleRPM, 0, 0);
  }

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

  update(rpm, throttle = 0, acceleration = 0) {
    if (!this.isRunning || !this.ctx) return;

    this.currentRPM      = Math.max(500, Math.min(8500, rpm));
    this.currentThrottle = Math.max(0,   Math.min(1, throttle));

    const cfg     = this.presets[this.currentPreset];
    const now     = this.ctx.currentTime;
    const t       = this.currentThrottle;
    const ramp    = 0.07;
    const baseFreq = this._firingFreq(this.currentRPM, cfg.cylinders);
    const rpmNorm  = (this.currentRPM - 500) / (8500 - 500);

    // Micro-jitter analógico (0.5%) para romper la rigidez de computadora
    const jitter = 1.0 + (Math.sin(now * 14) * 0.004);

    this.oscNodes.forEach(({ osc, gain, mult, baseLevel }) => {
      osc.frequency.setTargetAtTime(baseFreq * mult * jitter, now, ramp);
      const brightness = mult > 1.4
        ? baseLevel * (0.35 + 0.65 * rpmNorm + 0.35 * t)
        : baseLevel;
      gain.gain.setTargetAtTime(brightness, now, ramp);
    });

    // FM
    this.fmModulator.frequency.setTargetAtTime(baseFreq * cfg.fmRatio, now, ramp);
    this.fmCarrier.frequency.setTargetAtTime(baseFreq * jitter, now, ramp);
    const fmDepth = cfg.fmDepthIdle + (cfg.fmDepthThrottle - cfg.fmDepthIdle) * t;
    this.fmModGain.gain.setTargetAtTime(fmDepth, now, ramp);

    // LFO sub-armónico — limitado a máximo 20 Hz para evitar tono electrónico
    const lfoFreq  = Math.min(baseFreq * 0.5, 20);
    const lfoDepth = cfg.lfoDepthIdle + (cfg.lfoDepthThrottle - cfg.lfoDepthIdle) * t;
    this.cylinderLFO.frequency.setTargetAtTime(lfoFreq, now, ramp);
    this.cylinderLFOGain.gain.setTargetAtTime(lfoDepth, now, ramp);

    // Filtro acústico principal
    const targetFilterFreq = cfg.filterBaseFreq
      + (t * cfg.filterThrottleMult)
      + (rpmNorm * cfg.filterThrottleMult * 0.45);
    const targetQ = cfg.filterQIdle + (cfg.filterQThrottle - cfg.filterQIdle) * t;
    this.mainFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);
    this.mainFilter.Q.setTargetAtTime(Math.max(0.4, targetQ), now, 0.08);

    // Ganancia
    const mixGainVal = (0.32 + t * 0.68) * this.idleVolume * 0.45;
    this.oscMixGain.gain.setTargetAtTime(mixGainVal, now, ramp);

    // Ruido de admisión
    const intakeFreq = cfg.intakeFreqIdle + t * (cfg.intakeFreqThrottle - cfg.intakeFreqIdle);
    this.intakeFilter.frequency.setTargetAtTime(intakeFreq, now, 0.1);
    this.intakeFilter2.frequency.setTargetAtTime(intakeFreq * 1.35, now, 0.1);
    const intakeVol = 0.02 + t * 0.10 + rpmNorm * 0.03;
    this.intakeGain.gain.setTargetAtTime(intakeVol, now, 0.05);

    // Resonadores dinámicos que siguen levemente las RPM
    if (this.bodyResonator1) {
      const rf1 = (cfg.resonatorFreq1 || 140) * (1 + rpmNorm * 0.25);
      this.bodyResonator1.frequency.setTargetAtTime(rf1, now, 0.1);
    }

    // Pops de escape
    if (this.popFxEnabled && acceleration < -0.9
        && this.currentRPM > 2300 && this.currentThrottle < 0.15) {
      this._triggerExhaustPop(cfg.popIntense, cfg.popCountMax);
    }
  }

  _triggerExhaustPop(intensity = 1.0, countMax = 3) {
    const now = this.ctx.currentTime;
    if (now - this.lastPopTime < 0.09) return;
    this.lastPopTime = now;
    const popCount = 1 + Math.floor(Math.random() * countMax);
    for (let i = 0; i < popCount; i++) {
      this._singlePop(now + i * (0.05 + Math.random() * 0.07), intensity);
    }
  }

  _singlePop(startTime, intensity) {
    const cDur = 0.005;
    const cBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * cDur), this.ctx.sampleRate);
    const cd   = cBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.12));
    }
    const cSrc = this.ctx.createBufferSource(); cSrc.buffer = cBuf;
    const cG   = this.ctx.createGain();
    cG.gain.setValueAtTime(0.55 * intensity * this.masterVolume, startTime);
    cG.gain.exponentialRampToValueAtTime(0.001, startTime + cDur);
    cSrc.connect(cG); cG.connect(this.compressor); cSrc.start(startTime);

    const tDur = 0.06 + Math.random() * 0.05;
    const tBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * tDur), this.ctx.sampleRate);
    const td   = tBuf.getChannelData(0);
    for (let i = 0; i < td.length; i++) {
      td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (td.length * 0.25));
    }
    const tSrc = this.ctx.createBufferSource(); tSrc.buffer = tBuf;
    const tFilt = this.ctx.createBiquadFilter();
    tFilt.type = 'bandpass'; tFilt.frequency.value = 260 + Math.random() * 450; tFilt.Q.value = 1.8;
    const tG = this.ctx.createGain();
    tG.gain.setValueAtTime(0.35 * intensity * this.masterVolume, startTime);
    tG.gain.exponentialRampToValueAtTime(0.001, startTime + tDur);
    tSrc.connect(tFilt); tFilt.connect(tG); tG.connect(this.compressor); tSrc.start(startTime);
  }

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
    return Math.max(8, (rpm / 60) * (cylinders / 2));
  }

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
