/**
 * Physics Engine — Method of Images for point charge above dielectric interface.
 *
 * Region 1 (z > 0, ε₁): φ = (1/(4πε₁)) [q/R + q'/R']
 *   where q' = q·(ε₁-ε₂)/(ε₁+ε₂)  (image charge below interface)
 * Region 2 (z < 0, ε₂): φ = (1/(4πε₂)) [q''/R]
 *   where q'' = q·2ε₂/(ε₁+ε₂)      (transmitted charge)
 *
 * Normal = z-direction, Tangential = x-y plane.
 */

const Physics = (function () {
  const ONE_OVER_4PI = 1 / (4 * Math.PI);

  /**
   * Compute field at a single point.
   * @param {number} x, y, z — observation point
   * @param {{epsilon1, epsilon2, charge, chargePos: {x,y,z}}} p
   * @returns {{phi, Ex, Ey, Ez, Dx, Dy, Dz}}
   */
  function computeField(x, y, z, p) {
    const { epsilon1, epsilon2, charge: q, chargePos: cp } = p;
    const dx = x - cp.x;
    const dy = y - cp.y;
    const dz = z - cp.z;
    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Guard against singularity at charge position
    const Rmin = 0.02;
    const Reff = Math.max(R, Rmin);

    let phi, Ex, Ey, Ez, eps;

    if (z >= 0) {
      // Region 1: real charge + image charge
      eps = epsilon1;
      const alpha = (epsilon1 - epsilon2) / (epsilon1 + epsilon2);

      // Image charge at (cp.x, cp.y, -cp.z)
      const dzImg = z + cp.z;
      const Rimg = Math.sqrt(dx * dx + dy * dy + dzImg * dzImg);
      const RimgEff = Math.max(Rimg, Rmin);

      const coeff = q * ONE_OVER_4PI / epsilon1;
      phi = coeff * (1 / Reff + alpha / RimgEff);

      // E = -grad φ
      const dPhi_dx = -coeff * (dx / (Reff * Reff * Reff) + alpha * dx / (RimgEff * RimgEff * RimgEff));
      const dPhi_dy = -coeff * (dy / (Reff * Reff * Reff) + alpha * dy / (RimgEff * RimgEff * RimgEff));
      const dPhi_dz = -coeff * (dz / (Reff * Reff * Reff) + alpha * dzImg / (RimgEff * RimgEff * RimgEff));

      Ex = -dPhi_dx;
      Ey = -dPhi_dy;
      Ez = -dPhi_dz;
    } else {
      // Region 2: transmitted charge only
      eps = epsilon2;
      const beta = (2 * epsilon2) / (epsilon1 + epsilon2);

      const coeff = q * ONE_OVER_4PI / epsilon2;
      phi = coeff * beta / Reff;

      const common = -coeff * beta / (Reff * Reff * Reff);
      Ex = -common * dx;
      Ey = -common * dy;
      Ez = -common * dz;
    }

    const Dx = eps * Ex;
    const Dy = eps * Ey;
    const Dz = eps * Ez;

    return { phi, Ex, Ey, Ez, Dx, Dy, Dz };
  }

  /**
   * Sample field along a vertical line (x=x0, y=y0) from zMin to zMax.
   * @returns {Array<{z, phi, En, Dn, Et, Dt}>}
   */
  function sampleProfile(x0, y0, zMin, zMax, nPts, p) {
    const dz = (zMax - zMin) / (nPts - 1);
    const data = [];
    for (let i = 0; i < nPts; i++) {
      const z = zMin + i * dz;
      const f = computeField(x0, y0, z, p);
      data.push({
        z,
        phi: f.phi,
        En: f.Ez,
        Dn: f.Dz,
        Et: Math.sqrt(f.Ex * f.Ex + f.Ey * f.Ey),
        Dt: Math.sqrt(f.Dx * f.Dx + f.Dy * f.Dy),
      });
    }
    return data;
  }

  /**
   * Compute field on a 2D grid in the y=0 (or x=0) plane.
   * @returns {Array<Array<{x,z,phi,Ex,Ey,Ez,Dx,Dy,Dz}>>}
   */
  function sampleSlice(planeConst, planeVar1Min, planeVar1Max, planeVar2Min, planeVar2Max, n1, n2, p) {
    const result = [];
    const dv1 = (planeVar1Max - planeVar1Min) / (n1 - 1);
    const dv2 = (planeVar2Max - planeVar2Min) / (n2 - 1);
    for (let i = 0; i < n1; i++) {
      const row = [];
      const v1 = planeVar1Min + i * dv1;
      for (let j = 0; j < n2; j++) {
        const v2 = planeVar2Min + j * dv2;
        // Hardcoded for y=0 slice: v1=x, v2=z
        const f = computeField(v1, 0, v2, p);
        row.push({ x: v1, z: v2, ...f });
      }
      result.push(row);
    }
    return result;
  }

  return { computeField, sampleProfile, sampleSlice };
})();

window.Physics = Physics;
