import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaskGeometry } from '../src/geometry/maskGeometry.js';
import { createTeethGroup } from '../src/geometry/teethGeometry.js';
import { createFacePlates } from '../src/geometry/facePlates.js';
import { measureSymmetry, FACE_HEIGHT } from '../src/geometry/faceLandmarks.js';

const geometry = createMaskGeometry();
const mask = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
const teeth = createTeethGroup(mask);
const plates = createFacePlates(mask);
assert.equal(teeth.children.length,36,'All dental slots must hit the skull');
assert.equal(plates.children.length,4,'Both pairs of bone planes must exist');
const all = [geometry, ...teeth.children.map(m=>m.geometry), ...plates.children.map(m=>m.geometry)];
for (const g of all) {
  for (const name of ['position','normal']) {
    for (const v of g.attributes[name].array) assert.ok(Number.isFinite(v),`Non-finite ${name}`);
  }
}
const mirrorError = measureSymmetry(geometry);
assert.ok(mirrorError < FACE_HEIGHT*1e-5,`Mask mirror error ${mirrorError}`);
// A continuous descent toward the nasal tip must not introduce another bridge hump.
const noseRay=new THREE.Raycaster();let previousDepth=0;
for(let y=0.2;y>=-0.30;y-=0.025) {
  noseRay.set(new THREE.Vector3(0,y,3),new THREE.Vector3(0,0,-1));
  const depth=noseRay.intersectObject(mask,false)[0].point.z;
  assert.ok(depth>=previousDepth-0.001,'Nasal bridge must slope smoothly toward the tip');
  previousDepth=depth;
}
// Verify attachment symmetry in world/model coordinates across all patches/teeth.
for (const [name, group] of [['teeth',teeth],['planes',plates]]) {
  const positions=[];
  for (const mesh of group.children) positions.push(...mesh.geometry.attributes.position.array);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const error=measureSymmetry(g);
  assert.ok(error<FACE_HEIGHT*1e-4,`${name} mirror error ${error}`);
  console.log(`${name}: ${group.children.length} meshes, mirror error ${error.toExponential(3)}`);
}
// Frontmost upper and lower central crowns should both face toward the viewer.
for (const mesh of teeth.children.slice(16,20)) {
  const n=mesh.geometry.attributes.normal;
  let z=0;
  for (let i=0;i<n.count;i++) z+=n.getZ(i);
  assert.ok(z>0,'A central tooth has inverted winding');
}
console.log(`Mask: ${geometry.attributes.position.count} vertices; mirror error ${mirrorError.toExponential(3)}; all positions/normals finite.`);
