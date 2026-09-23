(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const state = {
    me: null,
    currentPage: "home",
    currentChat: "__public__",
    socket: null,
    conversations: [],
    messages: {},
    stories: [],
    feed: [],
    notifications: []
  };

  /* ================= HELPERS ================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initials(name) {
    const text = String(name || "A").trim();
    return text
      .split(/\s+/)
      .slice(0, 2)
      .map(x => x[0])
      .join("")
      .toUpperCase() || "A";
  }

  function timeAgo(date) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";

    const diff = Math.max(0, Date.now() - d.getTime());

    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "à l'instant";

    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min`;

    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} h`;

    const day = Math.floor(hour / 24);
    if (day < 7) return `${day} j`;

    return d.toLocaleDateString("fr-FR");
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2800);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Erreur ${response.status}`);
    }

    return data;
  }


  /* ================= AUTH ================= */

  async function loadMe() {
    try {
      const data = await api("/api/auth/me");

      state.me = data.user || data;

      updateCurrentUserUI();

      return true;
    } catch {
      window.location.href = "/login.html";
      return false;
    }
  }

  function updateCurrentUserUI() {
    if (!state.me) return;

    const username =
      state.me.username ||
      state.me.pseudo ||
      "Agorex";

    const avatar =
      state.me.avatar ||
      state.me.avatarUrl ||
      "";

    const displayName =
      state.me.displayName ||
      state.me.name ||
      username;

    const letter = initials(displayName);

    const avatarElements = [
      $("#composerAvatar"),
      $("#topAvatar"),
      $("#profileAvatar")
    ];

    avatarElements.forEach(el => {
      if (!el) return;

      if (avatar) {
        el.innerHTML = `<img src="${escapeHTML(avatar)}" alt="">`;
      } else {
        el.textContent = letter;
      }
    });

    $("#profileName").textContent = displayName;
    $("#profileUsername").textContent = `@${username}`;
    $("#profileBio").textContent =
      state.me.bio || "Bienvenue sur mon profil Agorex.";

    $("#editDisplayName").value =
      state.me.displayName || state.me.name || "";

    $("#editBio").value =
      state.me.bio || "";
  }


  /* ================= NAVIGATION ================= */

  function showPage(page) {
    state.currentPage = page;

    $$(".page").forEach(el => {
      el.classList.toggle("active", el.id === `page-${page}`);
    });

    $$(".nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.page === page);
    });

    $$(".mobile-nav button[data-page]").forEach(el => {
      el.classList.toggle("active", el.dataset.page === page);
    });

    if (page === "home") loadFeed();
    if (page === "messages") loadConversations();
    if (page === "notifications") loadNotifications();
    if (page === "profile") loadProfile();
  }


  $$(".nav-item[data-page]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  $$(".mobile-nav button[data-page]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  $("#mobileMenuButton")?.addEventListener("click", () => {
    toast("Utilisez la navigation en bas de l'écran.");
  });

  $("#topProfileButton")?.addEventListener("click", () => {
    showPage("profile");
  });


  /* ================= MODALS ================= */

  function openModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.remove("hidden");
  }

  function closeModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.add("hidden");
  }

  $$("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal(button.dataset.close);
    });
  });

  $$(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", () => {
      backdrop.parentElement.classList.add("hidden");
    });
  });

  $("#createButton")?.addEventListener("click", () => openModal("createModal"));
  $("#topCreateButton")?.addEventListener("click", () => openModal("createModal"));
  $("#mobileCreateButton")?.addEventListener("click", () => openModal("createModal"));

  $("#composerOpen")?.addEventListener("click", () => openModal("postModal"));
  $("#photoPostButton")?.addEventListener("click", () => openModal("postModal"));
  $("#emojiPostButton")?.addEventListener("click", () => openModal("postModal"));

  $("#storyPostButton")?.addEventListener("click", () => openModal("storyModal"));
  $("#myStoryButton")?.addEventListener("click", () => openModal("storyModal"));

  $("#createPostOption")?.addEventListener("click", () => {
    closeModal("createModal");
    openModal("postModal");
  });

  $("#createStoryOption")?.addEventListener("click", () => {
    closeModal("createModal");
    openModal("storyModal");
  });

  $("#editProfileButton")?.addEventListener("click", () => {
    openModal("profileModal");
  });


  /* ================= LOGOUT ================= */

  $("#logoutButton")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", {
        method: "POST"
      });

      window.location.href = "/login.html";
    } catch (error) {
      toast(error.message);
    }
  });


  /* ================= FEED ================= */

  async function loadFeed() {
    const feed = $("#feed");
    if (!feed) return;

    try {
      const data = await api("/api/feed");

      state.feed =
        Array.isArray(data)
          ? data
          : data.posts || data.feed || [];

      renderFeed();
    } catch (error) {
      feed.innerHTML = `
        <div class="empty-state">
          <div>!</div>
          <h3>Impossible de charger le fil</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  }

  function renderFeed() {
    const feed = $("#feed");

    if (!feed) return;

    if (!state.feed.length) {
      feed.innerHTML = `
        <div class="empty-state">
          <div>✦</div>
          <h3>Votre fil est vide</h3>
          <p>Publiez quelque chose pour commencer Agorex.</p>
        </div>
      `;
      return;
    }

    feed.innerHTML = state.feed.map(post => {
      const username =
        post.username ||
        post.author?.username ||
        "Agorex";

      const name =
        post.displayName ||
        post.author?.displayName ||
        username;

      const text =
        post.text ||
        post.content ||
        "";

      const image =
        post.image ||
        post.imageUrl ||
        "";

      const likes =
        Number(post.likesCount ?? post.likes ?? 0);

      const comments =
        Number(post.commentsCount ?? post.comments?.length ?? 0);

      const liked =
        post.likedByMe ||
        post.liked ||
        false;

      return `
        <article class="post" data-post-id="${escapeHTML(post.id || post._id || "")}">

          <header class="post-header">

            <div class="avatar">
              ${escapeHTML(initials(name))}
            </div>

            <div class="post-user">
              <strong>${escapeHTML(name)}</strong>
              <span>@${escapeHTML(username)} · ${escapeHTML(timeAgo(post.createdAt || post.date))}</span>
            </div>

            <button class="post-menu">•••</button>

          </header>

          ${
            text
              ? `<div class="post-content">${escapeHTML(text)}</div>`
              : ""
          }

          ${
            image
              ? `<img class="post-image" src="${escapeHTML(image)}" alt="Publication">`
              : ""
          }

          <div class="post-actions">

            <button class="${liked ? "liked" : ""}" data-like="${escapeHTML(post.id || post._id || "")}">
              ♡ ${likes}
            </button>

            <button data-comment="${escapeHTML(post.id || post._id || "")}">
              ◌ ${comments}
            </button>

            <button data-share="${escapeHTML(post.id || post._id || "")}">
              ↗ Partager
            </button>

          </div>

        </article>
      `;
    }).join("");

    $$("[data-like]").forEach(button => {
      button.addEventListener("click", async () => {
        try {
          await api(`/api/posts/${encodeURIComponent(button.dataset.like)}/like`, {
            method: "POST"
          });

          loadFeed();
        } catch (error) {
          toast(error.message);
        }
      });
    });

    $$("[data-share]").forEach(button => {
      button.addEventListener("click", async () => {
        const url = `${location.origin}/#post-${button.dataset.share}`;

        try {
          await navigator.clipboard.writeText(url);
          toast("Lien copié.");
        } catch {
          toast(url);
        }
      });
    });

    $$("[data-comment]").forEach(button => {
      button.addEventListener("click", () => {
        toast("Les commentaires seront affichés ici.");
      });
    });
  }

  $("#refreshFeed")?.addEventListener("click", loadFeed);


  /* ================= STORIES ================= */

  async function loadStories() {
    try {
      const data = await api("/api/stories");

      state.stories =
        Array.isArray(data)
          ? data
          : data.stories || [];

      renderStories();
    } catch {
      renderStories();
    }
  }

  function renderStories() {
    const list = $("#storiesList");

    if (!list) return;

    list.innerHTML = state.stories.map(story => {
      const username =
        story.username ||
        story.author?.username ||
        "Utilisateur";

      const name =
        story.displayName ||
        story.author?.displayName ||
        username;

      const avatar =
        story.avatar ||
        story.author?.avatar ||
        "";

      return `
        <button class="story" data-story-id="${escapeHTML(story.id || story._id || "")}">

          <div class="story-avatar">

            ${
              avatar
                ? `<img src="${escapeHTML(avatar)}" alt="">`
                : escapeHTML(initials(name))
            }

          </div>

          <span>${escapeHTML(name)}</span>

        </button>
      `;
    }).join("");

    $$(".story[data-story-id]").forEach(button => {
      button.addEventListener("click", () => {
        toast("Ouverture de la story...");
      });
    });
  }


  /* ================= POSTS ================= */

  $("#postForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const text = $("#postText").value.trim();

    if (!text) {
      toast("Écrivez quelque chose.");
      return;
    }

    try {
      const body = new FormData();
      body.append("text", text);

      await api("/api/posts", {
        method: "POST",
        body
      });

      $("#postText").value = "";
      closeModal("postModal");
      toast("Publication créée.");
      loadFeed();
    } catch (error) {
      toast(error.message);
    }
  });


  /* ================= STORIES CREATE ================= */

  $("#storyForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const text = $("#storyText").value.trim();

    if (!text) {
      toast("Écrivez quelque chose.");
      return;
    }

    try {
      await api("/api/stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text
        })
      });

      $("#storyText").value = "";
      closeModal("storyModal");
      toast("Story publiée.");
      loadStories();
    } catch (error) {
      toast(error.message);
    }
  });


  /* ================= PROFILE ================= */

  async function loadProfile() {
    if (!state.me) return;

    const username = state.me.username;

    try {
      const data = await api(`/api/profile/${encodeURIComponent(username)}`);

      const profile = data.profile || data.user || data;

      if (profile) {
        $("#profileName").textContent =
          profile.displayName ||
          profile.name ||
          username;

        $("#profileUsername").textContent =
          `@${profile.username || username}`;

        $("#profileBio").textContent =
          profile.bio ||
          "Bienvenue sur mon profil Agorex.";

        $("#profilePosts").textContent =
          profile.postsCount ??
          profile.posts?.length ??
          0;

        $("#profileFollowers").textContent =
          profile.followersCount ??
          profile.followers?.length ??
          0;

        $("#profileFollowing").textContent =
          profile.followingCount ??
          profile.following?.length ??
          0;
      }
    } catch {
      updateCurrentUserUI();
    }

    renderProfilePosts();
  }

  function renderProfilePosts() {
    const grid = $("#profilePostsGrid");

    if (!grid) return;

    const posts = state.feed.filter(post => {
      const username =
        post.username ||
        post.author?.username;

      return username === state.me?.username;
    });

    if (!posts.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div>▣</div>
          <h3>Aucune publication</h3>
          <p>Vos publications apparaîtront ici.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = posts.map(post => {
      const image = post.image || post.imageUrl || "";
      const text = post.text || post.content || "";

      return `
        <div class="profile-post-tile">
          ${
            image
              ? `<img src="${escapeHTML(image)}" alt="">`
              : `<span>${escapeHTML(text.slice(0,90))}</span>`
          }
        </div>
      `;
    }).join("");
  }


  /* ================= PROFILE UPDATE ================= */

  $("#profileForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const displayName = $("#editDisplayName").value.trim();
    const bio = $("#editBio").value.trim();

    try {
      await api("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName,
          bio
        })
      });

      if (state.me) {
        state.me.displayName = displayName;
        state.me.bio = bio;
      }

      updateCurrentUserUI();
      closeModal("profileModal");
      toast("Profil mis à jour.");
    } catch (error) {
      toast(error.message);
    }
  });


  /* ================= SEARCH ================= */

  let searchTimer;

  async function performSearch(query) {
    const container = $("#searchResults");

    if (!container) return;

    if (!query.trim()) {
      container.innerHTML = `
        <div class="empty-state">
          <div>⌕</div>
          <h3>Recherchez quelqu'un</h3>
          <p>Trouvez des utilisateurs sur Agorex.</p>
        </div>
      `;
      return;
    }

    try {
      const data = await api(`/api/search?q=${encodeURIComponent(query)}`);

      const results =
        Array.isArray(data)
          ? data
          : data.users || data.results || [];

      if (!results.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div>⌕</div>
            <h3>Aucun résultat</h3>
            <p>Essayez un autre pseudo.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = results.map(user => {
        const username = user.username || "Utilisateur";
        const name = user.displayName || user.name || username;

        return `
          <div class="search-user">

            <div class="avatar">
              ${escapeHTML(initials(name))}
            </div>

            <div class="search-user-info">
              <strong>${escapeHTML(name)}</strong>
              <span>@${escapeHTML(username)}</span>
            </div>

            <button data-message-user="${escapeHTML(username)}">
              Message
            </button>

          </div>
        `;
      }).join("");

      $$("[data-message-user]").forEach(button => {
        button.addEventListener("click", () => {
          openPrivateChat(button.dataset.messageUser);
        });
      });

    } catch (error) {
      container.innerHTML = `
        <div class="empty-state">
          <div>!</div>
          <h3>Recherche impossible</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  }

  $("#exploreSearch")?.addEventListener("input", event => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      performSearch(event.target.value);
    }, 300);
  });

  $("#globalSearch")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      showPage("explore");
      $("#exploreSearch").value = event.target.value;
      performSearch(event.target.value);
    }
  });


  /* ================= NOTIFICATIONS ================= */

  async function loadNotifications() {
    if (!state.me?.username) return;

    try {
      const data = await api(
        `/api/notifications/${encodeURIComponent(state.me.username)}`
      );

      state.notifications =
        Array.isArray(data)
          ? data
          : data.notifications || [];

      renderNotifications();
    } catch {
      renderNotifications();
    }
  }

  function renderNotifications() {
    const container = $("#notifications");

    if (!container) return;

    if (!state.notifications.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div>♡</div>
          <h3>Aucune notification</h3>
          <p>Vous êtes à jour.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.notifications.map(notification => {
      return `
        <div class="notification">

          <div class="avatar">
            ${escapeHTML(initials(notification.username || "A"))}
          </div>

          <div class="notification-text">
            <strong>${escapeHTML(notification.message || notification.text || "Nouvelle notification")}</strong>
            <span>${escapeHTML(timeAgo(notification.createdAt || notification.date))}</span>
          </div>

        </div>
      `;
    }).join("");
  }


  /* ================= CONVERSATIONS ================= */

  async function loadConversations() {
    try {
      const data = await api("/api/messages/conversations");

      state.conversations =
        Array.isArray(data)
          ? data
          : data.conversations || [];

      renderConversations();
    } catch {
      renderConversations();
    }
  }

  function renderConversations() {
    const list = $("#conversationList");

    if (!list) return;

    const publicConversation = `
      <button class="conversation public-conversation ${state.currentChat === "__public__" ? "active" : ""}" data-username="__public__">

        <div class="conversation-avatar public-avatar">
          🌎
        </div>

        <div class="conversation-info">
          <strong>Agorex Public</strong>
          <span>Tout le monde peut discuter</span>
        </div>

        <span class="online-dot"></span>

      </button>
    `;

    const privateConversations = state.conversations.map(conversation => {
      const username =
        conversation.username ||
        conversation.otherUsername ||
        conversation.user?.username;

      if (!username) return "";

      const name =
        conversation.displayName ||
        conversation.user?.displayName ||
        username;

      return `
        <button class="conversation ${state.currentChat === username ? "active" : ""}" data-username="${escapeHTML(username)}">

          <div class="conversation-avatar">
            ${escapeHTML(initials(name))}
          </div>

          <div class="conversation-info">
            <strong>${escapeHTML(name)}</strong>
            <span>${escapeHTML(conversation.lastMessage || "Conversation privée")}</span>
          </div>

        </button>
      `;
    }).join("");

    list.innerHTML = publicConversation + privateConversations;

    $$(".conversation[data-username]").forEach(button => {
      button.addEventListener("click", () => {
        openChat(button.dataset.username);
      });
    });
  }


  function openPrivateChat(username) {
    showPage("messages");
    openChat(username);
  }

  async function openChat(username) {
    state.currentChat = username;

    renderConversations();

    if (username === "__public__") {
      $("#chatName").textContent = "Agorex Public";
      $("#chatStatus").textContent = "Discussion publique";
      $("#chatAvatar").textContent = "🌎";

      loadPublicMessages();
      return;
    }

    $("#chatName").textContent = `@${username}`;
    $("#chatStatus").textContent = "Conversation privée";
    $("#chatAvatar").textContent = initials(username);

    try {
      const data = await api(
        `/api/messages/${encodeURIComponent(username)}`
      );

      state.messages[username] =
        Array.isArray(data)
          ? data
          : data.messages || [];

      renderMessages(state.messages[username]);
    } catch (error) {
      toast(error.message);
    }
  }


  async function loadPublicMessages() {
    try {
      const data = await api("/api/messages/public");

      const messages =
        Array.isArray(data)
          ? data
          : data.messages || [];

      renderMessages(messages);
    } catch {
      renderMessages([]);
    }
  }


  function renderMessages(messages) {
    const container = $("#messagesContainer");

    if (!container) return;

    if (!messages.length) {
      container.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">
            ${state.currentChat === "__public__" ? "🌎" : "◉"}
          </div>

          <h2>
            ${
              state.currentChat === "__public__"
                ? "Bienvenue dans Agorex Public"
                : "Nouvelle conversation"
            }
          </h2>

          <p>
            ${
              state.currentChat === "__public__"
                ? "Soyez le premier à envoyer un message."
                : "Envoyez votre premier message."
            }
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(message => {
      const username =
        message.username ||
        message.sender ||
        message.from ||
        "";

      const text =
        message.text ||
        message.content ||
        "";

      const mine =
        username === state.me?.username ||
        message.mine ||
        message.sender === state.me?.username;

      return `
        <div class="message-row ${mine ? "me" : ""}">

          <div class="message-bubble">

            ${
              !mine && state.currentChat === "__public__"
                ? `<div class="message-author">${escapeHTML(username)}</div>`
                : ""
            }

            <div>${escapeHTML(text)}</div>

            <div class="message-time">
              ${escapeHTML(timeAgo(message.createdAt || message.date))}
            </div>

          </div>

        </div>
      `;
    }).join("");

    container.scrollTop = container.scrollHeight;
  }


  /* ================= SOCKET ================= */

  function setupSocket() {
    if (typeof io !== "function") {
      console.warn("Socket.IO indisponible.");
      return;
    }

    state.socket = io();

    state.socket.on("connect", () => {
      if (!state.me?.username) return;

      state.socket.emit("join", {
        username: state.me.username
      });

      state.socket.emit("joinPublic", {
        username: state.me.username
      });
    });

    state.socket.on("publicMessage", message => {
      if (state.currentChat !== "__public__") return;

      const container = $("#messagesContainer");

      if (
        container?.querySelector(".chat-welcome")
      ) {
        renderMessages([message]);
        return;
      }

      appendMessage(message);
    });

    state.socket.on("privateMessage", message => {
      const sender =
        message.from ||
        message.sender ||
        message.username;

      if (
        state.currentChat === sender ||
        state.currentChat === message.to
      ) {
        appendMessage(message);
      }

      loadConversations();
    });

    state.socket.on("presence", data => {
      if (!data) return;

      const status =
        data.online
          ? "En ligne"
          : "Hors ligne";

      if (
        state.currentChat !== "__public__" &&
        data.username === state.currentChat
      ) {
        $("#chatStatus").textContent = status;
      }
    });

    state.socket.on("typing", data => {
      if (!data) return;

      const username =
        data.username ||
        data.from;

      if (
        username &&
        username !== state.me?.username &&
        username === state.currentChat
      ) {
        $("#typingIndicator").classList.toggle(
          "hidden",
          !data.typing
        );
      }
    });
  }


  function appendMessage(message) {
    const container = $("#messagesContainer");

    if (!container) return;

    const welcome = container.querySelector(".chat-welcome");

    if (welcome) {
      welcome.remove();
    }

    const username =
      message.username ||
      message.sender ||
      message.from ||
      "";

    const text =
      message.text ||
      message.content ||
      "";

    const mine =
      username === state.me?.username ||
      message.mine;

    const row = document.createElement("div");

    row.className =
      `message-row ${mine ? "me" : ""}`;

    row.innerHTML = `
      <div class="message-bubble">

        ${
          !mine && state.currentChat === "__public__"
            ? `<div class="message-author">${escapeHTML(username)}</div>`
            : ""
        }

        <div>${escapeHTML(text)}</div>

        <div class="message-time">
          ${escapeHTML(timeAgo(message.createdAt || new Date()))}
        </div>

      </div>
    `;

    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }


  /* ================= SEND MESSAGE ================= */

  $("#messageForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#messageInput");
    const text = input.value.trim();

    if (!text) return;

    if (!state.socket) {
      toast("Connexion au serveur indisponible.");
      return;
    }

    if (state.currentChat === "__public__") {
      state.socket.emit("publicMessage", text);
    } else {
      state.socket.emit("privateMessage", {
        to: state.currentChat,
        text
      });
    }

    input.value = "";
  });

  let typingTimer;

  $("#messageInput")?.addEventListener("input", () => {
    if (!state.socket || state.currentChat === "__public__") return;

    state.socket.emit("typing", {
      to: state.currentChat,
      typing: true
    });

    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => {
      state.socket.emit("typing", {
        to: state.currentChat,
        typing: false
      });
    }, 700);
  });

  $("#emojiMessage")?.addEventListener("click", () => {
    $("#messageInput").value += " 😊";
    $("#messageInput").focus();
  });

  $("#attachMessage")?.addEventListener("click", () => {
    toast("Les pièces jointes arrivent prochainement.");
  });


  /* ================= CONVERSATION SEARCH ================= */

  $("#conversationSearch")?.addEventListener("input", event => {
    const query = event.target.value.toLowerCase();

    $$(".conversation").forEach(item => {
      item.style.display =
        item.textContent.toLowerCase().includes(query)
          ? ""
          : "none";
    });
  });


  /* ================= NEW CONVERSATION ================= */

  $("#newConversationButton")?.addEventListener("click", () => {
    showPage("explore");
    $("#exploreSearch").focus();
  });


  /* ================= INIT ================= */

  async function init() {
    const authenticated = await loadMe();

    if (!authenticated) return;

    setupSocket();

    await Promise.all([
      loadFeed(),
      loadStories(),
      loadConversations(),
      loadNotifications()
    ]);

    showPage("home");
  }

  init();

})();
