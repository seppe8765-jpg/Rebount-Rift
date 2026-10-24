// Believable player names for computer-controlled opponents (so a lobby looks like a lobby).
const FIRST = ['Lucas', 'Emma', 'Noah', 'Sem', 'Mila', 'Daan', 'Lotte', 'Finn', 'Tess', 'Milan', 'Julia', 'Thijs', 'Fleur', 'Bram', 'Sanne', 'Jesse', 'Noor', 'Lars', 'Eva', 'Ruben', 'Anna', 'Tim', 'Luuk', 'Maud', 'Max', 'Zoe', 'Jelle', 'Iris', 'Niels', 'Liv', 'Mats', 'Kyra', 'Olivier', 'Sofie', 'Jonas', 'Elise', 'Arne', 'Hannah', 'Victor', 'Mathias', 'Ella', 'Leon', 'Nina', 'Oscar', 'Amber', 'Tom', 'Jade', 'Luca', 'Yara', 'Sam'];
const WORDS = ['Shadow', 'Nova', 'Blaze', 'Ghost', 'Pixel', 'Viper', 'Storm', 'Frost', 'Turbo', 'Raven', 'Zephyr', 'Comet', 'Rogue', 'Echo', 'Drift', 'Saber', 'Glitch', 'Hyper', 'Onyx', 'Wolf', 'Falcon', 'Cobra', 'Rocket', 'Ninja', 'Titan', 'Lynx', 'Orbit', 'Flux', 'Spark', 'Cipher', 'Phantom', 'Neon', 'Kraken', 'Blitz', 'Atlas', 'Pulse', 'Vortex', 'Jinx', 'Mango', 'Waffle', 'Pancake', 'Noodle', 'Potato', 'Panda', 'Cookie', 'Toast'];
const TAIL = ['', '', '', '_', 'x', 'XD', 'NL', 'BE', 'YT', 'pro', 'tv', 'gg'];
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const num = (rng) => { const r = rng(); return r < 0.3 ? '' : r < 0.55 ? String(Math.floor(rng() * 100)) : r < 0.8 ? String(2000 + Math.floor(rng() * 26)) : String(Math.floor(rng() * 1000)); };

export function makeName(rng) {
  const style = Math.floor(rng() * 7);
  let n;
  switch (style) {
    case 0: n = pick(rng, FIRST) + num(rng); break;
    case 1: n = pick(rng, FIRST) + '_' + pick(rng, TAIL).replace('_', '') + num(rng); break;
    case 2: n = pick(rng, WORDS) + pick(rng, WORDS); break;
    case 3: n = 'x' + pick(rng, WORDS) + num(rng); break;
    case 4: n = pick(rng, FIRST) + pick(rng, WORDS); break;
    case 5: n = pick(rng, WORDS).toLowerCase() + num(rng); break;
    default: n = pick(rng, FIRST) + pick(rng, ['Plays', 'Gaming', 'Official', 'GG', 'TV']); break;
  }
  n = n.replace(/_+$/, '').replace(/[^\w.\-]/g, '');
  return (n || pick(rng, FIRST)).slice(0, 12);
}

// unique names for one lobby
export function makeNames(rng, count, taken = []) {
  const used = new Set(taken.map((s) => String(s).toLowerCase()));
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 500) {
    const n = makeName(rng);
    if (used.has(n.toLowerCase())) continue;
    used.add(n.toLowerCase()); out.push(n);
  }
  while (out.length < count) out.push('Player' + (1000 + out.length));
  return out;
}
