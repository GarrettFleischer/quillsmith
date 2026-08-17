"use client";

import { useEffect, useRef, useState } from "react";
import type { ToolTraceEntry } from "@/lib/agent-stream-client";

export function AgentTracePanel({
  thinking,
  tools,
  collapsed,
  onToggle,
  live = false,
}: {
  thinking: string;
  tools: ToolTraceEntry[];
  collapsed: boolean;
  onToggle?: () => void;
  live?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [faded, setFaded] = useState(false);
  const hasReasoning = Boolean(thinking.trim());
  const hasTrace = hasReasoning || tools.length > 0;
  const expanded = live || !collapsed;
  const toolCount = tools.length;
  const summary = [
    toolCount ? `${toolCount} tool${toolCount === 1 ? "" : "s"}` : null,
    hasReasoning ? "reasoning" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    const el = scroller.current;
    if (!el || !expanded) return;
    el.scrollTop = el.scrollHeight;
    setFaded(el.scrollTop > 2);
  }, [thinking, tools, expanded]);

  if (!hasTrace) return null;

  return (
    <div className="max-w-[14rem]">
      <button
        type="button"
        className="text-[10px] uppercase tracking-wide text-muted"
        onClick={live ? undefined : onToggle}
        disabled={live || !onToggle}
      >
        {expanded ? "▾" : "▸"} {summary || "trace"}
      </button>
      {expanded ? (
        <div
          ref={scroller}
          className={`mt-1 max-h-28 overflow-y-auto text-xs leading-relaxed text-muted ${
            faded ? "agent-trace-viewport" : ""
          }`}
          onScroll={(e) => setFaded(e.currentTarget.scrollTop > 2)}
        >
          {hasReasoning ? (
            <pre className="whitespace-pre-wrap font-sans">{thinking}</pre>
          ) : null}
          {tools.map((tool) => (
            <p key={tool.id} className="mt-0.5">
              {tool.phase === "done" ? "✓" : "→"} {tool.name}
              {tool.phase === "start" && tool.args ? `(${tool.args})` : ""}
              {tool.phase === "done" && tool.preview ? ` ${tool.preview}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
