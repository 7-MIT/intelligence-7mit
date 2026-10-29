/** Parser kombinasi tombol (mis. "ctrl+shift+p") menjadi nama kanonik, independen dari library otomasi. */
const ALIASES: Record<string, string> = {
  ctrl: 'ctrl', control: 'ctrl',
  cmd: 'meta', command: 'meta', meta: 'meta', super: 'meta', win: 'meta', windows: 'meta',
  alt: 'alt', option: 'alt', opt: 'alt',
  shift: 'shift',
  enter: 'enter', return: 'enter',
  esc: 'escape', escape: 'escape',
  tab: 'tab', space: 'space', spacebar: 'space',
  backspace: 'backspace', delete: 'delete', del: 'delete', insert: 'insert',
  up: 'up', down: 'down', left: 'left', right: 'right',
  arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
  home: 'home', end: 'end', pageup: 'pageup', pagedown: 'pagedown', pgup: 'pageup', pgdn: 'pagedown',
  capslock: 'capslock', printscreen: 'printscreen'
};

const MODIFIERS = new Set(['ctrl', 'meta', 'alt', 'shift']);

export interface KeyCombo {
  modifiers: string[];
  keys: string[];
}

export function parseKeyCombo(input: string): KeyCombo {
  const parts = input.split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) throw new Error('Kombinasi tombol kosong');
  if (parts.length > 5) throw new Error('Kombinasi tombol terlalu panjang');
  const mapped = parts.map((p) => {
    const alias = ALIASES[p];
    if (alias) return alias;
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(p)) return p;
    if (/^[a-z0-9]$/.test(p)) return p;
    if (/^[-=\[\];',./\\`]$/.test(p)) return p;
    throw new Error(`Tombol tidak dikenal: "${p}"`);
  });
  const modifiers = mapped.filter((k) => MODIFIERS.has(k));
  const keys = mapped.filter((k) => !MODIFIERS.has(k));
  if (keys.length > 1) throw new Error('Hanya satu tombol non-modifier yang didukung per kombinasi');
  return { modifiers: [...new Set(modifiers)], keys };
}

/** Kombinasi yang berpotensi merusak/lepas kendali; selalu dinaikkan risikonya. */
export function comboRisk(c: KeyCombo): 'medium' | 'high' {
  const s = [...c.modifiers, ...c.keys].join('+');
  const dangerous = [
    'alt+f4', 'ctrl+alt+delete', 'meta+l', 'meta+q', 'ctrl+meta+q', 'ctrl+w', 'meta+w',
    'ctrl+shift+delete', 'alt+meta+escape', 'ctrl+shift+escape', 'meta+r'
  ];
  const norm = (x: string) => x.split('+').sort().join('+');
  return dangerous.some((d) => norm(d) === norm(s)) ? 'high' : 'medium';
}
