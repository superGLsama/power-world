/**
 * AgentCard Web Component - Day 50 迭代
 * 基于 Web Components 技术的可复用 Agent 卡片组件
 * 
 * Day 50 增强特性（基于 TypeORM Entity 设计模式）：
 * - 数据模型增强：description, owner, price, edition, stats, alliance, featured
 * - 三状态管理：loading/error/success 状态切换
 * - 显示模式：compact/full/preview 三种模式
 * - 验证管道：属性验证与类型转换
 * 
 * 使用方式：
 * <agent-card agent-id="xxx" name="Agent Name" mode="full"></agent-card>
 */

// ========== TypeORM 风格的数据模型定义 ==========

/**
 * AgentCard 数据模型定义（TypeORM Entity 风格）
 * 定义组件支持的所有数据字段及其类型
 */
const AGENT_CARD_SCHEMA = {
    // 基础字段
    primaryKey: 'agent-id',
    fields: {
        'agent-id': { type: 'string', required: true },
        'avatar': { type: 'string', default: '🤖' },
        'name': { type: 'string', required: true, default: 'Unknown Agent' },
        'rarity': { type: 'enum', values: ['ssr', 'sr', 'r'], default: 'r' },
        'score': { type: 'number', default: 0, min: 0, max: 100 },
        
        // 装备与标签
        'items': { type: 'array', default: [] },
        'tags': { type: 'array', default: [] },
        
        // 互动数据
        'likes': { type: 'number', default: 0, min: 0 },
        'favorites': { type: 'number', default: 0, min: 0 },
        
        // Day 50 新增：扩展数据模型
        'description': { type: 'string', default: '' },
        'owner': { type: 'string', default: '' },
        'price': { type: 'number', default: 0, min: 0 },
        'edition': { type: 'string', default: '' },  // 限量版标识，如 "1/100"
        'alliance': { type: 'string', default: '' },  // 联盟
        'stats': { type: 'object', default: {} },      // 统计数据 { power: 90, speed: 85, ... }
        'created-at': { type: 'string', default: '' }, // 创建时间 ISO 格式
        'featured': { type: 'boolean', default: false }, // 精选标记
        
        // 显示控制
        'mode': { type: 'enum', values: ['compact', 'full', 'preview'], default: 'full' },
        'show-actions': { type: 'boolean', default: true },
    }
};

// 稀有度配置
const RARITY_CONFIG = {
    ssr: { label: 'SSR', color: '#FFD700', bgGradient: 'linear-gradient(90deg, #FFD700, #FFA500)', glow: 'rgba(255, 215, 0, 0.4)' },
    sr: { label: 'SR', color: '#C0C0C0', bgGradient: 'linear-gradient(90deg, #C0C0C0, #A8A8A8)', glow: 'rgba(192, 192, 192, 0.4)' },
    r: { label: 'R', color: '#CD7F32', bgGradient: 'linear-gradient(90deg, #CD7F32, #B8860B)', glow: 'rgba(205, 127, 50, 0.4)' }
};

// ========== 模板缓存优化 ==========

