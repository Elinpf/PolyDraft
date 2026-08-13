# Tasks: App.tsx 拆分 + 状态就地化

## 1. 步骤一：结构搬运（零行为变化）

- [x] 1.1 建 `frontend/src/types.ts`，迁入跨页类型（Provider/Slot/Choice/Dimension/KnowledgeItem/CandReview/Candidate/FinalizedItem/Page/SharedState）
- [x] 1.2 建 `frontend/src/pages/` 目录
- [x] 1.3 搬 GeneratePage → pages/generate.tsx
- [x] 1.4 搬 ConfigPage → pages/config.tsx
- [x] 1.5 搬 SlotsPage → pages/slots.tsx
- [x] 1.6 搬 OptionsPage + DimPanel + AddChoiceRow → pages/options.tsx
- [x] 1.7 搬 KnowledgePage → pages/knowledge.tsx
- [x] 1.8 搬 HistoryPage → pages/history.tsx
- [x] 1.9 搬 DocsPage → pages/docs.tsx
- [x] 1.10 App.tsx 只剩路由 + 顶层状态 + SharedState（本步不动状态组织）
- [x] 1.11 tsc 通过；浏览器验证全部功能不变

## 2. 步骤二：状态就地 + 刷新去混味

- [x] 2.1 genProvider + setGenProvider 移进 GeneratePage（含 localStorage 持久化 copygen_provider）
- [x] 2.2 extraInputs + setExtraInputs + localStorage 持久化移进 GeneratePage
- [x] 2.3 provEditing + setProvEditing + reloadProviders 移进 ConfigPage（ConfigPage 不再接收 SharedState）
- [x] 2.4 SharedState 移除单消费者字段，只留 finalizeTick/dimsTick 信号
- [x] 2.5 刷新信号单独传给真正需要的页面（GeneratePage/HistoryPage 收 s；OptionsPage 收 s 生产 dimsTick）
- [x] 2.6 tsc 通过；浏览器验证切 tab 不丢状态、定稿刷新、维度刷新

## 3. 验证

- [x] 3.1 生成页切 tab 不丢生成状态（候选/进度/SSE）— 常驻挂载保活
- [x] 3.2 配置页切 tab 不丢编辑态 — provEditing 就地 + 常驻挂载
- [x] 3.3 定稿后历史页自动刷新 — finalizeTick 信号保留
- [x] 3.4 选项配置改维度后生成页自动刷新 — dimsTick 信号保留
- [x] 3.5 localStorage 补充输入持久化正常 — extraInputs 就地 + localStorage
