import OpenAI from "openai";
import { getConfig, ensureApiKey } from "./config.js";

let client;

export function getClient() {
  if (!client) {
    const { apiKey, baseUrl } = getConfig();
    if (!apiKey) {
      throw new Error("缺少 DEEPSEEK_API_KEY，无法初始化 DeepSeek 客户端。");
    }
    client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }
  return client;
}

export async function chatCompletion(messages, options = {}) {
  ensureApiKey();
  const { modelId } = getConfig();
  const response = await getClient().chat.completions.create({
    model: modelId,
    temperature: 0.7,
    ...options,
    messages,
  });

  const choice = response.choices?.[0];
  if (!choice?.message) {
    throw new Error("DeepSeek 响应格式异常。");
  }

  return {
    text: choice.message.content?.trim() ?? "",
    raw: response,
  };
}

// 流式输出处理函数
export async function* streamChatCompletion(messages, options = {}) {
  ensureApiKey();
  const { modelId } = getConfig();
  const stream = await getClient().chat.completions.create({
    model: modelId,
    temperature: 0.7,
    ...options,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
