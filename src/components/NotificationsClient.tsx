"use client";

import {
  useEffect,
  useState
} from "react";

type Notification = {
  id:string;
  type:string;
  actor_username:string|null;
  actor_display_name:string|null;
  created_at:string;
};

export default function NotificationsClient() {
  const [items,setItems] =
    useState<Notification[]>([]);

  async function load() {
    const response =
      await fetch(
        "/api/notifications",
        {cache:"no-store"}
      );

    if (response.ok) {
      setItems(
        await response.json()
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  function message(
    item:Notification
  ) {
    const actor =
      item.actor_display_name ||
      item.actor_username ||
      "Quelqu’un";

    if (item.type === "like") {
      return `${actor} a aimé ton post.`;
    }

    if (item.type === "comment") {
      return `${actor} a commenté ton post.`;
    }

    if (item.type === "follow") {
      return `${actor} a commencé à te suivre.`;
    }

    if (item.type === "message") {
      return `${actor} t’a envoyé un message.`;
    }

    return "Nouvelle notification.";
  }

  return (
    <div className="container">
      <h1 className="page-title">
        Notifications
      </h1>

      <p className="subtitle">
        Ton activité récente.
      </p>

      <div
        className="stack"
        style={{marginTop:18}}
      >
        {!items.length && (
          <section className="panel center">
            <div className="muted">
              Aucune notification.
            </div>
          </section>
        )}

        {items.map(item => (
          <div
            className="panel"
            style={{padding:16}}
            key={item.id}
          >
            <strong>
              {message(item)}
            </strong>

            <div className="subtitle">
              {new Date(
                item.created_at
              ).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
