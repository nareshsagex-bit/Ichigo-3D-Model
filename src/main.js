import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { attachModelFocus } from './controls/modelFocus.js';
import { createAuraEffects } from './effects/auraEffects.js';
import { attachHandControls } from './controls/handControls.js';

import { applyBodyTextures } from './materials/bodyTextures.js';
import { createBodyGroup, BODY } from './geometry/bodyGeometry.js';
import { createFacePlates } from './geometry/facePlates.js';
import { createMaskGeometry } from './geometry/maskGeometry.js';
import { createHornGeometry } from './geometry/hornGeometry.js';
import { createTeethGroup } from './geometry/teethGeometry.js';
import { attachClothMotion } from './geometry/clothMotion.js';
import { attachHairMotion } from './geometry/hairMotion.js';
import { createHairGroup } from './geometry/hairGeometry.js';
import { measureSymmetry, REFERENCE, FACE } from './geometry/faceLandmarks.js';
import {
  createMaskTextures,
  createBoneBumpMap,
  createHornTexture,
} from './materials/proceduralTextures.js';

// --- 1. Scene, Camera, and Renderer Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080e);
scene.fog = new THREE.FogExp2(0x06080e, 0.009);

const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
// Start with a direct, centered portrait view
camera.position.set(0, -9.6, 42);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, -9.6, 0);
controls.maxDistance = 58;
controls.minDistance = 0.8;

// --- 2. Lighting Setup (Atmospheric Anime Rim & Key Lighting) ---
const ambientLight = new THREE.AmbientLight(0x141f33, 1.4);
scene.add(ambientLight);

// Key front directional light
const keyLight = new THREE.DirectionalLight(0xf4f7ff, 2.2);
keyLight.position.set(7, 4, 15);
keyLight.target.position.set(0,-8,0);
scene.add(keyLight.target);
keyLight.shadow.camera.left=-13; keyLight.shadow.camera.right=13;
keyLight.shadow.camera.top=14; keyLight.shadow.camera.bottom=-14;
keyLight.shadow.camera.far=65;
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.0001;
keyLight.shadow.normalBias = 0.012;
scene.add(keyLight);

// Cool rim backlight (brilliant eclipse halo behind him)
const rimBackLight = new THREE.DirectionalLight(0xbae6fd, 4.2);
rimBackLight.position.set(0, 2.5, -4.0);
scene.add(rimBackLight);

// Secondary soft fill
const fillLight = new THREE.DirectionalLight(0xc8d4eb, 0.85);
fillLight.position.set(-2.5, -0.2, 2.0);
scene.add(fillLight);

// --- 3. Background Atmospheric Eclipse / Moon Ring ---
const ringGroup = new THREE.Group();
const ringGeo = new THREE.TorusGeometry(5.2, 0.06, 16, 160);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x93c5fd,
  transparent: true,
  opacity: 0.9,
});
const ringMesh = new THREE.Mesh(ringGeo, ringMat);
ringMesh.position.set(0, 0.6, -3.2);
ringGroup.add(ringMesh);

const haloGeo = new THREE.RingGeometry(4.6, 6.4, 96);
const haloMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide,
});
const haloMesh = new THREE.Mesh(haloGeo, haloMat);
haloMesh.position.set(0, 0.6, -3.22);
ringGroup.add(haloMesh);
scene.add(ringGroup);

// Ground reflection plane
const groundGeo = new THREE.PlaneGeometry(70, 70);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x05070c,
  roughness: 0.18,
  metalness: 0.8,
});
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = BODY.groundY;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// --- 4. Character Head Construction (Vasto Lorde Ichigo) ---
const characterGroup = new THREE.Group();
const bodyGroup = createBodyGroup();
applyBodyTextures(bodyGroup);
const clothMotion=attachClothMotion(bodyGroup.userData.layers.clothing);
characterGroup.add(bodyGroup);

// Procedural Textures
const maskTextures = createMaskTextures();
const boneBumpMap = createBoneBumpMap();
const hornTexture = createHornTexture();

