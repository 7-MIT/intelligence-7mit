import { createHash } from 'node:crypto';

export interface RawCapture {
  /** JPEG yang sudah diperkecil. */
  jpeg: Buffer;
  width: number;
  height: number;
  /** Batas layar dalam piksel logis (DIP), untuk memetakan koordinat gambar -> layar. */
  bounds: { x: number; y: number; width: number; height: number };
}

export interface Shot extends RawCapture {
  at: number;
  hash: string;
  dataUrl: string;
}

export type Capturer = (maxEdge: number) => Promise<RawCapture>;

/** Menangkap layar utama dan memetakan koordinat gambar ke koordinat layar logis. */
export class ScreenshotService {
  private last: Shot | null = null;
  constructor(private capturer: Capturer) {}

  async capture(maxEdge = 1280): Promise<Shot> {
    const raw = await this.capturer(maxEdge);
    if (raw.width < 2 || raw.height < 2) throw new Error('Hasil tangkapan layar kosong. Periksa izin Screen Recording.');
    const shot: Shot = {
      ...raw,
      at: Date.now(),
      hash: createHash('sha1').update(raw.jpeg).digest('hex'),
      dataUrl: `data:image/jpeg;base64,${raw.jpeg.toString('base64')}`
    };
    this.last = shot;
    return shot;
  }

  getLast(): Shot | null {
    return this.last;
  }

  /** Koordinat piksel gambar terakhir -> koordinat layar logis. */
  toScreen(x: number, y: number, shot = this.last): { x: number; y: number } {
    if (!shot) throw new Error('Belum ada screenshot. Ambil screenshot terlebih dahulu sebelum menunjuk koordinat.');
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > shot.width || y > shot.height) {
      throw new Error(`Koordinat (${x}, ${y}) di luar screenshot ${shot.width}x${shot.height}.`);
    }
    return {
      x: shot.bounds.x + (x / shot.width) * shot.bounds.width,
      y: shot.bounds.y + (y / shot.height) * shot.bounds.height
    };
  }
}
