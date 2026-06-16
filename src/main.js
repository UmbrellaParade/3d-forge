import "./styles.css";
import { createIcons, Download, Eye, RotateCcw, Save, Upload } from "lucide";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

createIcons({
  icons: {
    Download,
    Eye,
    RotateCcw,
    Save,
    Upload
  }
});

const canvas = document.querySelector("#scene");
const modelStatus = document.querySelector("#modelStatus");
const sourceLabel = document.querySelector("#sourceLabel");
const overlayLabel = document.querySelector("#overlayLabel");
const glbFile = document.querySelector("#glbFile");
const resetCamera = document.querySelector("#resetCamera");
const toggleOverlay = document.querySelector("#toggleOverlay");
const saveConfig = document.querySelector("#saveConfig");
const downloadConfig = document.querySelector("#downloadConfig");
const tailShape = document.querySelector("#tailShape");
const tailColor = document.querySelector("#tailColor");
const tailControls = document.querySelector("#tailControls");
const saveStatus = document.querySelector("#saveStatus");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#151816");

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 250);
camera.position.set(2.7, 1.8, 3.5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.75, 0);

const hemi = new THREE.HemisphereLight("#f8fff8", "#27332f", 1.9);
scene.add(hemi);

const key = new THREE.DirectionalLight("#fff7e8", 2.8);
key.position.set(4, 5, 2);
scene.add(key);

const rim = new THREE.DirectionalLight("#8fd6c8", 1.1);
rim.position.set(-3, 2, -4);
scene.add(rim);

const grid = new THREE.GridHelper(5, 20, "#43524c", "#27302c");
grid.position.y = -0.01;
scene.add(grid);

const axes = new THREE.AxesHelper(0.5);
axes.position.set(-1.4, 0.01, -1.4);
scene.add(axes);

const loader = new GLTFLoader();
let activeModel = null;
let activeModelUrl = null;
const controlElements = new Map();

const state = {
  overlayVisible: true,
  fixConfig: {
    tail: {
      tip_shape: "devil",
      tip_color: "#ff3a18",
      position: [0, 0.85, -0.85],
      rotation: [0, 0, 0],
      scale: 1
    },
    horns: {
      avoid_umbrella: true,
      move: "slightly_outward"
    },
    umbrella: {
      keep_large: true,
      position: "above_head_without_intersection"
    }
  }
};

let tailGroup = createTailTipGroup(state.fixConfig.tail.tip_shape);
scene.add(tailGroup);

const sliders = [
  ["posX", "X", -10, 10, 0.01, () => state.fixConfig.tail.position[0], (v) => (state.fixConfig.tail.position[0] = v)],
  ["posY", "Y", -10, 10, 0.01, () => state.fixConfig.tail.position[1], (v) => (state.fixConfig.tail.position[1] = v)],
  ["posZ", "Z", -10, 10, 0.01, () => state.fixConfig.tail.position[2], (v) => (state.fixConfig.tail.position[2] = v)],
  ["rotX", "RX", -180, 180, 1, () => radToDeg(state.fixConfig.tail.rotation[0]), (v) => (state.fixConfig.tail.rotation[0] = degToRad(v))],
  ["rotY", "RY", -180, 180, 1, () => radToDeg(state.fixConfig.tail.rotation[1]), (v) => (state.fixConfig.tail.rotation[1] = degToRad(v))],
  ["rotZ", "RZ", -180, 180, 1, () => radToDeg(state.fixConfig.tail.rotation[2]), (v) => (state.fixConfig.tail.rotation[2] = degToRad(v))],
  ["scale", "S", 0.05, 8, 0.01, () => state.fixConfig.tail.scale, (v) => (state.fixConfig.tail.scale = v)]
];

buildControls();
loadRuntimeConfig().finally(() => {
  applyTailConfig();
  loadDefaultModel();
});

glbFile.addEventListener("change", () => {
  const file = glbFile.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadModel(url, file.name);
});

resetCamera.addEventListener("click", () => {
  camera.position.set(2.7, 1.8, 3.5);
  controls.target.set(0, 0.75, 0);
  controls.update();
});

toggleOverlay.addEventListener("click", () => {
  state.overlayVisible = !state.overlayVisible;
  tailGroup.visible = state.overlayVisible;
});

saveConfig.addEventListener("click", async () => {
  await saveConfigToProject();
});

downloadConfig.addEventListener("click", async () => {
  await exportConfigJson();
});

tailShape.addEventListener("change", () => {
  state.fixConfig.tail.tip_shape = tailShape.value;
  applyTailConfig();
});

tailColor.addEventListener("input", () => {
  state.fixConfig.tail.tip_color = tailColor.value;
  applyTailConfig();
});

window.addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(render);

async function loadRuntimeConfig() {
  try {
    const response = await fetch("/runtime/fix_requests.json", { cache: "no-store" });
    if (!response.ok) return;
    const json = await response.json();
    state.fixConfig = mergeDeep(state.fixConfig, json);
    modelStatus.textContent = "Config ready";
  } catch {
    modelStatus.textContent = "Config default";
  }
}

