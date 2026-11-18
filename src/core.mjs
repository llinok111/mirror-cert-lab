// mirror-cert-lab core: pure geometry, no three.js / DOM / IO.
// A mirror plane is {n:[x,y,z], d} with unit n and plane n.p = d.
// Reflection: p' = p - 2 (n.p - d) n.

export function bboxDiag(vertices) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of vertices) {
    for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
  }
  return Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
}

export function normalizePlane(n, d) {
  const len = Math.hypot(n[0], n[1], n[2]);
  if (!(len > 0)) return null;
  const nn = [n[0] / len, n[1] / len, n[2] / len];
  let dd = d / len;
  // canonical sign so the same geometric plane dedupes to one key
  for (let k = 0; k < 3; k++) {
    if (Math.abs(nn[k]) > 1e-12) {
      if (nn[k] < 0) { nn[0] = -nn[0]; nn[1] = -nn[1]; nn[2] = -nn[2]; dd = -dd; }
      break;
    }
  }
  return { n: nn, d: dd };
}

export function reflectPoint(p, plane) {
  const t = plane.n[0] * p[0] + plane.n[1] * p[1] + plane.n[2] * p[2] - plane.d;
  return [p[0] - 2 * t * plane.n[0], p[1] - 2 * t * plane.n[1], p[2] - 2 * t * plane.n[2]];
}

export function pointPlaneDistance(p, plane) {
  return Math.abs(plane.n[0] * p[0] + plane.n[1] * p[1] + plane.n[2] * p[2] - plane.d);
}

const key3 = (x, y, z) => x + ',' + y + ',' + z;

export function buildGrid(points, cell) {
  const g = new Map();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const k = key3(Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell));
    let a = g.get(k); if (!a) { a = []; g.set(k, a); } a.push(i);
  }
  return { cell, map: g };
}

// Nearest point within tol. cell >= 2*tol makes the 27-cell neighbourhood complete.
function nearestInGrid(grid, points, q, tol) {
  const { cell, map } = grid;
  const cx = Math.floor(q[0] / cell), cy = Math.floor(q[1] / cell), cz = Math.floor(q[2] / cell);
  let best = -1, best2 = tol * tol;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const a = map.get(key3(cx + dx, cy + dy, cz + dz));
    if (!a) continue;
    for (const j of a) {
      const p = points[j];
      const d2 = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d2 < best2) { best2 = d2; best = j; }
    }
  }
  return { index: best, dist: best < 0 ? Infinity : Math.sqrt(best2) };
}

// One-directional matching: every A point must find a B point within tol.
export function matchDirected(A, B, tol) {
  if (!(tol > 0)) throw new Error('tol must be positive');
  const grid = buildGrid(B, 2 * tol);
  let maxDev = 0, witness = -1, unmatched = 0;
  for (let i = 0; i < A.length; i++) {
    const r = nearestInGrid(grid, B, A[i], tol);
    if (r.index < 0) { unmatched++; continue; }
    if (r.dist > maxDev) { maxDev = r.dist; witness = i; }
  }
  return { maxDev, witness, unmatched };
}

// Two-sided vertex certificate: no A-only and no B-only point inside tol.
export function matchSets(A, B, tol) {
  const fwd = matchDirected(A, B, tol);
  const bwd = matchDirected(B, A, tol);
  return {
    maxDev: Math.max(fwd.maxDev, bwd.maxDev),
    witness: fwd.unmatched ? fwd.witness : bwd.unmatched ? bwd.witness : fwd.witness,
    unmatchedA: fwd.unmatched,
    unmatchedB: bwd.unmatched,
  };
}

export function closestPointTriangle(p, a, b, c) {
  const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  const ap = [p[0]-a[0], p[1]-a[1], p[2]-a[2]];
  const d1 = ab[0]*ap[0]+ab[1]*ap[1]+ab[2]*ap[2], d2 = ac[0]*ap[0]+ac[1]*ap[1]+ac[2]*ap[2];
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = [p[0]-b[0], p[1]-b[1], p[2]-b[2]];
  const d3 = ab[0]*bp[0]+ab[1]*bp[1]+ab[2]*bp[2], d4 = ac[0]*bp[0]+ac[1]*bp[1]+ac[2]*bp[2];
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1*d4 - d3*d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1/(d1-d3); return [a[0]+v*ab[0], a[1]+v*ab[1], a[2]+v*ab[2]]; }
  const cp = [p[0]-c[0], p[1]-c[1], p[2]-c[2]];
  const d5 = ab[0]*cp[0]+ab[1]*cp[1]+ab[2]*cp[2], d6 = ac[0]*cp[0]+ac[1]*cp[1]+ac[2]*cp[2];
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5*d2 - d1*d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2/(d2-d6); return [a[0]+w*ac[0], a[1]+w*ac[1], a[2]+w*ac[2]]; }
  const va = d3*d6 - d5*d4;
  if (va <= 0 && (d4-d3) >= 0 && (d5-d6) >= 0) { const w = (d4-d3)/((d4-d3)+(d5-d6)); return [b[0]+w*(c[0]-b[0]), b[1]+w*(c[1]-b[1]), b[2]+w*(c[2]-b[2])]; }
  const den = 1/(va+vb+vc), v = vb*den, w = vc*den;
  return [a[0]+ab[0]*v+ac[0]*w, a[1]+ab[1]*v+ac[1]*w, a[2]+ab[2]*v+ac[2]*w];
}

