// Naive O(n^2) reference matching. Independent algorithm, same tol contract.
export function matchDirectedNaive(A, B, tol) {
  let maxDev = 0, witness = -1, unmatched = 0;
  const tol2 = tol * tol;
  for (let i = 0; i < A.length; i++) {
    let best2 = tol2, found = false;
    for (let j = 0; j < B.length; j++) {
      const d2 = (A[i][0] - B[j][0]) ** 2 + (A[i][1] - B[j][1]) ** 2 + (A[i][2] - B[j][2]) ** 2;
      if (d2 <= best2) { best2 = d2; found = true; }
    }
    if (!found) { unmatched++; continue; }
    const d = Math.sqrt(best2);
    if (d > maxDev) { maxDev = d; witness = i; }
  }
  return { maxDev, witness, unmatched };
}