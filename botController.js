// BotController: a human-like opponent. Bots use exactly the same inputs as a human
// (setInput + press) and are validated by the Match like everyone else - they cannot cheat.
//
// Events the bot reacts to (conceptually):
//   PROJECTILE_TARGETED  - ball has been aimed at this bot (reaction timer starts)
//   PROJECTILE_INCOMING  - ball is close enough to be tracked
//   PARRY_WINDOW_OPEN    - perceived time-to-impact dropped below the chosen lead -> press
//   PLAYER_ELIMINATED    - someone died (affects target memory / revenge)
import { CFG, speedIntensity } from '../game/config.js';
import { clamp, dirToYaw, angleDiff } from '../utils/math.js';

// reaction: [min,max] seconds before the bot "notices" a newly targeting ball
// sigma: stdev of the timing error (seconds)    mistake: base chance of an outright blunder
// aimErr: chance to pick a poor/random target   move: movement speed scale   lead: how early it wants to press
export const BOT_LEVELS = {
  easy:   { reaction: [0.32, 0.58], sigma: 0.095, mistake: 0.20, aimErr: 0.45, move: 0.55, leadBias: 0.55, tick: 1 / 18 },
  normal: { reaction: [0.20, 0.38], sigma: 0.055, mistake: 0.075, aimErr: 0.25, move: 0.75, leadBias: 0.5,  tick: 1 / 24 },
  hard:   { reaction: [0.12, 0.24], sigma: 0.030, mistake: 0.025, aimErr: 0.10, move: 0.9,  leadBias: 0.42, tick: 1 / 40 },
  // a rare champion: reacts almost instantly and practically never blunders - sometimes you simply lose to it
  master: { reaction: [0.04, 0.075], sigma: 0.007, mistake: 0.0, aimErr: 0.0, move: 1.12, leadBias: 0.3, tick: 1 / 60 },
  elite:  { reaction: [0.07, 0.16], sigma: 0.016, mistake: 0.008, aimErr: 0.03, move: 1.0,  leadBias: 0.3,  tick: 1 / 60 },
};

// a lobby has weak and strong players: you will not win every match
export const DEFAULT_LEVEL_MIX = { easy: 0.3, normal: 0.42, hard: 0.2, elite: 0.06, master: 0.02 };

// Adaptive difficulty: bot levels are drawn around the player's skill (0..1), but always with a spread, so a lobby
// still contains weak AND strong players - only the centre of gravity moves with how well you have been doing.
const LEVELS = ['easy', 'normal', 'hard', 'elite', 'master'];
export function mixForSkill(skill, sigma = 0.95) {
  const c = Math.max(0, Math.min(1, skill)) * 4;
  const w = LEVELS.map((_, i) => Math.exp(-((i - c) ** 2) / (2 * sigma * sigma)) + 0.02);
  const sum = w.reduce((a, b) => a + b, 0), mix = {};
  LEVELS.forEach((k, i) => { mix[k] = w[i] / sum; });
  return mix;
}
// the one strong opponent most lobbies have: a step above the player, never hopeless for a beginner
export function strongBotLevel(skill, rng) {
  if (skill < 0.3) return 'hard';
  if (skill < 0.55) return rng() < 0.3 ? 'hard' : 'elite';
  if (skill < 0.8) return rng() < 0.12 ? 'master' : 'elite';
  return rng() < 0.45 ? 'master' : 'elite';
}

export function pickBotLevel(rng, mix) {
  const m = mix || DEFAULT_LEVEL_MIX;
  let r = rng(), acc = 0;
  for (const k of Object.keys(m)) {
    acc += m[k];
    if (r < acc) return k;
  }
  return 'normal';
}

export class BotController {
  constructor(player, level, rng, profileOverride = null) {
    this.p = player;
    this.rng = rng;
    this.level = level || 'normal';
    const base = BOT_LEVELS[this.level] || BOT_LEVELS.normal;
    // every bot gets its own random personality so two bots never behave identically
    const jit = () => 1 + (rng() - 0.5) * 0.6; // every bot has its own form: two 'hard' bots are not equally good
    this.profile = profileOverride || {
      ...base,
      sigma: base.sigma * jit(),
      mistake: base.mistake * jit(),
      aimErr: base.aimErr * jit(),
    };
    this.reactionTime = rng.range(this.profile.reaction[0], this.profile.reaction[1]); // personal baseline
    this.parryAccuracy = 1 - this.profile.mistake; // exposed for debug UI
    this.mistakeChance = this.profile.mistake;
    this.movementSkill = this.profile.move;
    this.targetPreference = rng.pick(['random', 'far', 'revenge', 'weak', 'human']);
    this.speedScale = this.profile.move;
    this.revenge = new Map(); // who targeted/eliminated me
    // per-ball state
    this.seen = false;
    this.noticeAt = 0;
    this.plan = null; // {delta, lead, mistake}
    this.pressed = false;
    this.nextDecision = 0;
    // movement
    this.goalX = 0; this.goalZ = 0; this.goalT = 0;
    this.strafe = rng() < 0.5 ? 1 : -1;
    this.lastTargetedId = null;
    this.hopT = rng.range(3, 10); // idle hop timer
    this.padGoal = null; // pillar the bot wants to climb
    this.debug = { kind: 'idle' };
  }

