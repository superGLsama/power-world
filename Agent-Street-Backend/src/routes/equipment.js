/**
 * 装备系统路由
 * 处理装备详情、购买、上架等
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { success, error, ErrorCodes, paginated } from '../utils/response.js';
import { authenticate, rateLimit } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

// 手续费比例 (5%)
const TRADE_FEE_PERCENT = parseInt(process.env.TRADE_FEE_PERCENT || '5');
// 冷却时间（小时）
const TRADE_COOLDOWN_HOURS = parseInt(process.env.TRADE_COOLDOWN_HOURS || '24');

/**
 * GET /api/v1/equipment/market
 * 市场装备列表
 */
router.get('/market', async (req, res) => {
  try {
    const { rarity, type, page = 1, size = 20, sort = 'newest' } = req.query;
    
    const where = {
      status: 'listed'
    };
    
    if (rarity) where.rarity = rarity;
    if (type) where.type = type;
    
    // 排序
    let orderBy = {};
    switch (sort) {
      case 'price_asc':
        orderBy = { currentValue: 'asc' };
        break;
      case 'price_desc':
        orderBy = { currentValue: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { updatedAt: 'desc' };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    
    const [items, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(size),
        include: {
          agent: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.equipment.count({ where })
    ]);
    
    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      current_value: item.currentValue,
      seller_id: item.agent?.id,
      seller_name: item.agent?.name,
      image_url: item.imageUrl,
      listed_at: item.updatedAt.toISOString()
    }));
    
    res.json(success(paginated(formattedItems, parseInt(page), parseInt(size), total)));
  } catch (err) {
    console.error('Get market error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取市场列表失败'));
  }
});

/**
 * GET /api/v1/equipment/:equipment_id
 * 获取装备详情
 */
router.get('/:equipment_id', async (req, res) => {
  try {
    const { equipment_id } = req.params;
    
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id },
      include: {
        agent: {
          select: { id: true, name: true }
        },
        marketListing: true
      }
    });
    
    if (!equipment) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '装备不存在'));
    }
    
    res.json(success({
      id: equipment.id,
      name: equipment.name,
      type: equipment.type,
      rarity: equipment.rarity,
      story: equipment.story,
      current_value: equipment.currentValue,
      previous_owners: equipment.previousOwners || [],
      created_at: equipment.createdAt.toISOString(),
      trade_count: equipment.tradeCount,
      status: equipment.status,
      cooldown_ends_at: equipment.cooldownEndsAt?.toISOString() || null,
      image_url: equipment.imageUrl,
      preview_url: equipment.previewUrl,
      attributes: {
        style: equipment.style,
        comfort: equipment.comfort,
        rarity_score: equipment.rarityScore
      }
    }));
  } catch (err) {
    console.error('Get equipment error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取装备详情失败'));
  }
});

/**
 * POST /api/v1/equipment/buy
 * 购买装备
 */
router.post('/buy', authenticate, rateLimit(30, 60000), async (req, res) => {
  try {
    const { equipment_id, price } = req.body;
    
    if (!equipment_id || !price) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '缺少必要参数')
      );
    }
    
    // 获取装备信息
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id },
      include: {
        agent: {
          select: { id: true, name: true }
        },
        marketListing: true
      }
    });
    
    if (!equipment) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '装备不存在'));
    }
    
    // 检查是否在市场上架
    if (equipment.status !== 'listed' || !equipment.marketListing) {
      return res.status(400).json(error(ErrorCodes.EQUIPMENT_NOT_TRADEABLE, '该装备未上架'));
    }
    
    // 检查价格是否匹配
    if (equipment.marketListing.price !== price) {
      return res.status(400).json(error(ErrorCodes.PRICE_MISMATCH, '价格不匹配'));
    }
    
    // 不能购买自己的装备
    if (equipment.marketListing.sellerId === req.agentId) {
      return res.status(400).json(error(ErrorCodes.FORBIDDEN, '不能购买自己的装备'));
    }
    
    // 获取买家信息
    const buyer = await prisma.agent.findUnique({
      where: { id: req.agentId }
    });
    
    // 检查余额
    if (buyer.balance < price) {
      return res.status(400).json(
        error(ErrorCodes.INSUFFICIENT_BALANCE, '余额不足', `需要 ${price} $COIN，当前余额 ${buyer.balance} $COIN`)
      );
    }
    
    // 计算手续费
    const fee = Math.floor(price * TRADE_FEE_PERCENT / 100);
    const sellerReceives = price - fee;
    
    // 获取卖家
    const seller = await prisma.agent.findUnique({
      where: { id: equipment.marketListing.sellerId }
    });
    
    // 获取前任拥有者列表
    const previousOwners = equipment.previousOwners || [];
    previousOwners.push({
      name: seller.name,
      price: price,
      date: new Date().toISOString()
    });
    
    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 更新装备信息
      await tx.equipment.update({
        where: { id: equipment_id },
        data: {
          agentId: buyer.id,
          status: 'tradeable',
          currentValue: price,
          tradeCount: { increment: 1 },
          previousOwners,
          cooldownEndsAt: new Date(Date.now() + TRADE_COOLDOWN_HOURS * 60 * 60 * 1000)
        }
      });
      
      // 删除市场挂单
      await tx.marketListing.delete({
        where: { id: equipment.marketListing.id }
      });
      
      // 扣除买家余额
      await tx.agent.update({
        where: { id: buyer.id },
        data: { balance: { decrement: price } }
      });
      
      // 增加卖家余额
      await tx.agent.update({
        where: { id: seller.id },
        data: { balance: { increment: sellerReceives } }
      });
      
      // 创建交易记录
      const transaction = await tx.transaction.create({
        data: {
          equipmentId: equipment_id,
          fromAgentId: seller.id,
          toAgentId: buyer.id,
          type: 'buy',
          price,
          fee
        }
      });
      
      return transaction;
    });
    
    res.json(success({
      transaction_id: result.id,
      equipment_id,
      equipment_name: equipment.name,
      price_paid: price,
      fee,
      new_balance: buyer.balance - price,
      previous_owner: seller.name,
      acquired_at: result.createdAt.toISOString()
    }));
  } catch (err) {
    console.error('Buy equipment error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '购买装备失败'));
  }
});

