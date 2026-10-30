import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBodyGroup} from '../src/geometry/bodyGeometry.js';
import {createHandPose,solveArm} from '../src/geometry/handPose.js';

const body=createBodyGroup();body.updateMatrixWorld(true);
const skin=body.getObjectByName('Sculpted symmetric torso').geometry;
const rest=skin.attributes.position.array.slice();
const left=body.getObjectByName('Hand -1'),right=body.getObjectByName('Hand 1');
const sword=body.getObjectByName('Black katana');
const rightBind=right.matrixWorld.clone(),swordBind=sword.matrixWorld.clone();
const pose=createHandPose(body),wrist=pose.target(-1);
const target=wrist.clone().add(new THREE.Vector3(-1,2.2,1.1));
const reached=pose.setTarget(-1,target);
assert.ok(reached.distanceTo(target)<1e-5,'Reachable drag should follow the cursor target');
assert.ok(left.localToWorld(wrist.clone()).distanceTo(reached)<1e-5,'Hand wrist must follow the solved arm');
assert.deepEqual(right.matrixWorld.elements,rightBind.elements,'Other hand must remain independent');
assert.notDeepEqual(sword.matrixWorld.elements,swordBind.elements,'Katana must follow the gripping hand');
assert.equal(sword.parent.parent,left,'Katana must remain inside the hand hierarchy');
for(let i=0;i<rest.length/3;i++) if(rest[i*3+1]>-2.2)
  assert.deepEqual(Array.from(skin.attributes.position.array.slice(i*3,i*3+3)),Array.from(rest.slice(i*3,i*3+3)),'Neck and upper girdle must stay pinned');
const shoulder=new THREE.Vector3(-2.25,-2.75,0),elbow=new THREE.Vector3(-3.30,-5.35,0.04);
for(const t of [target,new THREE.Vector3(-50,50,50),shoulder]) {
  const s=solveArm(shoulder,elbow,wrist,t);
  assert.ok(Math.abs(s.elbow.distanceTo(shoulder)-elbow.distanceTo(shoulder))<1e-6);
  assert.ok(Math.abs(s.wrist.distanceTo(s.elbow)-wrist.distanceTo(elbow))<1e-6);
  pose.setTarget(-1,t);
  for(const attr of ['position','normal']) for(const x of skin.attributes[attr].array) assert.ok(Number.isFinite(x));
}
pose.setTarget(1,pose.target(1).add(new THREE.Vector3(-1.2,1.5,0.5)));
pose.reset();
assert.deepEqual(skin.attributes.position.array,rest,'Reset must exactly restore the bind geometry');
assert.deepEqual(left.matrixWorld.elements,new THREE.Matrix4().elements);
assert.deepEqual(right.matrixWorld.elements,rightBind.elements);
assert.deepEqual(sword.matrixWorld.elements,swordBind.elements);
assert.deepEqual(createBodyGroup().getObjectByName('Sculpted symmetric torso').geometry.attributes.position.array,rest,'A fresh page model must start in the original pose');
console.log('Hand posing: reachable and clamped IK, fixed bone lengths, independent hands, pinned shoulders, attached sword, finite skin, exact reset and fresh-model rest pose passed.');
