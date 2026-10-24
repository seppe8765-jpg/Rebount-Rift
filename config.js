// All gameplay tuning lives here. The simulation (Match) is DOM-free so the same
// code runs in the browser (local mode) and in the Node server (authoritative mode).
export const CFG = {
  MAX_PLAYERS: 12,
  FIXED_DT: 1 / 60,

  // arena (world units ~ metres)
  ARENA_R: 42, // big arena (was 26)
  ARENA_R_FINAL: 30, // arena shrinks during LAST 3
  SPAWN_R: 28,
  PLAYER_R: 0.7,
  BALL_H: 1.3,

  // movement
  MOVE_SPEED: 7.0, // a bit faster than before
  DASH_SPEED: 18,

  // jump: while the body is above JUMP_CLEAR the ball flies underneath (it homes back, so it is a timing dodge, not immunity)
  JUMP_V: 9.8, // base jump apex ~2.2 m (low obstacles). Upgrades add JUMP_V_STEP per level (tall obstacles need level 2+)
  JUMP_V_STEP: 1.5,
  GRAVITY: 22,
  JUMP_CD: 1.5,
  BALL_CLIMB: 9, // m/s: how fast the (homing) ball can climb/descend toward its target's height
  UPGRADE_CAPS: { jump: 3, speed: 3, dash: 3, invis: 1, warp: 1, guard: 1, bubble: 1, sprint: 1, sky: 1, magnet: 1, aim: 1, rapid: 1, slow: 1 },
  DASH_TIME: 0.16,
  DASH_CD: 2.2,

  // parry
  HIT_R: 1.15, // contact radius around a player
  PARRY_WINDOW_SLOW: 0.34, // seconds the parry stays active at start speed
  PARRY_WINDOW_FAST: 0.22, // ... and at critical speed (window shrinks as ball speeds up)
  PARRY_CD: 0.75,
  GRACE: 0.07, // ball may "hang" on a player this long, a parry in that time still counts (late)
  PERFECT: 0.08, // pressed <= 80 ms before contact
  GOOD: 0.18, // <= 180 ms. Longer = "early" (still succeeds, weaker)
  MAX_LAG_ALLOW: 0.12, // latency compensation cap (server side)

  // ball
  KMH_TO_U: 0.078, // km/h shown on HUD -> world units / second
  SPEED_TABLE: [35],
  SPEED_GROWTH: 1.12, // every deflection makes the ball 12% faster (35 -> ~62 after 5, ~109 after 10, ~190 after 15, ~330 after 20)
  SPEED_CAP_KMH: 1100, // effectively no cap: the ball keeps getting faster
  SPEED_ABS_MAX: 1600,
  PERFECT_SPEED_BONUS: 1.05,
  FLIGHT_ACCEL: 0.2, // ball gains +20%/s of its launch speed while flying (max below) so running away never works
  FLIGHT_ACCEL_MAX: 0.6,
  CHARGE_TIME: 1.1, // ball hovers + target warning before it launches
  ARM_TIME: 0.28, // after (re)launch the ball cannot hit yet -> no instant hits
  MIN_TARGET_DIST: 9,
  RALLY_KEEP: 0.5, // after an elimination the rally speed resets to 40%

  // aim
  AIM_CONE: 0.7, // rad: inside this cone the throw counts as 'aimed' (the ball goes to the nearest-to-aim player over the full 360 degrees)
  AIM_CONE_PERFECT: 0.95,
  PINGPONG_LIMIT: 3,

  // flow
  COUNTDOWN: 3.2,
  ROUND_END_TIME: 2.4,
  FRENZY_MULT: 1.35,

  // match-time escalation: [seconds, multiplier]
  TIME_CURVE: [[0, 1], [30, 1.05], [60, 1.15], [120, 1.35], [180, 1.65], [240, 2.0], [330, 2.6]],
  TIME_SLOPE_AFTER: 0.012, // per second after the last curve point: it never stops accelerating
};

export function speedFromRally(rally, growth = CFG.SPEED_GROWTH) {
  const t = CFG.SPEED_TABLE;
  if (rally < t.length) return t[rally];
  return Math.min(CFG.SPEED_CAP_KMH, t[t.length - 1] * Math.pow(growth, rally - (t.length - 1)));
}

export function timeMultiplier(sec) {
  const c = CFG.TIME_CURVE;
  if (sec <= 0) return 1;
  for (let i = 1; i < c.length; i++) {
    if (sec <= c[i][0]) {
      const [t0, m0] = c[i - 1], [t1, m1] = c[i];
      return m0 + ((m1 - m0) * (sec - t0)) / (t1 - t0);
    }
  }
  const last = c[c.length - 1];
  return last[1] + (sec - last[0]) * CFG.TIME_SLOPE_AFTER;
}

// 0 (slow) .. 1 (critical): used for the shrinking parry window and audio/visual intensity
export function speedIntensity(kmh) {
  return Math.min(1, Math.max(0, (kmh - 35) / 245));
}

export function parryWindowFor(kmh) {
  const k = speedIntensity(kmh);
  return CFG.PARRY_WINDOW_SLOW + (CFG.PARRY_WINDOW_FAST - CFG.PARRY_WINDOW_SLOW) * k;
}
