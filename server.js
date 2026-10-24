// server/index.js
import http from "node:http";

// src/game/maps.js
var ring = (n, r, rad, off = 0, h = 3.4) => Array.from({ length: n }, (_, i) => {
  const a = off + i / n * Math.PI * 2;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, r: rad, h };
});
var MAPS = [
  {
    id: "neon",
    name: "NEON GRID",
    blurb: "The classic: wide open, pure skill.",
    R: 42,
    Rfinal: 30,
    accel: 14,
    gravity: 22,
    pillars: [],
    theme: {
      accent: [0.2, 0.75, 1],
      fog: [0.025, 0.03, 0.07],
      skyTop: [0.015, 0.02, 0.07],
      skyHor: [0.08, 0.05, 0.2],
      neb1: [0.25, 0.08, 0.4],
      neb2: [0.05, 0.2, 0.4],
      floor: [0.03, 0.04, 0.085],
      danger: [0.28, 0.02, 0.05],
      pattern: 0,
      gridCol: [0.025, 0.09, 0.15],
      ambient: "motes",
      pillar: [0.07, 0.09, 0.2],
      crystal: 0
    }
  },
  {
    id: "ember",
    name: "EMBER PIT",
    blurb: "Lava stone with cover pillars. Use them to break the line.",
    R: 38,
    Rfinal: 27,
    accel: 14,
    gravity: 22,
    pillars: [...ring(6, 14, 2.2, 0, 3.4), ...ring(6, 24, 1.6, Math.PI / 6, 1.8)],
    theme: {
      accent: [1, 0.45, 0.12],
      fog: [0.07, 0.025, 0.02],
      skyTop: [0.05, 0.015, 0.015],
      skyHor: [0.3, 0.09, 0.03],
      neb1: [0.5, 0.12, 0.02],
      neb2: [0.35, 0.05, 0.1],
      floor: [0.06, 0.03, 0.03],
      danger: [0.5, 0.05, 0],
      pattern: 1,
      gridCol: [0.95, 0.32, 0.05],
      ambient: "embers",
      pillar: [0.16, 0.07, 0.05],
      crystal: 2
    }
  },
  {
    id: "frost",
    name: "FROST RING",
    blurb: "Slippery ice: you keep sliding. Plan your moves early.",
    R: 46,
    Rfinal: 33,
    accel: 3.4,
    gravity: 22,
    pillars: [],
    theme: {
      accent: [0.55, 0.9, 1],
      fog: [0.05, 0.08, 0.13],
      skyTop: [0.03, 0.07, 0.15],
      skyHor: [0.25, 0.4, 0.6],
      neb1: [0.1, 0.3, 0.5],
      neb2: [0.3, 0.2, 0.55],
      floor: [0.04, 0.06, 0.11],
      danger: [0.1, 0.05, 0.3],
      pattern: 2,
      gridCol: [0.3, 0.5, 0.7],
      ambient: "snow",
      pillar: [0.2, 0.3, 0.42],
      crystal: 0
    }
  },
  {
    id: "colosseum",
    name: "COLOSSEUM",
    blurb: "Ancient ring full of columns. Tight lanes, lots of cover.",
    R: 40,
    Rfinal: 29,
    accel: 14,
    gravity: 22,
    pillars: [...ring(8, 22, 1.8, 0, 3.4), ...ring(4, 9, 1.6, Math.PI / 4, 1.8)],
    theme: {
      accent: [1, 0.8, 0.35],
      fog: [0.07, 0.05, 0.08],
      skyTop: [0.05, 0.03, 0.1],
      skyHor: [0.35, 0.18, 0.25],
      neb1: [0.45, 0.2, 0.15],
      neb2: [0.3, 0.1, 0.4],
      floor: [0.08, 0.06, 0.07],
      danger: [0.35, 0.03, 0.1],
      pattern: 3,
      gridCol: [0.38, 0.27, 0.16],
      ambient: "sparks",
      pillar: [0.2, 0.16, 0.14],
      crystal: 1
    }
  },
  {
    id: "storm",
    name: "STORM CIRCUIT",
    blurb: "Low gravity: jump high and dodge the ball in the air.",
    R: 44,
    Rfinal: 31,
    accel: 14,
    gravity: 12.5,
    pillars: ring(5, 17, 1.7, 0.3, 3.4),
    theme: {
      accent: [0.8, 0.55, 1],
      fog: [0.04, 0.025, 0.09],
      skyTop: [0.03, 0.01, 0.1],
      skyHor: [0.2, 0.08, 0.4],
      neb1: [0.5, 0.15, 0.7],
      neb2: [0.8, 0.7, 0.1],
      floor: [0.05, 0.035, 0.11],
      danger: [0.3, 0.02, 0.2],
      pattern: 4,
      gridCol: [0.34, 0.16, 0.7],
      ambient: "sparks",
      pillar: [0.1, 0.07, 0.2],
      crystal: 1
    }
  },
  {
    id: "meadow",
    name: "SUNNY MEADOW",
    blurb: "Bright daylight lawn with a few cover pillars. Easy on the eyes, hard to win.",
    R: 42,
    Rfinal: 30,
    accel: 14,
    gravity: 22,
    pillars: ring(5, 16, 1.7, 0.2, 3),
    theme: {
      accent: [1, 0.85, 0.35],
      fog: [0.74, 0.86, 0.97],
      skyTop: [0.2, 0.46, 0.92],
      skyHor: [0.74, 0.86, 0.97],
      neb1: [0.5, 0.5, 0.5],
      neb2: [0.4, 0.45, 0.5],
      floor: [0.2, 0.5, 0.16],
      danger: [0.6, 0.12, 0.08],
      pattern: 5,
      gridCol: [0.07, 0.14, 0.04],
      ambient: "motes",
      pillar: [0.72, 0.68, 0.6],
      crystal: 0,
      day: true
    }
  },
  {
    id: "dunes",
    name: "TWILIGHT DUNES",
    blurb: "Blue desert at dusk with sandstone spires and cacti.",
    R: 44,
    Rfinal: 31,
    accel: 14,
    gravity: 22,
    pillars: ring(6, 17, 1.9, 0.5, 3.2),
    theme: {
      accent: [0.5, 0.8, 1],
      fog: [0.18, 0.5, 0.92],
      skyTop: [0.04, 0.16, 0.7],
      skyHor: [0.2, 0.62, 1],
      neb1: [0.3, 0.4, 0.6],
      neb2: [0.3, 0.4, 0.6],
      floor: [0.07, 0.17, 0.5],
      danger: [0.6, 0.12, 0.2],
      pattern: 6,
      gridCol: [0.05, 0.1, 0.25],
      ambient: "motes",
      pillar: [0.2, 0.3, 0.6],
      crystal: 0,
      day: true,
      scene: "dunes",
      side: [0.08, 0.16, 0.45]
    }
  }
].map((m) => ({ ...m, spawnR: Math.round(m.R * 0.72) }));
var MAP_BY_ID = new Map(MAPS.map((m) => [m.id, m]));
var getMap = (id) => typeof id === "object" && id ? id : MAP_BY_ID.get(id) || MAPS[0];
function scaleMap(map, k) {
  if (!k || k === 1) return map;
  return {
    ...map,
    R: +(map.R * k).toFixed(2),
    Rfinal: +(map.Rfinal * k).toFixed(2),
    spawnR: +(map.spawnR * k).toFixed(2),
    scale: k,
    pillars: map.pillars.map((p) => ({ ...p, x: p.x * k, z: p.z * k }))
  };
}

// src/game/modes.js
var MODES = [
  { id: "ffa", name: "12 PLAYERS", blurb: "Everyone for themselves: 12 players, last one standing wins.", total: 12, teams: 0, rScale: 1, finalAt: 3 },
  { id: "six", name: "6 PLAYERS", blurb: "Everyone for themselves with 6 players: faster and more intense.", total: 6, teams: 0, rScale: 0.82, finalAt: 0 },
  { id: "duel", name: "1 VS 1", blurb: "A pure duel in a small arena.", total: 2, teams: 0, rScale: 0.62, finalAt: 0, growth: 1.06, botMix: { easy: 0.03, normal: 0.2, hard: 0.35, elite: 0.27, master: 0.15 } }
];
var MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));
var getMode = (id) => typeof id === "object" && id ? id : MODE_BY_ID.get(id) || MODES[0];

// src/game/botNames.js
var FIRST = ["Lucas", "Emma", "Noah", "Sem", "Mila", "Daan", "Lotte", "Finn", "Tess", "Milan", "Julia", "Thijs", "Fleur", "Bram", "Sanne", "Jesse", "Noor", "Lars", "Eva", "Ruben", "Anna", "Tim", "Luuk", "Maud", "Max", "Zoe", "Jelle", "Iris", "Niels", "Liv", "Mats", "Kyra", "Olivier", "Sofie", "Jonas", "Elise", "Arne", "Hannah", "Victor", "Mathias", "Ella", "Leon", "Nina", "Oscar", "Amber", "Tom", "Jade", "Luca", "Yara", "Sam"];
var WORDS = ["Shadow", "Nova", "Blaze", "Ghost", "Pixel", "Viper", "Storm", "Frost", "Turbo", "Raven", "Zephyr", "Comet", "Rogue", "Echo", "Drift", "Saber", "Glitch", "Hyper", "Onyx", "Wolf", "Falcon", "Cobra", "Rocket", "Ninja", "Titan", "Lynx", "Orbit", "Flux", "Spark", "Cipher", "Phantom", "Neon", "Kraken", "Blitz", "Atlas", "Pulse", "Vortex", "Jinx", "Mango", "Waffle", "Pancake", "Noodle", "Potato", "Panda", "Cookie", "Toast"];
var TAIL = ["", "", "", "_", "x", "XD", "NL", "BE", "YT", "pro", "tv", "gg"];
var pick = (rng, a) => a[Math.floor(rng() * a.length)];
var num = (rng) => {
  const r = rng();
  return r < 0.3 ? "" : r < 0.55 ? String(Math.floor(rng() * 100)) : r < 0.8 ? String(2e3 + Math.floor(rng() * 26)) : String(Math.floor(rng() * 1e3));
};
function makeName(rng) {
  const style = Math.floor(rng() * 7);
  let n;
  switch (style) {
    case 0:
      n = pick(rng, FIRST) + num(rng);
      break;
    case 1:
      n = pick(rng, FIRST) + "_" + pick(rng, TAIL).replace("_", "") + num(rng);
      break;
    case 2:
      n = pick(rng, WORDS) + pick(rng, WORDS);
      break;
    case 3:
      n = "x" + pick(rng, WORDS) + num(rng);
      break;
    case 4:
      n = pick(rng, FIRST) + pick(rng, WORDS);
      break;
    case 5:
      n = pick(rng, WORDS).toLowerCase() + num(rng);
      break;
    default:
      n = pick(rng, FIRST) + pick(rng, ["Plays", "Gaming", "Official", "GG", "TV"]);
      break;
  }
  n = n.replace(/_+$/, "").replace(/[^\w.\-]/g, "");
  return (n || pick(rng, FIRST)).slice(0, 12);
}
function makeNames(rng, count, taken = []) {
  const used = new Set(taken.map((s) => String(s).toLowerCase()));
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 500) {
    const n = makeName(rng);
    if (used.has(n.toLowerCase())) continue;
    used.add(n.toLowerCase());
    out.push(n);
  }
  while (out.length < count) out.push("Player" + (1e3 + out.length));
  return out;
}

