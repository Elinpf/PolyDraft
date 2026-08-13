## ADDED Requirements

### Requirement: 审核结果字段收敛到 ReviewFields

后端 SHALL 在 `backend/review.py` 定义 `ReviewFields` dataclass（score/positive/reverse/accuracy，含默认值），作为审核结果结构化字段的单一真相源。`ReviewResult`（pipeline）与 `Finalized`（store）SHALL 继承 `ReviewFields`，不再重复声明这四个字段。

#### Scenario: ReviewFields 独立无循环依赖
- **WHEN** 查看 backend/review.py
- **THEN** 仅定义 ReviewFields dataclass，不 import pipeline 或 store
- **AND** pipeline.py 与 store.py 均 `from .review import ReviewFields`，单向无环

#### Scenario: ReviewResult 继承 ReviewFields
- **WHEN** 查看 backend/pipeline.py 的 ReviewResult
- **THEN** ReviewResult 继承 ReviewFields，仅额外声明 raw 字段
- **AND** to_dict() 输出仍为 {score, positive, reverse, accuracy, raw}

#### Scenario: Finalized 继承 ReviewFields
- **WHEN** 查看 backend/store.py 的 Finalized
- **THEN** Finalized 继承 ReviewFields，不再重复声明 score/positive/reverse/accuracy
- **AND** `Finalized(**dict(row))` 从 SQLite row 构造仍按名匹配，行为不变

### Requirement: save_finalized 散参收敛为对象参数

`save_finalized` SHALL 将 score/positive/reverse/accuracy 四个散参收敛为单个 `review_fields: ReviewFields` 参数（review raw 文本仍独立参数）。app.py 的 `save_fin` SHALL 从 `FinalizeInput`（flat）组装 `ReviewFields` 传入。

#### Scenario: save_finalized 签名
- **WHEN** 查看 store.save_finalized 签名
- **THEN** 含 provider/input_vars/selected_idx/text/review/review_fields 参数
- **AND** 不再含 score/positive/reverse/accuracy 散参

#### Scenario: app.py 组装 ReviewFields
- **WHEN** save_fin 处理 /finalized POST
- **THEN** 从 FinalizeInput 的 flat 字段组装 ReviewFields(score=..., positive=..., reverse=..., accuracy=...)
- **AND** 传给 save_finalized

### Requirement: API 与前端契约不变

`/finalized` POST 请求体 shape（flat：score/positive/reverse/accuracy 在顶层）SHALL 不变；`/finalized` GET 响应、`/re-review` 响应、生成 SSE `done.candidates[].review` shape SHALL 不变。前端 `CandReview` SHALL 加注释指明与后端 ReviewFields 对齐。

#### Scenario: /finalized POST 契约不变
- **WHEN** 前端 doFinalize 向 /finalized POST flat body
- **THEN** 后端仍 flat 接收（FinalizeInput 不变）
- **AND** 前端无需改动

#### Scenario: /re-review 响应不变
- **WHEN** 调用 /re-review
- **THEN** 响应仍为 {review: {score, positive, reverse, accuracy, raw}}

#### Scenario: 生成 SSE review 不变
- **WHEN** /generate SSE done 事件
- **THEN** candidates[].review 仍含 score/positive/reverse/accuracy/raw

#### Scenario: 前端 CandReview 注释
- **WHEN** 查看 frontend/src/types.ts
- **THEN** CandReview 含注释指明字段集与后端 ReviewFields 对齐

#### Scenario: 行为不变
- **WHEN** 运行生成/审核/定稿/重审/历史全流程
- **THEN** 与重构前完全一致
