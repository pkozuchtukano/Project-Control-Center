import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updatePortable } from './build-portable.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pcc-portable-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'release');
  const target = path.join(root, 'aplikacja');
  const backup = path.join(root, 'backup');
  const write = async (base, relative, content) => {
    const file = path.join(base, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  for (const file of ['PCC.exe', 'resources/app.asar', 'resources/app.asar.unpacked/native.node']) {
    await write(source, file, 'new program');
    await write(target, file, 'old program');
  }
  const protectedFiles = ['baza_danych.db', 'baza_danych.db-wal', 'baza_danych.db-shm', '.env', '.google-tokens.json', 'profil/Local Storage/data', 'docs/instructions.txt', 'custom-config.json'];
  for (const file of protectedFiles) await write(target, file, `original ${file}`);
  return { source, target, backup, write, protectedFiles };
}

test('updates program and preserves byte-identical data, WAL, profile and config with backups', async t => {
  const f = await fixture(t);
  const result = await updatePortable(f.source, f.target, f.backup, () => {});
  assert.equal(result.protectedCount, f.protectedFiles.length);
  assert.equal(await fs.readFile(path.join(f.target, 'PCC.exe'), 'utf8'), 'new program');
  assert.equal(await fs.readFile(path.join(f.backup, 'program/PCC.exe'), 'utf8'), 'old program');
  for (const file of f.protectedFiles) {
    assert.equal(await fs.readFile(path.join(f.target, file), 'utf8'), `original ${file}`);
    assert.equal(await fs.readFile(path.join(f.backup, 'dane', file), 'utf8'), `original ${file}`);
  }
});

test('rejects a package containing a database or configuration before replacing files', async t => {
  for (const file of ['baza_danych.db', '.env', 'resources/app.asar.unpacked/data.db']) {
    const f = await fixture(t);
    await f.write(f.source, file, 'must not overwrite user data');
    await assert.rejects(updatePortable(f.source, f.target, f.backup, () => {}), /spoza programu/);
    assert.equal(await fs.readFile(path.join(f.target, 'PCC.exe'), 'utf8'), 'old program');
    assert.equal(await fs.readFile(path.join(f.target, 'baza_danych.db'), 'utf8'), 'original baza_danych.db');
  }
});

test('refuses update while app is running and rejects incomplete packages', async t => {
  const f = await fixture(t);
  await assert.rejects(updatePortable(f.source, f.target, f.backup, () => { throw new Error('PCC running'); }), /PCC running/);
  await fs.unlink(path.join(f.source, 'resources/app.asar'));
  await assert.rejects(updatePortable(f.source, f.target, f.backup, () => {}), /Niekompletny pakiet/);
  assert.equal(await fs.readFile(path.join(f.target, 'PCC.exe'), 'utf8'), 'old program');
});

test('restores previous program when copying is interrupted', async t => {
  const f = await fixture(t);
  let checks = 0;
  await assert.rejects(updatePortable(f.source, f.target, f.backup, () => {
    if (++checks === 2) {
      // Simulate a staged file disappearing after validation and backup.
      process.getBuiltinModule('node:fs').unlinkSync(path.join(f.source, 'resources/app.asar'));
    }
  }), /ENOENT/);
  assert.equal(await fs.readFile(path.join(f.target, 'PCC.exe'), 'utf8'), 'old program');
  assert.equal(await fs.readFile(path.join(f.target, 'baza_danych.db'), 'utf8'), 'original baza_danych.db');
});
