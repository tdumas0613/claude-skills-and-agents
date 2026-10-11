#!/usr/bin/env node
// Finds references in agent instruction files that no longer match the repo.
//
// Scans CLAUDE.md, AGENTS.md, skills, subagent and command definitions (or the files given) for backticked file paths
// and `npm run` / `npm test` commands, and reports the ones that don't exist. It can't judge meaning: a path that
// exists may still be described wrongly, so treat a clean result as "nothing obviously stale", not "accurate".
//
// Usage: node check_refs.mjs [repo root, default .] [files...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
// This skill's own files name example paths that needn't exist in the repo being checked.
const own = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__']);
const all = new Set();   // every path in the repo, so shorthand like `render/` or `ui/reactions.ts` still resolves
(function walk(dir){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name), rel = path.relative(root, p).split(path.sep).join('/');
    if (e.isDirectory()){ all.add(rel + '/'); walk(p); } else all.add(rel);
  }
})(root);

const DEFAULTS = [/^CLAUDE(\.local)?\.md$/, /^AGENTS\.md$/, /(^|\/)CLAUDE\.md$/, /^\.claude\/skills\/[^/]+\/.*\.md$/, /^\.claude\/agents\/[^/]+\.md$/, /^\.claude\/commands\/.*\.md$/];
const files = (process.argv.length > 3 ? process.argv.slice(3).map(f => path.resolve(root, f))
  : [...all].filter(p => DEFAULTS.some(r => r.test(p))).map(p => path.join(root, p)))
  .filter(f => !path.resolve(f).startsWith(own + path.sep)).sort();

const pkg = path.join(root, 'package.json');
const scripts = fs.existsSync(pkg) ? JSON.parse(fs.readFileSync(pkg, 'utf8')).scripts || {} : {};
const somewhere = tok => {
  const t = tok.replace(/^[./]+/, ''), bare = t.replace(/\/$/, '');
  for (const p of all){ const q = p.replace(/\/$/, ''); if (p === t || p.endsWith('/' + t) || q === bare || q.endsWith('/' + bare)) return true; }
  return false;
};
const PATHLIKE = /^(\.{0,2}\/)?[\w.@-]+(\/[\w.*@<>-]+)*\/?$/;
const EXT = /\.(md|ts|tsx|js|mjs|cjs|jsx|json|py|sh|html|css|yml|yaml|toml|txt)$/;

let problems = 0;
const report = msg => { problems++; console.log(msg); };
for (const f of files){
  const doc = path.relative(root, f);
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const [, raw] of line.matchAll(/`([^`\n]+)`/g)){
      const tok = raw.trim();
      for (const [, name] of tok.matchAll(/npm run ([\w:-]+)/g)) if (Object.keys(scripts).length && !(name in scripts)) report(`${doc}:${i+1}: no npm script "${name}"`);
      if (tok === 'npm test' && Object.keys(scripts).length && !('test' in scripts)) report(`${doc}:${i+1}: no npm script "test"`);
      if (tok.includes(' ') || !PATHLIKE.test(tok) || !(tok.includes('/') || EXT.test(tok))) continue;
      if (/[<*]/.test(tok) || /^(http|~)/.test(tok)) continue;   // placeholders and globs
      // From the repo root, then next to the doc (skills refer to their own bundled files), then anywhere.
      if (![path.join(root, tok), path.join(path.dirname(f), tok)].some(c => fs.existsSync(c)) && !somewhere(tok)) report(`${doc}:${i+1}: missing path \`${tok}\``);
    }
  });
}
console.error(`${files.length} files checked, ${problems} problem(s)`);
process.exitCode = problems ? 1 : 0;
