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

  const { id: postId } =
    await context.params;

  const post = db.prepare(`
    SELECT
      p.id,
      p.user_id,
      p.caption,
      u.username
    FROM posts p
    JOIN users u
      ON u.id = p.user_id
    WHERE p.id = ?
  `).get(postId) as
    | {
        id: string;
        user_id: string;
        caption: string;
        username: string;
      }
    | undefined;

  if (!post) {
    return error(
      "Publication introuvable.",
      404
    );
  }

  db.prepare(`
    DELETE FROM posts
    WHERE id = ?
  `).run(postId);

  logAdminAction(
    auth.user!.id,
    "delete_post",
    "post",
    postId,
    {
      author: post.username
    }
  );

  return json({
    ok: true
  });
}
