import type { InputDriver, MouseButton } from './driver';

export interface PointerProbe {
  /** Ukuran layar utama dalam piksel logis (DIP) menurut Electron. */
  logicalSize(): { width: number; height: number };
  fallbackScale: number;
}

/**
 * Kontrol mouse. Driver (nut.js) dan Electron bisa memakai satuan berbeda (piksel fisik vs logis,
 * terutama di Windows ber-DPI tinggi). Skala dikalibrasi dari rasio ukuran layar menurut driver
 * terhadap ukuran layar logis Electron — tanpa menggerakkan kursor.
 */
export class MouseController {
  private scale: number | null = null;
  constructor(private driver: InputDriver, private probe: PointerProbe) {}

  async calibrate(): Promise<number> {
    if (this.scale) return this.scale;
    try {
      const d = await this.driver.screenSize();
      const l = this.probe.logicalSize();
      const rx = d.width / l.width;
      const ry = d.height / l.height;
      const ok = Number.isFinite(rx) && rx > 0.4 && rx < 6 && Math.abs(rx - ry) / rx < 0.05;
      this.scale = ok ? Math.round(rx * 1000) / 1000 : this.probe.fallbackScale;
    } catch {
      this.scale = this.probe.fallbackScale;
    }
    return this.scale;
  }

  private async toDriver(p: { x: number; y: number }) {
    const s = this.scale ?? (await this.calibrate());
    // koordinat driver = koordinat logis * (ukuran driver / ukuran logis)
    return { x: p.x * s, y: p.y * s };
  }

  async move(p: { x: number; y: number }) {
    const d = await this.toDriver(p);
    await this.driver.moveTo(d.x, d.y);
  }

  async click(p: { x: number; y: number }, button: MouseButton = 'left', count = 1) {
    await this.move(p);
    await this.driver.click(button, count);
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await this.driver.drag(await this.toDriver(from), await this.toDriver(to));
  }

  async scroll(dx: number, dy: number, at?: { x: number; y: number }) {
    if (at) await this.move(at);
    await this.driver.scroll(dx, dy);
  }
}
