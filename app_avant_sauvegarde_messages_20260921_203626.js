const socket = io();

let me = null;
let currentPrivateUser = null;
let currentRoom = null;
let onlineUsers = [];

const $ = id => document.getElementById(id);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function initials(name = "?") {
  return escapeHtml(name.slice(0, 1).toUpperCase());
}

function avatarStyle(url) {
  return url
    ? `style="background-image:url('${url.replaceAll("'", "%27")}')"`
    : "";
}

function showToast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
}

async function init() {
  try {
    const auth = await api("/api/auth/me");

    if (!auth.authenticated) {
      location.href = "/login.html";
      return;
    }

    me = auth.user;

    updateUserUI();
    setupNavigation();
    setupModals();
    setupComposer();
    setupMessaging();
    setupSearch();

    socket.emit("joinPublic");

    await loadHome();
    await loadConversations();
    await loadRooms();
    await loadNotifications();
    await loadProfile();

  } catch (err) {
    console.error(err);
    showToast(err.message);
  }
}

function updateUserUI() {
  const sidebar = $("sidebarUser");

  sidebar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div class="avatar" ${avatarStyle(me.avatar)}>${!me.avatar ? initials(me.username) : ""}</div>
      <div>
        <strong style="font-size:13px">${escapeHtml(me.username)}</strong>
        <small style="display:block;color:#9ca3af">En ligne</small>
      </div>
    </div>
  `;

  $("composerAvatar").setAttribute("style", me.avatar
    ? `background-image:url('${me.avatar}')`
    : "");

  if (!me.avatar) {
    $("composerAvatar").textContent = initials(me.username);
    $("composerAvatar").style.display = "grid";
    $("composerAvatar").style.placeItems = "center";
    $("composerAvatar").style.fontWeight = "800";
  }

  if (me.avatar) {
    $("topAvatar").style.backgroundImage = `url('${me.avatar}')`;
  } else {
    $("topAvatar").textContent = initials(me.username);
  }
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  document.querySelectorAll("[data-page-jump]").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.pageJump));
  });

  $("topAvatar").addEventListener("click", () => showPage("profile"));

  $("logoutBtn").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/login.html";
  });

  $("heroCreate").addEventListener("click", () => {
    $("postText").focus();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(x => x.classList.remove("active-page"));
  const target = $("page-" + page);
  if (!target) return;

  target.classList.add("active-page");

  document.querySelectorAll(".nav-item").forEach(x => {
    x.classList.toggle("active", x.dataset.page === page);
  });

  const names = {
    home: "Accueil",
    stories: "Stories",
    messages: "Messages privés",
    public: "Chat public",
    rooms: "Salons",
    explore: "Explorer",
    notifications: "Notifications",
    profile: "Mon profil"
  };

  $("topTitle").textContent = names[page] || "Veyra";

  if (page === "stories") loadStories();
  if (page === "messages") loadConversations();
  if (page === "public") loadPublicMessages();
  if (page === "rooms") loadRooms();
  if (page === "notifications") loadNotifications();
  if (page === "profile") loadProfile();
}

function setupModals() {
  $("createBtn").onclick = () => {
    $("postText").focus();
    showPage("home");
  };

  $("storyCreateBtn").onclick = () => openModal("storyModal");

  $("newMessageBtn").onclick = () => {
    $("messageSearch").value = "";
    $("messageSearchResults").innerHTML = "";
    openModal("newMessageModal");
  };

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.classList.remove("open");
    });
  });

  $("storyFile").addEventListener("change", previewStory);
}

function openModal(id) {
  $(id).classList.add("open");
}

function closeModal(id) {
  $(id).classList.remove("open");
}

function setupComposer() {
  $("postFile").addEventListener("change", () => {
    $("postFileName").textContent =
      $("postFile").files[0]?.name || "";
  });

  $("publishBtn").addEventListener("click", publishPost);

  $("publishStory").addEventListener("click", publishStory);
}

async function publishPost() {
  const text = $("postText").value.trim();
  const file = $("postFile").files[0];

  if (!text && !file) {
    showToast("Ajoute du texte ou un fichier.");
    return;
  }

  const form = new FormData();
  form.append("content", text);
  if (file) form.append("attachment", file);

  try {
    $("publishBtn").disabled = true;

    await api("/api/posts", {
      method: "POST",
      body: form
    });

    $("postText").value = "";
    $("postFile").value = "";
    $("postFileName").textContent = "";

    showToast("Publication créée !");
    await loadHome();

  } catch (err) {
    showToast(err.message);
  } finally {
    $("publishBtn").disabled = false;
  }
}

function previewStory() {
  const file = $("storyFile").files[0];
  const preview = $("storyPreview");

  preview.innerHTML = "";

  if (!file) return;

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  } else {
    preview.innerHTML =
      `<div class="file-card"><div class="file-card-icon">📎</div><strong>${escapeHtml(file.name)}</strong></div>`;
  }
}

async function publishStory() {
  const text = $("storyText").value.trim();
  const file = $("storyFile").files[0];

  if (!text && !file) {
    showToast("Ajoute du texte ou un fichier.");
    return;
  }

  const form = new FormData();
  form.append("content", text);
  if (file) form.append("attachment", file);

  try {
    $("publishStory").disabled = true;

    await api("/api/stories", {
      method: "POST",
      body: form
    });

    $("storyText").value = "";
    $("storyFile").value = "";
    $("storyPreview").innerHTML = "";

    closeModal("storyModal");
    showToast("Story publiée !");

    await loadStories();
    await loadHome();

  } catch (err) {
    showToast(err.message);
  } finally {
    $("publishStory").disabled = false;
  }
}

async function loadHome() {
  await Promise.all([
    loadStories(),
    loadFeed()
  ]);
}

function attachmentHtml(attachment) {
  if (!attachment) return "";

  if (attachment.mime?.startsWith("image/")) {
    return `
      <div class="message-attachment">
        <img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name)}">
      </div>
    `;
  }

  return `
    <div class="file-card">
      <div class="file-card-icon">📎</div>
      <div>
        <strong>${escapeHtml(attachment.name)}</strong>
        <small>${Math.round((attachment.size || 0) / 1024)} Ko</small>
      </div>
      <a href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">Ouvrir</a>
    </div>
  `;
}

async function loadFeed() {
  const posts = await api("/api/feed");

  $("feed").innerHTML = posts.length
    ? posts.map(post => `
      <article class="post">
        <div class="post-head">
          <div class="user-avatar" ${avatarStyle(post.avatar)}>
            ${!post.avatar ? initials(post.username) : ""}
          </div>
          <div>
            <div class="post-user">@${escapeHtml(post.username)}</div>
            <div class="post-date">${formatDate(post.createdAt)}</div>
          </div>
        </div>

        ${post.content
          ? `<div class="post-content">${escapeHtml(post.content)}</div>`
          : ""}

        ${post.attachment
          ? `<div>${post.attachment.mime?.startsWith("image/")
              ? `<img class="attachment-image" src="${escapeHtml(post.attachment.url)}" alt="${escapeHtml(post.attachment.name)}">`
              : attachmentHtml(post.attachment)
            }</div>`
          : ""}

        <div class="post-actions">
          <button class="action-btn" onclick="likePost('${post.id}')">
            ♡ ${post.likes?.length || 0}
          </button>
          <button class="action-btn">💬 ${post.comments?.length || 0}</button>
        </div>
      </article>
    `).join("")
    : `
      <div class="post" style="text-align:center;padding:45px">
        <h3>Ton fil est encore vide</h3>
        <p class="muted">Sois le premier à publier quelque chose.</p>
      </div>
    `;
}

async function likePost(id) {
  try {
    await api(`/api/posts/${id}/like`, { method: "POST" });
    await loadFeed();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadStories() {
  const stories = await api("/api/stories");

  const cards = stories.map(story => {
    const image = story.attachment?.mime?.startsWith("image/")
      ? `<img src="${escapeHtml(story.attachment.url)}">`
      : "";

    return `
      <article class="story-card ${image ? "" : "story-no-image"}">
        ${image}
        <div class="story-card-content">
          <strong>@${escapeHtml(story.username)}</strong>
          ${story.content ? `<p>${escapeHtml(story.content)}</p>` : ""}
        </div>
      </article>
    `;
  }).join("");

  $("storiesGrid").innerHTML = cards || `
    <div class="post" style="grid-column:1/-1;text-align:center;padding:45px">
      <h3>Aucune story pour le moment</h3>
      <p class="muted">Crée la première story de Veyra.</p>
    </div>
  `;

  $("storiesRow").innerHTML = stories.slice(0, 12).map(story => {
    const image = story.attachment?.mime?.startsWith("image/")
      ? `<img src="${escapeHtml(story.attachment.url)}">`
      : "";

    return `
      <div class="story-mini">
        ${image}
        <div class="story-avatar">${initials(story.username)}</div>
        <strong>@${escapeHtml(story.username)}</strong>
      </div>
    `;
  }).join("") || `
    <div class="muted" style="padding:20px">Aucune story pour le moment.</div>
  `;
}

function setupMessaging() {
  $("privateSend").onclick = sendPrivate;
  $("publicSend").onclick = sendPublic;
  $("roomSend").onclick = sendRoom;

  $("privateInput").addEventListener("keydown", e => {
    if (e.key === "Enter") sendPrivate();
    else {
      socket.emit("typing", {
        to: currentPrivateUser,
        active: true
      });
    }
  });

  $("privateFile").addEventListener("change", () => {
    $("privateFileName").textContent =
      $("privateFile").files[0]?.name || "";
  });

  $("publicFile").addEventListener("change", () => {
    $("publicFileName").textContent =
      $("publicFile").files[0]?.name || "";
  });

  $("roomFile").addEventListener("change", () => {
    $("roomFileName").textContent =
      $("roomFile").files[0]?.name || "";
  });

  socket.on("presence", users => {
    onlineUsers = users || [];
    updatePrivateStatus();
  });

  socket.on("privateMessage", message => {
    if (
      currentPrivateUser &&
      (
        (message.from === me.username && message.to === currentPrivateUser) ||
        (message.from === currentPrivateUser && message.to === me.username)
      )
    ) {
      appendMessage($("privateMessages"), message);
      $("privateMessages").scrollTop = $("privateMessages").scrollHeight;
    }

    loadConversations();
  });

  socket.on("publicMessage", message => {
    appendMessage($("publicMessages"), message);
    $("publicMessages").scrollTop = $("publicMessages").scrollHeight;
  });

  socket.on("roomMessage", message => {
    if (currentRoom && message.roomId === currentRoom.id) {
      appendMessage($("roomMessages"), message);
      $("roomMessages").scrollTop = $("roomMessages").scrollHeight;
    }
  });

  socket.on("typing", data => {
    if (data.from === currentPrivateUser) {
      $("typingPrivate").textContent =
        data.active ? `${data.from} écrit...` : "";
    }
  });

  $("closeRoom").onclick = () => {
    currentRoom = null;
    $("roomChat").classList.add("hidden");
    $("roomsGrid").classList.remove("hidden");
  };
}

async function uploadFile(file) {
  if (!file) return null;

  const form = new FormData();
  form.append("file", file);

  const result = await api("/api/upload", {
    method: "POST",
    body: form
  });

  return result.attachment;
}

async function sendPrivate() {
  if (!currentPrivateUser) return;

  const input = $("privateInput");
  const fileInput = $("privateFile");

  const text = input.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) return;

  try {
    const attachment = await uploadFile(file);

    socket.emit("privateMessage", {
      to: currentPrivateUser,
      text,
      attachment
    });

    input.value = "";
    fileInput.value = "";
    $("privateFileName").textContent = "";

  } catch (err) {
    showToast(err.message);
  }
}

async function sendPublic() {
  const input = $("publicInput");
  const fileInput = $("publicFile");

  const text = input.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) return;

  try {
    const attachment = await uploadFile(file);

    socket.emit("publicMessage", {
      text,
      attachment
    });

    input.value = "";
    fileInput.value = "";
    $("publicFileName").textContent = "";

  } catch (err) {
    showToast(err.message);
  }
}

async function sendRoom() {
  if (!currentRoom) return;

  const input = $("roomInput");
  const fileInput = $("roomFile");

  const text = input.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) return;

  try {
    const attachment = await uploadFile(file);

    socket.emit("roomMessage", {
      roomId: currentRoom.id,
      text,
      attachment
    });

    input.value = "";
    fileInput.value = "";
    $("roomFileName").textContent = "";

  } catch (err) {
    showToast(err.message);
  }
}

function appendMessage(container, message) {
  const mine = message.from === me.username;

  const row = document.createElement("div");
  row.className = "message-row" + (mine ? " mine" : "");

  row.innerHTML = `
    <div class="message-meta">
      <span class="message-name">@${escapeHtml(message.from)}</span>
      <span class="message-time">${formatDate(message.createdAt)}</span>
    </div>
    <div class="message-bubble">
      ${message.text ? `<div class="message-text">${escapeHtml(message.text)}</div>` : ""}
      ${message.attachment ? attachmentHtml(message.attachment) : ""}
    </div>
  `;

  container.appendChild(row);
}

async function loadConversations() {
  const conversations = await api("/api/messages/conversations");

  $("conversations").innerHTML = conversations.length
    ? conversations.map(c => `
      <div class="conversation ${currentPrivateUser === c.username ? "selected" : ""}"
           onclick="openPrivate('${escapeHtml(c.username)}')">
        <div class="conversation-avatar">${initials(c.username)}</div>
        <div style="min-width:0">
          <strong>@${escapeHtml(c.username)}</strong>
          <small>${escapeHtml(
            c.lastMessage?.text ||
            c.lastMessage?.attachment?.name ||
            "Pièce jointe"
          )}</small>
        </div>
      </div>
    `).join("")
    : `
      <div class="muted" style="padding:15px;text-align:center">
        Aucune discussion privée.
      </div>
    `;
}

async function openPrivate(username) {
  currentPrivateUser = username;

  $("privateEmpty").classList.add("hidden");
  $("privateChat").classList.remove("hidden");

  $("privateName").textContent = "@" + username;
  updatePrivateStatus();

  const users = await api("/api/users/" + encodeURIComponent(username));

  $("privateAvatar").textContent = users.avatar ? "" : initials(username);

  if (users.avatar) {
    $("privateAvatar").style.backgroundImage = `url('${users.avatar}')`;
  }

  const messages = await api(
    "/api/messages/" + encodeURIComponent(username)
  );

  $("privateMessages").innerHTML = "";

  messages.forEach(message =>
    appendMessage($("privateMessages"), message)
  );

  $("privateMessages").scrollTop =
    $("privateMessages").scrollHeight;

  await loadConversations();
}

function updatePrivateStatus() {
  if (!currentPrivateUser) return;

  $("privateStatus").textContent =
    onlineUsers.includes(currentPrivateUser)
      ? "● En ligne"
      : "Hors ligne";

  $("privateStatus").style.color =
    onlineUsers.includes(currentPrivateUser)
      ? "#22c55e"
      : "#9ca3af";
}

async function loadPublicMessages() {
  const messages = await api("/api/messages/public");

  $("publicMessages").innerHTML = "";

  messages.forEach(message =>
    appendMessage($("publicMessages"), message)
  );

  $("publicMessages").scrollTop =
    $("publicMessages").scrollHeight;
}

async function loadRooms() {
  const rooms = await api("/api/rooms");

  $("roomsGrid").innerHTML = rooms.map(room => `
    <article class="room-card" onclick="openRoom('${escapeHtml(room.id)}')">
      <div class="room-icon">${escapeHtml(room.icon)}</div>
      <h3>${escapeHtml(room.name)}</h3>
      <p>${escapeHtml(room.description || "Discussion communautaire")}</p>
    </article>
  `).join("");
}

async function openRoom(roomId) {
  const rooms = await api("/api/rooms");
  currentRoom = rooms.find(r => r.id === roomId);

  if (!currentRoom) return;

  $("roomsGrid").classList.add("hidden");
  $("roomChat").classList.remove("hidden");

  $("roomIcon").textContent = currentRoom.icon;
  $("roomName").textContent = currentRoom.name;
  $("roomDescription").textContent = currentRoom.description || "";

  socket.emit("joinRoom", roomId);

  const messages = await api(
    "/api/messages/room/" + encodeURIComponent(roomId)
  );

  $("roomMessages").innerHTML = "";

  messages.forEach(message =>
    appendMessage($("roomMessages"), message)
  );

  $("roomMessages").scrollTop =
    $("roomMessages").scrollHeight;
}

async function loadNotifications() {
  const notifications = await api(
    "/api/notifications/" + encodeURIComponent(me.username)
  );

  $("notifications").innerHTML = notifications.length
    ? notifications.map(n => `
      <div class="notification">
        <div class="avatar">${initials(n.from || "V")}</div>
        <div>
          <strong>${escapeHtml(n.text || "Nouvelle activité")}</strong>
          <small>${formatDate(n.createdAt)}</small>
        </div>
      </div>
    `).join("")
    : `
      <div class="post" style="text-align:center;padding:45px">
        <h3>Aucune notification</h3>
        <p class="muted">Tout est calme pour le moment.</p>
      </div>
    `;
}

async function loadProfile() {
  const data = await api(
    "/api/profile/" + encodeURIComponent(me.username)
  );

  const user = data.user;

  $("profileContent").innerHTML = `
    <div class="profile-banner"
      ${user.banner ? `style="background-image:url('${escapeHtml(user.banner)}')"` : ""}>
    </div>

    <div class="profile-box">
      <div class="profile-avatar"
        ${user.avatar ? `style="background-image:url('${escapeHtml(user.avatar)}')"` : ""}>
        ${!user.avatar ? initials(user.username) : ""}
      </div>

      <div class="profile-info">
        <h1>@${escapeHtml(user.username)}</h1>
        <p>${escapeHtml(user.bio || "Bienvenue sur mon profil Veyra.")}</p>

        <div class="profile-stats">
          <span><strong>${user.followers?.length || 0}</strong> abonnés</span>
          <span><strong>${user.following?.length || 0}</strong> abonnements</span>
          <span>Depuis ${new Date(user.createdAt).toLocaleDateString("fr-FR")}</span>
        </div>

        <div class="profile-actions">
          <button class="primary-btn" onclick="editProfile()">Modifier le profil</button>
        </div>
      </div>
    </div>

    <div class="section-head">
      <div>
        <h2>Publications</h2>
        <p>${data.posts.length} publication(s)</p>
      </div>
    </div>

    <div class="feed">
      ${data.posts.map(post => `
        <article class="post">
          <div class="post-head">
            <div class="user-avatar">${initials(post.username)}</div>
            <div>
              <div class="post-user">@${escapeHtml(post.username)}</div>
              <div class="post-date">${formatDate(post.createdAt)}</div>
            </div>
          </div>
          ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ""}
          ${post.attachment ? attachmentHtml(post.attachment) : ""}
        </article>
      `).join("") || `
        <div class="post" style="text-align:center;padding:40px">
          <p class="muted">Aucune publication.</p>
        </div>
      `}
    </div>
  `;
}

async function editProfile() {
  const bio = prompt("Ta nouvelle bio :", me.bio || "");
  if (bio === null) return;

  try {
    const updated = await api("/api/profile/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bio,
        avatar: me.avatar,
        banner: me.banner
      })
    });

    me = updated;
    updateUserUI();
    await loadProfile();
    showToast("Profil mis à jour.");

  } catch (err) {
    showToast(err.message);
  }
}

function setupSearch() {
  let timer;

  $("searchInput").addEventListener("input", () => {
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const q = $("searchInput").value.trim();

      if (!q) {
        $("searchResults").innerHTML = "";
        return;
      }

      const users = await api(
        "/api/search?q=" + encodeURIComponent(q)
      );

      $("searchResults").innerHTML = users.map(user => `
        <div class="user-card">
          <div class="user-avatar"
            ${avatarStyle(user.avatar)}>
            ${!user.avatar ? initials(user.username) : ""}
          </div>
          <div style="min-width:0">
            <strong>@${escapeHtml(user.username)}</strong>
            <small>${escapeHtml(user.bio || "Membre de Veyra")}</small>
          </div>
          <button class="action-btn" style="margin-left:auto"
            onclick="startPrivate('${escapeHtml(user.username)}')">✉</button>
        </div>
      `).join("");
    }, 250);
  });

  $("messageSearch").addEventListener("input", () => {
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const q = $("messageSearch").value.trim();

      if (!q) {
        $("messageSearchResults").innerHTML = "";
        return;
      }

      const users = await api(
        "/api/search?q=" + encodeURIComponent(q)
      );

      $("messageSearchResults").innerHTML = users
        .filter(u => u.username !== me.username)
        .map(user => `
          <div class="modal-user"
            onclick="startPrivate('${escapeHtml(user.username)}')">
            <div class="user-avatar">${initials(user.username)}</div>
            <strong>@${escapeHtml(user.username)}</strong>
          </div>
        `).join("");
    }, 250);
  });
}

function startPrivate(username) {
  closeModal("newMessageModal");
  showPage("messages");
  openPrivate(username);
}

init();
