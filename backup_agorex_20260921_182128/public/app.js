"use strict";

/*
 * AGOREX
 * Interface principale
 *
 * IMPORTANT :
 * Il n'y a volontairement plus aucun :
 * enterBtn
 * usernameInput
 * joinAgora
 *
 * La connexion est maintenant entièrement gérée
 * par /login.html et le système de session du serveur.
 */

let currentUser = null;
let allPosts = [];
let currentFilter = "all";

const $ = (selector) => document.querySelector(selector);

const feed = $("#feed");
const postContent = $("#postContent");
const publishBtn = $("#publishBtn");
const charCount = $("#charCount");
const logoutBtn = $("#logoutBtn");
const profileBtn = $("#profileBtn");
const editProfileBtn = $("#editProfileBtn");
const profileModal = $("#profileModal");
const notificationsModal = $("#notificationsModal");
const toast = $("#toast");


// ============================================================
// UTILITAIRES
// ============================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function initials(username) {
  const text = String(username || "A").trim();

  if (!text) return "A";

  return text
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? {
        "Content-Type": "application/json"
      } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    window.location.replace("/login.html");
    throw new Error("Non authentifié");
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Une erreur est survenue."
    );
  }

  return data;
}


// ============================================================
// UTILISATEUR
// ============================================================

async function loadCurrentUser() {
  try {
    const data = await api("/api/auth/me");

    if (!data.authenticated) {
      window.location.replace("/login.html");
      return false;
    }

    currentUser = data.user;

    updateUserInterface();

    return true;

  } catch (error) {
    console.error("Utilisateur :", error);
    return false;
  }
}

function updateUserInterface() {
  if (!currentUser) return;

  const username =
    currentUser.username ||
    currentUser.name ||
    "Utilisateur";

  const email =
    currentUser.email ||
    "";

  const avatarText = initials(username);

  const elements = {
    "#navUsername": username,
    "#composerUsername": username,
    "#sideUsername": username,
    "#profileModalUsername": username,
    "#sideEmail": email,
    "#profileModalEmail": email,
    "#welcomeText": `Bienvenue ${username}.`
  };

  Object.entries(elements).forEach(([selector, value]) => {
    const element = $(selector);

    if (element) {
      element.textContent = value;
    }
  });

  [
    "#navAvatar",
    "#composerAvatar",
    "#sideAvatar",
    "#profileModalAvatar"
  ].forEach(selector => {
    const element = $(selector);

    if (element) {
      element.textContent = avatarText;
    }
  });

  if ($("#bioInput")) {
    $("#bioInput").value = currentUser.bio || "";
  }
}


// ============================================================
// PUBLICATIONS
// ============================================================

async function loadPosts() {
  if (!feed) return;

  feed.innerHTML = `
    <div class="loading-card">
      <div class="spinner"></div>
      <p>Chargement des publications...</p>
    </div>
  `;

  try {
    const data = await api("/api/feed");

    if (Array.isArray(data)) {
      allPosts = data;
    } else if (Array.isArray(data.posts)) {
      allPosts = data.posts;
    } else {
      allPosts = [];
    }

    renderPosts();

  } catch (error) {
    console.error("Publications :", error);

    feed.innerHTML = `
      <div class="empty-card">
        <strong>Impossible de charger les publications.</strong>
        <p>${escapeHTML(error.message)}</p>
        <button class="secondary-button" onclick="loadPosts()">
          Réessayer
        </button>
      </div>
    `;
  }
}

function normalizePost(post) {
  return {
    id: post.id ?? post._id,
    username:
      post.username ||
      post.author ||
      post.user?.username ||
      "Utilisateur",
    content:
      post.content ||
      post.text ||
      "",
    createdAt:
      post.createdAt ||
      post.date ||
      post.timestamp,
    likes:
      Array.isArray(post.likes) ? post.likes.length : Number(post.likes ?? post.likeCount ?? 0),
    comments:
      Array.isArray(post.comments)
        ? post.comments
        : []
  };
}

