import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { initSalonsDatabase } from "@/lib/salons";
import { getSalonUser } from "@/lib/salon-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

initSalonsDatabase();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const user = await getSalonUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Non authentifié." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

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

  if (!salon) {
    return NextResponse.json(
      { ok: false, error: "Salon introuvable." },
      { status: 404 }
    );
  }

  const messages = db.prepare(`
    SELECT
      sm.id,
      sm.salon_id,
      sm.user_id,
      sm.content,
      sm.created_at,
      COALESCE(u.username, 'Utilisateur') AS username,
      COALESCE(u.display_name, u.username, 'Utilisateur') AS display_name,
      COALESCE(u.avatar_url, '') AS avatar_url
    FROM salon_messages sm
    LEFT JOIN users u
      ON u.id = sm.user_id
    WHERE sm.salon_id = ?
    ORDER BY sm.created_at DESC
    LIMIT 100
  `).all(id).reverse();

  return NextResponse.json({
    ok: true,
    salon,
    messages
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const user = await getSalonUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Non authentifié." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  const salon = db.prepare(`
    SELECT id
    FROM salons
    WHERE id = ?
  `).get(id);

  if (!salon) {
    return NextResponse.json(
      { ok: false, error: "Salon introuvable." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);

  const content =
    typeof body?.content === "string"
      ? body.content.trim()
      : "";

  if (!content) {
    return NextResponse.json(
      {
        ok: false,
        error: "Le message est vide."
      },
      { status: 400 }
    );
  }

  if (content.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        error: "Message limité à 2000 caractères."
      },
      { status: 400 }
    );
  }

  const messageId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO salon_messages
      (id, salon_id, user_id, content)
    VALUES
      (?, ?, ?, ?)
  `).run(
    messageId,
    id,
    user.id,
    content
  );

  const message = db.prepare(`
    SELECT
      sm.id,
      sm.salon_id,
      sm.user_id,
      sm.content,
      sm.created_at,
      COALESCE(u.username, ?) AS username,
      COALESCE(u.display_name, u.username, ?) AS display_name,
      COALESCE(u.avatar_url, '') AS avatar_url
    FROM salon_messages sm
    LEFT JOIN users u
      ON u.id = sm.user_id
    WHERE sm.id = ?
  `).get(
    user.username,
    user.username,
    messageId
  );

  return NextResponse.json(
    {
      ok: true,
      message
    },
    { status: 201 }
  );
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const user = await getSalonUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Non authentifié." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  const salon = db.prepare(`
    SELECT
      id,
      created_by
    FROM salons
    WHERE id = ?
  `).get(id) as
    | {
        id: string;
        created_by: string;
      }
    | undefined;

  if (!salon) {
    return NextResponse.json(
      { ok: false, error: "Salon introuvable." },
      { status: 404 }
    );
  }

  const allowed =
    user.role === "owner" ||
    String(salon.created_by) === String(user.id);

  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tu ne peux pas supprimer ce salon."
      },
      { status: 403 }
    );
  }

  const deleteSalon = db.transaction(() => {
    db.prepare(`
      DELETE FROM salon_messages
      WHERE salon_id = ?
    `).run(id);

    db.prepare(`
      DELETE FROM salons
      WHERE id = ?
    `).run(id);
  });

  deleteSalon();

  return NextResponse.json({
    ok: true
  });
}
