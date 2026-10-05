/**
 * Tesla Sound Engine - Main Application Logic
 * Telemetry, GPS Tracking, Gear Simulation & UI Updates
 */
document.addEventListener('DOMContentLoaded', () => {
  // Instantiate Audio Synth
  const audioEngine = new window.EngineAudioSynthesizer();

  // Application State
  const state = {
    isEngineRunning: false,
    useGPS: true,
    useMPH: false,
    currentSpeedKmH: 0,
    targetSpeedKmH: 0,
    currentRPM: 800,
    targetRPM: 800,
    currentGear: 1,
    throttle: 0, // 0 to 1
    acceleration: 0, // m/s^2
    transmission: 'auto_6',
    
    // GPS State
    watchId: null,
    lastGPSCheckTime: 0,
    lastGPSSpeedMs: 0,

    // SVG Gauge Dash Constants
    gaugeMaxOffset: 380
  };

  // DOM Elements
  const btnIgnition = document.getElementById('btn-ignition');
  const ignitionText = document.getElementById('ignition-text');
  const speedVal = document.getElementById('speed-value');
  const rpmVal = document.getElementById('rpm-value');
  const unitLabel = document.getElementById('unit-label');
  const gearIndicator = document.getElementById('gear-indicator');
  const speedGaugeFill = document.getElementById('speed-gauge-fill');
  const rpmGaugeFill = document.getElementById('rpm-gauge-fill');
  
  const gpsStatusBadge = document.getElementById('gps-status');
  const gpsStatusText = document.getElementById('gps-status-text');
  const audioStatusBadge = document.getElementById('audio-status');
  const audioStatusText = document.getElementById('audio-status-text');

  const presetBtns = document.querySelectorAll('.preset-btn');
  const modeGpsBtn = document.getElementById('mode-gps');
  const modeDemoBtn = document.getElementById('mode-demo');
  const demoControls = document.getElementById('demo-controls');
  const throttleSlider = document.getElementById('throttle-slider');
  const demoThrottleVal = document.getElementById('demo-throttle-val');
  const transmissionSelect = document.getElementById('transmission-select');

  const masterVolSlider = document.getElementById('master-volume');
  const idleVolSlider = document.getElementById('idle-volume');
  const popFxToggle = document.getElementById('pop-fx-toggle');
  const unitToggle = document.getElementById('unit-toggle');

  // Telemetry DOM
  const tGpsSpeed = document.getElementById('t-gps-speed');
  const tAccel = document.getElementById('t-accel');
  const tFreq = document.getElementById('t-freq');
  const tCoords = document.getElementById('t-coords');
  const tAccuracy = document.getElementById('telemetry-accuracy');

  // ----------------------------------------------------
  // IGNITION & AUDIO ENGINE TOGGLE
  // ----------------------------------------------------
  btnIgnition.addEventListener('click', () => {
    state.isEngineRunning = !state.isEngineRunning;

    if (state.isEngineRunning) {
      audioEngine.start();
      btnIgnition.classList.add('active');
      ignitionText.textContent = 'STOP ENGINE';

      audioStatusBadge.className = 'badge badge-success';
      audioStatusText.textContent = 'Audio: Activo';

      if (state.useGPS) {
        startGPSTracking();
      }
    } else {
      audioEngine.stop();
      btnIgnition.classList.remove('active');
      ignitionText.textContent = 'START ENGINE';

      audioStatusBadge.className = 'badge badge-danger';
      audioStatusText.textContent = 'Audio: Apagado';

      stopGPSTracking();
      resetGaugeState();
    }
  });

  // ----------------------------------------------------
  // GPS GEOLOCATION TRACKER
  // ----------------------------------------------------
  function startGPSTracking() {
    if (!('geolocation' in navigator)) {
      gpsStatusBadge.className = 'badge badge-danger';
      gpsStatusText.textContent = 'GPS: No soportado';
      return;
    }

    gpsStatusBadge.className = 'badge badge-warning';
    gpsStatusText.textContent = 'GPS: Buscando señal...';

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    };

    state.watchId = navigator.geolocation.watchPosition(
      handleGPSPosition,
      handleGPSError,
      options
    );
  }

  function stopGPSTracking() {
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
    gpsStatusBadge.className = 'badge badge-warning';
    gpsStatusText.textContent = 'GPS: Inactivo';
    tCoords.textContent = 'GPS Apagado';
  }

  function handleGPSPosition(position) {
    gpsStatusBadge.className = 'badge badge-success';
    gpsStatusText.textContent = 'GPS: Conectado';

    const now = Date.now();
    const rawSpeedMs = position.coords.speed !== null ? Math.max(0, position.coords.speed) : 0;
    const accuracy = position.coords.accuracy ? position.coords.accuracy.toFixed(1) : '--';
    
    tAccuracy.textContent = `Precisión GPS: ${accuracy} m`;
    tCoords.textContent = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;

    // Calculate Acceleration: delta_v / delta_t
    if (state.lastGPSCheckTime > 0) {
      const dt = (now - state.lastGPSCheckTime) / 1000;
      if (dt > 0.1) {
        const dv = rawSpeedMs - state.lastGPSSpeedMs;
        // Exponential Moving Average (EMA) smoothing for acceleration
        const instantAccel = dv / dt;
        state.acceleration = state.acceleration * 0.7 + instantAccel * 0.3;
      }
    }

    state.lastGPSCheckTime = now;
    state.lastGPSSpeedMs = rawSpeedMs;

    // Convert m/s to km/h
    const speedKmH = rawSpeedMs * 3.6;
    state.targetSpeedKmH = speedKmH;

    // Estimate Throttle pedal position based on positive acceleration
    state.throttle = Math.max(0, Math.min(1, state.acceleration / 3.0));
  }

  function handleGPSError(error) {
    console.warn("GPS Error:", error.message);
    gpsStatusBadge.className = 'badge badge-danger';
    gpsStatusText.textContent = 'GPS Error: ' + error.code;
  }

  // ----------------------------------------------------
  // GEAR & TRANSMISSION RATIO SIMULATOR
  // ----------------------------------------------------
  function calculateTransmissionRPM(speedKmH, accel) {
    if (speedKmH <= 0.5) return { rpm: 800, gear: 'N' };

    if (state.transmission === 'direct') {
      // Single ratio electric drive mapping
      const rpm = 800 + (speedKmH * 65);
      return { rpm: Math.min(8500, rpm), gear: 'D' };
    }

    // Gear ratios table for 6-speed / 7-speed
    const gearRatios = state.transmission === 'auto_7' 
      ? [0, 4.2, 2.8, 1.9, 1.4, 1.1, 0.9, 0.75] 
      : [0, 3.8, 2.3, 1.5, 1.1, 0.88, 0.68];
    
    const maxGears = gearRatios.length - 1;
    let gear = state.currentGear;
    if (gear < 1) gear = 1;

    // Calculate engine RPM for current gear
    let rpm = (speedKmH * gearRatios[gear] * 40) + 700;

    // Automatic Gear Shift Logic
    if (rpm > 6600 && gear < maxGears) {
      state.currentGear++;
      gear = state.currentGear;
      rpm = (speedKmH * gearRatios[gear] * 40) + 700; // Drop RPM after upshift
    } else if (rpm < 1800 && gear > 1) {
      state.currentGear--;
      gear = state.currentGear;
      rpm = (speedKmH * gearRatios[gear] * 40) + 700; // Spike RPM after downshift
    }

    return { rpm: Math.min(8200, Math.max(800, rpm)), gear: gear };
  }

  // ----------------------------------------------------
  // MAIN ANIMATION LOOP (60 FPS Update)
  // ----------------------------------------------------
  function updateLoop() {
    requestAnimationFrame(updateLoop);

    // Smooth speed interpolation
    state.currentSpeedKmH += (state.targetSpeedKmH - state.currentSpeedKmH) * 0.12;
    if (Math.abs(state.currentSpeedKmH) < 0.1) state.currentSpeedKmH = 0;

    // Gear & RPM Calculation
    const sim = calculateTransmissionRPM(state.currentSpeedKmH, state.acceleration);
    state.targetRPM = sim.rpm;
    
    // Smooth RPM response
    state.currentRPM += (state.targetRPM - state.currentRPM) * 0.18;

    // Update UI Elements
    const displaySpeed = state.useMPH ? (state.currentSpeedKmH * 0.621371) : state.currentSpeedKmH;
    speedVal.textContent = Math.round(displaySpeed);
    rpmVal.textContent = Math.round(state.currentRPM);
    gearIndicator.textContent = `GEAR ${sim.gear}`;

    // SVG Gauge Offsets
    const speedMax = state.useMPH ? 160 : 260;
    const speedPct = Math.min(1, state.currentSpeedKmH / speedMax);
    const speedOffset = state.gaugeMaxOffset - (speedPct * state.gaugeMaxOffset);
    speedGaugeFill.style.strokeDashoffset = speedOffset;

    const rpmPct = Math.min(1, state.currentRPM / 8500);
    const rpmOffset = state.gaugeMaxOffset - (rpmPct * state.gaugeMaxOffset);
    rpmGaugeFill.style.strokeDashoffset = rpmOffset;

    // Send data to Audio Synthesizer
    if (state.isEngineRunning) {
      audioEngine.update(state.currentRPM, state.throttle, state.acceleration);
    }

    // Telemetry updates
    const unitTextStr = state.useMPH ? 'mph' : 'km/h';
    tGpsSpeed.textContent = `${displaySpeed.toFixed(1)} ${unitTextStr}`;
    tAccel.textContent = `${state.acceleration.toFixed(2)} m/s²`;
    tFreq.textContent = `${Math.round((state.currentRPM / 60) * 4)} Hz`;
  }

  // Start 60fps Loop
  requestAnimationFrame(updateLoop);

  // ----------------------------------------------------
  // DEMO SIMULATION & KEYBOARD CONTROLS
  // ----------------------------------------------------
  throttleSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    demoThrottleVal.textContent = `${val}%`;
    state.throttle = val / 100;
    state.targetSpeedKmH = (val / 100) * 180;
    state.acceleration = (val / 100) * 3.5;
  });

  let keyThrottleInterval = null;
  window.addEventListener('keydown', (e) => {
    if (!state.useGPS && (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w')) {
      state.throttle = Math.min(1.0, state.throttle + 0.08);
      state.targetSpeedKmH = Math.min(220, state.targetSpeedKmH + 6);
      state.acceleration = 2.5;
      throttleSlider.value = Math.round(state.throttle * 100);
      demoThrottleVal.textContent = `${throttleSlider.value}%`;
    } else if (!state.useGPS && (e.key === 'ArrowDown' || e.key.toLowerCase() === 's')) {
      state.throttle = Math.max(0, state.throttle - 0.12);
      state.targetSpeedKmH = Math.max(0, state.targetSpeedKmH - 12);
      state.acceleration = -3.0; // Deceleration burst
      throttleSlider.value = Math.round(state.throttle * 100);
      demoThrottleVal.textContent = `${throttleSlider.value}%`;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!state.useGPS && (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w')) {
      state.acceleration = -1.5; // Natural deceleration
    }
  });

  // ----------------------------------------------------
  // EVENT LISTENERS FOR SETTINGS & CONTROLS
  // ----------------------------------------------------
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.getAttribute('data-preset');
      audioEngine.setPreset(preset);
    });
  });

  modeGpsBtn.addEventListener('click', () => {
    modeGpsBtn.classList.add('active');
    modeDemoBtn.classList.remove('active');
    demoControls.classList.add('hidden');
    state.useGPS = true;
    if (state.isEngineRunning) startGPSTracking();
  });

  modeDemoBtn.addEventListener('click', () => {
    modeDemoBtn.classList.add('active');
    modeGpsBtn.classList.remove('active');
    demoControls.classList.remove('hidden');
    state.useGPS = false;
    stopGPSTracking();
  });

  transmissionSelect.addEventListener('change', (e) => {
    state.transmission = e.target.value;
    state.currentGear = 1;
  });

  masterVolSlider.addEventListener('input', (e) => {
    audioEngine.setMasterVolume(e.target.value / 100);
  });

  idleVolSlider.addEventListener('input', (e) => {
    audioEngine.setIdleVolume(e.target.value / 100);
  });

  popFxToggle.addEventListener('change', (e) => {
    audioEngine.setPopFx(e.target.checked);
  });

  unitToggle.addEventListener('change', (e) => {
    state.useMPH = e.target.checked;
    unitLabel.textContent = state.useMPH ? 'MPH' : 'KM/H';
  });

  function resetGaugeState() {
    state.targetSpeedKmH = 0;
    state.targetRPM = 800;
    state.throttle = 0;
    state.acceleration = 0;
    state.currentGear = 1;
  }
});