function renderPosts() {
  if (!feed) return;

  let posts = allPosts.map(normalizePost);

  if (currentFilter === "latest") {
    posts.sort((a, b) => {
      return new Date(b.createdAt || 0) -
             new Date(a.createdAt || 0);
    });
  }

  if (!posts.length) {
    feed.innerHTML = `
      <div class="empty-card">
        <strong>Aucune publication pour le moment.</strong>
        <p>Sois le premier à publier quelque chose !</p>
      </div>
    `;

    return;
  }

  feed.innerHTML = posts
    .map(renderPost)
    .join("");

  bindPostActions();
}

function renderPost(post) {
  const comments = post.comments || [];

  return `
    <article class="post card" data-post-id="${escapeHTML(post.id)}">

      <div class="post-header">

        <div class="avatar">
          ${escapeHTML(initials(post.username))}
        </div>

        <div>
          <div class="post-author">
            ${escapeHTML(post.username)}
          </div>

          <div class="post-date">
            ${escapeHTML(formatDate(post.createdAt))}
          </div>
        </div>

      </div>

      <div class="post-content">
        ${escapeHTML(post.content)}
      </div>

      <div class="post-actions">

        <button
          class="post-action like-button"
          data-id="${escapeHTML(post.id)}"
        >
          ❤️ ${post.likes}
        </button>

        <button
          class="post-action comment-button"
          data-id="${escapeHTML(post.id)}"
        >
          💬 ${comments.length}
        </button>

      </div>

      <div class="comments" id="comments-${escapeHTML(post.id)}">

        ${comments
          .map(comment => `
            <div class="comment">
              <strong>
                ${escapeHTML(
                  comment.username ||
                  comment.author ||
                  "Utilisateur"
                )}
              </strong>

              ${escapeHTML(
                comment.content ||
                comment.text ||
                ""
              )}
            </div>
          `)
          .join("")}

        <div class="comment-form">

          <input
            type="text"
            class="comment-input"
            data-id="${escapeHTML(post.id)}"
            placeholder="Écrire un commentaire..."
          >

          <button
            class="secondary-button send-comment"
            data-id="${escapeHTML(post.id)}"
          >
            Envoyer
          </button>

        </div>

      </div>

    </article>
  `;
}

function bindPostActions() {

  document.querySelectorAll(".like-button")
    .forEach(button => {

      button.addEventListener("click", async () => {

        const id = button.dataset.id;

        try {

          await api(`/api/posts/${encodeURIComponent(id)}/like`, {
            method: "POST"
          });

          await loadPosts();

        } catch (error) {
          showToast(error.message);
        }

      });

    });


  document.querySelectorAll(".send-comment")
    .forEach(button => {

      button.addEventListener("click", async () => {

        const id = button.dataset.id;

        const input = document.querySelector(
          `.comment-input[data-id="${CSS.escape(id)}"]`
        );

        if (!input) return;

        const content = input.value.trim();

        if (!content) return;

        try {

          await api(
            `/api/posts/${encodeURIComponent(id)}/comments`,
            {
              method: "POST",
              body: JSON.stringify({
                content
              })
            }
          );

          input.value = "";

          await loadPosts();

        } catch (error) {
          showToast(error.message);
        }

      });

    });
}


// ============================================================
// CREATION PUBLICATION
// ============================================================

if (postContent) {

  postContent.addEventListener("input", () => {

    charCount.textContent =
      `${postContent.value.length} / 2000`;

  });

}

if (publishBtn) {

  publishBtn.addEventListener("click", async () => {

    const content = postContent.value.trim();

    if (!content) {
      showToast("Écris quelque chose avant de publier.");
      postContent.focus();
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = "Publication...";

    try {

      const formData = new FormData();
      formData.append("content", content);

      const response = await fetch("/api/posts", {
        method: "POST",
        credentials: "include",
        body: formData
      });

      if (response.status === 401) {
        window.location.replace("/login.html");
        return;
      }

      let result = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Impossible de publier."
        );
      }

      postContent.value = "";
      charCount.textContent = "0 / 2000";

      showToast("Publication créée !");

      await loadPosts();

    } catch (error) {
      showToast(error.message);

    } finally {

      publishBtn.disabled = false;
      publishBtn.textContent = "Publier";

    }

  });

}


