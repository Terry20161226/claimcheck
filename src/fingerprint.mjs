// diff 指纹：绑定"相对 base 的全部改动内容"——跑完验证又改代码，指纹必然变化。
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { changedFiles } from './git.mjs';

export function diffFingerprint(cwd, base = 'HEAD') {
  const files = changedFiles(cwd, base);
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update('\0');
    const p = join(cwd, f);
    h.update(existsSync(p) ? readFileSync(p) : Buffer.from('<deleted>'));
    h.update('\0');
  }
  return { fingerprint: h.digest('hex'), files };
}
