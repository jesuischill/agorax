"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/upload";
import type { Post, Profile } from "@/lib/types";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const [{ data: p }, { data: postData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
      supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }),
    ]);

    const next = p as Profile;
    setProfile(next);
    setDisplayName(next.display_name);
    setBio(next.bio || "");
    setPosts((postData || []) as Post[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!profile) return;

    let avatarUrl = profile.avatar_url;

    if (avatar) {
      avatarUrl = await uploadMedia(avatar, profile.id, "avatar");
    }

    await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);

    setAvatar(null);
    load();
  }

  if (!profile) {
    return <div className="text-zinc-500">Chargement...</div>;
  }

  const avatarUrl =
    profile.avatar_url ||
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
      profile.display_name || profile.username
    )}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <img
            src={avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-4 ring-white/10"
          />

          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.display_name}</h1>
            <p className="text-zinc-500">@{profile.username}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none"
            placeholder="Nom"
          />
          <label className="cursor-pointer rounded-2xl border border-white/10 bg-black px-4 py-3">
            Changer l’avatar
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="sm:col-span-2 min-h-28 rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none"
            placeholder="Ta bio..."
          />
        </div>

        <button
          onClick={save}
          className="mt-4 rounded-2xl bg-white px-5 py-3 font-semibold text-black"
        >
          Enregistrer le profil
        </button>
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold">Mes publications</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <article
            key={post.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
          >
            {post.image_url && (
              <img
                src={post.image_url}
                alt=""
                className="aspect-square w-full object-cover"
              />
            )}
            {post.content && (
              <p className="p-4 whitespace-pre-wrap">{post.content}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
