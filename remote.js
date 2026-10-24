// Online play: a WebSocket client + RemoteMatch, a read-only mirror of the server's Match with the
// same surface the renderer / HUD use (players, ball, byId, state, drainEvents, aliveCount...).
// The server is authoritative: this class only sends inputs and renders interpolated snapshots.
import { CFG, parryWindowFor } from '../game/config.js';
import { getMap, scaleMap } from '../game/maps.js';
import { getMode } from '../game/modes.js';
import { ABILITY_IDS } from '../game/upgrades.js';

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const INTERP_DELAY = 90; // ms: render slightly in the past to interpolate smoothly between 20 Hz snapshots

export class RemoteMatch {
  constructor(roster, youId, send, mapId = 'neon', modeId = 'ffa') {
    this.remote = true;
    this.mode = modeId;
    this.map = scaleMap(getMap(mapId), getMode(modeId).rScale);
    this.warpT = 0; this.orbs = [];
    this.localId = youId;
    this.send = send;
    this.players = roster.map((r) => ({
      id: r.id, name: r.name, isBot: r.isBot, level: r.level, color: r.color, skin: r.skin, up: r.up || {}, invisT: 0, abT: 0, abCd: 0, guardUsed: false,
      alive: true, left: false, x: 0, z: 0, y: 0, jumpCd: 0, vx: 0, vz: 0, yaw: 0, parryActive: 0, parryCd: 0, dashT: 0, dashCd: 0,
      stats: { parries: 0, perfect: 0, elims: 0 }, place: 0, diedAt: 0, aimAssist: 0, input: { mx: 0, mz: 0, aimYaw: 0 }, localPa: 0, localCd: 0,
    }));
    this.byId = new Map(this.players.map((p) => [p.id, p]));
    this.state = 'COUNTDOWN';
    this.stateT = 3;
    this.time = 0;
    this.arenaR = this.map.R;
    this.frenzyT = 0;
    this.winnerId = null;
    this.results = null;
    this.events = [];
    this.buf = [];
    this.ball = { mode: 'none', x: 0, z: 0, dx: 0, dz: 1, speedKmh: 35, baseKmh: 35, targetId: null, sourceId: null, rally: 0, hanging: false, cands: null, t: 0, recent: [] };
    this.lastSend = 0;
    this.rtt = 0;
    this.tutorial = false;
  }

  get frenzy() { return this.frenzyT > 0; }
  aliveCount() { let n = 0; for (const p of this.players) if (p.alive) n++; return n; }
  drainEvents() { const e = this.events; this.events = []; return e; }

  pushSnapshot(s, now) {
    this.buf.push({ t: now, s });
    if (this.buf.length > 6) this.buf.shift();
    // discrete values straight from the newest snapshot
    this.state = s.state; this.time = s.t; this.stateT = s.cd; this.arenaR = s.arenaR; this.frenzyT = s.frenzy ? 1 : 0; this.warpT = s.warp ? 1 : 0; this.orbs = (s.orbs || []).map((o) => ({ id: o[0], x: o[1], z: o[2], type: o[3] ? 'haste' : 'shield', life: o[4] }));
    const b = this.ball, sb = s.ball;
    b.mode = sb.mode; b.targetId = sb.targetId; b.sourceId = sb.sourceId; b.rally = sb.rally; b.hanging = sb.hanging; b.cands = sb.cands; b.t = sb.t;
    b.speedKmh = sb.kmh; b.dx = sb.dx; b.dz = sb.dz;
    s.players.forEach((sp, i) => {
      const p = this.byId.get(sp.id); if (!p) return;
      p.alive = sp.alive; p.parryActive = Math.max(sp.pa ? 0.15 : 0, p.localPa); p.parryCd = Math.max(sp.pc, p.localCd); p.dashT = sp.dash ? 0.1 : 0; p.dashCd = sp.dcd; p.ty = sp.y || 0; p.invisT = sp.iv ? 1 : 0; p.iv = sp.iv ? 1 : 0; p.abT = sp.at || 0; p.abCd = sp.ac || 0; p.guardUsed = !!sp.gu; p.shield = !!sp.sh; p.hasteT = sp.hs ? 1 : 0;
      const st = s.stats && s.stats[i];
      if (st) { p.stats.parries = st[0]; p.stats.perfect = st[1]; p.stats.elims = st[2]; p.diedAt = st[3]; p.place = st[4]; }
    });
  }

  update(dt) {
    const now = performance.now();
    for (const p of this.players) { p.localPa = Math.max(0, p.localPa - dt); p.localCd = Math.max(0, p.localCd - dt); p.jumpCd = Math.max(0, p.jumpCd - dt); }
    const n = this.buf.length;
    if (n === 0) return;
    const rt = now - INTERP_DELAY;
    let a = this.buf[0], b = this.buf[n - 1];
    for (let i = n - 1; i > 0; i--) { if (this.buf[i - 1].t <= rt) { a = this.buf[i - 1]; b = this.buf[i]; break; } }
    const span = b.t - a.t;
    const k = span > 0 ? Math.min(1, Math.max(0, (rt - a.t) / span)) : 1;
    for (let i = 0; i < b.s.players.length; i++) {
      const pb = b.s.players[i], pa = a.s.players[i] || pb;
      const p = this.byId.get(pb.id); if (!p) continue;
      const nx = lerp(pa.x, pb.x, k), nz = lerp(pa.z, pb.z, k);
      if (dt > 0) { p.vx = lerp(p.vx, (nx - p.x) / dt, 0.3); p.vz = lerp(p.vz, (nz - p.z) / dt, 0.3); }
      if (!p.alive) { p.vx = 0; p.vz = 0; }
      p.y = lerp(pa.y || 0, pb.y || 0, k);
      p.x = nx; p.z = nz; p.yaw = lerpAngle(pa.yaw, pb.yaw, k);
    }
    const ba = a.s.ball, bb = b.s.ball;
    const bk = (ba.mode === 'flying' && bb.mode === 'flying') ? k : 1;
    this.ball.x = lerp(ba.x, bb.x, bk); this.ball.z = lerp(ba.z, bb.z, bk); this.ball.y = lerp(ba.y != null ? ba.y : 1, bb.y != null ? bb.y : 1, bk);
  }

