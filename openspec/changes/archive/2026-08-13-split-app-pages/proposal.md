## Why

`frontend/src/App.tsx` 是近期最大热点（git log 改 10 次，远超其他文件），881 行挤 10 个页面组件 + 7 个类型定义。所有跨页状态经 `SharedState`（9 字段 prop 袋）穿透传递。

消费图证明 SharedState 是 shallow 抽象——9 字段里 6 个只有单一消费者（genProvider/extraInputs 只 GeneratePage 用，provEditing 只 ConfigPage 用），上提到 App 顶层纯属为"切 tab 不卸载保活"。deletion test：删掉 SharedState 直接传 props，复杂度只是搬家，不集中——证明 shallow。页面常驻挂载（display 切换不卸载）已让状态天然存活，上提多余。

跨页刷新信号（finalizeTick/dimsTick）是手搓计数器 pub/sub，无契约但有效。本期不去抽象成事件机制（speculative，仅 2 信号 3 参与者）。

## What Changes

- **步骤一（结构搬运，零行为变化）**：页面组件拆出到 `frontend/src/pages/{generate,config,slots,options,knowledge,history,docs}.tsx`；跨页类型到 `frontend/src/types.ts`；`App.tsx` 只剩路由 + 顶层状态。SharedState 与状态组织本步不动。
- **步骤二（状态就地 + 刷新去混味）**：单消费者状态就地（genProvider/extraInputs→generate.tsx，provEditing/reloadProviders→config.tsx，靠页面常驻挂载保活）；刷新信号 finalizeTick/dimsTick 保持计数器逻辑，但从 SharedState 拆出单独传给真正需要的页面。App 顶层只留 page 路由 + 两个跨页刷新信号。
- **不做**：useRefreshBus 命名事件机制、useGenState/useProviders hook 抽象、多生成页方案。

## Capabilities

### New Capabilities
（无新能力——纯结构重构，行为不变）

### Modified Capabilities
- `generation-ui`: 生成页组件从 App.tsx 迁出到独立文件，状态就地化，行为不变。
- `project-skeleton`: App.tsx 拆分为 pages/ 多文件 + types.ts，App 只保留路由。

## Impact

- 前端 `frontend/src/App.tsx` → 拆为 `App.tsx`（路由）+ `pages/*.tsx`（7 页）+ `types.ts`
- 行为零变化（步骤一纯搬运，步骤二状态重组保活）
- 后端无改动
- 为未来多生成页解耦扫清结构障碍（但本期不实现多生成页）
