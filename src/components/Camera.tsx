"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/upload";

export default function Camera() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);

  async function publish() {
    if (!file) return;

    const { data: auth } = await createClient().auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }

    setLoading(true);

    try {
      const url = await uploadMedia(file, auth.user.id, "snap");

      const supabase = createClient();

      await supabase.from("stories").insert({
        user_id: auth.user.id,
        media_url: url,
        text: caption.trim() || null,
        expires_at: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      router.push("/stories");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold">Nouveau snap</h1>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <label className="flex min-h-72 cursor-pointer items-center justify-center rounded-3xl border border-dashed border-white/15 bg-black text-center">
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Clique pour changer
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold">Choisir une photo ou une vidéo</p>
              <p className="mt-1 text-sm text-zinc-500">
                Sur mobile, tu peux utiliser la caméra.
              </p>
            </div>
          )}

          <input
            type="file"
            accept="image/*,video/*"
            capture="environment"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Ajouter un texte..."
          className="mt-4 min-h-24 w-full rounded-2xl border border-white/10 bg-black p-4 outline-none"
        />

        <button
          onClick={publish}
          disabled={!file || loading}
          className="mt-4 w-full rounded-2xl bg-fuchsia-500 py-3 font-semibold disabled:opacity-40"
        >
          {loading ? "Publication..." : "Publier dans ma story"}
        </button>
      </div>
    </div>
  );
}
