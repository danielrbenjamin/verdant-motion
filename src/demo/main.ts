import { demoLayout } from './layout';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Nature, TREE_PRESETS, type Tree, setAssetBasePath } from '../lib';
import { advanceSeason } from './season-playback';
import { smooth } from '../lib/math';
import './style.css';
setAssetBasePath(import.meta.env.BASE_URL);
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = demoLayout;
const select = document.querySelector<HTMLSelectElement>('#preset')!;
for (const p of TREE_PRESETS) {
  const o = document.createElement('option');
  o.value = p;
  o.textContent = p;
  select.append(o);
}
select.value = 'Oak Large';
const view = document.getElementById('view')!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
camera.position.set(32, 18, 36);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.setClearColor(0x000000, 0);
view.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 5, 0);
controls.minDistance = 4;
controls.maxDistance = 240;
controls.maxPolarAngle = Math.PI / 2.04;
// Neutral studio lighting; the canvas has no sky, ground, fog or backdrop geometry.
scene.add(new THREE.HemisphereLight(0xeaf1ff, 0x728276, 2));
const key = new THREE.DirectionalLight(0xfff4df, 3);
key.position.set(30, 60, 40);
scene.add(key);
const rim = new THREE.DirectionalLight(0xd5e8ff, 2);
rim.position.set(-40, 30, -25);
scene.add(rim);
let growing = false;
let growthStart = 0,
  growthElapsed = 0;
let nature: Nature;
let activeTree: Tree | undefined;
let playing = false;
let direction = 1;
let time = 0,
  last = performance.now(),
  frames = 0,
  fpsTime = 0;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function values() {
  return {
    season: Number($<HTMLInputElement>('season').value),
    growth: Number($<HTMLInputElement>('growth').value),
    health: Number($<HTMLInputElement>('health').value),
    wind: Number($<HTMLInputElement>('wind').value),
  };
}
function grassValues() {
  return {
    count: Number($<HTMLInputElement>('grass-count').value),
    size: Number($<HTMLInputElement>('grass-size').value),
  };
}
function flowerValues() {
  return {
    count: Number($<HTMLInputElement>('flower-count').value),
    size: Number($<HTMLInputElement>('flower-size').value),
  };
}
function updateLabels() {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[type=range]')) {
    const progress =
      ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty('--progress', progress + '%');
  }
  const v = values();
  for (const k of ['season', 'growth', 'health', 'wind'])
    $<HTMLOutputElement>(`${k}-out`).value = `${Math.round(v[k as keyof typeof v] * 100)}%`;
  const grass = grassValues();
  $<HTMLOutputElement>('grass-count-out').value = grass.count.toLocaleString();
  $<HTMLOutputElement>('grass-size-out').value = `${Math.round(grass.size * 100)}%`;
  const flowers = flowerValues();
  $<HTMLOutputElement>('flower-count-out').value = flowers.count.toLocaleString();
  $<HTMLOutputElement>('flower-size-out').value = `${Math.round(flowers.size * 100)}%`;
  const s = v.season;
  $('season-name').textContent =
    s < 0.18 || s > 0.92 ? 'WINTER' : s < 0.38 ? 'SPRING' : s < 0.69 ? 'SUMMER' : 'AUTUMN';
  nature?.setState(v);
}
function setup() {
  if (nature) {
    scene.remove(nature);
    nature.dispose();
  }
  nature = new Nature();
  const t = nature.addTree({
    preset: select.value,
    seed: Number($<HTMLInputElement>('seed').value),
    fallingLeaves: 160,
    proceduralGrowth: $<HTMLInputElement>('procedural-growth').checked,
  });
  t.castShadow = true;
  activeTree = t;
  if ($<HTMLInputElement>('grass').checked)
    nature.addGrass({ preset: 'meadow', ...grassValues(), area: [1000, 1000], seed: 32 });
  if ($<HTMLInputElement>('flowers').checked)
    nature.addFlower({ preset: 'daisy', ...flowerValues(), area: [1000, 1000], seed: 7 });
  nature.setState(values());
  scene.add(nature);
  $('scene-title').textContent = select.value;
}
function fitTree() {
  if (!activeTree) return;
  const box = new THREE.Box3().setFromObject(activeTree);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 1);
  const distance =
    Math.max(
      height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
      size.x /
        (2 *
          Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect))),
    ) * 1.25;
  const target = new THREE.Vector3(center.x, height * 0.45, center.z);
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(target);
  camera.position.copy(target).add(direction.multiplyScalar(distance));
  controls.minDistance = Math.max(2, distance * 0.25);
  controls.maxDistance = Math.max(80, distance * 5);
  camera.updateProjectionMatrix();
}
function resize() {
  const w = view.clientWidth,
    h = view.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  fitTree();
}
const ro = new ResizeObserver(resize);
ro.observe(view);
select.addEventListener('change', () => {
  setup();
  fitTree();
});
$('procedural-growth').addEventListener('change', () => {
  growing = false;
  $('grow').textContent = '▶ Grow from seedling';
  const enabled = $<HTMLInputElement>('procedural-growth').checked;
  $<HTMLInputElement>('growth').disabled = !enabled;
  $<HTMLButtonElement>('grow').disabled = !enabled;
  setup();
});
$('grow').addEventListener('click', () => {
  growing = !growing;
  if (growing && Number($<HTMLInputElement>('growth').value) >= 1)
    $<HTMLInputElement>('growth').value = '0';
  if (growing) {
    growthStart = Number($<HTMLInputElement>('growth').value);
    growthElapsed = 0;
  }
  $('grow').textContent = growing ? 'Ⅱ Pause growth' : '▶ Resume growth';
  updateLabels();
});
$('seed').addEventListener('change', setup);
$('random').addEventListener('click', () => {
  $<HTMLInputElement>('seed').value = String(Math.floor(Math.random() * 999999));
  setup();
});
for (const k of ['grass', 'flowers']) $(k).addEventListener('change', setup);
for (const k of ['grass-count', 'grass-size']) $(k).addEventListener('input', updateLabels);
for (const k of ['grass-count', 'grass-size']) $(k).addEventListener('change', setup);
for (const k of ['flower-count', 'flower-size']) $(k).addEventListener('input', updateLabels);
for (const k of ['flower-count', 'flower-size']) $(k).addEventListener('change', setup);
for (const k of ['season', 'growth', 'health', 'wind'])
  $(k).addEventListener('input', () => {
    if (k === 'growth') {
      growing = false;
      $('grow').textContent = '▶ Resume growth';
    }
    playing = false;
    $('play').innerHTML = '▶ &nbsp; Play seasons';
    updateLabels();
  });
