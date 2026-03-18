# 柳比歇夫时间记录 Demo

一个手机优先、以本地优先为核心的时间记录产品原型。

当前仓库已经不只是静态 demo：

- 前端原型位于 `demo/`
- 本地 agent API 位于 `backend/`
- localhost 下前端会尝试把当前状态同步到本地 API

## 文档索引

- `docs/product-spec.md`: 第一版产品目标、规则和边界
- `docs/data-model.md`: 实体、字段、本地存储结构、状态规则
- `docs/information-architecture.md`: 页面结构和交互入口
- `docs/agent-api-plan.md`: agent 可调用本地 API 的第一阶段方案
- `docs/tasks.md`: 当前任务拆分和多终端分工
- `docs/multi-terminal-workflow.md`: 主会话加辅助终端的协作说明
- `docs/terminal-d-lead.md`: 总负责人角色的职责和工作方式

## 当前闭环

- 首页直接展示具体项目，支持搜索、最近使用、最常使用
- 点击具体项目立即开始
- `本人` 项目会自动结束上一个本人任务再开始新的
- `Agent` 项目可与本人任务并行运行
- 历史记录支持按时间正序、倒序、耗时排序，并原地补备注、改开始/结束时间
- 仪表盘已切到工时盈余 / 负债逻辑，并支持趋势图交互
- `我` 页面支持折叠式管理项目类型、具体项目和仪表盘参数
- 数据持久化在 `localStorage`
- 已补第一阶段本地 agent API，可直接查项目、查运行中任务、开始任务、停止任务、改记录
- 已补基础 PWA 能力：第一次联网打开后可离线继续使用

## 启动

### 启动前端

可以直接打开 `demo/index.html`，也可以在仓库根目录运行：

```bash
python3 -m http.server 8010
```

然后访问：

```txt
http://127.0.0.1:8010/demo/
```

### 启动本地 agent API

```bash
python3 backend/server.py
```

默认地址：

```txt
http://127.0.0.1:8787
```

## 当前本地 API 能力

当前第一阶段已经可用的接口：

- `GET /api/health`
- `GET /api/state`
- `POST /api/state/import`
- `GET /api/projects`
- `GET /api/sessions`
- `GET /api/running`
- `POST /api/sessions/start`
- `POST /api/sessions/stop`
- `PATCH /api/sessions/:id`

详细说明见：

- `docs/agent-api-plan.md`

## 本地联动说明

- localhost 下前端启动时，会尝试从本地 agent API 拉最新状态
- 前端本地保存状态时，也会尝试把当前状态同步回 agent API
- 当前这层同步还是第一阶段桥接，不是完整双向实时同步系统

## 当前限制

1. 还没有云同步或登录。
2. 还没有推送提醒、桌面组件、通知栏控制。
3. 项目删除目前按“归档”处理，保留历史记录。
4. agent API 目前还是第一阶段，前端主数据源仍以 `localStorage` 为主，不是完全 API-first。