// src/game/cosmetics.js
var BODIES = [
  { id: "default", name: "Standard", price: 0, color: null },
  { id: "crimson", name: "Crimson", price: 150, color: [1, 0.25, 0.3] },
  { id: "azure", name: "Azure", price: 150, color: [0.25, 0.55, 1] },
  { id: "mint", name: "Mint", price: 200, color: [0.3, 1, 0.7] },
  { id: "gold", name: "Gold", price: 400, color: [1, 0.8, 0.25] },
  { id: "violet", name: "Violet", price: 400, color: [0.7, 0.35, 1] },
  { id: "onyx", name: "Onyx", price: 600, color: [0.55, 0.6, 0.75], dark: true },
  { id: "chrome", name: "Chrome", price: 700, color: [0.95, 0.97, 1] },
  { id: "rainbow", name: "Rainbow", price: 1500, color: "rainbow" }
];
var OUTFITS = [
  { id: "tee", name: "T-shirt & jeans", price: 0 },
  { id: "hoodie", name: "Grey Hoodie", price: 150, top: [0.42, 0.44, 0.48], bot: [0.12, 0.13, 0.18], shoe: [0.9, 0.9, 0.88], long: true, hood: true, pocket: true },
  { id: "track", name: "Red Tracksuit", price: 200, top: [0.8, 0.1, 0.14], bot: [0.75, 0.09, 0.12], shoe: [0.95, 0.95, 0.95], long: true, stripe: true },
  { id: "jacket", name: "Leather Jacket", price: 300, top: [0.09, 0.08, 0.09], bot: [0.16, 0.2, 0.34], shoe: [0.08, 0.07, 0.07], long: true, collar: true },
  { id: "suit", name: "Black Suit", price: 400, top: [0.07, 0.07, 0.09], bot: [0.07, 0.07, 0.09], shoe: [0.05, 0.05, 0.05], long: true, tie: true },
  { id: "camo", name: "Camo", price: 350, top: [0.25, 0.34, 0.18], bot: [0.2, 0.28, 0.14], shoe: [0.16, 0.12, 0.08], long: true, pocket: true },
  { id: "kimono", name: "Samurai Robe", price: 500, top: [0.5, 0.08, 0.1], bot: [0.1, 0.1, 0.16], shoe: [0.2, 0.15, 0.1], long: true, sash: [0.95, 0.85, 0.5] },
  { id: "hazmat", name: "Hazmat Suit", price: 600, top: [0.95, 0.8, 0.1], bot: [0.95, 0.8, 0.1], shoe: [0.15, 0.15, 0.15], long: true, hood: true }
];
var OUTFIT_BY_ID = new Map(OUTFITS.map((o) => [o.id, o]));
var HEADS = [
  { id: "none", name: "Bare", price: 0, mode: "none" },
  { id: "antenna", name: "Antenna", price: 100, mode: "antenna" },
  { id: "helmet", name: "Helmet", price: 200, mode: "helmet" },
  { id: "horns", name: "Horns", price: 350, mode: "horns" },
  { id: "halo", name: "Halo", price: 450, mode: "halo" },
  { id: "wizard", name: "Wizard Hat", price: 600, mode: "wizard" },
  { id: "crown", name: "Crown", price: 1e3, mode: "crown" }
];
var CHARACTERS = [
  { id: "rookie", name: "Rookie", price: 0, wins: 0 },
  { id: "ninja", name: "Shadow Ninja", price: 0, wins: 1 },
  { id: "sunny", name: "Sunny", price: 0, wins: 1 },
  { id: "luna", name: "Luna", price: 0, wins: 2 },
  { id: "disco", name: "Disco Dan", price: 0, wins: 4 },
  { id: "ember", name: "Ember", price: 0, wins: 6 },
  { id: "penguin", name: "Penguin Pro", price: 0, wins: 8 },
  { id: "blob", name: "Blobby", price: 0, wins: 2 },
  { id: "bot", name: "Pilot", price: 0, wins: 3 },
  { id: "tall", name: "Android", price: 0, wins: 5 },
  { id: "ghost", name: "Phantom", price: 0, wins: 10 },
  { id: "cube", name: "Cubix", price: 0, wins: 18 },
  { id: "knight", name: "Knight", price: 0, wins: 30 },
  { id: "alien", name: "Visitor", price: 0, wins: 50 }
];
function botSkin(n, salt = 0) {
  const h = (k) => {
    let x = Math.imul((n + 1) * 2654435761 ^ salt + k * 97, 2246822519);
    x ^= x >>> 15;
    x = Math.imul(x, 3266489917);
    return (x ^ x >>> 13) >>> 0;
  };
  const body = BODIES[h(1) % BODIES.length], head = HEADS[h(2) % HEADS.length];
  return { char: CHARACTERS[h(5) % CHARACTERS.length].id, outfit: OUTFITS[h(6) % OUTFITS.length].id, body: h(3) % 10 < 4 ? "default" : body.id, head: h(4) % 10 < 4 ? "none" : head.id };
}

// src/game/upgrades.js
var ABILITY_COOLDOWN = 10;
var UPGRADES = [
  { id: "jump", name: "Jump Boost", desc: "Jump higher. Level 2+ reaches the tall obstacles. (Everyone can double jump.)", levels: [150, 300, 600] },
  { id: "speed", name: "Swift Feet", desc: "Run 4% faster per level.", levels: [120, 240, 480] },
  { id: "dash", name: "Quick Dash", desc: "Dash cooldown 2.2s -> 1.8 / 1.4 / 1.0s.", levels: [150, 300, 600] },
  { id: "sprint", name: "Sprint", desc: "Run 45% faster for 5s.", levels: [350], ability: true, dur: 5, icon: "\u26A1" },
  { id: "invis", name: "Invisibility", desc: "Invisible for 5s: nobody can target you, a ball locked on you loses its lock.", levels: [400], ability: true, dur: 5, icon: "\u25CC" },
  { id: "bubble", name: "Bubble Shield", desc: "A shield for 3s that blocks the hit (it also breaks on the first hit).", levels: [500], ability: true, dur: 3, icon: "\u{1F6E1}" },
  { id: "warp", name: "Time Warp", desc: "The ball moves at half speed for 3s.", levels: [700], ability: true, dur: 3, icon: "\u23F1" },
  { id: "guard", name: "Guardian", desc: "For 4s the first lethal hit is deflected automatically.", levels: [800], ability: true, dur: 4, icon: "\u2665" },
  { id: "sky", name: "Sky Jump", desc: "Jump 70% higher for 5s - reach the tall obstacles.", levels: [450], ability: true, dur: 5, icon: "\u21E7" },
  { id: "magnet", name: "Wide Parry", desc: "Your parry timing window is 70% longer for 5s.", levels: [600], ability: true, dur: 5, icon: "\u25CE" },
  { id: "aim", name: "Auto Aim", desc: "For 5s your throws snap to the player closest to your crosshair.", levels: [550], ability: true, dur: 5, icon: "\u2316" },
  { id: "rapid", name: "Rapid Dash", desc: "For 5s your dash is ready again after 0.3s.", levels: [500], ability: true, dur: 5, icon: "\u226B" },
  { id: "slow", name: "Heavy Air", desc: "For 4s a ball flying at you is 40% slower.", levels: [900], ability: true, dur: 4, icon: "\u2744" }
];
var ABILITY_IDS = UPGRADES.filter((u) => u.ability).map((u) => u.id);
var UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

