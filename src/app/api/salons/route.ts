import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { initSalonsDatabase } from "@/lib/salons";
import { getSalonUser } from "@/lib/salon-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

initSalonsDatabase();

function makeSlug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `${base || "salon"}-${crypto.randomBytes(4).toString("hex")}`;
}

export async function GET(request: NextRequest) {
  const user = await getSalonUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Non authentifié." },
      { status: 401 }
    );
  }

  const salons = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.slug,
      s.description,
      s.created_by,
      s.created_at,
      COUNT(sm.id) AS message_count,
      (
        SELECT sm2.content
        FROM salon_messages sm2
        WHERE sm2.salon_id = s.id
        ORDER BY sm2.created_at DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT sm3.created_at
        FROM salon_messages sm3
        WHERE sm3.salon_id = s.id
        ORDER BY sm3.created_at DESC
        LIMIT 1
      ) AS last_message_at
    FROM salons s
    LEFT JOIN salon_messages sm
      ON sm.salon_id = s.id
    GROUP BY
      s.id,
      s.name,
      s.slug,
      s.description,
      s.created_by,
      s.created_at
    ORDER BY
      COALESCE(last_message_at, s.created_at) DESC
  `).all();

  return NextResponse.json({
    ok: true,
    salons
  });
}

export async function POST(request: NextRequest) {
  const user = await getSalonUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Non authentifié." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);

  const name =
    typeof body?.name === "string"
      ? body.name.trim()
      : "";

  const description =
    typeof body?.description === "string"
      ? body.description.trim()
      : "";

  if (name.length < 2 || name.length > 40) {
    return NextResponse.json(
      {
        ok: false,
        error: "Le nom doit contenir entre 2 et 40 caractères."
      },
      { status: 400 }
    );
  }

  if (description.length > 160) {
    return NextResponse.json(
      {
        ok: false,
        error: "La description est limitée à 160 caractères."
      },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const slug = makeSlug(name);

  db.prepare(`
    INSERT INTO salons
      (id, name, slug, description, created_by)
    VALUES
      (?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    slug,
    description,
    user.id
  );

  const salon = db.prepare(`
    SELECT
      id,
      name,
      slug,
      description,
      created_by,
      created_at
    FROM salons
    WHERE id = ?
  `).get(id);

  return NextResponse.json(
    {
      ok: true,
      salon
    },
    { status: 201 }
  );
}
