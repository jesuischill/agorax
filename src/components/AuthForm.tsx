"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({
  mode
}: {
  mode: "login" | "signup";
}) {
  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [username,setUsername] = useState("");
  const [displayName,setDisplayName] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/signup";

      const payload =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              username,
              displayName
            };

      const response = await fetch(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
          "Une erreur est survenue."
        );
        return;
      }

      router.replace("/feed");
      router.refresh();
    } catch {
      setError(
        "Le serveur ne répond pas."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <div className="auth-brand">
          Ago<span>raX</span>
        </div>

        <p className="subtitle">
          {mode === "login"
            ? "Content de te revoir."
            : "Le social, au même endroit."}
        </p>

        <form
          onSubmit={submit}
          className="form"
          style={{ marginTop: 22 }}
        >
          {mode === "signup" && (
            <>
              <input
                className="input"
                placeholder="Nom d’utilisateur"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                minLength={3}
                maxLength={24}
                required
              />

              <input
                className="input"
                placeholder="Nom affiché"
                value={displayName}
                onChange={(e) =>
                  setDisplayName(e.target.value)
                }
                minLength={2}
                maxLength={40}
                required
              />
            </>
          )}

          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />

          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            minLength={8}
            required
          />

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <button
            className="btn accent"
            disabled={loading}
          >
            {loading
              ? "Chargement..."
              : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>
        </form>

        <p className="subtitle">
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <Link href="/signup">
                Créer un compte
              </Link>
            </>
          ) : (
            <>
              Déjà inscrit ?{" "}
              <Link href="/login">
                Se connecter
              </Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
