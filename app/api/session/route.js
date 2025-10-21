import { NextResponse } from "next/server";
import { getOrCreateSession } from "../../../lib/sessionStore.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { sessionId } = body || {};
  const { id } = getOrCreateSession(sessionId);
  return NextResponse.json({ sessionId: id });
}
