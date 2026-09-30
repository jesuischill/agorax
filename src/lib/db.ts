import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const globalDb = globalThis as typeof globalThis & {
  agoraxDb?: Database.Database;
};

const databasePath =
  process.env.DATABASE_FILE ||
  (process.env.RENDER
    ? "/var/data/agorax.db"
    : path.join(process.cwd(), "data", "agorax.db"));

export const db =
  globalDb.agoraxDb ??
  new Database(databasePath);

if (process.env.NODE_ENV !== "production") {
  globalDb.agoraxDb = db;
}

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'post',
  caption TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  text TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL,
  post_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS posts_created_idx
ON posts(created_at DESC);

CREATE INDEX IF NOT EXISTS messages_conv_idx
ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS notifications_user_idx
ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_actions_created_idx
ON admin_actions(created_at DESC);
`);

function ensureColumn(
  table: string,
  column: string,
  definition: string
) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];

  if (!columns.some((item) => item.name === column)) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
  }
}

ensureColumn(
  "users",
  "role",
  "TEXT NOT NULL DEFAULT 'user'"
);

ensureColumn(
  "users",
  "banned",
  "INTEGER NOT NULL DEFAULT 0"
);

export function id() {
  return crypto.randomUUID();
}


/* AGORAX_SUPABASE_BACKUP_V1 */

const agoraxSupabaseUrl =
  process.env.SUPABASE_URL?.trim() || "";

const agoraxSupabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const agoraxSupabaseBucket =
  process.env.SUPABASE_DB_BUCKET?.trim() ||
  "agorax-system";

const agoraxSupabaseObject =
  process.env.SUPABASE_DB_OBJECT?.trim() ||
  "agorax.db";

const agoraxShouldBackup =
  Boolean(
    agoraxSupabaseUrl &&
    agoraxSupabaseServiceKey
  ) &&
  process.env.NEXT_PHASE !==
    "phase-production-build";

let agoraxBackupTimer: NodeJS.Timeout | null = null;
let agoraxBackupRunning = false;
let agoraxBackupPending = false;

async function agoraxBackupDatabase() {
  if (!agoraxShouldBackup) {
    return;
  }

  if (agoraxBackupRunning) {
    agoraxBackupPending = true;
    return;
  }

  agoraxBackupRunning = true;

  try {
    const supabase = createClient(
      agoraxSupabaseUrl,
      agoraxSupabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const bucket = agoraxSupabaseBucket;

    try {
      await supabase.storage.getBucket(bucket);
    } catch {
      await supabase.storage.createBucket(
        bucket,
        {
          public: false
        }
      ).catch(() => undefined);
    }

    const backupDir = path.join(
      process.cwd(),
      "data",
      ".agorax-backup"
    );

    fs.mkdirSync(backupDir, {
      recursive: true
    });

    const snapshotPath = path.join(
      backupDir,
      "agorax.snapshot.db"
    );

    await db.backup(snapshotPath);

    const fileBuffer =
      await fs.promises.readFile(snapshotPath);

    const fileBlob = new Blob(
      [fileBuffer],
      {
        type: "application/x-sqlite3"
      }
    );

    const { error } =
      await supabase.storage
        .from(bucket)
        .upload(
          agoraxSupabaseObject,
          fileBlob,
          {
            contentType:
              "application/x-sqlite3",
            upsert: true,
            cacheControl: "0"
          }
        );

    if (error) {
      console.error(
        "❌ Supabase DB backup:",
        error.message
      );
      return;
    }

    console.log(
      "✅ AgoraX DB sauvegardée dans Supabase Storage."
    );
  } catch (error) {
    console.error(
      "❌ Backup Supabase impossible:",
      error
    );
  } finally {
    agoraxBackupRunning = false;

    if (agoraxBackupPending) {
      agoraxBackupPending = false;
      agoraxScheduleBackup();
    }
  }
}

function agoraxScheduleBackup() {
  if (!agoraxShouldBackup) {
    return;
  }

  if (agoraxBackupTimer) {
    clearTimeout(agoraxBackupTimer);
  }

  agoraxBackupTimer = setTimeout(
    () => {
      void agoraxBackupDatabase();
    },
    1000
  );
}

const agoraxOriginalPrepare =
  db.prepare.bind(db);

const agoraxOriginalExec =
  db.exec.bind(db);

const agoraxOriginalTransaction =
  db.transaction.bind(db);

Object.defineProperty(
  db,
  "prepare",
  {
    configurable: true,
    value: (sql: string) => {
      const statement =
        agoraxOriginalPrepare(sql);

      return new Proxy(
        statement,
        {
          get(target, property, receiver) {
            if (
              property === "run"
            ) {
              return (
                ...args: any[]
              ) => {
                const result =
                  (target as any).run(
                    ...args
                  );

                agoraxScheduleBackup();

                return result;
              };
            }

            if (
              property === "get"
            ) {
              return (
                ...args: any[]
              ) =>
                (target as any).get(
                  ...args
                );
            }

            if (
              property === "all"
            ) {
              return (
                ...args: any[]
              ) =>
                (target as any).all(
                  ...args
                );
            }

            return Reflect.get(
              target,
              property,
              receiver
            );
          }
        }
      );
    }
  }
);

Object.defineProperty(
  db,
  "exec",
  {
    configurable: true,
    value: (sql: string) => {
      const result =
        agoraxOriginalExec(sql);

      agoraxScheduleBackup();

      return result;
    }
  }
);

Object.defineProperty(
  db,
  "transaction",
  {
    configurable: true,
    value: (callback: Function) => {
      const wrapped =
        agoraxOriginalTransaction(
          (...args: any[]) => {
            const result =
              callback(...args);

            agoraxScheduleBackup();

            return result;
          }
        );

      return wrapped;
    }
  }
);
