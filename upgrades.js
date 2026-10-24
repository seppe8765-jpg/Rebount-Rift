// Permanent upgrades bought with coins (earned by winning). `levels` = coin price per level.
// Passive upgrades (jump / speed / dash) work all the time. ABILITIES are bought once, only ONE can be equipped per
// match, and it is triggered with the ability key: it lasts `dur` seconds, then needs ABILITY_COOLDOWN seconds before
// it can be used again (the cooldown starts when the effect ends). The effects live in the simulation (Match).
export const ABILITY_COOLDOWN = 10;
export const UPGRADES = [
  { id: 'jump', name: 'Jump Boost', desc: 'Jump higher. Level 2+ reaches the tall obstacles. (Everyone can double jump.)', levels: [150, 300, 600] },
  { id: 'speed', name: 'Swift Feet', desc: 'Run 4% faster per level.', levels: [120, 240, 480] },
  { id: 'dash', name: 'Quick Dash', desc: 'Dash cooldown 2.2s -> 1.8 / 1.4 / 1.0s.', levels: [150, 300, 600] },
  { id: 'sprint', name: 'Sprint', desc: 'Run 45% faster for 5s.', levels: [350], ability: true, dur: 5, icon: '⚡' },
  { id: 'invis', name: 'Invisibility', desc: 'Invisible for 5s: nobody can target you, a ball locked on you loses its lock.', levels: [400], ability: true, dur: 5, icon: '◌' },
  { id: 'bubble', name: 'Bubble Shield', desc: 'A shield for 3s that blocks the hit (it also breaks on the first hit).', levels: [500], ability: true, dur: 3, icon: '🛡' },
  { id: 'warp', name: 'Time Warp', desc: 'The ball moves at half speed for 3s.', levels: [700], ability: true, dur: 3, icon: '⏱' },
  { id: 'guard', name: 'Guardian', desc: 'For 4s the first lethal hit is deflected automatically.', levels: [800], ability: true, dur: 4, icon: '♥' },
  { id: 'sky', name: 'Sky Jump', desc: 'Jump 70% higher for 5s - reach the tall obstacles.', levels: [450], ability: true, dur: 5, icon: '⇧' },
  { id: 'magnet', name: 'Wide Parry', desc: 'Your parry timing window is 70% longer for 5s.', levels: [600], ability: true, dur: 5, icon: '◎' },
  { id: 'aim', name: 'Auto Aim', desc: 'For 5s your throws snap to the player closest to your crosshair.', levels: [550], ability: true, dur: 5, icon: '⌖' },
  { id: 'rapid', name: 'Rapid Dash', desc: 'For 5s your dash is ready again after 0.3s.', levels: [500], ability: true, dur: 5, icon: '≫' },
  { id: 'slow', name: 'Heavy Air', desc: 'For 4s a ball flying at you is 40% slower.', levels: [900], ability: true, dur: 4, icon: '❄' },
];
export const ABILITY_IDS = UPGRADES.filter((u) => u.ability).map((u) => u.id);
export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));
