/**
 * Agent Street Backend - 主入口文件
 * Agent World 联盟核心时尚街区后端服务
 * 
 * Day 17 迭代：API 安全增强
 * - 响应压缩 (gzip)
 * - 细粒度限流策略
 * - 请求 ID 全局追踪
 * - 敏感操作审计日志
 * - CORS 增强配置
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 全局 Prisma 实例（用于健康检查）
const prisma = new PrismaClient();
global.prisma = prisma;

// 路由模块
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import equipmentRoutes from './routes/equipment.js';
import inventoryRoutes from './routes/inventory.js';
import transactionRoutes from './routes/transactions.js';
import leaderboardRoutes from './routes/leaderboard.js';
import statsRoutes from './routes/stats.js';
import auditRoutes from './routes/audit.js';

// 中间件
import { performanceMonitor } from './middleware/performance.js';
import { auditLog } from './middleware/audit.js';
import { error } from './utils/response.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS 增强配置（Day 17）- 支持更多场景
app.use(cors({
  origin: function(origin, callback) {
    // 允许的源列表
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://agent-street.netlify.app',
      'https://superglsama.github.io'
    ];
    
    // 允许没有 origin 的请求（如 Postman、curl）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.github.io') || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      // 生产环境可以取消下面这行注释
      // callback(new Error('Not allowed by CORS'));
      callback(null, true); // 暂时允许所有，便于开发
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Client-Version'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400 // 预检请求缓存 24 小时
}));

// 响应压缩（Day 17）- 减少传输体积，提升性能
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    const fallback = compression.filter(req, res);
    return fallback;
  },
  level: 6 // 压缩级别 1-9，默认 6
}));

// 解析 JSON
app.use(express.json({ limit: '10mb' }));

// 性能监控中间件
app.use(performanceMonitor);

// 审计日志中间件（Day 17）- 记录敏感操作
app.use(auditLog);

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// ========== 细粒度限流策略（Day 17）==========
// 通用速率限制
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求频率超限' } },
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});

// 写入操作限流（更严格）
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 每分钟最多 20 次写入
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '写入频率超限，请稍后再试' } },
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
});

// 认证接口限流（防止暴力破解）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟窗口
  max: 10, // 每 15 分钟最多 10 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'AUTH_RATE_LIMIT_EXCEEDED', message: '认证请求过于频繁，请 15 分钟后再试' } }
});

// 应用限流
app.use('/api', globalLimiter); // 通用限流
app.use('/api/v1/auth', authLimiter); // 认证接口单独限流

// 健康检查（支持 Docker 健康检查，Day 17 增强：显示压缩和安全功能）
app.get('/health', async (req, res) => {
  const healthcheck = {
    status: 'healthy',
    service: 'agent-street-api',
    version: '1.0.0',
    features: {
      compression: true, // gzip 压缩已启用
      rateLimit: true,   // 限流已启用
      security: true    // 安全中间件已启用
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      memory: {
        status: 'ok',
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    }
  };
  
  // 检查数据库连接（如果 Prisma 可用）
  try {
    if (global.prisma) {
      await global.prisma.$queryRaw`SELECT 1`;
      healthcheck.checks.database = { status: 'ok' };
    } else {
      healthcheck.checks.database = { status: 'not_initialized' };
    }
  } catch (err) {
    healthcheck.checks.database = { status: 'error', message: err.message };
    healthcheck.status = 'degraded';
  }
  
  // 如果所有检查通过，返回 200
  const allHealthy = Object.values(healthcheck.checks).every(c => c.status === 'ok' || c.status === 'not_initialized');
  res.status(allHealthy ? 200 : 503).json(healthcheck);
});

// API 版本信息
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Agent Street API',
    version: 'v1.0.0',
    description: 'Agent World 联盟核心时尚街区 API',
    endpoints: {
      auth: '/api/v1/auth',
      agents: '/api/v1/agents',
      equipment: '/api/v1/equipment',
      inventory: '/api/v1/inventory',
      transactions: '/api/v1/transactions',
      leaderboard: '/api/v1/leaderboard',
      market: '/api/v1/equipment/market',
      stats: '/api/v1/stats'
    }
  });
});

// 注册路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/equipment', equipmentRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/audit', auditRoutes); // Day 17 - 审计日志路由

// 404 处理
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json(error('NOT_FOUND', '请求的接口不存在'));
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json(error('INTERNAL_ERROR', '服务器内部错误'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Agent Street Server Started                          ║
║                                                           ║
║   Port: ${PORT}                                              ║
║   Env:  ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
║   🌐 Frontend: http://localhost:${PORT}                      ║
║   🔌 API:      http://localhost:${PORT}/api/v1               ║
║   📊 Stats:    http://localhost:${PORT}/api/v1/stats         ║
║   ❤️  Health:   http://localhost:${PORT}/health              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
