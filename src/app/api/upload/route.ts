import { error,json } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

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

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return error(
      "Fichier manquant.",
      400
    );
  }

  const isImage =
    file.type.startsWith("image/");

  const isVideo =
    file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    return error(
      "Format non supporté.",
      400
    );
  }

  const maxSize = isVideo
    ? 100 * 1024 * 1024
    : 20 * 1024 * 1024;

  if (file.size > maxSize) {
    return error(
      isVideo
        ? "Vidéo trop lourde : maximum 100 Mo."
        : "Image trop lourde : maximum 20 Mo.",
      400
    );
  }

  const ext =
    file.type === "image/jpeg" ? ".jpg" :
    file.type === "image/png" ? ".png" :
    file.type === "image/webp" ? ".webp" :
    file.type === "image/gif" ? ".gif" :
    file.type === "video/mp4" ? ".mp4" :
    file.type === "video/webm" ? ".webm" :
    "";

  const filename =
    `${Date.now()}-${crypto.randomUUID()}${ext}`;

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads"
  );

  await fs.mkdir(
    uploadDir,
    { recursive:true }
  );

  const bytes = Buffer.from(
    await file.arrayBuffer()
  );

  await fs.writeFile(
    path.join(uploadDir,filename),
    bytes
  );

  return json({
    ok:true,
    url:`/uploads/${filename}`,
    mediaType:isVideo
      ? "video"
      : "image"
  });
}
