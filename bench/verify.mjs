import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as C from '../src/core.mjs';
import { matchDirectedNaive } from '../baseline/naive.mjs';

const { assets } = JSON.parse(readFileSync('data/assets.json', 'utf8'));
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS ${name} :: ${detail}`); }
  else { fail++; console.log(`FAIL ${name} :: ${detail}`); }
}
const meshOf = (a) => ({ positions: a.positions, indices: a.indices });
const tolOf = (m) => 1e-6 * C.bboxDiag(m.positions);
const run = (m) => C.findSymmetries(m, { tol: tolOf(m) });

for (const a of assets.filter((x) => x.kind === 'symmetric')) {
  const r = run(meshOf(a));
  check(`symmetry:${a.name}`, r.accepted.length === a.expectPlanes,
    `${r.accepted.length}/${a.expectPlanes} planes, maxDev=${r.accepted.length ? Math.max(...r.accepted.map((p) => p.maxDev)).toExponential(2) : 'n/a'}`);
}
for (const a of assets.filter((x) => x.kind === 'decoy')) {
  const r = run(meshOf(a));
  check(`decoy:${a.name}`, r.accepted.length === 0, `${r.accepted.length} accepted, candidates=${r.candidates.length}`);
}

// Triangulation invariance: same surface, different diagonals -> still 3 planes.
const rt = assets.find((a) => a.name === 'retriangulated-box');
check('triangulation-invariance', run(meshOf(rt)).accepted.length === 3, `${run(meshOf(rt)).accepted.length}/3`);

// Scale invariance over 12 orders of magnitude.
const box = assets.find((a) => a.name === 'box-3planes');
const scales = [1e-6, 1e-3, 1, 1e3, 1e6];
const counts = [];
for (const s of scales) {
  const m = { positions: box.positions.map((p) => p.map((x) => x * s)), indices: box.indices };
  counts.push(run(m).accepted.length);
}
check('scale-invariance', counts.every((n) => n === 3), `scales ${scales.join(',')} -> ${counts.join(',')}`);

// Certificate threshold semantics: 5% perturbation is rejected at 1e-6 diag, accepted at 0.2 diag.
const pm = assets.find((a) => a.name === 'decoy-perturb');
const loose = C.findSymmetries(meshOf(pm), { tol: 0.2 * C.bboxDiag(pm.positions) });
check('threshold-semantics', loose.accepted.length > 0,
  `perturbed mesh accepted at 0.2*diag (${loose.accepted.length} planes), rejected at 1e-6*diag`);

// Naive O(n^2) cross-check on a reflected point set.
const rnd = (() => { let s = 12345; return () => (s = (1103515245 * s + 12345) % 2147483648) / 2147483648; })();
const A = Array.from({ length: 300 }, () => [rnd() * 4 - 2, rnd() * 4 - 2, rnd() * 4 - 2]);
const S = [...A, ...A.map((p) => C.reflectPoint(p, { n: [1, 0, 0], d: 0 }))];
const R = S.map((p) => C.reflectPoint(p, { n: [1, 0, 0], d: 0 }));
const tol = 1e-9, fast = C.matchDirected(R, S, tol), slow = matchDirectedNaive(R, S, tol);
check('naive-cross-check', fast.maxDev === slow.maxDev && fast.unmatched === slow.unmatched,
  `fast(maxDev=${fast.maxDev.toExponential(2)},unmatched=${fast.unmatched}) naive(maxDev=${slow.maxDev.toExponential(2)},unmatched=${slow.unmatched})`);

// Determinism.
const h = () => createHash('sha256').update(JSON.stringify(assets.map((a) => run(meshOf(a)).accepted.map((p) => p.plane)))).digest('hex');
const h1 = h(), h2 = h();
check('determinism', h1 === h2, `sha256 ${h1.slice(0, 16)} twice`);

// No plane may pass on a 1% perturbation at 1e-6 diag (tight certificate).
const pm2 = assets.find((a) => a.name === 'decoy-perturb');
check('no-false-accept', run(meshOf(pm2)).accepted.length === 0 && run(meshOf(assets.find((a) => a.name === 'decoy-shear'))).accepted.length === 0,
  'perturb+shear: 0 accepted');

// Surface certificate itself must see a real surface change.
const moved = meshOf(box);
const movedPos = moved.positions.map((p) => [...p]);
movedPos[0] = [movedPos[0][0], movedPos[0][1] + 0.05 * C.bboxDiag(moved.positions), movedPos[0][2]];
const origSamples = C.surfaceSamples(meshOf(box));
const surf = C.surfaceDeviation({ positions: movedPos, indices: moved.indices }, origSamples, 1e-6 * C.bboxDiag(moved.positions));
check('surface-sees-perturbation', surf.ok === false, `surface maxDev=${surf.maxDev.toExponential(2)} > tol=${(1e-6 * C.bboxDiag(moved.positions)).toExponential(2)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
