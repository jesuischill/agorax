import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const query =
    (url.searchParams.get("q") || "")
      .trim();

  const rows = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.bio,
      u.avatar_url,
      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ?
          AND f.following_id = u.id
      ) AS following
    FROM users u
    WHERE u.id <> ?
      AND (
        ? = ''
        OR lower(u.username)
          LIKE '%' || lower(?) || '%'
        OR lower(u.display_name)
          LIKE '%' || lower(?) || '%'
      )
    ORDER BY u.created_at DESC
    LIMIT 50
  `).all(
    user.id,
    user.id,
    query,
    query,
    query
  );

  return json(rows);
}
