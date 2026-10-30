import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const G=(d,w)=>Math.exp(-((d/w)**2));
const mix=THREE.MathUtils.lerp;
const torso=[[-1.72,0.48,0.43],[-2.02,1.13,0.63],[-2.4,1.82,0.76],[-2.9,2.05,0.80],
  [-3.4,1.95,0.77],[-4.0,1.72,0.68],[-4.7,1.48,0.60],[-5.5,1.34,0.55],[-6.35,1.43,0.57],[-6.9,1.58,0.62]];
const neck=[[-0.94,0,0.34,0.32,-0.07],[-1.2,0,0.38,0.36,-0.07],
  [-1.6,0,0.45,0.41,-0.06],[-2.1,0,0.65,0.50,-0.03],[-2.35,0,0.82,0.56,0]];
// Fuller deltoid and upper-arm sections grow inward and in depth, preserving
// the revised outer shoulder span instead of pushing the shoulder joints apart.
const arm=[[-1.98,2.00,0.16,0.22,0],[-2.22,2.10,0.61,0.70,0],
  [-2.63,2.20,0.79,0.84,0],[-3.15,2.37,0.72,0.75,0.01],
  [-3.9,2.63,0.55,0.53,0.02],[-4.55,2.83,0.48,0.45,0.02],
  [-5.30,2.97,0.32,0.31,0.02],[-6.22,3.15,0.46,0.40,0.10],
  [-7.38,3.35,0.34,0.29,0.12],[-8.60,3.43,0.23,0.21,0.12]];
function at(samples,y) {
  let i=0;
  while(i<samples.length-2 && y<samples[i+1][0]) i++;
  let t=THREE.MathUtils.clamp((y-samples[i][0])/(samples[i+1][0]-samples[i][0]),0,1);
  t=t*t*(3-2*t);
  return samples[i].slice(1).map((v,j)=>mix(v,samples[i+1][j+1],t));
}
function smoothUnion(a,b,k) {
  const h=Math.max(k-Math.abs(a-b),0)/k;
  return Math.min(a,b)-h*h*k*0.25;
}
function relief(x,y,front) {
  const ax=Math.abs(x); let d=0;
  if(front) {
    d+=0.27*G(ax-1.02,0.78)*G(y+3.04,0.46);
    d-=0.055*G(y+3.56,0.045)*G(ax-0.98,0.8);
    for(let row=0;row<4;row++) d+=0.23*G(ax-(0.44-row*0.035),0.37-row*0.018)*G(y+3.91+row*0.64,0.275);
    d-=0.035*G(x,0.035)*G(y+4.65,1.45);
    for(let k=0;k<4;k++) d+=0.065*G(y+3.72+k*0.40-0.64*(ax-1),0.09)*G(ax-1.23,0.38);
  } else {
    d+=0.14*G(ax-0.97,0.6)*G(y+3.05,0.7);
    d+=0.09*G(ax-0.68,0.5)*G(y+4.6,1.2)-0.035*G(ax,0.045);
  }
  return d;
}
function ellipseField(x,z,cx,cz,rx,rz) {
  return (Math.hypot((x-cx)/rx,(z-cz)/rz)-1)*Math.min(rx,rz);
}

/** Closed, continuous neck / shoulder girdle / torso / arms.
 * Smooth implicit unions replace intersecting shoulder spheres and a neck tube.
 * Extraction happens once at load, not during animation.
 */
export function createUpperBodyGeometry(resolution=120) {
  const material=new THREE.MeshBasicMaterial();
  const mc=new MarchingCubes(resolution,material,false,false,160000);
  mc.isolation=0;
  const sx=4.2,sy=4.2,sz=1.55,cy=-4.7;
  // Cache height-dependent sections and muscle fields outside the z loop.
  const cache=[];
  for(let j=0;j<resolution;j++) {
    const y=cy+(j/resolution*2-1)*sy;
    const [tx,tz]=at(torso,y),n=at(neck,y),a=at(arm,y);
    const row=[];
    for(let i=0;i<resolution;i++) {
      const x=(i/resolution*2-1)*sx;
      const facing=Math.pow(Math.sqrt(Math.max(0,1-(x/tx)**2)),5);
      row.push({x,y,tx,tz,n,a,front:relief(x,y,true)*facing,back:relief(x,y,false)*facing});
    }
    cache.push(row);
  }
  for(let k=0;k<resolution;k++) {
    const z=(k/resolution*2-1)*sz;
    for(let j=0;j<resolution;j++) for(let i=0;i<resolution;i++) {
      const {x,y,tx,tz,n,a,front,back}=cache[j][i],ax=Math.abs(x);
      const adjusted=z>=0?z-front:z+back;
      let d=Math.max(ellipseField(x,adjusted,0,0,tx,tz),y+1.72,-6.90-y);
      const neckD=Math.max(ellipseField(x,z,n[0],n[3],n[1],n[2]),y+0.94,-2.35-y);
      d=smoothUnion(d,neckD,0.30);
      // The trapezius slopes outwards from the neck into the acromion.
      const trapX=ax-1.10,trapY=y+2.12;
      const u=trapX*0.975-trapY*0.222,v=trapX*0.222+trapY*0.975;
      const trap=(Math.sqrt((u/1.08)**2+(v/0.32)**2+((z+0.10)/0.55)**2)-1)*0.32;
      d=smoothUnion(d,trap,0.24);
      const armD=Math.max(ellipseField(ax,z,a[0],a[3],a[1],a[2]),y+1.98,-8.60-y);
      d=smoothUnion(d,armD,y>-3.8?0.30:0.08);
      // A real cylindrical aperture through the sternum; the recessed void is separate.
      d=Math.max(d,0.57-Math.hypot(x,y+3.05));
      mc.field[k*resolution*resolution+j*resolution+i]=-d;
    }
  }
  mc.update();
  if(mc.count/3>=160000) throw new Error('Upper-body extraction buffer exhausted');
  const raw=new THREE.BufferGeometry();
  const src=mc.geometry.attributes.position.array;
  const p=new Float32Array(mc.count*3),colors=[],uv=[];
  for(let i=0;i<mc.count;i++) {
    const x=src[i*3]*sx,y=cy+src[i*3+1]*sy,z=src[i*3+2]*sz;
    p.set([x,y,z],i*3);
    let shade=0.98-0.10*G(x,0.035)*G(y+4.8,1.3);
    for(let row=0;row<4;row++) shade-=0.10*G(y+4.22+row*0.64,0.04)*G(Math.abs(x)-0.45,0.55);
    colors.push(shade,shade,Math.min(1,shade*1.02));
    uv.push((z>=0?0.25:0.75)+x/16,(y+8.6)/7.7);
  }
  raw.setAttribute('position',new THREE.BufferAttribute(p,3));
  raw.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  raw.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const g=mergeVertices(raw,1e-5);
  raw.dispose(); mc.geometry.dispose(); material.dispose();
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData.continuousUpperBody=true;
  return g;
}
