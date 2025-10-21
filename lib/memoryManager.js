import { chatCompletion } from "./deepseekClient.js";
import {
  memoryUpdateSystemPrompt,
  responseGenerationSystemPrompt,
  memoryUpdateUserPrompt,
  responseGenerationUserPrompt
} from "./prompts.js";

/**
 * 格式化对话历史为文本
 */
function formatDialogue(messages) {
  return messages
    .map((msg) => {
      const speaker = msg.role === "user" ? "用户" : msg.role === "assistant" ? "助手" : msg.role;
      return `${speaker}: ${msg.content}`;
    })
    .join("\n");
}

/**
 * 提取JSON块
 */
function extractJsonBlock(text) {
  // 尝试多种JSON提取方法
  const jsonPatterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /\{[\s\S]*\}/
  ];
  
  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const jsonStr = match[1] || match[0];
        return JSON.parse(jsonStr);
      } catch (err) {
        continue;
      }
    }
  }
  
  // 如果模式匹配失败，尝试直接查找JSON
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (err) {
    return null;
  }
}

/**
 * 标准化记忆结构 - 简化为原始记忆和记忆摘要
 */
function truncate(text, limit = 160) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function normalizeMemory(raw) {
  const summaryFromInput = Array.isArray(raw?.memory_summary) ? raw.memory_summary : [];

  const rawEntries = Array.isArray(raw?.raw_memory_entries)
    ? raw.raw_memory_entries.map((item, idx) => ({
        id: item.id || summaryFromInput[idx]?.id || `entry-${idx + 1}`,
        user_question: item.user_question || "",
        assistant_answer: item.assistant_answer || "",
        notes: item.notes ?? "",
      }))
    : [];

  const ensuredRawEntries = rawEntries.length
    ? rawEntries
    : summaryFromInput.map((item, idx) => ({
        id: item.id || `entry-${idx + 1}`,
        user_question: "",
        assistant_answer: "",
        notes: "",
      }));

  const summary = ensuredRawEntries.map((entry, idx) => {
    const baseSummary = summaryFromInput[idx]?.summary?.trim?.();

    if (baseSummary) {
      return {
        id: summaryFromInput[idx]?.id || entry.id || `summary-${idx + 1}`,
        summary: baseSummary
      };
    }

    const questionSnippet = truncate(entry.user_question, 80);
    const answerSnippet = truncate(entry.assistant_answer || entry.notes, 100);

    const questionClause = questionSnippet ? `用户询问${questionSnippet}` : "";
    const answerClause = answerSnippet ? `助手回应${answerSnippet}` : "";

    let summaryText = "";
    if (questionClause && answerClause) {
      summaryText = `${questionClause}；${answerClause}`;
    } else if (answerClause) {
      summaryText = answerClause;
    } else if (questionClause) {
      summaryText = questionClause;
    }

    if (!summaryText) {
      summaryText = "(未生成摘要)";
    }

    return {
      id: summaryFromInput[idx]?.id || entry.id || `summary-${idx + 1}`,
      summary: summaryText
    };
  });

  return {
    memory_summary: summary,
    raw_memory_entries: ensuredRawEntries
  };
}

/**
 * Step 1: 记忆更新
 * 将历史记忆与新对话融合，输出新的记忆摘要
 */
export async function updateMemory(previousMemory, newDialogue) {
  try {
    const previousSummaryText = JSON.stringify(previousMemory?.memory_summary ?? [], null, 2);
    const previousRawMemoryText = JSON.stringify(previousMemory?.raw_memory_entries ?? [], null, 2);
    const newDialogueText = formatDialogue(newDialogue);
    
    const userPrompt = memoryUpdateUserPrompt
      .replace("{{PREVIOUS_SUMMARY}}", previousSummaryText)
      .replace("{{PREVIOUS_RAW_MEMORY}}", previousRawMemoryText)
      .replace("{{NEW_DIALOGUE}}", newDialogueText);

    const response = await chatCompletion(
      [
        { role: "system", content: memoryUpdateSystemPrompt },
        { role: "user", content: userPrompt }
      ],
      { temperature: 0.2 }
    );

    console.log("模型原始输出:", response.text);

    const parsed = extractJsonBlock(response.text);
    if (!parsed || !parsed.memory_summary) {
      // 如果解析失败，尝试创建默认记忆结构
      console.warn("无法解析模型输出，使用默认记忆结构");
      return {
        updated_memory: normalizeMemory({
          memory_summary: [],
          raw_memory_entries: []
        }),
        no_new_info: true
      };
    }

    return {
      updated_memory: normalizeMemory(parsed),
      no_new_info: parsed.no_new_info || false
    };
  } catch (error) {
    console.error("记忆更新失败:", error);
    // 返回默认记忆结构而不是抛出错误
    return {
      updated_memory: normalizeMemory({
        memory_summary: [],
        raw_memory_entries: []
      }),
      no_new_info: true
    };
  }
}