function loadDefaultModel() {
  loadModel("/models/current.glb", "/models/current.glb");
}

function loadModel(url, label) {
  modelStatus.textContent = "Loading";
  sourceLabel.textContent = label;
  loader.load(
    url,
    (gltf) => {
      if (activeModel) scene.remove(activeModel);
      if (activeModelUrl) URL.revokeObjectURL(activeModelUrl);
      if (url.startsWith("blob:")) activeModelUrl = url;
      activeModel = gltf.scene;
      activeModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      scene.add(activeModel);
      fitCameraToObject(activeModel);
      updatePositionControlRanges(activeModel);
      modelStatus.textContent = "Model ready";
    },
    undefined,
    () => {
      modelStatus.textContent = "No GLB";
      showPlaceholder();
    }
  );
}

function showPlaceholder() {
  if (activeModel) return;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.68, 10, 18),
    new THREE.MeshStandardMaterial({ color: "#96d7c9", roughness: 0.78 })
  );
  body.position.y = 0.78;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 32, 20),
    new THREE.MeshStandardMaterial({ color: "#f4d1bf", roughness: 0.7 })
  );
  head.position.y = 1.55;
  group.add(body, head);
  activeModel = group;
  scene.add(activeModel);
  sourceLabel.textContent = "placeholder";
  fitCameraToObject(activeModel);
  updatePositionControlRanges(activeModel);
}

function createTailTipGroup(shape) {
  return normalizeTailShape(shape) === "heart" ? createHeartTailTip() : createDevilTailTip();
}

function createTailMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: "#ff3a18",
    emissive: "#541204",
    emissiveIntensity: 0.75,
    roughness: 0.42,
    metalness: 0.04
  });
  material.userData.emissiveScale = 0.32;
  return material;
}

function createDevilTailTip() {
  const group = new THREE.Group();
  group.name = "tail.tip.overlay";
  group.userData.shape = "devil";

  const mat = createTailMaterial();

  const center = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16), mat);
  center.scale.set(1.15, 0.85, 0.78);

  const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 32), mat);
  top.position.y = 0.22;

  const left = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 32), mat);
  left.position.set(-0.19, 0.02, 0);
  left.rotation.z = Math.PI / 2.7;

  const right = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 32), mat);
  right.position.set(0.19, 0.02, 0);
  right.rotation.z = -Math.PI / 2.7;

  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.22, 24), mat);
  socket.position.y = -0.18;

  group.add(center, top, left, right, socket);
  group.userData.materials = [mat];
  return group;
}

function createHeartTailTip() {
  const group = new THREE.Group();
  group.name = "tail.tip.overlay";
  group.userData.shape = "heart";

  const bodyMat = createTailMaterial();
  const outlineMat = new THREE.MeshStandardMaterial({
    color: "#ff3a18",
    emissive: "#ff3a18",
    emissiveIntensity: 1.35,
    roughness: 0.28,
    metalness: 0.02
  });
  bodyMat.userData.emissiveScale = 0.42;
  outlineMat.userData.emissiveScale = 0.95;

  const shape = new THREE.Shape();
  shape.moveTo(0, -0.27);
  shape.bezierCurveTo(-0.32, -0.06, -0.34, 0.2, -0.16, 0.29);
  shape.bezierCurveTo(-0.07, 0.34, -0.01, 0.28, 0, 0.18);
  shape.bezierCurveTo(0.01, 0.28, 0.07, 0.34, 0.16, 0.29);
  shape.bezierCurveTo(0.34, 0.2, 0.32, -0.06, 0, -0.27);

  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 8,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      curveSegments: 36
    }),
    bodyMat
  );
  body.position.z = -0.04;
  body.scale.set(0.9, 1, 0.9);

  const outlinePoints = shape.getPoints(96).map((point) => new THREE.Vector3(point.x, point.y, 0.045));
  const outlineCurve = new THREE.CatmullRomCurve3(outlinePoints, true, "centripetal");
  const outline = new THREE.Mesh(new THREE.TubeGeometry(outlineCurve, 144, 0.025, 12, true), outlineMat);
  outline.scale.copy(body.scale);

  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.22, 24), bodyMat);
  socket.position.y = -0.36;

  group.add(body, outline, socket);
  group.userData.materials = [bodyMat, outlineMat];
  return group;
}

function buildControls() {
  for (const [id, label, min, max, step, getValue, setValue] of sliders) {
    const row = document.createElement("label");
    row.className = "slider-row";
    row.htmlFor = id;

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const input = document.createElement("input");
    input.id = id;
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(getValue());

    const number = document.createElement("input");
    number.type = "number";
    number.step = String(step);
    number.value = formatNumber(getValue());
    number.ariaLabel = `${label} value`;

    const updateValue = (next) => {
      setValue(next);
      applyTailConfig();
    };

    input.addEventListener("input", () => updateValue(Number(input.value)));
    number.addEventListener("change", () => updateValue(Number(number.value)));

    row.append(labelEl, input, number);
    tailControls.append(row);
    controlElements.set(id, { range: input, number });
  }
}

