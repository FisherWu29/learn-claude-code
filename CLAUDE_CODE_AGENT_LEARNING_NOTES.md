# Claude Code / Agent 教程学习笔记（s05-s12）

这份文档整理了本次会话中围绕仓库 `learn-claude-code` 后半部分教程的讨论，重点覆盖：

- `s05` Skills
- `s06` Context Compact
- `s07` Task System
- `s08` Background Tasks
- `s09` Agent Teams
- `s10` Team Protocols
- `s11` Autonomous Agents
- `s12` Worktree + Task Isolation
- 以及补充讨论：Agent vs Skill、Subagent vs Team、后台任务的边界

目标不是逐行抄代码，而是把整条思路串起来，形成一张清晰的学习地图。

---

## 0. 整体学习地图

这套教程后半段的主线，不是“多加几个工具”，而是逐步搭出一个更完整的 agent system。

可以把 `s05-s12` 理解成下面这条演进路径：

```text
s05  按需加载知识
s06  压缩上下文
s07  持久化任务
s08  后台执行
s09  持久化团队成员
s10  团队协议
s11  自治认领任务
s12  worktree 目录隔离
```

如果再压缩成一句话：

> 从“会调用工具的单 agent”，逐步进化成“能长期运行、能协作、能恢复、能隔离的多 agent 系统”。

---

## 1. s05：Skills（按需知识加载）

### 核心问题
如果把所有领域知识都塞进 system prompt：

- token 开销大
- 大部分知识当前任务根本用不上
- 容易污染上下文

### 核心思路
使用两层注入：

1. **Layer 1**：在 system prompt 里只放 skill 名称和简介
2. **Layer 2**：当模型需要时，通过 `load_skill(...)` 工具加载完整 `SKILL.md`

### 最重要的理解

> **Skill = 做事时查什么说明书**

Skill 不等于工具，也不等于角色，它更像按需加载的专业知识说明书。

### 代码中的关键对象
- `SkillLoader`
- `get_descriptions()`
- `get_content(name)`
- `load_skill` 工具

### 仓库里的典型 skill
- `agent-builder`
- `code-review`
- `mcp-builder`
- `pdf`

### 这一节最该记住的一句话

> 不要把所有知识都塞进 system prompt，用到时再加载。

---

## 2. s06：Context Compact（上下文压缩）

### 核心问题
agent 长时间工作时：

- 会读很多文件
- 跑很多命令
- 积累很多工具输出
- 对话上下文会爆

### 三层压缩机制

#### Layer 1：`micro_compact`
每次 LLM 调用前，把较早的长工具输出替换成占位符，例如：

```text
[Previous: used read_file]
```

#### Layer 2：`auto_compact`
当 token 估算超过阈值时：

- 把完整对话存到 `.transcripts/`
- 让模型总结历史
- 用“摘要后的短消息”替换整段旧历史

#### Layer 3：`compact` 工具
模型可以主动要求压缩，会触发同样的摘要流程。

### 关于模型主动调用 `compact` 的具体流程
模型调用 `compact` 后：

1. harness 识别到这次工具调用是 `compact`
2. 先把 `tool_result: Compressing...` 写入历史
3. 然后调用 `auto_compact(messages)`
4. 保存完整 transcript 到 `.transcripts/`
5. 单独发起一次“请总结历史”的模型调用
6. 用 summary 替换整个长历史

### 最重要的理解

> 上下文不是神圣不可动的，应该被主动管理。

以及：

> 压缩不等于遗忘，完整历史可以外存。

---

## 3. s07：Task System（持久化任务系统）

### 核心问题
`s03` 的 todo 更像会话内清单：

- 扁平
- 依赖弱
- 不持久
- 压缩后容易丢语义

### s07 的升级
把任务做成磁盘上的 JSON 文件，放在：

```text
.tasks/
```

每个任务包含：

- `id`
- `subject`
- `description`
- `status`
- `blockedBy`
- `blocks`
- `owner`

### 最重要的概念
这是一个**任务图**，而不只是 todo list。

