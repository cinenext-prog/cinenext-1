# Livepeer Telegram Mini App 🎥

一个集成了 Livepeer 视频播放 SDK 的 Telegram Mini App，可以在 Telegram 中直接播放去中心化视频内容。

## ✨ 特性

- 🎬 集成 Livepeer 视频播放器
- 📱 完整的 Telegram Mini App 支持
- 🎨 适配 Telegram 主题色
- 📺 响应式视频播放界面
- 🔄 视频列表切换
- ⚡ 基于 Vite + React 构建

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置视频 Playback ID

编辑 `src/App.jsx`，将 `sampleVideos` 数组中的 `playbackId` 替换为你自己的视频 ID：

```javascript
const sampleVideos = [
  {
    id: 1,
    title: '我的视频',
    description: '这是我的视频描述',
    playbackId: 'your_actual_playback_id_here',
  },
];
```

> 💡 从 [Livepeer Studio](https://livepeer.studio) 上传视频后获取 Playback ID

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

### 4. 构建生产版本

```bash
npm run build
```

构建后的文件将输出到 `dist/` 目录。

## 📱 部署为 Telegram Mini App

### 1. 部署应用

将构建后的 `dist/` 目录部署到任何静态托管服务：

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

### 2. 在 Telegram 中创建 Mini App

1. 与 [@BotFather](https://t.me/botfather) 对话
2. 创建新机器人或使用现有机器人
3. 使用 `/newapp` 命令创建 Mini App
4. 提供你部署的应用 URL
5. 配置图标和描述

### 3. 测试

在 Telegram 中打开你的 Mini App，享受去中心化视频播放体验！

## 🛠️ 技术栈

- **前端框架**: React 18
- **构建工具**: Vite 5
- **视频播放**: Livepeer React SDK v4
- **Mini App SDK**: @telegram-apps/sdk
- **样式**: 原生 CSS with Telegram 主题变量

## 📁 项目结构

```
.
├── index.html              # HTML 入口
├── package.json           # 项目配置
├── vite.config.js        # Vite 配置
└── src/
    ├── main.jsx          # 应用入口
    ├── App.jsx           # 主应用组件
    ├── index.css         # 全局样式
    ├── player.css        # 播放器样式
    └── components/
        └── VideoPlayer.jsx  # Livepeer 播放器组件
```

## 🎨 定制化

### 修改主题色

编辑 `src/player.css` 中的颜色配置：

```css
[data-livepeer-range] {
  background: var(--tg-theme-button-color, #3390ec);  /* 修改颜色 */
}
```

### 添加更多视频

在 `src/App.jsx` 的 `sampleVideos` 数组中添加更多视频项：

```javascript
const sampleVideos = [
  {
    id: 3,
    title: '新视频',
    description: '描述',
    playbackId: 'playback_id_here',
  },
  // 添加更多...
];
```

## 📚 相关资源

- [Livepeer 文档](https://docs.livepeer.org/)
- [Telegram Mini Apps 文档](https://core.telegram.org/bots/webapps)
- [Vite 文档](https://vitejs.dev/)
- [React 文档](https://react.dev/)

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

Made with ❤️ for decentralized video streaming