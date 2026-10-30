import * as THREE from 'three';
import { FACE, profileAt, gauss, smoothstep, localFrame, faceUV, grinAt, grinT } from './faceLandmarks.js';

/**
 * Vasto Lorde Ichigo's hollow mask, built the way a modeler blocks a head:
 * 1. Silhouette from front/side profile curves (orthographic reference sheet)
 * 2. Planes and features as fields of |x|, so both halves are identical by construction
 * 3. Planar face-space UVs so the painted stripes/eyes line up with the sculpt
 */
export function createMaskGeometry() {
  // widthSegments must be even: every vertex then has an exact mirror partner
  const geo = new THREE.SphereGeometry(1, 192, 192);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const span = FACE.crownY - FACE.chinY;
  const { eye, brow, nose, cheekbone, cheekHollow } = FACE;
  const browSlope = (brow.outerY - brow.innerY) / (brow.outerX - brow.innerX);

  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i);
    const dy = pos.getY(i);
    const dz = pos.getZ(i);

    // --- 1. Silhouette ---
    const y = FACE.chinY + ((dy + 1) / 2) * span;
    const r = Math.hypot(dx, dz);
    const c = r > 1e-9 ? dx / r : 0;
    const s = r > 1e-9 ? dz / r : 0;
    const n = s > 0 ? FACE.faceFlatness : FACE.skullRoundness;
    const halfWidth = profileAt(FACE.frontOutline, y);
    const zFront = profileAt(FACE.frontDepth, y);
    let x = Math.sign(c) * Math.abs(c) ** (2 / n) * halfWidth;
    let z = Math.sign(s) * Math.abs(s) ** (2 / n) * (s > 0 ? zFront : profileAt(FACE.backDepth, y));

    // --- 2. Symmetric feature fields ---
    const ax = Math.abs(x);
    const sx = Math.sign(x) || 1;
    const front = s > 0 ? smoothstep(0.15, 0.6, z / Math.max(zFront, 1e-3)) : 0;

    if (front > 0) {
      let dz2 = 0;
      let dx2 = 0;

      // Central forehead crest
      dz2 += 0.045 * gauss(ax, 0.095) * smoothstep(0.2, 0.5, y) * (1 - smoothstep(0.95, 1.15, y));

      // Angry brow ridge: inner end low, outer end high
      const browLineY = brow.innerY + browSlope * (ax - brow.innerX);
      const alongBrow = smoothstep(brow.innerX - 0.06, brow.innerX + 0.04, ax) * (1 - smoothstep(brow.outerX - 0.06, brow.outerX + 0.08, ax));
      dz2 += brow.lift * gauss(y - browLineY - 0.02, 0.07) * Math.max(alongBrow, gauss(ax, 0.08) * 0.2);

      // Eye socket carved along the slanted almond
      const e = localFrame(ax, y, eye.cx, eye.cy, eye.slant);
      const socket = (e.u / (eye.halfLen + 0.05)) ** 2 + (e.v / (eye.halfH + 0.06)) ** 2;
      dz2 -= 0.22 * Math.exp(-socket * 1.8);

      // Nasal blade from between the brows down to a small skull nose tip
      const noseRun = smoothstep(nose.tipY - 0.04, nose.tipY + 0.1, y) * (1 - smoothstep(-0.32, 0.20, y));
      // Tent cross-section creates an actual blade with planar sides.
      const blade = Math.max(0, 1 - ax / (0.065 + 0.06 * Math.max(0, -y)));
      dz2 += 0.16 * blade * noseRun;
      // Paired glabella ridges split around the nasal root.
      dz2 += 0.018 * gauss(ax - 0.085, 0.035) * gauss(y - 0.02, 0.18);

      // Cheekbone plates, then a deep hollow beside the narrow muzzle
      const cb = gauss(ax - cheekbone.x, 0.1) * gauss(y - cheekbone.y, 0.1);
      dz2 += 0.09 * cb;
      dx2 += 0.03 * cb;
      const ch = gauss(ax - cheekHollow.x, 0.1) * gauss(y - cheekHollow.y, 0.18);
      dz2 -= 0.23 * ch;
      // Oblique zygomatic shelf and a tapering mandible plane.
      const cheekLine = -0.36 + 0.48 * (ax - 0.3);
      dz2 += 0.075 * Math.max(0, 1 - Math.abs(y - cheekLine) / 0.055)
        * smoothstep(0.25, 0.42, ax) * (1 - smoothstep(0.58, 0.69, ax));
      dz2 += 0.045 * Math.max(0, 1 - ax / 0.22) * gauss(y + 1.02, 0.12);

      // Dental arch: the grin band pushed slightly forward, fading out past the corners
      const gt = grinT(x, Math.max(halfWidth, 1e-3));
      const g = grinAt(Math.min(1, Math.abs(gt)));
      const band = smoothstep(g.bottom - 0.06, g.bottom + 0.02, y) * (1 - smoothstep(g.top - 0.02, g.top + 0.06, y));
      dz2 += 0.04 * band * (1 - smoothstep(0.85, 1.05, Math.abs(gt)));

      z += front * dz2;
      x += front * sx * dx2;
    }

    pos.setXYZ(i, x, y, z);

    // --- 3. Planar face-space UVs; the back reuses the unpainted column just past the
    // face edge, so the front design never repeats behind and the bone tone stays continuous
    const p = faceUV(x, y);
    const edgeU = faceUV(halfWidth + 0.02, y).u;
    if (s > 0) uv.setXY(i, p.u, p.v);
    else uv.setXY(i, x >= 0 ? edgeU : 1 - edgeU, p.v);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
