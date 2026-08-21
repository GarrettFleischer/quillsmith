"use client";

export function RailStrip({
  label,
  side,
  onClick,
}: {
  label: string;
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <div
      className={`hidden shrink-0 flex-col bg-surface/70 lg:flex ${
        side === "left" ? "border-r border-border" : "border-l border-border"
      }`}
    >
      <button
        type="button"
        className="flex h-full w-10 items-center justify-center px-1 text-xs tracking-wide text-muted transition hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        aria-label={`Open ${label}`}
        onClick={onClick}
      >
        <span className="ledger-rail-label">{label}</span>
      </button>
    </div>
  );
}
