const state = {
  user: null,
  page: "home",
  socket: null,
  activeChat: null,
  activeRoom: "general",
  rooms: [],
  conversations: [],
  messages: {},
  publicMessages: [],
  roomMessages: {},
  stories: [],
  posts: []
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
}

function avatar(username) {
  return `<div class="avatar">${escapeHtml((username || "?")[0].toUpperCase())}</div>`;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "maintenant";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} j`;
}

function showModal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").classList.remove("hidden");
}

function closeModal() {
  $("#modal").classList.add("hidden");
}

$("#modalClose").onclick = closeModal;
$("#modal").addEventListener("click", e => {
  if (e.target.id === "modal") closeModal();
});

function switchPage(page) {
  state.page = page;

  $$(".page").forEach(p => p.classList.remove("active"));
  $(`#page-${page}`)?.classList.add("active");

  $$(".nav-item,.mobile-nav button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const titles = {
    home: "Accueil",
    stories: "Stories",
    messages: "Messages",
    public: "Chat public",
    rooms: "Salons",
    explore: "Explorer",
    notifications: "Notifications",
    profile: "Mon profil"
  };

  $("#pageTitle").textContent = titles[page] || "Veyra";

  renderPage(page);
}

async function renderPage(page) {
  try {
    if (page === "home") await renderHome();
    if (page === "stories") await renderStories();
    if (page === "messages") await renderMessages();
    if (page === "public") await renderPublic();
    if (page === "rooms") await renderRooms();
    if (page === "explore") renderExplore();
    if (page === "notifications") await renderNotifications();
    if (page === "profile") await renderProfile();
  } catch (error) {
    console.error(error);
  }
}

async function renderHome() {
  const data = await api("/api/feed");
  state.posts = data.posts || [];

  const storiesData = await api("/api/stories");
  state.stories = storiesData.stories || [];

  $("#page-home").innerHTML = `
    <div class="hero">
      <h1>Bienvenue sur Veyra 👋</h1>
      <p>Partage ce que tu veux, découvre de nouvelles personnes et discute dans les espaces qui t'intéressent.</p>
    </div>

    <div class="section-title">Stories</div>
    <div class="stories-row">
      <div class="story-card mine" data-create-story>
        <div class="story-user">＋ Ta story</div>
        <div class="story-text">Publier une nouvelle story</div>
      </div>
      ${state.stories.slice(0, 12).map(s => `
        <div class="story-card">
          <div class="story-user">${escapeHtml(s.username)}</div>
          <div class="story-text">${escapeHtml(s.content)}</div>
        </div>
      `).join("")}
    </div>

    <div class="composer">
      <div class="composer-row">
        ${avatar(state.user.username)}
        <div class="composer-input" data-create-post>Quoi de neuf, ${escapeHtml(state.user.username)} ?</div>
      </div>
    </div>

    <div class="section-title">Publications</div>
    <div id="feed">
      ${renderPosts(state.posts)}
    </div>
  `;

  $("[data-create-story]")?.addEventListener("click", createStoryModal);
  $("[data-create-post]")?.addEventListener("click", createPostModal);
  $$("#feed .like-post").forEach(btn => btn.onclick = () => likePost(btn.dataset.id));
}

function renderPosts(posts) {
  if (!posts.length) {
    return `<div class="empty">Aucune publication pour le moment.<br>Sois le premier à publier quelque chose.</div>`;
  }

  return posts.map(post => `
    <article class="post">
      <div class="post-head">
        ${avatar(post.username)}
        <div>
          <div class="post-user">${escapeHtml(post.username)}</div>
          <div class="post-time">${timeAgo(post.createdAt)}</div>
        </div>
      </div>
      <div class="post-content">${escapeHtml(post.content).replaceAll("\n","<br>")}</div>
      <div class="post-actions">
        <button class="like-post" data-id="${post.id}">${post.liked ? "♥" : "♡"} ${post.likeCount || 0}</button>
        <button>💬 ${post.comments?.length || 0}</button>
        <button>↗ Partager</button>
      </div>
    </article>
  `).join("");
}

async function likePost(postId) {
  try {
    await api(`/api/posts/${postId}/like`, { method: "POST" });
    await renderHome();
  } catch (error) {
    alert(error.message);
  }
}

function createPostModal() {
  showModal(`
    <h2>Créer une publication</h2>
    <textarea id="postText" placeholder="Quoi de neuf ?"></textarea>
    <button class="primary" id="publishPost">Publier</button>
  `);

  $("#publishPost").onclick = async () => {
    const content = $("#postText").value.trim();
    if (!content) return;

    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({ content })
      });
      closeModal();
      await renderHome();
    } catch (error) {
      alert(error.message);
    }
  };
}

