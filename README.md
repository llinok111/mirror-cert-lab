# mirror-cert-lab

**Promise:** find the mirror-symmetry planes of a triangle mesh and accept each one only after a **two-sided vertex match + triangulation-invariant surface-distance check**, with a worst-deviation witness. On 6 deterministic assets it recovers **11/11 expected planes** on 4 symmetric shapes (3+2+3+3) and accepts **0 planes on 2 decoys** at `tol = 1e-6·bboxDiag` — 13/13 assertions pass; the O(n²) baseline agrees bit-for-bit on 6,000 points.

Upstream: none

## Run it

```bash
node tools/gen-sample.mjs     # writes data/assets.json (deterministic)
node bench/verify.mjs         # 13 assertions, exit 0 required
node bench/bench.mjs          # writes bench/result.json
python3 -m http.server 4173   # open http://localhost:4173 (three.js via CDN importmap)
```

Only the browser viewer needs a network; `src/core.mjs` is dependency-free and runs under plain `node`.

## What it proves

| claim | measured | baseline |
|---|---|---|
| symmetric assets recovered | 4/4 assets, 11/11 expected planes, max deviation ≤ **6.75e-16** | naive plane guessing would need the plane as input |
| decoys rejected | 2/2 (5% vertex perturbation; 3-axis shear), **0** accepted | vertex-only test also rejects both here |
| triangulation invariance | retriangulated box: **3/3** planes still accepted (same surface, different diagonals) | face-centroid checks fail this by construction |
| scale invariance | box scaled to 1e-6, 1e-3, 1, 1e3, 1e6 → **3/3** planes at every scale | absolute-tolerance checks break outside one scale |
| matching cross-check | grid vs O(n²): maxDev 0, unmatched 0 on 6,000 points | `baseline/naive.mjs` |
| matching speed | **55.1 ms** grid vs **83.9 ms** naive (1.52×, 6,000 points) | `baseline/naive.mjs`, same `tol` contract |
| full 6-asset certificate | cold 30.0 ms; 7 samples median **11.15 ms**, p95 14.97, RSD 12.0% | — |

`bench/result.json` is the machine-readable source of every number above. The 12.0% RSD is JIT warm-up plus GC on 6 small meshes (the timed unit is ~11 ms); cold start is reported separately (30.0 ms).

## How the certificate works

1. **Transform voting** (`votePlanes`): up to 180 evenly strided vertices are paired; each pair votes for its perpendicular-bisector plane in a `(normal, offset)` hash. The top 12 vote buckets are refined to unit planes. This finds tilted planes too — the `tilted-box` asset's planes are rotated, not axis-aligned.
2. **Two-sided vertex match** (`matchSets`): every reflected vertex must have an original vertex within `tol`, **and** every original vertex must have a reflected partner. A uniform hash grid with `cell = 2·tol` makes the 27-cell query exact for that radius.
3. **Surface check** (`surfaceDeviation`): every triangle centroid is reflected and its exact distance to the *original triangle set* is measured (closest-point-on-triangle). This is invariant to how the surface is triangulated.
4. **Witness**: the sample/vertex with the largest deviation is reported and drawn in the viewer.

The viewer recomputes the same `findSymmetries` call in the browser from `src/core.mjs` and prints maxDev per plane, so the on-screen numbers and the node numbers come from one implementation.

## 本轮创新

B 档 — **几何级镜像证书，而不是面表比对**：用「变换投票找倾斜平面 + 双向顶点匹配 + 对三角剖分不变的最小曲面距离」三层证据接受一个对称面，并输出最坏偏差见证点；同一份 `core.mjs` 在 node 与浏览器复算。台账里的 `curvature-scale-lab`（曲率符号）、`viewshed-lab`（高度场可见性）、`quantbound-lab`（量化误差）都不做对称性；常见 three.js 对称 demo 只画镜像副本，不给接受/拒绝契约，也没有反例（5% 扰动、剪切）与重三角化正控制。

## 已知限制

- **只做镜像（反射）对称**，不做旋转对称；候选来自 180 点采样投票，票数极低或采样漏掉镜像伙伴的平面会漏检（本项目 4 个对称形状上 0 漏检，但这不是普遍保证）。
- 接受阈值是**相对于 bbox 对角线**的 `tol = 1e-6·diag`；这是尺度不变的（已在 1e-6…1e6 验证），但**不是**无单位的绝对精度：几何本身偏差大于该阈值就会被拒（这正是 `threshold-semantics` 断言：5% 扰动在 `0.2·diag` 容差下会被接受）。
- 曲面检查对每个三角形质心做**暴力**最近三角形查询，复杂度 O(样本数 × 三角形数)；语料只有 12–36 个三角形。大网格需要 BVH，本仓库**没有**做，也没有大网格性能声明。
- 网格必须是**三角形**；四边形/多边形需先三角化（`retriangulated-box` 说明三角化方式不影响结论）。
- 反例只有两类（顶点扰动、三轴剪切），**没有**穷举所有近似对称；`decoy` 的 0 接受只对这些语料成立。
- 无像素级截图证据；G6 只验证 HTTP 200 + importmap 存在，浏览器端数字由同一 core 复算，未做截图比对。
- 匹配加速只有 1.52×，因为 6,000 点是**小规模**且哈希键是字符串；本项目的主张是证书语义，不是匹配吞吐。

## Layout

```
index.html / main.js      viewer (three.js 0.160.0 importmap, one orbit interaction)
src/core.mjs              pure ESM geometry (no three / DOM / IO)
tools/gen-sample.mjs      deterministic assets -> data/assets.json
bench/verify.mjs          13 assertions
bench/bench.mjs           7 samples + cold start -> bench/result.json
baseline/naive.mjs        O(n²) reference matcher
```
