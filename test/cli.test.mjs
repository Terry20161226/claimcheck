import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function run(args, cwd) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { cwd, env, encoding: 'utf8' });
    return { code: 0, result: JSON.parse(stdout) };
  } catch (e) {
    return { code: e.status, result: JSON.parse(e.stdout) };
  }
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-it-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, env });
  mkdirSync(join(dir, 'src'), { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'src/base.js'), 'export const x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return dir;
}

const claim = (paths) => JSON.stringify({ version: 1, task: 'demo', scope: { allowedPaths: paths } });

// claim 文件放仓库外的独立目录，避免 claim 自身污染 diff
function writeClaimOutside(content) {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-claim-'));
  const p = join(dir, 'claim.yaml');
  writeFileSync(p, content);
  return p;
}

test('改动全部在范围内 → exit 0 / PASS', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  const claimPath = writeClaimOutside(claim(['src/**']));
  const { code, result } = run(['verify', '--claim', claimPath], dir);
  assert.equal(code, 0);
  assert.equal(result.verdict, 'PASS');
});

test('越界改动 → exit 1 / VIOLATION out-of-scope', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  writeFileSync(join(dir, 'deploy.sh'), 'echo hi\n');
  const claimPath = writeClaimOutside(claim(['src/**']));
  const { code, result } = run(['verify', '--claim', claimPath], dir);
  assert.equal(code, 1);
  assert.equal(result.verdict, 'VIOLATION');
  assert.equal(result.subtype, 'out-of-scope');
  assert.ok(result.checks[0].evidence.join(' ').includes('deploy.sh'));
});

test('claim 文件不合法 → exit 2 / INSUFFICIENT_EVIDENCE', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'claim.yaml'), '{"version": 9}');
  const { code, result } = run(['verify', '--claim', 'claim.yaml'], dir);
  assert.equal(code, 2);
  assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
});

test('非 git 仓库 → exit 3 / CONFIG_ERROR', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-norepo-'));
  writeFileSync(join(dir, 'claim.yaml'), claim(['src/**']));
  const { code, result } = run(['verify', '--claim', 'claim.yaml'], dir);
  assert.equal(code, 3);
  assert.equal(result.verdict, 'CONFIG_ERROR');
});

test('claim.yaml 自身改动会计入核验（声明文件若在范围外需自行纳入）', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  // claim.yaml 未提交 → 属于未跟踪改动；范围只含 src/** → 越界
  writeFileSync(join(dir, 'claim.yaml'), claim(['src/**']));
  const { result } = run(['verify', '--claim', 'claim.yaml'], dir);
  assert.ok(result.checks[0].evidence.join(' ').includes('claim.yaml'));
});
