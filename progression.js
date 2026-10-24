// XP / levels / cosmetic loadout. Persists to localStorage (wrapped: it can throw or be empty
// in private windows or sandboxed iframes) with an in-memory fallback.
import { DEFAULT_LOADOUT, CATEGORIES } from './cosmetics.js';
import { UPGRADES, UPGRADE_BY_ID, ABILITY_IDS } from './upgrades.js';
import { makeName } from './botNames.js';
import { DEFAULT_KEYS } from '../input/keys.js';

const KEY = 'parry-arena-save-v1';
const mem = { value: null };

function readRaw() {
  try { const v = window.localStorage.getItem(KEY); if (v) return v; } catch (e) { /* ignore */ }
  return mem.value;
}
function writeRaw(v) {
  mem.value = v;
  try { window.localStorage.setItem(KEY, v); } catch (e) { /* ignore */ }
}

// coins: winning is what pays. Runners-up get a small consolation so a streak of losses is not a dead end.
export const COINS_WIN = 100;
export function coinsFor({ won, place }) {
  if (won) return COINS_WIN;
  if (place === 2 || place === 3) return 15;
  return 5;
}

export const xpToNext = (level) => 100 + 30 * (level - 1) + 2 * (level - 1) * (level - 1);

export function levelFromXp(totalXp) {
  let level = 1, rem = totalXp;
  while (rem >= xpToNext(level) && level < 99) { rem -= xpToNext(level); level++; }
  return { level, into: rem, need: xpToNext(level) };
}

export function calcXp({ won, place, parries, perfect, elims, survived }) {
  const rows = [
    ['Participation', 25],
    ['Survival', Math.min(80, Math.floor(survived / 3))],
    ['Parries', Math.min(150, parries * 3)],
    ['Perfect parries', Math.min(120, perfect * 5)],
    ['Eliminations', elims * 12],
    ['Placement', Math.max(0, (13 - place) * 3)],
  ];
  if (won) rows.push(['Victory', 100]);
  return { rows, total: rows.reduce((a, r) => a + r[1], 0) };
}

