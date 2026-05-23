/**
 * Profile Charts — φ(z), Eₙ(z), Dₙ(z) along a vertical line through the interface.
 * Uses Chart.js. Three charts side-by-side with titles and physical annotations.
 */
const Profiles = (function () {
  let charts = {};

  function init() {
    const baseOptions = (title, yLabel) => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: title,
          color: "#c9d1d9",
          font: { size: 13, weight: "bold" },
          padding: { bottom: 4 },
        },
        tooltip: {
          backgroundColor: "#161b22",
          titleColor: "#c9d1d9",
          bodyColor: "#c9d1d9",
          borderColor: "#30363d",
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toExponential(2)}`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "z", color: "#8b949e" },
          grid: { color: "#30363d44" },
          ticks: { color: "#8b949e" },
        },
        y: {
          title: { display: true, text: yLabel, color: "#8b949e" },
          grid: { color: "#30363d44" },
          ticks: { color: "#8b949e", callback: (v) => v.toExponential(1) },
        },
      },
    });

    const lineColors = {
      phi: { border: "#58a6ff", bg: "rgba(88,166,255,0.08)" },
      en:  { border: "#f0883e", bg: "rgba(240,136,62,0.08)" },
      dn:  { border: "#3fb950", bg: "rgba(63,185,80,0.08)" },
    };

    const ifacePlugin = {
      id: "interfaceLine",
      afterDraw(chart) {
        const ctx = chart.ctx;
        const xPixel = chart.scales.x.getPixelForValue(0);
        if (xPixel < chart.chartArea.left || xPixel > chart.chartArea.right) return;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#f8514966";
        ctx.lineWidth = 1.5;
        ctx.moveTo(xPixel, chart.chartArea.top);
        ctx.lineTo(xPixel, chart.chartArea.bottom);
        ctx.stroke();
        // label
        ctx.fillStyle = "#f85149aa";
        ctx.font = "10px monospace";
        ctx.fillText("z=0", xPixel + 4, chart.chartArea.top + 14);
        ctx.restore();
      },
    };

    function makeChart(id, title, yLabel, color, subtitle) {
      const plugins = [ifacePlugin];
      if (subtitle) {
        plugins.push({
          id: "subtitle",
          afterDraw(chart) {
            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = "#8b949eaa";
            ctx.font = "italic 10px system-ui";
            ctx.textAlign = "center";
            ctx.fillText(subtitle, chart.chartArea.left + chart.chartArea.width / 2, chart.chartArea.bottom - 2);
            ctx.restore();
          },
        });
      }

      return new Chart(document.getElementById(id), {
        type: "line",
        data: {
          datasets: [{
            label: yLabel,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            data: [],
          }],
        },
        options: baseOptions(title, yLabel),
        plugins,
      });
    }

    charts.phi = makeChart("chart-phi", "势函数 φ(z)", "φ", lineColors.phi, "φ 在 z=0 处连续");
    charts.en  = makeChart("chart-en",  "法向电场 Eₙ(z)", "Eₙ", lineColors.en,  "Eₙ 在 z=0 处跳变，比值 = ε₂/ε₁");
    charts.dn  = makeChart("chart-dn",  "法向电位移 Dₙ(z)", "Dₙ", lineColors.dn,  "Dₙ 在 z=0 处连续（无自由电荷）");
  }

  function update(data) {
    charts.phi.data.datasets[0].data = data.map((d) => ({ x: d.z, y: d.phi }));
    charts.en.data.datasets[0].data  = data.map((d) => ({ x: d.z, y: d.En }));
    charts.dn.data.datasets[0].data  = data.map((d) => ({ x: d.z, y: d.Dn }));
    charts.phi.update("none");
    charts.en.update("none");
    charts.dn.update("none");
  }

  return { init, update };
})();

window.Profiles = Profiles;
