import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBodyGroup} from '../src/geometry/bodyGeometry.js';
import {attachClothMotion,sampleClothMotion} from '../src/geometry/clothMotion.js';

const body=createBodyGroup(),cloth=body.userData.layers.clothing;
const panel=cloth.getObjectByName('Torn cloth panel 0/0');
const sash=cloth.getObjectByName('Sash fold 0'),sashMaterial=sash.material;
const motion=attachClothMotion(cloth);
assert.equal(sash.material,sashMaterial,'Waistband material must remain static');
assert.equal(sash.customDepthMaterial,undefined,'Waistband must not bend');
assert.ok(panel.customDepthMaterial,'Skirt shadows must bend with the fabric');
for(const time of [0,1,10,100]) {
  const waist=[1,-6.65,0.8];
  assert.deepEqual(sampleClothMotion(waist,time,2),waist,'Waistband must remain anchored');
  const tip=[2,-18,1];
  assert.deepEqual(sampleClothMotion(tip,time,0),tip,'Zero wind must restore the rest pose');
  for(const v of sampleClothMotion(tip,time,2)) assert.ok(Number.isFinite(v));
}
const tip=[2,-18,1],a=sampleClothMotion(tip,0),b=sampleClothMotion(tip,1);
assert.ok(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))>0.1,'Hem must visibly sway');
const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>'};
panel.material.onBeforeCompile(shader);
motion.update(0.016);
const phase=shader.uniforms.uClothTime.value;
motion.update(1,{enabled:false});
assert.equal(shader.uniforms.uClothTime.value,phase,'Pause must freeze the fabric');
motion.update(0.016,{speed:2});
assert.ok(shader.uniforms.uClothTime.value>phase);
assert.ok(shader.vertexShader.includes('objectNormal=clothBendNormal'),'Lighting normals must follow the cloth');
for(const material of [panel.customDepthMaterial,panel.customDistanceMaterial]) {
  const shadow={uniforms:{},vertexShader:'#include <begin_vertex>'};
  material.onBeforeCompile(shadow);
  assert.equal(shadow.uniforms.uClothTime,shader.uniforms.uClothTime);
  assert.ok(shadow.vertexShader.includes('transformed=clothBend'));
}
motion.reset();
assert.equal(shader.uniforms.uClothStrength.value,0);
assert.equal(shader.uniforms.uClothTime.value,0);
console.log('Cloth: anchored waist, moving hem, finite deformation, static sash, pause/resume, rest pose, normals and shadows passed.');
