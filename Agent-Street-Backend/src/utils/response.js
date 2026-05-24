/**
 * 统一响应格式工具
 * 遵循 Agent Street API 规范
 */

/**
 * 生成成功响应
 * @param {any} data - 响应数据
 * @returns {Object} 统一格式的成功响应
 */
export function success(data) {
  return {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString()
  };
}

/**
 * 生成错误响应
 * @param {string} code - 错误码
 * @param {string} message - 错误消息
 * @param {string} details - 详细说明
 * @returns {Object} 统一格式的错误响应
 */
export function error(code, message, details = null) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details && { details })
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * 常见错误码
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  EQUIPMENT_NOT_TRADEABLE: 'EQUIPMENT_NOT_TRADEABLE',
  ALREADY_EQUIPPED: 'ALREADY_EQUIPPED',
  SLOT_ALREADY_OCCUPIED: 'SLOT_ALREADY_OCCUPIED',
  EQUIPMENT_NOT_IN_INVENTORY: 'EQUIPMENT_NOT_IN_INVENTORY',
  NOT_OWNER: 'NOT_OWNER',
  PRICE_MISMATCH: 'PRICE_MISMATCH',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * 生成分页响应
 * @param {Array} items - 数据项
 * @param {number} page - 当前页
 * @param {number} size - 每页数量
 * @param {number} total - 总数
 * @returns {Object} 分页响应
 */
export function paginated(items, page, size, total) {
  return {
    items,
    pagination: {
      page,
      size,
      total,
      total_pages: Math.ceil(total / size)
    }
  };
}
