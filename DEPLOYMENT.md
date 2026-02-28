# 快速部署指南

## 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 修改视频 ID（编辑 `src/App.jsx`）：
   ```javascript
   const sampleVideos = [
     {
       id: 1,
       title: '我的视频',
       playbackId: '你的_playback_id',
     }
   ];
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 在浏览器中打开 `http://localhost:3000`

## 部署到 Vercel

1. 安装 Vercel CLI：
   ```bash
   npm i -g vercel
   ```

2. 登录并部署：
   ```bash
   vercel
   ```

3. 按照提示完成部署

## 部署到 Netlify

1. 构建项目：
   ```bash
   npm run build
   ```

2. 将 `dist/` 文件夹拖放到 Netlify 网站上

## 部署到 GitHub Pages

1. 安装 gh-pages：
   ```bash
   npm install --save-dev gh-pages
   ```

2. 在 `package.json` 中添加：
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

3. 在 `vite.config.js` 中添加 base 路径：
   ```javascript
   export default defineConfig({
     base: '/你的仓库名/',
     // ... 其他配置
   });
   ```

4. 部署：
   ```bash
   npm run deploy
   ```

## 配置 Telegram Bot

1. 与 [@BotFather](https://t.me/botfather) 对话

2. 创建新机器人：
   ```
   /newbot
   ```

3. 设置 Mini App：
   ```
   /newapp
   选择你的机器人
   提供部署的 URL
   ```

4. 上传图标（推荐 640x360 PNG）

5. 完成！在 Telegram 中测试你的 Mini App

## 获取 Livepeer Playback ID

1. 访问 [Livepeer Studio](https://livepeer.studio)
2. 创建账号或登录
3. 上传视频
4. 复制 Playback ID
5. 替换 `src/App.jsx` 中的 `playbackId`

## 常见问题

### Q: 视频无法播放？
A: 确保你的 playbackId 是正确的，并且视频已在 Livepeer 上成功处理。

### Q: 如何添加更多视频？
A: 在 `src/App.jsx` 的 `sampleVideos` 数组中添加更多对象。

### Q: 如何自定义样式？
A: 编辑 `src/index.css` 和 `src/player.css`。

### Q: Mini App 在 Telegram 中不显示？
A: 确保你的 URL 是 HTTPS，并且已正确配置了 BotFather。

## 技术支持

- [Livepeer 文档](https://docs.livepeer.org/)
- [Telegram Mini Apps 文档](https://core.telegram.org/bots/webapps)
- [Vite 文档](https://vitejs.dev/)
