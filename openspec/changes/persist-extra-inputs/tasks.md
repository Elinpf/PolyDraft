## 1. 后端表 + CRUD

- [x] 1.1 `backend/store.py` SCHEMA 加 `extra_inputs` 单行表（id=1, body JSON）
- [x] 1.2 `get_extra_inputs() -> dict`、`save_extra_inputs(data: dict)` CRUD
- [x] 1.3 `_seed_extra_inputs()`：表空时插 {'品牌':'爱他美'}
- [x] 1.4 `init_store` 调用 seed

## 2. 后端 API

- [x] 2.1 `backend/app.py`：`GET /extra-inputs` 返回 dict
- [x] 2.2 `POST /extra-inputs`（body=JSON dict）整体覆盖写，返回 {ok:true}

## 3. 前端 logic

- [x] 3.1 `useGenerateLogic`：extraInputs 改为 async fetch `/extra-inputs` 初始化
- [x] 3.2 变化 debounce 500ms POST 保存（不再写 localStorage）
- [x] 3.3 localStorage 迁移：后端空时读 localStorage 上传，迁移后清 localStorage
- [x] 3.4 删除旧的 localStorage useEffect 持久化逻辑
- [x] 3.5 vite.config.ts 加 `/extra-inputs` proxy（需重启 vite 生效）

## 4. 验证

- [x] 4.1 tsc --noEmit 通过
- [x] 4.2 后端 import 冒烟 + GET/POST /extra-inputs 通（seed + 读写）
- [ ] 4.3 编辑补充输入 → 刷新页面 → 保留（待 vite 重启后浏览器验证）
- [ ] 4.4 localStorage 旧数据迁移到后端（待浏览器验证）
- [ ] 4.5 默认 seed {'品牌':'爱他美'}（已验证后端 seed）
