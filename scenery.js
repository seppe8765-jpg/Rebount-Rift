// Procedural "Sunny Meadow" scenery: trees, bushes, rocks, grass tufts, flowers, fence, ancient stone columns and
// rolling hills. Everything is generated once per map into a few merged static meshes with per-vertex colour
// (and a "sway" weight so foliage and grass move in the wind), so it costs only a handful of draw calls.

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash2(xi, yi) * (1 - u) + hash2(xi + 1, yi) * u) * (1 - v) + (hash2(xi, yi + 1) * (1 - u) + hash2(xi + 1, yi + 1) * u) * v;
}
const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.25 + vnoise(x * 4.3, y * 4.3) * 0.125 + vnoise(x * 8.7, y * 8.7) * 0.0625;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

export const GROUND_Y = -2.5;
// ground height outside the arena: flat near it, rolling hills far away
export function groundH(x, z, R) {
  const r = Math.hypot(x, z);
  const far = smooth(R + 22, R + 120, r);
  return GROUND_Y + far * (fbm(x * 0.012 + 3, z * 0.012 - 7) * 46 - 6) + smooth(R + 4, R + 40, r) * (fbm(x * 0.05, z * 0.05) * 2.2);
}

class Builder {
  constructor() { this.chunks = []; this._new(); }
  _new() { this.c = { pos: [], nrm: [], col: [], idx: [] }; this.chunks.push(this.c); }
  _room(n) { if (this.c.pos.length / 3 + n > 60000) this._new(); }
  vert(p, n, c, sway = 0) { const C = this.c; C.pos.push(p[0], p[1], p[2]); C.nrm.push(n[0], n[1], n[2]); C.col.push(c[0], c[1], c[2], sway); return C.pos.length / 3 - 1; }
  tri(a, b, c) { this.c.idx.push(a, b, c); }
  // lumpy ellipsoid; colorFn(ny, rnd) -> rgb
  blob(cx, cy, cz, rx, ry, rz, colorFn, sway, R, lat = 6, lon = 9, lump = 0.18) {
    this._room((lat + 1) * (lon + 1));
    const base = this.c.pos.length / 3;
    const ph0 = R() * 6.28;
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const ph = (j / lon) * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        const k = 1 + lump * (Math.sin(ph * 3 + ph0 + th * 2) * 0.6 + Math.sin(th * 5 + ph0) * 0.4);
        const c = colorFn(ny, hash2(i * 3.1 + ph0, j * 1.7));
        this.vert([cx + nx * rx * k, cy + ny * ry * k, cz + nz * rz * k], [nx, ny, nz], c, sway);
      }
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const a = base + i * (lon + 1) + j, b = a + lon + 1; this.tri(a, b, a + 1); this.tri(b, b + 1, a + 1); }
  }
  // tapered tube from A to B (open ends capped by a simple fan when cap)
  tube(A, B, r0, r1, seg, colorFn, sway = 0, cap = false) {
    this._room(seg * 2 + 4);
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 1e-6;
    const ax = dx / L, ay = dy / L, az = dz / L;
    // any perpendicular
    let ux = 0, uy = 1, uz = 0; if (Math.abs(ay) > 0.9) { ux = 1; uy = 0; }
    let px = ay * uz - az * uy, py = az * ux - ax * uz, pz = ax * uy - ay * ux; const pl = Math.hypot(px, py, pz); px /= pl; py /= pl; pz /= pl;
    const qx = ay * pz - az * py, qy = az * px - ax * pz, qz = ax * py - ay * px;
    const base = this.c.pos.length / 3;
    for (let k = 0; k < 2; k++) {
      const P = k ? B : A, r = k ? r1 : r0;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const nx = px * c + qx * s, ny = py * c + qy * s, nz = pz * c + qz * s;
        this.vert([P[0] + nx * r, P[1] + ny * r, P[2] + nz * r], [nx, ny, nz], colorFn(k, j / seg), sway * k);
      }
    }
    for (let j = 0; j < seg; j++) { const a = base + j, b = a + seg + 1; this.tri(a, b, a + 1); this.tri(b, b + 1, a + 1); }
    if (cap) {
      const top = this.vert(B, [ax, ay, az], colorFn(1, 0), sway);
      for (let j = 0; j < seg; j++) this.tri(top, base + seg + 1 + j, base + seg + 2 + j);
    }
  }
  // cone with apex up (stacked pine layers); droop makes the rim sag
  cone(cx, cy, cz, r, h, seg, colorFn, sway, R) {
    this._room(seg * 2 + 2);
    const base = this.c.pos.length / 3, tip = this.vert([cx, cy + h, cz], [0, 1, 0], colorFn(1, 0.5), sway);
    const slope = r / h, nl = Math.hypot(1, slope);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = 0.88 + 0.24 * hash2(j, cy * 7);
      this.vert([cx + c * r * k, cy + Math.sin(j * 2.1) * 0.12, cz + s * r * k], [c / nl, slope / nl, s / nl], colorFn(0, hash2(j, cy)), sway);
    }
    for (let j = 0; j < seg; j++) this.tri(tip, base + 1 + j + 1, base + 1 + j);
    // underside
    const ctr = this.vert([cx, cy + 0.05, cz], [0, -1, 0], colorFn(0, 0.2).map((v) => v * 0.55), sway);
    for (let j = 0; j < seg; j++) this.tri(ctr, base + 1 + j, base + 2 + j);
  }
  box(cx, cy, cz, sx, sy, sz, ry, colorFn, jitter = 0, R = Math.random) {
    this._room(24);
    const co = Math.cos(ry), si = Math.sin(ry);
    const faces = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    for (const f of faces) {
      const base = this.c.pos.length / 3;
      const ax = f[0] ? 0 : 1, az = f[2] ? 0 : (f[0] ? 1 : 1);
      // two tangents
      let t1, t2;
      if (f[1]) { t1 = [1, 0, 0]; t2 = [0, 0, 1]; } else if (f[0]) { t1 = [0, 1, 0]; t2 = [0, 0, 1]; } else { t1 = [1, 0, 0]; t2 = [0, 1, 0]; }
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lp = [f[0] * 0.5 + t1[0] * u * 0.5 + t2[0] * v * 0.5, f[1] * 0.5 + t1[1] * u * 0.5 + t2[1] * v * 0.5, f[2] * 0.5 + t1[2] * u * 0.5 + t2[2] * v * 0.5];
        const jx = jitter ? (R() - 0.5) * jitter : 0, jy = jitter ? (R() - 0.5) * jitter : 0;
        const x = lp[0] * sx + jx, y = lp[1] * sy + jy, z = lp[2] * sz;
        const nx = f[0] * co + f[2] * si, nz = -f[0] * si + f[2] * co;
        this.vert([cx + x * co + z * si, cy + y, cz - x * si + z * co], [nx, f[1], nz], colorFn(lp[1] + 0.5, R()));
      }
      // wind the quad so its front faces outwards (no culling, so order is cosmetic)
      this.tri(base, base + 1, base + 2); this.tri(base, base + 2, base + 3);
    }
  }
  blade(x, y, z, h, w, lean, ang, c0, c1, sway) {
    this._room(5);
    const dx = Math.cos(ang), dz = Math.sin(ang), nx = -dz, nz = dx;
    const lx = dx * lean, lz = dz * lean;
    const a = this.vert([x - nx * w, y, z - nz * w], [0, 1, 0], c0, 0), b = this.vert([x + nx * w, y, z + nz * w], [0, 1, 0], c0, 0);
    const mc = mix3(c0, c1, 0.55);
    const c = this.vert([x - nx * w * 0.7 + lx * 0.35, y + h * 0.5, z - nz * w * 0.7 + lz * 0.35], [0, 1, 0], mc, sway * 0.5);
    const d = this.vert([x + nx * w * 0.7 + lx * 0.35, y + h * 0.5, z + nz * w * 0.7 + lz * 0.35], [0, 1, 0], mc, sway * 0.5);
    const e = this.vert([x + lx, y + h, z + lz], [0, 1, 0], c1, sway);
    this.tri(a, b, c); this.tri(b, d, c); this.tri(c, d, e);
  }
  disc(cx, cy, cz, r, seg, col) {
    this._room(seg + 2);
    const ctr = this.vert([cx, cy, cz], [0, 1, 0], col, 0), base = this.c.pos.length / 3;
    for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; this.vert([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r], [0, 1, 0], col, 0); }
    for (let j = 0; j < seg; j++) this.tri(ctr, base + j, base + j + 1);
  }
}

