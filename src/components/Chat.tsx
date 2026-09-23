"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message, Profile } from "@/lib/types";

export default function Chat() {
  const supabase = createClient();
  const [me, setMe] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");

  async function boot() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    setMe(auth.user.id);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", auth.user.id)
      .limit(30);

    setProfiles((data || []) as Profile[]);
  }

  async function selectUser(profile: Profile) {
    const { data, error } = await supabase.rpc(
      "create_direct_conversation",
      { other_user: profile.id }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedUser(profile);
    setConversationId(data as string);
    await loadMessages(data as string);
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("messages")
      .select("*, profiles:sender_id(*)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    setMessages((data || []) as Message[]);
  }

  async function send() {
    if (!me || !conversationId || !body.trim()) return;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: me,
      body: body.trim(),
    });

    setBody("");
  }

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => loadMessages(conversationId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-3xl font-bold">Messages</h1>

      <div className="grid min-h-[650px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] md:grid-cols-[280px_1fr]">
        <div className="border-b border-white/10 md:border-b-0 md:border-r">
          <div className="p-4 text-sm font-semibold text-zinc-500">
            Membres
          </div>

          <div className="space-y-1 p-2">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => selectUser(profile)}
                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/5 ${
                  selectedUser?.id === profile.id ? "bg-white/10" : ""
                }`}
              >
                <img
                  src={
                    profile.avatar_url ||
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                      profile.display_name || profile.username
                    )}`
                  }
                  alt=""
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <div className="font-medium">{profile.display_name}</div>
                  <div className="text-xs text-zinc-500">
                    @{profile.username}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[650px] flex-col">
          <div className="border-b border-white/10 p-4">
            {selectedUser ? (
              <div>
                <p className="font-semibold">{selectedUser.display_name}</p>
                <p className="text-xs text-zinc-500">
                  @{selectedUser.username}
                </p>
              </div>
            ) : (
              <p className="text-zinc-500">Sélectionne une personne</p>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => {
              const mine = message.sender_id === me;
              return (
                <div
                  key={message.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-3xl px-4 py-3 ${
                      mine
                        ? "bg-fuchsia-500 text-white"
                        : "bg-white/10 text-zinc-200"
                    }`}
                  >
                    {message.body}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                disabled={!selectedUser}
                placeholder="Écrire un message..."
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none"
              />
              <button
                onClick={send}
                disabled={!selectedUser}
                className="rounded-2xl bg-white px-5 font-semibold text-black disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
