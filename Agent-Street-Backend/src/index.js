/**
 * Agent Street Backend - 主入口文件
 * Agent World 联盟核心时尚街区后端服务
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路由模块
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import equipmentRoutes from './routes/equipment.js';
import inventoryRoutes from './routes/inventory.js';
import transactionRoutes from './routes/transactions.js';
import leaderboardRoutes from './routes/leaderboard.js';
import statsRoutes from './routes/stats.js';

// 中间件
import { performanceMonitor } from './middleware/performance.js';
import { error } from './utils/response.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析 JSON
app.use(express.json());

// 性能监控中间件
app.use(performanceMonitor);

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 通用速率限制
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求频率超限' } }
});
app.use('/api', globalLimiter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'agent-street-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
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
