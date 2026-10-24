// Arenas ("levels"). Each map changes the rules a little (size, cover pillars, ice, gravity) and the whole look.
// The simulation only reads the numeric part (R, pillars, accel, gravity); `theme` is for the renderer.
const ring = (n, r, rad, off = 0, h = 3.4) => Array.from({ length: n }, (_, i) => {
  const a = off + (i / n) * Math.PI * 2;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, r: rad, h };
});

export const MAPS = [
  {
    id: 'neon', name: 'NEON GRID', blurb: 'The classic: wide open, pure skill.',
    R: 42, Rfinal: 30, accel: 14, gravity: 22, pillars: [],
    theme: {
      accent: [0.2, 0.75, 1.0], fog: [0.025, 0.03, 0.07], skyTop: [0.015, 0.02, 0.07], skyHor: [0.08, 0.05, 0.2],
      neb1: [0.25, 0.08, 0.4], neb2: [0.05, 0.2, 0.4], floor: [0.03, 0.04, 0.085], danger: [0.28, 0.02, 0.05],
      pattern: 0, gridCol: [0.025, 0.09, 0.15], ambient: 'motes', pillar: [0.07, 0.09, 0.2], crystal: 0,
    },
  },
  {
    id: 'ember', name: 'EMBER PIT', blurb: 'Lava stone with cover pillars. Use them to break the line.',
    R: 38, Rfinal: 27, accel: 14, gravity: 22,
    pillars: [...ring(6, 14, 2.2, 0, 3.4), ...ring(6, 24, 1.6, Math.PI / 6, 1.8)],
    theme: {
      accent: [1.0, 0.45, 0.12], fog: [0.07, 0.025, 0.02], skyTop: [0.05, 0.015, 0.015], skyHor: [0.3, 0.09, 0.03],
      neb1: [0.5, 0.12, 0.02], neb2: [0.35, 0.05, 0.1], floor: [0.06, 0.03, 0.03], danger: [0.5, 0.05, 0.0],
      pattern: 1, gridCol: [0.95, 0.32, 0.05], ambient: 'embers', pillar: [0.16, 0.07, 0.05], crystal: 2,
    },
  },
  {
    id: 'frost', name: 'FROST RING', blurb: 'Slippery ice: you keep sliding. Plan your moves early.',
    R: 46, Rfinal: 33, accel: 3.4, gravity: 22, pillars: [],
    theme: {
      accent: [0.55, 0.9, 1.0], fog: [0.05, 0.08, 0.13], skyTop: [0.03, 0.07, 0.15], skyHor: [0.25, 0.4, 0.6],
      neb1: [0.1, 0.3, 0.5], neb2: [0.3, 0.2, 0.55], floor: [0.04, 0.06, 0.11], danger: [0.1, 0.05, 0.3],
      pattern: 2, gridCol: [0.3, 0.5, 0.7], ambient: 'snow', pillar: [0.2, 0.3, 0.42], crystal: 0,
    },
  },
  {
    id: 'colosseum', name: 'COLOSSEUM', blurb: 'Ancient ring full of columns. Tight lanes, lots of cover.',
    R: 40, Rfinal: 29, accel: 14, gravity: 22,
    pillars: [...ring(8, 22, 1.8, 0, 3.4), ...ring(4, 9, 1.6, Math.PI / 4, 1.8)],
    theme: {
      accent: [1.0, 0.8, 0.35], fog: [0.07, 0.05, 0.08], skyTop: [0.05, 0.03, 0.1], skyHor: [0.35, 0.18, 0.25],
      neb1: [0.45, 0.2, 0.15], neb2: [0.3, 0.1, 0.4], floor: [0.08, 0.06, 0.07], danger: [0.35, 0.03, 0.1],
      pattern: 3, gridCol: [0.38, 0.27, 0.16], ambient: 'sparks', pillar: [0.2, 0.16, 0.14], crystal: 1,
    },
  },
  {
    id: 'storm', name: 'STORM CIRCUIT', blurb: 'Low gravity: jump high and dodge the ball in the air.',
    R: 44, Rfinal: 31, accel: 14, gravity: 12.5,
    pillars: ring(5, 17, 1.7, 0.3, 3.4),
    theme: {
      accent: [0.8, 0.55, 1.0], fog: [0.04, 0.025, 0.09], skyTop: [0.03, 0.01, 0.1], skyHor: [0.2, 0.08, 0.4],
      neb1: [0.5, 0.15, 0.7], neb2: [0.8, 0.7, 0.1], floor: [0.05, 0.035, 0.11], danger: [0.3, 0.02, 0.2],
      pattern: 4, gridCol: [0.34, 0.16, 0.7], ambient: 'sparks', pillar: [0.1, 0.07, 0.2], crystal: 1,
    },
  },
  {
    id: 'meadow', name: 'SUNNY MEADOW', blurb: 'Bright daylight lawn with a few cover pillars. Easy on the eyes, hard to win.',
    R: 42, Rfinal: 30, accel: 14, gravity: 22,
    pillars: ring(5, 16, 1.7, 0.2, 3.0),
    theme: {
      accent: [1.0, 0.85, 0.35], fog: [0.74, 0.86, 0.97], skyTop: [0.2, 0.46, 0.92], skyHor: [0.74, 0.86, 0.97],
      neb1: [0.5, 0.5, 0.5], neb2: [0.4, 0.45, 0.5], floor: [0.2, 0.5, 0.16], danger: [0.6, 0.12, 0.08],
      pattern: 5, gridCol: [0.07, 0.14, 0.04], ambient: 'motes', pillar: [0.72, 0.68, 0.6], crystal: 0, day: true,
    },
  },
  {
    id: 'dunes', name: 'TWILIGHT DUNES', blurb: 'Blue desert at dusk with sandstone spires and cacti.',
    R: 44, Rfinal: 31, accel: 14, gravity: 22,
    pillars: ring(6, 17, 1.9, 0.5, 3.2),
    theme: {
      accent: [0.5, 0.8, 1.0], fog: [0.18, 0.5, 0.92], skyTop: [0.04, 0.16, 0.7], skyHor: [0.2, 0.62, 1.0],
      neb1: [0.3, 0.4, 0.6], neb2: [0.3, 0.4, 0.6], floor: [0.07, 0.17, 0.5], danger: [0.6, 0.12, 0.2],
      pattern: 6, gridCol: [0.05, 0.1, 0.25], ambient: 'motes', pillar: [0.2, 0.3, 0.6], crystal: 0, day: true, scene: 'dunes', side: [0.08, 0.16, 0.45],
    },
  },
].map((m) => ({ ...m, spawnR: Math.round(m.R * 0.72) }));

export const MAP_BY_ID = new Map(MAPS.map((m) => [m.id, m]));
export const getMap = (id) => (typeof id === 'object' && id ? id : MAP_BY_ID.get(id) || MAPS[0]);

// a copy of a map with the arena scaled (small modes). Pillar positions scale with it, their size stays.
export function scaleMap(map, k) {
  if (!k || k === 1) return map;
  return {
    ...map, R: +(map.R * k).toFixed(2), Rfinal: +(map.Rfinal * k).toFixed(2), spawnR: +(map.spawnR * k).toFixed(2), scale: k,
    pillars: map.pillars.map((p) => ({ ...p, x: p.x * k, z: p.z * k })),
  };
}
