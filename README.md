# ⚡ Tesla Engine Sound Simulator

Un sintetizador de sonido de motor en tiempo real diseñado para ejecutarse en el navegador web integrado de vehículos **Tesla**.

![Tesla Engine Sound](https://img.shields.io/badge/Tesla-Browser%20Compatible-00f2ff?style=for-the-badge&logo=tesla)
![HTML5 Web Audio](https://img.shields.io/badge/Web%20Audio%20API-Procedural%20Synth-ff3b30?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🚘 ¿Cómo funciona?

Esta aplicación web no requiere instalaciones físicas, modificaciones en el vehículo ni adaptadores OBD-II. 

1. **Lectura de Velocidad por GPS:** Accede a la API de geolocalización del navegador de Tesla (`navigator.geolocation.watchPosition`) para capturar la velocidad y aceleración real del coche en tiempo real.
2. **Síntesis Sintética de Audio:** Utiliza la **Web Audio API** de HTML5 para generar y modular frecuencias de disparo de cilindros, resonancia de escape y turbos según el nivel de aceleración y las RPM.
3. **Simulación de Marchas:** Algoritmo automático de transmisión secuencial de 6/7 velocidades o transmisión directa EV.
4. **Petardeos (Pops & Burbles):** Generación aleatoria de micro-explosiones de escape al soltar el acelerador a altas RPM.

---

## 🏎️ Perfiles de Motor Incluidos

* **V8 Muscle:** Tono grave, rudo y americano.
* **V10 Supercar:** Frecuencia aguda, rápida y exótica.
* **Rotativo Single-Turbo:** Zumbido de alto régimen con turbos y explosiones.
* **Cyberpunk Hypercar:** Sintetizador futurista EV de hiperdeportivo.

---

## 🛠️ Cómo Usar en tu Tesla

1. Abre el navegador web del Tesla.
2. Ingresa la URL publicada (por ejemplo la de GitHub Pages).
3. Presiona el botón táctil **START ENGINE**.
4. ¡Conduce y disfruta del sonido por los altavoces de tu vehículo!

---

## 💻 Desarrollado con
* HTML5 / CSS3 / JavaScript (Vanilla)
* Web Audio API
* HTML5 Geolocation API
