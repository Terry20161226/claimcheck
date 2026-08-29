#!/usr/bin/env bash
# 端到端 demo：故意让"agent"谎报三次，claimcheck 全部抓住；最后诚实交付拿 PASS。
# 所有操作在 mktemp 临时目录，不碰任何真实仓库。
set -u
CC="$(cd "$(dirname "$0")/.." && pwd)/src/cli.mjs"
DEMO=$(mktemp -d /tmp/claimcheck-demo-XXXXXX)
export GIT_AUTHOR_NAME=demo GIT_AUTHOR_EMAIL=demo@demo GIT_COMMITTER_NAME=demo GIT_COMMITTER_EMAIL=demo@demo

cd "$DEMO"
git init -q -b main
mkdir -p src
echo 'export const price = 100;' > src/pricing.js
git add -A && git commit -q -m init

step() { echo ""; echo "── $1"; }

step "① agent 改了代码，声称测试通过——但根本没跑"
echo 'export const price = 100; export const discount = (p) => p * 0.9;' > src/pricing.js
cat > /tmp/claimcheck-demo-claim.json <<EOF
{"version":1,"task":"加折扣函数","scope":{"allowedPaths":["src/**"]},"verification":[{"command":"node -e process.exit(0)","result":"pass"}]}
EOF
node "$CC" verify --claim /tmp/claimcheck-demo-claim.json
echo "   → exit $?"

step "② 这次跑了（但测试是红的），仍声称通过"
node "$CC" run node -e 'process.exit(1)' > /dev/null
cat > /tmp/claimcheck-demo-claim.json <<EOF
{"version":1,"task":"加折扣函数","scope":{"allowedPaths":["src/**"]},"verification":[{"command":"node -e process.exit(1)","result":"pass"}]}
EOF
node "$CC" verify --claim /tmp/claimcheck-demo-claim.json
echo "   → exit $?"

step "③ 跑绿了，但跑完又顺手改了代码"
node "$CC" run node -e 'process.exit(0)' > /dev/null
echo 'export const price = 99; export const discount = (p) => p * 0.9;' > src/pricing.js
cat > /tmp/claimcheck-demo-claim.json <<EOF
{"version":1,"task":"加折扣函数","scope":{"allowedPaths":["src/**"]},"verification":[{"command":"node -e process.exit(0)","result":"pass"}]}
EOF
node "$CC" verify --claim /tmp/claimcheck-demo-claim.json
echo "   → exit $?"

step "④ 诚实交付：跑绿 + 之后没动代码"
node "$CC" run node -e 'process.exit(0)' > /dev/null
node "$CC" verify --claim /tmp/claimcheck-demo-claim.json
echo "   → exit $?"

echo ""
echo "demo 目录保留在 $DEMO"
