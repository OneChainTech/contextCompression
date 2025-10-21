# 上下文压缩系统 - 递归摘要长期对话记忆

基于论文《Recursively Summarizing Enables Long-Term Dialogue Memory in LLMs》实现的上下文压缩系统，完整实现“两步处理”记忆方案，并落地“记忆摘要 + 原始问答”双轨记忆结构。

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
创建 `.env` 文件：
```bash
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
MODEL_ID=deepseek-ai/DeepSeek-V3.2-Exp
```

### 3. 启动系统
```bash
npm run dev
```
访问 `http://localhost:3000`

## 🧠 核心功能

### 两步处理架构
- **Step 1 · Memory Iteration**：读取现有记忆与最新对话，生成结构化的记忆摘要列表与原始问答记录。
- **Step 2 · Memory-grounded Response Generation**：使用新的记忆摘要推理响应，同时回写（必要时更新）记忆。

### 记忆数据结构
系统使用“摘要 + 原始问答”双轨结构，既兼顾上下文检索效率，也保留复现依据：

```json
{
  "memory_summary": [
    { "id": "m-202501", "summary": "用户询问部署注意事项，助手建议使用 Docker Compose 并记录环境变量" }
  ],
  "raw_memory_entries": [
    {
      "id": "m-202501",
      "user_question": "部署的时候需要注意什么？",
      "assistant_answer": "建议使用 Docker Compose，并将环境变量写入 .env。",
      "notes": ""
    }
  ]
}
```

### 界面与调试
- 右侧记忆面板实时显示记忆摘要与对应原始问答，便于人工复核。
- API 响应中附带完整的提示词文本（`debugInfo` 字段）以支持开发调试。

## 📄 提示词模板

### Memory Iteration System Prompt
```text
You are an AI memory curator maintaining the shared project memory bank.

Your responsibilities:
- Use the current memory summary as the authoritative representation.
- Consult raw memory entries only when the summary lacks enough detail.
- Absorb new dialogue signals, keep entries atomic, and avoid redundancy.
- Store raw memory as structured Q&A records: user_question, assistant_answer, and optional notes.
- Keep the concise summary and raw entries perfectly synchronized.
- For every summary item you keep, produce a corresponding raw entry that elaborates on the same fact in full sentences.
- Summaries must be single natural-language sentences that capture the key takeaway from the assistant_answer (actions, commitments, decisions, factual answers).

Always output valid JSON with the exact shape:
{
  "memory_summary": [
    { "id": "...", "summary": "..." }
  ],
  "raw_memory_entries": [
    { "id": "...", "user_question": "...", "assistant_answer": "...", "notes": "..." }
  ]
}

Notes:
- The "notes" field can be an empty string when no extra detail is needed.
- If nothing changes, return the previous inputs unchanged.
- Do not paraphrase or shorten user_question / assistant_answer when writing raw_memory_entries; keep their wording verbatim.

> 记忆摘要以自然语言单句概括“用户提出的问题 + 助手给出的结论”，避免直接罗列原问答文本；若需补充上下文，请使用 `notes` 字段。
```

### Memory-based Response Generation System Prompt
```text
You are an assistant that grounds every reply in the curated memory summary.

Workflow:
- Treat the memory summary as the main context; consult raw entries only when clarification is needed.
- Reference relevant summary ids while reasoning.
- Produce both analysis and the final reply, then update the memory representations if new facts appear.
- Maintain one-to-one alignment between memory_summary items and raw_memory_entries.
- When updating memory_summary, ensure each entry remains a concise sentence that reflects the assistant's final takeaway for the corresponding user question.

Always respond with valid JSON containing:
{
  "analysis": {
    "relevant_summary_refs": [ { "id": "...", "justification": "..." } ],
    "plan": ["..."]
  },
  "response": "...",
  "memory_summary": [ { "id": "...", "summary": "..." } ],
  "raw_memory_entries": [ { "id": "...", "user_question": "...", "assistant_answer": "...", "notes": "..." } ],
  "clarification_needed": false
}
```

## 🔧 配置选项

### 请求参数
- `/api/chat` 接口默认使用两步记忆方案；请求体需要提供 `sessionId`（可选）与 `message`。

## 📚 项目结构

```
.
├─ app/                    # Next.js App Router 页面与 API
│  ├─ api/                 # 会话与对话接口
│  ├─ page.jsx             # 前端界面
│  └─ globals.css          # 全局样式
├─ hooks/                  # React 自定义 Hook
├─ lib/                    # 核心逻辑模块
│  ├─ memoryManager.js     # 两步处理核心逻辑
│  ├─ prompts.js           # 提示词模板管理
│  ├─ deepseekClient.js    # DeepSeek 客户端
│  └─ sessionStore.js      # 会话存储
├─ test-data.js            # 测试数据生成器
├─ test-verification.js    # 测试验证脚本
├─ test-10-rounds.js       # 10轮连续对话测试
└─ README.md               # 项目说明
```
