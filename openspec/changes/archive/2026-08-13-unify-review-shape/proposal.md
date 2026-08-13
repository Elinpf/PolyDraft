## Why

审核结果 5-tuple（score/positive/reverse/accuracy，外加 raw）在 4 处各写一遍：

1. `backend/pipeline.py:24` `ReviewResult` dataclass（+raw +`to_dict`）
2. `backend/app.py:243` `FinalizeInput` Pydantic model（flat：provider/input_vars/selected_idx/text/review/score/positive/reverse/accuracy）
3. `backend/store.py:367` `Finalized` dataclass + `save_finalized(..., score, positive, reverse, accuracy)` 散参
4. `frontend/src/types.ts:8` `CandReview` type（+raw）

加一个审核维度（如「合规性」）要改 4 处定义 + `_parse_review` 的 `_LABELS` + 前端 `doFinalize` 传参，易漏且拼写漂移（score/scores）。后端三处（ReviewResult/Finalized/save_finalized 散参）可用单一 `ReviewFields` dataclass 收敛，删除 test：抽 `ReviewFields` 后 ReviewResult/Finalized 继承它，散参变一个对象参数，复杂度集中（"审核结果有哪些字段"只一处真相）。

## What Changes

- **后端定义 `ReviewFields` dataclass**（score/positive/reverse/accuracy + 默认值）作为审核结果字段真相源，放 `backend/pipeline.py`（与 ReviewResult 同模块）。
- **`ReviewResult` 继承 `ReviewFields`** + 加 `raw` + `to_dict()`（to_dict 输出含 raw，契约不变）。
- **`Finalized` 继承 `ReviewFields`**（store.py），`Finalized(**dict(row))` 仍按名匹配，行为不变。
- **`save_finalized` 散参收敛**：`score/positive/reverse/accuracy` 四个散参 → 一个 `review_fields: ReviewFields` 参数；app.py 的 `save_fin` 从 `FinalizeInput` 组装 `ReviewFields` 传入。
- **`FinalizeInput`（Pydantic）保持 flat**：前端契约（`/finalized` POST body flat 传 score/positive/reverse/accuracy）不变，避免破坏前端。
- **前端 `CandReview` 加注释**：指明字段集与后端 `ReviewFields` 对齐（无 codegen，手动同步）。
- **不做**：前端 codegen 从后端生成 TS 类型（speculative，项目无 codegen 基建）；把 `_parse_review` 的 `_LABELS` 改成数据驱动（已是 label 映射，足够）；改 `/finalized` API 响应 shape。

## Capabilities

### New Capabilities
（无新能力——纯结构重构，行为不变）

### Modified Capabilities
- `project-skeleton`: 后端审核结果字段定义收敛到 `ReviewFields` dataclass，ReviewResult/Finalized 继承，save_finalized 散参变对象参数；API 与前端契约不变。

## Impact

- `backend/pipeline.py`：新增 `ReviewFields` dataclass；`ReviewResult` 继承它；`to_dict` 输出不变。
- `backend/store.py`：`Finalized` 继承 `ReviewFields`（从 pipeline import）；`save_finalized` 签名改（散参→对象）；`list_finalized` 行为不变。
- `backend/app.py`：`save_fin` 从 `FinalizeInput` 组装 `ReviewFields` 传给 `save_finalized`；`FinalizeInput` 不变。
- `frontend/src/types.ts`：`CandReview` 加注释指向后端 `ReviewFields`，字段不变。
- 行为零变化：`/finalized` POST/GET 契约不变，`/re-review` 响应不变，生成 SSE `done.candidates[].review` 不变。
