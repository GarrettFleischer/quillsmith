export type SliderDef = {
  id: string;
  label: string;
  min: number;
  max: number;
  lowLabel: string;
  highLabel: string;
  scope: "character" | "scene";
};

export const CHARACTER_SLIDERS: SliderDef[] = [
  {
    id: "stress_harmony",
    label: "Stress ↔ harmony",
    min: -10,
    max: 10,
    lowLabel: "panic / breaking",
    highLabel: "unruffled / checked-out",
    scope: "character",
  },
];

export const SCENE_SLIDERS: SliderDef[] = [
  {
    id: "tension",
    label: "Tension",
    min: 0,
    max: 10,
    lowLabel: "still",
    highLabel: "breaking point",
    scope: "scene",
  },
  {
    id: "spice",
    label: "Heat / intimacy",
    min: 0,
    max: 10,
    lowLabel: "none",
    highLabel: "explicit",
    scope: "scene",
  },
];

export type CharacterSliderValues = Record<string, number>;

export type SceneSliderState = {
  tension?: number;
  spice?: number;
  characters?: Record<string, CharacterSliderValues>;
};

export function parseSliderMap(json?: string | null): CharacterSliderValues {
  if (!json?.trim()) return {};
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const out: CharacterSliderValues = {};
    for (const [key, value] of Object.entries(obj)) {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function parseSceneSliders(json?: string | null): SceneSliderState {
  if (!json?.trim()) return {};
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const charactersRaw =
      obj.characters && typeof obj.characters === "object"
        ? (obj.characters as Record<string, unknown>)
        : {};
    const characters: Record<string, CharacterSliderValues> = {};
    for (const [id, value] of Object.entries(charactersRaw)) {
      if (value && typeof value === "object") {
        const map: CharacterSliderValues = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          const n = Number(v);
          if (Number.isFinite(n)) map[k] = n;
        }
        characters[id] = map;
      }
    }
    return {
      tension: Number.isFinite(Number(obj.tension)) ? Number(obj.tension) : undefined,
      spice: Number.isFinite(Number(obj.spice)) ? Number(obj.spice) : undefined,
      characters,
    };
  } catch {
    return {};
  }
}

export function stringifySceneSliders(state: SceneSliderState): string {
  return JSON.stringify(state);
}

export function clampSlider(def: SliderDef, value: number): number {
  return Math.min(def.max, Math.max(def.min, Math.round(value)));
}

export function formatSliderLine(def: SliderDef, value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return `${def.label}: (baseline / unset)`;
  return `${def.label}: ${value} (${def.lowLabel} ${def.min} … ${def.highLabel} ${def.max})`;
}

export function sceneHasPhysics(state: SceneSliderState): boolean {
  if (state.tension != null || state.spice != null) return true;
  return Object.keys(state.characters ?? {}).length > 0;
}

export type PhysicsProposal = {
  tension?: number;
  spice?: number;
  characters?: Array<{ name: string; stress_harmony?: number }>;
};

export function mergePhysicsProposal(
  existing: SceneSliderState,
  physics: PhysicsProposal,
  characters: Array<{ id: string; name: string }>,
): SceneSliderState {
  const next: SceneSliderState = {
    ...existing,
    characters: { ...existing.characters },
  };
  if (Number.isFinite(Number(physics.tension))) next.tension = Number(physics.tension);
  if (Number.isFinite(Number(physics.spice))) next.spice = Number(physics.spice);
  for (const row of physics.characters ?? []) {
    const match = characters.find((c) => c.name.toLowerCase() === row.name.toLowerCase());
    if (!match || row.stress_harmony == null || !Number.isFinite(row.stress_harmony)) continue;
    next.characters = {
      ...next.characters,
      [match.id]: {
        ...(next.characters?.[match.id] ?? {}),
        stress_harmony: row.stress_harmony,
      },
    };
  }
  return next;
}
