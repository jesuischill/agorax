"use client";

import { useEffect, useState } from "react";
import { Heart, ImagePlus, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/upload";
import type { Post, Profile } from "@/lib/types";

type PostWithMeta = Post & {
  profiles: Profile;
  likes: { user_id: string }[];
};

export default function Feed() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);

    const { data } = await supabase
      .from("posts")
      .select("*, profiles(*), likes(user_id)")
      .order("created_at", { ascending: false });

    setPosts((data || []) as PostWithMeta[]);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("feed-posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function publish() {
    if (!userId || (!content.trim() && !file)) return;

    setPosting(true);

    try {
      let imageUrl: string | null = null;

      if (file) {
        imageUrl = await uploadMedia(file, userId, "post");
      }

      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        content: content.trim(),
        image_url: imageUrl,
      });

      if (error) throw error;

      setContent("");
      setFile(null);
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erreur");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: PostWithMeta) {
    if (!userId) return;

    const liked = post.likes?.some((x) => x.user_id === userId);

    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", userId);
    } else {
      await supabase.from("likes").insert({
        post_id: post.id,
        user_id: userId,
      });
    }

    await load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">Ton fil</p>
          <h1 className="text-3xl font-bold">AgoraX</h1>
        </div>
        <a
          href="/camera"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Nouveau snap
        </a>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quoi de neuf ?"
          className="min-h-28 w-full resize-none bg-transparent outline-none"
        />

        {file && (
          <div className="mb-3 rounded-2xl border border-white/10 p-3 text-sm text-zinc-300">
            {file.name}
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="cursor-pointer rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
            <ImagePlus size={20} />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            onClick={publish}
            disabled={posting}
            className="flex items-center gap-2 rounded-full bg-fuchsia-500 px-5 py-2 font-semibold disabled:opacity-50"
          >
            <Send size={17} />
            Publier
          </button>
        </div>
      </div>

      {posts.map((post) => {
        const liked = post.likes?.some((x) => x.user_id === userId);
        const avatar =
          post.profiles?.avatar_url ||
          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            post.profiles?.display_name || post.profiles?.username || "A"
          )}`;

        return (
          <article
            key={post.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"
          >
            <div className="flex items-center gap-3 p-4">
              <img
                src={avatar}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">
                  {post.profiles?.display_name || post.profiles?.username}
                </p>
                <p className="text-xs text-zinc-500">
                  @{post.profiles?.username}
                </p>
              </div>
            </div>

            {post.content && (
              <p className="whitespace-pre-wrap px-4 pb-4 text-[15px] leading-6">
                {post.content}
              </p>
            )}

            {post.image_url && (
              <img
                src={post.image_url}
                alt=""
                className="max-h-[650px] w-full object-cover"
              />
            )}

            <div className="flex items-center gap-6 p-4 text-sm text-zinc-400">
              <button
                onClick={() => toggleLike(post)}
                className={`flex items-center gap-2 ${
                  liked ? "text-pink-400" : ""
                }`}
              >
                <Heart size={19} fill={liked ? "currentColor" : "none"} />
                {post.likes?.length || 0}
              </button>
              <button className="flex items-center gap-2">
                <MessageCircle size={19} />
                Commenter
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
