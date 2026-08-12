"""流水线编排 — ticket 05/07 落地。

固定管线：并行生成 N 份（每份对应一个风格槽位：独立 prompt + temperature）→ 同模型审查 → 输出。
- 阶段不可插拔。N = 风格槽位数量，由用户在 WebUI 增删槽位控制。
- 并行 = 每槽位各跑一次（不同 prompt/温度 → 风格差异），失败容忍降级。
- 审查可单独重跑。
- 进度通过 async generator 推送事件，FastAPI SSE 消费。
"""
import asyncio
from dataclasses import dataclass, field

from .providers import LLMProvider
from .store import merge_variables, get_review_prompt, list_slots, GenSlot


@dataclass
class GenerateInput:
    input_vars: dict            # 本次输入变量（每次运行态）
    provider_name: str = "kimi"


@dataclass
class PipelineResult:
    drafts: list[str] = field(default_factory=list)
    review: str = ""


async def run(gen_input: GenerateInput, provider: LLMProvider, db_path="copygen.db"):
    """完整流水线，async generator，yield 进度事件 dict（SSE 友好）。

    事件：
      {"type": "stage", "stage": "generating"}
      {"type": "gen_progress", "done": 1, "total": 3}
      {"type": "stage", "stage": "reviewing"}
      {"type": "done", "drafts": [...], "review": "..."}
    """
    vars_ctx = merge_variables(gen_input.input_vars, db_path)
    slots = list_slots(db_path)

    yield {"type": "stage", "stage": "generating", "total": len(slots)}

    tasks = [
        asyncio.create_task(provider.complete(s.body, vars_ctx, s.temperature))
        for s in slots
    ]
    drafts = []
    done = 0
    for coro in asyncio.as_completed(tasks):
        try:
            drafts.append(await coro)
        except Exception:
            pass
        done += 1
        yield {"type": "gen_progress", "done": done, "total": len(slots)}

    if not drafts:
        yield {"type": "done", "drafts": [], "review": "", "error": "all generations failed"}
        return

    yield {"type": "stage", "stage": "reviewing"}
    review = await _review(provider, drafts, vars_ctx, db_path)
    yield {"type": "done", "drafts": drafts, "review": review}


async def re_review(drafts: list[str], input_vars: dict, provider: LLMProvider, db_path="copygen.db"):
    """单独重跑审查阶段（issues/03）：复用已有候选，不重走生成。"""
    vars_ctx = merge_variables(input_vars, db_path)
    review = await _review(provider, drafts, vars_ctx, db_path)
    return PipelineResult(drafts=drafts, review=review)


async def _review(provider, drafts, vars_ctx, db_path):
    """审查：全部候选拼成 {candidates}，喂审查 prompt，产出意见（不替人选优）。"""
    candidates_block = "\n---\n".join(
        f"[候选 {i}]\n{d}" for i, d in enumerate(drafts)
    )
    review_vars = {**vars_ctx, "candidates": candidates_block}
    review_prompt = get_review_prompt(db_path).body
    return await provider.complete(review_prompt, review_vars)
