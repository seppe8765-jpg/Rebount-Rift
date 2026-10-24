// Pooled billboard-particle system drawn as additive quads in a single draw call.
// Also supports "transient" sprites (added each frame: trail, beams, glows).
import { createProgram } from './gl.js';
import { FX_VS, FX_FS } from './shaders.js';

const MAXP = 2200;
const STRIDE = 11; // floats per vertex

export const SHAPE = { GLOW: 0, DISC: 1, RING: 2, CORE: 3 };

export class Particles {
  constructor(gl, quality = 1) {
    this.gl = gl;
    this.max = Math.floor(MAXP * (quality < 1 ? 0.5 : 1));
    this.prog = createProgram(gl, FX_VS, FX_FS, 'fx');
    this.p = new Float32Array(this.max * 3);
    this.v = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.maxLife = new Float32Array(this.max);
    this.size0 = new Float32Array(this.max);
    this.size1 = new Float32Array(this.max);
    this.col = new Float32Array(this.max * 4);
    this.shape = new Float32Array(this.max);
    this.grav = new Float32Array(this.max);
    this.drag = new Float32Array(this.max);
    this.alive = 0; // compacted: [0, alive)
    this.transMax = 700;
    this.total = this.max + this.transMax;
    this.vbuf = new Float32Array(this.total * 4 * STRIDE);
    this.tcount = 0;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vbuf.byteLength, gl.DYNAMIC_DRAW);
    const idx = new Uint16Array(this.total * 6);
    for (let i = 0; i < this.total; i++) {
      const b = i * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.drawCount = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, size0, size1, r, g, b, a = 1, shape = 0, grav = 0, drag = 0) {
    if (this.alive >= this.max) return;
    const i = this.alive++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size0[i] = size0; this.size1[i] = size1;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.shape[i] = shape; this.grav[i] = grav; this.drag[i] = drag;
  }

  burst(x, y, z, n, speed, life, size, rgb, { shape = 0, grav = 3, spread = 1, up = 0.3 } = {}) {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.65);
      this.spawn(x, y, z, Math.sin(ph) * Math.cos(th) * s * spread, Math.cos(ph) * s * 0.8 + up * s, Math.sin(ph) * Math.sin(th) * s * spread,
        life * (0.6 + Math.random() * 0.6), size, size * 0.15, rgb[0], rgb[1], rgb[2], 1, shape, grav, 1.5);
    }
  }

  // expanding horizontal ring made of one big ring-sprite lying flat is not possible with
  // camera-facing quads, so we emit a circle of fast particles instead.
  ring(x, y, z, n, speed, life, size, rgb) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawn(x, y, z, Math.cos(a) * speed, 0.2, Math.sin(a) * speed, life, size, size * 0.2, rgb[0], rgb[1], rgb[2], 1, 0, 0, 2.2);
    }
  }

  update(dt) {
    let n = this.alive;
    for (let i = 0; i < n;) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        n--;
        if (i !== n) this._copy(n, i);
        continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt; this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < 0.03 && this.grav[i] > 0) { this.p[i * 3 + 1] = 0.03; this.v[i * 3 + 1] *= -0.3; }
      i++;
    }
    this.alive = n;
  }

  _copy(from, to) {
    for (let k = 0; k < 3; k++) { this.p[to * 3 + k] = this.p[from * 3 + k]; this.v[to * 3 + k] = this.v[from * 3 + k]; }
    for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.size0[to] = this.size0[from]; this.size1[to] = this.size1[from];
    this.shape[to] = this.shape[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
  }

  beginFrame() { this.tcount = 0; }

  // transient sprite for this frame only
  sprite(x, y, z, size, r, g, b, a = 1, shape = 0) {
    if (this.tcount >= this.transMax) return;
    this._quad(this.max + this.tcount, x, y, z, size, r, g, b, a, shape);
    this.tcount++;
  }

  _quad(slot, x, y, z, size, r, g, b, a, shape) {
    const o = slot * 4 * STRIDE;
    const ks = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let c = 0; c < 4; c++) {
      const q = o + c * STRIDE;
      this.vbuf[q] = x; this.vbuf[q + 1] = y; this.vbuf[q + 2] = z;
      this.vbuf[q + 3] = ks[c * 2]; this.vbuf[q + 4] = ks[c * 2 + 1];
      this.vbuf[q + 5] = size;
      this.vbuf[q + 6] = r; this.vbuf[q + 7] = g; this.vbuf[q + 8] = b; this.vbuf[q + 9] = a;
      this.vbuf[q + 10] = shape;
    }
  }

  draw(vp, right, up) {
    const gl = this.gl;
    for (let i = 0; i < this.alive; i++) {
      const t = 1 - this.life[i] / this.maxLife[i];
      const size = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      const fade = Math.min(1, (1 - t) * 2.2) * Math.min(1, t * 30 + 0.3);
      this._quad(i, this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2], size, this.col[i * 4], this.col[i * 4 + 1], this.col[i * 4 + 2], this.col[i * 4 + 3] * fade, this.shape[i]);
    }
    // transients live after the pooled region; draw two ranges
    const pr = this.prog;
    gl.useProgram(pr.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    // upload pooled
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vbuf.subarray(0, this.alive * 4 * STRIDE));
    if (this.tcount) gl.bufferSubData(gl.ARRAY_BUFFER, this.max * 4 * STRIDE * 4, this.vbuf.subarray(this.max * 4 * STRIDE, (this.max + this.tcount) * 4 * STRIDE));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const bytes = STRIDE * 4;
    const A = pr.att;
    for (const [name, size, off] of [['aC', 3, 0], ['aK', 2, 12], ['aS', 1, 20], ['aCol', 4, 24], ['aShape', 1, 40]]) {
      gl.enableVertexAttribArray(A[name]);
      gl.vertexAttribPointer(A[name], size, gl.FLOAT, false, bytes, off);
    }
    gl.uniformMatrix4fv(pr.uni.uVP, false, vp);
    gl.uniform3fv(pr.uni.uRight, right);
    gl.uniform3fv(pr.uni.uUp, up);
    if (this.alive) gl.drawElements(gl.TRIANGLES, this.alive * 6, gl.UNSIGNED_SHORT, 0);
    if (this.tcount) gl.drawElements(gl.TRIANGLES, this.tcount * 6, gl.UNSIGNED_SHORT, this.max * 6 * 2);
    for (const name of ['aC', 'aK', 'aS', 'aCol', 'aShape']) gl.disableVertexAttribArray(A[name]);
  }
}
