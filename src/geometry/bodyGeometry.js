import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createUpperBodyGeometry } from './upperBodyGeometry.js';
import { createHairLock } from './layeredHairGeometry.js';

// Approximate front-turnaround landmarks, keeping the existing head unchanged.
// Head crown 1.24 / chin -1.24; full-sheet crown≈51px, chin≈99px, waist≈199px.
export const BODY = {
  neckTop:-0.95, shoulderY:-2.4, holeY:-3.05, holeRadius:0.57,
  waistY:-6.4, wristY:-8.45, kneeY:-13.6, ankleY:-19.0, groundY:-20.3,
};
const G=(d,w)=>Math.exp(-Math.pow(d/w,2));
const lerp=THREE.MathUtils.lerp;
const vec=p=>new THREE.Vector3(...p);
const skin=new THREE.MeshStandardMaterial({color:0xe4e6ed,roughness:0.72,metalness:0,vertexColors:true});
const bone=new THREE.MeshStandardMaterial({color:0xe6e8ef,roughness:0.78});
const ink=new THREE.MeshStandardMaterial({color:0x080b13,roughness:0.87});
const cloth=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.96,metalness:0,vertexColors:true,side:THREE.DoubleSide});

function mesh(geometry,material,parent,name) {
  const m=new THREE.Mesh(geometry,material); m.name=name;
  m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function ellipsoid(parent,position,scale,material,name) {
  const g=new THREE.SphereGeometry(1,32,24);
  const p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++) colors.push(1,1,1);
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const m=mesh(g,material,parent,name); m.position.set(...position); m.scale.set(...scale); return m;
}
function profile(samples,y) {
  if(y>=samples[0][0]) return samples[0].slice(1);
  if(y<=samples.at(-1)[0]) return samples.at(-1).slice(1);
  let i=0; while(y<samples[i+1][0]) i++;
  const t=(y-samples[i][0])/(samples[i+1][0]-samples[i][0]);
  const k=t*t*(3-2*t);
  return samples[i].slice(1).map((v,j)=>lerp(v,samples[i+1][j+1],k));
}
function finalize(p,c,index) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  g.setIndex(index); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
function colorAt(mark,shade=1) {
  return mark?[0.012,0.018,0.030]:[shade,shade,Math.min(1,shade*1.025)];
}

/** Shared upper-body skin: neck, shoulder girdle, torso and arms. */
export function createTorsoGeometry() { return createUpperBodyGeometry(); }

/** Continuous tapered limb with changing muscle sections, not stacked spheres. */
function limb(points,radii,mark=false,flatten=0.86) {
  const curve=new THREE.CatmullRomCurve3(points.map(vec)); curve.curveType='centripetal';
  const rows=72,around=48,p=[],c=[],index=[];
  const frames=curve.computeFrenetFrames(rows,false);
  // Keep flattened palms shallow in depth while transporting the frame smoothly around bends.
  const depthAxis=new THREE.Vector3(0,0,1);
  const twist=Math.atan2(depthAxis.dot(frames.binormals[0]),depthAxis.dot(frames.normals[0]));
  const ct=Math.cos(twist),st=Math.sin(twist);
  for(let i=0;i<=rows;i++) {
    const t=i/rows,center=curve.getPoint(t),dir=curve.getTangent(t).normalize();
    const front=frames.normals[i].clone().multiplyScalar(ct).addScaledVector(frames.binormals[i],st);
    const across=frames.binormals[i].clone().multiplyScalar(ct).addScaledVector(frames.normals[i],-st);
    const q=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(q));
    const f=q-k,u=f*f*(3-2*f),r=lerp(radii[k],radii[k+1],u);
    for(let j=0;j<=around;j++) {
      const a=j/around*Math.PI*2,co=Math.cos(a),si=Math.sin(a);
      const muscle=1+0.055*Math.cos(3*a)*Math.sin(Math.PI*t);
      const v=center.clone().addScaledVector(across,co*r*muscle).addScaledVector(front,si*r*flatten*muscle);
      p.push(v.x,v.y,v.z);
      const stripe=mark && ((t<0.20 && Math.sin(a*2+t*8)>0.38)
        || (t>0.38 && t<0.98 && Math.sin(a*2+t*9)>0.62));
      c.push(...colorAt(false,0.96-0.07*Math.pow(Math.sin(a*2),8)));
    }
  }
  for(let i=0;i<rows;i++) for(let j=0;j<around;j++) {
    const a=i*(around+1)+j,b=a+around+1; index.push(a,b,a+1,a+1,b,b+1);
  }
  const rootIndex=p.length/3,root=curve.getPoint(0),tip=curve.getPoint(1);
  p.push(root.x,root.y,root.z,tip.x,tip.y,tip.z);c.push(1,1,1,1,1,1);
  const endRow=rows*(around+1);
  for(let j=0;j<around;j++) index.push(rootIndex,j,j+1,rootIndex+1,endRow+j+1,endRow+j);
  const g=finalize(p,c,index),uv=[];
  for(let i=0;i<=rows;i++) for(let j=0;j<=around;j++) uv.push(j/around,1-i/rows);
  uv.push(0.5,1,0.5,0);
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  return g;
}