/**
 * POST /api/v1/equipment/sell
 * 上架装备到市场
 */
router.post('/sell', authenticate, rateLimit(30, 60000), async (req, res) => {
  try {
    const { equipment_id, price } = req.body;
    
    if (!equipment_id || !price || price <= 0) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, '缺少必要参数或价格无效')
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
    
    // 检查装备状态
    if (equipment.status === 'equipped') {
      return res.status(400).json(error(ErrorCodes.ALREADY_EQUIPPED, '装备正在穿戴中，请先卸下'));
    }
    
    if (equipment.status === 'listed') {
      return res.status(400).json(error(ErrorCodes.EQUIPMENT_NOT_TRADEABLE, '装备已在市场上架'));
    }
    
    // 检查冷却时间
    if (equipment.cooldownEndsAt && equipment.cooldownEndsAt > new Date()) {
      return res.status(400).json(
        error(ErrorCodes.EQUIPMENT_NOT_TRADEABLE, '装备冷却中', `冷却结束时间: ${equipment.cooldownEndsAt.toISOString()}`)
      );
    }
    
    // 创建市场挂单
    const listing = await prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id: equipment_id },
        data: { status: 'listed' }
      });
      
      return tx.marketListing.create({
        data: {
          equipmentId: equipment_id,
          sellerId: req.agentId,
          price
        }
      });
    });
    
    res.status(201).json(success({
      listing_id: listing.id,
      equipment_id,
      equipment_name: equipment.name,
      price,
      status: 'listed',
      listed_at: listing.createdAt.toISOString()
    }));
  } catch (err) {
    console.error('Sell equipment error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '上架装备失败'));
  }
});

/**
 * DELETE /api/v1/equipment/market/:listing_id
 * 从市场下架装备
 */
router.delete('/market/:listing_id', authenticate, async (req, res) => {
  try {
    const { listing_id } = req.params;
    
    const listing = await prisma.marketListing.findUnique({
      where: { id: listing_id }
    });
    
    if (!listing) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '挂单不存在'));
    }
    
    // 检查是否是自己的挂单
    if (listing.sellerId !== req.agentId) {
      return res.status(403).json(error(ErrorCodes.NOT_OWNER, '不是该挂单的所有者'));
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id: listing.equipmentId },
        data: { status: 'tradeable' }
      });
      
      await tx.marketListing.update({
        where: { id: listing_id },
        data: { status: 'cancelled' }
      });
    });
    
    res.json(success({
      equipment_id: listing.equipmentId,
      status: 'returned_to_inventory'
    }));
  } catch (err) {
    console.error('Cancel listing error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '下架装备失败'));
  }
});

/**
 * GET /api/v1/equipment/:equipment_id/history
 * 获取装备交易历史
 */
router.get('/:equipment_id/history', async (req, res) => {
  try {
    const { equipment_id } = req.params;
    
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id },
      include: {
        agent: {
          select: { name: true }
        },
        transactions: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!equipment) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '装备不存在'));
    }
    
    const history = [];
    
    // 添加创建记录
    history.push({
      event: 'create',
      from: null,
      to: equipment.previousOwners?.[0]?.name || equipment.agent?.name || 'System',
      price: null,
      timestamp: equipment.createdAt.toISOString()
    });
    
    // 添加交易记录
    for (const txn of equipment.transactions) {
      const fromAgent = txn.fromAgentId 
        ? await prisma.agent.findUnique({ where: { id: txn.fromAgentId }, select: { name: true } })
        : null;
      const toAgent = await prisma.agent.findUnique({ where: { id: txn.toAgentId }, select: { name: true } });
      
      history.push({
        event: txn.type,
        from: fromAgent?.name || null,
        to: toAgent?.name,
        price: txn.price,
        timestamp: txn.createdAt.toISOString()
      });
    }
    
    res.json(success({
      equipment_id,
      equipment_name: equipment.name,
      current_owner: equipment.agent?.name,
      current_value: equipment.currentValue,
      trade_count: equipment.tradeCount,
      history
    }));
  } catch (err) {
    console.error('Get equipment history error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取交易历史失败'));
  }
});

/**
 * GET /api/v1/equipment/:equipment_id/assets
 * 获取装备形象素材（联盟接入）
 */
router.get('/:equipment_id/assets', async (req, res) => {
  try {
    const { equipment_id } = req.params;
    const { format = 'json' } = req.query;
    
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id }
    });
    
    if (!equipment) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, '装备不存在'));
    }
    
    if (format !== 'json') {
      // 返回图片格式
      return res.json(success({
        image_url: equipment.imageUrl,
        preview_url: equipment.previewUrl
      }));
    }
    
    res.json(success({
      equipment_id,
      name: equipment.name,
      rarity: equipment.rarity,
      assets: {
        icon: equipment.imageUrl,
        preview: equipment.previewUrl,
        thumbnail: equipment.previewUrl?.replace('-preview.png', '-thumb.png'),
        transparent: equipment.imageUrl?.replace('.png', '-transparent.png')
      }
    }));
  } catch (err) {
    console.error('Get equipment assets error:', err);
    res.status(500).json(error(ErrorCodes.INTERNAL_ERROR, '获取装备素材失败'));
  }
});

export default router;
