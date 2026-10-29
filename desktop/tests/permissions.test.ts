import { describe, expect, it } from 'vitest';
import { harness } from './helpers';
import type { AuthRequest } from '../src/main/security/permissions';

const req = (over: Partial<AuthRequest> = {}): AuthRequest => ({ tool: 't', kind: 'filesystem', risk: 'low', summary: 's', readOnly: true, actor: 'agent', taskId: 'x', ...over });

describe('PermissionManager', () => {
  it('menolak bila izin belum diberikan', async () => {
    const h = harness();
    const d = await h.permissions.authorize(req());
    expect(d).toMatchObject({ allowed: false, code: 'not_granted' });
  });
  it('Read Only hanya membatasi AI; aksi langsung pengguna (mis. simpan di editor) tetap boleh', async () => {
    const h = harness({ grants: { filesystem: true }, mode: 'readonly' });
    expect((await h.permissions.authorize(req({ actor: 'user', readOnly: false, risk: 'medium' }))).allowed).toBe(true);
  });
  it('mode Read Only menolak tindakan yang mengubah, mengizinkan observasi', async () => {
    const h = harness({ grants: { filesystem: true }, mode: 'readonly' });
    expect((await h.permissions.authorize(req({ readOnly: false, risk: 'low' }))).allowed).toBe(false);
    expect((await h.permissions.authorize(req())).allowed).toBe(true);
  });
  it('pemblokiran keras tidak bisa disetujui', async () => {
    const h = harness({ grants: { terminal: true }, autoApprove: true });
    const d = await h.permissions.authorize(req({ kind: 'terminal', blocked: 'rm -rf /' }));
    expect(d).toMatchObject({ allowed: false, code: 'blocked' });
    expect(h.approvals).toHaveLength(0);
  });
  it('Ask: tindakan non-baca meminta persetujuan; ditolak -> rejected', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: false });
    const d = await h.permissions.authorize(req({ readOnly: false, risk: 'medium' }));
    expect(d).toMatchObject({ allowed: false, code: 'rejected' });
    expect(h.approvals).toHaveLength(1);
  });
  it('Ask: disetujui -> diizinkan oleh user', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    expect(await h.permissions.authorize(req({ readOnly: false, risk: 'medium' }))).toEqual({ allowed: true, by: 'user' });
  });
  it('Auto: hanya risiko rendah di workspace yang disetujui tanpa bertanya', async () => {
    const h = harness({ grants: { filesystem: true }, mode: 'auto', autoApprove: false });
    h.permissions.update({ autoWorkspaces: [h.ws] });
    expect((await h.permissions.authorize(req({ readOnly: false, risk: 'low', workspacePath: h.ws }))).allowed).toBe(true);
    expect(h.approvals).toHaveLength(0);
    expect((await h.permissions.authorize(req({ readOnly: false, risk: 'medium', workspacePath: h.ws }))).allowed).toBe(false);
    expect(h.approvals).toHaveLength(1);
    expect((await h.permissions.authorize(req({ readOnly: false, risk: 'low', workspacePath: '/tmp/other' }))).allowed).toBe(false);
  });
  it('risiko tinggi selalu meminta konfirmasi, juga di Auto', async () => {
    const h = harness({ grants: { filesystem: true }, mode: 'auto', autoApprove: false });
    h.permissions.update({ autoWorkspaces: [h.ws] });
    const d = await h.permissions.authorize(req({ readOnly: false, risk: 'high', workspacePath: h.ws }));
    expect(d.allowed).toBe(false);
    expect(h.approvals).toHaveLength(1);
  });
  it('konten tercemar (tainted) menurunkan Auto menjadi Ask, bahkan untuk baca-saja', async () => {
    const h = harness({ grants: { filesystem: true }, mode: 'auto', autoApprove: false });
    h.permissions.update({ autoWorkspaces: [h.ws] });
    const d = await h.permissions.authorize(req({ readOnly: true, tainted: true, workspacePath: h.ws }));
    expect(d.allowed).toBe(false);
    expect(h.approvals).toHaveLength(1);
  });
  it('"setujui untuk task ini" hanya untuk risiko ≤ medium dan tidak berlaku saat tainted', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: 'manual' });
    const remember = (id: string) => h.broker.respond(id, true, true);
    const p1 = h.permissions.authorize(req({ readOnly: false, risk: 'medium', tool: 'edit' }));
    await new Promise((r) => setTimeout(r, 5));
    remember(h.approvals[0].id);
    expect((await p1).allowed).toBe(true);
    const d2 = await h.permissions.authorize(req({ readOnly: false, risk: 'medium', tool: 'edit' }));
    expect(d2).toEqual({ allowed: true, by: 'task-allowance' });
    expect(h.approvals).toHaveLength(1);
    // tainted: kembali bertanya
    const p3 = h.permissions.authorize(req({ readOnly: false, risk: 'medium', tool: 'edit', tainted: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(h.approvals).toHaveLength(2);
    h.broker.respond(h.approvals[1].id, false);
    expect((await p3).allowed).toBe(false);
    // risiko tinggi tidak pernah diingat
    const p4 = h.permissions.authorize(req({ readOnly: false, risk: 'high', tool: 'edit' }));
    await new Promise((r) => setTimeout(r, 5));
    h.broker.respond(h.approvals[2].id, true, true);
    await p4;
    const p5 = h.permissions.authorize(req({ readOnly: false, risk: 'high', tool: 'edit' }));
    await new Promise((r) => setTimeout(r, 5));
    expect(h.approvals).toHaveLength(4);
    h.broker.respond(h.approvals[3].id, false);
    await p5;
  });
  it('pencabutan izin menolak permintaan yang menunggu dan tercatat di audit', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: 'manual' });
    const p = h.permissions.authorize(req({ readOnly: false, risk: 'medium' }));
    await new Promise((r) => setTimeout(r, 5));
    expect(h.approvals).toHaveLength(1);
    h.permissions.update({ grants: { filesystem: false } });
    expect((await p).allowed).toBe(false);
    expect(h.audit.list().some((e) => /dicabut/.test(e.summary))).toBe(true);
    expect((await h.permissions.authorize(req())).allowed).toBe(false);
  });
  it('abort signal membatalkan persetujuan yang menunggu', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: 'manual' });
    const ac = new AbortController();
    const p = h.permissions.authorize(req({ readOnly: false, risk: 'medium' }), ac.signal);
    await new Promise((r) => setTimeout(r, 5));
    ac.abort();
    expect(await p).toMatchObject({ allowed: false, code: 'rejected' });
  });
  it('aktor user: butuh izin, tapi konfirmasi hanya untuk risiko tinggi', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: false });
    expect((await h.permissions.authorize(req({ actor: 'user', readOnly: false, risk: 'medium' }))).allowed).toBe(true);
    expect((await h.permissions.authorize(req({ actor: 'user', readOnly: false, risk: 'high' }))).allowed).toBe(false);
  });
  it('setiap keputusan masuk audit log', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    await h.permissions.authorize(req({ readOnly: false, risk: 'medium' }));
    await h.permissions.authorize(req({ kind: 'input' }));
    const decisions = h.audit.list().map((e) => e.decision);
    expect(decisions).toContain('approved');
    expect(decisions).toContain('denied');
  });
  it('update() tidak menimpa state dengan nilai undefined', () => {
    const h = harness({ grants: { filesystem: true } });
    h.permissions.update({ autoWorkspaces: [h.ws] });
    h.permissions.update({ allowedFolders: undefined, autoWorkspaces: undefined, mode: 'readonly' });
    const st = h.permissions.getState();
    expect(st.allowedFolders).toEqual([h.ws]);
    expect(st.autoWorkspaces).toEqual([h.ws]);
    expect(st.mode).toBe('readonly');
  });
});
