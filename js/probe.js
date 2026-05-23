/**
 * Probe System — mouse-to-3D raycasting against y=0 plane (the profile cross-section).
 * Displays full 3-coordinate position with y=0 marked as fixed.
 */
const Probe = (function () {
  let currentPos = null;
  let enabled = true;

  function init(view3dCanvas, probeValuesEl, onProbeMove) {
    view3dCanvas.addEventListener("mousemove", (e) => {
      if (!enabled) return;
      const tv = window.ThreeView;
      if (!tv) return;

      const rect = view3dCanvas.getBoundingClientRect();
      const ndc = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };

      const hit = tv.intersectY0(ndc);
      if (hit) {
        currentPos = hit;
        tv.setProbePosition(hit);
        updateDisplay(hit, probeValuesEl);
        if (onProbeMove) onProbeMove(hit);
      }
    });

    view3dCanvas.addEventListener("mouseleave", function () {
      if (!enabled) return;
      currentPos = null;
      var tv = window.ThreeView;
      if (tv) tv.setProbePosition(null);
      // Keep last probe values displayed so user can scroll the left panel
    });
  }

  function updateDisplay(pos, el) {
    const { Physics: P } = window;
    const params = window._appParams;
    if (!P || !params) return;

    const f = P.computeField(pos.x, 0, pos.z, params);
    const Et = Math.sqrt(f.Ex * f.Ex + f.Ey * f.Ey);
    const Dt = Math.sqrt(f.Dx * f.Dx + f.Dy * f.Dy);

    el.innerHTML =
      '<div class="probe-row"><span class="lbl">x</span><span class="val">' + pos.x.toFixed(2) + '</span></div>' +
      '<div class="probe-row"><span class="lbl">y</span><span class="val" style="color:#8b949e">0（截面固定）</span></div>' +
      '<div class="probe-row"><span class="lbl">z</span><span class="val">' + pos.z.toFixed(2) + '</span></div>' +
      '<div class="probe-row" style="margin-top:4px"><span class="lbl">&phi;</span><span class="val">' + fmt(f.phi) + '</span></div>' +
      '<div class="probe-row"><span class="lbl">E&#x2099; (法向)</span><span class="val">' + fmt(f.Ez) + '</span></div>' +
      '<div class="probe-row"><span class="lbl">E&#x209C; (切向)</span><span class="val">' + fmt(Et) + '</span></div>' +
      '<div class="probe-row"><span class="lbl">D&#x2099; (法向)</span><span class="val">' + fmt(f.Dz) + '</span></div>' +
      '<div class="probe-row"><span class="lbl">D&#x209C; (切向)</span><span class="val">' + fmt(Dt) + '</span></div>';
  }

  function fmt(v) {
    if (!isFinite(v)) return "∞";
    if (Math.abs(v) < 0.01 || Math.abs(v) >= 10000) return v.toExponential(2);
    return v.toFixed(3);
  }

  function getPosition() { return currentPos; }

  return { init, getPosition };
})();

window.Probe = Probe;
