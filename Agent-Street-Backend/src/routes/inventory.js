/**
 * 仓库系统路由
 * 处理背包管理、穿戴装备等
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { success, error, ErrorCodes, paginated } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/v1/inventory/:agent_id
 * 获取 Agent 背包列表
 */
router.get('/:agent_id', async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { type, rarity, search, page = 1, size = 20 } = req.query;
    
    // 验证 agent 是否存在
    const agent = await prisma.agent.findUnique({
      where: { id: agent_id }
    });
    
    if (!agent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Agent 不存在'));
    }
    
    // 构建查询条件
    const where = { agentId: agent_id };
    if (type) where.type = type;
    if (rarity) where.rarity = rarity;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    
    const [items, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(size)
      }),
      prisma.equipment.count({ where })
    ]);
    
    // 获取穿搭配置
    const equippedOutfit = agent.equippedOutfit || {};
    
    // 格式化装备列表
    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      current_value: item.currentValue,
      is_equipped: equippedOutfit[item.type] === item.id,
      image_url: item.imageUrl,
      acquired_at: item.createdAt.toISOString()
    }));
    
    // 计算汇总信息
    const allEquipment = await prisma.equipment.findMany({
      where: { agentId: agent_id }
    });
    
    const rarityCount = {
      regular: 0,
      uncommon: 0,
      epic: 0,
      legendary: 0,
      mythic: 0
    };
    
    let totalValue = 0;
    for (const item of allEquipment) {
      rarityCount[item.rarity]++;
      totalValue += item.currentValue;
    }
    
    res.json(success({
      agent_id,
      items: formattedItems,
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        total,
        total_pages: Math.ceil(total / size)
      },
      summary: {
        total_value: totalValue,
        rarity_count: rarityCount
      }
    }));
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取背包列表失败'));
  }
});

/**
 * POST /api/v1/inventory/equip
 * 穿戴装备
 */
router.post('/equip', authenticate, async (req, res) => {
  try {
    const { equipment_id } = req.body;
    
    if (!equipment_id) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '缺少装备 ID')
      );
    }
    
    // 获取装备信息
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id }
    });
    
    if (!equipment) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '装备不存在'));
    }
    
    // 检查是否是自己的装备
    if (equipment.agentId !== req.agentId) {
      return res.status(403).json(error(ErrorCodes.NOT_OWNER, '不是该装备的所有者'));
    }
    
    // 检查装备是否在市场上
    if (equipment.status === 'listed') {
      return res.status(400).json(
        error(ErrorCodes.EQUIPMENT_NOT_TRADEABLE, '装备在市场上架中，请先下架')
      );
    }
    
    // 获取当前穿搭配置
    const agent = await prisma.agent.findUnique({
      where: { id: req.agentId }
    });
    
    const equippedOutfit = agent.equippedOutfit || {};
    const slot = equipment.type;
    const previousEquipmentId = equippedOutfit[slot];
    
    // 更新穿搭配置
    equippedOutfit[slot] = equipment_id;
    
    await prisma.$transaction(async (tx) => {
      // 更新 Agent 穿搭
      await tx.agent.update({
        where: { id: req.agentId },
        data: { equippedOutfit }
      });
      
      // 更新装备状态
      await tx.equipment.update({
        where: { id: equipment_id },
        data: { status: 'equipped' }
      });
      
      // 如果有替换的装备，更新其状态
      if (previousEquipmentId && previousEquipmentId !== equipment_id) {
        await tx.equipment.update({
          where: { id: previousEquipmentId },
          data: { status: 'tradeable' }
        });
      }
      
      // 创建交易记录
      await tx.transaction.create({
        data: {
          equipmentId: equipment_id,
          toAgentId: req.agentId,
          type: 'equip',
          price: 0,
          fee: 0
        }
      });
    });
    
    // 获取前任装备信息
    let previousEquipment = null;
    if (previousEquipmentId && previousEquipmentId !== equipment_id) {
      previousEquipment = await prisma.equipment.findUnique({
        where: { id: previousEquipmentId }
      });
    }
    
    res.json(success({
      equipment_id,
      equipment_name: equipment.name,
      slot,
      previous_equipment: previousEquipmentId,
      previous_equipment_name: previousEquipment?.name || null,
      equipped_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '穿戴装备失败'));
  }
});

