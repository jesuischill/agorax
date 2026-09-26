import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return error(
      "Non connecté.",
      401
    );
  }

  const posts = db.prepare(`
    SELECT COUNT(*) AS count
    FROM posts
    WHERE user_id = ?
  `).get(user.id) as {count:number};

  const followers = db.prepare(`
    SELECT COUNT(*) AS count
    FROM follows
    WHERE following_id = ?
  `).get(user.id) as {count:number};

  const following = db.prepare(`
    SELECT COUNT(*) AS count
    FROM follows
    WHERE follower_id = ?
  `).get(user.id) as {count:number};

  return json({
    user,
    stats:{
      posts:posts.count,
      followers:followers.count,
      following:following.count
    }
  });
}

export async function PATCH(
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

  const displayName =
    String(
      body.displayName ??
      user.display_name
    ).trim();

  const bio =
    String(
      body.bio ?? user.bio
    ).trim();

  const avatarUrl =
    body.avatarUrl === undefined
      ? user.avatar_url
      : body.avatarUrl;

  if (
    displayName.length < 2 ||
    displayName.length > 40
  ) {
    return error(
      "Nom invalide.",
      400
    );
  }

  if (bio.length > 160) {
    return error(
      "Bio trop longue.",
      400
    );
  }

  db.prepare(`
    UPDATE users
    SET
      display_name = ?,
      bio = ?,
      avatar_url = ?
    WHERE id = ?
  `).run(
    displayName,
    bio,
    avatarUrl,
    user.id
  );

  return json({ok:true});
}