// src/game/config.js
var CFG = {
  MAX_PLAYERS: 12,
  FIXED_DT: 1 / 60,
  // arena (world units ~ metres)
  ARENA_R: 42,
  // big arena (was 26)
  ARENA_R_FINAL: 30,
  // arena shrinks during LAST 3
  SPAWN_R: 28,
  PLAYER_R: 0.7,
  BALL_H: 1.3,
  // movement
  MOVE_SPEED: 7,
  // a bit faster than before
  DASH_SPEED: 18,
  // jump: while the body is above JUMP_CLEAR the ball flies underneath (it homes back, so it is a timing dodge, not immunity)
  JUMP_V: 9.8,
  // base jump apex ~2.2 m (low obstacles). Upgrades add JUMP_V_STEP per level (tall obstacles need level 2+)
  JUMP_V_STEP: 1.5,
  GRAVITY: 22,
  JUMP_CD: 1.5,
  BALL_CLIMB: 9,
  // m/s: how fast the (homing) ball can climb/descend toward its target's height
  UPGRADE_CAPS: { jump: 3, speed: 3, dash: 3, invis: 1, warp: 1, guard: 1, bubble: 1, sprint: 1, sky: 1, magnet: 1, aim: 1, rapid: 1, slow: 1 },
  DASH_TIME: 0.16,
  DASH_CD: 2.2,
  // parry
  HIT_R: 1.15,
  // contact radius around a player
  PARRY_WINDOW_SLOW: 0.34,
  // seconds the parry stays active at start speed
  PARRY_WINDOW_FAST: 0.22,
  // ... and at critical speed (window shrinks as ball speeds up)
  PARRY_CD: 0.75,
  GRACE: 0.07,
  // ball may "hang" on a player this long, a parry in that time still counts (late)
  PERFECT: 0.08,
  // pressed <= 80 ms before contact
  GOOD: 0.18,
  // <= 180 ms. Longer = "early" (still succeeds, weaker)
  MAX_LAG_ALLOW: 0.12,
  // latency compensation cap (server side)
  // ball
  KMH_TO_U: 0.078,
  // km/h shown on HUD -> world units / second
  SPEED_TABLE: [35],
  SPEED_GROWTH: 1.12,
  // every deflection makes the ball 12% faster (35 -> ~62 after 5, ~109 after 10, ~190 after 15, ~330 after 20)
  SPEED_CAP_KMH: 1100,
  // effectively no cap: the ball keeps getting faster
  SPEED_ABS_MAX: 1600,
  PERFECT_SPEED_BONUS: 1.05,
  FLIGHT_ACCEL: 0.2,
  // ball gains +20%/s of its launch speed while flying (max below) so running away never works
  FLIGHT_ACCEL_MAX: 0.6,
  CHARGE_TIME: 1.1,
  // ball hovers + target warning before it launches
  ARM_TIME: 0.28,
  // after (re)launch the ball cannot hit yet -> no instant hits
  MIN_TARGET_DIST: 9,
  RALLY_KEEP: 0.5,
  // after an elimination the rally speed resets to 40%
  // aim
  AIM_CONE: 0.7,
  // rad: inside this cone the throw counts as 'aimed' (the ball goes to the nearest-to-aim player over the full 360 degrees)
  AIM_CONE_PERFECT: 0.95,
  PINGPONG_LIMIT: 3,
  // flow
  COUNTDOWN: 3.2,
  ROUND_END_TIME: 2.4,
  FRENZY_MULT: 1.35,
  // match-time escalation: [seconds, multiplier]
  TIME_CURVE: [[0, 1], [30, 1.05], [60, 1.15], [120, 1.35], [180, 1.65], [240, 2], [330, 2.6]],
  TIME_SLOPE_AFTER: 0.012
  // per second after the last curve point: it never stops accelerating
};
function speedFromRally(rally, growth = CFG.SPEED_GROWTH) {
  const t = CFG.SPEED_TABLE;
  if (rally < t.length) return t[rally];
  return Math.min(CFG.SPEED_CAP_KMH, t[t.length - 1] * Math.pow(growth, rally - (t.length - 1)));
}
function timeMultiplier(sec) {
  const c = CFG.TIME_CURVE;
  if (sec <= 0) return 1;
  for (let i = 1; i < c.length; i++) {
    if (sec <= c[i][0]) {
      const [t0, m0] = c[i - 1], [t1, m1] = c[i];
      return m0 + (m1 - m0) * (sec - t0) / (t1 - t0);
    }
  }
  const last = c[c.length - 1];
  return last[1] + (sec - last[0]) * CFG.TIME_SLOPE_AFTER;
}
function speedIntensity(kmh) {
  return Math.min(1, Math.max(0, (kmh - 35) / 245));
}
function parryWindowFor(kmh) {
  const k = speedIntensity(kmh);
  return CFG.PARRY_WINDOW_SLOW + (CFG.PARRY_WINDOW_FAST - CFG.PARRY_WINDOW_SLOW) * k;
}

