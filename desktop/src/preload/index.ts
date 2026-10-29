import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CH } from '../shared/channels';

/** Satu-satunya permukaan yang terlihat renderer. Tidak ada akses Node, fs, atau electron mentah. */
const invoke = (channel: string) => (arg?: unknown) => ipcRenderer.invoke(channel, arg);
const on = <T>(channel: string, cb: (payload: T) => void) => {
  const h = (_e: IpcRendererEvent, p: T) => cb(p);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

const api = {
  settings: { get: invoke(CH.settingsGet), set: invoke(CH.settingsSet) },
  system: { status: invoke(CH.systemStatus), info: invoke(CH.appInfo), openExternal: (url: string) => ipcRenderer.invoke(CH.openExternal, { url }), checkUpdate: invoke(CH.updateCheck) },
  perm: { get: invoke(CH.permGet), set: invoke(CH.permSet), requestMac: invoke(CH.permRequestMac), respond: invoke(CH.approvalRespond) },
  provider: { list: invoke(CH.providersList), save: invoke(CH.providerSave), remove: invoke(CH.providerDelete), setKey: invoke(CH.providerKey), test: invoke(CH.providerTest), models: invoke(CH.providerModels) },
  conv: { list: invoke(CH.convList), get: invoke(CH.convGet), save: invoke(CH.convSave), remove: invoke(CH.convDelete), search: invoke(CH.convSearch) },
  ws: { list: invoke(CH.wsList), add: invoke(CH.wsAdd), remove: invoke(CH.wsRemove), pick: invoke(CH.wsPick) },
  task: { start: invoke(CH.taskStart), pause: invoke(CH.taskPause), resume: invoke(CH.taskResume), stop: invoke(CH.taskStop), stopAll: invoke(CH.taskStopAll), list: invoke(CH.taskList), timeline: invoke(CH.taskTimeline) },
  fs: { list: invoke(CH.fsList), read: invoke(CH.fsRead), write: invoke(CH.fsWrite) },
  git: { status: invoke(CH.gitStatus), diff: invoke(CH.gitDiff), commit: invoke(CH.gitCommit) },
  term: { start: invoke(CH.termStart), write: invoke(CH.termWrite), kill: invoke(CH.termKill), onData: (cb: (p: { id: string; data: string }) => void) => on(CH.termData, cb) },
  browser: { state: invoke(CH.browserState), navigate: invoke(CH.browserNavigate), close: invoke(CH.browserClose) },
  auth: { status: invoke(CH.authStatus), signIn: invoke(CH.authSignIn), signUp: invoke(CH.authSignUp), recover: invoke(CH.authRecover), sso: invoke(CH.authSso), signOut: invoke(CH.authSignOut), guest: invoke(CH.authGuest) },
  history: { sync: invoke(CH.historySync) },
  audit: { list: invoke(CH.auditList), export: invoke(CH.auditExport) },
  onAgentEvent: (cb: (e: unknown) => void) => on(CH.agentEvent, cb),
  onNavigate: (cb: (page: string) => void) => on(CH.navigate, cb)
};

contextBridge.exposeInMainWorld('it7', api);
export type It7Api = typeof api;
