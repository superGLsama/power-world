/**
 * Agent Street GraphQL Resolvers
 * 
 * 解析器函数：处理 GraphQL 查询的具体实现
 * 
 * GraphQL 核心概念：
 * - Resolver: 解析字段的函数，返回字段对应的数据
 * - 嵌套解析: 自动处理关联查询（如 agent.inventory 会自动查询装备）
 * - 上下文: 通过 context 获取数据库连接等共享资源
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ========== 辅助函数 ==========

/**
 * 计算 Agent 的稀有度分布
 */
function calculateRarityDistribution(inventory) {
  const distribution = {
    regular: 0,
    uncommon: 0,
    epic: 0,
    legendary: 0,
    mythic: 0
  };
  
  for (const item of inventory) {
    distribution[item.rarity]++;
  }
  
  return distribution;
}

/**
 * 计算 Agent 背包总价值
 */
function calculateTotalValue(inventory) {
  return inventory.reduce((sum, item) => sum + item.currentValue, 0);
}

/**
 * 计算穿搭风格分
 */
function calculateStyleScore(agent) {
  const equippedOutfit = agent.equippedOutfit || {};
  let totalStyle = 0;
  
  for (const equipment of agent.inventory) {
    if (Object.values(equippedOutfit).includes(equipment.id)) {
      totalStyle += equipment.style;
    }
  }
  
  return totalStyle;
}

/**
 * 计算穿搭价值
 */
function calculateOutfitValue(agent) {
  const equippedOutfit = agent.equippedOutfit || {};
  let totalValue = 0;
  
  for (const equipment of agent.inventory) {
    if (Object.values(equippedOutfit).includes(equipment.id)) {
      totalValue += equipment.currentValue;
    }
  }
  
  return totalValue;
}

/**
 * 格式化日期为 ISO 字符串
 */
function formatDate(date) {
  return date ? date.toISOString() : null;
}

// ========== 转换函数 ==========

/**
 * 转换 Agent 数据
 */
function transformAgent(agent) {
  if (!agent) return null;
  
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    streetAddress: agent.streetAddress,
    balance: agent.balance,
    isSite: agent.isSite,
    siteName: agent.siteName,
    equippedOutfit: agent.equippedOutfit,
    inventoryCount: agent.inventory?.length || 0,
    totalValue: calculateTotalValue(agent.inventory || []),
    rarityDistribution: calculateRarityDistribution(agent.inventory || []),
    createdAt: formatDate(agent.createdAt),
    updatedAt: formatDate(agent.updatedAt)
  };
}

/**
 * 转换 Equipment 数据
 */
function transformEquipment(equipment) {
  if (!equipment) return null;
  
  return {
    id: equipment.id,
    name: equipment.name,
    type: equipment.type,
    rarity: equipment.rarity,
    style: equipment.style,
    comfort: equipment.comfort,
    rarityScore: equipment.rarityScore,
    story: equipment.story,
    baseValue: equipment.baseValue,
    currentValue: equipment.currentValue,
    status: equipment.status,
    imageUrl: equipment.imageUrl,
    previewUrl: equipment.previewUrl,
    tradeCount: equipment.tradeCount,
    createdAt: formatDate(equipment.createdAt),
    updatedAt: formatDate(equipment.updatedAt)
  };
}

/**
 * 转换 MarketListing 数据
 */
function transformMarketListing(listing) {
  if (!listing) return null;
  
  return {
    id: listing.id,
    price: listing.price,
    status: listing.status,
    createdAt: formatDate(listing.createdAt)
  };
}

/**
 * 转换 Transaction 数据
 */
function transformTransaction(tx) {
  if (!tx) return null;
  
  return {
    id: tx.id,
    type: tx.type,
    price: tx.price,
    fee: tx.fee,
    createdAt: formatDate(tx.createdAt)
  };
}

// ========== Resolvers ==========

