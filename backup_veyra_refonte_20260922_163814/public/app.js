const socket = io();

const $ = id => document.getElementById(id);

let me = null;
let currentPage = "home";
let currentPrivateUser = null;
let currentRoom = null;
let typingTimeout = null;

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
};

const escapeHtml = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = value => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const initials = username => {
  const value = String(username || "V").trim();

  if (!value) return "V";

  return value
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0].toUpperCase())
    .join("") || "V";
};

function toast(message) {
  const container = $("toastContainer");

  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;

  container.appendChild(item);

  setTimeout(() => {
    item.remove();
  }, 3200);
}

function setAvatar(element, username) {
  if (!element) return;
  element.textContent = initials(username);
}

function showPage(page) {
  currentPage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  document.querySelectorAll(".nav-item[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (page === "home") {
    loadStories().catch(() => {});
    loadPosts("homePosts").catch(() => {});
  }

  if (page === "messages") {
    loadConversations().catch(err => toast(err.message));
  }

  if (page === "stories") {
    loadStoriesPage().catch(err => toast(err.message));
  }

  if (page === "posts") {
    loadPosts("postsFeed").catch(err => toast(err.message));
  }

  if (page === "rooms") {
    loadRooms().catch(err => toast(err.message));
  }

  if (page === "profile") {
    loadProfile().catch(err => toast(err.message));
  }
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  document.querySelectorAll("[data-page-jump]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.pageJump);
    });
  });

  $("sidebarProfile")?.addEventListener("click", () => showPage("profile"));
  $("topAvatar")?.addEventListener("click", () => showPage("profile"));

  $("logoutButton")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      location.href = "/login.html";
    } catch (error) {
      toast(error.message);
    }
  });

  $("backToConversations")?.addEventListener("click", () => {
    $("messenger").classList.remove("chat-open");
  });
}

async function loadMe() {
  const data = await api("/api/auth/me");
  me = data.user || data;

  if (!me?.username) {
    location.href = "/login.html";
    return;
  }

  $("sidebarUsername").textContent = "@" + me.username;
  $("postComposerName").textContent = me.username;
  $("profileUsername").textContent = "@" + me.username;
  $("profileEmail").textContent = me.email || "";

  $("profileBio").textContent =
    me.bio || "Bienvenue sur mon profil Veyra.";

  setAvatar($("sidebarAvatar"), me.username);
  setAvatar($("topAvatar"), me.username);
  setAvatar($("postComposerAvatar"), me.username);
  setAvatar($("storyCreateAvatar"), me.username);
  setAvatar($("profileAvatar"), me.username);
}

async function loadConversations() {
  const list = $("conversationList");

  list.innerHTML = `
    <div class="empty-state">
      <strong>Chargement...</strong>
      Conversations
    </div>
  `;

  const conversations = await api("/api/messages/conversations");

  if (!conversations.length) {
    list.innerHTML = `
      <div class="empty-state">
        <strong>Aucune discussion</strong>
        Recherche un utilisateur pour commencer.
      </div>
    `;
    return;
  }

  list.innerHTML = conversations.map(item => {
    const username = item.username || item.other || "";
    const last = item.lastMessage;

    return `
      <button class="conversation-item"
              data-username="${escapeHtml(username)}">

        <div class="avatar">${escapeHtml(initials(username))}</div>

        <div class="conversation-info">
          <strong>@${escapeHtml(username)}</strong>
          <span>${escapeHtml(
            last?.text ||
            (last?.attachment ? "📎 Pièce jointe" : "")
          )}</span>
        </div>

        <span class="conversation-time">
          ${escapeHtml(formatDate(item.createdAt))}
        </span>

      </button>
    `;
  }).join("");

  list.querySelectorAll(".conversation-item").forEach(button => {
    button.addEventListener("click", () => {
      openPrivateChat(button.dataset.username);
    });
  });
}

