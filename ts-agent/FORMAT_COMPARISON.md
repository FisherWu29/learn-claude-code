# OpenAI vs Anthropic API 格式对比

## 完整示例对比

### Anthropic 格式

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// === 定义工具 ===
const tools = [{
  name: 'bash',
  description: 'Run shell command',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string' }
    }
  }
}];

// === 发送请求 ===
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 8000,
  messages: [{ role: 'user', content: 'List files' }],
  tools,
});

// === 解析响应 ===
// response.content = [
//   { type: 'text', text: 'I'll list the files...' },
//   { type: 'tool_use', id: 'toolu_xxx', name: 'bash', input: { command: 'ls' } }
// ]

// === 返回工具结果 ===
messages.push({ role: 'assistant', content: response.content });
messages.push({
  role: 'user',
  content: [{
    type: 'tool_result',
    tool_use_id: 'toolu_xxx',
    content: 'file1.txt\nfile2.txt'
  }]
});

// === 判断是否继续 ===
if (response.stop_reason === 'tool_use') {
  // 继续循环
}
```

### OpenAI 格式

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

// === 定义工具 ===
const tools = [{
  type: 'function',
  function: {
    name: 'bash',
    description: 'Run shell command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' }
      }
    }
  }
}];

// === 发送请求 ===
const response = await client.chat.completions.create({
  model: 'deepseek-chat',
  max_tokens: 8000,
  messages: [{ role: 'user', content: 'List files' }],
  tools,
});

// === 解析响应 ===
// response.choices[0].message = {
//   role: 'assistant',
//   content: 'I'll list the files...',
//   tool_calls: [{
//     id: 'call_xxx',
//     type: 'function',
//     function: {
//       name: 'bash',
//       arguments: '{"command":"ls"}'  // JSON 字符串！
//     }
//   }]
// }

// === 返回工具结果 ===
messages.push(response.choices[0].message);
messages.push({
  role: 'tool',
  tool_call_id: 'call_xxx',
  content: 'file1.txt\nfile2.txt'
});

// === 判断是否继续 ===
if (response.choices[0].finish_reason === 'tool_calls') {
  // 继续循环
}
```

## 关键差异表

| 概念 | Anthropic | OpenAI |
|------|-----------|--------|
| **工具定义** | | |
| 顶层结构 | `tools: [{name, description, input_schema}]` | `tools: [{type: 'function', function: {...}}]` |
| 参数 Schema | `input_schema` 直接是 JSON Schema | `parameters` 是 JSON Schema |
| **请求响应** | | |
| 响应结构 | `response.content` 是数组 | `response.choices[0].message` 是对象 |
| 文本内容 | `{type: 'text', text: '...'}` | `message.content: string` |
| 工具调用 | `{type: 'tool_use', id, name, input}` | `tool_calls: [{id, function: {name, arguments}}]` |
| 工具参数 | `input: {command: 'ls'}` (对象) | `arguments: '{"command":"ls"}'` (字符串) |
| **工具结果** | | |
| 消息类型 | `{role: 'user', content: [{type: 'tool_result', ...}]}` | `{role: 'tool', tool_call_id, content}` |
| ID 字段 | `tool_use_id` | `tool_call_id` |
| **完成原因** | | |
| 停止原因 | `stop_reason: "tool_use"` | `finish_reason: "tool_calls"` |
| 正常结束 | `stop_reason: "end_turn"` | `finish_reason: "stop"` |

## 代码模式对比

### 工具执行循环

#### Anthropic

```typescript
for (const block of response.content) {
  if (block.type === 'tool_use') {
    const args = block.input;  // 直接是对象
    const result = await execute(block.name, args);
    results.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: result
    });
  }
}
```

#### OpenAI

```typescript
for (const call of message.tool_calls ?? []) {
  const args = JSON.parse(call.function.arguments);  // 需要解析 JSON
  const result = await execute(call.function.name, args);
  messages.push({
    role: 'tool',
    tool_call_id: call.id,
    content: result
  });
}
```

### 消息历史结构

#### Anthropic

```typescript
const messages = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: [
    { type: 'text', text: 'Hi!' },
    { type: 'tool_use', id: 'x', name: 'bash', input: {...} }
  ]},
  { role: 'user', content: [
    { type: 'tool_result', tool_use_id: 'x', content: '...' }
  ]}
];
```

#### OpenAI

```typescript
const messages = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi!', tool_calls: [...] },
  { role: 'tool', tool_call_id: 'x', content: '...' }
];
```