export const resolvers = {
  // ---------- 枚举解析器 ----------
  
  Rarity: {
    REGULAR: 'regular',
    UNCOMMON: 'uncommon',
    EPIC: 'epic',
    LEGENDARY: 'legendary',
    MYTHIC: 'mythic'
  },
  
  EquipmentType: {
    JACKET: 'jacket',
    PANTS: 'pants',
    SHOES: 'shoes',
    HAT: 'hat',
    ACCESSORY: 'accessory',
    BACKGROUND: 'background'
  },
  
  // ---------- 类型解析器 ----------
  
  Agent: {
    // 嵌套解析：inventory 字段
    inventory: (parent) => {
      return (parent.inventory || []).map(transformEquipment);
    },
    
    // 稀有度分布：使用 parent 数据计算
    rarityDistribution: (parent) => {
      return parent.rarityDistribution || calculateRarityDistribution(parent.inventory || []);
    }
  },
  
  Equipment: {
    // 嵌套解析：owner 字段
    owner: async (parent, args, context) => {
      if (!parent.agentId) return null;
      
      const agent = await context.prisma.agent.findUnique({
        where: { id: parent.agentId }
      });
      
      return transformAgent(agent);
    }
  },
  
  MarketListing: {
    // 嵌套解析：equipment 和 seller
    equipment: async (parent, args, context) => {
      const equipment = await context.prisma.equipment.findUnique({
        where: { id: parent.equipmentId }
      });
      
      return transformEquipment(equipment);
    },
    
    seller: async (parent, args, context) => {
      const agent = await context.prisma.agent.findUnique({
        where: { id: parent.sellerId }
      });
      
      return transformAgent(agent);
    }
  },
  
  Transaction: {
    // 嵌套解析：equipment, fromAgent, toAgent
    equipment: async (parent, args, context) => {
      const equipment = await context.prisma.equipment.findUnique({
        where: { id: parent.equipmentId }
      });
      
      return transformEquipment(equipment);
    },
    
    fromAgent: async (parent, args, context) => {
      if (!parent.fromAgentId) return null;
      
      const agent = await context.prisma.agent.findUnique({
        where: { id: parent.fromAgentId }
      });
      
      return transformAgent(agent);
    },
    
    toAgent: async (parent, args, context) => {
      const agent = await context.prisma.agent.findUnique({
        where: { id: parent.toAgentId }
      });
      
      return transformAgent(agent);
    }
  },
  
  LeaderboardEntry: {
    rank: (parent) => parent.rank,
    agent: (parent) => parent.agent,
    styleScore: (parent) => parent.styleScore,
    outfitValue: (parent) => parent.outfitValue
  },
  
  WealthEntry: {
    rank: (parent) => parent.rank,
    agent: (parent) => parent.agent,
    balance: (parent) => parent.balance,
    inventoryValue: (parent) => parent.inventoryValue,
    totalWealth: (parent) => parent.totalWealth
  },
  
  CollectionEntry: {
    rank: (parent) => parent.rank,
    agent: (parent) => parent.agent,
    collectionCount: (parent) => parent.collectionCount,
    rarityDistribution: (parent) => parent.rarityDistribution
  },
  
  PlatformStats: {
    uptime: () => {
      const seconds = Math.floor(process.uptime());
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  },
  
  // ---------- Query 解析器 ----------
  
  Query: {
    // ---------- Agent 查询 ----------
    
    agent: async (parent, { id }) => {
      const agent = await prisma.agent.findUnique({
        where: { id },
        include: { inventory: true }
      });
      return transformAgent(agent);
    },
    
    agentByName: async (parent, { name }) => {
      const agent = await prisma.agent.findUnique({
        where: { name },
        include: { inventory: true }
      });
      return transformAgent(agent);
    },
    
    agents: async (parent, { first = 20, after = 0, filter }) => {
      let where = {};
      
      // 应用筛选条件
      if (filter) {
        if (filter.nameContains) {
          where.name = { contains: filter.nameContains };
        }
      }
      
      const totalCount = await prisma.agent.count({ where });
      const agents = await prisma.agent.findMany({
        where,
        skip: after,
        take: first,
        include: { inventory: true },
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        nodes: agents.map(transformAgent),
        totalCount,
        hasMore: after + agents.length < totalCount
      };
    },
    
    allAgents: async (parent, { limit = 50, offset = 0 }) => {
      const agents = await prisma.agent.findMany({
        skip: offset,
        take: limit,
        include: { inventory: true },
        orderBy: { createdAt: 'desc' }
      });
      
      return agents.map(transformAgent);
    },
    
    // ---------- 排行榜 ----------
    
    styleLeaderboard: async (parent, { limit = 10 }) => {
      const agents = await prisma.agent.findMany({
        include: { inventory: true }
      });
      
      // 计算风格分并排序
      const rankings = agents.map(agent => ({
        agent: transformAgent(agent),
        styleScore: calculateStyleScore(agent),
        outfitValue: calculateOutfitValue(agent)
      }));
      
      rankings.sort((a, b) => b.styleScore - a.styleScore);
      
      return rankings.slice(0, limit).map((item, index) => ({
        rank: index + 1,
        agent: item.agent,
        styleScore: item.styleScore,
        outfitValue: item.outfitValue
      }));
    },
    
    wealthLeaderboard: async (parent, { limit = 10 }) => {
      const agents = await prisma.agent.findMany({
        include: { inventory: true }
      });
      
      // 计算财富并排序
      const rankings = agents.map(agent => {
        const inventoryValue = calculateTotalValue(agent.inventory);
        return {
          agent: transformAgent(agent),
          balance: agent.balance,
          inventoryValue,
          totalWealth: agent.balance + inventoryValue
        };
      });
      
      rankings.sort((a, b) => b.totalWealth - a.totalWealth);
      
      return rankings.slice(0, limit).map((item, index) => ({
        rank: index + 1,
        agent: item.agent,
        balance: item.balance,
        inventoryValue: item.inventoryValue,
        totalWealth: item.totalWealth
      }));
    },
    
    collectionLeaderboard: async (parent, { limit = 10 }) => {
      const agents = await prisma.agent.findMany({
        include: { inventory: true }
      });
      
      // 按收藏数量排序
      const rankings = agents
        .map(agent => ({
          agent: transformAgent(agent),
          collectionCount: agent.inventory.length,
          rarityDistribution: calculateRarityDistribution(agent.inventory)
        }))
        .sort((a, b) => b.collectionCount - a.collectionCount);
      
      return rankings.slice(0, limit).map((item, index) => ({
        rank: index + 1,
        agent: item.agent,
        collectionCount: item.collectionCount,
        rarityDistribution: item.rarityDistribution
      }));
    },
    
    // ---------- 装备查询 ----------
    
    equipment: async (parent, { id }) => {
      const equipment = await prisma.equipment.findUnique({
        where: { id }
      });
      return transformEquipment(equipment);
    },
    
    equipmentList: async (parent, { first = 20, after = 0, filter }) => {
      let where = {};
      
      if (filter) {
        if (filter.type) where.type = filter.type;
        if (filter.rarity) where.rarity = filter.rarity;
        if (filter.status) where.status = filter.status;
        if (filter.ownerId) where.agentId = filter.ownerId;
        if (filter.minStyle) where.style = { gte: filter.minStyle };
        if (filter.maxStyle) where.style = { ...where.style, lte: filter.maxStyle };
      }
      
      const totalCount = await prisma.equipment.count({ where });
      const equipment = await prisma.equipment.findMany({
        where,
        skip: after,
        take: first,
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        nodes: equipment.map(transformEquipment),
        totalCount,
        hasMore: after + equipment.length < totalCount
      };
    },
    
    equipmentByType: async (parent, { type, limit = 20 }) => {
      const equipment = await prisma.equipment.findMany({
        where: { type },
        take: limit,
        orderBy: { rarityScore: 'desc' }
      });
      
      return equipment.map(transformEquipment);
    },
    
    equipmentByRarity: async (parent, { rarity, limit = 20 }) => {
      const equipment = await prisma.equipment.findMany({
        where: { rarity },
        take: limit,
        orderBy: { rarityScore: 'desc' }
      });
      
      return equipment.map(transformEquipment);
    },
    
    // ---------- 市场 ----------
    
    activeListings: async (parent, { limit = 20 }) => {
      const listings = await prisma.marketListing.findMany({
        where: { status: 'active' },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      
      return listings.map(transformMarketListing);
    },
    
    // ---------- 交易 ----------
    
    recentTransactions: async (parent, { limit = 20 }) => {
      const transactions = await prisma.transaction.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      
      return transactions.map(transformTransaction);
    },
    
    // ---------- 统计 ----------
    
    platformStats: async () => {
      const [totalAgents, totalEquipment, transactions] = await Promise.all([
        prisma.agent.count(),
        prisma.equipment.count(),
        prisma.transaction.findMany()
      ]);
      
      const totalTradingVolume = transactions.reduce((sum, tx) => sum + tx.price, 0);
      
      return {
        totalAgents,
        totalEquipment,
        totalTransactions: transactions.length,
        totalTradingVolume
      };
    },
    
    // ---------- 探索 ----------
    
    randomAgent: async () => {
      const count = await prisma.agent.count();
      if (count === 0) return null;
      
      const random = Math.floor(Math.random() * count);
      const agent = await prisma.agent.findMany({
        skip: random,
        take: 1,
        include: { inventory: true }
      });
      
      return transformAgent(agent[0]);
    },
    
    randomEquipment: async (parent, { type, rarity }) => {
      let where = {};
      if (type) where.type = type;
      if (rarity) where.rarity = rarity;
      
      const count = await prisma.equipment.count({ where });
      if (count === 0) return null;
      
      const random = Math.floor(Math.random() * count);
      const equipment = await prisma.equipment.findMany({
        where,
        skip: random,
        take: 1
      });
      
      return transformEquipment(equipment[0]);
    }
  },
  
  // ---------- Mutation 解析器 ----------
  
  Mutation: {
    updateAgentDescription: async (parent, { agentId, description }) => {
      const agent = await prisma.agent.update({
        where: { id: agentId },
        data: { description },
        include: { inventory: true }
      });
      
      return transformAgent(agent);
    },
    
    equipItem: async (parent, { agentId, equipmentId, slot }) => {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { inventory: true }
      });
      
      if (!agent) throw new Error('Agent not found');
      
      // 获取当前穿搭配置
      const equippedOutfit = agent.equippedOutfit || {};
      
      // 更新装备状态
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: 'equipped' }
      });
      
      // 更新 Agent 穿搭
      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: {
          equippedOutfit: { ...equippedOutfit, [slot]: equipmentId }
        },
        include: { inventory: true }
      });
      
      return transformAgent(updatedAgent);
    },
    
    unequipItem: async (parent, { agentId, slot }) => {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { inventory: true }
      });
      
      if (!agent) throw new Error('Agent not found');
      
      const equippedOutfit = agent.equippedOutfit || {};
      const equipmentId = equippedOutfit[slot];
      
      if (equipmentId) {
        await prisma.equipment.update({
          where: { id: equipmentId },
          data: { status: 'tradeable' }
        });
        
        delete equippedOutfit[slot];
      }
      
      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: { equippedOutfit },
        include: { inventory: true }
      });
      
      return transformAgent(updatedAgent);
    },
    
    listItem: async (parent, { equipmentId, price }) => {
      const equipment = await prisma.equipment.findUnique({
        where: { id: equipmentId }
      });
      
      if (!equipment) throw new Error('Equipment not found');
      
      const listing = await prisma.marketListing.create({
        data: {
          equipmentId,
          sellerId: equipment.agentId,
          price,
          status: 'active'
        }
      });
      
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: 'listed' }
      });
      
      return transformMarketListing(listing);
    },
    
    cancelListing: async (parent, { listingId }) => {
      const listing = await prisma.marketListing.update({
        where: { id: listingId },
        data: { status: 'cancelled' }
      });
      
      const equipment = await prisma.equipment.update({
        where: { id: listing.equipmentId },
        data: { status: 'tradeable' }
      });
      
      return transformEquipment(equipment);
    },
    
    purchaseItem: async (parent, { listingId }) => {
      const listing = await prisma.marketListing.findUnique({
        where: { id: listingId },
        include: { equipment: true }
      });
      
      if (!listing || listing.status !== 'active') {
        throw new Error('Listing not available');
      }
      
      // TODO: 实现完整的购买逻辑（扣款、转账等）
      // 这里简化处理
      
      const transaction = await prisma.transaction.create({
        data: {
          equipmentId: listing.equipmentId,
          fromAgentId: listing.sellerId,
          toAgentId: listing.sellerId, // 简化
          type: 'buy',
          price: listing.price,
          fee: Math.floor(listing.price * 0.05)
        }
      });
      
      await prisma.marketListing.update({
        where: { id: listingId },
        data: { status: 'sold' }
      });
      
      return transformTransaction(transaction);
    }
  }
};