async function searchUsers(query) {
  const box = $("messageSearchResults");

  if (!query) {
    box.innerHTML = "";
    return;
  }

  try {
    const users = await api(
      "/api/users/search?q=" + encodeURIComponent(query)
    );

    box.innerHTML = users
      .filter(user => user.username !== me.username)
      .slice(0, 8)
      .map(user => `
        <button class="search-user"
                data-username="${escapeHtml(user.username)}">

          <div class="avatar">${escapeHtml(initials(user.username))}</div>

          <strong>@${escapeHtml(user.username)}</strong>

        </button>
      `)
      .join("");

    box.querySelectorAll(".search-user").forEach(button => {
      button.addEventListener("click", () => {
        openPrivateChat(button.dataset.username);
        $("messageSearch").value = "";
        box.innerHTML = "";
      });
    });

  } catch (error) {
    box.innerHTML = "";
  }
}

async function openPrivateChat(username) {
  currentPrivateUser = username;

  $("privateEmpty").classList.add("hidden");
  $("privateInterface").classList.remove("hidden");

  $("privateUsername").textContent = "@" + username;
  $("privateStatus").textContent = "Conversation privée";

  setAvatar($("privateAvatar"), username);

  const messages = await api(
    "/api/messages/" + encodeURIComponent(username)
  );

  $("privateMessages").innerHTML = "";

  messages.forEach(message => {
    appendMessage($("privateMessages"), message);
  });

  scrollMessages($("privateMessages"));

  socket.emit("joinPrivate", username);

  document.querySelectorAll(".conversation-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.username === username
    );
  });

  const messenger = document.querySelector(".messenger");

  if (window.innerWidth <= 680) {
    messenger.classList.add("chat-open");
  }
}

function appendMessage(container, message) {
  if (!container || !message) return;

  const mine = message.from === me?.username;

  const row = document.createElement("div");

  row.className = "message-row" + (mine ? " mine" : "");

  const attachment = message.attachment
    ? `
      <div class="message-attachment">
        <a href="${escapeHtml(message.attachment.url || "#")}"
           target="_blank"
           rel="noopener">
          📎 ${escapeHtml(
            message.attachment.originalName ||
            message.attachment.filename ||
            "Pièce jointe"
          )}
        </a>
      </div>
    `
    : "";

  row.innerHTML = `
    <div class="message-meta">
      <span class="message-name">@${escapeHtml(message.from)}</span>
      <span class="message-time">${escapeHtml(formatDate(message.createdAt))}</span>
    </div>

    <div class="message-bubble">
      ${
        message.text
          ? `<div class="message-text">${escapeHtml(message.text)}</div>`
          : ""
      }
      ${attachment}
    </div>
  `;

  container.appendChild(row);
}

function scrollMessages(container) {
  if (!container) return;

  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function sendPrivateMessage(event) {
  event.preventDefault();

  if (!currentPrivateUser) return;

  const input = $("privateInput");
  const fileInput = $("privateFile");

  const text = input.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) return;

  try {
    let attachment = null;

    if (file) {
      attachment = await uploadFile(file);
    }

    socket.emit("privateMessage", {
      to: currentPrivateUser,
      text,
      attachment
    });

    input.value = "";
    fileInput.value = "";
    $("privateFileName").textContent = "";
    $("privateFileName").classList.add("hidden");

  } catch (error) {
    toast(error.message);
  }
}

async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: form,
    credentials: "same-origin"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Envoi du fichier impossible.");
  }

  return data.file || data;
}

function setupPrivateComposer() {
  $("privateForm").addEventListener("submit", sendPrivateMessage);

  $("privateFile").addEventListener("change", () => {
    const file = $("privateFile").files[0];

    $("privateFileName").textContent = file
      ? "📎 " + file.name
      : "";

    $("privateFileName").classList.toggle("hidden", !file);
  });

  $("privateInput").addEventListener("input", () => {
    if (!currentPrivateUser) return;

    socket.emit("typing", {
      to: currentPrivateUser
    });

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
      socket.emit("typing", {
        to: currentPrivateUser,
        stop: true
      });
    }, 900);
  });

  $("privateEmoji").addEventListener("click", () => {
    $("privateInput").value += " 😊";
    $("privateInput").focus();
  });
}


/* PUBLIC CHAT */

function setupPublicSocket() {
  socket.emit("joinPublic");
}


/* POSTS */

