import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL?.trim();

const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY?.trim();

const bucket =
  process.env.SUPABASE_DB_BUCKET?.trim() ||
  "agorax-system";

const objectPath =
  process.env.SUPABASE_DB_OBJECT?.trim() ||
  "agorax.db";

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL et SUPABASE_SECRET_KEY sont nécessaires."
  );
}

const databasePath =
  path.join(
    process.cwd(),
    "data",
    "agorax.db"
  );

if (!fs.existsSync(databasePath)) {
  throw new Error(
    `Base SQLite introuvable: ${databasePath}`
  );
}

const backupDir =
  path.join(
    process.cwd(),
    "data",
    ".agorax-backup"
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true
  }
);

const snapshotPath =
  path.join(
    backupDir,
    "agorax.manual.snapshot.db"
  );

const db =
  new Database(databasePath);

try {
  await db.backup(snapshotPath);
} finally {
  db.close();
}

const buffer =
  await fs.promises.readFile(
    snapshotPath
  );

const supabase =
  createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

try {
  await supabase.storage
    .getBucket(bucket);
} catch {
  await supabase.storage
    .createBucket(
      bucket,
      {
        public: false
      }
    )
    .catch(() => undefined);
}

const { error } =
  await supabase.storage
    .from(bucket)
    .upload(
      objectPath,
      new Blob(
        [buffer],
        {
          type: "application/x-sqlite3"
        }
      ),
      {
        contentType:
          "application/x-sqlite3",
        upsert: true,
        cacheControl: "0"
      }
    );

if (error) {
  throw error;
}

console.log(
  "✅ agorax.db sauvegardée dans Supabase Storage."
);
