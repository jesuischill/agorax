import { json } from "@/lib/api";
import { requireOwnerApi } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireOwnerApi();

  if (auth.response) {
    return auth.response;
  }

  const posts = db.prepare(`
    SELECT
      p.id,
      p.kind,
      p.caption,
      p.media_url,
      p.media_type,
      p.created_at,
      u.id AS user_id,
      u.username,
      u.display_name
    FROM posts p
    JOIN users u
      ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 300
  `).all();

  return json(posts);
}
