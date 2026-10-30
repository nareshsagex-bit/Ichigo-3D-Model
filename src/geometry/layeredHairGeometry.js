import * as THREE from 'three';

const V = (p) => new THREE.Vector3(...p);

// Width and thickness are independent: clumps read as blades, not tubes.
export function createHairLock(points, width, thickness, outward, color, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map(V));
  curve.curveType = 'centripetal';
  const hint = V(outward).normalize();
  const rings = 10;
  const positions = [], colors = [], indices = [];
  const cross = new THREE.Vector3(), normal = new THREE.Vector3();
  const tint = new THREE.Color(color), pointColor = new THREE.Color();
  for (let i=0;i<=segments;i++) {
    const t=i/segments;
    const p=curve.getPoint(t), tangent=curve.getTangent(t).normalize();
    normal.copy(hint).addScaledVector(tangent,-hint.dot(tangent)).normalize();
    if (normal.lengthSq()<0.01) normal.set(0,0,1);
    cross.crossVectors(tangent,normal).normalize();
    const taper=Math.pow(1-t,0.82)*(0.68+0.78*Math.sin(Math.PI*t));
    const w=width*taper+0.0004, h=thickness*Math.pow(1-t,0.8)+0.0003;
    for(let j=0;j<=rings;j++) {
      const theta=j/rings*Math.PI*2;
      const u=Math.cos(theta), v=Math.sin(theta);
      const ridge=Math.sign(v)*Math.pow(Math.abs(v),0.72);
      const q=p.clone().addScaledVector(cross,w*u).addScaledVector(normal,h*ridge);
      positions.push(q.x,q.y,q.z);
      const rootShade=THREE.MathUtils.lerp(0.65,1,THREE.MathUtils.clamp(t*4,0,1));
      const planeShade=0.76+0.26*Math.max(0,v)+0.11*(1-Math.abs(u));
      pointColor.copy(tint).multiplyScalar(rootShade*planeShade);
      colors.push(pointColor.r,pointColor.g,pointColor.b);
    }
  }
  for(let i=0;i<segments;i++) for(let j=0;j<rings;j++) {
    const a=i*(rings+1)+j,b=a+rings+1;
    indices.push(a,b,a+1, a+1,b,b+1);
  }
  for(let j=1;j<rings-1;j++) {
    indices.push(0,j+1,j);
    const end=segments*(rings+1);
    indices.push(end,end+j,end+j+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices); g.computeVertexNormals();
  const n=g.attributes.normal;
  for(let i=0;i<=segments;i++) {
    const a=i*(rings+1),b=a+rings;
    normal.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();
    n.setXYZ(a,normal.x,normal.y,normal.z); n.setXYZ(b,normal.x,normal.y,normal.z);
  }
  g.computeBoundingSphere();
  return g;
}

/** Smooth swept crown, long back layers and face-framing strands.
 * Deterministic paired variation keeps the silhouette balanced on reload.
 */
