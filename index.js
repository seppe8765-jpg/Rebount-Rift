// Parry Arena authoritative game server.
//   node server/index.js            (PORT=8080, LOBBY_MS=8000)
//
// The server owns ALL game state (ball, targets, parry validation, eliminations, bots, winner).
// Clients only send inputs ("I move this way / I looked this way / I pressed parry").
// Open lobby slots are filled with bots - the match never waits for 12 real players.
import http from 'node:http';
import { Match, State } from '../src/game/match.js';
import { CFG } from '../src/game/config.js';
import { upgrade } from './ws.js';
import { MAPS } from '../src/game/maps.js';
import { BODIES, HEADS, CHARACTERS, OUTFITS } from '../src/game/cosmetics.js';
import { ABILITY_IDS } from '../src/game/upgrades.js';
import { MODES, MODE_BY_ID } from '../src/game/modes.js';

const PORT = +(process.env.PORT || 8080);
const LOBBY_MS = +(process.env.LOBBY_MS || 8000);
const SNAP_MS = 50;

let nextId = 1;
const clients = new Set();
// one lobby per game mode (1v1 / 6 players / 12 players): real players first, bots fill the rest after the timer
const lobbies = new Map(MODES.map((m) => [m.id, { mode: m, queue: [], timer: null, deadline: 0 }]));
const rooms = new Set();

const clean = (s) => String(s || 'Player').replace(/[^\w \-]/g, '').trim().slice(0, 12) || 'Player';
const num = (v, lo, hi, d = 0) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const send = (c, obj) => c.ws.send(JSON.stringify(obj));

function broadcastLobby(L) {
  const eta = Math.max(0, L.deadline - Date.now());
  for (const c of L.queue) send(c, { t: 'lobby', players: L.queue.length, max: L.mode.total, eta, mode: L.mode.id });
}

function scheduleLobby(L) {
  if (L.timer || L.queue.length === 0) return;
  // a duel only waits briefly: it is better to meet a computer opponent than to wait long
  const ms = L.mode.total === 2 ? Math.min(LOBBY_MS, 4000) : LOBBY_MS;
  L.deadline = Date.now() + ms;
  L.timer = setTimeout(() => startRoom(L), ms);
}

function startRoom(L) {
  clearTimeout(L.timer); L.timer = null;
  const total = L.mode.total;
  const players = L.queue.slice(0, total);
  L.queue = L.queue.slice(total);
  if (players.length === 0) return;
  launch(players, L.mode);
  if (L.queue.length) scheduleLobby(L);
}

// ------------------------------------------------------------------ private rooms ("play with friends": share a code / invite link)
const parties = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { for (;;) { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; if (!parties.has(s)) return s; } }
function broadcastParty(P) {
  const members = P.members.map((m) => m.name);
  P.members.forEach((m, i) => send(m, { t: 'party', code: P.code, members, host: i === 0, max: P.mode.total, mode: P.mode.id }));
}
function leaveParty(c) {
  const P = c.party; if (!P) return; c.party = null;
  P.members = P.members.filter((m) => m !== c);
  if (P.members.length === 0) parties.delete(P.code); else broadcastParty(P); // the next member becomes host
}

function launch(players, mode) {
  const L = { mode };
  const mapId = MAPS[Math.floor(Math.random() * MAPS.length)].id;
  const match = new Match({ map: mapId, mode: L.mode.id });
  const room = { match, clients: new Map(), snapAcc: 0, last: Date.now(), over: false, done: false };
  for (const c of players) {
    const p = match.addParticipant({ id: c.pid, name: c.name, isBot: false, skin: c.skin, up: c.up });
    if (!p) continue;
    c.room = room;
    room.clients.set(c.pid, c);
  }
  match.fillBots(); // real players first; the remaining slots get bots with realistic names
  match.start();
  const roster = match.rosterInfo();
  for (const c of room.clients.values()) send(c, { t: 'start', you: c.pid, roster, map: mapId, mode: L.mode.id });
  rooms.add(room);
}

function closeRoom(room) {
  room.done = true;
  rooms.delete(room);
  for (const c of room.clients.values()) c.room = null;
}

// ------------------------------------------------------------------ game loop
setInterval(() => {
  const now = Date.now();
  for (const room of rooms) {
    const dt = Math.min(0.1, (now - room.last) / 1000);
    room.last = now;
    const m = room.match;
    m.update(dt);
    const ev = m.drainEvents();
    if (ev.length) for (const c of room.clients.values()) send(c, { t: 'ev', e: ev });
    room.snapAcc += dt * 1000;
    if (room.snapAcc >= SNAP_MS) {
      room.snapAcc = 0;
      const snap = m.snapshot();
      snap.t2 = 's';
      snap.stats = m.players.map((p) => [p.stats.parries, p.stats.perfect, p.stats.elims, +p.diedAt.toFixed(1), p.place]);
      const s = JSON.stringify({ t: 'snap', s: snap, ts: now });
      for (const c of room.clients.values()) c.ws.send(s);
    }
    if (m.state === State.RESULTS && !room.over) {
      room.over = true;
      for (const c of room.clients.values()) send(c, { t: 'end', results: m.results });
      setTimeout(() => closeRoom(room), 3000);
    }
  }
}, 1000 / 60);

// keep RTT estimates for latency compensation
setInterval(() => { for (const c of clients) if (c.ws.open) send(c, { t: 'ping', s: Date.now() }); }, 2000);

