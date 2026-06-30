#!/usr/bin/env bash
# Week 1：用 curl 发第一条 chat 请求（需先在根目录 .env 配置 OPENAI_API_KEY）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请先复制 .env.example"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${OPENAI_API_KEY:-}" || "$OPENAI_API_KEY" == "sk-your-key-here" ]]; then
  echo "请先在 .env 中配置 OPENAI_API_KEY"
  exit 1
fi

BASE_URL="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

echo "→ POST $BASE_URL/chat/completions"
echo "→ model: $MODEL"
echo

curl -sS "$BASE_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [{\"role\": \"user\", \"content\": \"你好，用一句话介绍你自己\"}],
    \"temperature\": 0.7
  }" | node -e "
    let s='';
    process.stdin.on('data',d=>s+=d);
    process.stdin.on('end',()=>{
      const j=JSON.parse(s);
      if(j.error){ console.error(j.error); process.exit(1); }
      console.log('回复:', j.choices?.[0]?.message?.content);
      if(j.usage) console.log('usage:', j.usage);
    });
  "
