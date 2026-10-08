/**
 * RhythmicSynthesizer — Motor de síntesis física y orgánica
 * Vehículos: Caballo (galope realista con micro-fricción y doble golpe), 
 *            Carreta (crujidos de madera gruesa + vibración de rueda + caballo de tiro), 
 *            Trineo (cascos acolchados en nieve + cascabeles de bronce).
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

    // Scheduler de alta precisión
    this.nextBeatTime = 0.0;
    this.currentBeat  = 0;
    this.bpm          = 0;
    this.timerID      = null;
    this.LOOKAHEAD_MS    = 25;
    this.SCHEDULE_AHEAD  = 0.12;

    this.continuousNodes = [];

    this.presets = {
      horse: {
        // Galope real de 4 tiempos asimétricos (cla-clack ... cla-CLUMP)
        beatCount: 4,
        beatOffsets: [0.0, 0.22, 0.48, 0.70],
        beatTypes:   ['hoof_strike', 'hoof_toe', 'hoof_strike', 'hoof_slam'],
        beatVolumes: [ 0.75,          0.55,       0.70,          1.00 ],
        bellBeats:   [],
        continuous:  ['hoof_dust'],
        reverbMix:   0.32,
        bpmFromSpeed: (kmh) => Math.max(0, 45 + kmh * 4.6),
      },
      carreta: {
        beatCount: 4,
        beatOffsets: [0.0, 0.24, 0.50, 0.72],
        beatTypes:   ['wood_hoof', 'wood_hoof_toe', 'wood_hoof', 'wood_hoof_slam'],
        beatVolumes: [ 0.70,        0.50,           0.65,        0.95 ],
        bellBeats:   [],
        continuous:  ['heavy_creak', 'iron_wheel', 'harness_rattle'],
        reverbMix:   0.28,
        bpmFromSpeed: (kmh) => Math.max(0, 35 + kmh * 3.8),
      },
      sleigh: {
        beatCount: 4,
        beatOffsets: [0.0, 0.23, 0.49, 0.71],
        beatTypes:   ['snow_plow', 'snow_light', 'snow_plow', 'snow_slam'],
        beatVolumes: [ 0.60,        0.45,         0.55,        0.85 ],
        bellBeats:   [0, 2],
        continuous:  ['wind_glide'],
        reverbMix:   0.45,
        bpmFromSpeed: (kmh) => Math.max(0, 42 + kmh * 4.3),
      },
    };
  }

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

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value      = 12;
    this.compressor.ratio.value     = 4.5;
    this.compressor.attack.value    = 0.003;
    this.compressor.release.value   = 0.22;

    this.outputGain = this.ctx.createGain();
    this.outputGain.gain.setValueAtTime(this.masterVolume, now);
    this.compressor.connect(this.outputGain);
    this.outputGain.connect(this.ctx.destination);

    // Reverb orgánico exterior
    this.reverbNode = this._createOrganicReverb(2.0, 0.55);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = cfg.reverbMix;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0 - cfg.reverbMix;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.dryGain.connect(this.compressor);

    this._startContinuous(cfg.continuous);

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

  update(speedKmH, throttle) {
    if (!this.isRunning || !this.ctx) return;
    const cfg = this.presets[this.currentPreset];
    const targetBPM = Math.max(0, Math.min(220, cfg.bpmFromSpeed(speedKmH)));
    this.bpm = this.bpm * 0.88 + targetBPM * 0.12;
    this._updateContinuous(throttle, speedKmH);
  }

  getCurrentBPM() { return Math.round(this.bpm); }

  _scheduler() {
    const cfg = this.presets[this.currentPreset];

    while (this.nextBeatTime < this.ctx.currentTime + this.SCHEDULE_AHEAD) {
      if (this.bpm > 8) {
        const beatIdx = this.currentBeat % cfg.beatCount;
        
        // Offset asimétrico para simular el paso y galope orgánico de 4 patas
        const baseDuration = (60.0 / this.bpm);
        const subOffset = (cfg.beatOffsets && cfg.beatOffsets[beatIdx] !== undefined)
          ? cfg.beatOffsets[beatIdx] * baseDuration
          : (beatIdx * (baseDuration / cfg.beatCount));
        
        const scheduledTime = this.nextBeatTime + (subOffset * 0.4);

        this._scheduleHoof(
          cfg.beatTypes[beatIdx],
          cfg.beatVolumes[beatIdx],
          scheduledTime
        );

        if (cfg.bellBeats.includes(beatIdx)) {
          this._scheduleBells(scheduledTime);
        }

        const secPerBeat = (60.0 / this.bpm) / (cfg.beatCount / 4);
        this.nextBeatTime += secPerBeat;
      } else {
        this.nextBeatTime = this.ctx.currentTime + 0.15;
      }
      this.currentBeat++;
    }
    this.timerID = setTimeout(() => this._scheduler(), this.LOOKAHEAD_MS);
  }

  // ─── SÍNTESIS ACÚSTICA DE CASCO Y PEZUÑA ─────────────────────────────────
  _scheduleHoof(type, volume, time) {
    const now = time;
    const gainScale = volume * this.masterVolume;

    // 1. CAPA DE IMPACTO OSEO/CÓRNEO (Frecuencia resonante de pezuña hueca de queratina)
    let bodyFreq = 160;
    let bodyQ    = 3.8;
    let clickHp  = 300;
    let clickLp  = 2200;
    let duration = 0.055;

    if (type.includes('snow')) {
      bodyFreq = 110;
      bodyQ    = 1.5;
      clickHp  = 120;
      clickLp  = 850;
      duration = 0.080;
    } else if (type.includes('wood')) {
      bodyFreq = 190;
      bodyQ    = 4.5; // Resonancia hueca de tabla
      clickHp  = 400;
      clickLp  = 3400;
      duration = 0.048;
    }

    // Generador de tono resonante con envolvente de caída libre (cuerpo del casco)
    const bodyOsc = this.ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(bodyFreq * 1.5, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(bodyFreq * 0.75, now + duration);

    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(bodyFreq * 2.2, now);
    bodyFilter.Q.value = bodyQ;

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.55 * gainScale, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    bodyOsc.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(this.dryGain);
    bodyGain.connect(this.reverbNode);

    bodyOsc.start(now);
    bodyOsc.stop(now + duration);

    // 2. CAPA DE CONTACTO Y ROCE (Tierra / Piedras / Crujido)
    const noiseSz = Math.ceil(this.ctx.sampleRate * duration);
    const noiseBuf = this.ctx.createBuffer(1, noiseSz, this.ctx.sampleRate);
    const nData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseSz; i++) {
      nData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseSz * 0.28));
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const nHp = this.ctx.createBiquadFilter();
    nHp.type = 'highpass';
    nHp.frequency.value = clickHp;

    const nLp = this.ctx.createBiquadFilter();
    nLp.type = 'lowpass';
    nLp.frequency.value = clickLp;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.40 * gainScale, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSrc.connect(nHp);
    nHp.connect(nLp);
    nLp.connect(nGain);
    nGain.connect(this.dryGain);
    nGain.connect(this.reverbNode);

    noiseSrc.start(now);

    // 3. RETUMBO DE SUELO (THUMP SUB-BAJO) para golpes fuertes de galope
    if (type.includes('slam')) {
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.07);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.35 * gainScale, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      subOsc.connect(subGain);
      subGain.connect(this.dryGain);
      subOsc.start(now);
      subOsc.stop(now + 0.08);
    }
  }

  // ─── CASCABELES METÁLICOS DE BRONCE (Trineo) ──────────────────────────────
  _scheduleBells(time) {
    const bellPitches = [
      { f: 1975, d: 0.35, v: 0.25 },
      { f: 2349, d: 0.32, v: 0.22 },
      { f: 2793, d: 0.30, v: 0.18 },
      { f: 3520, d: 0.25, v: 0.12 },
    ];

    bellPitches.forEach(({ f, d, v }) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      // Pequeño arpegio de agite
      const jitter = (Math.random() - 0.5) * 20;
      osc.frequency.setValueAtTime(f + jitter, time);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(v * this.masterVolume, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + d);

      osc.connect(g);
      g.connect(this.dryGain);
      g.connect(this.reverbNode);

      osc.start(time);
      osc.stop(time + d + 0.02);
    });
  }

  // ─── CAPAS CONTINUAS REALISTAS (Crujido de madera maciza y rueda) ──────────
  _startContinuous(layers) {
    this.continuousNodes = [];

    if (layers.includes('heavy_creak')) {
      // Crujido de madera de carreta vieja: Ruido filtrado con resonancia en 120-240Hz
      const noise = this._makeNoiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 160;
      bp.Q.value = 4.0;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sawtooth';
      lfo.frequency.value = 1.2;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 80;
      lfo.connect(lfoG);
      lfoG.connect(bp.frequency);

      const g = this.ctx.createGain();
      g.gain.value = 0.06;

      noise.connect(bp);
      bp.connect(g);
      g.connect(this.dryGain);

      noise.start();
      lfo.start();
      this.continuousNodes.push({ type: 'heavy_creak', noise, lfo, gain: g });
    }

    if (layers.includes('iron_wheel')) {
      // Roce de llanta de hierro sobre tierra/adoquín
      const noise = this._makeNoiseSource();
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.Q.value = 1.2;

      const g = this.ctx.createGain();
      g.gain.value = 0.035;

      noise.connect(lp);
      lp.connect(g);
      g.connect(this.dryGain);

      noise.start();
      this.continuousNodes.push({ type: 'iron_wheel', noise, gain: g });
    }

    if (layers.includes('harness_rattle')) {
      // Cascabeles y correas de cuero de la carreta
      const noise = this._makeNoiseSource();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2400;

      const g = this.ctx.createGain();
      g.gain.value = 0.015;

      noise.connect(hp);
      hp.connect(g);
      g.connect(this.dryGain);

      noise.start();
      this.continuousNodes.push({ type: 'harness_rattle', noise, gain: g });
    }

    if (layers.includes('wind_glide')) {
      const noise = this._makeNoiseSource();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;

      const g = this.ctx.createGain();
      g.gain.value = 0.025;

      noise.connect(hp);
      hp.connect(g);
      g.connect(this.dryGain);

      noise.start();
      this.continuousNodes.push({ type: 'wind_glide', noise, gain: g });
    }
  }

  _updateContinuous(throttle, speedKmH) {
    const spd = Math.min(1.2, speedKmH / 30);
    this.continuousNodes.forEach(n => {
      const now = this.ctx.currentTime;
      if (n.type === 'heavy_creak') n.gain.gain.setTargetAtTime(0.04 + spd * 0.09, now, 0.4);
      if (n.type === 'iron_wheel')  n.gain.gain.setTargetAtTime(0.02 + spd * 0.07, now, 0.3);
      if (n.type === 'harness_rattle') n.gain.gain.setTargetAtTime(0.01 + spd * 0.03, now, 0.3);
      if (n.type === 'wind_glide')  n.gain.gain.setTargetAtTime(0.01 + spd * 0.06, now, 0.3);
    });
  }

  _stopContinuous() {
    this.continuousNodes.forEach(n => {
      ['noise', 'lfo'].forEach(k => {
        try { if (n[k]) n[k].stop(); } catch(e) {}
      });
    });
    this.continuousNodes = [];
  }

  _makeNoiseSource() {
    const bufSz = 3 * this.ctx.sampleRate;
    const buf   = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
    const data  = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  _createOrganicReverb(durationSec, decay) {
    const len = Math.ceil(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 8);
      }
    }
    const conv = this.ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

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
