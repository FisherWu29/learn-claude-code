# 调试指南

## 常见问题

### 1. API Key 错误

```
Error: Invalid API key
```

**解决**：检查 `.env` 文件中的 `ANTHROPIC_API_KEY` 是否正确。

### 2. 模型名称错误

```
Error: 400 Model does not exist
```

**解决**：检查 `MODEL_ID`，常用值：
- `claude-3-5-sonnet-20241022`（推荐）
- `claude-3-5-haiku-20241022`（便宜快速）
- `claude-3-opus-20240229`（最强）

### 3. 命令超时

```
Error: Timeout (120s)
```

**解决**：在 `runBash` 函数中增加 `timeout` 参数。

### 4. 工具调用无响应

可能原因：
- `stop_reason` 判断错误
- `tool_use_id` 不匹配
- 工具结果格式错误

**调试**：在 `agentLoop` 中添加日志

```typescript
console.log('stop_reason:', response.stop_reason);
console.log('content blocks:', response.content.length);
```

## 调试模式

创建 `src/debug.ts`：

```typescript
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function debug() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, say hi!' }],
  });

  console.log(response);
}

debug();
```

运行：
```bash
tsx src/debug.ts
```

## API 响应结构

```typescript
// Messages API 响应
{
  id: "msg_xxx",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",                    // 文本内容
      text: "Hello!"
    },
    {
      type: "tool_use",                // 工具调用
      id: "toolu_xxx",
      name: "bash",
      input: { command: "ls" }
    }
  ],
  stop_reason: "tool_use",             // 或 "end_turn"
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 }
}
```

## 测试用例

```bash
# 测试 ls
s01 >> ls

# 测试 cat 文件
s01 >> cat package.json

# 测试 echo
s01 >> echo "hello"

# 测试错误处理
s01 >> rm -rf /
```
