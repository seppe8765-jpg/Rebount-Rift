// Minimal WebGL1 toolkit (no dependencies): matrices, shader helper, primitive meshes.
// Kept tiny on purpose: CrazyGames wants fast loading and a small bundle.

// ------------------------------------------------------------------ mat4 (column-major)
export const mat4 = {
  create() { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  perspective(o, fovy, aspect, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = t / aspect; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f);
    return o;
  },
  lookAt(o, ex, ey, ez, cx, cy, cz) {
    let zx = ex - cx, zy = ey - cy, zz = ez - cz;
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    // up = (0,1,0): x = up x z
    let xx = zz, xy = 0, xz = -zx;
    l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },
  mul(o, a, b) {
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  },
  // translate * rotateY * scale
  trs(o, tx, ty, tz, ry, sx, sy, sz) {
    const c = Math.cos(ry), s = Math.sin(ry);
    o[0] = c * sx; o[1] = 0; o[2] = -s * sx; o[3] = 0;
    o[4] = 0; o[5] = sy; o[6] = 0; o[7] = 0;
    o[8] = s * sz; o[9] = 0; o[10] = c * sz; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  },
  // translate * Ry(ry) * Rx(rx) * Rz(rz) * scale  (used for limbs / sword that are tilted)
  trsE(o, tx, ty, tz, ry, rx, rz, sx, sy, sz) {
    const cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx), sx_ = Math.sin(rx), cz = Math.cos(rz), sz_ = Math.sin(rz);
    // Rx*Rz
    const a00 = cz, a01 = -sz_, a02 = 0, a10 = cx * sz_, a11 = cx * cz, a12 = -sx_, a20 = sx_ * sz_, a21 = sx_ * cz, a22 = cx;
    // Ry*(Rx*Rz)
    const r00 = cy * a00 + sy_ * a20, r01 = cy * a01 + sy_ * a21, r02 = cy * a02 + sy_ * a22;
    const r10 = a10, r11 = a11, r12 = a12;
    const r20 = -sy_ * a00 + cy * a20, r21 = -sy_ * a01 + cy * a21, r22 = -sy_ * a02 + cy * a22;
    o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
    o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
    o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  },
  invert(o, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return o;
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
};

// ------------------------------------------------------------------ shader helper
export function createProgram(gl, vsSrc, fsSrc, name = 'prog') {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(name + ' shader error: ' + gl.getShaderInfoLog(s));
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ' link error: ' + gl.getProgramInfoLog(p));
  const uni = {}, att = {};
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) {
    const info = gl.getActiveUniform(p, i);
    const key = info.name.replace(/\[0\]$/, '');
    uni[key] = gl.getUniformLocation(p, info.name);
  }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const info = gl.getActiveAttrib(p, i);
    att[info.name] = gl.getAttribLocation(p, info.name);
  }
  return { program: p, uni, att };
}

// ------------------------------------------------------------------ meshes
// Interleaved position(3) + normal(3), Uint16 indices.
export function makeMesh(gl, pos, nrm, idx) {
  const data = new Float32Array((pos.length / 3) * 6);
  for (let i = 0; i < pos.length / 3; i++) {
    data.set(pos.slice(i * 3, i * 3 + 3), i * 6);
    data.set(nrm.slice(i * 3, i * 3 + 3), i * 6 + 3);
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  return { vbo, ibo, count: idx.length };
}

export function sphereGeo(r = 1, lat = 14, lon = 20) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI;
    for (let j = 0; j <= lon; j++) {
      const ph = (j / lon) * Math.PI * 2;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      pos.push(x * r, y * r, z * r); nrm.push(x, y, z);
    }
  }
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j, b = a + lon + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, nrm, idx };
}

