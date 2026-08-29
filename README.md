# claimcheck

> 输入 coding agent 的完成声明，输出机械核验结论。**只认证据，不认声明。**

AI 说它做完了——怎么证明它真做完了？`claimcheck` 把 agent 的完成声明（改了哪些文件、跑了哪些验证、结果如何）与 git 权威状态和执行凭证逐项对表，给出结构化判定。

## 四值判定（不得合并）

| verdict | 含义 | exit code |
|---|---|---|
| `PASS` | 声明与证据逐项吻合 | 0 |
| `VIOLATION` | 证据齐全地证明声明不成立（附 subtype：`out-of-scope` / `business-failure` / …） | 1 |
| `INSUFFICIENT_EVIDENCE` | 声明无法核验：没留凭证、claim 文件本身不成立 | 2 |
| `CONFIG_ERROR` | 门禁自身故障：非 git 仓库、配置缺失等 | 3 |

## 用法

```bash
# 通过包装器执行验证命令，留下绑定 diff 指纹的凭证（存 .claimcheck/receipts/）
node src/cli.mjs run npm test

# 核验完成声明：scope + execution + freshness 三项全过才 PASS
node src/cli.mjs verify --claim claim.yaml --base HEAD

# MCP server（Claude Code / Qoder / Codex 均可挂，stdio 零依赖）
node src/cli.mjs mcp

# 端到端 demo：故意谎报三次全部被抓住（临时目录，不碰真实仓库）
bash examples/e2e-demo.sh
```

MCP 工具：`claimcheck_run`（留凭证）、`claimcheck_verify`（四值判定 + 逐项证据）。Claude Code Stop hook 示例见 `hooks/claude-code-stop-hook.sh`——agent 收尾时自动核验，非 PASS 即拦截并把证据回喂给 agent。

- `execution`：声称跑过的命令必须有真实凭证；声称 pass 但凭证失败 → `VIOLATION (business-failure)`
- `freshness`：凭证绑定的 diff 指纹必须与当前工作区一致；验证后又改了代码 → `VIOLATION (stale-evidence)`
- 凭证目录自动加入 `.git/info/exclude`，不污染 diff 与 scope 核验
- 声明不含任何验证命令时，执行维度判 `INSUFFICIENT_EVIDENCE`（fail-closed）

`claim.yaml`（JSON 语法，合法 YAML 子集）：

```json
{
  "version": 1,
  "task": "给定价模块加批量折扣接口",
  "scope": { "allowedPaths": ["src/pricing/**", "test/pricing/**"] },
  "verification": [{ "command": "npm test", "result": "pass" }]
}
```

输出为结构化 JSON，含逐项证据：

```json
{
  "verdict": "VIOLATION",
  "task": "给定价模块加批量折扣接口",
  "checks": [
    { "name": "scope", "verdict": "PASS", "evidence": ["全部 2 个改动文件均在声明范围内（src/pricing/**, test/pricing/**）"] },
    { "name": "execution", "verdict": "PASS", "evidence": ["\"npm test\" 有凭证（a1b2c3…），退出码 0，与声称一致"] },
    { "name": "freshness", "verdict": "VIOLATION", "subtype": "stale-evidence",
      "evidence": ["凭证 a1b2c3 绑定指纹 …与当前工作区不一致——验证之后代码又变过"] }
  ],
  "subtype": "stale-evidence"
}
```

## 设计原则

- **fail-closed**：拿不到证据 = 不通过；任何解析/环境失败收敛到 `CONFIG_ERROR` 或 `INSUFFICIENT_EVIDENCE`，绝不放行。
- **零运行时依赖**：Node 18+ 直接跑；glob、schema、核验全部内置。
- **claim 是声明，不是配置**：claim 文件不成立是 `INSUFFICIENT_EVIDENCE`（补声明），门禁环境坏了才是 `CONFIG_ERROR`（修门禁）。

## 明确的非目标

不做 spec 流程管理、不做任务编排、不做代码质量评审、不做 CI 平台。只回答"声明是否有证据"。

## Roadmap

- ~~W1：claim schema + `scope` 核验器 + 单测~~ ✅
- ~~W2：`claimcheck run <cmd>` 执行凭证（receipt，绑定 diff 指纹）+ `execution` / `freshness` 核验器~~ ✅
- ~~W3：MCP server 薄封装 + Claude Code Stop hook 示例 + 端到端 demo~~ ✅
- W4：真实工作流 dogfood + 20+ 场景 eval 集

## 测试

```bash
npm test
```

## 许可

MIT
