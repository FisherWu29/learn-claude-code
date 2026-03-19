#!/usr/bin/env tsx
/**
 * ============================================================
 * s01.ts - Agent 循环（OpenAI 版本）
 * ============================================================
 *
 * 整个 AI 编程 Agent 的核心秘密就在这一个模式中：
 *
 *     当响应包含 tool_calls 时循环：
 *         1. 调用 LLM(messages, tools) 获取响应
 *         2. 执行模型调用的工具
 *         3. 将工具结果追加回消息列表
 *         4. 重复循环
 *
 *     +----------+      +-------+      +---------+
 *     |   用户   | ---> |  LLM  | ---> |  工具   |
 *     |  提示词  |      |       |      |  执行   |
 *     +----------+      +---+---+      +----+----+
 *                           ^               |
 *                           |   工具结果    |
 *                           +---------------+
 *                           (循环继续，直到模型停止调用工具)
 *
 * 这是核心循环：将工具结果反馈给模型，直到模型决定停止。
 *
 * ============================================================
 * OpenAI vs Anthropic 格式差异（参考）
 * ============================================================
 *
 * | Anthropic | OpenAI |
 * |-----------|--------|
 * | content: [{type: "tool_use", id: "...", name: "...", input: {...}}] | tool_calls: [{id: "...", function: {name: "...", arguments: "..."}}] |
 * | stop_reason: "tool_use" | finish_reason: "tool_calls" |
 * | {type: "tool_result", tool_use_id: "...", content: "..."} | {role: "tool", tool_call_id: "...", content: "..."} |
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

// ============================================================
// 第一部分：初始化配置
// ============================================================

// --------------------------------------------------------
// Windows 中文编码修复
// --------------------------------------------------------
// 设置 Node.js 输出编码为 UTF-8，解决 Windows 控制台中文乱码问题
if (process.platform === 'win32') {
  process.stdout.setEncoding('utf-8');
  process.stderr.setEncoding('utf-8');
}

// 加载 .env 环境变量
dotenv.config();

// ============================================================
// 调试配置：是否显示详细日志
// ============================================================
// 默认开启调试，设置环境变量 DEBUG=false 可关闭
const DEBUG = process.env.DEBUG !== 'false';

// 是否显示完整的原始 JSON 响应（用于深入理解）
const VERBOSE = process.env.VERBOSE === 'true';

/**
 * 打印分隔线（用于区分不同的 LLM 调用）
 */
function printSeparator(title: string) {
  console.log('');
  console.log('\x1b[90m' + '═'.repeat(60) + '\x1b[0m');
  console.log(`\x1b[90m【${title}】\x1b[0m`);
  console.log('\x1b[90m' + '═'.repeat(60) + '\x1b[0m');
}

/**
 * 打印发送给 LLM 的消息摘要
 */
function printMessagesSent(messages: OpenAI.ChatCompletionMessageParam[], round: number) {
  console.log(`\n\x1b[36m📤 第 ${round} 轮 - 发送给 LLM 的消息 (${messages.length} 条):\x1b[0m`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const roleColor = {
      system: '\x1b[35m',  // 紫色
      user: '\x1b[32m',    // 绿色
      assistant: '\x1b[34m', // 蓝色
      tool: '\x1b[33m',    // 黄色
    }[msg.role] || '\x1b[37m';

    console.log(`  ${roleColor}[${msg.role}]\x1b[0m ${formatMessage(msg)}`);
  }
}

/**
 * 格式化消息用于显示
 */
function formatMessage(msg: OpenAI.ChatCompletionMessageParam): string {
  if (msg.role === 'tool') {
    return `tool_call_id=${msg.tool_call_id}, content="${(msg.content as string).slice(0, 50)}..."`;
  }
  if (typeof msg.content === 'string') {
    return `"${msg.content.slice(0, 80)}${msg.content.length > 80 ? '...' : ''}"`;
  }
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    return `调用 ${msg.tool_calls.length} 个工具: ${msg.tool_calls.map(t => t.function.name).join(', ')}`;
  }
  return '(复杂内容)';
}

/**
 * 打印 LLM 的响应
 */
