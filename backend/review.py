"""审核结果结构化字段真相源。

`ReviewFields` = 审核四维度（score/positive/reverse/accuracy），由 `pipeline.ReviewResult`
与 `store.Finalized` 继承，避免四处重复声明。独立模块以规避 pipeline ↔ store 循环 import。

加审核维度时同步：此处 + pipeline `_LABELS` + app `FinalizeInput` + 前端 `types.ts CandReview`。
"""
from dataclasses import dataclass


@dataclass
class ReviewFields:
    """审核结果结构化字段（单一真相源）。"""
    score: int = 0
    positive: str = ""
    reverse: str = ""
    accuracy: str = ""
