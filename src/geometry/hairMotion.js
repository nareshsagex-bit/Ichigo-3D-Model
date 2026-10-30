import * as THREE from 'three';

// Shared model-space field bends the whole mane coherently; shorter waves add
// a little separation between locks. Roots above y=0.25 remain fixed.
export const HAIR_WIND_GLSL = `
uniform float uHairTime;
uniform float uHairStrength;
uniform float uHairEnabled;
vec3 hairBend(vec3 p) {
  float reach=max(0.25-p.y,0.0);
  float flex=smoothstep(0.0,0.8,reach)*pow(clamp(reach/6.8,0.0,1.2),1.25);
  float wave=sin(uHairTime*1.2-reach*0.75)+0.35*sin(uHairTime*1.9-reach*0.4+0.9);
  float flutter=sin(uHairTime*2.7-reach*1.6+p.x*1.1+p.z*0.6);
  float force=uHairStrength*uHairEnabled*flex;
  return p+force*vec3(0.32*wave+0.06*flutter,
    0.025*sin(uHairTime*1.5-reach),
    0.19*cos(uHairTime*1.1-reach*0.65)+0.05*flutter);
}
vec3 hairBendNormal(vec3 p,vec3 n) {
  float h=0.002;
  vec3 dx=(hairBend(p+vec3(h,0,0))-hairBend(p-vec3(h,0,0)))/(2.0*h);
  vec3 dy=(hairBend(p+vec3(0,h,0))-hairBend(p-vec3(0,h,0)))/(2.0*h);
  vec3 dz=(hairBend(p+vec3(0,0,h))-hairBend(p-vec3(0,0,h)))/(2.0*h);
  return normalize(n.x*cross(dy,dz)+n.y*cross(dz,dx)+n.z*cross(dx,dy));
}
`;

/** CPU reference used for checking the deformation's observable invariants. */
export function sampleHairMotion(point,time,strength=1,enabled=true) {
  const [x,y,z]=point;
  const reach=Math.max(0.25-y,0);
  const r=THREE.MathUtils.clamp(reach/0.8,0,1);
  const flex=r*r*(3-2*r)*Math.pow(THREE.MathUtils.clamp(reach/6.8,0,1.2),1.25);
  const force=enabled?strength*flex:0;
  const wave=Math.sin(time*1.2-reach*0.75)+0.35*Math.sin(time*1.9-reach*0.4+0.9);
  const flutter=Math.sin(time*2.7-reach*1.6+x*1.1+z*0.6);
  return [x+force*(0.32*wave+0.06*flutter),y+force*0.025*Math.sin(time*1.5-reach),
    z+force*(0.19*Math.cos(time*1.1-reach*0.65)+0.05*flutter)];
}

export function attachHairMotion(group) {
  const uniforms={uHairTime:{value:0},uHairStrength:{value:0.85},uHairEnabled:{value:1}};
  function patch(material,lit) {
    material.onBeforeCompile=(shader)=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=HAIR_WIND_GLSL+shader.vertexShader;
      if(lit) shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal=hairBendNormal(position,objectNormal);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed=hairBend(transformed);');
    };
    material.customProgramCacheKey=()=>`waist-hair-wind-v1-${lit}`;
    material.needsUpdate=true;
  }
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  const distance=new THREE.MeshDistanceMaterial({side:THREE.DoubleSide});
  patch(depth,false); patch(distance,false);
  const patched=new Set();
  group.traverse(mesh=>{
    if(!mesh.isMesh || mesh.name==='Recessed undercoat') return;
    if(!patched.has(mesh.material)) { patch(mesh.material,true); patched.add(mesh.material); }
    mesh.customDepthMaterial=depth;
    mesh.customDistanceMaterial=distance;
    // GPU displacement is invisible to CPU culling. Include max control-range sway.
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.boundingSphere.radius+=1.5;
  });
  let phase=0;
  return {
    update(delta,{enabled=true,strength=0.85,speed=0.7}={}) {
      // Pause freezes the current pose; speed changes do not jump the phase.
      if(enabled) phase+=Math.min(Math.max(delta,0),0.05)*speed;
      uniforms.uHairTime.value=phase;
      uniforms.uHairStrength.value=strength;
      uniforms.uHairEnabled.value=1;
    },
    reset() { phase=0; uniforms.uHairStrength.value=0; },
  };
}
