"use client";

import {
  Hash,
  Plus,
  Send,
  Trash2,
  Users,
  X,
  MessageCircle
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

type Salon = {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_by: string;
  created_at: string;
  message_count?: number;
  last_message?: string | null;
  last_message_at?: string | null;
};

type SalonMessage = {
  id: string;
  salon_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string;
};

export default function SalonsClient() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<SalonMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState("");

  const selectedSalon = useMemo(
    () => salons.find((salon) => salon.id === selectedId) ?? null,
    [salons, selectedId]
  );

  const loadSalons = useCallback(async () => {
    try {
      const response = await fetch("/api/salons", {
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Impossible de charger les salons.");
      }

      setSalons(data.salons ?? []);

      setSelectedId((current) => {
        if (
          current &&
          (data.salons ?? []).some(
            (salon: Salon) => salon.id === current
          )
        ) {
          return current;
        }

        return data.salons?.[0]?.id ?? "";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur de chargement."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (salonId: string) => {
    if (!salonId) {
      setMessages([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/salons/${encodeURIComponent(salonId)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Impossible de charger le salon."
        );
      }

      setMessages(data.messages ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur de chargement du salon."
      );
    }
  }, []);

  useEffect(() => {
    void loadSalons();
  }, [loadSalons]);

  useEffect(() => {
    if (!selectedId) return;

    void loadMessages(selectedId);

    const timer = window.setInterval(() => {
      void loadMessages(selectedId);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [selectedId, loadMessages]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const content = message.trim();

    if (!content || !selectedId) return;

    setError("");

    try {
      const response = await fetch(
        `/api/salons/${encodeURIComponent(selectedId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ content })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Impossible d'envoyer le message."
        );
      }

      setMessage("");
      await loadMessages(selectedId);
      await loadSalons();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'envoi."
      );
    }
  }

  async function createSalon(event: FormEvent) {
    event.preventDefault();

    const name = newName.trim();
    const description = newDescription.trim();

    if (!name) return;

    setError("");

    try {
      const response = await fetch("/api/salons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Impossible de créer le salon."
        );
      }

      setNewName("");
      setNewDescription("");
      setCreating(false);

      await loadSalons();

      if (data.salon?.id) {
        setSelectedId(data.salon.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création."
      );
    }
  }

  async function deleteSalon(salon: Salon) {
    if (!window.confirm(`Supprimer le salon "${salon.name}" ?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/salons/${encodeURIComponent(salon.id)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Impossible de supprimer le salon."
        );
      }

      if (selectedId === salon.id) {
        setSelectedId("");
        setMessages([]);
      }

      await loadSalons();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la suppression."
      );
    }
  }

  return (
    <div className="salons-page">
      <div className="salons-container">
        <header className="salons-header">
          <div>
            <div className="salons-kicker">
              <Users size={15} />
              Communauté
            </div>

            <h1>Salons</h1>

            <p>
              Discute avec la communauté AgoraX dans des espaces publics.
            </p>
          </div>

          <button
            type="button"
            className="salons-primary-button"
            onClick={() => setCreating(true)}
          >
            <Plus size={18} />
            Nouveau salon
          </button>
        </header>

        {error ? (
          <div className="salons-error">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <div className="salons-layout">
          <aside className="salons-sidebar">
            <div className="salons-sidebar-title">
              <span>Salons disponibles</span>
              <span>{salons.length}</span>
            </div>

            {loading ? (
              <div className="salons-empty">Chargement...</div>
            ) : salons.length === 0 ? (
              <div className="salons-empty">
                Aucun salon pour le moment.
              </div>
            ) : (
              <div className="salons-list">
                {salons.map((salon) => (
                  <button
                    key={salon.id}
                    type="button"
                    className={`salon-item ${
                      selectedId === salon.id ? "is-active" : ""
                    }`}
                    onClick={() => setSelectedId(salon.id)}
                  >
                    <span className="salon-item-icon">
                      <Hash size={18} />
                    </span>

                    <span className="salon-item-copy">
                      <strong>{salon.name}</strong>

                      <span>
                        {salon.last_message
                          ? salon.last_message.length > 42
                            ? `${salon.last_message.slice(0, 42)}…`
                            : salon.last_message
                          : salon.description ||
                            "Aucun message pour le moment"}
                      </span>
                    </span>

                    <span className="salon-item-count">
                      {Number(salon.message_count ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="salons-chat">
            {selectedSalon ? (
              <>
                <div className="salon-chat-header">
                  <div className="salon-chat-title">
                    <div className="salon-chat-icon">
                      <Hash size={23} />
                    </div>

                    <div>
                      <h2>{selectedSalon.name}</h2>
                      <p>
                        {selectedSalon.description ||
                          "Salon public AgoraX"}
                      </p>
                    </div>
                  </div>

                  <div className="salon-chat-actions">
                    <span className="salon-online">
                      <span className="salon-online-dot" />
                      Public
                    </span>

                    <button
                      type="button"
                      className="salon-delete-button"
                      onClick={() => deleteSalon(selectedSalon)}
                      title="Supprimer le salon"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="salon-messages">
                  {messages.length === 0 ? (
                    <div className="salon-welcome">
                      <div className="salon-welcome-icon">
                        <MessageCircle size={28} />
                      </div>

                      <h3>
                        Bienvenue dans #{selectedSalon.name}
                      </h3>

                      <p>
                        Aucun message pour le moment.
                        Lance la discussion.
                      </p>
                    </div>
                  ) : (
                    messages.map((item) => (
                      <article key={item.id} className="salon-message">
                        <div className="salon-avatar">
                          {item.avatar_url ? (
                            <img src={item.avatar_url} alt="" />
                          ) : (
                            item.username.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="salon-message-main">
                          <div className="salon-message-meta">
                            <strong>
                              {item.display_name || item.username}
                            </strong>

                            <span>@{item.username}</span>

                            <time>
                              {new Date(
                                item.created_at
                              ).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </time>
                          </div>

                          <p>{item.content}</p>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <form
                  className="salon-composer"
                  onSubmit={sendMessage}
                >
                  <input
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    placeholder={`Écrire dans #${selectedSalon.name}...`}
                    maxLength={2000}
                  />

                  <button
                    type="submit"
                    aria-label="Envoyer"
                    disabled={!message.trim()}
                  >
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <div className="salon-no-selection">
                <div className="salon-welcome-icon">
                  <Hash size={28} />
                </div>

                <h2>Sélectionne un salon</h2>

                <p>
                  Choisis un espace à gauche pour commencer.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      {creating ? (
        <div className="salon-modal-backdrop">
          <div className="salon-modal">
            <div className="salon-modal-header">
              <div>
                <span>Nouveau salon</span>
                <h2>Créer un espace</h2>
              </div>

              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createSalon}>
              <label>
                Nom du salon
                <input
                  value={newName}
                  onChange={(event) =>
                    setNewName(event.target.value)
                  }
                  placeholder="Ex : Football"
                  minLength={2}
                  maxLength={40}
                  autoFocus
                />
              </label>

              <label>
                Description
                <textarea
                  value={newDescription}
                  onChange={(event) =>
                    setNewDescription(event.target.value)
                  }
                  placeholder="De quoi parle ce salon ?"
                  maxLength={160}
                  rows={4}
                />
              </label>

              <div className="salon-modal-actions">
                <button
                  type="button"
                  className="salon-secondary-button"
                  onClick={() => setCreating(false)}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="salons-primary-button"
                >
                  <Plus size={17} />
                  Créer le salon
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