function printLLMResponse(response: OpenAI.ChatCompletion, round: number) {
  const msg = response.choices[0].message;
  const finishReason = response.choices[0].finish_reason;

  console.log(`\n\x1b[35m📥 第 ${round} 轮 - LLM 响应:\x1b[0m`);
  console.log(`  finish_reason: \x1b[33m${finishReason}\x1b[0m`);

  // ============================================================
  // VERBOSE 模式：显示完整的原始 JSON
  // ============================================================
  if (VERBOSE) {
    console.log(`\n  \x1b[90m┌───────────── 原始响应 JSON ─────────────\x1b[0m`);
    // 只打印关键部分，避免太长
    const compact = {
      id: response.id,
      finish_reason: finishReason,
      message: {
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls?.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }))
      }
    };
    console.log(`  \x1b[90m${JSON.stringify(compact, null, 2).split('\n').join('\n  ')}\x1b[0m`);
    console.log(`  \x1b[90m───────────────────────────────────────\x1b[0m`);
  }

  // 先打印文字回复（如果有）
  if (msg.content) {
    console.log(`\n  \x1b[36m📝 大模型说:\x1b[0m`);
    console.log(`  "\x1b[37m${msg.content}\x1b[0m"`);
  }

  // 再打印工具调用（如果有）
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    console.log(`\n  \x1b[33m🔧 工具调用 (${msg.tool_calls.length} 个):\x1b[0m`);
    for (const call of msg.tool_calls) {
      console.log(`\n    \x1b[33m┌─ ${call.function.name}()\x1b[0m`);
      console.log(`    │  id: \x1b[90m${call.id}\x1b[0m`);
      console.log(`    │  name: \x1b[33m${call.function.name}\x1b[0m`);
      console.log(`    │  arguments (JSON 字符串):`);
      console.log(`    │    \x1b[37m${call.function.arguments}\x1b[0m`);

      // 解析后的参数（更易读）
      try {
        const parsed = JSON.parse(call.function.arguments);
        console.log(`    │  arguments (解析后):`);
        console.log(`    │    \x1b[36m${JSON.stringify(parsed, null, 6).split('\n').join('\n    │    ')}\x1b[0m`);
      } catch {
        // 解析失败，跳过
      }
      console.log(`    \x1b[33m└──────────────────────────────\x1b[0m`);
    }
  }

  // 如果什么都没有
  if (!msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
    console.log(`  \x1b[90m(空响应 - 只有 content 为空且没有工具调用)\x1b[0m`);
  }
}

/**
 * 打印工具执行结果
 */
function printToolResult(toolName: string, toolCallId: string, result: string) {
  console.log(`\n\x1b[32m🔧 工具执行结果: ${toolName}\x1b[0m`);
  console.log(`  tool_call_id: ${toolCallId}`);
  console.log(`  结果: \x1b[37m${result.slice(0, 200)}${result.length > 200 ? '...' : ''}\x1b[0m`);
}

// 工作目录：Agent 在哪个目录下运行
const WORKDIR = process.cwd();
// 创建 OpenAI 兼容客户端
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'sk-xxx',
  baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',  // DeepSeek 端点
});

// 使用的模型
const MODEL = process.env.MODEL_ID ?? 'deepseek-chat';

// ============================================================
// 第二部分：系统提示词 & 工具定义
// ============================================================

/**
 * 系统提示词：告诉模型它的身份和任务
 *
 * 关键点：
 * - 明确工作目录位置
 * - 指定可用工具（bash）
 * - 强调行动优于解释
 */
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use bash to solve tasks. Act, don't explain.`;

/**
 * OpenAI 工具定义接口
 *
 * OpenAI 格式与 Anthropic 略有不同
 */
interface ChatCompletionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * 可用工具列表
 *
 * s01 只有一个 bash 工具，保持最简
 */
const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Run a shell command.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
        },
        required: ['command'],
      },
    },
  },
];

// ============================================================
// 第三部分：工具执行函数
// ============================================================

/**
 * 执行 bash 命令
 *
 * 安全措施：
 * - 阻止危险命令（rm -rf /, sudo, shutdown 等）
 * - 超时限制：120 秒
 * - 输出长度限制：50000 字符
 *
 * @param command - 要执行的 shell 命令
 * @returns 命令输出（stdout + stderr）
 */