const G_DARK = [0.07, 0.2, 0.05], G_MID = [0.14, 0.36, 0.08], G_LIGHT = [0.34, 0.58, 0.14];
const BARK = [0.26, 0.17, 0.1], BARK_D = [0.15, 0.1, 0.07];

function oak(b, x, y, z, k, R) {
  const h = 4.2 * k, lean = (R() - 0.5) * 0.5;
  const top = [x + lean, y + h, z + lean * 0.6];
  b.tube([x, y - 0.3, z], top, 0.62 * k, 0.3 * k, 9, (e, t) => mul3(BARK, 0.7 + 0.5 * hash2(t * 9, e)), 0);
  // root flare
  for (let i = 0; i < 4; i++) { const a = i * 1.7 + R(); b.tube([x, y + 0.5 * k, z], [x + Math.cos(a) * 0.9 * k, y - 0.1, z + Math.sin(a) * 0.9 * k], 0.22 * k, 0.1 * k, 5, () => BARK_D, 0); }
  // main branches into the crown
  const tones = (hi) => (ny, r) => mix3(mix3(G_DARK, G_MID, 0.4 + 0.5 * r), G_LIGHT, clamp01(ny * 0.5 + 0.35 + hi) * (0.4 + 0.6 * r));
  const crown = [];
  const nb = 5 + Math.floor(R() * 2);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.283 + R() * 0.6, up = 0.6 + R() * 0.7, len = (1.7 + R() * 1.2) * k;
    const end = [top[0] + Math.cos(a) * len, top[1] + up * k, top[2] + Math.sin(a) * len];
    b.tube([top[0], top[1] - 0.8 * k, top[2]], end, 0.2 * k, 0.07 * k, 5, () => BARK, 0.1);
    crown.push(end);
  }
  for (const e of crown) {
    for (let j = 0; j < 3; j++) b.blob(e[0] + (R() - 0.5) * 1.6 * k, e[1] + (R() - 0.2) * 1.3 * k, e[2] + (R() - 0.5) * 1.6 * k, (1.5 + R() * 0.8) * k, (1.2 + R() * 0.6) * k, (1.5 + R() * 0.8) * k, tones((R() - 0.5) * 0.3), 1, R, 6, 9, 0.3);
  }
  b.blob(top[0], top[1] + 1.8 * k, top[2], 2.6 * k, 1.9 * k, 2.6 * k, tones(0.15), 1, R, 7, 10, 0.25);
}
function pine(b, x, y, z, k, R) {
  const h = 9 * k;
  b.tube([x, y - 0.3, z], [x, y + h, z], 0.38 * k, 0.08 * k, 7, (e, t) => mul3(BARK, 0.6 + 0.5 * hash2(t * 9, e)), 0.04);
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1), yy = y + (1.5 + t * 6.2) * k, rr = (3.1 - 2.5 * t) * k;
    b.cone(x, yy, z, rr, 2.8 * k * (1 - 0.25 * t), 11, (ny, r) => mix3(mix3([0.04, 0.17, 0.09], [0.09, 0.3, 0.14], 0.3 + 0.5 * r), [0.2, 0.42, 0.2], ny * 0.5 * t), 1, R);
  }
}
function birch(b, x, y, z, k, R) {
  const h = 5.4 * k;
  const top = [x + (R() - 0.5) * 0.6, y + h, z + (R() - 0.5) * 0.6];
  b.tube([x, y - 0.2, z], top, 0.2 * k, 0.1 * k, 7, (e, t) => (hash2(Math.floor(t * 16) + e * 3, 5.5) > 0.78 ? [0.1, 0.09, 0.08] : [0.88, 0.86, 0.8]), 0.03);
  const tones = (ny, r) => mix3([0.2, 0.46, 0.1], [0.5, 0.72, 0.18], clamp01(ny * 0.5 + 0.4) * (0.5 + 0.5 * r));
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + R(); b.blob(top[0] + Math.cos(a) * 0.9 * k, top[1] - 1.4 * k + i * 0.45 * k, top[2] + Math.sin(a) * 0.9 * k, 1.2 * k, 1.1 * k, 1.2 * k, tones, 1, R, 5, 8, 0.3); }
}
function bush(b, x, y, z, k, R) {
  const f = R() < 0.3;
  for (let i = 0; i < 4; i++) b.blob(x + (R() - 0.5) * 1.3 * k, y + 0.45 * k, z + (R() - 0.5) * 1.3 * k, (0.8 + R() * 0.5) * k, (0.65 + R() * 0.3) * k, (0.8 + R() * 0.5) * k, (ny, r) => mix3(G_DARK, f ? [0.5, 0.5, 0.2] : G_LIGHT, clamp01(ny * 0.6 + 0.3) * (0.4 + 0.6 * r)), 0.8, R, 5, 7, 0.25);
  if (f) for (let i = 0; i < 6; i++) b.blob(x + (R() - 0.5) * 1.8 * k, y + (0.3 + R() * 0.8) * k, z + (R() - 0.5) * 1.8 * k, 0.09, 0.09, 0.09, () => [0.9, 0.15 + R() * 0.2, 0.2], 0.8, R, 3, 5, 0);
}
function rock(b, x, y, z, k, R) {
  const tone = 0.9 + R() * 0.4;
  b.blob(x, y + 0.35 * k, z, k * (0.8 + R() * 0.5), k * (0.5 + R() * 0.3), k * (0.8 + R() * 0.5), (ny, r) => mix3(mul3([0.36, 0.35, 0.33], tone), [0.2, 0.28, 0.1], clamp01(0.5 - ny) * 0.0 + clamp01(ny - 0.1) * 0.35) .map((v, i) => v * (0.85 + 0.3 * r)), 0, R, 5, 8, 0.32);
}
function tuft(b, x, y, z, k, R, tint) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, d = R() * 0.22 * k;
    const c0 = mul3(G_DARK, 0.7 + R() * 0.4), c1 = mix3(G_MID, G_LIGHT, R() * (0.5 + tint));
    b.blade(x + Math.cos(a) * d, y, z + Math.sin(a) * d, (0.55 + R() * 0.55) * k, 0.045 * k, (0.12 + R() * 0.3) * k, R() * 6.283, c0, c1, 1);
  }
}
function flower(b, x, y, z, R) {
  const cols = [[1, 1, 0.9], [1, 0.82, 0.15], [0.95, 0.35, 0.5], [0.55, 0.5, 0.95], [1, 0.55, 0.15]];
  const c = cols[Math.floor(R() * cols.length)], h = 0.35 + R() * 0.3;
  b.tube([x, y, z], [x, y + h, z], 0.012, 0.01, 3, () => [0.18, 0.4, 0.1], 0.6);
  b.blob(x, y + h + 0.03, z, 0.07, 0.05, 0.07, () => c, 0.9, R, 3, 6, 0);
  b.blob(x, y + h + 0.06, z, 0.03, 0.03, 0.03, () => [1, 0.85, 0.2], 0.9, R, 3, 4, 0);
}