// Hollow Mask / Skull
const maskGeo = createMaskGeometry();
const maskMat = new THREE.MeshStandardMaterial({
  map: maskTextures.map,
  emissiveMap: maskTextures.emissiveMap,
  emissive: 0xffaa22,
  emissiveIntensity: 1.1,
  bumpMap: boneBumpMap,
  bumpScale: 0.012,
  roughness: 0.58,
  metalness: 0.02,
});
const maskMesh = new THREE.Mesh(maskGeo, maskMat);
maskMesh.castShadow = true;
maskMesh.receiveShadow = true;
characterGroup.add(maskMesh);
const facePlates = createFacePlates(maskMesh);
characterGroup.add(facePlates);

console.info(`[symmetry] mask max mirror error: ${measureSymmetry(maskGeo).toExponential(2)}`);

// Sweeping Horns: one geometry, the left horn is its mirror image
const hornMat = new THREE.MeshStandardMaterial({
  map: hornTexture,
  bumpMap: boneBumpMap,
  bumpScale: 0.3,
  roughness: 0.36,
  metalness: 0.04,
});

const hornGeo = createHornGeometry();
const rightHornMesh = new THREE.Mesh(hornGeo, hornMat);
rightHornMesh.castShadow = true;
characterGroup.add(rightHornMesh);

const leftHornMesh = new THREE.Mesh(hornGeo, hornMat);
leftHornMesh.scale.x = -1;
leftHornMesh.castShadow = true;
characterGroup.add(leftHornMesh);

// Long skull-grin teeth, bent onto the finished mask surface
const teethGroup = createTeethGroup(maskMesh);
characterGroup.add(teethGroup);

// Wild Anime Orange Hair Mane
const hairGroup = createHairGroup();
characterGroup.add(hairGroup);
const hairMotion = attachHairMotion(hairGroup);

scene.add(characterGroup);
const auraEffects=createAuraEffects(characterGroup,bodyGroup);

// Reference image plane, scaled so 1 px = REFERENCE.unitsPerPx and the traced face centre
// lands on the origin. Compared through an orthographic front camera (blueprint view),
// so silhouette and features line up 1:1 without perspective distortion.
const refTexture = new THREE.TextureLoader().load(REFERENCE.url);
refTexture.colorSpace = THREE.SRGBColorSpace;
const [panelX, panelY, panelW, panelH] = REFERENCE.panel;
refTexture.repeat.set(panelW / REFERENCE.widthPx, panelH / REFERENCE.heightPx);
refTexture.offset.set(panelX / REFERENCE.widthPx, 1 - (panelY + panelH) / REFERENCE.heightPx);
const refPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(panelW * REFERENCE.unitsPerPx, panelH * REFERENCE.unitsPerPx),
  new THREE.MeshBasicMaterial({ map: refTexture, transparent: true, opacity: 0.5, depthTest: false, fog: false })
);
refPlane.position.set(
  (panelX + panelW / 2 - REFERENCE.centerPx[0]) * REFERENCE.unitsPerPx,
  (REFERENCE.centerPx[1] - panelY - panelH / 2) * REFERENCE.unitsPerPx,
  0
);

const orthoHalfH = 1.9;
const orthoCam = new THREE.OrthographicCamera(-1, 1, orthoHalfH, -orthoHalfH, 0.1, 100);
orthoCam.position.set(0, 0, 8);
function fitOrtho() {
  const a = window.innerWidth / window.innerHeight;
  orthoCam.left = -orthoHalfH * a;
  orthoCam.right = orthoHalfH * a;
  orthoCam.updateProjectionMatrix();
}
fitOrtho();
refPlane.renderOrder = 999;
refPlane.visible = false;
scene.add(refPlane);

// --- 5. Interactive lil-gui Controls ---
const params = {
  // Visibility
  showBody: true,
  showCloth: true,
  showFur: true,
  showWeapon: true,
  showMask: true,
  showHorns: true,
  showTeeth: true,
  eyeGlow: 1.1,
  showHair: true,
  showEclipse: true,
  wireframe: false,
  clayView: false,
  showReference: false,
  referenceOpacity: 0.5,

  // Materials & Shading
  maskRoughness: 0.58,
  maskMetalness: 0.02,

  // Lighting
  rimIntensity: 4.2,
  keyIntensity: 2.2,
  ambientIntensity: 1.4,

  // Animation - OFF BY DEFAULT AS REQUESTED
  autoRotate: false,
  rotateSpeed: 0.5,
  characterAura: false,
  katanaAura: false,
  auraIntensity: 1.4,
  auraSpeed: 1,
  clothMotion: true,
  clothWindStrength: 0.75,
  clothWindSpeed: 0.8,
  hairMotion: true,
  windStrength: 0.85,
  windSpeed: 0.7,
};

