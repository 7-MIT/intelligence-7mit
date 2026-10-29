import type { AgentEvent, AgentMode, PermissionKind, Risk, Workspace } from '@shared/types';

export type PropType = 'string' | 'number' | 'integer' | 'boolean' | 'string[]';
export interface PropSpec {
  type: PropType;
  description: string;
  optional?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
}
export type ArgSchema = Record<string, PropSpec>;

export interface ToolContext {
  taskId: string;
  mode: AgentMode;
  /** Daftar tool yang ditawarkan untuk task ini; tool lain ditolak walau model memanggilnya. */
  allowedTools?: ReadonlySet<string>;
  workspace?: Workspace;
  signal: AbortSignal;
  emit: (e: AgentEvent) => void;
  /** Apakah screenshot boleh dikirim ke penyedia AI (izin pengguna). */
  allowImages: boolean;
  tainted: boolean;
  setTainted: () => void;
  /** Diset tool pembaruan rencana. */
  setPlan?: (steps: { title: string; status?: string }[]) => void;
}

export interface ToolPlan {
  risk: Risk;
  summary: string;
  detail?: string;
  readOnly: boolean;
  blocked?: string;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  images?: string[]; // data URL
  /** Sumber konten tak tepercaya (web/dokumen/terminal). Output akan dibungkus & dipindai. */
  untrusted?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  kind: PermissionKind;
  args: ArgSchema;
  /** Tool yang mengubah sesuatu; dilarang pada sub-mode Plan. */
  mutates: boolean;
  /** Tool internal tanpa efek ke OS (rencana, memori). Tidak melalui prompt izin, tetap diaudit. */
  meta?: boolean;
  plan(args: Record<string, unknown>, ctx: ToolContext): ToolPlan | Promise<ToolPlan>;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export function toSpec(t: ToolDef): ToolSpec {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [k, p] of Object.entries(t.args)) {
    const base = p.type === 'string[]' ? { type: 'array', items: { type: 'string' } } : { type: p.type };
    properties[k] = { ...base, description: p.description, ...(p.enum ? { enum: p.enum } : {}), ...(p.min !== undefined ? { minimum: p.min } : {}), ...(p.max !== undefined ? { maximum: p.max } : {}) };
    if (!p.optional) required.push(k);
  }
  return { type: 'function', function: { name: t.name, description: t.description, parameters: { type: 'object', properties, required, additionalProperties: false } } };
}

/** Validasi argumen dari model terhadap skema; melempar Error berpesan jelas agar model dapat memperbaiki. */
export function validateArgs(schema: ArgSchema, raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Argumen harus berupa objek JSON');
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) if (!(key in schema)) throw new Error(`Argumen tidak dikenal: "${key}"`);
  for (const [key, spec] of Object.entries(schema)) {
    let v = input[key];
    if (v === undefined || v === null) {
      if (!spec.optional) throw new Error(`Argumen wajib hilang: "${key}"`);
      continue;
    }
    switch (spec.type) {
      case 'string':
        if (typeof v !== 'string') throw new Error(`"${key}" harus string`);
        if (spec.enum && !spec.enum.includes(v)) throw new Error(`"${key}" harus salah satu dari: ${spec.enum.join(', ')}`);
        if (v.length > 200_000) throw new Error(`"${key}" terlalu panjang`);
        break;
      case 'number':
      case 'integer':
        if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`"${key}" harus angka`);
        if (spec.type === 'integer' && !Number.isInteger(v)) throw new Error(`"${key}" harus bilangan bulat`);
        if (spec.min !== undefined && v < spec.min) throw new Error(`"${key}" minimal ${spec.min}`);
        if (spec.max !== undefined && v > spec.max) throw new Error(`"${key}" maksimal ${spec.max}`);
        break;
      case 'boolean':
        if (typeof v !== 'boolean') throw new Error(`"${key}" harus boolean`);
        break;
      case 'string[]':
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error(`"${key}" harus array string`);
        if (v.length > 100) throw new Error(`"${key}" terlalu banyak elemen`);
        break;
    }
    out[key] = v;
  }
  return out;
}
