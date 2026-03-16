# Data Model

## 1. Purpose

定义第一版 demo 的核心实体、字段、约束关系和本地存储结构。

## 2. Scope

覆盖：

- 项目类型
- 具体项目
- 任务记录
- 本地存储结构
- 关键状态迁移

不覆盖：

- 服务器模型
- 多端同步冲突
- 权限体系

## 3. Entities

### 3.1 ProjectType

表示一级分类。

建议字段：

```ts
type ProjectType = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
```

约束：

- `name` 在有效类型中应唯一

### 3.2 Project

表示可直接点击开始的具体项目。

```ts
type Actor = "self" | "agent"

type Project = {
  id: string
  typeId: string
  name: string
  actor: Actor
  archived: boolean
  usageCount: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}
```

约束：

- 必须属于某个 `ProjectType`
- `actor` 固定绑定在项目上
- 归档后不能再开始新任务

### 3.3 Session

表示一次任务记录。

```ts
type Session = {
  id: string
  projectId: string
  startAt: string
  endAt: string | null
  note: string
  createdAt: string
  updatedAt: string
}
```

约束：

- `startAt` 必填
- `endAt` 可为空，表示进行中
- `endAt` 不得早于 `startAt`

## 4. Derived Data

以下数据不一定单独持久化，也可以运行时计算：

- 当前本人任务
- 当前运行中的 Agent 任务列表
- 项目类型分布
- 日 / 周 / 月统计
- 首页排序结果

第一版如果为了 demo 性能和简单性，也允许保留这些轻量冗余字段：

- `Project.usageCount`
- `Project.lastUsedAt`

## 5. Local Storage Schema

建议本地存储统一挂在一个 key 下：

```ts
type AppState = {
  projectTypes: ProjectType[]
  projects: Project[]
  sessions: Session[]
}
```

建议 key：

```txt
time-ledger-mobile-demo-v1
```

## 6. State Rules

### 6.1 启动本人项目

输入：

- `projectId`

前置条件：

- 项目存在
- 项目未归档
- 项目执行主体为 `self`

状态变化：

1. 查找当前未结束的本人任务
2. 自动将其 `endAt` 设为当前时间
3. 创建新 `Session`

### 6.2 启动 Agent 项目

输入：

- `projectId`

前置条件：

- 项目存在
- 项目未归档
- 项目执行主体为 `agent`

状态变化：

1. 不影响当前本人任务
2. 直接创建新 `Session`

### 6.3 停止任务

输入：

- `sessionId`

状态变化：

- 将该记录的 `endAt` 写为当前时间

### 6.4 修改历史记录

允许更新：

- `startAt`
- `endAt`
- `note`

更新后应重新参与所有统计计算。

### 6.5 归档具体项目

状态变化：

- `project.archived = true`

副作用：

- 首页不再展示
- 不能再开始新任务
- 历史记录保留

### 6.6 修改具体项目归属

允许更新：

- `typeId`

结果：

- 历史记录通过 `projectId` 关联读取时，会自动显示新项目类型

## 7. Query Rules

### 7.1 首页项目列表

过滤：

- 只展示未归档项目
- 支持按名称搜索

排序模式：

- `recent`
  - 按 `lastUsedAt` 倒序
  - 相同时按 `usageCount` 倒序
- `frequent`
  - 按 `usageCount` 倒序
  - 相同时按 `lastUsedAt` 倒序

### 7.2 当前任务查询

- 当前本人任务：未结束且关联项目的 `actor = self`
- 当前 Agent 任务：未结束且关联项目的 `actor = agent`

### 7.3 历史排序

支持：

- `desc`
- `asc`
- `duration`

## 8. Statistics Rules

### 8.1 本人时间

只统计 `actor = self` 的已结束记录。

### 8.2 Agent 时间

只统计 `actor = agent` 的已结束记录。

### 8.3 日 / 周 / 月

以记录 `startAt` 所在日期归属统计周期。

## 9. Validation Rules

- 项目类型名称不可为空
- 具体项目名称不可为空
- 新建具体项目时必须选择项目类型
- 新建具体项目时必须指定执行主体
- 结束时间不能早于开始时间
- 有未归档具体项目的项目类型不可删除

## 10. Open Questions

- 后续是否需要给 Session 增加标签、结果、附件字段，第一版暂不处理

## 11. Change Log

- 2026-03-16: 建立第一版数据模型文档
