import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const rows = db.prepare(`
    SELECT
      n.id,
      n.type,
      n.created_at,
      u.username AS actor_username,
      u.display_name AS actor_display_name
    FROM notifications n
    LEFT JOIN users u
      ON u.id = n.actor_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 100
  `).all(user.id);

  db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE user_id = ?
  `).run(user.id);

  return json(rows);
}