它可以表达：

- 哪些任务可做
- 哪些被阻塞
- 哪些已完成
- 哪些能并行

### 关键机制
- `task_create`
- `task_update`
- `task_list`
- `task_get`
- 任务完成时自动解除下游 `blockedBy`

### 最重要的理解

> 把任务状态从“对话记忆”中拿出来，放到外部持久化存储里。

这是后面并行执行、团队协作、自治认领的基础。

---

## 4. s08：Background Tasks（后台任务）

### 核心问题
很多命令很慢：

- `npm install`
- `pytest`
- `docker build`

如果全都阻塞执行，agent 只能原地等。

### 核心思路
用后台线程跑慢命令，让 agent 前台继续做别的事。

### 关键组件
- `BackgroundManager`
- `background_run`
- `check_background`
- `_notification_queue`

### 核心流程
1. 模型调用 `background_run(command)`
2. harness 立即返回 task_id
3. 后台线程去执行命令
4. 完成后把结果放进通知队列
5. 下一次 LLM 调用前，把后台结果注入消息历史

### 这节的关键边界
这版实现只解决：

- **不要阻塞当前 agent loop**
- **如果有可并行的旁路工作，可以先做别的**

它**没有**解决：

- 跨会话持久后台作业
- 关键路径依赖本身的等待问题
- 进程退出后的任务续跑

### 很重要的一点
如果后台任务本身就在关键路径上，例如：

- “必须等测试结果才能决定下一步修复”

那它本质上还是得等，后台化并不会神奇消除依赖。

### 最重要的理解

> 后台执行的价值在于利用等待时间做可并行工作，而不是消除依赖链。

---

## 5. s09：Agent Teams（智能体团队）

### 核心问题
`s04` 的 subagent 是一次性的：

- 生成
- 干活
- 返回摘要
- 消失

这不适合长期协作。

### s09 的升级
引入**持久化 teammate**：

- 有名字
- 有角色
- 有状态
- 有收件箱
- 有自己的线程和 agent loop

### 两个核心组件
#### `MessageBus`
使用 JSONL 文件作为每个 agent 的 inbox：

```text
.team/inbox/alice.jsonl
.team/inbox/bob.jsonl
.team/inbox/lead.jsonl
```

#### `TeammateManager`
管理：
- 团队 roster
- 成员状态
- 线程生命周期
- teammate loop

### 最重要的理解

> s04 的 subagent 更像“一次性外包工”，s09 的 teammate 更像“正式团队成员”。

### 关于 Team 和上下文的关键澄清
Team **不是**“所有成员共享同一份上下文”。

真实情况是：

- 每个 teammate 都有自己的独立消息历史
- 每个 teammate 有自己的 inbox
- 通过消息同步信息

所以更准确的说法是：

> Team 是多个独立上下文，通过消息机制协作。

---

## 6. s10：Team Protocols（团队协议）

### 核心问题
s09 虽然能通信，但大多还是自由消息，没有结构化协商规则。

例如：
- 优雅关机
- 高风险任务先审批

都不适合靠随便发一句话解决。

### 核心思路
引入统一的 request-response 模式：

- 每个请求都有 `request_id`
- tracker 用 `request_id` 追踪状态
- 状态机统一为：

```text
pending -> approved | rejected
```

### 两个协议
#### 1）Shutdown Protocol
lead 发起 shutdown request，teammate approve/reject。

#### 2）Plan Approval Protocol
teammate 提交计划，lead approve/reject。

### 最重要的理解

> s10 真正想教的不是关机和审批本身，而是“agent 间的结构化握手模式”。

以后任何异步协作都可以扩展成：

- request_id
- tracker
- pending / approved / rejected

---

## 7. s11：Autonomous Agents（自治智能体）

### 核心问题
在 `s09-s10` 中，队友通常还是“等 lead 派活”。

### 核心思路
让 teammate 在空闲时：

- 轮询 inbox
- 扫描任务板
- 发现可做任务就自动认领

