# cinenext-1

Livepeer 播放 Mini App + 纯前端管理后台。

## 新增后端能力（Vercel Functions）

已实现以下服务端接口（需配置 Postgres）：

- 用户鉴权：`/api/auth/telegram`、`/api/users/me`
- 互动：`/api/interactions/toggle-like`、`/api/comments/create`、`/api/share/track`
- 播放回传：`/api/playback/event`
- 广告事件：`/api/adsgram/event`
- 剧文本管理：`/api/dramas/list`、`/api/dramas/upsert`
- 订单（TON）：`/api/orders/create`、`/api/orders/confirm`
- 上链批处理（Cron）：`/api/cron/onchain-batch`、`/api/cron/onchain-anchor`

数据库初始化 SQL：`db/schema.sql`

关键环境变量（见 `.env.example`）：

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TONPAY_MERCHANT_WALLET`
- `CRON_SECRET`
- `VITE_ADSGRAM_BLOCK_ID`
- `ONCHAIN_ANCHOR_WEBHOOK`

## 广告解锁

前端已接入 AdsGram 激励广告流程：

- NFT 锁定视频会出现“广告解锁”按钮
- 成功观看后会记录 `reward` 事件并临时解锁当前视频
- 相关回传接口：`/api/adsgram/event`

需要在环境变量中配置：`VITE_ADSGRAM_BLOCK_ID`

## 上链锚定流程

- `/api/cron/onchain-batch` 每小时生成一条 batch（Merkle Root）
- 配置 `ONCHAIN_ANCHOR_WEBHOOK` 后会自动尝试提交上链并回写 `tx_hash`
- 也可由外部服务调用 `/api/cron/onchain-anchor` 手动回写 `batchId + txHash`

## 本地开发

```bash
npm install
npm run dev
```

- 播放端：`http://localhost:3000/`
- 管理后台：`http://localhost:3000/admin.html`
- 上传页：`http://localhost:3000/upload.html`

## 管理后台（Livepeer API 直连）

`admin.html` 已支持：

- 填写并保存 API Key（浏览器本地存储）
- 拉取 Livepeer 资产列表（按剧名分组、集数排序）
- 编辑资产名称与 metadata（JSON）
- 删除资产

`upload.html` 已支持：

- 独立上传视频（tus 分片上传）
- 写入 `seriesName` 与 `episodeNumber` metadata

建议的 metadata 字段：

```json
{
	"unlockType": "nft",
	"nftCollectionAddress": "EQ...",
	"price": "5",
	"category": "甜宠"
}
```

## 构建

```bash
npm run build
```

构建产物在 `dist/`，包含 `index.html` 与 `admin.html`。

## 本地命令行上传（不走浏览器）

当浏览器上传遇到 `Failed to fetch`（常见于静态托管环境）时，可使用本地 CLI 直连 Livepeer 上传：

```bash
npm run upload -- \
	--api-key <LIVEPEER_API_KEY> \
	--series "总裁的替身新娘" \
	--total 20 \
	--start 1 \
	--free 3 \
	--price 0.5 \
	./videos/ep01.mp4 ./videos/ep02.mp4
```

说明：

- 文件会按文件名自然排序后上传（顺序即集数）。
- 自动写入 metadata：`seriesName`、`episodeNumber`、`totalEpisodes`、`freeEpisodes`、`price` 等。
- 付费规则：`episodeNumber <= freeEpisodes` 时价格自动写 `0`。

## 本地代理 + 浏览器上传（推荐）

如果你想继续用浏览器页面上传，但线上静态站被 `Failed to fetch` 卡住，可在本机启动代理服务：

```bash
export LIVEPEER_API_KEY=<你的Livepeer_API_Key>
npm run local:web
```

启动后用浏览器打开：

- 管理页：`http://localhost:4173/admin.html`
- 上传页：`http://localhost:4173/upload.html`

说明：

- 该服务会同时托管页面与 `/api/request-upload` 代理。
- 上传页会在直连失败时自动回退到代理。
- 建议设置环境变量：`LIVEPEER_API_KEY`（服务端固定 key，避免前端域名白名单限制）。
- 在 `app.github.dev` 域名下，上传会优先走本地代理。