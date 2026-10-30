import * as THREE from 'three';
import {createHandPose} from '../geometry/handPose.js';

/** Camera-plane pointer dragging; ordinary orbiting works away from the wrist handles. */
export function attachHandControls(body,camera,canvas,orbit,onDragStart=()=>{}) {
  const pose=createHandPose(body),group=new THREE.Group();group.name='Hand drag handles';body.add(group);
  const handles=pose.sides.map(side=>{
    const handle=new THREE.Mesh(new THREE.SphereGeometry(0.24,20,14),
      new THREE.MeshBasicMaterial({color:0xff9a36,transparent:true,opacity:0.8,depthTest:false}));
    handle.name=side===-1?'Drag sword hand':'Drag free hand';handle.userData.side=side;
    handle.position.copy(pose.target(side));handle.renderOrder=20;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.32,0.025,6,32),
      new THREE.MeshBasicMaterial({color:0xffcc80,depthTest:false}));
    ring.renderOrder=21;handle.add(ring);group.add(handle);return handle;
  });
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane();
  const hit=new THREE.Vector3(),offset=new THREE.Vector3();
  let active=null,enabled=true,orbitWasEnabled=true;
  const hint=document.createElement('div');hint.className='hand-pose-hint';
  hint.textContent='Click model to inspect | Drag orange wrists to pose | Full Body resets view';
  canvas.parentElement.appendChild(hint);
  function cast(event) {
    const r=canvas.getBoundingClientRect();
    pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    ray.setFromCamera(pointer,camera);
  }
  function sync() {
    for(const h of handles) h.position.copy(pose.target(h.userData.side));
    body.updateMatrixWorld(true);
  }
  function finish(event) {
    if(active===null || (event.pointerId!==undefined && event.pointerId!==active.pointerId)) return;
    const pointerId=active.pointerId;active=null;
    if(canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    orbit.enabled=orbitWasEnabled;canvas.style.cursor='';
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!enabled || !body.visible || event.button!==0) return;
    cast(event);const intersection=ray.intersectObjects(handles,false)[0];
    if(!intersection) return;
    event.preventDefault();event.stopImmediatePropagation();
    const h=intersection.object,origin=h.getWorldPosition(new THREE.Vector3());
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),origin);
    ray.ray.intersectPlane(plane,hit);offset.copy(origin).sub(hit);
    active={side:h.userData.side,pointerId:event.pointerId};
    orbitWasEnabled=orbit.enabled;orbit.enabled=false;onDragStart();
    canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!enabled || !body.visible) return;
    cast(event);
    if(active!==null) {
      if(event.pointerId!==active.pointerId) return;
      event.preventDefault();event.stopImmediatePropagation();
      if(ray.ray.intersectPlane(plane,hit)) {
        pose.setTarget(active.side,body.worldToLocal(hit.clone().add(offset)));sync();
      }
    } else canvas.style.cursor=ray.intersectObjects(handles,false).length?'grab':'';
  },true);
  canvas.addEventListener('pointerup',finish,true);
  canvas.addEventListener('pointercancel',finish,true);
  canvas.addEventListener('lostpointercapture',finish);
  return {
    set enabled(value) {
      if(active!==null) finish({});
      enabled=value;group.visible=value;hint.hidden=!value;canvas.style.cursor='';
    },
    reset(){if(active!==null)finish({});pose.reset();sync();},
    update(){for(const h of handles) h.children[0].quaternion.copy(camera.quaternion).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());},
  };
}
