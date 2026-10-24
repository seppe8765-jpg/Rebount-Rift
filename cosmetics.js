// Purely cosmetic skins. Nothing here changes gameplay (hit boxes, speeds, timing are untouched).
// `price` = coins (earned by winning matches). price 0 = owned from the start. Colors are 0..1 RGB.
export const BALL_FX = [
  { id: 'plasma', name: 'Plasma', price: 0, glow: [0.25, 0.85, 1.0], core: [0.9, 1, 1] },
  { id: 'solar', name: 'Solar Flare', price: 150, glow: [1.0, 0.6, 0.15], core: [1, 0.95, 0.75] },
  { id: 'void', name: 'Void Orb', price: 300, glow: [0.65, 0.3, 1.0], core: [0.95, 0.85, 1] },
  { id: 'toxic', name: 'Toxic', price: 450, glow: [0.35, 1.0, 0.3], core: [0.9, 1, 0.8] },
  { id: 'rose', name: 'Rose Quartz', price: 650, glow: [1.0, 0.4, 0.75], core: [1, 0.9, 0.95] },
  { id: 'ice', name: 'Glacier', price: 200, glow: [0.6, 0.9, 1.0], core: [1, 1, 1] },
  { id: 'crimson', name: 'Crimson', price: 350, glow: [1.0, 0.15, 0.2], core: [1, 0.8, 0.8] },
  { id: 'gold', name: 'Midas', price: 800, glow: [1.0, 0.8, 0.25], core: [1, 1, 0.8] },
  { id: 'prism', name: 'Prism', price: 1200, glow: 'rainbow', core: [1, 1, 1] },
];

export const TRAILS = [
  { id: 'comet', name: 'Comet', price: 0, mode: 'comet' },
  { id: 'sparks', name: 'Sparks', price: 120, mode: 'sparks' },
  { id: 'dots', name: 'Pixel Dust', price: 250, mode: 'dots' },
  { id: 'stardust', name: 'Stardust', price: 450, mode: 'stardust' },
  { id: 'ribbon', name: 'Ribbon', price: 800, mode: 'ribbon' },
];

export const AURAS = [
  { id: 'none', name: 'Clean', price: 0, mode: 'none' },
  { id: 'halo', name: 'Halo', price: 100, mode: 'halo' },
  { id: 'pulse', name: 'Pulse', price: 250, mode: 'pulse' },
  { id: 'flame', name: 'Ember', price: 400, mode: 'flame' },
  { id: 'orbit', name: 'Orbit', price: 650, mode: 'orbit' },
  { id: 'storm', name: 'Storm', price: 1000, mode: 'storm' },
];

export const PARRY_FX = [
  { id: 'ring', name: 'Shockwave', price: 0, color: [0.5, 0.95, 1.0], mode: 'ring' },
  { id: 'gold', name: 'Golden', price: 120, color: [1.0, 0.85, 0.35], mode: 'ring' },
  { id: 'star', name: 'Starburst', price: 250, color: [1.0, 1.0, 1.0], mode: 'star' },
  { id: 'magenta', name: 'Neon Pink', price: 400, color: [1.0, 0.3, 0.8], mode: 'ring' },
  { id: 'violet', name: 'Ultraviolet', price: 300, color: [0.65, 0.35, 1.0], mode: 'ring' },
  { id: 'lime', name: 'Acid', price: 500, color: [0.7, 1.0, 0.2], mode: 'star' },
  { id: 'glitch', name: 'Glitch', price: 700, color: [0.3, 1.0, 0.6], mode: 'star' },
];

export const VICTORY_FX = [
  { id: 'confetti', name: 'Confetti', price: 0, mode: 'confetti' },
  { id: 'pillar', name: 'Light Pillar', price: 200, mode: 'pillar' },
  { id: 'fireworks', name: 'Fireworks', price: 450, mode: 'fireworks' },
  { id: 'rings', name: 'Crown Rings', price: 800, mode: 'rings' },
];

// Character looks. body.color = null keeps the slot colour. 'rainbow' cycles. (cosmetic only, shown to everybody online)
export const BODIES = [
  { id: 'default', name: 'Standard', price: 0, color: null },
  { id: 'crimson', name: 'Crimson', price: 150, color: [1.0, 0.25, 0.3] },
  { id: 'azure', name: 'Azure', price: 150, color: [0.25, 0.55, 1.0] },
  { id: 'mint', name: 'Mint', price: 200, color: [0.3, 1.0, 0.7] },
  { id: 'gold', name: 'Gold', price: 400, color: [1.0, 0.8, 0.25] },
  { id: 'violet', name: 'Violet', price: 400, color: [0.7, 0.35, 1.0] },
  { id: 'onyx', name: 'Onyx', price: 600, color: [0.55, 0.6, 0.75], dark: true },
  { id: 'chrome', name: 'Chrome', price: 700, color: [0.95, 0.97, 1.0] },
  { id: 'rainbow', name: 'Rainbow', price: 1500, color: 'rainbow' },
];

