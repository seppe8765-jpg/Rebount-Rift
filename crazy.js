// Thin, fully optional wrapper around the CrazyGames SDK. If the SDK is missing (local testing,
// blocked script, other host) every call is a harmless no-op, so the game never depends on it.
let sdk = null;
let tried = false;

export function loadCrazySdk() {
  if (tried) return Promise.resolve(sdk);
  tried = true;
  const onCg = /crazygames/i.test(location.hostname) || /[?&]cg=1/.test(location.search);
  if (!onCg) return Promise.resolve(null);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    s.onload = async () => {
      try { await window.CrazyGames.SDK.init(); sdk = window.CrazyGames.SDK; } catch (e) { sdk = null; }
      resolve(sdk);
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(sdk), 4000);
  });
}

const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };
export const cg = {
  loadingStart: () => safe(() => sdk && sdk.game.loadingStart()),
  loadingStop: () => safe(() => sdk && sdk.game.loadingStop()),
  gameplayStart: () => safe(() => sdk && sdk.game.gameplayStart()),
  gameplayStop: () => safe(() => sdk && sdk.game.gameplayStop()),
  // CrazyGames lets the player mute the game from the portal: follow that setting
  onMute: (fn) => safe(() => {
    if (!sdk) return;
    fn(!!sdk.game.settings.muteAudio);
    sdk.game.addSettingsChangeListener((s) => fn(!!s.muteAudio));
  }),
  // invite links ("Online with Friends"): the portal opens the game with ?roomId=... in the URL
  inviteLink: (code) => safe(() => sdk && sdk.game.inviteLink({ roomId: code })),
  showInvite: (code) => safe(() => sdk && sdk.game.showInviteButton({ roomId: code })),
  hideInvite: () => safe(() => sdk && sdk.game.hideInviteButton()),
  inviteParam: () => safe(() => (sdk && sdk.game.getInviteParam && sdk.game.getInviteParam('roomId')) || new URLSearchParams(location.search).get('room')) || null,
  instantMultiplayer: () => !!safe(() => sdk && sdk.game.isInstantMultiplayer),
  happytime: () => safe(() => sdk && sdk.game.happytime()),
  // midgame ad between matches; always resolves
  midgameAd: (muteFn) => new Promise((resolve) => {
    if (!sdk) return resolve();
    safe(() => sdk.ad.requestAd('midgame', {
      adStarted: () => muteFn && muteFn(true),
      adFinished: () => { muteFn && muteFn(false); resolve(); },
      adError: () => { muteFn && muteFn(false); resolve(); },
    }));
    setTimeout(resolve, 60000);
  }),
};
