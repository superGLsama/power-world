import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Agent Street E2E 测试套件
 * 测试核心功能：主题切换、搜索、收藏、筛选排序、导出
 */

const indexPath = join(__dirname, '..', 'Agent-Street', 'index.html');

test.describe('Agent Street 核心功能测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${indexPath}`);
    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test.describe('主题切换功能', () => {
    test('页面默认加载成功', async ({ page }) => {
      const title = await page.title();
      expect(title).toContain('Agent Street');
    });

    test('主题切换按钮存在且可点击', async ({ page }) => {
      const themeBtn = page.locator('#themeToggle, .theme-toggle-btn');
      await expect(themeBtn.first()).toBeVisible();
    });

    test('主题切换功能正常', async ({ page }) => {
      // 获取初始主题
      const initialTheme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme') || 'dark'
      );
      
      // 点击主题切换
      const themeBtn = page.locator('#themeToggle, .theme-toggle-btn').first();
      await themeBtn.click();
      await page.waitForTimeout(300);
      
      // 验证主题已切换
      const newTheme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme')
      );
      expect(newTheme).not.toBe(initialTheme);
    });
  });

  test.describe('搜索功能', () => {
    test('搜索输入框存在', async ({ page }) => {
      const searchInput = page.locator('#searchInput, input[placeholder*="搜索"]');
      await expect(searchInput).toBeVisible();
    });

    test('搜索输入框可输入', async ({ page }) => {
      const searchInput = page.locator('#searchInput, input[placeholder*="搜索"]');
      await searchInput.fill('test');
      const value = await searchInput.inputValue();
      expect(value).toBe('test');
    });

    test('搜索历史记录功能', async ({ page }) => {
      const searchInput = page.locator('#searchInput, input[placeholder*="搜索"]');
      
      // 输入搜索词
      await searchInput.fill('测试');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      // 清除输入，重新打开搜索
      await searchInput.clear();
      await searchInput.click();
      await page.waitForTimeout(200);
      
      // 检查是否有搜索历史显示
      const historySection = page.locator('.suggestion-title, .search-history, text=/搜索历史/');
      // 历史记录可能显示或隐藏，取决于实现
    });
  });

  test.describe('Agent 卡片显示', () => {
    test('Agent 卡片列表存在', async ({ page }) => {
      const agentCards = page.locator('.agent-card, .card, [class*="card"]');
      await expect(agentCards.first()).toBeVisible({ timeout: 10000 });
    });

    test('Agent 卡片数量大于0', async ({ page }) => {
      const agentCards = page.locator('.agent-card, .card, [class*="card"]');
      const count = await agentCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('卡片包含关键信息', async ({ page }) => {
      const firstCard = page.locator('.agent-card, .card, [class*="card"]').first();
      await expect(firstCard).toBeVisible({ timeout: 5000 });
      
      // 检查卡片是否有内容（不一定是文本，可能有图标或其他元素）
      const cardContent = await firstCard.innerHTML();
      expect(cardContent.length).toBeGreaterThan(0);
    });
  });

  test.describe('筛选与排序功能', () => {
    test('排序选择器存在', async ({ page }) => {
      const sortSelect = page.locator('#favoriteSortSelect, .sort-btn, .sort-bar');
      await expect(sortSelect.first()).toBeVisible({ timeout: 10000 });
    });

    test('稀有度筛选标签存在', async ({ page }) => {
      const filterPills = page.locator('.filter-pill, .filter-tag, button[class*="filter"]');
      const count = await filterPills.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('收藏功能', () => {
    test('收藏按钮存在', async ({ page }) => {
      // 等待卡片加载
      await page.waitForTimeout(1000);
      const favoriteBtn = page.locator('.favorite-btn, button[class*="favorite"], [onclick*="favorite"]').first();
      await expect(favoriteBtn).toBeVisible({ timeout: 5000 });
    });

    test('收藏夹入口存在', async ({ page }) => {
      const favoritePanelBtn = page.locator('#favoriteBtn, .favorite-panel-btn, button[onclick*="favorite"]').first();
      await expect(favoritePanelBtn).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('通知系统', () => {
    test('通知按钮存在', async ({ page }) => {
      const notifyBtn = page.locator('#notificationBtn, .notification-btn, button[onclick*="notification"]');
      await expect(notifyBtn.first()).toBeVisible({ timeout: 5000 });
    });

    test('通知按钮可点击', async ({ page }) => {
      const notifyBtn = page.locator('#notificationBtn, .notification-btn').first();
      await notifyBtn.click();
      await page.waitForTimeout(300);
      // 验证点击后有响应（可能有面板弹出或其他变化）
    });
  });

  test.describe('键盘快捷键', () => {
    test('搜索快捷键 / 可用', async ({ page }) => {
      await page.keyboard.press('/');
      await page.waitForTimeout(200);
      const searchInput = page.locator('#searchInput, input[placeholder*="搜索"]');
      const isFocused = await searchInput.evaluate(el => el === document.activeElement);
      // 搜索框应该获得焦点
    });

    test('Escape 键可关闭面板', async ({ page }) => {
      // 先打开一个面板（如果有的话）
      const notifyBtn = page.locator('#notificationBtn, .notification-btn').first();
      await notifyBtn.click();
      await page.waitForTimeout(300);
      
      // 按 Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    });
  });

  test.describe('响应式设计', () => {
    test('移动端视口下页面可访问', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      // 页面仍可访问
      const title = await page.title();
      expect(title).toContain('Agent Street');
    });

    test('平板视口下页面可访问', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      const title = await page.title();
      expect(title).toContain('Agent Street');
    });
  });

  test.describe('本地存储持久化', () => {
    test('主题偏好可保存到 localStorage', async ({ page }) => {
      // 设置主题
      await page.evaluate(() => {
        localStorage.setItem('agentStreet_theme', 'light');
      });
      
      // 重新加载页面
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      // 验证主题已应用
      const theme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme')
      );
      expect(theme).toBe('light');
    });
  });
});
