## 1. 变量注入改 label

- [x] 1.1 `backend/store.py` `selections_to_vars`：`out[dim.name] = ch.label`（不再 `ch.value or ch.label`）
- [x] 1.2 `selection_value` 不变（仍取 value 查知识库）
- [x] 1.3 验证：selections_to_vars({'产品系列':'至熠',...}) 返回 {产品系列:'至熠'}

## 2. 重写默认 prompt

- [x] 2.1 `backend/prompts.py`：重写 `_DEFAULT_SYSTEM`（分层：人设+调性+{产品知识}+选取指引）
- [x] 2.2 重写 `_DEFAULT_SLOTS` 三份（风格描述 + 业务变量占位）
- [x] 2.3 保留旧版作 `_OLD_PRE_LAYERING_SYSTEM` / `_OLD_PRE_LAYERING_SLOTS` 迁移比对常量

## 3. 一次性迁移

- [x] 3.1 `backend/migrations.py` 新增 `_migrate_prompt_layering()`：system/slot == 旧默认→替换新；用户改过跳过；幂等
- [x] 3.2 `init_store` 调用 `_migrate_prompt_layering()`
- [x] 3.3 迁移幂等验证（已是新版跳过）

## 4. 验证

- [x] 4.1 后端 import 冒烟
- [x] 4.2 渲染验证（不调真模型）：{产品系列}注入"至熠"、slot body 带变量、system 分层清晰、{产品知识}整段+指引
- [x] 4.3 旧库迁移：用户改过的坏版本跳过迁移（design 决策 5），已手动重置为新默认
- [x] 4.4 用户自定义 prompt 保留逻辑正确（不等于旧默认则跳过）

## 5. 文档

- [x] 5.1 README 加"提示词变量"章节：列出固化变量名清单