function furRing(parent,center,rx,rz,scale,name) {
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:0.9,side:THREE.DoubleSide});
  const patches=[];
  const collar=name==='Neck ruff',rows=collar?3:2,count=collar?28:18;
  for(let row=0;row<rows;row++) for(let k=0;k<count;k++) {
    const a=k/count*Math.PI*2+row*0.11;
    const h=0.55+0.45*(0.5+0.5*Math.sin(k*7.13+row*2));
    const out=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
    const root=new THREE.Vector3(center[0]+rx*out.x,center[1]-row*scale*0.10,center[2]+rz*out.z);
    let mid,tip;
    if(collar){
      // Raised lateral fans frame the neck, while the front opens into a V.
      // Rear tufts stay beneath the hair rather than piercing through the mane.
      const lateral=Math.abs(out.x),front=Math.max(out.z,0),back=Math.max(-out.z,0);
      const reach=(0.52+0.50*h)*(1-0.42*back);
      const rise=0.32+0.40*lateral+0.18*h-0.15*front;
      mid=root.clone().addScaledVector(out,scale*reach*0.48).add(new THREE.Vector3(0,scale*rise*0.48,0));
      tip=root.clone().addScaledVector(out,scale*reach).add(new THREE.Vector3(0,scale*rise,0));
    }else{
      mid=root.clone().addScaledVector(out,scale*0.22).add(new THREE.Vector3(0,scale*0.22,0));
      tip=root.clone().addScaledVector(out,scale*(0.35+0.30*h)).add(new THREE.Vector3(0,scale*(0.5+0.5*h),0));
    }
    const g=createHairLock([root.toArray(),mid.toArray(),tip.toArray()],scale*(collar?0.13:0.17),scale*(collar?0.06:0.045),out.toArray(),0xe5e8ef,collar?14:9);
    patches.push(g);
  }
  mesh(mergeGeometries(patches,false),material,parent,name);
  patches.forEach(g=>g.dispose());
}

