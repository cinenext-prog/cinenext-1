# Vercel 私有播放（方案 B）

这个方案不需要自建服务器：
- 前端部署在 Vercel
- 使用 Vercel Serverless Function 生成短时 JWT
- 前端用签名 URL 播放私有 Livepeer 视频

## 已实现内容

- API: `/api/playback-url`（见 `api/playback-url.js`）
- 前端：添加视频源时自动请求签名 URL，成功则按私有流播放；失败时回退公开 URL 并提示
- API: `/api/request-upload`（见 `api/request-upload.js`），用于代理 Livepeer 上传票据请求（解决浏览器端 `Failed to fetch`）

## 你需要配置的环境变量（Vercel）

在 Vercel 项目设置里添加：

- `LIVEPEER_JWT_PRIVATE_KEY`
  - Livepeer Signing Key 的私钥（PEM）
  - 可直接粘贴多行 PEM；如果保存成单行，保留 `\n` 也可
- `LIVEPEER_JWT_ISSUER`
  - Signing Key 对应的 issuer（通常是该 key 的 public identifier）
- `LIVEPEER_JWT_KEY_ID`（可选）
  - JWT header 的 `kid`，不填时默认使用 `LIVEPEER_JWT_ISSUER`
- `LIVEPEER_JWT_TTL_MINUTES`（可选）
  - JWT 有效期（分钟），默认 `30`
- `LIVEPEER_API_KEY`（用于上传代理，推荐）
  - 后端调用 Livepeer 上传票据接口时使用

## 在 Livepeer Studio 里准备 Signing Key

1. 进入 Livepeer Studio
2. 打开 Access Control / Signing Keys
3. 创建或查看一个用于 Playback JWT 的 Signing Key
4. 复制 Private Key 和对应的 Public/Issuer 标识

> 不要把私钥写进前端代码或提交到 Git。

## 部署步骤

1. 把仓库导入 Vercel
2. 在 Vercel 设置上述环境变量
3. 触发部署
4. 打开站点，输入私有 `playbackId` 测试播放

## 本地开发（可选）

如果你要本地联调 API，使用：

```bash
npx vercel dev
```

然后访问 Vercel 本地地址（不是 `vite` 的纯静态开发地址），因为 `/api/playback-url` 需要函数运行时。

## 常见问题

- 提示“未获取到签名播放地址”
  - 说明 `/api/playback-url` 不可用或环境变量没配好
- `playbackId` 正确但仍无法播放
  - 检查资源访问控制策略是否要求特定 claims
  - 检查 Signing Key 是否与该资源策略匹配

- 上传时报错 `无法申请上传地址：连接 Livepeer API 失败：Failed to fetch`
  - 说明浏览器直连上传票据接口被网络/CORS策略拦截
  - 使用 `/api/request-upload` 代理即可规避（推荐部署在 Vercel，并配置 `LIVEPEER_API_KEY`）

## 安全建议

- 私钥仅放在 Vercel 环境变量
- JWT 过期时间尽量短
- 前端只接收签名结果，不接触密钥