### WORK / IDLE 双阶段模型
#### WORK phase
正常 agent loop：
- 调 LLM
- 用工具
- 干当前任务

#### IDLE phase
如果模型调用 `idle`，或当前工作结束，就进入空闲轮询：
- 查 inbox
- 查 `.tasks/`
- 有活就恢复工作
- 一直没活就超时 shutdown

### 自动认领任务的规则
只认领同时满足这些条件的任务：

- `status == pending`
- 没有 `owner`
- 没有 `blockedBy`

也就是：

> 当前无人认领、未被阻塞、可立即执行的任务。

### 关键补丁：身份重注入
因为上下文压缩后，agent 可能忘了自己是谁，所以会在必要时插入：

```text
<identity>You are 'alice', role: coder, team: default...</identity>
```

### 最重要的理解

> 自治不是“模型更神奇”，而是“给模型一个能自己发现工作的环境”。

这个环境包括：
- inbox
- task board
- owner/status
- idle loop
- claim lock
- identity persistence

---

## 8. s12：Worktree + Task Isolation（Worktree 任务隔离）

### 核心问题
到 s11 为止，虽然任务可以并行、agent 可以自治，但大家还在共享同一个代码目录。

这会导致：

- 改动互相污染
- 很难回滚
- 多 agent 并行修改会打架

### 核心思路
引入 **Git worktree**，让每个任务绑定一个独立执行目录。

### 关键结构
#### `.tasks/task_x.json`
任务控制平面：
- `status`
- `owner`
- `worktree`

#### `.worktrees/index.json`
执行平面索引：
- `name`
- `path`
- `branch`
- `task_id`
- `status`

#### `.worktrees/events.jsonl`
生命周期事件流：
- create before/after/failed
- remove before/after/failed
- keep
- task.completed

### 最重要的理解

> 任务板负责“做什么”，worktree 负责“在哪做”。

也就是：

- **Task = control plane**
- **Worktree = execution plane**

### 关键能力
- `worktree_create`
- `worktree_run`
- `worktree_status`
- `worktree_keep`
- `worktree_remove`
- `worktree_events`

### `keep` 和 `remove` 的区别
#### `worktree_keep`
保留目录，状态标成 `kept`，供后续检查或继续工作。

#### `worktree_remove`
删除目录；如果 `complete_task=true`，还会顺手把绑定任务标记为 `completed` 并解绑。

### 最重要的理解

> 并行协作不仅要逻辑隔离，还要物理隔离。

真实代码仓库里，多 agent 并行修改必须做目录隔离，否则前面所有团队化、自治化能力都会互相踩踏。

---

## 9. 补充讨论：后台任务的边界

这个问题在本次会话里讨论得很重要，单独总结一下。

### 问题
“后台任务是不是最终还是要等？如果关键路径依赖后台任务，那不是和串行差不多吗？”

### 结论
是的，要区分两件事：

#### 1）后台执行能做什么
- 避免当前 agent loop 被慢命令阻塞
- 在等待期间做别的独立工作

#### 2）后台执行不能做什么
- 不能消除关键路径依赖
- 不能把必须等待的事情变成不等待

### 这版实现的局限
- 状态在内存里
- 使用 daemon thread
- 进程退出后后台任务不可靠
- 不是跨会话、持久化 job queue

### 最实用的理解

> 后台任务主要优化“等待时还能做什么”，不是优化“本来就必须等待的依赖”。

---

## 10. 补充讨论：Subagent 和 Team 的区别

### Subagent
通常：
- 一次性创建
- 给一个任务 prompt
- 有自己的独立上下文
- 做完返回摘要后结束

更像：

> 一次性外包工

### Team / Teammate
通常：
- 持续存在
- 有名字、角色、状态
- 创建时拿到 lead 给的 prompt
- 后续靠自己的历史和 inbox 消息继续工作

更像：

> 正式团队成员

### 核心区别
二者都不是共享主会话完整上下文，但：

- subagent：短生命周期、一次性委派
- teammate：长生命周期、消息驱动协作

