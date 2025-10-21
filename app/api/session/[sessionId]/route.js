import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/sessionStore.js";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { sessionId } = params || {};
  if (!sessionId) {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }
  const data = getSession(sessionId);
  if (!data) {
    return NextResponse.json({ error: "会话不存在。" }, { status: 404 });
  }
  return NextResponse.json({
    sessionId,
    history: data.history,
    memory: data.memory,
    levels: data.memoryLevels,
    updatedAt: data.updatedAt,
  });
}
