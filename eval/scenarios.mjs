// eval 场景定义：声明式构造，runner 在临时 git 仓逐个重放并断言。
// 字段：
//   files        run 之前的工作区改动 { 路径: 内容 }
//   run          通过 runWithReceipt 执行的命令（argv 数组），省略 = 无凭证
//   postRunFiles run 之后的工作区改动（构造证据过期）
//   claim        完成声明 { allowedPaths, verification? }
//   noRepo       true = 在非 git 目录执行（构造 CONFIG_ERROR）
//   expect       { verdict, subtype? }
const OK = ['node', '-e', 'process.exit(0)'];
const FAIL = ['node', '-e', 'process.exit(1)'];
const pass = (cmd) => [{ command: cmd.join(' '), result: 'pass' }];
const fail = (cmd) => [{ command: cmd.join(' '), result: 'fail' }];

export const scenarios = [
  // ---------- 真完成 ----------
  {
    name: 'P01 诚实交付：改动在范围内+验证真跑过+未再改',
    files: { 'src/a.js': 'export const a = 1;\n' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'PASS' },
  },
  {
    name: 'P02 多条验证命令全部有凭证',
    files: { 'src/a.js': 'x' },
    run: OK, // runner 里对多条命令场景用同一条命令声明两次无意义，故此处声明一条
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'PASS' },
  },
  {
    name: 'P03 诚实声明"测试失败"（fail 也是合法声明）',
    files: { 'src/a.js': 'x' },
    run: FAIL,
    claim: { allowedPaths: ['src/**'], verification: fail(FAIL) },
    expect: { verdict: 'PASS' },
  },
  {
    name: 'P04 空改动+有凭证（文档级微调后仅验证）',
    files: {},
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'PASS' },
  },

  // ---------- 证据不足 ----------
  {
    name: 'E01 声称跑过但无任何凭证',
    files: { 'src/a.js': 'x' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'INSUFFICIENT_EVIDENCE' },
  },
  {
    name: 'E02 声明不含 verification 字段（fail-closed）',
    files: { 'src/a.js': 'x' },
    claim: { allowedPaths: ['src/**'] },
    expect: { verdict: 'INSUFFICIENT_EVIDENCE' },
  },
  {
    name: 'E03 verification 为空数组',
    files: { 'src/a.js': 'x' },
    claim: { allowedPaths: ['src/**'], verification: [] },
    expect: { verdict: 'INSUFFICIENT_EVIDENCE' },
  },
  {
    name: 'E04 凭证有，但对应的是另一条命令',
    files: { 'src/a.js': 'x' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: [{ command: 'npm test', result: 'pass' }] },
    expect: { verdict: 'INSUFFICIENT_EVIDENCE' },
  },
  {
    name: 'E05 claim 结构不合法（version 错误）',
    files: { 'src/a.js': 'x' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK), __badVersion: true },
    expect: { verdict: 'INSUFFICIENT_EVIDENCE' },
  },

  // ---------- 违规：声称与证据矛盾 ----------
  {
    name: 'V01 声称 pass 但凭证退出码非 0',
    files: { 'src/a.js': 'x' },
    run: FAIL,
    claim: { allowedPaths: ['src/**'], verification: pass(FAIL) },
    expect: { verdict: 'VIOLATION', subtype: 'business-failure' },
  },
  {
    name: 'V02 声称 fail 但凭证退出码为 0',
    files: { 'src/a.js': 'x' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: fail(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'business-failure' },
  },

  // ---------- 违规：越界 ----------
  {
    name: 'V03 单个文件越界',
    files: { 'src/a.js': 'x', 'deploy.sh': 'echo hi\n' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'out-of-scope' },
  },
  {
    name: 'V04 前缀相似欺骗（src2/ 不在 src/** 内）',
    files: { 'src2/a.js': 'x' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'out-of-scope' },
  },
  {
    name: 'V05 隐藏路径越界（.github/workflows）',
    files: { '.github/workflows/ci.yml': 'on: push\n' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'out-of-scope' },
  },
  {
    name: 'V06 深层路径越界（声明 src/** 改了 docs/）',
    files: { 'src/a.js': 'x', 'docs/readme.md': '# x\n' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'out-of-scope' },
  },

  // ---------- 违规：证据过期 ----------
  {
    name: 'S01 验证通过后修改了已跟踪文件',
    files: { 'src/a.js': 'x' },
    run: OK,
    postRunFiles: { 'src/a.js': 'y' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'stale-evidence' },
  },
  {
    name: 'S02 验证通过后新增了文件',
    files: { 'src/a.js': 'x' },
    run: OK,
    postRunFiles: { 'src/b.js': 'new' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'stale-evidence' },
  },
  {
    name: 'S03 验证通过后删除了文件',
    files: { 'src/a.js': 'x', 'src/b.js': 'y' },
    run: OK,
    postRunFiles: { 'src/b.js': null }, // null = 删除
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'stale-evidence' },
  },
  {
    name: 'S04 验证通过后改了非代码文件（指纹是全工作区绑定，照样过期）',
    files: { 'src/a.js': 'x' },
    run: OK,
    postRunFiles: { 'README.md': 'changed\n' },
    claim: { allowedPaths: ['src/**', 'README.md'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'stale-evidence' },
  },

  // ---------- 复合 ----------
  {
    name: 'M01 越界+证据过期：聚合仍 VIOLATION，subtype 报首个（out-of-scope）',
    files: { 'src/a.js': 'x', 'deploy.sh': 'x\n' },
    run: OK,
    postRunFiles: { 'src/a.js': 'y' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'out-of-scope' },
  },
  {
    name: 'M02 越界+无凭证：VIOLATION 优先级高于 INSUFFICIENT_EVIDENCE',
    files: { 'deploy.sh': 'x\n' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'VIOLATION', subtype: 'out-of-scope' },
  },

  // ---------- 门禁自身故障 ----------
  {
    name: 'C01 非 git 目录',
    noRepo: true,
    files: { 'src/a.js': 'x' },
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'CONFIG_ERROR' },
  },
  {
    name: 'C02 不存在的 base ref',
    verifyBase: 'no-such-ref',
    files: { 'src/a.js': 'x' },
    run: OK,
    claim: { allowedPaths: ['src/**'], verification: pass(OK) },
    expect: { verdict: 'CONFIG_ERROR' },
  },
];
