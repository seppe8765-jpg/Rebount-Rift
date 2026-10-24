import { DEFAULT_KEYS } from './keys.js';
// Unified input: keyboard + mouse (pointer lock), touch (joystick / swipe / buttons), gamepad.
// Produces a camera yaw/pitch, a movement vector (camera relative) and queued parry/dash presses.
export class Input {
  constructor(canvas, { sens = 1 } = {}) {
    this.canvas = canvas;
    this.sens = sens;
    this.yaw = 0;
    this.pitch = 0.42;
    this.keys = new Set();
    this.parryQ = false;
    this.dashQ = false;
    this.jumpQ = false;
    this.abilityQ = false;
    this.map = { ...DEFAULT_KEYS };
    this.capture = null; // keybinding editor: callback(code) receives the next key press
    this.enabled = false; // only while a match is being played
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.locked = false;
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.pad = { fx: 0, fy: 0 };
    this.spectating = false; // spectator: free cursor (buttons usable), drag with the mouse to look around
    this.onSpectateKey = null;
    this.onPause = null;
    this.onAnyInput = null;
    this.lockFailed = false; // pointer lock unavailable (sandboxed iframe, denied...) -> steer the camera with the mouse position
    this.freeLook = false;
    this.mouse = { x: 0.5, y: 0.5, seen: false };
    this._lockAsked = 0;
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const f = this.capture; this.capture = null; f(e.code); return; }
      if (this.onAnyInput) this.onAnyInput();
      if (e.code === 'Escape') { if (this.onPause) this.onPause(); return; }
      if (!this.enabled) return;
      if (this.spectating && this.onSpectateKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { this.onSpectateKey(e.code === 'ArrowRight' ? 1 : -1); return; }
      const K = this.map;
      if ([K.fwd, K.back, K.left, K.right, K.jump, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === K.parry) this.parryQ = true;
      if (e.code === K.jump) this.jumpQ = true;
      if (e.code === K.dash) this.dashQ = true;
      if (e.code === K.ability || e.code === 'KeyE') this.abilityQ = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    c.addEventListener('mousedown', (e) => {
      if (this.onAnyInput) this.onAnyInput();
      if (!this.enabled || this.isTouchPrimary) return;
      if (e.button === 0) { this.parryQ = true; this.requestLock(); }
      e.preventDefault();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / Math.max(1, r.width); this.mouse.y = (e.clientY - r.top) / Math.max(1, r.height); this.mouse.seen = true;
      if (this.locked || (e.buttons & 2) || (this.spectating && (e.buttons & 1))) {
        this.yaw -= (e.movementX || 0) * 0.0023 * this.sens;
        this.pitch = Math.min(1.15, Math.max(0.05, this.pitch + (e.movementY || 0) * 0.002 * this.sens));
      }
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked && this.enabled && this.onPause && !this._suppressPause) this.onPause();
    });

    // ---- touch: left side = joystick, right side = camera swipe
    const opts = { passive: false };
    c.addEventListener('touchstart', (e) => {
      this.isTouchPrimary = true;
      if (this.onAnyInput) this.onAnyInput();
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.42 && this.joy.id === null) {
          this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
          this._joyUi(true);
        } else if (this.look.id === null) {
          this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, opts);
    c.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const max = 56, l = Math.hypot(dx, dy);
          if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
          this.joy.x = dx / max; this.joy.y = dy / max;
          this._joyUi(true, dx, dy);
        } else if (t.identifier === this.look.id) {
          const dx = t.clientX - this.look.x, dy = t.clientY - this.look.y;
          this.look.x = t.clientX; this.look.y = t.clientY;
          this.yaw -= dx * 0.006 * this.sens;
          this.pitch = Math.min(1.15, Math.max(0.05, this.pitch + dy * 0.004 * this.sens));
        }
      }
      e.preventDefault();
    }, opts);
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; this._joyUi(false); }
        if (t.identifier === this.look.id) this.look = { id: null, x: 0, y: 0 };
      }
    };
    c.addEventListener('touchend', end, opts);
    c.addEventListener('touchcancel', end, opts);

    // on-screen buttons (created by the UI module)
    this._bindButtons();
  }

  _bindButtons() {
    const hook = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const h = (e) => { e.preventDefault(); e.stopPropagation(); if (this.enabled) fn(); el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 90); };
      el.addEventListener('touchstart', h, { passive: false });
      el.addEventListener('mousedown', (e) => { if (this.isTouchPrimary) return; h(e); });
    };
    hook('btnParry', () => { this.parryQ = true; });
    hook('btnDash', () => { this.dashQ = true; });
    hook('btnJump', () => { this.jumpQ = true; });
    hook('btnAbility', () => { this.abilityQ = true; });
  }

  _joyUi(show, dx = 0, dy = 0) {
    const base = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
    if (!base || !knob) return;
    base.style.display = show ? 'block' : 'none';
    if (show) {
      base.style.left = this.joy.ox - 60 + 'px';
      base.style.top = this.joy.oy - 60 + 'px';
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  requestLock() {
    if (this.isTouchPrimary || this.locked) return;
    this._lockAsked = performance.now();
    try {
      if (!this.canvas.requestPointerLock) { this.lockFailed = true; return; }
      const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { this.lockFailed = true; });
    } catch (e) { this.lockFailed = true; }
  }
  releaseLock() {
    this._suppressPause = true;
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
    setTimeout(() => { this._suppressPause = false; }, 100);
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.keys.clear(); this.parryQ = false; this.dashQ = false; this.jumpQ = false; this.abilityQ = false; this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; this.look = { id: null, x: 0, y: 0 }; this._joyUi(false); }
  }

  _pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.pad.fx = 0; this.pad.fy = 0;
    if (!pad) return;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    this.pad.fx = dz(pad.axes[0] || 0); this.pad.fy = dz(pad.axes[1] || 0);
    this.yaw -= dz(pad.axes[2] || 0) * 2.6 * dt * this.sens;
    this.pitch = Math.min(1.15, Math.max(0.05, this.pitch + dz(pad.axes[3] || 0) * 1.6 * dt * this.sens));
    const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const parryNow = b(0) || b(5) || b(7), dashNow = b(1) || b(4) || b(6);
    if (parryNow && !this._padParry) this.parryQ = true;
    if (dashNow && !this._padDash) this.dashQ = true;
    const jumpNow = b(2) || b(3);
    if (jumpNow && !this._padJump) this.jumpQ = true;
    this._padJump = jumpNow;
    this._padParry = parryNow; this._padDash = dashNow;
    if (b(9) && !this._padStart && this.onPause) this.onPause();
    this._padStart = b(9);
  }

  // returns camera-relative movement converted to world-space direction
  update(dt) {
    this._pollPad(dt);
    if (!this.enabled) return { mx: 0, mz: 0 };
    let fwd = 0, right = 0;
    const k = this.keys;
    const K = this.map;
    if (k.has(K.fwd)) fwd += 1;
    if (k.has(K.back)) fwd -= 1;
    if (k.has(K.right)) right += 1;
    if (k.has(K.left)) right -= 1;
    // arrow keys always turn the camera (also the way to play with the keyboard only)
    if (!this.spectating) {
      if (k.has('ArrowLeft')) this.yaw += 2.4 * dt * this.sens;
      if (k.has('ArrowRight')) this.yaw -= 2.4 * dt * this.sens;
      if (k.has('ArrowUp')) this.pitch = Math.max(0.05, this.pitch - 1.4 * dt * this.sens);
      if (k.has('ArrowDown')) this.pitch = Math.min(1.15, this.pitch + 1.4 * dt * this.sens);
    }
    // pointer lock unavailable: the cursor position steers the camera (like a joystick) so aiming still works
    this.freeLook = !this.isTouchPrimary && !this.locked && !this.spectating && this.mouse.seen && (this.lockFailed || (this._lockAsked && performance.now() - this._lockAsked > 900));
    if (this.freeLook) {
      const dz = (v) => { const a = Math.abs(v); return a < 0.14 ? 0 : Math.sign(v) * (a - 0.14) / 0.86; };
      this.yaw -= dz((this.mouse.x - 0.5) * 2) * 2.6 * dt * this.sens;
      this.pitch = Math.min(1.15, Math.max(0.05, this.pitch + dz((this.mouse.y - 0.5) * 2) * 1.2 * dt * this.sens));
    }
    fwd += -this.joy.y + -this.pad.fy; right += this.joy.x + this.pad.fx;
    const l = Math.hypot(fwd, right);
    if (l > 1) { fwd /= l; right /= l; }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // forward = (sin, cos), right = (-cos, sin)
    return { mx: s * fwd - c * right, mz: c * fwd + s * right };
  }

  consumeParry() { const v = this.parryQ; this.parryQ = false; return v; }
  consumeJump() { const v = this.jumpQ; this.jumpQ = false; return v; }
  consumeAbility() { const v = this.abilityQ; this.abilityQ = false; return v; }
  consumeDash() { const v = this.dashQ; this.dashQ = false; return v; }
}
