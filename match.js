// Match: the authoritative, DOM-free simulation of one Rebound Rift round.
//
// It owns: participants (humans + bots), the single energy ball, targeting, parry
// validation, eliminations, special events and the round state machine:
//   LOBBY -> COUNTDOWN -> ACTIVE -> FINAL_PHASE -> ROUND_END -> RESULTS -> RETURN_TO_LOBBY
//
// Clients (or bots) can only send *inputs* (movement, aim, "parry pressed").
// Whether a parry succeeds is decided here, never by the client.
import { getMap, scaleMap } from './maps.js';
import { getMode } from './modes.js';
import { makeNames } from './botNames.js';
import { botSkin } from './cosmetics.js';
import { ABILITY_IDS, ABILITY_COOLDOWN, UPGRADE_BY_ID } from './upgrades.js';
import { CFG, speedFromRally, timeMultiplier, parryWindowFor } from './config.js';
import { makeRng } from '../utils/rng.js';
import { clamp, lerp, dirToYaw, yawToDir, segPointDist, angleDiff } from '../utils/math.js';
import { BotController, pickBotLevel, mixForSkill, strongBotLevel } from '../bots/botController.js';

export const State = Object.freeze({
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  ACTIVE: 'ACTIVE',
  FINAL_PHASE: 'FINAL_PHASE',
  ROUND_END: 'ROUND_END',
  RESULTS: 'RESULTS',
  RETURN_TO_LOBBY: 'RETURN_TO_LOBBY',
});

export class Match {
  constructor({ seed, botLevelMix, skill = null, tutorial = false, map = 'neon', mode = 'ffa' } = {}) {
    this.skill = skill; // player skill 0..1 (adaptive bot difficulty); null = default lobby mix
    this.tutorial = tutorial; // slow, forgiving training round: speed capped, player cannot be eliminated
    this.rng = makeRng(seed);
    this.growth = getMode(mode).growth || CFG.SPEED_GROWTH;
    this.botLevelMix = botLevelMix || (skill != null ? mixForSkill(skill, getMode(mode).total === 2 ? 0.7 : 0.95) : getMode(mode).botMix) || null;
    this.players = [];
    this.byId = new Map();
    this.state = State.LOBBY;
    this.stateT = 0;
    this.time = 0; // seconds since GO
    this.acc = 0;
    this.events = [];
    this.mode = getMode(mode);
    this.teams = this.mode.teams; // 0 = free for all, 2 = team elimination
    this.maxPlayers = this.mode.total;
    this.map = scaleMap(getMap(map), this.mode.rScale);
    this.arenaR = this.map.R;
    this.warpT = 0;
    this.winnerTeam = null;
    this.gravT = 0;
    this.orbs = []; this.orbT = 9; this._orbId = 0; // power-up orbs: shield / haste
    this._salt = Math.floor(this.rng() * 2 ** 30);
    this.winnerId = null;
    this.results = null;
    this.frenzyT = 0;
    this.frenzySmooth = 1;
    this.nextEventT = 0;
    this.lastCountdown = -1;
    this._botNum = 0;
    this.ball = this._newBall();
  }

  _newBall() {
    return {
      mode: 'none', // none | charging | choosing | flying
      x: 0, z: 0, y: CFG.BALL_H, dx: 0, dz: 1,
      baseKmh: CFG.SPEED_TABLE[0], speedKmh: CFG.SPEED_TABLE[0],
      targetId: null, sourceId: null, // source = last player that deflected it
      holders: [], // history of last deflecting players (for ping-pong detection)
      recent: [], // recent targets (anti repeat)
      rally: 0,
      t: 0, // timer for charging / choosing
      armT: 0, turnT: 0, flightT: 0,
      hanging: false, contactT: 0,
      cands: null,
      sinceEvent: 0,
      perfectBonus: 1,
    };
  }

  // ---------------------------------------------------------------- roster
  addParticipant({ id, name, isBot = false, level = null, aimAssist = 0, skin = null, team = null, up = null }) {
    if (this.players.length >= this.maxPlayers) return null;
    if (this.byId.has(id)) return this.byId.get(id);
    if (this.teams) {
      // balance the teams: join the smaller one (ties -> team 0)
      const n0 = this.players.filter((q) => q.team === 0).length, n1 = this.players.filter((q) => q.team === 1).length;
      if (team !== 0 && team !== 1) team = n0 <= n1 ? 0 : 1;
    } else team = null;
    const caps = CFG.UPGRADE_CAPS, u = {};
    for (const k of Object.keys(caps)) u[k] = Math.max(0, Math.min(caps[k], Math.floor(Number(up && up[k]) || 0)));
    const p = {
      id, name, isBot, level,
      alive: true, left: false,
      x: 0, z: 0, vx: 0, vz: 0, yaw: 0, y: 0, vy: 0, jumpCd: 0, onGround: true,
      team, up: u, ground: 0, shield: false, hasteT: 0, invisT: 0, guardUsed: false,
      input: { mx: 0, mz: 0, aimYaw: 0 },
      dashT: 0, dashCd: 0, dashX: 0, dashZ: 0, abT: 0, abCd: 0, airJumps: 0, airT: 0,
      parryCd: 0, parryActive: 0, parrySince: 0, lagAllow: 0,
      knockX: 0, knockZ: 0,
      stats: { parries: 0, perfect: 0, elims: 0 },
      place: 0, diedAt: 0, lastTargetedAt: -10,
      color: this.players.length % 12,
      aimAssist, skin,
      bot: null,
    };
    if (isBot) p.bot = new BotController(p, level, makeRng(this.rng() * 2 ** 32));
    this.players.push(p);
    this.byId.set(id, p);
    return p;
  }

