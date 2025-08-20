#!/bin/bash

# 部署静态资源到VPS
# 使用方法: ./deploy-assets.sh

echo "🚀 开始部署静态资源到VPS..."

# VPS配置
VPS_HOST="root@23.95.222.41"
VPS_PASSWORD="cr86S6RW7L0zEwVs9m"
VPS_WEB_DIR="/home/jason/code/cheman.top"

# 检查本地文件是否存在
if [ ! -f "public/favicon-alt.svg" ]; then
    echo "❌ 本地favicon-alt.svg文件不存在"
    exit 1
fi

if [ ! -f "public/manifest.json" ]; then
    echo "❌ 本地manifest.json文件不存在"
    exit 1
fi

echo "✅ 本地文件检查完成"

# 使用sshpass复制文件到VPS（如果没有sshpass，需要手动输入密码）
echo "📦 上传favicon文件..."
sshpass -p "$VPS_PASSWORD" scp public/favicon-alt.svg $VPS_HOST:$VPS_WEB_DIR/notepads/favicon.svg

echo "📦 上传manifest文件..."
sshpass -p "$VPS_PASSWORD" scp public/manifest.json $VPS_HOST:$VPS_WEB_DIR/notepads/manifest.json

echo "📦 上传icon.svg文件..."
sshpass -p "$VPS_PASSWORD" scp public/icon.svg $VPS_HOST:$VPS_WEB_DIR/notepads/icon.svg

# 设置正确的文件权限
echo "🔧 设置文件权限..."
sshpass -p "$VPS_PASSWORD" ssh $VPS_HOST "chmod 644 $VPS_WEB_DIR/notepads/favicon.svg"
sshpass -p "$VPS_PASSWORD" ssh $VPS_HOST "chmod 644 $VPS_WEB_DIR/notepads/manifest.json"
sshpass -p "$VPS_PASSWORD" ssh $VPS_HOST "chmod 644 $VPS_WEB_DIR/notepads/icon.svg"

echo "✅ 静态资源部署完成！"
echo "🌐 您现在可以访问以下链接测试:"
echo "   - https://www.cheman.top/notepads/favicon.svg"
echo "   - https://www.cheman.top/notepads/manifest.json"
echo "   - https://www.cheman.top/notepads/icon.svg"