async function loadPosts(containerId) {
  const container = $(containerId);

  if (!container) return;

  const posts = await api("/api/posts");

  if (!posts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Aucune publication</strong>
        Sois le premier à publier quelque chose.
      </div>
    `;
    return;
  }

  container.innerHTML = posts
    .slice()
    .reverse()
    .map(renderPost)
    .join("");
}

function renderPost(post) {
  const author = post.author || post.username || post.from || "Utilisateur";

  let media = "";

  if (post.attachment?.url) {
    const url = post.attachment.url;
    const name = post.attachment.originalName || "";

    if (/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
      media = `
        <img class="post-media"
             src="${escapeHtml(url)}"
             alt="Publication de ${escapeHtml(author)}">
      `;
    } else {
      media = `
        <div class="post-body">
          <div class="message-attachment">
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener">
              📎 ${escapeHtml(name || "Pièce jointe")}
            </a>
          </div>
        </div>
      `;
    }
  }

  return `
    <article class="post-card">

      <div class="post-header">

        <div class="avatar">
          ${escapeHtml(initials(author))}
        </div>

        <div class="post-author">
          <strong>@${escapeHtml(author)}</strong>
          <span>${escapeHtml(formatDate(post.createdAt))}</span>
        </div>

      </div>

      ${
        post.text
          ? `<div class="post-body">
               <p class="post-text">${escapeHtml(post.text)}</p>
             </div>`
          : ""
      }

      ${media}

      <div class="post-actions">
        <button class="post-action">♡ J'aime</button>
        <button class="post-action">💬 Commenter</button>
        <button class="post-action">↗ Partager</button>
      </div>

    </article>
  `;
}


/* STORY */

async function loadStories() {
  const stories = await api("/api/stories");

  renderStories($("homeStories"), stories);
}

async function loadStoriesPage() {
  const stories = await api("/api/stories");

  renderStories($("storiesGrid"), stories);

  const home = $("homeStories");

  if (home) {
    renderStories(home, stories);
  }
}

function renderStories(container, stories) {
  if (!container) return;

  if (!stories?.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Aucune story</strong>
        Ajoute ta première story.
      </div>
    `;
    return;
  }

  container.innerHTML = stories.map(story => {

    const author =
      story.username ||
      story.author ||
      story.from ||
      "Utilisateur";

    const image =
      story.attachment?.url ||
      story.file?.url ||
      story.image ||
      "";

    const background = image
      ? `style="background-image:linear-gradient(to top,rgba(0,0,0,.82),transparent 60%),url('${escapeHtml(image)}');background-size:cover;background-position:center"`
      : "";

    return `
      <article class="story-card"
               ${background}
               data-story-id="${escapeHtml(story.id || "")}">

        <div class="story-card-avatar avatar">
          ${escapeHtml(initials(author))}
        </div>

        <strong>@${escapeHtml(author)}</strong>
        <small>${escapeHtml(formatDate(story.createdAt))}</small>

      </article>
    `;
  }).join("");

  container.querySelectorAll(".story-card").forEach(card => {
    card.addEventListener("click", async () => {
      const id = card.dataset.storyId;

      const story = stories.find(
        item => String(item.id) === String(id)
      );

      if (story) openStory(story);
    });
  });
}

function openStory(story) {
  const author =
    story.username ||
    story.author ||
    story.from ||
    "Utilisateur";

  $("storyViewerUsername").textContent = "@" + author;
  setAvatar($("storyViewerAvatar"), author);

  const content = $("storyViewerContent");

  const url =
    story.attachment?.url ||
    story.file?.url ||
    story.image ||
    "";

  if (url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
    content.innerHTML = `
      <img src="${escapeHtml(url)}"
           alt="Story de ${escapeHtml(author)}">
    `;
  } else if (url) {
    content.innerHTML = `
      <a class="primary-button"
         href="${escapeHtml(url)}"
         target="_blank"
         rel="noopener">
         Ouvrir le fichier
      </a>
    `;
  } else {
    content.innerHTML = `
      <div class="empty-state">
        ${escapeHtml(story.text || "Cette story ne contient pas de contenu.")}
      </div>
    `;
  }

  $("storyViewer").classList.remove("hidden");
}


/* MODALS */

function openModal(id) {
  $(id).classList.remove("hidden");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach(modal => {
    modal.classList.add("hidden");
  });
}

