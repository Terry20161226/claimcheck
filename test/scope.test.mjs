import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyScope, VERDICT } from '../src/scope.mjs';

const scope = { allowedPaths: ['src/**', 'docs/api.md'] };

test('全部在范围内 → PASS', () => {
  const r = verifyScope(scope, ['src/a.js', 'src/lib/b.js', 'docs/api.md']);
  assert.equal(r.verdict, VERDICT.PASS);
});

test('空改动 → PASS（没有越界对象）', () => {
  const r = verifyScope(scope, []);
  assert.equal(r.verdict, VERDICT.PASS);
});

test('越界文件 → VIOLATION/out-of-scope，且逐一列出', () => {
  const r = verifyScope(scope, ['src/a.js', 'deploy.sh', '.github/workflows/ci.yml']);
  assert.equal(r.verdict, VERDICT.VIOLATION);
  assert.equal(r.subtype, 'out-of-scope');
  const evidence = r.evidence.join('\n');
  assert.ok(evidence.includes('deploy.sh'));
  assert.ok(evidence.includes('.github/workflows/ci.yml'));
  assert.ok(!evidence.includes('src/a.js'));
});

test('前缀相似不等于在范围内（src2 不在 src/** 内）', () => {
  const r = verifyScope(scope, ['src2/a.js']);
  assert.equal(r.verdict, VERDICT.VIOLATION);
});
