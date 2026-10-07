/**
 * RhythmicSynthesizer — Motor de síntesis rítmica
 * Vehículos: Caballo, Carreta, Trineo de Santa
 *
 * Usa el patrón "Web Audio lookahead scheduler" (A Tale of Two Clocks)
 * para scheduling de beats con precisión de muestra.
 * Acepta un AudioContext compartido para coexistir con EngineAudioSynthesizer.
 */
class RhythmicSynthesizer {
  constructor() {
    this.ctx         = null;
    this.outputGain  = null;
    this.compressor  = null;
    this.reverbNode  = null;
    this.reverbGain  = null;
    this.dryGain     = null;
    this.isRunning   = false;
    this.currentPreset = 'horse';
    this.masterVolume  = 0.8;

    // Lookahead scheduler state
    this.nextBeatTime = 0.0;
    this.currentBeat  = 0;
    this.bpm          = 0;
    this.timerID      = null;
    this.LOOKAHEAD_MS    = 25;    // ms entre llamadas al scheduler
    this.SCHEDULE_AHEAD  = 0.12; // segundos de anticipación

    // Nodos de capas continuas (crujidos, viento, etc.)
    this.continuousNodes = [];

    this.presets = {
      horse: {
        beatCount: 4,
        // 4 pulsos por ciclo: tac-tac-tac-THUD (galope natural)
        beatTypes:   ['hoof', 'hoof', 'hoof', 'hoof_hard'],
        beatVolumes: [ 0.65,   0.50,   0.60,   1.00 ],
        bellBeats:   [],               // sin cascabeles
        continuous:  [],
        reverbMix:   0.28,
        bpmFromSpeed: (kmh) => Math.max(0, 40 + kmh * 4.2),  // 10→82, 30→166
      },
      carreta: {
        beatCount: 4,
        beatTypes:   ['hoof_wood', 'hoof_wood', 'hoof_wood', 'hoof_wood_hard'],
        beatVolumes: [ 0.60,        0.45,         0.55,         0.90 ],
        bellBeats:   [],
        continuous:  ['creak', 'wheel'],
        reverbMix:   0.22,
        bpmFromSpeed: (kmh) => Math.max(0, 30 + kmh * 3.5),  // 10→65, 25→117
      },
      sleigh: {
        beatCount: 4,
        beatTypes:   ['hoof_snow', 'hoof_snow', 'hoof_snow', 'hoof_snow_hard'],
        beatVolumes: [ 0.55,        0.42,         0.48,         0.80 ],
        bellBeats:   [0, 2],           // cascabeles en beat 1 y 3
        continuous:  ['wind'],
        reverbMix:   0.45,
        bpmFromSpeed: (kmh) => Math.max(0, 40 + kmh * 4.0),
      },
    };
  }