export function buildScene(map) { return map.theme.scene === 'dunes' ? buildDunes(map) : buildMeadow(map); }

export function buildMeadow(map) {
  const R0 = map.R, seed = 1234;
  const R = rng(seed);
  const stat = new Builder();   // opaque, windless
  const shad = new Builder();   // blob shadows
  const place = [];

  // ---- rolling ground around the arena
  {
    const rings = 46, seg = 112, r0 = R0 - 0.6, r1 = 260;
    stat._room(1);
    const base = stat.c.pos.length / 3;
    for (let i = 0; i <= rings; i++) {
      const rr = r0 + (r1 - r0) * Math.pow(i / rings, 2.0);
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const y = i === 0 ? GROUND_Y - 0.4 : groundH(x, z, R0);
        const n = fbm(x * 0.09, z * 0.09), n2 = fbm(x * 0.4 + 9, z * 0.4);
        let c = mix3(mix3([0.1, 0.3, 0.05], [0.22, 0.46, 0.1], n), [0.34, 0.5, 0.13], smooth(0.55, 0.8, n2) * 0.6);
        c = mul3(c, 0.85 + 0.3 * n2);
        const mt = smooth(R0 + 90, R0 + 190, rr) * (0.3 + 0.7 * n);
        c = mix3(c, [0.3, 0.38, 0.44], clamp01(mt * 0.8 + (y > 10 ? 0.35 : 0)));
        stat.vert([x, y, z], [0, 1, 0], c, 0);
        if (stat.c.pos.length / 3 > 59000) throw new Error('ground chunk overflow');
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j, b = a + seg + 1; stat.tri(a, a + 1, b); stat.tri(b, a + 1, b + 1); }
    stat._new();
  }

  // ---- decoration scatter (outside the platform)
  const rnd = (a, b) => a + R() * (b - a);
  const spots = (n, rMin, rMax, minD, list) => {
    for (let t = 0, got = 0; t < n * 12 && got < n; t++) {
      const a = R() * 6.283, r = rMin + Math.pow(R(), 1.4) * (rMax - rMin), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (list.every((q) => Math.hypot(q[0] - x, q[1] - z) > minD)) { list.push([x, z]); got++; }
    }
  };
  const trees = [];
  spots(34, R0 + 6, R0 + 62, 6.5, trees);
  trees.forEach(([x, z], i) => {
    const y = groundH(x, z, R0), t = R(), k = 0.85 + R() * 0.55;
    shad.disc(x + 1.2, y + 0.06, z + 0.8, 3.2 * k, 14, [0, 0, 0]);
    if (t < 0.5) oak(stat, x, y, z, k, R); else if (t < 0.82) pine(stat, x, y, z, k, R); else birch(stat, x, y, z, k, R);
  });
  const far = [];
  spots(36, R0 + 62, R0 + 150, 9, far);
  far.forEach(([x, z], i) => { const y = groundH(x, z, R0), k = 1.6 + R() * 1.4; (i % 3 ? pine : oak)(stat, x, y, z, k, R); });
  const bushes = [];
  spots(60, R0 + 2.5, R0 + 48, 3, bushes);
  bushes.forEach(([x, z]) => { const y = groundH(x, z, R0); bush(stat, x, y, z, 0.8 + R() * 0.7, R); shad.disc(x + 0.4, y + 0.05, z + 0.3, 1.1, 10, [0, 0, 0]); });
  const rocks = [];
  spots(34, R0 + 1.5, R0 + 70, 3.5, rocks);
  rocks.forEach(([x, z]) => { const y = groundH(x, z, R0), k = 0.5 + Math.pow(R(), 2) * 2.2; rock(stat, x, y - 0.1, z, k, R); shad.disc(x + 0.3, y + 0.05, z + 0.2, 1.2 * k, 10, [0, 0, 0]); });

  // ---- grass tufts and flowers (dense near the arena, fading out)
  const grass = new Builder();
  for (let i = 0; i < 2300; i++) {
    const a = R() * 6.283, r = R0 + 0.7 + Math.pow(R(), 1.7) * 55, x = Math.cos(a) * r, z = Math.sin(a) * r;
    tuft(grass, x, groundH(x, z, R0) - 0.02, z, 0.85 + R() * 1.1, R, R() * 0.3);
  }
  // lush ring on the platform rim
  for (let i = 0; i < 520; i++) {
    const a = R() * 6.283, r = R0 - 0.1 + R() * 0.9, x = Math.cos(a) * r, z = Math.sin(a) * r;
    tuft(grass, x, 0.02, z, 0.55 + R() * 0.45, R, 0.2);
  }
  for (let i = 0; i < 380; i++) {
    const a = R() * 6.283, r = R0 + 1 + Math.pow(R(), 1.4) * 42, x = Math.cos(a) * r, z = Math.sin(a) * r;
    flower(grass, x, groundH(x, z, R0) - 0.02, z, R);
  }

  // ---- wooden fence on the rim
  const fence = new Builder();
  {
    const n = 72, rr = R0 + 0.12, hgt = 1.05;
    const wood = (e, t) => mul3([0.5, 0.34, 0.2], 0.8 + 0.35 * hash2(t * 4, e * 3.3));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      pts.push([x, z]);
      fence.tube([x, -0.2, z], [x, hgt, z], 0.1, 0.085, 6, wood, 0, true);
      fence.blob(x, hgt + 0.05, z, 0.11, 0.07, 0.11, () => [0.62, 0.45, 0.28], 0, R, 3, 6, 0);
    }
    for (let i = 0; i < n; i++) {
      const A = pts[i], B = pts[(i + 1) % n];
      for (const yy of [0.45, 0.85]) fence.tube([A[0], yy, A[1]], [B[0], yy, B[1]], 0.045, 0.045, 5, wood, 0);
    }
  }

  // ---- ancient stone columns (the cover pillars)
  const cols = new Builder();
  const stone = (e, t, base = [0.62, 0.6, 0.54]) => mul3(base, 0.85 + 0.3 * hash2(t * 11, e * 5.1));
  map.pillars.forEach((pl, idx) => {
    const r = pl.r, h = pl.h, broken = h < 2.5;
    const sh = (ny) => stone(ny, idx * 3.1, [0.64, 0.62, 0.56]);
    // moss and weathering come from the colour function (greener near the ground)
    const shaftCol = (e, t) => {
      const fl = 0.8 + 0.2 * Math.cos(t * Math.PI * 2 * 12); // fluting
      const moss = e === 0 ? 0.5 : 0.08;
      return mix3(mul3([0.66, 0.63, 0.56], fl * (0.85 + 0.3 * hash2(t * 9 + idx, e * 2))), [0.22, 0.4, 0.12], moss * hash2(t * 5, idx));
    };
    cols.box(pl.x, 0.2, pl.z, r * 2.7, 0.4, r * 2.7, idx, (y, rr) => mix3(mul3([0.55, 0.53, 0.48], 0.85 + 0.3 * rr), [0.25, 0.4, 0.14], 0.25), 0.06, R);
    cols.tube([pl.x, 0.38, pl.z], [pl.x, 0.75, pl.z], r * 1.22, r * 1.05, 20, (e, t) => stone(e, t), 0, true);
    if (!broken) {
      cols.tube([pl.x, 0.7, pl.z], [pl.x, h - 0.45, pl.z], r * 0.97, r * 0.84, 22, shaftCol, 0);
      cols.tube([pl.x, h - 0.5, pl.z], [pl.x, h - 0.2, pl.z], r * 0.86, r * 1.18, 20, (e, t) => stone(e, t), 0, true);
      cols.box(pl.x, h - 0.05, pl.z, r * 2.7, 0.3, r * 2.7, idx + 0.4, (y, rr) => stone(y, rr), 0.03, R);
    } else {
      // snapped column: rough jagged top
      cols.tube([pl.x, 0.7, pl.z], [pl.x, h - 0.1, pl.z], r * 0.97, r * 0.92, 18, shaftCol, 0, false);
      const cap = cols.vert([pl.x, h + 0.05, pl.z], [0, 1, 0], stone(1, 3), 0);
      for (let j = 0; j < 18; j++) {
        const a = (j / 18) * 6.283, rr2 = r * 0.92;
        const v1 = cols.vert([pl.x + Math.cos(a) * rr2, h - 0.1 + 0.28 * hash2(j, idx), pl.z + Math.sin(a) * rr2], [0, 1, 0], stone(1, j * 0.3), 0);
        const v2 = cols.vert([pl.x + Math.cos(a + 0.349) * rr2, h - 0.1 + 0.28 * hash2(j + 1, idx), pl.z + Math.sin(a + 0.349) * rr2], [0, 1, 0], stone(1, j * 0.3 + 1), 0);
        cols.tri(cap, v1, v2);
      }
      for (let i = 0; i < 4; i++) { const a = i * 1.7 + idx; rock(cols, pl.x + Math.cos(a) * r * 1.9, 0, pl.z + Math.sin(a) * r * 1.9, 0.28 + R() * 0.2, R); }
    }
    // ivy at the foot
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + idx; cols.blob(pl.x + Math.cos(a) * r * 1.0, 0.45 + R() * 0.5, pl.z + Math.sin(a) * r * 1.0, 0.3, 0.35, 0.3, (ny, rr) => mix3(G_DARK, G_LIGHT, 0.3 + 0.4 * rr), 0.4, R, 4, 6, 0.3); }
    shad.disc(pl.x + h * 0.18, 0.05, pl.z + h * 0.12, r * 1.7, 18, [0, 0, 0]);
  });

  return { stat: stat.chunks, grass: grass.chunks, fence: fence.chunks, cols: cols.chunks, shadow: shad.chunks };
}

