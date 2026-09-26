import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE = "agorax_session";
const SESSION_DAYS = 30;

type User = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
};

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(rawToken);

  const expires = new Date(
    Date.now() +
      SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  db.prepare(`
    INSERT INTO sessions(
      id,
      user_id,
      token_hash,
      expires_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    tokenHash,
    expires.toISOString()
  );

  const cookieStore = await cookies();

  cookieStore.set(
    COOKIE,
    rawToken,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60
    }
  );
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (token) {
    db.prepare(
      "DELETE FROM sessions WHERE token_hash = ?"
    ).run(hashToken(token));
  }

  cookieStore.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (!token) return null;

  const row = db.prepare(`
    SELECT
      u.id,
      u.email,
      u.username,
      u.display_name,
      u.bio,
      u.avatar_url
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `).get(hashToken(token)) as User | undefined;

  if (!row) {
    cookieStore.delete(COOKIE);
    return null;
  }

  return row;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function checkPassword(
  password: string,
  hash: string
) {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(
  password: string
) {
  return bcrypt.hash(password, 12);
}
