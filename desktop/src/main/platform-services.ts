import { desktopCapturer, screen, shell, systemPreferences, clipboard } from 'electron';
import type { Capturer } from './control/screenshot';
import type { PointerProbe } from './control/mouse';
import { listApps, openApp, windowOp } from './control/platform';
import type { Services } from './tools/definitions';

export const electronCapturer: Capturer = async (maxEdge) => {
  if (process.platform === 'darwin') {
    const st = systemPreferences.getMediaAccessStatus('screen');
    if (st !== 'granted') throw new Error(`Izin Screen Recording macOS belum diberikan (status: ${st}). Buka Permission Center → Minta izin macOS, lalu mulai ulang aplikasi.`);
  }
  const d = screen.getPrimaryDisplay();
  const sf = d.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) } });
  const src = sources.find((s) => s.display_id === String(d.id)) ?? sources[0];
  if (!src) throw new Error('Tidak ada layar yang dapat ditangkap (di Linux/Wayland butuh PipeWire/portal).');
  let img = src.thumbnail;
  const size = img.getSize();
  if (!size.width || !size.height) throw new Error('Tangkapan layar kosong. Periksa izin Screen Recording.');
  const k = Math.min(1, maxEdge / Math.max(size.width, size.height));
  if (k < 1) img = img.resize({ width: Math.round(size.width * k), height: Math.round(size.height * k), quality: 'good' });
  const out = img.getSize();
  return { jpeg: img.toJPEG(80), width: out.width, height: out.height, bounds: { ...d.bounds } };
};

export const pointerProbe: PointerProbe = {
  logicalSize: () => { const b = screen.getPrimaryDisplay().bounds; return { width: b.width, height: b.height }; },
  get fallbackScale() { return process.platform === 'win32' ? screen.getPrimaryDisplay().scaleFactor || 1 : 1; }
};

export const platformServices: Services['platform'] = {
  openApp: (n) => openApp(n),
  listApps: () => listApps(),
  windowOp: (op, title) => windowOp(op, title),
  openPath: (p) => shell.openPath(p)
};

export const clipboardLike = { readText: () => clipboard.readText(), writeText: (t: string) => clipboard.writeText(t) };
