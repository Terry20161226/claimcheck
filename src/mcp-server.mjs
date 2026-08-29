#!/usr/bin/env node
// MCP stdio server：薄封装同一内核（runWithReceipt / verifyClaim），零依赖手写 JSON-RPC。
// 协议：行分隔 JSON-RPC 2.0 over stdio。
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { parseClaim, ClaimError } from './schema.mjs';
import { VERDICT } from './scope.mjs';
import { verifyClaim } from './verify.mjs';
import { runWithReceipt } from './run.mjs';

const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = [
  {
    name: 'claimcheck_run',
    description: '通过包装器执行验证命令并留下绑定 diff 指纹的凭证（receipt）。agent 跑测试/构建必须走这里，自己"记得跑过"不算。',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'array', items: { type: 'string' }, description: '要执行的命令及参数，如 ["npm","test"]' },
        cwd: { type: 'string', description: '目标仓库路径，默认当前目录' },
        base: { type: 'string', description: 'diff 基准 ref，默认 HEAD' },
      },
      required: ['command'],
    },
  },
  {
    name: 'claimcheck_verify',
    description: '核验完成声明：scope / execution / freshness 三项对表，输出四值判定（PASS / VIOLATION+subtype / INSUFFICIENT_EVIDENCE / CONFIG_ERROR）与逐项证据。',
    inputSchema: {
      type: 'object',
      properties: {
        claimPath: { type: 'string', description: 'claim.yaml 路径（与 claimJson 二选一）' },
        claimJson: { type: 'string', description: 'claim 内容字符串（与 claimPath 二选一）' },
        cwd: { type: 'string', description: '目标仓库路径，默认当前目录' },
        base: { type: 'string', description: 'diff 基准 ref，默认 HEAD' },
      },
    },
  },
];

const text = (obj, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }], isError });

function callTool(name, args = {}) {
  const cwd = args.cwd ?? process.cwd();
  const base = args.base ?? 'HEAD';
  if (name === 'claimcheck_run') {
    if (!Array.isArray(args.command) || args.command.length === 0) {
      return text({ verdict: VERDICT.CONFIG_ERROR, evidence: ['command 必须是非空字符串数组'] }, true);
    }
    const { receipt, file } = runWithReceipt(cwd, args.command, base);
    return text({ receipt: file, id: receipt.id, command: receipt.command, exitCode: receipt.exitCode, fingerprint: receipt.fingerprint }, receipt.exitCode !== 0);
  }
  if (name === 'claimcheck_verify') {
    let claim;
    try {
      claim = parseClaim(args.claimJson ?? readFileSync(args.claimPath ?? '', 'utf8'));
    } catch (e) {
      const isClaim = e instanceof ClaimError;
      return text({
        verdict: isClaim ? VERDICT.INSUFFICIENT_EVIDENCE : VERDICT.CONFIG_ERROR,
        checks: [{ name: 'claim', verdict: isClaim ? VERDICT.INSUFFICIENT_EVIDENCE : VERDICT.CONFIG_ERROR, evidence: [e.message] }],
      }, true);
    }
    const result = verifyClaim({ claim, cwd, base });
    return text({ ...result, task: claim.task }, result.verdict !== VERDICT.PASS);
  }
  throw new Error(`unknown tool: ${name}`);
}

export function startMcpServer() {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params } = msg;
    if (method === 'initialize') {
      respond(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'claimcheck', version: '0.1.0' } });
    } else if (method === 'notifications/initialized') {
      // 无需响应
    } else if (method === 'ping') {
      respond(id, {});
    } else if (method === 'tools/list') {
      respond(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      try {
        respond(id, callTool(params?.name, params?.arguments));
      } catch (e) {
        respond(id, text({ verdict: VERDICT.CONFIG_ERROR, evidence: [e.message] }, true));
      }
    } else if (id !== undefined) {
      error(id, -32601, `method not found: ${method}`);
    }
  });
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}
function error(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

// 直接执行时启动（被 import 时不启动，便于测试）
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  startMcpServer();
}
