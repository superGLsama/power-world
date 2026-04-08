/**
 * 装备生成器
 * 根据稀有度概率生成随机装备
 * 
 * 稀有度概率分布:
 * - Regular (R): 60%
 * - Uncommon (U): 25%
 * - Epic (E): 10%
 * - Legendary (L): 4%
 * - Mythic (M): 1%
 */

import { v4 as uuidv4 } from 'uuid';

// 装备类型前缀映射
const TYPE_PREFIX = {
  jacket: 'JKT',
  pants: 'PNT',
  shoes: 'SHO',
  hat: 'HAT',
  accessory: 'ACC',
  background: 'BKG'
};

// 稀有度配置
const RARITY_CONFIG = {
  regular: {
    weight: 60,
    multiplier: 1,
    styleRange: [30, 60],
    comfortRange: [40, 70],
    rarityScoreRange: [30, 50],
    baseValueRange: [50, 200]
  },
  uncommon: {
    weight: 25,
    multiplier: 2.5,
    styleRange: [50, 75],
    comfortRange: [55, 80],
    rarityScoreRange: [50, 70],
    baseValueRange: [200, 500]
  },
  epic: {
    weight: 10,
    multiplier: 5,
    styleRange: [70, 90],
    comfortRange: [70, 90],
    rarityScoreRange: [70, 85],
    baseValueRange: [500, 2000]
  },
  legendary: {
    weight: 4,
    multiplier: 10,
    styleRange: [85, 98],
    comfortRange: [80, 95],
    rarityScoreRange: [85, 95],
    baseValueRange: [2000, 8000]
  },
  mythic: {
    weight: 1,
    multiplier: 25,
    styleRange: [95, 100],
    comfortRange: [90, 100],
    rarityScoreRange: [95, 100],
    baseValueRange: [8000, 50000]
  }
};

// 装备类型名称
const EQUIPMENT_TYPES = ['jacket', 'pants', 'shoes', 'hat', 'accessory'];

// 装备名称词缀
const NAME_PREFIXES = {
  jacket: ['暗夜', '烈焰', '冰霜', '疾风', '雷霆', '星空', '月光', '晨曦', '暮色', '幽影', '圣光', '深渊'],
  pants: ['漫步', '疾驰', '凌云', '踏雪', '逐浪', '追风', '揽月', '破晓', '流光', '幻影'],
  shoes: ['追风', '闪电', '流星', '疾影', '飞羽', '凌波', '青云', '赤焰', '寒霜', '雷鸣'],
  hat: ['皇冠', '礼帽', '头巾', '头盔', '羽冠', '面具', '兜帽', '头饰', '冠冕', '发带'],
  accessory: ['项链', '戒指', '手环', '披风', '徽章', '护符', '臂环', '耳饰', '眼镜', '腰带']
};

const NAME_SUFFIXES = {
  jacket: ['夹克', '外套', '风衣', '大衣', '披风', '战袍', '外套', '长衫'],
  pants: ['长裤', '短裤', '长裙', '牛仔裤', '休闲裤', '运动裤', '长裤'],
  shoes: ['跑鞋', '靴子', '运动鞋', '皮鞋', '休闲鞋', '凉鞋', '战靴'],
  hat: ['帽', '巾', '冠', '盔', '饰', '带'],
  accessory: ['之链', '之戒', '之环', '之符', '之徽', '之饰', '之带']
};

// 装备故事模板
const STORY_TEMPLATES = [
  '在 Agent World 第一条街的深夜，这件装备见证了无数 Agent 的诞生与离去。',
  '传说这件装备曾属于一位传奇 Agent，如今它等待着新的主人。',
  '当第一缕阳光照进 Agent Street，这件装备就开始闪耀着独特的光芒。',
  '无数交易记录中，这件装备的编号已被无数 Agent 传颂。',
  '在这条繁华的街道上，这件装备承载着特殊的记忆。',
  'Agent World 的街头，这件装备是最受欢迎的时尚单品。',
  '曾经有一个传说，关于这件装备和它的前任主人...',
  '在这座城市的最繁华地带，这件装备是身份与品味的象征。'
];

/**
 * 生成随机整数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 根据权重随机选择
 * @param {Object} weights - 权重映射 {key: weight}
 * @returns {string} 选中的 key
 */
function weightedRandom(weights) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * 生成装备 ID
 * @param {string} type - 装备类型
 * @param {string} rarity - 稀有度
 * @returns {string} 装备 ID
 */
function generateEquipmentId(type, rarity) {
  const prefix = TYPE_PREFIX[type] || 'ITM';
  const rarityCode = rarity[0].toUpperCase();
  const sequence = String(randomInt(1, 99999)).padStart(5, '0');
  const suffix = String.fromCharCode(65 + randomInt(0, 25)) + randomInt(1, 9);
  return `${prefix}-${rarityCode}-${sequence}-${suffix}`;
}

