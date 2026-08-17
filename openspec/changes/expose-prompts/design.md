## Context

排错需要看每个候选实际发给模型的提示词（变量替换后）。当前 `provider.complete` 渲染 messages 后只返回文本，提示词丢失。Q1/Q2/Q3 均选 A：complete 多返回 messages，候选卡折叠区展示，只给生成不给审核。

## Goals / Non-Goals

**Goals:**
- complete 返回渲染后 messages（单一真相源，不重复渲染）
- candidate 带 prompts 字段，前端可查看
- 候选卡折叠区展示 system + user
- 行为零变化（生成/审核/定稿结果不变）

**Non-Goals:**
- 审核环节提示词暴露（Q3 选 A，只给生成）
- 提示词在线编辑（本期只读排错）
- call_logs 读取路径（架构审查 #7，独立）

## Decisions

### 决策 1：complete 返回 (text, messages)

```python
# 前
async def complete(self, prompt, variables, temperature=0.7, system=None) -> str
# 后
async def complete(self, prompt, variables, temperature=0.7, system=None) -> tuple[str, list[dict]]
```

messages 结构：`[{"role":"system","content":...}, {"role":"user","content":...}]`（system 缺则只有 user）。

**为何不抽 _render 到 pipeline**：渲染逻辑（`_render` + `_SafeDict`）在 providers.py 内，抽出去要跨模块。complete 内部已渲染，直接返回它用的 messages 最省。pipeline 只需接收，不重新渲染。

**为何返回 messages 而非 (system_str, user_str)**：messages 是 OpenAI 标准结构，未来若加 tools/图像等字段天然兼容；pipeline 提取 system/user 字符串给前端即可。

### 决策 2：pipeline 提取 prompts 塞进 candidate

`_run_one` 返回 `(idx, slot, style, text, messages, err)`，candidate 组装：
```python
prompts = {}
for m in messages:
    if m["role"] == "system": prompts["system"] = m["content"]
    elif m["role"] == "user": prompts["user"] = m["content"]
candidates.append({..., "prompts": prompts})
```

**为何 system/user 分别提取**：前端折叠区分两段展示，比一段拼接清晰。

### 决策 3：re_review 适配签名但不返回提示词

re_review 调 complete 现在要解包 `(text, messages)`，但 re_review 只返回 ReviewResult，不暴露提示词（Q3 选 A）。messages 丢弃。

### 决策 4：前端候选卡折叠区

```tsx
<details className="prompt-inspector">
  <summary>查看提示词</summary>
  <div><strong>System</strong><pre>{prompts.system || '(无)'}</pre></div>
  <div><strong>User</strong><pre>{prompts.user}</pre></div>
</details>
```

用 `<details>` 原生折叠，无需 state。`<pre>` 等宽显示。默认收起。

**为何用 details 不用 state**：候选卡已有 logic 层 state，提示词展开是纯展示，details 原生 + CSS 最简，不污染 logic。

## Risks / Trade-offs

- **[complete 签名 breaking]** 返回值从 str 变 tuple，所有调用方要改。→ 只有 pipeline 两处调（generate + re_review），都改。log_call 已收 messages（原本就有），不受影响。
- **[提示词含密钥?]** 提示词是模板+变量，不含 api_key（key 在 header）。→ 无敏感泄露，可前端展示。
- **[SSE 体积]** 每个 candidate 多两段提示词文本（几百字），done 事件变大。→ 3 候选 × ~500字 = 1.5KB，可接受。
- **[prompts 字段可选]** 前端 `prompts?` 可选，旧数据/重审结果无此字段时折叠区不显示。→ 向后兼容。

## Migration Plan

1. providers.complete 返回 tuple，提取 messages
2. pipeline _run_one 收集 messages，candidate 组装加 prompts
3. re_review 适配新签名
4. 前端 types + logic + 两 view 加折叠区
5. 验证：生成后候选卡能展开看提示词，system/user 正确

回滚：单 commit，git revert。

## Open Questions

无。三决策点已定（A/A/A）。
