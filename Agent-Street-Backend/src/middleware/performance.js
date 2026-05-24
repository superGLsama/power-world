/**
 * API 性能监控与请求日志中间件
 * 
 * 功能：
 * - 请求追踪 (Request ID)
 * - 响应时间统计
 * - 慢查询警告
 * - 请求日志记录
 * - 性能指标收集
 */

import { v4 as uuidv4 } from 'uuid';

// 性能统计
const metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byStatus: { 200: 0, 201: 0, 400: 0, 401: 0, 403: 0, 404: 0, 500: 0 }
  },
  responseTime: {
    sum: 0,
    min: Infinity,
    max: 0,
    count: 0
  },
  endpoints: new Map(),
  recentLogs: [],
  startTime: Date.now()
};

const SLOW_QUERY_THRESHOLD = 1000;
const MAX_LOGS = 100;

function createLogEntry(req, res, responseTime, requestId) {
  const isSlow = responseTime > SLOW_QUERY_THRESHOLD;
  const isError = res.statusCode >= 400;
  
  return {
    id: requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: res.statusCode,
    responseTime: Math.round(responseTime * 100) / 100,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent')?.substring(0, 100) || 'unknown',
    isSlow,
    isError
  };
}

function addLog(log) {
  metrics.recentLogs.unshift(log);
  if (metrics.recentLogs.length > MAX_LOGS) {
    metrics.recentLogs.pop();
  }
}

function updateEndpointStats(path, responseTime) {
  const basePath = getBasePath(path);
  const stats = metrics.endpoints.get(basePath) || { count: 0, totalTime: 0, avgTime: 0, maxTime: 0 };
  stats.count++;
  stats.totalTime += responseTime;
  stats.avgTime = stats.totalTime / stats.count;
  stats.maxTime = Math.max(stats.maxTime, responseTime);
  metrics.endpoints.set(basePath, stats);
}

function getBasePath(path) {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export function performanceMonitor(req, res, next) {
  const requestId = uuidv4().substring(0, 8);
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  const startTime = process.hrtime.bigint();
  
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1_000_000;
    
    metrics.requests.total++;
    metrics.responseTime.count++;
    metrics.responseTime.sum += responseTime;
    metrics.responseTime.min = Math.min(metrics.responseTime.min, responseTime);
    metrics.responseTime.max = Math.max(metrics.responseTime.max, responseTime);
    
    if (metrics.requests.byStatus[res.statusCode] !== undefined) {
      metrics.requests.byStatus[res.statusCode]++;
    }
    
    if (res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.error++;
    }
    
    updateEndpointStats(req.path, responseTime);
    
    const log = createLogEntry(req, res, responseTime, requestId);
    addLog(log);
    
    if (log.isSlow) {
      console.warn(`🐌 [SLOW] ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms [${requestId}]`);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      const logLevel = log.isError ? '❌' : log.isSlow ? '🐌' : '✅';
      console.log(`${logLevel} [${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${responseTime.toFixed(2)}ms`);
    }
    
    return originalEnd.apply(this, args);
  };
  
  next();
}

export function getMetrics() {
  const uptime = Date.now() - metrics.startTime;
  const avgResponseTime = metrics.responseTime.count > 0 
    ? metrics.responseTime.sum / metrics.responseTime.count 
    : 0;
  
  const topEndpoints = Array.from(metrics.endpoints.entries())
    .map(([path, stats]) => ({ path, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    uptime: {
      seconds: Math.floor(uptime / 1000),
      formatted: formatUptime(uptime)
    },
    requests: {
      ...metrics.requests,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100
    },
    responseTime: {
      avg: Math.round(avgResponseTime * 100) / 100,
      min: Math.round(metrics.responseTime.min === Infinity ? 0 : metrics.responseTime.min * 100) / 100,
      max: Math.round(metrics.responseTime.max * 100) / 100
    },
    topEndpoints,
    slowQueries: metrics.recentLogs.filter(log => log.isSlow).length
  };
}

export function getRecentLogs(limit = 20) {
  return metrics.recentLogs.slice(0, limit);
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function resetMetrics() {
  metrics.requests = { total: 0, success: 0, error: 0, byStatus: { 200: 0, 201: 0, 400: 0, 401: 0, 403: 0, 404: 0, 500: 0 } };
  metrics.responseTime = { sum: 0, min: Infinity, max: 0, count: 0 };
  metrics.endpoints.clear();
  metrics.recentLogs = [];
  metrics.startTime = Date.now();
}

setInterval(() => {
  const m = getMetrics();
  console.log(`
📊 [Stats] 请求统计 (每5分钟)
   总请求: ${m.requests.total} | 成功: ${m.requests.success} | 错误: ${m.requests.error}
   平均响应: ${m.responseTime.avg}ms | 慢查询: ${m.slowQueries}
   Top 端点: ${m.topEndpoints[0]?.path || 'N/A'} (${m.topEndpoints[0]?.count || 0}次)
  `);
}, 5 * 60 * 1000);

export default performanceMonitor;
