import { json,error } from "@/lib/api";
import { db } from "@/lib/db";
import {
  checkPassword,
  createSession
} from "@/lib/auth";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const email = String(
      body.email || ""
    ).trim().toLowerCase();

    const password = String(
      body.password || ""
    );

    const user = db.prepare(`
      SELECT id,password_hash
      FROM users
      WHERE email = ?
      LIMIT 1
    `).get(email) as {
      id:string;
      password_hash:string;
    } | undefined;

    if (!user) {
      return error(
        "Email ou mot de passe incorrect.",
        401
      );
    }

    const valid = await checkPassword(
      password,
      user.password_hash
    );

    if (!valid) {
      return error(
        "Email ou mot de passe incorrect.",
        401
      );
    }

    await createSession(user.id);

    return json({ ok:true });
  } catch {
    return error(
      "Connexion impossible.",
      500
    );
  }
}
