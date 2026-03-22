# Claude Code / Agent 教程全量学习地图（s01-s12）

这份文档把 `learn-claude-code` 的 `s01 ~ s12` 压缩成一张“从 0 到多 agent 系统”的学习地图。

适合：

- 学完整套教程后回顾
- 快速记住每一课解决了什么问题
- 建立章节之间的递进关系

---

## 1. 一张总图

```text
基础闭环
└── s01 Agent Loop
    └── s02 Tool Use
        └── s03 Todo / 简单任务拆解

能力扩展
└── s04 Subagent
    └── s05 Skills
        └── s06 Context Compact

系统化协作
└── s07 Task System
    └── s08 Background Tasks
        └── s09 Agent Teams
            └── s10 Team Protocols
                └── s11 Autonomous Agents
                    └── s12 Worktree Task Isolation
```

如果压缩成一句话：

> 从“单个模型会调工具”，一步步长成“能长期运行、能并行协作、能自治认领任务、能隔离执行环境的 agent system”。

---

## 2. 分阶段理解整套教程

---

### 阶段 A：最小 Agent 闭环（s01-s03）

#### s01：Agent Loop
**核心问题**：怎么让模型不只是答一句话，而是持续工作？

**答案**：给它一个循环：
- 看上下文
- 决定行动还是回答
- 行动后继续循环

**关键词**：loop、messages、stop_reason

**一句话**：
> agent 的本质不是复杂编排，而是一个允许模型持续行动的循环。

---

#### s02：Tool Use
**核心问题**：模型怎么从“会想”变成“会做”？

**答案**：给模型工具：
- 读文件
- 写文件
- 跑命令
- 编辑内容

**关键词**：tools、tool_use、tool_result

**一句话**：
> tools 让模型从“只能回答”变成“可以操作世界”。

---

#### s03：Todo / 简单任务拆解
**核心问题**：多步任务怎么保持连贯？

**答案**：引入 todo / task list，把大任务拆成可跟踪的小步骤。

**关键词**：todo、计划、状态跟踪

**一句话**：
> 当任务超过一两步时，显式任务清单能显著提升稳定性。

---

### 阶段 B：能力扩展（s04-s06）

#### s04：Subagent
**核心问题**：主 agent 做探索时，上下文太容易被污染怎么办？

**答案**：把局部任务派给一次性 subagent：
- 给任务 prompt
- 独立执行
- 返回摘要
- 用完销毁

**关键词**：delegation、context isolation、一次性子代理

**一句话**：
> subagent 是“上下文隔离器”。

---

#### s05：Skills
**核心问题**：领域知识很多，不能全塞进 prompt，怎么办？

**答案**：skill 按需加载。

- Layer 1：只在 system prompt 里放 skill 名称和简介
- Layer 2：需要时通过 `load_skill` 加载完整 `SKILL.md`

**关键词**：on-demand knowledge、metadata、SKILL.md

**一句话**：
> skill 是按需加载的知识说明书。

---

#### s06：Context Compact
**核心问题**：长任务会把上下文撑爆怎么办？

**答案**：三层压缩：
- micro compact
- auto compact
- manual compact

**关键词**：summary、transcript、compression

**一句话**：
> 上下文要主动管理，不能无限堆积。

---

### 阶段 C：从单 agent 到系统（s07-s12）

#### s07：Task System
**核心问题**：任务状态不能只活在聊天上下文里，怎么办？

**答案**：把任务持久化到 `.tasks/`，形成任务图。

**关键词**：JSON tasks、blockedBy、blocks、persistent state

**一句话**：
> 任务状态要外置到磁盘，不能只靠对话记忆。

---

#### s08：Background Tasks
**核心问题**：慢命令会阻塞 agent，怎么办？

**答案**：后台线程执行慢命令，前台 agent 继续工作；结果稍后注入。

**关键词**：background_run、notification queue、non-blocking

**一句话**：
> 后台任务的价值，是把等待时间利用起来。

---

#### s09：Agent Teams
**核心问题**：一次性 subagent 不适合长期协作，怎么办？

**答案**：引入持久化 teammate：
- 有名字
- 有角色
- 有状态
- 有 inbox
- 有自己的 agent loop

**关键词**：team、mailbox、persistent teammate

**一句话**：
> s09 让 agent 从单兵作战进入团队协作。

---

#### s10：Team Protocols
**核心问题**：团队通信如果全靠自由文本，容易混乱，怎么办？

**答案**：用带 `request_id` 的协议握手：
- shutdown protocol
- plan approval protocol

**关键词**：request-response、request_id、tracker、FSM

**一句话**：
> agent 团队需要“协议”，不只是“聊天”。

---

