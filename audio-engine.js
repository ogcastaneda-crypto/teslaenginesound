/**
 * Tesla Sound Engine - Web Audio API Synthesizer (v2 - Enhanced Realism)
 *
 * Mejoras principales sobre la versión anterior:
 *  1. Síntesis FM (Frequency Modulation) para textura de combustión real
 *  2. LFO de pulsación de cilindros para simular el "latido" del motor
 *  3. Múltiples capas de armónicos independientes (no un solo oscilador)
 *  4. Reverb sintético (ConvolverNode con IR generado por código)
 *  5. Compresor dinámico para evitar clipping y dar cuerpo
 *  6. Resonancia Q variable en el filtro principal según aceleración
 *  7. Ruido de admisión con filtro dinámico más complejo
 *  8. Pops de escape mejorados con múltiples capas de impacto + cola
 *  9. Curva de distorsión tanh (más musical / cálida) en lugar de lineal
 * 10. Modulación de amplitud (tremolo) para simular el "roughness" mecánico
 */
class EngineAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.isRunning = false;

    // Nodos principales
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.dryGain = null;

    // Capas osciladores
    this.oscNodes = [];       // Array de { osc, gain }
    this.fmCarrier = null;    // Portadora FM
    this.fmModulator = null;  // Moduladora FM
    this.fmModGain = null;    // Profundidad FM

    // LFO de pulsación de cilindros
    this.cylinderLFO = null;
    this.cylinderLFOGain = null;

    // Filtros
    this.mainFilter = null;
    this.exhaustFilter = null;

    // Ruido de admisión
    this.intakeNoiseNode = null;
    this.intakeFilter = null;
    this.intakeFilter2 = null;
    this.intakeGain = null;

    // Distorsión
    this.distortionNode = null;

    // Parámetros
    this.currentPreset = 'v8_muscle';
    this.masterVolume = 0.8;
    this.idleVolume = 0.5;
    this.popFxEnabled = true;

    this.currentRPM = 800;
    this.currentThrottle = 0;
    this.lastPopTime = 0;

    // Definición de presets mejorada
    this.presets = {
      v8_muscle: {
        cylinders: 8,
        idleRPM: 750,
        // Frecuencias relativas de armónicos [multiplicador, nivel_relativo]
        harmonics: [
          [1.0,  0.9],   // Fundamental (firing freq)
          [0.5,  0.7],   // Sub-armónico (exhaust rumble)
          [2.0,  0.5],   // 2do armónico
          [3.0,  0.25],  // 3er armónico
          [4.0,  0.12],  // 4o armónico
        ],
        filterBaseFreq: 220,
        filterThrottleMult: 1800,
        filterQIdle: 3.0,
        filterQThrottle: 1.2,
        distortionAmount: 280,   // Distorsión suave/cálida
        fmDepthIdle: 8,
        fmDepthThrottle: 80,
        fmRatio: 0.5,           // Relación moduladora/portadora
        lfoRate: 12,             // Hz del LFO de pulsación (firing rate a idle)
        lfoDepthIdle: 0.06,
        lfoDepthThrottle: 0.02,
        reverbMix: 0.18,
        intakeFreqIdle: 900,
        intakeFreqThrottle: 3200,
        popIntense: 1.4,
        popCountMax: 3,
      },
      v10_exotic: {
        cylinders: 10,
        idleRPM: 900,
        harmonics: [
          [1.0,  0.85],
          [0.5,  0.4],
          [2.0,  0.6],
          [3.0,  0.35],
          [4.0,  0.2],
          [5.0,  0.08],
        ],
        filterBaseFreq: 320,
        filterThrottleMult: 3500,
        filterQIdle: 2.5,
        filterQThrottle: 0.8,
        distortionAmount: 160,
        fmDepthIdle: 5,
        fmDepthThrottle: 55,
        fmRatio: 0.75,
        lfoRate: 15,
        lfoDepthIdle: 0.04,
        lfoDepthThrottle: 0.015,
        reverbMix: 0.12,
        intakeFreqIdle: 1400,
        intakeFreqThrottle: 5000,
        popIntense: 1.0,
        popCountMax: 2,
      },
      rotary_turbo: {
        cylinders: 6,
        idleRPM: 1000,
        harmonics: [
          [1.0,  0.7],
          [2.0,  0.8],
          [3.0,  0.5],
          [4.0,  0.3],
          [6.0,  0.15],
        ],
        filterBaseFreq: 500,
        filterThrottleMult: 5500,
        filterQIdle: 4.0,
        filterQThrottle: 0.6,
        distortionAmount: 380,
        fmDepthIdle: 15,
        fmDepthThrottle: 200,
        fmRatio: 1.5,
        lfoRate: 20,
        lfoDepthIdle: 0.08,
        lfoDepthThrottle: 0.03,
        reverbMix: 0.22,
        intakeFreqIdle: 2200,
        intakeFreqThrottle: 7000,
        popIntense: 2.0,
        popCountMax: 5,
      },
      cyber_hyper: {
        cylinders: 12,
        idleRPM: 600,
        harmonics: [
          [1.0,  0.6],
          [0.25, 0.5],  // Sub-sub armónico (EV whine bajo)
          [2.0,  0.3],
          [4.0,  0.4],  // Whine eléctrico
          [8.0,  0.2],
        ],
        filterBaseFreq: 100,
        filterThrottleMult: 6000,
        filterQIdle: 1.5,
        filterQThrottle: 0.4,
        distortionAmount: 60,
        fmDepthIdle: 2,
        fmDepthThrottle: 30,
        fmRatio: 3.0,             // Más metálico
        lfoRate: 8,
        lfoDepthIdle: 0.02,
        lfoDepthThrottle: 0.01,
        reverbMix: 0.30,
        intakeFreqIdle: 3000,
        intakeFreqThrottle: 10000,
        popIntense: 0.3,
        popCountMax: 1,
      }
    };
  }

  // ─── INICIALIZACIÓN ───────────────────────────────────────────────────────
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

    // ── 1. COMPRESOR DINÁMICO (evita clipping, da cuerpo) ──────────────────
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value      = 12;
    this.compressor.ratio.value     = 4;
    this.compressor.attack.value    = 0.003;
    this.compressor.release.value   = 0.25;

    // ── 2. MASTER GAIN ────────────────────────────────────────────────────
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, now);

    // Cadena final: compressor → masterGain → destination
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // ── 3. REVERB SINTÉTICO ───────────────────────────────────────────────
    this.reverbNode = this._createSyntheticReverb(1.4, 0.5);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = cfg.reverbMix;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0 - cfg.reverbMix;

    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.dryGain.connect(this.compressor);

    // ── 4. DISTORSIÓN (curva tanh – cálida, musical) ─────────────────────
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this._makeTanhCurve(cfg.distortionAmount);
    this.distortionNode.oversample = '4x';
    this.distortionNode.connect(this.dryGain);
    this.distortionNode.connect(this.reverbNode);

    // ── 5. FILTRO PRINCIPAL DE ESCAPE (LP resonante) ──────────────────────
    this.mainFilter = this.ctx.createBiquadFilter();
    this.mainFilter.type = 'lowpass';
    this.mainFilter.frequency.setValueAtTime(cfg.filterBaseFreq, now);
    this.mainFilter.Q.setValueAtTime(cfg.filterQIdle, now);
    this.mainFilter.connect(this.distortionNode);

    // Filtro extra de exhaust (highpass suave para quitar frecuencias DC)
    this.exhaustFilter = this.ctx.createBiquadFilter();
    this.exhaustFilter.type = 'highpass';
    this.exhaustFilter.frequency.value = 40;
    this.exhaustFilter.Q.value = 0.5;
    this.exhaustFilter.connect(this.mainFilter);

    // ── 6. LFO DE PULSACIÓN DE CILINDROS ─────────────────────────────────
    this.cylinderLFO = this.ctx.createOscillator();
    this.cylinderLFO.type = 'sine';
    this.cylinderLFO.frequency.setValueAtTime(cfg.lfoRate, now);

    this.cylinderLFOGain = this.ctx.createGain();
    this.cylinderLFOGain.gain.setValueAtTime(cfg.lfoDepthIdle, now);
    this.cylinderLFO.connect(this.cylinderLFOGain);
    // El LFO modulará el gain del mezclador principal de osciladores (más abajo)

    // ── 7. FM SYNTHESIS (Carrier + Modulator) ────────────────────────────
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
    this.fmModGain.connect(this.fmCarrier.frequency); // FM connection

    // Gain del carrier FM
    const fmCarrierGain = this.ctx.createGain();
    fmCarrierGain.gain.value = 0.5;
    this.fmCarrier.connect(fmCarrierGain);

    // ── 8. OSCILADORES ARMÓNICOS ADITIVOS ────────────────────────────────
    // Mezcla de todos los armónicos
    this.oscMixGain = this.ctx.createGain();
    this.oscMixGain.gain.setValueAtTime(
      this.idleVolume * 0.4,
      now
    );

    // El LFO modula el gain de la mezcla (crea "roughness" mecánico)
    this.cylinderLFOGain.connect(this.oscMixGain.gain);

    this.oscNodes = [];
    cfg.harmonics.forEach(([mult, level]) => {
      const osc = this.ctx.createOscillator();
      // Alternar tipos de onda para mayor riqueza tímbrica
      osc.type = mult <= 1.0 ? 'sawtooth' :
                 mult <= 2.0 ? 'square'   : 'triangle';
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

    // ── 9. RUIDO DE ADMISIÓN DE AIRE (dual-bandpass) ───────────────────
    this.intakeNoiseNode = this._createPinkNoiseNode();

    this.intakeFilter = this.ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.frequency.value = cfg.intakeFreqIdle;
    this.intakeFilter.Q.value = 2.0;

    this.intakeFilter2 = this.ctx.createBiquadFilter();
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

    // ── 10. ARRANCAR TODOS LOS NODOS ──────────────────────────────────────
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
    this.oscNodes = [];
  }

  // ─── UPDATE EN TIEMPO REAL ────────────────────────────────────────────────
  update(rpm, throttle = 0, acceleration = 0) {
    if (!this.isRunning || !this.ctx) return;

    this.currentRPM      = Math.max(650, Math.min(9000, rpm));
    this.currentThrottle = Math.max(0,   Math.min(1, throttle));

    const cfg = this.presets[this.currentPreset];
    const now = this.ctx.currentTime;
    const t   = this.currentThrottle;
    const ramp = 0.06; // Tiempo de transición (s)

    const baseFreq  = this._firingFreq(this.currentRPM, cfg.cylinders);
    const rpmNorm   = (this.currentRPM - 650) / (9000 - 650); // 0..1

    // ── Frecuencias de osciladores ────────────────────────────────────────
    this.oscNodes.forEach(({ osc, gain, mult, baseLevel }) => {
      osc.frequency.setTargetAtTime(baseFreq * mult, now, ramp);

      // Los armónicos superiores ganan presencia con el RPM y throttle
      const brightnessFactor = mult > 1.5
        ? baseLevel * (0.4 + 0.6 * rpmNorm + 0.4 * t)
        : baseLevel;
      gain.gain.setTargetAtTime(brightnessFactor, now, ramp);
    });

    // ── FM Synthesis ──────────────────────────────────────────────────────
    this.fmModulator.frequency.setTargetAtTime(
      baseFreq * cfg.fmRatio, now, ramp
    );
    this.fmCarrier.frequency.setTargetAtTime(baseFreq, now, ramp);

    // FM depth crece con throttle → más "timbre de combustión" bajo aceleración
    const fmDepth = cfg.fmDepthIdle + (cfg.fmDepthThrottle - cfg.fmDepthIdle) * t;
    this.fmModGain.gain.setTargetAtTime(fmDepth, now, ramp);

    // ── LFO de pulsación ─────────────────────────────────────────────────
    const lfoFreq  = baseFreq;  // Sincroniza con firing rate
    const lfoDepth = cfg.lfoDepthIdle + (cfg.lfoDepthThrottle - cfg.lfoDepthIdle) * t;
    this.cylinderLFO.frequency.setTargetAtTime(lfoFreq, now, ramp);
    this.cylinderLFOGain.gain.setTargetAtTime(lfoDepth, now, ramp);

    // ── Filtro principal ─────────────────────────────────────────────────
    const targetFilterFreq = cfg.filterBaseFreq
      + (t * cfg.filterThrottleMult)
      + (rpmNorm * cfg.filterThrottleMult * 0.5);

    const targetQ = cfg.filterQIdle + (cfg.filterQThrottle - cfg.filterQIdle) * t;

    this.mainFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);
    this.mainFilter.Q.setTargetAtTime(Math.max(0.3, targetQ), now, 0.08);

    // ── Gain de mezcla de osciladores ────────────────────────────────────
    const mixGainVal = (0.3 + t * 0.7) * this.idleVolume * 0.4;
    this.oscMixGain.gain.setTargetAtTime(mixGainVal, now, ramp);

    // ── Ruido de admisión ─────────────────────────────────────────────────
    const intakeFreq = cfg.intakeFreqIdle + t * (cfg.intakeFreqThrottle - cfg.intakeFreqIdle);
    this.intakeFilter.frequency.setTargetAtTime(intakeFreq, now, 0.1);
    this.intakeFilter2.frequency.setTargetAtTime(intakeFreq * 1.4, now, 0.1);

    // Aumentar presencia del intake con throttle y RPM
    const intakeVol = 0.02 + t * 0.12 + rpmNorm * 0.04;
    this.intakeGain.gain.setTargetAtTime(intakeVol, now, 0.05);

    // ── Trigger de Pops/Burbles en desaceleración ─────────────────────────
    if (this.popFxEnabled && acceleration < -1.0
        && this.currentRPM > 2500 && this.currentThrottle < 0.15) {
      this._triggerExhaustPop(cfg.popIntense, cfg.popCountMax);
    }
  }

  // ─── EXHAUST POP MEJORADO ─────────────────────────────────────────────────
  _triggerExhaustPop(intensity = 1.0, countMax = 3) {
    const now = this.ctx.currentTime;
    if (now - this.lastPopTime < 0.08) return;
    this.lastPopTime = now;

    const popCount = 1 + Math.floor(Math.random() * countMax);
    for (let i = 0; i < popCount; i++) {
      const delay = i * (0.05 + Math.random() * 0.07);
      this._singlePop(now + delay, intensity);
    }
  }

  _singlePop(startTime, intensity) {
    // Capa 1: Impacto inicial (click percusivo)
    const clickDur = 0.003;
    const clickBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * clickDur), this.ctx.sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.1));
    }
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.6 * intensity * this.masterVolume, startTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + clickDur);
    clickSrc.connect(clickGain);
    clickGain.connect(this.compressor);
    clickSrc.start(startTime);

    // Capa 2: Cola de crujido (decaimiento más largo)
    const tailDur = 0.05 + Math.random() * 0.04;
    const tailBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * tailDur), this.ctx.sampleRate);
    const td = tailBuf.getChannelData(0);
    for (let i = 0; i < td.length; i++) {
      td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (td.length * 0.3));
    }
    const tailSrc = this.ctx.createBufferSource();
    tailSrc.buffer = tailBuf;

    const tailFilter = this.ctx.createBiquadFilter();
    tailFilter.type = 'bandpass';
    tailFilter.frequency.value = 300 + Math.random() * 500;
    tailFilter.Q.value = 1.5;

    const tailGain = this.ctx.createGain();
    tailGain.gain.setValueAtTime(0.3 * intensity * this.masterVolume, startTime);
    tailGain.gain.exponentialRampToValueAtTime(0.001, startTime + tailDur);

    tailSrc.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(this.compressor);
    tailSrc.start(startTime);
  }

  // ─── REVERB SINTÉTICO (IR generado por código) ────────────────────────────
  _createSyntheticReverb(durationSeconds = 1.5, decay = 0.5) {
    const sampleRate  = this.ctx.sampleRate;
    const length      = Math.ceil(sampleRate * durationSeconds);
    const impulse     = this.ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Decaimiento exponencial de ruido estéreo
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay * 10);
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  // ─── RUIDO ROSA (más cálido que el blanco) ───────────────────────────────
  _createPinkNoiseNode() {
    const bufferSize = 3 * this.ctx.sampleRate;
    const noiseBuf   = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data       = noiseBuf.getChannelData(0);

    // Filtro de primera diferencia para aproximar ruido rosa
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const src = this.ctx.createBufferSource();
    src.buffer  = noiseBuf;
    src.loop    = true;
    return src;
  }

  // ─── CURVA DE DISTORSIÓN TANH (cálida y musical) ─────────────────────────
  _makeTanhCurve(amount) {
    const samples = 44100;
    const curve   = new Float32Array(samples);
    const k       = amount / 100;
    for (let i = 0; i < samples; i++) {
      const x  = (i * 2) / samples - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  // ─── HELPER: Frecuencia de ignición ──────────────────────────────────────
  _firingFreq(rpm, cylinders) {
    // (RPM / 60) * (Cylinders / 2) → Hz de ignición en motor 4T
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

  setIdleVolume(val) {
    this.idleVolume = Math.max(0.1, Math.min(1, val));
  }

  setPopFx(enabled) {
    this.popFxEnabled = enabled;
  }
}

// Global Export
window.EngineAudioSynthesizer = EngineAudioSynthesizer;
