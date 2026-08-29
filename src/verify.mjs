// verify 内核：CLI 与 MCP server 共用。不处理 process/IO，只进数据出结论。
import { changedFiles, GitError } from './git.mjs';
import { diffFingerprint } from './fingerprint.mjs';
import { listReceipts } from './receipts.mjs';
import { verifyScope, VERDICT } from './scope.mjs';
import { verifyExecution } from './execution.mjs';
import { verifyFreshness } from './freshness.mjs';

// 聚合优先级：门禁故障 > 违规 > 证据不足 > 通过
const SEVERITY = { CONFIG_ERROR: 4, VIOLATION: 3, INSUFFICIENT_EVIDENCE: 2, PASS: 1 };

const stripMatched = ({ matched, ...rest }) => rest;

export function verifyClaim({ claim, cwd, base = 'HEAD' }) {
  let files, fingerprint;
  try {
    files = changedFiles(cwd, base);
    fingerprint = diffFingerprint(cwd, base).fingerprint;
  } catch (e) {
    if (e instanceof GitError) {
      return {
        verdict: VERDICT.CONFIG_ERROR,
        checks: [{ name: 'git', verdict: VERDICT.CONFIG_ERROR, evidence: [e.message] }],
      };
    }
    throw e;
  }

  const scope = verifyScope(claim.scope, files);
  const execution = verifyExecution(claim, listReceipts(cwd));
  const freshness = execution.matched.length > 0
    ? verifyFreshness(execution.matched, fingerprint)
    : {
        verdict: execution.verdict === VERDICT.PASS ? VERDICT.INSUFFICIENT_EVIDENCE : execution.verdict,
        evidence: ['无可核验的凭证'],
      };

  const checks = [
    { name: 'scope', ...scope },
    { name: 'execution', ...stripMatched(execution) },
    { name: 'freshness', ...freshness },
  ];
  const verdict = checks.reduce(
    (acc, c) => (SEVERITY[c.verdict] > SEVERITY[acc] ? c.verdict : acc),
    VERDICT.PASS,
  );
  const subtype = checks.find((c) => c.verdict === verdict && c.subtype)?.subtype;
  return { verdict, checks, ...(subtype ? { subtype } : {}) };
}
