# Tasks: 最窄垂直切片——单风格直通

## 1. 后端 provider 接入层

- [x] 1.1 创建 `backend/providers.py`：`ProviderConfig` + `LLMProvider`（OpenAI 兼容客户端，`complete`/`ping`）
- [x] 1.2 provider 持久化：`providers` 表存取函数，启动写 kimi/vllm 默认占位
- [x] 1.3 `LLMProvider.complete` 与 `ping` 写入 `call_logs`（成功/失败/耗时/错误）

## 2. 后端生成

- [x] 2.1 创建 `backend/store.py`：`generate_slots` 表 + 一条默认槽位
- [x] 2.2 创建 `backend/pipeline.py`：单步生成（调 provider.complete，渲染 {var}）
- [x] 2.3 `/generate` 路由：同步返回单条结果，写入 `gen_records`

## 3. 后端路由整合

- [x] 3.1 `backend/main.py`：`GET/POST /providers`、`POST /providers/{name}/test`、`POST /generate`
- [x] 3.2 startup 钩子调用 providers 与 slots 的 init

## 4. 前端配置页

- [x] 4.1 provider 配置页组件：列表展示 + 编辑表单 + 保存
- [x] 4.2 「测试」按钮：调测试 API，显示加载态与结果

## 5. 前端生成页

- [x] 5.1 生成页组件：输入变量表单 + provider 选择 + 触发按钮
- [x] 5.2 结果展示区 + 复制按钮 + 错误提示

## 6. 验证

- [x] 6.1 配置 kimi key，测试连通返回 ok
- [x] 6.2 触发生成，前端展示文案，`call_logs`/`gen_records` 各有记录
- [x] 6.3 连通性失败时返回 ok=false 且日志有记录
