# Tasks

## 1. Purpose

作为当前 demo 的协作任务面板，给多终端并行工作提供统一入口。

## 2. In Progress

- [ ] `docs/product-spec.md` 初版
- [ ] `docs/data-model.md` 初版
- [ ] `docs/information-architecture.md` 初版
- [ ] `README.md` 更新为文档索引入口

## 3. Next

- [ ] 首页低保真骨架
- [ ] 历史记录页骨架
- [ ] 仪表盘页骨架
- [ ] 我页管理骨架
- [ ] 本地存储状态管理初版

## 4. Later

- [ ] 导出能力
- [ ] 本地提醒机制
- [ ] 更细的统计维度
- [ ] 云同步与登录方案

## 5. Terminal Split

### Terminal D

职责：

- 作为总负责人角色，直接和用户协作
- 负责目标澄清、范围控制、任务拆分、优先级排序
- 协调 Terminal A / B / C 的工作边界
- 在实现开始前做统一收口，避免各线偏航

重点文件：

- `README.md`
- `docs/product-spec.md`
- `docs/data-model.md`
- `docs/information-architecture.md`
- `docs/tasks.md`
- `docs/multi-terminal-workflow.md`
- `docs/terminal-d-lead.md`

说明：

- 默认由主 Codex 会话承担，不必额外单开

### Terminal A

职责：

- 维护产品规则
- 校验实现是否符合产品规格

重点文件：

- `docs/product-spec.md`
- `README.md`

### Terminal B

职责：

- 维护数据模型
- 约束本地存储结构和状态流转

重点文件：

- `docs/data-model.md`

### Terminal C

职责：

- 维护页面信息架构
- 输出页面骨架与任务执行清单

重点文件：

- `docs/information-architecture.md`
- `docs/tasks.md`

## 6. Collaboration Rule

- 主 Codex 会话默认承担 Terminal D 职责，A / B / C 不直接替代 D 做总控决策
- 先更新对应文档，再开始实现
- 发生冲突时，以已落盘文档为准，而不是以聊天记忆为准
- 对齐阶段默认一次只问一个问题

## 7. Change Log

- 2026-03-16: 建立第一版协作任务文档