  setInput(id, { mx = 0, mz = 0, aimYaw = 0 } = {}) {
    const p = this.byId.get(id); if (!p) return;
    p.input.mx = mx; p.input.mz = mz; p.input.aimYaw = aimYaw;
    const now = performance.now();
    if (now - this.lastSend >= 33) { this.lastSend = now; this.send({ t: 'in', mx: +mx.toFixed(3), mz: +mz.toFixed(3), aim: +aimYaw.toFixed(3) }); }
  }

  // Sends the press; also predicts the swing locally so the parry feels instant. The server decides the outcome.
  press(id, kind) {
    const p = this.byId.get(id);
    if (!p || !p.alive) return false;
    if (this.state !== 'ACTIVE' && this.state !== 'FINAL_PHASE') return false;
    if (kind === 'parry') {
      if (p.localCd > 0 || p.parryCd > 0) return false;
      p.localPa = parryWindowFor(this.ball.speedKmh || 35); p.localCd = CFG.PARRY_CD;
      this.send({ t: 'parry' });
      this.events.push({ type: 'parryPress', id });
      return true;
    }
    if (kind === 'dash') { if (p.dashCd > 0) return false; this.send({ t: 'dash' }); return true; }
    if (kind === 'jump') {
      // ground jump, then one extra jump in the air (the server decides)
      if (p.cj == null || p.y < 0.05) p.cj = 0;
      if (p.cj >= 2 || (p.cj === 1 && p.y < 0.2)) return false;
      if (p.cj === 0 && p.jumpCd > 0) return false;
      if (p.cj === 0) p.jumpCd = 1.5;
      p.cj = (p.cj || 0) + 1; this.send({ t: 'jump' }); return true;
    }
    if (kind === 'ability') { if (p.abT > 0 || p.abCd > 0 || !ABILITY_IDS.some((k) => (p.up[k] || 0) > 0)) return false; this.send({ t: 'ability' }); return true; }
    return false;
  }
}

export class OnlineClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.h = {};
    this.id = null;
    this.match = null;
    this.rtt = 0;
    this.alive = false;
  }

  connect(timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return reject(e); }
      this.ws = ws;
      const t = setTimeout(() => { if (!settled) { settled = true; try { ws.close(); } catch (e) { /* ignore */ } reject(new Error('timeout')); } }, timeoutMs);
      ws.onopen = () => { /* wait for welcome */ };
      ws.onerror = () => { if (!settled) { settled = true; clearTimeout(t); reject(new Error('connect failed')); } };
      ws.onclose = () => { this.alive = false; if (this.h.close) this.h.close(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        this._onMsg(m);
        if (m.t === 'welcome' && !settled) { settled = true; clearTimeout(t); this.alive = true; this.id = m.id; resolve(this); }
      };
      setInterval(() => { if (this.alive && ws.readyState === 1) this.send({ t: 'ping', c: performance.now() }); }, 2000);
    });
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  join(name, skin, mode = 'ffa', up = {}) { this.send({ t: 'join', name, skin, mode, up }); }
  createRoom(name, skin, mode, up) { this.send({ t: 'create', name, skin, mode, up }); }
  joinRoom(code, name, skin, up) { this.send({ t: 'joinCode', code, name, skin, up }); }
  startParty() { this.send({ t: 'startParty' }); }
  leaveParty() { this.send({ t: 'leaveParty' }); }
  leave() { this.send({ t: 'leave' }); this.match = null; }
  close() { try { this.ws && this.ws.close(); } catch (e) { /* ignore */ } }

  _onMsg(m) {
    switch (m.t) {
      case 'party': this.h.party && this.h.party(m); break;
      case 'partyErr': this.h.partyErr && this.h.partyErr(m.why); break;
      case 'lobby': this.h.lobby && this.h.lobby(m); break;
      case 'start':
        this.match = new RemoteMatch(m.roster, m.you, (o) => this.send(o), m.map, m.mode);
        this.h.start && this.h.start(this.match, m);
        break;
      case 'snap': if (this.match) this.match.pushSnapshot(m.s, performance.now()); break;
      case 'ev': if (this.match) for (const e of m.e) this.match.events.push(e); break;
      case 'end': if (this.match) { this.match.results = m.results; this.match.winnerId = m.results.winnerId; } break;
      case 'ping': this.send({ t: 'pong', s: m.s }); break;
      case 'pong2': this.rtt = Math.round(performance.now() - m.c); if (this.match) this.match.rtt = this.rtt; break;
    }
  }
}
