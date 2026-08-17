"""流水线 — Change 3（SSE 流式进度）+ Change C（每份独立审核）。

并行生成 = 每槽位各跑一次，失败容忍。
审核 = 每份候选独立调用一次，产出三维度意见 + 综合打分（供人判断）。
run() 为 async generator，yield 进度事件供 SSE。
"""
import asyncio
import re
from dataclasses import dataclass, field

from .providers import LLMProvider
from .review import ReviewFields
from .store import (list_slots, get_review_prompt, get_system_prompt,
                    selections_to_vars, product_knowledge_for_selection)
from .log_store import log_generation, log_operation


@dataclass
class GenerateInput:
    input_vars: dict
    provider_name: str = "kimi"
    selections: dict = field(default_factory=dict)   # 维度名 -> 选项 label (Change A)


@dataclass
class ReviewResult(ReviewFields):
    raw: str = ""

    def to_dict(self) -> dict:
        return {
            "score": self.score, "positive": self.positive,
            "reverse": self.reverse, "accuracy": self.accuracy, "raw": self.raw,
        }


_LABELS = {
    "score": ("综合打分", "打分"),
    "positive": ("正向亲和",),
    "reverse": ("反向亲和",),
    "accuracy": ("产品知识准确性", "知识准确性", "准确性"),
}


def _parse_review(text: str) -> ReviewResult:
    """从 LLM 返回文本中容错解析出 打分/三维度。解析失败则 raw=全文，其余空。"""
    if not text:
        return ReviewResult(raw="")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    def grab(keys: tuple[str, ...]) -> str:
        for ln in lines:
            head = ln.split("：", 1)[0].split(":", 1)[0].strip()
            if head in keys:
                # 取冒号后内容
                for sep in ("：", ":"):
                    if sep in ln:
                        return ln.split(sep, 1)[1].strip()
                return ""
        return ""

    score_raw = grab(_LABELS["score"])
    m = re.search(r"\d+", score_raw)
    score = int(m.group()) if m else 0
    # 夹到 0-100
    score = max(0, min(100, score))
    return ReviewResult(
        score=score,
        positive=grab(_LABELS["positive"]),
        reverse=grab(_LABELS["reverse"]),
        accuracy=grab(_LABELS["accuracy"]),
        raw=text.strip(),
    )


def _build_vars_ctx(input_vars: dict, selections: dict) -> dict:
    """统一变量上下文装配：生成页补充输入 + 选项维度值 + 按系列产品知识。供 run/re_review 复用。"""
    # 生成页「补充输入」提供的 name/value（如 brand/tone）作为基础变量
    vars_ctx = dict(input_vars or {})
    # Change A：选项维度注入（覆盖同名补充输入）
    vars_ctx.update(selections_to_vars(selections))
    # Change B：按所选产品系列注入产品知识
    pk = product_knowledge_for_selection(selections)
    if pk:
        vars_ctx["产品知识"] = pk
    return vars_ctx


def _system_or_none() -> str | None:
    """取系统提示词；未配置时返回 None。"""
    try:
        return get_system_prompt().body
    except KeyError:
        return None


def _extract_prompts(messages: list[dict]) -> dict:
    out = {"system": "", "user": ""}
    for m in messages:
        if m.get("role") == "system":
            out["system"] = m.get("content", "")
        elif m.get("role") == "user":
            out["user"] = m.get("content", "")
    return out


