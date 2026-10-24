// Renderer: draws the whole game from a read-only "view" (a Match locally, or a network mirror
// with the same shape). Pure WebGL1, procedural assets only.
import { mat4, createProgram, makeMesh, sphereGeo, cylinderGeo, boxGeo, torusGeo, octaGeo, discGeo, superGeo } from './gl.js';
import { LIT_VS, LIT_FS, FLOOR_VS, FLOOR_FS, SKY_VS, SKY_FS, BAKE_FS, SCENE_VS, SCENE_FS, BLOOM_BRIGHT_FS, BLOOM_BLUR_FS, BLOOM_COMP_FS } from './shaders.js';
import { Particles, SHAPE } from './particles.js';
import { CFG, speedIntensity } from '../game/config.js';
import { PLAYER_COLORS, findItem, BODIES, HEADS, OUTFIT_BY_ID } from '../game/cosmetics.js';
import { getMap } from '../game/maps.js';
import { buildScene } from './scenery.js';

const BODY_BY_ID = new Map(BODIES.map((b) => [b.id, b]));

const lerp = (a, b, t) => a + (b - a) * t;
const hsv = (h, s, v) => {
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
};

// character models ('mannetjes'): body/head mesh + proportions
const CHARS = {
  rookie: { s: 1.0, w: 1.0,  hy: 1.78, hs: 0.235, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'eyes', hair: 'short' },
  ninja:  { s: 1.0, w: 1.0,  hy: 1.78, hs: 0.235, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'mask', katana: true },
  // cartoon cast: big head, small body, bright outfits (original designs)
  sunny:  { s: 0.78, w: 1.0, hy: 1.72, hs: 0.36, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'eyes', cartoon: true, hair: 'pony', hairC: [1.0, 0.82, 0.28], top: [1.0, 0.42, 0.74], bot: [0.9, 0.3, 0.62], shades: true, skinI: 4 },
  luna:   { s: 0.78, w: 1.0, hy: 1.72, hs: 0.36, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'eyes', cartoon: true, hair: 'bun', hairC: [0.08, 0.07, 0.1], top: [0.1, 0.78, 0.72], bot: [0.08, 0.55, 0.55], skinI: 2 },
  disco:  { s: 0.8, w: 1.0, hy: 1.72, hs: 0.35, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'eyes', cartoon: true, hair: 'afro', hairC: [0.26, 0.12, 0.06], top: [0.86, 0.1, 0.16], bot: [0.7, 0.06, 0.12], bowtie: true, skinI: 1 },
  ember:  { s: 0.78, w: 1.0, hy: 1.72, hs: 0.36, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'eyes', cartoon: true, hair: 'bob', hairC: [0.95, 0.38, 0.1], top: [0.2, 0.68, 0.3], bot: [0.12, 0.5, 0.22], skinI: 0 },
  penguin:{ s: 0.74, w: 1.1, hy: 1.7, hs: 0.36, hm: 'sphere', torso: 'sphere', legs: true, toon: true, face: 'eyes', cartoon: true, hair: 'none', penguin: true, top: [0.08, 0.09, 0.14], bot: [0.95, 0.55, 0.12], skinI: 0 },
  bot:    { s: 1.0,  w: 1.0,  hy: 1.82, hs: 0.22, hm: 'sphere', torso: 'sphere', legs: true },
  blob:   { s: 0.8,  w: 1.5,  hy: 1.55, hs: 0.2,  hm: 'sphere', torso: 'sphere', legs: true },
  tall:   { s: 1.12, w: 0.8,  hy: 1.82, hs: 0.19, hm: 'sphere', torso: 'sphere', legs: true },
  ghost:  { s: 1.0,  w: 1.0,  hy: 1.82, hs: 0.25, hm: 'sphere', torso: 'cone',   legs: false },
  cube:   { s: 0.95, w: 1.1,  hy: 1.82, hs: 0.26, hm: 'box',    torso: 'box',    legs: true },
  knight: { s: 1.05, w: 1.2,  hy: 1.84, hs: 0.23, hm: 'sphere', torso: 'sphere', legs: true, extra: 'shield' },
  alien:  { s: 1.0,  w: 0.8,  hy: 1.82, hs: 0.34, hm: 'sphere', torso: 'sphere', legs: true, extra: 'ant' },
};

