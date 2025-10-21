import { randomUUID } from "crypto";

const sessions = new Map();

export function getOrCreateSession(providedId) {
  if (providedId && sessions.has(providedId)) {
    return { id: providedId, data: sessions.get(providedId) };
  }
  const id = providedId || randomUUID();
  const data = {
    history: [],
    memory: null,
    memoryLevels: [],
    updatedAt: new Date().toISOString(),
  };
  sessions.set(id, data);
  return { id, data };
}

export function getSession(id) {
  return sessions.get(id);
}

export function updateSession(id, updater) {
  const data = sessions.get(id);
  if (!data) {
    return null;
  }
  const next = updater(data);
  sessions.set(id, next);
  return next;
}
