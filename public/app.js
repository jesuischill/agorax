const $ = selector => document.querySelector(selector);

let me = null;
let socket = null;
let currentChat = null;
let currentRoom = null;
let typingTimer = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function time(date) {
  try {
    return new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function toast(message) {
  const old = $(".toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2500);
}

/* =========================
   NAVIGATION
========================= */

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", async () => {
    const page = button.dataset.page;

    document.querySelectorAll(".page").forEach(p =>
      p.classList.remove("active")
    );

    $("#" + page).classList.add("active");

    document.querySelectorAll(".nav").forEach(n =>
      n.classList.remove("active")
    );

    button.classList.add("active");

    if (page === "homePage") {
      await loadPosts();
      await loadStories();
    }

    if (page === "storiesPage") {
      await loadStoriesFull();
    }

    if (page === "chatPage") {
      await loadConversations();
      await loadRooms();
    }

    if (page === "profilePage") {
      await loadProfile();
    }
  });
});

/* =========================
   POSTS
========================= */

async function loadPosts() {
  try {
    const posts = await api("/api/posts");
    const container = $("#posts");

    container.innerHTML = "";

    if (!posts.length) {
      container.innerHTML = `
        <div class="empty">
          <div>📝</div>
          <h3>Aucune publication</h3>
          <p>Sois le premier à publier.</p>
        </div>
      `;
      return;
    }

    posts.forEach(post => {
      container.insertAdjacentHTML(
        "beforeend",
        postHtml(post)
      );
    });

  } catch (error) {
    toast(error.message);
  }
}

function postHtml(post) {
  const username = String(
    post.username || "Utilisateur"
  );

  const initial =
    username.charAt(0).toUpperCase() || "U";

  const mine =
    username === me?.username;

  const attachment = post.attachment
    ? `
      <div class="post-attachment">
        ${
          /\.(png|jpe?g|gif|webp|svg)$/i.test(post.attachment)
            ? `<img src="${esc(post.attachment)}">`
            : `
              <a
                href="${esc(post.attachment)}"
                target="_blank"
                rel="noopener"
              >
                📎 ${esc(post.originalName || "Fichier")}
              </a>
            `
        }
      </div>
    `
    : "";

  return `
    <article class="post-card" data-post-id="${esc(post.id)}">

      <header class="post-header">

        <div class="author">
          <div class="avatar">${esc(initial)}</div>

          <div>
            <strong>${esc(username)}</strong>
            <small>${time(post.createdAt)}</small>
          </div>
        </div>

        ${
          mine
            ? `
              <button
                class="delete-btn"
                title="Supprimer"
                onclick="deletePost('${esc(post.id)}')"
              >🗑️</button>
            `
            : ""
        }

      </header>

      ${
        post.text
          ? `<div class="post-text">${esc(post.text)}</div>`
          : ""
      }

      ${attachment}

      <footer class="post-footer">

        <button
          onclick="likePost('${esc(post.id)}')"
        >
          ❤️ ${post.likes?.length || 0}
        </button>

        <span>💬 ${post.comments?.length || 0}</span>

      </footer>

    </article>
  `;
}

async function likePost(id) {
  try {
    await api(`/api/posts/${encodeURIComponent(id)}/like`, {
      method: "POST"
    });

    await loadPosts();
  } catch (error) {
    toast(error.message);
  }
}

