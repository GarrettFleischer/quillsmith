export function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevron({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={`${className ?? ""} transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="m6 4 5 4-5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPin({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8.8 2.4 13.6 7.2l-1.15.35-2.4 2.4.7 3.15L8 10.4l-3.7 3.2.2-2.55L2.4 9.2l3.15.7 2.4-2.4.35-1.15Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.25h7.25A1.75 1.75 0 0 1 12.5 5v7.5H5.25A1.75 1.75 0 0 1 3.5 10.75V3.25Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M3.5 10.75h8.25" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.75 9.1 6.15 13.5 7.25 9.1 8.35 8 12.75 6.9 8.35 2.5 7.25 6.9 6.15 8 1.75Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 2.4v1.4M8 12.2v1.4M2.4 8h1.4M12.2 8h1.4M4.05 4.05l.99.99M11 11l.99.99M11.96 4.05l-.99.99M4.99 11l-.99.99"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13.5s4-3.35 4-6.15A4 4 0 0 0 4 7.35C4 10.15 8 13.5 8 13.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="7.25" r="1.35" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconScroll({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.5 4.25h7.25v8.1c0 .7-.55 1.15-1.25 1.15H4.5V4.25Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M4.5 4.25c0-.9.7-1.5 1.5-1.5h.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 7h4M6.5 9.25h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function IconItem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.75 13.25 8 8 13.25 2.75 8 8 2.75Z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconDoc({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 2.75h4.2L12.5 6v7.25H5V2.75Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.2 2.75V6H12.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconStory({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5h9v9h-9z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 6.25h4M6 8.5h4M6 10.75h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
