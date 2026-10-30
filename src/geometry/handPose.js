import * as THREE from 'three';

const smooth=THREE.MathUtils.smoothstep;
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

/** Two-bone reach with a stable bend plane; unreachable targets stop at arm length. */
export function solveArm(shoulder,elbow,wrist,target) {
  const upper=shoulder.distanceTo(elbow),lower=elbow.distanceTo(wrist);
  const axis=target.clone().sub(shoulder);
  const distance=THREE.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+0.08,upper+lower-0.0001);
  if(axis.lengthSq()<1e-8) axis.copy(wrist).sub(shoulder);
  axis.normalize();
  const restAxis=wrist.clone().sub(shoulder).normalize();
  const pole=elbow.clone().sub(shoulder).addScaledVector(restAxis,-elbow.clone().sub(shoulder).dot(restAxis));
  pole.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restAxis,axis));
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(upper*upper-along*along,0));
  const e=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,height);
  const w=shoulder.clone().addScaledVector(axis,distance);
  return {elbow:e,wrist:w,
    upperRotation:new THREE.Quaternion().setFromUnitVectors(elbow.clone().sub(shoulder).normalize(),e.clone().sub(shoulder).normalize()),
    lowerRotation:new THREE.Quaternion().setFromUnitVectors(wrist.clone().sub(elbow).normalize(),w.clone().sub(e).normalize())};
}

/** Pose the continuous arm skin and its hand/cuff attachments without persisting state. */
export function createHandPose(body) {
  const skin=body.getObjectByName('Sculpted symmetric torso'),g=skin.geometry;
  const rest=g.attributes.position.array.slice(),arms=new Map();
  for(const side of [-1,1]) {
    const shoulder=v(side*2.25,-2.75,0),elbow=v(side*3.30,-5.35,0.04),wrist=v(side*3.91,-8.50,0.15);
    const hand=body.getObjectByName(`Hand ${side}`),cuff=body.getObjectByName(`Wrist fur ${side}`);
    const affected=[];
    for(let i=0;i<rest.length/3;i++) {
      const x=rest[i*3],y=rest[i*3+1];
      if(Math.sign(x)!==side || y>-2.2) continue;
      // Inner torso stays pinned; the deltoid blends gradually into the shoulder girdle.
      const edge=THREE.MathUtils.lerp(1.65,1.85,smooth(-y,3.2,4.5));
      const weight=smooth(Math.abs(x),edge,edge+0.55)*smooth(-y,2.2,3.15);
      if(weight>0) affected.push({i,weight,forearm:smooth(-y,4.98,5.75)});
    }
    arms.set(side,{shoulder,elbow,wrist,hand,cuff,affected,restHand:hand.matrix.clone(),restCuff:cuff.matrix.clone(),target:wrist.clone()});
  }
  const p=v(0,0,0),a=v(0,0,0),b=v(0,0,0),matrix=new THREE.Matrix4();
  const translate=new THREE.Matrix4();
  function setTarget(side,target) {
    const arm=arms.get(side),solution=solveArm(arm.shoulder,arm.elbow,arm.wrist,target);
    arm.target.copy(solution.wrist);
    for(const {i,weight,forearm} of arm.affected) {
      p.fromArray(rest,i*3);
      a.copy(p).sub(arm.shoulder).applyQuaternion(solution.upperRotation).add(arm.shoulder);
      b.copy(p).sub(arm.elbow).applyQuaternion(solution.lowerRotation).add(solution.elbow);
      a.lerp(b,forearm).lerp(p,1-weight);
      g.attributes.position.setXYZ(i,a.x,a.y,a.z);
    }
    matrix.makeRotationFromQuaternion(solution.lowerRotation);
    matrix.setPosition(solution.wrist);
    translate.makeTranslation(-arm.wrist.x,-arm.wrist.y,-arm.wrist.z);
    matrix.multiply(translate);
    // Geometry uses model-space bind coordinates; rotate around the wrist bind point.
    for(const [object,bind] of [[arm.hand,arm.restHand],[arm.cuff,arm.restCuff]]) {
      const m=matrix.clone().multiply(bind);
      m.decompose(object.position,object.quaternion,object.scale);
      object.updateMatrix();
    }
    g.attributes.position.needsUpdate=true;
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    body.updateMatrixWorld(true);
    return arm.target.clone();
  }
  return {
    sides:[-1,1],
    target:side=>arms.get(side).target.clone(),
    setTarget,
    reset() {
      g.attributes.position.array.set(rest);g.attributes.position.needsUpdate=true;
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
      for(const arm of arms.values()) {
        arm.target.copy(arm.wrist);
        arm.restHand.decompose(arm.hand.position,arm.hand.quaternion,arm.hand.scale);
        arm.restCuff.decompose(arm.cuff.position,arm.cuff.quaternion,arm.cuff.scale);
      }
      body.updateMatrixWorld(true);
    },
  };
}
