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
# 当前只实现 W1 范围：scope 核验
node src/cli.mjs verify --claim claim.yaml --base HEAD
```

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
    { "name": "scope", "verdict": "VIOLATION", "subtype": "out-of-scope",
      "evidence": ["声明范围: src/pricing/**, test/pricing/**", "越界文件 (1): deploy.sh"] }
  ],
  "subtype": "out-of-scope"
}
```

## 设计原则

- **fail-closed**：拿不到证据 = 不通过；任何解析/环境失败收敛到 `CONFIG_ERROR` 或 `INSUFFICIENT_EVIDENCE`，绝不放行。
- **零运行时依赖**：Node 18+ 直接跑；glob、schema、核验全部内置。
- **claim 是声明，不是配置**：claim 文件不成立是 `INSUFFICIENT_EVIDENCE`（补声明），门禁环境坏了才是 `CONFIG_ERROR`（修门禁）。

## 明确的非目标

不做 spec 流程管理、不做任务编排、不做代码质量评审、不做 CI 平台。只回答"声明是否有证据"。

## Roadmap

- **W1（当前）**：claim schema + `scope` 核验器 + 单测
- W2：`claimcheck run <cmd>` 执行凭证（receipt，绑定 diff 指纹）+ `execution` / `freshness` 核验器
- W3：MCP server 薄封装 + Claude Code Stop hook 示例 + 端到端 demo
- W4：真实工作流 dogfood + 20+ 场景 eval 集

## 测试

```bash
npm test
```

## 许可

MIT
