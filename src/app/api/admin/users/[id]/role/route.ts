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
    SELECT
      id,
      username,
      role
    FROM users
    WHERE id = ?
  `).get(targetId) as
    | {
        id: string;
        username: string;
        role: "user" | "owner";
      }
    | undefined;

  if (!target) {
    return error(
      "Compte introuvable.",
      404
    );
  }

  const body = await request.json();

  const role =
    body.role === "owner"
      ? "owner"
      : "user";

  if (
    target.id === auth.user!.id &&
    role === "user"
  ) {
    return error(
      "Tu ne peux pas retirer ton propre statut owner.",
      400
    );
  }

  if (
    role === "user" &&
    target.role === "owner"
  ) {
    const ownerCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'owner'
    `).get() as { count: number };

    if (ownerCount.count <= 1) {
      return error(
        "Il doit rester au moins un owner.",
        400
      );
    }
  }

  db.prepare(`
    UPDATE users
    SET role = ?
    WHERE id = ?
  `).run(
    role,
    targetId
  );

  logAdminAction(
    auth.user!.id,
    role === "owner"
      ? "promote_owner"
      : "demote_owner",
    "user",
    targetId,
    {
      username: target.username
    }
  );

  return json({
    ok: true,
    role
  });
}
