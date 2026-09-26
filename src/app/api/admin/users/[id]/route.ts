import { error, json } from "@/lib/api";
import {
  logAdminAction,
  requireOwnerApi
} from "@/lib/admin";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
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
      display_name,
      role
    FROM users
    WHERE id = ?
  `).get(targetId) as
    | {
        id: string;
        username: string;
        display_name: string;
        role: string;
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
      "Tu ne peux pas supprimer ton propre compte depuis ce panneau.",
      400
    );
  }

  if (target.role === "owner") {
    return error(
      "Retire d'abord son statut owner.",
      400
    );
  }

  db.prepare(`
    DELETE FROM users
    WHERE id = ?
  `).run(targetId);

  logAdminAction(
    auth.user!.id,
    "delete_user",
    "user",
    targetId,
    {
      username: target.username
    }
  );

  return json({
    ok: true
  });
}
