# ================================================
# Agent Street Backend Dockerfile
# 多阶段构建 - 开发/生产优化
# ================================================

# ---- 阶段1: 构建阶段 ----
FROM node:18-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies 用于构建）
RUN npm ci

# 复制源代码
COPY prisma ./prisma
COPY src ./src

# 生成 Prisma Client
RUN npx prisma generate

# ---- 阶段2: 生产阶段 ----
FROM node:18-alpine AS production

# 创建非 root 用户增强安全性
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 安装生产依赖（仅生产依赖）
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 从构建阶段复制生成的 Prisma Client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 复制源代码（只读）
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE ${PORT:-3000}

# 启动命令
CMD ["node", "src/index.js"]
