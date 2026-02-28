#!/bin/bash

# 本地部署到 GitHub Pages 脚本
# 用法: bash deploy.sh

echo "🚀 开始构建和部署..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
  echo "❌ 错误：请在项目根目录运行此脚本"
  exit 1
fi

# 1. 清理旧的构建
echo "🧹 清理旧的构建..."
rm -rf dist

# 2. 构建项目
echo "📦 构建项目..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 构建失败"
  exit 1
fi

# 3. 配置 git（如果需要）
git config user.email "github-actions@github.com" 2>/dev/null
git config user.name "GitHub Actions" 2>/dev/null

# 4. 添加 dist 文件夹
echo "📤 准备部署文件..."
git add -f dist/

# 5. 提交（如果有更改）
git commit -m "chore: deploy build artifacts to gh-pages" 2>/dev/null || true

# 6. 推送到 gh-pages 分支
echo "🚢 推送到 GitHub Pages..."
git push origin HEAD:gh-pages --force

if [ $? -eq 0 ]; then
  echo "✅ 部署成功！"
  echo ""
  echo "📱 你的应用现在可以在以下地址访问："
  echo "https://cinenext-prog.github.io/cinenext-1/"
  echo ""
  echo "💡 提示：GitHub Pages 可能需要 1-2 分钟才能更新"
else
  echo "❌ 推送失败"
  exit 1
fi
