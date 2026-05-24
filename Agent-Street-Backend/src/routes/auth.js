/**
 * 认证路由
 * 处理 Token 验证
 * 
 * Day 14 优化：刷新 Token 时正确清除缓存
 */

import { Router } from 'express';
import { success, error, ErrorCodes } from '../utils/response.js';
import { authenticate, authCache } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/auth/verify
 * 验证当前 API Key 的有效性
 */
router.get('/verify', authenticate, (req, res) => {
  const agent = req.agent;
  
  res.json(success({
    agent_id: agent.id,
    name: agent.name,
    street_address: agent.streetAddress,
    balance: agent.balance,
    api_key_valid: true,
    permissions: ['read', 'trade', 'equip']
  }));
});

/**
 * POST /api/v1/auth/refresh
 * 刷新 API Key（如果需要）
 * 
 * Day 14 优化：刷新时清除旧 token 缓存
 */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const oldApiKey = req.agent.apiKey;
    
    // 生成新的 API Key
    const newApiKey = `as_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const updatedAgent = await prisma.agent.update({
      where: { id: req.agentId },
      data: { apiKey: newApiKey }
    });
    
    // 清除旧 token 缓存（Day 14 优化）
    if (oldApiKey) {
      authCache.invalidate(oldApiKey);
    }
    
    // 新 token 会被下次 authenticate 自动缓存
    
    res.json(success({
      agent_id: updatedAgent.id,
      name: updatedAgent.name,
      new_api_key: newApiKey,
      refreshed_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Refresh API key error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '刷新 API Key 失败'));
  }
});

export default router;
