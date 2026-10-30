import * as THREE from 'three';
import { FACE, FACE_HEIGHT, profileAt, grinAt } from '../geometry/faceLandmarks.js';
import { eyeOutline, eyeGlowOutline } from '../geometry/eyeGeometry.js';

/**
 * Procedural textures for Vasto Lorde Ichigo.
 * The mask canvases are painted in face space: a canvas transform maps (x, y) head units
 * onto the same planar UVs the mask geometry writes, so stripes, eyes and the mouth
 * land exactly on the sculpted features. Every mark is drawn for side = ±1.
 */

const SIDES = [-1, 1];

function faceCanvas(size = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx, size };
}

// Switch the context to face units: x right, y up, origin on the centre line
function useFaceSpace(ctx, size) {
  ctx.setTransform(
    size / (2 * FACE.uvHalfWidth),
    0,
    0,
    -size / FACE_HEIGHT,
    size / 2,
    (size * FACE.crownY) / FACE_HEIGHT
  );
}

function tracePolygon(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/**
 * Variable-width ribbon along a smooth curve through face-space points.
 * widths are sampled evenly along the curve (full width, not half).
 */
function ribbon(points, widths, side, samples = 80) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(side * x, y, 0)));
  curve.curveType = 'centripetal';
  const left = [];
  const right = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const d = curve.getTangentAt(t);
    const f = t * (widths.length - 1);
    const k = Math.min(widths.length - 2, Math.floor(f));
    const w = THREE.MathUtils.lerp(widths[k], widths[k + 1], f - k) / 2;
    left.push([p.x - d.y * w, p.y + d.x * w]);
    right.push([p.x + d.y * w, p.y - d.x * w]);
  }
  return left.concat(right.reverse());
}

// Hollow stripe design traced from the reference (viewer's-right half; mirrored by side)
const STRIPES = [
  // Thick stripe hugging the forehead edge, curving in to the eye's outer corner
  {
    points: [[0.35, 1.22], [0.43, 0.96], [0.45, 0.62], [0.43, 0.25], [0.36, -0.07]],
    widths: [0.075, 0.13, 0.15, 0.13, 0.07],
  },
  // Thin inner crescent on the forehead, tapering to a point
  {
    points: [[0.21, 1.20], [0.22, 0.92], [0.19, 0.62], [0.14, 0.32]],
    widths: [0.045, 0.055, 0.032, 0.0],
  },
  // Tear mark: from under the eye down to the grin's corner
  {
    points: [[0.35, -0.19], [0.38, -0.32], [0.34, -0.43], [0.32, -0.57]],
    widths: [0.095, 0.10, 0.065, 0.0],
  },
];

// Grin outline in face space: the arch angle projected to front-view x
function mouthPath(ctx, grow = 0) {
  const steps = 64;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 - 1;
    const g = grinAt(t);
    const half = profileAt(FACE.frontOutline, g.bite);
    pts.push([half * Math.sin(t * FACE.mouth.wrap) * (1 + grow), g.top + grow, g.bottom - grow]);
  }
  ctx.beginPath();
  pts.forEach(([x, top], i) => (i === 0 ? ctx.moveTo(x, top) : ctx.lineTo(x, top)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][2]);
  ctx.closePath();
}

// Dark grin cavity: shows only as the thin lines between and around the teeth
function paintMouth(ctx, { fill, rim }) {
  mouthPath(ctx, 0.015);
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = 0.02;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

export function createMaskTextures() {
  const color = faceCanvas();
  const glow = faceCanvas();
  const { ctx, size } = color;

  // 1. Bone base: bright centre, ash toward the edges
  const bg = ctx.createRadialGradient(size / 2, size * 0.42, 60, size / 2, size * 0.5, size * 0.6);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.45, '#f4f3ef');
  bg.addColorStop(1, '#dcd8cf');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Fine bone grain
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const g = (Math.random() - 0.5) * 6;
    img.data[i] += g;
    img.data[i + 1] += g;
    img.data[i + 2] += g;
  }
  ctx.putImageData(img, 0, 0);

  useFaceSpace(ctx, size);

  // 2. Black hollow stripes
  ctx.fillStyle = '#0a0a0f';
  for (const side of SIDES) {
    for (const s of STRIPES) {
      tracePolygon(ctx, ribbon(s.points, s.widths, side));
      ctx.fill();
    }
  }

  // Angular nasal openings and cheek cut-outs, mirrored from one definition.
  for (const side of SIDES) {
    const poly = (points, fill) => {
      tracePolygon(ctx, points.map(([x,y]) => [side*x,y]));
      ctx.fillStyle = fill;
      ctx.fill();
    };
    poly([[0.025,-0.36],[0.12,-0.29],[0.095,-0.45],[0.025,-0.53]], '#11131b');
    poly([[0.49,-0.24],[0.62,-0.22],[0.55,-0.36],[0.47,-0.40],
      [0.42,-0.61],[0.37,-0.59],[0.40,-0.39]], '#11131b');

  }

  // 3. Mouth cavity (shows between the long teeth)
  paintMouth(ctx, { fill: '#0b0b0f', rim: 'rgba(10, 10, 14, 0.9)' });

  // 4. Eyes: dark socket with a thin white-hot slit fading to gold at the rim
  const slitGradient = (c, side) => {
    const { cx, cy, slant } = FACE.eye;
    const gx = side * (cx + FACE.eyeGlow.offset * Math.cos(slant));
    const gy = cy + FACE.eyeGlow.offset * Math.sin(slant);
    const g = c.createRadialGradient(gx, gy, 0, gx, gy, FACE.eye.halfLen * FACE.eyeGlow.len);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.55, '#ffe27a');
    g.addColorStop(1, '#f59e0b');
    return g;
  };
  for (const side of SIDES) {
    tracePolygon(ctx, eyeOutline(side));
    ctx.fillStyle = '#040406';
    ctx.fill();
    tracePolygon(ctx, eyeGlowOutline(side));
    ctx.fillStyle = slitGradient(ctx, side);
    ctx.fill();
  }

  // Emissive layer: only the slits glow
  glow.ctx.fillStyle = '#000000';
  glow.ctx.fillRect(0, 0, glow.size, glow.size);
  useFaceSpace(glow.ctx, glow.size);
  for (const side of SIDES) {
    tracePolygon(glow.ctx, eyeGlowOutline(side));
    glow.ctx.fillStyle = slitGradient(glow.ctx, side);
    glow.ctx.fill();
  }

  const make = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: make(color.canvas), emissiveMap: make(glow.canvas) };
}

/**
 * Bump map: bone grain plus a recessed mouth cavity so the teeth read as set into the mask.
 */
export function createBoneBumpMap() {
  const { canvas, ctx, size } = faceCanvas(1024);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 14;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  useFaceSpace(ctx, size);
  paintMouth(ctx, { fill: '#303030' });

  return new THREE.CanvasTexture(canvas);
}

/**
 * Procedural horn texture matching the image:
 * Bone ivory with smooth gradient and dark inner shadow
 */
export function createHornTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const w = canvas.width;
  const h = canvas.height;

  // Clean bone gradient matching the image's sleek horns
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#f3f1ea');
  grad.addColorStop(0.7, '#e4dfd3');
  grad.addColorStop(1.0, '#cbc4b4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle bone longitudinal grain
  ctx.fillStyle = 'rgba(60, 55, 50, 0.04)';
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * w;
    const width = 1 + Math.random() * 3;
    ctx.fillRect(x, 0, width, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}
