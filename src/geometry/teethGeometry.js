import * as THREE from 'three';
import { FACE, grinAt } from './faceLandmarks.js';

/**
 * Skull-grin teeth for Vasto Lorde Ichigo, traced from the turnaround sheet:
 * many thin teeth on a horseshoe dental arch that wraps back along the jaw,
 * in a short band under the nose whose bite line curves up toward the corners.
 *
 * Each tooth sits at an arch angle φ. The mask is raycast inward from that angle
 * (toward the arch axis) at the root, middle and tip, and the tooth's vertices are
 * bent along those hits, so every tooth hugs the muzzle, front and sides alike.
 * Teeth are laid out at ±φ, so the grin is symmetric by construction.
 */
export function createTeethGroup(maskMesh) {
  const group = new THREE.Group();
  const { archCenterZ, wrap, teethPerRow } = FACE.mouth;

  const material = new THREE.MeshStandardMaterial({
    color: 0xd8d9df,
    roughness: 0.64,
    metalness: 0.02,
  });

  maskMesh.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const inward = new THREE.Vector3();
  function surface(phi, y) {
    origin.set(Math.sin(phi) * 4, y, archCenterZ + Math.cos(phi) * 4);
    inward.set(-Math.sin(phi), 0, -Math.cos(phi));
    raycaster.set(origin, inward);
    const hit = raycaster.intersectObject(maskMesh, false)[0];
    if (!hit) return null;
    return { point: hit.point, normal: hit.face.normal.clone() };
  }

  function bendTooth(phi, rootY, tipY, width) {
    const rows = 12;
    const positions = [], indices = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const y = THREE.MathUtils.lerp(rootY, tipY, t);
      const hit = surface(phi, y);
      if (!hit) return null;
      const n = hit.normal;
      const across = new THREE.Vector3().crossVectors(up, n).normalize();
      // Enamel crown narrows into a short pointed tip, not a long picket.
      const taper = t < 0.64 ? 0.72 + 0.28 * Math.sin(t / 0.64 * Math.PI / 2)
        : THREE.MathUtils.lerp(1, 0.78, (t - 0.64) / 0.36);
      for (let k = 0; k < 5; k++) {
        const u = k / 4 * 2 - 1;
        const bulge = 0.006 + 0.016 * (1 - u * u) * Math.sin(Math.PI * (0.12 + 0.8 * t));
        const v = hit.point.clone().addScaledVector(across, u * width * taper / 2)
          .addScaledVector(n, bulge);
        positions.push(v.x, v.y, v.z);
      }
    }
    for (let j = 0; j < rows; j++) for (let k = 0; k < 4; k++) {
      const a = j * 5 + k, b = a + 5;
      if (tipY < rootY) indices.push(a,b,a+1, a+1,b,b+1);
      else indices.push(a,a+1,b, a+1,b+1,b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  const step = (2 * wrap) / teethPerRow;
  for (let i = 0; i < teethPerRow / 2; i++) {
    const phi = step * (i + 0.5);
    const g = grinAt(phi / wrap);

    // Tooth width = distance between the neighbouring slots on the surface, minus a thin gap
    const l = surface(phi - step / 2, g.bite);
    const r = surface(phi + step / 2, g.bite);
    if (!l || !r) continue;
    const width = l.point.distanceTo(r.point) * 0.94;

    for (const [rootY, tipY] of [
      [g.top + 0.01, g.bite + 0.0015],
      [g.bottom - 0.01, g.bite - 0.0015],
    ]) {
      if (Math.abs(rootY - tipY) < 0.04) continue;
      const geo = bendTooth(phi, rootY, tipY, width);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      // Reflect the finished crown so raycast triangle normals cannot introduce
      // left/right differences in the enamel surface. Restore outward winding.
      const mirrored = geo.clone().scale(-1,1,1);
      const index = mirrored.index.array;
      for (let j=0;j<index.length;j+=3) {
        const b=index[j+1]; index[j+1]=index[j+2]; index[j+2]=b;
      }
      mirrored.computeVertexNormals();
      const partner = new THREE.Mesh(mirrored,material);
      partner.castShadow=true;
      partner.receiveShadow=true;
      group.add(partner);
    }
  }

  return group;
}
