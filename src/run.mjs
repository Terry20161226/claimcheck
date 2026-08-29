// claimcheck run：命令必须经由包装器真实执行才产生凭证——agent 自己"记得跑过"不算。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { diffFingerprint } from './fingerprint.mjs';
import { ensureStoreExcluded, writeReceipt } from './receipts.mjs';

const TAIL_LEN = 2000;

export function runWithReceipt(cwd, argv, base = 'HEAD') {
  const command = argv.join(' ');
  const startedAt = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8' });
  const finishedAt = new Date().toISOString();

  // 指纹在命令结束后计算：绑定的是"被验证过的那份代码状态"
  const { fingerprint } = diffFingerprint(cwd, base);

  const receipt = {
    version: 1,
    id: createHash('sha256').update(command + startedAt).digest('hex').slice(0, 12),
    command,
    exitCode: r.status ?? (r.error ? 127 : 1),
    signal: r.signal ?? null,
    startedAt,
    finishedAt,
    base,
    fingerprint,
    tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.slice(-TAIL_LEN),
  };
  ensureStoreExcluded(cwd);
  const file = writeReceipt(cwd, receipt);
  return { receipt, file };
}
