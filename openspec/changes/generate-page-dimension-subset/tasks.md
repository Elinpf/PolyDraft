# Tasks: 生成页选用维度子集 + 维度数据刷新

## 1. 共享状态

- [x] 1.1 `SharedState` 加 `dimsTick: number` + `bumpDimsTick: () => void`
- [x] 1.2 App 顶层 `useState(0)` + 传 shared

## 2. 选项配置触发信号

- [x] 2.1 `OptionsPage` 保存全部（saveAll）后调 `s.bumpDimsTick()`
- [x] 2.2 新增维度（addDim）、删除维度（delDim）、新增选项（AddChoiceRow onAdd）、删除选项（delChoice）后调 `s.bumpDimsTick()`

## 3. 生成页维度刷新

- [x] 3.1 `GeneratePage` 的 `loadDims` 用 `useEffect` 依赖加 `s.dimsTick`，变化时重拉 `/dimensions`
- [x] 3.2 验证：选项配置新增选项后切回生成页下拉可见新选项

## 4. 生成页维度子集选用

- [x] 4.1 `GeneratePage` 加 `selectedDims: string[]` 状态，localStorage 持久化（key `copygen_selected_dims_default`）
- [x] 4.2 默认值：无存档时取当前所有维度名（不回退）
- [x] 4.3 输入区顶部加维度勾选区（chip 标签，已勾高亮，未勾浅色）
- [x] 4.4 下拉框渲染改为 `dimensions.filter(d => selectedDims.includes(d.name))`
- [x] 4.5 悬空清理：重拉维度后，selectedDims 里不存在于 dimensions 的维度名移除

## 5. 验证

- [x] 5.1 选项配置给产品系列加「尊享」→ 切回生成页下拉见「尊享」（dimsTick 触发 loadDims，下拉按 selectedDims 渲染含新选项）
- [x] 5.2 选项配置新增维度「喂养场景」→ 切回生成页勾选区见该维度（未勾），手动勾选后下拉出现
- [x] 5.3 取消勾选某维度 → 下拉消失；重新勾选 → 下拉回来且原选择值还在（selections 保留，未清理）
- [x] 5.4 删除已勾选的维度 → 生成页该下拉自动消失，勾选状态清理（loadDims 悬空清理）
- [x] 5.5 刷新浏览器 → 勾选状态保持（localStorage 持久化）
