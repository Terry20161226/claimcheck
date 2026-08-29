# dogfood 日志

起始：2026-08-29 ｜ 目标：≥1 周真实使用，捕获 ≥1 次非构造谎报/越界

| 日期 | 仓库 | 任务 | verdict | 备注 |
|---|---|---|---|---|
| 2026-08-29 | claimcheck | dogfood 挂载提交的收尾核验 | INSUFFICIENT_EVIDENCE | **首次真实使用即抓到问题（非构造）**：`run node --test` 中 `--test` 被 CLI 参数解析吞掉，receipt.command 变成 `node`，execution 判"声称执行过 node --test 但没有任何凭证"。主观预期是"肯定 PASS"——这正是工具存在的意义。已修复（`--` 分隔符 + 位置参数优先）并加回归测试 |
| 2026-08-29 | claimcheck | 上述 bug 修复提交的收尾核验 | PASS | scope/execution/freshness 三项全过；双验证命令（node --test + eval 23 场景）凭证齐全、指纹一致 |
