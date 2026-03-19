# ts-agent

TypeScript 实现的 learn-claude-code Agent，使用 **OpenAI 兼容接口**。

## 快速开始

### 1. 安装依赖

```bash
cd ts-agent
npm install
```

### 2. 配置环境变量

```bash
# 复制模板
cp .env.example .env

# 编辑 .env，填入你的 API key
```

`.env` 文件内容：
```env
OPENAI_API_KEY=sk-xxx...
MODEL_ID=deepseek-chat
OPENAI_BASE_URL=https://api.deepseek.com
```

### 3. 运行

```bash
npm run s01
```

### 调试模式

默认开启调试模式，会显示完整的会话流转过程：

```
【用户输入 #1】
👤 用户: 列出当前目录的文件

============================================================
【LLM 调用 #1】
============================================================

📤 第 1 轮 - 发送给 LLM 的消息 (2 条):
  [system] "You are a coding agent at..."
  [user] "列出当前目录的文件"

📥 第 1 轮 - LLM 响应:
  finish_reason: tool_calls
  工具调用 (1 个):
    - bash(call_xxx)
      arguments: {"command":"ls"}

⚡ 执行: $ ls

🔧 工具执行结果: bash
  结果: package.json
  src/
  .env

⟳ 继续循环，等待模型下一步决策...
...
```

关闭调试模式，在 `.env` 中设置：
```env
DEBUG=false
```

## 支持的服务

只需修改 `OPENAI_BASE_URL` 即可切换不同服务：

| 服务 | OPENAI_BASE_URL |
|------|-----------------|
| DeepSeek | `https://api.deepseek.com` |
| OpenAI | `https://api.openai.com/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| 本地 Ollama | `http://localhost:11434/v1` |

## 项目结构

```
ts-agent/
├── src/
│   ├── s01.ts       # 核心模式：agent loop + bash (OpenAI 版本)
│   ├── s02.ts       # 添加 read/write/edit 工具
│   └── ...
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 核心模式（OpenAI 版本）

```typescript
// OpenAI 格式的 Agent 循环
while (response.choices[0].message.tool_calls?.length > 0) {
  response = await client.chat.completions.create({
    messages,
    tools,
  });
  execute tools;
  append tool results as {role: 'tool', tool_call_id: '...', content: '...'};
}
```

## OpenAI vs Anthropic 格式对比

| 功能 | OpenAI | Anthropic |
|------|--------|-----------|
| 工具调用位置 | `message.tool_calls` | `content` 数组中的 `type: "tool_use"` |
| 工具调用 ID | `tool_call.id` | `block.id` |
| 工具参数 | `function.arguments` (JSON 字符串) | `input` (对象) |
| 工具结果消息 | `{role: "tool", tool_call_id, content}` | `{type: "tool_result", tool_use_id, content}` |
| 完成原因 | `finish_reason: "tool_calls"` | `stop_reason: "tool_use"` |

## 测试示例

```
s01 >> 列出当前目录的文件
s01 >> 读取 package.json
s01 >> 创建一个 test.txt 文件，内容是 hello
s01 >> q
```

## 调试技巧

### 查看响应结构

```typescript
console.log(JSON.stringify(response.choices[0].message, null, 2));
```

### 常见问题

1. **401 Unauthorized**: 检查 `OPENAI_API_KEY`
2. **404 Not Found**: 检查 `OPENAI_BASE_URL` 路径
3. **Model 不存在**: 检查 `MODEL_ID` 是否正确