export const KATANA_GRIP={
  center:new THREE.Vector3(-3.63,-9.05,0.45),
  axis:new THREE.Vector3(-0.38,-0.925,0).normalize(),radius:0.13,
};
function gripPoint(along,radial,front) {
  const d=KATANA_GRIP.axis,r=new THREE.Vector3(-d.y,d.x,0);
  return KATANA_GRIP.center.clone().addScaledVector(d,along).addScaledVector(r,radial)
    .add(new THREE.Vector3(0,0,front));
}
function createGrippingHand(parent) {
  const hand=new THREE.Group(); hand.name='Hand -1';parent.add(hand);
  const angle=-Math.atan2(-KATANA_GRIP.axis.x,-KATANA_GRIP.axis.y);
  const palm=ellipsoid(hand,gripPoint(-0.04,-0.04,-0.30).toArray(),[0.32,0.51,0.20],skin,'Grip palm');
  palm.rotation.z=angle;
  const offsets=[-0.29,-0.07,0.15,0.35];
  for(let k=0;k<4;k++) {
    const along=offsets[k],r=[0.225,0.23,0.22,0.205][k];
    const angles=[3.5,2.8,2.0,1.2,0.45,-0.10+k*0.06];
    const points=angles.map(a=>gripPoint(along,r*Math.cos(a),r*Math.sin(a)).toArray());
    const finger=mesh(limb(points,[0.105,0.105,0.10,0.09,0.078,0.063]),skin,hand,`Finger ${k}`);
    finger.userData.gripFinger=true;
    const end=angles.at(-1);
    const nail=ellipsoid(hand,gripPoint(along,(r+0.055)*Math.cos(end),(r+0.055)*Math.sin(end)).toArray(),
      [0.018,0.065,0.047],bone,`Grip nail ${k}`);
    nail.rotation.z=angle;
  }
  mesh(limb([gripPoint(-0.39,0.16,-0.18).toArray(),gripPoint(-0.23,0.30,0.01).toArray(),
    gripPoint(-0.13,0.19,0.19).toArray(),gripPoint(-0.03,-0.07,0.25).toArray()],
    [0.145,0.13,0.10,0.065]),skin,hand,'Opposing thumb');
  const pad=ellipsoid(hand,gripPoint(-0.23,0.12,-0.12).toArray(),[0.18,0.28,0.14],skin,'Thenar pad');
  pad.rotation.z=angle;
  const socket=new THREE.Group();socket.name='Katana socket';hand.add(socket);
  hand.userData.gripSocket=socket;
  return hand;
}
function createHand(parent,side) {
  if(side===-1) return createGrippingHand(parent);
  const hand=new THREE.Group();hand.name=`Hand ${side}`;parent.add(hand);
  const x=3.43;
  mesh(limb([[x,-8.47,0.12],[x,-8.78,0.13],[x,-9.06,0.14],[x,-9.30,0.14]],
    [0.22,0.31,0.34,0.30],false,0.55),skin,hand,'Tapered palm');
  for(let k=0;k<4;k++) {
    const fx=x-0.27+k*0.18,length=[0.90,1.04,0.98,0.78][k];
    mesh(limb([[fx,-9.18,0.15],[fx+0.02,-9.49,0.17],
      [fx+0.02,-9.72,0.25],[fx-0.025,-9.18-length,0.31]],
      [0.10,0.105,0.083,0.052]),skin,hand,`Finger ${k}`);
    ellipsoid(hand,[fx-0.015,-9.12-length,0.36],[0.042,0.085,0.015],bone,`Nail ${k}`);
  }
  mesh(limb([[x-0.24,-8.79,0.14],[x-0.48,-9.02,0.21],
    [x-0.50,-9.28,0.31],[x-0.38,-9.43,0.36]],[0.14,0.13,0.10,0.055]),skin,hand,'Thumb');
  return hand;
}

