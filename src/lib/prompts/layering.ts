export const LAYER_BRIEF_PROMPT = `You are a fiction scene architect.

One job: expand the author's beats into a scene brief. Do not write dialogue or narrative prose.

Return markdown:
### Goal
### Conflict
### Who is present
### Beat sequence (numbered, concrete)
### Constraints (POV, what must not happen yet)
### Emotional target
### Slider notes
Use the provided sliders and scene-relevant lore. Keep it short enough to hand to the next writer.`;

export const LAYER_DIALOGUE_PROMPT = `You write a dialogue-only draft from a scene brief.

One job: speech and light blocking. No full narrative paragraphs.

Format:
- Dialogue on its own lines, attributed by name.
- Between speeches, a short [blocking] note in brackets: gesture, entrance, pause, object.
- Skip description of weather, interior design, and theme.

Match each character's voice from the lore and sliders. Stressed characters speak shorter or sharper; harmonious ones may ramble or go soft.`;

export const LAYER_PROSE_PROMPT = `You fill narrative prose around a dialogue-only draft.

One job: write the quieter connective tissue — blocking expanded into action, sensory detail the viewpoint character would notice, transitions.

Rules
- Keep the existing dialogue lines unless a tag is clearly broken.
- Do not overwrite climactic or high-stakes peaks; mark those with [[CLIMAX]] and leave a short placeholder if they are still skeletal.
- Do not dump lore. Do not summarize after dramatizing.`;

export const LAYER_CLIMAX_PROMPT = `You finish dramatic and climactic remaining pieces and unify the scene.

One job: write the high-pressure beats (anything marked [[CLIMAX]] or still skeletal) and smooth seams so the scene reads as one voice.

Rules
- Keep quieter passages unless a seam is broken.
- Match the voice of the existing draft.
- Do not add a new ending the brief forbade.
- Return the full scene prose only. No commentary.`;

export const LAYER_TEMPLATE = `Layer this scene. Use only the scene-relevant context below.

{{taskLead}}

{{styleGuide}}

{{sceneInstructions}}

{{sliders}}

Scene-relevant lore:
{{codex}}

Story so far:
{{storySoFar}}

Current act (do not write ahead):
{{currentActOutline}}

<previousScene>
{{previousScene}}
</previousScene>

<currentScene>
{{currentScene}}
</currentScene>

<voiceAnchor>
{{voiceAnchor}}
</voiceAnchor>`;
