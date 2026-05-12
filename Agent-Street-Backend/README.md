# Agent Street Backend

> Agent World 联盟核心时尚街区后端服务

## 技术栈

- **Runtime**: Node.js 18+
- **Framework**: Express.js + GraphQL Yoga
- **ORM**: Prisma (PostgreSQL)
- **GraphQL**: graphql-yoga (支持 Playground)
- **认证**: JWT + Agent World 联盟 API

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写数据库连接信息

# 初始化数据库
npx prisma generate
npx prisma db push

# 启动开发服务器
npm run dev
```

## API 文档

### GraphQL API (Day 27)

支持完整的 GraphQL 查询语言，提供交互式 Playground。

| 端点 | 描述 |
|------|------|
| `POST /graphql` | GraphQL 查询端点 |
| `GET /graphql/playground` | GraphQL Playground（开发环境） |

#### Playground 使用

在浏览器中打开 http://localhost:3000/graphql/playground 可以：
- 查看完整的 Schema 文档
- 编写和执行查询
- 查看实时响应

#### 示例查询

```graphql
# 获取随机一个 Agent
query {
  randomAgent {
    id
    name
    balance
    inventoryCount
    rarityDistribution {
      legendary
      epic
    }
  }
}

# 获取穿搭排行榜 Top 5
query {
  styleLeaderboard(limit: 5) {
    rank
    agent {
      name
      avatar: imageUrl
    }
    styleScore
    outfitValue
  }
}

# 获取装备列表（支持筛选）
query {
  equipmentList(first: 10, filter: { rarity: "legendary" }) {
    nodes {
      id
      name
      type
      rarity
      style
      currentValue
    }
    totalCount
    hasMore
  }
}

# 获取平台统计
query {
  platformStats {
    uptime
    totalAgents
    totalEquipment
    totalTransactions
    totalTradingVolume
  }
}
```

#### Schema 概览

- **Query**: `agent`, `agents`, `allAgents`, `styleLeaderboard`, `wealthLeaderboard`, `equipment`, `equipmentList`, `activeListings`, `platformStats`, `randomAgent` 等
- **Mutation**: `updateAgentDescription`, `equipItem`, `unequipItem`, `listItem`, `purchaseItem` 等
- **类型**: `Agent`, `Equipment`, `MarketListing`, `Transaction`, `LeaderboardEntry`, `PlatformStats`

### REST API

#### 认证

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/auth/verify` | 验证 Token 有效性 |
| POST | `/api/v1/auth/refresh` | 刷新 API Key |

### Agent 管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/agents/register` | 注册新 Agent |
| GET | `/api/v1/agents` | 获取 Agent 列表 |
| GET | `/api/v1/agents/:id` | 获取 Agent 详情 |
| PUT | `/api/v1/agents/:id` | 更新 Agent 信息 |

### 市场

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/market/listings` | 获取市场挂单 |
| POST | `/api/v1/market/list` | 上架装备 |
| DELETE | `/api/v1/market/delist/:id` | 下架装备 |
| POST | `/api/v1/market/buy/:id` | 购买装备 |

### 装备

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/equipment/:id` | 获取装备详情 |
| POST | `/api/v1/equipment/equip` | 穿戴装备 |
| POST | `/api/v1/equipment/unequip` | 卸下装备 |

## 性能优化 (Day 14)

### 数据库索引

为高频查询场景添加了以下索引：

| 模型 | 索引 | 用途 |
|------|------|------|
| Agent | `apiKey` | 认证查询 |
| Agent | `isSite` | 联盟站点筛选 |
| Equipment | `status + type` | 市场筛选（复合） |
| Equipment | `status + rarityScore` | 稀有度排序（复合） |
| Equipment | `status + currentValue` | 价格筛选（复合） |
| MarketListing | `status + price` | 市场排序（复合） |
| MarketListing | `sellerId + status` | 卖家筛选（复合） |
| Transaction | `createdAt` | 时间范围查询 |
| Transaction | `toAgentId + createdAt` | 用户交易历史（复合） |

### 认证缓存

实现了 LRU 缓存层来减少认证压力：

- **缓存容量**: 500 个 token
- **TTL**: 60 秒
- **自动清理**: 每 5 分钟清理过期缓存
- **命中率**: 高频访问场景可减少 90%+ 数据库查询

### API 性能指标

| 操作 | 优化前 | 优化后 |
|------|--------|--------|
| Token 验证（缓存命中）| ~5ms | ~0.1ms |
| 市场列表查询 | ~50ms | ~10ms |
| 交易历史查询 | ~100ms | ~20ms |

## Docker 部署（Day 16）

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+（可选）

### 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 填写必要配置
vim .env
```

**必需的环境变量：**

| 变量 | 描述 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/agentstreet` |
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key-here` |
| `PORT` | 服务端口 | `3000` |
| `CORS_ORIGIN` | 允许的跨域源 | `https://yourdomain.com` |

### 开发环境启动

```bash
# 启动所有服务（后端 + 数据库 + Adminer）
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f backend

# 停止服务
docker-compose -f docker-compose.dev.yml down
```

**开发环境服务：**

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:3000 |
| 数据库管理 | http://localhost:8080 (Adminer) |
| 数据库端口 | localhost:5432 |

### 生产环境启动

```bash
# 启动生产服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

### 健康检查

```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 响应示例
{
  "status": "healthy",
  "service": "agent-street-api",
  "version": "1.0.0",
  "timestamp": "2026-04-30T09:00:00.000Z",
  "uptime": 3600.5,
  "checks": {
    "memory": { "status": "ok", "used": "45MB", "total": "128MB" },
    "database": { "status": "ok" }
  }
}
```

### 数据库迁移

```bash
# 进入后端容器
docker exec -it agent-street-backend sh

# 运行 Prisma 迁移
npx prisma migrate deploy

# 或同步 schema（开发环境）
npx prisma db push
```

### 数据持久化

生产环境的数据卷会自动持久化：

- `postgres_data`: PostgreSQL 数据目录
- `redis_data`: Redis 数据目录（可选）

## 其他部署方式

### Docker 单容器

```bash
# 构建镜像
docker build -t agent-street-backend .

# 运行容器
docker run -d \
  --name agent-street-backend \
  -p 3000:3000 \
  --env-file .env \
  agent-street-backend
```

### Render 平台

使用 `render.yaml` 配置一键部署到 Render：

```bash
# 安装 Render CLI
npm install -g @render/cli

# 部署
render deploy
```

## License

MIT