async function runBash(command: string): Promise<string> {
  // 危险命令黑名单
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];

  // 检查是否包含危险命令
  if (dangerous.some(d => command.includes(d))) {
    return 'Error: Dangerous command blocked';
  }

  // 动态导入 Node.js 内置模块
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // 执行命令
    const { stdout, stderr } = await execAsync(command, {
      cwd: WORKDIR,        // 在工作目录下执行
      timeout: 120000,     // 120 秒超时
    });

    // 合并 stdout 和 stderr
    const output = (stdout + stderr).trim();

    // 返回输出，限制长度
    return output ? output.slice(0, 50000) : '(no output)';
  } catch (error) {
    // 处理超时或其他错误
    if (error instanceof Error && 'killed' in error && error.killed) {
      return 'Error: Timeout (120s)';
    }
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================
// 第四部分：Agent 核心循环
// ============================================================

/**
 * ============================================================
 * 核心模式：Agent 循环（OpenAI 版本）
 * ============================================================
 *
 * 工作流程：
 * 1. 调用 LLM，传入当前消息历史和可用工具
 * 2. 检查响应是否包含 tool_calls
 * 3. 如果包含工具调用：
 *    a. 执行每个工具
 *    b. 收集工具结果
 *    c. 将结果作为 tool 消息添加回历史
 *    d. 回到步骤 1（循环）
 * 4. 如果没有工具调用：退出循环，完成
 *
 * @param messages - 对话历史（会被原地修改）
 */
async function agentLoop(messages: OpenAI.ChatCompletionMessageParam[]): Promise<void> {
  // ============================================================
  // 主循环：持续运行直到模型不再调用工具
  // ============================================================
  let round = 0;  // 轮次计数器

  while (true) {
    round++;

    // ============================================================
    // 调试：打印发送的消息
    // ============================================================
    if (DEBUG) {
      printSeparator(`LLM 调用 #${round}`);
      printMessagesSent(messages, round);
    }

    // --------------------------------------------------------
    // 步骤 1：调用 LLM 获取响应
    // --------------------------------------------------------
    const response = await client.chat.completions.create({
      model: MODEL,              // 使用的模型
      messages: messages,        // 消息历史
      tools: TOOLS,              // 可用工具列表
      max_tokens: 8000,          // 最大输出 token 数
    });

    // --------------------------------------------------------
    // 步骤 2：获取助手的回复
    // --------------------------------------------------------
    const assistantMessage = response.choices[0].message;

    // ============================================================
    // 调试：打印 LLM 响应
    // ============================================================
    if (DEBUG) {
      printLLMResponse(response, round);
    }

    // 将助手消息添加到历史
    messages.push(assistantMessage);

    // --------------------------------------------------------
    // 步骤 3：检查是否调用了工具
    // --------------------------------------------------------
    // OpenAI 格式：assistantMessage.tool_calls 是数组
    // 如果没有工具调用，tool_calls 为 undefined
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // 模型没有调用工具，对话结束
      if (DEBUG) {
        console.log(`\n\x1b[32m✅ 对话结束：模型没有调用工具\x1b[0m`);
      }
      return;
    }

    // --------------------------------------------------------
    // 步骤 4：执行工具并收集结果
    // --------------------------------------------------------
    for (const toolCall of assistantMessage.tool_calls) {
      // OpenAI 格式：
      // - toolCall.id: 工具调用的唯一 ID
      // - toolCall.function.name: 工具名称
      // - toolCall.function.arguments: JSON 字符串格式的参数

      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      console.log(`\n\x1b[33m⚡ 执行: $ ${functionArgs.command}\x1b[0m`);

      // 执行命令
      const output = await runBash(functionArgs.command as string);

      // ============================================================
      // 调试：打印工具执行结果
      // ============================================================
      if (DEBUG) {
        printToolResult(functionName, toolCall.id, output);
      }

      // ------------------------------------------------------
      // 步骤 5：将工具结果添加到消息历史
      // ------------------------------------------------------
      // OpenAI 格式：role: "tool"，tool_call_id 匹配对应的工具调用
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: output,
      });
    }

    // --------------------------------------------------------
    // 循环继续：回到步骤 1，让模型基于工具结果决定下一步
    // --------------------------------------------------------
    if (DEBUG) {
      console.log(`\n\x1b[90m⟳ 继续循环，等待模型下一步决策...\x1b[0m`);
    }
  }
}

