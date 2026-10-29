import path from 'node:path';
import type { InputDriver } from '../control/driver';
import type { FileSystemAgent } from '../control/fs-agent';
import type { KeyboardController } from '../control/keyboard';
import type { MouseController } from '../control/mouse';
import type { ScreenshotService } from '../control/screenshot';
import type { TerminalExecutor } from '../control/terminal';
import type { BrowserController } from '../browser/controller';
import { RISKY_LABEL, validateUrl } from '../browser/controller';
import { unifiedDiff } from '../control/diff';
import { comboRisk, parseKeyCombo } from '../control/keys';
import { classifyCommand, verdictToRisk } from '../security/shell-guard';
import { sanitizedEnv } from '../control/terminal';
import type { ToolDef, ToolResult, ToolContext } from './types';
import type { Risk } from '@shared/types';

export interface Services {
  fs: FileSystemAgent;
  term: TerminalExecutor;
  screen: ScreenshotService;
  mouse: MouseController;
  keyboard: KeyboardController;
  driver: InputDriver;
  browser: BrowserController;
  memory: { read(workspaceId: string): string; write(workspaceId: string, text: string, replace: boolean): void };
  platform: {
    openApp(name: string): Promise<string>;
    listApps(): Promise<string[]>;
    windowOp(op: 'maximize' | 'close', title: string): Promise<string>;
    openPath(p: string): Promise<string>;
  };
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function resolvePath(ctx: ToolContext, p: string): string {
  if (path.isAbsolute(p)) return p;
  if (!ctx.workspace) throw new Error('Tidak ada workspace aktif; gunakan path absolut di dalam folder yang diizinkan.');
  return path.resolve(ctx.workspace.path, p);
}

const trunc = (s: string, n = 120) => (s.length > n ? s.slice(0, n) + '…' : s);

export function buildTools(s: Services): ToolDef[] {
  const sleep = s.sleep ?? defaultSleep;
  const tools: ToolDef[] = [];

  // ───────────── Meta ─────────────
  tools.push(
    {
      name: 'update_plan', kind: 'filesystem', meta: true, mutates: false,
      description: 'Tampilkan/perbarui rencana tugas ke pengguna. Panggil di awal tugas multilangkah dan setiap kali ada kemajuan.',
      args: {
        steps: { type: 'string[]', description: 'Daftar langkah rencana, berurutan' },
        done: { type: 'integer', description: 'Jumlah langkah pertama yang sudah selesai', optional: true, min: 0, max: 100 },
        failed: { type: 'boolean', description: 'Tandai langkah aktif sebagai gagal', optional: true }
      },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Perbarui rencana (${(a.steps as string[]).length} langkah)` }),
      async run(a, ctx) {
        const steps = a.steps as string[];
        const done = (a.done as number | undefined) ?? 0;
        ctx.setPlan?.(steps.map((title, i) => ({ title, status: i < done ? 'done' : i === done ? (a.failed ? 'failed' : 'active') : 'pending' })));
        return { ok: true, output: 'Rencana diperbarui.' };
      }
    },
    {
      name: 'memory_read', kind: 'filesystem', meta: true, mutates: false,
      description: 'Baca catatan memori workspace (fakta proyek, preferensi, keputusan sebelumnya).',
      args: {},
      plan: () => ({ risk: 'low', readOnly: true, summary: 'Baca memori workspace' }),
      async run(_a, ctx) {
        if (!ctx.workspace) return { ok: false, output: 'Tidak ada workspace aktif.' };
        return { ok: true, output: s.memory.read(ctx.workspace.id) || '(memori kosong)' };
      }
    },
    {
      name: 'memory_write', kind: 'filesystem', meta: true, mutates: true,
      description: 'Simpan catatan singkat ke memori workspace untuk sesi mendatang. Jangan simpan rahasia/kredensial.',
      args: { note: { type: 'string', description: 'Catatan singkat (maks 2000 karakter)' }, replace: { type: 'boolean', description: 'Ganti seluruh memori, bukan menambah', optional: true } },
      plan: (a) => ({ risk: 'low', readOnly: false, summary: `Simpan memori: ${trunc(a.note as string, 60)}` }),
      async run(a, ctx) {
        if (!ctx.workspace) return { ok: false, output: 'Tidak ada workspace aktif.' };
        const note = (a.note as string).slice(0, 2000);
        if (/(-----BEGIN|api[_-]?key\s*[:=]|password\s*[:=]|sk-[A-Za-z0-9]{16,})/i.test(note)) return { ok: false, output: 'Catatan tampak berisi rahasia; tidak disimpan.' };
        s.memory.write(ctx.workspace.id, note, !!a.replace);
        return { ok: true, output: 'Memori disimpan.' };
      }
    }
  );

  // ───────────── File system ─────────────
  tools.push(
    {
      name: 'list_dir', kind: 'filesystem', mutates: false,
      description: 'Daftar isi folder (path relatif terhadap workspace).',
      args: { path: { type: 'string', description: 'Path folder; default workspace', optional: true } },
      plan(a, ctx) {
        const p = s.fs.resolve(resolvePath(ctx, (a.path as string) ?? '.'));
        return { risk: 'low', readOnly: true, summary: `Daftar folder ${p}` };
      },
      async run(a, ctx) {
        const items = await s.fs.list(resolvePath(ctx, (a.path as string) ?? '.'));
        return { ok: true, output: items.slice(0, 300).map((e) => `${e.isDir ? 'd' : '-'} ${e.name}${e.isDir ? '/' : ` (${e.size}B)`}`).join('\n') || '(kosong)', untrusted: 'nama berkas' };
      }
    },
    {
      name: 'read_file', kind: 'filesystem', mutates: false,
      description: 'Baca berkas teks. Dapat membatasi baris. Berkas kredensial/kunci privat diblokir.',
      args: {
        path: { type: 'string', description: 'Path berkas' },
        start_line: { type: 'integer', description: 'Baris awal (1-based)', optional: true, min: 1 },
        end_line: { type: 'integer', description: 'Baris akhir', optional: true, min: 1 }
      },
      plan(a, ctx) {
        const p = s.fs.resolve(resolvePath(ctx, a.path as string));
        return { risk: 'low', readOnly: true, summary: `Baca ${p}` };
      },
      async run(a, ctx) {
        const r = await s.fs.read(resolvePath(ctx, a.path as string));
        let text = r.content;
        const from = a.start_line as number | undefined;
        const to = a.end_line as number | undefined;
        if (from || to) text = text.split('\n').slice((from ?? 1) - 1, to ?? undefined).join('\n');
        const numbered = text.split('\n').map((l, i) => `${(from ?? 1) + i}\t${l}`).join('\n');
        return { ok: true, output: numbered + (r.truncated ? '\n… (berkas dipotong)' : ''), untrusted: `berkas ${path.basename(a.path as string)}` };
      }
    },
    {
      name: 'search_files', kind: 'filesystem', mutates: false,
      description: 'Cari berkas berdasarkan nama (glob, mis. *.ts) dan/atau isi teks.',
      args: {
        path: { type: 'string', description: 'Folder awal; default workspace', optional: true },
        name: { type: 'string', description: 'Pola nama berkas (glob)', optional: true },
        text: { type: 'string', description: 'Teks yang dicari dalam isi berkas', optional: true },
        max: { type: 'integer', description: 'Maks hasil', optional: true, min: 1, max: 500 }
      },
      plan(a, ctx) {
        if (!a.name && !a.text) throw new Error('Isi "name" atau "text".');
        const p = s.fs.resolve(resolvePath(ctx, (a.path as string) ?? '.'));
        return { risk: 'low', readOnly: true, summary: `Cari di ${p}: ${a.name ?? ''} ${a.text ?? ''}`.trim() };
      },
      async run(a, ctx) {
        const r = await s.fs.search(resolvePath(ctx, (a.path as string) ?? '.'), { name: a.name as string | undefined, text: a.text as string | undefined, max: a.max as number | undefined }, ctx.signal);
        return { ok: true, output: r.join('\n') || '(tidak ada hasil)', untrusted: 'hasil pencarian' };
      }
    },
    {
      name: 'write_file', kind: 'filesystem', mutates: true,
      description: 'Buat atau timpa berkas dengan isi lengkap. Pengguna melihat diff sebelum diterapkan.',
      args: { path: { type: 'string', description: 'Path berkas' }, content: { type: 'string', description: 'Isi lengkap berkas' } },
      async plan(a, ctx) {
        const p = s.fs.resolve(resolvePath(ctx, a.path as string), true);
        const old = await s.fs.readIfExists(p).catch(() => null);
        const diff = unifiedDiff(old ?? '', a.content as string, path.basename(p));
        return { risk: 'medium', readOnly: false, summary: old === null ? `Buat berkas ${p}` : `Ubah berkas ${p}`, detail: diff };
      },
      async run(a, ctx) {
        await s.fs.write(resolvePath(ctx, a.path as string), a.content as string);
        return { ok: true, output: `Tersimpan: ${a.path} (${(a.content as string).length} karakter)` };
      }
    },
    {
      name: 'edit_file', kind: 'filesystem', mutates: true,
      description: 'Ganti teks persis dalam berkas. old_string harus unik kecuali replace_all=true.',
      args: {
        path: { type: 'string', description: 'Path berkas' },
        old_string: { type: 'string', description: 'Teks yang diganti (persis, termasuk indentasi)' },
        new_string: { type: 'string', description: 'Teks pengganti' },
        replace_all: { type: 'boolean', description: 'Ganti semua kemunculan', optional: true }
      },
      async plan(a, ctx) {
        const p = s.fs.resolve(resolvePath(ctx, a.path as string), true);
        const old = await s.fs.readIfExists(p);
        if (old === null) throw new Error('Berkas tidak ada; gunakan write_file.');
        const needle = a.old_string as string;
        const count = needle ? old.split(needle).length - 1 : 0;
        if (count === 0) throw new Error('old_string tidak ditemukan. Baca ulang berkas lalu salin teks persis.');
        if (count > 1 && !a.replace_all) throw new Error(`old_string muncul ${count} kali; tambah konteks atau set replace_all=true.`);
        const next = a.replace_all ? old.split(needle).join(a.new_string as string) : old.replace(needle, () => a.new_string as string);
        return { risk: 'medium', readOnly: false, summary: `Edit ${p}`, detail: unifiedDiff(old, next, path.basename(p)) };
      },
      async run(a, ctx) {
        const p = resolvePath(ctx, a.path as string);
        const old = (await s.fs.readIfExists(p)) ?? '';
        const needle = a.old_string as string;
        const next = a.replace_all ? old.split(needle).join(a.new_string as string) : old.replace(needle, () => a.new_string as string);
        await s.fs.write(p, next);
        return { ok: true, output: `Diedit: ${a.path}` };
      }
    },
    {
      name: 'make_dir', kind: 'filesystem', mutates: true,
      description: 'Buat folder (termasuk induknya).', args: { path: { type: 'string', description: 'Path folder' } },
      plan(a, ctx) { return { risk: 'medium', readOnly: false, summary: `Buat folder ${s.fs.resolve(resolvePath(ctx, a.path as string), true)}` }; },
      async run(a, ctx) { await s.fs.mkdir(resolvePath(ctx, a.path as string)); return { ok: true, output: 'Folder dibuat.' }; }
    },
    {
      name: 'copy_path', kind: 'filesystem', mutates: true,
      description: 'Salin berkas/folder. Gagal bila tujuan sudah ada.',
      args: { from: { type: 'string', description: 'Sumber' }, to: { type: 'string', description: 'Tujuan' } },
      plan(a, ctx) { return { risk: 'medium', readOnly: false, summary: `Salin ${s.fs.resolve(resolvePath(ctx, a.from as string))} → ${s.fs.resolve(resolvePath(ctx, a.to as string), true)}` }; },
      async run(a, ctx) { await s.fs.copy(resolvePath(ctx, a.from as string), resolvePath(ctx, a.to as string)); return { ok: true, output: 'Disalin.' }; }
    },
    {
      name: 'move_path', kind: 'filesystem', mutates: true,
      description: 'Pindahkan atau ganti nama berkas/folder. Gagal bila tujuan sudah ada.',
      args: { from: { type: 'string', description: 'Sumber' }, to: { type: 'string', description: 'Tujuan' } },
      plan(a, ctx) { return { risk: 'medium', readOnly: false, summary: `Pindah/ganti nama ${s.fs.resolve(resolvePath(ctx, a.from as string), true)} → ${s.fs.resolve(resolvePath(ctx, a.to as string), true)}` }; },
      async run(a, ctx) { await s.fs.move(resolvePath(ctx, a.from as string), resolvePath(ctx, a.to as string)); return { ok: true, output: 'Dipindahkan.' }; }
    },
    {
      name: 'delete_path', kind: 'filesystem', mutates: true,
      description: 'Hapus berkas/folder (dipindahkan ke Trash/Recycle Bin). Selalu meminta konfirmasi pengguna.',
      args: { path: { type: 'string', description: 'Path yang dihapus' } },
      plan(a, ctx) { return { risk: 'high', readOnly: false, summary: `HAPUS ${s.fs.resolve(resolvePath(ctx, a.path as string), true)} (ke Trash)` }; },
      async run(a, ctx) { await s.fs.remove(resolvePath(ctx, a.path as string)); return { ok: true, output: 'Dipindahkan ke Trash/Recycle Bin.' }; }
    },
    {
      name: 'open_path', kind: 'filesystem', mutates: true,
      description: 'Buka berkas/folder dengan aplikasi default sistem (bukan executable/skrip).',
      args: { path: { type: 'string', description: 'Path berkas atau folder' } },
      plan(a, ctx) { return { risk: 'medium', readOnly: false, summary: `Buka ${s.fs.checkOpenable(resolvePath(ctx, a.path as string))}` }; },
      async run(a, ctx) {
        const err = await s.platform.openPath(s.fs.checkOpenable(resolvePath(ctx, a.path as string)));
        return err ? { ok: false, output: err } : { ok: true, output: 'Dibuka.' };
      }
    }
  );

  // ───────────── Terminal ─────────────
  tools.push({
    name: 'run_command', kind: 'terminal', mutates: true,
    description: 'Jalankan satu perintah shell di workspace (build, test, git, instal dependency). Perintah berbahaya diblokir; yang mengubah sistem meminta persetujuan. Output ditampilkan; tidak interaktif.',
    args: {
      command: { type: 'string', description: 'Perintah shell' },
      cwd: { type: 'string', description: 'Direktori kerja; default workspace', optional: true },
      timeout_sec: { type: 'integer', description: 'Batas waktu detik (default 120, maks 600)', optional: true, min: 1, max: 600 }
    },
    plan(a, ctx) {
      const cwd = s.fs.resolve(resolvePath(ctx, (a.cwd as string) ?? '.'));
      const v = classifyCommand(a.command as string);
      return { risk: verdictToRisk(v), readOnly: v.level === 'low', blocked: v.level === 'blocked' ? v.reason : undefined, summary: `$ ${trunc(a.command as string, 160)}  (di ${cwd})`, detail: `${a.command}\n\nKlasifikasi: ${v.level} — ${v.reason}` };
    },
    async run(a, ctx) {
      const cwd = resolvePath(ctx, (a.cwd as string) ?? '.');
      const r = await s.term.run(a.command as string, s.fs.resolve(cwd), { timeoutMs: ((a.timeout_sec as number) ?? 120) * 1000, signal: ctx.signal, env: sanitizedEnv() });
      const head = r.aborted ? '[dihentikan]' : r.timedOut ? '[timeout]' : `[exit ${r.exitCode}]`;
      return { ok: r.exitCode === 0 && !r.timedOut && !r.aborted, output: `${head}\n${r.output}${r.truncated ? '\n… (output dipotong)' : ''}`, untrusted: 'output terminal' };
    }
  });

  // ───────────── Computer control ─────────────
  const needImages = (ctx: ToolContext) => {
    if (!ctx.allowImages) throw new Error('Pengiriman screenshot ke penyedia AI belum diizinkan. Aktifkan "Izinkan kirim screenshot" di Permission Center.');
  };
  const targetEvent = (ctx: ToolContext, x: number, y: number, action: string) => {
    const shot = s.screen.getLast();
    if (shot) ctx.emit({ type: 'target', taskId: ctx.taskId, x, y, action, width: shot.width, height: shot.height });
  };
  const verify = async (ctx: ToolContext, before: string | undefined, label: string): Promise<ToolResult> => {
    await sleep(700);
    if (!ctx.allowImages) return { ok: true, output: `${label}. (verifikasi visual dilewati: screenshot tidak diizinkan)` };
    const shot = await s.screen.capture();
    ctx.emit({ type: 'frame', dataUrl: shot.dataUrl, width: shot.width, height: shot.height, at: shot.at });
    const same = before !== undefined && before === shot.hash;
    return {
      ok: true,
      output: `${label}. Screenshot verifikasi ${shot.width}x${shot.height} terlampir.${same ? ' PERINGATAN: layar tidak berubah sama sekali — tindakan mungkin tidak berefek (jendela berprivilege lebih tinggi / fokus salah / tidak ada respons).' : ''}`,
      images: [shot.dataUrl]
    };
  };
  const xy = { x: { type: 'number', description: 'Koordinat X pada piksel screenshot terakhir', min: 0 }, y: { type: 'number', description: 'Koordinat Y pada piksel screenshot terakhir', min: 0 } } as const;

  tools.push(
    {
      name: 'screenshot', kind: 'screen', mutates: false,
      description: 'Ambil screenshot layar utama. Koordinat untuk click/move/drag memakai piksel gambar ini. Selalu panggil sebelum menunjuk koordinat dan setelah tindakan untuk memverifikasi.',
      args: {},
      plan: (_a, ctx) => { needImages(ctx); return { risk: 'low', readOnly: true, summary: 'Ambil screenshot layar' }; },
      async run(_a, ctx) {
        const shot = await s.screen.capture();
        ctx.emit({ type: 'frame', dataUrl: shot.dataUrl, width: shot.width, height: shot.height, at: shot.at });
        return { ok: true, output: `Screenshot ${shot.width}x${shot.height}. Koordinat (0,0) di kiri-atas.`, images: [shot.dataUrl] };
      }
    },
    {
      name: 'mouse_move', kind: 'input', mutates: true, description: 'Pindahkan pointer ke koordinat.', args: { ...xy },
      plan: (a) => ({ risk: 'low', readOnly: false, summary: `Pindahkan pointer ke (${a.x}, ${a.y})` }),
      async run(a, ctx) {
        const shot = s.screen.getLast();
        const p = s.screen.toScreen(a.x as number, a.y as number);
        targetEvent(ctx, a.x as number, a.y as number, 'move');
        await s.mouse.move(p);
        return { ok: true, output: `Pointer di (${a.x}, ${a.y})` + (shot ? '' : '') };
      }
    },
    {
      name: 'click', kind: 'input', mutates: true,
      description: 'Klik pada koordinat screenshot. clicks=2 untuk double click. Hasil diverifikasi otomatis dengan screenshot.',
      args: { ...xy, button: { type: 'string', description: 'Tombol mouse', enum: ['left', 'right', 'middle'], optional: true }, clicks: { type: 'integer', description: '1 klik, 2 double click', optional: true, min: 1, max: 3 } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `${(a.clicks as number) === 2 ? 'Double click' : (a.button as string) === 'right' ? 'Klik kanan' : 'Klik'} di (${a.x}, ${a.y})` }),
      async run(a, ctx) {
        const before = s.screen.getLast()?.hash;
        const p = s.screen.toScreen(a.x as number, a.y as number);
        targetEvent(ctx, a.x as number, a.y as number, 'click');
        await s.mouse.click(p, (a.button as 'left' | 'right' | 'middle') ?? 'left', (a.clicks as number) ?? 1);
        return verify(ctx, before, `Klik di (${a.x}, ${a.y})`);
      }
    },
    {
      name: 'drag', kind: 'input', mutates: true, description: 'Seret dari satu titik ke titik lain (drag and drop).',
      args: { from_x: { type: 'number', description: 'X awal', min: 0 }, from_y: { type: 'number', description: 'Y awal', min: 0 }, to_x: { type: 'number', description: 'X akhir', min: 0 }, to_y: { type: 'number', description: 'Y akhir', min: 0 } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `Seret (${a.from_x}, ${a.from_y}) → (${a.to_x}, ${a.to_y})` }),
      async run(a, ctx) {
        const before = s.screen.getLast()?.hash;
        const f = s.screen.toScreen(a.from_x as number, a.from_y as number);
        const t = s.screen.toScreen(a.to_x as number, a.to_y as number);
        targetEvent(ctx, a.to_x as number, a.to_y as number, 'drag');
        await s.mouse.drag(f, t);
        return verify(ctx, before, 'Drag selesai');
      }
    },
    {
      name: 'scroll', kind: 'input', mutates: true,
      description: 'Gulir di posisi tertentu (opsional). amount positif = ke bawah/kanan, negatif = ke atas/kiri.',
      args: { amount: { type: 'integer', description: 'Jumlah langkah gulir (-50..50)', min: -50, max: 50 }, horizontal: { type: 'boolean', description: 'Gulir horizontal', optional: true }, x: { type: 'number', description: 'X posisi gulir', optional: true, min: 0 }, y: { type: 'number', description: 'Y posisi gulir', optional: true, min: 0 } },
      plan: (a) => ({ risk: 'low', readOnly: false, summary: `Gulir ${a.amount}${a.horizontal ? ' horizontal' : ''}` }),
      async run(a, ctx) {
        const before = s.screen.getLast()?.hash;
        const at = a.x !== undefined && a.y !== undefined ? s.screen.toScreen(a.x as number, a.y as number) : undefined;
        if (at) targetEvent(ctx, a.x as number, a.y as number, 'scroll');
        await s.mouse.scroll(a.horizontal ? (a.amount as number) : 0, a.horizontal ? 0 : (a.amount as number), at);
        return verify(ctx, before, 'Gulir selesai');
      }
    },
    {
      name: 'type_text', kind: 'input', mutates: true,
      description: 'Ketik teks pada elemen yang sedang fokus (klik dulu field-nya). Jangan mengetik kata sandi atau rahasia.',
      args: { text: { type: 'string', description: 'Teks yang diketik (maks 5000 karakter)' } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `Ketik teks: "${trunc((a.text as string).replace(/\n/g, '⏎'), 80)}"`, detail: a.text as string }),
      async run(a, ctx) {
        const before = s.screen.getLast()?.hash;
        const r = await s.keyboard.type(a.text as string);
        return verify(ctx, before, `Mengetik ${(a.text as string).length} karakter (${r.method})`);
      }
    },
    {
      name: 'press_keys', kind: 'input', mutates: true,
      description: 'Tekan tombol/shortcut, mis. "enter", "ctrl+s", "cmd+space", "alt+tab". Gunakan "cmd" untuk Command di macOS.',
      args: { keys: { type: 'string', description: 'Kombinasi dipisah +' } },
      plan(a) {
        const c = parseKeyCombo(a.keys as string);
        return { risk: comboRisk(c), readOnly: false, summary: `Tekan ${a.keys}` };
      },
      async run(a, ctx) {
        const before = s.screen.getLast()?.hash;
        await s.keyboard.press(a.keys as string);
        return verify(ctx, before, `Menekan ${a.keys}`);
      }
    },
    {
      name: 'wait', kind: 'screen', mutates: false, meta: true, description: 'Tunggu beberapa detik (mis. aplikasi sedang memuat).',
      args: { seconds: { type: 'number', description: 'Detik (0.5–15)', min: 0.5, max: 15 } },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Tunggu ${a.seconds} detik` }),
      async run(a) { await sleep((a.seconds as number) * 1000); return { ok: true, output: 'Selesai menunggu.' }; }
    },
    {
      name: 'list_windows', kind: 'apps', mutates: false, description: 'Daftar jendela yang terbuka (id, judul, posisi).', args: {},
      plan: () => ({ risk: 'low', readOnly: true, summary: 'Daftar jendela terbuka' }),
      async run() {
        const w = await s.driver.listWindows();
        return { ok: true, output: w.map((x) => `#${x.id} "${x.title}" ${x.width}x${x.height}@${x.x},${x.y}`).join('\n') || '(tidak ada jendela)', untrusted: 'judul jendela' };
      }
    },
    {
      name: 'focus_window', kind: 'apps', mutates: true, description: 'Pindahkan fokus ke jendela (id dari list_windows).',
      args: { id: { type: 'integer', description: 'ID jendela' } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `Fokus ke jendela #${a.id}` }),
      async run(a) { const ok = await s.driver.focusWindow(a.id as number); return { ok, output: ok ? 'Jendela difokuskan.' : 'Gagal memfokuskan jendela (izin Accessibility / jendela hilang).' }; }
    },
    {
      name: 'window_action', kind: 'apps', mutates: true,
      description: 'Minimize/maximize/restore/close jendela. close mengirim permintaan tutup normal sehingga aplikasi dapat menanyakan penyimpanan; selalu butuh persetujuan.',
      args: { id: { type: 'integer', description: 'ID jendela' }, action: { type: 'string', description: 'Aksi', enum: ['minimize', 'maximize', 'restore', 'close'] } },
      plan: (a) => ({ risk: a.action === 'close' ? 'high' : 'medium', readOnly: false, summary: `${a.action} jendela #${a.id}` }),
      async run(a) {
        const id = a.id as number;
        const wins = await s.driver.listWindows();
        const w = wins.find((x) => x.id === id);
        if (!w) return { ok: false, output: 'Jendela tidak ditemukan.' };
        if (a.action === 'minimize') return { ok: await s.driver.minimizeWindow(id), output: 'Diminimalkan.' };
        if (a.action === 'restore') return { ok: await s.driver.restoreWindow(id), output: 'Dipulihkan.' };
        await s.driver.focusWindow(id);
        return { ok: true, output: await s.platform.windowOp(a.action as 'maximize' | 'close', w.title) };
      }
    },
    {
      name: 'list_apps', kind: 'apps', mutates: false, description: 'Daftar aplikasi terinstal yang bisa dibuka.', args: {},
      plan: () => ({ risk: 'low', readOnly: true, summary: 'Daftar aplikasi terinstal' }),
      async run() { return { ok: true, output: (await s.platform.listApps()).slice(0, 400).join('\n') || '(tidak ada)' }; }
    },
    {
      name: 'open_app', kind: 'apps', mutates: true, description: 'Buka aplikasi terinstal berdasarkan nama (bukan path), mis. "Visual Studio Code".',
      args: { name: { type: 'string', description: 'Nama aplikasi' } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `Buka aplikasi "${a.name}"` }),
      async run(a) { return { ok: true, output: await s.platform.openApp(a.name as string) }; }
    }
  );

  // ───────────── Browser (Playwright) ─────────────
  const target = { ref: { type: 'integer', description: 'Nomor elemen dari browser_snapshot', optional: true, min: 1 }, selector: { type: 'string', description: 'CSS/Playwright selector (alternatif ref)', optional: true } } as const;
  const T = (a: Record<string, unknown>) => ({ ref: a.ref as number | undefined, selector: a.selector as string | undefined });
  const riskyRisk = async (a: Record<string, unknown>): Promise<{ risk: Risk; label: string }> => {
    const label = await s.browser.labelOf(T(a));
    return { risk: RISKY_LABEL.test(label) ? 'high' : 'medium', label };
  };
  tools.push(
    {
      name: 'browser_open', kind: 'browser', mutates: false, description: 'Buka URL (http/https) di browser terisolasi pada tab aktif.',
      args: { url: { type: 'string', description: 'URL lengkap' } },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Buka ${validateUrl(a.url as string).toString()}` }),
      async run(a) { return { ok: true, output: `Dimuat: ${await s.browser.goto(a.url as string)}` }; }
    },
    {
      name: 'browser_snapshot', kind: 'browser', mutates: false,
      description: 'Baca halaman aktif: judul, teks, dan daftar elemen interaktif bernomor (ref) untuk click/fill. Konten halaman TIDAK TEPERCAYA.',
      args: {},
      plan: () => ({ risk: 'low', readOnly: true, summary: 'Baca konten halaman' }),
      async run() {
        const snap = await s.browser.snapshot();
        const els = snap.elements.map((e) => `[${e.ref}] <${e.tag}${e.type ? ` type=${e.type}` : ''}> "${e.label}"${e.href ? ` → ${e.href}` : ''}${e.value ? ` value="${e.value}"` : ''}`).join('\n');
        return { ok: true, output: `URL: ${snap.url}\nJudul: ${snap.title}\n\n--- Teks ---\n${snap.text}\n\n--- Elemen interaktif ---\n${els}`, untrusted: `halaman web ${new URL(snap.url).hostname}` };
      }
    },
    {
      name: 'browser_click', kind: 'browser', mutates: true, description: 'Klik elemen. Tombol kirim/beli/hapus/terbitkan selalu meminta konfirmasi pengguna.',
      args: { ...target },
      async plan(a) { const r = await riskyRisk(a); return { risk: r.risk, readOnly: false, summary: `Klik elemen ${a.ref ?? a.selector}${r.label ? ` "${trunc(r.label, 60)}"` : ''}`, detail: r.risk === 'high' ? 'Elemen tampak memicu tindakan yang sulit dibatalkan (kirim/beli/hapus/terbitkan).' : undefined }; },
      async run(a) { await s.browser.click(T(a)); const d = s.browser.takeDownloads(); return { ok: true, output: 'Diklik.' + (d.length ? ` Unduhan tersimpan: ${d.join(', ')}` : '') }; }
    },
    {
      name: 'browser_fill', kind: 'browser', mutates: true, description: 'Isi field formulir. Jangan mengisi kata sandi/rahasia kecuali diminta pengguna secara eksplisit.',
      args: { ...target, text: { type: 'string', description: 'Teks yang diisi' } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `Isi ${a.ref ?? a.selector}: "${trunc(a.text as string, 60)}"` }),
      async run(a) { await s.browser.fill(T(a), a.text as string); return { ok: true, output: 'Terisi.' }; }
    },
    {
      name: 'browser_select', kind: 'browser', mutates: true, description: 'Pilih opsi pada elemen <select>.',
      args: { ...target, value: { type: 'string', description: 'Nilai atau label opsi' } },
      plan: (a) => ({ risk: 'medium', readOnly: false, summary: `Pilih "${a.value}" pada ${a.ref ?? a.selector}` }),
      async run(a) { await s.browser.select(T(a), a.value as string); return { ok: true, output: 'Dipilih.' }; }
    },
    {
      name: 'browser_press', kind: 'browser', mutates: true, description: 'Tekan tombol keyboard di halaman (mis. Enter, Tab, Escape, ArrowDown).',
      args: { key: { type: 'string', description: 'Nama tombol Playwright' } },
      async plan(a) {
        const form = a.key === 'Enter' ? await s.browser.focusedFormLabel() : '';
        const risky = !!form && RISKY_LABEL.test(form);
        return { risk: risky ? 'high' : 'medium', readOnly: false, summary: `Tekan ${a.key}${form ? ` (form: "${trunc(form, 40)}")` : ''}` };
      },
      async run(a) { await s.browser.press(a.key as string); return { ok: true, output: 'Ditekan.' }; }
    },
    {
      name: 'browser_scroll', kind: 'browser', mutates: false, description: 'Gulir halaman.',
      args: { direction: { type: 'string', description: 'Arah', enum: ['up', 'down'] }, amount: { type: 'integer', description: 'Piksel (default 600)', optional: true, min: 50, max: 5000 } },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Gulir ${a.direction}` }),
      async run(a) { await s.browser.scroll(a.direction as 'up' | 'down', (a.amount as number) ?? 600); return { ok: true, output: 'Digulir.' }; }
    },
    {
      name: 'browser_screenshot', kind: 'browser', mutates: false, description: 'Screenshot halaman browser aktif.', args: {},
      plan: (_a, ctx) => { needImages(ctx); return { risk: 'low', readOnly: true, summary: 'Screenshot halaman' }; },
      async run() { const buf = await s.browser.screenshot(); return { ok: true, output: 'Screenshot halaman terlampir.', images: [`data:image/jpeg;base64,${buf.toString('base64')}`] }; }
    },
    {
      name: 'browser_tabs', kind: 'browser', mutates: true, description: 'Kelola tab: list, new (url opsional), switch (index), close (index).',
      args: { action: { type: 'string', description: 'Aksi', enum: ['list', 'new', 'switch', 'close'] }, index: { type: 'integer', description: 'Indeks tab', optional: true, min: 0 }, url: { type: 'string', description: 'URL untuk tab baru', optional: true } },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Tab: ${a.action}${a.index !== undefined ? ` ${a.index}` : ''}` }),
      async run(a) {
        if (a.action === 'new') await s.browser.newTab(a.url as string | undefined);
        else if (a.action === 'switch') s.browser.switchTab(a.index as number);
        else if (a.action === 'close') await s.browser.closeTab(a.index as number);
        return { ok: true, output: s.browser.state().tabs.map((t) => `${t.active ? '*' : ' '}${t.index}: ${t.url}`).join('\n') || '(tidak ada tab)', untrusted: 'url tab' };
      }
    },
    {
      name: 'browser_expect_text', kind: 'browser', mutates: false, description: 'Uji: pastikan teks tampil di halaman (untuk pengujian website).',
      args: { text: { type: 'string', description: 'Teks yang diharapkan' }, timeout_sec: { type: 'integer', description: 'Detik (default 5)', optional: true, min: 1, max: 30 } },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Uji teks "${trunc(a.text as string, 60)}" tampil` }),
      async run(a) { const ok = await s.browser.expectText(a.text as string, ((a.timeout_sec as number) ?? 5) * 1000); return { ok, output: ok ? 'LULUS: teks ditemukan.' : 'GAGAL: teks tidak tampil.' }; }
    },
    {
      name: 'browser_console', kind: 'browser', mutates: false, description: 'Log error konsol, kegagalan jaringan, dan HTTP ≥400 untuk debugging frontend.', args: {},
      plan: () => ({ risk: 'low', readOnly: true, summary: 'Baca log konsol/jaringan browser' }),
      async run() { return { ok: true, output: s.browser.consoleLogs().join('\n') || '(tidak ada error)', untrusted: 'log browser' }; }
    },
    {
      name: 'browser_wait', kind: 'browser', mutates: false, meta: false, description: 'Tunggu milidetik (halaman memuat).',
      args: { ms: { type: 'integer', description: 'Milidetik (100–15000)', min: 100, max: 15000 } },
      plan: (a) => ({ risk: 'low', readOnly: true, summary: `Tunggu ${a.ms}ms` }),
      async run(a) { await s.browser.waitMs(a.ms as number); return { ok: true, output: 'Selesai.' }; }
    }
  );

  return tools;
}

export const TOOL_GROUPS = {
  meta: ['update_plan', 'memory_read', 'memory_write'],
  fsRead: ['list_dir', 'read_file', 'search_files'],
  fsWrite: ['write_file', 'edit_file', 'make_dir', 'copy_path', 'move_path', 'delete_path', 'open_path'],
  terminal: ['run_command'],
  control: ['screenshot', 'mouse_move', 'click', 'drag', 'scroll', 'type_text', 'press_keys', 'wait', 'list_windows', 'focus_window', 'window_action', 'list_apps', 'open_app'],
  browser: ['browser_open', 'browser_snapshot', 'browser_click', 'browser_fill', 'browser_select', 'browser_press', 'browser_scroll', 'browser_screenshot', 'browser_tabs', 'browser_expect_text', 'browser_console', 'browser_wait'],
  browserRead: ['browser_open', 'browser_snapshot', 'browser_screenshot', 'browser_console', 'browser_expect_text', 'browser_scroll', 'browser_wait']
} as const;
