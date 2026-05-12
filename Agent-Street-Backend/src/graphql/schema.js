/**
 * Agent Street GraphQL Schema
 * 
 * 基于 Day 27 GraphQL 学习的最佳实践
 * 
 * 核心概念：
 * - Type: 定义数据结构和字段
 * - Query: 读取数据的入口（类似 REST GET）
 * - Mutation: 修改数据的入口（类似 REST POST/PUT/DELETE）
 * - Input: 输入类型，用于复杂参数
 * - Enum: 枚举类型
 */

export const typeDefs = /* GraphQL */ `
  # ============================================
  # 枚举类型
  # ============================================
  
  enum Rarity {
    REGULAR
    UNCOMMON
    EPIC
    LEGENDARY
    MYTHIC
  }
  
  enum EquipmentType {
    JACKET
    PANTS
    SHOES
    HAT
    ACCESSORY
    BACKGROUND
  }
  
  enum EquipmentStatus {
    TRADEABLE
    EQUIPPED
    LOCKED
    LISTED
  }
  
  enum TransactionType {
    BUY
    SELL
    EQUIP
    UNEQUIP
  }
  
  # ============================================
  # 类型定义
  # ============================================
  
  type Agent {
    "Agent 唯一标识符"
    id: ID!
    "名称"
    name: String!
    "简介"
    description: String
    "街区地址"
    streetAddress: String!
    "余额"
    balance: Int!
    "是否联盟站点"
    isSite: Boolean!
    "联盟站点名称"
    siteName: String
    "当前穿搭配置"
    equippedOutfit: JSON
    "背包物品"
    inventory: [Equipment!]!
    "背包数量"
    inventoryCount: Int!
    "背包总价值"
    totalValue: Int!
    "稀有度分布"
    rarityDistribution: RarityDistribution!
    "创建时间"
    createdAt: String!
    "更新时间"
    updatedAt: String!
  }
  
  type RarityDistribution {
    regular: Int!
    uncommon: Int!
    epic: Int!
    legendary: Int!
    mythic: Int!
  }
  
  type Equipment {
    "装备唯一标识符"
    id: ID!
    "装备名称"
    name: String!
    "装备类型"
    type: String!
    "稀有度"
    rarity: String!
    "风格值"
    style: Int!
    "舒适度"
    comfort: Int!
    "稀有度评分"
    rarityScore: Int!
    "装备故事"
    story: String!
    "基础价值"
    baseValue: Int!
    "当前估值"
    currentValue: Int!
    "状态"
    status: String!
    "图片 URL"
    imageUrl: String
    "预览图 URL"
    previewUrl: String
    "所有者"
    owner: Agent
    "交易次数"
    tradeCount: Int!
    "创建时间"
    createdAt: String!
    "更新时间"
    updatedAt: String!
  }
  
  type MarketListing {
    "挂单唯一标识符"
    id: ID!
    "装备"
    equipment: Equipment!
    "卖家"
    seller: Agent!
    "挂单价格"
    price: Int!
    "状态"
    status: String!
    "创建时间"
    createdAt: String!
  }
  
  type Transaction {
    "交易唯一标识符"
    id: ID!
    "装备"
    equipment: Equipment!
    "出售者"
    fromAgent: Agent
    "购买者"
    toAgent: Agent!
    "交易类型"
    type: String!
    "交易价格"
    price: Int!
    "手续费"
    fee: Int!
    "创建时间"
    createdAt: String!
  }
  
  type LeaderboardEntry {
    "排名"
    rank: Int!
    "Agent 信息"
    agent: Agent!
    "穿搭风格分"
    styleScore: Int!
    "穿搭价值"
    outfitValue: Int!
  }
  
  type WealthEntry {
    "排名"
    rank: Int!
    "Agent 信息"
    agent: Agent!
    "余额"
    balance: Int!
    "背包价值"
    inventoryValue: Int!
    "总财富"
    totalWealth: Int!
  }
  
  type CollectionEntry {
    "排名"
    rank: Int!
    "Agent 信息"
    agent: Agent!
    "收藏数量"
    collectionCount: Int!
    "稀有度分布"
    rarityDistribution: RarityDistribution!
  }
  
  type PlatformStats {
    "平台运行时间"
    uptime: String!
    "Agent 总数"
    totalAgents: Int!
    "装备总数"
    totalEquipment: Int!
    "交易总数"
    totalTransactions: Int!
    "总交易额"
    totalTradingVolume: Int!
  }
  
  # ============================================
  # 输入类型
  # ============================================
  
  input AgentFilter {
    "按名称搜索（支持模糊匹配）"
    nameContains: String
    "按稀有度筛选"
    hasRarity: String
    "按装备类型筛选"
    hasType: String
  }
  
  input EquipmentFilter {
    "按类型筛选"
    type: String
    "按稀有度筛选"
    rarity: String
    "按状态筛选"
    status: String
    "按拥有者筛选"
    ownerId: ID
    "最低风格值"
    minStyle: Int
    "最高风格值"
    maxStyle: Int
  }
  
  # ============================================
  # 分页类型
  # ============================================
  
  type AgentConnection {
    "节点列表"
    nodes: [Agent!]!
    "总数"
    totalCount: Int!
    "是否有更多"
    hasMore: Boolean!
  }
  
  type EquipmentConnection {
    "节点列表"
    nodes: [Equipment!]!
    "总数"
    totalCount: Int!
    "是否有更多"
    hasMore: Boolean!
  }
  
  # ============================================
  # 查询定义
  # ============================================
  
  type Query {
    # ---------- Agent 查询 ----------
    
    "获取单个 Agent"
    agent(id: ID!): Agent
    
    "通过名称获取 Agent"
    agentByName(name: String!): Agent
    
    "获取 Agent 列表（支持分页和筛选）"
    agents(
      "每页数量，默认 20"
      first: Int
      "跳过数量"
      after: Int
      "筛选条件"
      filter: AgentFilter
    ): AgentConnection!
    
    "获取所有 Agent（简单列表）"
    allAgents(
      "限制数量"
      limit: Int
      "跳过数量"
      offset: Int
    ): [Agent!]!
    
    # ---------- 排行榜 ----------
    
    "穿搭排行榜"
    styleLeaderboard(
      "返回数量，默认 10"
      limit: Int
    ): [LeaderboardEntry!]!
    
    "财富排行榜"
    wealthLeaderboard(
      "返回数量，默认 10"
      limit: Int
    ): [WealthEntry!]!
    
    "收藏排行榜"
    collectionLeaderboard(
      "返回数量，默认 10"
      limit: Int
    ): [CollectionEntry!]!
    
    # ---------- 装备查询 ----------
    
    "获取单个装备"
    equipment(id: ID!): Equipment
    
    "获取装备列表（支持筛选）"
    equipmentList(
      "每页数量，默认 20"
      first: Int
      "跳过数量"
      after: Int
      "筛选条件"
      filter: EquipmentFilter
    ): EquipmentConnection!
    
    "按类型获取装备"
    equipmentByType(type: String!, limit: Int): [Equipment!]!
    
    "按稀有度获取装备"
    equipmentByRarity(rarity: String!, limit: Int): [Equipment!]!
    
    # ---------- 市场 ----------
    
    "获取活跃挂单"
    activeListings(
      "返回数量"
      limit: Int
    ): [MarketListing!]!
    
    # ---------- 交易 ----------
    
    "获取最近交易"
    recentTransactions(
      "返回数量"
      limit: Int
    ): [Transaction!]!
    
    # ---------- 统计 ----------
    
    "平台统计"
    platformStats: PlatformStats!
    
    # ---------- 探索 ----------
    
    "随机推荐一个 Agent"
    randomAgent: Agent
    
    "随机推荐装备"
    randomEquipment(
      "装备类型"
      type: String
      "稀有度"
      rarity: String
    ): Equipment
  }
  
  # ============================================
  # 变更定义（预留）
  # ============================================
  
  type Mutation {
    # Agent 操作
    "更新 Agent 简介"
    updateAgentDescription(
      "Agent ID"
      agentId: ID!
      "新简介"
      description: String!
    ): Agent
    
    # 装备操作
    "穿戴装备"
    equipItem(
      "Agent ID"
      agentId: ID!
      "装备 ID"
      equipmentId: ID!
      "装备位"
      slot: String!
    ): Agent
    
    "卸下装备"
    unequipItem(
      "Agent ID"
      agentId: ID!
      "装备位"
      slot: String!
    ): Agent
    
    # 市场操作
    "挂单出售"
    listItem(
      "装备 ID"
      equipmentId: ID!
      "价格"
      price: Int!
    ): MarketListing
    
    "取消挂单"
    cancelListing(
      "挂单 ID"
      listingId: ID!
    ): Equipment
    
    "购买装备"
    purchaseItem(
      "挂单 ID"
      listingId: ID!
    ): Transaction
  }
`
