## Context

补充输入（变量名→值）现仅存 localStorage `copygen_extra_inputs`，换浏览器即丢。本期改后端持久化。形态：`Record<string,string>`，默认 `{'品牌':'爱他美'}`。后端已有 `system_prompt`/`review_prompt` 单例表模式可参照。

## Goals / Non-Goals

**Goals:**
- 后端持久化补充输入，跨设备同步
- 前端启动加载 + 变化自动保存（debounce）
- 迁移 localStorage 旧数据到后端（不丢用户已有输入）

**Non-Goals:**
- 补充输入配置页（仍由生成页内联编辑）
- 变量级 API（整体覆盖写）
- 补充输入的"启用/禁用"开关（全部参与生成）

## Decisions

### 决策 1：单行配置表

```sql
CREATE TABLE IF NOT EXISTS extra_inputs (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    body  TEXT NOT NULL   -- JSON: {变量名: 值}
);
```
参照 `system_prompt`/`review_prompt` 单例表模式。`get_extra_inputs() -> dict`、`save_extra_inputs(dict)`。

**为何单行表不逐行存**：补充输入是整体配置（一组变量），整体读写最简，无需逐行 CRUD。

### 决策 2：前端 debounce 保存

```typescript
// 启动 fetch 初始化
useEffect(() => { fetch('/extra-inputs').then(r => r.json()).then(setExtraInputs) }, [])
// 变化 debounce 500ms 写回（避免每次按键都 POST）
useEffect(() => {
  const id = setTimeout(() => fetch('/extra-inputs', {POST, body: extraInputs}), 500)
  return () => clearTimeout(id)
}, [extraInputs])
```

**为何 debounce 500ms**：用户连续编辑变量名/值时不每次都 POST，500ms 静止后保存。避免请求风暴。

### 决策 3：localStorage 迁移

后端无法读前端 localStorage。迁移在前端：
- 启动时先 fetch `/extra-inputs`
- 后端有数据 → 用后端的（后端为准）
- 后端空 → 读 localStorage，若非空则 POST 上传（迁移），并用之
- 后端空 + localStorage 空 → seed 默认 `{'品牌':'爱他美'}`，POST 保存
- 迁移完成后清 localStorage（避免下次再当源）

### 决策 4：默认 seed

`_seed_extra_inputs`：表空时插 `{'品牌':'爱他美'}`。与原 localStorage 默认一致。

## Risks / Trade-offs

- **[首次加载空闪]** async fetch 前表单空 → 加载中态。→ fetch 完成前用空对象，输入框空，加载完填充。可接受（几十 ms）。
- **[并发覆盖]** 多设备同时编辑，后覆盖前。→ 单人工具，整体覆盖写，不处理并发。文档说明。
- **[debounce 丢失]** 用户编辑后 500ms 内关闭页面，最后改动可能丢。→ 500ms 短，风险低；可加 beforeunload 同步保存兜底。
- **[localStorage 残留]** 迁移后清 localStorage，避免双源。→ 迁移逻辑显式 removeItem。

## Migration Plan

1. 后端：SCHEMA 加表 + CRUD + seed + init_store 调用
2. 后端：API 路由
3. 前端：logic 改 fetch 初始化 + debounce 保存 + localStorage 迁移
4. 验证：补充输入编辑后刷新/换浏览器可见；localStorage 旧数据迁移

回滚：单 commit，git revert。表保留无害。

## Open Questions

无。