async function submitPost() {
  const text = $("postText").value.trim();
  const file = $("postFile").files[0];

  if (!text && !file) {
    toast("Ajoute un texte ou un fichier.");
    return;
  }

  try {
    let attachment = null;

    if (file) {
      attachment = await uploadFile(file);
    }

    await api("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        attachment
      })
    });

    $("postText").value = "";
    $("postFile").value = "";
    $("postFileName").textContent = "";

    closeModals();

    await loadPosts("postsFeed");
    await loadPosts("homePosts");

    toast("Publication créée.");

  } catch (error) {
    toast(error.message);
  }
}

async function submitStory() {
  const text = $("storyText").value.trim();
  const file = $("storyFile").files[0];

  if (!text && !file) {
    toast("Ajoute un texte ou un fichier.");
    return;
  }

  try {
    let attachment = null;

    if (file) {
      attachment = await uploadFile(file);
    }

    await api("/api/stories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        attachment
      })
    });

    $("storyText").value = "";
    $("storyFile").value = "";
    $("storyFileName").textContent = "";

    closeModals();

    await loadStoriesPage();

    toast("Story publiée.");

  } catch (error) {
    toast(error.message);
  }
}

function setupModals() {
  $("newPostButton")?.addEventListener("click", () => openModal("postModal"));
  $("openPostComposer")?.addEventListener("click", () => openModal("postModal"));
  $("postComposerPhoto")?.addEventListener("click", () => openModal("postModal"));

  $("newStoryButton")?.addEventListener("click", () => openModal("storyModal"));
  $("storyCreatePlus")?.addEventListener("click", () => openModal("storyModal"));
  $("storyCreateCard")?.addEventListener("click", event => {
    if (event.target.id !== "storyCreatePlus") {
      openModal("storyModal");
    }
  });

  $("submitPost")?.addEventListener("click", submitPost);
  $("submitStory")?.addEventListener("click", submitStory);

  $("postFile")?.addEventListener("change", () => {
    const file = $("postFile").files[0];
    $("postFileName").textContent = file
      ? "📎 " + file.name
      : "";
  });

  $("storyFile")?.addEventListener("change", () => {
    const file = $("storyFile").files[0];
    $("storyFileName").textContent = file
      ? "📎 " + file.name
      : "";
  });

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModals);
  });

  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", closeModals);
  });

  $("storyClose")?.addEventListener("click", () => {
    $("storyViewer").classList.add("hidden");
  });
}


/* ROOMS */

async function loadRooms() {
  const rooms = await api("/api/rooms");

  if (!rooms.length) {
    $("roomsGrid").innerHTML = `
      <div class="empty-state">
        <strong>Aucun salon</strong>
        Crée le premier salon.
      </div>
    `;
    return;
  }

  $("roomsGrid").innerHTML = rooms.map(room => `
    <article class="room-card"
             data-room-id="${escapeHtml(room.id)}">

      <div class="room-icon">
        ${escapeHtml(room.icon || "#")}
      </div>

      <h3>${escapeHtml(room.name)}</h3>

      <p>
        ${escapeHtml(room.description || "Discussion communautaire")}
      </p>

    </article>
  `).join("");

  $("roomsGrid").querySelectorAll(".room-card").forEach(card => {
    card.addEventListener("click", () => {
      openRoom(card.dataset.roomId);
    });
  });
}

async function openRoom(roomId) {
  const rooms = await api("/api/rooms");

  currentRoom = rooms.find(room => String(room.id) === String(roomId));

  if (!currentRoom) return;

  $("roomsGrid").classList.add("hidden");
  $("roomChat").classList.remove("hidden");

  $("roomIcon").textContent = currentRoom.icon || "#";
  $("roomName").textContent = currentRoom.name;
  $("roomDescription").textContent =
    currentRoom.description || "Discussion communautaire";

  socket.emit("joinRoom", roomId);

  const messages = await api(
    "/api/messages/room/" + encodeURIComponent(roomId)
  );

  $("roomMessages").innerHTML = "";

  messages.forEach(message => {
    appendMessage($("roomMessages"), message);
  });

  scrollMessages($("roomMessages"));
}