function refreshControls() {
  sliders.forEach(([id, , , , , getValue]) => {
    const controls = controlElements.get(id);
    if (!controls) return;
    const value = getValue();
    controls.range.value = String(value);
    controls.number.value = formatNumber(value);
  });
}

function applyTailConfig() {
  const tail = state.fixConfig.tail;
  const shape = normalizeTailShape(tail.tip_shape);
  if (tailGroup.userData.shape !== shape) {
    replaceTailGroup(shape);
  }
  tailGroup.position.fromArray(tail.position ?? [0, 0.85, -0.85]);
  tailGroup.rotation.fromArray(tail.rotation ?? [0, 0, 0]);
  tailGroup.scale.setScalar(tail.scale ?? 1);
  tailGroup.visible = state.overlayVisible;
  const color = tail.tip_color ?? "#ff3a18";
  tailShape.value = shape;
  tailColor.value = color;
  updateTailMaterials(color);
  overlayLabel.textContent = `tail.tip ${shape}`;
  refreshControls();
}

function replaceTailGroup(shape) {
  const previous = tailGroup;
  tailGroup = createTailTipGroup(shape);
  tailGroup.position.copy(previous.position);
  tailGroup.rotation.copy(previous.rotation);
  tailGroup.scale.copy(previous.scale);
  tailGroup.visible = previous.visible;
  scene.remove(previous);
  disposeGroup(previous);
  scene.add(tailGroup);
}

function updateTailMaterials(color) {
  for (const material of tailGroup.userData.materials ?? []) {
    material.color.set(color);
    material.emissive.set(color).multiplyScalar(material.userData.emissiveScale ?? 0.32);
  }
}

function disposeGroup(group) {
  group.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
  });
  for (const material of group.userData.materials ?? []) {
    material.dispose();
  }
}

function normalizeTailShape(shape) {
  return shape === "heart" ? "heart" : "devil";
}

async function saveConfigToProject() {
  setSaveStatus("Saving...");
  try {
    const response = await fetch("/api/save-config", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(state.fixConfig)
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }

    const result = await response.json();
    setSaveStatus(`Saved ${result.saved_at}`);
  } catch (error) {
    setSaveStatus("Save failed. Use JSON download instead.");
    console.error(error);
  }
}

async function exportConfigJson() {
  setSaveStatus("Exporting JSON...");
  try {
    const response = await fetch("/api/export-config", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(state.fixConfig)
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    const result = await response.json();
    await copyConfigToClipboard();
    setSaveStatus(`Exported ${result.files[0]}`);
  } catch (error) {
    downloadConfigAsFallback();
    setSaveStatus("Downloaded JSON fallback");
    console.error(error);
  }
}

async function copyConfigToClipboard() {
  if (!navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.fixConfig, null, 2));
  } catch {
    // Exporting the project file is the important part; clipboard is a convenience.
  }
}

function downloadConfigAsFallback() {
  const payload = JSON.stringify(state.fixConfig, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fix_requests.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setSaveStatus(message) {
  if (!saveStatus) return;
  saveStatus.textContent = message;
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const fitDistance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(fitDistance * 0.9, fitDistance * 0.55, fitDistance * 1.15));
  camera.near = Math.max(fitDistance / 100, 0.01);
  camera.far = fitDistance * 100;
  camera.updateProjectionMatrix();
  controls.update();
}

function updatePositionControlRanges(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 1);
  const margin = span * 3;
  const ranges = {
    posX: [center.x - margin, center.x + margin],
    posY: [box.min.y - margin * 0.5, box.max.y + margin],
    posZ: [center.z - margin, center.z + margin]
  };

  for (const [id, [min, max]] of Object.entries(ranges)) {
    const controlsForId = controlElements.get(id);
    if (!controlsForId) continue;
    const currentValue = Number(controlsForId.range.value);
    const nextMin = Math.min(min, currentValue - 1);
    const nextMax = Math.max(max, currentValue + 1);
    controlsForId.range.min = formatRangeLimit(nextMin);
    controlsForId.range.max = formatRangeLimit(nextMax);
    controlsForId.number.min = formatRangeLimit(nextMin);
    controlsForId.number.max = formatRangeLimit(nextMax);
  }
  refreshControls();
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

function mergeDeep(base, patch) {
  const result = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && base?.[key]) {
      result[key] = mergeDeep(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function degToRad(value) {
  return THREE.MathUtils.degToRad(value);
}

function radToDeg(value) {
  return THREE.MathUtils.radToDeg(value);
}

function formatNumber(value) {
  return Number(value).toFixed(Math.abs(value) >= 10 ? 0 : 2);
}

function formatRangeLimit(value) {
  return Number(value).toFixed(2);
}
