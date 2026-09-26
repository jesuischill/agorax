import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db,id } from "@/lib/db";

function getConversation(
  userA:string,
  userB:string
) {
  const existing = db.prepare(`
    SELECT c.id
    FROM conversations c
    JOIN conversation_members a
      ON a.conversation_id = c.id
    JOIN conversation_members b
      ON b.conversation_id = c.id
    WHERE a.user_id = ?
      AND b.user_id = ?
      AND (
        SELECT COUNT(*)
        FROM conversation_members m
        WHERE m.conversation_id = c.id
      ) = 2
    LIMIT 1
  `).get(
    userA,
    userB
  ) as {id:string} | undefined;

  if (existing) {
    return existing.id;
  }

  const conversationId = id();

  db.prepare(`
    INSERT INTO conversations(id)
    VALUES (?)
  `).run(conversationId);

  const add = db.prepare(`
    INSERT INTO conversation_members(
      conversation_id,
      user_id
    )
    VALUES (?, ?)
  `);

  const tx = db.transaction(() => {
    add.run(
      conversationId,
      userA
    );

    add.run(
      conversationId,
      userB
    );
  });

  tx();

  return conversationId;
}

export async function GET(
  request:Request
) {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const url = new URL(request.url);
  const other =
    url.searchParams.get("with");

  if (!other) {
    return error(
      "Destinataire manquant.",
      400
    );
  }

  const conversation =
    getConversation(
      user.id,
      other
    );

  const rows = db.prepare(`
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
    LIMIT 300
  `).all(conversation);

  return json(rows);
}

export async function POST(
  request:Request
) {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const body = await request.json();
  const other = String(
    body.with || ""
  );

  const text = String(
    body.body || ""
  ).trim();

  if (!other || !text) {
    return error(
      "Message invalide.",
      400
    );
  }

  if (text.length > 2000) {
    return error(
      "Message trop long.",
      400
    );
  }

  const target = db.prepare(`
    SELECT id
    FROM users
    WHERE id = ?
  `).get(other);

  if (!target) {
    return error(
      "Destinataire introuvable.",
      404
    );
  }

  const conversation =
    getConversation(
      user.id,
      other
    );

  db.prepare(`
    INSERT INTO messages(
      id,
      conversation_id,
      sender_id,
      body
    )
    VALUES (?, ?, ?, ?)
  `).run(
    id(),
    conversation,
    user.id,
    text
  );

  if (other !== user.id) {
    db.prepare(`
      INSERT INTO notifications(
        id,
        user_id,
        actor_id,
        type
      )
      VALUES (?, ?, ?, 'message')
    `).run(
      id(),
      other,
      user.id
    );
  }

  return json({ok:true});
}
