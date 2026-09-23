"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function Discover() {
  const supabase = createClient();
  const [me, setMe] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    setMe(auth.user.id);

    const [{ data: profilesData }, { data: followsData }] = await Promise.all([
      supabase.from("profiles").select("*").neq("id", auth.user.id).limit(50),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", auth.user.id),
    ]);

    setProfiles((profilesData || []) as Profile[]);
    setFollowing((followsData || []).map((x) => x.following_id));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(profileId: string) {
    if (!me) return;

    const isFollowing = following.includes(profileId);

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", me)
        .eq("following_id", profileId);
    } else {
      await supabase.from("follows").insert({
        follower_id: me,
        following_id: profileId,
      });
    }

    await load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-zinc-500">Explorer</p>
      <h1 className="mb-6 text-3xl font-bold">Découvrir</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map((profile) => {
          const isFollowing = following.includes(profile.id);
          const avatar =
            profile.avatar_url ||
            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
              profile.display_name || profile.username
            )}`;

          return (
            <div
              key={profile.id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-center gap-3">
                <img
                  src={avatar}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{profile.display_name}</p>
                  <p className="truncate text-sm text-zinc-500">
                    @{profile.username}
                  </p>
                </div>
              </div>

              {profile.bio && (
                <p className="mt-4 text-sm text-zinc-400">{profile.bio}</p>
              )}

              <button
                onClick={() => toggle(profile.id)}
                className={`mt-5 w-full rounded-2xl px-4 py-2.5 font-semibold ${
                  isFollowing
                    ? "bg-white/10 text-white"
                    : "bg-white text-black"
                }`}
              >
                {isFollowing ? "Abonné" : "Suivre"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
