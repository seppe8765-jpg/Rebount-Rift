// Session: owns the current Match in local (offline / bots) mode and the lobby <-> match flow.
// The online variant (src/network/remoteSession.js) exposes the same surface, so the UI
// does not care whether the match runs locally or on an authoritative server.
import { Match, State } from './match.js';
import { CFG } from './config.js';
import { MAPS, getMap } from './maps.js';

// 'random' picks a map, but never the same one twice in a row
export function pickMap(choice, last = null) {
  if (choice && choice !== 'random') return getMap(choice).id;
  const pool = MAPS.filter((m) => m.id !== last);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export class Session {
  constructor({ seed } = {}) {
    this.seed = seed;
    this.match = null;
    this.localId = 'you';
    this.mode = 'local';
    this.round = 0;
  }

  // real players available right now: only the local one (no backend in the offline build)
  startLocalMatch({ name = 'YOU', aimAssist = 0, botLevelMix = null, skill = null, map = 'random', skin = null, mode = 'ffa', up = null } = {}) {
    this.round++;
    const mapId = pickMap(map, this.lastMap);
    this.lastMap = mapId;
    const m = new Match({ seed: this.seed ? this.seed + this.round : undefined, botLevelMix, skill, map: mapId, mode });
    m.addParticipant({ id: this.localId, name, isBot: false, aimAssist, skin, up });
    m.fillBots(); // never wait for 12 real players: fill the lobby with bots
    m.start();
    this.match = m;
    return m;
  }

  // Training round: you + 3 slow, forgiving bots; the player cannot be eliminated.
  startTutorial({ name = 'YOU', aimAssist = 0, skin = null, up = null } = {}) {
    const m = new Match({ seed: this.seed, tutorial: true, map: 'neon' });
    m.addParticipant({ id: this.localId, name, isBot: false, aimAssist, skin, up });
    for (let i = 1; i <= 3; i++) m.addParticipant({ id: 'bot' + i, name: 'BOT_0' + i, isBot: true, level: 'easy' });
    m.start();
    this.match = m;
    return m;
  }

  update(dt) {
    if (!this.match) return;
    this.match.update(dt);
  }

  endMatchToLobby() {
    if (this.match) this.match.returnToLobby();
    this.match = null;
  }

  get local() { return this.match ? this.match.byId.get(this.localId) : null; }
  get finished() { return !!this.match && this.match.state === State.RESULTS; }
  static get MAX() { return CFG.MAX_PLAYERS; }
}
