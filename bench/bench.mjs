import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as C from '../src/core.mjs';
import { matchDirectedNaive } from '../baseline/naive.mjs';

const { assets } = JSON.parse(readFileSync('data/assets.json', 'utf8'));
const meshes = assets.map((a) => ({ name: a.name, positions: a.positions, indices: a.indices }));
const full = () => meshes.map((m) => C.findSymmetries(m, { tol: 1e-6 * C.bboxDiag(m.positions) }));

const coldStart = (() => { const t = performance.now(); full(); return performance.now() - t; })();
const samples = [];
for (let i = 0; i < 7; i++) { const t = performance.now(); full(); samples.push(performance.now() - t); }
const sorted = [...samples].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const stddev = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);

// Baseline: same certificate contract, O(n^2) inner loop, 3000 points.
let seed = 987654321;
const rnd = () => (seed = (1103515245 * seed + 12345) % 2147483648) / 2147483648;
const A = Array.from({ length: 3000 }, () => [rnd() * 4 - 2, rnd() * 4 - 2, rnd() * 4 - 2]);
const S = [...A, ...A.map((p) => C.reflectPoint(p, { n: [1, 0, 0], d: 0 }))];
const R = S.map((p) => C.reflectPoint(p, { n: [1, 0, 0], d: 0 }));
const tol = 1e-9;
const bt = [];
for (let i = 0; i < 3; i++) { const t = performance.now(); matchDirectedNaive(R, S, tol); bt.push(performance.now() - t); }
const gt = [];
for (let i = 0; i < 5; i++) { const t = performance.now(); C.matchDirected(R, S, tol); gt.push(performance.now() - t); }
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const result = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  coldStartMs: +coldStart.toFixed(3),
  samplesMs: samples.map((x) => +x.toFixed(3)),
  medianMs: +median.toFixed(3), p95Ms: +p95.toFixed(3),
  minMs: +sorted[0].toFixed(3), stddevMs: +stddev.toFixed(3), rsdPct: +(100 * stddev / mean).toFixed(2),
  baseline: { points: S.length, naiveMedianMs: +med(bt).toFixed(3), gridMedianMs: +med(gt).toFixed(3), speedup: +(med(bt) / med(gt)).toFixed(2) },
  countercheck: { matched: S.length, maxDev: C.matchDirected(R, S, tol).maxDev },
  assetCounts: full().map((r, i) => ({ name: meshes[i].name, accepted: r.accepted.length })),
  fingerprint: createHash('sha256').update(JSON.stringify(full().map((r) => r.accepted.map((p) => p.plane)))).digest('hex'),
};
writeFileSync('bench/result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