// ============================================================
// DECONNEXION
// ============================================================

if (logoutBtn) {

  logoutBtn.addEventListener("click", async () => {

    try {

      await api("/api/auth/logout", {
        method: "POST"
      });

    } catch (error) {
      console.warn("Déconnexion :", error);
    }

    window.location.replace("/login.html");

  });

}


// ============================================================
// PROFIL
// ============================================================

function openProfile() {

  if (!profileModal) return;

  updateUserInterface();

  profileModal.classList.remove("hidden");
}

function closeProfile() {

  if (!profileModal) return;

  profileModal.classList.add("hidden");
}

if (profileBtn) {
  profileBtn.addEventListener("click", openProfile);
}

if (editProfileBtn) {
  editProfileBtn.addEventListener("click", openProfile);
}

if ($("#closeProfileModal")) {
  $("#closeProfileModal")
    .addEventListener("click", closeProfile);
}

if ($("#saveProfileBtn")) {

  $("#saveProfileBtn").addEventListener(
    "click",
    async () => {

      const bio =
        $("#bioInput")?.value.trim() || "";

      try {

        const data = await api("/api/profile/update", {
          method: "POST",
          body: JSON.stringify({
            username: currentUser.username,
            bio
          })
        });

        if (data.user) {
          currentUser = data.user;
          updateUserInterface();
        } else if (currentUser) {
          currentUser.bio = bio;
        }

        closeProfile();

        showToast("Profil enregistré.");

      } catch (error) {
        showToast(
          "La personnalisation du profil sera disponible après connexion à l'API profil."
        );

        console.error(error);
      }

    }
  );

}


// ============================================================
// NOTIFICATIONS
// ============================================================

if ($("#notificationsBtn")) {

  $("#notificationsBtn").addEventListener(
    "click",
    () => {

      if (notificationsModal) {
        notificationsModal.classList.remove("hidden");
      }

    }
  );

}

if ($("#closeNotificationsModal")) {

  $("#closeNotificationsModal")
    .addEventListener("click", () => {

      notificationsModal?.classList.add("hidden");

    });

}


// ============================================================
// RECHERCHE
// ============================================================

if ($("#searchInput")) {

  $("#searchInput").addEventListener(
    "input",
    () => {

      const query =
        $("#searchInput").value
          .trim()
          .toLowerCase();

      if (!query) {
        renderPosts();
        return;
      }

      const filtered = allPosts.filter(post => {

        const normalized = normalizePost(post);

        return (
          normalized.content
            .toLowerCase()
            .includes(query)
          ||
          normalized.username
            .toLowerCase()
            .includes(query)
        );

      });

      const previous = allPosts;

      allPosts = filtered;

      renderPosts();

      allPosts = previous;

    }
  );

}


// ============================================================
// BOUTON NOUVELLE PUBLICATION
// ============================================================

if ($("#newPostBtn")) {

  $("#newPostBtn").addEventListener(
    "click",
    () => {

      postContent?.focus();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    }
  );

}


// ============================================================
// ONGLETS
// ============================================================

document.querySelectorAll(".feed-tab")
  .forEach(tab => {

    tab.addEventListener("click", () => {

      document
        .querySelectorAll(".feed-tab")
        .forEach(item =>
          item.classList.remove("active")
        );

      tab.classList.add("active");

      currentFilter =
        tab.dataset.filter || "all";

      renderPosts();

    });

  });


// ============================================================
// MENU
// ============================================================

document.querySelectorAll(".menu-item")
  .forEach(item => {

    item.addEventListener("click", () => {

      document
        .querySelectorAll(".menu-item")
        .forEach(menu =>
          menu.classList.remove("active")
        );

      item.classList.add("active");

      const section =
        item.dataset.section;

      if (section === "profile") {
        openProfile();
      }

      if (section === "notifications") {
        notificationsModal?.classList.remove("hidden");
      }

    });

  });


// ============================================================
// DEMARRAGE
// ============================================================