const gui = new GUI({ title: 'Vasto Lorde Character Studio' });

const handControls=attachHandControls(bodyGroup,camera,renderer.domElement,controls,()=>{
  params.autoRotate=false;isTransitioningCam=false;modelFocus.stop();
});
const modelFocus=attachModelFocus(characterGroup,camera,renderer.domElement,controls,{
  enabled:()=>!params.showReference,
  onFocus:()=>{params.autoRotate=false;isTransitioningCam=false;
    document.querySelectorAll('.preset-btn').forEach(button=>button.classList.remove('active'));},
});
const fAura=gui.addFolder('Aura Effects');
const auraButtons=[['character-aura','characterAura'],['katana-aura','katanaAura']];
function syncAura(){
  auraEffects.setCharacter(params.characterAura && !params.showReference);
  auraEffects.setKatana(params.katanaAura && !params.showReference);
  for(const [id,key] of auraButtons)document.getElementById(id).setAttribute('aria-pressed',String(params[key]));
}
for(const [id,key] of auraButtons){
  const controller=fAura.add(params,key).name(key==='characterAura'?'Character Aura':'Katana Aura').onChange(syncAura);
  document.getElementById(id).addEventListener('click',()=>{params[key]=!params[key];controller.updateDisplay();syncAura();});
}
fAura.add(params,'auraIntensity',0.25,3,0.05).name('Aura Intensity');
fAura.add(params,'auraSpeed',0.2,2,0.05).name('Aura Speed');fAura.close();
const fPose=gui.addFolder('Hand Posing');
fPose.add({enabled:true},'enabled').name('Drag Hands').onChange(v=>handControls.enabled=v && !params.showReference);
fPose.add({reset:()=>handControls.reset()},'reset').name('Reset Hand Pose');
const fBody = gui.addFolder('Body Layers');
fBody.add(params,'showBody').name('Body').onChange(v=>bodyGroup.visible=v);
fBody.add(params,'showCloth').name('Torn Hakama & Sash').onChange(v=>bodyGroup.userData.layers.clothing.visible=v);
fBody.add(params,'showFur').name('Fur Collar & Cuffs').onChange(v=>bodyGroup.userData.layers.fur.visible=v);
fBody.add(params,'showWeapon').name('Katana').onChange(v=>bodyGroup.userData.layers.weapon.visible=v);
for(const [key,label] of [['grip','Katana Grip'],['shoulders','Neck & Shoulders'],['hands','Hands Close-Up'],['feet','Feet Close-Up']]) {
  fBody.add({view:()=>selectCameraView(key)},'view').name(label);
}
const fGeo = gui.addFolder('Head Layers');
fGeo.add(params, 'showMask').name('Skull Mask').onChange((v) => { maskMesh.visible = v; facePlates.visible = v; });
fGeo.add(params, 'showHorns').name('Demon Horns').onChange((v) => {
  rightHornMesh.visible = v;
  leftHornMesh.visible = v;
});
fGeo.add(params, 'showTeeth').name('Clenched Teeth').onChange((v) => (teethGroup.visible = v));
fGeo.add(params, 'showHair').name('Orange Mane').onChange((v) => (hairGroup.visible = v));
fGeo.add(params, 'showEclipse').name('Eclipse Ring').onChange((v) => (ringGroup.visible = v));
fGeo.add(params, 'wireframe').name('Wireframe Mode').onChange((v) => {
  bodyGroup.traverse(child=>{ if(child.isMesh) child.material.wireframe=v; });
  maskMat.wireframe = v;
  facePlates.traverse((child) => { if (child.isMesh) child.material.wireframe = v; });
  teethGroup.traverse((child) => { if (child.isMesh) child.material.wireframe = v; });
  hornMat.wireframe = v;
  hairGroup.traverse((child) => {
    if (child.isMesh) child.material.wireframe = v;
  });
});

