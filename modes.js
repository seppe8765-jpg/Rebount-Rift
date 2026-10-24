// Game modes: everybody plays for themselves (free for all). `total` = number of participants
// (real players first, the rest are filled with computer players). rScale shrinks the arena for small modes;
// finalAt = number of survivors that triggers the shrinking final phase (0 = never).
// (The simulation also supports team elimination via `teams: 2`, but no team mode is offered.)
export const MODES = [
  { id: 'ffa', name: '12 PLAYERS', blurb: 'Everyone for themselves: 12 players, last one standing wins.', total: 12, teams: 0, rScale: 1, finalAt: 3 },
  { id: 'six', name: '6 PLAYERS', blurb: 'Everyone for themselves with 6 players: faster and more intense.', total: 6, teams: 0, rScale: 0.82, finalAt: 0 },
  { id: 'duel', name: '1 VS 1', blurb: 'A pure duel in a small arena.', total: 2, teams: 0, rScale: 0.62, finalAt: 0, growth: 1.06, botMix: { easy: 0.03, normal: 0.2, hard: 0.35, elite: 0.27, master: 0.15 } },
];
export const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));
export const getMode = (id) => (typeof id === 'object' && id ? id : MODE_BY_ID.get(id) || MODES[0]);
