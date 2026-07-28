export type QuestionLayer = "novel" | "act" | "chapter" | "beat" | "review";

export type Question = {
  id: string;
  layer: QuestionLayer;
  prompt: string;
  whyItMatters: string;
  doneWhen: string;
};

export const QUESTION_BANK: Question[] = [
  {
    id: "novel.premise",
    layer: "novel",
    prompt: "What is the story in 2–3 sentences?",
    whyItMatters: "Anchors every act and chapter decision.",
    doneWhen: "A clear premise a stranger could understand.",
  },
  {
    id: "novel.genre_tone",
    layer: "novel",
    prompt: "Genre, tone, comparable titles (optional)?",
    whyItMatters: "Keeps prose and structure in the right register.",
    doneWhen: "Genre + tone stated; comps optional.",
  },
  {
    id: "novel.protagonist",
    layer: "novel",
    prompt: "Whose story is it; what do they want; what do they need?",
    whyItMatters: "Want vs need drives arc choices.",
    doneWhen: "Want and need are distinct and specific.",
  },
  {
    id: "novel.antagonism",
    layer: "novel",
    prompt: "What stands in the way (person, system, self)?",
    whyItMatters: "Conflict must be visible in act briefs.",
    doneWhen: "Primary opposition named.",
  },
  {
    id: "novel.stakes",
    layer: "novel",
    prompt: "What is at risk if they fail?",
    whyItMatters: "Stakes should escalate across acts.",
    doneWhen: "Concrete personal and/or world stakes.",
  },
  {
    id: "novel.theme",
    layer: "novel",
    prompt: "What questions or themes should the book press on?",
    whyItMatters: "Guides chapter obligations and ending intent.",
    doneWhen: "At least one thematic question.",
  },
  {
    id: "novel.ending_intent",
    layer: "novel",
    prompt:
      "Intended ending shape: triumph / pyrrhic / tragedy / bittersweet / open?",
    whyItMatters: "Act bridges should aim toward this shape.",
    doneWhen: "Ending shape chosen.",
  },
  {
    id: "novel.pov_tense",
    layer: "novel",
    prompt: "POV and tense constraints?",
    whyItMatters: "Prose generation must stay consistent.",
    doneWhen: "POV + tense stated.",
  },
  {
    id: "novel.audience_length",
    layer: "novel",
    prompt: "Audience and rough length / chapter count ambition?",
    whyItMatters: "Calibrates how many acts/chapters to propose.",
    doneWhen: "Audience and rough scale noted.",
  },
  {
    id: "act.purpose",
    layer: "act",
    prompt: "Why does this act exist in the book?",
    whyItMatters: "Prevents filler acts.",
    doneWhen: "Purpose is unique vs other acts.",
  },
  {
    id: "act.state_start",
    layer: "act",
    prompt: "World/character state at act open?",
    whyItMatters: "Must differ from prior act end.",
    doneWhen: "Concrete starting state.",
  },
  {
    id: "act.state_end",
    layer: "act",
    prompt: "State at act close (must differ meaningfully)?",
    whyItMatters: "Defines the act's change.",
    doneWhen: "End state differs from start.",
  },
  {
    id: "act.introduces",
    layer: "act",
    prompt: "Who/what is introduced here?",
    whyItMatters: "Timing of introductions for coherence.",
    doneWhen: "Introductions listed or explicitly none.",
  },
  {
    id: "act.accomplishes",
    layer: "act",
    prompt: "What is gained or achieved?",
    whyItMatters: "Progress toward novel stakes.",
    doneWhen: "At least one accomplishment or gain.",
  },
  {
    id: "act.losses",
    layer: "act",
    prompt: "What is lost, broken, or foreclosed?",
    whyItMatters: "Cost makes acts feel consequential.",
    doneWhen: "Loss named or justified as none.",
  },
  {
    id: "act.turn",
    layer: "act",
    prompt: "Central turn or midpoint pressure inside this act?",
    whyItMatters: "Gives chapters a spine.",
    doneWhen: "Turn described.",
  },
  {
    id: "act.bridge",
    layer: "act",
    prompt: "How does the end of this act force the next?",
    whyItMatters: "Keeps momentum between acts.",
    doneWhen: "Bridge pressure clear (or final act).",
  },
  {
    id: "chapter.goal",
    layer: "chapter",
    prompt: "What single advance does this chapter make toward the act brief?",
    whyItMatters: "Chapters are act milestones.",
    doneWhen: "One clear goal.",
  },
  {
    id: "chapter.enter_exit",
    layer: "chapter",
    prompt: "Emotional/plot state enter → exit?",
    whyItMatters: "Local change proves the chapter earns its place.",
    doneWhen: "Enter and exit states differ.",
  },
  {
    id: "chapter.focus",
    layer: "chapter",
    prompt: "Whose scene-pressure; where?",
    whyItMatters: "Guides scene drafting.",
    doneWhen: "POV pressure and place noted.",
  },
  {
    id: "chapter.obligation",
    layer: "chapter",
    prompt: "Promise or question it raises for later?",
    whyItMatters: "Foreshadowing / payoff tracking.",
    doneWhen: "Obligation noted or none.",
  },
  {
    id: "chapter.act_fit",
    layer: "chapter",
    prompt: "Which part of the act brief does this serve?",
    whyItMatters: "No orphan chapters.",
    doneWhen: "Explicit map to act brief.",
  },
  {
    id: "beat.sequence",
    layer: "beat",
    prompt: "Ordered steps that achieve the chapter goal?",
    whyItMatters: "Beats guide prose without owning scenes.",
    doneWhen: "Ordered beat list exists.",
  },
  {
    id: "beat.info",
    layer: "beat",
    prompt: "What must the reader learn or feel on each step?",
    whyItMatters: "Keeps beats purposeful.",
    doneWhen: "Info/feeling per major beat.",
  },
  {
    id: "beat.turn",
    layer: "beat",
    prompt: "Where does the chapter’s local turn land?",
    whyItMatters: "Avoid flat chapters.",
    doneWhen: "Turn beat identified.",
  },
  {
    id: "beat.handoff",
    layer: "beat",
    prompt: "What condition must be true for the next chapter?",
    whyItMatters: "Clean chapter bridges.",
    doneWhen: "Handoff condition stated.",
  },
];

export const COHERENCE_REVIEW_PROMPTS = [
  "Do chapter goals cover the act brief without orphans or contradictions?",
  "Are introductions timed before they are relied on?",
  "Do stakes escalate across acts?",
  "Are losses/accomplishments visible in later act state_start?",
  "Any theme/POV breaks?",
  "Any act that could be deleted without changing the novel?",
];

export function questionsForLayer(layer: QuestionLayer) {
  return QUESTION_BANK.filter((q) => q.layer === layer);
}