// ------------------------------------------------------------------ Twilight Dunes (blue desert)
function cactus(b, x, y, z, k, R) {
  const dark = () => mul3([0.04, 0.1, 0.24], 0.8 + R() * 0.5);
  const ridge = (e, t) => mul3([0.05, 0.12, 0.3], 0.72 + 0.28 * Math.abs(Math.cos(t * Math.PI * 2 * 5)));
  const h = (4.2 + R() * 3) * k;
  b.tube([x, y - 0.2, z], [x, y + h, z], 0.38 * k, 0.3 * k, 10, ridge, 0.03);
  b.blob(x, y + h, z, 0.3 * k, 0.3 * k, 0.3 * k, dark, 0.03, R, 4, 8, 0);
  const arms = 1 + Math.floor(R() * 3);
  for (let i = 0; i < arms; i++) {
    const a = R() * 6.283, hy = y + h * (0.35 + R() * 0.3), len = (1.0 + R() * 0.8) * k, up = (1.2 + R() * 1.6) * k;
    const ex = x + Math.cos(a) * len, ez = z + Math.sin(a) * len;
    b.tube([x, hy, z], [ex, hy + 0.1, ez], 0.2 * k, 0.2 * k, 8, ridge, 0);
    b.tube([ex, hy, ez], [ex, hy + up, ez], 0.2 * k, 0.16 * k, 8, ridge, 0.03);
    b.blob(ex, hy + up, ez, 0.17 * k, 0.17 * k, 0.17 * k, dark, 0.03, R, 4, 7, 0);
  }
}
function dune(b, x, y, z, rx, ry, rz, R) {
  b.blob(x, y, z, rx, ry, rz, (ny, r) => mix3([0.07, 0.16, 0.5], [0.16, 0.32, 0.8], clamp01(ny * 0.8 + 0.2)), 0, R, 6, 12, 0.05);
}
function sandRock(b, x, y, z, k, R) {
  b.blob(x, y + 0.3 * k, z, k * (0.9 + R() * 0.5), k * (0.55 + R() * 0.3), k * (0.9 + R() * 0.5), (ny, r) => mul3([0.04, 0.07, 0.2], 0.8 + 0.5 * r + 0.3 * clamp01(ny)), 0, R, 5, 8, 0.3);
}

