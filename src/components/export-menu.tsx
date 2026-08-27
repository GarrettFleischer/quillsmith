"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCaret, IconExport } from "@/components/codex-icons";

export function ExportMenu({ novelId }: { novelId: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 176;
    let left = rect.right - width;
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 4, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? labelId : undefined}
        className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <IconExport className="h-3.5 w-3.5" />
        Export
        <IconCaret className={`h-3 w-3 ${open ? "rotate-180" : ""}`} />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={labelId}
              role="menu"
              aria-label="Export"
              className="fixed z-50 w-44 overflow-hidden rounded-md border border-border bg-surface py-1 panel-enter"
              style={{ top: pos.top, left: pos.left }}
            >
              <a
                role="menuitem"
                className="block px-3 py-1.5 text-sm hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
                href={`/api/novels/${novelId}/export?format=markdown`}
                onClick={() => setOpen(false)}
              >
                Markdown
              </a>
              <a
                role="menuitem"
                className="block px-3 py-1.5 text-sm hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
                href={`/api/novels/${novelId}/export?format=json`}
                onClick={() => setOpen(false)}
              >
                JSON
              </a>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
