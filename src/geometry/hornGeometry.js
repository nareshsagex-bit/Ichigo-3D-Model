import * as THREE from 'three';
import { FACE } from './faceLandmarks.js';

/**
 * One Vasto Lorde horn (character's left / viewer's right, +x side).
 * The sweep is traced from the reference: an S-curve out of the temple, steeply up,
 * out almost flat, then a final upward hook to a fine point far above the crown.
 * The opposite horn is the same geometry mirrored with scale.x = -1, so the pair can
 * never drift apart.
 */
export function createHornGeometry() {
  const curve = new THREE.CatmullRomCurve3(FACE.horn.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  curve.curveType = 'centripetal';

  const radialSegments = 32;
  const tubularSegments = 160;
  const tipRadius = 0.004;
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const vertices = [];
  const uvs = [];
  const indices = [];
  const P = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    // Thick root flaring into the skull, then a steady taper to the needle tip
    const flare = 1 + 0.35 * Math.exp(-u / 0.05);
    const radius = FACE.horn.baseRadius * flare * Math.pow(1 - u, 0.75) + tipRadius;

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      // Slightly flattened bone section with a soft ridge along the outer edge
      const r = radius * (1 + 0.1 * Math.cos(theta) - 0.05 * Math.cos(2 * theta));
      dir.set(0, 0, 0).addScaledVector(N, Math.cos(theta)).addScaledVector(B, Math.sin(theta) * 0.82);
      vertices.push(P.x + dir.x * r, P.y + dir.y * r, P.z + dir.z * r);
      uvs.push(j / radialSegments, u * 5);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      const c = (i + 1) * (radialSegments + 1) + j + 1;
      const d = i * (radialSegments + 1) + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
