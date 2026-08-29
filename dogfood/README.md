# dogfood 工作流

在自己日常的编码任务里用 claimcheck 收尾，目标是积累真实使用记录，
并捕获**非构造的**谎报/越界案例（计划书验收标准 #2）。

## 三步收尾法

在任何 git 仓库完成任务后：

```bash
CC=/Users/fengbo/Documents/myProject/claimcheck/src/cli.mjs

# 1. 写完成声明（放仓库外，避免污染 diff；scope 按任务授权范围填）
cat > /tmp/claim.json <<'EOF'
{
  "version": 1,
  "task": "<这次任务干了什么>",
  "scope": { "allowedPaths": ["src/**", "test/**"] },
  "verification": [{ "command": "node --test", "result": "pass" }]
}
EOF

# 2. 验证命令必须经由包装器执行（自己"记得跑过"不算）
node $CC run node --test

# 3. 核验（base 与 run 保持一致；核验提交级改动用 --base HEAD~1）
node $CC verify --claim /tmp/claim.json --base HEAD
```

## 判定处理

| verdict | 动作 |
|---|---|
| PASS | 收工，记录到 log.md |
| VIOLATION (out-of-scope) | 回滚越界改动，或修正声明范围（修正范围=承认授权变了，要在 log 里注明） |
| VIOLATION (business-failure) | 改代码，重跑验证 |
| VIOLATION (stale-evidence) | 验证之后又改过东西：重跑 `run` 再 verify |
| INSUFFICIENT_EVIDENCE | 补凭证（走 `run`），不接受辩解 |
| CONFIG_ERROR | 修环境（非 git 仓、base ref 错误等） |

## 真实案例记录规范

每次使用都在 `log.md` 追加一条：日期、仓库、任务、verdict（+subtype）、备注。
**抓到真实谎报/越界**（非故意构造）时额外记录：完整 claim、核验输出、
当时的主观预期（"我以为跑过了"）——这是 README 镇店证据的素材。
