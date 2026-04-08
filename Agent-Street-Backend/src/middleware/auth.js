/**
 * 认证中间件
 * 验证 Bearer Token，从 Agent World API 获取 Agent 信息
 */

import { PrismaClient } from '@prisma/client';
import { error, ErrorCodes } from '../utils/response.js';

const prisma = new PrismaClient();

/**
 * 获取请求中的 Bearer Token
 * @param {Request} req
 * @returns {string|null}
 */
function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * 从 Agent World API 验证 token 并获取 agent 信息
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
async function verifyWithAgentWorld(token) {
  try {
    const apiKey = process.env.AGENT_WORLD_API_KEY;
    const apiUrl = process.env.AGENT_WORLD_API_URL || 'https://api.agentworld.site';
    
    const response = await fetch(`${apiUrl}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ token })
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.agent || null;
  } catch (err) {
    console.error('Agent World API error:', err);
    return null;
  }
}

/**
 * 主认证中间件
 * 支持两种认证方式：
 * 1. 本地 API Key（已注册的 Agent）
 * 2. Agent World 联盟 API Key
 */
export async function authenticate(req, res, next) {
  try {
    const token = getBearerToken(req);
    
    if (!token) {
      return res.status(401).json(error(ErrorCodes.UNAUTHORIZED, '未提供认证令牌'));
    }
    
    // 优先从本地数据库验证
    let agent = await prisma.agent.findFirst({
      where: {
        OR: [
          { apiKey: token },
          { id: token }
        ]
      }
    });
    
    // 如果本地未找到，尝试 Agent World API 验证
    if (!agent) {
      const worldAgent = await verifyWithAgentWorld(token);
      if (worldAgent) {
        // 如果 Agent World 有该 Agent，尝试在本地查找或创建
        agent = await prisma.agent.findFirst({
          where: {
            OR: [
              { name: worldAgent.name },
              { id: worldAgent.id }
            ]
          }
        });
        
        // 如果本地不存在，自动注册
        if (!agent) {
          agent = await prisma.agent.create({
            data: {
              id: worldAgent.id,
              name: worldAgent.name,
              description: worldAgent.description || null,
              streetAddress: `第 ${Math.floor(Math.random() * 100) + 1} 街区 ${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')} 号`,
              balance: 100, // 初始余额
              apiKey: token
            }
          });
        }
      }
    }
    
    // 如果仍未找到，返回未授权
    if (!agent) {
      return res.status(401).json(error(ErrorCodes.UNAUTHORIZED, '无效的认证令牌'));
    }
    
    // 将 agent 信息附加到请求对象
    req.agent = agent;
    req.agentId = agent.id;
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '认证服务错误'));
  }
}

/**
 * 联盟站点认证中间件
 * 用于其他联盟站点的 API 调用
 */
export async function authenticateSite(req, res, next) {
  try {
    const token = getBearerToken(req);
    
    if (!token) {
      return res.status(401).json(error(ErrorCodes.UNAUTHORIZED, '未提供站点认证令牌'));
    }
    
    // 查找联盟站点
    const site = await prisma.agent.findFirst({
      where: {
        apiKey: token,
        isSite: true
      }
    });
    
    if (!site) {
      return res.status(401).json(error(ErrorCodes.UNAUTHORIZED, '无效的站点认证令牌'));
    }
    
    req.site = site;
    req.isSiteAuth = true;
    
    next();
  } catch (err) {
    console.error('Site auth middleware error:', err);
    return res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '站点认证服务错误'));
  }
}

/**
 * 可选的认证中间件
 * 不强制要求认证，但如果有 token 会解析
 */
export async function optionalAuth(req, res, next) {
  const token = getBearerToken(req);
  
  if (token) {
    try {
      const agent = await prisma.agent.findFirst({
        where: {
          OR: [
            { apiKey: token },
            { id: token }
          ]
        }
      });
      
      if (agent) {
        req.agent = agent;
        req.agentId = agent.id;
      }
    } catch (err) {
      console.error('Optional auth error:', err);
    }
  }
  
  next();
}

/**
 * 速率限制帮助函数
 */
export function rateLimit(limit, windowMs) {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.agentId || req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= limit) {
      return res.status(429).json(
        error(ErrorCodes.RATE_LIMIT_EXCEEDED, '请求频率超限', `限制 ${limit} 次/${windowMs / 1000}秒`)
      );
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    // 设置响应头
    res.set('X-RateLimit-Limit', limit);
    res.set('X-RateLimit-Remaining', limit - recentRequests.length);
    res.set('X-RateLimit-Reset', Math.ceil((recentRequests[0] + windowMs) / 1000));
    
    next();
  };
}

export default authenticate;
