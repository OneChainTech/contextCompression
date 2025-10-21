"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChatSession } from "../hooks/useChatSession.js";

function MessageBubble({ role, content }) {
  return (
    <div className={`bubble ${role}`}>
      <div>{content}</div>
    </div>
  );
}

function MemoryView({ memory }) {
  if (!memory) {
    return <div className="memory-summary">暂无长期记忆。</div>;
  }

  const hasSummaryList = Array.isArray(memory.memory_summary) && memory.memory_summary.length > 0;
  const hasRawEntries = Array.isArray(memory.raw_memory_entries) && memory.raw_memory_entries.length > 0;

  if (hasSummaryList || hasRawEntries) {
    return (
      <div className="memory-summary">
        <div className="memory-section">
          <h3>记忆摘要</h3>
          {hasSummaryList ? (
            <ul className="memory-list">
              {memory.memory_summary.map((item) => (
                <li key={item.id || item.summary}>
                  <strong>{item.id || "未命名"}：</strong>
                  {item.summary}
                </li>
              ))}
            </ul>
          ) : (
            <div>无</div>
          )}
        </div>
        <div className="memory-section">
          <h3>原始记忆</h3>
          {hasRawEntries ? (
            <ul className="memory-list">
              {memory.raw_memory_entries.map((item) => (
                <li key={item.id || item.user_question || item.assistant_answer}>
                  <strong>{item.id || "未命名"}</strong>
                  <div>用户问题：{item.user_question || "未记录"}</div>
                  <div>模型回答：{item.assistant_answer || "未记录"}</div>
                  {item.notes ? <div>备注：{item.notes}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div>无</div>
          )}
        </div>
      </div>
    );
  }

  // 兼容旧结构
  return (
    <div className="memory-summary">
      <div className="memory-section">
        <h3>摘要</h3>
        <div>{memory.summary || "无"}</div>
      </div>
      <div className="memory-section">
        <h3>持久事实</h3>
        {memory.facts?.length ? (
          <ul className="memory-list">
            {memory.facts.map((fact, idx) => (
              <li key={idx}>{fact}</li>
            ))}
          </ul>
        ) : (
          <div>无</div>
        )}
      </div>
      <div className="memory-section">
        <h3>待执行动作</h3>
        {memory.actions?.length ? (
          <ul className="memory-list">
            {memory.actions.map((action, idx) => (
              <li key={idx}>{action}</li>
            ))}
          </ul>
        ) : (
          <div>无</div>
        )}
      </div>
    </div>
  );
}

function MemoryLevels({ levels }) {
  if (!levels?.length) {
    return null;
  }
  return (
    <div className="levels-list">
      {levels.map((level, levelIdx) => (
        <div className="level-card" key={`level-${levelIdx}`}>
          <h4>层级 {levelIdx + 1}</h4>
          {level.map((item, idx) => (
            <div className="source-snippet" key={`level-${levelIdx}-${idx}`}>
              <strong>摘要：</strong>
              {typeof item.summary === "object"
                ? item.summary.summary || "无"
                : item.summary}
              {Array.isArray(item.summary?.facts) && item.summary.facts.length ? (
                <>
                  {"\n"}
                  <strong>事实亮点：</strong>
                  {"\n"}
                  {item.summary.facts.join("；")}
                </>
              ) : null}
              {Array.isArray(item.summary?.actions) && item.summary.actions.length ? (
                <>
                  {"\n"}
                  <strong>行动项：</strong>
                  {"\n"}
                  {item.summary.actions.join("；")}
                </>
              ) : null}
              {"\n"}
              <strong>来源片段：</strong>
              {"\n"}
              {item.source}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const { sessionId, messages, memory, levels, loading, error, send } = useChatSession();
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const parsedMessages = useMemo(
    () =>
      messages.map((msg, idx) => ({
        key: `${msg.role}-${idx}`,
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
    [messages]
  );

  async function handleSubmit(evt) {
    evt.preventDefault();
    if (!input.trim() || loading) return;
    await send(input.trim());
    setInput("");
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h1>基于递归摘要的大模型上下文工程</h1>
      </header>
      <main className="layout">
        <section className="panel">
          <h2>对话</h2>
          <div className="messages">
            {parsedMessages.map((msg) => (
              <MessageBubble key={msg.key} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <div className="bubble assistant">
                <div>正在生成回复…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form className="input-area" onSubmit={handleSubmit}>
            <textarea
              value={input}
              placeholder="输入消息，验证长程记忆能力…"
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              发送
            </button>
          </form>
        </section>
        <aside className="panel">
          <h2>递归记忆</h2>
          <MemoryView memory={memory} />
          <MemoryLevels levels={levels} />
        </aside>
      </main>
      <footer className="status-bar">
        <span>会话 ID：{sessionId || "待建立"}</span>
        <span>{error ? `错误：${error}` : loading ? "调用模型中…" : "就绪"}</span>
      </footer>
    </div>
  );
}
