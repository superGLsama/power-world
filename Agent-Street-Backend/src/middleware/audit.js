/**
 * 敏感操作审计日志中间件
 * 
 * 功能：
 * - 记录敏感操作（写入、更新、删除）
 * - 记录认证相关事件
 * - 记录异常访问
 * 
 * Day 17 新增 - 基于 API 网关安全设计
 */

import { v4 as uuidv4 } from 'uuid';

// 审计日志存储
const auditLogs = [];
const MAX_AUDIT_LOGS = 500;

// 敏感操作类型
const SensitiveOperations = {
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',
  AUTH_REFRESH: 'auth_refresh',
  AUTH_FAILED: 'auth_failed',
  DATA_CREATE: 'data_create',
  DATA_UPDATE: 'data_update',
  DATA_DELETE: 'data_delete',
  DATA_EXPORT: 'data_export',
  ADMIN_ACCESS: 'admin_access',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  FORBIDDEN_ACCESS: 'forbidden_access'
};

// 敏感路径
const sensitivePaths = [
  '/api/v1/auth',
  '/api/v1/transactions',
  '/api/v1/inventory',
  '/admin'
];

// 需要记录的方法
const sensitiveMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * 创建审计日志条目
 */
function createAuditEntry(req, res, operation, details = {}) {
  return {
    id: uuidv4().substring(0, 8),
    timestamp: new Date().toISOString(),
    operation,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.get('User-Agent')?.substring(0, 100) || 'unknown',
    agentId: req.agentId || null,
    status: res.statusCode,
    details
  };
}

/**
 * 判断是否为敏感操作
 */
function isSensitiveOperation(req) {
  // 检查是否为敏感路径
  const isSensitivePath = sensitivePaths.some(p => req.path.startsWith(p));
  
  // 检查是否为写入操作
  const isWriteOperation = sensitiveMethods.includes(req.method);
  
  // 检查是否有认证信息
  const hasAuth = !!req.headers.authorization;
  
  return isSensitivePath || (isWriteOperation && hasAuth);
}

/**
 * 获取操作类型
 */
function getOperationType(req) {
  const path = req.path;
  const method = req.method;
  
  if (path.includes('/auth/login') || path.includes('/auth/verify')) {
    return method === 'GET' ? SensitiveOperations.AUTH_LOGIN : SensitiveOperations.AUTH_LOGIN;
  }
  if (path.includes('/auth/refresh')) {
    return SensitiveOperations.AUTH_REFRESH;
  }
  if (path.includes('/transactions')) {
    return method === 'POST' ? SensitiveOperations.DATA_CREATE : SensitiveOperations.DATA_UPDATE;
  }
  if (path.includes('/inventory')) {
    return method === 'DELETE' ? SensitiveOperations.DATA_DELETE : SensitiveOperations.DATA_UPDATE;
  }
  if (path.includes('/admin')) {
    return SensitiveOperations.ADMIN_ACCESS;
  }
  if (method === 'POST') {
    return SensitiveOperations.DATA_CREATE;
  }
  if (method === 'PUT' || method === 'PATCH') {
    return SensitiveOperations.DATA_UPDATE;
  }
  if (method === 'DELETE') {
    return SensitiveOperations.DATA_DELETE;
  }
  
  return 'general';
}

/**
 * 审计日志中间件
 */
export function auditLog(req, res, next) {
  // 记录开始时间
  const startTime = Date.now();
  
  // 监听响应完成事件
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // 判断是否需要记录
    const shouldLog = isSensitiveOperation(req) || 
                      res.statusCode >= 400 || 
                      responseTime > 5000; // 慢查询也记录
    
    if (!shouldLog) return;
    
    const operation = getOperationType(req);
    const entry = createAuditEntry(req, res, operation, {
      responseTime,
      contentLength: res.get('Content-Length') || 0
    });
    
    // 添加到日志数组
    auditLogs.unshift(entry);
    
    // 保持最大数量
    if (auditLogs.length > MAX_AUDIT_LOGS) {
      auditLogs.pop();
    }
    
    // 打印敏感操作的日志
    if (sensitiveMethods.includes(req.method) || res.statusCode >= 400) {
      console.log(`[AUDIT] ${entry.operation} | ${entry.method} ${entry.path} | ${entry.status} | ${entry.ip} | ${responseTime}ms`);
    }
  });
  
  next();
}

/**
 * 获取审计日志
 */
export function getAuditLogs(options = {}) {
  const { limit = 50, operation, startDate, endDate } = options;
  
  let filtered = [...auditLogs];
  
  if (operation) {
    filtered = filtered.filter(log => log.operation === operation);
  }
  
  if (startDate) {
    const start = new Date(startDate);
    filtered = filtered.filter(log => new Date(log.timestamp) >= start);
  }
  
  if (endDate) {
    const end = new Date(endDate);
    filtered = filtered.filter(log => new Date(log.timestamp) <= end);
  }
  
  return filtered.slice(0, limit);
}

/**
 * 获取审计统计
 */
export function getAuditStats() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  const lastHour = auditLogs.filter(log => new Date(log.timestamp).getTime() > oneHourAgo);
  const lastDay = auditLogs.filter(log => new Date(log.timestamp).getTime() > oneDayAgo);
  
  // 按操作类型统计
  const byOperation = {};
  auditLogs.forEach(log => {
    byOperation[log.operation] = (byOperation[log.operation] || 0) + 1;
  });
  
  // 按状态码统计
  const byStatus = { '2xx': 0, '4xx': 0, '5xx': 0 };
  auditLogs.forEach(log => {
    if (log.status >= 200 && log.status < 300) byStatus['2xx']++;
    else if (log.status >= 400 && log.status < 500) byStatus['4xx']++;
    else if (log.status >= 500) byStatus['5xx']++;
  });
  
  return {
    total: auditLogs.length,
    lastHour: lastHour.length,
    last24Hours: lastDay.length,
    byOperation,
    byStatus
  };
}

export { SensitiveOperations };