(async function startAgorex() {

  console.log("================================");
  console.log("AGOREX — démarrage");
  console.log("================================");

  const authenticated =
    await loadCurrentUser();

  if (!authenticated) {
    return;
  }

  await loadPosts();

})();


// ============================================================
// CHAT TEMPS RÉEL AGOREX
// ============================================================

(function initAgorexChat() {

  const chatPanel = document.querySelector("#chatPanel");
  const chatToggle = document.querySelector("#chatToggle");
  const closeChat = document.querySelector("#closeChat");
  const chatMessages = document.querySelector("#chatMessages");
  const chatForm = document.querySelector("#chatForm");
  const chatInput = document.querySelector("#chatInput");
  const roomSelect = document.querySelector("#roomSelect");
  const onlineCount = document.querySelector("#onlineCount");

  if (
    !chatPanel ||
    !chatToggle ||
    !closeChat ||
    !chatMessages ||
    !chatForm ||
    !chatInput ||
    !roomSelect
  ) {
    console.error("❌ Interface du chat introuvable.");
    return;
  }

  let socket = null;
  let connected = false;

  function escapeChat(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function addSystemMessage(message) {

    const div = document.createElement("div");

    div.className = "chat-system";

    div.textContent = message;

    chatMessages.appendChild(div);

    chatMessages.scrollTop =
      chatMessages.scrollHeight;
  }

  function addChatMessage(data) {

    const div = document.createElement("div");

    div.className = "chat-message";

    const username =
      data.username || "Utilisateur";

    const message =
      data.message || "";

    const time =
      data.time || "";

    div.innerHTML = `
      <div class="chat-message-name">
        ${escapeChat(username)}
      </div>

      <div class="chat-message-body">
        ${escapeChat(message)}
        ${
          time
            ? `<span class="chat-message-time">
                ${escapeChat(time)}
               </span>`
            : ""
        }
      </div>
    `;

    chatMessages.appendChild(div);

    chatMessages.scrollTop =
      chatMessages.scrollHeight;
  }

  function connectChat() {

    if (socket) {
      return;
    }

    if (typeof io !== "function") {

      addSystemMessage(
        "Le module du chat n'est pas disponible."
      );

      console.error(
        "Socket.IO n'est pas chargé."
      );

      return;
    }

    socket = io({
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {

      connected = true;

      addSystemMessage(
        "Connecté au chat Agorex."
      );

      const room =
        roomSelect.value || "general";

      socket.emit("joinRoom", room);
    });

    socket.on("disconnect", () => {

      connected = false;

      if (onlineCount) {
        onlineCount.textContent =
          "Hors ligne";
      }

      addSystemMessage(
        "Connexion au chat interrompue."
      );

    });

    socket.on("system", message => {

      addSystemMessage(message);

    });

    socket.on("message", data => {

      addChatMessage(data);

    });

    socket.on("online", count => {

      if (onlineCount) {

        onlineCount.textContent =
          `${count} en ligne`;

      }

    });

    socket.on("roomChanged", room => {

      addSystemMessage(
        `Salon : ${room}`
      );

    });

  }

  chatToggle.addEventListener(
    "click",
    () => {

      chatPanel.classList.toggle("open");

      if (chatPanel.classList.contains("open")) {

        connectChat();

        setTimeout(() => {
          chatInput.focus();
        }, 100);

      }

    }
  );

  closeChat.addEventListener(
    "click",
    () => {

      chatPanel.classList.remove("open");

    }
  );

  chatForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      const message =
        chatInput.value.trim();

      if (!message) {
        return;
      }

      if (!socket || !connected) {

        addSystemMessage(
          "Connexion au chat en cours..."
        );

        connectChat();

        return;
      }

      socket.emit("message", message);

      chatInput.value = "";

      chatInput.focus();

    }
  );

  roomSelect.addEventListener(
    "change",
    () => {

      const room =
        roomSelect.value;

      if (!socket || !connected) {
        connectChat();
        return;
      }

      socket.emit("joinRoom", room);

      chatMessages.innerHTML = "";

      addSystemMessage(
        `Connexion au salon ${room}...`
      );

    }
  );

})();