### 最重要的一句话

> Subagent 和 teammate 都是独立上下文；team 不是共享同一上下文，而是通过消息同步。

---

## 11. 补充讨论：Agent 和 Skill 的区别

这是本次会话的高频困惑，值得单独写明。

### 一句话区分
- **Agent = 谁来做事**
- **Skill = 做事时查什么说明书**

### Agent 更像
- 岗位
- 角色
- 身份壳子

例如：
- reviewer
- tester
- architect

### Skill 更像
- 手册
- SOP
- 领域知识插件

例如：
- code-review
- mcp-builder
- pdf

### 二者的关系
不是二选一，而是：

> Agent 工作时，可以按需加载 Skill。

### 最实用的判断法
如果一段内容描述的是：

#### 身份 / 职责 / 风格 / 边界
更适合写进 **Agent**。

#### 知识 / 步骤 / checklist / 领域流程
更适合写进 **Skill**。

### 与协作机制的关系
自定义 Agent 不只属于 subagent，也不只属于 team。

更准确地说：

- **Agent 定义“以什么身份工作”**
- **Subagent / Team 定义“以什么协作模式工作”**

所以两边都可以使用自定义 Agent。

---

## 12. 一张最终总表

| 概念 | 核心问题 | 本质 |
|---|---|---|
| Agent | 谁来做事？ | 角色 / 身份 |
| Skill | 做事时参考什么？ | 知识 / SOP |
| Subagent | 这次任务怎么派出去？ | 一次性委派 |
| Team | 多个代理怎么持续协作？ | 多成员协作模式 |
| Task | 现在要做什么？ | 持久化控制平面 |
| Worktree | 在哪里做？ | 隔离执行平面 |

---

## 13. 后半段教程的一条完整主线

把 `s05-s12` 串成一句完整的话：

> 先学会按需加载知识（s05），再学会压缩上下文（s06），再把任务放到对话外持久化（s07），然后让慢操作后台运行（s08），再把单 agent 扩展成可通信的团队（s09），给团队通信加协议（s10），让队友自己看任务板认领工作（s11），最后用 worktree 把多任务执行环境物理隔离（s12）。

这其实已经不是“写几个 prompt”的层级了，而是在搭一个小型 agent operating system 的雏形。

---

## 14. 对 Claude Code 真实使用的启发

### 1）不是所有事都要上 team
很多时候：
- 主 agent + 临时 subagent
已经足够高效。

### 2）优先沉淀少量高频角色
如果一个角色你会反复使用，例如：
- reviewer
- tester
- architect

就值得沉淀成自定义 Agent。

### 3）Skill 更适合沉淀通用流程和领域知识
例如：
- 测试 SOP
- 代码审查 checklist
- 某技术栈排障手册

### 4）后台任务只对可并行工作有价值
如果它在关键路径上，后台化不会消除等待。

### 5）多 agent 真想落地，最终一定会碰到工作区隔离问题
这正是 s12 最有现实价值的地方。

---

## 15. 最终压缩版结论

如果只记最短版本，记下面这些：

- **s05**：知识按需加载
- **s06**：上下文要主动压缩
- **s07**：任务要外部持久化
- **s08**：慢操作放后台，但关键路径依赖仍要等
- **s09**：team 是多个独立上下文通过消息协作
- **s10**：团队通信要有协议和 request_id
- **s11**：自治 = 自己看任务板认领工作
- **s12**：并行改代码必须做 worktree 目录隔离

以及：

- **Agent = 谁来做事**
- **Skill = 做事时查什么说明书**
- **Subagent = 一次性委派**
- **Team = 持续协作组织**

---

## 16. 附：本次会话产出的相关文档

本次讨论还额外整理了一份：

- `AGENT_VS_SKILL.md`

它更聚焦在：

- Agent vs Skill
- 与 Subagent / Team 的关系
- 如何决定一段内容该做成 Agent 还是 Skill

而本文件更偏向：

- 教程主线总结
- 后半段各章节的脉络串联
- 实际使用中的概念澄清

