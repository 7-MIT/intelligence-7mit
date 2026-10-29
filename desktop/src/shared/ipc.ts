import { z } from 'zod';

export { CH } from './channels';

const id = z.string().min(1).max(128);
const pathStr = z.string().min(1).max(4096);

const attachment = z.object({
  name: z.string().max(260),
  mime: z.string().max(100),
  size: z.number(),
  /** Gambar: data URL. Teks: isi teks. */
  data: z.string().max(12_000_000)
}).strict();

export const schemas = {
  settingsSet: z.object({
    theme: z.enum(['dark', 'light', 'system']).optional(),
    language: z.enum(['id', 'en']).optional(),
    maxSteps: z.number().int().min(1).max(200).optional(),
    activeProviderId: id.optional(),
    globalShortcut: z.string().max(64).optional(),
    notifications: z.boolean().optional(),
    autoUpdate: z.boolean().optional(),
    controlPreviewFps: z.number().min(0.2).max(4).optional()
  }).strict(),
  permSet: z.object({
    grants: z.record(z.enum(['screen', 'input', 'terminal', 'filesystem', 'browser', 'apps']), z.boolean()).optional(),
    mode: z.enum(['readonly', 'ask', 'auto']).optional(),
    allowedFolders: z.array(pathStr).max(50).optional(),
    autoWorkspaces: z.array(pathStr).max(50).optional(),
    allowScreenshotUpload: z.boolean().optional()
  }).strict(),
  approval: z.object({ id, approved: z.boolean(), remember: z.boolean().optional() }).strict(),
  providerSave: z.object({
    id: id.optional(),
    name: z.string().min(1).max(80),
    kind: z.enum(['openai', 'intelligence7mit']),
    baseUrl: z.string().url().max(500),
    model: z.string().min(1).max(200),
    supportsTools: z.boolean(),
    supportsVision: z.boolean()
  }).strict(),
  providerKey: z.object({ id, key: z.string().max(500) }).strict(),
  idOnly: z.object({ id }).strict(),
  convSave: z.object({
    id,
    title: z.string().max(200),
    mode: z.enum(['chat', 'code', 'web', 'control']),
    workspaceId: id.optional(),
    messages: z.array(z.object({
      id,
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().max(500_000),
      createdAt: z.number(),
      attachments: z.array(z.object({ name: z.string(), mime: z.string(), size: z.number() })).optional(),
      taskId: id.optional()
    })).max(5000),
    createdAt: z.number(),
    updatedAt: z.number()
  }).strict(),
  search: z.object({ query: z.string().max(200) }).strict(),
  wsAdd: z.object({ name: z.string().min(1).max(80), path: pathStr }).strict(),
  taskStart: z.object({
    mode: z.enum(['chat', 'code', 'web', 'control']),
    submode: z.enum(['plan', 'edit', 'agent']).optional(),
    prompt: z.string().min(1).max(100_000),
    conversationId: id.optional(),
    workspaceId: id.optional(),
    capabilities: z.object({ web: z.boolean(), computer: z.boolean() }).strict().optional(),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(200_000) })).max(200).optional(),
    attachments: z.array(attachment).max(8).optional()
  }).strict(),
  fsList: z.object({ path: pathStr }).strict(),
  fsRead: z.object({ path: pathStr }).strict(),
  fsWrite: z.object({ path: pathStr, content: z.string().max(5_000_000) }).strict(),
  gitStatus: z.object({ workspaceId: id }).strict(),
  gitCommit: z.object({ workspaceId: id, message: z.string().min(1).max(500) }).strict(),
  browserNavigate: z.object({ url: z.string().max(2000) }).strict(),
  gitDiff: z.object({ workspaceId: id, path: z.string().max(4096).optional() }).strict(),
  termStart: z.object({ workspaceId: id }).strict(),
  termWrite: z.object({ id, data: z.string().max(10_000) }).strict(),
  externalUrl: z.object({ url: z.string().url().max(2000) }).strict(),
  taskTimeline: z.object({ id }).strict()
};

export type TaskStartInput = z.infer<typeof schemas.taskStart>;
