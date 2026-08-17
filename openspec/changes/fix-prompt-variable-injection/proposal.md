## Why

实测渲染提示词发现变量注入系统多处失灵，导致模型收到的提示词是半残的"拼贴画"：

1. **`{产品系列}` 注入成 `A` 而非"至熠"**：`selections_to_vars` 注入 `ch.value`，产品系列维度 value 是旧 seed 的 `A/B/C/D`，但 label 已改成"至熠/奇迹白罐/..."。注入取 value 导致 system 出现"结合我选的A中"——不通顺、模型读不懂。
2. **slot body 三份风格全丢变量占位**：官方版/亲切版/闺蜜版只剩风格描述，`{产品系列}` `{品牌}` `{文案类型}` 等业务变量全部丢失，模型不知道写什么产品/段位/类型。
3. **system prompt 是拼贴画**：变量值硬塞进自然语言指令（"结合选中的{喂养场景}中对应的{喂养场景提示词}...再结合我选的A中符合{喂养场景}的1个{产品知识}"），读起来像乱码，模型难解析。
4. **`{喂养场景}` 静默丢失**：用户选的 label 若与维度选项对不上（或维度名引用错），变量静默消失，无提示。
5. **产品知识整段塞入无指引**：`{产品知识}` 注入整个系列知识，但 prompt 没告诉模型"选取相关卖点"，模型倾向堆砌全部。

决策（C/B/A）：变量分层（system=人设+知识，slot body=风格+业务变量）；固化核心变量名；产品知识注入整段 + prompt 层指引模型选取。

## What Changes

- **`selections_to_vars` 注入 label 而非 value**：变量上下文里 `{产品系列}` = 用户选的 label（"至熠"），可读；value 仅 `product_knowledge_for_selection` 内部查知识库用。
- **重写 system prompt**：清晰分层——人设 + 调性 + 产品知识（整段注入）+ 明确指引"根据文案类型和喂养场景从知识中选取相关卖点，不堆砌全部"。去掉拼贴式的变量组合指令。
- **重写三个 slot body**：风格描述 + 业务变量占位（`{产品系列}` `{产品段位}` `{文案类型}` `{文案类型提示词}` `{喂养场景}` `{喂养场景提示词}` `{品牌}`）。
- **固化变量名清单**：核心变量 = `{品牌}` `{产品系列}` `{产品段位}` `{文案类型}` `{文案类型提示词}` `{产品知识}` `{喂养场景}` `{喂养场景提示词}`，文档化。
- **不做**：产品知识结构化按场景筛选（C 方案，prompt 层指引不改后端）；label/value 数据迁移（注入改用 label 后 value 仅查知识用，旧 A/B/C/D value 保留兼容）。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `generation-pipeline`: 变量注入用 label；system/slot prompt 重写为清晰分层；产品知识整段注入 + 指引。行为变化：模型收到的提示词更清晰，文案质量提升。

## Impact

- `backend/store.py`：`selections_to_vars` 注入 `ch.label` 而非 `ch.value or ch.label`；`selection_value` 不变（仍取 value 查知识库）
- `backend/prompts.py`：`_DEFAULT_SYSTEM` 重写；`_DEFAULT_SLOTS` 三份重写（带变量占位）
- `backend/store.py`：`init_store` 对旧 system/slot 做一次性迁移到新版（仅替换仍是旧默认的；用户改过的不动）
- 一次性迁移函数：把旧版 system/slot 迁移到新版分层结构
- 文档：变量名清单写入 README 或 docs
- 行为变化：提示词渲染更清晰，变量正确注入；用户已自定义的 prompt 保留