function createStoryModal() {
  showModal(`
    <h2>Nouvelle story</h2>
    <p style="color:var(--muted)">Ta story restera visible pendant 24 heures.</p>
    <textarea id="storyText" placeholder="Écris quelque chose..."></textarea>
    <button class="primary" id="publishStory">Publier la story</button>
  `);

  $("#publishStory").onclick = async () => {
    const content = $("#storyText").value.trim();
    if (!content) return;

    try {
      await api("/api/stories", {
        method: "POST",
        body: JSON.stringify({ content })
      });
      closeModal();
      await renderStories();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function renderStories() {
  const data = await api("/api/stories");
  state.stories = data.stories || [];

  $("#page-stories").innerHTML = `
    <div class="hero">
      <h1>Stories</h1>
      <p>Découvre les stories de la communauté.</p>
    </div>
    <button class="primary" style="margin-top:20px;padding:13px 18px" id="newStory">＋ Nouvelle story</button>
    <div class="stories-row" style="margin-top:20px;flex-wrap:wrap">
      ${state.stories.map(s => `
        <div class="story-card">
          <div class="story-user">${escapeHtml(s.username)}</div>
          <div class="story-text">${escapeHtml(s.content)}</div>
        </div>
      `).join("")}
    </div>
  `;

  $("#newStory").onclick = createStoryModal;
}

async function renderMessages() {
  const data = await api("/api/messages/conversations");
  state.conversations = data.conversations || [];

  $("#page-messages").innerHTML = `
    <div class="chat-layout">
      <aside class="chat-list">
        <h3>Discussions</h3>
        <button class="chat-item active" data-open-public>
          <strong>🌎 Agorex Public</strong>
          <span>Discussion publique</span>
        </button>
        ${state.conversations.map(c => `
          <button class="chat-item private-chat" data-username="${escapeHtml(c.username)}">
            <strong>${escapeHtml(c.username)}</strong>
            <span>Discussion privée</span>
          </button>
        `).join("")}
      </aside>

      <div class="chat-box">
        <div class="chat-head" id="chatHead">🌎 Agorex Public</div>
        <div class="messages" id="messageArea"></div>
        <form class="chat-input" id="chatForm">
          <input id="messageInput" autocomplete="off" placeholder="Écrire un message...">
          <button class="send">Envoyer</button>
        </form>
      </div>
    </div>
  `;

  $("[data-open-public]").onclick = () => openPublicChat();
  $$(".private-chat").forEach(btn => {
    btn.onclick = () => openPrivateChat(btn.dataset.username);
  });

  $("#chatForm").onsubmit = e => {
    e.preventDefault();
    sendCurrentMessage();
  };

  openPublicChat();
}

async function openPublicChat() {
  state.activeChat = null;

  $$(".chat-item").forEach(x => x.classList.remove("active"));
  $("[data-open-public]")?.classList.add("active");

  $("#chatHead").textContent = "🌎 Agorex Public";

  const data = await api("/api/messages/public");
  state.publicMessages = data.messages || [];

  renderMessageArea(state.publicMessages);
  state.socket.emit("joinPublic");
}

async function openPrivateChat(username) {
  state.activeChat = username;

  $$(".chat-item").forEach(x => x.classList.remove("active"));
  $(`[data-username="${CSS.escape(username)}"]`)?.classList.add("active");

  $("#chatHead").textContent = `💬 ${username}`;

  const data = await api(`/api/messages/${encodeURIComponent(username)}`);
  state.messages[username] = data.messages || [];

  renderMessageArea(state.messages[username]);
}

function renderMessageArea(messages) {
  const area = $("#messageArea");
  if (!area) return;

  area.innerHTML = messages.length
    ? messages.map(message => `
      <div class="bubble ${message.from === state.user.username ? "me" : ""}">
        ${message.from !== state.user.username ? `<div class="bubble-name">${escapeHtml(message.from)}</div>` : ""}
        ${escapeHtml(message.text)}
      </div>
    `).join("")
    : `<div class="empty">Aucun message pour le moment.</div>`;

  area.scrollTop = area.scrollHeight;
}

function sendCurrentMessage() {
  const input = $("#messageInput");
  const text = input.value.trim();

  if (!text) return;

  if (state.activeChat) {
    state.socket.emit("privateMessage", {
      to: state.activeChat,
      text
    });
  } else {
    state.socket.emit("publicMessage", { text });
  }

  input.value = "";
}

async function renderPublic() {
  const data = await api("/api/messages/public");
  state.publicMessages = data.messages || [];

  $("#page-public").innerHTML = `
    <div class="hero">
      <h1>🌎 Agorex Public</h1>
      <p>Le chat public principal de Veyra.</p>
    </div>
    <div class="chat-layout" style="margin-top:20px">
      <div class="chat-box">
        <div class="chat-head">🌎 Discussion publique</div>
        <div class="messages" id="publicArea"></div>
        <form class="chat-input" id="publicForm">
          <input id="publicInput" placeholder="Écrire dans le chat public..." autocomplete="off">
          <button class="send">Envoyer</button>
        </form>
      </div>
    </div>
  `;

  const area = $("#publicArea");

  function draw() {
    area.innerHTML = state.publicMessages.length
      ? state.publicMessages.map(m => `
        <div class="bubble ${m.from === state.user.username ? "me" : ""}">
          ${m.from !== state.user.username ? `<div class="bubble-name">${escapeHtml(m.from)}</div>` : ""}
          ${escapeHtml(m.text)}
        </div>
      `).join("")
      : `<div class="empty">Le chat public est vide.</div>`;

    area.scrollTop = area.scrollHeight;
  }

  draw();

  $("#publicForm").onsubmit = e => {
    e.preventDefault();

    const input = $("#publicInput");
    const text = input.value.trim();

    if (!text) return;

    state.socket.emit("publicMessage", { text });
    input.value = "";
  };

  state.socket.emit("joinPublic");
}

async function renderRooms() {
  const data = await api("/api/rooms");
  state.rooms = data.rooms || [];

  $("#page-rooms").innerHTML = `
    <div class="hero">
      <h1>▦ Salons</h1>
      <p>Chaque salon possède sa propre discussion.</p>
    </div>

    <div class="room-grid" style="margin-top:20px">
      <div class="rooms-list">
        ${state.rooms.map(room => `
          <button class="room-button ${room.id === state.activeRoom ? "active" : ""}" data-room="${room.id}">
            <strong>${room.icon} ${escapeHtml(room.name)}</strong>
            <span>${escapeHtml(room.description || "")}</span>
          </button>
        `).join("")}
        <button class="room-button" id="createRoom">
          <strong>＋ Créer un salon</strong>
          <span>Créer un nouvel espace</span>
        </button>
      </div>

      <div class="chat-box panel">
        <div class="chat-head" id="roomHead"></div>
        <div class="messages" id="roomArea"></div>
        <form class="chat-input" id="roomForm">
          <input id="roomInput" placeholder="Écrire dans ce salon..." autocomplete="off">
          <button class="send">Envoyer</button>
        </form>
      </div>
    </div>
  `;

  $$(".room-button[data-room]").forEach(btn => {
    btn.onclick = () => openRoom(btn.dataset.room);
  });

  $("#createRoom").onclick = createRoomModal;
  $("#roomForm").onsubmit = e => {
    e.preventDefault();

    const input = $("#roomInput");
    const text = input.value.trim();

    if (!text) return;

    state.socket.emit("roomMessage", {
      roomId: state.activeRoom,
      text
    });

    input.value = "";
  };

  openRoom(state.activeRoom);
}

async function openRoom(roomId) {
  state.activeRoom = roomId;

  const room = state.rooms.find(r => r.id === roomId);
  if (!room) return;

  $$(".room-button[data-room]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.room === roomId);
  });

  $("#roomHead").textContent = `${room.icon} ${room.name}`;

  const data = await api(`/api/messages/room/${encodeURIComponent(roomId)}`);
  state.roomMessages[roomId] = data.messages || [];

  const area = $("#roomArea");

  function draw() {
    area.innerHTML = state.roomMessages[roomId].length
      ? state.roomMessages[roomId].map(m => `
        <div class="bubble ${m.from === state.user.username ? "me" : ""}">
          ${m.from !== state.user.username ? `<div class="bubble-name">${escapeHtml(m.from)}</div>` : ""}
          ${escapeHtml(m.text)}
        </div>
      `).join("")
      : `<div class="empty">Aucun message dans ce salon.</div>`;

    area.scrollTop = area.scrollHeight;
  }

  draw();

  state.socket.emit("joinRoom", roomId);
}

function createRoomModal() {
  showModal(`
    <h2>Créer un salon</h2>
    <div class="form-group">
      <label>Nom du salon</label>
      <input id="roomName" placeholder="Ex : Cinéma">
    </div>
    <div class="form-group">
      <label>Icône</label>
      <input id="roomIcon" value="💬" maxlength="4">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input id="roomDescription" placeholder="De quoi parle ce salon ?">
    </div>
    <button class="primary" id="saveRoom">Créer le salon</button>
  `);

  $("#saveRoom").onclick = async () => {
    try {
      const data = await api("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: $("#roomName").value,
          icon: $("#roomIcon").value,
          description: $("#roomDescription").value
        })
      });

      closeModal();
      state.activeRoom = data.room.id;
      await renderRooms();
    } catch (error) {
      alert(error.message);
    }
  };
}

