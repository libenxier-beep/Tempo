# Multi Terminal Workflow

## 1. Purpose

指导用户在主会话加多个辅助终端的模式下协作，避免重复劳动、上下文漂移和互相覆盖。

## 2. Scope

覆盖：

- 三个终端的职责分配
- 主会话与辅助终端的职责分配
- 每个终端启动时应先读取的文件
- 每个终端的输出要求
- 终端之间如何传递结果

不覆盖：

- Git 分支策略
- CI 流程

## 3. Shared Rules

所有终端都必须先读：

1. `AGENTS.md`
2. `README.md`
3. 自己负责的文档

所有终端都遵守：

- 先更新文档，再更新实现
- 文档中已确认的规则不重复发明
- 发现冲突时先停手，回到规格文档校验
- 对齐阶段一次只问一个问题

## 4. Terminal D

### 4.1 Role

总负责人角色。

### 4.2 Must Read

- `AGENTS.md`
- `README.md`
- `docs/product-spec.md`
- `docs/data-model.md`
- `docs/information-architecture.md`
- `docs/tasks.md`
- `docs/multi-terminal-workflow.md`
- `docs/terminal-d-lead.md`

### 4.3 Output

- 与用户做上游对齐
- 拆分和分配任务
- 收口 A / B / C 的产出
- 判断是否进入实现阶段

### 4.4 Good Tasks

- 明确当前阶段目标
- 仲裁规则冲突
- 决定本轮优先级
- 给每个终端下达清晰边界

默认情况下，主 Codex 会话直接承担 D 的职责，不必额外再开一个 D 终端。

只有在你明确想把“总控”和“具体执行”拆开时，才建议单独再拉起一个 D。

## 5. Terminal A

### 4.1 Role

产品规格负责人。

### 4.2 Must Read

- `AGENTS.md`
- `README.md`
- `docs/product-spec.md`

### 4.3 Output

- 校正产品规则
- 增补遗漏边界
- 保证 README 中的“当前闭环”与产品规格一致

### 4.4 Good Tasks

- 核对“本人任务”和“Agent 任务”的行为规则
- 核对项目归档和删除规则
- 核对历史记录编辑能力
- 更新路线图和限制说明

## 6. Terminal B

### 5.1 Role

数据模型负责人。

### 5.2 Must Read

- `AGENTS.md`
- `README.md`
- `docs/data-model.md`

### 5.3 Output

- 维护实体定义
- 维护本地存储结构
- 校验状态流转是否自洽

### 5.4 Good Tasks

- 设计 `localStorage` schema
- 细化 `Session` 字段
- 规定统计口径
- 规定查询和排序规则

## 7. Terminal C

### 6.1 Role

页面架构与执行清单负责人。

### 6.2 Must Read

- `AGENTS.md`
- `README.md`
- `docs/information-architecture.md`
- `docs/tasks.md`

### 6.3 Output

- 维护页面层级
- 维护页面职责
- 维护当前任务拆分和执行顺序

### 6.4 Good Tasks

- 输出首页结构
- 输出历史记录页结构
- 输出仪表盘结构
- 更新任务看板

## 8. Handoff Format

每个终端完成一轮后，统一按下面格式回写到聊天或提交说明中：

```md
## Done
- 本轮完成了什么

## Changed Files
- 修改了哪些文件

## Decisions
- 新确认了哪些规则

## Risks
- 还有什么没定或可能冲突

## Next
- 建议下一个终端接什么
```

## 9. Recommended Usage

### 8.1 开终端时怎么说

给每个终端的第一句提示词直接写清职责，不要含糊。

独立 Terminal D 示例：

```txt
你现在是 Terminal D，总负责人终端。先读取 AGENTS.md、README.md、docs/product-spec.md、docs/data-model.md、docs/information-architecture.md、docs/tasks.md、docs/multi-terminal-workflow.md、docs/terminal-d-lead.md。你的职责是和用户做上游对齐、拆任务、协调 A/B/C、收口冲突。默认一次只问一个问题。没有完成对齐前，不要直接推进大块实现。
```

Terminal A 示例：

```txt
你现在只负责产品规格。先读取 AGENTS.md、README.md、docs/product-spec.md，只允许更新产品规则相关文档，不要写实现代码。
```

Terminal B 示例：

```txt
你现在只负责数据模型。先读取 AGENTS.md、README.md、docs/data-model.md，只允许更新数据模型和状态规则，不要改页面实现。
```

Terminal C 示例：

```txt
你现在只负责信息架构和任务拆分。先读取 AGENTS.md、README.md、docs/information-architecture.md、docs/tasks.md，只允许更新页面架构和任务清单，不要改数据模型。
```

### 8.2 真正开始写代码前

只有当主会话完成 D 的收口职责，且 A、B、C 三条线都完成第一轮文档确认后，才建议开新的实现终端写 demo。

## 10. Change Log

- 2026-03-16: 建立第一版多终端协作说明
