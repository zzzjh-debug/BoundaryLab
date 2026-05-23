/**
 * Main entry point — state management, UI events, 2D heatmap rendering.
 */
import * as THREE from "three";

(function () {
  // ====== State ======
  const params = {
    epsilon1: 1.0,
    epsilon2: 4.0,
    charge: 1.0,
    chargePos: { x: 0, y: 0, z: 1.0 },
  };
  const display = { y0Only: false }; // default: all field lines

  window._appParams = params;

  // ====== Helpers ======
  function linspace(a, b, n) {
    const arr = new Array(n);
    const step = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) arr[i] = a + i * step;
    return arr;
  }

  // ====== 2D Heatmap Rendering ======
  function renderHeatmap(canvasId, sampleFn, nx, ny, flipY, xLabel, yLabel) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    const cw = parent ? parent.clientWidth - 16 : 220;
    const ch = parent ? parent.clientHeight - 40 : 200;
    if (cw <= 0 || ch <= 0) return;
    canvas.width = cw; canvas.height = ch;

    const ctx = canvas.getContext("2d");
    const samples = [];
    let vMin = Infinity, vMax = -Infinity;
    for (let iy = 0; iy < ny; iy++) {
      const row = [];
      for (let ix = 0; ix < nx; ix++) {
        const v = sampleFn(ix / (nx - 1), iy / (ny - 1));
        row.push(v);
        if (isFinite(v)) { if (v < vMin) vMin = v; if (v > vMax) vMax = v; }
      }
      samples.push(row);
    }
    if (!isFinite(vMin)) { vMin = -0.1; vMax = 0.1; }

    const allVals = [];
    for (let iy = 0; iy < ny; iy++)
      for (let ix = 0; ix < nx; ix++)
        if (isFinite(samples[iy][ix])) allVals.push(samples[iy][ix]);
    allVals.sort((a, b) => a - b);
    const n = allVals.length;
    const pLo = allVals[Math.floor(n * 0.02)];
    const pHi = allVals[Math.floor(n * 0.98)];
    const mid = (pLo + pHi) / 2;
    const half = Math.max((pHi - pLo) / 2, 0.001);

    ctx.clearRect(0, 0, cw, ch);
    const imgData = ctx.createImageData(cw, ch);
    for (let iy = 0; iy < ch; iy++) {
      for (let ix = 0; ix < cw; ix++) {
        const si = flipY ? (ch - 1 - iy) : iy;
        const sx = (ix / cw) * (nx - 1), sy = (si / ch) * (ny - 1);
        const fx = Math.floor(sx), fy = Math.floor(sy);
        const cx = Math.min(fx + 1, nx - 1), cy = Math.min(fy + 1, ny - 1);
        const tx = sx - fx, ty = sy - fy;
        let v = samples[fy][fx] * (1 - tx) * (1 - ty) + samples[fy][cx] * tx * (1 - ty) + samples[cy][fx] * (1 - tx) * ty + samples[cy][cx] * tx * ty;
        if (!isFinite(v)) v = mid;
        let t = (v - mid) / (half * 1.2);
        t = Math.max(-1, Math.min(1, t));
        const idx = (iy * cw + ix) * 4;
        if (t < 0) { const s = 1 + t; imgData.data[idx] = Math.round(255 * s); imgData.data[idx + 1] = Math.round(255 * s); imgData.data[idx + 2] = 255; }
        else { const s = 1 - t; imgData.data[idx] = 255; imgData.data[idx + 1] = Math.round(255 * s); imgData.data[idx + 2] = Math.round(255 * s); }
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.fillStyle = "#ffffffcc"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center";
    if (xLabel) ctx.fillText(xLabel, cw / 2, ch - 4);
    if (yLabel) { ctx.save(); ctx.translate(10, ch / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore(); }
  }

  function updateHeatmaps() {
    const p = { epsilon1: params.epsilon1, epsilon2: params.epsilon2, charge: params.charge, chargePos: params.chargePos };
    renderHeatmap("heatmap-y0", (fx, fz) => Physics.computeField(-3 + fx * 6, 0, -2.5 + fz * 5.5, p).phi, 80, 60, true, "x →", "z ↑");
    renderHeatmap("heatmap-z0", (fx, fy) => Physics.computeField(-3 + fx * 6, -2.8 + fy * 5.6, 0.001, p).phi, 80, 50, true, "x →", "y ↑");
  }

  // ====== Slider bindings ======
  function bindSlider(id, paramKey, subKey, fmt) {
    const slider = document.getElementById(`slider-${id}`);
    const valEl = document.getElementById(`val-${id}`);
    if (!slider || !valEl) return;
    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      if (subKey) params[paramKey][subKey] = v; else params[paramKey] = v;
      valEl.textContent = fmt ? fmt(v) : v.toFixed(1);
      refresh();
    });
  }
  bindSlider("eps1", "epsilon1", null, (v) => v.toFixed(1));
  bindSlider("eps2", "epsilon2", null, (v) => v.toFixed(1));
  bindSlider("q", "charge", null, (v) => v.toFixed(1));
  bindSlider("z0", "chargePos", "z", (v) => v.toFixed(2));
  bindSlider("x0", "chargePos", "x", (v) => v.toFixed(2));
  bindSlider("y0", "chargePos", "y", (v) => v.toFixed(2));

  // Radio buttons
  document.querySelectorAll("input[name='fieldMode']").forEach((radio) => {
    radio.addEventListener("change", () => {
      display.y0Only = (radio.value === "y0");
      refresh();
    });
  });

  // ====== Refresh ======
  function refresh() {
    if (window.ThreeView) window.ThreeView.update(params, display);
    if (window.Profiles) updateProfiles();
    updateHeatmaps();
  }

  function updateProfiles() {
    const probePos = window.Probe ? window.Probe.getPosition() : null;
    const x0 = probePos ? probePos.x : params.chargePos.x;
    const data = Physics.sampleProfile(x0, params.chargePos.y, -2.5, 3.0, 250, params);
    Profiles.update(data);
  }

  // ====== Boot ======
  function boot() {
    if (typeof Physics === "undefined" || typeof Profiles === "undefined" || typeof Probe === "undefined") return;
    try { Profiles.init(); updateProfiles(); } catch (e) { console.error(e); }
    try { updateHeatmaps(); } catch (e) { console.error(e); }

    const ctr = document.getElementById("view3d-container");
    const cvs = document.getElementById("view3d");
    if (!ctr || !cvs) return;

    try { window.ThreeView.init(ctr, cvs); } catch (e) { console.error(e); }

    requestAnimationFrame(() => {
      try { window.ThreeView.update(params, display); } catch (e) { console.error(e); }
    });

    const probeEl = document.getElementById("probe-values");
    try { Probe.init(cvs, probeEl, () => updateProfiles()); } catch (e) { console.error(e); }

    const hmPanel = document.getElementById("heatmap-panel");
    if (hmPanel) { new ResizeObserver(() => updateHeatmaps()).observe(hmPanel); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(boot)));
  } else {
    requestAnimationFrame(() => requestAnimationFrame(boot));
  }
})();