#### s11：Autonomous Agents
**核心问题**：队友总等 lead 派活，扩展性差，怎么办？

**答案**：让队友在空闲时：
- 查 inbox
- 看任务板
- 自动认领未分配任务

**关键词**：idle loop、auto-claim、polling、identity reinjection

**一句话**：
> 自治 = agent 会自己找活干。

---

#### s12：Worktree Task Isolation
**核心问题**：多个 agent 并行改代码时，共享目录会互相污染，怎么办？

**答案**：每个任务绑定独立 git worktree：
- 任务板管“做什么”
- worktree 管“在哪做”

**关键词**：git worktree、execution plane、control plane、directory isolation

**一句话**：
> 并行改代码最终必须做工作区隔离。

---

## 3. 每一课到底新增了什么

| 章节 | 新增的核心能力 |
|---|---|
| s01 | agent loop |
| s02 | tools / tool use |
| s03 | todo / 简单任务拆解 |
| s04 | subagent / 上下文隔离 |
| s05 | skill / 按需知识加载 |
| s06 | 上下文压缩 |
| s07 | 持久化任务图 |
| s08 | 后台执行 |
| s09 | 持久化 teammate + inbox |
| s10 | request-response 团队协议 |
| s11 | 自治认领任务 |
| s12 | worktree 目录隔离 |

---

## 4. 教程里的几组关键概念对照

### Agent vs Skill
- **Agent**：谁来做事
- **Skill**：做事时查什么说明书

### Subagent vs Team
- **Subagent**：一次性委派，用完销毁
- **Team**：持久成员，靠消息协作

### Task vs Worktree
- **Task**：控制平面，记录目标和状态
- **Worktree**：执行平面，记录在哪个隔离目录里干活

### Background Task vs Autonomous Agent
- **Background task**：后台跑命令
- **Autonomous agent**：自己看任务板找活干

---

## 5. 真正的递进关系是什么

表面上像是每课加一个功能，实际上递进关系更强：

### 没有 s02，就没有“做事能力”
### 没有 s04，就没有“上下文隔离”
### 没有 s05，就没有“按需知识”
### 没有 s06，就没有“长期会话”
### 没有 s07，就没有“任务外部状态”
### 没有 s08，就没有“非阻塞执行”
### 没有 s09，就没有“团队成员”
### 没有 s10，就没有“结构化协作”
### 没有 s11，就没有“自治”
### 没有 s12，就没有“真实并行代码修改的安全隔离”

所以这套教程并不是离散技巧集合，而是一步步把系统补完整。

---

## 6. 哪几课最值得反复回看

如果只想抓最重要的里程碑，建议优先反复看：

### s02
因为 tool use 是一切行动能力的起点。

### s04
因为 subagent 体现了“上下文隔离”的第一性原理。

### s05
因为 skill 体现了“知识按需加载”的关键设计思想。

### s06
因为长任务的本质问题就是上下文管理。

### s07
因为状态外置是从 demo 到系统的分水岭。

### s09
因为它第一次真正进入多 agent 协作。

### s11
因为自治是从“被动执行”到“主动发现工作”的跃迁。

### s12
因为它解决了真实代码仓库中最容易被忽略、但最致命的并行污染问题。

---

## 7. 面向真实使用的压缩版建议

如果你不是为了复刻整个仓库，而是为了在实际工具里更好地使用这些思路，可以这样映射：

### 立即能用上的
- 工具调用思维（s02）
- 子代理隔离思维（s04）
- skill / 说明书按需加载思维（s05）
- 上下文节省思维（s06）

### 做复杂项目会越来越需要的
- 显式任务系统（s07）
- 后台执行 / 非阻塞思维（s08）
- 团队与角色协作（s09-s10）
- 自治认领（s11）
- worktree 隔离（s12）

---

## 8. 最终压缩版

如果只记 12 句：

- s01：agent 的本质是循环
- s02：tools 让模型能行动
- s03：多步任务需要显式拆解
- s04：subagent 用来隔离上下文
- s05：skill 用来按需加载知识
- s06：上下文必须主动压缩
- s07：任务状态必须外置持久化
- s08：慢操作要后台化，但关键路径依赖仍要等
- s09：team 是可持续存在的多 agent 组织
- s10：团队协作要有协议和 request_id
- s11：自治 = 会自己看任务板认领工作
- s12：并行改代码最终要用 worktree 做目录隔离

---

## 9. 结语

学完整套教程后，最重要的收获不是“记住了 12 个脚本”，而是建立下面这个整体认识：

> 一个真正有用的 agent system，不只是 prompt + tool，而是还要考虑知识加载、上下文压缩、任务持久化、并行执行、团队协作、自治认领和执行环境隔离。