// ------------------------------------------------------------------ connections
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: clients.size, queue: [...lobbies.values()].reduce((n, L) => n + L.queue.length, 0), rooms: rooms.size }));
  } else { res.writeHead(404); res.end(); }
});

server.on('upgrade', (req, socket) => {
  const c = { lobby: null, party: null, up: {}, pid: 'p' + nextId++, name: 'Player', room: null, rtt: 80, ws: null, lastParry: 0, parryTokens: 6, tokT: Date.now(), inT: 0 };
  c.ws = upgrade(req, socket, {
    onMessage: (txt) => onMessage(c, txt),
    onClose: () => onClose(c),
  });
  if (!c.ws) return;
  clients.add(c);
  send(c, { t: 'welcome', id: c.pid, max: CFG.MAX_PLAYERS });
});

function onClose(c) {
  clients.delete(c);
  leaveParty(c);
  const L = c.lobby; c.lobby = null;
  if (L) L.queue = L.queue.filter((q) => q !== c);
  if (c.room) {
    const room = c.room;
    room.clients.delete(c.pid);
    room.match.removeParticipant(c.pid); // a leaver never blocks the match
    if (room.clients.size === 0) closeRoom(room);
    c.room = null;
  }
  if (L) { if (L.queue.length === 0 && L.timer) { clearTimeout(L.timer); L.timer = null; } else broadcastLobby(L); }
}

function readLoadout(c, msg) {
  // cosmetic only: accept just known item ids
  const sk = msg.skin || {};
  c.skin = { outfit: OUTFITS.some((o) => o.id === sk.outfit) ? sk.outfit : 'tee', body: BODIES.some((b) => b.id === sk.body) ? sk.body : 'default', head: HEADS.some((h) => h.id === sk.head) ? sk.head : 'none', char: CHARACTERS.some((h) => h.id === sk.char) ? sk.char : 'bot' };
  // upgrades are client-declared (there is no account backend): clamped to the legal maximum, NOT cheat-proof
  const up = msg.up && typeof msg.up === 'object' ? msg.up : {};
  c.up = {}; for (const k of Object.keys(CFG.UPGRADE_CAPS)) c.up[k] = Math.floor(num(up[k], 0, CFG.UPGRADE_CAPS[k], 0));
  { let seen = false; for (const k of ABILITY_IDS) { if (c.up[k] > 0) { if (seen) c.up[k] = 0; else seen = true; } } } // one ability per match
}

function onMessage(c, txt) {
  if (txt.length > 2000) return;
  let msg; try { msg = JSON.parse(txt); } catch (e) { return; }
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'join': {
      if (c.room || c.lobby || c.party) return;
      c.name = clean(msg.name);
      readLoadout(c, msg);
      const L = lobbies.get(MODE_BY_ID.has(msg.mode) ? msg.mode : 'ffa');
      c.lobby = L; L.queue.push(c);
      if (L.queue.length >= L.mode.total) startRoom(L); else { scheduleLobby(L); broadcastLobby(L); }
      break;
    }
    case 'create': case 'joinCode': {
      if (c.room || c.lobby || c.party) return;
      c.name = clean(msg.name); readLoadout(c, msg);
      if (msg.t === 'create') {
        const mode = MODE_BY_ID.get(msg.mode) || MODE_BY_ID.get('ffa');
        const P = { code: newCode(), mode, members: [c] };
        parties.set(P.code, P); c.party = P; broadcastParty(P);
      } else {
        const P = parties.get(String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
        if (!P) return send(c, { t: 'partyErr', why: 'Room not found - check the code.' });
        if (P.members.length >= P.mode.total) return send(c, { t: 'partyErr', why: 'Room is full.' });
        P.members.push(c); c.party = P; broadcastParty(P);
      }
      break;
    }
    case 'startParty': {
      const P = c.party; if (!P || P.members[0] !== c) return; // only the host starts
      parties.delete(P.code); for (const m of P.members) m.party = null;
      launch(P.members, P.mode);
      break;
    }
    case 'in': {
      if (!c.room) return;
      const now = Date.now();
      if (now - c.inT < 12) return; // max ~80 input msgs/s
      c.inT = now;
      c.room.match.setInput(c.pid, { mx: num(msg.mx, -1, 1), mz: num(msg.mz, -1, 1), aimYaw: num(msg.aim, -1000, 1000, 0) });
      break;
    }
    case 'parry': case 'dash': case 'jump': case 'ability': {
      if (!c.room) return;
      // token bucket: spamming input messages does not buy extra parries (the match applies its own cooldown too)
      const now = Date.now();
      c.parryTokens = Math.min(6, c.parryTokens + (now - c.tokT) / 150); c.tokT = now;
      if (c.parryTokens < 1) return;
      c.parryTokens -= 1;
      c.room.match.press(c.pid, msg.t, { lag: c.rtt / 2000 });
      break;
    }
    case 'pong': {
      const rtt = Date.now() - num(msg.s, 0, Date.now(), Date.now());
      c.rtt = Math.min(1000, Math.max(5, c.rtt * 0.6 + rtt * 0.4));
      break;
    }
    case 'ping': send(c, { t: 'pong2', c: msg.c }); break;
    case 'leaveParty': leaveParty(c); break;
    case 'leave': onClose(c); break;
  }
}

// ESM entry: start unless imported by tests with PARRY_NO_LISTEN
if (!process.env.PARRY_NO_LISTEN) server.listen(PORT, () => console.log(`Parry Arena server on :${PORT} (lobby ${LOBBY_MS} ms)`));
export { server };
