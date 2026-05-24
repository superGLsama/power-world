/**
 * Agent 管理路由
 * 处理 Agent 注册、信息查询和更新
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { success, error, ErrorCodes, paginated } from '../utils/response.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { generateWelcomePackage } from '../utils/equipmentGenerator.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * 生成唯一街区地址
 */
async function generateStreetAddress() {
  const district = Math.floor(Math.random() * 100) + 1;
  const number = Math.floor(Math.random() * 999) + 1;
  const address = `第 ${district} 街区 ${String(number).padStart(3, '0')} 号`;
  
  // 确保地址唯一
  const existing = await prisma.agent.findUnique({
    where: { streetAddress: address }
  });
  
  if (existing) {
    return generateStreetAddress(); // 递归直到找到唯一的
  }
  
  return address;
}

/**
 * POST /api/v1/agents/register
 * Agent 注册
 */
router.post('/register', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // 验证名称
    if (!name || name.length < 2 || name.length > 20) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '名称长度需在 2-20 字符之间')
      );
    }
    
    // 检查名称是否已存在
    const existing = await prisma.agent.findUnique({
      where: { name }
    });
    
    if (existing) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '该名称已被使用')
      );
    }
    
    // 生成唯一地址
    const streetAddress = await generateStreetAddress();
    
    // 生成 API Key
    const apiKey = `as_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // 创建 Agent
    const agent = await prisma.agent.create({
      data: {
        name,
        description: description || null,
        streetAddress,
        balance: 150, // 初始余额
        apiKey
      }
    });
    
    // 生成新手装备包
    const welcomePackage = generateWelcomePackage();
    const equipmentIds = {};
    
    for (const [slot, equipData] of Object.entries(welcomePackage)) {
      await prisma.equipment.create({
        data: {
          ...equipData,
          agentId: agent.id,
          previousOwners: [{ name: agent.name, date: new Date().toISOString() }]
        }
      });
      equipmentIds[slot] = equipData.id;
    }
    
    res.status(201).json(success({
      agent_id: agent.id,
      name: agent.name,
      street_address: agent.streetAddress,
      balance: agent.balance,
      api_key: apiKey,
      welcome_package: equipmentIds,
      created_at: agent.createdAt.toISOString()
    }));
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '注册失败'));
  }
});

/**
 * GET /api/v1/agents/:agent_id
 * 获取 Agent 信息
 */
router.get('/:agent_id', optionalAuth, async (req, res) => {
  try {
    const { agent_id } = req.params;
    
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id },
      include: {
        inventory: true
      }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    // 计算稀有度分布
    const rarityDistribution = {
      regular: 0,
      uncommon: 0,
      epic: 0,
      legendary: 0,
      mythic: 0
    };
    
    let totalValue = 0;
    agent.inventory.forEach(item => {
      rarityDistribution[item.rarity]++;
      totalValue += item.currentValue;
    });
    
    // 解析穿搭配置
    let equippedOutfit = {
      jacket: null,
      pants: null,
      shoes: null,
      hat: null,
      accessory: null,
      background: null
    };
    
    if (agent.equippedOutfit) {
      equippedOutfit = { ...equippedOutfit, ...agent.equippedOutfit };
    }
    
    res.json(success({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      street_address: agent.streetAddress,
      balance: agent.balance,
      equipped_outfit: equippedOutfit,
      inventory_count: agent.inventory.length,
      total_value: totalValue,
      rarity_distribution: rarityDistribution,
      created_at: agent.createdAt.toISOString()
    }));
  } catch (err) {
    console.error('Get agent error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取 Agent 信息失败'));
  }
});

/**
 * PUT /api/v1/agents/:agent_id
 * 更新 Agent 信息
 */
router.put('/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { name, description } = req.body;
    
    // 只能更新自己的信息
    if (req.agentId !== agent_id) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, '无权修改此 Agent'));
    }
    
    // 验证名称
    if (name && (name.length < 2 || name.length > 20)) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '名称长度需在 2-20 字符之间')
      );
    }
    
    // 检查新名称是否被占用
    if (name) {
      const existing = await prisma.agent.findFirst({
        where: {
          name,
          NOT: { id: agent_id }
        }
      });
      
      if (existing) {
        return res.status(400).json(
          error(ErrorCodes.VALIDATION_ERROR, '该名称已被使用')
        );
      }
    }
    
    const updatedAgent = await prisma.agent.update({
      where: { id: agent_id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description })
      }
    });
    
    res.json(success({
      id: updatedAgent.id,
      name: updatedAgent.name,
      description: updatedAgent.description,
      street_address: updatedAgent.streetAddress,
      balance: updatedAgent.balance,
      updated_at: updatedAgent.updatedAt.toISOString()
    }));
  } catch (err) {
    console.error('Update agent error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '更新 Agent 信息失败'));
  }
});

/**
 * GET /api/v1/agents/:agent_id/avatar
 * 获取 Agent 头像（联盟接入）
 */
router.get('/:agent_id/avatar', async (req, res) => {
  try {
    const { agent_id } = req.params;
    
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    res.json(success({
      agent_id: agent.id,
      agent_name: agent.name,
      avatar_url: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar.png`,
      avatar_thumbnail: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar_thumb.png`,
      outfit_preview_url: `https://cdn.agentstreet.ai/agents/${agent.id}/outfit_preview.png`,
      updated_at: agent.updatedAt.toISOString()
    }));
  } catch (err) {
    console.error('Get avatar error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取头像失败'));
  }
});

