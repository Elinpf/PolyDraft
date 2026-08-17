import { useGenerateLogic } from '../logic/useGenerateLogic'
import { useThemeView } from '../theme'
import type { SharedState } from '../types'

// ============ 生成页入口 ============
// 逻辑在 useGenerateLogic，视图由主题决定。
// 状态在 logic hook 中，切主题时 View 更换但 state 保留。
// 主题未注册 generate 视为配置错误（显式报错而非静默 fallback）。

export function GeneratePage({ s }: { s: SharedState }) {
  const logic = useGenerateLogic(s)
  const View = useThemeView('generate')
  if (!View) throw new Error('当前主题未注册 generate 视图')
  return <View logic={logic} />
}
