"use client";

import {
  useState
} from "react";

type Kind =
  | "post"
  | "reel"
  | "story";

export default function CreateClient() {
  const [kind,setKind] =
    useState<Kind>("post");

  const [text,setText] =
    useState("");

  const [file,setFile] =
    useState<File|null>(null);

  const [loading,setLoading] =
    useState(false);

  const [message,setMessage] =
    useState("");

  async function submit() {
    if (!text.trim() && !file) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      let media = null;

      if (file) {
        const form =
          new FormData();

        form.append(
          "file",
          file
        );

        const upload =
          await fetch(
            "/api/upload",
            {
              method:"POST",
              body:form
            }
          );

        const data =
          await upload.json();

        if (!upload.ok) {
          throw new Error(
            data.error
          );
        }

        media = data;
      }

      if (kind === "story") {
        const response =
          await fetch(
            "/api/stories",
            {
              method:"POST",
              headers:{
                "Content-Type":
                  "application/json"
              },
              body:JSON.stringify({
                text,
                mediaUrl:
                  media?.url || null,
                mediaType:
                  media?.mediaType || null
              })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error
          );
        }

        setMessage(
          "Story publiée pour 24 heures."
        );
      } else {
        const response =
          await fetch(
            "/api/posts",
            {
              method:"POST",
              headers:{
                "Content-Type":
                  "application/json"
              },
              body:JSON.stringify({
                kind,
                caption:text,
                mediaUrl:
                  media?.url || null,
                mediaType:
                  media?.mediaType || null
              })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error
          );
        }

        setMessage(
          kind === "reel"
            ? "Reel publié."
            : "Post publié."
        );
      }

      setText("");
      setFile(null);
    } catch(err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Erreur."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">
        Créer
      </h1>

      <p className="subtitle">
        Post, Reel ou Story.
      </p>

      <section
        className="panel"
        style={{
          padding:20,
          marginTop:18,
          width:"min(100%,720px)"
        }}
      >
        <div className="row">
          {(
            [
              "post",
              "reel",
              "story"
            ] as Kind[]
          ).map(value => (
            <button
              key={value}
              className={
                `btn ${
                  value === kind
                    ? "accent"
                    : "secondary"
                }`
              }
              onClick={() =>
                setKind(value)
              }
            >
              {value === "post"
                ? "Post"
                : value === "reel"
                ? "Reel"
                : "Story"}
            </button>
          ))}
        </div>

        <div className="spacer"/>

        <textarea
          className="textarea"
          placeholder="Ajoute une légende..."
          value={text}
          onChange={e =>
            setText(
              e.target.value
            )
          }
        />

        <div className="spacer"/>

        <label
          className="panel"
          style={{
            minHeight:210,
            display:"grid",
            placeItems:"center",
            borderStyle:"dashed",
            cursor:"pointer"
          }}
        >
          <div className="center">
            {file ? (
              <>
                <strong>
                  {file.name}
                </strong>
                <p className="subtitle">
                  Média sélectionné
                </p>
              </>
            ) : (
              <>
                <strong>
                  Ajouter une image ou une vidéo
                </strong>
                <p className="subtitle">
                  La caméra mobile peut être utilisée.
                </p>
              </>
            )}
          </div>

          <input
            hidden
            type="file"
            accept={
              kind === "reel"
                ? "video/*"
                : "image/*,video/*"
            }
            capture={
              kind === "story"
                ? "environment"
                : undefined
            }
            onChange={e =>
              setFile(
                e.target.files?.[0] ||
                null
              )
            }
          />
        </label>

        <div className="spacer"/>

        {message && (
          <div className="success">
            {message}
          </div>
        )}

        <button
          className="btn accent"
          style={{
            width:"100%",
            marginTop:12
          }}
          disabled={loading}
          onClick={submit}
        >
          {loading
            ? "Publication..."
            : `Publier ${kind}`}
        </button>
      </section>
    </div>
  );
}
