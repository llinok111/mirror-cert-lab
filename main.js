import * as THREE from 'three';
import * as C from './src/core.mjs';

const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1116);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.position.set(4, 3, 6);
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1.6);
scene.add(hemi);
scene.add(new THREE.DirectionalLight(0xffffff, 1.2).translateX(4).translateY(6));
const grid = new THREE.GridHelper(10, 20, 0x253041, 0x1a2230);
scene.add(grid);

let target = new THREE.Vector3();
let radius = 6, theta = 0.9, phi = 1.1, dragging = false, lx = 0, ly = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  theta -= (e.clientX - lx) * 0.006; phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi - (e.clientY - ly) * 0.006));
  lx = e.clientX; ly = e.clientY;
});
renderer.domElement.addEventListener('wheel', (e) => { radius = Math.max(1, radius * (1 + Math.sign(e.deltaY) * 0.1)); e.preventDefault(); }, { passive: false });

let group = new THREE.Group();
scene.add(group);

function clear() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); scene.remove(group); group = new THREE.Group(); scene.add(group); }

function draw(mesh, report) {
  clear();
  const pos = mesh.positions.map((p) => new THREE.Vector3(...p));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions.flat(), 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8ab4f8, metalness: 0.15, roughness: 0.55, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1 });
  group.add(new THREE.Mesh(geo, mat));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: 0x2b3b55 }));
  group.add(edges);
  for (const a of report.accepted) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0x50e3a4, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    const n = new THREE.Vector3(...a.plane.n);
    plane.position.copy(n.clone().multiplyScalar(a.plane.d));
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    group.add(plane);
  }
  const box = new THREE.Box3().setFromPoints(pos);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  target = c; radius = size * 1.4;
  grid.position.set(c.x, box.min.y, c.z);
  // witnesses: worst vertex of each accepted plane
  for (const a of report.accepted) {
    if (a.vertex.witness < 0) continue;
    const p = pos[a.vertex.witness];
    const s = new THREE.Mesh(new THREE.SphereGeometry(size * 0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf0c674 }));
    s.position.copy(p);
    group.add(s);
  }
  return report;
}

function frame() {
  requestAnimationFrame(frame);
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.cos(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * Math.sin(phi) * Math.sin(theta));
  camera.lookAt(target);
  renderer.render(scene, camera);
}

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const { assets } = await (await fetch('./data/assets.json')).json();
const sel = document.getElementById('asset');
for (const a of assets) sel.appendChild(new Option(a.name, a.name));
const tbody = document.querySelector('#planes tbody');
const summary = document.getElementById('summary');

function show(name) {
  const a = assets.find((x) => x.name === name);
  const mesh = { positions: a.positions, indices: a.indices };
  const tol = 1e-6 * C.bboxDiag(mesh.positions);
  const report = C.findSymmetries(mesh, { tol });
  draw(mesh, report);
  tbody.innerHTML = '';
  for (const p of report.accepted) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.plane.n.map((x) => x.toFixed(3)).join(', ')}</td><td>${p.plane.d.toFixed(4)}</td><td>${p.maxDev.toExponential(2)}</td>`;
    tbody.appendChild(tr);
  }
  summary.innerHTML = `accepted <span class="${report.accepted.length ? 'ok' : 'no'}">${report.accepted.length}</span> · rejected ${report.rejected.length} · tol ${tol.toExponential(2)} · diag ${report.diag.toFixed(4)}`;
  window.__report = report; // console-verifiable in the page
}
sel.addEventListener('change', () => show(sel.value));
resize(); show(assets[0].name); frame();
