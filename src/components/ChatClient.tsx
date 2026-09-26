"use client";

import {
  useEffect,
  useState
} from "react";

type User = {
  id:string;
  username:string;
  display_name:string;
  avatar_url:string|null;
};

type Message = {
  id:string;
  sender_id:string;
  body:string;
  created_at:string;
};

export default function ChatClient({
  me
}: {
  me:string;
}) {
  const [users,setUsers] =
    useState<User[]>([]);

  const [selected,setSelected] =
    useState<User|null>(null);

  const [messages,setMessages] =
    useState<Message[]>([]);

  const [body,setBody] =
    useState("");

  async function loadUsers() {
    const response =
      await fetch("/api/users");

    if (response.ok) {
      setUsers(
        await response.json()
      );
    }
  }

  async function loadMessages() {
    if (!selected) return;

    const response =
      await fetch(
        `/api/messages?with=${selected.id}`,
        {cache:"no-store"}
      );

    if (response.ok) {
      setMessages(
        await response.json()
      );
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadMessages();

    if (!selected) return;

    const timer =
      setInterval(
        loadMessages,
        1500
      );

    return () =>
      clearInterval(timer);
  }, [selected?.id]);

  async function send() {
    const text =
      body.trim();

    if (!selected || !text) {
      return;
    }

    const response =
      await fetch(
        "/api/messages",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:JSON.stringify({
            with:selected.id,
            body:text
          })
        }
      );

    if (response.ok) {
      setBody("");
      loadMessages();
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">
        Messages
      </h1>

      <p className="subtitle">
        Discute directement avec les membres.
      </p>

      <div
        className="panel chat-layout"
        style={{marginTop:18}}
      >
        <div className="chat-users">
          {users.map(user => (
            <button
              className={
                `chat-user ${
                  selected?.id === user.id
                    ? "active"
                    : ""
                }`
              }
              key={user.id}
              onClick={() =>
                setSelected(user)
              }
            >
              <div className="row">
                <img
                  className="avatar"
                  style={{
                    width:39,
                    height:39
                  }}
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
            </button>
          ))}
        </div>

        <div className="chat-window">
          <div
            style={{
              padding:16,
              borderBottom:
                "1px solid var(--line)"
            }}
          >
            {selected
              ? selected.display_name
              : "Sélectionne un membre"}
          </div>

          <div className="messages">
            {messages.map(
              message => (
                <div
                  key={message.id}
                  className={
                    `bubble ${
                      message.sender_id === me
                        ? "mine"
                        : ""
                    }`
                  }
                >
                  {message.body}
                </div>
              )
            )}
          </div>

          <div className="chat-compose">
            <input
              className="input"
              disabled={!selected}
              placeholder="Écrire un message..."
              value={body}
              onChange={e =>
                setBody(
                  e.target.value
                )
              }
              onKeyDown={e => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  send();
                }
              }}
            />

            <button
              className="btn accent"
              disabled={!selected}
              onClick={send}
            >
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
