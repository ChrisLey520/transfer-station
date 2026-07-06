# Claude Code Transfer Station

一个面向 Claude Code 的 API 中转站原型，包含中转 API、密钥管理、Token 用量统计、使用日志、套餐管理，以及类似 Codex 的双滚动额度限制：

- 5 小时滚动 Token 上限
- 7 天滚动 Token 上限
- 任一窗口耗尽时，请求会被 `429` 拦截
- 管理台支持简体中文、繁体中文、英文

## Run Locally

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

管理台：

```text
http://localhost:5173
```

API 中转服务：

```text
http://localhost:8787
```

淘宝消息 worker：

```bash
pnpm run dev:taobao-worker
```

## Environment

上游渠道、Claude Code / Codex API URL、上游 API Key 和计费倍率都在管理员渠道页维护。`.env` 只需要保留端口、数据库、管理员等运行配置。

可选管理保护：

```bash
ADMIN_TOKEN=your-admin-token
ADMIN_EMAILS=demo@example.com
```

普通用户注册后身份为会员。`ADMIN_EMAILS` 中的邮箱会在启动时标记为管理员，内置演示账号 `demo@example.com / demo123456` 默认为管理员。管理台 API 支持管理员登录态访问，也兼容设置 `ADMIN_TOKEN` 后使用 `x-admin-token` 访问。

淘宝自动发码需要额外配置：

```bash
TAOBAO_APP_KEY=your-taobao-app-key
TAOBAO_APP_SECRET=your-taobao-app-secret
TAOBAO_TMC_GROUP=your-tmc-group
TAOBAO_REDIRECT_URI=https://your-domain.example.com/api/taobao/oauth/callback
TAOBAO_OAUTH_STATE=your-random-state
```

可选项：

```bash
TAOBAO_TMC_INTERVAL_MS=5000
TAOBAO_TMC_QUANTITY=10
TAOBAO_TOP_ENDPOINT=https://eco.taobao.com/router/rest
TAOBAO_TOKEN_ENDPOINT=https://oauth.taobao.com/token
```

## Production Deploy

生产启动默认只执行数据库结构初始化，不会自动写入默认套餐、默认管理员、默认渠道，也不会在启动时回填历史 usage cost。新环境首次部署后，需要显式跑一次种子数据：

```bash
pnpm run build
pnpm run seed:prod
pnpm run start
```

也可以只在首次启动或一次性迁移时临时开启：

```bash
SEED_ON_START=1 pnpm run start
```

k3s 部署脚本默认不跑 seed。新集群首次部署或需要同步默认数据时执行：

```bash
DEPLOY_RUN_SEED=1 pnpm run deploy:k3s
```

普通滚动发布继续使用：

```bash
pnpm run deploy:k3s
```

## Taobao Auto Gift Codes

淘宝优先使用 TMC 消息通知触发发码，不依赖定时扫描订单。基本流程：

1. 在淘宝开放平台准备应用，开通交易消息相关能力，并配置回调地址 `/api/taobao/oauth/callback`。
2. 在管理台「礼品码」页面的「淘宝自动发码」区域保存店铺 Session，或通过 OAuth 回调写入店铺授权。
3. 点击「开通 TMC」，调用 `taobao.tmc.user.permit` 为店铺开通消息服务。
4. 配置淘宝商品 ID / SKU ID 到礼品卡类型的映射，可选择套餐礼品卡或余额礼品卡。
5. 启动 `pnpm run dev:taobao-worker`（生产环境用 `pnpm run start:taobao-worker`）消费 TMC 消息；Kubernetes 样例已把 worker 作为 sidecar 容器启动。
6. 买家付款后，worker 拉取订单详情并自动生成兑换码；买家登录后可在 `/orders` 的「我的订单」输入订单号领取。

当前实现不主动通过旺旺/客服消息发送动态兑换码，因为这类能力通常需要额外类目、客服或消息权限。先用「我的订单」取码完成闭环，后续拿到权限后可以在订单生成后扩展自动回复通道。

## Proxy Endpoints

Claude Code 和 Codex 使用各自的专用入口：

```text
POST http://localhost:8787/claude-code/v1/messages
POST http://localhost:8787/codex/v1/responses
```

客户端使用管理台创建的 `ccx_...` 密钥访问中转站，中转站会按 Agent 类型智能调度到对应上游渠道和上游 API Key。

示例：

```bash
curl http://localhost:8787/claude-code/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: ccx_your_transfer_station_key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 256,
    "messages": [
      { "role": "user", "content": "hello" }
    ]
  }'
```

当前 Claude 系列模型示例：

- Sonnet: `claude-sonnet-4-6`
- Opus: `claude-opus-4-8`
- Haiku: `claude-haiku-4-5`

健康检查端点：

```text
GET http://localhost:8787/claude-code/v1/key/health
GET http://localhost:8787/codex/v1/key/health
```

健康检查会先用当前中转 Key 做本地额度预检：如果 5 小时、7 天滚动额度与自由余额都不足，会直接返回 `402`，不会继续探测上游。只有本地额度预检通过后，中转站才会向上游发送固定的极短探测消息 `Reply OK.`。任一可用上游渠道能返回正常模型回复即视为健康；所有上游渠道都失败或无文本回复时返回不健康。`Claude Code` 与 `Codex` 的探测请求都限制最大输出 Token 为 8，且不写入用户用量日志，也不会额外消耗额度。

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