/**
 * POST /api/v1/inventory/unequip
 * 卸下装备
 */
router.post('/unequip', authenticate, async (req, res) => {
  try {
    const { slot } = req.body;
    
    if (!slot) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '缺少装备槽位')
      );
    }
    
    // 有效槽位
    const validSlots = ['jacket', 'pants', 'shoes', 'hat', 'accessory', 'background'];
    if (!validSlots.includes(slot)) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, `无效的装备槽位，可选值: ${validSlots.join(', ')}`)
      );
    }
    
    // 获取当前穿搭配置
    const agent = await prisma.agent.findUnique({
      where: { id: req.agentId }
    });
    
    const equippedOutfit = agent.equippedOutfit || {};
    const equipmentId = equippedOutfit[slot];
    
    if (!equipmentId) {
      return res.status(400).json(
        error(ErrorCodes.NOT_FOUND, '该槽位没有穿戴装备')
      );
    }
    
    // 获取装备信息
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId }
    });
    
    // 移除穿搭配置中的装备
    delete equippedOutfit[slot];
    
    await prisma.$transaction(async (tx) => {
      // 更新 Agent 穿搭
      await tx.agent.update({
        where: { id: req.agentId },
        data: { equippedOutfit }
      });
      
      // 更新装备状态
      await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: 'tradeable' }
      });
      
      // 创建交易记录
      await tx.transaction.create({
        data: {
          equipmentId,
          toAgentId: req.agentId,
          type: 'unequip',
          price: 0,
          fee: 0
        }
      });
    });
    
    res.json(success({
      equipment_id: equipmentId,
      equipment_name: equipment?.name,
      slot,
      unequipped_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Unequip error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '卸下装备失败'));
  }
});

/**
 * POST /api/v1/inventory/transfer
 * 转移装备给其他 Agent
 */
router.post('/transfer', authenticate, async (req, res) => {
  try {
    const { equipment_id, to_agent_id } = req.body;
    
    if (!equipment_id || !to_agent_id) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '缺少必要参数')
      );
    }
    
    if (req.agentId === to_agent_id) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '不能转移给自己')
      );
    }
    
    // 获取装备信息
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id }
    });
    
    if (!equipment) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '装备不存在'));
    }
    
    if (equipment.agentId !== req.agentId) {
      return res.status(403).json(error(ErrorCodes.NOT_OWNER, '不是该装备的所有者'));
    }
    
    if (equipment.status === 'equipped') {
      return res.status(400).json(
        error(ErrorCodes.ALREADY_EQUIPPED, '装备正在穿戴中，请先卸下')
      );
    }
    
    // 检查目标 Agent 是否存在
    const targetAgent = await prisma.agent.findUnique({
      where: { id: to_agent_id }
    });
    
    if (!targetAgent) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '目标 Agent 不存在'));
    }
    
    // 获取前任拥有者列表
    const previousOwners = equipment.previousOwners || [];
    previousOwners.push({
      name: agent.name,
      price: 0,
      date: new Date().toISOString()
    });
    
    const agent = await prisma.agent.findUnique({
      where: { id: req.agentId }
    });
    
    await prisma.$transaction(async (tx) => {
      // 转移装备
      await tx.equipment.update({
        where: { id: equipment_id },
        data: {
          agentId: to_agent_id,
          previousOwners
        }
      });
      
      // 创建交易记录
      await tx.transaction.create({
        data: {
          equipmentId: equipment_id,
          fromAgentId: req.agentId,
          toAgentId: to_agent_id,
          type: 'transfer',
          price: 0,
          fee: 0
        }
      });
    });
    
    res.json(success({
      equipment_id,
      equipment_name: equipment.name,
      from_agent: agent.name,
      to_agent: targetAgent.name,
      transferred_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '转移装备失败'));
  }
});

export default router;