  // ─── INIT / START / STOP ──────────────────────────────────────────────────
  init(sharedCtx) {
    if (sharedCtx) {
      this.ctx = sharedCtx;
    } else if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    }
  }

  start(sharedCtx) {
    this.init(sharedCtx);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.isRunning) return;

    const cfg = this.presets[this.currentPreset];
    const now = this.ctx.currentTime;

    // Compresor dinámico
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value      = 10;
    this.compressor.ratio.value     = 4;
    this.compressor.attack.value    = 0.003;
    this.compressor.release.value   = 0.25;

    // Gain de salida maestro
    this.outputGain = this.ctx.createGain();
    this.outputGain.gain.setValueAtTime(this.masterVolume, now);
    this.compressor.connect(this.outputGain);
    this.outputGain.connect(this.ctx.destination);

    // Reverb sintético
    this.reverbNode = this._createReverb(2.2, 0.6);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = cfg.reverbMix;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0 - cfg.reverbMix;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.dryGain.connect(this.compressor);

    // Capas continuas
    this._startContinuous(cfg.continuous);

    // Arrancar scheduler de beats
    this.bpm          = cfg.bpmFromSpeed(0);
    this.nextBeatTime = now + 0.1;
    this.currentBeat  = 0;
    this.isRunning    = true;
    this._scheduler();
  }

  stop() {
    if (!this.isRunning) return;
    clearTimeout(this.timerID);
    this._stopContinuous();
    try {
      this.outputGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    } catch(e) {}
    this.isRunning = false;
  }

  // ─── UPDATE EN TIEMPO REAL (llamado desde el loop de 60fps) ──────────────
  update(speedKmH, throttle) {
    if (!this.isRunning || !this.ctx) return;
    const cfg = this.presets[this.currentPreset];
    const targetBPM = Math.max(0, Math.min(220, cfg.bpmFromSpeed(speedKmH)));
    // Suavizado de BPM para transiciones naturales
    this.bpm = this.bpm * 0.88 + targetBPM * 0.12;
    this._updateContinuous(throttle, speedKmH);
  }

  getCurrentBPM() { return Math.round(this.bpm); }

  // ─── LOOKAHEAD SCHEDULER ─────────────────────────────────────────────────
  _scheduler() {
    const cfg = this.presets[this.currentPreset];

    while (this.nextBeatTime < this.ctx.currentTime + this.SCHEDULE_AHEAD) {
      if (this.bpm > 8) {
        const beatIdx = this.currentBeat % cfg.beatCount;
        // Programar casco
        this._scheduleHoof(
          cfg.beatTypes[beatIdx],
          cfg.beatVolumes[beatIdx],
          this.nextBeatTime
        );
        // Cascabeles en beats definidos
        if (cfg.bellBeats.includes(beatIdx)) {
          this._scheduleBells(this.nextBeatTime);
        }
        // Avanzar tiempo al siguiente beat
        // Dividimos por (beatCount/4) para mantener el ciclo en relación a la música
        const secPerBeat = (60.0 / this.bpm) / (cfg.beatCount / 4);
        this.nextBeatTime += secPerBeat;
      } else {
        // Casi parado: avanzar sin sonido
        this.nextBeatTime = this.ctx.currentTime + 0.15;
      }
      this.currentBeat++;
    }
    this.timerID = setTimeout(() => this._scheduler(), this.LOOKAHEAD_MS);
  }

  // ─── SÍNTESIS DE CASCO ───────────────────────────────────────────────────
  _scheduleHoof(type, volume, time) {
    // Parámetros según tipo de superficie
    let dur, hpFreq, lpFreq, subFreq, subVol;

    switch (type) {
      case 'hoof_hard':
        dur = 0.024; hpFreq = 380; lpFreq = 2600; subFreq = 90;  subVol = 0.18; break;
      case 'hoof_wood':
        dur = 0.018; hpFreq = 650; lpFreq = 3200; subFreq = 110; subVol = 0.06; break;
      case 'hoof_wood_hard':
        dur = 0.026; hpFreq = 420; lpFreq = 2800; subFreq = 95;  subVol = 0.14; break;
      case 'hoof_snow':
        dur = 0.028; hpFreq =  80; lpFreq =  700; subFreq = 55;  subVol = 0.05; break;
      case 'hoof_snow_hard':
        dur = 0.032; hpFreq = 100; lpFreq =  900; subFreq = 65;  subVol = 0.10; break;
      default: // 'hoof'
        dur = 0.019; hpFreq = 480; lpFreq = 2500; subFreq = 100; subVol = 0.10; break;
    }

    // --- Capa principal: clic percusivo ---
    const bufSz  = Math.ceil(this.ctx.sampleRate * dur);
    const buf    = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSz * 0.22));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = hpFreq;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = lpFreq;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume * this.masterVolume, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(hp); hp.connect(lp); lp.connect(g);
    g.connect(this.dryGain); g.connect(this.reverbNode);
    src.start(time);

    // --- Capa de sub-thud (solo en golpes fuertes) ---
    if (subVol > 0.07) {
      const subSz   = Math.ceil(this.ctx.sampleRate * 0.045);
      const subBuf  = this.ctx.createBuffer(1, subSz, this.ctx.sampleRate);
      const subData = subBuf.getChannelData(0);
      for (let i = 0; i < subSz; i++) {
        subData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (subSz * 0.5));
      }
      const subSrc  = this.ctx.createBufferSource();
      subSrc.buffer = subBuf;

      const subFilt = this.ctx.createBiquadFilter();
      subFilt.type = 'lowpass'; subFilt.frequency.value = subFreq; subFilt.Q.value = 2.5;

      const subG = this.ctx.createGain();
      subG.gain.setValueAtTime(subVol * this.masterVolume, time);
      subG.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

      subSrc.connect(subFilt); subFilt.connect(subG); subG.connect(this.dryGain);
      subSrc.start(time);
    }
  }

  // ─── SÍNTESIS DE CASCABELES ───────────────────────────────────────────────
  _scheduleBells(time) {
    // Acorde de cascabeles: A6 + C7 + E7 + A7 (grupo armónico brillante)
    const partials = [
      { freq: 1760 + Math.random() * 18, vol: 0.22, decay: 0.45 },
      { freq: 2093 + Math.random() * 22, vol: 0.18, decay: 0.40 },
      { freq: 2637 + Math.random() * 28, vol: 0.14, decay: 0.35 },
      { freq: 3520 + Math.random() * 35, vol: 0.08, decay: 0.28 },
    ];

    partials.forEach(({ freq, vol, decay }) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Micro-vibrato para que suene más orgánico
      const vib = this.ctx.createOscillator();
      vib.type = 'sine'; vib.frequency.value = 6 + Math.random() * 3;
      const vibG = this.ctx.createGain();
      vibG.gain.value = 8;
      vib.connect(vibG); vibG.connect(osc.frequency);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol * this.masterVolume, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + decay);

      osc.connect(g);
      g.connect(this.dryGain);
      g.connect(this.reverbNode);

      osc.start(time); vib.start(time);
      osc.stop(time + decay + 0.05);
      vib.stop(time + decay + 0.05);
    });
  }

  // ─── CAPAS CONTINUAS (crujidos, ruedas, viento) ───────────────────────────
  _startContinuous(layers) {
    this.continuousNodes = [];

    if (layers.includes('creak')) {
      // Crujido de madera: ruido filtrado + LFO en la frecuencia del filtro
      const noiseNode = this._makeNoiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 175; bp.Q.value = 3.0;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.7;
      const lfoG = this.ctx.createGain(); lfoG.gain.value = 55;
      lfo.connect(lfoG); lfoG.connect(bp.frequency);

      const g = this.ctx.createGain(); g.gain.value = 0.05;
      noiseNode.connect(bp); bp.connect(g); g.connect(this.dryGain);
      noiseNode.start(); lfo.start();
      this.continuousNodes.push({ type: 'creak', noiseNode, lfo, gain: g });
    }

    if (layers.includes('wheel')) {
      // Chirrido de eje: oscilador con vibrato lento
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 390;
      const vib = this.ctx.createOscillator();
      vib.type = 'sine'; vib.frequency.value = 2.2;
      const vibG = this.ctx.createGain(); vibG.gain.value = 22;
      vib.connect(vibG); vibG.connect(osc.frequency);

      const g = this.ctx.createGain(); g.gain.value = 0.014;
      osc.connect(g); g.connect(this.dryGain);
      osc.start(); vib.start();
      this.continuousNodes.push({ type: 'wheel', osc, vib, gain: g });
    }

    if (layers.includes('wind')) {
      // Viento: ruido rosa de alta frecuencia
      const noiseNode = this._makeNoiseSource();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2000;
      const g = this.ctx.createGain(); g.gain.value = 0.025;
      noiseNode.connect(hp); hp.connect(g); g.connect(this.dryGain);
      noiseNode.start();
      this.continuousNodes.push({ type: 'wind', noiseNode, gain: g });
    }
  }

  _updateContinuous(throttle, speedKmH) {
    const spd = Math.min(1, speedKmH / 35);
    this.continuousNodes.forEach(n => {
      const now = this.ctx.currentTime;
      switch (n.type) {
        case 'creak': n.gain.gain.setTargetAtTime(0.03 + spd * 0.09, now, 0.6); break;
        case 'wheel': n.gain.gain.setTargetAtTime(0.008 + spd * 0.025, now, 0.5); break;
        case 'wind':  n.gain.gain.setTargetAtTime(0.008 + spd * 0.055, now, 0.3); break;
      }
    });
  }

  _stopContinuous() {
    this.continuousNodes.forEach(n => {
      ['noiseNode', 'osc', 'lfo', 'vib'].forEach(k => {
        try { if (n[k]) n[k].stop(); } catch(e) {}
      });
    });
    this.continuousNodes = [];
  }

  // ─── UTILITIES ────────────────────────────────────────────────────────────
  _makeNoiseSource() {
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
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  _createReverb(durationSec, decay) {
    const len = Math.ceil(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay * 10);
      }
    }
    const conv = this.ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  // ─── SETTERS ──────────────────────────────────────────────────────────────
  setPreset(name) {
    if (this.presets[name]) {
      const wasRunning = this.isRunning;
      const savedCtx   = this.ctx;
      if (wasRunning) this.stop();
      this.currentPreset = name;
      if (wasRunning) this.start(savedCtx);
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.outputGain && this.ctx) {
      this.outputGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }
}

window.RhythmicSynthesizer = RhythmicSynthesizer;