// ============================================================
// 第五部分：REPL（交互式命令行）
// ============================================================

/**
 * 主函数：运行交互式命令行
 *
 * REPL = Read-Eval-Print Loop
 * - Read: 读取用户输入
 * - Eval: 执行 agent loop
 * - Print: 打印结果
 * - Loop: 重复
 */
async function main() {
  // 导入 readline 模块（用于读取命令行输入）
  const { createInterface } = await import('readline');

  // 创建 readline 接口
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  /**
   * 消息历史：存储整个对话
   *
   * OpenAI 格式的消息结构：
   * [
   *   { role: 'system', content: '...' },    // 可选的系统提示
   *   { role: 'user', content: '用户输入' },
   *   { role: 'assistant', content: '...', tool_calls: [...] },
   *   { role: 'tool', tool_call_id: '...', content: '工具结果' },
   *   ...
   * ]
   */
  const history: OpenAI.ChatCompletionMessageParam[] = [];

  // 添加系统消息
  history.push({ role: 'system', content: SYSTEM });

  /**
   * 读取用户输入的辅助函数
   */
  const query = (): Promise<string> =>
    new Promise(resolve => {
      rl.question('\x1b[36ms01 >> \x1b[0m', resolve); // 青色提示符
    });

  console.log('='.repeat(50));
  console.log('  Agent s01 - 基础循环 (OpenAI 版本)');
  console.log('  输入任务，或输入 q/exit 退出');
  if (DEBUG) {
    console.log('  \x1b[33m调试模式：开启\x1b[0m');
  }
  console.log('='.repeat(50));
  console.log('');

  try {
    // --------------------------------------------------------
    // 主循环：持续读取用户输入
    // --------------------------------------------------------
    let conversationRound = 0;  // 对话轮次

    while (true) {
      conversationRound++;
      const input = await query();
      const trimmed = input.trim().toLowerCase();

      // 检查退出命令
      if (trimmed === '' || trimmed === 'q' || trimmed === 'exit') {
        console.log('再见！');
        break;
      }

      // ============================================================
      // 调试：显示用户输入
      // ============================================================
      if (DEBUG) {
        console.log('');
        printSeparator(`用户输入 #${conversationRound}`);
        console.log(`\x1b[32m👤 用户: ${input}\x1b[0m`);
      }

      // 将用户输入添加到历史
      history.push({ role: 'user', content: input });

      // ------------------------------------------------------
      // 核心：运行 agent loop
      // ------------------------------------------------------
      await agentLoop(history);

      // ============================================================
      // 调试：显示当前历史状态
      // ============================================================
      if (DEBUG) {
        console.log(`\n\x1b[90m📚 当前历史记录: ${history.length} 条消息\x1b[0m`);
      }

      // ------------------------------------------------------
      // 打印助手的最终回复
      // ------------------------------------------------------
      const lastMessage = history[history.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // 打印文字回复
        if ('content' in lastMessage && lastMessage.content) {
          console.log(`\n\x1b[34m🤖 Agent 最终回复:\x1b[0m`);
          console.log(`  "${lastMessage.content}"`);
        }
        // 如果只有工具调用没有文字
        else if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
          console.log(`\n\x1b[34m🤖 Agent 调用了 ${lastMessage.tool_calls.length} 个工具，没有额外文字\x1b[0m`);
        }
      }

      // ============================================================
      // 调试：显示当前历史状态
      // ============================================================
      if (DEBUG) {
        console.log(`\n\x1b[90m📚 当前历史记录: ${history.length} 条消息\x1b[0m`);
      }

      console.log(''); // 空行分隔
    }
  } finally {
    // 确保 readline 接口被关闭
    rl.close();
  }
}

// ============================================================
// 程序入口
// ============================================================
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
