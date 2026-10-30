import { FACE } from './faceLandmarks.js';

/**
 * Angry slanted almond for one eye, as face-space points (x, y).
 * side = +1 for the character's left (viewer's right), -1 for the other eye.
 * lenScale / heightScale shrink the same almond, so the dark socket and the
 * glowing slit inside it share one shape. Upper lid is a flat, heavy line (scowl).
 * Built from |x| frame constants times side, so both eyes are exact mirrors and
 * match the carved sockets in maskGeometry.
 */
export function eyeOutline(side, lenScale = 1, heightScale = 1, offset = 0, samples = 48) {
  const { cx, cy, halfLen, halfH, slant } = FACE.eye;
  const L = halfLen * lenScale;
  const Hh = halfH * heightScale;
  const c = Math.cos(slant);
  const s = Math.sin(slant);
  const toFace = (u, v) => [side * (cx + (u + offset) * c - v * s), cy + (u + offset) * s + v * c];

  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const u = -L + (2 * L * i) / samples;
    const k = 1 - (u / L) ** 2;
    // Upper lid: heavier toward the inner corner for the frown
    const inner = 0.5 - 0.5 * (u / L);
    pts.push(toFace(u, Hh * Math.pow(k, 0.9) * (0.45 + 0.35 * inner)));
  }
  for (let i = samples; i >= 0; i--) {
    const u = -L + (2 * L * i) / samples;
    const k = 1 - (u / L) ** 2;
    pts.push(toFace(u, -Hh * 1.05 * Math.pow(k, 0.65)));
  }
  return pts;
}

/** The glowing slit inside the socket. */
export function eyeGlowOutline(side) {
  const { len, height, offset } = FACE.eyeGlow;
  return eyeOutline(side, len, height, offset);
}
