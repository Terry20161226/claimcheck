#!/usr/bin/env node
// claimcheck verify --claim <file> [--base <git-ref>] [--cwd <dir>]
// 输出结构化 JSON 结论；exit code: 0=PASS 1=VIOLATION 2=INSUFFICIENT_EVIDENCE 3=CONFIG_ERROR
import { readFileSync } from 'node:fs';
import { parseClaim, ClaimError } from './schema.mjs';
import { changedFiles, GitError } from './git.mjs';
import { verifyScope, VERDICT } from './scope.mjs';

const EXIT = { PASS: 0, VIOLATION: 1, INSUFFICIENT_EVIDENCE: 2, CONFIG_ERROR: 3 };

function parseArgs(argv) {
  const args = { base: 'HEAD', cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--claim') args.claim = argv[++i];
    else if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--cwd') args.cwd = argv[++i];
    else if (argv[i] === 'verify') args.cmd = 'verify';
    else { console.error(`未知参数: ${argv[i]}`); process.exit(64); }
  }
  return args;
}

function emit(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(EXIT[result.verdict] ?? 3);
}

const args = parseArgs(process.argv.slice(2));
if (args.cmd !== 'verify' || !args.claim) {
  console.error('用法: claimcheck verify --claim <claim.yaml> [--base <ref>] [--cwd <dir>]');
  process.exit(64);
}

let claim;
try {
  claim = parseClaim(readFileSync(args.claim, 'utf8'));
} catch (e) {
  if (e instanceof ClaimError) {
    // 声明本身不成立：无法核验声明，属于证据不足而非门禁故障
    emit({ verdict: VERDICT.INSUFFICIENT_EVIDENCE, checks: [{ name: 'claim', verdict: VERDICT.INSUFFICIENT_EVIDENCE, evidence: [e.message] }] });
  }
  emit({ verdict: VERDICT.CONFIG_ERROR, checks: [{ name: 'claim', verdict: VERDICT.CONFIG_ERROR, evidence: [`无法读取 claim 文件: ${e.message}`] }] });
}

let files;
try {
  files = changedFiles(args.cwd, args.base);
} catch (e) {
  if (e instanceof GitError) {
    emit({ verdict: VERDICT.CONFIG_ERROR, checks: [{ name: 'git', verdict: VERDICT.CONFIG_ERROR, evidence: [e.message] }] });
  }
  throw e;
}

const scope = verifyScope(claim.scope, files);
emit({
  verdict: scope.verdict,
  task: claim.task,
  checks: [{ name: 'scope', ...scope }],
  ...(scope.subtype ? { subtype: scope.subtype } : {}),
});
