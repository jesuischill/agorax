import { error, json } from "@/lib/api";
import {
  logAdminAction,
  requireOwnerApi
} from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = await requireOwnerApi();

  if (auth.response) {
    return auth.response;
  }

  const { id: conversationId } =
    await context.params;

  const conversation = db.prepare(`
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
      ) AS participants
    FROM conversations c
    WHERE c.id = ?
  `).get(conversationId);

  if (!conversation) {
    return error(
      "Discussion introuvable.",
      404
    );
  }

  const messages = db.prepare(`
    SELECT
      m.id,
      m.sender_id,
      m.body,
      m.created_at,
      u.username,
      u.display_name
    FROM messages m
    JOIN users u
      ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    LIMIT 500
  `).all(conversationId);

  return json({
    conversation,
    messages
  });
}

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

  const { id: conversationId } =
    await context.params;

  const exists = db.prepare(`
    SELECT id
    FROM conversations
    WHERE id = ?
  `).get(conversationId);

  if (!exists) {
    return error(
      "Discussion introuvable.",
      404
    );
  }

  db.prepare(`
    DELETE FROM conversations
    WHERE id = ?
  `).run(conversationId);

  logAdminAction(
    auth.user!.id,
    "delete_conversation",
    "conversation",
    conversationId
  );

  return json({
    ok: true
  });
}