// src/utils/rng.js
function makeRng(seed = Math.random() * 2 ** 32 >>> 0) {
  let s = seed >>> 0;
  const f = () => {
    s = s + 1831565813 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(f.range(a, b + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = f();
    while (v === 0) v = f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  f.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return f;
}

// src/utils/math.js
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var lerp = (a, b, t) => a + (b - a) * t;
var angleDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
var yawToDir = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
var dirToYaw = (x, z) => Math.atan2(x, z);
function segPointDist(ax, az, bx, bz, px, pz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}

// src/bots/botController.js
var BOT_LEVELS = {
  easy: { reaction: [0.32, 0.58], sigma: 0.095, mistake: 0.2, aimErr: 0.45, move: 0.55, leadBias: 0.55, tick: 1 / 18 },
  normal: { reaction: [0.2, 0.38], sigma: 0.055, mistake: 0.075, aimErr: 0.25, move: 0.75, leadBias: 0.5, tick: 1 / 24 },
  hard: { reaction: [0.12, 0.24], sigma: 0.03, mistake: 0.025, aimErr: 0.1, move: 0.9, leadBias: 0.42, tick: 1 / 40 },
  // a rare champion: reacts almost instantly and practically never blunders - sometimes you simply lose to it
  master: { reaction: [0.04, 0.075], sigma: 7e-3, mistake: 0, aimErr: 0, move: 1.12, leadBias: 0.3, tick: 1 / 60 },
  elite: { reaction: [0.07, 0.16], sigma: 0.016, mistake: 8e-3, aimErr: 0.03, move: 1, leadBias: 0.3, tick: 1 / 60 }
};
var DEFAULT_LEVEL_MIX = { easy: 0.3, normal: 0.42, hard: 0.2, elite: 0.06, master: 0.02 };
var LEVELS = ["easy", "normal", "hard", "elite", "master"];
function mixForSkill(skill, sigma = 0.95) {
  const c = Math.max(0, Math.min(1, skill)) * 4;
  const w = LEVELS.map((_, i) => Math.exp(-((i - c) ** 2) / (2 * sigma * sigma)) + 0.02);
  const sum = w.reduce((a, b) => a + b, 0), mix = {};
  LEVELS.forEach((k, i) => {
    mix[k] = w[i] / sum;
  });
  return mix;
}
function strongBotLevel(skill, rng) {
  if (skill < 0.3) return "hard";
  if (skill < 0.55) return rng() < 0.3 ? "hard" : "elite";
  if (skill < 0.8) return rng() < 0.12 ? "master" : "elite";
  return rng() < 0.45 ? "master" : "elite";
}
function pickBotLevel(rng, mix) {
  const m = mix || DEFAULT_LEVEL_MIX;
  let r = rng(), acc = 0;
  for (const k of Object.keys(m)) {
    acc += m[k];
    if (r < acc) return k;
  }
  return "normal";
}
var BotController = class {
  constructor(player, level, rng, profileOverride = null) {
    this.p = player;
    this.rng = rng;
    this.level = level || "normal";
    const base = BOT_LEVELS[this.level] || BOT_LEVELS.normal;
    const jit = () => 1 + (rng() - 0.5) * 0.6;
    this.profile = profileOverride || {
      ...base,
      sigma: base.sigma * jit(),
      mistake: base.mistake * jit(),
      aimErr: base.aimErr * jit()
    };
    this.reactionTime = rng.range(this.profile.reaction[0], this.profile.reaction[1]);
    this.parryAccuracy = 1 - this.profile.mistake;
    this.mistakeChance = this.profile.mistake;
    this.movementSkill = this.profile.move;
    this.targetPreference = rng.pick(["random", "far", "revenge", "weak", "human"]);
    this.speedScale = this.profile.move;
    this.revenge = /* @__PURE__ */ new Map();
    this.seen = false;
    this.noticeAt = 0;
    this.plan = null;
    this.pressed = false;
    this.nextDecision = 0;
    this.goalX = 0;
    this.goalZ = 0;
    this.goalT = 0;
    this.strafe = rng() < 0.5 ? 1 : -1;
    this.lastTargetedId = null;
    this.hopT = rng.range(3, 10);
    this.padGoal = null;
    this.debug = { kind: "idle" };
  }
  // ---- event hooks ------------------------------------------------------
  notify(type, data) {
    if (type === "PLAYER_ELIMINATED" && data && data.by === this.p.id) {
    }
  }
  // ---- main update ------------------------------------------------------
  update(dt, match) {
    const p = this.p;
    this._move(dt, match);
    this._abilities(dt, match);
    const b = match.ball;
    if (b.mode !== "flying" || b.targetId !== p.id) {
      if (this.plan) this._resetBall();
      return;
    }
    if (!this.plan) this._onTargeted(match, b);
    const now = match.time;
    if (!this.seen) {
      if (now >= this.noticeAt) {
        this.seen = true;
      } else return;
    }
    if (this.pressed) return;
    if (now < this.nextDecision) return;
    this.nextDecision = now + this.profile.tick;
    if (this.plan.mistake === "none") return;
    const dx = p.x - b.x, dz = p.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    const dist = dl - CFG.HIT_R;
    const u = b.speedKmh * CFG.KMH_TO_U;
    const closing = Math.max(0.5, ((b.dx * u - p.vx) * dx + (b.dz * u - p.vz) * dz) / dl);
    const tti = Math.max(0, dist) / closing + this.plan.delta;
    if (tti <= this.plan.lead) {
      const target = this._chooseTarget(match, b);
      if (match.press(p.id, "parry", { targetId: target })) {
        this.pressed = true;
        const t = match.byId.get(target);
        if (t) p.input.aimYaw = dirToYaw(t.x - p.x, t.z - p.z);
      }
    }
  }
  // jumping + abilities: bots use them like a player would, but only with the upgrades they own
  _abilities(dt, match) {
    const p = this.p, b = match.ball, up = p.up || {};
    const targeted = b.mode === "flying" && b.targetId === p.id;
    if (this.padGoal && p.onGround) {
      const pl = this.padGoal, d = Math.hypot(p.x - pl.x, p.z - pl.z);
      if (d < pl.r + 1.5 && d > pl.r) {
        match.press(p.id, "jump");
      }
    }
    this.hopT -= dt;
    if (this.hopT <= 0) {
      this.hopT = this.rng.range(4, 12);
      if (!targeted && p.onGround) match.press(p.id, "jump");
    }
    if (!targeted) return;
    const u = b.speedKmh * CFG.KMH_TO_U, dist = Math.hypot(b.x - p.x, b.z - p.z);
    const tti = dist / Math.max(1, u);
    if (up.invis && p.abT <= 0 && p.abCd <= 0 && b.speedKmh > 220 && tti < 0.55 && tti > 0.2 && this.rng() < 0.03) match.press(p.id, "invis");
    if (up.warp && p.abT <= 0 && p.abCd <= 0 && b.speedKmh > 260 && tti < 0.9 && match.aliveCount() <= 4 && this.rng() < 0.04) match.press(p.id, "warp");
  }
  _resetBall() {
    this.seen = false;
    this.plan = null;
    this.pressed = false;
  }
  _onTargeted(match, b) {
    const p = this.p;
    this.pressed = false;
    this.seen = false;
    const sf = speedIntensity(b.speedKmh);
    const react = Math.max(0.04, this.reactionTime * this.rng.range(0.8, 1.25));
    this.noticeAt = match.time + react;
    const chaos = (match.frenzyT > 0 ? 0.5 : 0) + (match.aliveCount() <= 3 ? 0.15 : 0) + (b.rally > 12 ? 0.2 : 0);
    const dist = Math.hypot(b.x - p.x, b.z - p.z);
    const distF = dist < 9 ? 1.5 : dist > 28 ? 1.15 : 1;
    const rallyF = 1 + Math.min(b.rally, 20) * 0.025;
    let pm = this.profile.mistake * (1 + 0.8 * sf) * (1 + chaos) * distF * rallyF;
    pm = clamp(pm, 0, 0.7);
    let mistake = null;
    if (this.rng() < pm) mistake = this.rng.pick(["none", "early", "late", "early", "late"]);
    const sigma = this.profile.sigma * (1 + sf * 1.1) * (1 + chaos * 0.5);
    const delta = this.rng.gauss() * sigma;
    const W = match.byId.get(p.id) ? this._windowFor(b.speedKmh) : 0.25;
    let lead = W * this.profile.leadBias;
    if (mistake === "early") lead += this.rng.range(0.14, 0.4);
    if (mistake === "late") lead -= this.rng.range(0.12 + CFG.GRACE, 0.3);
    this.plan = { delta, lead, mistake };
    this.debug = { kind: mistake || "ok", lead, delta };
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
    if (this.rng() < this.profile.aimErr * (1 + 0.5 * sf)) return this.rng.pick(cands).id;
    let best = null, bs = -1e9;
    for (const c of cands) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      let s = this.rng() * 1;
      switch (this.targetPreference) {
        case "far":
          s += d / 20;
          break;
        case "weak":
          s += c.isBot ? c.level === "easy" ? 0.8 : c.level === "normal" ? 0.3 : 0 : 0.4;
          break;
        case "human":
          s += c.isBot ? 0 : 0.7;
          break;
        case "revenge":
          s += (this.revenge.get(c.id) || 0) * 0.6;
          break;
      }
      if (c.id === b.sourceId) s -= 0.8;
      if (b.recent && b.recent.includes(c.id)) s -= 0.4;
      if (d < 6) s -= 0.8;
      if (s > bs) {
        bs = s;
        best = c;
      }
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
      if (orb && Math.hypot(orb.x - p.x, orb.z - p.z) < 22 && this.rng() < 0.55) {
        this.goalX = orb.x;
        this.goalZ = orb.z;
        this.goalT = 3;
      } else {
        const reach = Math.pow(CFG.JUMP_V + CFG.JUMP_V_STEP * (p.up && p.up.jump || 0), 2) / (2 * CFG.GRAVITY) - 0.35;
        const pads = (match.map.pillars || []).filter((q) => q.h <= reach);
        if (pads.length && this.rng() < 0.3) {
          this.padGoal = this.rng.pick(pads);
          this.goalX = this.padGoal.x;
          this.goalZ = this.padGoal.z;
          this.goalT = this.rng.range(2.5, 5);
        } else {
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
    if (l < 1.2) {
      mx = 0;
      mz = 0;
    } else {
      mx /= l;
      mz /= l;
    }
    const b = match.ball;
    if (b.mode === "flying" && b.targetId === p.id) {
      const side = this.profile.move > 0.7 ? 0.5 : 0;
      mx = mx * 0.35 - b.dz * this.strafe * side * 0.5;
      mz = mz * 0.35 + b.dx * this.strafe * side * 0.5;
    }
    if (b.mode === "flying" || b.mode === "charging") {
      const want = dirToYaw(b.x - p.x, b.z - p.z);
      if (!this.pressed) p.input.aimYaw += angleDiff(p.input.aimYaw, want) * Math.min(1, dt * 8);
    }
    match.setInput(p.id, { mx, mz });
  }
};

// src/game/match.js
var State = Object.freeze({
  LOBBY: "LOBBY",
  COUNTDOWN: "COUNTDOWN",
  ACTIVE: "ACTIVE",
  FINAL_PHASE: "FINAL_PHASE",
  ROUND_END: "ROUND_END",
  RESULTS: "RESULTS",
  RETURN_TO_LOBBY: "RETURN_TO_LOBBY"
});
var Match = class {
  constructor({ seed, botLevelMix, skill = null, tutorial = false, map = "neon", mode = "ffa" } = {}) {
    this.skill = skill;
    this.tutorial = tutorial;
    this.rng = makeRng(seed);
    this.growth = getMode(mode).growth || CFG.SPEED_GROWTH;
    this.botLevelMix = botLevelMix || (skill != null ? mixForSkill(skill, getMode(mode).total === 2 ? 0.7 : 0.95) : getMode(mode).botMix) || null;
    this.players = [];
    this.byId = /* @__PURE__ */ new Map();
    this.state = State.LOBBY;
    this.stateT = 0;
    this.time = 0;
    this.acc = 0;
    this.events = [];
    this.mode = getMode(mode);
    this.teams = this.mode.teams;
    this.maxPlayers = this.mode.total;
    this.map = scaleMap(getMap(map), this.mode.rScale);
    this.arenaR = this.map.R;
    this.warpT = 0;
    this.winnerTeam = null;
    this.gravT = 0;
    this.orbs = [];
    this.orbT = 9;
    this._orbId = 0;
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
      mode: "none",
      // none | charging | choosing | flying
      x: 0,
      z: 0,
      y: CFG.BALL_H,
      dx: 0,
      dz: 1,
      baseKmh: CFG.SPEED_TABLE[0],
      speedKmh: CFG.SPEED_TABLE[0],
      targetId: null,
      sourceId: null,
      // source = last player that deflected it
      holders: [],
      // history of last deflecting players (for ping-pong detection)
      recent: [],
      // recent targets (anti repeat)
      rally: 0,
      t: 0,
      // timer for charging / choosing
      armT: 0,
      turnT: 0,
      flightT: 0,
      hanging: false,
      contactT: 0,
      cands: null,
      sinceEvent: 0,
      perfectBonus: 1
    };
  }
  // ---------------------------------------------------------------- roster
  addParticipant({ id, name, isBot = false, level = null, aimAssist = 0, skin = null, team = null, up = null }) {
    if (this.players.length >= this.maxPlayers) return null;
    if (this.byId.has(id)) return this.byId.get(id);
    if (this.teams) {
      const n0 = this.players.filter((q) => q.team === 0).length, n1 = this.players.filter((q) => q.team === 1).length;
      if (team !== 0 && team !== 1) team = n0 <= n1 ? 0 : 1;
    } else team = null;
    const caps = CFG.UPGRADE_CAPS, u = {};
    for (const k of Object.keys(caps)) u[k] = Math.max(0, Math.min(caps[k], Math.floor(Number(up && up[k]) || 0)));
    const p = {
      id,
      name,
      isBot,
      level,
      alive: true,
      left: false,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      y: 0,
      vy: 0,
      jumpCd: 0,
      onGround: true,
      team,
      up: u,
      ground: 0,
      shield: false,
      hasteT: 0,
      invisT: 0,
      guardUsed: false,
      input: { mx: 0, mz: 0, aimYaw: 0 },
      dashT: 0,
      dashCd: 0,
      dashX: 0,
      dashZ: 0,
      abT: 0,
      abCd: 0,
      airJumps: 0,
      airT: 0,
      parryCd: 0,
      parryActive: 0,
      parrySince: 0,
      lagAllow: 0,
      knockX: 0,
      knockZ: 0,
      stats: { parries: 0, perfect: 0, elims: 0 },
      place: 0,
      diedAt: 0,
      lastTargetedAt: -10,
      color: this.players.length % 12,
      aimAssist,
      skin,
      bot: null
    };
    if (isBot) p.bot = new BotController(p, level, makeRng(this.rng() * 2 ** 32));
    this.players.push(p);
    this.byId.set(id, p);
    return p;
  }
  // computer players own a few upgrades, scaled by level (they cannot be as strong as a fully upgraded human)
  _botUpgrades(level) {
    const r = this.rng;
    if (level === "easy") return { jump: r() < 0.3 ? 1 : 0 };
    if (level === "normal") return { jump: r() < 0.6 ? 1 : 0, speed: r() < 0.3 ? 1 : 0 };
    if (level === "hard") return { jump: r() < 0.5 ? 2 : 1, speed: 1, invis: r() < 0.3 ? 1 : 0 };
    if (level === "master") return { jump: 3, speed: 3, dash: 2, invis: 1, warp: 1, guard: 1 };
    return { jump: 2, speed: r() < 0.5 ? 2 : 1, invis: r() < 0.6 ? 1 : 0, warp: r() < 0.3 ? 1 : 0, guard: r() < 0.3 ? 1 : 0 };
  }
  fillBots() {
    if (!this._names) this._names = makeNames(makeRng(this._salt), this.maxPlayers + 4, this.players.map((q) => q.name));
    while (this.players.length < this.maxPlayers) {
      this._botNum++;
      let level = pickBotLevel(this.rng, this.botLevelMix);
      if (this._botNum === 1 && !this.tutorial && this.rng() < 0.92) level = this.skill != null ? strongBotLevel(this.skill, this.rng) : this.rng() < 0.1 ? "master" : "elite";
      this.addParticipant({
        id: "bot" + this._botNum,
        name: this._names[(this._botNum - 1) % this._names.length],
        isBot: true,
        level,
        skin: botSkin(this._botNum, this._salt),
        up: this._botUpgrades(level)
      });
    }
  }
  get frenzy() {
    return this.frenzyT > 0;
  }
  humans() {
    return this.players.filter((p) => !p.isBot && !p.left);
  }
  aliveList() {
    return this.players.filter((p) => p.alive);
  }
  aliveCount() {
    let n = 0;
    for (const p of this.players) if (p.alive) n++;
    return n;
  }
  // A participant disconnects / closes the browser. Never blocks the match.
  removeParticipant(id) {
    const p = this.byId.get(id);
    if (!p) return;
    if (this.state === State.LOBBY) {
      this.players = this.players.filter((q) => q !== p);
      this.byId.delete(id);
      return;
    }
    if (!p.alive) {
      p.left = true;
      return;
    }
    const remaining = this.aliveCount();
    p.left = true;
    p.alive = false;
    p.place = remaining;
    p.diedAt = this.time;
    this.emit({ type: "leave", id, name: p.name, remaining: remaining - 1 });
    this._afterLoss(p, null, true);
  }
  // ---------------------------------------------------------------- flow
  start() {
    if (this.state !== State.LOBBY) return;
    const order = this.rng.shuffle(this.players.slice());
    const n = order.length;
    const off = this.rng() * Math.PI * 2;
    const slot = /* @__PURE__ */ new Map();
    if (this.teams) {
      for (const t of [0, 1]) {
        const mem = order.filter((p) => p.team === t);
        mem.forEach((p, j) => slot.set(p.id, off + t * Math.PI + (j - (mem.length - 1) / 2) * (mem.length > 2 ? 0.34 : 0.45)));
      }
    } else order.forEach((p, i) => slot.set(p.id, off + i / n * Math.PI * 2));
    order.forEach((p) => {
      const a = slot.get(p.id);
      p.x = Math.sin(a) * this.map.spawnR;
      p.z = Math.cos(a) * this.map.spawnR;
      p.yaw = Math.atan2(-p.x, -p.z);
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
    this.emit({ type: "state", state: s });
  }
  returnToLobby() {
    if (this.state === State.RESULTS || this.state === State.ROUND_END) this._setState(State.RETURN_TO_LOBBY);
  }
  emit(e) {
    this.events.push(e);
  }
  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
  // ---------------------------------------------------------------- inputs
  setInput(id, { mx = 0, mz = 0, aimYaw } = {}) {
    const p = this.byId.get(id);
    if (!p) return;
    const l = Math.hypot(mx, mz);
    if (l > 1) {
      mx /= l;
      mz /= l;
    }
    if (!Number.isFinite(mx) || !Number.isFinite(mz)) {
      mx = 0;
      mz = 0;
    }
    p.input.mx = mx;
    p.input.mz = mz;
    if (Number.isFinite(aimYaw)) p.input.aimYaw = aimYaw;
  }
  _abOn(p, id) {
    return p.abT > 0 && !!p.up[id];
  }
  _abId(p) {
    for (const k of ABILITY_IDS) if (p.up[k] > 0) return k;
    return null;
  }
  // The one equipped ability: lasts its duration, then ABILITY_COOLDOWN seconds until it can be used again.
  _ability(p, kind) {
    const id = this._abId(p);
    if (!id || kind !== "ability" && kind !== id) return false;
    if (p.abT > 0 || p.abCd > 0 || this.state === State.COUNTDOWN) return false;
    const def = UPGRADE_BY_ID.get(id);
    p.abT = def.dur;
    p.abCd = 0;
    if (id === "invis") {
      p.invisT = def.dur;
      this.emit({ type: "invis", id: p.id });
      const b = this.ball;
      if (b.mode === "flying" && b.targetId === p.id && !b.hanging) this._retargetNow();
    } else if (id === "bubble") {
      p.shield = true;
      this.emit({ type: "pickup", id: p.id, kind: "shield" });
    } else if (id === "sprint") {
      p.hasteT = Math.max(p.hasteT, def.dur);
      this.emit({ type: "pickup", id: p.id, kind: "haste" });
    } else if (id === "warp") {
      this.warpT = def.dur;
      this.emit({ type: "warp", id: p.id });
    } else this.emit({ type: "ability", id: p.id, ability: id });
    return true;
  }
  // kind: 'parry' | 'dash'. lag (seconds) = measured one-way latency, used for compensation.
  press(id, kind, { lag = 0, targetId = null } = {}) {
    const p = this.byId.get(id);
    if (!p || !p.alive) return false;
    if (this.state !== State.ACTIVE && this.state !== State.FINAL_PHASE && this.state !== State.COUNTDOWN) return false;
    if (kind === "jump") {
      if (this.state === State.COUNTDOWN) return false;
      const jv = (CFG.JUMP_V + CFG.JUMP_V_STEP * p.up.jump) * (this._abOn(p, "sky") ? 1.7 : 1);
      if (!p.onGround) {
        if (p.airJumps >= 1 || p.airT < 0.12) return false;
        p.airJumps++;
        p.vy = jv * 0.9;
        this.emit({ type: "jump", id, double: true });
        return true;
      }
      if (p.jumpCd > 0) return false;
      p.vy = jv;
      p.jumpCd = CFG.JUMP_CD;
      p.onGround = false;
      p.airJumps = 0;
      p.airT = 0;
      this.emit({ type: "jump", id });
      return true;
    }
    if (kind === "dash") {
      if (p.dashCd > 0 || this.state === State.COUNTDOWN) return false;
      let { mx, mz } = p.input;
      if (Math.hypot(mx, mz) < 0.1) {
        const d = yawToDir(p.yaw);
        mx = d.x;
        mz = d.z;
      }
      const l = Math.hypot(mx, mz) || 1;
      p.dashX = mx / l;
      p.dashZ = mz / l;
      p.dashT = CFG.DASH_TIME;
      p.dashCd = this._abOn(p, "rapid") ? 0.3 : CFG.DASH_CD - 0.4 * p.up.dash;
      this.emit({ type: "dash", id });
      return true;
    }
    if (kind === "ability" || ABILITY_IDS.includes(kind)) return this._ability(p, kind);
    if (kind === "parry") {
      if (this.state === State.COUNTDOWN) return false;
      if (p.parryCd > 0) return false;
      const b = this.ball;
      const kmh = b.mode === "flying" ? b.speedKmh : CFG.SPEED_TABLE[0];
      p.parryActive = parryWindowFor(kmh) * (this._abOn(p, "magnet") ? 1.7 : 1);
      p.parrySince = 0;
      p.parryCd = CFG.PARRY_CD;
      p.lagAllow = clamp(lag, 0, CFG.MAX_LAG_ALLOW);
      p.botAimTarget = targetId;
      this.emit({ type: "parryPress", id });
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
        this.stateT -= dt;
        const c = Math.ceil(this.stateT);
        if (c !== this.lastCountdown) {
          this.lastCountdown = c;
          if (c >= 1 && c <= 3) this.emit({ type: "countdown", n: c });
        }
        this._updatePlayers(dt);
        this._updateBots(dt);
        if (this.stateT <= 0) {
          this._setState(State.ACTIVE);
          this.emit({ type: "go" });
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
    if (this.warpT > 0) {
      this.warpT -= dt;
      if (this.warpT <= 0) this.emit({ type: "event", name: "WARP_END" });
    }
    if (this.frenzyT > 0) {
      this.frenzyT -= dt;
      if (this.frenzyT <= 0) this.emit({ type: "event", name: "FRENZY_END" });
    }
    if (this.gravT > 0) {
      this.gravT -= dt;
      if (this.gravT <= 0) this.emit({ type: "event", name: "GRAVITY_END" });
    }
    this.frenzySmooth = lerp(this.frenzySmooth, this.frenzyT > 0 ? CFG.FRENZY_MULT : 1, Math.min(1, dt * 4));
    if (!this.tutorial && this.state === State.ACTIVE && this.time >= this.nextEventT && this.aliveCount() >= 4 && this.ball.mode === "flying") {
      this.nextEventT = this.time + this.rng.range(30, 50);
      if (this.rng() < 0.62) {
        this.frenzyT = 6;
        this.emit({ type: "event", name: "FRENZY" });
      } else {
        this.gravT = 7;
        this.emit({ type: "event", name: "LOW GRAVITY" });
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
          this.orbs.push({ id: ++this._orbId, x, z, type: this.rng() < 0.4 ? "shield" : "haste", life: 14 });
          this.emit({ type: "orb", x, z });
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
      if (o.type === "shield") {
        if (p.shield) continue;
        p.shield = true;
      } else p.hasteT = 5;
      this.orbs.splice(i, 1);
      this.emit({ type: "pickup", id: p.id, kind: o.type, x: o.x, z: o.z });
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
        p.knockX *= k;
        p.knockZ *= k;
        continue;
      }
      p.parryCd = Math.max(0, p.parryCd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.jumpCd = Math.max(0, p.jumpCd - dt);
      if (p.abT > 0) {
        p.abT -= dt;
        if (p.abT <= 0) {
          p.abT = 0;
          p.abCd = ABILITY_COOLDOWN;
          if (p.up.bubble) p.shield = false;
          if (p.up.invis && p.invisT > 0) p.invisT = 1e-4;
        }
      } else if (p.abCd > 0) p.abCd = Math.max(0, p.abCd - dt);
      if (!p.onGround) p.airT += dt;
      if (p.hasteT > 0) p.hasteT -= dt;
      this._collectOrbs(p);
      if (p.invisT > 0) {
        p.invisT -= dt;
        if (p.invisT <= 0) this.emit({ type: "visible", id: p.id });
      }
      {
        let ground = 0;
        for (const pl of this.map.pillars) {
          if (p.y >= pl.h - 0.3 && Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r + 0.25) ground = Math.max(ground, pl.h);
        }
        p.ground = ground;
        if (p.y > ground + 1e-4 || p.vy > 0) {
          p.vy -= this.map.gravity * (this.gravT > 0 ? 0.45 : 1) * dt;
          p.y += p.vy * dt;
          if (p.y <= ground) {
            p.y = ground;
            p.vy = 0;
            p.onGround = true;
            p.airJumps = 0;
            p.airT = 0;
          } else p.onGround = false;
        } else {
          p.y = ground;
          p.vy = 0;
          p.onGround = true;
        }
      }
      if (p.parryActive > 0) {
        p.parryActive -= dt;
        p.parrySince += dt;
      }
      let vx = 0, vz = 0;
      if (p.dashT > 0) {
        p.dashT -= dt;
        vx = p.dashX * CFG.DASH_SPEED;
        vz = p.dashZ * CFG.DASH_SPEED;
      } else if (moving) {
        const sp = (p.isBot && p.bot ? p.bot.speedScale : 1) * CFG.MOVE_SPEED * (1 + 0.04 * p.up.speed) * (p.hasteT > 0 ? 1.45 : 1);
        vx = p.input.mx * sp;
        vz = p.input.mz * sp;
      }
      const a = Math.min(1, dt * this.map.accel);
      p.vx = lerp(p.vx, vx, a);
      p.vz = lerp(p.vz, vz, a);
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const sp2 = Math.hypot(p.vx, p.vz);
      let wantYaw = p.yaw;
      if (p.parryActive > 0) wantYaw = p.input.aimYaw;
      else if (sp2 > 1) wantYaw = dirToYaw(p.vx, p.vz);
      p.yaw += angleDiff(p.yaw, wantYaw) * Math.min(1, dt * 14);
    }
    const alive = this.players.filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = CFG.PLAYER_R * 2;
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          a.x -= dx / d * push;
          a.z -= dz / d * push;
          b.x += dx / d * push;
          b.z += dz / d * push;
        }
      }
    }
    for (const p of alive) {
      const r = Math.hypot(p.x, p.z);
      if (r > R) {
        p.x *= R / r;
        p.z *= R / r;
      }
      for (const pl of this.map.pillars) {
        if (p.y >= pl.h - 0.3) continue;
        const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz), min = pl.r + CFG.PLAYER_R;
        if (d < min) {
          const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
          p.x = pl.x + nx * min;
          p.z = pl.z + nz * min;
          const vn = p.vx * nx + p.vz * nz;
          if (vn < 0) {
            p.vx -= vn * nx;
            p.vz -= vn * nz;
          }
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
    let best = null, bestScore = -1e9;
    for (const c of alive) {
      if (c.id === sourceId && alive.length > 2) continue;
      if (c.invisT > 0 && alive.length > 1) continue;
      let sc = this._scoreTarget(c, x, z, 0, 0, sourceId);
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < 8) sc -= 2;
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    if (!best) best = alive[0];
    let sx = x, sz = z;
    if (sourceId === null || b.mode === "none" || b.mode === "charging") {
      if (!best.isBot) {
        const f = yawToDir(best.input.aimYaw);
        const tx = sx - best.x, tz = sz - best.z;
        const l2 = Math.hypot(tx, tz) || 1;
        const dot = tx / l2 * f.x + tz / l2 * f.z;
        if (dot < -0.1 || l2 < 9) {
          const ang = best.input.aimYaw + this.rng.range(-0.5, 0.5);
          const fd = yawToDir(ang);
          sx = best.x + fd.x * 20;
          sz = best.z + fd.z * 20;
          const r = Math.hypot(sx, sz), maxR = this.arenaR - 3;
          if (r > maxR) {
            sx *= maxR / r;
            sz *= maxR / r;
          }
        }
      }
    }
    b.mode = "charging";
    b.x = sx;
    b.z = sz;
    b.y = CFG.BALL_H;
    b.t = CFG.CHARGE_TIME;
    b.targetId = best.id;
    b.hanging = false;
    b.cands = null;
    b.armT = 0;
    const tdx = best.x - sx, tdz = best.z - sz;
    const l = Math.hypot(tdx, tdz) || 1;
    b.dx = tdx / l;
    b.dz = tdz / l;
    b.baseKmh = this.currentBaseKmh();
    b.speedKmh = b.baseKmh;
    this._noteTarget(best);
    this.emit({ type: "target", targetId: best.id, sourceId: null, charging: true, kmh: b.speedKmh, x: sx, z: sz });
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
    for (const p of this.players) if (p.alive) {
      if (p.team === 0) t0 = true;
      else t1 = true;
    }
    return !(t0 && t1);
  }
  _scoreTarget(c, rx, rz, dirx, dirz, sourceId) {
    const b = this.ball;
    const d = Math.hypot(c.x - rx, c.z - rz);
    let s = 1 - Math.min(1, Math.abs(d - 22) / 22);
    if (d < CFG.MIN_TARGET_DIST) s -= 1.4;
    s += this.rng() * 0.9;
    const ri = b.recent.indexOf(c.id);
    if (ri >= 0) s -= 1.1 - ri * 0.3;
    if (c.id === sourceId) s -= 2.2;
    if (dirx || dirz) {
      const l = d || 1;
      s += ((c.x - rx) / l * dirx + (c.z - rz) / l * dirz) * 0.3;
    }
    s += 0.3 * Math.min(1, (this.time - c.lastTargetedAt) / 12);
    return s;
  }
  _pingCount() {
    const h = this.ball.holders;
    let n = 0;
    for (let i = h.length - 1; i >= 2; i--) {
      if (h[i] === h[i - 2]) n++;
      else break;
    }
    return n;
  }
  _launch(target, dx, dz, { bonus = 1, announce = true } = {}) {
    const b = this.ball;
    const l = Math.hypot(dx, dz) || 1;
    b.dx = dx / l;
    b.dz = dz / l;
    b.mode = "flying";
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
      this.emit({ type: "target", targetId: target.id, sourceId: b.sourceId, charging: false, kmh: b.speedKmh, x: b.x, z: b.z });
    }
  }
  // Ball lost its target (disconnect, elimination...) -> pick a new valid one at once.
  // safety net: a ball that has not moved for a few seconds is sent on again (never a frozen match)
  _watchdog(dt) {
    if (this.tutorial) return;
    const b = this.ball;
    const key = b.mode + ":" + (b.targetId || "") + ":" + (+b.x).toFixed(1) + ":" + (+b.z).toFixed(1);
    if (key !== this._wdKey) {
      this._wdKey = key;
      this._wdT = 0;
      return;
    }
    this._wdT = (this._wdT || 0) + dt;
    if (b.mode === "none") {
      if (this._wdT > 6 && !this._isOver()) {
        this._wdT = 0;
        this._chargeAt(0, 0, null);
      }
    } else if (this._wdT > 3.5) {
      this._wdT = 0;
      b.hanging = false;
      this._retargetNow();
    }
  }
  _retargetNow() {
    const b = this.ball;
    const src = b.sourceId ? this.byId.get(b.sourceId) : null;
    const alive = src && this.teams ? this.targetPool(src) : this.targetPool(null);
    if (this._isOver() || alive.length < 1) return this._endRound();
    if (b.mode === "flying" && Number.isFinite(b.x) && Math.hypot(b.x, b.z) < this.arenaR + 40) {
      let best = null, bs = -1e9;
      for (const c of alive) {
        if (c.id === b.sourceId && alive.length > 2) continue;
        const sc = this._scoreTarget(c, b.x, b.z, b.dx, b.dz, b.sourceId);
        if (sc > bs) {
          bs = sc;
          best = c;
        }
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
    if (b.mode === "none") return;
    b.sinceEvent += dt;
    if (b.mode === "charging") {
      const t2 = this.byId.get(b.targetId);
      if (!t2 || !t2.alive) {
        this._chargeAt(b.x, b.z, b.sourceId);
        return;
      }
      b.t -= dt;
      if (b.t <= 0) {
        b.mode = "flying";
        this._launch(t2, t2.x - b.x, t2.z - b.z, { announce: false });
        this.emit({ type: "launch", targetId: t2.id, kmh: b.speedKmh });
      }
      return;
    }
    if (b.mode === "choosing") {
      b.t -= dt;
      const live = (b.cands || []).map((id) => this.byId.get(id)).filter((p) => p && p.alive);
      if (live.length === 0) {
        this._retargetNow();
        return;
      }
      if (b.t <= 0) {
        const pick2 = live[Math.floor(this.rng() * live.length)];
        this._launch(pick2, pick2.x - b.x, pick2.z - b.z);
      }
      return;
    }
    const t = this.byId.get(b.targetId);
    if (!t || !t.alive) {
      this._retargetNow();
      return;
    }
    if (!Number.isFinite(b.x) || !Number.isFinite(b.z) || Math.hypot(b.x, b.z) > this.arenaR + 60) {
      this._retargetNow();
      return;
    }
    b.armT = Math.max(0, b.armT - dt);
    b.turnT += dt;
    b.flightT += dt;
    if (b.sinceEvent > 20) b.baseKmh *= 1 + dt * 0.05;
    b.speedKmh = Math.min(CFG.SPEED_ABS_MAX, b.baseKmh * this.frenzySmooth * (1 + Math.min(CFG.FLIGHT_ACCEL_MAX, CFG.FLIGHT_ACCEL * b.flightT)));
    if (b.hanging) {
      b.contactT += dt;
      if (t.parryActive > 0) {
        this._resolveParry(t, "late");
        return;
      }
      if (b.contactT > CFG.GRACE + t.lagAllow) this._eliminate(t, b.sourceId);
      return;
    }
    const u = b.speedKmh * CFG.KMH_TO_U * (this.warpT > 0 ? 0.5 : 1) * (this._abOn(t, "slow") ? 0.6 : 1);
    const wantY = (t.ground || 0) + CFG.BALL_H, dy = wantY - b.y, step = CFG.BALL_CLIMB * dt;
    b.y += Math.abs(dy) <= step ? dy : Math.sign(dy) * step;
    const tx = t.x - b.x, tz = t.z - b.z;
    const tl = Math.hypot(tx, tz) || 1;
    const turn = lerp(2.2, 16, clamp(b.turnT / 0.7, 0, 1));
    let nx = b.dx + (tx / tl - b.dx) * Math.min(1, turn * dt);
    let nz = b.dz + (tz / tl - b.dz) * Math.min(1, turn * dt);
    if (u >= 100 && tl <= u / 16 * 1.5) {
      nx = tx / tl;
      nz = tz / tl;
    }
    const nl = Math.hypot(nx, nz) || 1;
    b.dx = nx / nl;
    b.dz = nz / nl;
    const ox = b.x, oz = b.z;
    b.x += b.dx * u * dt;
    b.z += b.dz * u * dt;
    for (const pl of this.map.pillars) {
      if (b.y > pl.h + 0.3) continue;
      const ex = b.x - pl.x, ez = b.z - pl.z, d = Math.hypot(ex, ez), min = pl.r + 0.45;
      if (d < min) {
        const nx2 = d > 1e-4 ? ex / d : 1, nz2 = d > 1e-4 ? ez / d : 0;
        b.x = pl.x + nx2 * min;
        b.z = pl.z + nz2 * min;
        const vn = b.dx * nx2 + b.dz * nz2;
        if (vn < 0) {
          b.dx -= vn * nx2;
          b.dz -= vn * nz2;
          const l = Math.hypot(b.dx, b.dz) || 1;
          b.dx /= l;
          b.dz /= l;
        }
        if (b.pillarEvT === void 0 || this.time - b.pillarEvT > 0.15) {
          b.pillarEvT = this.time;
          this.emit({ type: "pillar", x: b.x, z: b.z });
        }
      }
    }
    if (b.armT <= 0) {
      const d = segPointDist(ox, oz, b.x, b.z, t.x, t.z);
      if (d <= CFG.HIT_R && b.y >= t.y - 0.3 && b.y <= t.y + 2.1) {
        b.hanging = true;
        b.contactT = 0;
        this.emit({ type: "contact", targetId: t.id });
        if (t.parryActive > 0) {
          const q = t.parrySince <= CFG.PERFECT ? "perfect" : t.parrySince <= CFG.GOOD ? "good" : "early";
          this._resolveParry(t, q);
        }
      }
    }
  }
  // ---------------------------------------------------------------- parry
  _resolveParry(p, quality, free = false) {
    const b = this.ball;
    if (!free) {
      p.stats.parries++;
      if (quality === "perfect") p.stats.perfect++;
    }
    p.parryActive = 0;
    p.parryCd = Math.min(p.parryCd, 0.35);
    b.hanging = false;
    b.rally++;
    b.sourceId = p.id;
    b.holders.push(p.id);
    if (b.holders.length > 8) b.holders.shift();
    b.x = p.x;
    b.z = p.z;
    b.y = p.y + CFG.BALL_H;
    const alive = this.targetPool(p);
    if (alive.length === 0) return this._isOver() ? this._endRound() : this._chargeAt(b.x, b.z, null);
    const aimYaw = p.input.aimYaw;
    const f = yawToDir(aimYaw);
    const sourceCands = alive;
    let aimed = null, aimedPrecise = false;
    const wanted = p.botAimTarget ? this.byId.get(p.botAimTarget) : null;
    p.botAimTarget = null;
    if (wanted && wanted.alive && wanted.id !== p.id) {
      aimed = wanted;
    } else if (!p.isBot) {
      const cone = (quality === "perfect" ? CFG.AIM_CONE_PERFECT : CFG.AIM_CONE) + p.aimAssist + (this._abOn(p, "aim") ? 0.9 : 0);
      let bestS = 1e9, bestAng = 9;
      for (const c of sourceCands) {
        const ang = Math.abs(angleDiff(aimYaw, dirToYaw(c.x - p.x, c.z - p.z)));
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        const sc = ang + d * 4e-3;
        if (sc < bestS) {
          bestS = sc;
          aimed = c;
          bestAng = ang;
        }
      }
      if (aimed && bestAng > cone && sourceCands.length > 2) {
        if (bestAng > 2.2) aimed = null;
      }
      aimedPrecise = !!aimed && bestAng <= cone;
    }
    let pingBlock = false;
    if (aimed && alive.length > 1 && aimed.id === b.holders[b.holders.length - 2] && this._pingCount() >= CFG.PINGPONG_LIMIT) {
      aimed = null;
      pingBlock = true;
    }
    if (!aimed && !pingBlock && p.isBot) {
      let bestA = 0.5;
      for (const c of alive) {
        if (c.id === b.holders[b.holders.length - 2] && alive.length > 2) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < CFG.MIN_TARGET_DIST) continue;
        const ang = Math.abs(angleDiff(aimYaw, dirToYaw(c.x - p.x, c.z - p.z)));
        if (ang < bestA) {
          bestA = ang;
          aimed = c;
        }
      }
    }
    if (alive.length === 1) aimed = alive[0];
    const bonus = quality === "perfect" ? CFG.PERFECT_SPEED_BONUS : 1;
    let target, dx, dz, byAim = false;
    if (aimed) {
      target = aimed;
      byAim = true;
      const l = Math.hypot(aimed.x - p.x, aimed.z - p.z) || 1;
      dx = (aimed.x - p.x) / l * 0.85 + f.x * 0.15;
      dz = (aimed.z - p.z) / l * 0.85 + f.z * 0.15;
    } else {
      let best = null, bs = -1e9;
      const ranked = [];
      for (const c of alive) {
        const sc = this._scoreTarget(c, p.x, p.z, f.x, f.z, p.id);
        ranked.push([sc, c]);
        if (sc > bs) {
          bs = sc;
          best = c;
        }
      }
      target = best;
      dx = (best.x - p.x) * 0.5 / (Math.hypot(best.x - p.x, best.z - p.z) || 1) + f.x * 0.5;
      dz = (best.z - p.z) * 0.5 / (Math.hypot(best.x - p.x, best.z - p.z) || 1) + f.z * 0.5;
      ranked.sort((a, c) => c[0] - a[0]);
      if (!this.tutorial && alive.length >= 3 && b.rally >= 2 && ranked.length >= 2 && this.rng() < 0.1 && this.frenzyT <= 0) {
        b.mode = "choosing";
        b.t = 0.85;
        b.cands = [ranked[0][1].id, ranked[1][1].id];
        b.targetId = null;
        b.baseKmh = this.currentBaseKmh(bonus);
        this.emit({ type: "parry", id: p.id, quality, kmh: b.baseKmh, x: p.x, z: p.z, targetId: null, aimed: false });
        this.emit({ type: "doubleTarget", ids: b.cands.slice() });
        this.emit({ type: "event", name: "DOUBLE TARGET" });
        return;
      }
    }
    this._launch(target, dx, dz, { bonus, announce: false });
    b.armT = CFG.ARM_TIME;
    this._noteTarget(target);
    this.emit({ type: "parry", id: p.id, quality, kmh: b.speedKmh, x: p.x, z: p.z, targetId: target.id, aimed: byAim && (aimedPrecise || !!wanted) });
    this.emit({ type: "target", targetId: target.id, sourceId: p.id, charging: false, kmh: b.speedKmh, x: p.x, z: p.z });
  }
  // ---------------------------------------------------------------- elimination
  _eliminate(p, byId) {
    const b = this.ball;
    if (this.tutorial && !p.isBot) {
      this.emit({ type: "tutorialMiss", id: p.id });
      b.rally = 0;
      b.hanging = false;
      b.sourceId = null;
      b.holders = [];
      this._chargeAt(0, 0, null);
      return;
    }
    if (p.shield) {
      p.shield = false;
      this.emit({ type: "shieldBreak", id: p.id });
      this._resolveParry(p, "early", true);
      return;
    }
    if (this._abOn(p, "guard")) {
      p.abT = 0;
      p.abCd = ABILITY_COOLDOWN;
      p.guardUsed = true;
      this.emit({ type: "guard", id: p.id });
      this._resolveParry(p, "early", true);
      return;
    }
    const remainingBefore = this.aliveCount();
    p.alive = false;
    p.place = remainingBefore;
    p.diedAt = this.time;
    const kn = 11;
    p.knockX = b.dx * kn;
    p.knockZ = b.dz * kn;
    const killer = byId ? this.byId.get(byId) : null;
    if (killer && killer.id !== p.id) killer.stats.elims++;
    this.emit({
      type: "elim",
      id: p.id,
      by: killer ? killer.id : null,
      byName: killer ? killer.name : null,
      name: p.name,
      place: p.place,
      remaining: remainingBefore - 1,
      x: p.x,
      z: p.z
    });
    this._afterLoss(p, killer, false);
  }
  _afterLoss(p, killer, left) {
    const b = this.ball;
    const remaining = this.aliveCount();
    if (this._isOver()) {
      b.mode = "none";
      return this._endRound();
    }
    if (this.mode.finalAt && remaining <= this.mode.finalAt && this.state === State.ACTIVE) {
      this._setState(State.FINAL_PHASE);
      this.emit({ type: "event", name: "LAST " + this.mode.finalAt });
    }
    if (left) {
      if (b.mode === "flying" && b.targetId === p.id) this._retargetNow();
      else if (b.mode === "charging" && b.targetId === p.id) this._chargeAt(b.x, b.z, b.sourceId);
      else if (b.mode === "choosing") {
      }
      return;
    }
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
      winner = this.players.slice().sort((a, c) => c.diedAt - a.diedAt)[0] || null;
    }
    if (winner) winner.place = 1;
    this.winnerId = winner ? winner.id : null;
    if (this.teams && winner) {
      this.winnerTeam = winner.team;
      for (const q of this.players) q.place = q.team === winner.team ? 1 : 2;
    }
    this.ball.mode = "none";
    const ranked = this.players.slice().sort((a, c) => (a.place || 99) - (c.place || 99));
    this.results = {
      winnerId: this.winnerId,
      winnerTeam: this.winnerTeam,
      duration: this.time,
      placements: ranked.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        level: p.level,
        place: p.place || 1,
        parries: p.stats.parries,
        perfect: p.stats.perfect,
        elims: p.stats.elims,
        survived: p.alive ? this.time : p.diedAt
      }))
    };
    this._setState(State.ROUND_END);
    this.emit({ type: "end", winnerId: this.winnerId, winnerTeam: this.winnerTeam });
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
      frenzy: this.frenzyT > 0,
      grav: this.gravT > 0,
      warp: this.warpT > 0,
      orbs: this.orbs.map((o) => [o.id, +o.x.toFixed(2), +o.z.toFixed(2), o.type === "shield" ? 0 : 1, +o.life.toFixed(1)]),
      ball: {
        mode: b.mode,
        x: b.x,
        z: b.z,
        y: b.y,
        dx: b.dx,
        dz: b.dz,
        kmh: b.speedKmh,
        targetId: b.targetId,
        sourceId: b.sourceId,
        rally: b.rally,
        hanging: b.hanging,
        cands: b.cands,
        t: b.t
      },
      players: this.players.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        y: p.y,
        yaw: p.yaw,
        alive: p.alive,
        iv: p.invisT > 0 ? 1 : 0,
        at: +p.abT.toFixed(2),
        ac: +p.abCd.toFixed(2),
        gu: p.guardUsed ? 1 : 0,
        sh: p.shield ? 1 : 0,
        hs: p.hasteT > 0 ? 1 : 0,
        pa: p.parryActive > 0 ? 1 : 0,
        pc: p.parryCd,
        dash: p.dashT > 0 ? 1 : 0,
        dcd: p.dashCd
      }))
    };
  }
};

