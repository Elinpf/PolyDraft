# Tasks: 产品知识独立 tab + 与产品系列联动

## 1. 后端数据层

- [x] 1.1 `store.py`：`product_knowledge` 表（series 主键 / body 多行文本）
- [x] 1.2 存取函数：list/save/delete（按 series）
- [x] 1.3 startup seed 默认系列知识占位

## 2. 迁移

- [x] 2.1 init_store 移除 variables 表的「产品知识」默认条目
- [x] 2.2 一次性迁移：已存的「产品知识」全局变量值迁到 product_knowledge 默认系列条目（若存在）

## 3. 后端路由

- [x] 3.1 `GET/POST/DELETE /product-knowledge`（按 series）

## 4. 后端流水线接入

- [x] 4.1 pipeline 生成前从 selections 取产品系列值
- [x] 4.2 查 product_knowledge 得 body，注入 `{产品知识}` 到变量上下文
- [x] 4.3 未选系列或无记录时 `{产品知识}` 优雅降级为空

## 5. 前端产品知识 tab

- [x] 5.1 新增「产品知识」tab
- [x] 5.2 系列知识列表 + 增删改（多行 textarea）
- [x] 5.3 从变量页移除「产品知识」展示（迁移后 variables 表已无该条目）

## 6. 验证

- [x] 6.1 维护 A 系列知识，生成页选 A → `{产品知识}` 注入 A 的内容（vars_ctx 集成测试通过）
- [x] 6.2 选 B 系列 → 注入 B 的内容（product_knowledge_for_selection('B') 返回 B 知识）
- [x] 6.3 未选系列 → `{产品知识}` 为空不报错（返回空串）
- [x] 6.4 变量页不再有产品知识条目（迁移已删除，variables 仅剩 brand/tone/topic）