function createFoot(parent,side) {
  const fx=side*1.49;
  // Longitudinal sections form heel, instep, arch and forefoot in one surface.
  const sections=[[-0.48,0.21,-19.96,0.27],[-0.22,0.33,-19.88,0.36],
    [0.12,0.36,-19.84,0.40],[0.56,0.39,-19.99,0.27],
    [0.94,0.43,-20.08,0.19],[1.16,0.38,-20.11,0.14]];
  const p=[],c=[],idx=[],rows=40,around=40;
  for(let i=0;i<=rows;i++) {
    const q=i/rows*(sections.length-1),k=Math.min(sections.length-2,Math.floor(q));
    const t=q-k,u=t*t*(3-2*t);
    const [z,rx,cy,ry]=sections[k].map((v,j)=>lerp(v,sections[k+1][j],u));
    for(let j=0;j<=around;j++) {
      const a=j/around*Math.PI*2;
      p.push(fx+rx*Math.cos(a),cy+ry*Math.sin(a),z);
      c.push(...colorAt(false,0.97));
    }
  }
  for(let i=0;i<rows;i++) for(let j=0;j<around;j++) {
    const a=i*(around+1)+j,b=a+around+1;idx.push(a,a+1,b,a+1,b+1,b);
  }
  const capIndex=p.length/3;
  p.push(fx,sections[0][2],sections[0][0],fx,sections.at(-1)[2],sections.at(-1)[0]);
  c.push(1,1,1,1,1,1);
  for(let j=0;j<around;j++) idx.push(capIndex,j+1,j,capIndex+1,rows*(around+1)+j,rows*(around+1)+j+1);
  mesh(finalize(p,c,idx),skin,parent,`Foot ${side}`);
  for(let k=0;k<5;k++) {
    const x=fx+side*(-0.29+k*0.148),r=0.14-k*0.013;
    const tip=1.53-k*0.075;
    mesh(limb([[x,-20.10,1.0-k*0.025],[x,-20.12,1.24-k*0.045],
      [x,-20.13,tip]],[r,r*0.9,r*0.64]),skin,parent,`Toe ${side}/${k}`);
    ellipsoid(parent,[x,-20.025,tip-0.055],[r*0.56,0.018,0.075],bone,`Toenail ${side}/${k}`);
    mesh(limb([[fx+(x-fx)*0.25,-19.52,0.22],[fx+(x-fx)*0.65,-19.75,0.55],
      [x,-19.94,0.93]],[0.018,0.026,0.018]),skin,parent,`Foot tendon ${side}/${k}`);
  }
}

function makeCloth(group) {
  const palette=[0x919aae,0xb4bdce,0x788399,0xa5afc2];
  // Individual curved panels preserve open tears and a split lower silhouette.
  for(let layer=0;layer<2;layer++) for(let k=0;k<18;k++) {
    const angle=k/18*Math.PI*2+layer*0.13;
    const phase=k*4.72+layer*2.1;
    const end=-15.6-2.9*(0.5+0.5*Math.sin(phase));
    const rows=25,cols=8,p=[],c=[],idx=[];
    const tint=new THREE.Color(palette[(k+layer)%palette.length]);
    for(let i=0;i<=rows;i++) for(let j=0;j<=cols;j++) {
      const t=i/rows,u=j/cols*2-1;
      const cut=0.40*G(t-(0.40+0.08*Math.sin(phase)),0.025)+0.35*G(t-0.74,0.035);
      const half=0.29*(1-0.38*t)*(1+0.12*Math.sin(t*8+phase))*(1-cut);
      const a=angle+u*half;
      const radius=1.53+2.30*Math.pow(t,0.95)+layer*0.10;
      let y=lerp(-6.65,end,t);
      // Ragged edges and a deep alternating V at the hem of each panel.
      y+=Math.pow(t,9)*(1.35*Math.abs(u)+0.30*Math.sin(j*2.5+phase));
      const fold=0.08*Math.cos(u*Math.PI*2+0.4*Math.sin(t*8+phase));
      const x=Math.sin(a)*(radius+fold)+0.13*Math.sin(t*5+phase)*t;
      const z=Math.cos(a)*(0.88+1.05*t+fold)-0.38*t*t+layer*0.07*Math.cos(a);
      p.push(x,y,z);
      const f=0.75+0.27*Math.pow(Math.cos(u*Math.PI),2)+0.10*Math.sin(t*12+phase);
      c.push(tint.r*f,tint.g*f,tint.b*f);
    }
    for(let i=0;i<rows;i++) for(let j=0;j<cols;j++) {
      const a=i*(cols+1)+j,b=a+cols+1;
      if(i>rows*0.7 && ((k+j)%7===0) && j===0) continue;
      idx.push(a,b,a+1,a+1,b,b+1);
    }
    mesh(finalize(p,c,idx),cloth,group,`Torn cloth panel ${layer}/${k}`);
  }
  // Waist wrappings are overlapping folds rather than a smooth belt cylinder.
  const sashMaterial=new THREE.MeshStandardMaterial({color:0x8a92a5,roughness:0.95});
  for(let k=0;k<5;k++) {
    const curve=[];
    for(let i=0;i<=80;i++) {
      const a=i/80*Math.PI*2;
      curve.push(new THREE.Vector3(1.56*Math.cos(a),-6.4+(k-2)*0.13+0.11*Math.sin(a*2+k*0.5),0.82*Math.sin(a)));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve),100,0.105,7,false),sashMaterial,group,`Sash fold ${k}`);
  }
  ellipsoid(group,[0,-6.42,0.82],[0.35,0.40,0.24],sashMaterial,'Waist knot');
  for(const side of [-1,1]) {
    const g=createHairLock([[side*0.08,-6.45,0.83],[side*0.38,-7.12,0.92],
      [side*0.45,-8.12,0.86],[side*0.63,-9.25,0.74]],0.25,0.055,[0,0,1],0x8c94a6,24);
    mesh(g,cloth,group,`Sash tail ${side}`);
  }
}

