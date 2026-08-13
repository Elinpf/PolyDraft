// 跨页共享类型（拆分自 App.tsx）

export type Provider = { name: string; base_url: string; api_key: string; model: string }
export type Slot = { slot: number; name: string; body: string; temperature: number }
export type Choice = { id: number; dimension_id: number; label: string; value: string; prompt_fragment: string }
export type Dimension = { id: number; name: string; kind: 'value' | 'prompt'; choices: Choice[] }
export type KnowledgeItem = { series: string; body: string }
export type CandReview = { score: number; positive: string; reverse: string; accuracy: string; raw: string }
export type Candidate = { text: string; style?: string; review: CandReview; edited: string; finalized: boolean; reReviewing: boolean; finalizing: boolean }
export type FinalizedItem = { id: number; ts: string; provider: string; input_vars: string; selected_idx: number; text: string; review: string; score: number | null; positive: string; reverse: string; accuracy: string }
export type Page = 'generate' | 'config' | 'slots' | 'options' | 'knowledge' | 'history' | 'docs'

// ====== 共享状态（提升到 App，切换页面不丢失）======
// 仅跨页的刷新信号——单消费者状态已就地进各页面。

export type SharedState = {
  // 定稿刷新信号：定稿后 +1，历史页监听并重新拉取
  finalizeTick: number
  bumpFinalizeTick: () => void
  // 维度变更信号：选项配置增删改后 +1，生成页监听重拉维度（页面常驻，切回可见新维度）
  dimsTick: number
  bumpDimsTick: () => void
}