const fRef = gui.addFolder('Reference Overlay');
fRef.add(params, 'showReference').name('Show Reference (ortho front)').onChange((v) => {
  refPlane.visible = v;
  modelFocus.stop();
  syncAura();
  handControls.enabled=!v && fPose.controllers[0].getValue();
  if (v) { params.autoRotate = false; characterGroup.rotation.set(0,0,0); }
});
fRef.add(params, 'referenceOpacity', 0.05, 1.0, 0.05).name('Opacity').onChange((v) => (refPlane.material.opacity = v));

const fMat = gui.addFolder('Bone & Shading');
fMat.add(params, 'clayView').name('Clay Form Study').onChange((v) => {
  maskMat.map = v ? null : maskTextures.map;
  maskMat.emissiveMap = v ? null : maskTextures.emissiveMap;
  maskMat.bumpMap = v ? null : boneBumpMap;
  maskMat.emissive.set(v ? 0x000000 : 0xffaa22);
  maskMat.needsUpdate = true;
});
fMat.add(params, 'maskRoughness', 0.0, 1.0, 0.01).name('Bone Roughness').onChange((v) => (maskMat.roughness = v));
fMat.add(params, 'maskMetalness', 0.0, 1.0, 0.01).name('Bone Specular').onChange((v) => (maskMat.metalness = v));
fMat.add(params, 'eyeGlow', 0.0, 6.0, 0.1).name('Eye Glow').onChange((v) => (maskMat.emissiveIntensity = v));

const fLight = gui.addFolder('Atmosphere & Lights');
fLight.add(params, 'rimIntensity', 0.0, 8.0, 0.1).name('Eclipse Rim Light').onChange((v) => (rimBackLight.intensity = v));
fLight.add(params, 'keyIntensity', 0.0, 5.0, 0.1).name('Key Front Light').onChange((v) => (keyLight.intensity = v));
fLight.add(params, 'ambientIntensity', 0.0, 3.0, 0.1).name('Ambient Light').onChange((v) => (ambientLight.intensity = v));

const fCloth=gui.addFolder('Cloth Motion');
fCloth.add(params,'clothMotion').name('Living Skirt');
fCloth.add(params,'clothWindStrength',0,2,0.05).name('Cloth Wind Strength');
fCloth.add(params,'clothWindSpeed',0.15,2,0.05).name('Cloth Wind Speed');
fCloth.add({rest:()=>{params.clothMotion=false;params.clothWindStrength=0;clothMotion.reset();fCloth.controllers.forEach(c=>c.updateDisplay());}},'rest').name('Reset Cloth to Rest');
const fHair = gui.addFolder('Hair Motion');
fHair.add(params,'hairMotion').name('Living Hair');
fHair.add(params,'windStrength',0,2,0.05).name('Wind Strength');
fHair.add(params,'windSpeed',0.15,2,0.05).name('Wind Speed');
fHair.add({rest:()=>{ params.hairMotion=false; params.windStrength=0; hairMotion.reset(); fHair.controllers.forEach(c=>c.updateDisplay()); }},'rest').name('Reset to Rest');
const fAnim = gui.addFolder('Motion & Turntable');
fAnim.add(params, 'autoRotate').name('Auto Turntable (OFF)');
fAnim.add(params, 'rotateSpeed', 0.1, 3.0, 0.1).name('Turntable Speed');

