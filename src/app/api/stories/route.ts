import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db,id } from "@/lib/db";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const rows = db.prepare(`
    SELECT
      s.id,
      s.user_id,
      s.media_url,
      s.media_type,
      s.text,
      s.expires_at,
      s.created_at,
      u.username,
      u.display_name,
      u.avatar_url
    FROM stories s
    JOIN users u
      ON u.id = s.user_id
    WHERE datetime(s.expires_at)
      > datetime('now')
    ORDER BY s.created_at DESC
    LIMIT 100
  `).all();

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

  const text = String(
    body.text || ""
  ).trim();

  const mediaUrl =
    body.mediaUrl
      ? String(body.mediaUrl)
      : null;

  const mediaType =
    body.mediaType
      ? String(body.mediaType)
      : null;

  if (!text && !mediaUrl) {
    return error(
      "Ajoute du texte ou un média.",
      400
    );
  }

  const expiresAt =
    new Date(
      Date.now() +
      24 * 60 * 60 * 1000
    ).toISOString();

  const storyId = id();

  db.prepare(`
    INSERT INTO stories(
      id,
      user_id,
      media_url,
      media_type,
      text,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    storyId,
    user.id,
    mediaUrl,
    mediaType,
    text,
    expiresAt
  );

  return json(
    {
      ok:true,
      id:storyId
    },
    201
  );
}