async function deletePost(id) {
  if (!confirm("Supprimer cette publication ?")) return;

  try {
    await api(`/api/posts/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    toast("Publication supprimée.");

    await loadPosts();
  } catch (error) {
    toast(error.message);
  }
}

$("#postFile").addEventListener("change", () => {
  const file = $("#postFile").files[0];
  $("#postFileName").textContent =
    file ? file.name : "";
});

$("#publishBtn").addEventListener("click", async () => {
  const text = $("#postText").value.trim();
  const file = $("#postFile").files[0];

  if (!text && !file) {
    toast("Ajoute du texte ou un fichier.");
    return;
  }

  const form = new FormData();

  form.append("text", text);

  if (file) {
    form.append("attachment", file);
  }

  try {
    await api("/api/posts", {
      method: "POST",
      body: form
    });

    $("#postText").value = "";
    $("#postFile").value = "";
    $("#postFileName").textContent = "";

    toast("Publication créée.");

    await loadPosts();

  } catch (error) {
    toast(error.message);
  }
});

/* =========================
   STORIES
========================= */

async function loadStories() {
  try {
    const stories = await api("/api/stories");
    const container = $("#stories");

    container.innerHTML = "";

    stories.slice(0, 12).forEach(story => {
      container.insertAdjacentHTML(
        "beforeend",
        storyCardHtml(story)
      );
    });

  } catch (error) {
    toast(error.message);
  }
}

async function loadStoriesFull() {
  try {
    const stories = await api("/api/stories");
    const container = $("#storiesFull");

    container.innerHTML = "";

    if (!stories.length) {
      container.innerHTML = `
        <div class="empty">
          <div>◉</div>
          <h3>Aucune story</h3>
          <p>Ajoute ta première story.</p>
        </div>
      `;
      return;
    }

    stories.forEach(story => {
      container.insertAdjacentHTML(
        "beforeend",
        storyLargeHtml(story)
      );
    });

  } catch (error) {
    toast(error.message);
  }
}

function storyCardHtml(story) {
  const username = String(
    story.username || "Utilisateur"
  );

  const initial =
    username.charAt(0).toUpperCase() || "U";

  const mine =
    username === me?.username;

  return `
    <article
      class="story-card"
      data-story-id="${esc(story.id)}"
      onclick="openStory('${esc(story.id)}')"
    >

      ${
        story.attachment
          ? `
            <img
              src="${esc(story.attachment)}"
              alt=""
            >
          `
          : `
            <div class="story-text-preview">
              ${esc(story.caption || "Story")}
            </div>
          `
      }

      <div class="story-overlay">

        <div class="story-author">
          <div class="story-avatar">
            ${esc(initial)}
          </div>

          <strong>${esc(username)}</strong>
        </div>

        ${
          mine
            ? `
              <button
                class="delete-btn story-delete"
                onclick="event.stopPropagation(); deleteStory('${esc(story.id)}')"
              >
                🗑️
              </button>
            `
            : ""
        }

      </div>

    </article>
  `;
}

function storyLargeHtml(story) {
  const username = String(
    story.username || "Utilisateur"
  );

  const initial =
    username.charAt(0).toUpperCase() || "U";

  const mine =
    username === me?.username;

  return `
    <article
      class="story-large"
      data-story-id="${esc(story.id)}"
    >

      <div class="story-large-media">

        ${
          story.attachment
            ? `
              <img src="${esc(story.attachment)}">
            `
            : `
              <div class="story-large-text">
                ${esc(story.caption || "Story")}
              </div>
            `
        }

        <div class="story-large-top">

          <div class="author story-author-large">
            <div class="avatar">${esc(initial)}</div>

            <div>
              <strong>${esc(username)}</strong>
              <small>${time(story.createdAt)}</small>
            </div>
          </div>

          ${
            mine
              ? `
                <button
                  class="delete-btn"
                  onclick="deleteStory('${esc(story.id)}')"
                  title="Supprimer cette story"
                >
                  🗑️
                </button>
              `
              : ""
          }

        </div>

      </div>

      ${
        story.caption
          ? `
            <div class="story-caption">
              ${esc(story.caption)}
            </div>
          `
          : ""
      }

    </article>
  `;
}

async function deleteStory(id) {
  if (!confirm("Supprimer définitivement cette story ?")) {
    return;
  }

  try {
    await api(`/api/stories/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    toast("Story supprimée.");

    await loadStories();
    await loadStoriesFull();

  } catch (error) {
    toast(error.message);
  }
}

async function createStory() {
  const input = document.createElement("input");

  input.type = "file";
  input.accept = "image/*,video/*";
  input.click();

  input.onchange = async () => {
    const file = input.files[0];

    if (!file) return;

    const caption = prompt(
      "Texte de la story (facultatif) :"
    ) || "";

    const form = new FormData();

    form.append("attachment", file);
    form.append("caption", caption);

    try {
      await api("/api/stories", {
        method: "POST",
        body: form
      });

      toast("Story ajoutée.");

      await loadStories();
      await loadStoriesFull();

    } catch (error) {
      toast(error.message);
    }
  };
}

function openStory(id) {
  const story = document.querySelector(
    `[data-story-id="${CSS.escape(id)}"]`
  );

  if (!story) return;

  story.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

$("#addStoryBtn").onclick = createStory;
$("#addStoryBtn2").onclick = createStory;

/* =========================
   MODAL
========================= */

$("#chooseStory").onclick = () => {
  $("#modal").classList.add("hidden");
  createStory();
};

$("#choosePost").onclick = () => {
  $("#modal").classList.add("hidden");
  $("#postText").focus();
};

$("#closeModal").onclick = () =>
  $("#modal").classList.add("hidden");

/* =========================
   CHAT
========================= */

function connectSocket() {
  socket = io();

  socket.on("privateMessage", message => {
    if (
      currentChat &&
      (
        (message.from === me.username &&
          message.to === currentChat) ||
        (message.from === currentChat &&
          message.to === me.username)
      )
    ) {
      appendMessage(message);
    }

    loadConversations();
  });

  socket.on("publicMessage", message => {
    if (currentChat === "__public__") {
      appendMessage(message);
    }
  });

  socket.on("roomMessage", message => {
    if (currentRoom === message.roomId) {
      appendMessage(message);
    }
  });

  socket.on("typing", data => {
    if (currentChat === data.from) {
      $("#typingIndicator").textContent =
        data.typing ? "écrit..." : "";
    }
  });
}

async function loadConversations() {
  try {
    const conversations =
      await api("/api/messages/conversations");

    const list = $("#conversationList");

    list.innerHTML = "";

    conversations.forEach(item => {
      list.insertAdjacentHTML(
        "beforeend",
        `
          <button
            class="conversation"
            onclick="openChat('${esc(item.username)}')"
          >
            <span class="avatar small">
              ${esc(item.username.charAt(0).toUpperCase())}
            </span>

            <span>
              <strong>${esc(item.username)}</strong>
              <small>
                ${esc(item.lastMessage?.text || "")}
              </small>
            </span>
          </button>
        `
      );
    });

  } catch {}
}

async function openChat(username) {
  currentChat = username;
  currentRoom = null;

  $("#chatEmpty").classList.add("hidden");
  $("#chatWindow").classList.remove("hidden");
  $("#chatTitle").textContent = username;

  const messages =
    await api(
      `/api/messages/${encodeURIComponent(username)}`
    );

  $("#messages").innerHTML = "";

  messages.forEach(appendMessage);

  scrollMessages();
}

function openPublicChat() {
  currentChat = "__public__";
  currentRoom = null;

  $("#chatEmpty").classList.add("hidden");
  $("#chatWindow").classList.remove("hidden");
  $("#chatTitle").textContent = "Chat public";

  socket.emit("joinPublic");

  api("/api/messages/public")
    .then(messages => {
      $("#messages").innerHTML = "";
      messages.forEach(appendMessage);
      scrollMessages();
    });
}

async function loadRooms() {
  try {
    const rooms = await api("/api/rooms");
    const list = $("#roomList");

    list.innerHTML = "";

    rooms.forEach(room => {
      list.insertAdjacentHTML(
        "beforeend",
        `
          <button
            class="room"
            onclick="openRoom('${esc(room.id)}','${esc(room.name)}')"
          >
            # ${esc(room.name)}
          </button>
        `
      );
    });

  } catch {}
}

async function openRoom(id, name) {
  currentRoom = id;
  currentChat = null;

  $("#chatEmpty").classList.add("hidden");
  $("#chatWindow").classList.remove("hidden");
  $("#chatTitle").textContent = "# " + name;

  socket.emit("joinRoom", id);

  const messages =
    await api(`/api/messages/room/${encodeURIComponent(id)}`);

  $("#messages").innerHTML = "";

  messages.forEach(appendMessage);

  scrollMessages();
}

function appendMessage(message) {
  const mine =
    message.from === me.username;

  const div = document.createElement("div");

  div.className =
    "message " + (mine ? "mine" : "");

  div.innerHTML = `
    <div class="message-name">
      ${esc(message.from)}
    </div>

    <div class="message-bubble">
      ${esc(message.text)}
    </div>

    <small>${time(message.createdAt)}</small>
  `;

  $("#messages").appendChild(div);
}

function scrollMessages() {
  const box = $("#messages");

  box.scrollTop = box.scrollHeight;
}

$("#messageForm").addEventListener("submit", event => {
  event.preventDefault();

  const text = $("#messageInput").value.trim();

  if (!text || !socket) return;

  if (currentChat === "__public__") {
    socket.emit("publicMessage", { text });
  } else if (currentChat) {
    socket.emit("privateMessage", {
      to: currentChat,
      text
    });
  } else if (currentRoom) {
    socket.emit("roomMessage", {
      roomId: currentRoom,
      text
    });
  }

  $("#messageInput").value = "";
});

$("#messageInput").addEventListener("input", () => {
  if (!currentChat || currentChat === "__public__") {
    return;
  }

  socket.emit("typing", {
    to: currentChat,
    typing: true
  });

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    socket.emit("typing", {
      to: currentChat,
      typing: false
    });
  }, 800);
});

