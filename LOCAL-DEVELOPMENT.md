# 🚀 本地开发指南

## ✅ 当前状态

你的项目已完全配置，可以在本地开发！

### 环境配置
- ✅ Node.js 依赖已安装
- ✅ Vite 开发服务器已启动 (http://localhost:3000)
- ✅ React 热更新已启用
- ✅ Telegram SDK 已加载
- ✅ Livepeer SDK 已集成 (API Key: a3eaad66-77f7-4e15-8ee7-4ee59865e603)

---

## 🎯 快速开始

### 1. 启动开发服务器

```bash
npm run dev
```

你会看到：
```
  VITE v5.4.21  ready in 279 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://10.0.12.224:3000/
```

### 2. 打开应用

在浏览器中访问：
```
http://localhost:3000
```

或者在 VS Code 中使用 Simple Browser：
- 按 `Ctrl+Shift+P`
- 输入 `Simple Browser: Show`
- 输入 URL: `http://localhost:3000`

### 3. 开始开发

修改代码后，浏览器会 **自动热更新**（不需要手动刷新）

---

## 📝 项目结构

```
cinenext-1/
├── src/
│   ├── main.jsx              # React 入口
│   ├── App.jsx               # 主应用组件
│   ├── components/
│   │   └── VideoPlayer.jsx   # Livepeer 播放器
│   ├── index.css             # 全局样式
│   └── player.css            # 播放器样式
├── index.html                # HTML 入口
├── vite.config.js            # Vite 配置
├── package.json              # 项目配置
└── dist/                      # 生产构建输出
```

---

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (热更新) |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |

---

## 🎨 配置视频（重要！）

编辑 `src/App.jsx`，替换示例视频 ID：

```javascript
const sampleVideos = [
  {
    id: 1,
    title: '我的视频标题',
    description: '视频描述',
    playbackId: 'YOUR_ACTUAL_PLAYBACK_ID',  // ← 改这里
  },
];
```

获取 Playback ID：
1. 打开 https://livepeer.studio
2. 上传视频
3. 复制 Playback ID

---

## 🔄 部署流程

### 本地开发完成后

```bash
# 1. 构建生产版本
npm run build

# 2. 部署到 GitHub Pages
git add -f dist/
git commit -m "deploy: update application"
git push origin HEAD:gh-pages --force
```

### 或使用快捷命令

```bash
npm run build && git add -f dist/ && git push origin HEAD:gh-pages --force
```

---

## 🧪 测试功能

### Telegram Mini App 功能

本地测试中，Telegram 功能会无法使用（需要在 Telegram 中真实运行）。但你可以：
1. 在浏览器开发者工具检查 `window.Telegram` 对象
2. 查看控制台日志了解执行情况

### 播放器测试

1. 确保已配置有效的 Playback ID
2. 播放器会自动加载和显示视频
3. 测试各个控制器：播放/暂停、音量、全屏等

---

## 🐛 常见问题

### Q: 保存代码后没有热更新？
A: 
- 检查 Vite 服务器是否仍在运行
- 在终端看是否有错误信息
- 重启服务器：`npm run dev`

### Q: 浏览器显示空白页面？
A:
- 打开浏览器开发者工具 (`F12`)
- 查看 Console 标签的错误信息
- 检查网络标签确保所有资源加载成功

### Q: 视频无法播放？
A:
- 确认 Playback ID 是正确的
- 在 Livepeer Studio 确认视频已完全处理
- 检查浏览器是否支持 HLS 流

### Q: 修改后样式没有更新？
A:
- CSS 更新通常是即时的
- 如果没有，尝试 `Ctrl+Shift+R` 硬刷新
- 或清除浏览器缓存

---

## 📚 开发资源

- [Vite 文档](https://vitejs.dev/)
- [React 文档](https://react.dev/)
- [Livepeer 文档](https://docs.livepeer.org/)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)

---

## ✨ 调试技巧

### 查看编译错误

如果页面不加载，终端会显示错误信息。常见的有：
- `Module parse error` - 代码语法错误
- `Cannot find module` - 模块导入错误
- `SyntaxError` - JavaScript 语法错误

### 使用浏览器开发者工具

按 `F12` 打开，查看：
- **Console** - 错误和日志信息
- **Sources** - 调试代码，设置断点
- **Network** - 查看网络请求
- **Application** - 查看存储的数据

### 添加调试日志

```javascript
// 在 App.jsx 或任何组件中
console.log('调试信息', variable);
```

---

## 🚀 准备就绪！

你的本地开发环境已完全配置。现在可以：

1. ✅ 在 `http://localhost:3000` 访问应用
2. ✅ 修改代码并立即看到变化
3. ✅ 构建并部署到 GitHub Pages

**开始开发吧！** 🎉
