import { parseKeyCombo } from './keys';
import { run } from './platform';

export interface WindowInfo {
  id: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MouseButton = 'left' | 'right' | 'middle';

/** Abstraksi otomasi input OS. Implementasi nyata: NutDriver. Pengujian memakai driver palsu. */
export interface InputDriver {
  availability(): Promise<{ ok: boolean; reason?: string }>;
  getPosition(): Promise<{ x: number; y: number }>;
  /** Ukuran layar utama dalam satuan koordinat driver. */
  screenSize(): Promise<{ width: number; height: number }>;
  moveTo(x: number, y: number): Promise<void>;
  click(button: MouseButton, count: number): Promise<void>;
  drag(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void>;
  scroll(dx: number, dy: number): Promise<void>;
  typeText(text: string): Promise<void>;
  pressCombo(combo: string): Promise<void>;
  listWindows(): Promise<WindowInfo[]>;
  focusWindow(id: number): Promise<boolean>;
  minimizeWindow(id: number): Promise<boolean>;
  restoreWindow(id: number): Promise<boolean>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Driver berbasis @nut-tree-fork/nut-js (Windows/macOS/Linux X11). Dimuat malas agar aplikasi tetap jalan bila modul native gagal. */
export class NutDriver implements InputDriver {
  private nut: typeof import('@nut-tree-fork/nut-js') | null = null;
  private loadError: string | null = null;

  private async lib() {
    if (this.nut) return this.nut;
    if (this.loadError) throw new Error(this.loadError);
    try {
      const mod = await import('@nut-tree-fork/nut-js');
      mod.mouse.config.autoDelayMs = 30;
      mod.keyboard.config.autoDelayMs = 20;
      this.nut = mod;
      return mod;
    } catch (err) {
      this.loadError = `Modul otomasi native (nut.js) tidak dapat dimuat: ${(err as Error).message}`;
      throw new Error(this.loadError);
    }
  }

  async availability() {
    try {
      await this.lib();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
  }

  async getPosition() {
    const { mouse } = await this.lib();
    const p = await mouse.getPosition();
    return { x: p.x, y: p.y };
  }

  async screenSize() {
    const { screen } = await this.lib();
    return { width: await screen.width(), height: await screen.height() };
  }

  async moveTo(x: number, y: number) {
    const { mouse, Point, straightTo } = await this.lib();
    await mouse.move(straightTo(new Point(Math.round(x), Math.round(y))));
  }

  async click(button: MouseButton, count: number) {
    const { mouse, Button } = await this.lib();
    const b = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT;
    for (let i = 0; i < count; i++) {
      await mouse.click(b);
      if (i < count - 1) await sleep(60);
    }
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    const { mouse, Point, straightTo, Button } = await this.lib();
    await mouse.move(straightTo(new Point(Math.round(from.x), Math.round(from.y))));
    await mouse.pressButton(Button.LEFT);
    try {
      await sleep(80);
      await mouse.move(straightTo(new Point(Math.round(to.x), Math.round(to.y))));
      await sleep(80);
    } finally {
      await mouse.releaseButton(Button.LEFT);
    }
  }

  async scroll(dx: number, dy: number) {
    const { mouse } = await this.lib();
    if (dy > 0) await mouse.scrollDown(Math.abs(dy));
    else if (dy < 0) await mouse.scrollUp(Math.abs(dy));
    if (dx > 0) await mouse.scrollRight(Math.abs(dx));
    else if (dx < 0) await mouse.scrollLeft(Math.abs(dx));
  }

  async typeText(text: string) {
    const { keyboard } = await this.lib();
    await keyboard.type(text);
  }

  private resolveKey(lib: typeof import('@nut-tree-fork/nut-js'), name: string) {
    const { Key } = lib;
    const direct: Record<string, keyof typeof Key> = {
      ctrl: 'LeftControl', meta: 'LeftSuper', alt: 'LeftAlt', shift: 'LeftShift', enter: 'Enter', escape: 'Escape',
      tab: 'Tab', space: 'Space', backspace: 'Backspace', delete: 'Delete', insert: 'Insert', up: 'Up', down: 'Down',
      left: 'Left', right: 'Right', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
      capslock: 'CapsLock', printscreen: 'Print',
      '-': 'Minus', '=': 'Equal', '[': 'LeftBracket', ']': 'RightBracket', ';': 'Semicolon', "'": 'Quote',
      ',': 'Comma', '.': 'Period', '/': 'Slash', '\\': 'Backslash', '`': 'Grave'
    };
    const key = direct[name] ?? (/^[a-z]$/.test(name) ? name.toUpperCase() : /^\d$/.test(name) ? `Num${name}` : /^f\d+$/.test(name) ? name.toUpperCase() : undefined);
    const code = key ? Key[key as keyof typeof Key] : undefined;
    if (code === undefined) throw new Error(`Tombol tidak didukung pada platform ini: ${name}`);
    return code;
  }

  async pressCombo(combo: string) {
    const lib = await this.lib();
    const c = parseKeyCombo(combo);
    const codes = [...c.modifiers, ...c.keys].map((k) => this.resolveKey(lib, k));
    await lib.keyboard.pressKey(...codes);
    await lib.keyboard.releaseKey(...[...codes].reverse());
  }

  /** Linux: libnut hanya melihat child langsung root (tidak melihat jendela di bawah window manager yang melakukan reparenting), jadi pakai wmctrl bila ada. */
  private async wmctrl(): Promise<boolean> {
    if (process.platform !== 'linux') return false;
    this.hasWmctrl ??= await run('wmctrl', ['-m']).then(() => true, () => false);
    return this.hasWmctrl;
  }
  private hasWmctrl: boolean | undefined;

  async listWindows(): Promise<WindowInfo[]> {
    if (await this.wmctrl()) {
      const out = await run('wmctrl', ['-lG']);
      return out.split('\n').flatMap((line) => {
        const m = line.match(/^(0x[0-9a-f]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+\S+\s+(.*)$/i);
        return m && m[7].trim() ? [{ id: parseInt(m[1], 16), title: m[7].trim(), x: +m[3], y: +m[4], width: +m[5], height: +m[6] }] : [];
      });
    }
    const lib = await this.lib();
    const wins = await lib.getWindows();
    const out: WindowInfo[] = [];
    for (const w of wins.slice(0, 80)) {
      try {
        const [title, r] = await Promise.all([w.title, w.region]);
        if (!title) continue;
        out.push({ id: (w as unknown as { windowHandle: number }).windowHandle, title, x: r.left, y: r.top, width: r.width, height: r.height });
      } catch {
        /* jendela hilang saat dienumerasi */
      }
    }
    return out;
  }

  private async byId(id: number) {
    const lib = await this.lib();
    const wins = await lib.getWindows();
    return wins.find((w) => (w as unknown as { windowHandle: number }).windowHandle === id);
  }

  async focusWindow(id: number) {
    if (await this.wmctrl()) { await run('wmctrl', ['-ia', '0x' + id.toString(16)]); return true; }
    const w = await this.byId(id);
    return w ? w.focus() : false;
  }
  async minimizeWindow(id: number) {
    if (await this.wmctrl()) { await run('wmctrl', ['-i', '-r', '0x' + id.toString(16), '-b', 'add,hidden']); return true; }
    const w = await this.byId(id);
    return w ? w.minimize() : false;
  }
  async restoreWindow(id: number) {
    if (await this.wmctrl()) { await run('wmctrl', ['-i', '-r', '0x' + id.toString(16), '-b', 'remove,hidden']); await run('wmctrl', ['-ia', '0x' + id.toString(16)]); return true; }
    const w = await this.byId(id);
    return w ? w.restore() : false;
  }
}
