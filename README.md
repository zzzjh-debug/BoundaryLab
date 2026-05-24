# BoundaryLab — Electromagnetic Boundary Effect Visualization

An interactive web-based laboratory for exploring electromagnetic boundary conditions across **7 physical models** — from planar dielectric interfaces to spherical geometries, from electrostatics to magnetostatics and DC current flow.

**Live Demo: [zzzjh-debug.github.io/BoundaryLab](https://zzzjh-debug.github.io/BoundaryLab/)**

## Models

| # | Model | Source | Interface | Key Physics |
|---|-------|--------|-----------|-------------|
| 1 | Point charge + dielectric | q | Planar ε₁/ε₂ | φ continuous, Dₙ continuous, Eₙ jumps |
| 2 | Point charge + grounded conductor | q | Planar / PEC | φ=0 (Dirichlet BC), induced σ |
| 3 | Charged dielectric interface | q + σ_f | Planar ε₁/ε₂ | **D₁ₙ−D₂ₙ=σ_f** (general form) |
| 4 | Line charge + dielectric | λ (∞ line) | Planar ε₁/ε₂ | 2D logarithmic potential, E~1/r |
| 5 | DC current + conductivity | I (point) | Planar σ₁/σ₂ | ε↔σ duality, **Jₙ continuous, Jₜ jumps** |
| 6 | Uniform E-field + dielectric sphere | E₀ | Spherical ε_in/ε_out | Internal uniform field, L=1/3 |
| 7 | Magnetic dipole + permeability | m ẑ | Planar μ₁/μ₂ | **Bₙ continuous, Hₜ continuous**, m' sign reversal |

Each model has dedicated chart annotations showing the relevant boundary condition formulas.

## Features

- **3D Field Line Tracing** — Euler-integrated with arrow markers (Three.js InstancedMesh)
- **Profile Charts** — φ(z), Eₙ/Hₙ(z), Dₙ/Bₙ/Jₙ(z) with dynamic titles and BC annotations (Chart.js)
- **2D Heatmaps** — potential distribution with percentile color scale and colorbar legend
- **Probe System** — mouse-over the 3D view to inspect local field values; data persists on mouse-leave
- **Source Visualization** — model-specific source rendering (point sphere, line cylinder, current sphere, dielectric sphere)
- **Parameter Animation** — auto-sweep z₀ with play/pause

### Physics Demonstrated

| Boundary Condition | Shown In |
|-------------------|----------|
| φ continuous | Models 1,3,4,5,6,7,8 |
| Dₙ continuous (σ_f=0) | Models 1,4,6 |
| D₁ₙ−D₂ₙ = σ_f | Model 3 |
| φ=0 (Dirichlet) | Model 2 |
| Jₙ continuous, Jₜ jumps | Model 5 |
| Bₙ continuous, Hₜ continuous | Model 8 |
| Field line refraction | Models 1,4,5,8 |
| Depolarization (spherical) | Model 6 |
| ε↔σ duality | Model 5 |
| m' sign reversal (μ₂−μ₁) | Model 8 |

## Quick Start

```bash
npx serve .
```

Open the URL (default `http://localhost:3000`). Zero dependencies — pure static HTML/CSS/JS with CDN-loaded Three.js 0.160 and Chart.js 4.4.

## Project Structure

```
BoundaryLab/
├── index.html           # Main page (dark theme)
├── css/
│   └── style.css        # Styles
├── js/
│   ├── physics.js       # 7-model physics engine (method of images, spherical harmonics)
│   ├── threeView.js     # 3D visualization & field line tracing
│   ├── profiles.js      # Cross-section charts (Chart.js)
│   ├── probe.js         # Interface probe system
│   └── main.js          # State management, heatmaps, animation
└── .gitignore
```

## Tech Stack

- [Three.js 0.160](https://threejs.org/) — 3D rendering
- [Chart.js 4.4](https://www.chartjs.org/) — 2D profile charts
- Pure HTML/CSS/JS, zero build step, ~2000 lines

## License

MIT
