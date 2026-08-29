// git 权威状态采集：相对 base ref 的全部改动（已跟踪 + 未跟踪）。
import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

export function changedFiles(cwd, base = 'HEAD') {
  const run = (...args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      throw new GitError(`git ${args.join(' ')} 失败: ${(e.stderr || e.message).trim()}`);
    }
  };
  const tracked = run('diff', '--name-only', base, '--').split('\n').filter(Boolean);
  const untracked = run('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}
