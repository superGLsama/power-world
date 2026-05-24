/**
 * 统计与监控 API 路由
 * 
 * 提供平台统计和性能监控数据
 */

import { Router } from 'express';
import { getMetrics, getRecentLogs, resetMetrics } from '../middleware/performance.js';
import { success, error } from '../utils/response.js';

const router = Router();

/**
 * GET /api/v1/stats/overview
 * 获取平台总览统计
 */
router.get('/overview', (req, res) => {
  try {
    const metrics = getMetrics();
    
    res.json(success({
      service: 'Agent Street API',
      version: '1.0.0',
      uptime: metrics.uptime,
      requests: {
        total: metrics.requests.total,
        success: metrics.requests.success,
        error: metrics.requests.error,
        successRate: metrics.requests.total > 0 
          ? ((metrics.requests.success / metrics.requests.total) * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        avgResponseTime: metrics.responseTime.avg + 'ms',
        maxResponseTime: metrics.responseTime.max + 'ms',
        slowQueries: metrics.slowQueries
      }
    }, '平台统计获取成功'));
  } catch (err) {
    console.error('Stats overview error:', err);
    res.status(500).json(error('STATS_ERROR', '获取统计信息失败'));
  }
});

/**
 * GET /api/v1/stats/performance
 * 获取详细性能报告
 */
router.get('/performance', (req, res) => {
  try {
    const metrics = getMetrics();
    
    res.json(success({
      responseTime: {
        average: metrics.responseTime.avg,
        min: metrics.responseTime.min,
        max: metrics.responseTime.max,
        unit: 'ms'
      },
      topEndpoints: metrics.topEndpoints.map(e => ({
        endpoint: e.path,
        requests: e.count,
        avgTime: Math.round(e.avgTime * 100) / 100,
        maxTime: Math.round(e.maxTime * 100) / 100
      })),
      statusDistribution: metrics.requests.byStatus,
      slowQueryThreshold: 1000
    }, '性能报告获取成功'));
  } catch (err) {
    console.error('Performance stats error:', err);
    res.status(500).json(error('PERFORMANCE_ERROR', '获取性能报告失败'));
  }
});

/**
 * GET /api/v1/stats/logs
 * 获取最近请求日志
 */
router.get('/logs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const logs = getRecentLogs(limit);
    
    res.json(success({
      count: logs.length,
      logs
    }, '请求日志获取成功'));
  } catch (err) {
    console.error('Logs error:', err);
    res.status(500).json(error('LOGS_ERROR', '获取请求日志失败'));
  }
});

/**
 * POST /api/v1/stats/reset
 * 重置统计数据（仅开发环境）
 */
router.post('/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json(error('FORBIDDEN', '生产环境禁止重置统计'));
  }
  
  try {
    resetMetrics();
    res.json(success({ reset: true }, '统计数据已重置'));
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json(error('RESET_ERROR', '重置统计失败'));
  }
});

export default router;