function createSword(parent) {
  const g=new THREE.Group();g.name='Black katana';parent.add(g);
  const direction=KATANA_GRIP.axis,start=gripPoint(0.64,0,0),pommel=gripPoint(-0.78,0,0);
  const shape=new THREE.Shape();
  shape.moveTo(0,0);shape.lineTo(0.16,-0.25);shape.quadraticCurveTo(0.18,-8.8,-0.24,-11.25);
  shape.quadraticCurveTo(-0.05,-9.8,-0.10,-0.2);shape.closePath();
  const blade=new THREE.ExtrudeGeometry(shape,{depth:0.035,bevelEnabled:true,bevelThickness:0.015,bevelSize:0.015,bevelSegments:1,steps:1});
  const m=mesh(blade,ink,g,'Curved blade');
  m.rotation.z=-Math.atan2(-direction.x,-direction.y);m.position.copy(start);
  const grip=mesh(limb([pommel.toArray(),start.toArray()],[KATANA_GRIP.radius,KATANA_GRIP.radius]),ink,g,'Katana grip');
  grip.userData.rawAxis=direction.toArray();
  const guard=mesh(new THREE.BoxGeometry(0.76,0.10,0.49),ink,g,'Katana guard');
  guard.position.copy(start);guard.rotation.z=m.rotation.z;
  // A subtle steel edge lets the black blade read against the dark studio.
  const edge=new THREE.MeshStandardMaterial({color:0x5a6271,roughness:0.45,metalness:0.35});
  const path=new THREE.CatmullRomCurve3([[0.15,-0.20,0.045],[0.12,-4.0,0.045],[0.04,-8.8,0.045],[-0.24,-11.25,0.045]].map(vec));
  const line=mesh(new THREE.TubeGeometry(path,48,0.012,5,false),edge,g,'Blade edge');
  line.position.copy(start);line.rotation.z=m.rotation.z;
  return g;
}

/** Add mass in model space so skin, cuffs, sash and hand-held weapon stay aligned.
 * The neck fades back to its original head attachment; no height is changed.
 * Keep the chest opening circular while expanding the pectorals around it.
 */
