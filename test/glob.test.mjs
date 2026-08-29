import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchGlob, matchAnyGlob } from '../src/glob.mjs';

test('精确路径', () => {
  assert.ok(matchGlob('docs/api.md', 'docs/api.md'));
  assert.ok(!matchGlob('docs/api.md', 'docs/api2.md'));
});

test('* 段内匹配，不跨目录', () => {
  assert.ok(matchGlob('src/*.js', 'src/a.js'));
  assert.ok(!matchGlob('src/*.js', 'src/lib/a.js'));
});

test('** 跨目录匹配', () => {
  assert.ok(matchGlob('src/**', 'src/a.js'));
  assert.ok(matchGlob('src/**', 'src/lib/deep/a.js'));
  assert.ok(!matchGlob('src/**', 'test/a.js'));
});

test('src/**/x.js 中段 **', () => {
  assert.ok(matchGlob('src/**/x.js', 'src/x.js'));
  assert.ok(matchGlob('src/**/x.js', 'src/a/b/x.js'));
  assert.ok(!matchGlob('src/**/x.js', 'src/a/b/y.js'));
});

test('? 单字符', () => {
  assert.ok(matchGlob('src/?.js', 'src/a.js'));
  assert.ok(!matchGlob('src/?.js', 'src/ab.js'));
});

test('正则元字符被转义', () => {
  assert.ok(matchGlob('src/a+b.js', 'src/a+b.js'));
  assert.ok(!matchGlob('src/a+b.js', 'src/aab.js'));
});

test('matchAnyGlob 任一命中即真', () => {
  assert.ok(matchAnyGlob(['src/**', 'docs/**'], 'docs/x.md'));
  assert.ok(!matchAnyGlob(['src/**', 'docs/**'], 'scripts/x.sh'));
});
