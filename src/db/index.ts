import type BetterSqlite3 from "better-sqlite3";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";
import { seedIfNeeded } from "./seed";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "quillsmith.db");

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: BetterSqlite3.Database | null = null;

export function getDb() {
  if (_db) return _db;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  seedIfNeeded(_db);
  return _db;
}

/** Run synchronous DB work in a single SQLite transaction (rollback on throw). */
export function withTransaction<T>(fn: () => T): T {
  getDb();
  return _sqlite!.transaction(fn)();
}

function migrate(sqlite: BetterSqlite3.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      premise TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      themes TEXT DEFAULT '',
      stakes TEXT DEFAULT '',
      protagonist_focus TEXT DEFAULT '',
      ending_intention TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      overview_checklist_json TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS acts (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      title TEXT NOT NULL,
      brief TEXT DEFAULT '',
      introduces TEXT DEFAULT '',
      accomplishes TEXT DEFAULT '',
      losses TEXT DEFAULT '',
      state_start TEXT DEFAULT '',
      state_end TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      act_id TEXT NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      title TEXT NOT NULL,
      goal TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS beats (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      title TEXT DEFAULT '',
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scene_revisions (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      label TEXT,
      content TEXT NOT NULL,
      parent_revision_id TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_appearances (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
      scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      context_snippet TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS overview_chat_messages (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS overview_answers (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slash_commands (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      description TEXT DEFAULT '',
      default_temperature REAL NOT NULL DEFAULT 0.7,
      prompt_template TEXT NOT NULL,
      enable_tools TEXT NOT NULL DEFAULT 'true',
      built_in INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS command_model_overrides (
      id TEXT PRIMARY KEY,
      command_id TEXT NOT NULL REFERENCES slash_commands(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      temperature REAL,
      prompt_template TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      openrouter_api_key TEXT DEFAULT '',
      default_model TEXT DEFAULT 'anthropic/claude-sonnet-4',
      theme TEXT DEFAULT 'system',
      density_thresholds_json TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS task_model_overrides (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL UNIQUE,
      model_id TEXT NOT NULL,
      temperature REAL
    );

    CREATE TABLE IF NOT EXISTS coach_sessions (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      scene_id TEXT,
      chapter_id TEXT,
      task TEXT NOT NULL,
      messages_json TEXT NOT NULL DEFAULT '[]',
      density_json TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comp_analyses (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      chapter_breakdown_json TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  ensureColumn(sqlite, "novels", "style_guide_json", "TEXT DEFAULT ''");
  ensureColumn(sqlite, "novels", "style_samples_json", "TEXT DEFAULT '[]'");
  ensureColumn(sqlite, "acts", "summary", "TEXT DEFAULT ''");
  ensureColumn(sqlite, "acts", "summary_updated_at", "INTEGER");
  ensureColumn(sqlite, "chapters", "summary", "TEXT DEFAULT ''");
  ensureColumn(sqlite, "chapters", "summary_updated_at", "INTEGER");
  ensureColumn(sqlite, "app_settings", "density_thresholds_json", "TEXT DEFAULT ''");
  ensureColumn(sqlite, "novels", "slider_defs_json", "TEXT DEFAULT ''");
  ensureColumn(sqlite, "scenes", "sliders_json", "TEXT DEFAULT '{}'");
  ensureColumn(sqlite, "knowledge_entries", "sliders_json", "TEXT DEFAULT '{}'");
  ensureColumn(sqlite, "app_settings", "craft_pipeline", "INTEGER NOT NULL DEFAULT 1");
}

function ensureColumn(
  sqlite: BetterSqlite3.Database,
  table: string,
  column: string,
  definition: string,
) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export type Db = ReturnType<typeof getDb>;
