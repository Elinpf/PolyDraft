# PolyDraft

> AI 文案生成流水线 —— 多风格并行生成 · 独立审核 · 定稿留存

面向内部内容运营的 **AI 文案生成流水线** WebUI：通过 OpenAI 兼容接口接入大模型，并行生成多风格文案，再由独立审核环节打分，最终人工定稿留存。

适合需要批量产出品牌私域文案、且希望对生成结果做结构化质量把关的团队。

---

## 它能做什么

整体是一条流水线：

```
输入变量 → 并行生成多风格候选 → 每份独立审核(打分+三维度意见) → 编辑/重审 → 定稿留存
```

- **多风格并行生成**：预置多个"文案风格"槽位（如 官方版 / 亲切版 / 闺蜜版），并发调用模型一次产出多版文案，失败容忍（某风格挂了不影响其他）。
- **独立审核**：每份候选单独调一次模型做审核，给出综合打分（0-100）+ 正向亲和 / 反向亲和 / 产品知识准确性 三维度意见，供人判断。
- **可编辑 + 重审**：候选文案可手动编辑，改完单份重新审核。
- **定稿留存**：选中的文案定稿入库，保留编辑后文本、审核结果、输入变量快照。
- **可配置提示词**：系统提示词 / 审核提示词 / 各风格槽位模板全可在 WebUI 编辑。
- **选项维度 + 变量系统**：用选项维度（产品系列 / 段位 / 文案类型 等）驱动模板变量，支持自定义变量。
- **产品知识库**：按产品系列维护知识文本，生成时自动注入 system prompt。
- **SSE 流式进度**：生成/审核进度实时推到前端。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.12+ · FastAPI · uvicorn · SQLite |
| 前端 | React + TypeScript · Vite |
| 模型接入 | OpenAI Python SDK（兼容任意 OpenAI 协议端点） |
| 数据存储 | 单文件 SQLite（`copygen.db`），配置与业务数据同库 |

模型不绑定特定厂商：只要是 OpenAI 兼容的 `/v1/chat/completions` 端点都能接（Kimi、vLLM、智谱 GLM、本地 Ollama 等）。

---

## 项目结构

```
atm/
├── backend/
│   ├── app.py              # FastAPI 入口 + 路由（30 个）
│   ├── pipeline.py         # 生成/审核流水线（async generator + SSE 事件）
│   ├── providers.py        # 模型接入层（AsyncOpenAI 客户端 + 配置 CRUD）
│   ├── store.py            # 数据层 CRUD + init_store 编排 + dataclass
│   ├── prompts.py           # 提示词模板与 seed 常量
│   ├── migrations.py       # 一次性数据库迁移函数
│   ├── review.py           # 审核结果字段真相源（ReviewFields）
│   ├── db.py               # SQLite 连接器 + 日志表 schema
│   ├── log_store.py        # 调用日志（call_logs）/ 操作日志落库
│   ├── logging_config.py   # 日志配置
│   └── middleware.py       # 请求日志中间件
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # 路由 + 常驻挂载渲染
│   │   ├── types.ts        # 跨页类型
│   │   └── pages/          # 7 个页面（generate/slots/options/knowledge/history/config/docs）
│   ├── vite.config.ts      # dev 代理 /api → 后端 8099
│   └── package.json
├── copygen.db              # SQLite 数据文件（运行时生成，gitignore）
├── requirements.txt        # Python 依赖
└── docs/                   # 文档
```

---

## 部署

### 前置要求

- Python **3.12+**
- Node.js **20+**（npm 10+）
- 一个 OpenAI 兼容的模型端点（自建或商用）

### 1. 克隆

```bash
git clone <repo-url> atm
cd atm
```

### 2. 后端

