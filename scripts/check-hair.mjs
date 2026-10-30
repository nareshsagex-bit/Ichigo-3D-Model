import assert from 'node:assert/strict';
import { createHairGroup, createHairLock } from '../src/geometry/layeredHairGeometry.js';

const group=createHairGroup();
let vertices=0,triangles=0;
for(const mesh of group.children) {
  const g=mesh.geometry;
  vertices+=g.attributes.position.count;
  triangles+=g.index.count/3;
  for(const attr of ['position','normal']) for(const v of g.attributes[attr].array)
    assert.ok(Number.isFinite(v),`${mesh.name}: non-finite ${attr}`);
  assert.ok(mesh.material.metalness===0,'Hair must not use metallic shading');
}
const crown=group.children.filter(m=>m.name.startsWith('Long crown lock'));
assert.equal(crown.length,31,'All crown spikes should be replaced with flowing locks');
for(const m of crown){
  m.geometry.computeBoundingBox();
  assert.ok(m.geometry.boundingBox.min.y<-5.5,'Crown strands must reach the long mane');
  assert.ok(m.geometry.boundingBox.max.y<1.5,'Crown must not have upright spikes');
}
// A straight clump makes outward winding and terminal taper measurable.
const g=createHairLock([[0,1,0],[0,0,0],[0,-1,0]],0.2,0.05,[0,0,1],0xe47727);
const p=g.attributes.position,n=g.attributes.normal;
let outward=0;
for(let j=0;j<10;j++) {
  const i=14*11+j;
  outward+=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);
}
assert.ok(outward>0,'Hair surface winding points inward');
const terminal=28*11;
assert.ok(Math.hypot(p.getX(terminal),p.getZ(terminal))<0.002,'Lock has a blunt terminal');
const second=createHairGroup();
assert.equal(group.children.length,second.children.length);
for(let i=0;i<group.children.length;i++)
  assert.deepEqual(group.children[i].geometry.attributes.position.array,second.children[i].geometry.attributes.position.array,'Hair must be deterministic on reload');
console.log(`${group.children.length} hair meshes, ${vertices} vertices, ${triangles} triangles: finite geometry, outward winding, sharp taper, nonmetallic materials and deterministic generation passed.`);
