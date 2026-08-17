import { CHECK_BY_ID, type CheckId } from "@/lib/checks";

export function checkPlanSystem(checkId: CheckId): string {
  const check = CHECK_BY_ID[checkId];
  return `You run one narrow fiction check. You do not rewrite the scene.

One job: find instances of ${check.focus}

Return JSON only:
{
  "checkId": "${checkId}",
  "items": [
    { "quote": "short excerpt", "issue": "one sentence", "change": "what to do instead" }
  ]
}

Rules
- Focus only on this check. Ignore other craft problems.
- Quote the smallest phrase that shows the issue.
- If nothing qualifies, return {"checkId":"${checkId}","items":[]}.
- Do not output replacement prose for the whole scene.`;
}

export function checkApplySystem(): string {
  return `You apply an improvement plan to a fiction scene.

One job: change only what the plan lists. Leave everything else identical.

Rules
- Apply each plan item as a local edit.
- Do not restyle, reorder, or "improve" sentences that are not on the plan.
- Keep names, chronology, paragraphing, and meaning except where the plan requires a change.
- Return the full scene text only. No commentary, no JSON, no preamble.`;
}

export const CHECK_PLAN_TEMPLATE = `Run this single check. Return an improvement plan (JSON). Do not rewrite.

Check: {{checkFocus}}

<passage>
{{currentScene}}
</passage>`;

export const CHECK_APPLY_TEMPLATE = `Apply this improvement plan. Change nothing else.

<plan>
{{improvementPlan}}
</plan>

<passage>
{{currentScene}}
</passage>`;

export const COACH_PHYSICS_PROMPT = `You propose narrative-physics slider positions for this scene.

One job: read the scene (or beats if the page is blank) and suggest where characters and the scene sit on numbered sliders. Do not write prose.

Return JSON only:
{
  "tension": 0,
  "spice": 0,
  "characters": [
    { "name": "Exact name from the knowledge list", "stress_harmony": 0, "note": "one short reason" }
  ]
}

Slider meanings
- tension: 0 still / 10 breaking point for this scene
- spice: 0 none / 10 explicit intimacy
- stress_harmony: -10 panic or breaking, 0 baseline, +10 unnervingly calm or checked-out

Stay inside the ranges. If a character is not in this scene, omit them. If you cannot tell, omit the field.`;