// Triangulation-invariant surface check: sampled points must lie on the original surface.
export function surfaceDeviation(mesh, reflPoints, tol) {
  const { positions, indices } = mesh;
  let maxDev = 0, witness = -1;
  for (let s = 0; s < reflPoints.length; s++) {
    let best2 = Infinity;
    for (let f = 0; f < indices.length; f += 3) {
      const q = closestPointTriangle(reflPoints[s], positions[indices[f]], positions[indices[f+1]], positions[indices[f+2]]);
      const d2 = (q[0]-reflPoints[s][0])**2 + (q[1]-reflPoints[s][1])**2 + (q[2]-reflPoints[s][2])**2;
      if (d2 < best2) best2 = d2;
    }
    if (best2 > maxDev*maxDev) { maxDev = Math.sqrt(best2); witness = s; }
  }
  return { maxDev, witness, ok: maxDev <= tol };
}

// Surface sample set: centroid plus half-edge midpoints of every triangle.
export function surfaceSamples(mesh) {
  const { positions, indices } = mesh, out = [];
  for (let f = 0; f < indices.length; f += 3) {
    const a = positions[indices[f]], b = positions[indices[f+1]], c = positions[indices[f+2]];
    out.push([(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, (a[2]+b[2]+c[2])/3]);
  }
  return out;
}

// Vertex-only certificate (deliberately weaker; kept to expose its blind spot).
export function verifyVertexOnly(mesh, plane, tol) {
  const refl = mesh.positions.map((p) => reflectPoint(p, plane));
  const m = matchSets(refl, mesh.positions, tol);
  return { accepted: m.unmatchedA === 0 && m.unmatchedB === 0, ...m };
}

export function verifyReflection(mesh, plane, tol, opts = {}) {
  const refl = mesh.positions.map((p) => reflectPoint(p, plane));
  const v = matchSets(refl, mesh.positions, tol);
  let surf = { maxDev: 0, witness: -1, ok: true };
  if (opts.surface !== false) {
    const samples = surfaceSamples(mesh).map((p) => reflectPoint(p, plane));
    surf = surfaceDeviation(mesh, samples, tol);
  }
  return {
    accepted: v.unmatchedA === 0 && v.unmatchedB === 0 && surf.ok,
    vertex: v,
    surface: surf,
    maxDev: Math.max(v.maxDev, surf.maxDev),
  };
}

// Transform voting: mirror-partner pairs vote for the perpendicular-bisector plane.
export function votePlanes(vertices, opts = {}) {
  const sampleSize = opts.sampleSize ?? 180;
  const maxVotes = opts.maxVotes ?? 12;
  const diag = bboxDiag(vertices);
  const stride = Math.max(1, Math.floor(vertices.length / sampleSize));
  const sample = [];
  for (let i = 0; i < vertices.length && sample.length < sampleSize; i += stride) sample.push(vertices[i]);
  const nBin = 0.06, oBin = 0.005 * diag;
  const buckets = new Map();
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const d = [sample[j][0] - sample[i][0], sample[j][1] - sample[i][1], sample[j][2] - sample[i][2]];
      const len = Math.hypot(d[0], d[1], d[2]);
      if (len < 1e-9 * diag) continue;
      const plane = normalizePlane(d, (d[0] * (sample[i][0] + sample[j][0]) + d[1] * (sample[i][1] + sample[j][1]) + d[2] * (sample[i][2] + sample[j][2])) / 2);
      if (!plane) continue;
      const key = [Math.round(plane.n[0] / nBin), Math.round(plane.n[1] / nBin), Math.round(plane.n[2] / nBin), Math.round(plane.d / oBin)].join('|');
      const b = buckets.get(key);
      if (b) { b.votes++; b.sumN[0] += plane.n[0]; b.sumN[1] += plane.n[1]; b.sumN[2] += plane.n[2]; b.sumD += plane.d; }
      else buckets.set(key, { votes: 1, sumN: [...plane.n], sumD: plane.d });
    }
  }
  const ranked = [...buckets.values()].sort((a, b) => b.votes - a.votes).slice(0, maxVotes)
    .map((b) => normalizePlane(b.sumN, b.sumD / b.votes))
    .filter(Boolean);
  return ranked;
}

export function findSymmetries(mesh, opts = {}) {
  const tol = opts.tol ?? 1e-6 * bboxDiag(mesh.positions);
  const candidates = votePlanes(mesh.positions, opts);
  const accepted = [], rejected = [];
  for (const plane of candidates) {
    const r = verifyReflection(mesh, plane, tol);
    (r.accepted ? accepted : rejected).push({ plane, ...r });
  }
  const dedup = [];
  for (const a of accepted) {
    const near = dedup.find((b) => Math.abs(a.plane.n[0] * b.plane.n[0] + a.plane.n[1] * b.plane.n[1] + a.plane.n[2] * b.plane.n[2]) > 1 - 1e-6 && Math.abs(a.plane.d - b.plane.d) < 1e-4 * bboxDiag(mesh.positions));
    if (!near) dedup.push(a);
  }
  return { tol, candidates, accepted: dedup, rejected, diag: bboxDiag(mesh.positions) };
}

export function signedVolume(mesh) {
  const { positions, indices } = mesh;
  let v = 0;
  for (let f = 0; f < indices.length; f += 3) {
    const a = positions[indices[f]], b = positions[indices[f + 1]], c = positions[indices[f + 2]];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}