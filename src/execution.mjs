// execution 核验：声称执行过的每条验证命令，都必须有真实凭证；
// 凭证结果与声称结果矛盾 → VIOLATION (subtype: business-failure)。
import { VERDICT } from './scope.mjs';

export function verifyExecution(claim, receipts) {
  const declared = claim.verification ?? [];
  if (declared.length === 0) {
    return {
      verdict: VERDICT.INSUFFICIENT_EVIDENCE,
      evidence: ['声明未包含任何验证命令——执行维度无法核验'],
      matched: [],
    };
  }
  const evidence = [];
  const matched = [];
  let worst = VERDICT.PASS;
  for (const v of declared) {
    const candidates = receipts.filter((r) => r.command === v.command);
    if (candidates.length === 0) {
      worst = VERDICT.INSUFFICIENT_EVIDENCE;
      evidence.push(`声称执行过 "${v.command}"，但没有任何执行凭证`);
      continue;
    }
    const latest = candidates.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
    matched.push(latest);
    if (v.result === 'pass' && latest.exitCode !== 0) {
      worst = VERDICT.VIOLATION;
      evidence.push(
        `声称 "${v.command}" 通过，但最近凭证（${latest.id}）退出码 ${latest.exitCode}（${latest.tail.trim().split('\n').pop() ?? ''}）`,
      );
    } else if (v.result === 'fail' && latest.exitCode === 0) {
      worst = VERDICT.VIOLATION;
      evidence.push(`声称 "${v.command}" 失败，但最近凭证（${latest.id}）退出码 0`);
    } else {
      evidence.push(`"${v.command}" 有凭证（${latest.id}），退出码 ${latest.exitCode}，与声称一致`);
    }
  }
  return { verdict: worst, ...(worst === VERDICT.VIOLATION ? { subtype: 'business-failure' } : {}), evidence, matched };
}