// server/ws.js
import crypto from "node:crypto";
var GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
var MAX_PAYLOAD = 64 * 1024;
function upgrade(req, socket, { onMessage: onMessage2, onClose: onClose2 }) {
  const key = req.headers["sec-websocket-key"];
  if (!key || String(req.headers.upgrade || "").toLowerCase() !== "websocket") {
    socket.destroy();
    return null;
  }
  const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r
Upgrade: websocket\r
Connection: Upgrade\r
Sec-WebSocket-Accept: ${accept}\r
\r
`);
  socket.setNoDelay(true);
  let buf = Buffer.alloc(0);
  let frag = null;
  let closed = false;
  const frame = (opcode, payload) => {
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([128 | opcode, len]);
    else if (len < 65536) {
      head = Buffer.alloc(4);
      head[0] = 128 | opcode;
      head[1] = 126;
      head.writeUInt16BE(len, 2);
    } else {
      head = Buffer.alloc(10);
      head[0] = 128 | opcode;
      head[1] = 127;
      head.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([head, payload]);
  };
  const conn = {
    send(str) {
      if (closed || socket.destroyed) return false;
      if (socket.writableLength > 512 * 1024) return false;
      socket.write(frame(1, Buffer.from(str)));
      return true;
    },
    close(code = 1e3) {
      if (closed) return;
      closed = true;
      try {
        const p = Buffer.alloc(2);
        p.writeUInt16BE(code, 0);
        socket.write(frame(8, p));
      } catch (e) {
      }
      socket.end();
    },
    get open() {
      return !closed && !socket.destroyed;
    }
  };
  const finish = () => {
    if (!closed) closed = true;
    onClose2 && onClose2();
  };
  socket.on("close", () => {
    closed = true;
    onClose2 && onClose2();
    onClose2 = null;
  });
  socket.on("error", () => {
    socket.destroy();
  });
  socket.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const b0 = buf[0], b1 = buf[1];
      const fin = !!(b0 & 128), opcode = b0 & 15, masked = !!(b1 & 128);
      let len = b1 & 127, off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      if (len > MAX_PAYLOAD || !masked) {
        conn.close(1009);
        socket.destroy();
        return;
      }
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (opcode === 8) {
        conn.close(1e3);
        finish();
        return;
      }
      if (opcode === 9) {
        socket.write(frame(10, payload));
        continue;
      }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 0) {
        if (opcode === 1) frag = { parts: [payload] };
        else if (frag) frag.parts.push(payload);
        if (fin && frag) {
          const text = Buffer.concat(frag.parts).toString("utf8");
          frag = null;
          try {
            onMessage2(text);
          } catch (e) {
          }
        }
      }
    }
  });
  return conn;
}

// server/index.js
var PORT = +(process.env.PORT || 8080);
var LOBBY_MS = +(process.env.LOBBY_MS || 8e3);
var SNAP_MS = 50;
var nextId = 1;
var clients = /* @__PURE__ */ new Set();
var lobbies = new Map(MODES.map((m) => [m.id, { mode: m, queue: [], timer: null, deadline: 0 }]));
var rooms = /* @__PURE__ */ new Set();
var clean = (s) => String(s || "Player").replace(/[^\w \-]/g, "").trim().slice(0, 12) || "Player";
var num2 = (v, lo, hi, d = 0) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
var send = (c, obj) => c.ws.send(JSON.stringify(obj));
function broadcastLobby(L) {
  const eta = Math.max(0, L.deadline - Date.now());
  for (const c of L.queue) send(c, { t: "lobby", players: L.queue.length, max: L.mode.total, eta, mode: L.mode.id });
}
function scheduleLobby(L) {
  if (L.timer || L.queue.length === 0) return;
  const ms = L.mode.total === 2 ? Math.min(LOBBY_MS, 4e3) : LOBBY_MS;
  L.deadline = Date.now() + ms;
  L.timer = setTimeout(() => startRoom(L), ms);
}
function startRoom(L) {
  clearTimeout(L.timer);
  L.timer = null;
  const total = L.mode.total;
  const players = L.queue.slice(0, total);
  L.queue = L.queue.slice(total);
  if (players.length === 0) return;
  launch(players, L.mode);
  if (L.queue.length) scheduleLobby(L);
}
var parties = /* @__PURE__ */ new Map();
var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  for (; ; ) {
    let s = "";
    for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!parties.has(s)) return s;
  }
}
function broadcastParty(P) {
  const members = P.members.map((m) => m.name);
  P.members.forEach((m, i) => send(m, { t: "party", code: P.code, members, host: i === 0, max: P.mode.total, mode: P.mode.id }));
}
function leaveParty(c) {
  const P = c.party;
  if (!P) return;
  c.party = null;
  P.members = P.members.filter((m) => m !== c);
  if (P.members.length === 0) parties.delete(P.code);
  else broadcastParty(P);
}
function launch(players, mode) {
  const L = { mode };
  const mapId = MAPS[Math.floor(Math.random() * MAPS.length)].id;
  const match = new Match({ map: mapId, mode: L.mode.id });
  const room = { match, clients: /* @__PURE__ */ new Map(), snapAcc: 0, last: Date.now(), over: false, done: false };
  for (const c of players) {
    const p = match.addParticipant({ id: c.pid, name: c.name, isBot: false, skin: c.skin, up: c.up });
    if (!p) continue;
    c.room = room;
    room.clients.set(c.pid, c);
  }
  match.fillBots();
  match.start();
  const roster = match.rosterInfo();
  for (const c of room.clients.values()) send(c, { t: "start", you: c.pid, roster, map: mapId, mode: L.mode.id });
  rooms.add(room);
}
function closeRoom(room) {
  room.done = true;
  rooms.delete(room);
  for (const c of room.clients.values()) c.room = null;
}
setInterval(() => {
  const now = Date.now();
  for (const room of rooms) {
    const dt = Math.min(0.1, (now - room.last) / 1e3);
    room.last = now;
    const m = room.match;
    m.update(dt);
    const ev = m.drainEvents();
    if (ev.length) for (const c of room.clients.values()) send(c, { t: "ev", e: ev });
    room.snapAcc += dt * 1e3;
    if (room.snapAcc >= SNAP_MS) {
      room.snapAcc = 0;
      const snap = m.snapshot();
      snap.t2 = "s";
      snap.stats = m.players.map((p) => [p.stats.parries, p.stats.perfect, p.stats.elims, +p.diedAt.toFixed(1), p.place]);
      const s = JSON.stringify({ t: "snap", s: snap, ts: now });
      for (const c of room.clients.values()) c.ws.send(s);
    }
    if (m.state === State.RESULTS && !room.over) {
      room.over = true;
      for (const c of room.clients.values()) send(c, { t: "end", results: m.results });
      setTimeout(() => closeRoom(room), 3e3);
    }
  }
}, 1e3 / 60);
setInterval(() => {
  for (const c of clients) if (c.ws.open) send(c, { t: "ping", s: Date.now() });
}, 2e3);
var server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: clients.size, queue: [...lobbies.values()].reduce((n, L) => n + L.queue.length, 0), rooms: rooms.size }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.on("upgrade", (req, socket) => {
  const c = { lobby: null, party: null, up: {}, pid: "p" + nextId++, name: "Player", room: null, rtt: 80, ws: null, lastParry: 0, parryTokens: 6, tokT: Date.now(), inT: 0 };
  c.ws = upgrade(req, socket, {
    onMessage: (txt) => onMessage(c, txt),
    onClose: () => onClose(c)
  });
  if (!c.ws) return;
  clients.add(c);
  send(c, { t: "welcome", id: c.pid, max: CFG.MAX_PLAYERS });
});
function onClose(c) {
  clients.delete(c);
  leaveParty(c);
  const L = c.lobby;
  c.lobby = null;
  if (L) L.queue = L.queue.filter((q) => q !== c);
  if (c.room) {
    const room = c.room;
    room.clients.delete(c.pid);
    room.match.removeParticipant(c.pid);
    if (room.clients.size === 0) closeRoom(room);
    c.room = null;
  }
  if (L) {
    if (L.queue.length === 0 && L.timer) {
      clearTimeout(L.timer);
      L.timer = null;
    } else broadcastLobby(L);
  }
}
function readLoadout(c, msg) {
  const sk = msg.skin || {};
  c.skin = { outfit: OUTFITS.some((o) => o.id === sk.outfit) ? sk.outfit : "tee", body: BODIES.some((b) => b.id === sk.body) ? sk.body : "default", head: HEADS.some((h) => h.id === sk.head) ? sk.head : "none", char: CHARACTERS.some((h) => h.id === sk.char) ? sk.char : "bot" };
  const up = msg.up && typeof msg.up === "object" ? msg.up : {};
  c.up = {};
  for (const k of Object.keys(CFG.UPGRADE_CAPS)) c.up[k] = Math.floor(num2(up[k], 0, CFG.UPGRADE_CAPS[k], 0));
  {
    let seen = false;
    for (const k of ABILITY_IDS) {
      if (c.up[k] > 0) {
        if (seen) c.up[k] = 0;
        else seen = true;
      }
    }
  }
}
function onMessage(c, txt) {
  if (txt.length > 2e3) return;
  let msg;
  try {
    msg = JSON.parse(txt);
  } catch (e) {
    return;
  }
  if (!msg || typeof msg !== "object") return;
  switch (msg.t) {
    case "join": {
      if (c.room || c.lobby || c.party) return;
      c.name = clean(msg.name);
      readLoadout(c, msg);
      const L = lobbies.get(MODE_BY_ID.has(msg.mode) ? msg.mode : "ffa");
      c.lobby = L;
      L.queue.push(c);
      if (L.queue.length >= L.mode.total) startRoom(L);
      else {
        scheduleLobby(L);
        broadcastLobby(L);
      }
      break;
    }
    case "create":
    case "joinCode": {
      if (c.room || c.lobby || c.party) return;
      c.name = clean(msg.name);
      readLoadout(c, msg);
      if (msg.t === "create") {
        const mode = MODE_BY_ID.get(msg.mode) || MODE_BY_ID.get("ffa");
        const P = { code: newCode(), mode, members: [c] };
        parties.set(P.code, P);
        c.party = P;
        broadcastParty(P);
      } else {
        const P = parties.get(String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
        if (!P) return send(c, { t: "partyErr", why: "Room not found - check the code." });
        if (P.members.length >= P.mode.total) return send(c, { t: "partyErr", why: "Room is full." });
        P.members.push(c);
        c.party = P;
        broadcastParty(P);
      }
      break;
    }
    case "startParty": {
      const P = c.party;
      if (!P || P.members[0] !== c) return;
      parties.delete(P.code);
      for (const m of P.members) m.party = null;
      launch(P.members, P.mode);
      break;
    }
    case "in": {
      if (!c.room) return;
      const now = Date.now();
      if (now - c.inT < 12) return;
      c.inT = now;
      c.room.match.setInput(c.pid, { mx: num2(msg.mx, -1, 1), mz: num2(msg.mz, -1, 1), aimYaw: num2(msg.aim, -1e3, 1e3, 0) });
      break;
    }
    case "parry":
    case "dash":
    case "jump":
    case "ability": {
      if (!c.room) return;
      const now = Date.now();
      c.parryTokens = Math.min(6, c.parryTokens + (now - c.tokT) / 150);
      c.tokT = now;
      if (c.parryTokens < 1) return;
      c.parryTokens -= 1;
      c.room.match.press(c.pid, msg.t, { lag: c.rtt / 2e3 });
      break;
    }
    case "pong": {
      const rtt = Date.now() - num2(msg.s, 0, Date.now(), Date.now());
      c.rtt = Math.min(1e3, Math.max(5, c.rtt * 0.6 + rtt * 0.4));
      break;
    }
    case "ping":
      send(c, { t: "pong2", c: msg.c });
      break;
    case "leaveParty":
      leaveParty(c);
      break;
    case "leave":
      onClose(c);
      break;
  }
}
if (!process.env.PARRY_NO_LISTEN) server.listen(PORT, () => console.log(`Parry Arena server on :${PORT} (lobby ${LOBBY_MS} ms)`));
export {
  server
};
