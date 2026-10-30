import * as THREE from 'three';

function canvasTexture(size,paint) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'); ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);
  paint(ctx,size);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}
function ribbon(ctx,points,widths) {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)));
  const left=[],right=[];
  for(let i=0;i<=100;i++) {
    const t=i/100,p=curve.getPoint(t),d=curve.getTangent(t).normalize();
    const q=t*(widths.length-1),k=Math.min(widths.length-2,Math.floor(q));
    const w=THREE.MathUtils.lerp(widths[k],widths[k+1],q-k)/2;
    left.push([p.x-d.y*w,p.y+d.x*w]);right.push([p.x+d.y*w,p.y-d.x*w]);
  }
  const polygon=left.concat(right.reverse());ctx.beginPath();
  polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}

export function applyBodyTextures(body) {
  const torsoMap=canvasTexture(2048,(ctx,size)=>{
    for(const back of [false,true]) {
      ctx.save();
      ctx.beginPath();ctx.rect(back?size/2:0,0,size/2,size);ctx.clip();
      ctx.setTransform(size/16,0,0,-size/7.7,(back?0.75:0.25)*size,-0.9*size/7.7);
      ctx.fillStyle='#080b14';
      for(const side of [-1,1]) {
        ctx.save();ctx.scale(side,1);
        if(!back) {
          ribbon(ctx,[[0.53,-2.88],[0.94,-2.66],[1.66,-2.40],[2.13,-2.40],[2.67,-2.86]],
            [0.17,0.21,0.24,0.29,0.07]);
          ribbon(ctx,[[0.55,-3.20],[1.12,-3.33],[1.78,-3.20],[2.15,-2.94]],
            [0.16,0.23,0.21,0.07]);
          ribbon(ctx,[[0.18,-2.03],[0.45,-2.18],[0.72,-2.38],[0.61,-2.62]],
            [0.12,0.17,0.18,0.04]);
          ribbon(ctx,[[1.98,-2.12],[2.50,-2.34],[2.72,-2.71],[2.61,-3.28]],
            [0.19,0.23,0.26,0.01]);
        } else {
          ribbon(ctx,[[0.28,-2.00],[0.66,-2.45],[0.82,-3.12],[1.02,-3.77]],
            [0.15,0.25,0.22,0.01]);
          ribbon(ctx,[[1.05,-2.16],[1.66,-2.35],[2.30,-2.37],[2.71,-2.80]],
            [0.13,0.21,0.26,0.03]);
        }
        ribbon(ctx,[[2.42,-3.00],[2.74,-3.64],[2.80,-4.34],[2.97,-4.95]],
          [0.27,0.32,0.21,0.015]);
        ribbon(ctx,[[2.97,-5.40],[3.29,-6.12],[3.41,-6.75],[3.25,-7.45],[3.44,-8.42]],
          [0.03,0.26,0.30,0.22,0.025]);
        ctx.restore();
      }
      ctx.restore();
    }
  });
  body.traverse(m=>{
    if(!m.isMesh) return;
    if(m.name==='Sculpted symmetric torso') m.material.map=torsoMap;
    m.material.needsUpdate=true;
  });
}