export class Renderer {
  constructor(canvas, { quality = 'high' } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    // try the nicest context first, then progressively plainer ones (some browsers/GPUs refuse high-performance or MSAA)
    let gl = null;
    const tries = [
      { antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance', depth: true, stencil: false, preserveDrawingBuffer: true },
      { antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: true },
      { alpha: false },
      {},
    ];
    for (const attrs of tries) {
      try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e) { gl = null; }
      if (gl) break;
    }
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.lit = createProgram(gl, LIT_VS, LIT_FS, 'lit');
    this.floor = createProgram(gl, FLOOR_VS, FLOOR_FS, 'floor');
    this.sky = createProgram(gl, SKY_VS, SKY_FS, 'sky');
    this.sceneProg = createProgram(gl, SCENE_VS, SCENE_FS, 'scene');
    this.sceneCache = new Map();
    this.fx = new Particles(gl, quality === 'low' ? 0.5 : 1);
    this.scale = 1; this.ft = 0.016; this.slowAcc = 0; this.fastAcc = 0;
    const mk = (g) => makeMesh(gl, g.pos, g.nrm, g.idx);
    this.m = {
      sphere: mk(sphereGeo(1, quality === 'low' ? 10 : 16, quality === 'low' ? 14 : 22)),
      cyl: mk(cylinderGeo(1, 1, 1, 40)),
      cone: mk(cylinderGeo(1, 0.18, 1, 40)),
      box: mk(boxGeo(1, 1, 1)),
      ring: mk(torusGeo(1, 0.035, 72, 6)),
      ringThick: mk(torusGeo(1, 0.07, 48, 8)),
      octa: mk(octaGeo(1)),
      sup: mk(superGeo(0.3, 10, 16)),
      round: mk(superGeo(0.92, 14, 22)),
      head: mk(superGeo(0.5, 12, 18)),
      blk: mk(superGeo(0.24, 8, 12, 0.5)),
    };
    // fullscreen triangle for the sky
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.floorCache = new Map();
    this.bloom = null;
    this.vp = mat4.create(); this.proj = mat4.create(); this.view = mat4.create(); this.invVP = mat4.create(); this.model = mat4.create();
    this.cam = { x: 0, y: 8, z: -10, tx: 0, ty: 1, tz: 0, fov: 1.0 };
    this.right = new Float32Array([1, 0, 0]); this.up = new Float32Array([0, 1, 0]);
    this.w = 1; this.h = 1; this.cssW = 1; this.cssH = 1;
    this.time = 0;
    this.trail = []; // ball positions
    this.deadAnim = new Map();
    this.parryAnim = new Map();
    this.cosm = { ball: findItem('ball', 'plasma'), trail: findItem('trail', 'comet'), aura: findItem('aura', 'none'), parry: findItem('parry', 'ring'), victory: findItem('victory', 'confetti') };
    this.localId = 'you';
    this.accent = [0.2, 0.75, 1.0];
    this.theme = null;
    this.alert = 0; // 0..1 how threatening the situation is for the viewed player
    this.victory = false;
    this.fogCol = [0.025, 0.03, 0.07];
    this.debrisSeed = Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * 6.283 + Math.random(), r: 56 + Math.random() * 34, y: -6 + Math.random() * 22, s: 0.7 + Math.random() * 1.8, sp: 0.04 + Math.random() * 0.08, c: i % 3 }));
    this.map = null;
    this.setMap(getMap('neon'));
    this.resize();
  }

  // switch arena: rebuilds the floor disc, bakes (cached) the floor texture and applies the colour theme
  setMap(map) {
    const gl = this.gl;
    this.map = map;
    const th = map.theme;
    this.theme = th;
    this.RMax = map.R + 0.4;
    this.accent = th.accent; this.fogCol = th.fog;
    let e = this.floorCache.get(map.id);
    if (!e) {
      e = { tex: this._bakeFloor(map), disc: makeMesh(gl, ...(() => { const g = discGeo(this.RMax, 96); return [g.pos, g.nrm, g.idx]; })()) };
      this.floorCache.set(map.id, e);
    }
    this.floorTex = e.tex; this.m.disc = e.disc;
    this.fogN = th.day ? 80 : 60; this.fogF = th.day ? 330 : 190;
    this.scene = null;
    if (th.day) {
      let sc = this.sceneCache.get(map.id);
      if (!sc) {
        const up = (chunks) => chunks.filter((c) => c.idx.length).map((c) => {
          const n = c.pos.length / 3, data = new Float32Array(n * 10);
          for (let i = 0; i < n; i++) { data.set(c.pos.slice(i * 3, i * 3 + 3), i * 10); data.set(c.nrm.slice(i * 3, i * 3 + 3), i * 10 + 3); data.set(c.col.slice(i * 4, i * 4 + 4), i * 10 + 6); }
          const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(c.idx), gl.STATIC_DRAW);
          return { vbo, ibo, count: c.idx.length };
        });
        const b = buildScene(map);
        sc = { solid: [...up(b.stat), ...up(b.cols), ...up(b.fence), ...up(b.grass)], shadow: up(b.shadow) };
        this.sceneCache.set(map.id, sc);
      }
      this.scene = sc;
    }
    this.trail.length = 0;
    this.debrisSeed.forEach((d, i) => { d.r = map.R + 12 + Math.random() * 30; });
  }

  setCosmetics(loadout) {
    this.cosm = {
      ball: findItem('ball', loadout.ball), trail: findItem('trail', loadout.trail), aura: findItem('aura', loadout.aura),
      parry: findItem('parry', loadout.parry), victory: findItem('victory', loadout.victory),
    };
  }

  resize() {
    const dprCap = this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const cw = this.canvas.clientWidth || window.innerWidth, ch = this.canvas.clientHeight || window.innerHeight;
    this.cssW = cw; this.cssH = ch;
    this.w = Math.max(2, Math.floor(cw * dpr * this.scale)); this.h = Math.max(2, Math.floor(ch * dpr * this.scale));
    if (this.canvas.width !== this.w || this.canvas.height !== this.h) { this.canvas.width = this.w; this.canvas.height = this.h; }
  }

  // Render the static floor pattern once into a 1024^2 texture (cheap per-pixel work afterwards).
  _bakeFloor(map) {
    const gl = this.gl;
    const size = this.quality === 'low' ? 512 : 1024;
    if (!this.bakeProg) this.bakeProg = createProgram(gl, SKY_VS, BAKE_FS, 'bake');
    const prog = this.bakeProg;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, size, size);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(prog.program);
    this._attribs(prog, ['aP']);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.vertexAttribPointer(prog.att.aP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(prog.uni.uSpan, map.R + 0.4);
    gl.uniform1f(prog.uni.uPattern, map.theme.pattern);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    return tex;
  }

  // Dynamic resolution: if frames are slow, render at a lower internal resolution (and recover later).
  adapt(dt) {
    this.ft = this.ft * 0.9 + dt * 0.1;
    if (this.ft > 0.026) { this.slowAcc += dt; this.fastAcc = 0; } else if (this.ft < 0.0185) { this.fastAcc += dt; this.slowAcc = 0; } else { this.slowAcc = 0; this.fastAcc = 0; }
    if (this.slowAcc > 1.2 && this.scale > 0.45) { this.scale = Math.max(0.45, this.scale * 0.85); this.slowAcc = 0; }
    else if (this.fastAcc > 5 && this.scale < 1) { this.scale = Math.min(1, this.scale * 1.12); this.fastAcc = 0; }
  }

  project(x, y, z) {
    const m = this.vp;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return { x: 0, y: 0, visible: false, w: cw };
    return { x: (cx / cw * 0.5 + 0.5) * this.cssW, y: (1 - (cy / cw * 0.5 + 0.5)) * this.cssH, visible: true, w: cw };
  }

  // ---- gl helpers
  _attribs(pr, names) {
    const gl = this.gl;
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    for (const n of names) if (pr.att[n] !== undefined) gl.enableVertexAttribArray(pr.att[n]);
  }
  _bindMesh(pr, mesh) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.vertexAttribPointer(pr.att.aPos, 3, gl.FLOAT, false, 24, 0);
    if (pr.att.aNrm !== undefined) gl.vertexAttribPointer(pr.att.aNrm, 3, gl.FLOAT, false, 24, 12);
  }
  _lit(mesh, tx, ty, tz, ry, sx, sy, sz, color, emissive = [0, 0, 0], alpha = 1, rim = 0.6, rimCol = null) {
    const gl = this.gl, pr = this.lit, u = pr.uni;
    this._bindMesh(pr, mesh);
    mat4.trs(this.model, tx, ty, tz, ry, sx, sy, sz);
    gl.uniformMatrix4fv(u.uM, false, this.model);
    gl.uniform3fv(u.uColor, color);
    gl.uniform3fv(u.uEmissive, emissive);
    gl.uniform3fv(u.uRimColor, rimCol || this.accent);
    gl.uniform1f(u.uRim, rim * (this._rs == null ? 1 : this._rs));
    gl.uniform1f(u.uAlpha, alpha * (this._pa == null ? 1 : this._pa));
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  // =================================================================== frame
  render(view, cam, dt, opts = {}) {
    const gl = this.gl;
    if (view.map && view.map !== this.map) this.setMap(view.map);
    this.time += dt;
    const t = this.time;
    this.resize();
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(this.theme.fog[0], this.theme.fog[1], this.theme.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // camera matrices
    const shake = opts.shake || 0;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake;
    this.cam = cam;
    mat4.perspective(this.proj, cam.fov, this.w / this.h, 0.1, 600);
    mat4.lookAt(this.view, cam.x + sx, cam.y + sy, cam.z + sz, cam.tx, cam.ty, cam.tz);
    mat4.mul(this.vp, this.proj, this.view);
    mat4.invert(this.invVP, this.vp);
    this.right[0] = this.view[0]; this.right[1] = this.view[4]; this.right[2] = this.view[8];
    this.up[0] = this.view[1]; this.up[1] = this.view[5]; this.up[2] = this.view[9];

    const ball = view.ball;
    const kmh = ball.speedKmh || 35;
    const si = speedIntensity(kmh);
    const flying = ball.mode === 'flying';
    const target = ball.targetId ? view.byId.get(ball.targetId) : null;
    const viewer = view.byId.get(opts.viewerId || this.localId);
    const targetsViewer = !!(target && viewer && target === viewer && ball.mode !== 'none');
    this.alert = lerp(this.alert, targetsViewer ? 0.4 + si * 0.6 : 0, Math.min(1, dt * 6));

    // ball colour logic (theme -> targeting orange/red -> critical white-magenta)
    const theme = this.cosm.ball;
    let baseGlow = theme.glow === 'rainbow' ? hsv((t * 0.35) % 1, 0.6, 1) : theme.glow;
    const hot = [1.0, 0.38, 0.12];
    let tgtMix = (ball.mode === 'flying' || ball.mode === 'charging') && target ? 0.6 : 0;
    if (targetsViewer) tgtMix = 0.9;
    const glow = [lerp(baseGlow[0], hot[0], tgtMix), lerp(baseGlow[1], hot[1], tgtMix), lerp(baseGlow[2], hot[2], tgtMix)];
    const crit = Math.max(0, (si - 0.55) / 0.45);
    glow[0] = lerp(glow[0], 1.0, crit * 0.5); glow[1] = lerp(glow[1], 0.35, crit * 0.4); glow[2] = lerp(glow[2], 0.9, crit * 0.5);
    const ballY = (ball.y != null ? ball.y : CFG.BALL_H) + Math.sin(t * 6) * 0.06;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    // ---- floor (platform top)
    {
      const pr = this.floor, u = pr.uni;
      gl.useProgram(pr.program);
      this._attribs(pr, ['aPos']);
      this._bindMesh(pr, this.m.disc);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.floorTex);
      gl.uniform1i(u.uTex, 0);
      gl.uniformMatrix4fv(u.uVP, false, this.vp);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uR, view.arenaR);
      gl.uniform1f(u.uRMax, this.RMax);
      gl.uniform3fv(u.uBase, this.theme.floor); gl.uniform3fv(u.uDanger, this.theme.danger); gl.uniform3fv(u.uGridCol, this.theme.gridCol); gl.uniform1f(u.uPattern, this.theme.pattern);
      const bi = ball.mode === 'none' ? 0 : 1.0;
      gl.uniform3f(u.uBall, ball.x, bi, ball.z);
      gl.uniform3fv(u.uBallCol, glow);
      const tp = target && ball.mode !== 'none' ? target : null;
      gl.uniform4f(u.uTarget, tp ? tp.x : 0, tp ? tp.z : 0, tp && tp.alive ? 1 : 0, 0);
      gl.uniform3f(u.uCam, cam.x, cam.y, cam.z);
      gl.uniform3fv(u.uFog, this.fogCol);
      gl.uniform1f(u.uFogNear, this.fogN); gl.uniform1f(u.uFogFar, this.fogF);
      gl.uniform1f(u.uIntensity, 1.0 + (view.frenzy ? 0.25 * Math.sin(t * 14) : 0));
      gl.uniform3fv(u.uAccent, view.frenzy ? [1.0, 0.35, 0.3] : this.accent);
      gl.drawElements(gl.TRIANGLES, this.m.disc.count, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
    }

    // ---- scenery (day map)
    if (this.scene) {
      const pr = this.sceneProg, u = pr.uni, S = this.scene;
      gl.useProgram(pr.program);
      this._attribs(pr, ['aPos', 'aNrm', 'aCol']);
      gl.uniformMatrix4fv(u.uVP, false, this.vp);
      gl.uniform3f(u.uCam, cam.x, cam.y, cam.z);
      gl.uniform3fv(u.uFog, this.fogCol);
      gl.uniform1f(u.uFogNear, this.fogN); gl.uniform1f(u.uFogFar, this.fogF);
      gl.uniform1f(u.uTime, t);
      const draw = (m) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
        gl.vertexAttribPointer(pr.att.aPos, 3, gl.FLOAT, false, 40, 0);
        gl.vertexAttribPointer(pr.att.aNrm, 3, gl.FLOAT, false, 40, 12);
        gl.vertexAttribPointer(pr.att.aCol, 4, gl.FLOAT, false, 40, 24);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      };
      gl.uniform1f(u.uAlpha, 1);
      for (const m of S.solid) draw(m);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniform1f(u.uAlpha, 0.3);
      for (const m of S.shadow) draw(m);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }

    // ---- lit geometry
    {
      const pr = this.lit, u = pr.uni;
      gl.useProgram(pr.program);
      this._attribs(pr, ['aPos', 'aNrm']);
      gl.uniformMatrix4fv(u.uVP, false, this.vp);
      gl.uniform3f(u.uCam, cam.x, cam.y, cam.z);
      gl.uniform3fv(u.uFog, this.fogCol);
      gl.uniform1f(u.uFogNear, this.fogN); gl.uniform1f(u.uFogFar, this.fogF);
      const R = this.RMax;
      // platform body + underside
      const day = !!this.theme.day;
      if (day) {
        const sd = this.theme.side || [0.45, 0.32, 0.2];
        this._lit(this.m.cyl, 0, -1.16, 0, 0, R, 2.2, R, sd, [0, 0, 0], 1, 0.1);
        this._lit(this.m.cone, 0, -7.2, 0, 0, R * 0.96, 10, R * 0.96, sd.map((c) => c * 0.88), [0, 0, 0], 1, 0.1);
      } else {
        this._lit(this.m.cyl, 0, -1.16, 0, 0, R, 2.2, R, [0.05, 0.06, 0.12], [0, 0, 0], 1, 0.45);
        this._lit(this.m.cone, 0, -7.2, 0, 0, R * 0.96, 10, R * 0.96, [0.04, 0.045, 0.1], [0.0, 0.01, 0.03], 1, 0.6);
      }
      // glowing edges
      if (!day) this._lit(this.m.ringThick, 0, 0.04, 0, 0, R, 1, R, [0, 0, 0], this.accent.map((c) => c * 1.3), 1, 0);
      if (!day) this._lit(this.m.ring, 0, -2.2, 0, 0, R * 0.99, 1, R * 0.99, [0, 0, 0], [0.9, 0.2, 0.6], 1, 0);
      // live arena boundary (shrinks in LAST 3)
      const bh = view.state === 'FINAL_PHASE' ? [1.8, 0.25, 0.3] : [0.3, 0.9, 1.4];
      this._lit(this.m.ring, 0, 0.12, 0, 0, view.arenaR, 1, view.arenaR, [0, 0, 0], bh, 1, 0);
      // light posts
      for (let i = 0; i < (day ? 0 : 12); i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.03;
        this._lit(this.m.cyl, Math.sin(a) * (R + 0.1), 1.6, Math.cos(a) * (R + 0.1), 0, 0.12, 3.2, 0.12, [0.1, 0.1, 0.2], this.accent.map((c) => c * (0.6 + 0.4 * Math.sin(t * 3 + i))), 1, 0.2);
      }
      // centre energy ring
      if (!day) {
      this._lit(this.m.ring, 0, 6 + Math.sin(t) * 0.4, 0, t * 0.5, 4, 1, 4, [0, 0, 0], [0.7, 0.4, 1.3], 1, 0);
      this._lit(this.m.ring, 0, 6 + Math.sin(t) * 0.4, 0, -t * 0.7, 2.6, 1, 2.6, [0, 0, 0], [0.3, 0.9, 1.3], 1, 0);
      }
      // floating crystals
      for (const d of (day ? [] : this.debrisSeed)) {
        const a = d.a + t * d.sp;
        const th = this.theme;
        const col = d.c === 0 ? th.accent.map((c) => c * 1.2) : d.c === 1 ? th.neb1.map((c) => c * 2.4 + 0.3) : th.neb2.map((c) => c * 2.4 + 0.3);
        this._lit(this.m.octa, Math.sin(a) * d.r, d.y + Math.sin(t * 0.6 + d.a) * 1.2, Math.cos(a) * d.r, t * 0.4 + d.a, d.s * 0.7, d.s * 1.3, d.s * 0.7, [0.06, 0.07, 0.14], col.map((c) => c * 0.35), 1, 1.2);
      }

      // cover pillars
      const th = this.theme;
      for (const pl of (day ? [] : this.map.pillars)) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2 + pl.x);
        this._lit(this.m.cyl, pl.x, pl.h / 2, pl.z, 0, pl.r, pl.h, pl.r, th.pillar, [0, 0, 0], 1, 0.9);
        this._lit(this.m.cyl, pl.x, pl.h + 0.12, pl.z, 0, pl.r * 1.18, 0.28, pl.r * 1.18, th.pillar.map((c) => c * 1.4), th.accent.map((c) => c * 0.08), 1, 0.6);
        this._lit(this.m.cyl, pl.x, 0.14, pl.z, 0, pl.r * 1.14, 0.28, pl.r * 1.14, th.pillar.map((c) => c * 1.3), [0, 0, 0], 1, 0.4);
        this._lit(this.m.ring, pl.x, pl.h + 0.28, pl.z, 0, pl.r * 1.12, 1, pl.r * 1.12, [0, 0, 0], th.accent.map((c) => c * 1.5 * pulse), 1, 0);
        this._lit(this.m.ring, pl.x, pl.h * 0.55, pl.z, 0, pl.r * 1.02, 1, pl.r * 1.02, [0, 0, 0], th.accent.map((c) => c * 0.9 * pulse), 1, 0);
        this._lit(this.m.ring, pl.x, 0.32, pl.z, 0, pl.r * 1.02, 1, pl.r * 1.02, [0, 0, 0], th.accent.map((c) => c * 0.8), 1, 0);
      }

      // power-up orbs
      for (const o of (view.orbs || [])) {
        const col = o.type === 'shield' ? [0.3, 0.9, 1] : [1, 0.75, 0.2];
        const bob = Math.sin(t * 3 + o.id) * 0.15, grow = Math.min(1, (14 - o.life) * 3 + 0.2), fade2 = o.life < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 10)) : 1;
        this._lit(this.m.sphere, o.x, 1.1 + bob, o.z, t, 0.42 * grow, 0.42 * grow, 0.42 * grow, [0, 0, 0], col.map((c) => c * 1.7 * fade2), 1, 0);
        this._lit(this.m.ring, o.x, 1.1 + bob, o.z, t * 2, 0.8 * grow, 1, 0.8 * grow, [0, 0, 0], col.map((c) => c * 1.3 * fade2), 1, 0);
        this._lit(this.m.ring, o.x, 0.12, o.z, -t, 1.1 * grow, 1, 1.1 * grow, [0, 0, 0], col.map((c) => c * 0.9 * fade2), 1, 0);
      }

      // the ball itself: a clean solid sphere (neutral white, turns red while it hunts you / its target)
      if (ball.mode !== 'none') {
        const hot2 = ball.mode === 'flying' || ball.mode === 'charging' || ball.mode === 'choosing';
        const k = hot2 ? (targetsViewer ? 1 : target ? 0.45 : 0) : 0;
        const base = [0.93 + (0.95 - 0.93) * k, 0.94 * (1 - k) + 0.1 * k, 0.97 * (1 - k) + 0.1 * k];
        const rr = 0.52 + (ball.mode === 'charging' ? 0.06 * Math.sin(t * 30) : 0);
        this._lit(this.m.sphere, ball.x, ballY, ball.z, t * 2, rr * 1.12, rr * 1.12, rr * 1.12, [0, 0, 0], k > 0.5 ? [0.9, 0.9, 0.9] : [0.6, 0.62, 0.7], 1, 0);
        this._lit(this.m.sphere, ball.x, ballY, ball.z, t * 2, rr, rr, rr, base, base.map((c) => c * (0.35 + 0.25 * k)), 1, 0.9, [1, 1, 1]);
      }

      // players
      for (const p of view.players) this._drawPlayer(view, p, t, dt);

      // soft blob shadows (a few stacked translucent discs)
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      for (const p of view.players) {
        if (!p.alive) continue;
        const k = 1 - Math.min(0.5, (p.y || 0) * 0.35);
        for (let i = 0; i < 3; i++) this._lit(this.m.cyl, p.x, 0.03 + i * 0.002, p.z, 0, (1.0 - i * 0.22) * k, 0.01, (1.0 - i * 0.22) * k, [0, 0, 0], [0, 0, 0], 0.16 * k, 0);
      }
      if (ball.mode !== 'none') {
        for (let i = 0; i < 3; i++) this._lit(this.m.cyl, ball.x, 0.03 + i * 0.002, ball.z, 0, 0.75 - i * 0.2, 0.01, 0.75 - i * 0.2, [0, 0, 0], [0, 0, 0], 0.18, 0);
      }
      gl.depthMask(true); gl.disable(gl.BLEND);
    }

    // ---- sky
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    {
      const pr = this.sky;
      gl.useProgram(pr.program);
      this._attribs(pr, ['aP']);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
      gl.vertexAttribPointer(pr.att.aP, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(pr.uni.uInvVP, false, this.invVP);
      gl.uniform3f(pr.uni.uCam, cam.x, cam.y, cam.z);
      gl.uniform1f(pr.uni.uTime, t);
      gl.uniform3fv(pr.uni.uTop, this.theme.skyTop);
      gl.uniform3fv(pr.uni.uHor, this.theme.skyHor);
      gl.uniform3fv(pr.uni.uNeb1, this.theme.neb1);
      gl.uniform3fv(pr.uni.uNeb2, this.theme.neb2);
      gl.uniform1f(pr.uni.uAlert, this.alert);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.depthMask(true);

    // ---- additive effects
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    this.fx.beginFrame();
    this._frameFx(view, t, dt, { ball, glow, ballY, si, crit, flying, target, targetsViewer, opts });
    this.fx.update(dt);
    // shields (lit pass but additive)
    {
      const pr = this.lit; gl.useProgram(pr.program); this._attribs(pr, ['aPos', 'aNrm']);
      gl.uniformMatrix4fv(pr.uni.uVP, false, this.vp);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      for (const p of view.players) {
        if (!p.alive || !(p.parryActive > 0)) continue;
        const c = this._colorOf(p, view);
        const k = Math.min(1, p.parryActive / 0.15);
                // the sword does the work now: only a faint reach ring on the floor shows how far the swing covers (360 degrees)
        const py = p.y || 0;
        this._lit(this.m.ring, p.x, 0.2 + py * 0.2, p.z, 0, 1.9, 1, 1.9, [0, 0, 0], c.map((v) => v * (0.5 + 0.6 * k)), 0.5 + 0.4 * k, 0, [1, 1, 1]);
      }
    }
    gl.blendFunc(gl.ONE, gl.ONE);
    this.fx.draw(this.vp, this.right, this.up);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    if (this.quality === 'high' && this.scale > 0.6 && !opts.noBloom) this._bloomPass(view, si);
  }

  // ---- bloom: copy the finished frame, extract + blur the bright parts at 1/4 size, add them back
  _bloomInit() {
    const gl = this.gl;
    const sceneFmt = (gl.getContextAttributes() || {}).alpha === false ? gl.RGB : gl.RGBA; // copyTexSubImage needs a format the framebuffer has
    const mkTex = (w, h, fmt = gl.RGBA) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const w = this.w, h = this.h, bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    if (this.bloom) { gl.deleteTexture(this.bloom.scene); gl.deleteTexture(this.bloom.a); gl.deleteTexture(this.bloom.b); gl.deleteFramebuffer(this.bloom.fa); gl.deleteFramebuffer(this.bloom.fb); }
    const mkFbo = (tex) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return f; };
    const scene = mkTex(w, h, sceneFmt), a = mkTex(bw, bh), b = mkTex(bw, bh);
    const fa = mkFbo(a), fb = mkFbo(b);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!this.bloomProgs) this.bloomProgs = {
      bright: createProgram(gl, SKY_VS, BLOOM_BRIGHT_FS, 'bloomBright'),
      blur: createProgram(gl, SKY_VS, BLOOM_BLUR_FS, 'bloomBlur'),
      comp: createProgram(gl, SKY_VS, BLOOM_COMP_FS, 'bloomComp'),
    };
    this.bloom = { w, h, bw, bh, scene, a, b, fa, fb };
  }

  _bloomPass(view, si) {
    const gl = this.gl;
    if (!this.bloom || this.bloom.w !== this.w || this.bloom.h !== this.h) this._bloomInit();
    const B = this.bloom, P = this.bloomProgs;
    // 1) copy the frame
    gl.bindTexture(gl.TEXTURE_2D, B.scene);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, B.w, B.h);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    const quad = (pr) => { gl.useProgram(pr.program); this._attribs(pr, ['aP']); gl.vertexAttribPointer(pr.att.aP, 2, gl.FLOAT, false, 0, 0); };
    // 2) bright pass + downsample into A
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fa); gl.viewport(0, 0, B.bw, B.bh);
    quad(P.bright);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, B.scene); gl.uniform1i(P.bright.uni.uTex, 0);
    gl.uniform2f(P.bright.uni.uTexel, 1 / B.w, 1 / B.h); gl.uniform1f(P.bright.uni.uThr, 0.78);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 3) blur A->B (horizontal) and B->A (vertical), twice for a wider glow
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb); quad(P.blur);
      gl.bindTexture(gl.TEXTURE_2D, B.a); gl.uniform1i(P.blur.uni.uTex, 0); gl.uniform2f(P.blur.uni.uDir, 1 / B.bw, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fa); quad(P.blur);
      gl.bindTexture(gl.TEXTURE_2D, B.b); gl.uniform1i(P.blur.uni.uTex, 0); gl.uniform2f(P.blur.uni.uDir, 0, 1 / B.bh); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // 4) add to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    quad(P.comp);
    gl.bindTexture(gl.TEXTURE_2D, B.a); gl.uniform1i(P.comp.uni.uTex, 0);
    gl.uniform1f(P.comp.uni.uStrength, 0.75 + 0.25 * si + this.alert * 0.2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  }

  _colorOf(p, view) {
    if (p.id === (view.localId || this.localId)) return this.cosm.parry.color;
    return PLAYER_COLORS[p.color % PLAYER_COLORS.length];
  }

  // one tilted mesh (limb / blade): same as _lit but with pitch + roll
  _litE(mesh, tx, ty, tz, ry, rx, rz, sx, sy, sz, color, emissive = [0, 0, 0], alpha = 1, rim = 0.6, rimCol = null) {
    const gl = this.gl, pr = this.lit, u = pr.uni;
    this._bindMesh(pr, mesh);
    mat4.trsE(this.model, tx, ty, tz, ry, rx, rz, sx, sy, sz);
    gl.uniformMatrix4fv(u.uM, false, this.model);
    gl.uniform3fv(u.uColor, color);
    gl.uniform3fv(u.uEmissive, emissive);
    gl.uniform3fv(u.uRimColor, rimCol || this.accent);
    gl.uniform1f(u.uRim, rim * (this._rs == null ? 1 : this._rs));
    gl.uniform1f(u.uAlpha, alpha * (this._pa == null ? 1 : this._pa));
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }
  // a cylinder / box stretched from point A to point B (a bone)
  _bone(mesh, ax, ay, az, bx, by, bz, w, d, color, emissive, rim = 0.8, rimCol = null) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1e-4;
    this._litE(mesh, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), Math.acos(Math.max(-1, Math.min(1, dy / L))), 0, w, L, d, color, emissive, 1, rim, rimCol);
  }

  _drawPlayer(view, p, t, dt) {
    const gl = this.gl;
    let d = this.deadAnim.get(p.id);
    if (p.alive) { if (d) this.deadAnim.delete(p.id); d = null; }
    else { if (!d) { d = { t: 0 }; this.deadAnim.set(p.id, d); } d.t += dt; }
    if (d && d.t > 1.0) return;
    const fade = d ? Math.max(0, 1 - d.t / 1.0) : 1;
    let col = PLAYER_COLORS[p.color % PLAYER_COLORS.length];
    const isMe = p.id === (view.localId || this.localId);
    const bodyItem = p.skin && BODY_BY_ID.get(p.skin.body);
    if (bodyItem && bodyItem.color) col = bodyItem.color === 'rainbow' ? hsv((t * 0.25 + p.color * 0.08) % 1, 0.65, 1) : bodyItem.color;
    const sp = Math.hypot(p.vx || 0, p.vz || 0);
    const sc = d ? fade : 1;
    this._pa = (p.iv || p.invisT > 0) ? (isMe ? 0.62 : 0.07) : 1;
    if (this._pa < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    const ch = CHARS[(p.skin && p.skin.char) || 'rookie'] || CHARS.rookie;
    let dark = bodyItem && bodyItem.dark ? [0.02, 0.02, 0.035] : bodyItem && bodyItem.id === 'chrome' ? [0.55, 0.58, 0.65] : [0.1, 0.11, 0.19];
    let armor = dark.map((c, i) => c * 0.6 + col[i] * 0.16);
    if (ch.toon) { dark = ch.face === 'mask' ? [0.07, 0.09, 0.2] : col.map((c) => c * 0.55); armor = ch.face === 'mask' ? [0.1, 0.13, 0.3] : col.map((c) => 0.25 + c * 0.6); }
    const emis = col.map((c) => c * 0.55 * fade);
    const glowC = col.map((c) => c * 1.6 * fade);
    const SKINS = [[0.96, 0.78, 0.63], [0.86, 0.64, 0.48], [0.68, 0.47, 0.34], [0.5, 0.34, 0.25], [0.98, 0.84, 0.72]];
    let skin = ch.toon && ch.face !== 'mask' || !ch.toon ? SKINS[p.color % SKINS.length] : SKINS[0];
    if (ch.skinI != null) skin = SKINS[ch.skinI];
    let pants = ch.face === 'mask' ? [0.05, 0.07, 0.16] : ch.toon ? [0.16, 0.22, 0.38] : dark.map((c) => c * 1.25 + 0.03);
    let boots = ch.face === 'mask' ? [0.04, 0.05, 0.12] : [0.12, 0.09, 0.08];
    if (ch.top) { armor = ch.top; pants = ch.bot; boots = ch.penguin ? [0.95, 0.55, 0.12] : [0.95, 0.95, 0.95]; }
    // clothing (outfit skin) for the realistic characters
    const OF = !ch.top && ch.face !== 'mask' && p.skin && OUTFIT_BY_ID.get(p.skin.outfit);
    const wear = OF && OF.top ? OF : null;
    if (wear) { armor = wear.top; pants = wear.bot; boots = wear.shoe || boots; }
    this._rs = ch.toon && !ch.cartoon ? 0.22 : 1;   // realistic characters: no neon outlines

    // ---- animation state: run cycle, sword swing, facing
    this._an = this._an || new Map();
    let an = this._an.get(p.id);
    if (!an) { an = { ph: 0, sw: -1, prevPa: false, vy: p.yaw, hold: 0 }; this._an.set(p.id, an); }
    const ball = view.ball;
    const ballLive = ball && (ball.mode === 'flying' || ball.mode === 'choosing' || ball.mode === 'charging');
    const pa = p.parryActive > 0;
    if ((pa && !an.prevPa) || p._swingNow) { an.sw = 0; p._swingNow = false; an.hold = 0.4; }
    an.prevPa = pa;
    if (an.sw >= 0) { an.sw += dt; if (an.sw > 0.34) an.sw = -1; }
    if (an.hold > 0) an.hold -= dt;
    // while swinging the character instantly turns to the ball (visual only: the hit distance / timing is unchanged)
    let wantYaw = p.yaw;
    if (an.hold > 0 && ballLive) wantYaw = Math.atan2(ball.x - p.x, ball.z - p.z);
    let dy = wantYaw - an.vy; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    an.vy += dy * Math.min(1, dt * (an.hold > 0 ? 30 : 12));
    const vy = an.vy;
    an.ph += sp * dt * 1.15;
    const run = Math.min(1, sp / 4);
    const F = [Math.sin(vy), Math.cos(vy)], R = [Math.cos(vy), -Math.sin(vy)];
    const g = (p.y || 0) + (d ? d.t * 1.2 : 0) + 0.02;          // ground under the feet
    const k = ch.s * sc, W = ch.w;                              // height / width scale
    const air = (p.y || 0) > 0.25;
    const bob = Math.sin(t * 2.6 + p.color) * 0.015 + Math.abs(Math.sin(an.ph)) * 0.05 * run;
    const px = p.x, pz = p.z;
    const P = (r_, f_, h_) => [px + R[0] * r_ * W * sc + F[0] * f_ * sc, g + (h_ + bob) * k, pz + R[1] * r_ * W * sc + F[1] * f_ * sc]; // local (right, forward, height)

    // legs (hidden for floating characters)
    const hipY = 0.95, lean = run * 0.12;
    if (ch.legs) {
      for (const s of [-1, 1]) {
        const cyc = Math.sin(an.ph + (s > 0 ? 0 : Math.PI)), lift = Math.max(0, Math.cos(an.ph + (s > 0 ? 0 : Math.PI)));
        const stride = air ? 0 : 0.34 * run;
        const hip = P(0.14 * s, 0, hipY);
        const foot = air ? P(0.14 * s, s > 0 ? 0.3 : -0.15, 0.55) : P(0.14 * s, cyc * stride, 0.07 + lift * 0.2 * run);
        const knee = air ? P(0.15 * s, s > 0 ? 0.35 : 0.25, 0.75) : P(0.15 * s, cyc * stride * 0.5 + 0.1 * run, 0.52 + lift * 0.14 * run);
        this._lit(this.m.sup, knee[0], knee[1], knee[2], vy, 0.105 * W * sc, 0.09 * sc, 0.105 * W * sc, pants, [0, 0, 0], 1, 0.3);
        this._bone(this.m.blk, hip[0], hip[1], hip[2], knee[0], knee[1], knee[2], 0.115 * W * sc, 0.115 * W * sc, pants, emis.map((c) => c * 0.05), 0.5, col);
        this._bone(this.m.blk, knee[0], knee[1], knee[2], foot[0], foot[1] + 0.07 * k, foot[2], 0.105 * W * sc, 0.105 * W * sc, pants, [0, 0, 0], 0.5, col);
        this._lit(this.m.sup, foot[0] + F[0] * 0.07 * sc, foot[1] + 0.02 * k, foot[2] + F[1] * 0.07 * sc, vy, 0.12 * W * sc, 0.06 * k, 0.2 * sc, boots, [0, 0, 0], 1, 0.6, col);
        this._lit(this.m.sup, foot[0] + F[0] * 0.07 * sc, foot[1] - 0.025 * k, foot[2] + F[1] * 0.07 * sc, vy, 0.125 * W * sc, 0.02 * k, 0.215 * sc, [0.85, 0.85, 0.82], [0, 0, 0], 1, 0.3);
      }
    }
    // torso: pelvis, chest plate, belt light
    const tc = P(0, lean * 0.4, 1.22);
    if (ch.torso === 'cone') this._litE(this.m.cone, tc[0], g + 0.8 * k, tc[2], vy, 0, 0, 0.5 * W * sc, 1.55 * k, 0.5 * W * sc, armor, emis.map((c) => c * 0.3), 1, 1.1, col);
    else {
      const pel = P(0, lean * 0.2, 1.0), wst = P(0, lean * 0.3, 1.12);
      this._litE(this.m.sup, pel[0], pel[1], pel[2], vy, lean * 0.5, 0, 0.24 * W * sc, 0.12 * k, 0.14 * W * sc, pants, [0, 0, 0], 1, 0.5, col);
      this._litE(this.m.sup, wst[0], wst[1], wst[2], vy, lean * 0.7, 0, 0.26 * W * sc, 0.15 * k, 0.14 * W * sc, armor, emis.map((c) => c * 0.15), 1, 0.7, col);
      this._litE(this.m.sup, tc[0], tc[1] + 0.03 * k, tc[2], vy, lean, 0, 0.3 * W * sc, 0.27 * k, 0.16 * W * sc, armor, emis.map((c) => c * 0.25), 1, 0.9, col);
      // collar / neckline
      const cl = P(0, 0.02, 1.5); this._lit(this.m.sup, cl[0], cl[1], cl[2], vy, 0.11 * W * sc, 0.04 * k, 0.09 * W * sc, ch.toon ? armor.map((c) => c * 0.8) : dark, [0, 0, 0], 1, 0.4);
    }
    const ch2 = P(0, 0.2, 1.3);
    if (!ch.toon) this._lit(this.m.sphere, ch2[0], ch2[1], ch2[2], vy, 0.1 * sc, 0.13 * k, 0.05 * sc, [0, 0, 0], glowC, 1, 0);       // chest core
    if (wear) {
      if (wear.hood) { const hd = P(0, -0.13, 1.52); this._lit(this.m.sup, hd[0], hd[1], hd[2], vy, 0.17 * W * sc, 0.1 * k, 0.1 * sc, armor.map((c) => c * 0.85), [0, 0, 0], 1, 0.2); }
      if (wear.pocket) { const pk = P(0, 0.16, 1.1); this._lit(this.m.box, pk[0], pk[1], pk[2], vy, 0.2 * W * sc, 0.07 * k, 0.02 * sc, armor.map((c) => c * 0.8), [0, 0, 0], 1, 0.1); }
      if (wear.stripe) for (const sd of [-1, 1]) { const sp2 = P(0.285 * sd * W, 0, 1.28); this._lit(this.m.box, sp2[0], sp2[1], sp2[2], vy, 0.018 * sc, 0.3 * k, 0.12 * sc, [0.97, 0.97, 0.97], [0, 0, 0], 1, 0.1); const lg = P(0.2 * sd * W, 0.0, 0.55); this._lit(this.m.box, lg[0], lg[1], lg[2], vy, 0.015 * sc, 0.8 * k, 0.1 * sc, [0.97, 0.97, 0.97], [0, 0, 0], 1, 0.1); }
      if (wear.tie) { const sh = P(0, 0.15, 1.46); this._lit(this.m.sup, sh[0], sh[1], sh[2], vy, 0.06 * sc, 0.1 * k, 0.015 * sc, [0.96, 0.96, 0.96], [0, 0, 0], 1, 0.2); const te = P(0, 0.17, 1.36); this._lit(this.m.sup, te[0], te[1], te[2], vy, 0.025 * sc, 0.15 * k, 0.015 * sc, [0.6, 0.06, 0.1], [0, 0, 0], 1, 0.2); }
      if (wear.collar) for (const sd of [-1, 1]) { const lp = P(0.07 * sd, 0.12, 1.45); this._lit(this.m.sup, lp[0], lp[1], lp[2], vy, 0.045 * sc, 0.1 * k, 0.03 * sc, armor.map((c) => c * 1.3 + 0.03), [0, 0, 0], 1, 0.5); }
      if (wear.sash) { const sb = P(0, 0.02, 1.12); this._lit(this.m.ring, sb[0], sb[1], sb[2], vy, 0.3 * W * sc, 3.2, 0.3 * W * sc, wear.sash, wear.sash.map((c) => c * 0.1), 1, 0.2); }
    }
    const bt = P(0, 0, 0.98);
    this._lit(this.m.ring, bt[0], bt[1], bt[2], vy, 0.27 * W * sc, 1, 0.27 * W * sc, [0, 0, 0], glowC.map((c) => c * (ch.toon ? 0.25 : 0.8)), 1, 0); // belt

    if (ch.face === 'mask') {
      // red sash + scarf tail that streams behind while running
      this._lit(this.m.ring, bt[0], bt[1], bt[2], vy, 0.3 * W * sc, 3, 0.3 * W * sc, [0, 0, 0], [1.4, 0.2, 0.2].map((c) => c * fade), 1, 0);
      const sc0 = P(0, -0.12, 1.55), sc1 = P(0.05 + Math.sin(t * 5) * 0.06 * (0.5 + run), -0.5 - run * 0.25, 1.45 - run * 0.1);
      this._bone(this.m.box, sc0[0], sc0[1], sc0[2], sc1[0], sc1[1], sc1[2], 0.1 * sc, 0.015 * sc, [0.75, 0.12, 0.12], [0.3, 0.02, 0.02].map((c) => c * fade), 0.4);
    }
    // head: neck, head, visor
    const HY = ch.hy, HS = ch.hs;
    const hc = P(0, lean * 0.6, HY);
    const hy = hc[1];
    this._lit(this.m.cyl, hc[0], hc[1] - 0.17 * k, hc[2], 0, 0.065 * sc, 0.13 * k, 0.065 * sc, ch.face === 'mask' ? dark : skin, [0, 0, 0], 1, 0.3);
    if (!ch.toon) {
      this._lit(this.m[ch.hm === 'sphere' ? 'head' : ch.hm], hc[0], hc[1], hc[2], vy, HS * sc, HS * 1.08 * sc, HS * sc, [0.16, 0.17, 0.27], emis.map((c) => c * 0.15), 1, 1.0, col);
      const vz = P(0, HS * 0.8, HY + 0.01);
      this._lit(this.m.box, vz[0], vz[1], vz[2], vy, HS * 1.25 * sc, HS * 0.34 * sc, 0.1 * sc, [0, 0, 0], glowC, 1, 0);
    } else if (ch.face === 'eyes') {
      // Rookie: round friendly head with big eyes
      this._lit(ch.cartoon ? this.m.round : this.m.head, hc[0], hc[1], hc[2], vy, HS * sc, HS * 1.04 * sc, HS * 0.98 * sc, ch.penguin ? [0.08, 0.09, 0.14] : skin, skin.map((c) => c * 0.18 * fade), 1, 0.7, [1, 0.9, 0.8]);
      for (const sd of [-1, 1]) { const ea = P(HS * 0.97 * sd, 0, HY); this._lit(this.m.sup, ea[0], ea[1], ea[2], vy, 0.03 * sc, 0.06 * sc, 0.045 * sc, skin.map((c) => c * 0.92), [0, 0, 0], 1, 0.3); }
      const ns = P(0, HS * 0.98, HY - 0.04); this._lit(this.m.sup, ns[0], ns[1], ns[2], vy, 0.035 * sc, 0.04 * sc, 0.04 * sc, skin.map((c) => c * 0.95), [0, 0, 0], 1, 0.3);
      const mo = P(0, HS * 0.9, HY - 0.15); this._lit(this.m.box, mo[0], mo[1], mo[2], vy, 0.09 * sc, 0.012 * sc, 0.02 * sc, [0.55, 0.2, 0.2], [0, 0, 0], 1, 0.1);
      const es = ch.cartoon ? HS / 0.36 * 1.15 : HS / 0.36;
      for (const sd of [-1, 1]) {
        const e1 = P(0.115 * sd * es, HS * 0.86, HY + 0.03 * es), e2 = P(0.115 * sd * es, HS * 0.93, HY + 0.03 * es);
        this._lit(this.m.sphere, e1[0], e1[1], e1[2], vy, 0.075 * es * sc, 0.09 * es * sc, 0.04 * sc, [1, 1, 1], [0.6, 0.6, 0.6].map((c) => c * fade), 1, 0);
        this._lit(this.m.sphere, e2[0], e2[1], e2[2], vy, 0.042 * es * sc, 0.058 * es * sc, 0.03 * sc, ch.cartoon ? [0.1, 0.25, 0.5] : [0.05, 0.05, 0.1], [0, 0, 0], 1, 0);
        if (ch.cartoon) { const cb = P(0.2 * sd * es, HS * 0.8, HY - 0.1 * es); this._lit(this.m.sphere, cb[0], cb[1], cb[2], vy, 0.05 * sc, 0.03 * sc, 0.02 * sc, [1, 0.55, 0.55], [0.15, 0.04, 0.04].map((c) => c * fade), 1, 0); }
      }
      for (const sd of [-1, 1]) { const eb = P(0.115 * sd * es, HS * 0.93, HY + 0.075 * es); this._lit(this.m.box, eb[0], eb[1], eb[2], vy, 0.075 * es * sc, 0.014 * sc, 0.016 * sc, ch.hairC ? ch.hairC.map((c) => c * 0.7) : [0.18, 0.12, 0.08], [0, 0, 0], 1, 0.1); }
      if (ch.shades) {
        const sh = P(0, HS * 0.95, HY + 0.035 * es);
        this._lit(this.m.sup, sh[0], sh[1], sh[2], vy, HS * 0.85 * sc, 0.06 * sc, 0.03 * sc, [0.1, 0.05, 0.12], [0.3, 0.1, 0.35].map((c) => c * fade), 1, 0.6);
        for (const sd of [-1, 1]) { const l = P(0.115 * sd * es, HS * 0.97, HY + 0.035 * es); this._lit(this.m.sup, l[0], l[1], l[2], vy, 0.1 * es * sc, 0.08 * es * sc, 0.025 * sc, [0.9, 0.25, 0.7], [0.4, 0.1, 0.3].map((c) => c * fade), 1, 0.8, [1, 0.8, 1]); }
      }
      if (ch.hair) {
        const HAIRS = [[0.12, 0.08, 0.05], [0.3, 0.18, 0.08], [0.75, 0.55, 0.25], [0.06, 0.05, 0.05], [0.5, 0.2, 0.1]];
        const hcol = ch.hairC || HAIRS[p.color % HAIRS.length], hn = hcol.map((c) => c * 0.8);
        const cap = (up, back, sx, sy) => { const q = P(0, -back, HY + up); this._lit(this.m.round, q[0], q[1], q[2], vy, HS * sx * sc, HS * sy * sc, HS * sx * sc, hcol, hcol.map((c) => c * 0.1 * fade), 1, 0.9, [1, 1, 1]); };
        if (ch.hair === 'afro') { const q = P(0, -HS * 0.18, HY + HS * 0.2); this._lit(this.m.sphere, q[0], q[1], q[2], vy, HS * 1.38 * sc, HS * 1.3 * sc, HS * 1.3 * sc, hcol, hcol.map((c) => c * 0.12 * fade), 1, 0.8, [1, 1, 1]); }
        else if (ch.hair === 'short') {
          cap(HS * 0.2, HS * 0.1, 1.05, 0.82);
          for (const sd of [-1, 1]) { const q = P(HS * 0.92 * sd, -HS * 0.15, HY + HS * 0.05); this._lit(this.m.sup, q[0], q[1], q[2], vy, 0.04 * sc, HS * 0.4 * sc, HS * 0.45 * sc, hcol, [0, 0, 0], 1, 0.5); }
          const fr = P(0, HS * 0.9, HY + HS * 0.55); this._lit(this.m.sup, fr[0], fr[1], fr[2], vy, HS * 0.85 * sc, 0.035 * sc, 0.05 * sc, hcol, [0, 0, 0], 1, 0.4);
        } else if (ch.hair === 'pony') {
          cap(HS * 0.22, HS * 0.1, 1.07, 0.85);
          const t0 = P(0, -HS * 0.95, HY + HS * 0.35), t1 = P(Math.sin(t * 4 + p.color) * 0.07 * (0.4 + run), -HS * 1.35 - run * 0.15, HY - 0.3 * k);
          this._bone(this.m.blk, t0[0], t0[1], t0[2], t1[0], t1[1], t1[2], 0.085 * sc, 0.085 * sc, hcol, hcol.map((c) => c * 0.1 * fade), 0.6, [1, 1, 1]);
          const bg = P(0, HS * 0.95, HY + HS * 0.62); this._lit(this.m.sup, bg[0], bg[1], bg[2], vy, HS * 0.8 * sc, 0.07 * sc, 0.07 * sc, hn, [0, 0, 0], 1, 0.4);
        } else if (ch.hair === 'bun') {
          cap(HS * 0.2, HS * 0.08, 1.07, 0.85);
          const bn = P(0, -HS * 0.12, HY + HS * 1.0); this._lit(this.m.sphere, bn[0], bn[1], bn[2], vy, 0.17 * sc, 0.16 * sc, 0.17 * sc, hcol, hcol.map((c) => c * 0.12 * fade), 1, 0.8, [1, 1, 1]);
        } else if (ch.hair === 'bob') {
          cap(HS * 0.2, HS * 0.12, 1.08, 0.86);
          for (const sd of [-1, 1]) { const q = P(HS * 0.98 * sd, -HS * 0.1, HY - HS * 0.1); this._lit(this.m.sup, q[0], q[1], q[2], vy, 0.09 * sc, HS * 0.62 * sc, 0.2 * sc, hcol, hcol.map((c) => c * 0.1 * fade), 1, 0.7, [1, 1, 1]); }
          const bg = P(0, HS * 0.93, HY + HS * 0.58); this._lit(this.m.sup, bg[0], bg[1], bg[2], vy, HS * 0.9 * sc, 0.1 * sc, 0.07 * sc, hcol, [0, 0, 0], 1, 0.4);
        }
      }
      if (ch.penguin) {
        const bk = P(0, HS * 1.02, HY - 0.06 * es); this._lit(this.m.sup, bk[0], bk[1], bk[2], vy, 0.09 * sc, 0.04 * sc, 0.12 * sc, [1, 0.62, 0.12], [0.25, 0.1, 0.02].map((c) => c * fade), 1, 0.5);
        const bl = P(0, 0.14, 1.26); this._litE(this.m.sup, bl[0], bl[1], bl[2], vy, lean, 0, 0.2 * W * sc, 0.24 * k, 0.1 * sc, [0.96, 0.96, 0.98], [0.1, 0.1, 0.12].map((c) => c * fade), 1, 0.6);
        const fc = P(0, HS * 0.8, HY + 0.02); this._lit(this.m.sup, fc[0], fc[1] - 0.02, fc[2], vy, HS * 0.7 * sc, HS * 0.55 * sc, 0.05 * sc, [0.96, 0.96, 0.98], [0, 0, 0], 1, 0.3);
      }
      if (ch.bowtie) { for (const sd of [-1, 1]) { const q = P(0.07 * sd, 0.12, 1.5); this._lit(this.m.sup, q[0], q[1], q[2], vy, 0.06 * sc, 0.045 * sc, 0.04 * sc, [0.7, 0.05, 0.1], [0.2, 0.02, 0.03].map((c) => c * fade), 1, 0.4); } }
      // cap in the player colour (the cartoon cast has hair instead)
      if (!ch.hair) this._lit(this.m.head, hc[0], hc[1] + HS * 0.35 * sc, hc[2], vy, HS * 1.04 * sc, HS * 0.72 * sc, HS * 1.04 * sc, col.map((c) => c * 0.85), emis.map((c) => c * 0.3), 1, 0.9, [1, 1, 1]);
      const br = P(0, HS * 0.95, HY + HS * 0.42);
      if (!ch.hair) this._lit(this.m.box, br[0], br[1], br[2], vy, HS * 0.9 * sc, 0.03 * sc, 0.22 * sc, col.map((c) => c * 0.7), [0, 0, 0], 1, 0.6);
    } else {
      // Ninja: dark hood + mask, glowing eye slit, headband with flowing tails
      this._lit(this.m.head, hc[0], hc[1], hc[2], vy, HS * sc, HS * 1.04 * sc, HS * 0.98 * sc, [0.07, 0.09, 0.2], [0.02, 0.03, 0.07].map((c) => c * fade), 1, 1.0, col);
      const ey = P(0, HS * 0.9, HY + 0.04);
      this._lit(this.m.box, ey[0], ey[1], ey[2], vy, HS * 0.8 * sc, 0.07 * sc, 0.05 * sc, [0.95, 0.85, 0.75], [0.5, 0.35, 0.3].map((c) => c * fade), 1, 0.2);
      for (const sd of [-1, 1]) { const pp = P(0.14 * sd, HS * 0.93, HY + 0.045); this._lit(this.m.box, pp[0], pp[1], pp[2], vy, 0.07 * sc, 0.035 * sc, 0.03 * sc, [0, 0, 0], [1.8, 0.2, 0.2].map((c) => c * fade), 1, 0); }
      const hb = P(0, 0, HY + HS * 0.38);
      this._lit(this.m.ring, hb[0], hb[1], hb[2], vy, HS * 1.0 * sc, 1.6, HS * 1.0 * sc, [0, 0, 0], col.map((c) => c * 1.2 * fade), 1, 0);
      for (let i = 0; i < 2; i++) {
        const w1 = Math.sin(t * 6 + i) * 0.08 + run * 0.12;
        const a0 = P(0.04 * (i ? 1 : -1), -HS * 0.9, HY + HS * 0.38), a1 = P(0.1 * (i ? 1 : -1) + w1, -HS * 0.9 - 0.3, HY + HS * 0.3 - run * 0.05);
        this._bone(this.m.box, a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], 0.05 * sc, 0.012 * sc, col.map((c) => c * 0.9), emis.map((c) => c * 0.3), 0.4);
      }
    }

    // shoulders + arms + sword
    const shR = P(0.38, 0, 1.5), shL = P(-0.38, 0, 1.5);
    for (const sh of [shR, shL]) this._lit(this.m.sup, sh[0], sh[1], sh[2], vy, 0.13 * W * sc, 0.09 * sc, 0.12 * W * sc, armor, emis.map((c) => c * 0.5), 1, 1.0, col);
    // left arm: swings against the legs; during a swing it is held back for balance
    {
      const sw = Math.sin(an.ph + Math.PI) * 0.4 * run;
      const hand = an.sw >= 0 ? P(-0.55, -0.15, 1.15) : P(-0.43, sw, 0.95 + Math.abs(sw) * 0.2);
      const el = P(-0.5, hand[0] === 0 ? 0 : (sw * 0.5), 1.2);
      this._lit(this.m.sup, el[0], el[1], el[2], vy, 0.085 * sc, 0.085 * sc, 0.085 * sc, wear && wear.long ? armor : skin, [0, 0, 0], 1, 0.3);
      this._bone(this.m.blk, shL[0], shL[1], shL[2], el[0], el[1], el[2], 0.1 * sc, 0.1 * sc, armor, [0, 0, 0], 0.6, col);
      this._bone(this.m.blk, el[0], el[1], el[2], hand[0], hand[1], hand[2], 0.088 * sc, 0.088 * sc, ch.face === 'mask' ? dark : (wear && wear.long ? armor : skin), [0, 0, 0], 0.5, col);
      this._lit(this.m.sup, hand[0], hand[1], hand[2], vy, 0.075 * sc, 0.07 * sc, 0.08 * sc, ch.face === 'mask' ? dark : skin, [0, 0, 0], 1, 0.5, col);
      this._lit(this.m.sup, hand[0] + R[0] * 0.07 * sc, hand[1] + 0.03 * sc, hand[2] + R[1] * 0.07 * sc, vy, 0.025 * sc, 0.035 * sc, 0.04 * sc, ch.face === 'mask' ? dark : skin, [0, 0, 0], 1, 0.4);
    }
    // right arm + sword
    {
      let a, hand, D;           // a: slash angle, D: unit blade direction (world)
      if (an.sw >= 0) {
        const u = an.sw / 0.34;
        const ease = (x) => x * x * (3 - 2 * x);
        a = u < 0.25 ? 0.3 + (1.55 - 0.3) * (1 - Math.pow(1 - u / 0.25, 2)) : 1.55 + (-1.35 - 1.55) * ease((u - 0.25) / 0.75);
        const hx = F[0] * Math.cos(a) + R[0] * Math.sin(a), hz = F[1] * Math.cos(a) + R[1] * Math.sin(a);
        const sRef = shR;
        hand = [sRef[0] + hx * 0.5 * sc, sRef[1] - 0.05 * k, sRef[2] + hz * 0.5 * sc];
        D = [hx, 0.06, hz];
        // glowing slash trail along the blade tip
        if (u > 0.2) { const tp = [hand[0] + D[0] * 1.5 * sc, hand[1] + 0.1, hand[2] + D[2] * 1.5 * sc]; this.fx.spawn(tp[0], tp[1], tp[2], 0, 0.2, 0, 0.28, 0.5, 0.02, col[0] * 1.2, col[1] * 1.2, col[2] * 1.2, 0.8, SHAPE.GLOW); this.fx.spawn(tp[0] - D[0] * 0.7, tp[1], tp[2] - D[2] * 0.7, 0, 0.1, 0, 0.22, 0.35, 0.02, 1, 1, 1, 0.7, SHAPE.CORE); }
      } else {
        const bobS = Math.sin(an.ph) * 0.06 * run;
        hand = P(0.46, 0.3 + bobS, 1.0);
        const dl = Math.hypot(0.5 * F[0] + 0.1 * R[0], 0.5 * F[1] + 0.1 * R[1]) || 1;
        D = [(0.55 * F[0] + 0.12 * R[0]) / 1.0, 0.8, (0.55 * F[1] + 0.12 * R[1]) / 1.0];
        const l2 = Math.hypot(D[0], D[1], D[2]); D = [D[0] / l2, D[1] / l2, D[2] / l2];
      }
      const el = [(shR[0] + hand[0]) / 2 + R[0] * 0.08, (shR[1] + hand[1]) / 2 - 0.06, (shR[2] + hand[2]) / 2 + R[1] * 0.08];
      this._lit(this.m.sup, el[0], el[1], el[2], vy, 0.085 * sc, 0.085 * sc, 0.085 * sc, wear && wear.long ? armor : skin, [0, 0, 0], 1, 0.3);
      this._bone(this.m.blk, shR[0], shR[1], shR[2], el[0], el[1], el[2], 0.1 * sc, 0.1 * sc, armor, [0, 0, 0], 0.6, col);
      this._bone(this.m.blk, el[0], el[1], el[2], hand[0], hand[1], hand[2], 0.088 * sc, 0.088 * sc, ch.face === 'mask' ? dark : (wear && wear.long ? armor : skin), [0, 0, 0], 0.5, col);
      this._lit(this.m.sup, hand[0], hand[1], hand[2], vy, 0.078 * sc, 0.07 * sc, 0.085 * sc, ch.face === 'mask' ? dark : skin, [0, 0, 0], 1, 0.5, col);
      this._lit(this.m.sup, hand[0] - R[0] * 0.07 * sc, hand[1] + 0.03 * sc, hand[2] - R[1] * 0.07 * sc, vy, 0.025 * sc, 0.035 * sc, 0.04 * sc, ch.face === 'mask' ? dark : skin, [0, 0, 0], 1, 0.4);
      // the sword: grip, guard, blade with glowing edge
      const sx0 = hand[0] - D[0] * 0.16 * sc, sy0 = hand[1] - D[1] * 0.16 * sc, sz0 = hand[2] - D[2] * 0.16 * sc;
      const gx = hand[0] + D[0] * 0.1 * sc, gy = hand[1] + D[1] * 0.1 * sc, gz = hand[2] + D[2] * 0.1 * sc;
      const BL = ch.katana ? 1.55 : 1.3, BW = ch.katana ? 0.07 : 0.1;
      const tx = hand[0] + D[0] * BL * sc, ty = hand[1] + D[1] * BL * sc, tz = hand[2] + D[2] * BL * sc;
      this._bone(this.m.cyl, sx0, sy0, sz0, gx, gy, gz, 0.035 * sc, 0.035 * sc, [0.25, 0.18, 0.12], [0, 0, 0], 0.4);
      this._lit(this.m.sphere, sx0, sy0, sz0, 0, 0.05 * sc, 0.05 * sc, 0.05 * sc, [0.9, 0.75, 0.3], [0.2, 0.15, 0.05].map((c) => c * fade), 1, 0.6);
      this._litE(this.m.box, gx, gy, gz, vy, 0, 0, (ch.katana ? 0.16 : 0.3) * sc, 0.045 * sc, 0.06 * sc, [0.9, 0.75, 0.3], [0.25, 0.2, 0.05].map((c) => c * fade), 1, 0.6);
      this._bone(this.m.box, gx, gy, gz, tx, ty, tz, BW * sc, 0.022 * sc, [0.8, 0.86, 0.95], glowC.map((c) => c * 0.35), 1.4, col);
      this._bone(this.m.box, gx, gy, gz, tx, ty, tz, 0.035 * sc, 0.03 * sc, [1, 1, 1], glowC, 0, col);
    }

    // headgear
    const head = p.skin && p.skin.head;
    if (head && head !== 'none') {
      const gold = [1.0, 0.8, 0.25], rx2 = R[0], rz2 = R[1], hs = HS / 0.27;
      if (head === 'antenna') {
        this._lit(this.m.cyl, hc[0], hy + 0.5 * sc, hc[2], 0, 0.022 * sc, 0.46 * sc, 0.022 * sc, dark, [0, 0, 0], 1, 0.3);
        this._lit(this.m.sphere, hc[0], hy + 0.76 * sc, hc[2], 0, 0.07 * sc, 0.07 * sc, 0.07 * sc, [0, 0, 0], col.map((c) => c * (1.4 + 0.5 * Math.sin(t * 6)) * fade), 1, 0);
      } else if (head === 'helmet') {
        this._lit(this.m.sphere, hc[0], hy + 0.05 * sc, hc[2], vy, 0.3 * sc * hs, 0.26 * sc * hs, 0.3 * sc * hs, [0.25, 0.27, 0.34], emis.map((c) => c * 0.1), 1, 0.9, col);
        this._lit(this.m.box, hc[0], hy + 0.27 * sc * hs, hc[2], vy, 0.05 * sc, 0.08 * sc, 0.34 * sc, col.map((c) => c * 0.7), emis.map((c) => c * 0.4), 1, 0.2);
      } else if (head === 'horns') {
        for (const sd of [-1, 1]) this._lit(this.m.cone, hc[0] + rx2 * 0.2 * sd * sc, hy + 0.3 * sc * hs, hc[2] + rz2 * 0.2 * sd * sc, 0, 0.07 * sc, 0.34 * sc, 0.07 * sc, [0.9, 0.85, 0.7], [0.25, 0.08, 0.04].map((c) => c * fade), 1, 0.5);
      } else if (head === 'halo') {
        this._lit(this.m.ring, hc[0], hy + 0.45 * sc * hs + Math.sin(t * 3) * 0.04, hc[2], t, 0.3 * sc, 1, 0.3 * sc, [0, 0, 0], gold.map((c) => c * 1.7 * fade), 1, 0);
      } else if (head === 'wizard') {
        this._lit(this.m.cyl, hc[0], hy + 0.2 * sc * hs, hc[2], 0, 0.4 * sc, 0.035 * sc, 0.4 * sc, [0.25, 0.12, 0.45], [0.12, 0.05, 0.25].map((c) => c * fade), 1, 0.5);
        this._lit(this.m.cone, hc[0], hy + 0.54 * sc * hs, hc[2], 0, 0.27 * sc, 0.66 * sc, 0.27 * sc, [0.3, 0.15, 0.55], [0.12, 0.05, 0.3].map((c) => c * fade), 1, 0.7);
        this._lit(this.m.sphere, hc[0], hy + 0.88 * sc * hs, hc[2], 0, 0.05 * sc, 0.05 * sc, 0.05 * sc, [0, 0, 0], gold.map((c) => c * 1.5 * fade), 1, 0);
      } else if (head === 'crown') {
        this._lit(this.m.cyl, hc[0], hy + 0.26 * sc * hs, hc[2], 0, 0.24 * sc, 0.1 * sc, 0.24 * sc, gold, gold.map((c) => c * 0.35 * fade), 1, 0.6);
        for (let i = 0; i < 5; i++) { const an2 = (i / 5) * 6.283; this._lit(this.m.cone, hc[0] + Math.sin(an2) * 0.2 * sc, hy + 0.42 * sc * hs, hc[2] + Math.cos(an2) * 0.2 * sc, 0, 0.055 * sc, 0.2 * sc, 0.055 * sc, gold, gold.map((c) => c * 0.5 * fade), 1, 0.6); }
      }
    }
    // character extras
    if (ch.extra === 'shield') { const sh = P(-0.6, 0.12, 1.05); this._lit(this.m.box, sh[0], sh[1], sh[2], vy, 0.06 * sc, 0.42 * sc, 0.3 * sc, [0.5, 0.52, 0.6], col.map((c) => c * 0.3 * fade), 1, 0.8, col); }
    if (ch.extra === 'ant') for (const sd of [-1, 1]) { const a2 = P(0.15 * sd, 0, HY + 0.3); this._lit(this.m.cyl, a2[0], a2[1], a2[2], 0, 0.02 * sc, 0.3 * sc, 0.02 * sc, dark, col.map((c) => c * fade), 1, 0.3); }
    this._rs = 1;
    if (this._pa < 1) { gl.disable(gl.BLEND); this._pa = 1; }
    // shield bubble + haste sparks
    if (p.alive && p.shield) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const sp2 = 1 + Math.sin(t * 5) * 0.04;
      this._lit(this.m.sphere, px, g + 1.0 * k, pz, t, 0.95 * sp2, 1.3 * sp2, 0.95 * sp2, [0.2, 0.7, 1], [0.1, 0.5, 0.9], 0.28, 1.6, [0.4, 0.95, 1]);
      gl.disable(gl.BLEND);
    }
    if (p.alive && p.hasteT > 0 && Math.random() < 0.6) this.fx.spawn(px + (Math.random() - 0.5) * 0.5, g + 0.3, pz + (Math.random() - 0.5) * 0.5, 0, 0.6, 0, 0.35, 0.35, 0.02, 1, 0.75, 0.2, 0.9, SHAPE.GLOW);
    if (p.alive && sp > 1.5 && Math.random() < 0.4) this.fx.spawn(px - (p.vx || 0) * 0.05, g + 0.08, pz - (p.vz || 0) * 0.05, 0, 0.2, 0, 0.3, 0.26, 0.02, col[0], col[1], col[2], 0.6, SHAPE.GLOW);
    // soft sun shadow: a few stacked translucent discs stretched away from the light
    if (p.alive && !(this.theme.pattern === 0 && false)) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      const gh = (p.y || 0), a0 = this.theme.day ? 0.2 : 0.14;
      for (const [hh, rr] of [[0.0, 0.62], [0.9, 0.5], [1.7, 0.36]]) {
        const ox = -0.56 * (hh + gh), oz = -0.44 * (hh + gh);
        for (let i = 0; i < 3; i++) this._lit(this.m.cyl, px + ox, 0.045 + i * 0.002, pz + oz, 0, (rr - i * 0.1) * sc * (1 + gh * 0.15), 0.01, (rr - i * 0.1) * sc * (1 + gh * 0.15), [0, 0, 0], [0, 0, 0], a0 * fade, 0);
      }
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // ground ring (marks your own character with a white one)
    this._lit(this.m.ring, px, 0.12, pz, t * 2, (0.62 - Math.min(0.25, (p.y || 0) * 0.2)) * sc, 1, 0.62 * sc, [0, 0, 0], col.map((c) => c * (isMe ? 2.0 : 1.2) * fade), 1, 0);
    if (isMe && p.alive) this._lit(this.m.ring, px, 0.1, pz, 0, 0.95, 1, 0.95, [0, 0, 0], [1.6, 1.6, 1.6], 1, 0);
  }

  // =================================================================== additive effects
  _frameFx(view, t, dt, c) {
    const fx = this.fx;
    const { ball, glow, ballY, si, crit, flying, target, targetsViewer } = c;
    const theme = this.cosm.ball;

    // ---- ambient particles per arena theme (spawned around the camera focus)
    {
      const a = null /* ambient floating lights removed on request */, cam = this.cam, ac = this.theme.accent;
      const n = (rate) => { const x = rate * dt; return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); };
      const rx = () => cam.tx + (Math.random() - 0.5) * 70, rz = () => cam.tz + (Math.random() - 0.5) * 70;
      const inside = (x, z) => x * x + z * z < this.map.R * this.map.R * 1.05;
      if (a === 'motes') for (let i = n(16); i > 0; i--) { const x = rx(), z = rz(); if (inside(x, z)) fx.spawn(x, 0.5 + Math.random() * 9, z, (Math.random() - 0.5) * 0.6, 0.25 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 5, 0.13, 0.02, ac[0], ac[1], ac[2], 0.5, SHAPE.GLOW, 0, 0); }
      else if (a === 'embers') for (let i = n(34); i > 0; i--) { const x = rx(), z = rz(); if (inside(x, z)) fx.spawn(x, 0.1, z, (Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.2, 3.2, 0.16, 0.02, 1, 0.45 + Math.random() * 0.25, 0.1, 0.9, SHAPE.CORE, -0.3, 0.2); }
      else if (a === 'snow') for (let i = n(46); i > 0; i--) { const x = rx(), z = rz(); fx.spawn(x, 16 + Math.random() * 4, z, (Math.random() - 0.5) * 1.4, -1.6 - Math.random(), (Math.random() - 0.5) * 1.4, 9, 0.1, 0.09, 0.9, 0.97, 1, 0.8, SHAPE.DISC, 0, 0); }
      else if (a === 'sparks') for (let i = n(22); i > 0; i--) { const x = rx(), z = rz(); if (inside(x, z)) fx.spawn(x, 0.2 + Math.random() * 3, z, (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 2, 2.2, 0.12, 0.02, ac[0], ac[1], ac[2], 0.9, SHAPE.CORE, -0.2, 0.3); }
    }

    // ---- aura sprites for the local player (and soft halos for everyone)
    for (const p of view.players) {
      if (!p.alive) continue;
      const col = PLAYER_COLORS[p.color % PLAYER_COLORS.length];
      const isMe = p.id === (view.localId || this.localId);
      fx.sprite(p.x, 0.15, p.z, 1.3, col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0.55, SHAPE.GLOW);
      if (isMe) {
        const a = this.cosm.aura;
        const rb = hsv((t * 0.4) % 1, 0.6, 1);
        if (a.mode === 'halo') { for (let i = 0; i < 10; i++) { const an = (i / 10) * 6.283 + t; fx.sprite(p.x + Math.sin(an) * 0.5, 2.15, p.z + Math.cos(an) * 0.5, 0.12, 1, 0.95, 0.6, 0.9, SHAPE.CORE); } }
        else if (a.mode === 'pulse') { const k = (t * 1.4) % 1; fx.sprite(p.x, 1.0, p.z, 0.8 + k * 2.0, col[0], col[1], col[2], (1 - k) * 0.5, SHAPE.GLOW); }
        else if (a.mode === 'flame') { if (Math.random() < 0.8) fx.spawn(p.x + (Math.random() - 0.5) * 0.5, 0.3, p.z + (Math.random() - 0.5) * 0.5, 0, 1.7, 0, 0.7, 0.35, 0.05, 1.0, 0.45, 0.1, 0.9, SHAPE.GLOW, -0.5, 1); }
        else if (a.mode === 'orbit') { for (let i = 0; i < 3; i++) { const an = t * 2.4 + (i / 3) * 6.283; fx.sprite(p.x + Math.sin(an) * 0.95, 1.1 + Math.sin(t * 3 + i) * 0.3, p.z + Math.cos(an) * 0.95, 0.22, rb[0], rb[1], rb[2], 1, SHAPE.CORE); } }
        else if (a.mode === 'storm') { if (Math.random() < 0.6) { const an = Math.random() * 6.283; fx.spawn(p.x + Math.sin(an) * 0.6, 0.2 + Math.random() * 1.6, p.z + Math.cos(an) * 0.6, Math.cos(an) * 2, 0.6, -Math.sin(an) * 2, 0.5, 0.18, 0.02, 0.6, 0.8, 1, 1, SHAPE.CORE, 0, 2); } }
      }
      if (p.dashT > 0) fx.sprite(p.x, 0.9, p.z, 1.8, col[0], col[1], col[2], 0.6, SHAPE.GLOW);
    }

    if (ball.mode === 'none') { this.trail.length = 0; return; }

    // ---- ball
    const bx = ball.x, bz = ball.z;
    const charging = ball.mode === 'charging';
    const choosing = ball.mode === 'choosing';
    const pulse = charging ? 0.7 + 0.3 * Math.sin(t * 16) : 1;
    const gs = (1.5 + si * 0.9 + crit * 0.6) * pulse * (charging ? 0.8 + 0.5 * Math.min(1, (1 - (ball.t || 0) / CFG.CHARGE_TIME)) : 1);
    fx.sprite(bx, ballY, bz, gs * 1.5, glow[0] * 0.3, glow[1] * 0.3, glow[2] * 0.3, 0.45, SHAPE.GLOW);
    fx.sprite(bx, ballY, bz, gs * 0.75, glow[0], glow[1], glow[2], 0.5, SHAPE.GLOW);
    fx.sprite(bx, ballY, bz, gs * 0.18, theme.core[0], theme.core[1], theme.core[2], 0.5, SHAPE.CORE);
    // charging: spinning sparks gather on the ball
    if (charging) for (let i = 0; i < 6; i++) { const an = t * 5 + (i / 6) * 6.283; const rr = 1.8 * (ball.t / CFG.CHARGE_TIME); fx.sprite(bx + Math.sin(an) * rr, ballY + Math.cos(an * 1.3) * 0.5, bz + Math.cos(an) * rr, 0.2, glow[0], glow[1], glow[2], 1, SHAPE.CORE); }

    // ---- trail
    if (flying) {
      this.trail.push([bx, ballY, bz]);
      const maxLen = Math.round(8 + si * 16 + crit * 8);
      while (this.trail.length > maxLen) this.trail.shift();
    } else this.trail.length = 0;
    const tr = theme.glow === 'rainbow' ? null : glow;
    const mode = this.cosm.trail.mode;
    for (let i = 0; i < this.trail.length; i++) {
      const k = i / this.trail.length; // 0 old .. 1 new
      const q = this.trail[i];
      const col = tr || hsv((t * 0.5 + k * 0.4) % 1, 0.7, 1);
      if (mode === 'comet') fx.sprite(q[0], q[1], q[2], 0.15 + k * (0.55 + 0.5 * si), col[0], col[1], col[2], k * 0.3, SHAPE.GLOW);
      else if (mode === 'ribbon') fx.sprite(q[0], q[1], q[2], 0.25 + k * 0.7, col[0], col[1], col[2], k * 0.9, SHAPE.DISC);
      else if (mode === 'dots') { if (i % 2 === 0) fx.sprite(q[0], q[1], q[2], 0.12 + k * 0.18, col[0], col[1], col[2], k, SHAPE.DISC); }
      else if (mode === 'sparks') fx.sprite(q[0], q[1], q[2], 0.1 + k * 0.35, col[0], col[1], col[2], k * 0.3, SHAPE.GLOW);
      else if (mode === 'stardust') fx.sprite(q[0] + Math.sin(i * 7.3 + t * 8) * 0.25, q[1] + Math.cos(i * 3.1 + t * 6) * 0.25, q[2] + Math.sin(i * 5.7) * 0.25, 0.12 + k * 0.2, col[0], col[1], col[2], k * 0.9, SHAPE.CORE);
    }
    if (flying && (mode === 'sparks' || mode === 'stardust') && Math.random() < 0.7) {
      const col = tr || hsv((t * 0.5) % 1, 0.7, 1);
      fx.spawn(bx, ballY, bz, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.5, 0.2, 0.02, col[0], col[1], col[2], 1, SHAPE.CORE, 4, 1);
    }
    // extra ember sparks when very fast
    if (flying && crit > 0 && Math.random() < crit) fx.spawn(bx, ballY, bz, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.4, 0.25, 0.02, 1, 0.5, 0.9, 1, SHAPE.CORE, 6, 1);

    // ---- target indication: dotted beam from the ball to the target
    const cands = choosing && ball.cands ? ball.cands.map((id) => view.byId.get(id)).filter(Boolean) : target ? [target] : [];
    for (const tp of cands) {
      if (!tp.alive) continue;
      const dx = tp.x - bx, dz = tp.z - bz;
      const len = Math.hypot(dx, dz);
      const n = Math.min(26, Math.max(6, Math.floor(len / 1.1)));
      const strong = tp.id === (view.localId || this.localId);
      for (let i = 1; i < n; i++) {
        const f = ((i + (t * 3) % 1) / n);
        if (f > 1) continue;
        const a = (strong ? 0.75 : 0.45) * (0.4 + 0.6 * f);
        fx.sprite(bx + dx * f, ballY * (1 - f) + 1.0 * f, bz + dz * f, strong ? 0.22 : 0.15, 1, 0.3 + 0.2 * f, 0.15, a, SHAPE.CORE);
      }
      // ring marker (also for second double-target candidate)
      if (choosing || strong) {
        const pul = 0.5 + 0.5 * Math.sin(t * 12);
        for (let i = 0; i < 18; i++) { const an = (i / 18) * 6.283 + t * 2; fx.sprite(tp.x + Math.sin(an) * 1.75, 0.15, tp.z + Math.cos(an) * 1.75, 0.18, 1, 0.2, 0.12, 0.5 + 0.5 * pul, SHAPE.CORE); }
      }
      // chevron above the target's head
      fx.sprite(tp.x, 2.7 + Math.sin(t * 8) * 0.12, tp.z, 0.5, 1, 0.25, 0.15, 0.95, SHAPE.CORE);
    }
  }

  // =================================================================== event driven particles
  onEvent(e, view) {
    const fx = this.fx;
    const colorFor = (id) => { const p = view.byId.get(id); return p ? PLAYER_COLORS[p.color % PLAYER_COLORS.length] : [0.6, 0.9, 1]; };
    switch (e.type) {
      case 'parry': {
        const isMe = e.id === (view.localId || this.localId);
        const pf = isMe ? this.cosm.parry : { color: colorFor(e.id), mode: 'ring' };
        const c = pf.color;
        { const pp = view.byId.get(e.id), an0 = this._an && this._an.get(e.id); if (pp && (!an0 || (an0.sw < 0 && an0.hold < 0.1))) pp._swingNow = true; } // others: swing at the moment of the hit
        const big = e.quality === 'perfect';
        const y = CFG.BALL_H;
        fx.burst(e.x, y, e.z, big ? 80 : 36, big ? 11 : 7, big ? 0.9 : 0.6, big ? 0.34 : 0.26, big ? [1, 1, 1] : c, { shape: SHAPE.CORE, grav: 2 });
        fx.burst(e.x, y, e.z, big ? 40 : 20, big ? 8 : 5, 0.7, 0.3, c, { shape: SHAPE.GLOW, grav: 0.5 });
        fx.ring(e.x, y, e.z, big ? 44 : 28, big ? 15 : 10, 0.5, big ? 0.55 : 0.4, c);
        if (big) fx.ring(e.x, y, e.z, 36, 9, 0.7, 0.4, [1, 0.95, 0.7]);
        if (pf.mode === 'star') for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; fx.spawn(e.x, y, e.z, Math.cos(a) * 14, 0.5, Math.sin(a) * 14, 0.45, 0.6, 0.05, 1, 1, 1, 1, SHAPE.CORE, 0, 3); }
        fx.sprite(e.x, y, e.z, big ? 7 : 4, 1, 1, 1, 0.9, SHAPE.GLOW);
        fx.spawn(e.x, y, e.z, 0, 0, 0, 0.18, big ? 9 : 5, 8, 1, 1, 1, 0.9, SHAPE.GLOW);
        break;
      }
      case 'elim': {
        const c = colorFor(e.id);
        fx.burst(e.x, 1.1, e.z, 70, 9, 1.1, 0.34, c, { shape: SHAPE.CORE, grav: 4 });
        fx.burst(e.x, 1.1, e.z, 20, 5, 0.8, 0.5, [1, 0.5, 0.3], { shape: SHAPE.GLOW, grav: 1 });
        fx.ring(e.x, 0.9, e.z, 36, 11, 0.6, 0.5, [1, 0.4, 0.3]);
        for (let i = 0; i < 24; i++) fx.spawn(e.x + (Math.random() - 0.5), 0.2, e.z + (Math.random() - 0.5), 0, 4 + Math.random() * 6, 0, 0.9, 0.35, 0.05, c[0], c[1], c[2], 1, SHAPE.GLOW, -1, 1);
        break;
      }
      case 'target': if (e.charging) fx.ring(e.x, CFG.BALL_H, e.z, 24, 6, 0.6, 0.3, [1, 0.5, 0.3]); break;
      case 'go': fx.burst(0, 1.3, 0, 60, 10, 1, 0.3, [0.5, 0.9, 1], { shape: SHAPE.CORE, grav: 1 }); fx.ring(0, 1, 0, 50, 14, 0.9, 0.5, [0.5, 0.9, 1]); break;
      case 'dash': { const p = view.byId.get(e.id); if (p) fx.burst(p.x, 0.4, p.z, 14, 4, 0.4, 0.3, colorFor(e.id), { shape: SHAPE.GLOW, grav: 0 }); break; }
      case 'orb': fx.ring(e.x, 0.3, e.z, 30, 7, 0.9, 0.4, [1, 1, 1]); fx.burst(e.x, 1.1, e.z, 18, 4, 0.8, 0.22, [1, 0.9, 0.6], { shape: SHAPE.GLOW, grav: -0.5 }); break;
      case 'pickup': { const c = e.kind === 'shield' ? [0.3, 0.9, 1] : [1, 0.75, 0.2]; fx.burst(e.x, 1.1, e.z, 40, 8, 0.7, 0.28, c, { shape: SHAPE.CORE, grav: 0 }); fx.ring(e.x, 0.9, e.z, 30, 11, 0.6, 0.4, c); break; }
      case 'shieldBreak': { const p = view.byId.get(e.id); if (p) { fx.burst(p.x, 1.1, p.z, 60, 10, 0.8, 0.3, [0.4, 0.95, 1], { shape: SHAPE.CORE, grav: 1 }); fx.ring(p.x, 1.1, p.z, 40, 13, 0.6, 0.5, [0.7, 1, 1]); } break; }
      case 'pillar': fx.burst(e.x, CFG.BALL_H, e.z, 14, 6, 0.4, 0.22, this.theme.accent, { shape: SHAPE.CORE, grav: 2 }); break;
      case 'contact': fx.sprite(view.ball.x, CFG.BALL_H, view.ball.z, 3, 1, 0.6, 0.3, 1, SHAPE.GLOW); break;
    }
  }

  // looping celebration around the winner (called every frame while victory)
  victoryTick(view, dt) {
    const p = view.byId.get(view.localId || this.localId);
    if (!p || !p.alive) return;
    const mode = this.cosm.victory.mode, fx = this.fx;
    const t = this.time;
    if (mode === 'confetti') { for (let i = 0; i < 3; i++) { const c = hsv(Math.random(), 0.8, 1); fx.spawn(p.x + (Math.random() - 0.5) * 6, 9 + Math.random() * 3, p.z + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2, 3, 0.22, 0.2, c[0], c[1], c[2], 1, SHAPE.DISC, 1.5, 0.5); } }
    else if (mode === 'pillar') { for (let i = 0; i < 4; i++) fx.spawn(p.x + (Math.random() - 0.5) * 0.7, 0.2, p.z + (Math.random() - 0.5) * 0.7, 0, 10 + Math.random() * 8, 0, 1.2, 0.5, 0.1, 1, 0.9, 0.5, 1, SHAPE.GLOW, 0, 0.2); for (let h = 0; h < 14; h++) fx.sprite(p.x, h * 1.1, p.z, 1.1, 1, 0.85, 0.4, 0.14, SHAPE.GLOW); }
    else if (mode === 'fireworks') { if (Math.random() < dt * 2.2) { const ox = p.x + (Math.random() - 0.5) * 12, oz = p.z + (Math.random() - 0.5) * 12, oy = 6 + Math.random() * 5; const c = hsv(Math.random(), 0.7, 1); fx.burst(ox, oy, oz, 60, 8, 1.4, 0.3, c, { shape: SHAPE.CORE, grav: 3 }); } }
    else if (mode === 'rings') { if (Math.random() < dt * 1.6) fx.ring(p.x, 0.3 + Math.random() * 3, p.z, 40, 6 + Math.random() * 5, 1.0, 0.4, [1, 0.85, 0.4]); }
    fx.sprite(p.x, 1.3, p.z, 2.6 + Math.sin(t * 5) * 0.3, 1, 0.9, 0.5, 0.35, SHAPE.GLOW);
  }
}
