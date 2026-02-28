# 🚀 GitHub Pages 部署完成指南

## ✅ 已完成的配置

### 1. 项目结构
- ✅ Vite 配置更新（添加 base 路径：`/cinenext-1/`）
- ✅ package.json 更新（添加 deploy 脚本）
- ✅ gh-pages 包已安装
- ✅ GitHub Actions 工作流已创建

### 2. 文件变更
- ✅ `.github/workflows/deploy.yml` - 自动部署工作流
- ✅ `.env` - 本地环境配置（含 API 密钥）
- ✅ 所有代码已推送到 GitHub

---

## 🔑 关键步骤：在 GitHub 设置 Secret

为了让自动部署工作，你需要在 GitHub 仓库中设置 `LIVEPEER_API_KEY` secret：

### 步骤 1：打开仓库设置
1. 打开 GitHub：https://github.com/cinenext-prog/cinenext-1
2. 点击 **Settings**（设置）标签

### 步骤 2：进入 Secrets 管理
1. 左侧菜单找到 **Secrets and variables** → **Actions**
2. 点击 **New repository secret**（新建仓库密钥）

### 步骤 3：添加密钥
- **Name**：`LIVEPEER_API_KEY`
- **Secret**：`a3eaad66-77f7-4e15-8ee7-4ee59865e603`
- 点击 **Add secret**（添加密钥）

---

## 🎯 部署流程

### 自动部署（推荐）
一旦设置好 secret，每次你推送代码到 `main` 分支时：
1. GitHub Actions 会自动启动构建
2. 自动部署到 GitHub Pages
3. 应用将在以下 URL 可用：

```
https://cinenext-prog.github.io/cinenext-1/
```

### 查看部署状态
1. 打开仓库：https://github.com/cinenext-prog/cinenext-1
2. 点击 **Actions** 标签
3. 查看最新的工作流运行状态

---

## 🌐 访问你的应用

### GitHub Pages URL
```
https://cinenext-prog.github.io/cinenext-1/
```

### 在 Telegram 中使用
将此 URL 配置为 Telegram Bot 的 Mini App URL：
1. 与 @BotFather 对话
2. 编辑 Mini App URL 为上面的地址
3. 在 Telegram 中打开你的 Mini App

---

## 🔄 持续开发流程

### 本地修改 + 自动部署
```bash
# 1. 修改代码
# 2. 提交并推送
git add .
git commit -m "你的提交信息"
git push origin main

# 3. GitHub Actions 自动部署
# 4. 应用将在几分钟内更新到 GitHub Pages
```

### 查看部署日志
1. GitHub Actions 标签页
2. 点击最新的工作流
3. 查看详细的构建和部署日志

---

## ⚙️ 环境变量配置

### 本地开发（`.env` 文件）
```
VITE_LIVEPEER_API_KEY=a3eaad66-77f7-4e15-8ee7-4ee59865e603
```

### GitHub Actions（GitHub Secrets）
```
LIVEPEER_API_KEY = (同上)
```

---

## 📋 检查清单

在部署后验证：

- [ ] GitHub secret `LIVEPEER_API_KEY` 已添加
- [ ] GitHub Pages 已启用（Settings → Pages）
- [ ] 分支选择为 `gh-pages`（如果手动设置）
- [ ] 访问 GitHub Pages URL 能打开应用
- [ ] 视频播放功能正常
- [ ] Telegram SDK 加载正常

---

## 🆘 故障排除

### 问题：部署失败
- **检查**：GitHub Actions 日志（Actions 标签页）
- **常见原因**：Secret 未设置、配置错误
- **解决**：查看工作流日志，确保 `LIVEPEER_API_KEY` secret 已添加

### 问题：访问 404
- **检查**：GitHub Pages 是否启用
- **解决**：Settings → Pages → 确保源为 `gh-pages` 分支

### 问题：样式混乱或资源加载失败
- **原因**：base 路径配置问题
- **已解决**：已在 vite.config.js 中设置 `base: '/cinenext-1/'`

---

## 📚 相关资源

- [GitHub Pages 文档](https://pages.github.com/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html#github-pages)
- [Livepeer 文档](https://docs.livepeer.org/)

---

## ✨ 完成！

你的 Telegram Mini App 已配置好自动部署到 GitHub Pages！

**现在只需：**
1. 在 GitHub 设置 LIVEPEER_API_KEY secret
2. 每次 push 代码时自动部署
3. 在 Telegram 中使用部署的 URL

祝你开发愉快！🎉
