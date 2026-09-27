import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const databasePath = path.join(
  process.cwd(),
  "data",
  "agorax.db"
);

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
  try {
    const configuredSecret =
      process.env.ADMIN_BOOTSTRAP_SECRET?.trim();

    if (!configuredSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin bootstrap disabled."
        },
        { status: 404 }
      );
    }

    const providedSecret =
      request.headers
        .get("x-admin-bootstrap-secret")
        ?.trim() || "";

    if (
      !providedSecret ||
      !safeEqual(providedSecret, configuredSecret)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid bootstrap secret."
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const username =
      typeof body?.username === "string"
        ? body.username.trim()
        : "";

    if (!username || username.length > 100) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid username is required."
        },
        { status: 400 }
      );
    }

    fs.mkdirSync(
      path.join(process.cwd(), "data"),
      { recursive: true }
    );

    const db = new Database(databasePath, {
      timeout: 5000
    });

    try {
      db.pragma("busy_timeout = 5000");

      const usersTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
        )
        .get();

      if (!usersTable) {
        return NextResponse.json(
          {
            ok: false,
            error: "Users table does not exist yet."
          },
          { status: 500 }
        );
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_bootstrap (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          used INTEGER NOT NULL DEFAULT 0,
          used_at TEXT,
          used_user_id TEXT
        )
      `);

      db.prepare(
        "INSERT OR IGNORE INTO admin_bootstrap (id, used) VALUES (1, 0)"
      ).run();

      const state = db
        .prepare(
          "SELECT used FROM admin_bootstrap WHERE id = 1"
        )
        .get() as { used?: number } | undefined;

      if (state?.used === 1) {
        return NextResponse.json(
          {
            ok: false,
            error: "Bootstrap already used."
          },
          { status: 409 }
        );
      }

      const user = db
        .prepare(
          "SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1"
        )
        .get(username) as
        | {
            id: string | number;
            username: string;
          }
        | undefined;

      if (!user) {
        return NextResponse.json(
          {
            ok: false,
            error: "User not found."
          },
          { status: 404 }
        );
      }

      const activate = db.transaction(() => {
        db.prepare(
          "UPDATE users SET role = 'owner', banned = 0 WHERE id = ?"
        ).run(user.id);

        db.prepare(
          "UPDATE admin_bootstrap SET used = 1, used_at = ?, used_user_id = ? WHERE id = 1"
        ).run(
          new Date().toISOString(),
          String(user.id)
        );
      });

      activate();

      return NextResponse.json({
        ok: true,
        message: "Admin account activated.",
        user: {
          id: user.id,
          username: user.username,
          role: "owner"
        }
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(
      "Admin bootstrap error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error."
      },
      { status: 500 }
    );
  }
}
