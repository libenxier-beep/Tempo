# Agent API Plan

## 目标

先给 Tempo 补一层最小本地 API，让 agent 不用点 UI，也能直接：

- 查项目
- 查当前运行中的任务
- 开始任务
- 停止任务
- 修改一条记录

第一阶段不直接改前端主数据源，先把 agent 调用链单独跑通。当前已经进入“第一阶段补强版”。

## 方案

- 运行方式：`python3 backend/server.py`
- 地址：`http://127.0.0.1:8787`
- 技术选型：Python 标准库 HTTP 服务 + 本地 JSON 持久化
- 持久化文件：`backend/state.json`

## 当前接口

### `GET /api/health`

健康检查。

### `GET /api/state`

返回完整状态，便于调试。

### `GET /api/project-types`

查询全部项目类型。

### `POST /api/state/import`

把一整份应用状态导入到 agent API。

请求体：

```json
{
  "state": {
    "version": 1,
    "updatedAt": "...",
    "profile": {},
    "dashboardSettings": {},
    "projectTypes": [],
    "projects": [],
    "sessions": []
  }
}
```

用途：

- 让当前前端本地状态同步到 agent API
- 作为后续前后端打通的最小桥接接口

### `GET /api/projects`

查询全部项目。

可选参数：

- `archived=true|false`

返回结果会补上所属 `projectType`，便于 agent 直接使用。

### `POST /api/project-types`

创建一个新的项目类型。

请求体：

```json
{
  "name": "工作"
}
```

### `POST /api/projects`

创建一个新的具体项目。

请求体：

```json
{
  "name": "产品设计",
  "typeId": "...",
  "actor": "self"
}
```

### `GET /api/sessions`

查询全部记录。

可选参数：

- `status=all|running|completed`

### `GET /api/running`

查询当前运行中的全部任务。

### `GET /api/dashboard/summary`

返回轻量仪表盘摘要，当前包含：

- 项目类型数
- 项目总数
- 活跃项目数
- 运行中任务数
- 已完成记录数
- 累计已记录小时数
- 当前仪表盘设置

### `POST /api/sessions/start`

开始一个任务。

请求体：

```json
{
  "projectId": "..."
}
```

规则：

- 本人任务会自动结束上一个本人任务
- Agent 任务允许并行

### `POST /api/sessions/stop`

停止一个进行中的任务。

请求体：

```json
{
  "sessionId": "..."
}
```

### `PATCH /api/sessions/:id`

修改一条记录的开始时间、结束时间、备注。

请求体示例：

```json
{
  "startAt": "2026-03-18T01:00:00+00:00",
  "endAt": "2026-03-18T02:00:00+00:00",
  "note": "补充说明"
}
```

### `PATCH /api/dashboard/settings`

修改仪表盘相关设置。

请求体示例：

```json
{
  "dailyTargetHours": 8,
  "hourlyRate": 120,
  "debtStartDate": "2026-03-18"
}
```

## 下一阶段

下一阶段，再做这两件事：

1. 把前端从 `localStorage` 逐步切到这层 API
2. 再包一层 agent 工具协议，例如 MCP 或固定工具函数
