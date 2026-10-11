#!/usr/bin/env node
// Builds skills/<name>/<name>.zip for every skill: the file to upload to claude.ai, with the skill's folder at the
// top of the zip. It zips what git has staged (the index), not the working folder, so a zip built during a commit
// holds exactly what that commit holds. Other zips are left out, so a skill's zip never packs its previous one.
// Every timestamp is fixed, so an unchanged skill rebuilds byte for byte and shows no diff.
//
// Usage: node scripts/build-skill-zips.mjs [--stage]
//   --stage   also `git add` each zip (the pre-commit hook passes it)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const git = (...args) => execFileSync('git', args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').toString().trim();
const stage = process.argv.includes('--stage');

// Staged files under skills/, as { mode, sha, path }.
const staged = git('-C', root, 'ls-files', '-s', '-z', '--', 'skills/').toString().split('\0').filter(Boolean)
  .map(line => { const [meta, file] = line.split('\t'); const [mode, sha] = meta.split(' '); return { mode, sha, path: file }; });

const skills = new Map();   // skill name -> its files, paths relative to its folder
for (const f of staged){
  const m = f.path.match(/^skills\/([^/]+)\/(.+)$/);
  if (!m || m[2].endsWith('.zip')) continue;
  if (!skills.has(m[1])) skills.set(m[1], []);
  skills.get(m[1]).push({ ...f, rel: m[2] });
}

// A zip archive (PKZIP, deflate), written by hand so the bytes depend only on the files.
const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1;   // 1980-01-01 00:00, the earliest a zip can say
function zip(entries){   // entries: { name, data?: Buffer, mode } in order; a name ending in / is a folder
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries){
    const dir = e.name.endsWith('/'), name = Buffer.from(e.name, 'utf8');
    const raw = dir ? Buffer.alloc(0) : e.data, body = dir ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const method = dir ? 0 : 8, crc = dir ? 0 : zlib.crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);   // UTF-8 names
    local.writeUInt16LE(method, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE((3 << 8) | 20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(method, 10); central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((((dir ? 0o40755 : e.mode) << 16) | (dir ? 0x10 : 0)) >>> 0, 38);   // Unix mode, DOS folder bit
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const dirSize = centrals.reduce((n, b) => n + b.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dirSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

for (const [name, files] of [...skills].sort(([a], [b]) => a.localeCompare(b))){
  const folders = new Set([`${name}/`]);
  for (const f of files){ const parts = f.rel.split('/'); for (let i = 1; i < parts.length; i++) folders.add(`${name}/${parts.slice(0, i).join('/')}/`); }
  const entries = [
    ...[...folders].map(d => ({ name: d })),
    ...files.map(f => ({ name: `${name}/${f.rel}`, data: git('-C', root, 'cat-file', 'blob', f.sha), mode: parseInt(f.mode, 8) })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const out = path.join(root, 'skills', name, `${name}.zip`), bytes = zip(entries);
  const same = fs.existsSync(out) && fs.readFileSync(out).equals(bytes);
  if (!same) fs.writeFileSync(out, bytes);
  if (stage) git('-C', root, 'add', '--', path.relative(root, out).split(path.sep).join('/'));
  console.log(`${same ? 'unchanged' : 'built    '}  skills/${name}/${name}.zip  (${files.length} files)`);
}
