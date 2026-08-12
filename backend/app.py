"""FastAPI 应用入口。"""
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .logging_config import setup_logging
from .db import init_db
from .middleware import RequestLoggingMiddleware
from .providers import (init_providers, list_providers, save_provider, get_provider,
                       LLMProvider, ProviderConfig)
from .store import (init_store, list_slots, save_slot, delete_slot,
                    get_review_prompt, save_review_prompt, GenSlot,
                    get_system_prompt, save_system_prompt,
                    save_finalized, list_finalized, delete_finalized, Finalized,
                    list_dimensions, get_dimension, save_dimension, update_dimension,
                    delete_dimension, list_choices, save_choice, update_choice,
                    delete_choice, OptionDimension, OptionChoice,
                    list_product_knowledge, save_product_knowledge,
                    delete_product_knowledge, ProductKnowledge)
from .pipeline import GenerateInput, run, re_review
setup_logging()
init_db()
init_providers()
init_store()

app = FastAPI(title="CopyGen Pipeline")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RequestLoggingMiddleware)


@app.get("/health")
async def health():
    return {"ok": True}


# --- providers ---

@app.get("/providers")
async def list_all_providers():
    return [p.__dict__ for p in list_providers()]


@app.post("/providers")
async def save_prov(cfg: ProviderConfig):
    save_provider(cfg)
    return {"ok": True}


@app.post("/providers/{name}/test")
async def test_conn(name: str):
    cfg = get_provider(name)
    if not cfg:
        raise HTTPException(404, f"provider {name} not configured")
    ok = await LLMProvider(cfg).ping()
    return {"ok": ok}


# --- slots (generate 风格槽位) ---
@app.get("/slots")
async def get_slots():
    return [s.__dict__ for s in list_slots()]


@app.post("/slots")
async def add_slot(s: GenSlot):
    save_slot(s.slot, s.body, s.temperature)
    return {"ok": True}


@app.delete("/slots/{slot}")
async def del_slot(slot: int):
    delete_slot(slot)
    return {"ok": True}


# --- review prompt ---
@app.get("/prompts/review")
async def get_rev():
    return get_review_prompt().__dict__


@app.post("/prompts/review")
async def save_rev(body: str):
    save_review_prompt(body)
    return {"ok": True}


# --- system prompt ---

@app.get("/prompts/system")
async def get_sys():
    return get_system_prompt().__dict__


@app.post("/prompts/system")
async def save_sys(body: str):
    save_system_prompt(body)
    return {"ok": True}


# --- 选项维度 (Change A) ---

@app.get("/dimensions")
async def get_dims():
    """列出所有维度及其选项。"""
    out = []
    for d in list_dimensions():
        out.append({**d.__dict__, "choices": [c.__dict__ for c in list_choices(d.id)]})
    return out


class DimensionInput(BaseModel):
    name: str
    kind: str = "value"   # 'value' | 'prompt'


@app.post("/dimensions")
async def add_dim(dim: DimensionInput):
    try:
        dim_id = save_dimension(dim.name, dim.kind)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "id": dim_id}


@app.put("/dimensions/{dim_id}")
async def upd_dim(dim_id: int, dim: DimensionInput):
    try:
        update_dimension(dim_id, dim.name, dim.kind)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.delete("/dimensions/{dim_id}")
async def del_dim(dim_id: int):
    delete_dimension(dim_id)
    return {"ok": True}


class ChoiceInput(BaseModel):
    label: str
    value: str = ""
    prompt_fragment: str = ""


@app.post("/dimensions/{dim_id}/choices")
async def add_choice(dim_id: int, ch: ChoiceInput):
    if not get_dimension(dim_id):
        raise HTTPException(404, "维度不存在")
    try:
        cid = save_choice(dim_id, ch.label, ch.value, ch.prompt_fragment)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "id": cid}


@app.put("/choices/{choice_id}")
async def upd_choice(choice_id: int, ch: ChoiceInput):
    try:
        update_choice(choice_id, ch.label, ch.value, ch.prompt_fragment)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.delete("/choices/{choice_id}")
async def del_choice(choice_id: int):
    delete_choice(choice_id)
    return {"ok": True}


# --- 产品知识 (Change B) ---

@app.get("/product-knowledge")
async def list_pk():
    return [p.__dict__ for p in list_product_knowledge()]


class ProductKnowledgeInput(BaseModel):
    series: str
    body: str = ""


@app.post("/product-knowledge")
async def save_pk(pk: ProductKnowledgeInput):
    try:
        save_product_knowledge(pk.series, pk.body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.delete("/product-knowledge/{series}")
async def del_pk(series: str):
    delete_product_knowledge(series)
    return {"ok": True}


# --- pipeline ---

@app.post("/generate")
async def generate(gen_input: GenerateInput):
    """SSE：逐事件推送流水线进度。"""
    cfg = get_provider(gen_input.provider_name)
    if not cfg:
        raise HTTPException(400, f"provider {gen_input.provider_name} not configured")

    async def event_stream():
        try:
            async for evt in run(gen_input, LLMProvider(cfg)):
                yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'done', 'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class ReReviewInput(BaseModel):
    text: str
    input_vars: dict = {}
    selections: dict = {}
    provider_name: str = "kimi"


@app.post("/re-review")
async def re_review_endpoint(req: ReReviewInput):
    cfg = get_provider(req.provider_name)
    if not cfg:
        raise HTTPException(400, f"provider {req.provider_name} not configured")
    try:
        result = await re_review(req.text, req.input_vars, req.selections, LLMProvider(cfg))
    except Exception as e:
        raise HTTPException(400, f"review failed: {e}")
    return {"review": result.to_dict()}


# --- 定稿留存 (finalized) ---

class FinalizeInput(BaseModel):
    provider: str
    input_vars: dict
    selected_idx: int
    text: str
    review: str = ""
    score: int | None = None
    positive: str = ""
    reverse: str = ""
    accuracy: str = ""


@app.get("/finalized")
async def list_fin():
    return [f.__dict__ for f in list_finalized()]


@app.post("/finalized")
async def save_fin(fin: FinalizeInput):
    fid = save_finalized(fin.provider, fin.input_vars, fin.selected_idx, fin.text,
                         fin.review, fin.score, fin.positive, fin.reverse, fin.accuracy)
    return {"ok": True, "id": fid}


@app.delete("/finalized/{fid}")
async def del_fin(fid: int):
    delete_finalized(fid)
    return {"ok": True}
