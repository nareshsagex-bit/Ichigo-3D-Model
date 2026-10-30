import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBodyGroup,createTorsoGeometry,BODY,KATANA_GRIP} from '../src/geometry/bodyGeometry.js';
import {measureSymmetry} from '../src/geometry/faceLandmarks.js';

const body=createBodyGroup();body.updateMatrixWorld(true);
let count=0,vertices=0;
body.traverse(m=>{
  if(!m.isMesh) return;
  count++; const g=m.geometry; vertices+=g.attributes.position.count;
  for(const attr of ['position','normal']) for(const v of g.attributes[attr].array)
    assert.ok(Number.isFinite(v),`${m.name} contains non-finite ${attr}`);
});
const torso=createTorsoGeometry();
assert.ok(measureSymmetry(torso)<1e-5,'Torso must be bilaterally symmetric');
const trunk=body.getObjectByName('Sculpted symmetric torso');
assert.ok(measureSymmetry(trunk.geometry)<1e-5,'Adjusted shoulder surface must remain symmetric');
const shoulderPositions=trunk.geometry.attributes.position;
let shoulderHalfWidth=0;
for(let i=0;i<shoulderPositions.count;i++) {
  const y=shoulderPositions.getY(i);
  if(y>-3.3 && y<-2.1) shoulderHalfWidth=Math.max(shoulderHalfWidth,Math.abs(shoulderPositions.getX(i)));
}
assert.ok(shoulderHalfWidth*2<6.4,'Shoulder envelope must stay narrowed to the revised proportions');

const ray=new THREE.Raycaster(new THREE.Vector3(0,BODY.holeY,4),new THREE.Vector3(0,0,-1));
const first=ray.intersectObject(body,true)[0];
assert.ok(first,'Chest ray should hit the recessed cavity');
assert.equal(first.object.name,'Chest void','Chest center must be open through the front skin');
ray.set(new THREE.Vector3(0.85,BODY.holeY,4),new THREE.Vector3(0,0,-1));
assert.ok(ray.intersectObject(trunk)[0].point.z>0.7,'Chest skin must remain outside opening');
const bounds=new THREE.Box3().setFromObject(body.userData.layers.anatomy);
assert.ok(bounds.min.y>-20.4 && bounds.min.y<-20.2,'Feet must meet floor');
assert.ok(trunk.geometry.userData.continuousUpperBody,'Neck, shoulders and arms must share one surface');
// Weld by position only: UV seams must not split the anatomical surface.
const tp=trunk.geometry.attributes.position,ti=trunk.geometry.index;
const roots=new Map(),parent=[];
const ids=Array.from({length:tp.count},(_,i)=>{
  const key=[tp.getX(i),tp.getY(i),tp.getZ(i)].map(v=>Math.round(v*1e4)).join(',');
  if(!roots.has(key)){roots.set(key,parent.length);parent.push(parent.length);}
  return roots.get(key);
});
const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
for(let i=0;i<ti.count;i+=3) for(let k=1;k<3;k++) parent[find(ids[ti.getX(i+k)])]=find(ids[ti.getX(i)]);
assert.equal(new Set(parent.map((_,i)=>find(i))).size,1,'Upper body must be one connected skin surface');

for(const side of [-1,1]) {
  const hand=body.getObjectByName(`Hand ${side}`);
  assert.ok(hand,`Missing hand ${side}`);
  const hb=new THREE.Box3().setFromObject(hand);
  assert.ok(hb.intersectsBox(new THREE.Box3().setFromObject(trunk)),'Wrist must overlap hand');
}
const sword=body.getObjectByName('Black katana');
assert.equal(sword.parent,body.getObjectByName('Hand -1').userData.gripSocket,'Sword must be attached to the gripping hand');
let fingers=0;
body.getObjectByName('Hand -1').traverse(m=>{if(m.userData.gripFinger) fingers++;});
assert.equal(fingers,4,'Four fingers must curl around the handle');
for(const along of [-0.29,-0.07,0.15,0.35]) {
  const point=KATANA_GRIP.center.clone().addScaledVector(KATANA_GRIP.axis,along);
  point.x*=1.14;
  ray.set(new THREE.Vector3(point.x,point.y,3),new THREE.Vector3(0,0,-1));
  const hits=ray.intersectObject(body.getObjectByName('Hand -1'),true);
  assert.ok(hits.some(h=>h.object.userData.gripFinger),'Finger must cover the handle at each grip station');
  assert.ok(hits.some(h=>h.object.name==='Katana grip'),'Handle must pass through every curled finger station');
  assert.ok(hits[0].object.userData.gripFinger || hits[0].object.name==='Opposing thumb','Fingers must sit in front of the handle');
}

// Weld coordinates conceptually to check that fingers/toes have closed tips.
for(const object of [body.getObjectByName('Toe 1/0'),body.getObjectByName('Hand 1').getObjectByName('Finger 0')]) {
  const g=object.geometry,p=g.attributes.position,edges=new Map();
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
  for(let i=0;i<g.index.count;i+=3) {
    const tri=[0,1,2].map(j=>key(g.index.getX(i+j)));
    for(let j=0;j<3;j++) {
      const e=[tri[j],tri[(j+1)%3]].sort().join('|');
      edges.set(e,(edges.get(e)||0)+1);
    }
  }
  assert.ok([...edges.values()].every(n=>n===2),`${object.name} has an open tip or seam`);
}
console.log(`${count} body meshes / ${vertices} vertices: finite geometry, symmetric trunk, carved chest aperture, attached hands, and floor contact passed.`);
