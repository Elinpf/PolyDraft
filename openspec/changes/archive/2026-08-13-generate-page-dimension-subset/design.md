# Design: 生成页选用维度子集 + 维度数据刷新

## Context

选项配置与生成页脱节：生成页维度列表只在挂载时拉一次，因页面常驻挂载（切 tab 不卸载），切回不重拉，选项配置的改动不反映。且生成页自动包含全部维度，无法应对未来多生成页方案各自用不同维度子集的需求。

## Goals / Non-Goals

**Goals**
- 生成页能选用维度子集：勾选哪些维度渲染哪些下拉。
- 选项配置改动后，切回生成页立即看到最新维度/选项。
- 勾选状态持久化，按生成页方案隔离，为多生成页解耦铺路。
- 默认不回退：现有三个维度默认勾选。

**Non-Goals**
- 后端维度 CRUD 改动（仍全量返回，过滤在前端）。
- 多生成页方案本身的实现（本期只铺路：勾选按方案 ID 存，默认页 `default`）。
- 维度勾选的服务端持久化（本期仅 localStorage）。

## Decisions

### 1. 维度数据刷新：dimsTick 信号
`SharedState` 加 `dimsTick: number` + `bumpDimsTick()`。`OptionsPage` 在保存全部 / 新增维度 / 删除维度 / 新增选项 / 删除选项 / 删除选项后调 `bumpDimsTick()`。`GeneratePage` 的 `useEffect` 依赖加 `s.dimsTick`，变化时重拉 `/dimensions`。

### 2. 维度子集选用
`GeneratePage` 加状态 `selectedDims: string[]`（维度名列表），localStorage 持久化（key `copygen_selected_dims_<pageId>`，当前 pageId=`default`）。渲染下拉框时 `dimensions.filter(d => selectedDims.includes(d.name))`。

默认值：首次进入无存档时，取当前所有维度名（保证现状不回退，三个默认维度全勾）。

交互：输入区顶部一排可勾选标签（chip），点击切换勾选。新增维度不自动进 `selectedDims`，需手动点。

### 3. 悬空清理
重拉维度后，`selectedDims` 里存在但 `dimensions` 里已没有的维度名，从 `selectedDims` 移除（维度被删时下拉自动消失）。

### 4. selections 状态与维度子集
用户已选的 `selections[dimName]` 在该维度被取消勾选时保留值但不渲染下拉——重新勾选回来值还在。无需特殊清理（后端 `selections_to_vars` 对未选维度自然不注入）。

### 5. 默认勾选规则
- 无 localStorage 存档：`selectedDims = 所有当前维度名`
- 有存档：用存档值，但做悬空清理

## Risks / Trade-offs

- [勾选状态仅 localStorage，换浏览器丢] → 可接受，本期不持久化到服务端。
- [新增维度默认不进生成页，用户可能困惑"为什么加了没出现"] → 勾选区会显示所有维度，未勾选的用浅色，用户能看到需手动勾。
- [dimsTick 频繁 bump] → 仅在选项配置保存/增删时触发，频率低。

## Open Questions
- 多生成页方案落地时，pageId 如何分配：本期固定 `default`，未来按方案路由决定。