/**
 * Step 2: 基于记忆的回答生成
 * 读取最新记忆摘要，结合当前对话上下文生成回复
 */
export async function generateResponse(updatedMemory, currentDialogue) {
  try {
    const summaryText = JSON.stringify(updatedMemory?.memory_summary ?? [], null, 2);
    const rawMemoryText = JSON.stringify(updatedMemory?.raw_memory_entries ?? [], null, 2);
    const currentDialogueText = formatDialogue(currentDialogue);
    
    const userPrompt = responseGenerationUserPrompt
      .replace("{{MEMORY_SUMMARY}}", summaryText)
      .replace("{{RAW_MEMORY_ENTRIES}}", rawMemoryText)
      .replace("{{CURRENT_DIALOGUE}}", currentDialogueText);

    const response = await chatCompletion(
      [
        { role: "system", content: responseGenerationSystemPrompt },
        { role: "user", content: userPrompt }
      ],
      { temperature: 0.6 }
    );

    const parsed = extractJsonBlock(response.text);
    if (!parsed || typeof parsed.response !== "string") {
      console.warn("回答生成解析失败，返回原始文本");
      return {
        response: response.text.trim(),
        updated_memory: updatedMemory,
        analysis: null,
        clarification_needed: false
      };
    }

    return {
      response: parsed.response.trim(),
      updated_memory: normalizeMemory(parsed),
      analysis: parsed.analysis || null,
      clarification_needed: parsed.clarification_needed || false
    };
  } catch (error) {
    console.error("回答生成失败:", error);
    // 返回默认回答而不是抛出错误
    return {
      response: "抱歉，我遇到了一些技术问题，无法生成回复。请稍后再试。",
      updated_memory: normalizeMemory({
        memory_summary: [],
        raw_memory_entries: []
      }),
      analysis: null,
      clarification_needed: true
    };
  }
}

/**
 * 两步处理：记忆更新 + 回答生成
 */
export async function processWithTwoStepMemory(previousMemory, newDialogue, currentDialogue) {
  try {
    // Step 1: 更新记忆
    const memoryResult = await updateMemory(previousMemory, newDialogue);
    
    // Step 2: 生成回答
    const responseResult = await generateResponse(memoryResult.updated_memory, currentDialogue);
    
    return {
      updated_memory: responseResult.updated_memory,
      no_new_info: memoryResult.no_new_info,
      response: responseResult.response,
      analysis: responseResult.analysis,
      clarification_needed: responseResult.clarification_needed,
      debug_info: {
        memory_update_prompt: {
          system: memoryUpdateSystemPrompt,
          user: memoryUpdateUserPrompt
            .replace("{{PREVIOUS_SUMMARY}}", JSON.stringify(previousMemory?.memory_summary ?? [], null, 2))
            .replace("{{PREVIOUS_RAW_MEMORY}}", JSON.stringify(previousMemory?.raw_memory_entries ?? [], null, 2))
            .replace("{{NEW_DIALOGUE}}", formatDialogue(newDialogue))
        },
        response_generation_prompt: {
          system: responseGenerationSystemPrompt,
          user: responseGenerationUserPrompt
            .replace("{{MEMORY_SUMMARY}}", JSON.stringify(memoryResult.updated_memory?.memory_summary ?? [], null, 2))
            .replace("{{RAW_MEMORY_ENTRIES}}", JSON.stringify(memoryResult.updated_memory?.raw_memory_entries ?? [], null, 2))
            .replace("{{CURRENT_DIALOGUE}}", formatDialogue(currentDialogue))
        }
      }
    };
  } catch (error) {
    console.error("两步处理失败:", error);
    // 返回默认结果而不是抛出错误
    return {
      updated_memory: normalizeMemory({
        memory_summary: [],
        raw_memory_entries: []
      }),
      no_new_info: true,
      response: "抱歉，我遇到了一些技术问题，无法正常处理您的请求。请稍后再试。",
      analysis: null,
      clarification_needed: true,
      debug_info: {
        memory_update_prompt: {
          system: memoryUpdateSystemPrompt,
          user: "Error: 无法生成提示词"
        },
        response_generation_prompt: {
          system: responseGenerationSystemPrompt,
          user: "Error: 无法生成提示词"
        }
      }
    };
  }
}
