#!/usr/bin/env node
// claimcheck verify --claim <file> [--base <git-ref>] [--cwd <dir>]
// claimcheck run <cmd...> [--cwd <dir>]
// claimcheck mcp  （MCP stdio server）
// 输出结构化 JSON 结论；exit code: 0=PASS 1=VIOLATION 2=INSUFFICIENT_EVIDENCE 3=CONFIG_ERROR
import { readFileSync } from 'node:fs';
import { parseClaim, ClaimError } from './schema.mjs';
import { VERDICT } from './scope.mjs';
import { verifyClaim } from './verify.mjs';
import { runWithReceipt } from './run.mjs';

const EXIT = { PASS: 0, VIOLATION: 1, INSUFFICIENT_EVIDENCE: 2, CONFIG_ERROR: 3 };

function emit(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(EXIT[result.verdict] ?? 3);
}

function splitArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flags[argv[i]] = argv[++i];
    else pos.push(argv[i]);
  }
  return { flags, pos };
}

function cmdRun(argv) {
  const { flags, pos } = splitArgs(argv);
  const cwd = flags['--cwd'] ?? process.cwd();
  const base = flags['--base'] ?? 'HEAD';
  if (pos.length === 0) { console.error('用法: claimcheck run <cmd...> [--cwd <dir>] [--base <ref>]'); process.exit(64); }
  const { receipt, file } = runWithReceipt(cwd, pos, base);
  console.log(JSON.stringify({
    receipt: file,
    id: receipt.id,
    command: receipt.command,
    exitCode: receipt.exitCode,
    fingerprint: receipt.fingerprint,
  }, null, 2));
  process.exit(receipt.exitCode === 0 ? 0 : 1);
}

function cmdVerify(argv) {
  const { flags } = splitArgs(argv);
  const claimPath = flags['--claim'];
  if (!claimPath) { console.error('用法: claimcheck verify --claim <claim.yaml> [--base <ref>] [--cwd <dir>]'); process.exit(64); }
  const cwd = flags['--cwd'] ?? process.cwd();
  const base = flags['--base'] ?? 'HEAD';

  let claim;
  try {
    claim = parseClaim(readFileSync(claimPath, 'utf8'));
  } catch (e) {
    if (e instanceof ClaimError) {
      // 声明本身不成立：无法核验声明，属于证据不足而非门禁故障
      emit({ verdict: VERDICT.INSUFFICIENT_EVIDENCE, checks: [{ name: 'claim', verdict: VERDICT.INSUFFICIENT_EVIDENCE, evidence: [e.message] }] });
    }
    emit({ verdict: VERDICT.CONFIG_ERROR, checks: [{ name: 'claim', verdict: VERDICT.CONFIG_ERROR, evidence: [`无法读取 claim 文件: ${e.message}`] }] });
  }

  const result = verifyClaim({ claim, cwd, base });
  emit({ ...result, task: claim.task });
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'run') cmdRun(rest);
else if (cmd === 'verify') cmdVerify(rest);
else if (cmd === 'mcp') {
  const { startMcpServer } = await import('./mcp-server.mjs');
  startMcpServer();
} else {
  console.error('用法: claimcheck run <cmd...> | claimcheck verify --claim <file> [--base <ref>] [--cwd <dir>] | claimcheck mcp');
  process.exit(64);
}
