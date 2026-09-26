"use client";

import { useEffect,useState } from "react";
import {
  Search,
  UserCheck,
  UserPlus
} from "lucide-react";

type User = {
  id:string;
  username:string;
  display_name:string;
  bio:string;
  avatar_url:string|null;
  following:number|boolean;
};

export default function DiscoverClient() {
  const [query,setQuery] =
    useState("");

  const [users,setUsers] =
    useState<User[]>([]);

  async function load() {
    const response =
      await fetch(
        `/api/users?q=${encodeURIComponent(query)}`,
        {cache:"no-store"}
      );

    if (response.ok) {
      setUsers(
        await response.json()
      );
    }
  }

  useEffect(() => {
    const timer =
      setTimeout(
        load,
        250
      );

    return () =>
      clearTimeout(timer);
  }, [query]);

  async function toggleFollow(
    id:string
  ) {
    const response =
      await fetch(
        `/api/users/${id}/follow`,
        {method:"POST"}
      );

    if (!response.ok) return;

    const data =
      await response.json();

    setUsers(old =>
      old.map(user =>
        user.id === id
          ? {
              ...user,
              following:
                data.following
            }
          : user
      )
    );
  }

  return (
    <div className="container">
      <div className="top-row">
        <div>
          <h1 className="page-title">
            Découvrir
          </h1>

          <p className="subtitle">
            Trouve de nouvelles personnes.
          </p>
        </div>
      </div>

      <div
        className="panel"
        style={{
          padding:14,
          marginBottom:16
        }}
      >
        <div className="row">
          <Search
            size={19}
            className="muted"
          />

          <input
            className="input grow"
            placeholder="Rechercher..."
            value={query}
            onChange={e =>
              setQuery(
                e.target.value
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-3">
        {users.map(user => (
          <article
            className="panel user-card"
            key={user.id}
          >
            <div className="row">
              <img
                className="avatar"
                src={
                  user.avatar_url ||
                  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.display_name)}`
                }
                alt=""
              />

              <div>
                <div className="user-name">
                  {user.display_name}
                </div>

                <div className="user-handle">
                  @{user.username}
                </div>
              </div>
            </div>

            <p className="subtitle">
              {user.bio ||
                "Membre AgoraX"}
            </p>

            <button
              className={
                `btn ${
                  user.following
                    ? "secondary"
                    : "accent"
                }`
              }
              style={{
                width:"100%",
                marginTop:14
              }}
              onClick={() =>
                toggleFollow(
                  user.id
                )
              }
            >
              {user.following ? (
                <>
                  <UserCheck size={16}/>
                  Suivi
                </>
              ) : (
                <>
                  <UserPlus size={16}/>
                  Suivre
                </>
              )}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
