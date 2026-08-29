// claim 文件的结构校验。claim 是"声明"，不是门禁配置——
// 声明本身不成立（缺字段、格式错）时结论是 INSUFFICIENT_EVIDENCE，不是 CONFIG_ERROR。

export class ClaimError extends Error {}

/**
 * @typedef {Object} Claim
 * @property {number} version
 * @property {string} task
 * @property {{ allowedPaths: string[] }} scope
 * @property {Array<{ command: string, result: string }>} [verification]
 */

export function parseClaim(raw) {
  let data;
  try {
    data = JSON.parse(raw); // JSON 是合法 YAML 子集：claim.yaml 先用 JSON 语法承载
  } catch (e) {
    throw new ClaimError(`claim 不是合法 JSON/YAML 子集: ${e.message}`);
  }
  const problems = [];
  if (typeof data !== 'object' || data === null) problems.push('claim 必须是对象');
  else {
    if (data.version !== 1) problems.push('version 必须为 1');
    if (typeof data.task !== 'string' || !data.task) problems.push('task 不能为空字符串');
    if (typeof data.scope !== 'object' || data.scope === null
        || !Array.isArray(data.scope.allowedPaths) || data.scope.allowedPaths.length === 0
        || !data.scope.allowedPaths.every((p) => typeof p === 'string' && p.length > 0)) {
      problems.push('scope.allowedPaths 必须是非空字符串数组');
    }
    if (data.verification !== undefined) {
      const ok = Array.isArray(data.verification)
        && data.verification.every((v) => typeof v?.command === 'string' && typeof v?.result === 'string');
      if (!ok) problems.push('verification 必须是 { command, result } 数组');
    }
  }
  if (problems.length) throw new ClaimError(problems.join('; '));
  return data;
}
