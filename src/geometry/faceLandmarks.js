import * as THREE from 'three';

/**
 * Single source of truth for Vasto Lorde Ichigo's head.
 * Geometry, texture painting, teeth, horns and cameras all read these numbers,
 * so the left/right halves and every attachment stay locked together.
 *
 * Approximate landmark fit to the front panel of the supplied turnaround sheet.
 * Crown (264,84), chin (264,258), H=174 pixels. These are visual estimates,
 * not an assertion that the illustrated panels are consistent orthographic views.
 */
export const REFERENCE = {
  url: '/reference/turnaround-sheet.png',
  widthPx: 1536,
  heightPx: 1024,
  panel: [0, 0, 512, 312],
  unitsPerPx: 2.48 / 174,
  centerPx: [264, 171],
};

export const FACE = {
  crownY: 1.24,
  chinY: -1.24,

  // Front view silhouette: [y, halfWidth], crown → chin.
  // Broad, flattened helmet top; widest at the temples; a hard step in under the
  // cheekbones into the narrow skeletal muzzle that is all teeth; pointed chin.
  frontOutline: [
    [1.24, 0], [1.20, 0.18], [1.10, 0.35], [0.94, 0.49],
    [0.72, 0.59], [0.45, 0.65], [0.18, 0.69], [0.02, 0.70],
    [-0.15, 0.66], [-0.28, 0.61], [-0.40, 0.53],
    [-0.60, 0.46], [-0.82, 0.39], [-1.02, 0.29],
    [-1.18, 0.15], [-1.24, 0],
  ],

  // Separate front/back depth curves retain a cranial volume and a lean jaw.
  frontDepth: [
    [1.24, 0], [1.20, 0.23], [1.10, 0.43], [0.94, 0.57],
    [0.72, 0.66], [0.45, 0.72], [0.18, 0.75], [0.02, 0.74],
    [-0.15, 0.74], [-0.30, 0.74], [-0.45, 0.79],
    [-0.65, 0.76], [-0.85, 0.70], [-1.05, 0.73],
    [-1.19, 0.57], [-1.24, 0],
  ],

  // Side view: back of the skull (hidden under the hair shell)
  backDepth: [
    [1.24, 0.0],
    [1.1, 0.5],
    [0.85, 0.8],
    [0.45, 0.92],
    [0.0, 0.86],
    [-0.35, 0.66],
    [-0.7, 0.42],
    [-1.0, 0.22],
    [-1.18, 0.08],
    [-1.24, 0.0],
  ],

  // Cross-section superellipse exponents (higher = flatter)
  faceFlatness: 2.15,
  skullRoundness: 2.0,

  // Dark angry socket (right side; left is the mirror). Inner corner low, outer high.
  eye: { cx: 0.355, cy: -0.13, halfLen: 0.195, halfH: 0.062, slant: 0.30 },
  // Thin glowing slit in the outer half of the socket (fractions of the socket; offset along the eye)
  eyeGlow: { len: 0.59, height: 0.36, offset: 0.012 },
  brow: { innerX: 0.12, innerY: -0.04, outerX: 0.59, outerY: 0.16, lift: 0.055 },
  nose: { tipY: -0.48 },
  cheekbone: { x: 0.56, y: -0.28 },
  cheekHollow: { x: 0.42, y: -0.48 },

  // Skull grin, traced from the turnaround sheet (public/reference/turnaround-sheet.png):
  // a horseshoe dental arch wrapping ~70° back along each side of the jaw (profile view),
  // a short band just under the nose, and a bite line that curves up toward the corners.
  // Heights are given at the centre (t = 0) and at the corners (|t| = 1), t = arch angle / wrap.
  mouth: {
    archCenterZ: 0.26, // teeth are raycast inward toward this axis
    wrap: 1.22, // radians each side of centre
    top: [-0.55, -0.42],
    bite: [-0.78, -0.62],
    bottom: [-0.96, -0.79],
    teethPerRow: 18,
  },

  // Horn S-curve traced from the reference: out of the temple, steeply up,
  // out almost flat, then a final upward hook to the needle tip
  horn: {
    path: [
      [0.5, 0.74, 0.0],
      [0.95, 0.84, 0.05],
      [1.62, 1.1, 0.08],
      [2.02, 1.64, 0.05],
      [2.4, 2.1, 0.0],
      [3.0, 2.32, -0.08],
      [3.45, 2.46, -0.12],
      [3.76, 2.82, -0.18],
      [4.0, 3.2, -0.24],
    ],
    baseRadius: 0.15,
  },

  // Planar texture projection extents
  uvHalfWidth: 1.0,
};

