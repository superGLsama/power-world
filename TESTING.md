# Agent Street E2E 测试指南

## 概述

本文档介绍 Agent Street 的端到端测试基础设施，基于 Playwright 1.60 构建。

## 快速开始

### 安装依赖

```bash
npm install
npx playwright install chromium
```

### 运行测试

```bash
# 运行所有测试（默认 Chromium）
npm test

# 仅在 Chromium 运行
npm run test:chromium

# 有头模式（可见浏览器）
npm run test:headed

# 打开测试 UI
npm run test:ui

# 查看测试报告
npm run test:report
```

## 测试结构

```
tests/
└── agentstreet.spec.ts    # 核心功能测试套件
```

## 测试覆盖范围

### 1. 主题切换功能
- 页面默认加载成功
- 主题切换按钮可用
- 主题切换功能正常

### 2. 搜索功能
- 搜索输入框存在
- 搜索输入功能正常
- 搜索历史记录功能

### 3. Agent 卡片显示
- 卡片列表渲染
- 卡片数量验证
- 卡片内容完整性

### 4. 筛选与排序
- 排序选择器可用
- 稀有度筛选标签存在

### 5. 收藏功能
- 收藏按钮存在
- 收藏夹入口可用

### 6. 通知系统
- 通知按钮存在
- 通知面板可打开

### 7. 键盘快捷键
- `/` 搜索快捷键
- `Escape` 关闭面板

### 8. 响应式设计
- 移动端视口（375x667）
- 平板视口（768x1024）

### 9. 本地存储持久化
- 主题偏好保存与恢复

## 跨浏览器测试

Playwright 配置支持以下浏览器：

| 浏览器 | 说明 |
|--------|------|
| Chromium | 默认，包含完整功能 |
| Firefox | 跨浏览器兼容性 |
| WebKit | Safari 兼容性 |
| Mobile Chrome | 移动端测试 |

## 测试报告

运行测试后，报告保存在：
- HTML 报告：`playwright-report/index.html`
- 截图：`test-results/**/screenshots/`

## 持续集成

可在 CI 中运行（已配置失败禁止）：

```bash
npm test
```

## 下一步

- 添加收藏功能的完整测试
- 添加导出功能的测试
- 添加批量操作的测试
- 添加通知系统的完整测试
- 添加性能基准测试
