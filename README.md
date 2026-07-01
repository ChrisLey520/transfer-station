# Claude Code Transfer Station

一个面向 Claude Code 的 API 中转站原型，包含中转 API、密钥管理、Token 用量统计、使用日志、套餐管理，以及类似 Codex 的双滚动额度限制：

- 5 小时滚动 Token 上限
- 7 天滚动 Token 上限
- 任一窗口耗尽时，请求会被 `429` 拦截
- 管理台支持简体中文、繁体中文、英文

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

管理台：

```text
http://localhost:5173
```

API 中转服务：

```text
http://localhost:8787
```

## Environment

在 `.env` 中配置上游 Anthropic API Key：

```bash
ANTHROPIC_API_KEY=sk-ant-your-upstream-key
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_VERSION=2023-06-01
```

可选管理保护：

```bash
ADMIN_TOKEN=your-admin-token
```

设置后，管理台 API 需要 `x-admin-token`。不设置时为本地开发模式。

## Claude Code Proxy Endpoint

中转入口兼容 Anthropic Messages API：

```text
POST http://localhost:8787/v1/messages
```

客户端使用管理台创建的 `ccx_...` 密钥访问中转站，中转站再使用 `.env` 里的 `ANTHROPIC_API_KEY` 访问上游。

示例：

```bash
curl http://localhost:8787/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: ccx_your_transfer_station_key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 256,
    "messages": [
      { "role": "user", "content": "hello" }
    ]
  }'
```

## Quota Model

每个 API Key 绑定一个套餐。套餐包含：

- `fiveHourTokenLimit`: 最近 5 小时成功请求的 Token 总量上限
- `weeklyTokenLimit`: 最近 7 天成功请求的 Token 总量上限

中转请求进入时先检查两个滚动窗口。请求完成后，从 Anthropic 响应的 `usage` 中记录输入、输出与总 Token。流式 SSE 请求会边转发边解析 usage，并在结束时写入日志。

## OpenPencil

OpenPencil MCP 已检测到，但当前返回：

```text
OpenPencil app is not connected. The OpenPencil desktop app is not running or no document is open.
```

当前终端 PATH 里也没有找到 `openpencil-cli` 或 `openpencil`。打开 OpenPencil 桌面端并打开一个文档后，可以再让 Codex 重试将页面设计画入 OpenPencil。
