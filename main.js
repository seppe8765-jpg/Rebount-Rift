// Rebound Rift - application shell: wires simulation, renderer, input, audio and UI together.
import { Match, State } from './game/match.js';
import { Session, pickMap } from './game/session.js';
import { CFG, speedIntensity } from './game/config.js';
import { Progress } from './game/progression.js';
import { PLAYER_COLORS } from './game/cosmetics.js';
import { Renderer } from './gfx/renderer.js';
import { Input } from './input/input.js';
import { AudioEngine } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { loadCrazySdk, cg } from './platform/crazy.js';
import { makeRng } from './utils/rng.js';
import { clamp, lerp, angleDiff, dirToYaw } from './utils/math.js';
import { OnlineClient } from './network/remote.js';
import { makeNames } from './game/botNames.js';
import { getMode } from './game/modes.js';
import { keyLabel } from './input/keys.js';
import { CHARACTERS } from './game/cosmetics.js';
import { UPGRADES, ABILITY_IDS, ABILITY_COOLDOWN, UPGRADE_BY_ID } from './game/upgrades.js';

// surface unexpected errors on screen (so a player can tell what went wrong instead of seeing a frozen game)
let errCount = 0;
function showError(msg) {
  if (errCount++ > 2) return;
  const b = document.getElementById('errbox');
  if (!b) return;
  b.textContent = 'Something went wrong: ' + String(msg).slice(0, 200) + '  (press F5 to reload)';
  b.classList.remove('hidden');
  setTimeout(() => b.classList.add('hidden'), 12000);
}
window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason && e.reason.message || e.reason));

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug'); // developer overlay: off by default in production
const SERVER_URL = params.get('server') || (typeof __RR_SERVER__ !== 'undefined' && __RR_SERVER__) || null; // optional ws://host:port of the authoritative server; offline vs bots otherwise

class App {
  constructor() {
    this.progress = new Progress();
    this.ui = new UI(this.progress);
    this.audio = new AudioEngine();
    this.localId = 'you';
    this.online = null;
    this.mode = 'boot'; // boot | menu | searching | play
    this.paused = false;
    this.session = new Session({});
    this.demo = null;
    this.shake = 0;
    this.slowT = 0;
    this.fovPunch = 0;
    this.camPos = { x: 0, y: 6, z: -10 };
    this.camFocus = { x: 0, z: 0 };
    this.last = 0;
    this.fpsAcc = 0; this.fpsN = 0; this.fpsText = '';
    this.spec = { on: false, idx: 0, id: null };
    this.award = null;
    this.tut = null;
    this.searchTimer = null;
    this.resultsTimer = null;
    this.menuT = 0;
  }

