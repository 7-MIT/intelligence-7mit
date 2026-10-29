import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';

export const RISKY_LABEL = /\b(send|kirim|submit|buy|beli|purchase|pay|bayar|checkout|order|pesan sekarang|delete|hapus|remove|publish|terbitkan|post|tweet|confirm|konfirmasi|transfer|donate|subscribe|berlangganan|sign\s?out|log\s?out|keluar|unsubscribe|deactivate|nonaktifkan)\b/i;

export function validateUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error(`URL tidak valid: ${raw}`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Protokol tidak diizinkan: ${u.protocol} (hanya http/https)`);
  if (/^(169\.254\.|metadata\.google\.internal|fd00:ec2)/i.test(u.hostname)) throw new Error('Alamat metadata cloud diblokir');
  return u;
}

export interface SnapshotElement { ref: number; tag: string; type?: string; label: string; href?: string; value?: string }
export interface Snapshot { url: string; title: string; text: string; elements: SnapshotElement[] }

const SNAPSHOT_FN = `(() => {
  document.querySelectorAll('[data-it7-ref]').forEach(e => e.removeAttribute('data-it7-ref'));
  const sel = 'a[href],button,input,textarea,select,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[onclick],[contenteditable=true]';
  const out = []; let n = 0;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;
    n++; el.setAttribute('data-it7-ref', String(n));
    const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || el.value || el.name || '').replace(/\\s+/g,' ').trim().slice(0,100);
    out.push({ ref: n, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || undefined, label, href: el.tagName === 'A' ? el.href : undefined, value: (el.tagName === 'INPUT' && el.type !== 'password') ? (el.value || '').slice(0,60) : undefined });
    if (n >= 150) break;
  }
  return { url: location.href, title: document.title, text: (document.body?.innerText || '').replace(/\\n{3,}/g,'\\n\\n').slice(0, 9000), elements: out };
})()`;

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Page[] = [];
  private active = 0;
  private logs: string[] = [];
  private downloads: string[] = [];
  private stream: NodeJS.Timeout | null = null;
  private launching: Promise<void> | null = null;

  constructor(private downloadsDir: string) {}

  isOpen(): boolean { return !!this.browser; }

  state() {
    return { open: this.isOpen(), tabs: this.pages.map((p, i) => ({ index: i, url: p.url(), active: i === this.active })) };
  }

  private async launch(): Promise<void> {
    const { chromium } = await import('playwright-core');
    const errors: string[] = [];
    const custom = process.env.IT7_BROWSER_PATH; // jalur Chrome/Chromium kustom (opsional)
    const attempts: ({ executablePath: string } | { channel: string } | Record<string, never>)[] = [
      ...(custom ? [{ executablePath: custom }] : []), {}, { channel: 'chrome' }, { channel: 'msedge' }
    ];
    for (const opt of attempts) {
      try {
        this.browser = await chromium.launch({ headless: true, ...opt });
        break;
      } catch (e) {
        errors.push(`${JSON.stringify(opt)}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
    if (!this.browser) {
      throw new Error(`Tidak ada browser Chromium yang dapat dijalankan. Pasang Google Chrome/Microsoft Edge, atau jalankan "npx playwright-core install chromium".\nDetail: ${errors.join(' | ')}`);
    }
    // Konteks baru & tidak persisten = sesi terisolasi (tanpa cookie/login pengguna).
    this.context = await this.browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    this.context.on('page', (p) => this.track(p));
    this.browser.on('disconnected', () => { this.browser = null; this.context = null; this.pages = []; });
    this.track(await this.context.newPage());
  }

  private track(p: Page) {
    if (!this.pages.includes(p)) this.pages.push(p);
    this.active = this.pages.indexOf(p);
    const push = (s: string) => { this.logs.push(s); if (this.logs.length > 200) this.logs.shift(); };
    p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) push(`[console.${m.type()}] ${m.text().slice(0, 300)}`); });
    p.on('pageerror', (e) => push(`[pageerror] ${e.message.slice(0, 300)}`));
    p.on('requestfailed', (r) => push(`[requestfailed] ${r.method()} ${r.url().slice(0, 200)} — ${r.failure()?.errorText}`));
    p.on('response', (r) => { if (r.status() >= 400) push(`[http ${r.status()}] ${r.url().slice(0, 200)}`); });
    p.on('close', () => { this.pages = this.pages.filter((x) => x !== p); this.active = Math.max(0, Math.min(this.active, this.pages.length - 1)); });
    p.on('download', async (d) => {
      try {
        await fs.mkdir(this.downloadsDir, { recursive: true });
        const name = path.basename(d.suggestedFilename()).replace(/[^\w.\- ]/g, '_') || 'download';
        const dest = path.join(this.downloadsDir, `${Date.now()}-${name}`);
        await d.saveAs(dest);
        this.downloads.push(dest);
        push(`[download] ${dest}`);
      } catch (e) { push(`[download-error] ${(e as Error).message}`); }
    });
  }

  async page(): Promise<Page> {
    if (!this.browser) {
      this.launching ??= this.launch().finally(() => { this.launching = null; });
      await this.launching;
    }
    const p = this.pages[this.active];
    if (!p) { const np = await this.context!.newPage(); this.track(np); return np; }
    return p;
  }

  async goto(url: string): Promise<string> {
    const u = validateUrl(url);
    const p = await this.page();
    const res = await p.goto(u.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return `${res?.status() ?? '?'} ${p.url()}`;
  }

  async snapshot(): Promise<Snapshot> {
    const p = await this.page();
    return (await p.evaluate(SNAPSHOT_FN)) as Snapshot;
  }

  private loc(p: Page, target: { ref?: number; selector?: string }) {
    if (target.ref !== undefined) return p.locator(`[data-it7-ref="${Number(target.ref)}"]`).first();
    if (target.selector) return p.locator(target.selector).first();
    throw new Error('Tentukan "ref" (dari browser_snapshot) atau "selector"');
  }

  /** Label elemen sasaran, dipakai untuk menilai risiko klik. */
  async labelOf(target: { ref?: number; selector?: string }): Promise<string> {
    try {
      const p = await this.page();
      const l = this.loc(p, target);
      return (await l.evaluate((el: Element) => ((el as HTMLElement).getAttribute('aria-label') || (el as HTMLElement).innerText || (el as HTMLInputElement).value || (el as HTMLElement).getAttribute('title') || '') + ' ' + ((el as HTMLElement).closest('form')?.getAttribute('action') ?? ''), undefined, { timeout: 3000 })).trim().slice(0, 200);
    } catch { return ''; }
  }

  async focusedFormLabel(): Promise<string> {
    try {
      const p = await this.page();
      return await p.evaluate(`(() => { const f = document.activeElement?.closest?.('form'); if (!f) return ''; const b = f.querySelector('[type=submit],button:not([type])'); return b ? (b.innerText || b.value || '') : (f.getAttribute('action') || ''); })()`) as string;
    } catch { return ''; }
  }

  async click(target: { ref?: number; selector?: string }): Promise<void> {
    const p = await this.page();
    await this.loc(p, target).click({ timeout: 8000 });
    await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
  }
  async fill(target: { ref?: number; selector?: string }, text: string): Promise<void> {
    await this.loc(await this.page(), target).fill(text, { timeout: 8000 });
  }
  async select(target: { ref?: number; selector?: string }, value: string): Promise<void> {
    await this.loc(await this.page(), target).selectOption(value, { timeout: 8000 });
  }
  async press(key: string): Promise<void> {
    const p = await this.page();
    await p.keyboard.press(key);
    await p.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => undefined);
  }
  async scroll(dir: 'up' | 'down', amount: number): Promise<void> {
    const p = await this.page();
    await p.mouse.wheel(0, dir === 'down' ? amount : -amount);
  }
  async screenshot(): Promise<Buffer> {
    return (await this.page()).screenshot({ type: 'jpeg', quality: 70 });
  }
  async expectText(text: string, timeout = 5000): Promise<boolean> {
    const p = await this.page();
    try { await p.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
  }
  async waitMs(ms: number): Promise<void> { await (await this.page()).waitForTimeout(Math.min(ms, 15_000)); }

  async newTab(url?: string): Promise<number> {
    await this.page();
    const p = await this.context!.newPage();
    this.track(p);
    if (url) await p.goto(validateUrl(url).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return this.active;
  }
  switchTab(i: number): void {
    if (i < 0 || i >= this.pages.length) throw new Error(`Tab ${i} tidak ada`);
    this.active = i;
  }
  async closeTab(i: number): Promise<void> {
    const p = this.pages[i];
    if (!p) throw new Error(`Tab ${i} tidak ada`);
    await p.close();
  }
  consoleLogs(): string[] { return [...this.logs]; }
  takeDownloads(): string[] { const d = this.downloads; this.downloads = []; return d; }

  startStream(onFrame: (dataUrl: string) => void, fps = 1.5): void {
    this.stopStream();
    this.stream = setInterval(async () => {
      try {
        if (!this.pages[this.active]) return;
        const buf = await this.pages[this.active].screenshot({ type: 'jpeg', quality: 55, timeout: 2000 });
        onFrame(`data:image/jpeg;base64,${buf.toString('base64')}`);
      } catch { /* halaman sedang berpindah */ }
    }, Math.round(1000 / fps));
  }
  stopStream(): void { if (this.stream) clearInterval(this.stream); this.stream = null; }

  async close(): Promise<void> {
    this.stopStream();
    const b = this.browser;
    this.browser = null; this.context = null; this.pages = [];
    await b?.close().catch(() => undefined);
  }
}
