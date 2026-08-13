# Design: App.tsx 拆分 + 状态就地化

## Context

App.tsx 881 行单文件，SharedState 9 字段 prop 袋穿透。消费图证据：

| SharedState 字段 | 消费者 |
|---|---|
| genProvider / setGenProvider / extraInputs / setExtraInputs | 仅 GeneratePage |
| provEditing / setProvEditing / reloadProviders | 仅 ConfigPage |
| dimsTick | GeneratePage 消费 / OptionsPage 生产 |
| finalizeTick | HistoryPage 消费 / GeneratePage 生产 |

9 字段中 6 个单消费者、零共享——上提 App 顶层纯属 prop 穿透，页面常驻挂载已保活。两个 tick 是真正跨页部分。

## Goals / Non-Goals

**Goals**
- App.tsx 按领域拆 `pages/*.tsx`，App 只剩路由。
- 单消费者状态就地，零 prop 穿透。
- 刷新信号保持计数器逻辑，从 SharedState 袋子拆出单独传递。
- 行为零变化，分两步可验证。

**Non-Goals**
- useRefreshBus 命名事件机制（speculative，仅 2 信号 3 参与者）。
- useGenState/useProviders 等 hook 抽象（deletion test shallow，无第二消费者）。
- 多生成页方案落地。
- 后端改动。

## Decisions

### 1. 步骤一：结构搬运（零行为变化）
- `pages/{generate,config,slots,options,knowledge,history,docs}.tsx`：各页面组件搬出。
- `types.ts`：跨页类型（Provider/Slot/Choice/Dimension/KnowledgeItem/CandReview/Candidate/Page/SharedState）。
- SharedState 类型与 App 顶层状态本步保持不动，各页 import SharedState 与 useState。
- DimPanel/AddChoiceRow 放 options.tsx 内（仅 OptionsPage 用）。

### 2. 步骤二：状态就地 + 刷新去混味
- `genProvider`/`extraInputs`（含 localStorage 持久化）落进 GeneratePage。
- `provEditing`/`reloadProviders` 落进 ConfigPage。
- SharedState 删除单消费者字段，只留 `finalizeTick`/`bumpFinalizeTick`/`dimsTick`/`bumpDimsTick`（或单独 Context/props 传）。
- 刷新信号保持 useState(0) + bump 计数器逻辑，行为不变。

### 3. 保活机制
页面常驻挂载（`display: page==='x' ? 'block' : 'none'`，App.tsx 已有）不卸载组件，就地 useState 天然存活。无需上提。

## Risks / Trade-offs

- [步骤一搬运可能漏移 import 导致编译错] → tsc 逐文件校验，每页搬完即测。
- [步骤二状态就地后，刷新信号仍靠 props/Context 穿透] → 比当前"全家桶 SharedState"轻，且行为不变。
- [hooks 抽象本期不做，未来若多生成页要复用 genProvider 需再抽] → 记为 Open Question，等真有第二消费者。

## Open Questions
- 第二消费者出现时再抽 useGenState/useProviders hook（当前 speculative generality，不做）。
- 刷新信号是否升级为命名事件机制：等信号数或参与者增加再议。
