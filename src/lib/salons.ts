import { db } from "@/lib/db";

export function initSalonsDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS salons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salon_messages (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_salons_created_at
      ON salons(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_salon_messages_salon_created
      ON salon_messages(salon_id, created_at DESC);
  `);

  const defaults = [
    {
      id: "general",
      name: "Général",
      slug: "general",
      description: "Le salon principal d'AgoraX."
    },
    {
      id: "gaming",
      name: "Gaming",
      slug: "gaming",
      description: "Jeux vidéo, actus gaming et discussions."
    },
    {
      id: "musique",
      name: "Musique",
      slug: "musique",
      description: "Parler musique, artistes et découvertes."
    },
    {
      id: "memes",
      name: "Memes",
      slug: "memes",
      description: "Humour et memes AgoraX."
    }
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO salons
      (id, name, slug, description, created_by)
    VALUES
      (?, ?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    for (const salon of defaults) {
      insert.run(
        salon.id,
        salon.name,
        salon.slug,
        salon.description,
        "system"
      );
    }
  });

  seed();
}
