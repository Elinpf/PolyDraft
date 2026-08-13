## 1. ReviewFields 真相源

- [x] 1.1 新建 `backend/review.py`，定义 `ReviewFields` dataclass（score:int=0, positive:str="", reverse:str="", accuracy:str=""），无其他依赖
- [x] 1.2 pipeline.py `from .review import ReviewFields`，`ReviewResult` 继承 ReviewFields，仅保留 raw 字段 + to_dict()（输出不变）

## 2. store.py 继承 + 散参收敛

- [x] 2.1 store.py `from .review import ReviewFields`，`Finalized` 继承 ReviewFields，删除自身重复声明的 score/positive/reverse/accuracy
- [x] 2.2 `save_finalized` 签名改：删 score/positive/reverse/accuracy 散参，加 `review_fields: ReviewFields = None`；内部解包写库（None 时取默认空值）
- [x] 2.3 `list_finalized` 构造 `Finalized(**dict(row))` 行为不变（按名匹配）

## 3. app.py 组装层

- [x] 3.1 `save_fin` 从 `FinalizeInput` flat 字段组装 `ReviewFields(fin.score, fin.positive, fin.reverse, fin.accuracy)`，传给 `save_finalized`
- [x] 3.2 `FinalizeInput` Pydantic model 不变（保持前端 flat 契约）

## 4. 前端注释

- [x] 4.1 `frontend/src/types.ts` 的 `CandReview` 加注释：字段集与后端 ReviewFields (backend/review.py) 对齐，加维度需同步

## 5. 验证

- [x] 5.1 `python -c "from backend import app"` 无 ImportError（无循环 import）
- [x] 5.2 后端 e2e：生成 / 审核 / 单份重审 / 定稿 / 历史列表 全跑通
- [x] 5.3 验证 to_dict 输出 {score,positive,reverse,accuracy,raw} 与 /re-review 响应 shape 不变
- [x] 5.4 验证 /finalized POST flat 契约不变（前端 doFinalize 无需改）
