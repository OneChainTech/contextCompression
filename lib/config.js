const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL_ID = "deepseek-ai/DeepSeek-V3.2-Exp";
export function getConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    modelId: process.env.MODEL_ID || DEFAULT_MODEL_ID
  };
}

export function ensureApiKey() {
  const { apiKey } = getConfig();
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY，无法调用 DeepSeek 接口。");
  }
}
