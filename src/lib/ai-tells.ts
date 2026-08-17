/** Canonical AI-tell taxonomy for generation-time prevention and cleanup-time scrubbers. */

export type AiTellId =
  | "metaphor_stacking"
  | "list_rhythm_stacking"
  | "rule_of_three"
  | "contrast_structures"
  | "brochure_language"
  | "meaning_commentary"
  | "elegant_variation"
  | "fake_fancy_verbs"
  | "emotional_shorthand"
  | "clean_pivot_tics";

export type AiTell = {
  id: AiTellId;
  label: string;
  description: string;
  examples: string[];
  fixGuidance: string;
  detectPrompt: string;
  rewritePrompt: string;
  densityThresholdPer1k?: number;
};

export const AI_TELLS: AiTell[] = [
  {
    id: "metaphor_stacking",
    label: "Metaphor stacking",
    description:
      "Grand images and personification glued onto vague objects or feelings, stacked until the page feels like poetry mode.",
    examples: [
      "the building breathe around her",
      "kindness could be used as a gag",
      "truth came in flavors",
      "the word had begun to taste metallic",
      "cities breathing with innovation",
    ],
    fixGuidance:
      "Keep at most one metaphor that reveals something specific about this character or situation. Cut the rest. Prefer concrete sensory fact.",
    densityThresholdPer1k: 6,
    detectPrompt: `You hunt ONE pattern: metaphor stacking and personification of inanimate things or abstractions.

Flag a hit when the prose assigns human action, grand feeling, or poetic transformation to a vague object, concept, or atmosphere — especially when several such images appear close together.

Do not flag a single grounded comparison that belongs to this character's point of view.

Return JSON only:
{"hits":[{"quote":"...","pattern":"metaphor_stacking","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite the passage to cut metaphor stacking and personification of vague objects. Keep at most one metaphor that reveals something specific. Replace the rest with concrete action, dialogue, or sensory fact owned by this scene. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "list_rhythm_stacking",
    label: "List rhythm stacking",
    description:
      "Stacked parallel details used as faux-precision: The gap… The click… The squeak…",
    examples: [
      "The 7-minute gap… The lazy click… The way nurse Pauline's rubber soles squeaked…",
      "A corner of meal-tray paper, thread pulled from her blanket, the tiny pencil stolen from group therapy.",
    ],
    fixGuidance:
      "One list of details can work. Break the drumbeat: turn some items into action, bury others, or keep two instead of a stacked cadence.",
    densityThresholdPer1k: 4,
    detectPrompt: `You hunt ONE pattern: list rhythm stacking.

Flag when the prose stacks three or more parallel noun phrases, "The X… The Y… The Z…" beats, or itemized sensory catalogs that create a mechanical drumbeat of faux-precision.

Do not flag a single ordinary two-item pairing.

Return JSON only:
{"hits":[{"quote":"...","pattern":"list_rhythm_stacking","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite to break list-rhythm stacking. Keep the facts. Convert stacked catalogs into mixed sentence shapes: some action, some one detail, some two. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "rule_of_three",
    label: "Rule of three",
    description:
      "Mechanical triple lists of adjectives, nouns, or clauses used as a profundity template.",
    examples: [
      "cold, quiet, and unforgiving",
      "Mara was unstable. Mara was paranoid. Mara needed help.",
      "economically, socially, and culturally",
      "shame, then tenderness, then a dangerous aching protectiveness",
    ],
    fixGuidance:
      "Vary rhythm. Some sentences short and blunt, some with two items, some with four, some with none. Save true triples for rare earned moments.",
    detectPrompt: `You hunt ONE pattern: mechanical rule-of-three.

Flag adjective triples, abstract-noun triples, and three stacked parallel clauses that feel templated (X, Y, and Z / A. B. C.).

Do not flag every coincidence of three facts in a paragraph — only the rhythmic template.

Return JSON only:
{"hits":[{"quote":"...","pattern":"rule_of_three","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite to break mechanical rule-of-three lists. Keep meaning. Use uneven counts and mixed sentence lengths. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "contrast_structures",
    label: "Contrast structures",
    description:
      "Not-X-but-Y profundity crutches, including 'did not X, which would have been easier; she did Y.'",
    examples: [
      "It's not just a mirror, it's a portal.",
      "not dramatically, not with the tidy violence of lust, but with the dull irreversible click",
      "She did not laugh prettily, which would have been easier to dismiss.",
      "Not a key, not exactly, but enough",
    ],
    fixGuidance:
      "Say what the thing is. Save contrast syntax for rare genuinely important turns.",
    detectPrompt: `You hunt ONE pattern: contrast profundity structures.

Flag "not just X but Y", "not X but Y", "did not X, which would have been easier…", "not a key, not exactly, but…", and close cousins used to perform insight.

Do not flag ordinary negation ("He did not answer.").

Return JSON only:
{"hits":[{"quote":"...","pattern":"contrast_structures","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite to remove not-X-but-Y and "did not X which would have been Y" profundity crutches. State the thing directly. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "brochure_language",
    label: "Brochure language",
    description:
      "Travel-guide puffery: nestled, bustling hubs, rich tapestry, testament, showcase.",
    examples: [
      "nestled in the heart of",
      "bustling hub of culture and activity",
      "a glimpse into the rich tapestry of community life",
      "stands as a testament to",
    ],
    fixGuidance:
      "Describe the place as this character would complain about it to a friend: the flickering sign, the table, the guy who's always there at 9 a.m.",
    detectPrompt: `You hunt ONE pattern: brochure / tourism / press-release language.

Flag nestled, tapestry, hub of culture, glimpse into, showcase, testament, visitors, rich heritage, and any paragraph that could be pasted into a travel blog.

Return JSON only:
{"hits":[{"quote":"...","pattern":"brochure_language","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite to strip brochure and tourism language. Use grounded, character-owned details. If a paragraph could sit on a travel site, make it a cramped specific place instead. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "meaning_commentary",
    label: "Meaning commentary",
    description:
      "Essay-like zoom-out after a concrete moment: overall, ultimately, what this says about identity.",
    examples: [
      "Ultimately, it was a story about belonging.",
      "In that moment she understood what it meant to be human.",
      "The scene said something larger about memory and identity.",
    ],
    fixGuidance:
      "End on action, image, or dialogue. Strip the commentary. Let the reader connect.",
    detectPrompt: `You hunt ONE pattern: over-explaining meaning like a school essay.

Flag sentences that zoom out to announce theme, identity, memory, the human condition, or close with overall/ultimately/in the end summarizing significance.

Return JSON only:
{"hits":[{"quote":"...","pattern":"meaning_commentary","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite to cut thematic commentary and essay endings. End on action, image, or dialogue. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "elegant_variation",
    label: "Elegant variation",
    description:
      "Synonym roulette: the same object renamed town / settlement / community / urban center.",
    examples: [
      "the town… the settlement… the community… the urban center",
      "her school… the educational institution… the academy",
    ],
    fixGuidance:
      "Pick the honest word that fits the POV and repeat it. Consistency of language is a human-narrator marker.",
    detectPrompt: `You hunt ONE pattern: elegant variation / synonym roulette.

Flag when the same referent is renamed with thesaurus swaps in close succession without a character reason.

Return JSON only:
{"hits":[{"quote":"...","pattern":"elegant_variation","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite so each referent keeps one honest POV-fitting word. Kill thesaurus swaps. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "fake_fancy_verbs",
    label: "Fake fancy verbs",
    description:
      "Dodging simple is/are: serves as, stands as, boasts, features, offers, represents.",
    examples: [
      "stands as a beacon of resilience",
      "offers a serene backdrop to daily life",
      "the cafe boasts an intimate atmosphere",
    ],
    fixGuidance:
      "If you can swap the verb for is/are without losing anything important, do it. Reserve fancy verbs for moments that need elevation.",
    detectPrompt: `You hunt ONE pattern: fake fancy copulas.

Flag serves as, stands as, boasts, features, offers, represents, functions as, when a simple is/are would do.

Return JSON only:
{"hits":[{"quote":"...","pattern":"fake_fancy_verbs","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite fancy copulas (serves as, stands as, boasts, offers, represents) into simple is/are or concrete verbs. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "emotional_shorthand",
    label: "Emotional shorthand",
    description:
      "Abstract emotional labels and profundity without grounding in body, choice, or speech.",
    examples: [
      "the heart could be loyal and treacherous in the same beat",
      "a dangerous aching protectiveness he had no right to possess",
      "still the feeling grew in the spaces when he tried to starve it",
    ],
    fixGuidance:
      "Put feeling in a specific gesture, withheld word, or choice. Cut abstract heart/loyalty sermons.",
    detectPrompt: `You hunt ONE pattern: emotional shorthand — abstract labeled feelings and profundity without dramatized grounding.

Flag "the heart could…", stacked emotion nouns, and sentences that name a feeling-state instead of showing it.

Return JSON only:
{"hits":[{"quote":"...","pattern":"emotional_shorthand","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite emotional shorthand into dramatized gesture, speech, or choice. Cut abstract heart/loyalty sermons. Do not add plot. Return rewritten prose only.`,
  },
  {
    id: "clean_pivot_tics",
    label: "Clean pivot tics",
    description:
      "Short declarative pivot sentences used as a structural tic, repeated until they feel templated.",
    examples: [
      "Julian looked away too late.",
      "He had known Elise for eight months.",
      "So Julian became disciplined.",
    ],
    fixGuidance:
      "A clean pivot is fine once. If several short subject-verb snaps march through a page, vary length and bury some turns in action.",
    detectPrompt: `You hunt ONE pattern: clean pivot sentence tics.

Flag short standalone declarative pivots that reset the paragraph (Name + simple verb + period) when they repeat as a structural habit in the passage. One such sentence is not a hit; a cluster is.

Return JSON only:
{"hits":[{"quote":"...","pattern":"clean_pivot_tics","why":"...","suggestion":"..."}]}`,
    rewritePrompt: `Rewrite to break a run of short clean-pivot sentences. Vary length; fold some turns into surrounding action. Do not add plot. Return rewritten prose only.`,
  },
];

export const AI_TELL_BY_ID: Record<AiTellId, AiTell> = Object.fromEntries(
  AI_TELLS.map((t) => [t.id, t]),
) as Record<AiTellId, AiTell>;

export function isAiTellId(value: string): value is AiTellId {
  return value in AI_TELL_BY_ID;
}

export function generationTellRules(): string {
  return `Density ration (AI tells — occasional use is human; stacking is not)
- At most one metaphor or personification of an abstraction per scene unless a beat requires more.
- Do not stack list-rhythm catalogs (The X. The Y. The Z.) more than once per scene.
- Do not march rule-of-three adjective or clause templates through consecutive sentences.
- Do not perform insight with not-X-but-Y or "did not X, which would have been easier."
- No brochure/tourism diction for places the viewpoint character actually lives in.
- No essay commentary that explains what a moment represents.
- Repeat the honest word for a referent; do not synonym-roulette.
- Prefer is/are and concrete verbs over serves as / stands as / boasts / offers / represents.
- Dramatize feeling; do not stack abstract emotional shorthand.
- Do not rely on a drumbeat of short clean-pivot sentences to structure the page.`;
}
