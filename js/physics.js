/**
 * Physics Engine — multi-model electrostatic boundary-value solver.
 *
 * Three models, all using the Method of Images (or superposition thereof):
 *
 *   Model 1 "dielectric" — Point charge above a planar dielectric interface
 *     Region 1 (z > 0, ε₁):
 *       φ = (1/(4πε₁)) [q/R + q'/R']
 *       q' = q·(ε₁−ε₂)/(ε₁+ε₂)  (image below interface)
 *     Region 2 (z < 0, ε₂):
 *       φ = (1/(4πε₂)) [q''/R]
 *       q'' = q·2ε₂/(ε₁+ε₂)      (transmitted charge)
 *     BC: φ₁=φ₂, D₁ₙ=D₂ₙ (σ_f=0), E₁ₙ/E₂ₙ=ε₂/ε₁
 *
 *   Model 2 "conductor" — Point charge above a grounded conducting plane
 *     Region 1 (z > 0, ε₁):
 *       φ = (1/(4πε₁)) [q/R − q/R']
 *       Image charge −q at mirror position.
 *     Region 2 (z < 0):  φ = 0, E = 0  (electrostatic equilibrium)
 *     BC: φ(z=0)=0 (Dirichlet), induced σ = −ε₁·∂φ/∂z|_{0⁺}
 *
 *   Model 3 "charged" — Point charge above dielectric interface with free σ_f
 *     Same image solution as Model 1, plus uniform sheet field from σ_f:
 *       z > 0: E_z += σ_f/(2ε₁),  D_z += σ_f/2
 *       z < 0: E_z += −σ_f/(2ε₂), D_z += −σ_f/2
 *     BC: φ₁=φ₂, D₁ₙ−D₂ₙ=σ_f (general form), E₁ₜ=E₂ₜ
 *
 * Normal = z-direction, Tangential = x-y plane.
 */