```bash
# 建议用虚拟环境
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

### 3. 前端

```bash
cd frontend
npm install
cd ..
```

### 4. 配置模型

启动后端后，数据库会自动初始化并 seed 两个默认 provider（`kimi` / `custom`，api_key 为空需填）。两种方式配置：

**方式 A：WebUI 配置**（推荐）—— 启动后到「模型配置」页填写 base_url / api_key / model 并测试连通。

**方式 B：直接命令行**（适合脚本化）：

```bash
curl -X POST http://localhost:8099/providers \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "custom",
    "base_url": "https://your-endpoint/v1",
    "api_key": "sk-xxx",
    "model": "your-model-name"
  }'
```

| provider 名 | 用途 |
|-------------|------|
| `kimi` | 接 Kimimi / Kimi for coding 等官方端点 |
| `custom` | 任意自建或第三方 OpenAI 兼容端点（vLLM / GLM / Ollama 等） |

### 5. 运行（开发模式）

两个进程分别开：

```bash
# 终端 1：后端（默认 8099）
python -m uvicorn backend.app:app --port 8099 --reload

# 终端 2：前端（默认 5173）
cd frontend
npm run dev
```

浏览器打开 **http://localhost:5173** 即可。前端 dev server 已配置代理，`/api`、`/providers`、`/generate` 等请求会转发到 `http://localhost:8099`。

> 首次启动会自动建表并写入默认风格槽位、提示词、选项维度、产品知识 seed。

### 6. 生产构建

```bash
# 前端构建产物
cd frontend && npm run build      # 产出 frontend/dist
```

构建后由任意静态服务器或反向代理托管 `dist/`，并把 API 路径反代到后端 uvicorn。后端用：

```bash
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8099
```

单机单人场景下，前端 dist 也可由 FastAPI 托管（额外加一行 StaticFiles 挂载即可），实现单进程部署。

---

## 使用流程

1. **模型配置**：填好 `kimi` / `custom` 的 endpoint + key + model，点「测试连通」。
2. **文案风格**（可选）：维护生成槽位，每个槽位是一段含 `{变量}` 占位的 prompt 模板。
3. **选项配置**（可选）：维护维度（产品系列 / 段位 / 文案类型 等）及其选项。`prompt` 类维度的选项可带 prompt 片段，会注入 `{维度名提示词}` 变量。
4. **产品知识**（可选）：按产品系列维护知识文本，生成时通过 `{产品知识}` 注入。
5. **生成**：选模型、填品牌等补充输入、勾选维度并选值 → 生成。并行产出多风格候选 + 每份独立审核。
6. **编辑/重审/定稿**：编辑候选后可单份重审，满意的逐份定稿留存。
7. **历史**：查看过往定稿。

---

## 数据与备份

- 所有数据在 `copygen.db`（SQLite 单文件），包含 provider 配置（**含 api_key 明文**）、提示词、维度、产品知识、定稿记录、调用日志。
- **备份**：直接复制 `copygen.db` 即可。
- **敏感信息**：`copygen.db` 不入库（`.gitignore` 已排除）；provider 的 api_key 明文存储，适合单机单人部署，**勿用于公网多用户场景**。

---

## 开发说明

- 后端无 Web 框架脚手架，纯 FastAPI 路由 + 函数式数据层；数据库迁移为一次性函数（`backend/migrations.py`），启动时由 `init_store` 幂等执行。
- 前端页面常驻挂载（`display` 切换不卸载），保留生成页 SSE reader 与表单状态，切 tab 不丢。
- 项目用 OpenSpec 管理变更（`openspec/changes/`），架构决策记录在 `docs/adr/`。
- 域名语言见 `CLAUDE.md` / `docs/agents/`。

## License

Copyright (C) 2026 PolyDraft contributors.

本项目基于 **[GNU AGPL-3.0](./LICENSE)** 发布。

- 你可以自由使用、修改、分发本项目。
- **如果你修改后通过网络对外提供服务**（例如部署成 SaaS 让他人使用），必须以 AGPL-3.0 开源你修改后的完整源码——这是 AGPL 相比 GPL 的核心条款（section 13）。
- 个人自用、组织内部使用不对外提供服务，则无需开源任何东西。

简言之：欢迎使用与改进，但拿去包一层对外卖服务时，请同样开源你的修改。
