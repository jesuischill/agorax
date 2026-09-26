"use client";

import {
  useEffect,
  useState
} from "react";
import { Camera } from "lucide-react";

type Story = {
  id:string;
  username:string;
  display_name:string;
  avatar_url:string|null;
  media_url:string|null;
  media_type:string|null;
  text:string;
  expires_at:string;
};

export default function StoriesClient() {
  const [stories,setStories] =
    useState<Story[]>([]);

  const [text,setText] =
    useState("");

  const [file,setFile] =
    useState<File|null>(null);

  const [loading,setLoading] =
    useState(false);

  async function load() {
    const response =
      await fetch(
        "/api/stories",
        {cache:"no-store"}
      );

    if (response.ok) {
      setStories(
        await response.json()
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function publish() {
    if (!file && !text.trim()) {
      return;
    }

    setLoading(true);

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

        const uploadData =
          await upload.json();

        if (!upload.ok) {
          throw new Error(
            uploadData.error
          );
        }

        media = uploadData;
      }

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

      setText("");
      setFile(null);

      await load();
    } catch (err) {
      alert(
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
      <div className="top-row">
        <div>
          <h1 className="page-title">
            Stories
          </h1>
          <p className="subtitle">
            Les moments qui disparaissent après 24 h.
          </p>
        </div>
      </div>

      <section className="panel composer">
        <textarea
          className="textarea"
          placeholder="Une phrase pour ta story..."
          value={text}
          onChange={e =>
            setText(
              e.target.value
            )
          }
        />

        <div className="toolbar">
          <label className="icon-btn">
            <Camera size={18}/>
            <input
              hidden
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={e =>
                setFile(
                  e.target.files?.[0] ||
                  null
                )
              }
            />
          </label>

          <button
            className="btn accent"
            disabled={loading}
            onClick={publish}
          >
            {loading
              ? "Publication..."
              : "Publier la story"}
          </button>
        </div>
      </section>

      <div className="spacer"/>

      <div className="story-strip">
        {stories.map(story => (
          <article
            className="story"
            key={story.id}
          >
            {story.media_url ? (
              story.media_type ===
              "video" ? (
                <video
                  className="story-media"
                  src={story.media_url}
                  controls
                />
              ) : (
                <img
                  className="story-media"
                  src={story.media_url}
                  alt=""
                />
              )
            ) : (
              <div
                className="story-media"
                style={{
                  display:"grid",
                  placeItems:"center",
                  padding:12
                }}
              >
                {story.text}
              </div>
            )}

            <div className="story-label">
              @{story.username}
            </div>
          </article>
        ))}
      </div>

      {!stories.length && (
        <section className="panel center">
          <div className="muted">
            Aucune story active.
          </div>
        </section>
      )}
    </div>
  );
}
