import type { InputDriver } from './driver';
import { parseKeyCombo } from './keys';

export interface ClipboardLike {
  readText(): string;
  writeText(t: string): void;
}

/** Kontrol keyboard. Teks non-ASCII/panjang diketik lewat clipboard agar akurat, lalu clipboard dipulihkan. */
export class KeyboardController {
  constructor(private driver: InputDriver, private clipboard: ClipboardLike, private pasteCombo: string) {}

  async type(text: string): Promise<{ method: 'keys' | 'paste' }> {
    if (text.length > 5000) throw new Error('Teks terlalu panjang untuk satu kali ketik (maks 5000 karakter).');
    const needsPaste = /[^\x20-\x7e\n\t]/.test(text) || text.length > 200;
    if (!needsPaste) {
      await this.driver.typeText(text);
      return { method: 'keys' };
    }
    const prev = this.clipboard.readText();
    try {
      this.clipboard.writeText(text);
      await this.driver.pressCombo(this.pasteCombo);
      await new Promise((r) => setTimeout(r, 150));
    } finally {
      this.clipboard.writeText(prev);
    }
    return { method: 'paste' };
  }

  async press(combo: string): Promise<void> {
    parseKeyCombo(combo); // validasi lebih dulu
    await this.driver.pressCombo(combo);
  }
}
