import { currentUser } from "@/lib/auth";
import { db, id } from "@/lib/db";
import { error } from "@/lib/api";

export async function requireOwnerApi() {
  const user = await currentUser();

  if (!user) {
    return {
      user: null,
      response: error(
        "Authentification requise.",
        401
      )
    };
  }

  if (user.role !== "owner") {
    return {
      user: null,
      response: error(
        "Accès administrateur refusé.",
        403
      )
    };
  }

  return {
    user,
    response: null
  };
}

export function logAdminAction(
  adminUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: unknown
) {
  db.prepare(`
    INSERT INTO admin_actions(
      id,
      admin_user_id,
      action,
      target_type,
      target_id,
      details
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id(),
    adminUserId,
    action,
    targetType ?? null,
    targetId ?? null,
    details
      ? JSON.stringify(details)
      : null
  );
}