export function buildDunes(map) {
  const R0 = map.R, R = rng(777);
  const stat = new Builder(), shad = new Builder(), grass = new Builder(), cols = new Builder();
  {
    const rings = 46, seg = 112, r0 = R0 - 0.6, r1 = 260;
    const base = stat.c.pos.length / 3;
    for (let i = 0; i <= rings; i++) {
      const rr = r0 + (r1 - r0) * Math.pow(i / rings, 2.0);
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const far = smooth(R0 + 20, R0 + 120, rr);
        const y = i === 0 ? GROUND_Y - 0.4 : GROUND_Y + far * (fbm(x * 0.015 + 1, z * 0.015) * 30 - 4) + smooth(R0 + 4, R0 + 40, rr) * fbm(x * 0.06, z * 0.06) * 2.5;
        const n = fbm(x * 0.08, z * 0.08), rip = 0.5 + 0.5 * Math.sin((x * 0.9 + z * 0.35 + n * 6) * 2.2);
        const c = mix3(mix3([0.05, 0.12, 0.42], [0.1, 0.22, 0.62], n), [0.14, 0.3, 0.78], rip * 0.35);
        stat.vert([x, y, z], [0, 1, 0], c, 0);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j, b = a + seg + 1; stat.tri(a, a + 1, b); stat.tri(b, a + 1, b + 1); }
    stat._new();
  }
  const spots = (n, rMin, rMax, minD, list) => {
    for (let t = 0, got = 0; t < n * 12 && got < n; t++) {
      const a = R() * 6.283, r = rMin + Math.pow(R(), 1.3) * (rMax - rMin), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (list.every((q) => Math.hypot(q[0] - x, q[1] - z) > minD)) { list.push([x, z]); got++; }
    }
  };
  const gy = (x, z) => { const rr = Math.hypot(x, z), far = smooth(R0 + 20, R0 + 120, rr); return GROUND_Y + far * (fbm(x * 0.015 + 1, z * 0.015) * 30 - 4) + smooth(R0 + 4, R0 + 40, rr) * fbm(x * 0.06, z * 0.06) * 2.5; };
  const cs = []; spots(40, R0 + 6, R0 + 110, 8, cs);
  cs.forEach(([x, z]) => { const y = gy(x, z); cactus(stat, x, y, z, 0.8 + R() * 0.8, R); shad.disc(x + 1, y + 0.06, z + 0.7, 1.6, 10, [0, 0, 0]); });
  const rs = []; spots(40, R0 + 2, R0 + 90, 4, rs);
  rs.forEach(([x, z]) => { const y = gy(x, z), k = 0.5 + Math.pow(R(), 2) * 2.4; sandRock(stat, x, y - 0.1, z, k, R); shad.disc(x + 0.3, y + 0.05, z + 0.2, 1.2 * k, 10, [0, 0, 0]); });
  const ds = []; spots(18, R0 + 25, R0 + 150, 18, ds);
  ds.forEach(([x, z]) => dune(stat, x, gy(x, z) - 1, z, 14 + R() * 12, 3 + R() * 4, 12 + R() * 10, R));
  // flat sandstone plates lying around (like the stepping slabs in the reference)
  for (let i = 0; i < 6; i++) { const a = R() * 6.283, r = R0 + 12 + R() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r; stat.box(x, gy(x, z) + 0.15, z, 9 + R() * 8, 0.35, 5 + R() * 5, R() * 3, (y) => [0.04, 0.09, 0.26], 0.05, R); }
  // small dry tufts and pebbles on the rim and around
  for (let i = 0; i < 900; i++) { const a = R() * 6.283, r = R0 + 0.5 + Math.pow(R(), 1.6) * 50, x = Math.cos(a) * r, z = Math.sin(a) * r; grass.blade(x, gy(x, z), z, 0.25 + R() * 0.3, 0.03, 0.1, R() * 6.283, [0.04, 0.1, 0.3], [0.1, 0.22, 0.6], 1); }
  // sandstone spires as the cover pillars
  map.pillars.forEach((pl, idx) => {
    const r = pl.r, h = pl.h;
    const rock = (e, t) => mul3([0.1, 0.17, 0.42], 0.75 + 0.25 * hash2(Math.floor(t * 14) + idx, e * 2) + 0.15 * e);
    cols.tube([pl.x, 0, pl.z], [pl.x, h * 0.55, pl.z], r * 1.15, r * 0.95, 14, rock, 0);
    cols.tube([pl.x, h * 0.55, pl.z], [pl.x, h, pl.z], r * 0.95, r * 0.8, 14, rock, 0, true);
    cols.blob(pl.x, h + 0.05, pl.z, r * 0.95, 0.35, r * 0.95, () => [0.14, 0.24, 0.55], 0, R, 4, 10, 0.12);
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + idx; sandRock(cols, pl.x + Math.cos(a) * r * 1.7, 0, pl.z + Math.sin(a) * r * 1.7, 0.3 + R() * 0.25, R); }
    shad.disc(pl.x + h * 0.18, 0.05, pl.z + h * 0.12, r * 1.6, 18, [0, 0, 0]);
  });
  return { stat: stat.chunks, grass: grass.chunks, fence: [], cols: cols.chunks, shadow: shad.chunks };
}