function setupRoomComposer() {
  $("closeRoom")?.addEventListener("click", () => {
    $("roomChat").classList.add("hidden");
    $("roomsGrid").classList.remove("hidden");
    currentRoom = null;
  });

  $("roomFile")?.addEventListener("change", () => {
    const file = $("roomFile").files[0];

    $("roomFileName").textContent = file
      ? "📎 " + file.name
      : "";

    $("roomFileName").classList.toggle("hidden", !file);
  });

  $("roomForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentRoom) return;

    const input = $("roomInput");
    const fileInput = $("roomFile");

    const text = input.value.trim();
    const file = fileInput.files[0];

    if (!text && !file) return;

    try {
      let attachment = null;

      if (file) {
        attachment = await uploadFile(file);
      }

      socket.emit("roomMessage", {
        roomId: currentRoom.id,
        text,
        attachment
      });

      input.value = "";
      fileInput.value = "";
      $("roomFileName").textContent = "";
      $("roomFileName").classList.add("hidden");

    } catch (error) {
      toast(error.message);
    }
  });
}


/* PROFILE */

async function loadProfile() {
  try {
    const posts = await api("/api/posts");

    const mine = posts.filter(post =>
      (post.author || post.username || post.from) === me.username
    );

    $("profilePostsCount").textContent = mine.length;
    $("profileFollowers").textContent =
      Array.isArray(me.followers) ? me.followers.length : 0;
    $("profileFollowing").textContent =
      Array.isArray(me.following) ? me.following.length : 0;

  } catch {
    $("profilePostsCount").textContent = "0";
  }
}


/* SOCKET */

socket.on("connect", () => {
  setupPublicSocket();

  if (currentRoom) {
    socket.emit("joinRoom", currentRoom.id);
  }
});

socket.on("privateMessage", message => {
  if (!currentPrivateUser || !me) return;

  const belongs =
    (message.from === me.username && message.to === currentPrivateUser) ||
    (message.from === currentPrivateUser && message.to === me.username);

  if (!belongs) return;

  appendMessage($("privateMessages"), message);
  scrollMessages($("privateMessages"));

  $("privateTyping").classList.add("hidden");

  loadConversations().catch(() => {});
});

socket.on("publicMessage", () => {
  if (currentPage === "home") {
    toast("Nouveau message public.");
  }
});

socket.on("roomMessage", message => {
  if (!currentRoom) return;

  if (String(message.roomId) !== String(currentRoom.id)) return;

  appendMessage($("roomMessages"), message);
  scrollMessages($("roomMessages"));
});

socket.on("typing", data => {
  if (
    currentPrivateUser &&
    data?.from === currentPrivateUser &&
    !data.stop
  ) {
    $("privateTyping").classList.remove("hidden");

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
      $("privateTyping").classList.add("hidden");
    }, 1400);
  }

  if (data?.stop) {
    $("privateTyping").classList.add("hidden");
  }
});

socket.on("presence", users => {
  if (!currentPrivateUser) return;

  const online = Array.isArray(users) &&
    users.includes(currentPrivateUser);

  $("privateStatus").textContent =
    online ? "● En ligne" : "Hors ligne";
});


/* SEARCH */

function setupSearch() {
  $("messageSearch")?.addEventListener("input", event => {
    searchUsers(event.target.value.trim());
  });

  $("globalSearch")?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    const query = event.target.value.trim();

    if (!query) return;

    showPage("posts");
    toast("Recherche : " + query);
  });
}


/* INIT */

async function init() {
  try {
    await loadMe();

    setupNavigation();
    setupPrivateComposer();
    setupModals();
    setupRoomComposer();
    setupSearch();

    $("newConversationButton")?.addEventListener("click", () => {
      $("messageSearch").focus();
    });

    $("emptyNewConversation")?.addEventListener("click", () => {
      $("messageSearch").focus();
    });

    await loadStories();
    await loadPosts("homePosts");

    showPage("home");

  } catch (error) {
    console.error(error);

    if (
      error.message.toLowerCase().includes("connect") ||
      error.message.toLowerCase().includes("auth") ||
      error.message.toLowerCase().includes("non connecté")
    ) {
      location.href = "/login.html";
    } else {
      toast(error.message);
    }
  }
}

init();
