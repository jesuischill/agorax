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

  const { id:postId } =
    await context.params;

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

  const existing = db.prepare(`
    SELECT post_id
    FROM likes
    WHERE post_id = ?
      AND user_id = ?
  `).get(
    postId,
    user.id
  );

  if (existing) {
    db.prepare(`
      DELETE FROM likes
      WHERE post_id = ?
        AND user_id = ?
    `).run(
      postId,
      user.id
    );
  } else {
    db.prepare(`
      INSERT INTO likes(
        post_id,
        user_id
      )
      VALUES (?, ?)
    `).run(
      postId,
      user.id
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
        VALUES (?, ?, ?, 'like', ?)
      `).run(
        id(),
        post.user_id,
        user.id,
        postId
      );
    }
  }

  const count = db.prepare(`
    SELECT COUNT(*) AS count
    FROM likes
    WHERE post_id = ?
  `).get(postId) as {
    count:number;
  };

  return json({
    liked:!existing,
    count:count.count
  });
}