/**
 * GET /api/v1/agents/:agent_id/outfit
 * 获取 Agent 穿搭配置（联盟接入）
 */
router.get('/:agent_id/outfit', async (req, res) => {
  try {
    const { agent_id } = req.params;
    
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id },
      include: {
        inventory: true
      }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    const equippedOutfit = agent.equippedOutfit || {};
    
    // 构建穿搭信息
    const slots = ['jacket', 'pants', 'shoes', 'hat', 'accessory', 'background'];
    const outfit = {};
    let totalStyleScore = 0;
    
    for (const slot of slots) {
      const equipmentId = equippedOutfit[slot];
      if (equipmentId) {
        const equipment = agent.inventory.find(e => e.id === equipmentId);
        if (equipment) {
          outfit[slot] = {
            id: equipment.id,
            name: equipment.name,
            rarity: equipment.rarity,
            image_url: equipment.imageUrl
          };
          totalStyleScore += equipment.style;
        } else {
          outfit[slot] = null;
        }
      } else {
        outfit[slot] = null;
      }
    }
    
    res.json(success({
      agent_id: agent.id,
      agent_name: agent.name,
      outfit,
      total_style_score: totalStyleScore
    }));
  } catch (err) {
    console.error('Get outfit error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取穿搭配置失败'));
  }
});

/**
 * GET /api/v1/agents/:agent_id/preview
 * 获取 Agent 形象预览（联盟接入）
 */
router.get('/:agent_id/preview', async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { format = 'json' } = req.query;
    
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id },
      include: {
        inventory: true
      }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    if (format === 'glb') {
      return res.json(success({
        model_url: `https://cdn.agentstreet.ai/agents/${agent.id}/model.glb`,
        version: '1.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }));
    }
    
    if (format === 'image') {
      return res.json(success({
        preview_url: `https://cdn.agentstreet.ai/agents/${agent.id}/preview.png`,
        preview_thumbnail_url: `https://cdn.agentstreet.ai/agents/${agent.id}/preview_thumb.png`,
        background_url: `https://cdn.agentstreet.ai/scenes/street-bg.png`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }));
    }
    
    // JSON 格式
    const equippedOutfit = agent.equippedOutfit || {};
    const slots = ['jacket', 'pants', 'shoes', 'hat', 'accessory', 'background'];
    const outfit = {};
    let styleScore = 0;
    
    const colors = {
      jacket: '#2C3E50',
      pants: '#1A1A2E',
      shoes: '#E74C3C',
      hat: '#9B59B6',
      accessory: '#F1C40F',
      background: '#3498DB'
    };
    
    for (const slot of slots) {
      const equipmentId = equippedOutfit[slot];
      if (equipmentId) {
        const equipment = agent.inventory.find(e => e.id === equipmentId);
        if (equipment) {
          outfit[slot] = {
            id: equipment.id,
            name: equipment.name,
            rarity: equipment.rarity,
            color: colors[slot] || '#95A5A6',
            position: { x: 0, y: slot === 'shoes' ? 0 : 0.2, z: 0 }
          };
          styleScore += equipment.style;
        } else {
          outfit[slot] = null;
        }
      } else {
        outfit[slot] = null;
      }
    }
    
    res.json(success({
      agent_id: agent.id,
      agent_name: agent.name,
      avatar: {
        url: `https://cdn.agentstreet.ai/agents/${agent.id}/avatar.png`,
        style: 'anime'
      },
      outfit,
      render_url: `https://cdn.agentstreet.ai/agents/${agent.id}/preview.png`,
      style_score: styleScore
    }));
  } catch (err) {
    console.error('Get preview error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取形象预览失败'));
  }
});

export default router;
