/**
 * 市场交易路由
 * 处理交易历史等
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { success, error, ErrorCodes, paginated } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/v1/transactions/:agent_id
 * 获取 Agent 交易历史
 */
router.get('/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { type, page = 1, size = 20 } = req.query;
    
    // 只能查看自己的交易历史或联盟站点
    if (req.agentId !== agent_id && !req.isSiteAuth) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, '无权查看此交易历史'));
    }
    
    // 验证 agent 是否存在
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    // 构建查询条件
    const where = {
      OR: [
        { toAgentId: agent_id },
        { fromAgentId: agent_id }
      ]
    };
    
    if (type === 'buy') {
      where.fromAgentId = { not: null };
    } else if (type === 'sell') {
      where.toAgentId = agent_id;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(size),
        include: {
          equipment: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);
    
    // 获取当前余额
    let balanceAfter = agent.balance;
    
    const formattedTransactions = await Promise.all(
      transactions.map(async (txn) => {
        // 获取对方信息
        let counterparty = null;
        if (txn.fromAgentId && txn.fromAgentId !== agent_id) {
          const fromAgent = await prisma.agent.findUnique({
            where: { id: txn.fromAgentId },
            select: { name: true }
          });
          counterparty = fromAgent?.name;
        } else if (txn.toAgentId !== agent_id) {
          const toAgent = await prisma.agent.findUnique({
            where: { id: txn.toAgentId },
            select: { name: true }
          });
          counterparty = toAgent?.name;
        }
        
        // 判断是买入还是卖出
        const txnType = txn.fromAgentId === agent_id ? 'sell' : 'buy';
        
        // 计算交易后余额
        if (txnType === 'buy') {
          balanceAfter += txn.price;
        } else {
          balanceAfter -= (txn.price - txn.fee);
        }
        
        return {
          id: txn.id,
          type: txnType,
          equipment_id: txn.equipment.id,
          equipment_name: txn.equipment.name,
          counterparty,
          amount: txn.price,
          fee: txn.fee,
          balance_after: balanceAfter,
          created_at: txn.createdAt.toISOString()
        };
      })
    );
    
    res.json(success({
      agent_id,
      transactions: formattedTransactions,
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        total,
        total_pages: Math.ceil(total / size)
      }
    }));
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取交易历史失败'));
  }
});

/**
 * GET /api/v1/transactions/stats/:agent_id
 * 获取 Agent 交易统计
 */
router.get('/stats/:agent_id', async (req, res) => {
  try {
    const { agent_id } = req.params;
    
    // 验证 agent 是否存在
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    // 获取统计数据
    const [buyCount, sellCount, totalBuyValue, totalSellValue] = await Promise.all([
      prisma.transaction.count({
        where: { toAgentId: agent_id, fromAgentId: { not: null } }
      }),
      prisma.transaction.count({
        where: { fromAgentId: agent_id }
      }),
      prisma.transaction.aggregate({
        where: { toAgentId: agent_id, fromAgentId: { not: null } },
        _sum: { price: true }
      }),
      prisma.transaction.aggregate({
        where: { fromAgentId: agent_id },
        _sum: { price: true }
      })
    ]);
    
    res.json(success({
      agent_id,
      buy_count: buyCount,
      sell_count: sellCount,
      total_buy_value: totalBuyValue._sum.price || 0,
      total_sell_value: totalSellValue._sum.price || 0,
      net_value: (totalSellValue._sum.price || 0) - (totalBuyValue._sum.price || 0)
    }));
  } catch (err) {
    console.error('Get transaction stats error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取交易统计失败'));
  }
});

export default router;
