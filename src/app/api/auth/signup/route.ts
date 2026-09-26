import { json,error } from "@/lib/api";
import { db,id } from "@/lib/db";
import {
  createSession,
  hashPassword
} from "@/lib/auth";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const email = String(
      body.email || ""
    ).trim().toLowerCase();

    const username = String(
      body.username || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g,"");

    const displayName = String(
      body.displayName || ""
    ).trim();

    const password = String(
      body.password || ""
    );

    if (!email.includes("@")) {
      return error(
        "Email invalide.",
        400
      );
    }

    if (!/^[a-z0-9_]{3,24}$/.test(
      username
    )) {
      return error(
        "Nom d’utilisateur invalide.",
        400
      );
    }

    if (displayName.length < 2 ||
        displayName.length > 40) {
      return error(
        "Nom affiché invalide.",
        400
      );
    }

    if (password.length < 8) {
      return error(
        "Mot de passe : minimum 8 caractères.",
        400
      );
    }

    const existing = db.prepare(`
      SELECT id
      FROM users
      WHERE email = ? OR username = ?
      LIMIT 1
    `).get(
      email,
      username
    );

    if (existing) {
      return error(
        "Email ou nom d’utilisateur déjà utilisé.",
        409
      );
    }

    const userId = id();
    const passwordHash =
      await hashPassword(password);

    db.prepare(`
      INSERT INTO users(
        id,
        email,
        password_hash,
        username,
        display_name
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      email,
      passwordHash,
      username,
      displayName
    );

    await createSession(userId);

    return json(
      { ok:true },
      201
    );
  } catch {
    return error(
      "Impossible de créer le compte.",
      500
    );
  }
}
