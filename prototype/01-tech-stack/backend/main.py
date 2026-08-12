"""FastAPI 入口 — prototype 骨架。

暴露：
- GET  /providers            列出已配置供应商
- POST /providers             新增/更新供应商配置（含 api_key）
- POST /providers/{name}/test 测试连通性
- GET  /variables             列出全局变量
- POST /variables             新增/更新全局变量
- DELETE /variables/{name}    删除全局变量
- GET  /prompts/{key}         取生成/审查提示词
- POST /prompts/{key}         存生成/审查提示词
- POST /generate              触发流水线（SSE 流式进度）
- POST /re-review             单独重跑审查（复用已有候选）
"""
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from .providers import LLMProvider, ProviderConfig, init_db, save_provider, get_provider, list_providers
from .store import (init_store, list_variables, save_variable, delete_variable,
                    get_review_prompt, save_review_prompt,
                    list_slots, save_slot, delete_slot,
                    Variable, ReviewPrompt, GenSlot)
from .pipeline import GenerateInput, run, re_review

app = FastAPI()


@app.on_event("startup")
def _startup():
    init_db()
    init_store()


@app.get("/providers")
async def list_all():
    return [p.__dict__ for p in list_providers()]


@app.post("/providers")
async def save(cfg: ProviderConfig):
    save_provider(cfg)
    return {"ok": True}


@app.post("/providers/{name}/test")
async def test_conn(name: str):
    cfg = get_provider(name)
    if not cfg:
        raise HTTPException(404, f"provider {name} not configured")
    ok = await LLMProvider(cfg).ping()
    return {"ok": ok}


@app.get("/variables")
async def list_vars():
    return [v.__dict__ for v in list_variables()]


@app.get("/variables/known")
async def known_vars():
    """供前端校验：全局变量名 + 系统保留名。输入变量名由前端表单自管。"""
    from .store import SYSTEM_VARS
    names = [v.name for v in list_variables()] + list(SYSTEM_VARS)
    return {"names": names}


@app.post("/variables")
async def save_var(v: Variable):
    try:
        save_variable(v.name, v.value)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.delete("/variables/{name}")
async def del_var(name: str):
    delete_variable(name)
    return {"ok": True}


@app.get("/prompts/review")
async def get_rev():
    return get_review_prompt().__dict__


@app.post("/prompts/review")
async def save_rev(body: str):
    save_review_prompt(body)
    return {"ok": True}


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


@app.post("/generate")
async def generate(gen_input: GenerateInput):
    """SSE：逐事件推送流水线进度。前端 EventSource 消费。"""
    cfg = get_provider(gen_input.provider_name)
    if not cfg:
        raise HTTPException(400, f"provider {gen_input.provider_name} not configured")

    async def event_stream():
        async for evt in run(gen_input, LLMProvider(cfg)):
            yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/re-review")
async def re_review_endpoint(drafts: list[str], input_vars: dict, provider_name: str = "kimi"):
    """单独重跑审查（issues/03），复用已有候选。"""
    cfg = get_provider(provider_name)
    if not cfg:
        raise HTTPException(400, f"provider {provider_name} not configured")
    result = await re_review(drafts, input_vars, LLMProvider(cfg))
    return {"drafts": result.drafts, "review": result.review}
