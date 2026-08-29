#!/usr/bin/env bash
# Claude Code Stop hook：agent 收尾时强制核验完成声明，不过则拦截收尾。
# 配置方式（项目 .claude/settings.json）：
#   {
#     "hooks": {
#       "Stop": [{
#         "matcher": "",
#         "hooks": [{ "type": "command", "command": "bash /path/to/claimcheck/hooks/claude-code-stop-hook.sh" }]
#       }]
#     }
#   }
#
# 协议：Stop hook 从 stdin 读会话 JSON；exit 0 = 允许收尾；
# exit 2 = 拦截，stderr 内容回喂给 agent 继续修。
# 环境变量：CLAIMCHECK_CLAIM（claim 文件路径，默认 ./claim.yaml）、CLAIMCHECK_HOME（claimcheck 仓库路径）

set -u
CLAIMCHECK_HOME="${CLAIMCHECK_HOME:-$(cd "$(dirname "$0")/.." && pwd)}"
CLAIM="${CLAIMCHECK_CLAIM:-claim.yaml}"

cat > /dev/null  # 消费 stdin（会话 JSON，本示例不用）

if [ ! -f "$CLAIM" ]; then
  echo "claimcheck: 找不到 $CLAIM —— 收尾前必须先写完成声明（scope.allowedPaths + verification）。" >&2
  exit 2
fi

out=$(node "$CLAIMCHECK_HOME/src/cli.mjs" verify --claim "$CLAIM" 2>&1)
code=$?

if [ "$code" -ne 0 ]; then
  echo "claimcheck 拦截收尾（exit $code）：" >&2
  echo "$out" >&2
  echo "" >&2
  echo "修复方向：VIOLATION=按 subtype 改代码/回滚越界/重跑验证；INSUFFICIENT_EVIDENCE=用 claimcheck run 补凭证；CONFIG_ERROR=修门禁环境。" >&2
  exit 2
fi
exit 0
