import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, globalShortcut, Menu, nativeImage, nativeTheme, Notification, session, shell, Tray } from 'electron';
import { CH } from '@shared/ipc';
import type { AgentEvent } from '@shared/types';
import { registerIpc, setCrashed } from './ipc';
import { createServices, type Services } from './services';

const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL'];
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let services: Services;
let quitting = false;
let previewTimer: NodeJS.Timeout | null = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

const emit = (e: AgentEvent) => { if (win && !win.isDestroyed()) win.webContents.send(CH.agentEvent, e); };

function appOrigin(): string {
  return isDev ? new URL(process.env['ELECTRON_RENDERER_URL']!).origin : pathToFileURL(path.join(__dirname, '../renderer/')).href;
}
const isTrusted = (url: string) => !!url && url.startsWith(appOrigin());

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1080, minHeight: 680, show: false, backgroundColor: '#05070b', title: 'intelligence.7mit 6 Desktop',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: false
    }
  });
  win.once('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { const u = new URL(url); if (u.protocol === 'https:' || u.protocol === 'http:') void shell.openExternal(u.toString()); } catch { /* abaikan */ }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!isTrusted(url)) { e.preventDefault(); } });
  win.webContents.on('render-process-gone', (_e, d) => {
    console.error('[renderer gone]', d.reason);
    services?.manager.stopAll();
    if (!quitting && d.reason !== 'clean-exit') setTimeout(() => win?.reload(), 500);
  });
  win.on('close', (e) => { if (!quitting && tray && process.platform !== 'darwin') { e.preventDefault(); win?.hide(); } });
  win.on('closed', () => { win = null; });
  if (isDev) void win.loadURL(process.env['ELECTRON_RENDERER_URL']!);
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function applySettings() {
  const s = services.store.getSettings();
  nativeTheme.themeSource = s.theme;
  globalShortcut.unregisterAll();
  try {
    if (s.globalShortcut) globalShortcut.register(s.globalShortcut, () => (win?.isVisible() && win.isFocused() ? win.hide() : showWindow()));
  } catch (e) { console.error('[shortcut]', e); }
}

function setupTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../resources', process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'));
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('intelligence.7mit 6 Desktop');
  const build = () => Menu.buildFromTemplate([
    { label: 'Buka intelligence.7mit', click: showWindow },
    { label: 'Stop AI sekarang', click: () => { services.manager.stopAll(); services.broker.rejectAll(); } },
    { type: 'separator' },
    { label: 'Keluar', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(build());
  tray.on('click', showWindow);
}

/** Pratinjau layar untuk Control Session: hanya ke renderer lokal, tidak dikirim ke penyedia AI. */
function startPreview() {
  stopPreview();
  const fps = services.store.getSettings().controlPreviewFps;
  const tick = async () => {
    if (!services.permissions.getState().grants.screen) return emit({ type: 'capture_status', active: false, reason: 'Izin screen observation dicabut' });
    try {
      const shot = await services.previewSvc.capture(960);
      emit({ type: 'frame', dataUrl: shot.dataUrl, width: shot.width, height: shot.height, at: shot.at });
      emit({ type: 'capture_status', active: true });
    } catch (e) { emit({ type: 'capture_status', active: false, reason: (e as Error).message }); }
  };
  void tick();
  previewTimer = setInterval(tick, Math.round(1000 / fps));
}
function stopPreview() { if (previewTimer) clearInterval(previewTimer); previewTimer = null; emit({ type: 'capture_status', active: false }); }

async function checkUpdate(): Promise<string> {
  if (!app.isPackaged) return 'Pembaruan otomatis hanya aktif pada aplikasi terpasang (build produksi).';
  try {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.autoDownload = true;
    const r = await autoUpdater.checkForUpdates();
    return r?.updateInfo?.version && r.updateInfo.version !== app.getVersion() ? `Versi baru ${r.updateInfo.version} sedang diunduh` : 'Anda memakai versi terbaru';
  } catch (e) { return `Gagal memeriksa pembaruan: ${(e as Error).message}`; }
}

app.whenReady().then(() => {
  app.setAppUserModelId('org.mit7.intelligence.desktop');
  // Tolak semua permintaan izin web (kamera, geolokasi, notifikasi web, dll.) pada renderer.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  services = createServices(emit);
  const { crashed } = services.store.markStarted();
  setCrashed(crashed);
  if (crashed) services.audit.log({ actor: 'system', tool: 'app.recover', decision: 'ok', summary: 'Aplikasi pulih setelah penutupan tidak normal' });

  const hooks = {
    onStart: (t: import('@shared/types').TaskSummary) => { if (t.mode === 'control') startPreview(); if (t.mode === 'web' || t.mode === 'code') services.browser.startStream((dataUrl) => { if (win?.isVisible()) emit({ type: 'browser_frame', dataUrl }); }); },
    onEnd: (t: import('@shared/types').TaskSummary) => {
      services.store.saveTask({ ...t });
      if (t.mode === 'control' && !services.manager.hasRunning('control')) stopPreview();
      const s = services.store.getSettings();
      if (s.notifications && Notification.isSupported() && (!win?.isFocused())) {
        new Notification({ title: 'intelligence.7mit', body: `Task ${t.status === 'done' ? 'selesai' : t.status === 'stopped' ? 'dihentikan' : 'berakhir dengan error'}: ${t.title}` }).show();
      }
    }
  };
  services.manager.setHooks(hooks);
  // Pencabutan izin langsung menutup sesi yang bergantung padanya.
  services.permissions.onChange((st) => {
    if (!st.grants.terminal) services.term.killAll();
    if (!st.grants.browser) void services.browser.close();
  });

  registerIpc(services, { getWindow: () => win, isTrusted, applySettings, checkUpdate, startBrowserStream: () => services.browser.startStream((dataUrl) => { if (win?.isVisible()) emit({ type: 'browser_frame', dataUrl }); }) });
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]) : null);
  createWindow();
  setupTray();
  applySettings();
  if (app.isPackaged && services.store.getSettings().autoUpdate) void checkUpdate();
  app.on('activate', () => showWindow());
});

app.on('before-quit', () => {
  quitting = true;
  services?.manager.stopAll();
  services?.term.killAll();
  void services?.browser.close();
  services?.store.markClean();
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !tray) app.quit(); });