/** Grin edge heights at arch parameter t ∈ [-1, 1] (0 = centre, ±1 = mouth corners). */
export function grinAt(t) {
  const k = t * t;
  const lerp = ([c, e]) => c + (e - c) * k;
  return { top: lerp(FACE.mouth.top), bite: lerp(FACE.mouth.bite), bottom: lerp(FACE.mouth.bottom) };
}

/** Arch angle for a front-view x on the muzzle (inverse of the arch projection). */
export function grinT(x, halfWidth) {
  const a = Math.asin(Math.max(-1, Math.min(1, x / halfWidth)));
  return a / FACE.mouth.wrap;
}

export const FACE_HEIGHT = FACE.crownY - FACE.chinY;

/** Cubic Hermite interpolation of [y, value] samples (Catmull-Rom tangents in y). */
export function profileAt(samples, y) {
  // samples are ordered top → bottom (descending y)
  const n = samples.length;
  if (y >= samples[0][0]) return samples[0][1];
  if (y <= samples[n - 1][0]) return samples[n - 1][1];

  let i = 0;
  while (i < n - 2 && y < samples[i + 1][0]) i++;

  const [y0, v0] = samples[i];
  const [y1, v1] = samples[i + 1];
  const tangent = (k) => {
    const a = samples[Math.max(0, k - 1)];
    const b = samples[Math.min(n - 1, k + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const h = y1 - y0;
  const t = (y - y0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * v0 +
    (t3 - 2 * t2 + t) * h * tangent(i) +
    (-2 * t3 + 3 * t2) * v1 +
    (t3 - t2) * h * tangent(i + 1)
  );
}

export const gauss = (d, w) => Math.exp(-((d / w) ** 2));

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Rotate (ax, y) into a feature's local frame; using |x| mirrors the slant for free. */
export function localFrame(ax, y, cx, cy, angle) {
  const dx = ax - cx;
  const dy = y - cy;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { u: dx * c + dy * s, v: -dx * s + dy * c };
}

/** Face-space (x, y) → planar UV. Canvas centre column is the face centre line. */
export function faceUV(x, y) {
  return {
    u: 0.5 + x / (2 * FACE.uvHalfWidth),
    v: (y - FACE.chinY) / FACE_HEIGHT,
  };
}

/** Max distance between each vertex and its mirror partner at (-x, y, z). */
export function measureSymmetry(geometry, cell = 1e-3) {
  const pos = geometry.attributes.position;
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
  const grid = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }

  const v = new THREE.Vector3();
  const m = new THREE.Vector3();
  let maxError = 0;
  for (let i = 0; i < pos.count; i++) {
    m.set(-pos.getX(i), pos.getY(i), pos.getZ(i));
    const gx = Math.round(m.x / cell);
    const gy = Math.round(m.y / cell);
    const gz = Math.round(m.z / cell);
    let best = Infinity;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c = -1; c <= 1; c++) {
          const bucket = grid.get(`${gx + a},${gy + b},${gz + c}`);
          if (!bucket) continue;
          for (const j of bucket) best = Math.min(best, v.fromBufferAttribute(pos, j).distanceTo(m));
        }
    maxError = Math.max(maxError, best);
  }
  return maxError;
}
