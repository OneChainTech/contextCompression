import { useEffect, useRef, useState } from "react";

async function request(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "请求失败");
  }

  return res.json();
}

export function useChatSession() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [memory, setMemory] = useState(null);
  const [levels, setLevels] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function ensureSession() {
    if (sessionId) {
      return sessionId;
    }
    const result = await request("/api/session", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setSessionId(result.sessionId);
    return result.sessionId;
  }

  async function send(text) {
    setError(null);
    setLoading(true);
    try {
      const id = await ensureSession();
      const optimistic = [...messages, { role: "user", content: text }];
      setMessages(optimistic);
      const result = await request("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId: id,
          message: text,
          stream: false
        })
      });

      if (!mounted.current) return;

      setSessionId(id);
      setMessages([...optimistic, { role: "assistant", content: result.reply }]);
      setMemory(result.memory || null);
      setLevels(result.levels || []);
      setDebugInfo(result.debugInfo || null);
    } catch (err) {
      console.error(err);
      if (mounted.current) {
        setError(err.message || "发送失败");
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  return {
    sessionId,
    messages,
    memory,
    levels,
    debugInfo,
    loading,
    error,
    send,
  };
}
