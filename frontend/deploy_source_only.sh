#!/bin/bash

# 🚀 源代码直接部署脚本 - 跳过本地构建
# 由于本地Bus error问题，直接部署源代码到生产服务器构建

set -e

echo "🚀 开始部署源代码到生产服务器..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 生产服务器配置
PROD_SERVER="198.18.0.38"
PROD_USER="root"
PROD_PATH="/var/www/html/notepads"
BACKUP_PATH="/var/www/html/notepads_backup_$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}📦 步骤1: 准备部署文件...${NC}"
# 创建临时部署目录
DEPLOY_DIR="/tmp/neuralink_deploy_$(date +%s)"
mkdir -p "$DEPLOY_DIR"

# 复制源代码（排除不需要的文件）
rsync -av --exclude=node_modules --exclude=.next --exclude=.git \
    --exclude=*.log --exclude=*.backup \
    . "$DEPLOY_DIR/"

echo "✅ 源代码准备完成: $DEPLOY_DIR"

echo -e "${BLUE}🔄 步骤2: 备份生产环境...${NC}"
ssh "$PROD_USER@$PROD_SERVER" "
    if [ -d '$PROD_PATH' ]; then
        echo '备份现有版本...'
        cp -r '$PROD_PATH' '$BACKUP_PATH'
        echo '✅ 备份完成: $BACKUP_PATH'
    else
        echo '首次部署，跳过备份'
    fi
"

echo -e "${BLUE}📤 步骤3: 上传源代码...${NC}"
# 确保目标目录存在
ssh "$PROD_USER@$PROD_SERVER" "mkdir -p '$PROD_PATH'"

# 上传文件
rsync -av --delete "$DEPLOY_DIR/" "$PROD_USER@$PROD_SERVER:$PROD_PATH/"
echo "✅ 源代码上传完成"

echo -e "${BLUE}🔧 步骤4: 生产服务器构建...${NC}"
ssh "$PROD_USER@$PROD_SERVER" "
    cd '$PROD_PATH'
    echo '安装依赖...'
    npm install --production=false
    echo '构建生产版本...'
    NODE_OPTIONS='--max-old-space-size=8192' npm run build
    echo '✅ 生产服务器构建完成'
"

echo -e "${BLUE}🔄 步骤5: 重启服务...${NC}"
ssh "$PROD_USER@$PROD_SERVER" "
    # 停止现有服务
    pkill -f 'next start' || echo '没有运行的Next.js服务'
    
    # 启动新服务
    cd '$PROD_PATH'
    nohup npm start > neuralink.log 2>&1 &
    
    sleep 3
    echo '✅ 服务重启完成'
"

echo -e "${BLUE}🧹 步骤6: 清理临时文件...${NC}"
rm -rf "$DEPLOY_DIR"
echo "✅ 清理完成"

echo -e "${BLUE}✅ 步骤7: 验证部署...${NC}"
# 测试应用是否正常响应
if curl -f -s "https://www.cheman.top/notepads/" > /dev/null; then
    echo "✅ 应用正常运行"
else
    echo "⚠️ 应用可能有问题，请检查日志"
fi

echo -e "${GREEN}🎉 部署完成!${NC}"
echo ""
echo "🌍 访问地址: https://www.cheman.top/notepads/"
echo "📋 备份位置: $BACKUP_PATH"
echo "📝 日志文件: $PROD_PATH/neuralink.log"
echo ""
echo -e "${YELLOW}🔍 验证步骤:${NC}"
echo "1. 访问 https://www.cheman.top/notepads/"
echo "2. 测试PDF预览加载速度"
echo "3. 检查主页加载时间是否改善"
echo "4. 验证所有功能正常工作"

echo -e "${BLUE}💡 如需回滚:${NC}"
echo "ssh $PROD_USER@$PROD_SERVER 'rm -rf $PROD_PATH && mv $BACKUP_PATH $PROD_PATH'"