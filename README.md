# cinenext-1

Livepeer 播放 Mini App + 纯前端管理后台。

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