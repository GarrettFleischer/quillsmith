"use client";

import type { SliderDef } from "@/lib/sliders";

export function SliderFields({
  defs,
  values,
  onChange,
}: {
  defs: SliderDef[];
  values: Record<string, number>;
  onChange: (id: string, value: number) => void;
}) {
  return (
    <div className="space-y-2">
      {defs.map((def) => {
        const value = values[def.id] ?? Math.round((def.min + def.max) / 2);
        return (
          <label key={def.id} className="block">
            <span className="flex justify-between text-[11px] text-muted">
              <span>{def.label}</span>
              <span>{value}</span>
            </span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              value={value}
              onChange={(e) => onChange(def.id, Number(e.target.value))}
              className="mt-1 w-full accent-[var(--accent)]"
            />
            <span className="flex justify-between text-[10px] text-muted">
              <span>{def.lowLabel}</span>
              <span>{def.highLabel}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
