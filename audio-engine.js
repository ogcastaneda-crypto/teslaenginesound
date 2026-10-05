/**
 * Tesla Sound Engine - Web Audio API Synthesizer
 * Generates real-time procedural engine audio without external media assets.
 */
class EngineAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.isRunning = false;

    // Node graph references
    this.masterGain = null;
    this.idleGain = null;
    this.throttleGain = null;

    // Oscillators & Noise
    this.primaryOsc = null;
    this.subOsc = null;
    this.secondaryOsc = null;
    this.intakeNoiseNode = null;
    this.intakeFilter = null;
    this.distortionNode = null;
    this.mainFilter = null;

    // Parameters & Presets
    this.currentPreset = 'v8_muscle';
    this.masterVolume = 0.8;
    this.idleVolume = 0.5;
    this.popFxEnabled = true;

    this.currentRPM = 800;
    this.currentThrottle = 0;
    this.lastPopTime = 0;

    // Preset Definitions
    this.presets = {
      v8_muscle: {
        cylinders: 8,
        waveType: 'sawtooth',
        subType: 'square',
        filterBaseFreq: 180,
        filterThrottleMult: 1200,
        distortion: 0.25,
        popIntense: 1.2
      },
      v10_exotic: {
        cylinders: 10,
        waveType: 'sawtooth',
        subType: 'triangle',
        filterBaseFreq: 280,
        filterThrottleMult: 2200,
        distortion: 0.18,
        popIntense: 0.8
      },
      rotary_turbo: {
        cylinders: 6, // High pulse rate equivalent
        waveType: 'square',
        subType: 'sawtooth',
        filterBaseFreq: 350,
        filterThrottleMult: 2800,
        distortion: 0.35,
        popIntense: 1.8
      },
      cyber_hyper: {
        cylinders: 12,
        waveType: 'sine',
        subType: 'triangle',
        filterBaseFreq: 120,
        filterThrottleMult: 3500,
        distortion: 0.08,
        popIntense: 0.4
      }
    };
  }

  // Initialize Web Audio Context on User Gesture
  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isRunning) return;

    const config = this.presets[this.currentPreset];

    // Master Volume Gain Node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Distortion Node for Engine Harmonics
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.makeDistortionCurve(config.distortion * 50);
    this.distortionNode.oversample = '4x';
    this.distortionNode.connect(this.masterGain);

    // Main Lowpass Filter Node (Opens as RPM/Throttle increases)
    this.mainFilter = this.ctx.createBiquadFilter();
    this.mainFilter.type = 'lowpass';
    this.mainFilter.frequency.setValueAtTime(config.filterBaseFreq, this.ctx.currentTime);
    this.mainFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);
    this.mainFilter.connect(this.distortionNode);

    // Primary Cylinder Pulse Oscillator
    this.primaryOsc = this.ctx.createOscillator();
    this.primaryOsc.type = config.waveType;

    // Sub-Harmonic Oscillator for Low-end Exhaust Rumble
    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = config.subType;

    // Secondary Harmonic Oscillator
    this.secondaryOsc = this.ctx.createOscillator();
    this.secondaryOsc.type = 'sawtooth';

    // Mix Gains
    this.throttleGain = this.ctx.createGain();
    this.primaryOsc.connect(this.throttleGain);
    this.subOsc.connect(this.throttleGain);
    this.secondaryOsc.connect(this.throttleGain);

    this.throttleGain.connect(this.mainFilter);

    // Intake Air Noise Generator
    this.intakeNoiseNode = this.createWhiteNoiseNode();
    this.intakeFilter = this.ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.frequency.value = 1200;
    this.intakeFilter.Q.value = 3.0;

    this.intakeGain = this.ctx.createGain();
    this.intakeGain.gain.value = 0.05;

    this.intakeNoiseNode.connect(this.intakeFilter);
    this.intakeFilter.connect(this.intakeGain);
    this.intakeGain.connect(this.masterGain);

    // Start Oscillators
    const now = this.ctx.currentTime;
    this.primaryOsc.start(now);
    this.subOsc.start(now);
    this.secondaryOsc.start(now);
    this.intakeNoiseNode.start(now);

    this.isRunning = true;
    this.update(800, 0, 0); // Initialize to idle
  }

  stop() {
    if (!this.isRunning) return;
    try {
      this.primaryOsc.stop();
      this.subOsc.stop();
      this.secondaryOsc.stop();
      this.intakeNoiseNode.stop();
    } catch (e) {
      console.warn("Audio stop error:", e);
    }
    this.isRunning = false;
  }

  // Real-Time Update Callback: Receives RPM, Throttle Position (0-1), and Acceleration (m/s2)
  update(rpm, throttle = 0, acceleration = 0) {
    if (!this.isRunning || !this.ctx) return;

    this.currentRPM = Math.max(700, Math.min(8500, rpm));
    this.currentThrottle = Math.max(0, Math.min(1, throttle));

    const config = this.presets[this.currentPreset];
    const now = this.ctx.currentTime;

    // Firing frequency calculation: (RPM / 60) * (Cylinders / 2)
    const baseFreq = (this.currentRPM / 60) * (config.cylinders / 2);

    // Set Oscillator Frequencies with smooth ramp
    this.primaryOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.secondaryOsc.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);

    // Filter Frequency Response (Opens up on Acceleration)
    const targetFilterFreq = config.filterBaseFreq + (this.currentThrottle * config.filterThrottleMult) + (baseFreq * 1.8);
    this.mainFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);

    // Volume Modulation
    const throttleGainVal = 0.3 + (this.currentThrottle * 0.7);
    this.throttleGain.gain.setTargetAtTime(throttleGainVal * this.idleVolume, now, 0.05);

    // Intake Air Noise volume
    this.intakeGain.gain.setTargetAtTime(0.02 + (this.currentThrottle * 0.18), now, 0.05);

    // Trigger Deceleration Pops/Burbles when letting off gas at high RPM
    if (this.popFxEnabled && acceleration < -1.2 && this.currentRPM > 2800 && this.currentThrottle < 0.15) {
      this.triggerExhaustPop(config.popIntense);
    }
  }

  // Generate Exhaust Pop Crackle Sound
  triggerExhaustPop(intensity = 1.0) {
    const now = this.ctx.currentTime;
    if (now - this.lastPopTime < 0.12) return; // Debounce pops
    this.lastPopTime = now;

    const bufferSize = this.ctx.sampleRate * 0.05; // 50ms burst
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const popSource = this.ctx.createBufferSource();
    popSource.buffer = buffer;

    const popFilter = this.ctx.createBiquadFilter();
    popFilter.type = 'highpass';
    popFilter.frequency.value = 400 + Math.random() * 600;

    const popGain = this.ctx.createGain();
    popGain.gain.setValueAtTime(0.4 * intensity * this.masterVolume, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    popSource.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.masterGain);

    popSource.start(now);
  }

  // Create White Noise Buffer Source
  createWhiteNoiseNode() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    return whiteNoise;
  }

  // Soft Clipping Distortion Curve Generator
  makeDistortionCurve(amount) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // Setters
  setPreset(name) {
    if (this.presets[name]) {
      this.currentPreset = name;
      if (this.isRunning) {
        this.stop();
        this.start();
      }
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