function renderExplore() {
  $("#page-explore").innerHTML = `
    <div class="hero">
      <h1>Explorer</h1>
      <p>Découvre des personnes et des publications sur Veyra.</p>
    </div>

    <div class="search-box" style="margin-top:20px">
      <input id="exploreInput" placeholder="Rechercher un pseudo ou une publication...">
      <button id="exploreSearch">Rechercher</button>
    </div>

    <div id="exploreResults"></div>
  `;

  $("#exploreSearch").onclick = searchExplore;

  $("#exploreInput").onkeydown = e => {
    if (e.key === "Enter") searchExplore();
  };
}

async function searchExplore() {
  const q = $("#exploreInput").value.trim();
  if (!q) return;

  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`);

    $("#exploreResults").innerHTML = `
      <div class="section-title">Personnes</div>
      ${
        data.users.length
          ? data.users.map(user => `
            <div class="user-card">
              ${avatar(user.username)}
              <div>
                <strong>${escapeHtml(user.username)}</strong>
                <div style="color:var(--muted);font-size:12px">${user.followers.length} abonnés</div>
              </div>
              <button class="follow-btn" data-follow="${escapeHtml(user.username)}">Voir</button>
            </div>
          `).join("")
          : `<div class="empty">Aucun utilisateur trouvé.</div>`
      }

      <div class="section-title">Publications</div>
      ${renderPosts(data.posts)}
    `;

    $$("#exploreResults [data-follow]").forEach(btn => {
      btn.onclick = () => openProfile(btn.dataset.follow);
    });
  } catch (error) {
    alert(error.message);
  }
}

async function openProfile(username) {
  state.profileUsername = username;
  switchPage("profile");
  await renderProfile(username);
}

async function renderProfile(username = state.profileUsername || state.user.username) {
  const data = await api(`/api/profile/${encodeURIComponent(username)}`);
  const user = data.user;
  const mine = user.username === state.user.username;
  const following = user.followers.includes(state.user.username);

  $("#page-profile").innerHTML = `
    <div class="profile-cover"></div>

    <div class="profile-info">
      <div class="profile-avatar">${escapeHtml(user.username[0].toUpperCase())}</div>

      <h1>${escapeHtml(user.username)}</h1>
      <div class="profile-bio">${escapeHtml(user.bio || "Aucune bio pour le moment.")}</div>

      <div class="stats">
        <div><strong>${user.followers.length}</strong><span>Abonnés</span></div>
        <div><strong>${user.following.length}</strong><span>Abonnements</span></div>
        <div><strong>${data.posts.length}</strong><span>Publications</span></div>
      </div>

      ${
        mine
          ? `<button class="primary" id="editProfile" style="margin-top:20px;padding:12px 16px">Modifier le profil</button>`
          : `
            <div style="display:flex;gap:8px;margin-top:20px">
              <button class="follow-btn" id="followUser">${following ? "Ne plus suivre" : "S'abonner"}</button>
              <button class="follow-btn" id="messageUser">Message</button>
            </div>
          `
      }
    </div>

    <div class="section-title">Publications de ${escapeHtml(user.username)}</div>
    ${renderPosts(data.posts)}
  `;

  $$("#page-profile .like-post").forEach(btn => {
    btn.onclick = () => likePost(btn.dataset.id);
  });

  if (mine) {
    $("#editProfile").onclick = editProfileModal;
  } else {
    $("#followUser").onclick = async () => {
      try {
        await api(`/api/profile/follow/${encodeURIComponent(user.username)}`, { method: "POST" });
        await renderProfile(user.username);
      } catch (error) {
        alert(error.message);
      }
    };

    $("#messageUser").onclick = async () => {
      state.activeChat = user.username;
      switchPage("messages");
      await renderMessages();
      await openPrivateChat(user.username);
    };
  }
}

function editProfileModal() {
  showModal(`
    <h2>Modifier mon profil</h2>

    <div class="form-group">
      <label>Bio</label>
      <textarea id="profileBio">${escapeHtml(state.user.bio || "")}</textarea>
    </div>

    <div class="form-group">
      <label>Avatar URL</label>
      <input id="profileAvatar" value="${escapeHtml(state.user.avatar || "")}">
    </div>

    <div class="form-group">
      <label>Bannière URL</label>
      <input id="profileBanner" value="${escapeHtml(state.user.banner || "")}">
    </div>

    <button class="primary" id="saveProfile">Enregistrer</button>
  `);

  $("#saveProfile").onclick = async () => {
    try {
      const data = await api("/api/profile/update", {
        method: "POST",
        body: JSON.stringify({
          bio: $("#profileBio").value,
          avatar: $("#profileAvatar").value,
          banner: $("#profileBanner").value
        })
      });

      state.user = data.user;
      updateUserUI();
      closeModal();
      await renderProfile();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function renderNotifications() {
  const data = await api(`/api/notifications/${encodeURIComponent(state.user.username)}`);

  $("#page-notifications").innerHTML = `
    <div class="hero">
      <h1>Notifications</h1>
      <p>Retrouve ici les activités liées à ton compte.</p>
    </div>

    <div style="margin-top:20px">
      ${
        data.notifications.length
          ? data.notifications.map(n => `
            <div class="notification">
              <strong>${escapeHtml(n.from || "Veyra")}</strong>
              <div>${escapeHtml(n.text || "")}</div>
              <small style="color:var(--muted)">${timeAgo(n.createdAt)}</small>
            </div>
          `).join("")
          : `<div class="empty">Aucune notification.</div>`
      }
    </div>
  `;
}

function updateUserUI() {
  $("#sidebarUser").innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      ${avatar(state.user.username)}
      <div>
        <strong>${escapeHtml(state.user.username)}</strong>
        <div style="font-size:11px;color:var(--muted)">${state.user.followers.length} abonnés</div>
      </div>
    </div>
  `;

  $("#topAvatar").textContent = state.user.username[0].toUpperCase();
}

