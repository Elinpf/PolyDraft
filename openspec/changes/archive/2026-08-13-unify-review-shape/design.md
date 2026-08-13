## Context

审核结果字段（score/positive/reverse/accuracy）在后端 3 处独立声明：`ReviewResult`（pipeline）、`Finalized`（store）、`save_finalized` 散参（store）。`FinalizeInput`（app，Pydantic）和前端 `CandReview`（TS）各一处。本期收敛后端 3 处到单一 `ReviewFields` dataclass，前端与 Pydantic 保持 flat（契约稳定）。

关键约束：
- 前端 `doFinalize`（generate.tsx）向 `/finalized` POST flat body（score/positive/reverse/accuracy 在顶层），不可破坏。
- `/re-review` 响应 `{review: {score,positive,reverse,accuracy,raw}}`，`to_dict()` 输出契约不可变。
- `Finalized(**dict(row))` 从 SQLite row 按名构造，继承后仍按名匹配。

## Goals / Non-Goals

**Goals:**
- 后端审核结果字段单一真相源 `ReviewFields`：加维度只改它 + `_LABELS` + `FinalizeInput` + 前端，dataclass 层不再 3 处重复。
- `save_finalized` 散参收敛为 `review_fields: ReviewFields`，调用方少传 4 个散参。
- 行为零变化：所有 API 响应 shape、前端契约、DB 列不变。

**Non-Goals:**
- 前端 TS 类型 codegen（项目无基建，speculative）。
- `_parse_review` 的 `_LABELS` 数据驱动化（已是 label 映射表，足够清晰）。
- `/finalized` API 响应改嵌套（破坏前端，不做）。
- `FinalizeInput` Pydantic 改继承 dataclass（Pydantic 与 dataclass 混继承复杂，flat 保持）。
- 跨层单真相源（Python↔TS 无 codegen 不成立，前端手动同步 + 注释）。

## Decisions

### 决策 1：ReviewFields 放 pipeline.py，ReviewResult/Finalized 继承

`ReviewFields`（score:int=0, positive:str="", reverse:str="", accuracy:str=""）定义在 `pipeline.py`（ReviewResult 邻近）。`ReviewResult(ReviewFields)` 加 `raw:str=""` + `to_dict()`。`store.py` 的 `Finalized` 继承 `ReviewFields`（`from .pipeline import ReviewFields`），自身声明 id/ts/provider/input_vars/selected_idx/text/review。

**为何 ReviewFields 放 pipeline 不放 store**：ReviewResult 是审核解析产物（pipeline 语义），store 的 Finalized 是它的持久化镜像。真相源跟语义走 → pipeline。store 反向依赖 pipeline 是否循环？pipeline 已 `from .store import ...`（list_slots 等），若 store `from .pipeline import ReviewFields` 则循环 import。

→ **规避循环**：`ReviewFields` 放 `pipeline.py`，store.py 在 `save_finalized` / `Finalized` 处用 `TYPE_CHECKING` 或延迟 import？实际 Python 模块循环 import 在顶层 `from x import Y` 会失败。pipeline 顶层 `from .store import list_slots, ...`；若 store 顶层 `from .pipeline import ReviewFields` → 循环。

**解法**：把 `ReviewFields` 放到不依赖两者的中立模块。候选：新建 `backend/review.py`（纯 dataclass，无其他依赖），pipeline 与 store 都 `from .review import ReviewFields`。`ReviewResult` 也搬到 review.py？ReviewResult 的 `to_dict` 和 `_parse_review` 紧耦合 pipeline 逻辑，留 pipeline。ReviewFields（纯字段）独立到 review.py。

→ **最终**：`backend/review.py` 定义 `ReviewFields` dataclass。pipeline.ReviewResult 继承它（同文件 import 无环）；store.Finalized 继承它；store.save_finalized 接收 `ReviewFields`。无循环（review.py 不 import pipeline/store）。

### 决策 2：save_finalized 散参 → 对象参数

```python
# 前
def save_finalized(provider, input_vars, selected_idx, text, review="",
                   score=None, positive="", reverse="", accuracy="") -> int
# 后
def save_finalized(provider, input_vars, selected_idx, text,
                   review="", review_fields: ReviewFields = None) -> int
```
app.py `save_fin`：从 `FinalizeInput`（flat）组装 `ReviewFields(score=fin.score, positive=fin.positive, reverse=fin.reverse, accuracy=fin.accuracy)` 传入。`review`（raw 文本）仍是独立参数（不在 ReviewFields，因 Finalized.review 列存 raw，与结构化字段分离）。

### 决策 3：FinalizeInput 保持 flat

Pydantic model 继承 dataclass 需 `pydantic.dataclasses`，混用增加复杂度且 flat 是前端契约。`FinalizeInput` 保持当前 flat 字段，app.py 做组装层（flat→ReviewFields）。前端零改动。

### 决策 4：前端 CandReview 加注释，字段不变

`frontend/src/types.ts` 的 `CandReview` 加注释：`// 字段集与后端 ReviewFields (backend/review.py) 对齐；加维度需同步`。无 codegen，手动同步。

## Risks / Trade-offs

- **[循环 import]** store↔pipeline 互相依赖会 ImportError。→ ReviewFields 独立到 `review.py`（无依赖），两者单向 import review。验证 `from backend import app` 无错。
- **[dataclass 继承字段顺序]** ReviewFields 字段全有默认值，子类加字段也需有默认——ReviewResult.raw=""、Finalized 各字段都有默认，OK。`Finalized(**dict(row))` 按名匹配，顺序无关。
- **[save_finalized 调用方漂移]** app.py 是唯一调用方，改组装即可。验证 e2e 定稿流程。
- **[to_dict 契约]** ReviewResult.to_dict 须仍输出 `{score,positive,reverse,accuracy,raw}`。继承后 to_dict 用 `dataclasses.asdict` 或手写，确保 raw 在内。→ 手写 to_dict 保持原样输出。

## Migration Plan

纯重构，无数据/API 变化。

1. 新建 `backend/review.py`，定义 `ReviewFields` dataclass。
2. pipeline.py：`ReviewResult` 继承 `ReviewFields`，`to_dict` 输出不变。
3. store.py：`Finalized` 继承 `ReviewFields`；`save_finalized` 签名改 `review_fields` 参数，内部解包写库。
4. app.py：`save_fin` 组装 `ReviewFields` 传入。
5. 前端 types.ts：`CandReview` 加注释。
6. 验证：import 冒烟 + 后端 e2e（生成/审核/定稿/重审/历史）。

回滚：单 commit，`git revert`。

## Open Questions

无。循环 import 由中立模块 review.py 规避；前端不 codegen 是显式 non-goal。