/**
 * 生成装备名称
 * @param {string} type - 装备类型
 * @param {string} rarity - 稀有度
 * @returns {string}
 */
function generateName(type, rarity) {
  const prefixes = NAME_PREFIXES[type] || ['神秘'];
  const suffixes = NAME_SUFFIXES[type] || ['物品'];
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const suffix = suffixes[randomInt(0, suffixes.length - 1)];
  
  // 神话装备有特殊前缀
  if (rarity === 'mythic') {
    const mythicPrefixes = ['创世', '永恒', '混沌', '起源', '虚无'];
    return mythicPrefixes[randomInt(0, mythicPrefixes.length - 1)] + prefix + suffix;
  }
  
  return prefix + suffix;
}

/**
 * 生成装备故事
 * @param {string} name - 装备名称
 * @param {string} rarity - 稀有度
 * @returns {string}
 */
function generateStory(name, rarity) {
  let story = STORY_TEMPLATES[randomInt(0, STORY_TEMPLATES.length - 1)];
  
  // 根据稀有度添加不同的故事结尾
  const endings = {
    regular: '这件装备虽然普通，却散发着朴实的光彩。',
    uncommon: '稀有特质让它在街头格外引人注目。',
    epic: '史诗般的品质让它成为收藏家追逐的目标。',
    legendary: '传说级别的装备，每一位新主人都为之骄傲。',
    mythic: '神话级的存在，世间罕有，价值连城。'
  };
  
  return story + ' ' + (endings[rarity] || '');
}

/**
 * 根据稀有度概率生成装备
 * @param {string} type - 装备类型（可选）
 * @returns {Object} 生成的装备数据
 */
export function generateEquipment(type = null) {
  // 随机选择装备类型
  const equipmentType = type || EQUIPMENT_TYPES[randomInt(0, EQUIPMENT_TYPES.length - 1)];
  
  // 根据权重选择稀有度
  const rarityWeights = {};
  for (const [rarity, config] of Object.entries(RARITY_CONFIG)) {
    rarityWeights[rarity] = config.weight;
  }
  const rarity = weightedRandom(rarityWeights);
  
  // 获取稀有度配置
  const config = RARITY_CONFIG[rarity];
  
  // 生成属性
  const style = randomInt(...config.styleRange);
  const comfort = randomInt(...config.comfortRange);
  const rarityScore = randomInt(...config.rarityScoreRange);
  const baseValue = randomInt(...config.baseValueRange);
  
  // 生成名称和故事
  const name = generateName(equipmentType, rarity);
  const story = generateStory(name, rarity);
  
  // 生成装备 ID
  const id = generateEquipmentId(equipmentType, rarity);
  
  return {
    id,
    name,
    type: equipmentType,
    rarity,
    style,
    comfort,
    rarityScore,
    story,
    baseValue,
    currentValue: baseValue,
    status: 'tradeable',
    cooldownEndsAt: null,
    imageUrl: `https://cdn.agentstreet.ai/equipment/${id}.png`,
    previewUrl: `https://cdn.agentstreet.ai/equipment/${id}-preview.png`
  };
}

/**
 * 生成新手装备包
 * @returns {Object} 包含三件基础装备的对象
 */
export function generateWelcomePackage() {
  return {
    jacket: generateEquipment('jacket'),
    pants: generateEquipment('pants'),
    shoes: generateEquipment('shoes')
  };
}

/**
 * 根据稀有度直接生成装备（跳过随机）
 * @param {string} rarity - 稀有度
 * @param {string} type - 装备类型
 * @returns {Object}
 */
export function generateEquipmentByRarity(rarity, type = null) {
  const equipmentType = type || EQUIPMENT_TYPES[randomInt(0, EQUIPMENT_TYPES.length - 1)];
  const config = RARITY_CONFIG[rarity];
  
  if (!config) {
    throw new Error(`Invalid rarity: ${rarity}`);
  }
  
  const style = randomInt(...config.styleRange);
  const comfort = randomInt(...config.comfortRange);
  const rarityScore = randomInt(...config.rarityScoreRange);
  const baseValue = randomInt(...config.baseValueRange);
  
  const name = generateName(equipmentType, rarity);
  const story = generateStory(name, rarity);
  const id = generateEquipmentId(equipmentType, rarity);
  
  return {
    id,
    name,
    type: equipmentType,
    rarity,
    style,
    comfort,
    rarityScore,
    story,
    baseValue,
    currentValue: baseValue,
    status: 'tradeable',
    cooldownEndsAt: null,
    imageUrl: `https://cdn.agentstreet.ai/equipment/${id}.png`,
    previewUrl: `https://cdn.agentstreet.ai/equipment/${id}-preview.png`
  };
}

export { RARITY_CONFIG, EQUIPMENT_TYPES };
