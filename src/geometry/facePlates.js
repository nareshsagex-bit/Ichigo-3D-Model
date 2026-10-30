import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mirrored bone planes fitted to the sculpt, with a raised internal ridge.
 * Each patch is an open relief on the closed skull, not a floating attachment.
 */
export function createFacePlates(mask) {
  const group = new THREE.Group();
  group.name = 'Brow and zygomatic bone planes';
  const material = new THREE.MeshStandardMaterial({
    color: 0xe5e6eb, roughness: 0.67, metalness: 0,
  });
  mask.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const patches = [
    // Broad orbital roof, with the lower edge following the angry eye angle.
    { rim: [[0.15,-0.08],[0.23,0.035],[0.44,0.12],[0.58,0.13],
      [0.56,0.055],[0.42,-0.005],[0.24,-0.10]], ridge: [0.36,0.025,0.025] },
    // Cheek shelf separates the dark orbital hollow from the dental muzzle.
    { rim: [[0.60,-0.18],[0.60,-0.24],[0.56,-0.32],[0.45,-0.35],
      [0.31,-0.52],[0.35,-0.36],[0.48,-0.25]], ridge: [0.48,-0.30,0.05] },
  ];
  for (const side of [1]) for (const {rim, ridge} of patches) {
    const points = [...rim.map(([x,y]) => [x,y,0.004]), ridge];
    const vertices = [];
    const cache=new Map();
    const sample=(p) => {
      const key=p[0].toFixed(6)+','+p[1].toFixed(6);
      if (!cache.has(key)) {
        ray.set(new THREE.Vector3(p[0],p[1],3),new THREE.Vector3(0,0,-1));
        const hit=ray.intersectObject(mask,false)[0];
        if (!hit) throw new Error('Bone-plane landmark missed mask');
        cache.set(key,hit.point.z);
      }
      return [p[0],p[1],cache.get(key)+p[2]];
    };
    // Subdivide and project the relief so its edges cannot cut through the skull.
    const steps=8;
    for (let k=0;k<rim.length;k++) {
      const a=points[k], b=points[(k+1)%rim.length], c=ridge;
      const blend=(i,j)=>sample(a.map((v,d)=>v+(b[d]-v)*i/steps+(c[d]-v)*j/steps));
      const tri=(a,b,c)=>{
        if ((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0) [b,c]=[c,b];
        vertices.push(...a,...b,...c);
      };
      for(let i=0;i<steps;i++) for(let j=0;j<steps-i;j++) {
        tri(blend(i,j),blend(i+1,j),blend(i,j+1));
        if(i+j<steps-1) tri(blend(i+1,j),blend(i+1,j+1),blend(i,j+1));
      }
    }
    const raw=new THREE.BufferGeometry();
    raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const geometry=mergeVertices(raw,1e-5);
    raw.dispose();
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    group.add(mesh);
    const mirrored=geometry.clone().scale(-1,1,1);
    const reverse=mirrored.index.array;
    for (let i=0;i<reverse.length;i+=3) { const b=reverse[i+1]; reverse[i+1]=reverse[i+2]; reverse[i+2]=b; }
    mirrored.computeVertexNormals();
    const partner=new THREE.Mesh(mirrored,material);
    partner.castShadow=false;
    partner.receiveShadow=false;
    group.add(partner);
  }
  return group;
}
