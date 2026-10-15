import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const runtimeFiles = new Set([
  'PCC.exe', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
  'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'ffmpeg.dll',
  'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll', 'LICENSE.electron.txt',
  'LICENSES.chromium.html', 'resources.pak', 'snapshot_blob.bin',
  'v8_context_snapshot.bin', 'vk_swiftshader.dll',
  'vk_swiftshader_icd.json', 'vulkan-1.dll',
]);

const isRuntimeFile = relative => runtimeFiles.has(relative)
  || relative.startsWith('locales/')
  || relative === 'resources/app.asar'
  || relative.startsWith('resources/app.asar.unpacked/');

async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Niedozwolony link: ${directory}/${entry.name}`);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) result.push(relative);
    else throw new Error(`Nieobslugiwany plik: ${relative}`);
  }
  return result;
}

async function hash(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

function assertClosed() {
  const processes = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq PCC.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  if (/"PCC\.exe"/i.test(processes)) throw new Error('Zamknij PCC rowniez przy zegarze i uruchom Kompiluj.cmd ponownie.');
}

// Only packaged runtime files can be replaced; every other existing file is preserved.
export async function updatePortable(source, target, backup, checkClosed = assertClosed) {
  checkClosed();
  const packageFiles = await listFiles(source);
  for (const required of ['PCC.exe', 'resources/app.asar']) {
    if (!packageFiles.includes(required)) throw new Error(`Niekompletny pakiet: brak ${required}`);
  }
  for (const relative of packageFiles) {
    if (!isRuntimeFile(relative) || relative.split('/').some(part => /^(\.env.*|profil|baza_danych\.db.*|.*\.db(?:-wal|-shm)?|.*tokens.*)$/i.test(part))) {
      throw new Error(`Pakiet zawiera plik spoza programu: ${relative}`);
    }
  }
  await fs.mkdir(target, { recursive: true });
  const existingFiles = await listFiles(target);
  const protectedFiles = existingFiles.filter(relative => !isRuntimeFile(relative));
  const checksums = {};
  // The app must be closed: retain the database together with any WAL/SHM files.
  for (const relative of protectedFiles) {
    const original = path.join(target, relative);
    checksums[relative] = await hash(original);
    const saved = path.join(backup, 'dane', relative);
    await copyFile(original, saved);
    if (await hash(saved) !== checksums[relative]) throw new Error(`Niepoprawna kopia: ${relative}`);
  }
  await fs.mkdir(backup, { recursive: true });
  await fs.writeFile(path.join(backup, 'sumy-danych.json'), JSON.stringify(checksums, null, 2));
  const existing = new Set(existingFiles);
  for (const relative of packageFiles) {
    if (existing.has(relative)) await copyFile(path.join(target, relative), path.join(backup, 'program', relative));
  }
  checkClosed();
  const copied = [];
  try {
    for (const relative of packageFiles) {
      copied.push(relative);
      await copyFile(path.join(source, relative), path.join(target, relative));
      if (await hash(path.join(source, relative)) !== await hash(path.join(target, relative))) {
        throw new Error(`Niepoprawna kopia programu: ${relative}`);
      }
    }
  } catch (error) {
    for (const relative of copied.reverse()) {
      if (existing.has(relative)) await copyFile(path.join(backup, 'program', relative), path.join(target, relative));
      else await fs.unlink(path.join(target, relative)).catch(failure => { if (failure.code !== 'ENOENT') throw failure; });
    }
    throw error;
  }
  for (const relative of protectedFiles) {
    if (await hash(path.join(target, relative)) !== checksums[relative]) {
      throw new Error(`Plik danych zmienil sie podczas aktualizacji: ${relative}. Kopia: ${backup}`);
    }
  }
  return { protectedCount: protectedFiles.length, programCount: packageFiles.length };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assertClosed();
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Budowanie nie powiodlo sie. Folder aplikacja nie zostal zaktualizowany.');
  const backup = path.join(root, 'kopie-kompilacji', new Date().toISOString().replace(/[:.]/g, '-'));
  console.log(`Kopia bezpieczenstwa: ${backup}`);
  const counts = await updatePortable(path.join(root, 'release', 'win-unpacked'), path.join(root, 'aplikacja'), backup);
  console.log(`Gotowe: aplikacja\\PCC.exe. Zaktualizowano ${counts.programCount} plikow programu.`);
  console.log(`Zweryfikowano ${counts.protectedCount} plikow danych i konfiguracji: bez zmian.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`BLAD: ${error.message}`); process.exitCode = 1; });
}
