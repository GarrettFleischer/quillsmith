"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose, IconPin } from "@/components/codex-icons";

const MIN_W = 340;
const MIN_H = 380;
const HEADER_H = 56;

export function FloatingPane({
  title,
  pinned,
  focused,
  x,
  y,
  width,
  height,
  z,
  onClose,
  onPin,
  onMove,
  onResize,
  onFocus,
  children,
}: {
  title: string;
  pinned: boolean;
  focused: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  onClose: () => void;
  onPin: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onFocus: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x, y });
  const [size, setSize] = useState({ width, height });
  const posRef = useRef({ x, y });
  const sizeRef = useRef({ width, height });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!drag.current) {
      posRef.current = { x, y };
      setPos({ x, y });
    }
  }, [x, y]);

  useEffect(() => {
    if (!resize.current) {
      sizeRef.current = { width, height };
      setSize({ width, height });
    }
  }, [width, height]);

  useEffect(() => {
    function measure() {
      setCompact(window.innerWidth < 1024);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!focused) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pinned) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, pinned, onClose]);

  function clampPos(nx: number, ny: number, w: number, h: number) {
    const maxX = Math.max(8, window.innerWidth - 48);
    const maxY = Math.max(HEADER_H, window.innerHeight - 48);
    return {
      x: Math.min(Math.max(8 - w + 48, nx), maxX),
      y: Math.min(Math.max(HEADER_H, ny), maxY),
    };
  }

  function onDragStart(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    onFocus();
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = clampPos(
      e.clientX - drag.current.dx,
      e.clientY - drag.current.dy,
      sizeRef.current.width,
      sizeRef.current.height,
    );
    posRef.current = next;
    setPos(next);
  }

  function onDragEnd() {
    if (!drag.current) return;
    drag.current = null;
    onMove(posRef.current.x, posRef.current.y);
  }

  function onResizeStart(e: PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onFocus();
    resize.current = { sx: e.clientX, sy: e.clientY, w: size.width, h: size.height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: PointerEvent<HTMLButtonElement>) {
    if (!resize.current) return;
    const next = {
      width: Math.max(MIN_W, resize.current.w + (e.clientX - resize.current.sx)),
      height: Math.max(MIN_H, resize.current.h + (e.clientY - resize.current.sy)),
    };
    sizeRef.current = next;
    setSize(next);
  }

  function onResizeEnd() {
    if (!resize.current) return;
    resize.current = null;
    onResize(sizeRef.current.width, sizeRef.current.height);
  }

  if (!mounted) return null;

  const style = compact
    ? { top: 56, left: 8, right: 8, bottom: 8, width: "auto" as const, height: "auto" as const }
    : { top: pos.y, left: pos.x, width: size.width, height: size.height };

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      onPointerDown={onFocus}
      className={`fixed flex flex-col overflow-hidden rounded-lg border bg-surface ${
        focused ? "border-accent/50" : "border-border"
      }`}
      style={{
        ...style,
        zIndex: focused ? 39 : 33 + (z % 5),
        boxShadow: focused
          ? "0 1px 0 color-mix(in oklab, var(--text) 8%, transparent), 0 18px 40px color-mix(in oklab, var(--text) 16%, transparent)"
          : "0 1px 0 color-mix(in oklab, var(--text) 8%, transparent), 0 12px 28px color-mix(in oklab, var(--text) 12%, transparent)",
      }}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none select-none items-center gap-1 border-b border-border bg-surface-2/60 px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={compact ? undefined : onDragStart}
        onPointerMove={compact ? undefined : onDragMove}
        onPointerUp={compact ? undefined : onDragEnd}
        onPointerCancel={compact ? undefined : onDragEnd}
      >
        <button
          type="button"
          aria-pressed={pinned}
          title={pinned ? "Unpin window" : "Pin window"}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            pinned ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface hover:text-text"
          }`}
          onClick={onPin}
        >
          <IconPin className="h-3.5 w-3.5" filled={pinned} />
          Pin
        </button>
        <p className="min-w-0 flex-1 truncate px-1 text-sm">{title}</p>
        <button
          type="button"
          aria-label="Close"
          className="rounded p-1 text-muted hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onClose}
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {compact ? null : (
        <button
          type="button"
          aria-label="Resize"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
        >
          <span className="absolute right-1 bottom-1 block h-2 w-2 border-r border-b border-muted" />
        </button>
      )}
    </div>,
    document.body,
  );
}