export class Progress {
  constructor() {
    this.data = { xp: 0, coins: 500, owned: {}, upgrades: {}, loadout: { ...DEFAULT_LOADOUT }, settings: { map: 'random', mode: 'ffa', keys: { ...DEFAULT_KEYS }, volume: 0.7, music: false, musicV: 2, sens: 1, quality: 'high', name: 'YOU', tutorialDone: false, ability: 'none' }, stats: { matches: 0, wins: 0, parries: 0, perfect: 0, elims: 0 } };
    try {
      const raw = readRaw();
      if (raw) {
        const d = JSON.parse(raw);
        this.data.xp = +d.xp || 0;
        this.data.coins = Math.max(0, Math.floor(+d.coins || 0));
        if (d.owned && typeof d.owned === 'object') this.data.owned = d.owned;
        if (d.upgrades && typeof d.upgrades === 'object') this.data.upgrades = d.upgrades;
        Object.assign(this.data.loadout, d.loadout || {});
        Object.assign(this.data.settings, d.settings || {});
        this.data.settings.keys = { ...DEFAULT_KEYS, ...((d.settings && d.settings.keys) || {}) };
        Object.assign(this.data.stats, d.stats || {});
        if (Number.isFinite(d.skill)) this.data.skill = d.skill;
      }
    } catch (e) { /* corrupted -> defaults */ }
    this._sanitize();
  }
  _sanitize() {
    const s = this.data.settings;
    if (s.musicV !== 2) { s.music = false; s.musicV = 2; } // the old drone was too annoying: music is now opt-in
    s.name = String(s.name || '').replace(/[^\w .\-]/g, '').trim().slice(0, 12);
    if (!s.name || s.name === 'YOU') { s.name = makeName(Math.random); }
    if (!ABILITY_IDS.includes(this.data.settings.ability)) this.data.settings.ability = 'none';
    for (const k of UPGRADES) this.data.upgrades[k.id] = Math.max(0, Math.min(k.levels.length, Math.floor(+this.data.upgrades[k.id] || 0)));
    for (const c of CATEGORIES) {
      if (c.byWins) { if (!this.owns(c.key, this.data.loadout[c.key])) this.data.loadout[c.key] = c.items[0].id; continue; }
      const list = Array.isArray(this.data.owned[c.key]) ? this.data.owned[c.key].filter((id) => c.items.some((i) => i.id === id)) : [];
      for (const it of c.items) if (it.price === 0 && !list.includes(it.id)) list.push(it.id);
      this.data.owned[c.key] = list;
      if (!list.includes(this.data.loadout[c.key])) this.data.loadout[c.key] = c.items[0].id;
    }
  }
  save() { writeRaw(JSON.stringify(this.data)); }
  get level() { return levelFromXp(this.data.xp).level; }
  get info() { return levelFromXp(this.data.xp); }
  get settings() { return this.data.settings; }
  get loadout() { return this.data.loadout; }
  get coins() { return this.data.coins; }
  owns(cat, id) {
    const c = CATEGORIES.find((x) => x.key === cat);
    if (c && c.byWins) { const it = c.items.find((i) => i.id === id); return !!it && this.data.stats.wins >= it.wins; }
    return (this.data.owned[cat] || []).includes(id);
  }
  get stats() { return this.data.stats; }
  setName(v) { this.data.settings.name = String(v || '').replace(/[^\w .\-]/g, '').trim().slice(0, 12) || makeName(Math.random); this.save(); }
  // upgrades
  // what a match gets: the permanent stat upgrades plus ONLY the one equipped ability
  get up() {
    const o = { ...this.data.upgrades };
    const eq = this.data.settings.ability;
    for (const id of ABILITY_IDS) if (id !== eq) o[id] = 0;
    return o;
  }
  get ability() { const a = this.data.settings.ability; return ABILITY_IDS.includes(a) && (this.data.upgrades[a] || 0) > 0 ? a : 'none'; }
  ownsAbility(id) { return (this.data.upgrades[id] || 0) > 0; }
  equipAbility(id) {
    if (id !== 'none' && !(ABILITY_IDS.includes(id) && (this.data.upgrades[id] || 0) > 0)) return false;
    this.data.settings.ability = this.data.settings.ability === id ? 'none' : id; this.save(); return true;
  }
  upgradeCost(id) { const u = UPGRADE_BY_ID.get(id); const lv = this.data.upgrades[id] || 0; return u && lv < u.levels.length ? u.levels[lv] : null; }
  buyUpgrade(id) {
    const cost = this.upgradeCost(id);
    if (cost === null) return { ok: false, reason: 'max' };
    if (this.data.coins < cost) return { ok: false, reason: 'coins' };
    this.data.coins -= cost; this.data.upgrades[id] = (this.data.upgrades[id] || 0) + 1;
    if (ABILITY_IDS.includes(id) && this.ability === 'none') this.data.settings.ability = id; // first ability you buy is equipped
    this.save();
    return { ok: true };
  }
  equip(cat, id) {
    if (this.owns(cat, id)) { this.data.loadout[cat] = id; this.save(); return true; }
    return false;
  }
  // spend coins on a skin. Returns {ok, reason}
  buy(cat, id) {
    const c = CATEGORIES.find((x) => x.key === cat);
    const it = c && c.items.find((i) => i.id === id);
    if (!it) return { ok: false, reason: 'unknown' };
    if (this.owns(cat, id)) return { ok: false, reason: 'owned' };
    if (this.data.coins < it.price) return { ok: false, reason: 'coins' };
    this.data.coins -= it.price;
    this.data.owned[cat].push(id);
    this.data.loadout[cat] = id;
    this.save();
    return { ok: true };
  }
  // returns {total (xp), rows, levelBefore, levelAfter, coins, coinsTotal}
  // adaptive difficulty: a slow-moving 0..1 rating of how well you do (1 = win, 0 = out first), used to choose the bots
  get skill() { const v = this.data.skill; return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.3; }
  recordSkill(res) {
    const n = Math.max(2, res.total || 12);
    const s = res.won ? 1 : Math.max(0, 1 - ((res.place || n) - 1) / (n - 1)) * 0.85;
    this.data.skill = this.skill + (s - this.skill) * (res.won ? 0.34 : 0.22);
  }
  award(res) {
    const before = this.level;
    this.recordSkill(res);
    const x = calcXp(res);
    this.data.xp += x.total;
    const s = this.data.stats;
    s.matches++; if (res.won) s.wins++; s.parries += res.parries; s.perfect += res.perfect; s.elims += res.elims;
    const after = this.level;
    const coins = coinsFor(res);
    this.data.coins += coins;
    this.save();
    return { total: x.total, rows: x.rows, levelBefore: before, levelAfter: after, coins, coinsTotal: this.data.coins };
  }
}
