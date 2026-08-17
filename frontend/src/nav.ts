import type { Page } from './types'

// ============ 导航项 ============
// App 与 BrandApp 共用，避免两处定义漂移。
// 纯文字导航，无图标——shell 直接渲染 label。

export const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'generate', label: '生成' },
  { key: 'slots', label: '文案风格' },
  { key: 'options', label: '选项配置' },
  { key: 'knowledge', label: '产品知识' },
  { key: 'history', label: '定稿历史' },
  { key: 'config', label: '模型配置' },
]