function broadenBody(group) {
  const build=[[-1.0,0,0],[-2.4,-0.02,0.45],[-4.4,0.07,0.45],
    [-6.4,0.14,0.30],[-9.0,0.14,0.25],[-20.4,0.12,0.25]];
  group.updateMatrixWorld(true);
  const before=new THREE.Box3().setFromObject(group.userData.layers.anatomy);
  const point=new THREE.Vector3();
  group.traverse(m=>{
    if(!m.isMesh) return;
    const inverse=m.matrixWorld.clone().invert();
    const p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
      point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);
      const [width,depth]=profile(build,point.y);
      const distance=Math.hypot(point.x,point.y-BODY.holeY);
      const outside=THREE.MathUtils.smoothstep(distance,0.70,1.20);
      point.x*=1+width*outside;
      point.z*=1+depth;
      // Lower the outer acromion gently, keeping the sternum and neck attachment fixed.
      point.y-=0.18*THREE.MathUtils.smoothstep(Math.abs(point.x),0.70,2.45)
        *G(point.y+2.25,0.80)*outside;
      point.applyMatrix4(inverse);
      p.setXYZ(i,point.x,point.y,point.z);
    }
    p.needsUpdate=true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  });
  const after=new THREE.Box3().setFromObject(group.userData.layers.anatomy);
  group.userData.buildMeasurements={before:before.getSize(new THREE.Vector3()).toArray(),
    after:after.getSize(new THREE.Vector3()).toArray()};
}

export function createBodyGroup() {
  const group=new THREE.Group(); group.name='Vasto Lorde body';
  const anatomy=new THREE.Group(),clothing=new THREE.Group(),fur=new THREE.Group();
  anatomy.name='Anatomy'; clothing.name='Torn hakama and sash'; fur.name='White fur cuffs';
  group.add(anatomy,clothing,fur);
  const torsoSkin=skin.clone();
  mesh(createTorsoGeometry(),torsoSkin,anatomy,'Sculpted symmetric torso');

  const rim=mesh(new THREE.TorusGeometry(BODY.holeRadius,0.042,12,80),bone,anatomy,'Chest aperture rim');
  rim.position.set(0,BODY.holeY,0.858);
  const tunnel=mesh(new THREE.CylinderGeometry(BODY.holeRadius-0.025,BODY.holeRadius-0.025,1.65,64,1,true),
    new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}),anatomy,'Chest aperture inner wall');
  tunnel.rotation.x=Math.PI/2; tunnel.position.set(0,BODY.holeY,0.05);
  const voidFace=mesh(new THREE.CircleGeometry(BODY.holeRadius+0.10,64),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}),anatomy,'Chest void');
  voidFace.position.set(0,BODY.holeY,-0.72);
  for(const side of [-1,1]) {
    createHand(anatomy,side);
    const leg=mesh(limb([[side*0.84,-6.95,0],[side*1.05,-9.3,0],[side*1.25,-12.2,0],
      [side*1.31,-13.7,0],[side*1.40,-15.1,0],[side*1.47,-17.2,0],[side*1.49,-19.28,0]],
      [0.88,0.93,0.70,0.52,0.65,0.49,0.34]),skin,anatomy,`Leg ${side}`);
    // Hakama legs under the torn outer panels create a dark solid inner volume.
    const pants=new THREE.MeshStandardMaterial({color:0x515b70,roughness:1});
    const trouser=mesh(limb([[side*0.85,-7.0,0],[side*1.02,-9.8,0],[side*1.25,-12.5,0],
      [side*1.37,-15.0,0],[side*1.46,-17.9,0]],[0.95,1.02,0.81,0.68,0.42]),pants,clothing,`Inner hakama leg ${side}`);
    const fx=side*1.49;
    ellipsoid(anatomy,[fx,-19.43,0.02],[0.35,0.52,0.38],skin,`Ankle ${side}`);
    createFoot(anatomy,side);
    furRing(fur,[side*3.42,-8.50,0.12],0.24,0.22,0.78,`Wrist fur ${side}`);
    furRing(fur,[side*1.49,-19.10,0],0.35,0.33,0.95,`Ankle fur ${side}`);
  }
  furRing(fur,[0,-2.30,0.04],0.74,0.52,1.08,'Neck ruff');
  makeCloth(clothing);
  const weapon=createSword(anatomy.getObjectByName('Hand -1').userData.gripSocket);
  group.userData.layers={anatomy,clothing,fur,weapon};
  broadenBody(group);
  return group;
}