const AgentCardTemplate = document.createElement('template');
AgentCardTemplate.innerHTML = `
    <style>
        :host {
            /* 设计令牌 - 支持外部定制 */
            --card-bg: rgba(26, 26, 46, 0.6);
            --card-border: rgba(107, 92, 231, 0.3);
            --card-hover-border: rgba(107, 92, 231, 0.6);
            --card-radius: 16px;
            --card-padding: 1.2rem;
            
            --text-primary: #ffffff;
            --text-secondary: #B8B5FF;
            --text-muted: #888888;
            
            --accent-primary: #6B5CE7;
            --accent-secondary: #00FFD1;
            --accent-warning: #FFD700;
            --accent-danger: #ff6b8a;
            
            /* 稀有度颜色 */
            --rarity-ssr-glow: rgba(255, 215, 0, 0.4);
            --rarity-sr-glow: rgba(192, 192, 192, 0.4);
            --rarity-r-glow: rgba(205, 127, 50, 0.4);
            
            --heart-color: #ff6b8a;
            --star-color: #FFD700;
            
            /* CSS Containment 性能优化 */
            contain: content;
            display: block;
        }

        :host([hidden]) { display: none; }

        /* 状态：加载中 */
        :host([loading]) .card { display: none; }
        :host([loading]) .skeleton { display: block; }
        
        /* 状态：错误 */
        :host([error]) .card { display: none; }
        :host([error]) .error-state { display: flex; }
        
        /* 模式：紧凑模式 */
        :host([mode="compact"]) .card-image { height: 80px; }
        :host([mode="compact"]) .card-avatar { font-size: 2.5rem; }
        :host([mode="compact"]) .card-content { padding: 0.8rem; }
        :host([mode="compact"]) .card-outfit,
        :host([mode="compact"]) .card-description,
        :host([mode="compact"]) .card-stats,
        :host([mode="compact"]) .card-price { display: none; }
        
        /* 模式：预览模式 */
        :host([mode="preview"]) .card-image { height: 120px; }
        :host([mode="preview"]) .card-stats { display: none; }
        :host([mode="preview"]) .card-price { display: none; }
        
        /* 精选标记 */
        :host([featured]) .card::before {
            content: '★ 精选';
            position: absolute;
            top: -1px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(90deg, var(--accent-warning), #FFA500);
            color: #000;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 12px;
            border-radius: 0 0 8px 8px;
            z-index: 10;
        }

        .card {
            position: relative;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--card-radius);
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .card:hover {
            border-color: var(--card-hover-border);
            transform: translateY(-4px);
            box-shadow: 0 8px 32px rgba(107, 92, 231, 0.2);
        }

        /* 稀有度光效 */
        .card[data-rarity="ssr"] { box-shadow: 0 0 20px var(--rarity-ssr-glow); }
        .card[data-rarity="ssr"]:hover { box-shadow: 0 0 30px var(--rarity-ssr-glow), 0 8px 32px rgba(255, 215, 0, 0.3); }
        .card[data-rarity="sr"] { box-shadow: 0 0 15px var(--rarity-sr-glow); }
        .card[data-rarity="sr"]:hover { box-shadow: 0 0 25px var(--rarity-sr-glow), 0 8px 32px rgba(192, 192, 192, 0.2); }
        .card[data-rarity="r"] { box-shadow: 0 0 10px var(--rarity-r-glow); }

        /* 卡片头部图片区域 */
        .card-image {
            position: relative;
            height: 140px;
            background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .card-particles {
            position: absolute;
            inset: 0;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }

        .card:hover .card-particles { opacity: 1; }

        .card-particle {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            animation: particleFloat 3s ease-in-out infinite;
        }

        @keyframes particleFloat {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
            50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
        }

        .card-avatar {
            font-size: 4rem;
            z-index: 1;
            transition: transform 0.3s ease;
        }

        .card:hover .card-avatar { transform: scale(1.1); }

        .card-rarity {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 0.25rem 0.6rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 700;
            font-family: 'Orbitron', sans-serif;
        }

        .card-rarity.ssr {
            background: linear-gradient(90deg, #FFD700, #FFA500);
            color: #000;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .card-rarity.sr {
            background: linear-gradient(90deg, #C0C0C0, #A8A8A8);
            color: #000;
        }

        .card-rarity.r {
            background: linear-gradient(90deg, #CD7F32, #B8860B);
            color: #fff;
        }

        /* 卡片内容区域 */
        .card-content {
            padding: var(--card-padding);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.8rem;
        }

        .card-name {
            font-family: 'Orbitron', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 70%;
        }

        .card-score {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.2rem;
            font-weight: 700;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* 描述文字 */
        .card-description {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-bottom: 0.6rem;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.4;
        }

        /* 装备展示 */
        .card-outfit {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 0.8rem;
        }

        .mini-item {
            font-size: 1rem;
            padding: 2px 4px;
            background: rgba(107, 92, 231, 0.15);
            border-radius: 4px;
        }

        /* 统计数据 */
        .card-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            margin-bottom: 0.8rem;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 4px;
            background: rgba(107, 92, 231, 0.1);
            border-radius: 6px;
        }

        .stat-label {
            font-size: 0.6rem;
            color: var(--text-muted);
            text-transform: uppercase;
        }

        .stat-value {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--accent-secondary);
        }

        /* 价格与联盟 */
        .card-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.8rem;
            flex-wrap: wrap;
            gap: 8px;
        }

        .card-price {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--accent-warning);
        }

        .card-edition {
            font-size: 0.7rem;
            color: var(--text-muted);
            padding: 2px 6px;
            background: rgba(255, 215, 0, 0.1);
            border-radius: 4px;
        }

        .card-alliance {
            font-size: 0.75rem;
            color: var(--accent-primary);
            padding: 2px 8px;
            background: rgba(107, 92, 231, 0.15);
            border-radius: 4px;
        }

        /* 卡片底部 */
        .card-footer {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .card-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .card-tag {
            font-size: 0.7rem;
            padding: 2px 6px;
            background: rgba(0, 255, 209, 0.1);
            border: 1px solid rgba(0, 255, 209, 0.3);
            border-radius: 4px;
            color: var(--accent-secondary);
        }

        .card-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            margin-top: 0.5rem;
        }

        /* 操作按钮 */
        .action-btn {
            border: none;
            background: rgba(107, 92, 231, 0.15);
            border-radius: 8px;
            padding: 0.4rem 0.6rem;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .action-btn:hover {
            background: rgba(107, 92, 231, 0.3);
            transform: scale(1.1);
        }

        .action-btn:active { transform: scale(0.95); }

        .like-btn.liked {
            color: var(--heart-color);
            background: rgba(255, 107, 138, 0.2);
        }

        .favorite-btn.favorited {
            color: var(--star-color);
            background: rgba(255, 215, 0, 0.2);
        }

        /* 心跳动画 */
        .like-btn.liked { animation: heartbeat 1.5s ease-in-out infinite; }

        @keyframes heartbeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
        }

        /* 入场动画 */
        :host(.entering) .card {
            animation: cardEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes cardEnter {
            0% { opacity: 0; transform: scale(0.8) translateY(20px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ========== 骨架屏（Loading 状态） ========== */
        .skeleton {
            display: none;
            padding: var(--card-padding);
        }

        .skeleton-image {
            height: 140px;
            background: linear-gradient(90deg, rgba(107,92,231,0.1) 25%, rgba(107,92,231,0.2) 50%, rgba(107,92,231,0.1) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 8px;
            margin-bottom: 1rem;
        }

        .skeleton-line {
            height: 16px;
            background: linear-gradient(90deg, rgba(107,92,231,0.1) 25%, rgba(107,92,231,0.2) 50%, rgba(107,92,231,0.1) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
            margin-bottom: 8px;
        }

        .skeleton-line.short { width: 60%; }
        .skeleton-line.medium { width: 80%; }

        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }

        /* ========== 错误状态 ========== */
        .error-state {
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
        }

        .error-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .error-message {
            color: var(--accent-danger);
            font-size: 0.9rem;
        }

        .retry-btn {
            margin-top: 1rem;
            padding: 0.5rem 1.5rem;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
            border: none;
            border-radius: 20px;
            color: #fff;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s;
        }

        .retry-btn:hover { transform: scale(1.05); }

        /* 响应式 */
        @media (max-width: 480px) {
            .card-image { height: 120px; }
            .card-avatar { font-size: 3rem; }
            .card-name { font-size: 0.9rem; }
            .card-stats { grid-template-columns: repeat(2, 1fr); }
        }
        
        /* Day 51: 无障碍动画偏好支持 */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.001ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.001ms !important;
            }
            
            /* 禁用装饰性动画 */
            .card-particles { display: none !important; }
            
            /* 保持功能但禁用动画 */
            .card { transition: none !important; }
            .card:hover { transform: none !important; box-shadow: inherit; }
            .card:hover .card-avatar { transform: none !important; }
            
            /* 重试按钮禁用悬停效果 */
            .retry-btn:hover { transform: none !important; }
        }
    </style>
    
    <!-- 主卡片 -->
    <div class="card" part="card">
        <div class="card-image" part="image">
            <div class="card-particles" part="particles"></div>
            <span class="card-avatar" part="avatar">🤖</span>
            <span class="card-rarity" part="rarity">SSR</span>
        </div>
        <div class="card-content" part="content">
            <div class="card-header">
                <span class="card-name" part="name">Agent Name</span>
                <span class="card-score" part="score">95</span>
            </div>
            <p class="card-description" part="description"></p>
            <div class="card-outfit" part="outfit"></div>
            <div class="card-meta">
                <span class="card-price" part="price">
                    <span>💎</span>
                    <span class="price-value">0</span>
                </span>
                <span class="card-edition" part="edition"></span>
                <span class="card-alliance" part="alliance"></span>
            </div>
            <div class="card-stats" part="stats"></div>
            <div class="card-footer">
                <div class="card-tags" part="tags"></div>
                <div class="card-actions" part="actions">
                    <button class="action-btn like-btn" part="like-btn" aria-label="点赞">
                        🤍 <span class="like-count">0</span>
                    </button>
                    <button class="action-btn favorite-btn" part="favorite-btn" aria-label="收藏">
                        ☆
                    </button>
                    <button class="action-btn compare-btn" part="compare-btn" aria-label="对比">
                        ⚖️
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 骨架屏 -->
    <div class="skeleton">
        <div class="skeleton-image"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
    </div>

    <!-- 错误状态 -->
    <div class="error-state">
        <span class="error-icon">⚠️</span>
        <span class="error-message">加载失败</span>
        <button class="retry-btn">重试</button>
    </div>
`;