// Keep detail controls available without obscuring the full character.
fGeo.close(); fRef.close(); fMat.close(); fLight.close(); fHair.close(); fCloth.close(); fAnim.close();
// --- 6. Camera Preset Views ---
const cameraTargets = {
  bodyFront: { pos:new THREE.Vector3(0,-9.6,42), look:new THREE.Vector3(0,-9.6,0) },
  bodyQuarter: { pos:new THREE.Vector3(23,-7.1,36), look:new THREE.Vector3(0,-9.6,0) },
  bodySide: { pos:new THREE.Vector3(42,-9.6,0), look:new THREE.Vector3(0,-9.6,0) },
  bodyBack: { pos:new THREE.Vector3(0,-9.6,-42), look:new THREE.Vector3(0,-9.6,0) },
  grip: { pos:new THREE.Vector3(-6.3,-8.8,4.8), look:new THREE.Vector3(-4.15,-9.05,0.45) },
  shoulders: { pos:new THREE.Vector3(4,-1.4,10), look:new THREE.Vector3(0,-2.15,0) },
  hands: { pos:new THREE.Vector3(6.4,-8.8,5.2), look:new THREE.Vector3(3.43,-9.3,0.1) },
  feet: { pos:new THREE.Vector3(3,-18.5,7.2), look:new THREE.Vector3(0,-19.35,0.3) },
  torso: { pos:new THREE.Vector3(7,-3.7,13), look:new THREE.Vector3(0,-4.1,0) },
  front: { pos: new THREE.Vector3(0, 0.0, 4.6), look: new THREE.Vector3(0, 0.0, 0) },
  threeQuarter: { pos: new THREE.Vector3(2.6, 0.3, 3.8), look: new THREE.Vector3(0, 0.0, 0) },
  profile: { pos: new THREE.Vector3(4.6, 0.0, 0.0), look: new THREE.Vector3(0, 0.0, 0) },
  mane: { pos: new THREE.Vector3(5.0, -0.5, 13.0), look: new THREE.Vector3(0, -2.4, -0.45) },
  rear: { pos: new THREE.Vector3(0, -0.7, -14.0), look: new THREE.Vector3(0, -2.4, -0.45) },
  horns: { pos: new THREE.Vector3(0, 1.3, 11.5), look: new THREE.Vector3(0, 1.2, 0) },
  teeth: { pos: new THREE.Vector3(0, -0.6, 2.2), look: new THREE.Vector3(0, -0.65, 0.5) },
};

let targetCamPos = camera.position.clone();
let targetControlsLook = controls.target.clone();
let isTransitioningCam = false;
function selectCameraView(key){
  modelFocus.stop();
  const target=cameraTargets[key];if(!target)return;
  targetCamPos.copy(target.pos);targetControlsLook.copy(target.look);
  camera.position.copy(target.pos);controls.target.copy(target.look);
  camera.lookAt(target.look);controls.update();isTransitioningCam=false;
}

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const presetKey = btn.dataset.preset;
    const target = cameraTargets[presetKey];
    if (target) {
      selectCameraView(presetKey);
    }
  });
});

// --- 7. Animation Loop ---
let previousFrameTime;
function animate(timestamp = 0) {
  requestAnimationFrame(animate);
  const delta=previousFrameTime===undefined?0:(timestamp-previousFrameTime)/1000;
  previousFrameTime=timestamp;
  auraEffects.update(delta,{intensity:params.auraIntensity,speed:params.auraSpeed,height:renderer.domElement.height});
  clothMotion.update(delta,{
    enabled:params.clothMotion && !params.showReference,
    strength:params.clothWindStrength,
    speed:params.clothWindSpeed,
  });
  hairMotion.update(delta,{
    enabled:params.hairMotion && !params.showReference,
    strength:params.windStrength,
    speed:params.windSpeed,
  });

  // Smooth camera transition when user clicks a preset
  if (isTransitioningCam) {
    // Use elapsed time so detail views settle even when a background tab renders slowly.
    const blend=1-Math.exp(-8*Math.min(Math.max(delta,0),1));
    camera.position.lerp(targetCamPos,blend);
    controls.target.lerp(targetControlsLook,blend);
    if (camera.position.distanceTo(targetCamPos) < 0.01) {
      isTransitioningCam = false;
    }
  }

  // Turntable rotation (ONLY if user turns it on)
  if (params.autoRotate && !isTransitioningCam) {
    characterGroup.rotation.y += 0.008 * params.rotateSpeed;
  }

  modelFocus.update(delta);
  controls.update();
  handControls.update();
  ringGroup.visible=params.showEclipse && (params.showReference || camera.position.z-controls.target.z>1);
  renderer.render(scene, params.showReference ? orthoCam : camera);
}

// --- 8. Window Resize Handler ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitOrtho();
});

animate();
