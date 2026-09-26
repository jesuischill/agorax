"use client";

import {
  useEffect,
  useState
} from "react";

type ProfileData = {
  user:{
    id:string;
    email:string;
    username:string;
    display_name:string;
    bio:string;
    avatar_url:string|null;
  };
  stats:{
    posts:number;
    followers:number;
    following:number;
  };
};

export default function ProfileClient() {
  const [data,setData] =
    useState<ProfileData|null>(null);

  const [name,setName] =
    useState("");

  const [bio,setBio] =
    useState("");

  const [avatar,setAvatar] =
    useState<File|null>(null);

  const [saving,setSaving] =
    useState(false);

  async function load() {
    const response =
      await fetch(
        "/api/me",
        {cache:"no-store"}
      );

    if (!response.ok) return;

    const result =
      await response.json();

    setData(result);
    setName(
      result.user.display_name
    );
    setBio(
      result.user.bio
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!data) return;

    setSaving(true);

    try {
      let avatarUrl =
        data.user.avatar_url;

      if (avatar) {
        const form =
          new FormData();

        form.append(
          "file",
          avatar
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

        avatarUrl =
          uploadData.url;
      }

      const response =
        await fetch(
          "/api/me",
          {
            method:"PATCH",
            headers:{
              "Content-Type":
                "application/json"
            },
            body:JSON.stringify({
              displayName:name,
              bio,
              avatarUrl
            })
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error
        );
      }

      setAvatar(null);
      await load();
    } catch(err) {
      alert(
        err instanceof Error
          ? err.message
          : "Erreur"
      );
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="center">
        Chargement...
      </div>
    );
  }

  const image =
    data.user.avatar_url ||
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(data.user.display_name)}`;

  return (
    <div className="container">
      <section className="panel profile-head">
        <div className="row">
          <img
            className="profile-avatar"
            src={image}
            alt=""
          />

          <div>
            <h1 className="page-title">
              {data.user.display_name}
            </h1>

            <div className="user-handle">
              @{data.user.username}
            </div>

            <div className="stats">
              <span className="stat">
                <strong>
                  {data.stats.posts}
                </strong>
                posts
              </span>

              <span className="stat">
                <strong>
                  {data.stats.followers}
                </strong>
                abonnés
              </span>

              <span className="stat">
                <strong>
                  {data.stats.following}
                </strong>
                abonnements
              </span>
            </div>
          </div>
        </div>

        <div
          className="stack"
          style={{marginTop:22}}
        >
          <input
            className="input"
            value={name}
            onChange={e =>
              setName(
                e.target.value
              )
            }
          />

          <textarea
            className="textarea"
            value={bio}
            onChange={e =>
              setBio(
                e.target.value
              )
            }
            placeholder="Ta bio..."
          />

          <label className="btn secondary">
            Changer l’avatar
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={e =>
                setAvatar(
                  e.target.files?.[0] ||
                  null
                )
              }
            />
          </label>

          <button
            className="btn accent"
            disabled={saving}
            onClick={save}
          >
            {saving
              ? "Enregistrement..."
              : "Enregistrer"}
          </button>
        </div>
      </section>
    </div>
  );
}