const Physics = (function () {
  const ONE_OVER_4PI = 1 / (4 * Math.PI);
  const RMIN = 0.02;

  let _activeModel = "dielectric";

  // ─── Model Implementations ────────────────────────────────────────

  /**
   * Model 1: Point charge + planar dielectric interface (σ_f = 0).
   */
  function _computeDielectric(x, y, z, p) {
    const { epsilon1, epsilon2, charge: q, chargePos: cp } = p;
    const dx = x - cp.x;
    const dy = y - cp.y;
    const dz = z - cp.z;
    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const Reff = Math.max(R, RMIN);

    let phi, Ex, Ey, Ez, eps;

    if (z >= 0) {
      eps = epsilon1;
      const alpha = (epsilon1 - epsilon2) / (epsilon1 + epsilon2);
      const dzImg = z + cp.z;
      const Rimg = Math.sqrt(dx * dx + dy * dy + dzImg * dzImg);
      const RimgEff = Math.max(Rimg, RMIN);

      const coeff = q * ONE_OVER_4PI / epsilon1;
      phi = coeff * (1 / Reff + alpha / RimgEff);

      const dPhi_dx = -coeff * (dx / (Reff * Reff * Reff) + alpha * dx / (RimgEff * RimgEff * RimgEff));
      const dPhi_dy = -coeff * (dy / (Reff * Reff * Reff) + alpha * dy / (RimgEff * RimgEff * RimgEff));
      const dPhi_dz = -coeff * (dz / (Reff * Reff * Reff) + alpha * dzImg / (RimgEff * RimgEff * RimgEff));

      Ex = -dPhi_dx;
      Ey = -dPhi_dy;
      Ez = -dPhi_dz;
    } else {
      eps = epsilon2;
      const beta = (2 * epsilon2) / (epsilon1 + epsilon2);

      const coeff = q * ONE_OVER_4PI / epsilon2;
      phi = coeff * beta / Reff;

      const common = -coeff * beta / (Reff * Reff * Reff);
      Ex = -common * dx;
      Ey = -common * dy;
      Ez = -common * dz;
    }

    return { phi, Ex, Ey, Ez, Dx: eps * Ex, Dy: eps * Ey, Dz: eps * Ez };
  }

  /**
   * Model 2: Point charge above a grounded conducting plane (z=0).
   *
   *   z ≥ 0: φ = (q/(4πε₁))·[1/R − 1/R']
   *   z < 0: φ = 0, E = 0
   *
   * Induced surface charge density on the plane:
   *   σ(x,y) = −ε₁·∂φ/∂z|_{z=0⁺} = −q·z₀ / [2π((x−x₀)²+(y−y₀)²+z₀²)^(3/2)]
   *   ∫σ dA = −q  (total induced charge equals −q)
   */
  function _computeConductor(x, y, z, p) {
    const { epsilon1, charge: q, chargePos: cp } = p;
    const dx = x - cp.x;
    const dy = y - cp.y;
    const dz = z - cp.z;

    // Below the conductor plane: field is zero (electrostatic equilibrium)
    if (z < 0) {
      return { phi: 0, Ex: 0, Ey: 0, Ez: 0, Dx: 0, Dy: 0, Dz: 0 };
    }

    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const Reff = Math.max(R, RMIN);

    const dzImg = z + cp.z;
    const Rimg = Math.sqrt(dx * dx + dy * dy + dzImg * dzImg);
    const RimgEff = Math.max(Rimg, RMIN);

    const coeff = q * ONE_OVER_4PI / epsilon1;
    const phi = coeff * (1 / Reff - 1 / RimgEff);

    // E = −∇φ
    // ∂φ/∂x = coeff·[−dx/R³ + dx/R'³]  → Ex = coeff·[dx/R³ − dx/R'³]
    const dPhi_dx = -coeff * (dx / (Reff * Reff * Reff) - dx / (RimgEff * RimgEff * RimgEff));
    const dPhi_dy = -coeff * (dy / (Reff * Reff * Reff) - dy / (RimgEff * RimgEff * RimgEff));
    const dPhi_dz = -coeff * (dz / (Reff * Reff * Reff) - dzImg / (RimgEff * RimgEff * RimgEff));

    const Ex = -dPhi_dx;
    const Ey = -dPhi_dy;
    const Ez = -dPhi_dz;

    return { phi, Ex, Ey, Ez, Dx: epsilon1 * Ex, Dy: epsilon1 * Ey, Dz: epsilon1 * Ez };
  }

  /**
   * Model 3: Point charge above dielectric interface with free surface charge σ_f.
   *
   * Total field = image-charge solution (Model 1) + uniform sheet field from σ_f.
   *
   * The uniform sheet at z=0 with free charge σ_f contributes:
   *   z > 0:  E_z^σ = +σ_f/(2ε₁),  D_z^σ = +σ_f/2,   φ^σ = −σ_f·z/(2ε₁)
   *   z < 0:  E_z^σ = −σ_f/(2ε₂),  D_z^σ = −σ_f/2,   φ^σ = +σ_f·z/(2ε₂)
   *
   * BC check: D₁ₙ(0⁺) − D₂ₙ(0⁻) = σ_f  ✓
   */
  function _computeCharged(x, y, z, p) {
    const { epsilon1, epsilon2, sigma_f, charge: q, chargePos: cp } = p;
    const dx = x - cp.x;
    const dy = y - cp.y;
    const dz = z - cp.z;
    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const Reff = Math.max(R, RMIN);

    let phi, Ex, Ey, Ez, eps;

    if (z >= 0) {
      eps = epsilon1;
      const alpha = (epsilon1 - epsilon2) / (epsilon1 + epsilon2);
      const dzImg = z + cp.z;
      const Rimg = Math.sqrt(dx * dx + dy * dy + dzImg * dzImg);
      const RimgEff = Math.max(Rimg, RMIN);

      const coeff = q * ONE_OVER_4PI / epsilon1;
      // Image solution
      phi = coeff * (1 / Reff + alpha / RimgEff) - sigma_f * z / (2 * epsilon1);

      const dPhi_dx = -coeff * (dx / (Reff * Reff * Reff) + alpha * dx / (RimgEff * RimgEff * RimgEff));
      const dPhi_dy = -coeff * (dy / (Reff * Reff * Reff) + alpha * dy / (RimgEff * RimgEff * RimgEff));
      const dPhi_dz_img = -coeff * (dz / (Reff * Reff * Reff) + alpha * dzImg / (RimgEff * RimgEff * RimgEff));

      Ex = -dPhi_dx;
      Ey = -dPhi_dy;
      Ez = -dPhi_dz_img + sigma_f / (2 * epsilon1);
    } else {
      eps = epsilon2;
      const beta = (2 * epsilon2) / (epsilon1 + epsilon2);

      const coeff = q * ONE_OVER_4PI / epsilon2;
      phi = coeff * beta / Reff + sigma_f * z / (2 * epsilon2);

      const common = -coeff * beta / (Reff * Reff * Reff);
      Ex = -common * dx;
      Ey = -common * dy;
      Ez = -common * dz - sigma_f / (2 * epsilon2);
    }

    return { phi, Ex, Ey, Ez, Dx: eps * Ex, Dy: eps * Ey, Dz: eps * Ez };
  }

  /**
   * Model 4: Infinite line charge (λ, along y-axis) above a planar dielectric interface.
   *
   * 2D problem in x-z plane.  Field is uniform along y (E_y = 0).
   *
   *   Region 1 (z > 0, ε₁):
   *     φ = −(λ/(2πε₁))·[ln(r) + α·ln(r')]
   *     E_x = (λ/(2πε₁))·[(x−x₀)/r² + α·(x−x₀)/r'²]
   *     E_z = (λ/(2πε₁))·[(z−z₀)/r² + α·(z+z₀)/r'²]
   *
   *   Region 2 (z < 0, ε₂):
   *     φ = −(λ/(2πε₂))·β·ln(r)
   *     E_x = (λ/(2πε₂))·β·(x−x₀)/r²
   *     E_z = (λ/(2πε₂))·β·(z−z₀)/r²
   *
   *   r² = (x−x₀)² + (z−z₀)²,  r'² = (x−x₀)² + (z+z₀)²
   *   α = (ε₁−ε₂)/(ε₁+ε₂),  β = 2ε₂/(ε₁+ε₂)
   *
   *   BC: φ continuous, Dₙ continuous (σ_f=0), Eₙ ratio = ε₂/ε₁
   *   Field decays as 1/r (vs 1/r² for point charge).
   */
  function _computeLineCharge(x, y, z, p) {
    const { epsilon1, epsilon2, charge: lambda, chargePos: cp } = p;
    const dx = x - cp.x;
    const dz = z - cp.z;
    const r2 = dx * dx + dz * dz;
    const r = Math.sqrt(r2);
    const rEff = Math.max(r, RMIN);

    let phi, Ex, Ez, eps;

    if (z >= 0) {
      eps = epsilon1;
      const alpha = (epsilon1 - epsilon2) / (epsilon1 + epsilon2);
      const dzImg = z + cp.z;
      const rImg2 = dx * dx + dzImg * dzImg;
      const rImg = Math.sqrt(rImg2);
      const rImgEff = Math.max(rImg, RMIN);

      const coeff = lambda / (2 * Math.PI * epsilon1);
      phi = -coeff * (Math.log(rEff) + alpha * Math.log(rImgEff));

      Ex = coeff * (dx / (rEff * rEff) + alpha * dx / (rImgEff * rImgEff));
      Ez = coeff * (dz / (rEff * rEff) + alpha * dzImg / (rImgEff * rImgEff));
    } else {
      eps = epsilon2;
      const beta = (2 * epsilon2) / (epsilon1 + epsilon2);

      const coeff = lambda / (2 * Math.PI * epsilon2);
      phi = -coeff * beta * Math.log(rEff);

      Ex = coeff * beta * dx / (rEff * rEff);
      Ez = coeff * beta * dz / (rEff * rEff);
    }

    return { phi, Ex, Ey: 0, Ez, Dx: eps * Ex, Dy: 0, Dz: eps * Ez };
  }

  /**
   * Model 5: Point current source I above a planar conductivity interface.
   *
   * Mathematically dual to electrostatics (Model 1):
   *   ε → σ,  q → I,  D → J
   *
   *   Region 1 (z > 0, σ₁):
   *     φ = (I/(4πσ₁))·[1/R + α/R']
   *     J₁ = σ₁E₁
   *
   *   Region 2 (z < 0, σ₂):
   *     φ = (I/(4πσ₂))·β/R
   *     J₂ = σ₂E₂
   *
   *   α = (σ₁−σ₂)/(σ₁+σ₂),  β = 2σ₂/(σ₁+σ₂)
   *
   *   BC: φ continuous, Jₙ continuous (no current source at interface),
   *       Eₙ ratio = σ₂/σ₁,  Eₜ continuous,  Jₜ ratio = σ₁/σ₂
   *   Refraction: tanθ₁/tanθ₂ = σ₁/σ₂
   */
  function _computeCurrent(x, y, z, p) {
    const { epsilon1: sigma1, epsilon2: sigma2, charge: I, chargePos: cp } = p;
    const dx = x - cp.x;
    const dy = y - cp.y;
    const dz = z - cp.z;
    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const Reff = Math.max(R, RMIN);

    let phi, Ex, Ey, Ez, sigma;

    if (z >= 0) {
      sigma = sigma1;
      const alpha = (sigma1 - sigma2) / (sigma1 + sigma2);
      const dzImg = z + cp.z;
      const Rimg = Math.sqrt(dx * dx + dy * dy + dzImg * dzImg);
      const RimgEff = Math.max(Rimg, RMIN);

      const coeff = I * ONE_OVER_4PI / sigma1;
      phi = coeff * (1 / Reff + alpha / RimgEff);

      const dPhi_dx = -coeff * (dx / (Reff * Reff * Reff) + alpha * dx / (RimgEff * RimgEff * RimgEff));
      const dPhi_dy = -coeff * (dy / (Reff * Reff * Reff) + alpha * dy / (RimgEff * RimgEff * RimgEff));
      const dPhi_dz = -coeff * (dz / (Reff * Reff * Reff) + alpha * dzImg / (RimgEff * RimgEff * RimgEff));

      Ex = -dPhi_dx;
      Ey = -dPhi_dy;
      Ez = -dPhi_dz;
    } else {
      sigma = sigma2;
      const beta = (2 * sigma2) / (sigma1 + sigma2);

      const coeff = I * ONE_OVER_4PI / sigma2;
      phi = coeff * beta / Reff;

      const common = -coeff * beta / (Reff * Reff * Reff);
      Ex = -common * dx;
      Ey = -common * dy;
      Ez = -common * dz;
    }

    // J = σE (dual to D = εE)
    return { phi, Ex, Ey, Ez, Dx: sigma * Ex, Dy: sigma * Ey, Dz: sigma * Ez };
  }

  /**
   * Model 8: z-oriented magnetic dipole m above a planar permeability interface.
   *
   * Magnetostatic dual to electrostatics, with a crucial sign difference:
   *   BC: Bₙ continuous, Hₜ continuous  (B ↔ D, H ↔ E)
   *
   * Image dipole:  m' = m·(μ₂−μ₁)/(μ₁+μ₂)   [note: reversed from dielectric!]
   * Transmitted:   m'' = m·2μ₁/(μ₁+μ₂)
   *
   * The scalar potential φ_m (H = −∇φ_m) satisfies the same Laplace equation
   * as electrostatics, but the sign of the image coefficient is flipped because
   * Bₙ (not Hₙ) is continuous — the roles of normal and tangential components swap.
   *
   * For z ≥ 0 (μ₁): H = H_dipole(m) + H_dipole(m')
   * For z < 0 (μ₂): H = H_dipole(m'')
   * B = μH in each region.
   *
   * The return values map: phi → φ_m,  E → H,  D → B.
   */
  function _computeMagneticDipole(x, y, z, p) {
    const mu1 = p.epsilon1;   // μ₁
    const mu2 = p.epsilon2;   // μ₂
    const m = p.charge || 1.0; // magnetic dipole moment
    const cp = p.chargePos;

    const dx = x - cp.x;
    const dy = y - cp.y;
    const dz = z - cp.z;
    const R2 = dx * dx + dy * dy + dz * dz;
    const R = Math.sqrt(R2);
    const Reff = Math.max(R, 0.02);
    const Reff5 = Reff * Reff * Reff * Reff * Reff;

    // H-field of a z-oriented dipole: H = (1/4π)[3(m·r̂)r̂ − m]/r³
    // H_x = (3m/4π) xz/r⁵,  H_y = (3m/4π) yz/r⁵,  H_z = (m/4π)(3z²−r²)/r⁵
    function dipoleH(mag, ddx, ddy, ddz, r5) {
      const co = mag / (4 * Math.PI);
      return {
        Hx: 3 * co * ddx * ddz / r5,
        Hy: 3 * co * ddy * ddz / r5,
        Hz: co * (3 * ddz * ddz - (ddx * ddx + ddy * ddy + ddz * ddz)) / r5,
      };
    }

    let Hx, Hy, Hz, phi_m, mu;

    if (z >= 0) {
      mu = mu1;
      // Image dipole moment (note reversed sign vs dielectric)
      const mImg = m * (mu2 - mu1) / (mu1 + mu2);
      const dzImg = z + cp.z;
      const Rimg2 = dx * dx + dy * dy + dzImg * dzImg;
      const Rimg = Math.sqrt(Rimg2);
      const RimgEff = Math.max(Rimg, 0.02);
      const RimgEff5 = RimgEff * RimgEff * RimgEff * RimgEff * RimgEff;

      const hReal = dipoleH(m, dx, dy, dz, Reff5);
      const hImg  = dipoleH(mImg, dx, dy, dzImg, RimgEff5);

      Hx = hReal.Hx + hImg.Hx;
      Hy = hReal.Hy + hImg.Hy;
      Hz = hReal.Hz + hImg.Hz;

      // Scalar potential: φ_m = (1/4π)[m(z−z₀)/R³ + m'(z+z₀)/R'³]
      phi_m = (m * dz / (Reff * Reff * Reff) + mImg * dzImg / (RimgEff * RimgEff * RimgEff)) / (4 * Math.PI);
    } else {
      mu = mu2;
      const mTrans = m * 2 * mu1 / (mu1 + mu2);

      const hTrans = dipoleH(mTrans, dx, dy, dz, Reff5);
      Hx = hTrans.Hx;
      Hy = hTrans.Hy;
      Hz = hTrans.Hz;

      phi_m = mTrans * dz / (Reff * Reff * Reff) / (4 * Math.PI);
    }

    return {
      phi: phi_m,
      Ex: Hx, Ey: Hy, Ez: Hz,
      Dx: mu * Hx, Dy: mu * Hy, Dz: mu * Hz,
    };
  }

  /**
   * Model 6: Uniform electric field E₀ (along +z) applied to a dielectric sphere.
   *
   * Sphere: radius a, permittivity ε_in, centered at origin.
   * Medium: permittivity ε_out.
   *
   * Analytic solution (Legendre expansion, dipole term):
   *
   *   Inside (r < a):
   *     φ_in = −K·E₀·z          where K = 3ε_out/(ε_in+2ε_out)
   *     E_in = K·E₀ ẑ           (UNIFORM — special property of spherical geometry)
   *
   *   Outside (r ≥ a):
   *     φ_out = −E₀·z + C·E₀·a³·z/r³    where C = (ε_in−ε_out)/(ε_in+2ε_out)
   *     E = uniform field + z-oriented dipole at origin
   *       E_x = 3C·E₀·a³·x·z/r⁵
   *       E_y = 3C·E₀·a³·y·z/r⁵
   *       E_z = E₀ + C·E₀·a³·(3z²−r²)/r⁵
   *
   *   D = εE (ε_in inside, ε_out outside)
   *
   *   BC at r=a: φ continuous, D_r continuous  ✓
   *   Depolarization factor L = 1/3 (sphere)
   */
  function _computeSphere(x, y, z, p) {
    const epsIn = p.epsilon1;   // ε_in
    const epsOut = p.epsilon2;  // ε_out
    const E0 = p.charge || 1.0; // applied field strength
    const a = 1.0;              // sphere radius (fixed)

    const r = Math.sqrt(x * x + y * y + z * z);

    if (r < a) {
      // Inside: uniform field
      const K = 3 * epsOut / (epsIn + 2 * epsOut);
      const Ez = K * E0;
      return {
        phi: -K * E0 * z,
        Ex: 0, Ey: 0, Ez: Ez,
        Dx: 0, Dy: 0, Dz: epsIn * Ez,
      };
    }

    // Outside: uniform + dipole
    const C = (epsIn - epsOut) / (epsIn + 2 * epsOut);
    const a3 = a * a * a;
    const r2 = r * r;
    const r5 = r2 * r2 * r; // r^5 = r^2 * r^2 * r
    const rEff = Math.max(r, 0.02);
    const rEff5 = rEff * rEff * rEff * rEff * rEff;

    const dipoleFactor = C * E0 * a3 / rEff5;

    const Ex = 3 * dipoleFactor * x * z;
    const Ey = 3 * dipoleFactor * y * z;
    const Ez = E0 + dipoleFactor * (3 * z * z - rEff * rEff);

    return {
      phi: -E0 * z + C * E0 * a3 * z / (rEff * rEff * rEff),
      Ex: Ex, Ey: Ey, Ez: Ez,
      Dx: epsOut * Ex, Dy: epsOut * Ey, Dz: epsOut * Ez,
    };
  }

  // ─── Model Registry ───────────────────────────────────────────────

  const models = {
    dielectric: {
      id: "dielectric",
      name: "点电荷 + 介质分界面",
      subtitle: "镜像法 · 无自由面电荷",
      params: ["epsilon1", "epsilon2", "charge", "chargePos"],
      computeField: _computeDielectric,
      chartSubtitles: {
        phi: "φ 在 z=0 处连续",
        en:  "Eₙ 在 z=0 处跳变，比值 = ε₂/ε₁",
        dn:  "Dₙ 在 z=0 处连续（无自由电荷）",
      },
      uiLabels: { epsSection: "介质参数", eps1: "ε₁ (上半空间)", eps2: "ε₂ (下半空间)", source: "电荷量 q" },
    },
    conductor: {
      id: "conductor",
      name: "点电荷 + 接地导体平面",
      subtitle: "镜像法 · Dirichlet 边值条件",
      params: ["epsilon1", "charge", "chargePos"],
      computeField: _computeConductor,
      chartSubtitles: {
        phi: "φ 在 z=0 处为零（接地 Dirichlet BC）",
        en:  "Eₙ 在导体内部为零（静电平衡）",
        dn:  "Dₙ 在导体内部为零",
      },
      uiLabels: { epsSection: "介质参数", eps1: "ε₁ (上半空间)", eps2: "ε₂ (下半空间)", source: "电荷量 q" },
    },
    charged: {
      id: "charged",
      name: "点电荷 + 介质分界面（含 σ_f）",
      subtitle: "镜像法 + 均匀带电面 · 一般 Dₙ 跳变条件",
      params: ["epsilon1", "epsilon2", "sigma_f", "charge", "chargePos"],
      computeField: _computeCharged,
      chartSubtitles: {
        phi: "φ 在 z=0 处连续",
        en:  "Eₙ 在 z=0 处跳变",
        dn:  "Dₙ 在 z=0 处跳变 = σ_f（一般形式）",
      },
      uiLabels: { epsSection: "介质参数", eps1: "ε₁ (上半空间)", eps2: "ε₂ (下半空间)", source: "电荷量 q" },
    },
    linecharge: {
      id: "linecharge",
      name: "线电荷 + 介质分界面",
      subtitle: "镜像法 · 2D 对数势 · 场衰减 1/r",
      params: ["epsilon1", "epsilon2", "charge", "chargePos"],
      computeField: _computeLineCharge,
      chartSubtitles: {
        phi: "φ 在 z=0 处连续（对数势 ln r）",
        en:  "Eₙ 在 z=0 处跳变，比值 = ε₂/ε₁（场 ~ 1/r）",
        dn:  "Dₙ 在 z=0 处连续（无自由电荷）",
      },
      uiLabels: { epsSection: "介质参数", eps1: "ε₁ (上半空间)", eps2: "ε₂ (下半空间)", source: "线电荷密度 λ" },
    },
    current: {
      id: "current",
      name: "稳恒电流 + 电导率分界面",
      subtitle: "镜像法 · 静电-稳恒对偶 · ε↔σ  D↔J",
      params: ["epsilon1", "epsilon2", "charge", "chargePos"],
      computeField: _computeCurrent,
      chartSubtitles: {
        phi: "φ 在 z=0 处连续（电压连续）",
        en:  "Eₙ 在 z=0 处跳变，比值 = σ₂/σ₁",
        dn:  "Jₙ 在 z=0 处连续（无电流源 at 界面）",
      },
      chartTitles: { phi: "势函数 φ(z) — 电压", en: "法向电场 Eₙ(z)", dn: "法向电流密度 Jₙ(z)" },
      uiLabels: { epsSection: "电导率参数", eps1: "σ₁ (上半空间)", eps2: "σ₂ (下半空间)", source: "电流强度 I" },
    },
    sphere: {
      id: "sphere",
      name: "均匀电场 + 介质球",
      subtitle: "球谐展开 · 去极化因子 L=1/3 · 内部均匀场",
      params: ["epsilon1", "epsilon2", "charge", "chargePos"],
      computeField: _computeSphere,
      chartSubtitles: {
        phi: "φ 在 r=a 处连续",
        en:  "Eₙ 在球面跳变，内部为均匀场",
        dn:  "Dₙ 在球面连续（无自由电荷）",
      },
      chartTitles: { phi: "势函数 φ(z) — 沿 z 轴", en: "法向电场 E(z)", dn: "法向电位移 D(z)" },
      uiLabels: { epsSection: "介质参数", eps1: "ε_in (球内)", eps2: "ε_out (球外)", source: "外电场强度 E₀" },
    },
    magdipole: {
      id: "magdipole",
      name: "磁偶极子 + 磁导率分界面",
      subtitle: "镜像法 · Bₙ连续 Hₜ连续 · 磁静电对偶",
      params: ["epsilon1", "epsilon2", "charge", "chargePos"],
      computeField: _computeMagneticDipole,
      chartSubtitles: {
        phi: "φ_m (磁标势) 在 z=0 处连续",
        en:  "Hₙ 在 z=0 处跳变，比值 = μ₂/μ₁",
        dn:  "Bₙ 在 z=0 处连续（无磁单极）",
      },
      chartTitles: { phi: "磁标势 φ_m(z)", en: "磁场强度 H(z)", dn: "磁通密度 B(z)" },
      uiLabels: { epsSection: "磁导率参数", eps1: "μ₁ (上半空间)", eps2: "μ₂ (下半空间)", source: "磁偶极矩 m" },
    },
  };

  // ─── Public API ───────────────────────────────────────────────────

  function setModel(id) {
    if (models[id]) _activeModel = id;
  }

  function getModel() {
    return _activeModel;
  }

  function getModelMeta(id) {
    const m = models[id || _activeModel];
    return { id: m.id, name: m.name, subtitle: m.subtitle, params: m.params, chartSubtitles: m.chartSubtitles, chartTitles: m.chartTitles, uiLabels: m.uiLabels };
  }

  function getAllModels() {
    return Object.keys(models).map(function (k) {
      return { id: k, name: models[k].name, subtitle: models[k].subtitle };
    });
  }

  function computeField(x, y, z, p) {
    return models[_activeModel].computeField(x, y, z, p);
  }

  function sampleProfile(x0, y0, zMin, zMax, nPts, p) {
    var dz = (zMax - zMin) / (nPts - 1);
    var data = [];
    for (var i = 0; i < nPts; i++) {
      var z = zMin + i * dz;
      var f = computeField(x0, y0, z, p);
      data.push({
        z: z,
        phi: f.phi,
        En: f.Ez,
        Dn: f.Dz,
        Et: Math.sqrt(f.Ex * f.Ex + f.Ey * f.Ey),
        Dt: Math.sqrt(f.Dx * f.Dx + f.Dy * f.Dy),
      });
    }
    return data;
  }

  function sampleSlice(v1Min, v1Max, v2Min, v2Max, n1, n2, p) {
    var result = [];
    var dv1 = (v1Max - v1Min) / (n1 - 1);
    var dv2 = (v2Max - v2Min) / (n2 - 1);
    for (var i = 0; i < n1; i++) {
      var row = [];
      var v1 = v1Min + i * dv1;
      for (var j = 0; j < n2; j++) {
        var v2 = v2Min + j * dv2;
        var f = computeField(v1, 0, v2, p);
        row.push({ x: v1, z: v2, phi: f.phi, Ex: f.Ex, Ey: f.Ey, Ez: f.Ez, Dx: f.Dx, Dy: f.Dy, Dz: f.Dz });
      }
      result.push(row);
    }
    return result;
  }

  return {
    setModel: setModel,
    getModel: getModel,
    getModelMeta: getModelMeta,
    getAllModels: getAllModels,
    computeField: computeField,
    sampleProfile: sampleProfile,
    sampleSlice: sampleSlice,
  };
})();

window.Physics = Physics;
