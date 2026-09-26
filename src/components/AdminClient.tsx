"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Ban,
  CheckCircle2,
  Crown,
  Eye,
  MessageSquare,
  Shield,
  Trash2,
  UserCheck,
  UserX
} from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: "user" | "owner";
  banned: number;
  created_at: string;
  post_count: number;
  follower_count: number;
  message_count: number;
};

type AdminPost = {
  id: string;
  kind: string;
  caption: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  username: string;
  display_name: string;
};

type Conversation = {
  id: string;
  participants: string;
  last_message: string | null;
  last_message_at: string | null;
};

type Message = {
  id: string;
  username: string;
  display_name: string;
  body: string;
  created_at: string;
  sender_id: string;
};

export default function AdminClient({
  currentUserId
}: {
  currentUserId: string;
}) {
  const [tab, setTab] =
    useState<"users" | "posts" | "messages">(
      "users"
    );

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [posts, setPosts] =
    useState<AdminPost[]>([]);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [selectedConversation, setSelectedConversation] =
    useState<string | null>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [search, setSearch] =
    useState("");

  const [busy, setBusy] =
    useState<string | null>(null);

  async function loadUsers() {
    const response =
      await fetch(
        `/api/admin/users?q=${encodeURIComponent(search)}`,
        { cache: "no-store" }
      );

    if (response.ok) {
      setUsers(await response.json());
    }
  }

  async function loadPosts() {
    const response =
      await fetch(
        "/api/admin/posts",
        { cache: "no-store" }
      );

    if (response.ok) {
      setPosts(await response.json());
    }
  }

  async function loadConversations() {
    const response =
      await fetch(
        "/api/admin/conversations",
        { cache: "no-store" }
      );

    if (response.ok) {
      setConversations(
        await response.json()
      );
    }
  }

  useEffect(() => {
    loadUsers();
    loadPosts();
    loadConversations();
  }, []);

  useEffect(() => {
    const timer =
      setTimeout(
        loadUsers,
        200
      );

    return () =>
      clearTimeout(timer);
  }, [search]);

  async function action(
    key: string,
    url: string,
    init: RequestInit
  ) {
    setBusy(key);

    try {
      const response =
        await fetch(
          url,
          {
            ...init,
            headers: {
              "Content-Type":
                "application/json",
              ...(init.headers || {})
            }
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
          "Action refusée."
        );
        return null;
      }

      return data;
    } finally {
      setBusy(null);
    }
  }

  async function toggleBan(user: AdminUser) {
    const next = !Boolean(user.banned);

    if (
      !window.confirm(
        next
          ? `Bannir @${user.username} ?`
          : `Débannir @${user.username} ?`
      )
    ) {
      return;
    }

    const data =
      await action(
        `ban-${user.id}`,
        `/api/admin/users/${user.id}/ban`,
        {
          method: "POST",
          body: JSON.stringify({
            banned: next
          })
        }
      );

    if (!data) return;

    setUsers(old =>
      old.map(item =>
        item.id === user.id
          ? {
              ...item,
              banned: data.banned ? 1 : 0
            }
          : item
      )
    );
  }

  async function toggleRole(user: AdminUser) {
    const next =
      user.role === "owner"
        ? "user"
        : "owner";

    if (
      !window.confirm(
        next === "owner"
          ? `Donner les droits owner à @${user.username} ?`
          : `Retirer les droits owner de @${user.username} ?`
      )
    ) {
      return;
    }

    const data =
      await action(
        `role-${user.id}`,
        `/api/admin/users/${user.id}/role`,
        {
          method: "POST",
          body: JSON.stringify({
            role: next
          })
        }
      );

    if (!data) return;

    setUsers(old =>
      old.map(item =>
        item.id === user.id
          ? {
              ...item,
              role: data.role
            }
          : item
      )
    );
  }

  async function deleteUser(user: AdminUser) {
    if (
      !window.confirm(
        `SUPPRIMER définitivement @${user.username} et ses données ?`
      )
    ) {
      return;
    }

    const data =
      await action(
        `delete-${user.id}`,
        `/api/admin/users/${user.id}`,
        {
          method: "DELETE"
        }
      );

    if (!data) return;

    setUsers(old =>
      old.filter(
        item => item.id !== user.id
      )
    );
  }

  async function deletePost(post: AdminPost) {
    if (
      !window.confirm(
        `Supprimer le post de @${post.username} ?`
      )
    ) {
      return;
    }

    const data =
      await action(
        `post-${post.id}`,
        `/api/admin/posts/${post.id}`,
        {
          method: "DELETE"
        }
      );

    if (!data) return;

    setPosts(old =>
      old.filter(
        item => item.id !== post.id
      )
    );
  }

  async function inspectConversation(
    id: string
  ) {
    setSelectedConversation(id);

    const response =
      await fetch(
        `/api/admin/conversations/${id}`,
        { cache: "no-store" }
      );

    if (!response.ok) {
      alert(
        "Impossible de charger la discussion."
      );
      return;
    }

    const data =
      await response.json();

    setMessages(data.messages);
  }

  async function deleteConversation(
    id: string
  ) {
    if (
      !window.confirm(
        "Supprimer définitivement cette discussion privée ?"
      )
    ) {
      return;
    }

    const data =
      await action(
        `conversation-${id}`,
        `/api/admin/conversations/${id}`,
        {
          method: "DELETE"
        }
      );

    if (!data) return;

    setConversations(old =>
      old.filter(
        item => item.id !== id
      )
    );

    if (selectedConversation === id) {
      setSelectedConversation(null);
      setMessages([]);
    }
  }

  const stats = useMemo(
    () => ({
      total: users.length,
      banned: users.filter(
        user => Boolean(user.banned)
      ).length,
      owners: users.filter(
        user => user.role === "owner"
      ).length,
      posts: posts.length,
      conversations:
        conversations.length
    }),
    [users, posts, conversations]
  );

  return (
    <div className="container admin-page">
      <div className="admin-header">
        <div>
          <div className="admin-kicker">
            <Shield size={17} />
            CENTRE DE MODÉRATION
          </div>

          <h1 className="page-title">
            Panneau Admin
          </h1>

          <p className="subtitle">
            Gestion des comptes, contenus et
            discussions sensibles.
          </p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="panel admin-stat">
          <strong>{stats.total}</strong>
          <span>comptes</span>
        </div>

        <div className="panel admin-stat">
          <strong>{stats.banned}</strong>
          <span>bannis</span>
        </div>

        <div className="panel admin-stat">
          <strong>{stats.owners}</strong>
          <span>owners</span>
        </div>

        <div className="panel admin-stat">
          <strong>{stats.posts}</strong>
          <span>posts</span>
        </div>

        <div className="panel admin-stat">
          <strong>{stats.conversations}</strong>
          <span>discussions</span>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={
            tab === "users"
              ? "btn accent"
              : "btn secondary"
          }
          onClick={() =>
            setTab("users")
          }
        >
          <UserCheck size={17} />
          Comptes
        </button>

        <button
          className={
            tab === "posts"
              ? "btn accent"
              : "btn secondary"
          }
          onClick={() =>
            setTab("posts")
          }
        >
          <Trash2 size={17} />
          Publications
        </button>

        <button
          className={
            tab === "messages"
              ? "btn accent"
              : "btn secondary"
          }
          onClick={() =>
            setTab("messages")
          }
        >
          <MessageSquare size={17} />
          Discussions privées
        </button>
      </div>

      {tab === "users" && (
        <section className="stack">
          <div className="panel admin-toolbar">
            <input
              className="input"
              placeholder="Rechercher un compte..."
              value={search}
              onChange={event =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          {users.map(user => (
            <article
              className="panel admin-user"
              key={user.id}
            >
              <div className="admin-user-main">
                <div className="admin-avatar">
                  {user.display_name
                    .slice(0, 1)
                    .toUpperCase()}
                </div>

                <div className="admin-user-info">
                  <div className="row">
                    <strong>
                      {user.display_name}
                    </strong>

                    {user.role === "owner" && (
                      <span className="admin-badge owner">
                        <Crown size={13} />
                        OWNER
                      </span>
                    )}

                    {Boolean(user.banned) && (
                      <span className="admin-badge banned">
                        <Ban size={13} />
                        BANNI
                      </span>
                    )}
                  </div>

                  <div className="user-handle">
                    @{user.username} • {user.email}
                  </div>

                  <div className="admin-meta">
                    {user.post_count} posts •{" "}
                    {user.follower_count} abonnés •{" "}
                    {user.message_count} messages
                  </div>
                </div>
              </div>

              <div className="admin-actions">
                <button
                  className="btn secondary"
                  disabled={
                    busy ===
                    `ban-${user.id}`
                  }
                  onClick={() =>
                    toggleBan(user)
                  }
                >
                  {user.banned ? (
                    <>
                      <CheckCircle2 size={16} />
                      Débannir
                    </>
                  ) : (
                    <>
                      <Ban size={16} />
                      Bannir
                    </>
                  )}
                </button>

                <button
                  className="btn secondary"
                  disabled={
                    busy ===
                    `role-${user.id}`
                  }
                  onClick={() =>
                    toggleRole(user)
                  }
                >
                  {user.role === "owner" ? (
                    <>
                      <UserX size={16} />
                      Non-owner
                    </>
                  ) : (
                    <>
                      <Crown size={16} />
                      Rendre owner
                    </>
                  )}
                </button>

                <button
                  className="btn danger"
                  disabled={
                    busy ===
                    `delete-${user.id}` ||
                    user.id ===
                      currentUserId
                  }
                  onClick={() =>
                    deleteUser(user)
                  }
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "posts" && (
        <section className="stack">
          {posts.map(post => (
            <article
              className="panel admin-post"
              key={post.id}
            >
              <div className="admin-post-head">
                <div>
                  <strong>
                    @{post.username}
                  </strong>

                  <div className="subtitle">
                    {post.kind.toUpperCase()} •{" "}
                    {new Date(
                      post.created_at
                    ).toLocaleString()}
                  </div>
                </div>

                <button
                  className="btn danger"
                  disabled={
                    busy ===
                    `post-${post.id}`
                  }
                  onClick={() =>
                    deletePost(post)
                  }
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </div>

              {post.caption && (
                <p className="post-caption">
                  {post.caption}
                </p>
              )}

              {post.media_url && (
                <div className="admin-post-media">
                  {post.media_type ===
                  "video" ? (
                    <video
                      src={post.media_url}
                      controls
                    />
                  ) : (
                    <img
                      src={post.media_url}
                      alt=""
                    />
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === "messages" && (
        <section className="admin-chat-layout">
          <div className="panel admin-conversations">
            <div className="admin-section-title">
              Discussions
            </div>

            {conversations.map(
              conversation => (
                <button
                  key={conversation.id}
                  className={
                    `admin-conversation ${
                      selectedConversation ===
                      conversation.id
                        ? "selected"
                        : ""
                    }`
                  }
                  onClick={() =>
                    inspectConversation(
                      conversation.id
                    )
                  }
                >
                  <strong>
                    {conversation.participants}
                  </strong>

                  <span>
                    {conversation.last_message ||
                      "Aucun message"}
                  </span>
                </button>
              )
            )}
          </div>

          <div className="panel admin-messages">
            {!selectedConversation ? (
              <div className="center">
                <Eye size={35} />
                <p>
                  Sélectionne une discussion
                  pour l’examiner en modération.
                </p>
              </div>
            ) : (
              <>
                <div className="admin-message-toolbar">
                  <strong>
                    Discussion privée
                  </strong>

                  <button
                    className="btn danger"
                    disabled={
                      busy ===
                      `conversation-${selectedConversation}`
                    }
                    onClick={() =>
                      deleteConversation(
                        selectedConversation
                      )
                    }
                  >
                    <Trash2 size={16} />
                    Supprimer discussion
                  </button>
                </div>

                <div className="admin-message-list">
                  {messages.map(
                    message => (
                      <div
                        className="admin-message"
                        key={message.id}
                      >
                        <strong>
                          @{message.username}
                        </strong>

                        <span>
                          {message.body}
                        </span>

                        <small>
                          {new Date(
                            message.created_at
                          ).toLocaleString()}
                        </small>
                      </div>
                    )
                  )}

                  {!messages.length && (
                    <div className="center">
                      Aucun message.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <div className="admin-warning">
        <Shield size={16} />
        Les discussions privées affichées ici sont
        réservées à la modération en cas de problème.
      </div>
    </div>
  );
}
