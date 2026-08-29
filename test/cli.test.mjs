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

function runCli(args, cwd) {
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

// claim 文件放仓库外的独立目录，避免 claim 自身污染 diff
function writeClaimOutside(content) {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-claim-'));
  const p = join(dir, 'claim.yaml');
  writeFileSync(p, content);
  return p;
}

const claim = (paths, verification) => JSON.stringify({
  version: 1,
  task: 'demo',
  scope: { allowedPaths: paths },
  ...(verification ? { verification } : {}),
});

const OK_CMD = [process.execPath, '-e', 'process.exit(0)'];
const FAIL_CMD = [process.execPath, '-e', 'process.exit(1)'];

test('完整证据链 → exit 0 / PASS（scope + execution + freshness）', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  runCli(['run', ...OK_CMD], dir);
  const claimPath = writeClaimOutside(claim(['src/**'], [{ command: OK_CMD.join(' '), result: 'pass' }]));
  const { code, result } = runCli(['verify', '--claim', claimPath], dir);
  assert.equal(code, 0);
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(result.checks.map((c) => [c.name, c.verdict]), [
    ['scope', 'PASS'], ['execution', 'PASS'], ['freshness', 'PASS'],
  ]);
});

test('越界改动 → exit 1 / VIOLATION out-of-scope', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  writeFileSync(join(dir, 'deploy.sh'), 'echo hi\n');
  runCli(['run', ...OK_CMD], dir);
  const claimPath = writeClaimOutside(claim(['src/**'], [{ command: OK_CMD.join(' '), result: 'pass' }]));
  const { code, result } = runCli(['verify', '--claim', claimPath], dir);
  assert.equal(code, 1);
  assert.equal(result.verdict, 'VIOLATION');
  assert.equal(result.subtype, 'out-of-scope');
  assert.ok(result.checks[0].evidence.join(' ').includes('deploy.sh'));
});

test('声称跑过但无凭证 → exit 2 / INSUFFICIENT_EVIDENCE', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  const claimPath = writeClaimOutside(claim(['src/**'], [{ command: 'npm test', result: 'pass' }]));
  const { code, result } = runCli(['verify', '--claim', claimPath], dir);
  assert.equal(code, 2);
  assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
});

test('声称通过但凭证是失败 → exit 1 / VIOLATION business-failure', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  runCli(['run', ...FAIL_CMD], dir);
  const claimPath = writeClaimOutside(claim(['src/**'], [{ command: FAIL_CMD.join(' '), result: 'pass' }]));
  const { code, result } = runCli(['verify', '--claim', claimPath], dir);
  assert.equal(code, 1);
  assert.equal(result.verdict, 'VIOLATION');
  assert.equal(result.subtype, 'business-failure');
});

test('验证通过后又改了代码 → exit 1 / VIOLATION stale-evidence', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  runCli(['run', ...OK_CMD], dir);
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 3;\n'); // 验证后再改
  const claimPath = writeClaimOutside(claim(['src/**'], [{ command: OK_CMD.join(' '), result: 'pass' }]));
  const { code, result } = runCli(['verify', '--claim', claimPath], dir);
  assert.equal(code, 1);
  assert.equal(result.verdict, 'VIOLATION');
  assert.equal(result.subtype, 'stale-evidence');
});

test('声明不含任何验证命令 → 执行维度 INSUFFICIENT_EVIDENCE（fail-closed）', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  const claimPath = writeClaimOutside(claim(['src/**']));
  const { code, result } = runCli(['verify', '--claim', claimPath], dir);
  assert.equal(code, 2);
  assert.equal(result.checks.find((c) => c.name === 'execution').verdict, 'INSUFFICIENT_EVIDENCE');
});

test('claim 文件不合法 → exit 2 / INSUFFICIENT_EVIDENCE', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'claim.yaml'), '{"version": 9}');
  const { code, result } = runCli(['verify', '--claim', 'claim.yaml'], dir);
  assert.equal(code, 2);
  assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
});

test('非 git 仓库 → exit 3 / CONFIG_ERROR', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-norepo-'));
  writeFileSync(join(dir, 'claim.yaml'), claim(['src/**']));
  const { code, result } = runCli(['verify', '--claim', 'claim.yaml'], dir);
  assert.equal(code, 3);
  assert.equal(result.verdict, 'CONFIG_ERROR');
});

test('receipt 目录自动加入 git exclude，不污染 diff', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  runCli(['run', ...OK_CMD], dir);
  const claimPath = writeClaimOutside(claim(['src/**'], [{ command: OK_CMD.join(' '), result: 'pass' }]));
  const { result } = runCli(['verify', '--claim', claimPath], dir);
  assert.ok(!result.checks[0].evidence.join(' ').includes('.claimcheck'));
});