// ========== 验证管道（Pipe） ==========

/**
 * 属性验证管道 - 类似 NestJS Pipe 的数据验证与转换
 */
class ValidationPipe {
    static transform(name, value, schema) {
        if (!schema.fields[name]) return value;
        
        const field = schema.fields[name];
        
        switch (field.type) {
            case 'number':
                const num = parseFloat(value);
                return isNaN(num) ? field.default : Math.max(field.min || 0, Math.min(field.max || Infinity, num));
            
            case 'boolean':
                return value !== null && value !== 'false';
            
            case 'array':
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch {
                        return field.default;
                    }
                }
                return Array.isArray(value) ? value : field.default;
            
            case 'object':
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch {
                        return field.default;
                    }
                }
                return typeof value === 'object' ? value : field.default;
            
            case 'enum':
                return field.values.includes(value) ? value : field.default;
            
            default:
                return value !== undefined && value !== null ? value : field.default;
        }
    }
}

// ========== AgentCard Web Component ==========

class AgentCard extends HTMLElement {
    // 支持的观察属性
    static get observedAttributes() {
        return [
            'agent-id', 'avatar', 'name', 'rarity', 'score', 
            'items', 'tags', 'likes', 'favorites', 'liked', 'favorited',
            'description', 'owner', 'price', 'edition', 'alliance', 'stats',
            'created-at', 'featured', 'mode', 'show-actions', 'loading', 'error'
        ];
    }

