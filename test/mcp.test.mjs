import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const MCP = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mcp-server.mjs');
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

// 最小 MCP stdio 客户端：发一行收一行
function mcpClient() {
  const proc = spawn('node', [MCP], { stdio: ['pipe', 'pipe', 'inherit'] });
  const pending = new Map();
  let buf = '';
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    }
  });
  let nextId = 1;
  return {
    call(method, params) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    notify(method) {
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
    },
    close() { proc.kill(); },
  };
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'claimcheck-mcp-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, env });
  mkdirSync(join(dir, 'src'), { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'src/base.js'), 'export const x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return dir;
}

test('MCP initialize + tools/list', async () => {
  const c = mcpClient();
  const init = await c.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.name, 'claimcheck');
  c.notify('notifications/initialized');
  const list = await c.call('tools/list');
  assert.deepEqual(list.result.tools.map((t) => t.name).sort(), ['claimcheck_run', 'claimcheck_verify']);
  c.close();
});

test('MCP 全链路：run 留凭证 → verify PASS；谎报 → isError + INSUFFICIENT_EVIDENCE', async () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'src/feature.js'), 'export const y = 2;\n');
  const c = mcpClient();
  await c.call('initialize', {});
  c.notify('notifications/initialized');

  // 谎报：声称跑过 node -e process.exit(0)，但没凭证
  const lieClaim = JSON.stringify({
    version: 1, task: 'demo',
    scope: { allowedPaths: ['src/**'] },
    verification: [{ command: `${process.execPath} -e process.exit(0)`, result: 'pass' }],
  });
  const lie = await c.call('tools/call', { name: 'claimcheck_verify', arguments: { claimJson: lieClaim, cwd: dir } });
  assert.equal(lie.result.isError, true);
  assert.equal(JSON.parse(lie.result.content[0].text).verdict, 'INSUFFICIENT_EVIDENCE');

  // 诚实：走 claimcheck_run，再 verify
  const runRes = await c.call('tools/call', { name: 'claimcheck_run', arguments: { command: [process.execPath, '-e', 'process.exit(0)'], cwd: dir } });
  assert.equal(runRes.result.isError, false);
  const ok = await c.call('tools/call', { name: 'claimcheck_verify', arguments: { claimJson: lieClaim, cwd: dir } });
  assert.equal(ok.result.isError, false);
  assert.equal(JSON.parse(ok.result.content[0].text).verdict, 'PASS');
  c.close();
});
