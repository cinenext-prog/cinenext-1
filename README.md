# cinenext-1

Livepeer 播放 Mini App + 纯前端管理后台。

## 本地开发

```bash
npm install
npm run dev
```

- 播放端：`http://localhost:3000/`
- 管理后台：`http://localhost:3000/admin.html`

## 管理后台（Livepeer API 直连）

`admin.html` 已支持：

- 填写并保存 API Key（浏览器本地存储）
- 拉取 Livepeer 资产列表
- 上传本地视频（tus 分片上传）
- 编辑资产名称与 metadata（JSON）
- 删除资产

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