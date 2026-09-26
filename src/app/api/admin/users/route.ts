import { json } from "@/lib/api";
import {
  requireOwnerApi
} from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await requireOwnerApi();

  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const q = (
    url.searchParams.get("q") || ""
  ).trim();

  const users = db.prepare(`
    SELECT
      u.id,
      u.email,
      u.username,
      u.display_name,
      u.role,
      u.banned,
      u.created_at,
      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = u.id
      ) AS post_count,
      (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.following_id = u.id
      ) AS follower_count,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.sender_id = u.id
      ) AS message_count
    FROM users u
    WHERE
      ? = ''
      OR lower(u.username) LIKE '%' || lower(?) || '%'
      OR lower(u.display_name) LIKE '%' || lower(?) || '%'
      OR lower(u.email) LIKE '%' || lower(?) || '%'
    ORDER BY u.created_at DESC
    LIMIT 200
  `).all(
    q,
    q,
    q,
    q
  );

  return json(users);
}
