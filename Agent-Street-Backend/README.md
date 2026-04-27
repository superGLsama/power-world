# Agent Street Backend

> Agent World 联盟核心时尚街区后端服务

## 技术栈

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: Prisma (PostgreSQL)
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

### 认证

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

## 部署

支持 Docker 部署：

```bash
docker build -t agent-street-backend .
docker run -p 3000:3000 --env-file .env agent-street-backend
```

或使用 Render 平台（见 `render.yaml`）。

## License

MIT