function setupSocket() {
  state.socket = io();

  state.socket.on("privateMessage", message => {
    const other = message.from === state.user.username ? message.to : message.from;

    state.messages[other] ||= [];
    state.messages[other].push(message);

    if (state.page === "messages" && state.activeChat === other) {
      renderMessageArea(state.messages[other]);
    }
  });

  state.socket.on("publicMessage", message => {
    state.publicMessages.push(message);

    if (state.page === "messages" && !state.activeChat) {
      renderMessageArea(state.publicMessages);
    }

    if (state.page === "public") {
      const area = $("#publicArea");

      if (area) {
        area.innerHTML = state.publicMessages.map(m => `
          <div class="bubble ${m.from === state.user.username ? "me" : ""}">
            ${m.from !== state.user.username ? `<div class="bubble-name">${escapeHtml(m.from)}</div>` : ""}
            ${escapeHtml(m.text)}
          </div>
        `).join("");

        area.scrollTop = area.scrollHeight;
      }
    }
  });

  state.socket.on("roomMessage", message => {
    state.roomMessages[message.roomId] ||= [];
    state.roomMessages[message.roomId].push(message);

    if (state.page === "rooms" && state.activeRoom === message.roomId) {
      const area = $("#roomArea");

      if (area) {
        area.innerHTML = state.roomMessages[message.roomId].map(m => `
          <div class="bubble ${m.from === state.user.username ? "me" : ""}">
            ${m.from !== state.user.username ? `<div class="bubble-name">${escapeHtml(m.from)}</div>` : ""}
            ${escapeHtml(m.text)}
          </div>
        `).join("");

        area.scrollTop = area.scrollHeight;
      }
    }
  });
}

$$("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});

$("#createBtn").onclick = createPostModal;

$("#searchTop").onclick = () => {
  switchPage("explore");
  setTimeout(() => $("#exploreInput")?.focus(), 100);
};

$("#logoutBtn").onclick = async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/login.html";
};

async function init() {
  try {
    const data = await api("/api/auth/me");

    if (!data.user) {
      location.href = "/login.html";
      return;
    }

    state.user = data.user;

    updateUserUI();
    setupSocket();
    switchPage("home");
  } catch {
    location.href = "/login.html";
  }
}

init();
