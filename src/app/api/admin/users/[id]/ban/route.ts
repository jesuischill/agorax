import { error, json } from "@/lib/api";
import {
  logAdminAction,
  requireOwnerApi
} from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = await requireOwnerApi();

  if (auth.response) {
    return auth.response;
  }

  const { id: targetId } =
    await context.params;

  const target = db.prepare(`
    SELECT id, username, display_name, role, banned
    FROM users
    WHERE id = ?
  `).get(targetId) as
    | {
        id: string;
        username: string;
        display_name: string;
        role: string;
        banned: number;
      }
    | undefined;

  if (!target) {
    return error(
      "Compte introuvable.",
      404
    );
  }

  if (target.id === auth.user!.id) {
    return error(
      "Tu ne peux pas te bannir toi-même.",
      400
    );
  }

  if (target.role === "owner") {
    return error(
      "Un owner doit d'abord être rétrogradé avant toute autre action.",
      400
    );
  }

  const body = await request.json().catch(() => ({}));

  const banned =
    typeof body.banned === "boolean"
      ? body.banned
      : !Boolean(target.banned);

  db.prepare(`
    UPDATE users
    SET banned = ?
    WHERE id = ?
  `).run(
    banned ? 1 : 0,
    targetId
  );

  if (banned) {
    db.prepare(`
      DELETE FROM sessions
      WHERE user_id = ?
    `).run(targetId);
  }

  logAdminAction(
    auth.user!.id,
    banned ? "ban_user" : "unban_user",
    "user",
    targetId,
    {
      username: target.username
    }
  );

  return json({
    ok: true,
    banned
  });
}