    constructor() {
        super();
        
        // 创建 Shadow DOM
        this.attachShadow({ mode: 'open' });
        
        // 克隆模板
        this.shadowRoot.appendChild(
            AgentCardTemplate.content.cloneNode(true)
        );
        
        // 缓存 DOM 引用
        this._card = this.shadowRoot.querySelector('.card');
        this._avatar = this.shadowRoot.querySelector('.card-avatar');
        this._rarity = this.shadowRoot.querySelector('.card-rarity');
        this._name = this.shadowRoot.querySelector('.card-name');
        this._score = this.shadowRoot.querySelector('.card-score');
        this._description = this.shadowRoot.querySelector('.card-description');
        this._outfit = this.shadowRoot.querySelector('.card-outfit');
        this._tags = this.shadowRoot.querySelector('.card-tags');
        this._actions = this.shadowRoot.querySelector('.card-actions');
        this._likeBtn = this.shadowRoot.querySelector('.like-btn');
        this._likeCount = this.shadowRoot.querySelector('.like-count');
        this._favoriteBtn = this.shadowRoot.querySelector('.favorite-btn');
        this._compareBtn = this.shadowRoot.querySelector('.compare-btn');
        this._particles = this.shadowRoot.querySelector('.card-particles');
        this._price = this.shadowRoot.querySelector('.price-value');
        this._edition = this.shadowRoot.querySelector('.card-edition');
        this._alliance = this.shadowRoot.querySelector('.card-alliance');
        this._stats = this.shadowRoot.querySelector('.card-stats');
        this._errorState = this.shadowRoot.querySelector('.error-state');
        this._retryBtn = this.shadowRoot.querySelector('.retry-btn');
        
        // 内部状态
        this._localLiked = false;
        this._localFavorited = false;
        this._localLikes = 0;
        
        // 绑定方法
        this._handleClick = this._handleClick.bind(this);
        this._handleLike = this._handleLike.bind(this);
        this._handleFavorite = this._handleFavorite.bind(this);
        this._handleCompare = this._handleCompare.bind(this);
        this._handleRetry = this._handleRetry.bind(this);
    }

