// freshness 核验：凭证绑定的 diff 指纹必须与当前工作区一致——
// 防"跑完测试又改了代码"：凭证签发后任何内容改动都会让指纹失配。
import { VERDICT } from './scope.mjs';

export function verifyFreshness(matchedReceipts, currentFingerprint) {
  if (matchedReceipts.length === 0) {
    return { verdict: VERDICT.INSUFFICIENT_EVIDENCE, evidence: ['无可核验的凭证'] };
  }
  const evidence = [];
  let ok = true;
  for (const r of matchedReceipts) {
    if (r.fingerprint !== currentFingerprint) {
      ok = false;
      evidence.push(
        `凭证 ${r.id}（"${r.command}"）绑定指纹 ${r.fingerprint.slice(0, 12)}…，当前工作区 ${currentFingerprint.slice(0, 12)}… 不一致——验证之后代码又变过`,
      );
    } else {
      evidence.push(`凭证 ${r.id} 指纹与当前工作区一致`);
    }
  }
  return ok
    ? { verdict: VERDICT.PASS, evidence }
    : { verdict: VERDICT.VIOLATION, subtype: 'stale-evidence', evidence };
}
