import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClaim, ClaimError } from '../src/schema.mjs';

const valid = JSON.stringify({
  version: 1,
  task: 'demo',
  scope: { allowedPaths: ['src/**'] },
  verification: [{ command: 'npm test', 'result': 'pass' }],
});

test('合法 claim 通过', () => {
  const c = parseClaim(valid);
  assert.equal(c.task, 'demo');
  assert.deepEqual(c.scope.allowedPaths, ['src/**']);
});

test('version 缺失或非 1 拒绝', () => {
  assert.throws(() => parseClaim(JSON.stringify({ task: 'x', scope: { allowedPaths: ['a'] } })), ClaimError);
  assert.throws(() => parseClaim(JSON.stringify({ version: 2, task: 'x', scope: { allowedPaths: ['a'] } })), ClaimError);
});

test('allowedPaths 为空数组拒绝', () => {
  assert.throws(() => parseClaim(JSON.stringify({ version: 1, task: 'x', scope: { allowedPaths: [] } })), ClaimError);
});

test('非 JSON 拒绝', () => {
  assert.throws(() => parseClaim('not: json: at: all: ['), ClaimError);
});

test('verification 可选，但形状必须正确', () => {
  assert.ok(parseClaim(JSON.stringify({ version: 1, task: 'x', scope: { allowedPaths: ['a'] } })));
  assert.throws(() => parseClaim(JSON.stringify({ version: 1, task: 'x', scope: { allowedPaths: ['a'] }, verification: [{ command: 1 }] })), ClaimError);
});
