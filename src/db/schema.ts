import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const novels = sqliteTable("novels", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  premise: text("premise").default(""),
  genre: text("genre").default(""),
  tone: text("tone").default(""),
  themes: text("themes").default(""),
  stakes: text("stakes").default(""),
  protagonistFocus: text("protagonist_focus").default(""),
  endingIntention: text("ending_intention").default(""),
  notes: text("notes").default(""),
  overviewChecklistJson: text("overview_checklist_json").default("{}"),
  styleGuideJson: text("style_guide_json").default(""),
  styleSamplesJson: text("style_samples_json").default("[]"),
  sliderDefsJson: text("slider_defs_json").default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const acts = sqliteTable("acts", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  brief: text("brief").default(""),
  introduces: text("introduces").default(""),
  accomplishes: text("accomplishes").default(""),
  losses: text("losses").default(""),
  stateStart: text("state_start").default(""),
  stateEnd: text("state_end").default(""),
  summary: text("summary").default(""),
  summaryUpdatedAt: integer("summary_updated_at", { mode: "timestamp_ms" }),
});

export const chapters = sqliteTable("chapters", {
  id: text("id").primaryKey(),
  actId: text("act_id")
    .notNull()
    .references(() => acts.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  goal: text("goal").default(""),
  summary: text("summary").default(""),
  summaryUpdatedAt: integer("summary_updated_at", { mode: "timestamp_ms" }),
});

export const beats = sqliteTable("beats", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  content: text("content").notNull().default(""),
});

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  title: text("title").default(""),
  content: text("content").notNull().default('{"type":"doc","content":[{"type":"paragraph"}]}'),
  slidersJson: text("sliders_json").default("{}"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const sceneRevisions = sqliteTable("scene_revisions", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  source: text("source").notNull(),
  label: text("label"),
  content: text("content").notNull(),
  parentRevisionId: text("parent_revision_id"),
});

export const knowledgeEntries = sqliteTable("knowledge_entries", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  aliases: text("aliases").default(""),
  summary: text("summary").default(""),
  notes: text("notes").default(""),
  slidersJson: text("sliders_json").default("{}"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const knowledgeAppearances = sqliteTable("knowledge_appearances", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  contextSnippet: text("context_snippet").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const overviewChatMessages = sqliteTable("overview_chat_messages", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const chapterChatMessages = sqliteTable("chapter_chat_messages", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metaJson: text("meta_json").default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const overviewAnswers = sqliteTable("overview_answers", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  answer: text("answer").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const slashCommands = sqliteTable("slash_commands", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").default(""),
  defaultTemperature: real("default_temperature").notNull().default(0.7),
  promptTemplate: text("prompt_template").notNull(),
  enableTools: text("enable_tools").notNull().default("true"),
  builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
});

export const commandModelOverrides = sqliteTable("command_model_overrides", {
  id: text("id").primaryKey(),
  commandId: text("command_id")
    .notNull()
    .references(() => slashCommands.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  temperature: real("temperature"),
  promptTemplate: text("prompt_template"),
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  openrouterApiKey: text("openrouter_api_key").default(""),
  defaultModel: text("default_model").default("anthropic/claude-sonnet-4"),
  theme: text("theme").default("system"),
  densityThresholdsJson: text("density_thresholds_json").default(""),
  craftPipeline: integer("craft_pipeline", { mode: "boolean" }).notNull().default(true),
});

export const taskModelOverrides = sqliteTable("task_model_overrides", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().unique(),
  modelId: text("model_id").notNull(),
  temperature: real("temperature"),
});

export const coachSessions = sqliteTable("coach_sessions", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  sceneId: text("scene_id"),
  chapterId: text("chapter_id"),
  task: text("task").notNull(),
  messagesJson: text("messages_json").notNull().default("[]"),
  densityJson: text("density_json").default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const compAnalyses = sqliteTable("comp_analyses", {
  id: text("id").primaryKey(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  author: text("author").default(""),
  notes: text("notes").default(""),
  chapterBreakdownJson: text("chapter_breakdown_json").default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