  // computer players own a few upgrades, scaled by level (they cannot be as strong as a fully upgraded human)
  _botUpgrades(level) {
    const r = this.rng;
    if (level === 'easy') return { jump: r() < 0.3 ? 1 : 0 };
    if (level === 'normal') return { jump: r() < 0.6 ? 1 : 0, speed: r() < 0.3 ? 1 : 0 };
    if (level === 'hard') return { jump: r() < 0.5 ? 2 : 1, speed: 1, invis: r() < 0.3 ? 1 : 0 };
    if (level === 'master') return { jump: 3, speed: 3, dash: 2, invis: 1, warp: 1, guard: 1 };
    return { jump: 2, speed: r() < 0.5 ? 2 : 1, invis: r() < 0.6 ? 1 : 0, warp: r() < 0.3 ? 1 : 0, guard: r() < 0.3 ? 1 : 0 };
  }

  fillBots() {
    if (!this._names) this._names = makeNames(makeRng(this._salt), this.maxPlayers + 4, this.players.map((q) => q.name));
    while (this.players.length < this.maxPlayers) {
      this._botNum++;
      let level = pickBotLevel(this.rng, this.botLevelMix);
      // almost every match has one strong bot that can keep a long rally going (a real opponent to beat)
      if (this._botNum === 1 && !this.tutorial && this.rng() < 0.92) level = this.skill != null ? strongBotLevel(this.skill, this.rng) : (this.rng() < 0.1 ? 'master' : 'elite');
      this.addParticipant({
        id: 'bot' + this._botNum,
        name: this._names[(this._botNum - 1) % this._names.length],
        isBot: true,
        level,
        skin: botSkin(this._botNum, this._salt),
        up: this._botUpgrades(level),
      });
    }
  }

  get frenzy() { return this.frenzyT > 0; }
  humans() { return this.players.filter((p) => !p.isBot && !p.left); }
  aliveList() { return this.players.filter((p) => p.alive); }
  aliveCount() { let n = 0; for (const p of this.players) if (p.alive) n++; return n; }

  // A participant disconnects / closes the browser. Never blocks the match.
  removeParticipant(id) {
    const p = this.byId.get(id);
    if (!p) return;
    if (this.state === State.LOBBY) {
      this.players = this.players.filter((q) => q !== p);
      this.byId.delete(id);
      return;
    }
    if (!p.alive) { p.left = true; return; }
    const remaining = this.aliveCount();
    p.left = true;
    p.alive = false;
    p.place = remaining;
    p.diedAt = this.time;
    this.emit({ type: 'leave', id, name: p.name, remaining: remaining - 1 });
    this._afterLoss(p, null, true);
  }

  // ---------------------------------------------------------------- flow
  start() {
    if (this.state !== State.LOBBY) return;
    // spread everyone on a ring, in random order
    const order = this.rng.shuffle(this.players.slice());
    const n = order.length;
    const off = this.rng() * Math.PI * 2;
    const slot = new Map();
    if (this.teams) {
      // each team gets its own side of the arena, spread along an arc
      for (const t of [0, 1]) {
        const mem = order.filter((p) => p.team === t);
        mem.forEach((p, j) => slot.set(p.id, off + t * Math.PI + (j - (mem.length - 1) / 2) * (mem.length > 2 ? 0.34 : 0.45)));
      }
    } else order.forEach((p, i) => slot.set(p.id, off + (i / n) * Math.PI * 2));
    order.forEach((p) => {
      const a = slot.get(p.id);
      p.x = Math.sin(a) * this.map.spawnR;
      p.z = Math.cos(a) * this.map.spawnR;
      p.yaw = Math.atan2(-p.x, -p.z); // face the centre
      p.input.aimYaw = p.yaw;
    });
    this.time = 0;
    this.nextEventT = this.rng.range(28, 45);
    this._setState(State.COUNTDOWN);
    this.stateT = CFG.COUNTDOWN;
  }

  _setState(s) {
    this.state = s;
    this.stateT = 0;
    this.emit({ type: 'state', state: s });
  }

  returnToLobby() {
    if (this.state === State.RESULTS || this.state === State.ROUND_END) this._setState(State.RETURN_TO_LOBBY);
  }

