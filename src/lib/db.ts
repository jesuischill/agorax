import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const databasePath =
  process.env.DATABASE_FILE ||
  (process.env.RENDER
    ? "/var/data/agorax.db"
    : path.join(process.cwd(), "data", "agorax.db"));
