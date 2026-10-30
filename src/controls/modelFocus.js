import * as THREE from 'three';

/** Ignore invisible layers and visual-only energy/hand-control overlays. */
export function focusableMesh(object,root){
  if(!object.isMesh)return false;
  for(let node=object;node;node=node.parent){
    if(!node.visible || ['Hand drag handles','Character reiatsu aura','Katana energy aura'].includes(node.name))return false;
    if(node===root)return true;
  }
  return false;
}

export function focusDistance(point,objectName=''){
  if(/blade|katana/i.test(objectName))return 4.0;
  if(/hair|lock|layer|feather|undercoat/i.test(objectName))return 4.8;
  if(/tooth/i.test(objectName))return 2.8;
  if(point.y>-1.1)return 3.6;
  if(Math.abs(point.x)>2 && point.y>-10.8)return point.y<-8.1?3.4:4.8;
  if(point.y<-18.3)return 3.8;
  if(point.y>-6.7)return 6.0;
  return 5.4;
}

/** Only a short primary-pointer click focuses; orbit drags and wrist drags keep their roles. */
export function attachModelFocus(root,camera,canvas,orbit,{onFocus=()=>{},enabled=()=>true}={}){
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let down=null,animation=null;
  function stop(){animation=null;}
  canvas.addEventListener('pointerdown',event=>{
    // Wrist dragging intercepts this event in its earlier capture listener.
    if(event.button!==0 || !enabled() || !orbit.enabled)return;
    stop();down={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};
  });
  canvas.addEventListener('pointermove',event=>{
    if(down && event.pointerId===down.id && Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)down.moved=true;
  });
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerup',event=>{
    if(!down || event.pointerId!==down.id)return;
    const click=down;down=null;
    if(click.moved || event.button!==0 || !enabled() || !orbit.enabled)return;
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    ray.setFromCamera(pointer,camera);
    const meshes=[];root.traverse(object=>{if(focusableMesh(object,root))meshes.push(object);});
    const hit=ray.intersectObjects(meshes,false)[0];if(!hit)return;
    const local=root.worldToLocal(hit.point.clone());
    const distance=focusDistance(local,hit.object.name);
    const direction=camera.getWorldDirection(new THREE.Vector3()).negate();
    const target=hit.point.clone();
    animation={position:target.clone().addScaledVector(direction,distance),target};
    onFocus(hit);
  });
  canvas.addEventListener('wheel',stop,{passive:true});
  return {
    stop,
    update(delta){
      if(!animation)return;
      const blend=1-Math.exp(-10*Math.min(Math.max(delta,0.001),1));
      camera.position.lerp(animation.position,blend);orbit.target.lerp(animation.target,blend);
      if(camera.position.distanceTo(animation.position)<0.015 && orbit.target.distanceTo(animation.target)<0.015){
        camera.position.copy(animation.position);orbit.target.copy(animation.target);animation=null;
      }
    },
  };
}
