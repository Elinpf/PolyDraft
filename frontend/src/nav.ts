import type { Page } from './types'

// ============ 导航项 ============
// App（经典版顶栏）与 BrandApp（新版侧栏）共用，避免两处定义漂移。
// 各主题的图标字形由各 shell 自行映射（经典用 emoji，新版用单字符）。

export const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'generate', label: '生成' },
  { key: 'slots', label: '文案风格' },
  { key: 'options', label: '选项配置' },
  { key: 'knowledge', label: '产品知识' },
  { key: 'history', label: '历史' },
  { key: 'config', label: '模型配置' },
]
