import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const restoreEnabled =
  String(process.env.AGORAX_RESTORE_REMOTE || "")
    .toLowerCase() === "true";

if (!restoreEnabled) {
  console.log(
    "ℹ️ Restauration Supabase désactivée."
  );
  process.exit(0);
}

const url =
  process.env.SUPABASE_URL?.trim();

const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const bucket =
  process.env.SUPABASE_DB_BUCKET?.trim() ||
  "agorax-system";

const objectPath =
  process.env.SUPABASE_DB_OBJECT?.trim() ||
  "agorax.db";

if (!url || !key) {
  console.log(
    "ℹ️ Supabase non configuré, restauration ignorée."
  );
  process.exit(0);
}

const supabase = createClient(
  url,
  key,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

console.log(
  "=== Restauration AgoraX depuis Supabase ==="
);

const { data, error } =
  await supabase.storage
    .from(bucket)
    .download(objectPath);

if (error) {
  console.log(
    "ℹ️ Aucune sauvegarde distante trouvée:",
    error.message
  );
  process.exit(0);
}

const buffer =
  Buffer.from(
    await data.arrayBuffer()
  );

const dataDir =
  path.join(
    process.cwd(),
    "data"
  );

fs.mkdirSync(
  dataDir,
  {
    recursive: true
  }
);

const databasePath =
  path.join(
    dataDir,
    "agorax.db"
  );

const temporaryPath =
  `${databasePath}.restore`;

fs.writeFileSync(
  temporaryPath,
  buffer
);

fs.renameSync(
  temporaryPath,
  databasePath
);

console.log(
  "✅ Base AgoraX restaurée depuis Supabase."
);
