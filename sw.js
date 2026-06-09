/**
 * Agent Street Service Worker - Day 62 PWA Offline Support
 * 基于 Day61 Serverless/边缘计算学习 - 实现前端离线能力
 * 
 * 功能：
 * 1. 静态资源缓存（CSS、JS、图片、字体）
 * 2. 网络优先策略（API 请求）
 * 3. 缓存优先策略（静态资源）
 * 4. 离线回退页面
 * 5. 后台自动更新
 */

// ============ 配置常量 ============
const CACHE_NAME = 'agent-street-v62';
const STATIC_CACHE = 'agent-street-static-v62';
const DYNAMIC_CACHE = 'agent-street-dynamic-v62';

// 静态资源 - 需要预缓存
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// API 基础 URL
const API_BASE = 'https://api.coze.cn';

// ============ 安装阶段 ============
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        Promise.all([
            // 预缓存静态资源
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            // 立即激活
            self.skipWaiting()
        ])
    );
});

// ============ 激活阶段 ============
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // 删除旧版本缓存
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即接管所有页面
            return self.clients.claim();
        })
    );
});

// ============ 请求拦截 ============
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 跳过非 GET 请求
    if (request.method !== 'GET') {
        return;
    }

    // 根据请求类型选择缓存策略
    if (isStaticAsset(url)) {
        // 静态资源：缓存优先
        event.respondWith(cacheFirst(request));
    } else if (isAPIRequest(url)) {
        // API 请求：网络优先，失败回退到缓存
        event.respondWith(networkFirst(request));
    } else {
        // 其他请求：Stale-while-revalidate
        event.respondWith(staleWhileRevalidate(request));
    }
});

// ============ 缓存策略函数 ============

/**
 * 缓存优先策略 - 静态资源
 * 适用于：CSS、JS、图片、字体等不常变化的资源
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // 返回缓存，同时在后台更新缓存
        updateCache(request);
        return cachedResponse;
    }
    
    // 缓存中没有，发起网络请求
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // 网络失败，返回离线回退
        return getOfflineFallback(request);
    }
}

/**
 * 网络优先策略 - API 请求
 * 适用于：API 数据，需要最新内容
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // 网络失败，尝试从缓存获取
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // API 失败返回空数据提示
        return new Response(
            JSON.stringify({
                success: false,
                error: 'offline',
                message: '当前处于离线状态'
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Stale-while-revalidate - 混合策略
 * 适用于：HTML 页面
 */
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, networkResponse.clone());
            });
        }
        return networkResponse;
    }).catch(() => {
        // 网络失败，如果也没有缓存，返回离线回退
        if (!cachedResponse) {
            return getOfflineFallback(request);
        }
    });
    
    // 优先返回缓存，同时后台更新
    return cachedResponse || fetchPromise;
}

/**
 * 后台更新缓存（不阻塞主线程）
 */
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            // 检查是否有变化
            const cachedResponse = await caches.match(request);
            if (!cachedResponse || cachedResponse.headers.get('etag') !== networkResponse.headers.get('etag')) {
                cache.put(request, networkResponse.clone());
            }
        }
    } catch (error) {
        // 静默失败，不影响用户体验
    }
}

// ============ 辅助函数 ============

/**
 * 判断是否为静态资源
 */
function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp'];
    const staticPaths = ['/fonts/', '/images/', '/assets/'];
    
    return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
           staticPaths.some(path => url.pathname.includes(path)) ||
           url.hostname.includes('fonts.googleapis.com') ||
           url.hostname.includes('fonts.gstatic.com');
}

/**
 * 判断是否为 API 请求
 */
function isAPIRequest(url) {
    return url.href.startsWith(API_BASE) ||
           url.pathname.startsWith('/api/');
}

/**
 * 获取离线回退内容
 */
async function getOfflineFallback(request) {
    // 如果请求的是 HTML 页面，返回离线页面
    if (request.headers.get('accept')?.includes('text/html')) {
        const offlinePage = await caches.match('./index.html');
        if (offlinePage) {
            return new Response(await offlinePage.text(), {
                status: 503,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Offline-Mode': 'true'
                }
            });
        }
    }
    
    // 其他请求返回错误提示
    return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6B5CE7" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>`,
        {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
        }
    );
}

// ============ 消息处理 ============

/**
 * 接收来自主线程的消息
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        // 通知用户有更新可用
        self.registration.update().then(() => {
            console.log('[SW] New version available, will activate on next visit');
        });
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        // 返回当前版本
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        // 清除所有缓存
        caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }).then(() => {
            console.log('[SW] All caches cleared');
            event.ports[0].postMessage({ success: true });
        });
    }
});

// ============ 后台同步（可选）============

/**
 * 定期更新检查
 */
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(updateContent());
    }
});

async function updateContent() {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (error) {
                // 单个资源更新失败不影响整体
            }
        }
        
        console.log('[SW] Content sync completed');
    } catch (error) {
        console.error('[SW] Content sync failed:', error);
    }
}

console.log('[SW] Agent Street Service Worker loaded - Day 62 PWA Offline Support');
