import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHairGroup } from '../src/geometry/hairGeometry.js';
import { attachHairMotion, sampleHairMotion } from '../src/geometry/hairMotion.js';

const group=createHairGroup();
const box=new THREE.Box3().setFromObject(group);
assert.ok(box.min.y < -7.3 && box.min.y > -8.1,'Longest tips should reach a little below the waist');
for(const time of [0,1,10,100]) {
  const root=[0.6,0.7,-0.4];
  assert.deepEqual(sampleHairMotion(root,time),root,'Scalp roots must remain attached');
  const tip=[1,-6.5,-2];
  assert.deepEqual(sampleHairMotion(tip,time,0),tip,'Zero strength should restore rest pose');
  assert.deepEqual(sampleHairMotion(tip,time,1,false),tip);
  for(const v of sampleHairMotion(tip,time,2)) assert.ok(Number.isFinite(v));
}
const a=sampleHairMotion([1,-6.5,-2],0),b=sampleHairMotion([1,-6.5,-2],1);
assert.ok(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))>0.03,'Tips must visibly move over time');
const motion=attachHairMotion(group);
const mesh=group.children.find(m=>m.name.startsWith('Long flowing'));
const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>'};
mesh.material.onBeforeCompile(shader);
motion.update(0.016,{enabled:true});
const phase=shader.uniforms.uHairTime.value;
motion.update(1,{enabled:false});
assert.equal(shader.uniforms.uHairTime.value,phase,'Pause must freeze the current pose');
motion.update(0.016,{enabled:true,speed:2});
assert.ok(shader.uniforms.uHairTime.value>phase,'Resume must advance the pose');
const depth={uniforms:{},vertexShader:'#include <begin_vertex>'};
mesh.customDepthMaterial.onBeforeCompile(depth);
assert.equal(depth.uniforms.uHairTime,shader.uniforms.uHairTime,'Shadow and visible motion must share time');
assert.ok(shader.vertexShader.includes('objectNormal=hairBendNormal'),'Normals must deform with the hair');
console.log(`Waist-length minY=${box.min.y.toFixed(2)}. Root anchoring, moving tips, rest pose, pause/resume, finite motion and matching shadow uniforms passed.`);