export function cylinderGeo(rTop = 1, rBot = 1, h = 1, seg = 24, capped = true) {
  const pos = [], nrm = [], idx = [];
  const slope = (rBot - rTop) / h;
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const l = Math.hypot(1, slope);
    pos.push(c * rTop, h / 2, s * rTop); nrm.push(c / l, slope / l, s / l);
    pos.push(c * rBot, -h / 2, s * rBot); nrm.push(c / l, slope / l, s / l);
  }
  for (let j = 0; j < seg; j++) {
    const a = j * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  if (capped) {
    for (const [y, r, ny] of [[h / 2, rTop, 1], [-h / 2, rBot, -1]]) {
      const base = pos.length / 3;
      pos.push(0, y, 0); nrm.push(0, ny, 0);
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r); nrm.push(0, ny, 0);
      }
      for (let j = 0; j < seg; j++) {
        if (ny > 0) idx.push(base, base + j + 2, base + j + 1); else idx.push(base, base + j + 1, base + j + 2);
      }
    }
  }
  return { pos, nrm, idx };
}

export function boxGeo(w = 1, h = 1, d = 1) {
  const pos = [], nrm = [], idx = [];
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  for (const [n, u, v] of faces) {
    const b = pos.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(
        ((n[0] + u[0] * su + v[0] * sv) * w) / 2,
        ((n[1] + u[1] * su + v[1] * sv) * h) / 2,
        ((n[2] + u[2] * su + v[2] * sv) * d) / 2,
      );
      nrm.push(n[0], n[1], n[2]);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos, nrm, idx };
}

export function torusGeo(R = 1, r = 0.1, seg = 40, tube = 10) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    for (let j = 0; j <= tube; j++) {
      const b = (j / tube) * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      const nx = Math.cos(b) * cx, ny = Math.sin(b), nz = Math.cos(b) * cz;
      pos.push((R + r * Math.cos(b)) * cx, r * Math.sin(b), (R + r * Math.cos(b)) * cz);
      nrm.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < tube; j++) {
      const a = i * (tube + 1) + j, b = a + tube + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, nrm, idx };
}

export function octaGeo(r = 1) {
  const v = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]];
  const f = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
  const pos = [], nrm = [], idx = [];
  for (const [a, b, c] of f) {
    const A = v[a], B = v[b], C = v[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], wx = C[0] - A[0], wy = C[1] - A[1], wz = C[2] - A[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = pos.length / 3;
    for (const P of [A, B, C]) { pos.push(P[0], P[1], P[2]); nrm.push(nx, ny, nz); }
    idx.push(base, base + 1, base + 2);
  }
  return { pos, nrm, idx };
}

// flat disc in the XZ plane, used for the floor (position only needed)
export function discGeo(r = 1, seg = 64) {
  const pos = [0, 0, 0], nrm = [0, 1, 0], idx = [];
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2;
    pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); nrm.push(0, 1, 0);
  }
  for (let j = 0; j < seg; j++) idx.push(0, j + 2, j + 1);
  return { pos, nrm, idx };
}

// superellipsoid: e=1 is a sphere, small e gives a rounded box (used for torsos, fists, boots: no more "balls")
export function superGeo(e = 0.5, lat = 12, lon = 18, ys = 1) {
  const pos = [], nrm = [], idx = [];
  const sp = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
  const n1 = 2 / e - 1;
  for (let i = 0; i <= lat; i++) {
    const th = -Math.PI / 2 + (i / lat) * Math.PI;
    for (let j = 0; j <= lon; j++) {
      const ph = (j / lon) * Math.PI * 2;
      const x = sp(Math.cos(th), e) * sp(Math.cos(ph), e), y = sp(Math.sin(th), e), z = sp(Math.cos(th), e) * sp(Math.sin(ph), e);
      let nx = sp(x, n1), ny = sp(y, n1), nz = sp(z, n1);
      const l = Math.hypot(nx, ny, nz) || 1;
      pos.push(x, y * ys, z); nrm.push(nx / l, ny / l, nz / l);
    }
  }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const a = i * (lon + 1) + j, b = a + lon + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return { pos, nrm, idx };
}
