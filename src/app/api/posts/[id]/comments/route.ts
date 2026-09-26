import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db,id } from "@/lib/db";

export async function GET(
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

  const { id:postId } =
    await context.params;

  const rows = db.prepare(`
    SELECT
      c.id,
      c.body,
      c.created_at,
      u.username,
      u.display_name,
      u.avatar_url
    FROM comments c
    JOIN users u
      ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    LIMIT 100
  `).all(postId);

  return json(rows);
}

export async function POST(
  request:Request,
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

  const { id:postId } =
    await context.params;

  const body = await request.json();
  const text = String(
    body.body || ""
  ).trim();

  if (!text || text.length > 500) {
    return error(
      "Commentaire invalide.",
      400
    );
  }

  const post = db.prepare(`
    SELECT user_id
    FROM posts
    WHERE id = ?
  `).get(postId) as {
    user_id:string;
  } | undefined;

  if (!post) {
    return error(
      "Publication introuvable.",
      404
    );
  }

  db.prepare(`
    INSERT INTO comments(
      id,
      post_id,
      user_id,
      body
    )
    VALUES (?, ?, ?, ?)
  `).run(
    id(),
    postId,
    user.id,
    text
  );

  if (post.user_id !== user.id) {
    db.prepare(`
      INSERT INTO notifications(
        id,
        user_id,
        actor_id,
        type,
        post_id
      )
      VALUES (?, ?, ?, 'comment', ?)
    `).run(
      id(),
      post.user_id,
      user.id,
      postId
    );
  }

  return json({ok:true});
}