// Clothing worn over the body (cosmetic only). top/bot null = the player's own colour t-shirt + jeans.
export const OUTFITS = [
  { id: 'tee', name: 'T-shirt & jeans', price: 0 },
  { id: 'hoodie', name: 'Grey Hoodie', price: 150, top: [0.42, 0.44, 0.48], bot: [0.12, 0.13, 0.18], shoe: [0.9, 0.9, 0.88], long: true, hood: true, pocket: true },
  { id: 'track', name: 'Red Tracksuit', price: 200, top: [0.8, 0.1, 0.14], bot: [0.75, 0.09, 0.12], shoe: [0.95, 0.95, 0.95], long: true, stripe: true },
  { id: 'jacket', name: 'Leather Jacket', price: 300, top: [0.09, 0.08, 0.09], bot: [0.16, 0.2, 0.34], shoe: [0.08, 0.07, 0.07], long: true, collar: true },
  { id: 'suit', name: 'Black Suit', price: 400, top: [0.07, 0.07, 0.09], bot: [0.07, 0.07, 0.09], shoe: [0.05, 0.05, 0.05], long: true, tie: true },
  { id: 'camo', name: 'Camo', price: 350, top: [0.25, 0.34, 0.18], bot: [0.2, 0.28, 0.14], shoe: [0.16, 0.12, 0.08], long: true, pocket: true },
  { id: 'kimono', name: 'Samurai Robe', price: 500, top: [0.5, 0.08, 0.1], bot: [0.1, 0.1, 0.16], shoe: [0.2, 0.15, 0.1], long: true, sash: [0.95, 0.85, 0.5] },
  { id: 'hazmat', name: 'Hazmat Suit', price: 600, top: [0.95, 0.8, 0.1], bot: [0.95, 0.8, 0.1], shoe: [0.15, 0.15, 0.15], long: true, hood: true },
];
export const OUTFIT_BY_ID = new Map(OUTFITS.map((o) => [o.id, o]));

// Headgear drawn from simple shapes.
export const HEADS = [
  { id: 'none', name: 'Bare', price: 0, mode: 'none' },
  { id: 'antenna', name: 'Antenna', price: 100, mode: 'antenna' },
  { id: 'helmet', name: 'Helmet', price: 200, mode: 'helmet' },
  { id: 'horns', name: 'Horns', price: 350, mode: 'horns' },
  { id: 'halo', name: 'Halo', price: 450, mode: 'halo' },
  { id: 'wizard', name: 'Wizard Hat', price: 600, mode: 'wizard' },
  { id: 'crown', name: 'Crown', price: 1000, mode: 'crown' },
];

// Characters ('mannetjes'): different models, unlocked by the number of matches you have WON (not for sale).
export const CHARACTERS = [
  { id: 'rookie', name: 'Rookie', price: 0, wins: 0 },
  { id: 'ninja', name: 'Shadow Ninja', price: 0, wins: 1 },
  { id: 'sunny', name: 'Sunny', price: 0, wins: 1 },
  { id: 'luna', name: 'Luna', price: 0, wins: 2 },
  { id: 'disco', name: 'Disco Dan', price: 0, wins: 4 },
  { id: 'ember', name: 'Ember', price: 0, wins: 6 },
  { id: 'penguin', name: 'Penguin Pro', price: 0, wins: 8 },
  { id: 'blob', name: 'Blobby', price: 0, wins: 2 },
  { id: 'bot', name: 'Pilot', price: 0, wins: 3 },
  { id: 'tall', name: 'Android', price: 0, wins: 5 },
  { id: 'ghost', name: 'Phantom', price: 0, wins: 10 },
  { id: 'cube', name: 'Cubix', price: 0, wins: 18 },
  { id: 'knight', name: 'Knight', price: 0, wins: 30 },
  { id: 'alien', name: 'Visitor', price: 0, wins: 50 },
];

export const CATEGORIES = [
  { key: 'char', title: 'Character model (unlocked by wins)', items: CHARACTERS, byWins: true },
  { key: 'outfit', title: 'Clothing', items: OUTFITS },
  { key: 'body', title: 'Colour', items: BODIES },
  { key: 'head', title: 'Headgear', items: HEADS },
  { key: 'ball', title: 'Energy Ball', items: BALL_FX },
  { key: 'trail', title: 'Trail', items: TRAILS },
  { key: 'aura', title: 'Player Aura', items: AURAS },
  { key: 'parry', title: 'Parry Effect', items: PARRY_FX },
  { key: 'victory', title: 'Victory Effect', items: VICTORY_FX },
];

export const DEFAULT_LOADOUT = { char: 'rookie', outfit: 'tee', body: 'default', head: 'none', ball: 'plasma', trail: 'comet', aura: 'none', parry: 'ring', victory: 'confetti' };

export function findItem(cat, id) {
  const c = CATEGORIES.find((x) => x.key === cat);
  return (c && (c.items.find((i) => i.id === id) || c.items[0])) || null;
}

// 12 distinct player colours (also used for bots)
export const PLAYER_COLORS = [
  [0.25, 0.85, 1.0], [1.0, 0.45, 0.25], [0.55, 1.0, 0.4], [0.9, 0.35, 1.0],
  [1.0, 0.85, 0.25], [0.3, 0.55, 1.0], [1.0, 0.35, 0.55], [0.35, 1.0, 0.85],
  [0.85, 0.65, 1.0], [1.0, 0.65, 0.4], [0.7, 0.9, 0.3], [0.95, 0.95, 0.95],
];
export const rgbCss = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// deterministic random look for bots (does not consume the match RNG)
export function botSkin(n, salt = 0) {
  const h = (k) => { let x = Math.imul((n + 1) * 2654435761 ^ (salt + k * 97), 2246822519); x ^= x >>> 15; x = Math.imul(x, 3266489917); return (x ^ (x >>> 13)) >>> 0; };
  const body = BODIES[h(1) % BODIES.length], head = HEADS[h(2) % HEADS.length];
  return { char: CHARACTERS[h(5) % CHARACTERS.length].id, outfit: OUTFITS[h(6) % OUTFITS.length].id, body: h(3) % 10 < 4 ? 'default' : body.id, head: h(4) % 10 < 4 ? 'none' : head.id };
}
