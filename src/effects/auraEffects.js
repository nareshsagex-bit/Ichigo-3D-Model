import * as THREE from 'three';

const fragment=`
uniform float uIntensity;
varying float vFade;
varying vec3 vColor;
void main(){
  vec2 q=(gl_PointCoord-0.5)*2.0;
  float core=max(0.0,1.0-length(q*vec2(1.9,1.0)));
  float alpha=pow(core,2.2)*vFade;
  if(alpha<0.006) discard;
  gl_FragColor=vec4(vColor*uIntensity,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const common=`
uniform float uTime;
uniform float uViewport;
uniform float uIntensity;
attribute vec3 aSeed;
attribute float aSize;
varying float vFade;
varying vec3 vColor;
`;

const characterVertex=common+`
void main(){
  float life=fract(aSeed.x+uTime*(0.095+aSeed.z*0.055));
  float y=-20.1+life*23.5;
  float angle=aSeed.y*6.283185+uTime*0.17+life*0.7;
  float radius=mix(4.1,2.2,smoothstep(-7.0,2.5,y))+aSeed.z*1.1;
  radius+=0.22*sin(uTime*1.4+life*11.0+aSeed.y*9.0);
  vec3 p=vec3(sin(angle)*radius,y,cos(angle)*radius*0.64);
  p.x+=0.22*sin(life*13.0+uTime*0.9);
  vec4 viewPosition=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*viewPosition;
  gl_PointSize=clamp(aSize*uViewport/max(0.2,-viewPosition.z),1.0,105.0);
  vFade=smoothstep(0.0,0.10,life)*(1.0-smoothstep(0.74,1.0,life));
  vColor=mix(vec3(1.0,0.035,0.015),vec3(1.0,0.48,0.09),aSeed.z*aSeed.z);
}`;

const swordVertex=common+`
uniform vec2 uBladeY;
void main(){
  float life=fract(aSeed.x+uTime*(0.28+aSeed.z*0.20));
  vec3 p=position;
  // Blade-local particles lick away from the steel and fade without leaving detached trails.
  float spread=0.02+life*0.30;
  p.x+=sin(aSeed.y*6.283185+uTime*1.3)*spread;
  p.z+=cos(aSeed.y*6.283185+uTime*1.1)*spread;
  p.y=clamp(p.y+life*0.5,uBladeY.x,uBladeY.y);
  vec4 viewPosition=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*viewPosition;
  gl_PointSize=clamp(aSize*uViewport/max(0.2,-viewPosition.z),1.0,80.0);
  vFade=sin(life*3.141593)*0.9;
  vColor=mix(vec3(0.9,0.015,0.05),vec3(1.0,0.28,0.06),aSeed.z);
}`;

function seededParticles(count,vertex,uniforms,positionAt=()=>[0,0,0],largeEvery=8){
  let state=27531;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const position=[],seed=[],size=[];
  for(let i=0;i<count;i++){
    const a=random(),b=random(),c=random();
    position.push(...positionAt(a,b,c));seed.push(a,b,c);
    size.push(i%largeEvery===0?0.55+c*0.65:0.06+c*0.16);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,3));
  geometry.setAttribute('aSize',new THREE.Float32BufferAttribute(size,1));
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true});
  const points=new THREE.Points(geometry,material);
  // Vertex shader owns the positions; the static seed bounds do not describe the aura.
  points.frustumCulled=false;points.renderOrder=3;
  return points;
}

export function createAuraEffects(character,body){
  const uniforms={uTime:{value:0},uViewport:{value:800},uIntensity:{value:1.4}};
  const characterAura=new THREE.Group();characterAura.name='Character reiatsu aura';
  const particles=seededParticles(1152,characterVertex,uniforms);
  particles.name='Rising reiatsu particles';characterAura.add(particles);character.add(characterAura);
  const veilGeometry=new THREE.CylinderGeometry(1,1,23.5,64,48,true);
  const veilMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`uniform float uTime;varying vec3 vNormal;varying vec3 vView;varying vec2 vUV;
      void main(){
        vec3 p=position;p.y-=8.35;
        float height=(p.y+20.1)/23.5;
        float radius=mix(4.3,2.2,smoothstep(0.56,1.0,height));
        radius+=0.16*sin(p.y*1.7+uTime*2.0+uv.x*18.85);
        p.x*=radius;p.z*=radius*0.64;
        vec4 viewPosition=modelViewMatrix*vec4(p,1.0);
        vNormal=normalize(normalMatrix*normal);vView=-viewPosition.xyz;vUV=uv;
        gl_Position=projectionMatrix*viewPosition;
      }`,
    fragmentShader:`uniform float uTime;uniform float uIntensity;
      varying vec3 vNormal;varying vec3 vView;varying vec2 vUV;
      void main(){
        float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.4);
        float flame=pow(0.5+0.5*sin(vUV.x*62.83-vUV.y*15.0+uTime*2.1),3.0);
        float ends=smoothstep(0.0,0.10,vUV.y)*(1.0-smoothstep(0.72,1.0,vUV.y));
        float alpha=rim*(0.035+0.13*flame)*ends*uIntensity;
        gl_FragColor=vec4(1.0,0.015,0.035,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const veil=new THREE.Mesh(veilGeometry,veilMaterial);veil.name='Soft crimson energy veil';
  veil.frustumCulled=false;characterAura.add(veil);

  const blade=body.getObjectByName('Curved blade');blade.geometry.computeBoundingBox();
  const box=blade.geometry.boundingBox;
  const bladeUniforms={...uniforms,uBladeY:{value:new THREE.Vector2(box.min.y,box.max.y)}};
  const swordAura=new THREE.Group();swordAura.name='Katana energy aura';blade.add(swordAura);
  const sparks=seededParticles(360,swordVertex,bladeUniforms,(a,b,c)=>{
    const y=THREE.MathUtils.lerp(box.min.y+0.04,box.max.y-0.04,a);
    // The narrow blade bends near its tip; follow its actual section centre.
    const p=blade.geometry.attributes.position;
    let min=Infinity,max=-Infinity;
    for(let i=0;i<p.count;i++) if(Math.abs(p.getY(i)-y)<0.35){min=Math.min(min,p.getX(i));max=Math.max(max,p.getX(i));}
    const x=Number.isFinite(min)?(min+max)*0.5:(box.min.x+box.max.x)*0.5;
    return [x+(b-0.5)*0.14,y,box.max.z+0.025+(c-0.5)*0.08];
  },5);
  sparks.name='Katana crimson sparks';swordAura.add(sparks);
  // A thin energy edge remains readable between sparks and follows the posed sword.
  const edge=body.getObjectByName('Blade edge');
  const edgeGlow=new THREE.Mesh(edge.geometry.clone(),new THREE.MeshBasicMaterial({
    color:0xff2445,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false}));
  edgeGlow.name='Katana energy edge';edgeGlow.scale.set(1.015,1,1.8);swordAura.add(edgeGlow);
  characterAura.visible=false;swordAura.visible=false;
  let time=0;
  return {
    characterAura,swordAura,
    setCharacter(value){characterAura.visible=value;},
    setKatana(value){swordAura.visible=value;},
    update(delta,{intensity=1.4,speed=1,height=800}={}){
      if(characterAura.visible || swordAura.visible)time+=THREE.MathUtils.clamp(delta,0,0.05)*speed;
      uniforms.uTime.value=time;uniforms.uViewport.value=height;uniforms.uIntensity.value=intensity;
      edgeGlow.material.opacity=THREE.MathUtils.clamp((0.58+0.18*Math.sin(time*3.2))*intensity,0,1);
    },
  };
}