$("#publicChatBtn").onclick = openPublicChat;

$("#createRoomBtn").onclick = async () => {
  const name = prompt("Nom du salon :");

  if (!name) return;

  try {
    await api("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name })
    });

    await loadRooms();

    toast("Salon créé.");

  } catch (error) {
    toast(error.message);
  }
};

/* =========================
   PROFILE
========================= */

async function loadProfile() {
  try {
    const data =
      await api(
        `/api/profile/${encodeURIComponent(me.username)}`
      );

    const user = data.user;

    $("#profile").innerHTML = `
      <div class="profile-card">

        <div class="profile-avatar">
          ${
            user.avatar
              ? `<img src="${esc(user.avatar)}">`
              : esc(user.username.charAt(0).toUpperCase())
          }
        </div>

        <h1>${esc(user.username)}</h1>

        <p>${esc(user.bio || "Aucune bio.")}</p>

        <div class="profile-stats">
          <div>
            <strong>${data.followers}</strong>
            <span>abonnés</span>
          </div>

          <div>
            <strong>${data.followingCount}</strong>
            <span>abonnements</span>
          </div>
        </div>

        <textarea id="bioInput">${esc(user.bio || "")}</textarea>

        <button id="saveBio" class="primary">
          Enregistrer
        </button>

      </div>
    `;

    $("#saveBio").onclick = async () => {
      try {
        await api("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bio: $("#bioInput").value
          })
        });

        toast("Profil enregistré.");
        await loadProfile();

      } catch (error) {
        toast(error.message);
      }
    };

  } catch (error) {
    toast(error.message);
  }
}

