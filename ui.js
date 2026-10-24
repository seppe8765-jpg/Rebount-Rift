// DOM user interface: HUD, menus, results. Contains no game rules, only presentation.
import { CATEGORIES, PLAYER_COLORS, rgbCss } from '../game/cosmetics.js';
import { xpToNext } from '../game/progression.js';
import { MAPS, MAP_BY_ID } from '../game/maps.js';
import { MODES, getMode } from '../game/modes.js';
import { UPGRADES, ABILITY_IDS, ABILITY_COOLDOWN, UPGRADE_BY_ID } from '../game/upgrades.js';
import { ACTIONS, DEFAULT_KEYS, keyLabel } from '../input/keys.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'howto', 'cosm', 'settings', 'searching', 'party', 'pause', 'results'];

export class UI {
  constructor(progress) {
    this.progress = progress;
    this.h = {}; // handlers assigned by the app
    this.labels = new Map();
    this.msgTimer = 0;
    this._bind();
  }

  _bind() {
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopPropagation(); this.h.sfx && this.h.sfx('click'); fn(e); }); };
    on('bPlay', () => this.h.play && this.h.play());
    on('bTrain', () => this.h.train && this.h.train());
    on('bHow', () => this.openModal('howto'));
    on('bCos', () => { this.buildCosmetics(); this.openModal('cosm'); });
    on('abilChip', () => { this.buildCosmetics(); this.openModal('cosm'); const e = $('abSec'); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'start' }); });
    on('bSet', () => { this.syncSettings(); this.openModal('settings'); });
    on('modePrev', () => this.cycleMode(-1));
    on('modeNext', () => this.cycleMode(1));
    on('mapPrev', () => this.cycleMap(-1));
    on('mapNext', () => this.cycleMap(1));
    on('bFriends', () => this.h.friends && this.h.friends());
    on('partyCreate', () => this.h.partyCreate && this.h.partyCreate());
    on('partyGo', () => this.h.partyJoin && this.h.partyJoin($('partyCode').value));
    on('partyStart', () => this.h.partyStart && this.h.partyStart());
    on('partyCopy', () => this.h.partyCopy && this.h.partyCopy());
    on('partyBack', () => this.h.partyBack && this.h.partyBack());
    on('srchCancel', () => this.h.cancelSearch && this.h.cancelSearch());
    on('pResume', () => this.h.resume && this.h.resume());
    on('pMenu', () => this.h.leave && this.h.leave());
    on('specPrev', () => this.h.spec && this.h.spec(-1));
    on('specNext', () => this.h.spec && this.h.spec(1));
    on('specLeave', () => this.h.leave && this.h.leave());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { this.h.sfx && this.h.sfx('click'); this.openModal(null); this.show('menu'); }));
    // settings
    const s = this.progress.settings;
    $('sName').addEventListener('change', (e) => { this.progress.setName(e.target.value); e.target.value = s.name; this.refreshProfile(); });
    $('sVol').addEventListener('input', (e) => { s.volume = e.target.value / 100; this.progress.save(); this.h.settings && this.h.settings(); });
    $('sMus').addEventListener('change', (e) => { s.music = e.target.checked; this.progress.save(); this.h.settings && this.h.settings(); });
    $('sSens').addEventListener('input', (e) => { s.sens = e.target.value / 100; this.progress.save(); this.h.settings && this.h.settings(); });
    $('sQual').addEventListener('change', (e) => { s.quality = e.target.value; this.progress.save(); });
    // two-step confirm (window.confirm is blocked inside many sandboxed iframes)
    $('sReset').addEventListener('click', () => {
      const b = $('sReset').querySelector('span');
      if (!this._resetArmed) { this._resetArmed = true; b.textContent = 'Click again to erase everything'; setTimeout(() => { this._resetArmed = false; b.textContent = 'Reset progress'; }, 4000); return; }
      this.h.resetProgress && this.h.resetProgress();
    });
  }

  cycleMode(d) {
    let i = MODES.findIndex((m) => m.id === this.progress.settings.mode); if (i < 0) i = 0;
    this.progress.settings.mode = MODES[(i + d + MODES.length) % MODES.length].id;
    this.progress.save();
    this.refreshMode();
  }
  refreshMode() {
    const m = getMode(this.progress.settings.mode);
    $('modeName').textContent = m.name; $('modeBlurb').textContent = m.blurb;
  }

  // keybinding editor: click an action, press the new key; a key already in use is swapped
  buildKeys() {
    const root = $('keyList'); root.innerHTML = '';
    const keys = this.progress.settings.keys;
    for (const a of ACTIONS) {
      const b = document.createElement('button');
      b.innerHTML = `<span>${a.name}</span><b>${keyLabel(keys[a.id])}</b>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        root.querySelectorAll('.wait').forEach((x) => x.classList.remove('wait'));
        b.classList.add('wait'); b.lastChild.textContent = 'press a key...';
        this.h.capture && this.h.capture((code) => {
          if (code !== 'Escape') {
            for (const o of ACTIONS) if (o.id !== a.id && keys[o.id] === code) keys[o.id] = keys[a.id];
            keys[a.id] = code; this.progress.save(); this.h.settings && this.h.settings();
          }
          this.buildKeys();
        });
      });
      root.appendChild(b);
    }
    const r = document.createElement('button'); r.style.gridColumn = '1 / -1'; r.innerHTML = '<span>Reset controls to default</span>';
    r.addEventListener('click', () => { Object.assign(keys, DEFAULT_KEYS); this.progress.save(); this.h.settings && this.h.settings(); this.buildKeys(); });
    root.appendChild(r);
  }

  cycleMap(d) {
    const opts = ['random', ...MAPS.map((m) => m.id)];
    let i = opts.indexOf(this.progress.settings.map); if (i < 0) i = 0;
    this.progress.settings.map = opts[(i + d + opts.length) % opts.length];
    this.progress.save();
    this.refreshMap();
  }
  refreshMap() {
    const id = this.progress.settings.map;
    const m = MAP_BY_ID.get(id);
    $('mapName').textContent = m ? m.name : 'RANDOM';
    $('mapBlurb').textContent = m ? m.blurb : 'A different arena every match';
  }

  // ------------------------------------------------------------ screens
  show(name) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
    $('profile').classList.toggle('hidden', name !== 'menu');
    if (name === 'menu') { this.refreshProfile(); this.refreshAbilityChip(); this.refreshMap(); this.refreshMode(); }
  }
  openModal(name) {
    for (const s of ['howto', 'cosm', 'settings']) $(s).classList.add('hidden');
    if (name) { $('menu').classList.add('hidden'); $('profile').classList.add('hidden'); $(name).classList.remove('hidden'); }
  }
  hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); $('profile').classList.add('hidden'); }
  showHud(on, touch) {
    $('hud').classList.toggle('hidden', !on);
    $('touch').classList.toggle('hidden', !(on && touch));
  }
  loading(p, txt) { $('loadBar').style.width = p * 100 + '%'; if (txt) $('loadTxt').textContent = txt; }
  hideLoading() { $('loading').classList.add('hidden'); }
  showRotate(v) { $('rotate').classList.toggle('hidden', !v); }

  refreshProfile() {
    const i = this.progress.info;
    $('pLv').textContent = 'LV ' + i.level;
    $('pName').textContent = this.progress.settings.name;
    $('pCoins').textContent = '🪙 ' + this.progress.coins;
    $('pXp').style.width = Math.round((i.into / i.need) * 100) + '%';
  }
  syncSettings() {
    const s = this.progress.settings;
    this.buildKeys();
    $('sName').value = s.name; $('sVol').value = Math.round(s.volume * 100); $('sMus').checked = !!s.music;
    $('sSens').value = Math.round(s.sens * 100); $('sQual').value = s.quality;
  }

  refreshAbilityChip() {
    const el = $('abilChip'); if (!el) return;
    const id = this.progress.ability, d = id && UPGRADE_BY_ID.get(id);
    el.innerHTML = d ? `<i>${d.icon}</i> ${d.name} <small>equipped · ${d.dur}s</small>` : '<i>＋</i> Get an ability <small>buy &amp; equip</small>';
  }

  buildCosmetics() {
    const body = $('cosBody');
    body.innerHTML = '';
    const pr = this.progress;
    $('cosSub').textContent = `🪙 ${pr.coins} coins - win matches to earn coins (100 per win). Upgrades change gameplay; skins and characters are cosmetic. Characters unlock by wins (you have ${pr.stats.wins}).`;
    const mkSec = (id, title, note) => { const w = document.createElement('div'); w.className = 'cat'; w.id = id; w.innerHTML = `<h3>${title}</h3><div class="dim" style="font-size:13px">${note}</div>`; const it = document.createElement('div'); it.className = 'items'; w.appendChild(it); body.appendChild(w); return it; };
    const eqName = pr.ability && UPGRADE_BY_ID.get(pr.ability) ? UPGRADE_BY_ID.get(pr.ability).name : 'none';
    const upItems = mkSec('upSec', 'Upgrades (permanent)', 'Always active in every match: jump height, run speed and dash cooldown. (Everyone can double jump.)');
    const abItems = mkSec('abSec', 'Abilities - buy, then EQUIP one', `Each ability lasts a few seconds when you press <b>Q</b> (or the Ability button on mobile), then needs ${ABILITY_COOLDOWN}s before you can use it again. You can own all of them but only ONE can be equipped per match. Equipped now: <b style="color:#7dffb0">${eqName}</b>`);
    for (const u of UPGRADES) {
      const lv = pr.up[u.id] || 0, cost = pr.upgradeCost(u.id), key = 'up:' + u.id;
      const confirming = this._buying === key, afford = cost !== null && pr.coins >= cost;
      const isAb = ABILITY_IDS.includes(u.id);
      const owned = isAb ? pr.ownsAbility(u.id) : false;
      const d = document.createElement('div');
      d.className = 'item' + (cost !== null && !afford ? ' locked' : '') + (confirming ? ' buying' : '');
      d.style.minWidth = '190px'; d.title = u.desc;
      const pips = u.levels.map((_, i) => (i < lv ? '●' : '○')).join(' ');
      const sub = cost === null ? (isAb ? '<small class="ow">OWNED</small>' : '<small class="eq">MAX</small>') : confirming ? `<small class="cf">TAP AGAIN: BUY ${cost} 🪙</small>` : `<small>🪙 ${cost}${afford ? '' : ' - not enough coins'}</small>`;
      const head = isAb ? `<span style="font-size:22px">${u.icon}</span> ${u.name}<small class="ow">${u.dur}s active · ${ABILITY_COOLDOWN}s cooldown</small>` : `${u.name}<small class="ow">${pips}</small>`;
      d.innerHTML = `${head}<small style="color:var(--dim);font-weight:400;letter-spacing:0;white-space:normal">${u.desc}</small>${sub}`;
      if (isAb && lv > 0) {
        const on = pr.ability === u.id;
        const b = document.createElement('button'); b.className = 'btn small'; b.style.marginTop = '6px';
        b.innerHTML = `<span>${on ? 'EQUIPPED ✓' : 'EQUIP'}</span>`;
        if (on) { b.style.borderColor = '#7dffb0'; d.style.outline = '2px solid #7dffb0'; }
        b.addEventListener('click', (e) => { e.stopPropagation(); this.h.sfx && this.h.sfx('click'); pr.equipAbility(u.id); this.refreshAbilityChip(); this.buildCosmetics(); });
        d.appendChild(b);
      }
      d.addEventListener('click', () => {
        this.h.sfx && this.h.sfx('click');
        if (cost === null || !afford) this._buying = null;
        else if (!confirming) this._buying = key;
        else { const r = pr.buyUpgrade(u.id); this._buying = null; if (r.ok) { this.h.sfx && this.h.sfx('victory'); this.refreshProfile(); this.refreshAbilityChip(); } }
        this.buildCosmetics();
      });
      (isAb ? abItems : upItems).appendChild(d);
    }
    for (const c of CATEGORIES) {
      const wrap = document.createElement('div'); wrap.className = 'cat';
      wrap.innerHTML = `<h3>${c.title}</h3>`;
      const items = document.createElement('div'); items.className = 'items';
      for (const it of c.items) {
        const d = document.createElement('div');
        const owned = pr.owns(c.key, it.id);
        const key = c.key + ':' + it.id;
        const confirming = this._buying === key;
        const afford = !c.byWins && pr.coins >= it.price;
        d.className = 'item' + (pr.loadout[c.key] === it.id ? ' sel' : '') + (!owned && !afford ? ' locked' : '') + (confirming ? ' buying' : '');
        d.dataset.item = key;
        let sw = '';
        const col = it.glow && it.glow !== 'rainbow' ? it.glow : it.color;
        if (col) sw = `<span class="sw" style="color:${rgbCss(col)};background:${rgbCss(col)}"></span>`;
        else if (it.glow === 'rainbow') sw = '<span class="sw" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);color:#fff"></span>';
        const sub = c.byWins && !owned ? `<small>🔒 ${it.wins} wins (${pr.stats.wins}/${it.wins})</small>` : owned ? (pr.loadout[c.key] === it.id ? '<small class="eq">EQUIPPED</small>' : '<small class="ow">OWNED</small>')
          : confirming ? `<small class="cf">TAP AGAIN: BUY ${it.price} 🪙</small>` : `<small>🪙 ${it.price}${afford ? '' : ' - not enough coins'}</small>`;
        d.innerHTML = `${sw}${it.name}${sub}`;
        d.addEventListener('click', () => {
          this._prev = { cat: c.key, id: it.id };
          if (owned) { pr.equip(c.key, it.id); this._buying = null; this.h.sfx && this.h.sfx('click'); this.h.loadout && this.h.loadout(); }
          else if (c.byWins || !afford) { this._buying = null; this.h.sfx && this.h.sfx('click'); }
          else if (!confirming) { this._buying = key; this.h.sfx && this.h.sfx('click'); }
          else { const r = pr.buy(c.key, it.id); this._buying = null; if (r.ok) { this.h.sfx && this.h.sfx('victory'); this.h.loadout && this.h.loadout(); this.refreshProfile(); } }
          this.buildCosmetics();
        });
        items.appendChild(d);
      }
      wrap.appendChild(items);
      body.appendChild(wrap);
    }
    this.refreshPreview();
  }

  // picture of the item you tapped on the player (rendered by the game itself), so you see what you are about to buy
  refreshPreview() {
    const pr = this.progress, p = this._prev || { cat: 'char', id: pr.loadout.char };
    const cat = CATEGORIES.find((c) => c.key === p.cat); const it = cat && cat.items.find((i) => i.id === p.id);
    if (!it || !this.h.portrait) return;
    const url = this.h.portrait(p.cat, p.id);
    if (url) $('cosPrevImg').src = url;
    const owned = pr.owns(p.cat, p.id);
    $('cosPrevName').textContent = it.name;
    const note = ['parry', 'victory', 'trail'].includes(p.cat) ? ' · effect plays during the match' : '';
    $('cosPrevSub').textContent = (cat.byWins && !owned ? `Unlocks at ${it.wins} wins` : owned ? (pr.loadout[p.cat] === p.id ? 'Equipped' : 'Owned') : `🪙 ${it.price}`) + note;
  }

  // ------------------------------------------------------------ searching
  searching(text, count, roster, note, total = 12) {
    $('srchTitle').textContent = text;
    $('srchCount').textContent = `Players: ${count}/${total}`;
    $('srchNote').textContent = note || '';
    $('srchRoster').innerHTML = roster.map((r) => `<i class="${r.you ? 'you' : ''}">${r.name}</i>`).join('');
  }
  // private room screen: m = {code, members, host, max} or null (code entry)
  party(m, err) {
    $('partyErr').textContent = err || '';
    $('partyJoin').classList.toggle('hidden', !!m);
    $('partyRoom').classList.toggle('hidden', !m);
    if (!m) return;
    $('partyShow').textContent = m.code;
    $('partyCount').textContent = `Players: ${m.members.length}/${m.max}`;
    $('partyRoster').innerHTML = m.members.map((n, i) => `<i class="${i === 0 ? 'you' : ''}">${n}${i === 0 ? ' ★' : ''}</i>`).join('');
    $('partyStart').classList.toggle('hidden', !m.host);
    $('partyNote').textContent = m.host ? 'You are the host. Empty slots are filled with bots.' : 'Waiting for the host to start...';
  }
  startTxt(txt) {
    let el = $('startTxt');
    if (!el) { el = document.createElement('div'); el.id = 'startTxt'; $('hud').appendChild(el); }
    el.textContent = txt || ''; el.classList.toggle('hidden', !txt);
  }

  hint(html) { const h = $('hint'); if (!html) { h.classList.add('hidden'); return; } h.innerHTML = html; h.style.opacity = 1; h.classList.remove('hidden'); }
  fadeHint() { const h = $('hint'); h.style.opacity = 0; setTimeout(() => h.classList.add('hidden'), 650); }

  // ------------------------------------------------------------ HUD
  // ability HUD: items = [{label, state: 'rdy'|'act'|'cd', text}]
  setAbilities(items) {
    const root = $('abil'); const sig = JSON.stringify(items.map((i) => ({ ...i, frac: Math.round((i.frac || 0) * 40) })));
    if (this._abSig === sig) return; this._abSig = sig;
    root.innerHTML = items.map((i) => `<div class="ab ${i.state}" style="--f:${Math.round((i.frac || 0) * 360)}deg"><b class="ic">${i.icon || ''}</b>${i.key ? `<kbd>${i.key}</kbd>` : ''}<span>${i.label}${i.text ? '<em>' + i.text + '</em>' : ''}</span></div>`).join('');
    { const b = $('btnAbility'); if (b) b.classList.toggle('hidden', !items.some((i) => i.id === 'ability')); }
  }
  setAlive(n) { $('aliveN').textContent = n; }
  setTarget(text, me) { const t = $('targetBanner'); t.textContent = text; t.classList.toggle('me', !!me); }
  setSpeed(kmh, intensity) {
    $('spN').firstChild.nodeValue = Math.round(kmh);
    $('spBar').style.width = Math.min(100, 6 + intensity * 94) + '%';
    $('spN').style.color = intensity > 0.7 ? '#ff5a6a' : intensity > 0.4 ? '#ffb02e' : '#e9f3ff';
  }
  feed(text, you) {
    const f = $('feed');
    const d = document.createElement('div'); d.textContent = text; if (you) d.className = 'you';
    f.appendChild(d);
    while (f.children.length > 5) f.removeChild(f.firstChild);
    setTimeout(() => d.remove(), 5000);
  }
  msg(text, color = '#fff') {
    const m = $('msg');
    m.textContent = text; m.style.color = color;
    m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
  }
  countdown(txt) {
    const c = $('countdown');
    c.textContent = txt;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  }
  banner(txt, color) {
    const b = $('banner'); b.textContent = txt; b.style.color = color || ''; b.style.textShadow = color ? `0 0 22px ${color}` : '';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  setThreat(v) { $('vignette').style.boxShadow = v > 0.02 ? `inset 0 0 ${60 + v * 140}px rgba(255,40,60,${Math.min(0.75, v * 0.8)})` : 'inset 0 0 0 rgba(255,40,60,0)'; }
  flash(color = '#fff', a = 0.35) {
    const f = $('flash'); f.style.background = color; f.style.transition = 'none'; f.style.opacity = a;
    requestAnimationFrame(() => { f.style.transition = 'opacity .25s'; f.style.opacity = 0; });
  }
  // dir: screen-space angle (radians, 0 = up, clockwise), null to hide
  setArrow(angle, radius) {
    const i = $('arrow').firstElementChild;
    if (angle === null) { i.style.opacity = 0; return; }
    i.style.opacity = 1;
    i.style.transform = `rotate(${angle}rad) translateY(${-radius}px)`;
  }
  setCooldown(frac) { const r = $('cdring'); r.style.opacity = frac > 0 ? 0.9 : 0; r.style.setProperty('--p', 1 - frac); }
  setAimLock(v) { $('cross').classList.toggle('aimlock', !!v); }
  setCrosshair(v) { $('cross').style.display = v ? 'block' : 'none'; $('cdring').style.display = v ? 'block' : 'none'; }
  tutorial(text, sub) { const t = $('tut'); t.classList.toggle('hidden', !text); t.innerHTML = text ? `${text}${sub ? `<small>${sub}</small>` : ''}` : ''; }
  debug(text) { const d = $('debug'); d.classList.toggle('hidden', !text); if (text) d.textContent = text; }
  fps(text) { const d = $('fps'); d.classList.toggle('hidden', !text); if (text) d.textContent = text; }
  spectate(name, on) { $('spec').classList.toggle('hidden', !on); if (name) $('specName').textContent = name; }

  // nameplates: items = [{id,name,x,y,visible,me,target,aim,dead,color}]
  setLabels(items) {
    const root = $('labels');
    const seen = new Set();
    for (const it of items) {
      seen.add(it.id);
      let el = this.labels.get(it.id);
      if (!el) { el = document.createElement('div'); el.className = 'nm'; el.style.color = rgbCss(it.color); el.textContent = it.name; root.appendChild(el); this.labels.set(it.id, el); }
      if (!it.visible || it.dead) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.className = 'nm' + (it.me ? ' me' : '') + (it.target ? ' tg' : '') + (it.aim ? ' aim' : '');
      el.style.transform = `translate(${Math.round(it.x)}px,${Math.round(it.y)}px) translate(-50%,-100%)`;
    }
    for (const [id, el] of this.labels) if (!seen.has(id)) { el.remove(); this.labels.delete(id); }
  }
  clearLabels() { for (const [, el] of this.labels) el.remove(); this.labels.clear(); }

  // ------------------------------------------------------------ results
  results({ won, place, stats, xp, levelInfo, canSpectate, note, goal }) {
    const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
    const mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const rows = xp ? xp.rows.filter((r) => r[1] > 0).map((r) => `<span>${r[0]}</span><span>+${r[1]}</span>`).join('') + `<div class="t"><span>XP EARNED</span><span>+${xp.total}</span></div>` : '';
    const pct = levelInfo ? Math.round((levelInfo.into / levelInfo.need) * 100) : 0;
    const ul = xp && xp.coins != null ? `<div class="unlock">🪙 +${xp.coins} coins${won ? ' (victory!)' : ''} - balance ${xp.coinsTotal}</div>` : '';
    $('resBox').innerHTML = `
      <div class="title ${won ? 'win' : 'lose'}">${won ? 'Victory!' : 'Eliminated'}</div>
      <div class="place">${won ? '1st PLACE' : `You placed #${place}`}</div>
      <div class="stats">
        <div><b>${stats.parries}</b><span>Parries</span></div>
        <div><b>${stats.perfect}</b><span>Perfect</span></div>
        <div><b>${stats.elims}</b><span>Eliminations</span></div>
        <div><b>${mm(stats.survived)}</b><span>Survival</span></div>
      </div>
      ${xp ? `<div class="xp-rows">${rows}</div>
      <div class="dim" style="font-size:13px;letter-spacing:.14em">LEVEL ${levelInfo.level}${xp && levelInfo.leveled ? ' ▲ LEVEL UP!' : ''}</div>
      <div class="lvbar"><i style="width:${pct}%"></i></div>` : ''}
      ${ul}
      ${goal ? `<div class="dim" style="font-size:13px;line-height:1.5">${goal}</div>` : ''}
      ${note ? `<div class="dim" style="letter-spacing:.12em">${note}</div>` : ''}
      <div class="btns">
        <button class="btn primary" id="rAgain"><span>Play again</span></button>
        ${canSpectate ? '<button class="btn" id="rSpec"><span>Spectate</span></button>' : ''}
        <button class="btn" id="rMenu"><span>Main menu</span></button>
      </div>`;
    const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { this.h.sfx && this.h.sfx('click'); fn(); }); };
    bind('rAgain', () => this.h.playAgain && this.h.playAgain());
    bind('rSpec', () => this.h.startSpectate && this.h.startSpectate());
    bind('rMenu', () => this.h.leave && this.h.leave());
    this.show('results');
  }
}
