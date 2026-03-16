# Data Model

## 1. Purpose

定义第一版 demo 的核心实体、字段、约束关系、本地存储结构、状态流转、查询排序和统计口径。

## 2. Scope

覆盖：

- 项目类型
- 具体项目
- 任务记录
- 本地存储结构
- 关键状态迁移
- 统计口径
- 排序规则

不覆盖：

- 服务器模型
- 多端同步冲突
- 权限体系
- 云同步
- 账号体系

## 3. Entities

### 3.1 ProjectType

表示一级分类。

建议字段：

```ts
type ProjectType = {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

约束：

- `id` 必须全局唯一，创建后不可修改
- `name` 去除首尾空白后不可为空
- `name` 在全部项目类型中唯一，按原始字符串比较
- `sortOrder` 为整数，数值越小越靠前
- `createdAt`、`updatedAt` 为 ISO 8601 时间字符串
- `updatedAt` 不得早于 `createdAt`

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
  archivedAt: string | null
  usageCount: number
  lastUsedAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

约束：

- `id` 必须全局唯一，创建后不可修改
- `typeId` 必须指向一个存在的 `ProjectType.id`
- `name` 去除首尾空白后不可为空
- `name` 在同一 `typeId` 下应唯一，第一版不要求跨类型唯一
- `actor` 枚举值只能是 `self | agent`
- `actor` 固定绑定在项目上；第一版不支持修改历史记录的执行主体
- `archived = true` 时，`archivedAt` 必须有值；否则必须为 `null`
- `usageCount` 为大于等于 `0` 的整数
- `lastUsedAt` 为空表示从未启动过
- `sortOrder` 为整数，数值越小越靠前
- `updatedAt` 不得早于 `createdAt`
- 归档后不能再开始新任务，但历史记录继续保留并可编辑
- 允许修改 `typeId`、`name`，修改后历史读取结果同步反映最新项目信息

### 3.3 Session

表示一次任务记录。

```ts
type Session = {
  id: string
  projectId: string
  startAt: string
  endAt: string | null
  note: string
  durationMs: number | null
  createdAt: string
  updatedAt: string
}
```

约束：

- `id` 必须全局唯一，创建后不可修改
- `projectId` 必须指向一个存在的 `Project.id`
- `startAt` 必填，为 ISO 8601 时间字符串
- `endAt` 可为空，表示进行中
- `endAt` 不得早于 `startAt`
- `note` 为普通文本，允许空字符串
- `durationMs` 为冗余字段：`endAt = null` 时必须为 `null`，`endAt` 有值时等于 `endAt - startAt`
- `createdAt`、`updatedAt` 为记录自身的创建和最后编辑时间，不等同于任务开始或结束时间
- `updatedAt` 不得早于 `createdAt`
- 同一时刻最多只允许一个 `actor = self` 的进行中记录
- `actor = agent` 的进行中记录允许并行多个

## 4. Referential Rules

- 不允许存在悬空引用：
  - `Project.typeId` 必须命中已有项目类型
  - `Session.projectId` 必须命中已有具体项目
- 删除项目类型前，必须保证其下没有任何具体项目，包括已归档项目
- 具体项目不做物理删除，第一版统一使用归档
- 历史记录读取项目名、项目类型、执行主体时，以当前 `Project` / `ProjectType` 实体为准，不做名称快照

## 5. Derived Data

以下数据不一定单独持久化，也可以运行时计算：

- 当前本人任务
- 当前运行中的 Agent 任务列表
- 项目类型分布
- 日 / 周 / 月统计
- 首页排序结果

第一版允许保留以下轻量冗余字段，以减少每次启动时的扫描成本：

- `Project.usageCount`
- `Project.lastUsedAt`
- `Session.durationMs`

冗余字段一致性要求：

- 每次创建新 `Session` 时，成功启动的项目 `usageCount += 1`
- 每次创建新 `Session` 时，成功启动的项目 `lastUsedAt = session.startAt`
- 每次结束或编辑 `Session` 时，若 `endAt` 有值则重算 `durationMs`
- 发现冗余字段与源字段冲突时，以可推导的源字段为准并重算

## 6. Local Storage Schema

建议本地存储统一挂在一个 key 下，避免多 key 分裂导致迁移复杂：

```ts
type AppState = {
  version: 1
  updatedAt: string
  projectTypes: ProjectType[]
  projects: Project[]
  sessions: Session[]
}
```

建议 key：

```txt
time-ledger-mobile-demo-v1
```

字段说明：

- `version` 用于后续本地 schema 升级
- `updatedAt` 表示最近一次成功写入本地存储的时间
- 第一版不新增单独的 `currentSessionId`、`statsCache`、`searchIndex` 等派生缓存字段，避免双写复杂度

对当前产品规则的支撑结论：

- 当前三张实体表加轻量冗余字段，足够支撑首页开始任务、并发 Agent、历史编辑、归档项目、日周月统计和最近/常用排序
- 现阶段不需要新增后端字段、账号字段、同步元数据
- 若后续要求持久化用户 UI 偏好，例如首页默认排序模式，再单独扩展 `preferences`，不纳入本版范围

## 7. State Rules

### 7.1 启动本人任务

输入：

- `projectId`

前置条件：

- 项目存在
- 项目未归档
- 项目执行主体为 `self`

状态变化：

1. 读取目标 `Project`
2. 查找全部 `endAt = null` 的 `Session`
3. 在这些进行中记录中，找到其关联项目 `actor = self` 的记录，数量理论上应为 `0 | 1`
4. 若存在进行中的本人记录，则先将其 `endAt` 写为当前时间，并同步重算 `durationMs`、更新 `updatedAt`
5. 为目标项目创建新的 `Session`
6. 目标项目 `usageCount += 1`，`lastUsedAt = session.startAt`，`updatedAt` 更新为当前时间

结果约束：

- 启动成功后，系统内仍然至多存在一个进行中的本人记录
- 自动结束旧本人任务不影响任何进行中的 Agent 任务

### 7.2 启动 Agent 任务

输入：

- `projectId`

前置条件：

- 项目存在
- 项目未归档
- 项目执行主体为 `agent`

状态变化：

1. 不影响当前本人任务
2. 不影响其他进行中的 Agent 任务
3. 为目标项目创建新的 `Session`
4. 目标项目 `usageCount += 1`，`lastUsedAt = session.startAt`，`updatedAt` 更新为当前时间

结果约束：

- 第一版允许同一 Agent 项目存在多条并行进行中的记录；若产品后续不接受，需要由产品规格单独收口

### 7.3 停止任务

输入：

- `sessionId`

前置条件：

- `Session` 存在
- `Session.endAt = null`

状态变化：

- 将该记录的 `endAt` 写为当前时间
- 重算 `durationMs`
- 更新 `Session.updatedAt`

结果约束：

- 已结束记录再次点击停止应视为无效操作或前端禁用，不应覆盖已存时间

### 7.4 编辑历史记录

允许更新：

- `startAt`
- `endAt`
- `note`

前置条件：

- `Session` 存在
- 修改后的 `endAt` 若存在，不得早于 `startAt`

状态变化：

- 更新对应字段
- 重算 `durationMs`
- 更新 `Session.updatedAt`

结果约束：

- 编辑后的记录立即参与所有查询、排序和统计
- 若把一条已结束记录改回 `endAt = null`，它会重新变成进行中记录
- 若编辑后造成同时存在多个进行中的本人记录，数据层应拒绝该次编辑

### 7.5 归档项目

输入：

- `projectId`

前置条件：

- `Project` 存在

状态变化：

- `project.archived = true`
- `project.archivedAt = 当前时间`
- `project.updatedAt = 当前时间`

结果约束：

- 首页不再展示
- 不能再开始新任务
- 历史记录保留
- 已归档项目若存在进行中的 `Session`，第一版数据模型不强制自动停止；是否允许“带运行中记录归档”由产品规格补充确认

### 7.6 编辑项目归属

允许更新：

- `typeId`

前置条件：

- 新 `typeId` 必须存在

结果约束：

- 历史记录通过 `projectId` 关联读取时，会自动显示新项目类型
- 不产生新的 `Session`，也不修改历史记录主键关联

## 8. Query And Sorting Rules

### 8.1 首页项目列表

过滤：

- 只展示未归档项目
- 支持按 `Project.name` 搜索，默认按包含匹配

排序模式：

- `recent`
  - 第 1 关键字：`lastUsedAt` 倒序，`null` 视为最晚使用优先级最低
  - 第 2 关键字：`usageCount` 倒序
  - 第 3 关键字：`sortOrder` 升序
  - 第 4 关键字：`createdAt` 升序
- `frequent`
  - 第 1 关键字：`usageCount` 倒序
  - 第 2 关键字：`lastUsedAt` 倒序，`null` 视为最晚使用优先级最低
  - 第 3 关键字：`sortOrder` 升序
  - 第 4 关键字：`createdAt` 升序

### 8.2 当前任务查询

- 当前本人任务：`endAt = null` 且关联项目 `actor = self`
- 当前 Agent 任务：`endAt = null` 且关联项目 `actor = agent`

当前任务排序：

- 当前本人任务理论上最多 1 条
- 运行中的 Agent 任务按 `startAt` 倒序展示，新启动的排前面

### 8.3 历史排序

支持：

- `desc`
  - 第 1 关键字：`startAt` 倒序
  - 第 2 关键字：`createdAt` 倒序
- `asc`
  - 第 1 关键字：`startAt` 升序
  - 第 2 关键字：`createdAt` 升序
- `duration`
  - 仅对已结束记录按 `durationMs` 倒序
  - 进行中记录固定排在已结束记录之前
  - 同耗时时按 `startAt` 倒序

## 9. Statistics Rules

### 9.1 统计基础

- 统计对象为 `Session`
- 除特别说明外，仅统计已结束记录
- 进行中记录不计入耗时汇总，避免实时累加导致口径抖动
- 单条记录耗时使用 `durationMs`

### 9.2 本人时间

- 只统计关联项目 `actor = self` 的已结束记录

### 9.3 Agent 时间

- 只统计关联项目 `actor = agent` 的已结束记录
- 不并入本人时间

### 9.4 日 / 周 / 月归属

- 统一以 `Session.startAt` 所在本地日期归属统计周期
- 日统计：按自然日聚合
- 周统计：按自然周聚合；第一版默认采用本地周一到周日
- 月统计：按自然月聚合

### 9.5 项目类型分布

- 统计维度按 `Session.projectId -> Project.typeId` 的当前关联结果聚合
- 只统计已结束记录
- 本人和 Agent 可分别聚合，也可并列展示，但不得混成单一“总时间”误导用户

### 9.6 最近趋势

- 趋势图基础口径为按日汇总的已结束时长
- 第一版不要求持久化趋势缓存，运行时计算即可

## 10. Validation Rules

- 项目类型名称不可为空
- 具体项目名称不可为空
- 新建具体项目时必须选择项目类型
- 新建具体项目时必须指定执行主体
- 结束时间不能早于开始时间
- 有未归档具体项目的项目类型不可删除
- 有已归档具体项目的项目类型同样不可删除
- 归档项目不可再次开始任务
- 编辑历史记录不能制造出两个进行中的本人任务
- `usageCount`、`sortOrder` 必须是整数
- 所有时间字段必须可被解析为有效时间

## 11. Risks / Open Questions

- 历史“花费时间长短”在产品规格里未明确是默认长到短还是短到长；当前数据模型先按长到短定义，若产品想改，应回写 `docs/product-spec.md`
- 是否允许“归档一个仍有进行中记录的项目”目前产品规格未写死；当前仅记录为风险，不额外引入自动停止规则
- 是否允许“同一个 Agent 项目被重复点击后形成多条并行进行中记录”产品规格未限制；当前数据模型按允许处理
- 周统计采用周一到周日是一个实现默认值，不是已经落盘的产品决策；如需改为周日开周，应由产品规格确认
- 后续若要支持标签、结果、附件等扩展字段，应在 `Session` 上做版本演进，第一版暂不处理

## 11. Change Log

- 2026-03-16: 建立第一版数据模型文档