  // ---- event hooks ------------------------------------------------------
  notify(type, data) {
    if (type === 'PLAYER_ELIMINATED' && data && data.by === this.p.id) {
      // nothing special; kept as a hook for memory-based behaviours
    }
  }

  // ---- main update ------------------------------------------------------
  update(dt, match) {
    const p = this.p;
    this._move(dt, match);
    this._abilities(dt, match);
    const b = match.ball;
    if (b.mode !== 'flying' || b.targetId !== p.id) {
      if (this.plan) this._resetBall();
      return;
    }
    // PROJECTILE_TARGETED: a new ball is flying at me
    if (!this.plan) this._onTargeted(match, b);

    const now = match.time;
    if (!this.seen) {
      if (now >= this.noticeAt) { this.seen = true; /* PROJECTILE_INCOMING */ }
      else return;
    }
    if (this.pressed) return;
    if (now < this.nextDecision) return;
    this.nextDecision = now + this.profile.tick;
    if (this.plan.mistake === 'none') return; // blunder: freezes and never reacts

    // perceived time to impact (what the bot *thinks*; has a personal timing error)
    const dx = p.x - b.x, dz = p.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    const dist = dl - CFG.HIT_R;
    const u = b.speedKmh * CFG.KMH_TO_U;
    // closing speed along the line ball->me, accounting for my own movement
    const closing = Math.max(0.5, ((b.dx * u - p.vx) * dx + (b.dz * u - p.vz) * dz) / dl);
    const tti = Math.max(0, dist) / closing + this.plan.delta;
    if (tti <= this.plan.lead) {
      // PARRY_WINDOW_OPEN
      const target = this._chooseTarget(match, b);
      if (match.press(p.id, 'parry', { targetId: target })) {
        this.pressed = true;
        // face roughly towards the intended target (visual only)
        const t = match.byId.get(target);
        if (t) p.input.aimYaw = dirToYaw(t.x - p.x, t.z - p.z);
      } // else: parry on cooldown -> retry next tick (= late)
    }
  }

  // jumping + abilities: bots use them like a player would, but only with the upgrades they own
  _abilities(dt, match) {
    const p = this.p, b = match.ball, up = p.up || {};
    const targeted = b.mode === 'flying' && b.targetId === p.id;
    // climb a pillar: jump when standing next to the one we walk to
    if (this.padGoal && p.onGround) {
      const pl = this.padGoal, d = Math.hypot(p.x - pl.x, p.z - pl.z);
      if (d < pl.r + 1.5 && d > pl.r) { match.press(p.id, 'jump'); }
    }
    // idle hop (looks alive)
    this.hopT -= dt;
    if (this.hopT <= 0) { this.hopT = this.rng.range(4, 12); if (!targeted && p.onGround) match.press(p.id, 'jump'); }
    if (!targeted) return;
    const u = b.speedKmh * CFG.KMH_TO_U, dist = Math.hypot(b.x - p.x, b.z - p.z);
    const tti = dist / Math.max(1, u);
    // invisibility: shake off a very fast ball that is about to hit
    if (up.invis && p.abT <= 0 && p.abCd <= 0 && b.speedKmh > 220 && tti < 0.55 && tti > 0.2 && this.rng() < 0.03) match.press(p.id, 'invis');
    // time warp when the match is tense
    if (up.warp && p.abT <= 0 && p.abCd <= 0 && b.speedKmh > 260 && tti < 0.9 && match.aliveCount() <= 4 && this.rng() < 0.04) match.press(p.id, 'warp');
  }

  _resetBall() {
    this.seen = false; this.plan = null; this.pressed = false;
  }

  _onTargeted(match, b) {
    const p = this.p;
    this.pressed = false;
    this.seen = false;
    const sf = speedIntensity(b.speedKmh);
    // reaction jitter around this bot's personal baseline
    const react = Math.max(0.04, this.reactionTime * this.rng.range(0.8, 1.25));
    this.noticeAt = match.time + react;
    // how chaotic is the situation?
    const chaos = (match.frenzyT > 0 ? 0.5 : 0) + (match.aliveCount() <= 3 ? 0.15 : 0) + (b.rally > 12 ? 0.2 : 0);
    const dist = Math.hypot(b.x - p.x, b.z - p.z);
    const distF = dist < 9 ? 1.5 : dist > 28 ? 1.15 : 1; // short flights / far shots are harder
    const rallyF = 1 + Math.min(b.rally, 20) * 0.025; // fatigue
    let pm = this.profile.mistake * (1 + 0.8 * sf) * (1 + chaos) * distF * rallyF;
    pm = clamp(pm, 0, 0.7);
    let mistake = null;
    if (this.rng() < pm) mistake = this.rng.pick(['none', 'early', 'late', 'early', 'late']);
    // timing error grows with speed (harder to estimate fast balls)
    const sigma = this.profile.sigma * (1 + sf * 1.1) * (1 + chaos * 0.5);
    const delta = this.rng.gauss() * sigma;
    // ideal lead: press ~this many seconds before impact (window-centered)
    const W = match.byId.get(p.id) ? this._windowFor(b.speedKmh) : 0.25;
    let lead = W * this.profile.leadBias;
    if (mistake === 'early') lead += this.rng.range(0.14, 0.4);
    if (mistake === 'late') lead -= this.rng.range(0.12 + CFG.GRACE, 0.3);
    this.plan = { delta, lead, mistake };
    this.debug = { kind: mistake || 'ok', lead, delta };
  }