async def run(gen_input: GenerateInput, provider: LLMProvider):
    """完整流水线，async generator，yield 进度事件 dict。

    事件：stage(generating)/gen_progress/stage(reviewing)/review_progress/done
    done: { candidates: [{text, review:{...}}], failures:[...] }
    """
    vars_ctx = _build_vars_ctx(gen_input.input_vars, gen_input.selections)
    slots = list_slots()
    total = len(slots)
    system = _system_or_none()

    log_operation("pipeline", "generate", 0, 0, "start generating")
    yield {"type": "stage", "stage": "generating", "total": total}

    # 生成阶段：每个槽位独立任务，失败容忍，索引不丢
    # temperature 对产品隐藏，后端固定 1（兼容 kimi-for-coding 等仅允许 1 的模型）
    async def _run_one(idx: int, sl):
        try:
            text, messages = await provider.complete(sl.body, vars_ctx, 1.0, system=system)
            return idx, sl.slot, sl.name or f"风格 {sl.slot}", text, messages, None
        except Exception as e:
            return idx, sl.slot, sl.name or f"风格 {sl.slot}", None, None, str(e)

    task_list = [asyncio.create_task(_run_one(i, sl)) for i, sl in enumerate(slots)]
    drafts: list[tuple[int, int, str, str, list[dict]]] = []   # (idx, slot_no, style_name, text, messages)
    failures: list[dict] = []
    done = 0
    for t in asyncio.as_completed(task_list):
        idx, slot_no, style_name, text, messages, err = await t
        if text is not None:
            drafts.append((idx, slot_no, style_name, text, messages or []))
        else:
            failures.append({"slot": slot_no, "error": err})
        done += 1
        yield {"type": "gen_progress", "done": done, "total": total}

    if not drafts:
        log_generation("generate", gen_input.provider_name, gen_input.input_vars, [], "")
        log_operation("pipeline", "generate", 0, 0, "all generations failed")
        yield {"type": "done", "candidates": [], "failures": failures,
               "error": "all generations failed"}
        return

    # 审核阶段：每份候选独立审核，并行
    drafts.sort(key=lambda x: x[0])
    candidates_slot = [s for _, s, _, _, _ in drafts]
    candidates_text = [t for _, _, _, t, _ in drafts]
    candidates_style = [n for _, _, n, _, _ in drafts]
    candidates_msgs = [m for _, _, _, _, m in drafts]

    log_operation("pipeline", "generate", 0, 0, "start reviewing")
    yield {"type": "stage", "stage": "reviewing", "total": len(candidates_text)}

    review_prompt = get_review_prompt().body

    async def _review_one(i: int, cand_text: str):
        try:
            rvars = {**vars_ctx, "candidate": cand_text}
            raw, _ = await provider.complete(review_prompt, rvars, 1.0, system=system)
            return i, _parse_review(raw)
        except Exception as e:
            return i, ReviewResult(raw=f"审核失败：{e}")

    r_tasks = [asyncio.create_task(_review_one(i, ct)) for i, ct in enumerate(candidates_text)]
    reviews: list[ReviewResult | None] = [None] * len(candidates_text)
    r_done = 0
    r_total = len(candidates_text)
    for t in asyncio.as_completed(r_tasks):
        i, res = await t
        reviews[i] = res
        r_done += 1
        yield {"type": "review_progress", "done": r_done, "total": r_total}

    candidates = [
        {"slot": candidates_slot[i], "text": candidates_text[i], "style": candidates_style[i],
         "review": (reviews[i] or ReviewResult()).to_dict(),
         "prompts": _extract_prompts(candidates_msgs[i])}
        for i in range(len(candidates_text))
    ]

    log_generation("generate", gen_input.provider_name, gen_input.input_vars, candidates_text,
                   "\n---\n".join(r.raw for r in reviews if r))
    log_operation("pipeline", "generate", 0, 0, "done")
    yield {"type": "done", "candidates": candidates, "failures": failures}


async def re_review(text: str, input_vars: dict, selections: dict, provider: LLMProvider) -> ReviewResult:
    """单份候选重审，返回该份审核结果。"""
    vars_ctx = _build_vars_ctx(input_vars, selections)
    system = _system_or_none()
    review_prompt = get_review_prompt().body
    rvars = {**vars_ctx, "candidate": text}
    raw, _ = await provider.complete(review_prompt, rvars, 1.0, system=system)
    log_generation("re_review", provider.cfg.name, input_vars, [text], raw)
    return _parse_review(raw)


async def generate_one(slot_no: int, input_vars: dict, selections: dict, provider: LLMProvider) -> dict:
    """单槽位重新生成 + 自动审核，返回与 run() done 事件中单个 candidate 同形的 dict。

    供前端「重新生成」调用：为一个风格槽位产出一版新候选（含审核），
    前端把它作为该槽位的新版本追加，并支持版本间左右切换对比。
    """
    vars_ctx = _build_vars_ctx(input_vars, selections)
    system = _system_or_none()
    sl = next((s for s in list_slots() if s.slot == slot_no), None)
    if sl is None:
        raise KeyError(f"slot {slot_no} not found")
    style_name = sl.name or f"风格 {sl.slot}"
    text, messages = await provider.complete(sl.body, vars_ctx, 1.0, system=system)
    review_prompt = get_review_prompt().body
    rvars = {**vars_ctx, "candidate": text}
    raw, _ = await provider.complete(review_prompt, rvars, 1.0, system=system)
    review = _parse_review(raw)
    log_generation("generate_one", provider.cfg.name, input_vars, [text], raw)
    return {"slot": sl.slot, "style": style_name, "text": text,
            "review": review.to_dict(), "prompts": _extract_prompts(messages)}