/* =========================
   SEARCH
========================= */

let searchTimer;

$("#searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);

  const q = $("#searchInput").value.trim();

  if (!q) {
    $("#searchResults").innerHTML = "";
    return;
  }

  searchTimer = setTimeout(async () => {
    try {
      const users =
        await api(
          `/api/users/search?q=${encodeURIComponent(q)}`
        );

      $("#searchResults").innerHTML =
        users.map(user => `
          <button
            onclick="openUserProfile('${esc(user.username)}')"
          >
            <span class="avatar small">
              ${esc(user.username.charAt(0).toUpperCase())}
            </span>
            <strong>${esc(user.username)}</strong>
          </button>
        `).join("");

    } catch (error) {
      toast(error.message);
    }
  }, 250);
});

async function openUserProfile(username) {
  $("#searchResults").innerHTML = "";
  $("#searchInput").value = "";

  const data =
    await api(
      `/api/profile/${encodeURIComponent(username)}`
    );

  $("#profile").innerHTML = `
    <div class="profile-card">

      <div class="profile-avatar">
        ${
          data.user.avatar
            ? `<img src="${esc(data.user.avatar)}">`
            : esc(data.user.username.charAt(0).toUpperCase())
        }
      </div>

      <h1>${esc(data.user.username)}</h1>

      <p>${esc(data.user.bio || "Aucune bio.")}</p>

      <div class="profile-stats">
        <div>
          <strong>${data.followers}</strong>
          <span>abonnés</span>
        </div>

        <div>
          <strong>${data.followingCount}</strong>
          <span>abonnements</span>
        </div>
      </div>

      <button
        class="primary"
        onclick="toggleFollow('${esc(username)}')"
      >
        ${data.following ? "Ne plus suivre" : "Suivre"}
      </button>

    </div>
  `;

  document.querySelector('[data-page="profilePage"]').click();
}

async function toggleFollow(username) {
  try {
    const data =
      await api(
        `/api/users/${encodeURIComponent(username)}/follow`,
        { method: "POST" }
      );

    toast(
      data.following
        ? "Utilisateur suivi."
        : "Utilisateur retiré."
    );

    await openUserProfile(username);

  } catch (error) {
    toast(error.message);
  }
}

/* =========================
   LOGOUT
========================= */

$("#logoutBtn").onclick = async () => {
  try {
    await api("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    location.href = "/login.html";
  }
};

/* =========================
   INIT
========================= */

async function init() {
  try {
    const data = await api("/api/auth/me");

    me = data.user;

    window.me = me;
    window.currentUser = me;

    connectSocket();

    await loadStories();
    await loadPosts();

  } catch {
    location.href = "/login.html";
  }
}

init();
