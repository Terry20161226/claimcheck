#!/usr/bin/env node
// eval runner：每个场景在独立临时 git 仓重放，断言 verdict + subtype。
// 全部通过 exit 0；任何不符 exit 1 并列出明细。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { scenarios } from './scenarios.mjs';
import { runWithReceipt } from '../src/run.mjs';
import { verifyClaim } from '../src/verify.mjs';
import { parseClaim, ClaimError } from '../src/schema.mjs';
import { VERDICT } from '../src/scope.mjs';

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'eval', GIT_AUTHOR_EMAIL: 'eval@eval',
  GIT_COMMITTER_NAME: 'eval', GIT_COMMITTER_EMAIL: 'eval@eval',
};

function applyFiles(dir, files) {
  for (const [path, content] of Object.entries(files ?? {})) {
    const p = join(dir, path);
    if (content === null) rmSync(p, { force: true });
    else {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    }
  }
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-eval-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, env });
  mkdirSync(join(dir, 'src'), { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'src/base.js'), 'export const x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return dir;
}

function runScenario(s) {
  const dir = s.noRepo
    ? mkdtempSync(join(tmpdir(), 'claimcheck-eval-norepo-'))
    : makeRepo();
  applyFiles(dir, s.files);
  if (s.run) runWithReceipt(dir, s.run, 'HEAD');
  applyFiles(dir, s.postRunFiles);

  const raw = JSON.stringify({
    version: s.claim.__badVersion ? 9 : 1,
    task: s.name,
    scope: { allowedPaths: s.claim.allowedPaths },
    ...(s.claim.verification ? { verification: s.claim.verification } : {}),
  });
  let claim;
  try {
    claim = parseClaim(raw);
  } catch (e) {
    if (e instanceof ClaimError) return { verdict: VERDICT.INSUFFICIENT_EVIDENCE };
    throw e;
  }
  return verifyClaim({ claim, cwd: dir, base: s.verifyBase ?? 'HEAD' });
}

let passed = 0;
const failures = [];
for (const s of scenarios) {
  let actual;
  try {
    actual = runScenario(s);
  } catch (e) {
    actual = { verdict: `THREW: ${e.message}` };
  }
  const ok = actual.verdict === s.expect.verdict
    && (s.expect.subtype === undefined || actual.subtype === s.expect.subtype);
  if (ok) {
    passed++;
    console.log(`✓ ${s.name} → ${actual.verdict}${actual.subtype ? ` (${actual.subtype})` : ''}`);
  } else {
    failures.push({ name: s.name, expect: s.expect, actual });
    console.log(`✗ ${s.name} → 期望 ${s.expect.verdict}${s.expect.subtype ? ` (${s.expect.subtype})` : ''}，实际 ${actual.verdict}${actual.subtype ? ` (${actual.subtype})` : ''}`);
  }
}

console.log(`\n${passed}/${scenarios.length} 通过`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
