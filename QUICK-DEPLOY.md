# 🚀 快速部署指南

GitHub Actions 遇到了一些配置问题。以下是最快的解决方案：

## ✅ 方法 1：本地一键部署（推荐）

在你的项目目录运行：

```bash
npm run build && git add -f dist/ && git commit -m "deploy" --allow-empty && git push origin HEAD:gh-pages --force
```

或者简化版：

```bash
npm run build
git add -f dist/
git push origin HEAD:gh-pages --force
```

完成后，你的应用将在以下地址可用：
```
https://cinenext-prog.github.io/cinenext-1/
```

---

## ✅ 方法 2：使用部署脚本

项目中已包含自动部署脚本：

```bash
bash deploy-local.sh
```

这个脚本会自动：
1. 构建项目
2. 提交构建文件
3. 部署到 GitHub Pages

---

## 📝 step-by-step 操作步骤

### 第 1 步：构建项目
```bash
npm run build
```

你会看到输出，其中包含：
```
✓ built in 4.67s
```

### 第 2 步：强制添加 dist 文件夹
```bash
git add -f dist/
```

（-f 强制添加，因为 dist/ 在 .gitignore 中被忽略）

### 第 3 步：部署到 gh-pages 分支
```bash
git push origin HEAD:gh-pages --force
```

### 第 4 步：验证

打开你的浏览器，访问：
```
https://cinenext-prog.github.io/cinenext-1/
```

✅ 应该能看到应用了！

---

## 🔄 后续更新

每次修改代码后，只需重复上面的 3 步：

```bash
# 修改代码...
npm run build
git add -f dist/
git push origin HEAD:gh-pages --force
```

或者使用一个快捷别名：

```bash
# 添加到你的 .bash_profile 或 .zshrc
alias deploy-gh="npm run build && git add -f dist/ && git commit -m 'deploy' --allow-empty && git push origin HEAD:gh-pages --force"

# 然后就可以简单地运行：
deploy-gh
```

---

## 🆘 如果仍然失败

### 检查列表：
- ✅ 确认你有 GitHub 权限（Owner/Admin）
- ✅ 确认 `npm run build` 成功完成
- ✅ 确认 dist/ 文件夹存在
- ✅ 确认网络连接正常

### 如果分支创建失败：

确保你的本地 Git 配置完整：
```bash
git config user.email "你的邮箱@example.com"
git config user.name "你的名字"
```

---

## ✨ 最简单的一键命令

复制并粘贴这个命令，然后运行：

```bash
npm run build && git add -f dist/ && git push origin HEAD:gh-pages --force
```

完成！🎉

---

**应用 URL**：https://cinenext-prog.github.io/cinenext-1/

在 Telegram 中配置这个 URL 作为 Mini App URL 即可！
