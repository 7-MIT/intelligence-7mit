import { describe, expect, it } from 'vitest';
import { CH, schemas } from '@shared/ipc';

describe('validasi IPC', () => {
  it('menolak properti tak dikenal (strict)', () => {
    expect(() => schemas.permSet.parse({ grants: { input: true }, evil: 1 })).toThrow();
    expect(() => schemas.taskStart.parse({ mode: 'chat', prompt: 'hi', extra: 1 })).toThrow();
  });
  it('menolak enum/tipe salah', () => {
    expect(() => schemas.permSet.parse({ mode: 'yolo' })).toThrow();
    expect(() => schemas.permSet.parse({ grants: { root: true } })).toThrow();
    expect(() => schemas.taskStart.parse({ mode: 'control', prompt: '' })).toThrow();
    expect(() => schemas.settingsSet.parse({ maxSteps: 9999 })).toThrow();
    expect(() => schemas.fsWrite.parse({ path: 'a', content: 5 })).toThrow();
  });
  it('menolak URL penyedia yang bukan URL', () => {
    expect(() => schemas.providerSave.parse({ name: 'x', kind: 'openai', baseUrl: 'bukan-url', model: 'm', supportsTools: true, supportsVision: false })).toThrow();
  });
  it('menerima input valid', () => {
    expect(schemas.permSet.parse({ grants: { screen: true }, mode: 'readonly' })).toBeTruthy();
    expect(schemas.approval.parse({ id: 'a', approved: true, remember: true })).toBeTruthy();
    expect(schemas.taskStart.parse({ mode: 'code', submode: 'plan', prompt: 'hi' })).toBeTruthy();
  });
  it('channel unik', () => {
    const v = Object.values(CH);
    expect(new Set(v).size).toBe(v.length);
  });
});
