/**
 * 审计日志路由
 * 提供审计日志查询接口
 * 
 * Day 17 新增 - 基于 API 网关安全设计
 */

import { Router } from 'express';
import { success, error, ErrorCodes } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { getAuditLogs, getAuditStats, SensitiveOperations } from '../middleware/audit.js';

const router = Router();

/**
 * GET /api/v1/audit/logs
 * 获取审计日志列表（需要管理员权限）
 */
router.get('/logs', authenticate, (req, res) => {
  try {
    const { limit = 50, operation, startDate, endDate } = req.query;
    
    const logs = getAuditLogs({
      limit: parseInt(limit),
      operation,
      startDate,
      endDate
    });
    
    res.json(success({
      logs,
      total: logs.length
    }));
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取审计日志失败'));
  }
});

/**
 * GET /api/v1/audit/stats
 * 获取审计统计信息（需要管理员权限）
 */
router.get('/stats', authenticate, (req, res) => {
  try {
    const stats = getAuditStats();
    
    res.json(success(stats));
  } catch (err) {
    console.error('Get audit stats error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取审计统计失败'));
  }
});

/**
 * GET /api/v1/audit/operations
 * 获取支持的审计操作类型
 */
router.get('/operations', (req, res) => {
  res.json(success({
    operations: Object.entries(SensitiveOperations).map(([key, value]) => ({
      key,
      value,
      description: getOperationDescription(value)
    }))
  }));
});

/**
 * 获取操作类型描述
 */
function getOperationDescription(operation) {
  const descriptions = {
    [SensitiveOperations.AUTH_LOGIN]: '认证登录',
    [SensitiveOperations.AUTH_LOGOUT]: '认证登出',
    [SensitiveOperations.AUTH_REFRESH]: 'Token 刷新',
    [SensitiveOperations.AUTH_FAILED]: '认证失败',
    [SensitiveOperations.DATA_CREATE]: '数据创建',
    [SensitiveOperations.DATA_UPDATE]: '数据更新',
    [SensitiveOperations.DATA_DELETE]: '数据删除',
    [SensitiveOperations.DATA_EXPORT]: '数据导出',
    [SensitiveOperations.ADMIN_ACCESS]: '管理员访问',
    [SensitiveOperations.RATE_LIMIT_EXCEEDED]: '限流触发',
    [SensitiveOperations.UNAUTHORIZED_ACCESS]: '未授权访问',
    [SensitiveOperations.FORBIDDEN_ACCESS]: '禁止访问'
  };
  
  return descriptions[operation] || operation;
}

export default router;
