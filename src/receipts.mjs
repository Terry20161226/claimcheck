// receipt 存储：.claimcheck/receipts/，并加入 .git/info/exclude——
// 凭证目录绝不能污染 diff（否则 scope 核验会把凭证本身判成越界）。
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STORE = '.claimcheck/receipts';

export function ensureStoreExcluded(cwd) {
  const excludeFile = join(cwd, '.git', 'info', 'exclude');
  if (!existsSync(excludeFile)) return; // 非 git 仓库由调用方先行拦截
  const content = readFileSync(excludeFile, 'utf8');
  if (!content.split('\n').includes('.claimcheck/')) {
    writeFileSync(excludeFile, `${content.trimEnd()}\n.claimcheck/\n`);
  }
}

export function writeReceipt(cwd, receipt) {
  const dir = join(cwd, STORE);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${receipt.id}.json`);
  writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
  return file;
}

export function listReceipts(cwd) {
  const dir = join(cwd, STORE);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
