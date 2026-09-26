import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db,id } from "@/lib/db";

export async function GET(
  request: Request
) {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const userId = url.searchParams.get("user");

  const where:string[] = [];
  const params:any[] = [];

  if (kind === "reel") {
    where.push("p.kind = ?");
    params.push("reel");
  } else if (kind === "post") {
    where.push("p.kind = ?");
    params.push("post");
  }

  if (userId) {
    where.push("p.user_id = ?");
    params.push(userId);
  }

  const sql = `
    SELECT
      p.id,
      p.user_id,
      p.kind,
      p.caption,
      p.media_url,
      p.media_type,
      p.created_at,
      u.username,
      u.display_name,
      u.avatar_url,
      (
        SELECT COUNT(*)
        FROM likes l
        WHERE l.post_id = p.id
      ) AS like_count,
      (
        SELECT COUNT(*)
        FROM comments c
        WHERE c.post_id = p.id
      ) AS comment_count,
      EXISTS(
        SELECT 1
        FROM likes me
        WHERE me.post_id = p.id
        AND me.user_id = ?
      ) AS liked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ${
      where.length
        ? `WHERE ${where.join(" AND ")}`
        : ""
    }
    ORDER BY p.created_at DESC
    LIMIT 100
  `;

  const rows = db
    .prepare(sql)
    .all(
      user.id,
      ...params
    );

  return json(rows);
}

export async function POST(
  request: Request
) {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const body = await request.json();

  const kind =
    body.kind === "reel"
      ? "reel"
      : "post";

  const caption = String(
    body.caption || ""
  ).trim();

  const mediaUrl =
    body.mediaUrl
      ? String(body.mediaUrl)
      : null;

  const mediaType =
    body.mediaType
      ? String(body.mediaType)
      : null;

  if (!caption && !mediaUrl) {
    return error(
      "Ajoute du texte ou un média.",
      400
    );
  }

  if (
    kind === "reel" &&
    mediaType !== "video"
  ) {
    return error(
      "Un Reel doit être une vidéo.",
      400
    );
  }

  const postId = id();

  db.prepare(`
    INSERT INTO posts(
      id,
      user_id,
      kind,
      caption,
      media_url,
      media_type
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    postId,
    user.id,
    kind,
    caption,
    mediaUrl,
    mediaType
  );

  return json(
    {
      ok:true,
      id:postId
    },
    201
  );
}
