import { NextResponse } from "next/server";
import { getOrCreateSession } from "../../../lib/sessionStore.js";
import { processWithTwoStepMemory } from "../../../lib/memoryManager.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { message, sessionId } = body || {};

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "缺少 message 字段。" }, { status: 400 });
  }

  try {
    const { id, data } = getOrCreateSession(sessionId);
    data.history.push({ role: "user", content: message });

    // 仅使用两步处理方式
    const newDialogue = data.history.slice(-6); // 最近3轮对话
    const currentDialogue = data.history.slice(-2); // 当前对话

    const result = await processWithTwoStepMemory(
      data.memory,
      newDialogue,
      currentDialogue
    );

    const reply = result.response;
    const updatedMemory = result.updated_memory;
    const debugInfo = result.debug_info;

    data.memory = updatedMemory;
    data.memoryLevels = [];
    data.analysis = result.analysis || null;
    data.clarificationNeeded = result.clarification_needed || false;

    data.history.push({ role: "assistant", content: reply });
    data.updatedAt = new Date().toISOString();

    return NextResponse.json({
      sessionId: id,
      reply,
      memory: data.memory,
      levels: data.memoryLevels || [],
      debugInfo: debugInfo
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "调用 DeepSeek 接口失败。" },
      { status: 500 }
    );
  }
}
