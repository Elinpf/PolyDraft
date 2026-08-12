# Tasks: 并行多风格 + 审查

## 1. 后端数据层扩展

- [x] 1.1 `store.py`：`generate_slots` 支持多行存取（list/save/delete slot）
- [x] 1.2 `store.py`：`review_prompt` 单例表存取
- [x] 1.3 startup 写入多槽位默认占位 + 审查 prompt 默认

## 2. 后端流水线

- [x] 2.1 `pipeline.py`：并行生成（每槽位各跑，带各自 temperature）
- [x] 2.2 `pipeline.py`：审查阶段（候选拼接 `{candidates}`，调审查 prompt）
- [x] 2.3 `pipeline.py`：`re_review()` 仅重跑审查
- [x] 2.4 失败容忍：异常槽位过滤，全部失败报错
- [x] 2.5 `gen_records` 记录多候选 + review

## 3. 后端路由

- [x] 3.1 `GET/POST/DELETE /slots` 槽位管理
- [x] 3.2 `GET/POST /prompts/review` 审查 prompt
- [x] 3.3 `POST /re-review` 单独重跑审查

## 4. 前端槽位管理页

- [x] 4.1 槽位列表 + 增删改 prompt/temperature
- [x] 4.2 审查 prompt 编辑区

## 5. 前端输出页扩展

- [x] 5.1 多候选选择器 + 切换查看
- [x] 5.2 审查意见块（综合意见 + 每份简评）
- [x] 5.3 `/re-review` 入口占位（功能在 Change 3 接通交互）

## 6. 验证

- [x] 6.1 多槽位生成，返回多份风格不同的候选 + 审查意见
- [x] 6.2 某槽位失败时仍返回其余候选
- [x] 6.3 `/re-review` 只更新 review，候选不变
- [x] 6.4 `gen_records` 记录多候选与 review