  _windowFor(kmh) {
    const k = speedIntensity(kmh);
    return CFG.PARRY_WINDOW_SLOW + (CFG.PARRY_WINDOW_FAST - CFG.PARRY_WINDOW_SLOW) * k;
  }

  // ---- target selection (returns player id) -----------------------------
  _chooseTarget(match, b) {
    const p = this.p;
    const cands = match.targetPool(p);
    if (cands.length === 0) return null;
    if (cands.length === 1) return cands[0].id;
    const sf = speedIntensity(b.speedKmh);
    // blunder: aim at a random (maybe silly) player, or just keep the ball going back
    if (this.rng() < this.profile.aimErr * (1 + 0.5 * sf)) return this.rng.pick(cands).id;
    let best = null, bs = -1e9;
    for (const c of cands) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      let s = this.rng() * 1.0;
      switch (this.targetPreference) {
        case 'far': s += d / 20; break;
        case 'weak': s += c.isBot ? (c.level === 'easy' ? 0.8 : c.level === 'normal' ? 0.3 : 0) : 0.4; break;
        case 'human': s += c.isBot ? 0 : 0.7; break;
        case 'revenge': s += (this.revenge.get(c.id) || 0) * 0.6; break;
      }
      if (c.id === b.sourceId) s -= 0.8; // dont always return to sender
      if (b.recent && b.recent.includes(c.id)) s -= 0.4;
      if (d < 6) s -= 0.8;
      if (s > bs) { bs = s; best = c; }
    }
    if (b.sourceId) this.revenge.set(b.sourceId, (this.revenge.get(b.sourceId) || 0) + 1);
    return best.id;
  }

  // ---- movement ---------------------------------------------------------
  _move(dt, match) {
    const p = this.p;
    this.goalT -= dt;
    const R = match.arenaR - 3;
    if (this.goalT <= 0) {
      this.padGoal = null;
      const orb = (match.orbs || []).slice().sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z))[0];
      if (orb && Math.hypot(orb.x - p.x, orb.z - p.z) < 22 && this.rng() < 0.55) { this.goalX = orb.x; this.goalZ = orb.z; this.goalT = 3; }
      else {
      // sometimes head for a pillar that this bot can actually climb
      const reach = Math.pow(CFG.JUMP_V + CFG.JUMP_V_STEP * ((p.up && p.up.jump) || 0), 2) / (2 * CFG.GRAVITY) - 0.35;
      const pads = (match.map.pillars || []).filter((q) => q.h <= reach);
      if (pads.length && this.rng() < 0.3) { this.padGoal = this.rng.pick(pads); this.goalX = this.padGoal.x; this.goalZ = this.padGoal.z; this.goalT = this.rng.range(2.5, 5); }
      else {
      const a = this.rng() * Math.PI * 2;
      const r = this.rng.range(5, R);
      this.goalX = Math.sin(a) * r;
      this.goalZ = Math.cos(a) * r;
      this.goalT = this.rng.range(1.2, 3.6);
      }
      }
    }
    let mx = this.goalX - p.x, mz = this.goalZ - p.z;
    const l = Math.hypot(mx, mz);
    if (l < 1.2) { mx = 0; mz = 0; } else { mx /= l; mz /= l; }
    // small sidestep when the ball is coming for me (looks alive, makes bots less static)
    const b = match.ball;
    if (b.mode === 'flying' && b.targetId === p.id) {
      // targeted: slow down so the parry timing is predictable, small sidestep for better bots
      const side = this.profile.move > 0.7 ? 0.5 : 0;
      mx = mx * 0.35 - b.dz * this.strafe * side * 0.5;
      mz = mz * 0.35 + b.dx * this.strafe * side * 0.5;
    }
    // aim / look: toward the ball while it flies, otherwise keep current
    if (b.mode === 'flying' || b.mode === 'charging') {
      const want = dirToYaw(b.x - p.x, b.z - p.z);
      if (!this.pressed) p.input.aimYaw += angleDiff(p.input.aimYaw, want) * Math.min(1, dt * 8);
    }
    match.setInput(p.id, { mx, mz });
  }
}