  // ------------------------------------------------------------------ boot
  async boot() {
    const ui = this.ui;
    ui.loading(0.1, 'Starting engine…');
    const canvas = document.getElementById('c');
    try {
      this.renderer = new Renderer(canvas, { quality: this.progress.settings.quality });
    } catch (e) {
      ui.loading(1, 'Sorry - the graphics engine could not start (' + String((e && e.message) || e).slice(0, 140) + '). Turn on hardware acceleration in your browser settings, update your browser, or try another browser.');
      throw e;
    }
    this.renderer.setCosmetics(this.progress.loadout);
    this.input = new Input(canvas, { sens: this.progress.settings.sens });
    ui.loading(0.5, 'Loading…');
    this._wireUi();
    this._applySettings();
    this.input.onAnyInput = () => this.audio.unlock();
    this.input.onPause = () => { if (this.mode === 'play' && !this.paused) this.pause(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'play') this.pause(); });
    window.addEventListener('blur', () => { if (this.mode === 'play' && !this.paused && this.input.isTouchPrimary) this.pause(); });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.renderer.resize(), 200));
    await loadCrazySdk();
    cg.loadingStart();
    cg.onMute((m) => { this._sdkMuted = m; this.audio.setMuted(m); });
    this._startDemo();
    ui.loading(1, 'Ready');
    await new Promise((r) => setTimeout(r, 150));
    ui.hideLoading();
    cg.loadingStop();
    this.toMenu();
    { const inv = cg.inviteParam(); if (inv && SERVER_URL) this.openFriends(String(inv)); } // opened through an invite link
    if (DEBUG) window.__game = this;
    requestAnimationFrame((t) => this._frame(t));
  }

  _wireUi() {
    const ui = this.ui;
    ui.h = {
      sfx: (n) => this.audio[n] && this.audio[n](),
      portrait: (cat, id) => this.portrait(cat, id),
      play: () => this.startSearch(),
      friends: () => this.openFriends(),
      partyCreate: () => this._partyConnect((c) => c.createRoom(this.progress.settings.name, this._skin(), this.progress.settings.mode, this.progress.up)),
      partyJoin: (code) => { code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 4) return this.ui.party(null, 'Enter the 4-character code.'); this._partyConnect((c) => c.joinRoom(code, this.progress.settings.name, this._skin(), this.progress.up)); },
      partyStart: () => this.online && this.online.startParty(),
      partyCopy: () => this._copyInvite(),
      partyBack: () => { cg.hideInvite(); this._closeOnline(); this.toMenu(); },
      train: () => this.startTraining(),
      cancelSearch: () => this.cancelSearch(),
      resume: () => this.resume(),
      leave: () => this.leaveToMenu(),
      playAgain: () => this.startSearch(),
      spec: (d) => this.cycleSpectate(d),
      startSpectate: () => this.startSpectate(),
      settings: () => this._applySettings(),
      capture: (fn) => { this.input.capture = fn; },
      loadout: () => this.renderer.setCosmetics(this.progress.loadout),
      resetProgress: () => { try { localStorage.removeItem('parry-arena-save-v1'); } catch (e) { /* ignore */ } location.reload(); },
    };
  }

  _applySettings() {
    const s = this.progress.settings;
    this.audio.setVolume(s.volume);
    this.audio.music = s.music;
    if (this.input) { this.input.sens = s.sens; this.input.map = { ...s.keys }; }
  }

  // ------------------------------------------------------------------ menu demo (bots playing in the background)
  // renders one player wearing `id` of category `cat` into a small picture (used by the shop preview)
  portrait(cat, id) {
    try {
      const r = this.renderer, lo = { ...this.progress.loadout, [cat]: id };
      const key = JSON.stringify(lo); this._pcache = this._pcache || new Map();
      if (this._pcache.has(key)) return this._pcache.get(key);
      if (!this._studio || this._studioMap !== this.demo.map.id) {
        const m = new Match({ map: this.demo.map.id }); m.addParticipant({ id: 'prev', name: '', isBot: false, skin: {} }); m.start(); this._studio = m; this._studioMap = this.demo.map.id;
      }
      const m = this._studio, p = m.byId.get('prev');
      p.skin = { char: lo.char, outfit: lo.outfit, body: lo.body, head: lo.head };
      p.x = 0; p.z = 0; p.y = 0; p.yaw = 0.35; p.vx = p.vz = 0; p.alive = true; p.parryActive = 0;
      m.ball.mode = cat === 'ball' ? 'flying' : 'none'; m.ball.x = 0.9; m.ball.z = 0.6; m.ball.y = 1.7; m.ball.speedKmh = 20; m.ball.targetId = null;
      const savedCosm = r.cosm, savedLocal = r.localId;
      r.setCosmetics(lo); r.localId = 'prev';
      r.render(m, { x: 0.4, y: 1.55, z: 5.2, tx: 0, ty: 1.3, tz: 0, fov: 0.56 }, 0.016, { viewerId: 'prev' });
      const gl = r.gl, W = r.w, H = r.h, sw = Math.floor(Math.min(W, H * 360 / 420)), sh = Math.floor(sw * 420 / 360);
      const x0 = Math.floor((W - sw) / 2), y0 = Math.floor((H - sh) / 2);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const px = new Uint8Array(sw * sh * 4);
      gl.readPixels(x0, y0, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const img = new ImageData(sw, sh);
      for (let y = 0; y < sh; y++) { const src = (sh - 1 - y) * sw * 4; img.data.set(px.subarray(src, src + sw * 4), y * sw * 4); }
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
      const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh; tmp.getContext('2d').putImageData(img, 0, 0);
      const c = document.createElement('canvas'); c.width = 360; c.height = 420;
      c.getContext('2d').drawImage(tmp, 0, 0, sw, sh, 0, 0, 360, 420);
      r.cosm = savedCosm; r.localId = savedLocal;
      const url = c.toDataURL('image/jpeg', 0.85);
      if (this._pcache.size > 80) this._pcache.clear();
      this._pcache.set(key, url);
      return url;
    } catch (e) { if (DEBUG) console.error('portrait', e); return null; }
  }

  _startDemo() {
    this.demo = new Match({ map: pickMap(Math.random() < 0.75 ? (Math.random() < 0.5 ? 'meadow' : 'dunes') : 'random', this.demoMap) });
    this.demoMap = this.demo.map.id;
    this.demo.fillBots();
    this.demo.start();
  }

  toMenu() {
    clearTimeout(this._hintT); this.ui.hint(null);
    this.mode = 'menu';
    this.paused = false;
    this.input.spectating = false;
    this.input.setEnabled(false);
    this.input.releaseLock();
    this.ui.showHud(false);
    this.ui.clearLabels();
    this.ui.tutorial(null);
    this.ui.spectate(null, false);
    this.ui.show('menu');
    this.renderer.localId = '__none__';
    this.renderer.victory = false;
    this.session.endMatchToLobby();
    this.spec.on = false;
    this.tut = null;
    document.getElementById('menuTip').textContent = this.input.isTouch ? 'Landscape recommended · tap PLAY' : 'Tip: move your mouse slowly - aim decides where the ball goes next.';
    this.audio.setDrone(true, 0.1);
    cg.gameplayStop();
  }

  leaveToMenu() {
    if (this.tut) { this.progress.settings.tutorialDone = true; this.progress.save(); }
    this._closeOnline();
    clearTimeout(this.resultsTimer);
    clearTimeout(this.searchTimer);
    this.toMenu();
  }

  // ------------------------------------------------------------------ matchmaking ("never wait for 12 real players")
  async startSearch() {
    // first time: the short training teaches the one mechanic everything else builds on
    if (!this.progress.settings.tutorialDone && !this._skipTraining) { this.audio.unlock(); return this.startTraining(); }
    if (this._matchesPlayed > 0) { this.audio.unlock(); await cg.midgameAd((m) => this.audio.setMuted(m || !!this._sdkMuted)); }
    if (SERVER_URL) return this.startOnline();
    return this.startLocalSearch();
  }

  async startOnline() {
    clearTimeout(this.resultsTimer);
    this.session.endMatchToLobby();
    this._closeOnline();
    this.mode = 'searching';
    this.input.setEnabled(false);
    this.ui.showHud(false);
    this.ui.spectate(null, false);
    this.award = null;
    this.ui.show('searching');
    this.ui.searching('Connecting...', 1, [{ name: this.progress.settings.name, you: true }], '');
    const client = new OnlineClient(SERVER_URL);
    this.online = client;
    const token = (this._searchToken = (this._searchToken || 0) + 1);
    try {
      await client.connect(3500);
    } catch (e) {
      if (token !== this._searchToken || this.mode !== 'searching') return;
      this._closeOnline();
      this.startLocalSearch('Server unreachable - playing offline against bots.');
      return;
    }
    if (token !== this._searchToken || this.mode !== 'searching') { client.close(); return; }
    client.h.lobby = (m) => {
      if (this.mode !== 'searching') return;
      const roster = [];
      for (let i = 0; i < m.players; i++) roster.push(i === 0 ? { name: this.progress.settings.name, you: true } : { name: 'Player ' + (i + 1) });
      this.ui.searching('Finding opponents...', m.players, roster, `Players: ${m.players}/${CFG.MAX_PLAYERS}` + (m.eta != null ? ` - match starts in ${Math.max(0, Math.ceil(m.eta / 1000))}s (open slots filled with bots)` : ''));
    };
    client.h.start = (rm) => {
      if (this.mode !== 'searching') return;
      this.ui.searching('MATCH STARTING', CFG.MAX_PLAYERS, [], '');
      this.searchTimer = setTimeout(() => this.beginMatch(false, rm), 400);
    };
    client.h.close = () => this._onOnlineClosed();
    client.join(this.progress.settings.name, this._skin(), this.progress.settings.mode, this.progress.up);
  }

  // ------------------------------------------------------------------ play with friends (private room with a code / invite link)
  openFriends(code) {
    this._closeOnline();
    this.mode = 'party';
    this.ui.show('party');
    this.ui.party(null, SERVER_URL ? '' : 'Online play needs the game server - not available in this build.');
    if (code && SERVER_URL) { document.getElementById('partyCode').value = code; this.ui.h.partyJoin(code); }
  }
  async _partyConnect(action) {
    if (!SERVER_URL) return this.ui.party(null, 'Online play needs the game server - not available in this build.');
    this.audio.unlock();
    this._closeOnline();
    const client = new OnlineClient(SERVER_URL);
    this.online = client;
    this.ui.party(null, 'Connecting...');
    try { await client.connect(3500); } catch (e) { this._closeOnline(); return this.ui.party(null, 'Server unreachable.'); }
    client.h.party = (m) => { this._partyCode = m.code; this.ui.party(m); cg.showInvite(m.code); };
    client.h.partyErr = (why) => { this.ui.party(null, why); };
    client.h.start = (rm) => { cg.hideInvite(); this.ui.searching('MATCH STARTING', CFG.MAX_PLAYERS, [], ''); this.ui.show('searching'); this.mode = 'searching'; this.searchTimer = setTimeout(() => this.beginMatch(false, rm), 400); };
    client.h.close = () => { if (this.online !== client) return; if (this.mode === 'party') { this.online = null; this.ui.party(null, 'Connection lost.'); } else this._onOnlineClosed(); };
    action(client);
  }
  _copyInvite() {
    const code = this._partyCode; if (!code) return;
    const u = new URL(location.href); u.searchParams.set('room', code);
    const link = cg.inviteLink(code) || u.toString();
    const done = () => { const n = document.getElementById('partyNote'); if (n) n.textContent = 'Invite link copied!'; };
    try { navigator.clipboard.writeText(link).then(done, () => { document.getElementById('partyNote').textContent = link; }); } catch (e) { document.getElementById('partyNote').textContent = link; }
  }

  _closeOnline() {
    if (this.online) { const c = this.online; this.online = null; c.h = {}; c.leave(); c.close(); }
  }

  _onOnlineClosed() {
    if (!this.online) return;
    this.online = null;
    if (this.mode === 'searching') { this.startLocalSearch('Connection lost - playing offline against bots.'); return; }
    if (this.mode === 'play' && this.match && this.match.remote) {
      this.match.events.push({ type: 'leave', name: 'Connection to server' });
      this.ui.msg('CONNECTION LOST', '#ff3b45');
      setTimeout(() => { if (this.mode === 'play' && this.match && this.match.remote) this.leaveToMenu(); }, 2500);
    }
  }

  startLocalSearch(note) {
    clearTimeout(this.resultsTimer);
    this.session.endMatchToLobby();
    this.mode = 'searching';
    this.input.setEnabled(false);
    this.ui.showHud(false);
    this.ui.spectate(null, false);
    this.award = null;
    const you = { name: this.progress.settings.name, you: true };
    const total = getMode(this.progress.settings.mode).total;
    this._botNames = makeNames(makeRng((Math.random() * 1e9) | 0), total, [you.name]);
    let roster = [you];
    const render = (txt, note) => this.ui.searching(txt, roster.length, roster, note, total);
    this.ui.show('searching');
    render('Finding opponents...', note || 'Real players are matched first - open slots are filled with bots, so you never wait.');
    let n = 0;
    const tick = () => {
      if (this.mode !== 'searching') return;
      n++;
      if (roster.length < total) {
        roster.push({ name: this._botNames[roster.length - 1] });
        render('Finding opponents...', `${roster[roster.length - 1].name} joined`);
        this.audio.hover();
        this.searchTimer = setTimeout(tick, 110);
      } else {
        render('MATCH STARTING', '');
        this.searchTimer = setTimeout(() => this.beginMatch(false), 650);
      }
    };
    this.searchTimer = setTimeout(tick, 500);
  }

  cancelSearch() { clearTimeout(this.searchTimer); this._closeOnline(); this.toMenu(); }

  startTraining() {
    this.audio.unlock();
    this.beginMatch(true);
  }

  beginMatch(tutorial, remoteMatch) {
    const name = this.progress.settings.name;
    const assist = this.input.isTouch ? 0.14 : 0;
    this.session.endMatchToLobby();
    const m = remoteMatch || (tutorial ? this.session.startTutorial({ name, aimAssist: assist, skin: this._skin(), up: this.progress.up }) : this.session.startLocalMatch({ name, aimAssist: assist, map: this.progress.settings.map, skin: this._skin(), mode: this.progress.settings.mode, up: this.progress.up, skill: this.progress.skill }));
    this.localId = remoteMatch ? remoteMatch.localId : this.session.localId;
    this.match = m;
    this.mode = 'play';
    this.paused = false;
    this.input.spectating = false;
    this.award = null;
    this.spec = { on: false, idx: 0, id: null };
    this.deathShown = false;
    this.slowT = 0; this.shake = 0; this.fovPunch = 0;
    this.renderer.localId = this.localId;
    this.renderer.victory = false;
    this.renderer.setCosmetics(this.progress.loadout);
    this.ui.hideAll();
    this.ui.showHud(true, this.input.isTouch);
    this.ui.setCrosshair(!this.input.isTouch);
    this.ui.startTxt('MATCH STARTING');
    this.ui.feed('', false);
    document.getElementById('feed').innerHTML = '';
    this.ui.clearLabels();
    this.input.setEnabled(true);
    this.input.yaw = remoteMatch ? this._remoteStartYaw(m) : m.byId.get(this.localId).yaw;
    this.input.pitch = 0.42;
    this.input.requestLock();
    this.tut = tutorial ? { step: 0, t: 0, parried: false } : null;
    this._showHint();
    if (tutorial) this.ui.tutorial('Wait until the projectile is close.', 'Watch the red target ring and the dotted line');
    else this.ui.tutorial(null);
    this.camPos = { x: 0, y: 8, z: -12 };
    this.audio.setDrone(true, 0.3);
    cg.gameplayStart();
  }

  _skin() { const l = this.progress.loadout; return { char: l.char, outfit: l.outfit, body: l.body, head: l.head }; }

  _showHint() { clearTimeout(this._hintT); this.ui.hint(null); } // the controls box at the bottom was removed on request

  // online: face the arena centre at the start (the first snapshot has not arrived yet)
  _remoteStartYaw(m) { const me = m.byId.get(m.localId); return me && (me.x || me.z) ? dirToYaw(-me.x, -me.z) : 0; }

  // ------------------------------------------------------------------ pause
  pause() {
    if (this.mode !== 'play' || this.paused) return;
    this.paused = true;
    this.input.setEnabled(false);
    this.input.releaseLock();
    this.ui.show('pause');
    this.audio.setDrone(false);
    this.audio.setBallState(0, 0, false, 0);
    cg.gameplayStop();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.hideAll();
    this.input.setEnabled(true);
    this.input.requestLock();
    this.audio.setDrone(true, 0.3);
    cg.gameplayStart();
  }

  // ------------------------------------------------------------------ spectator
  startSpectate() {
    this.ui.hideAll();
    this.spec.on = true;
    this.input.setEnabled(true); // camera control only (no local player to move)
    this.input.spectating = true;
    this.input.releaseLock(); // free cursor so Previous / Next can be clicked
    this.input.onSpectateKey = (d) => this.cycleSpectate(d);
    this.cycleSpectate(0);
    this.ui.showHud(true, false);
    this.ui.setCrosshair(false);
  }
  cycleSpectate(dir) {
    const m = this.match;
    if (!m) return;
    const alive = m.players.filter((p) => p.alive && p.id !== this.localId);
    if (alive.length === 0) { this.spec.id = null; this.ui.spectate('—', true); return; }
    let i = alive.findIndex((p) => p.id === this.spec.id);
    if (i < 0) i = 0; else i = (i + dir + alive.length) % alive.length;
    this.spec.id = alive[i].id;
    this.ui.spectate(alive[i].name, true);
  }

  // ------------------------------------------------------------------ main loop
  _frame(ts) {
    requestAnimationFrame((t) => this._frame(t));
    const dtReal = Math.min(0.05, Math.max(0.0005, (ts - (this.last || ts)) / 1000));
    this.last = ts;
    this.fpsAcc += dtReal; this.fpsN++;
    this.renderer.adapt(Math.min(0.2, (ts - (this._prevTs || ts)) / 1000)); this._prevTs = ts;
    if (this.fpsAcc > 0.5) { this.fpsText = Math.round(this.fpsN / this.fpsAcc) + ' fps'; this.fpsAcc = 0; this.fpsN = 0; }
    try {
      if (this.mode === 'play') this._framePlay(dtReal);
      else this._frameMenu(dtReal);
    } catch (e) {
      console.error(e);
      showError(e && e.message);
    }
  }

  _frameMenu(dt) {
    this.menuT += dt;
    const d = this.demo;
    d.update(dt);
    for (const e of d.drainEvents()) this.renderer.onEvent(e, d);
    if (d.state === State.RESULTS || d.state === State.RETURN_TO_LOBBY) this._startDemo();
    const a = this.menuT * 0.12;
    const R = 62;
    const cam = { x: Math.sin(a) * R, y: 32 + Math.sin(this.menuT * 0.2) * 4, z: Math.cos(a) * R, tx: 0, ty: 1, tz: 0, fov: 0.95 };
    this.renderer.render(d, cam, dt, { viewerId: '__none__' });
    this.audio.setBallState(0.1, speedIntensity(d.ball.speedKmh) * 0.5, false, 0);
    this.ui.fps(DEBUG ? this.fpsText : null);
  }

  _framePlay(dtReal) {
    const m = this.match, ui = this.ui, input = this.input, r = this.renderer;
    const localId = this.localId;
    const me = m.byId.get(localId);
    const spectating = this.spec.on || (!me.alive && this.deathShown);

    if (!this.paused) {
      // --- input
      const mv = input.update(dtReal);
      if (me.alive) {
        m.setInput(localId, { mx: mv.mx, mz: mv.mz, aimYaw: input.yaw });
        if (input.consumeParry() && m.press(localId, 'parry')) this.audio.whiff();
        if (input.consumeDash()) m.press(localId, 'dash');
        if (input.consumeJump()) m.press(localId, 'jump');
        if (input.consumeAbility()) m.press(localId, 'ability');
      } else { input.consumeParry(); input.consumeDash(); input.consumeJump(); input.consumeAbility(); }

      // --- slow motion on parry (hit-stop feel), purely a local time scale
      let scale = 1;
      if (this.slowT > 0 && !m.remote) { this.slowT -= dtReal; scale = 0.22; }
      m.update(dtReal * scale);
    }

    // --- events
    const events = m.drainEvents();
    for (const e of events) this._onEvent(e, m, me);

    // --- decay
    this.shake = Math.max(0, this.shake - dtReal * 2.2);
    this.fovPunch = lerp(this.fovPunch, 0, Math.min(1, dtReal * 5));

    // --- viewer (who the camera follows)
    let viewer = me;
    if (spectating) viewer = (this.spec.id && m.byId.get(this.spec.id) && m.byId.get(this.spec.id).alive) ? m.byId.get(this.spec.id) : null;
    if (spectating && !viewer) { this.cycleSpectate(0); viewer = this.spec.id ? m.byId.get(this.spec.id) : null; }
    if (!viewer) viewer = me;
    if (spectating && viewer && viewer.alive === false) this.cycleSpectate(1);

    // --- camera
    const b = m.ball;
    const si = speedIntensity(b.speedKmh || 35);
    const follow = viewer;
    this.camFocus.x = lerp(this.camFocus.x, follow.x, Math.min(1, dtReal * 10));
    this.camFocus.z = lerp(this.camFocus.z, follow.z, Math.min(1, dtReal * 10));
    const dist = (this.camDist || (input.isTouch ? 10.5 : 9.2)) + si * 1.2;
    const pitch = input.pitch;
    const fy = Math.sin(input.yaw), fz = Math.cos(input.yaw);
    this.camY = lerp(this.camY || 0, (follow.y || 0) * 0.6, Math.min(1, dtReal * 8));
    const ty = 1.5 + this.camY;
    const cam = {
      x: this.camFocus.x - fy * dist * Math.cos(pitch),
      y: ty + dist * Math.sin(pitch),
      z: this.camFocus.z - fz * dist * Math.cos(pitch),
      tx: this.camFocus.x + fy * 2.5, ty: ty, tz: this.camFocus.z + fz * 2.5,
      fov: 1.05 - this.fovPunch * 0.5 + si * 0.08,
    };
    r.victory = m.state === State.ROUND_END || m.state === State.RESULTS;
    r.render(m, cam, dtReal, { shake: this.shake * 0.35, viewerId: viewer.id });
    if (r.victory && m.winnerId === localId) r.victoryTick(m, dtReal);

    // --- HUD
    this._hud(m, me, viewer, si);
    if (this.tut) this._tutorialTick(m, me, dtReal);
  }

  _abilityHud(me) {
    const up = me.up || {}, K = this.progress.settings.keys, items = [];
    const cd = (c) => (c > 0 ? 'cd' : 'rdy');
    const kl = (a) => keyLabel(K[a]);
    const fr = (v, max) => (v > 0 ? Math.min(1, v / max) : 0);
    const id = ABILITY_IDS.find((k) => up[k] > 0);
    if (id) {
      const def = UPGRADE_BY_ID.get(id);
      const on = me.abT > 0;
      items.push({ id: 'ability', icon: def.icon, label: def.name.toUpperCase(), key: kl('ability'), state: on ? 'act' : cd(me.abCd), text: on ? Math.ceil(me.abT) + 's' : me.abCd > 0 ? Math.ceil(me.abCd) + 's' : 'READY', frac: on ? me.abT / def.dur : fr(me.abCd, ABILITY_COOLDOWN) });
    }
    if (me.shield) items.push({ id: 'shield', icon: '🛡', label: 'SHIELD', state: 'act', text: 'ON' });
    if (me.hasteT > 0) items.push({ id: 'haste', icon: '⚡', label: 'HASTE', state: 'act', text: Math.ceil(me.hasteT) + 's' });
    this.ui.setAbilities(items);
  }

  _hud(m, me, viewer, si) {
    const ui = this.ui, r = this.renderer, b = m.ball;
    const alive = m.aliveCount();
    if (this.input.freeLook && !this._freeLookHinted) { this._freeLookHinted = true; ui.hint('Mouse lock is blocked here: move the cursor toward the screen edges to turn the camera (or use the arrow keys)'); clearTimeout(this._hintT); this._hintT = setTimeout(() => ui.fadeHint(), 9000); }
    ui.setAlive(alive);
    this._abilityHud(me);
    ui.setSpeed(b.mode === 'none' ? 0 : b.speedKmh, si);
    const target = b.targetId ? m.byId.get(b.targetId) : null;
    const meTargeted = !!(target && target === viewer && b.mode !== 'none');
    if (b.mode === 'choosing' && b.cands) ui.setTarget('DOUBLE TARGET: ' + b.cands.map((id) => (id === viewer.id ? 'YOU' : m.byId.get(id).name)).join(' / '), b.cands.includes(viewer.id));
    else if (target && b.mode !== 'none') ui.setTarget(meTargeted ? (viewer === m.byId.get(this.localId) ? 'TARGETED → YOU' : 'TARGET: ' + viewer.name) : 'TARGET: ' + target.name, meTargeted);
    else ui.setTarget('TARGET: —', false);

    // threat vignette + incoming arrow
    let threat = 0;
    if (meTargeted && viewer.alive) {
      const d = Math.hypot(b.x - viewer.x, b.z - viewer.z);
      threat = clamp(1 - d / 32, 0, 1) * (0.45 + si * 0.55) + 0.12;
      if (b.mode === 'flying') {
        const pj = r.project(b.x, CFG.BALL_H, b.z);
        const cx = r.cssW / 2, cy = r.cssH / 2;
        const off = !pj.visible || pj.x < 20 || pj.x > r.cssW - 20 || pj.y < 20 || pj.y > r.cssH - 20;
        if (off) {
          let dx = pj.x - cx, dy = pj.y - cy;
          if (!pj.visible) { dx = -dx; dy = -dy; }
          ui.setArrow(Math.atan2(dx, -dy), Math.min(r.cssW, r.cssH) * 0.33);
        } else ui.setArrow(null);
      } else ui.setArrow(null);
    } else ui.setArrow(null);
    ui.setThreat(threat);
    this.audio.setBallState(
      b.mode === 'none' ? 0 : clamp(1 - Math.hypot(b.x - viewer.x, b.z - viewer.z) / 34, 0, 1),
      si, meTargeted && b.mode === 'flying' && viewer.alive, 1 / 60);
    this.audio.setDrone(true, 0.2 + si * 0.8);

    // cooldown ring + aim lock
    ui.setCooldown(me.alive ? clamp(me.parryCd / CFG.PARRY_CD, 0, 1) : 0);
    const aimId = me.alive && m.state !== State.COUNTDOWN ? this._aimCandidate(m, me) : null;
    ui.setAimLock(!!aimId);

    // nameplates
    const items = [];
    for (const p of m.players) {
      const pr = r.project(p.x, 2.55 + (p.y || 0), p.z);
      items.push({
        id: p.id, name: p.id === this.localId ? this.progress.settings.name : p.name, x: pr.x, y: pr.y, visible: pr.visible && pr.w < 70,
        me: p.id === this.localId, target: p === target && b.mode !== 'none', aim: p.id === aimId, dead: !p.alive, color: PLAYER_COLORS[p.color % 12],
      });
    }
    ui.setLabels(items);

    if (DEBUG) {
      const d = viewer ? Math.hypot(b.x - viewer.x, b.z - viewer.z).toFixed(1) : '-';
      const win = viewer ? viewer.parryActive.toFixed(2) : '-';
      ui.debug([
        `state     ${m.state}`, `time      ${m.time.toFixed(1)}s`, `alive     ${alive}`,
        `ball      ${b.mode}  ${Math.round(b.speedKmh)} km/h  rally ${b.rally}`,
        `target    ${target ? target.name + ' (' + (target.level || 'human') + ')' : '-'}`,
        `dist→you  ${d}`, `parry win ${win}  cd ${viewer ? viewer.parryCd.toFixed(2) : '-'}`,
        `bots      ${m.players.filter((p) => p.isBot).map((p) => (p.alive ? p.level[0] : '·')).join('')}`,
      ].join('\n'));
      ui.fps(this.fpsText);
    }
  }

  // which player the parry would currently be aimed at (same cone logic as the server)
  _aimCandidate(m, me) {
    const cone = CFG.AIM_CONE + me.aimAssist;
    let best = null, bs = 1e9;
    for (const c of m.players) {
      if (!c.alive || c === me) continue;
      const ang = Math.abs(angleDiff(this.input.yaw, dirToYaw(c.x - me.x, c.z - me.z)));
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      const sc = ang + d * 0.004;
      if (ang <= cone && sc < bs) { bs = sc; best = c; }
    }
    return best ? best.id : null;
  }

  // ------------------------------------------------------------------ events -> feedback
  _onEvent(e, m, me) {
    const ui = this.ui, a = this.audio, r = this.renderer;
    const localId = me.id;
    const vp = me; // listener position
    const near = (x, z) => clamp(1.15 - Math.hypot(x - vp.x, z - vp.z) / 45, 0.15, 1);
    r.onEvent(e, m);
    switch (e.type) {
      case 'countdown': ui.countdown(String(e.n)); a.countdown(e.n); break;
      case 'go': ui.countdown('GO!'); a.countdown(0); ui.startTxt(''); this.flashSoft(); break;
      case 'target':
        if (e.charging) { if (e.targetId === localId) a.targetAcquired(true); }
        else if (e.targetId === localId && e.sourceId !== null) a.targetAcquired(true);
        break;
      case 'launch': a.launch(e.kmh); break;
      case 'parry': {
        const mine = e.id === localId;
        a.parry(e.quality, mine ? 1 : near(e.x, e.z) * 0.7, 0);
        if (mine) {
          const txt = e.quality === 'perfect' ? 'PERFECT!' : e.quality === 'late' ? 'LATE PARRY' : e.quality === 'early' ? 'EARLY PARRY' : 'PARRY!';
          ui.msg(txt, e.quality === 'perfect' ? '#ffd36a' : e.quality === 'good' ? '#7df3ff' : '#ffffff');
          this.shake = Math.max(this.shake, e.quality === 'perfect' ? 1.4 : 0.8);
          if (!m.remote) this.slowT = e.quality === 'perfect' ? 0.1 : 0.055;
          this.fovPunch = e.quality === 'perfect' ? 0.18 : 0.08;
          ui.flash(e.quality === 'perfect' ? '#fff3c4' : '#bff6ff', e.quality === 'perfect' ? 0.35 : 0.15);
        } else if (near(e.x, e.z) > 0.8) this.shake = Math.max(this.shake, 0.15);
        break;
      }
      case 'orb': ui.feed('A power-up appeared!', false); break;
      case 'pickup': if (e.id === localId) { ui.msg(e.kind === 'shield' ? 'SHIELD!' : 'HASTE!', e.kind === 'shield' ? '#5ae6ff' : '#ffc04a'); a.event(); } break;
      case 'shieldBreak': if (e.id === localId) { ui.msg('SHIELD SAVED YOU!', '#5ae6ff'); ui.flash('#5ae6ff', 0.4); } break;
      case 'invis': if (e.id === localId) { ui.msg('INVISIBLE', '#b77cff'); a.event(); } break;
      case 'visible': if (e.id === localId) ui.msg('VISIBLE AGAIN', '#b77cff'); break;
      case 'ability': if (e.id === localId) { const d = UPGRADE_BY_ID.get(e.ability); ui.msg((d ? d.name : 'ABILITY').toUpperCase(), '#7dffb0'); a.event(); } break;
      case 'warp': ui.banner('TIME WARP', '#7de0ff'); a.event(); break;
      case 'guard': if (e.id === localId) { ui.msg('GUARDIAN SAVED YOU!', '#ffd36a'); ui.flash('#ffd36a', 0.4); } break;
      case 'dash': if (e.id === localId) a.dash(); break;
      case 'jump': if (e.id === localId) a.jump(); break;
      case 'elim': {
        const mine = e.id === localId;
        const nm = (id, fallback) => (id === localId ? this.progress.settings.name : fallback);
        const killer = e.by ? nm(e.by, e.byName) : null;
        ui.feed(killer ? `${killer} eliminated ${nm(e.id, e.name)}` : `${nm(e.id, e.name)} eliminated`, mine || e.by === localId);
        a.elim(mine, near(e.x, e.z));
        this.shake = Math.max(this.shake, mine ? 2 : near(e.x, e.z) * 0.6);
        if (e.remaining > 1) ui.banner(`${e.remaining} PLAYERS REMAIN`, '#ffffff');
        if (mine) {
          ui.msg('ELIMINATED', '#ff3b45'); ui.flash('#ff2030', 0.5); a.defeat();
          if (!this.tut) this._finishLocal(false, e.place);
        }
        break;
      }
      case 'leave': ui.feed(`${e.name} left`, false); break;
      case 'event':
        if (e.name === 'FRENZY_END' || e.name === 'GRAVITY_END') break;
        ui.banner(e.name, e.name === 'LAST 3' ? '#ff5a6a' : '#ffb02e'); a.event(); break;
      case 'tutorialMiss': this._tutMiss(); break;
      case 'end':
        if (this.tut) break;
        if (e.winnerId === localId) {
          a.victory(); ui.msg('VICTORY!', '#ffd36a'); ui.flash('#fff3c4', 0.4); cg.happytime();
          this._finishLocal(true, 1);
        } else if (!this.award) this._finishLocal(false, me.place || 2);
        break;
      case 'state':
        if (e.state === State.RESULTS && !this.tut) this._onMatchResults(m, me);
        break;
    }
  }

  flashSoft() { this.ui.flash('#9ff', 0.18); }

  // ------------------------------------------------------------------ results & XP
  _finishLocal(won, place) {
    if (this.award) return;
    const m = this.match, me = m.byId.get(this.localId);
    const survived = won ? m.time : me.diedAt || m.time;
    const res = { won, place, total: m.players.length, parries: me.stats.parries, perfect: me.stats.perfect, elims: me.stats.elims, survived };
    const before = this.progress.info.level;
    const xp = this.progress.award(res);
    this.award = { res, xp, levelInfo: { ...this.progress.info, leveled: xp.levelAfter > before } };
    this.deathShown = false;
    clearTimeout(this.resultsTimer);
    this.resultsTimer = setTimeout(() => {
      if (this.mode !== 'play' || this.match !== m) return;
      if (won) return; // the victory screen is opened when the match reaches RESULTS
      this.deathShown = true;
      this.showResults(true);
    }, 1500);
  }

  showResults(canSpectate, note) {
    if (!this.award) return;
    const m = this.match;
    const a = this.award;
    this.input.setEnabled(false);
    this.input.releaseLock();
    this._matchesPlayed = (this._matchesPlayed || 0) + 1;
    this.ui.results({
      goal: this._nextGoal(),
      won: a.res.won, place: a.res.place, stats: a.res, xp: a.xp, levelInfo: a.levelInfo,
      canSpectate: canSpectate && m.aliveCount() > 1 && m.state !== State.RESULTS && m.state !== State.ROUND_END, note,
    });
  }

  // one concrete thing to work towards, shown on the results screen
  _nextGoal() {
    const pr = this.progress, wins = pr.stats.wins;
    const ch = CHARACTERS.find((c) => wins < c.wins);
    const ups = UPGRADES.map((u) => ({ u, cost: pr.upgradeCost(u.id) })).filter((x) => x.cost !== null).sort((a, b) => a.cost - b.cost);
    const buy = ups.find((x) => x.cost <= pr.coins);
    if (buy) return `🪙 You can buy <b>${buy.u.name}</b> now (${buy.cost} coins) - open Cosmetics!`;
    const next = ups[0];
    const parts = [];
    if (next) parts.push(`<b>${next.u.name}</b> costs ${next.cost} 🪙 (you have ${pr.coins})`);
    if (ch) parts.push(`new character <b>${ch.name}</b> after ${ch.wins - wins} more win${ch.wins - wins > 1 ? 's' : ''}`);
    return parts.join(' · ');
  }

  _onMatchResults(m, me) {
    if (!this.award) this._finishLocal(false, me.place || 2);
    const w = m.byId.get(m.winnerId);
    this.ui.spectate(null, false);
    this.spec.on = false;
    this.showResults(false, w && w.id !== me.id ? `WINNER: ${w.name}` : '');
    if (!this.award.res.won) this.audio.defeat();
  }

  // ------------------------------------------------------------------ tutorial
  _tutMiss() {
    this.ui.tutorial('Too late!', 'Press PARRY just before the projectile reaches you');
    this.tut.step = Math.min(this.tut.step, 1);
    this.tut.t = 0;
    this.tut.missT = 2.5;
  }
  _tutorialTick(m, me, dt) {
    const t = this.tut, b = m.ball, ui = this.ui;
    t.t += dt;
    if (t.missT > 0) { t.missT -= dt; if (t.missT <= 0) { ui.tutorial(t.step === 0 ? 'Wait until the projectile is close.' : 'Press PARRY.', ''); } return; }
    const toMe = b.mode === 'flying' && b.targetId === this.localId;
    const d = toMe ? Math.hypot(b.x - me.x, b.z - me.z) : 99;
    if (t.step === 0 && toMe && d < 9) { t.step = 1; ui.tutorial('Press PARRY.', this.input.isTouch ? 'Tap the PARRY button' : 'Left mouse button or F'); }
    if (t.step === 3 && t.t > 22 && !t.done) { t.done = true; ui.tutorial('Training complete!', 'You are ready for the arena'); this.progress.settings.tutorialDone = true; this.progress.save(); setTimeout(() => { if (this.mode === 'play' && this.tut) this.leaveToMenu(); }, 3200); }
  }
}

// tutorial progress is advanced from the event stream
const origOnEvent = App.prototype._onEvent;
App.prototype._onEvent = function (e, m, me) {
  origOnEvent.call(this, e, m, me);
  const t = this.tut;
  if (!t) return;
  if (e.type === 'parry' && e.id === this.localId) {
    if (t.step <= 1) { t.step = 2; t.t = 0; this.ui.tutorial('Aim toward another player.', 'Look at a bot with the crosshair - then parry the next ball'); }
    else if (t.step === 2) {
      if (e.aimed) { t.step = 3; t.t = 0; this.ui.tutorial('Survive.', 'Keep parrying - the others are trying to knock you out'); }
      else this.ui.tutorial('Aim toward another player.', 'Turn the camera so a bot is in your crosshair, then parry');
    }
  }
};

const app = new App();
app.boot().catch((e) => { console.error(e); });
