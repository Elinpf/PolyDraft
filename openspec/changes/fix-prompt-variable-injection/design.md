## Context

实测渲染提示词（通过 expose-prompts 功能）发现变量注入失灵：
- `{产品系列}` 注入成 value `A` 而非 label `至熠`（selections_to_vars 注入 value）
- slot body 三份风格丢光变量占位，只剩风格描述
- system prompt 拼贴式，变量硬塞进自然语言，模型难解析
- 产品知识整段注入无指引，模型堆砌

决策：C 方案（产品知识整段注入 + prompt 指引）/ B 固化变量名 / A 分层（system=人设+知识，slot=风格+业务变量）。

当前变量注入流向：
- `_build_vars_ctx`：补充输入 + `selections_to_vars(selections)` + 产品知识（按 series value 查）
- `_render(template, vars)`：`{var}` 替换，缺则原样留（`_SafeDict.__missing__`）
- system + slot body 都经 `_render`

## Goals / Non-Goals

**Goals:**
- `{产品系列}` 等业务变量注入可读 label（"至熠"），不注入 value（"A"）
- system prompt 清晰分层：人设 + 调性 + 产品知识（整段）+ 选取指引
- slot body = 风格描述 + 业务变量占位
- 一次性迁移旧 prompt 到新版（用户自定义的保留）
- 文档化变量名清单

**Non-Goals:**
- 产品知识结构化按场景筛选（C 方案，prompt 层指引，不改后端）
- label/value 数据迁移（value 保留 A/B/C/D 供查知识库，注入改用 label）
- 改 `_render` / `_SafeDict` 机制（缺变量原样留是预期行为）
- 改审核 prompt（review_prompt 不变）

## Decisions

### 决策 1：selections_to_vars 注入 label

```python
# 前
out[dim.name] = ch.value or ch.label
# 后
out[dim.name] = ch.label
```

**为何 label 不 value**：提示词是给模型读的自然语言，"至熠"比"A"可读。value（A/B/C/D）是历史 seed 的内部码，仅用于查 product_knowledge（`selection_value` 仍取 value，不变）。

**label==value 时**：多数维度 label==value（如"朋友圈"），无影响。仅产品系列这种 label≠value 的维度行为改善。

### 决策 2：system prompt 分层重写

新结构：
```
[人设] 你是品牌官方私域内容专家，身份为爱他美海外品线私域的喂养顾问。
[调性] 整体调性符合品牌官方形象，但不要太官方书面，夹杂亲切感。
[产品知识] 以下是所选产品系列的完整知识，请根据文案类型和喂养场景选取相关卖点，不要堆砌全部：
{产品知识}
[输出要求] 产出文案需上下文有逻辑性、连贯性。
```

**去掉拼贴式指令**：旧 system 里"结合选中的{喂养场景}中对应的{喂养场景提示词}...再结合我选的A中符合{喂养场景}的1个{产品知识}"这类拼贴全部删除。变量信息移到 slot body 明确列出，system 只放人设+知识+通用指引。

**产品知识指引**：明确"选取相关卖点，不堆砌全部"——C 方案核心，prompt 层引导模型筛选，不改后端。

### 决策 3：slot body = 风格 + 变量占位

新模板（官方版示例）：
```
请撰写一段产品种草文案，风格为「官方版」：侧重成分/原理/价值解读；语气专业但不晦涩，可出现专业卖点词汇，不夸大功效，合规严谨。

产品系列：{产品系列}
产品段位：{产品段位}
文案类型：{文案类型}
文案类型要求：{文案类型提示词}
喂养场景：{喂养场景}
场景要点：{喂养场景提示词}
品牌：{品牌}
```

**为何变量放 slot body**：每份文案的"写什么产品/段位/类型/场景"是任务输入，跟风格绑在一起自然；system 只管全局人设+知识。这是 prompt 工程标准分层（system=角色+知识，user=任务+变量）。

**三版风格描述保留用户改过的**：迁移时只替换仍是旧默认的 slot。

### 决策 4：固化变量名清单

核心变量（文档化，提示词里直接用）：
- `{品牌}` —— 来自补充输入
- `{产品系列}` `{产品段位}` —— 来自 value 类维度（注入 label）
- `{文案类型}` `{文案类型提示词}` —— 来自 prompt 类维度
- `{喂养场景}` `{喂养场景提示词}` —— 来自 prompt 类维度
- `{产品知识}` —— 后端按产品系列注入

文档写入 README "提示词变量" 章节。

### 决策 5：一次性迁移

旧 system/slot 若仍是旧默认值 → 替换为新版；用户改过的不动。新增迁移函数 `_migrate_prompt_layering()`，比对旧默认 `_OLD_*` 常量。

## Risks / Trade-offs

- **[用户改过 prompt 不迁移]** 旧 system/slot 若用户自定义过，迁移跳过——用户可能手动改的也是坏的。→ 迁移函数只替换旧默认；用户自定义的需手动改，文档说明。
- **[label/value 不一致仍在]** value 保留 A/B/C/D 查知识库，label 显示用。→ `selection_value` 不变，`selections_to_vars` 改 label，两套并存无冲突。
- **[迁移误伤]** 一次性迁移若比对逻辑错可能覆盖用户内容。→ 仅 `body == _OLD_DEFAULT` 时替换，严格相等比对；迁移前 copygen.db 已有数据，用户可备份。
- **[产品知识仍整段]** C 方案不改后端筛选，token 仍可能浪费。→ prompt 指引模型选取，实测后若仍堆砌再考虑 B 结构化。

## Migration Plan

1. 改 `selections_to_vars` 注入 label
2. 重写 `prompts.py` 的 `_DEFAULT_SYSTEM` + `_DEFAULT_SLOTS`，保留旧版作 `_OLD_*` 迁移比对
3. 新增 `_migrate_prompt_layering()` 迁移函数，init_store 调用
4. 跑生成验证：`{产品系列}` 注入"至熠"、slot body 带变量、system 清晰分层、产品知识有指引
5. 文档：README 加变量名清单

回滚：单 commit，git revert。迁移幂等（仅替换旧默认）。

## Open Questions

无。C/B/A 已定。