$('play').addEventListener('click', () => {
  playing = !playing;
  $('play').innerHTML = playing ? 'Ⅱ &nbsp; Pause seasons' : '▶ &nbsp; Play seasons';
});
$('reverse').addEventListener('click', () => {
  direction *= -1;
  playing = true;
  $('play').innerHTML = 'Ⅱ &nbsp; Pause seasons';
});
$('reset').addEventListener('click', () => {
  playing = false;
  growing = false;
  $('grow').textContent = '▶ Grow from seedling';
  direction = 1;
  for (const [k, v] of Object.entries({ season: 0.5, growth: 1, health: 1, wind: 0.25 }))
    $<HTMLInputElement>(k).value = String(v);
  $('play').innerHTML = '▶ &nbsp; Play seasons';
  updateLabels();
});
function tick(now: number) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  frames++;
  fpsTime += dt;
  if (fpsTime > 1) {
    $('fps').textContent = `${Math.round(frames / fpsTime)} FPS`;
    fpsTime = 0;
    frames = 0;
  }
  if (playing) {
    const el = $<HTMLInputElement>('season');
    el.value = String(
      advanceSeason(Number(el.value), (direction * dt) / 18, activeTree?.hasFallingLeaves ?? false),
    );
    updateLabels();
  }
  if (growing) {
    const el = $<HTMLInputElement>('growth');
    const duration = Math.max(1, Number($<HTMLInputElement>('growth-duration').value) || 12);
    growthElapsed += dt;
    el.value = String(growthStart + (1 - growthStart) * smooth(0, 1, growthElapsed / duration));
    if (Number(el.value) >= 1) {
      growing = false;
      $('grow').textContent = '▶ Grow from seedling';
    }
    updateLabels();
  }
  nature.update(dt, time);
  controls.update();
  renderer.render(scene, camera);
}
setup();
updateLabels();
resize();
requestAnimationFrame(tick);
