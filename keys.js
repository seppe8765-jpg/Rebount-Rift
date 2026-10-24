// Remappable keyboard actions. Mouse: left button = parry (always), right-drag = look. Arrow keys always turn the camera.
export const ACTIONS = [
  { id: 'fwd', name: 'Move forward' },
  { id: 'back', name: 'Move back' },
  { id: 'left', name: 'Move left' },
  { id: 'right', name: 'Move right' },
  { id: 'parry', name: 'Parry' },
  { id: 'jump', name: 'Jump' },
  { id: 'dash', name: 'Dash' },
  { id: 'ability', name: 'Ability (equipped)' },
];
export const DEFAULT_KEYS = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', parry: 'KeyF', jump: 'Space', dash: 'ShiftLeft', ability: 'KeyQ' };
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return ({ Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', Enter: 'Enter', Backquote: '`', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'" })[code] || code;
}
