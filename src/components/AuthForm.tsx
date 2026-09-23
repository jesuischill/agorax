"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.replace("/feed");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName || username,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/feed");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-md pt-12">
        <div className="mb-8">
          <div className="text-4xl font-black">
            Agora<span className="text-fuchsia-400">X</span>
          </div>
          <p className="mt-2 text-zinc-500">
            {mode === "login"
              ? "Content de te revoir."
              : "Crée ton espace AgoraX."}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
        >
          {mode === "signup" && (
            <>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nom d'utilisateur"
                required
                minLength={3}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-fuchsia-400"
              />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nom affiché"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-fuchsia-400"
              />
            </>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-fuchsia-400"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            minLength={6}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-fuchsia-400"
          />

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-fuchsia-500 px-4 py-3 font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {loading
              ? "Chargement..."
              : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>

          <p className="pt-2 text-center text-sm text-zinc-500">
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <Link href="/signup" className="text-white hover:underline">
                  Créer un compte
                </Link>
              </>
            ) : (
              <>
                Déjà inscrit ?{" "}
                <Link href="/login" className="text-white hover:underline">
                  Se connecter
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
