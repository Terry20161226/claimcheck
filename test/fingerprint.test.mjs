import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { diffFingerprint } from '../src/fingerprint.mjs';

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-fp-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, env });
  mkdirSync(join(dir, 'src'), { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'src/base.js'), 'export const x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return dir;
}

test('内容不变 → 指纹稳定', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  const f1 = diffFingerprint(dir).fingerprint;
  const f2 = diffFingerprint(dir).fingerprint;
  assert.equal(f1, f2);
});

test('内容改变 → 指纹改变', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  const f1 = diffFingerprint(dir).fingerprint;
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 2;\n');
  const f2 = diffFingerprint(dir).fingerprint;
  assert.notEqual(f1, f2);
});

test('新增未跟踪文件 → 指纹改变', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  const f1 = diffFingerprint(dir).fingerprint;
  writeFileSync(join(dir, 'src/b.js'), 'export const b = 1;\n');
  assert.notEqual(diffFingerprint(dir).fingerprint, f1);
});
