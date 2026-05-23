/**
 * Main entry point — state management, UI events, model switching, 2D heatmap rendering.
 */
import * as THREE from "three";

(function () {
  // ====== State ======
  const params = {
    epsilon1: 1.0,
    epsilon2: 4.0,
    sigma_f: 0.2,
    charge: 1.0,
    chargePos: { x: 0, y: 0, z: 1.0 },
  };
  const display = { y0Only: false };
  let activeModel = "dielectric";

  window._appParams = params;

  // ====== Model parameter visibility ======
  const MODEL_PARAMS = {
    dielectric:  ["epsilon1", "epsilon2",             "charge", "chargePos"],
    conductor:   ["epsilon1",                         "charge", "chargePos"],
    charged:     ["epsilon1", "epsilon2", "sigma_f", "charge", "chargePos"],
    linecharge:  ["epsilon1", "epsilon2",             "charge", "chargePos"],
    current:     ["epsilon1", "epsilon2",             "charge", "chargePos"],
    sphere:      ["epsilon1", "epsilon2",             "charge"],
  };

  // Models where source position is meaningless
  const MODELS_NO_Y0 = { linecharge: true };
  const MODELS_NO_POS = { sphere: true };

  function applyModelVisibility(modelId) {
    var vis = MODEL_PARAMS[modelId] || MODEL_PARAMS.dielectric;
    function show(id, v) { var el = document.getElementById(id); if (el) el.style.display = v ? "" : "none"; }
    show("field-eps1",  vis.indexOf("epsilon1") >= 0);
    show("field-eps2",  vis.indexOf("epsilon2") >= 0);
    show("field-sigma", vis.indexOf("sigma_f") >= 0);
    show("field-y0",    !MODELS_NO_Y0[modelId] && !MODELS_NO_POS[modelId]);
    show("field-z0",    !MODELS_NO_POS[modelId]);
    show("field-x0",    !MODELS_NO_POS[modelId]);

    // Update labels to match model physics
    var meta = Physics.getModelMeta(modelId);
    var labels = meta.uiLabels;
    if (labels) {
      var el;
      el = document.getElementById("lbl-eps-section"); if (el) el.textContent = labels.epsSection;
      el = document.getElementById("lbl-eps1-text"); if (el) el.textContent = labels.eps1;
      el = document.getElementById("lbl-eps2-text"); if (el) el.textContent = labels.eps2;
      el = document.getElementById("lbl-q-text"); if (el) el.textContent = labels.source;
    }
  }

  // ====== Helpers ======
  function linspace(a, b, n) {
    var arr = new Array(n);
    var step = (b - a) / (n - 1);
    for (var i = 0; i < n; i++) arr[i] = a + i * step;
    return arr;
  }

  // ====== 2D Heatmap Rendering ======
  function renderHeatmap(canvasId, sampleFn, nx, ny, flipY, xLabel, yLabel) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var row = canvas.parentElement;
    var card = row ? row.parentElement : null;
    var cw = (row && row.clientWidth > 10) ? row.clientWidth - 18 : (card ? card.clientWidth - 30 : 200);
    var ch = (row && row.clientHeight > 10) ? row.clientHeight : (card ? card.clientHeight - 36 : 180);
    if (cw <= 10 || ch <= 10) return null;
    canvas.width = cw; canvas.height = ch;

    var ctx = canvas.getContext("2d");
    var samples = [];
    var vMin = Infinity, vMax = -Infinity;
    for (var iy = 0; iy < ny; iy++) {
      var rowVals = [];
      for (var ix = 0; ix < nx; ix++) {
        var v = sampleFn(ix / (nx - 1), iy / (ny - 1));
        rowVals.push(v);
        if (isFinite(v)) { if (v < vMin) vMin = v; if (v > vMax) vMax = v; }
      }
      samples.push(rowVals);
    }
    if (!isFinite(vMin)) { vMin = -0.1; vMax = 0.1; }

    var allVals = [];
    for (var iy2 = 0; iy2 < ny; iy2++)
      for (var ix2 = 0; ix2 < nx; ix2++)
        if (isFinite(samples[iy2][ix2])) allVals.push(samples[iy2][ix2]);
    allVals.sort(function (a, b) { return a - b; });
    var nVals = allVals.length;
    var pLo = allVals[Math.floor(nVals * 0.02)];
    var pHi = allVals[Math.floor(nVals * 0.98)];
    var mid = (pLo + pHi) / 2;
    var half = Math.max((pHi - pLo) / 2, 0.001);

    ctx.clearRect(0, 0, cw, ch);
    var imgData = ctx.createImageData(cw, ch);
    for (var iy3 = 0; iy3 < ch; iy3++) {
      for (var ix3 = 0; ix3 < cw; ix3++) {
        var si = flipY ? (ch - 1 - iy3) : iy3;
        var sx = (ix3 / cw) * (nx - 1), sy = (si / ch) * (ny - 1);
        var fx = Math.floor(sx), fy = Math.floor(sy);
        var cx = Math.min(fx + 1, nx - 1), cy = Math.min(fy + 1, ny - 1);
        var tx = sx - fx, ty = sy - fy;
        var val = samples[fy][fx] * (1 - tx) * (1 - ty) + samples[fy][cx] * tx * (1 - ty) + samples[cy][fx] * (1 - tx) * ty + samples[cy][cx] * tx * ty;
        if (!isFinite(val)) val = mid;
        var t = (val - mid) / (half * 1.2);
        t = Math.max(-1, Math.min(1, t));
        var idx = (iy3 * cw + ix3) * 4;
        if (t < 0) { var s = 1 + t; imgData.data[idx] = Math.round(255 * s); imgData.data[idx + 1] = Math.round(255 * s); imgData.data[idx + 2] = 255; }
        else { var s = 1 - t; imgData.data[idx] = 255; imgData.data[idx + 1] = Math.round(255 * s); imgData.data[idx + 2] = Math.round(255 * s); }
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.fillStyle = "#ffffffcc"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center";
    if (xLabel) ctx.fillText(xLabel, cw / 2, ch - 4);
    if (yLabel) { ctx.save(); ctx.translate(10, ch / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore(); }

    return { lo: pLo, hi: pHi };
  }

  // ====== Colorbar Rendering ======
  function renderColorbar(colorbarId, lo, hi) {
    var cb = document.getElementById(colorbarId);
    if (!cb || lo === undefined || hi === undefined) return;
    var heatmapCanvasId = colorbarId.replace("colorbar-", "heatmap-");
    var hmCanvas = document.getElementById(heatmapCanvasId);
    if (!hmCanvas) return;
    cb.width = 14;
    cb.height = hmCanvas.height || 100;
    if (cb.height < 20) return;

    var ctx = cb.getContext("2d");
    var h = cb.height;
    var mid = (lo + hi) / 2;
    var half = Math.max((hi - lo) / 2, 0.001);

    // Draw vertical gradient: top = hi (red), mid = mid (white), bottom = lo (blue)
    var imgData = ctx.createImageData(14, h);
    for (var iy = 0; iy < h; iy++) {
      // iy=0 is top → t>0 (red), iy=h-1 is bottom → t<0 (blue)
      var t = 1 - 2 * (iy / (h - 1)); // 1 at top → -1 at bottom
      var r, g, b;
      if (t < 0) { var s = 1 + t; r = Math.round(255 * s); g = Math.round(255 * s); b = 255; }
      else       { var s = 1 - t; r = 255; g = Math.round(255 * s); b = Math.round(255 * s); }
      for (var ix = 0; ix < 14; ix++) {
        var idx = (iy * 14 + ix) * 4;
        imgData.data[idx] = r; imgData.data[idx + 1] = g; imgData.data[idx + 2] = b; imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Labels
    ctx.fillStyle = "#c9d1d9"; ctx.font = "9px monospace"; ctx.textAlign = "left";
    ctx.fillText(fmtHeat(hi), 1, 9);
    ctx.fillText(fmtHeat(lo), 1, h - 2);
  }

  function fmtHeat(v) {
    if (!isFinite(v)) return "—";
    if (Math.abs(v) < 0.01 || Math.abs(v) >= 1000) return v.toExponential(0);
    if (Math.abs(v) < 1) return v.toFixed(2);
    return v.toFixed(1);
  }

  function updateHeatmaps() {
    var r0 = renderHeatmap("heatmap-y0", function (fx, fz) { return Physics.computeField(-3 + fx * 6, 0, -2.5 + fz * 5.5, params).phi; }, 80, 60, true, "x →", "z ↑");
    if (r0) renderColorbar("colorbar-y0", r0.lo, r0.hi);
    var r1 = renderHeatmap("heatmap-z0", function (fx, fy) { return Physics.computeField(-3 + fx * 6, -2.8 + fy * 5.6, 0.001, params).phi; }, 80, 50, true, "x →", "y ↑");
    if (r1) renderColorbar("colorbar-z0", r1.lo, r1.hi);
  }

  // ====== Slider bindings ======
  function bindSlider(id, paramKey, subKey, fmt) {
    var slider = document.getElementById("slider-" + id);
    var valEl = document.getElementById("val-" + id);
    if (!slider || !valEl) return;
    slider.addEventListener("input", function () {
      var v = parseFloat(slider.value);
      if (subKey) params[paramKey][subKey] = v; else params[paramKey] = v;
      valEl.textContent = fmt ? fmt(v) : v.toFixed(1);
      refresh();
    });
  }
  bindSlider("eps1", "epsilon1", null, function (v) { return v.toFixed(1); });
  bindSlider("eps2", "epsilon2", null, function (v) { return v.toFixed(1); });
  bindSlider("sigma", "sigma_f", null, function (v) { return v.toFixed(2); });
  bindSlider("q", "charge", null, function (v) { return v.toFixed(1); });
  bindSlider("z0", "chargePos", "z", function (v) { return v.toFixed(2); });
  bindSlider("x0", "chargePos", "x", function (v) { return v.toFixed(2); });
  bindSlider("y0", "chargePos", "y", function (v) { return v.toFixed(2); });

  // ====== Model switching ======
  document.querySelectorAll("input[name='activeModel']").forEach(function (radio) {
    radio.addEventListener("change", function () {
      if (this.checked) switchModel(this.value);
    });
  });

  function switchModel(modelId) {
    activeModel = modelId;
    Physics.setModel(modelId);
    var meta = Physics.getModelMeta();
    document.getElementById("model-subtitle").textContent = meta.name;
    applyModelVisibility(modelId);
    if (window.ThreeView) window.ThreeView.setSourceStyle(modelId);
    if (window.Profiles) {
      window.Profiles.setSubtitles(meta.chartSubtitles);
      if (meta.chartTitles) window.Profiles.setChartTitles(meta.chartTitles);
      else window.Profiles.setChartTitles({ phi: "势函数 φ(z)", en: "法向电场 Eₙ(z)", dn: "法向电位移 Dₙ(z)" });
    }
    refresh();
  }

  // Radio buttons for display mode
  document.querySelectorAll("input[name='fieldMode']").forEach(function (radio) {
    radio.addEventListener("change", function () {
      display.y0Only = (this.value === "y0");
      refresh();
    });
  });

  // ====== Refresh ======
  function refresh() {
    if (window.ThreeView) window.ThreeView.update(params, Object.assign({}, display, { modelId: activeModel }));
    if (window.Profiles) updateProfiles();
    updateHeatmaps();
  }

  function updateProfiles() {
    var probePos = window.Probe ? window.Probe.getPosition() : null;
    var x0 = probePos ? probePos.x : params.chargePos.x;
    var data = Physics.sampleProfile(x0, params.chargePos.y, -2.5, 3.0, 250, params);
    window.Profiles.update(data);
  }

  // ====== Boot ======
  function boot() {
    if (typeof Physics === "undefined" || typeof Profiles === "undefined" || typeof Probe === "undefined") return;
    Physics.setModel(activeModel);
    applyModelVisibility(activeModel);
    try { Profiles.init(); var meta = Physics.getModelMeta(); Profiles.setSubtitles(meta.chartSubtitles); if (meta.chartTitles) Profiles.setChartTitles(meta.chartTitles); updateProfiles(); } catch (e) { console.error(e); }
    try { updateHeatmaps(); } catch (e) { console.error(e); }

    var ctr = document.getElementById("view3d-container");
    var cvs = document.getElementById("view3d");
    if (!ctr || !cvs) return;

    try { window.ThreeView.init(ctr, cvs); } catch (e) { console.error(e); }
    try { window.ThreeView.setSourceStyle(activeModel); } catch (e) { console.error(e); }

    requestAnimationFrame(function () {
      try { window.ThreeView.update(params, Object.assign({}, display, { modelId: activeModel })); } catch (e) { console.error(e); }
    });

    var probeEl = document.getElementById("probe-values");
    try { Probe.init(cvs, probeEl, function () { updateProfiles(); }); } catch (e) { console.error(e); }

    var hmPanel = document.getElementById("heatmap-panel");
    if (hmPanel) { new ResizeObserver(function () { updateHeatmaps(); }).observe(hmPanel); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { requestAnimationFrame(function () { requestAnimationFrame(boot); }); });
  } else {
    requestAnimationFrame(function () { requestAnimationFrame(boot); });
  }
})();
