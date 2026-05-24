/**
 * 排行榜路由
 * 提供穿搭排行榜、财富排行榜等
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { success, paginated } from '../utils/response.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/v1/leaderboard/style
 * 获取穿搭排行榜
 */
router.get('/style', async (req, res) => {
  try {
    const { period = 'weekly', page = 1, size = 10 } = req.query;
    
    // 获取所有 Agent
    const agents = await prisma.agent.findMany({
      include: {
        inventory: true
      }
    });
    
    // 计算每个 Agent 的风格得分
    const rankings = agents.map(agent => {
      const equippedOutfit = agent.equippedOutfit || {};
      let totalStyleScore = 0;
      let outfitValue = 0;
      
      for (const equipment of agent.inventory) {
        if (Object.values(equippedOutfit).includes(equipment.id)) {
          totalStyleScore += equipment.style;
          outfitValue += equipment.currentValue;
        }
      }
      
      return {
        agent_id: agent.id,
        agent_name: agent.name,
        avatar_url: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar.png`,
        style_score: totalStyleScore,
        outfit_value: outfitValue
      };
    });
    
    // 按风格得分排序
    rankings.sort((a, b) => b.style_score - a.style_score);
    
    // 分页
    const skip = (parseInt(page) - 1) * parseInt(size);
    const paginatedRankings = rankings.slice(skip, skip + parseInt(size));
    
    // 添加排名
    const rankedResults = paginatedRankings.map((item, index) => ({
      rank: skip + index + 1,
      ...item
    }));
    
    res.json(success({
      period,
      rankings: rankedResults,
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        total: rankings.length,
        total_pages: Math.ceil(rankings.length / parseInt(size))
      }
    }));
  } catch (err) {
    console.error('Get style leaderboard error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取排行榜失败' } });
  }
});

/**
 * GET /api/v1/leaderboard/wealth
 * 获取财富排行榜
 */
router.get('/wealth', async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        orderBy: { balance: 'desc' },
        skip,
        take: parseInt(size),
        include: {
          inventory: {
            select: { currentValue: true }
          }
        }
      }),
      prisma.agent.count()
    ]);
    
    const rankings = agents.map((agent, index) => {
      const inventoryValue = agent.inventory.reduce((sum, item) => sum + item.currentValue, 0);
      
      return {
        rank: skip + index + 1,
        agent_id: agent.id,
        agent_name: agent.name,
        avatar_url: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar.png`,
        balance: agent.balance,
        inventory_value: inventoryValue,
        total_wealth: agent.balance + inventoryValue
      };
    });
    
    res.json(success({
      rankings,
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        total,
        total_pages: Math.ceil(total / parseInt(size))
      }
    }));
  } catch (err) {
    console.error('Get wealth leaderboard error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取财富榜失败' } });
  }
});

/**
 * GET /api/v1/leaderboard/collection
 * 获取收藏排行榜
 */
router.get('/collection', async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    
    // 按装备数量排序
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        orderBy: {
          inventory: { _count: 'desc' }
        },
        skip,
        take: parseInt(size),
        include: {
          _count: {
            select: { inventory: true }
          },
          inventory: {
            select: { rarity: true }
          }
        }
      }),
      prisma.agent.count()
    ]);
    
    const rankings = agents.map((agent, index) => {
      // 稀有度分布
      const rarityDistribution = {
        regular: 0,
        uncommon: 0,
        epic: 0,
        legendary: 0,
        mythic: 0
      };
      
      for (const item of agent.inventory) {
        rarityDistribution[item.rarity]++;
      }
      
      return {
        rank: skip + index + 1,
        agent_id: agent.id,
        agent_name: agent.name,
        avatar_url: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar.png`,
        collection_count: agent._count.inventory,
        rarity_distribution: rarityDistribution
      };
    });
    
    res.json(success({
      rankings,
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        total,
        total_pages: Math.ceil(total / parseInt(size))
      }
    }));
  } catch (err) {
    console.error('Get collection leaderboard error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取收藏榜失败' } });
  }
});

/**
 * GET /api/v1/leaderboard/trading
 * 获取交易活跃排行榜
 */
router.get('/trading', async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    
    // 获取所有 Agent 并计算交易次数
    const agents = await prisma.agent.findMany({
      include: {
        transactions: {
          select: { id: true }
        }
      }
    });
    
    // 按交易次数排序
    const sortedAgents = agents
      .map(agent => ({
        agent_id: agent.id,
        agent_name: agent.name,
        avatar_url: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar.png`,
        transaction_count: agent.transactions.length
      }))
      .sort((a, b) => b.transaction_count - a.transaction_count);
    
    const paginatedResults = sortedAgents.slice(skip, skip + parseInt(size));
    const rankedResults = paginatedResults.map((item, index) => ({
      rank: skip + index + 1,
      ...item
    }));
    
    res.json(success({
      rankings: rankedResults,
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        total: sortedAgents.length,
        total_pages: Math.ceil(sortedAgents.length / parseInt(size))
      }
    }));
  } catch (err) {
    console.error('Get trading leaderboard error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取交易榜失败' } });
  }
});

export default router;
