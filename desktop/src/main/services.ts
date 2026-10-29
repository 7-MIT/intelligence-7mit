import path from 'node:path';
import { app, safeStorage, shell } from 'electron';
import type { AgentEvent, ApprovalRequest } from '@shared/types';
import { BrowserController } from './browser/controller';
import { NutDriver } from './control/driver';
import { FileSystemAgent } from './control/fs-agent';
import { KeyboardController } from './control/keyboard';
import { MouseController } from './control/mouse';
import { ScreenshotService } from './control/screenshot';
import { TerminalExecutor } from './control/terminal';
import { AgentTaskManager } from './agent/manager';
import { OpenAICompatProvider, SevenMitProvider, type LLMProvider } from './agent/llm';
import { clipboardLike, electronCapturer, platformServices, pointerProbe } from './platform-services';
import { ApprovalBroker } from './security/approvals';
import { AuditLogger } from './security/audit';
import { PathGuard } from './security/paths';
import { PermissionManager } from './security/permissions';
import { Store } from './store';
import { AuthService, SUPABASE_KEY, setTestBaseUrl } from './auth';
import { HistorySync } from './history-sync';
import { ToolExecutor } from './tools/executor';
import { buildTools } from './tools/definitions';


export function createServices(emit: (e: AgentEvent) => void) {
  const dir = app.getPath('userData');
  const store = new Store(dir, {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => safeStorage.encryptString(s).toString('base64'),
    decrypt: (s) => safeStorage.decryptString(Buffer.from(s, 'base64'))
  });
  if (!app.isPackaged && process.env.IT7_E2E === '1' && process.env.IT7_SUPABASE_URL) setTestBaseUrl(process.env.IT7_SUPABASE_URL);
  const auth = new AuthService({ load: () => store.loadAuth(), save: (a) => store.saveAuth(a) });
  const history = new HistorySync(auth, store);
  const audit = new AuditLogger(path.join(dir, 'audit', 'audit.jsonl'));
  let taskOf = new Map<string, string | undefined>();
  let manager: AgentTaskManager;
  const broker = new ApprovalBroker((type, payload) => {
    if (type === 'request') {
      const r = payload as ApprovalRequest;
      taskOf.set(r.id, r.taskId);
      emit({ type: 'approval', request: r });
      manager?.onApproval('request', r, r.taskId);
    } else {
      const r = payload as { id: string; approved: boolean };
      emit({ type: 'approval_resolved', id: r.id, approved: r.approved });
      manager?.onApproval('resolved', r, taskOf.get(r.id));
      taskOf.delete(r.id);
    }
  });
  const permissions = new PermissionManager({ load: () => store.loadPermissions(), save: (s) => store.savePermissions(s) }, audit, broker);
  const guard = new PathGuard(() => permissions.getState().allowedFolders);
  const fsAgent = new FileSystemAgent(guard, (p) => shell.trashItem(p));
  const term = new TerminalExecutor();
  const driver = new NutDriver();
  const screenSvc = new ScreenshotService(electronCapturer);
  const previewSvc = new ScreenshotService(electronCapturer); // terpisah agar peta koordinat agen tidak berubah
  const mouse = new MouseController(driver, pointerProbe);
  const pasteCombo = process.platform === 'darwin' ? 'meta+v' : 'ctrl+v';
  const keyboard = new KeyboardController(driver, clipboardLike, pasteCombo);
  const browser = new BrowserController(path.join(app.getPath('downloads'), 'intelligence-7mit'));
  const executor = new ToolExecutor(permissions, audit);
  executor.register(...buildTools({
    fs: fsAgent, term, screen: screenSvc, mouse, keyboard, driver, browser,
    memory: { read: (id) => store.memoryRead(id), write: (id, t, r) => store.memoryWrite(id, t, r) },
    platform: platformServices
  }));

  const getProvider = (): LLMProvider => {
    const s = store.getSettings();
    const cfg = store.getProvider(s.activeProviderId) ?? store.listProviders()[0];
    return cfg.kind === 'intelligence7mit' ? new SevenMitProvider(cfg, SUPABASE_KEY, fetch, { token: () => auth.accessToken(), context: () => auth.accountContext() }) : new OpenAICompatProvider(cfg, () => store.getKey(cfg.id));
  };

  manager = new AgentTaskManager({
    executor, permissions, broker, audit, getProvider,
    getSettings: () => store.getSettings(),
    getWorkspace: (id) => store.getWorkspace(id),
    memoryRead: (id) => store.memoryRead(id),
    emit, platform: process.platform
  });

  return { auth, history, store, audit, broker, permissions, guard, fsAgent, term, driver, screenSvc, previewSvc, mouse, browser, executor, manager, getProvider };
}

export type Services = ReturnType<typeof createServices>;
