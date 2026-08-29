// scope 核验器：实际改动路径必须 ⊆ 声明的授权范围。
import { matchAnyGlob } from './glob.mjs';

export const VERDICT = {
  PASS: 'PASS',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  VIOLATION: 'VIOLATION',
  CONFIG_ERROR: 'CONFIG_ERROR',
};

/**
 * @param {{ allowedPaths: string[] }} scope 声明的授权范围（glob 列表）
 * @param {string[]} files 实际改动路径（相对仓库根）
 * @returns {{ verdict: string, subtype?: string, evidence: string[] }}
 */
export function verifyScope(scope, files) {
  const outOfScope = files.filter((f) => !matchAnyGlob(scope.allowedPaths, f));
  if (outOfScope.length === 0) {
    return {
      verdict: VERDICT.PASS,
      evidence: [`全部 ${files.length} 个改动文件均在声明范围内（${scope.allowedPaths.join(', ')}）`],
    };
  }
  return {
    verdict: VERDICT.VIOLATION,
    subtype: 'out-of-scope',
    evidence: [
      `声明范围: ${scope.allowedPaths.join(', ')}`,
      `越界文件 (${outOfScope.length}): ${outOfScope.join(', ')}`,
    ],
  };
}