export function createHairGroup() {
  const group=new THREE.Group(); group.name='Layered orange mane';
  const material=new THREE.MeshStandardMaterial({
    color:0xffcf9c, vertexColors:true, roughness:0.78, metalness:0, side:THREE.DoubleSide,
  });
  const palette=[0xdf7226,0xe47d2e,0xd56b23,0xe98130,0xe18331];
  function lock(points,width,depth,outward,index,name) {
    // Longer, denser lengths spread gently below the nape; the scalp stays fitted.
    const waistPoints=points.map(([x,y,z])=>{
      const spread=THREE.MathUtils.smoothstep(-y,0.15,1.9);
      return [x*(1+0.18*spread),y-2.5*Math.max(0,-0.45-y),z-0.25*spread];
    });
    const mesh=new THREE.Mesh(createHairLock(waistPoints,width,depth,outward,palette[index%palette.length],44),material);
    mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=false; group.add(mesh);
  }
  const cap=new THREE.Mesh(
    new THREE.SphereGeometry(1,40,28,Math.PI,Math.PI,0,Math.PI*0.83),
    new THREE.MeshStandardMaterial({color:0x77300f,roughness:0.95,metalness:0})
  );
  cap.scale.set(0.70,1.23,0.94); cap.position.set(0,0,-0.035);
  cap.name='Recessed undercoat'; group.add(cap);

  // A shared envelope makes the large locks continuous from scalp to tip.
  const envelope=[
    [1.27,0.23,0.38],[1.08,0.52,0.72],[0.65,0.79,1.00],
    [0,0.94,1.18],[-0.65,1.10,1.34],[-1.30,1.30,1.50],
    [-2.10,1.58,1.76],[-2.60,1.72,1.95],
  ];
  function radius(y) {
    let i=0;
    while(i<envelope.length-2 && y<envelope[i+1][0]) i++;
    const a=envelope[i],b=envelope[i+1];
    const t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
    return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];
  }
  function flowingLock(a,end,offset,width,index,name,flick=0) {
    const s=Math.sin(a),c=Math.cos(a);
    const heights=envelope.map(p=>p[0]).filter(y=>y>end);
    heights.push(end);
    const points=heights.map((y,i)=>{
      const [rx,rz]=radius(y);
      const t=i/(heights.length-1);
      const lift=offset+flick*Math.pow(t,4);
      const flow=0.07*Math.sin(a*3)*Math.sin(Math.max(0,0.7-y)*1.7);
      return [(rx+lift)*s+flow,y,-0.06-0.10*Math.max(0,-y)-(rz+lift)*c];
    });
    lock(points,width,0.05,[s,0.05,-c],index,name);
  }
  for(let k=0;k<45;k++) {
    const pair=Math.abs(k-22),a=(k/44*2-1)*1.63;
    const variation=0.5+0.5*Math.sin(pair*4.71+0.4);
    flowingLock(a,-2.15-0.38*variation,0,0.205+0.025*variation,pair,`Long flowing lock ${k}`);
  }
  for(let k=0;k<32;k++) {
    const pair=Math.abs(k-15.5),a=(k/31*2-1)*1.59;
    const variation=0.5+0.5*Math.sin(pair*3.4+0.7);
    flowingLock(a,-1.85-0.45*variation,0.065,0.145+0.025*variation,pair|0,`Overlapping long layer ${k}`,0.06);
  }
  // Long outer layers follow the scalp down into the mane instead of lifting into spikes.
  for(let k=0;k<23;k++) {
    const a=(k/22*2-1)*1.70,pair=Math.abs(k-11);
    flowingLock(a,-2.05-0.30*(0.5+0.5*Math.sin(pair*5.7)),0.12,0.135,pair+1,`Long scalp layer ${k}`,0.04);
  }
  // Hairline strands rise only enough to clear the skull, then sweep back and
  // fall continuously to the waist. No short terminal spikes at the crown.
  for(let k=0;k<31;k++) {
    const q=(k-15)/15,pair=Math.abs(k-15);
    const variation=0.5+0.5*Math.sin(pair*8.12+1.7);
    const x=q*0.57,y=1.10+0.13*(1-q*q);
    lock([
      [x,y,-0.22],
      [x+q*0.08,1.28-0.08*q*q,-0.58],
      [q*0.80,0.87,-1.02],
      [q*0.96,0.02,-1.28],
      [q*1.14,-0.80,-1.55],
      [q*1.35,-1.60,-1.91],
      [q*(1.48+0.10*variation),-2.30-0.23*variation,-2.18-0.12*variation],
    ],0.12+0.012*variation,0.035,[q*0.25,0.10,-1],pair,`Long crown lock ${k}`);
  }
  for(const side of [-1,1]) for(let k=0;k<6;k++) {
    const t=k/5;
    lock([
      [side*(0.58+0.11*t),0.64-0.36*t,-0.05-0.19*t],
      [side*(0.77+0.16*t),0.10-0.35*t,-0.12-0.24*t],
      [side*(0.94+0.22*t),-0.58-0.26*t,-0.19-0.32*t],
      [side*(1.18+0.22*t),-1.29-0.45*t,-0.29-0.45*t],
      [side*(1.30+0.19*t),-1.55-0.55*t,-0.46-0.42*t],
    ],0.16+0.025*t,0.045,[side*0.5,0,0.87],k+1,`Face feather ${side}/${k}`);
  }
  return group;
}
