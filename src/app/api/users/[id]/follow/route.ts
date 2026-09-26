import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db,id } from "@/lib/db";

export async function POST(
  _request:Request,
  context:{
    params:Promise<{id:string}>
  }
) {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const { id:targetId } =
    await context.params;

  if (targetId === user.id) {
    return error(
      "Action invalide.",
      400
    );
  }

  const target = db.prepare(`
    SELECT id
    FROM users
    WHERE id = ?
  `).get(targetId);

  if (!target) {
    return error(
      "Utilisateur introuvable.",
      404
    );
  }

  const existing = db.prepare(`
    SELECT follower_id
    FROM follows
    WHERE follower_id = ?
      AND following_id = ?
  `).get(
    user.id,
    targetId
  );

  if (existing) {
    db.prepare(`
      DELETE FROM follows
      WHERE follower_id = ?
        AND following_id = ?
    `).run(
      user.id,
      targetId
    );
  } else {
    db.prepare(`
      INSERT INTO follows(
        follower_id,
        following_id
      )
      VALUES (?, ?)
    `).run(
      user.id,
      targetId
    );

    db.prepare(`
      INSERT INTO notifications(
        id,
        user_id,
        actor_id,
        type
      )
      VALUES (?, ?, ?, 'follow')
    `).run(
      id(),
      targetId,
      user.id
    );
  }

  return json({
    following:!existing
  });
}
