// Uji LIVE ke backend intelligence.7mit (hanya jika IT7_LIVE=1): Code mode teks end-to-end dengan Hermes.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SevenMitProvider } from '../src/main/agent/llm';
import { SUPABASE_KEY } from '../src/main/auth';
import { BUILTIN_PROVIDER } from '../src/main/store';
import { harness, makeManager, waitFor } from './helpers';

describe.skipIf(process.env.IT7_LIVE !== '1')('LIVE backend bawaan', () => {
  it('Code (mode teks): membuat berkas nyata di workspace lokal setelah persetujuan', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    const provider = new SevenMitProvider(BUILTIN_PROVIDER, SUPABASE_KEY);
    const m = makeManager(h, provider, { maxSteps: 4 });
    m.start({ mode: 'code', submode: 'edit', prompt: 'Buat file halo.html berisi halaman HTML sederhana dengan judul "Halo Dunia" dan satu paragraf.', workspaceId: 'w1' });
    await waitFor(() => ['done', 'error'].includes(m.list()[0].status), 120000);
    const status = m.list()[0].status;
    const shown = h.events.filter((e) => e.type === 'text_done').map((e) => (e as { content: string }).content).join('\n---\n');
    console.log('STATUS', status, '\nFILES', fs.readdirSync(h.ws), '\nCHAT:\n', shown.slice(0, 800));
    expect(status).toBe('done');
    const f = path.join(h.ws, 'halo.html');
    expect(fs.existsSync(f)).toBe(true);
    expect(fs.readFileSync(f, 'utf8').toLowerCase()).toContain('halo dunia');
  }, 150000);
});
