# BoundaryLab — Electromagnetic Boundary Effect Visualization

An interactive web-based visualization of a point charge near a dielectric interface, demonstrating fundamental electromagnetic boundary conditions.

**Live Demo: [zzzjh-debug.github.io/BoundaryLab](https://zzzjh-debug.github.io/BoundaryLab/)**

## Features

- **3D Field Line Tracing** — Euler-integrated field lines with arrow markers, rendered via Three.js
- **Profile Charts** — φ(z), Eₙ(z), Dₙ(z) cross-sectional plots with boundary condition annotations (Chart.js)
- **Probe System** — click anywhere on the interface plane to inspect local field values (φ, Eₙ, Eₜ, Dₙ, Dₜ)
- **2D Heatmaps** — potential distribution φ(x,0,z) and φ(x,y,0) in real time
- **Interactive Parameters** — tunable ε₁, ε₂, charge magnitude, and charge position via sliders

### Physics Demonstrated

| Quantity | Behavior at z=0 | Verification |
|----------|----------------|--------------|
| φ | Continuous | Smooth φ(z) curve; equal probe values across interface |
| Eₙ | Jumps, ratio = ε₂/ε₁ | Discontinuity in Eₙ(z); probe ratio matches |
| Dₙ | Continuous | Smooth Dₙ(z) curve; equal probe values across interface |
| Field lines | Refract, tanθ₁/tanθ₂ = ε₁/ε₂ | Visible bending at z=0 in 3D view |

## Quick Start

```bash
npx serve .
```

Open the URL printed in the terminal (default `http://localhost:3000`). No dependencies to install — pure static HTML, CSS, and JavaScript with CDN-loaded Three.js and Chart.js.

## Project Structure

```
BoundaryLab/
├── index.html           # Main page (dark theme)
├── css/
│   └── style.css        # Styles
├── js/
│   ├── physics.js       # Method of images engine
│   ├── threeView.js     # 3D visualization & field line tracing
│   ├── profiles.js      # Cross-section charts (Chart.js)
│   ├── probe.js         # Interface probe system
│   └── main.js          # State management & heatmaps
└── .gitignore
```

**7 source files** — ~1500 lines of vanilla JavaScript.

## Tech Stack

- [Three.js 0.160](https://threejs.org/) — 3D rendering
- [Chart.js 4.4](https://www.chartjs.org/) — 2D profile charts
- Pure HTML/CSS/JS, zero build step

## License

MIT
