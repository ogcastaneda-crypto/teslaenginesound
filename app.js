/**
 * Tesla Sound Engine — Main Application Logic (v3)
 * Cambios:
 *  - Fix RPM: multiplicador 40→13, upshift 6600→4500, downshift 1800→1200
 *  - Routing dual: EngineAudioSynthesizer / RhythmicSynthesizer
 *  - Gauge RPM cambia a BPM en modo rítmico
 */
document.addEventListener('DOMContentLoaded', () => {

  const audioEngine  = new window.EngineAudioSynthesizer();
  const rhythmEngine = new window.RhythmicSynthesizer();

  // Presets que usan el sintetizador rítmico
  const RHYTHMIC_PRESETS = new Set(['horse', 'carreta', 'sleigh']);
  const RHYTHMIC_EMOJI   = { horse: '🐴', carreta: '🪵', sleigh: '🎅' };

  const state = {
    isEngineRunning:  false,
    useGPS:           true,
    useMPH:           false,
    currentSpeedKmH:  0,
    targetSpeedKmH:   0,
    currentRPM:       800,
    targetRPM:        800,
    currentGear:      1,
    throttle:         0,
    acceleration:     0,
    transmission:     'auto_6',
    currentPreset:    'v8_muscle',
    watchId:          null,
    lastGPSCheckTime: 0,
    lastGPSSpeedMs:   0,
    gaugeMaxOffset:   380,
  };

  // ── DOM References ──────────────────────────────────────────────────────
  const btnIgnition      = document.getElementById('btn-ignition');
  const ignitionText     = document.getElementById('ignition-text');
  const speedVal         = document.getElementById('speed-value');
  const rpmVal           = document.getElementById('rpm-value');
  const unitLabel        = document.getElementById('unit-label');
  const rpmLabel         = document.getElementById('rpm-label');
  const gearIndicator    = document.getElementById('gear-indicator');
  const speedGaugeFill   = document.getElementById('speed-gauge-fill');
  const rpmGaugeFill     = document.getElementById('rpm-gauge-fill');

  const gpsStatusBadge   = document.getElementById('gps-status');
  const gpsStatusText    = document.getElementById('gps-status-text');
  const audioStatusBadge = document.getElementById('audio-status');
  const audioStatusText  = document.getElementById('audio-status-text');

  const chipBtns          = document.querySelectorAll('.chip');
  const modeGpsBtn        = document.getElementById('mode-gps');
  const modeDemoBtn       = document.getElementById('mode-demo');
  const demoControls      = document.getElementById('demo-controls');
  const throttleSlider    = document.getElementById('throttle-slider');
  const demoThrottleVal   = document.getElementById('demo-throttle-val');
  const transmissionSelect = document.getElementById('transmission-select');

  const masterVolSlider   = document.getElementById('master-volume');
  const idleVolSlider     = document.getElementById('idle-volume');
  const popFxToggle       = document.getElementById('pop-fx-toggle');
  const unitToggle        = document.getElementById('unit-toggle');

  const tGpsSpeed   = document.getElementById('t-gps-speed');
  const tAccel      = document.getElementById('t-accel');
  const tFreq       = document.getElementById('t-freq');
  const tCoords     = document.getElementById('t-coords');
  const tAccuracy   = document.getElementById('telemetry-accuracy');

  // ── Helpers ─────────────────────────────────────────────────────────────
  function isRhythmic(preset) { return RHYTHMIC_PRESETS.has(preset); }

  function _startActiveEngine() {
    if (isRhythmic(state.currentPreset)) {
      // Asegurarse de que el audioEngine ya inicializó el ctx
      audioEngine.init();
      rhythmEngine.init(audioEngine.ctx);
      rhythmEngine.setPreset(state.currentPreset);
      rhythmEngine.start(audioEngine.ctx);
    } else {
      audioEngine.setPreset(state.currentPreset);
      audioEngine.start();
    }
  }

  function _stopActiveEngine() {
    if (isRhythmic(state.currentPreset)) {
      rhythmEngine.stop();
    } else {
      audioEngine.stop();
    }
  }

  // ── IGNICIÓN ─────────────────────────────────────────────────────────────
  btnIgnition.addEventListener('click', () => {
    state.isEngineRunning = !state.isEngineRunning;

    if (state.isEngineRunning) {
      _startActiveEngine();
      btnIgnition.classList.add('active');
      ignitionText.textContent = 'STOP';
      audioStatusBadge.className  = 'badge badge-success';
      audioStatusText.textContent = 'Audio: Activo';
      if (state.useGPS) startGPSTracking();
    } else {
      _stopActiveEngine();
      btnIgnition.classList.remove('active');
      ignitionText.textContent = 'START';
      audioStatusBadge.className  = 'badge badge-danger';
      audioStatusText.textContent = 'Audio: Apagado';
      stopGPSTracking();
      resetGaugeState();
    }
  });

  // ── CAMBIO DE PRESET ─────────────────────────────────────────────────────
  function switchPreset(newPreset) {
    const wasRhythmic  = isRhythmic(state.currentPreset);
    const willRhythmic = isRhythmic(newPreset);
    state.currentPreset = newPreset;

    if (!state.isEngineRunning) return;

    if (wasRhythmic && !willRhythmic) {
      // Rítmico → Motor
      rhythmEngine.stop();
      audioEngine.setPreset(newPreset);
      audioEngine.start();
    } else if (!wasRhythmic && willRhythmic) {
      // Motor → Rítmico
      audioEngine.stop();
      audioEngine.init(); // asegurar ctx
      rhythmEngine.init(audioEngine.ctx);
      rhythmEngine.setPreset(newPreset);
      rhythmEngine.start(audioEngine.ctx);
    } else if (wasRhythmic && willRhythmic) {
      // Rítmico → Rítmico
      rhythmEngine.stop();
      rhythmEngine.setPreset(newPreset);
      rhythmEngine.start(audioEngine.ctx);
    } else {
      // Motor → Motor
      audioEngine.setPreset(newPreset);
    }
  }

  // ── GPS ──────────────────────────────────────────────────────────────────
  function startGPSTracking() {
    if (!('geolocation' in navigator)) {
      gpsStatusBadge.className  = 'badge badge-danger';
      gpsStatusText.textContent = 'GPS: No soportado';
      return;
    }
    gpsStatusBadge.className  = 'badge badge-warning';
    gpsStatusText.textContent = 'GPS: Buscando...';
    state.watchId = navigator.geolocation.watchPosition(
      handleGPSPosition, handleGPSError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  function stopGPSTracking() {
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
    gpsStatusBadge.className  = 'badge badge-warning';
    gpsStatusText.textContent = 'GPS: Inactivo';
    if (tCoords) tCoords.textContent = 'GPS Apagado';
  }

  function handleGPSPosition(position) {
    gpsStatusBadge.className  = 'badge badge-success';
    gpsStatusText.textContent = 'GPS: OK';
    const now       = Date.now();
    const rawSpeedMs = position.coords.speed !== null
      ? Math.max(0, position.coords.speed) : 0;
    const accuracy  = position.coords.accuracy
      ? position.coords.accuracy.toFixed(1) : '--';
    if (tAccuracy) tAccuracy.textContent = `Prec: ${accuracy}m`;
    if (tCoords)   tCoords.textContent   =
      `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;

    if (state.lastGPSCheckTime > 0) {
      const dt = (now - state.lastGPSCheckTime) / 1000;
      if (dt > 0.1) {
        const dv = rawSpeedMs - state.lastGPSSpeedMs;
        const instantAccel = dv / dt;
        state.acceleration = state.acceleration * 0.7 + instantAccel * 0.3;
      }
    }
    state.lastGPSCheckTime = now;
    state.lastGPSSpeedMs   = rawSpeedMs;
    state.targetSpeedKmH   = rawSpeedMs * 3.6;
    state.throttle         = Math.max(0, Math.min(1, state.acceleration / 3.0));
  }

  function handleGPSError(error) {
    gpsStatusBadge.className  = 'badge badge-danger';
    gpsStatusText.textContent = 'GPS Err: ' + error.code;
  }

  // ── TRANSMISIÓN Y RPM ────────────────────────────────────────────────────
  function calculateTransmissionRPM(speedKmH, accel) {
    if (speedKmH <= 0.5) return { rpm: 800, gear: 'N' };

    if (state.transmission === 'direct') {
      // EV / transmisión directa — escala lineal desde 800 a 8500 RPM
      const rpm = 800 + (speedKmH * 20);
      return { rpm: Math.min(8500, rpm), gear: 'D' };
    }

    // ── MULTIPLICADOR CORREGIDO: 40 → 13 ──────────────────────────────────
    // Antes: 10 km/h → 2220 RPM (3x demasiado alto)
    // Ahora: 10 km/h →  1194 RPM (realista)
    const gearRatios = state.transmission === 'auto_7'
      ? [0, 4.2, 2.8, 1.9, 1.4, 1.1, 0.9, 0.75]
      : [0, 3.8, 2.3, 1.5, 1.1, 0.88, 0.68];

    const maxGears = gearRatios.length - 1;
    let gear = Math.max(1, state.currentGear);
    let rpm  = (speedKmH * gearRatios[gear] * 13) + 700;

    // Cambios de marcha — umbrales corregidos
    if (rpm > 4500 && gear < maxGears) {
      state.currentGear++;
      gear = state.currentGear;
      rpm  = (speedKmH * gearRatios[gear] * 13) + 700;
    } else if (rpm < 1200 && gear > 1) {
      state.currentGear--;
      gear = state.currentGear;
      rpm  = (speedKmH * gearRatios[gear] * 13) + 700;
    }

    return { rpm: Math.min(8200, Math.max(800, rpm)), gear };
  }

  // ── LOOP PRINCIPAL 60 FPS ────────────────────────────────────────────────
  function updateLoop() {
    requestAnimationFrame(updateLoop);

    // Suavizado de velocidad
    state.currentSpeedKmH += (state.targetSpeedKmH - state.currentSpeedKmH) * 0.12;
    if (Math.abs(state.currentSpeedKmH) < 0.1) state.currentSpeedKmH = 0;

    const displaySpeed = state.useMPH
      ? (state.currentSpeedKmH * 0.621371) : state.currentSpeedKmH;
    speedVal.textContent = Math.round(displaySpeed);

    // Gauge de velocidad
    const speedMax = state.useMPH ? 160 : 260;
    const speedPct = Math.min(1, state.currentSpeedKmH / speedMax);
    speedGaugeFill.style.strokeDashoffset =
      state.gaugeMaxOffset - (speedPct * state.gaugeMaxOffset);

    if (!state.isEngineRunning) {
      rpmVal.textContent = isRhythmic(state.currentPreset) ? '0' : '800';
      rpmGaugeFill.style.strokeDashoffset = state.gaugeMaxOffset;
      gearIndicator.textContent = 'STOP';
      return;
    }

    if (isRhythmic(state.currentPreset)) {
      // ── MODO RÍTMICO ───────────────────────────────────────────────────
      rhythmEngine.update(state.currentSpeedKmH, state.throttle);
      const bpm    = rhythmEngine.getCurrentBPM();
      rpmVal.textContent = bpm;
      if (rpmLabel) rpmLabel.textContent = 'BPM';
      const rpmPct = Math.min(1, bpm / 200);
      rpmGaugeFill.style.strokeDashoffset =
        state.gaugeMaxOffset - (rpmPct * state.gaugeMaxOffset);
      gearIndicator.textContent = RHYTHMIC_EMOJI[state.currentPreset] || '🎵';

      if (tFreq) tFreq.textContent = `${bpm} BPM`;
    } else {
      // ── MODO MOTOR ─────────────────────────────────────────────────────
      const sim = calculateTransmissionRPM(state.currentSpeedKmH, state.acceleration);
      state.targetRPM = sim.rpm;
      state.currentRPM += (state.targetRPM - state.currentRPM) * 0.18;

      rpmVal.textContent = Math.round(state.currentRPM);
      if (rpmLabel) rpmLabel.textContent = 'RPM';
      const rpmPct = Math.min(1, state.currentRPM / 8500);
      rpmGaugeFill.style.strokeDashoffset =
        state.gaugeMaxOffset - (rpmPct * state.gaugeMaxOffset);
      gearIndicator.textContent = `G${sim.gear}`;

      audioEngine.update(state.currentRPM, state.throttle, state.acceleration);
      if (tFreq) tFreq.textContent =
        `${Math.round((state.currentRPM / 60) * 4)} Hz`;
    }

    // Telemetría
    const unitStr = state.useMPH ? 'mph' : 'km/h';
    if (tGpsSpeed) tGpsSpeed.textContent = `${displaySpeed.toFixed(1)} ${unitStr}`;
    if (tAccel)    tAccel.textContent    = `${state.acceleration.toFixed(2)} m/s²`;
    if (tCoords && state.lastGPSCheckTime === 0) tCoords.textContent = 'Esperando GPS...';
  }

  requestAnimationFrame(updateLoop);

  // ── DEMO CONTROLS ────────────────────────────────────────────────────────
  throttleSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    demoThrottleVal.textContent  = `${val}%`;
    state.throttle               = val / 100;
    state.targetSpeedKmH        = (val / 100) * 180;
    state.acceleration           = (val / 100) * 3.5;
  });

  window.addEventListener('keydown', (e) => {
    if (state.useGPS) return;
    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
      state.throttle       = Math.min(1.0, state.throttle + 0.08);
      state.targetSpeedKmH = Math.min(220, state.targetSpeedKmH + 6);
      state.acceleration   = 2.5;
      throttleSlider.value  = Math.round(state.throttle * 100);
      demoThrottleVal.textContent = `${throttleSlider.value}%`;
    } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
      state.throttle       = Math.max(0, state.throttle - 0.12);
      state.targetSpeedKmH = Math.max(0, state.targetSpeedKmH - 12);
      state.acceleration   = -3.0;
      throttleSlider.value  = Math.round(state.throttle * 100);
      demoThrottleVal.textContent = `${throttleSlider.value}%`;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!state.useGPS && (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w')) {
      state.acceleration = -1.5;
    }
  });

  // ── PRESET CHIPS ─────────────────────────────────────────────────────────
  chipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      chipBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchPreset(btn.getAttribute('data-preset'));
    });
  });

  // ── MODO GPS / DEMO ──────────────────────────────────────────────────────
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

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  transmissionSelect.addEventListener('change', (e) => {
    state.transmission = e.target.value;
    state.currentGear  = 1;
  });

  masterVolSlider.addEventListener('input', (e) => {
    const val = e.target.value / 100;
    audioEngine.setMasterVolume(val);
    rhythmEngine.setMasterVolume(val);
  });

  if (idleVolSlider) {
    idleVolSlider.addEventListener('input', (e) => {
      audioEngine.setIdleVolume(e.target.value / 100);
    });
  }

  popFxToggle.addEventListener('change', (e) => {
    audioEngine.setPopFx(e.target.checked);
  });

  unitToggle.addEventListener('change', (e) => {
    state.useMPH       = e.target.checked;
    unitLabel.textContent = state.useMPH ? 'MPH' : 'KM/H';
  });

  function resetGaugeState() {
    state.targetSpeedKmH = 0;
    state.targetRPM      = 800;
    state.throttle       = 0;
    state.acceleration   = 0;
    state.currentGear    = 1;
  }
});
