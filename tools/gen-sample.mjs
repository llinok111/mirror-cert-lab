// Deterministic sample generator: node tools/gen-sample.mjs -> data/assets.json
import { writeFileSync, mkdirSync } from 'node:fs';

function box(cx, cy, cz, hx, hy, hz, flip = false) {
  const p = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) p.push([cx + sx * hx, cy + sy * hy, cz + sz * hz]);
  // local cube corner order: index = (sx<0?0:4) + (sy<0?0:2) + (sz<0?0:1)
  const quads = [
    [0, 1, 3, 2], [4, 6, 7, 5], // x-
    [1, 5, 7, 3], [0, 2, 6, 4], // z-
    [2, 3, 7, 6], [0, 4, 5, 1], // y-
  ];
  const idx = [];
  for (const [a, b, c, d] of quads) { idx.push(a, b, c, a, c, d); }
  if (flip) { const t = idx[0]; idx[0] = idx[1]; idx[1] = t; }
  return { p, idx };
}

function merge(parts) {
  const positions = [], indices = [];
  for (const part of parts) {
    const base = positions.length;
    positions.push(...part.p);
    for (const i of part.idx) indices.push(base + i);
  }
  return { positions, indices };
}

function rotate(positions, ax, ay, az) {
  const [cx, sx] = [Math.cos(ax), Math.sin(ax)], [cy, sy] = [Math.cos(ay), Math.sin(ay)], [cz, sz] = [Math.cos(az), Math.sin(az)];
  return positions.map(([x, y, z]) => {
    let a = x, b = y * cx - z * sx, c = y * sx + z * cx;
    let d = a * cy + c * sy, e = b, f = -a * sy + c * cy;
    return [d * cz - e * sz, d * sz + e * cz, f];
  });
}

const assets = [];

// 1. elongated box -> 3 mirror planes
assets.push({ name: 'box-3planes', ...merge([box(0, 0, 0, 1.5, 0.7, 1.0)]), expectPlanes: 3, kind: 'symmetric' });

// 2. two mirrored arms + central plate -> x=0 and z=0
assets.push({
  name: 'bracket-mirror', kind: 'symmetric', expectPlanes: 2,
  ...merge([box(-1.0, 0.5, 0, 0.5, 0.5, 0.4), box(1.0, 0.5, 0, 0.5, 0.5, 0.4), box(0, 0.3, 0, 0.5, 0.3, 0.4)]),
});

// 3. tilted box: symmetry planes are rotated, not axis aligned
const tilted = box(0, 0, 0, 1.4, 0.6, 0.9);
assets.push({ name: 'tilted-box', kind: 'symmetric', expectPlanes: 3, positions: rotate(tilted.p, 0.35, 0, 0.52), indices: tilted.idx });
assets[2].positions = rotate(assets[2].positions, 0.2, 0.1, 0);

// 4. perturbation decoy: one vertex moved by 5% of the diagonal
{
  const m = merge([box(0, 0, 0, 1.5, 0.7, 1.0)]);
  const d = Math.hypot(3, 1.4, 2);
  m.positions[0] = [m.positions[0][0], m.positions[0][1] + 0.05 * d, m.positions[0][2]];
  assets.push({ name: 'decoy-perturb', kind: 'decoy', expectPlanes: 0, ...m });
}

// 5. shear decoy
{
  const m = merge([box(0, 0, 0, 1.5, 0.7, 1.0)]);
  m.positions = m.positions.map(([x, y, z]) => [x + 0.3 * y, y + 0.2 * z, z + 0.1 * x]);
  assets.push({ name: 'decoy-shear', kind: 'decoy', expectPlanes: 0, ...m });
}

// 6. same surface, different triangulation: must stay accepted (triangulation invariance)
{
  const m = merge([box(0, 0, 0, 1.5, 0.7, 1.0, true)]);
  assets.push({ name: 'retriangulated-box', kind: 'symmetric', expectPlanes: 3, ...m });
}

mkdirSync('data', { recursive: true });
const payload = JSON.stringify({ generatedBy: 'tools/gen-sample.mjs', assets }, null, 0);
writeFileSync('data/assets.json', payload);
console.log('assets', assets.length, 'bytes', payload.length);