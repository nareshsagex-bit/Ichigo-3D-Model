import * as THREE from 'three';

// A shared continuous wind field keeps neighboring rags moving together.
// The smooth weight pins the full waistband and increases flexibility toward the hem.
export const CLOTH_WIND_GLSL=`
uniform float uClothTime;
uniform float uClothStrength;
vec3 clothBend(vec3 p) {
  float reach=max(-6.65-p.y,0.0);
  float flex=smoothstep(0.0,1.0,reach)*pow(clamp(reach/11.5,0.0,1.0),1.6);
  float wave=sin(uClothTime*1.25-reach*0.48);
  float flutter=sin(uClothTime*2.6-reach*1.3+p.x*0.9+p.z*0.7);
  float force=uClothStrength*flex;
  return p+force*vec3(0.48*wave+0.07*flutter,
    0.08*wave*wave,
    0.27*cos(uClothTime*1.1-reach*0.42)+0.06*flutter);
}
vec3 clothBendNormal(vec3 p,vec3 n) {
  float h=0.002;
  vec3 dx=(clothBend(p+vec3(h,0,0))-clothBend(p-vec3(h,0,0)))/(2.0*h);
  vec3 dy=(clothBend(p+vec3(0,h,0))-clothBend(p-vec3(0,h,0)))/(2.0*h);
  vec3 dz=(clothBend(p+vec3(0,0,h))-clothBend(p-vec3(0,0,h)))/(2.0*h);
  return normalize(n.x*cross(dy,dz)+n.y*cross(dz,dx)+n.z*cross(dx,dy));
}
`;

export function sampleClothMotion([x,y,z],time,strength=0.75) {
  const reach=Math.max(-6.65-y,0),r=THREE.MathUtils.clamp(reach,0,1);
  const flex=r*r*(3-2*r)*Math.pow(THREE.MathUtils.clamp(reach/11.5,0,1),1.6);
  const wave=Math.sin(time*1.25-reach*0.48);
  const flutter=Math.sin(time*2.6-reach*1.3+x*0.9+z*0.7),force=strength*flex;
  return [x+force*(0.48*wave+0.07*flutter),y+force*0.08*wave*wave,
    z+force*(0.27*Math.cos(time*1.1-reach*0.42)+0.06*flutter)];
}

export function attachClothMotion(group) {
  const uniforms={uClothTime:{value:0},uClothStrength:{value:0.75}};
  const patch=(material,lit)=>{
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=CLOTH_WIND_GLSL+shader.vertexShader;
      if(lit) shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal=clothBendNormal(position,objectNormal);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed=clothBend(transformed);');
    };
    material.customProgramCacheKey=()=>`cloth-wind-v1-${lit}`;
    material.needsUpdate=true;
  };
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  const distance=new THREE.MeshDistanceMaterial({side:THREE.DoubleSide});
  patch(depth,false);patch(distance,false);
  const materials=new Map();
  group.traverse(mesh=>{
    if(!mesh.isMesh || !/^(Torn cloth panel|Sash tail)/.test(mesh.name)) return;
    if(!materials.has(mesh.material)) {
      const m=mesh.material.clone();patch(m,true);materials.set(mesh.material,m);
    }
    // Clone: the source material is shared with pieces that must remain static.
    mesh.material=materials.get(mesh.material);
    mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
    mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=1.5;
  });
  let phase=0;
  return {
    update(delta,{enabled=true,strength=0.75,speed=0.8}={}) {
      if(enabled) phase+=THREE.MathUtils.clamp(delta,0,0.05)*speed;
      uniforms.uClothTime.value=phase;uniforms.uClothStrength.value=strength;
    },
    reset(){phase=0;uniforms.uClothTime.value=0;uniforms.uClothStrength.value=0;},
  };
}
