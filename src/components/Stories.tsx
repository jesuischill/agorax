"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/upload";
import type { Story } from "@/lib/types";

export default function Stories() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);

    const { data } = await supabase
      .from("stories")
      .select("*, profiles(*)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    setStories((data || []) as Story[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function createStory() {
    if (!userId || (!text.trim() && !file)) return;

    let mediaUrl: string | null = null;

    if (file) {
      mediaUrl = await uploadMedia(file, userId, "story");
    }

    await supabase.from("stories").insert({
      user_id: userId,
      text: text.trim() || null,
      media_url: mediaUrl,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    setText("");
    setFile(null);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-zinc-500">24 heures</p>
      <h1 className="mb-6 text-3xl font-bold">Stories</h1>

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ta story..."
          className="min-h-24 w-full bg-transparent outline-none"
        />

        {file && (
          <p className="mb-3 text-sm text-zinc-500">{file.name}</p>
        )}

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm">
            <Plus size={18} />
            Média
            <input
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            onClick={createStory}
            className="rounded-full bg-fuchsia-500 px-5 py-2 font-semibold"
          >
            Publier
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => {
          const avatar =
            story.profiles?.avatar_url ||
            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
              story.profiles?.display_name || story.profiles?.username || "A"
            )}`;

          return (
            <article
              key={story.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
            >
              {story.media_url && (
                <img
                  src={story.media_url}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">
                      {story.profiles?.display_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      @{story.profiles?.username}
                    </p>
                  </div>
                </div>
                {story.text && (
                  <p className="mt-4 whitespace-pre-wrap text-zinc-300">
                    {story.text}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