    // 组件挂载
    connectedCallback() {
        // 添加事件监听
        this._card.addEventListener('click', this._handleClick);
        this._likeBtn.addEventListener('click', this._handleLike);
        this._favoriteBtn.addEventListener('click', this._handleFavorite);
        this._compareBtn.addEventListener('click', this._handleCompare);
        this._retryBtn.addEventListener('click', this._handleRetry);
        
        // 初始化显示
        this._updateDisplay();
        
        // 添加入场动画
        this.classList.add('entering');
        setTimeout(() => this.classList.remove('entering'), 500);
        
        // 生成粒子
        this._generateParticles();
    }

    // 组件卸载
    disconnectedCallback() {
        this._card.removeEventListener('click', this._handleClick);
        this._likeBtn.removeEventListener('click', this._handleLike);
        this._favoriteBtn.removeEventListener('click', this._handleFavorite);
        this._compareBtn.removeEventListener('click', this._handleCompare);
        this._retryBtn.removeEventListener('click', this._handleRetry);
    }

    // 属性变化监听
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // 通过验证管道处理
        const transformedValue = ValidationPipe.transform(name, newValue, AGENT_CARD_SCHEMA);
        
        switch (name) {
            case 'loading':
                if (this.hasAttribute('loading')) {
                    this.removeAttribute('error');
                }
                break;
            case 'error':
                if (this.hasAttribute('error')) {
                    this.removeAttribute('loading');
                }
                break;
            case 'avatar':
                this._avatar.textContent = transformedValue || '🤖';
                break;
            case 'name':
                this._name.textContent = transformedValue || 'Unknown';
                break;
            case 'rarity':
                this._updateRarity(transformedValue);
                break;
            case 'score':
                this._score.textContent = transformedValue || '0';
                break;
            case 'description':
                this._description.textContent = transformedValue || '';
                this._description.style.display = transformedValue ? '-webkit-box' : 'none';
                break;
            case 'items':
                this._updateItems(transformedValue);
                break;
            case 'tags':
                this._updateTags(transformedValue);
                break;
            case 'likes':
                this._localLikes = transformedValue;
                this._likeCount.textContent = this._localLikes;
                break;
            case 'favorites':
                // 收藏数显示备用
                break;
            case 'liked':
                this._localLiked = this.hasAttribute('liked');
                this._updateLikeState();
                break;
            case 'favorited':
                this._localFavorited = this.hasAttribute('favorited');
                this._updateFavoriteState();
                break;
            case 'price':
                this._price.textContent = transformedValue || '0';
                break;
            case 'edition':
                this._edition.textContent = transformedValue || '';
                this._edition.style.display = transformedValue ? 'inline-block' : 'none';
                break;
            case 'alliance':
                this._alliance.textContent = transformedValue || '';
                this._alliance.style.display = transformedValue ? 'inline-block' : 'none';
                break;
            case 'stats':
                this._updateStats(transformedValue);
                break;
            case 'featured':
                // featured 属性控制 CSS
                break;
            case 'mode':
                // mode 属性控制 CSS
                break;
            case 'show-actions':
                this._actions.style.display = transformedValue ? 'flex' : 'none';
                break;
        }
    }

    // ========== 私有方法 ==========

    _updateRarity(rarity) {
        const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.r;
        this._rarity.textContent = config.label;
        this._rarity.className = `card-rarity ${rarity}`;
        this._card.dataset.rarity = rarity;
    }

    _updateItems(items) {
        this._outfit.innerHTML = '';
        const itemsArray = Array.isArray(items) ? items : [];
        itemsArray.slice(0, 6).forEach(item => {
            const span = document.createElement('span');
            span.className = 'mini-item';
            span.textContent = item;
            this._outfit.appendChild(span);
        });
    }

    _updateTags(tags) {
        this._tags.innerHTML = '';
        const tagsArray = Array.isArray(tags) ? tags : [];
        tagsArray.slice(0, 4).forEach(tag => {
            const span = document.createElement('span');
            span.className = 'card-tag';
            span.textContent = tag;
            this._tags.appendChild(span);
        });
    }

    _updateStats(stats) {
        this._stats.innerHTML = '';
        const statsObj = typeof stats === 'object' ? stats : {};
        const entries = Object.entries(statsObj).slice(0, 6);
        
        if (entries.length === 0) {
            this._stats.style.display = 'none';
            return;
        }
        
        this._stats.style.display = 'grid';
        entries.forEach(([key, value]) => {
            const div = document.createElement('div');
            div.className = 'stat-item';
            div.innerHTML = `
                <span class="stat-label">${key}</span>
                <span class="stat-value">${value}</span>
            `;
            this._stats.appendChild(div);
        });
    }

    _updateLikeState() {
        if (this._localLiked) {
            this._likeBtn.classList.add('liked');
            this._likeBtn.innerHTML = '❤️ <span class="like-count">${this._localLikes}</span>';
        } else {
            this._likeBtn.classList.remove('liked');
            this._likeBtn.innerHTML = '🤍 <span class="like-count">${this._localLikes}</span>';
        }
        // 更新点赞数
        const countSpan = this._likeBtn.querySelector('.like-count');
        if (countSpan) countSpan.textContent = this._localLikes;
    }

    _updateFavoriteState() {
        if (this._localFavorited) {
            this._favoriteBtn.classList.add('favorited');
            this._favoriteBtn.textContent = '★';
        } else {
            this._favoriteBtn.classList.remove('favorited');
            this._favoriteBtn.textContent = '☆';
        }
    }

    _updateDisplay() {
        // 初始化所有显示
        const rarity = this.getAttribute('rarity') || 'r';
        const mode = this.getAttribute('mode') || 'full';
        const showActions = this.getAttribute('show-actions');
        
        this._updateRarity(rarity);
        this._avatar.textContent = this.getAttribute('avatar') || '🤖';
        this._name.textContent = this.getAttribute('name') || 'Unknown';
        this._score.textContent = this.getAttribute('score') || '0';
        
        const description = this.getAttribute('description');
        this._description.textContent = description || '';
        this._description.style.display = description ? '-webkit-box' : 'none';
        
        const price = this.getAttribute('price');
        this._price.textContent = price || '0';
        
        const edition = this.getAttribute('edition');
        this._edition.textContent = edition || '';
        this._edition.style.display = edition ? 'inline-block' : 'none';
        
        const alliance = this.getAttribute('alliance');
        this._alliance.textContent = alliance || '';
        this._alliance.style.display = alliance ? 'inline-block' : 'none';
        
        const stats = this.getAttribute('stats');
        this._updateStats(stats ? JSON.parse(stats) : {});
        
        this._updateItems(JSON.parse(this.getAttribute('items') || '[]'));
        this._updateTags(JSON.parse(this.getAttribute('tags') || '[]'));
        
        this._localLiked = this.hasAttribute('liked');
        this._localFavorited = this.hasAttribute('favorited');
        this._localLikes = parseInt(this.getAttribute('likes')) || 0;
        this._likeCount.textContent = this._localLikes;
        
        this._updateLikeState();
        this._updateFavoriteState();
        
        if (showActions === 'false') {
            this._actions.style.display = 'none';
        }
    }

    _generateParticles() {
        this._particles.innerHTML = '';
        const rarity = this.getAttribute('rarity') || 'r';
        const color = RARITY_CONFIG[rarity]?.color || '#00FFD1';
        const count = 8;
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'card-particle';
            particle.style.background = color;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 2}s`;
            this._particles.appendChild(particle);
        }
    }

    // ========== 事件处理 ==========

    _handleClick(event) {
        if (event.target.closest('.card-actions')) return;
        
        this.dispatchEvent(new CustomEvent('card-click', {
            bubbles: true,
            composed: true,
            detail: this.getAgentData()
        }));
    }

    _handleLike(event) {
        event.stopPropagation();
        this._localLiked = !this._localLiked;
        
        if (this._localLiked) {
            this._localLikes++;
            if (!this.hasAttribute('liked')) this.setAttribute('liked', '');
        } else {
            this._localLikes--;
            this.removeAttribute('liked');
        }
        
        this._likeCount.textContent = this._localLikes;
        this._updateLikeState();
        
        this.dispatchEvent(new CustomEvent('card-like', {
            bubbles: true,
            composed: true,
            detail: { agentId: this.getAttribute('agent-id'), liked: this._localLiked, likes: this._localLikes }
        }));
    }

    _handleFavorite(event) {
        event.stopPropagation();
        this._localFavorited = !this._localFavorited;
        
        if (this._localFavorited) {
            this.setAttribute('favorited', '');
        } else {
            this.removeAttribute('favorited');
        }
        
        this._updateFavoriteState();
        
        this.dispatchEvent(new CustomEvent('card-favorite', {
            bubbles: true,
            composed: true,
            detail: { agentId: this.getAttribute('agent-id'), favorited: this._localFavorited }
        }));
    }

    _handleCompare(event) {
        event.stopPropagation();
        
        this.dispatchEvent(new CustomEvent('card-compare', {
            bubbles: true,
            composed: true,
            detail: { agentId: this.getAttribute('agent-id'), name: this.getAttribute('name') }
        }));
    }

    _handleRetry() {
        this.removeAttribute('error');
        this.dispatchEvent(new CustomEvent('card-retry', {
            bubbles: true,
            composed: true,
            detail: { agentId: this.getAttribute('agent-id') }
        }));
    }

    // ========== 公开方法 ==========

    /** 设置加载状态 */
    setLoading(loading) {
        if (loading) {
            this.setAttribute('loading', '');
        } else {
            this.removeAttribute('loading');
        }
    }

    /** 设置错误状态 */
    setError(message = '加载失败') {
        this.setAttribute('error', message);
        const errorMsg = this.shadowRoot.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = message;
    }

    /** 设置点赞状态 */
    setLiked(liked) {
        this._localLiked = liked;
        this._updateLikeState();
    }

    /** 设置收藏状态 */
    setFavorited(favorited) {
        this._localFavorited = favorited;
        this._updateFavoriteState();
    }

    /** 更新点赞数 */
    updateLikes(count) {
        this._localLikes = count;
        this._likeCount.textContent = count;
    }

    /** 获取完整数据（TypeORM Entity 风格） */
    getAgentData() {
        return {
            id: this.getAttribute('agent-id'),
            avatar: this.getAttribute('avatar') || '🤖',
            name: this.getAttribute('name') || 'Unknown',
            rarity: this.getAttribute('rarity') || 'r',
            score: parseInt(this.getAttribute('score')) || 0,
            description: this.getAttribute('description') || '',
            owner: this.getAttribute('owner') || '',
            price: parseInt(this.getAttribute('price')) || 0,
            edition: this.getAttribute('edition') || '',
            alliance: this.getAttribute('alliance') || '',
            stats: JSON.parse(this.getAttribute('stats') || '{}'),
            createdAt: this.getAttribute('created-at') || '',
            featured: this.hasAttribute('featured'),
            items: JSON.parse(this.getAttribute('items') || '[]'),
            tags: JSON.parse(this.getAttribute('tags') || '[]'),
            likes: this._localLikes,
            liked: this._localLiked,
            favorites: parseInt(this.getAttribute('favorites')) || 0,
            favorited: this._localFavorited,
            mode: this.getAttribute('mode') || 'full',
            showActions: this.getAttribute('show-actions') !== 'false'
        };
    }
}

// 注册自定义元素
customElements.define('agent-card', AgentCard);

// ========== 便捷工厂函数 ==========

/**
 * 创建 AgentCard 组件的便捷函数
 * @param {Object} agent - Agent 数据对象（TypeORM Entity 风格）
 * @param {Object} options - 配置选项
 * @returns {HTMLElement} AgentCard 元素
 */
function createAgentCard(agent, options = {}) {
    const card = document.createElement('agent-card');
    
    card.setAttribute('agent-id', agent.id);
    card.setAttribute('avatar', agent.avatar || '🤖');
    card.setAttribute('name', agent.name || 'Unknown');
    card.setAttribute('rarity', agent.rarity || 'r');
    card.setAttribute('score', agent.score || 0);
    
    if (agent.description) card.setAttribute('description', agent.description);
    if (agent.owner) card.setAttribute('owner', agent.owner);
    if (agent.price) card.setAttribute('price', agent.price);
    if (agent.edition) card.setAttribute('edition', agent.edition);
    if (agent.alliance) card.setAttribute('alliance', agent.alliance);
    if (agent.stats) card.setAttribute('stats', JSON.stringify(agent.stats));
    if (agent.createdAt) card.setAttribute('created-at', agent.createdAt);
    if (agent.featured) card.setAttribute('featured', '');
    
    if (agent.items && agent.items.length) card.setAttribute('items', JSON.stringify(agent.items));
    if (agent.tags && agent.tags.length) card.setAttribute('tags', JSON.stringify(agent.tags));
    if (agent.likes !== undefined) card.setAttribute('likes', agent.likes);
    if (agent.favorites !== undefined) card.setAttribute('favorites', agent.favorites);
    if (agent.liked) card.setAttribute('liked', '');
    if (agent.favorited) card.setAttribute('favorited', '');
    
    if (options.mode) card.setAttribute('mode', options.mode);
    if (options.showActions === false) card.setAttribute('show-actions', 'false');
    if (options.delay !== undefined) card.style.animationDelay = `${options.delay}ms`;
    if (options.class) card.classList.add(...options.class.split(' '));
    
    return card;
}

/**
 * 批量创建 AgentCard 组件
 * @param {Array} agents - Agent 数据数组
 * @param {HTMLElement} container - 容器元素
 * @param {Object} options - 配置选项
 */
function renderAgentCards(agents, container, options = {}) {
    const fragment = document.createDocumentFragment();
    
    agents.forEach((agent, index) => {
        const card = createAgentCard(agent, {
            ...options,
            delay: index * (options.stagger || 50)
        });
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}

/**
 * 批量创建带骨架屏的 AgentCard
 * @param {number} count - 骨架屏数量
 * @param {HTMLElement} container - 容器元素
 */
function renderSkeletonCards(count, container) {
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < count; i++) {
        const card = document.createElement('agent-card');
        card.setAttribute('loading', '');
        card.style.animationDelay = `${i * 50}ms`;
        fragment.appendChild(card);
    }
    
    container.appendChild(fragment);
}

// 导出到全局
window.AgentCard = AgentCard;
window.createAgentCard = createAgentCard;
window.renderAgentCards = renderAgentCards;
window.renderSkeletonCards = renderSkeletonCards;
window.AGENT_CARD_SCHEMA = AGENT_CARD_SCHEMA;
window.ValidationPipe = ValidationPipe;