  emit(e) { this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------------------------------------------------------------- inputs
  setInput(id, { mx = 0, mz = 0, aimYaw } = {}) {
    const p = this.byId.get(id);
    if (!p) return;
    const l = Math.hypot(mx, mz);
    if (l > 1) { mx /= l; mz /= l; }
    if (!Number.isFinite(mx) || !Number.isFinite(mz)) { mx = 0; mz = 0; }
    p.input.mx = mx;
    p.input.mz = mz;
    if (Number.isFinite(aimYaw)) p.input.aimYaw = aimYaw;
  }

  _abOn(p, id) { return p.abT > 0 && !!p.up[id]; }
  _abId(p) { for (const k of ABILITY_IDS) if (p.up[k] > 0) return k; return null; }

  // The one equipped ability: lasts its duration, then ABILITY_COOLDOWN seconds until it can be used again.
  _ability(p, kind) {
    const id = this._abId(p);
    if (!id || (kind !== 'ability' && kind !== id)) return false;
    if (p.abT > 0 || p.abCd > 0 || this.state === State.COUNTDOWN) return false;
    const def = UPGRADE_BY_ID.get(id);
    p.abT = def.dur; p.abCd = 0;
    if (id === 'invis') {
      p.invisT = def.dur;
      this.emit({ type: 'invis', id: p.id });
      const b = this.ball;
      if (b.mode === 'flying' && b.targetId === p.id && !b.hanging) this._retargetNow();
    } else if (id === 'bubble') { p.shield = true; this.emit({ type: 'pickup', id: p.id, kind: 'shield' }); }
    else if (id === 'sprint') { p.hasteT = Math.max(p.hasteT, def.dur); this.emit({ type: 'pickup', id: p.id, kind: 'haste' }); }
    else if (id === 'warp') { this.warpT = def.dur; this.emit({ type: 'warp', id: p.id }); }
    else this.emit({ type: 'ability', id: p.id, ability: id });
    return true;
  }

  // kind: 'parry' | 'dash'. lag (seconds) = measured one-way latency, used for compensation.
  press(id, kind, { lag = 0, targetId = null } = {}) {
    const p = this.byId.get(id);
    if (!p || !p.alive) return false;
    if (this.state !== State.ACTIVE && this.state !== State.FINAL_PHASE && this.state !== State.COUNTDOWN) return false;
    if (kind === 'jump') {
      if (this.state === State.COUNTDOWN) return false;
      const jv = (CFG.JUMP_V + CFG.JUMP_V_STEP * p.up.jump) * (this._abOn(p, 'sky') ? 1.7 : 1);
      if (!p.onGround) {
        // double jump: one extra jump in the air (a short moment after the first)
        if (p.airJumps >= 1 || p.airT < 0.12) return false;
        p.airJumps++; p.vy = jv * 0.9;
        this.emit({ type: 'jump', id, double: true });
        return true;
      }
      if (p.jumpCd > 0) return false;
      p.vy = jv; p.jumpCd = CFG.JUMP_CD; p.onGround = false; p.airJumps = 0; p.airT = 0;
      this.emit({ type: 'jump', id });
      return true;
    }
    if (kind === 'dash') {
      if (p.dashCd > 0 || this.state === State.COUNTDOWN) return false;
      let { mx, mz } = p.input;
      if (Math.hypot(mx, mz) < 0.1) { const d = yawToDir(p.yaw); mx = d.x; mz = d.z; }
      const l = Math.hypot(mx, mz) || 1;
      p.dashX = mx / l; p.dashZ = mz / l;
      p.dashT = CFG.DASH_TIME;
      p.dashCd = this._abOn(p, 'rapid') ? 0.3 : CFG.DASH_CD - 0.4 * p.up.dash;
      this.emit({ type: 'dash', id });
      return true;
    }
    if (kind === 'ability' || ABILITY_IDS.includes(kind)) return this._ability(p, kind);
    if (kind === 'parry') {
      if (this.state === State.COUNTDOWN) return false;
      if (p.parryCd > 0) return false; // anti-spam
      const b = this.ball;
      const kmh = b.mode === 'flying' ? b.speedKmh : CFG.SPEED_TABLE[0];
      p.parryActive = parryWindowFor(kmh) * (this._abOn(p, 'magnet') ? 1.7 : 1);
      p.parrySince = 0;
      p.parryCd = CFG.PARRY_CD;
      p.lagAllow = clamp(lag, 0, CFG.MAX_LAG_ALLOW);
      p.botAimTarget = targetId; // bots can name their preferred target
      this.emit({ type: 'parryPress', id });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- update
  update(dtReal) {
    this.acc += Math.min(dtReal, 0.25);
    let guard = 0;
    while (this.acc >= CFG.FIXED_DT && guard++ < 20) {
      this.acc -= CFG.FIXED_DT;
      this._step(CFG.FIXED_DT);
    }
  }

  _step(dt) {
    if (this.state !== State.COUNTDOWN) this.stateT += dt;
    switch (this.state) {
      case State.LOBBY:
      case State.RESULTS:
      case State.RETURN_TO_LOBBY:
        return;
      case State.COUNTDOWN: {
        this.stateT -= dt; // the countdown counts down
        const c = Math.ceil(this.stateT);
        if (c !== this.lastCountdown) {
          this.lastCountdown = c;
          if (c >= 1 && c <= 3) this.emit({ type: 'countdown', n: c });
        }
        this._updatePlayers(dt);
        this._updateBots(dt);
        if (this.stateT <= 0) {
          this._setState(State.ACTIVE);
          this.emit({ type: 'go' });
          this._spawnBall();
        }
        return;
      }
      case State.ACTIVE:
      case State.FINAL_PHASE:
        this.time += dt;
        this._updateEvents(dt);
        this._updatePlayers(dt);
        this._updateBots(dt);
        this._updateBall(dt);
        this._watchdog(dt);
        return;
      case State.ROUND_END:
        this._updatePlayers(dt);
        if (this.stateT >= CFG.ROUND_END_TIME) {
          this._setState(State.RESULTS);
        }
        return;
    }
  }

  // -- special events (FRENZY, LAST 3)
  _updateEvents(dt) {
    this._updateOrbs(dt);
    if (this.warpT > 0) { this.warpT -= dt; if (this.warpT <= 0) this.emit({ type: 'event', name: 'WARP_END' }); }
    if (this.frenzyT > 0) {
      this.frenzyT -= dt;
      if (this.frenzyT <= 0) this.emit({ type: 'event', name: 'FRENZY_END' });
    }
    if (this.gravT > 0) { this.gravT -= dt; if (this.gravT <= 0) this.emit({ type: 'event', name: 'GRAVITY_END' }); }
    this.frenzySmooth = lerp(this.frenzySmooth, this.frenzyT > 0 ? CFG.FRENZY_MULT : 1, Math.min(1, dt * 4));
    if (!this.tutorial && this.state === State.ACTIVE && this.time >= this.nextEventT && this.aliveCount() >= 4 && this.ball.mode === 'flying') {
      this.nextEventT = this.time + this.rng.range(30, 50);
      if (this.rng() < 0.62) {
        this.frenzyT = 6;
        this.emit({ type: 'event', name: 'FRENZY' });
      } else {
        this.gravT = 7; // everybody floats: higher, longer jumps
        this.emit({ type: 'event', name: 'LOW GRAVITY' });
      }
    }
    const target = this.state === State.FINAL_PHASE ? this.map.Rfinal : this.map.R;
    this.arenaR = lerp(this.arenaR, target, Math.min(1, dt * 1.5));
  }

  // -- players
  // power-up orbs: walk into one to get a one-hit SHIELD (deflects the next lethal hit) or HASTE (+45% speed for 5 s)
  _updateOrbs(dt) {
    if (this.tutorial) return;
    for (const o of this.orbs) o.life -= dt;
    this.orbs = this.orbs.filter((o) => o.life > 0);
    this.orbT -= dt;
    if (this.orbT <= 0) {
      this.orbT = this.rng.range(11, 17);
      if (this.orbs.length < 2 && this.aliveCount() > 1) {
        for (let k = 0; k < 8; k++) {
          const a = this.rng() * Math.PI * 2, r = this.rng.range(4, this.arenaR * 0.68);
          const x = Math.sin(a) * r, z = Math.cos(a) * r;
          if (this.map.pillars.some((pl) => Math.hypot(x - pl.x, z - pl.z) < pl.r + 1.8)) continue;
          this.orbs.push({ id: ++this._orbId, x, z, type: this.rng() < 0.4 ? 'shield' : 'haste', life: 14 });
          this.emit({ type: 'orb', x, z });
          break;
        }
      }
    }
  }

  _collectOrbs(p) {
    if (!this.orbs.length || p.y > 1.6) return;
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      if (Math.hypot(p.x - o.x, p.z - o.z) > 1.7) continue;
      if (o.type === 'shield') { if (p.shield) continue; p.shield = true; } else p.hasteT = 5;
      this.orbs.splice(i, 1);
      this.emit({ type: 'pickup', id: p.id, kind: o.type, x: o.x, z: o.z });
      return;
    }
  }

  _updatePlayers(dt) {
    const R = this.arenaR - CFG.PLAYER_R - 0.2;
    const moving = this.state !== State.ROUND_END;
    for (const p of this.players) {
      if (!p.alive) {
        p.x += p.knockX * dt;
        p.z += p.knockZ * dt;
        const k = Math.exp(-dt * 3);
        p.knockX *= k; p.knockZ *= k;
        continue;
      }
      p.parryCd = Math.max(0, p.parryCd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.jumpCd = Math.max(0, p.jumpCd - dt);
      if (p.abT > 0) {
        p.abT -= dt;
        if (p.abT <= 0) { p.abT = 0; p.abCd = ABILITY_COOLDOWN; if (p.up.bubble) p.shield = false; if (p.up.invis && p.invisT > 0) p.invisT = 0.0001; }
      } else if (p.abCd > 0) p.abCd = Math.max(0, p.abCd - dt);
      if (!p.onGround) p.airT += dt;
      if (p.hasteT > 0) p.hasteT -= dt;
      this._collectOrbs(p);
      if (p.invisT > 0) { p.invisT -= dt; if (p.invisT <= 0) this.emit({ type: 'visible', id: p.id }); }
      // vertical motion: gravity, landing on the ground or on top of a pillar you jumped onto
      {
        let ground = 0;
        for (const pl of this.map.pillars) {
          if (p.y >= pl.h - 0.3 && Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r + 0.25) ground = Math.max(ground, pl.h);
        }
        p.ground = ground; // height of the surface under the player (0, or a pillar top)
        if (p.y > ground + 1e-4 || p.vy > 0) {
          p.vy -= this.map.gravity * (this.gravT > 0 ? 0.45 : 1) * dt;
          p.y += p.vy * dt;
          if (p.y <= ground) { p.y = ground; p.vy = 0; p.onGround = true; p.airJumps = 0; p.airT = 0; } else p.onGround = false;
        } else { p.y = ground; p.vy = 0; p.onGround = true; }
      }
      if (p.parryActive > 0) { p.parryActive -= dt; p.parrySince += dt; }
      let vx = 0, vz = 0;
      if (p.dashT > 0) {
        p.dashT -= dt;
        vx = p.dashX * CFG.DASH_SPEED; vz = p.dashZ * CFG.DASH_SPEED;
      } else if (moving) {
        const sp = (p.isBot && p.bot ? p.bot.speedScale : 1) * CFG.MOVE_SPEED * (1 + 0.04 * p.up.speed) * (p.hasteT > 0 ? 1.45 : 1);
        vx = p.input.mx * sp; vz = p.input.mz * sp;
      }
      // light acceleration so movement feels smooth but responsive
      const a = Math.min(1, dt * this.map.accel);
      p.vx = lerp(p.vx, vx, a);
      p.vz = lerp(p.vz, vz, a);
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      // facing: aim while parrying, otherwise movement direction
      const sp2 = Math.hypot(p.vx, p.vz);
      let wantYaw = p.yaw;
      if (p.parryActive > 0) wantYaw = p.input.aimYaw;
      else if (sp2 > 1) wantYaw = dirToYaw(p.vx, p.vz);
      p.yaw += angleDiff(p.yaw, wantYaw) * Math.min(1, dt * 14);
    }
    // separation
    const alive = this.players.filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = CFG.PLAYER_R * 2;
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
    for (const p of alive) {
      const r = Math.hypot(p.x, p.z);
      if (r > R) { p.x *= R / r; p.z *= R / r; }
      // cover pillars are solid for players (they slide along them)
      for (const pl of this.map.pillars) {
        if (p.y >= pl.h - 0.3) continue; // above the top: no side collision (you can land on it)
        const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz), min = pl.r + CFG.PLAYER_R;
        if (d < min) {
          const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
          p.x = pl.x + nx * min; p.z = pl.z + nz * min;
          const vn = p.vx * nx + p.vz * nz;
          if (vn < 0) { p.vx -= vn * nx; p.vz -= vn * nz; }
        }
      }
    }
  }

  _updateBots(dt) {
    for (const p of this.players) {
      if (p.bot && p.alive) p.bot.update(dt, this);
    }
  }

  // ---------------------------------------------------------------- ball
  currentBaseKmh(bonus = 1) {
    let v = speedFromRally(this.ball.rally, this.growth) * timeMultiplier(this.time) * bonus;
    if (this.state === State.FINAL_PHASE) v *= 1.08;
    if (this.tutorial) v = Math.min(v, 46);
    return Math.min(CFG.SPEED_ABS_MAX * 0.8, v);
  }

  _spawnBall() {
    const b = this.ball;
    const alive = this.aliveList();
    if (alive.length < 2) return this._endRound();
    b.rally = 0;
    b.holders = [];
    b.recent = [];
    b.sourceId = null;
    b.sinceEvent = 0;
    this._chargeAt(0, 0, null);
  }

  // Ball hovers at (x,z) for CHARGE_TIME with a visible TARGET warning, then launches.
  _chargeAt(x, z, sourceId) {
    const b = this.ball;
    const src = sourceId ? this.byId.get(sourceId) : null;
    const alive = src && this.teams ? this.targetPool(src) : this.players.filter((c) => c.alive);
    if (this._isOver() || alive.length < 1) return this._endRound();
    // Anti-frustration: find a target that is not too close to the spawn point
    // and (for humans) has the spawn in front of them.
    let best = null, bestScore = -1e9;
    for (const c of alive) {
      if (c.id === sourceId && alive.length > 2) continue;
      if (c.invisT > 0 && alive.length > 1) continue;
      let sc = this._scoreTarget(c, x, z, 0, 0, sourceId);
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < 8) sc -= 2;
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    if (!best) best = alive[0];
    // Spawn position: centre, but if it would be behind a human target, spawn in front of them.
    let sx = x, sz = z;
    if (sourceId === null || b.mode === 'none' || b.mode === 'charging') {
      if (!best.isBot) {
        const f = yawToDir(best.input.aimYaw);
        const tx = sx - best.x, tz = sz - best.z;
        const l = Math.hypot(tx, tz) || 1;
        const dot = (tx / l) * f.x + (tz / l) * f.z;
        if (dot < -0.1 || l < 9) {
          const ang = best.input.aimYaw + this.rng.range(-0.5, 0.5);
          const fd = yawToDir(ang);
          sx = best.x + fd.x * 20; sz = best.z + fd.z * 20;
          const r = Math.hypot(sx, sz), maxR = this.arenaR - 3;
          if (r > maxR) { sx *= maxR / r; sz *= maxR / r; }
        }
      }
    }
    b.mode = 'charging';
    b.x = sx; b.z = sz; b.y = CFG.BALL_H;
    b.t = CFG.CHARGE_TIME;
    b.targetId = best.id;
    b.hanging = false;
    b.cands = null;
    b.armT = 0;
    const tdx = best.x - sx, tdz = best.z - sz;
    const l = Math.hypot(tdx, tdz) || 1;
    b.dx = tdx / l; b.dz = tdz / l;
    b.baseKmh = this.currentBaseKmh();
    b.speedKmh = b.baseKmh;
    this._noteTarget(best);
    this.emit({ type: 'target', targetId: best.id, sourceId: null, charging: true, kmh: b.speedKmh, x: sx, z: sz });
  }

  _noteTarget(p) {
    const b = this.ball;
    p.lastTargetedAt = this.time;
    b.recent.unshift(p.id);
    if (b.recent.length > 3) b.recent.length = 3;
  }

  // who may the ball be sent to after `p` deflects it (opponents only in team modes; invisible players are skipped unless nobody else is left)
  targetPool(p) {
    let pool = this.players.filter((c) => c.alive && (!p || c.id !== p.id) && (!this.teams || !p || c.team !== p.team));
    const visible = pool.filter((c) => c.invisT <= 0);
    if (visible.length) pool = visible;
    return pool;
  }

  // team modes: the game is over when only one team has players left
  _isOver() {
    if (!this.teams) return this.aliveCount() <= 1;
    let t0 = false, t1 = false;
    for (const p of this.players) if (p.alive) { if (p.team === 0) t0 = true; else t1 = true; }
    return !(t0 && t1);
  }

  _scoreTarget(c, rx, rz, dirx, dirz, sourceId) {
    const b = this.ball;
    const d = Math.hypot(c.x - rx, c.z - rz);
    let s = 1 - Math.min(1, Math.abs(d - 22) / 22); // prefer mid-range
    if (d < CFG.MIN_TARGET_DIST) s -= 1.4;
    s += this.rng() * 0.9; // randomness
    const ri = b.recent.indexOf(c.id);
    if (ri >= 0) s -= 1.1 - ri * 0.3; // anti repeat
    if (c.id === sourceId) s -= 2.2; // avoid immediate return to sender
    if (dirx || dirz) {
      const l = d || 1;
      s += (((c.x - rx) / l) * dirx + ((c.z - rz) / l) * dirz) * 0.3; // visibility / in front
    }
    s += 0.3 * Math.min(1, (this.time - c.lastTargetedAt) / 12); // fairness
    return s;
  }

  _pingCount() {
    const h = this.ball.holders;
    let n = 0;
    for (let i = h.length - 1; i >= 2; i--) {
      if (h[i] === h[i - 2]) n++; else break;
    }
    return n;
  }

  _launch(target, dx, dz, { bonus = 1, announce = true } = {}) {
    const b = this.ball;
    const l = Math.hypot(dx, dz) || 1;
    b.dx = dx / l; b.dz = dz / l;
    b.mode = 'flying';
    b.targetId = target.id;
    b.hanging = false;
    b.contactT = 0;
    b.armT = CFG.ARM_TIME;
    b.turnT = 0;
    b.flightT = 0;
    b.cands = null;
    b.baseKmh = this.currentBaseKmh(bonus);
    b.speedKmh = b.baseKmh * this.frenzySmooth;
    b.sinceEvent = 0;
    if (announce) {
      this._noteTarget(target);
      this.emit({ type: 'target', targetId: target.id, sourceId: b.sourceId, charging: false, kmh: b.speedKmh, x: b.x, z: b.z });
    }
  }

  // Ball lost its target (disconnect, elimination...) -> pick a new valid one at once.
  // safety net: a ball that has not moved for a few seconds is sent on again (never a frozen match)
  _watchdog(dt) {
    if (this.tutorial) return;
    const b = this.ball;
    const key = b.mode + ':' + (b.targetId || '') + ':' + (+b.x).toFixed(1) + ':' + (+b.z).toFixed(1);
    if (key !== this._wdKey) { this._wdKey = key; this._wdT = 0; return; }
    this._wdT = (this._wdT || 0) + dt;
    if (b.mode === 'none') { if (this._wdT > 6 && !this._isOver()) { this._wdT = 0; this._chargeAt(0, 0, null); } }
    else if (this._wdT > 3.5) { this._wdT = 0; b.hanging = false; this._retargetNow(); }
  }

  _retargetNow() {
    const b = this.ball;
    const src = b.sourceId ? this.byId.get(b.sourceId) : null;
    const alive = src && this.teams ? this.targetPool(src) : this.targetPool(null);
    if (this._isOver() || alive.length < 1) return this._endRound();
    if (b.mode === 'flying' && Number.isFinite(b.x) && Math.hypot(b.x, b.z) < this.arenaR + 40) {
      let best = null, bs = -1e9;
      for (const c of alive) {
        if (c.id === b.sourceId && alive.length > 2) continue;
        const sc = this._scoreTarget(c, b.x, b.z, b.dx, b.dz, b.sourceId);
        if (sc > bs) { bs = sc; best = c; }
      }
      best = best || alive[0];
      this._launch(best, best.x - b.x, best.z - b.z);
      b.armT = 0.35;
    } else {
      this._chargeAt(0, 0, null);
    }
  }

  _updateBall(dt) {
    const b = this.ball;
    if (b.mode === 'none') return;
    b.sinceEvent += dt;

    if (b.mode === 'charging') {
      const t = this.byId.get(b.targetId);
      if (!t || !t.alive) { this._chargeAt(b.x, b.z, b.sourceId); return; }
      b.t -= dt;
      if (b.t <= 0) {
        b.mode = 'flying'; // _launch below sets it again; announce already sent while charging
        this._launch(t, t.x - b.x, t.z - b.z, { announce: false });
        this.emit({ type: 'launch', targetId: t.id, kmh: b.speedKmh });
      }
      return;
    }

    if (b.mode === 'choosing') {
      b.t -= dt;
      const live = (b.cands || []).map((id) => this.byId.get(id)).filter((p) => p && p.alive);
      if (live.length === 0) { this._retargetNow(); return; }
      if (b.t <= 0) {
        const pick = live[Math.floor(this.rng() * live.length)];
        this._launch(pick, pick.x - b.x, pick.z - b.z);
      }
      return;
    }

    // ---- flying
    const t = this.byId.get(b.targetId);
    if (!t || !t.alive) { this._retargetNow(); return; }
    if (!Number.isFinite(b.x) || !Number.isFinite(b.z) || Math.hypot(b.x, b.z) > this.arenaR + 60) {
      this._retargetNow(); return;
    }
    b.armT = Math.max(0, b.armT - dt);
    b.turnT += dt;
    b.flightT += dt;

    // watchdog against endless rallies between near-perfect players
    if (b.sinceEvent > 20) b.baseKmh *= 1 + dt * 0.05;
    b.speedKmh = Math.min(CFG.SPEED_ABS_MAX, b.baseKmh * this.frenzySmooth * (1 + Math.min(CFG.FLIGHT_ACCEL_MAX, CFG.FLIGHT_ACCEL * b.flightT)));

    if (b.hanging) {
      // ball is touching the target: a (late) parry still saves them for GRACE seconds
      b.contactT += dt;
      if (t.parryActive > 0) { this._resolveParry(t, 'late'); return; }
      if (b.contactT > CFG.GRACE + t.lagAllow) this._eliminate(t, b.sourceId);
      return;
    }

    const u = b.speedKmh * CFG.KMH_TO_U * (this.warpT > 0 ? 0.5 : 1) * (this._abOn(t, 'slow') ? 0.6 : 1);
    // the ball follows the height of the SURFACE under the target (ground or a pillar top), not the jump itself: jump over a fast ball to dodge it
    const wantY = (t.ground || 0) + CFG.BALL_H, dy = wantY - b.y, step = CFG.BALL_CLIMB * dt;
    b.y += Math.abs(dy) <= step ? dy : Math.sign(dy) * step;
    const tx = t.x - b.x, tz = t.z - b.z;
    const tl = Math.hypot(tx, tz) || 1;
    // homing: steering ramps up after launch so the deflect direction matters (curve)
    const turn = lerp(2.2, 16, clamp(b.turnT / 0.7, 0, 1));
    let nx = b.dx + (tx / tl - b.dx) * Math.min(1, turn * dt);
    let nz = b.dz + (tz / tl - b.dz) * Math.min(1, turn * dt);
    // at extreme speeds a steering-limited ball would orbit its target forever: in the last metres it locks on fully
    if (u >= 100 && tl <= (u / 16) * 1.5) { nx = tx / tl; nz = tz / tl; }
    const nl = Math.hypot(nx, nz) || 1;
    b.dx = nx / nl; b.dz = nz / nl;
    const ox = b.x, oz = b.z;
    b.x += b.dx * u * dt;
    b.z += b.dz * u * dt;
    // the ball glances off cover pillars (slides around them while it keeps homing)
    for (const pl of this.map.pillars) {
      if (b.y > pl.h + 0.3) continue; // flying over the top
      const ex = b.x - pl.x, ez = b.z - pl.z, d = Math.hypot(ex, ez), min = pl.r + 0.45;
      if (d < min) {
        const nx = d > 1e-4 ? ex / d : 1, nz = d > 1e-4 ? ez / d : 0;
        b.x = pl.x + nx * min; b.z = pl.z + nz * min;
        const vn = b.dx * nx + b.dz * nz;
        if (vn < 0) { b.dx -= vn * nx; b.dz -= vn * nz; const l = Math.hypot(b.dx, b.dz) || 1; b.dx /= l; b.dz /= l; }
        if (b.pillarEvT === undefined || this.time - b.pillarEvT > 0.15) { b.pillarEvT = this.time; this.emit({ type: 'pillar', x: b.x, z: b.z }); }
      }
    }

    if (b.armT <= 0) {
      const d = segPointDist(ox, oz, b.x, b.z, t.x, t.z);
      if (d <= CFG.HIT_R && b.y >= t.y - 0.3 && b.y <= t.y + 2.1) { // vertical window: a jump at the right moment lets the ball pass underneath
        b.hanging = true;
        b.contactT = 0;
        this.emit({ type: 'contact', targetId: t.id });
        if (t.parryActive > 0) {
          const q = t.parrySince <= CFG.PERFECT ? 'perfect' : t.parrySince <= CFG.GOOD ? 'good' : 'early';
          this._resolveParry(t, q);
        }
      }
    }
  }

  // ---------------------------------------------------------------- parry
  _resolveParry(p, quality, free = false) {
    const b = this.ball;
    if (!free) { p.stats.parries++; if (quality === 'perfect') p.stats.perfect++; }
    p.parryActive = 0;
    p.parryCd = Math.min(p.parryCd, 0.35); // reward a successful parry with a faster reset
    b.hanging = false;
    b.rally++;
    b.sourceId = p.id;
    b.holders.push(p.id);
    if (b.holders.length > 8) b.holders.shift();
    b.x = p.x; b.z = p.z; b.y = p.y + CFG.BALL_H;

    const alive = this.targetPool(p);
    if (alive.length === 0) return this._isOver() ? this._endRound() : this._chargeAt(b.x, b.z, null);

    // ---- choose the new target
    const aimYaw = p.input.aimYaw;
    const f = yawToDir(aimYaw);
    const sourceCands = alive;
    let aimed = null, aimedPrecise = false;
    const wanted = p.botAimTarget ? this.byId.get(p.botAimTarget) : null;
    p.botAimTarget = null;
    if (wanted && wanted.alive && wanted.id !== p.id) {
      aimed = wanted;
    } else if (!p.isBot) {
      // Full 360 degree aiming: the ball goes to the player closest to where you LOOK, independent of where the ball
      // came from or which way you are walking. Inside the cone it counts as a precise (aimed) throw.
      const cone = (quality === 'perfect' ? CFG.AIM_CONE_PERFECT : CFG.AIM_CONE) + p.aimAssist + (this._abOn(p, 'aim') ? 0.9 : 0);
      let bestS = 1e9, bestAng = 9;
      for (const c of sourceCands) {
        const ang = Math.abs(angleDiff(aimYaw, dirToYaw(c.x - p.x, c.z - p.z)));
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        const sc = ang + d * 0.004;
        if (sc < bestS) { bestS = sc; aimed = c; bestAng = ang; }
      }
      if (aimed && bestAng > cone && sourceCands.length > 2) { if (bestAng > 2.2) aimed = null; } // looking away from everyone: normal selection
      aimedPrecise = !!aimed && bestAng <= cone;
    }
    // avoid endless A <-> B ping-pong while a third player is alive
    let pingBlock = false;
    if (aimed && alive.length > 1 && aimed.id === b.holders[b.holders.length - 2] && this._pingCount() >= CFG.PINGPONG_LIMIT) {
      aimed = null; pingBlock = true;
    }
    // somebody standing right in front of the one who hits the ball always gets it (no random far-away target)
    if (!aimed && !pingBlock && p.isBot) {
      let bestA = 0.5;
      for (const c of alive) {
        if (c.id === b.holders[b.holders.length - 2] && alive.length > 2) continue; // never ping-pong back to the previous holder this way
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < CFG.MIN_TARGET_DIST) continue;
        const ang = Math.abs(angleDiff(aimYaw, dirToYaw(c.x - p.x, c.z - p.z)));
        if (ang < bestA) { bestA = ang; aimed = c; }
      }
    }
    // while only one other player is left it's always them
    if (alive.length === 1) aimed = alive[0];

    const bonus = quality === 'perfect' ? CFG.PERFECT_SPEED_BONUS : 1;
    let target, dx, dz, byAim = false;
    if (aimed) {
      target = aimed; byAim = true;
      const l = Math.hypot(aimed.x - p.x, aimed.z - p.z) || 1;
      dx = ((aimed.x - p.x) / l) * 0.85 + f.x * 0.15;
      dz = ((aimed.z - p.z) / l) * 0.85 + f.z * 0.15;
    } else {
      let best = null, bs = -1e9;
      const ranked = [];
      for (const c of alive) {
        const sc = this._scoreTarget(c, p.x, p.z, f.x, f.z, p.id);
        ranked.push([sc, c]);
        if (sc > bs) { bs = sc; best = c; }
      }
      target = best;
      dx = (best.x - p.x) * 0.5 / (Math.hypot(best.x - p.x, best.z - p.z) || 1) + f.x * 0.5;
      dz = (best.z - p.z) * 0.5 / (Math.hypot(best.x - p.x, best.z - p.z) || 1) + f.z * 0.5;
      // DOUBLE TARGET: two warned players, the ball picks one after a short hover
      ranked.sort((a, c) => c[0] - a[0]);
      if (!this.tutorial && alive.length >= 3 && b.rally >= 2 && ranked.length >= 2 && this.rng() < 0.1 && this.frenzyT <= 0) {
        b.mode = 'choosing';
        b.t = 0.85;
        b.cands = [ranked[0][1].id, ranked[1][1].id];
        b.targetId = null;
        b.baseKmh = this.currentBaseKmh(bonus);
        this.emit({ type: 'parry', id: p.id, quality, kmh: b.baseKmh, x: p.x, z: p.z, targetId: null, aimed: false });
        this.emit({ type: 'doubleTarget', ids: b.cands.slice() });
        this.emit({ type: 'event', name: 'DOUBLE TARGET' });
        return;
      }
    }
    this._launch(target, dx, dz, { bonus, announce: false });
    b.armT = CFG.ARM_TIME;
    this._noteTarget(target);
    this.emit({ type: 'parry', id: p.id, quality, kmh: b.speedKmh, x: p.x, z: p.z, targetId: target.id, aimed: byAim && (aimedPrecise || !!wanted) });
    this.emit({ type: 'target', targetId: target.id, sourceId: p.id, charging: false, kmh: b.speedKmh, x: p.x, z: p.z });
  }

  // ---------------------------------------------------------------- elimination
  _eliminate(p, byId) {
    const b = this.ball;
    if (this.tutorial && !p.isBot) {
      // training round: the player is never eliminated, the ball just resets
      this.emit({ type: 'tutorialMiss', id: p.id });
      b.rally = 0; b.hanging = false; b.sourceId = null; b.holders = [];
      this._chargeAt(0, 0, null);
      return;
    }
    if (p.shield) {
      p.shield = false;
      this.emit({ type: 'shieldBreak', id: p.id });
      this._resolveParry(p, 'early', true);
      return;
    }
    if (this._abOn(p, 'guard')) {
      // Guardian: while it is active the lethal hit is deflected automatically
      p.abT = 0; p.abCd = ABILITY_COOLDOWN; p.guardUsed = true;
      this.emit({ type: 'guard', id: p.id });
      this._resolveParry(p, 'early', true);
      return;
    }
    const remainingBefore = this.aliveCount();
    p.alive = false;
    p.place = remainingBefore;
    p.diedAt = this.time;
    const kn = 11;
    p.knockX = b.dx * kn; p.knockZ = b.dz * kn;
    const killer = byId ? this.byId.get(byId) : null;
    if (killer && killer.id !== p.id) killer.stats.elims++;
    this.emit({
      type: 'elim', id: p.id, by: killer ? killer.id : null, byName: killer ? killer.name : null,
      name: p.name, place: p.place, remaining: remainingBefore - 1, x: p.x, z: p.z,
    });
    this._afterLoss(p, killer, false);
  }

  _afterLoss(p, killer, left) {
    const b = this.ball;
    const remaining = this.aliveCount();
    if (this._isOver()) {
      b.mode = 'none';
      return this._endRound();
    }
    if (this.mode.finalAt && remaining <= this.mode.finalAt && this.state === State.ACTIVE) {
      this._setState(State.FINAL_PHASE);
      this.emit({ type: 'event', name: 'LAST ' + this.mode.finalAt });
    }
    if (left) {
      // a disconnect never resets/blocks the ball: only re-target if it was aimed at the leaver
      if (b.mode === 'flying' && b.targetId === p.id) this._retargetNow();
      else if (b.mode === 'charging' && b.targetId === p.id) this._chargeAt(b.x, b.z, b.sourceId);
      else if (b.mode === 'choosing') { /* handled in update */ }
      return;
    }
    // after a normal elimination: slow the ball down and respawn it with a warning
    b.rally = Math.floor(b.rally * CFG.RALLY_KEEP);
    b.sourceId = null;
    b.holders = [];
    b.hanging = false;
    this._chargeAt(p.x * 0.3, p.z * 0.3, null);
  }

  _endRound() {
    if (this.state === State.ROUND_END || this.state === State.RESULTS || this.state === State.RETURN_TO_LOBBY) return;
    const alive = this.aliveList();
    let winner = alive[0] || null;
    if (!winner) {
      // everyone gone at once: the last one to leave/die wins
      winner = this.players.slice().sort((a, c) => c.diedAt - a.diedAt)[0] || null;
    }
    if (winner) winner.place = 1;
    this.winnerId = winner ? winner.id : null;
    if (this.teams && winner) {
      // team result: everybody on the winning team is 1st, the others 2nd
      this.winnerTeam = winner.team;
      for (const q of this.players) q.place = q.team === winner.team ? 1 : 2;
    }
    this.ball.mode = 'none';
    const ranked = this.players.slice().sort((a, c) => (a.place || 99) - (c.place || 99));
    this.results = {
      winnerId: this.winnerId, winnerTeam: this.winnerTeam,
      duration: this.time,
      placements: ranked.map((p) => ({
        id: p.id, name: p.name, isBot: p.isBot, level: p.level, place: p.place || 1,
        parries: p.stats.parries, perfect: p.stats.perfect, elims: p.stats.elims,
        survived: p.alive ? this.time : p.diedAt,
      })),
    };
    this._setState(State.ROUND_END);
    this.emit({ type: 'end', winnerId: this.winnerId, winnerTeam: this.winnerTeam });
  }

  // ---------------------------------------------------------------- views
  rosterInfo() {
    return this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, level: p.level, color: p.color, skin: p.skin, team: p.team, up: p.up }));
  }

  snapshot() {
    const b = this.ball;
    return {
      t: this.time,
      state: this.state,
      cd: Math.max(0, this.state === State.COUNTDOWN ? this.stateT : 0),
      arenaR: this.arenaR,
      alive: this.aliveCount(),
      frenzy: this.frenzyT > 0, grav: this.gravT > 0, warp: this.warpT > 0,
      orbs: this.orbs.map((o) => [o.id, +o.x.toFixed(2), +o.z.toFixed(2), o.type === 'shield' ? 0 : 1, +o.life.toFixed(1)]),
      ball: {
        mode: b.mode, x: b.x, z: b.z, y: b.y, dx: b.dx, dz: b.dz, kmh: b.speedKmh,
        targetId: b.targetId, sourceId: b.sourceId, rally: b.rally, hanging: b.hanging,
        cands: b.cands, t: b.t,
      },
      players: this.players.map((p) => ({
        id: p.id, x: p.x, z: p.z, y: p.y, yaw: p.yaw, alive: p.alive, iv: p.invisT > 0 ? 1 : 0, at: +p.abT.toFixed(2), ac: +p.abCd.toFixed(2), gu: p.guardUsed ? 1 : 0, sh: p.shield ? 1 : 0, hs: p.hasteT > 0 ? 1 : 0,
        pa: p.parryActive > 0 ? 1 : 0, pc: p.parryCd, dash: p.dashT > 0 ? 1 : 0, dcd: p.dashCd,
      })),
    };
  }
}
