import { json } from "@/lib/api";
import { requireOwnerApi } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireOwnerApi();

  if (auth.response) {
    return auth.response;
  }

  const conversations = db.prepare(`
    SELECT
      c.id,
      c.created_at,
      (
        SELECT GROUP_CONCAT(
          u.display_name || ' (@' || u.username || ')',
          ' • '
        )
        FROM conversation_members cm
        JOIN users u
          ON u.id = cm.user_id
        WHERE cm.conversation_id = c.id
      ) AS participants,
      (
        SELECT m.body
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_at
    FROM conversations c
    ORDER BY COALESCE(
      last_message_at,
      c.created_at
    ) DESC
    LIMIT 300
  `).all();

  return json(conversations);
}
