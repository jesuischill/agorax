const socket = io();

let username = "";
let currentRoom = "Général";

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const app = $("app");
const usernameInput = $("username");
const enterBtn = $("enterBtn");

const profileName = $("profileName");
const avatar = $("avatar");
const createAvatar = $("createAvatar");

const pages = {
  home: $("homePage"),
  profile: $("profilePage"),
  chat: $("chatPage"),
  notifications: $("notificationsPage")
};

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "à l'instant";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(hours / 24);

  return `il y a ${days} j`;
}


/* =========================
   CONNEXION
   ========================= */

enterBtn.addEventListener("click", joinAgora);

usernameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    joinAgora();
  }
});

async function joinAgora() {
  const name = usernameInput.value.trim();

  if (!name) {
    usernameInput.focus();
    return;
  }

  username = name.slice(0, 30);

  localStorage.setItem("agorax_username", username);

  await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username })
  });

  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");

  profileName.textContent = username;

  const letter = username.charAt(0).toUpperCase();

  avatar.textContent = letter;
  createAvatar.textContent = letter;
  $("bigAvatar").textContent = letter;
  $("profileUsername").textContent = username;

  loadFeed();
  loadProfile();
  loadNotifications();

  socket.emit("join", {
    username,
    room: currentRoom
  });
}

const savedUsername = localStorage.getItem("agorax_username");

if (savedUsername) {
  usernameInput.value = savedUsername;
}


/* =========================
   NAVIGATION
   ========================= */

document.querySelectorAll(".nav-btn").forEach(button => {

  button.addEventListener("click", () => {

    const page = button.dataset.page;

    document.querySelectorAll(".nav-btn")
      .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");

    Object.values(pages)
      .forEach(element => element.classList.add("hidden"));

    pages[page].classList.remove("hidden");

    const titles = {
      home: ["Accueil", "Découvrez les publications de la communauté"],
      profile: ["Mon profil", "Votre espace personnel"],
      chat: ["Chat", "Discutez avec la communauté"],
      notifications: ["Notifications", "Votre activité récente"]
    };

    $("pageTitle").textContent = titles[page][0];
    $("pageSubtitle").textContent = titles[page][1];

    if (page === "profile") {
      loadProfile();
    }

    if (page === "notifications") {
      loadNotifications();
    }
  });

});


/* =========================
   PUBLICATIONS
   ========================= */

$("postContent").addEventListener("input", () => {
  $("charCount").textContent =
    $("postContent").value.length;
});

$("imageInput").addEventListener("change", () => {

  const file = $("imageInput").files[0];

  if (!file) {
    $("imagePreview").classList.add("hidden");
    $("imagePreview").innerHTML = "";
    return;
  }

  const url = URL.createObjectURL(file);

  $("imagePreview").innerHTML =
    `<img src="${url}" alt="Aperçu">`;

  $("imagePreview").classList.remove("hidden");
});

$("publishBtn").addEventListener("click", async () => {

  const content = $("postContent").value.trim();
  const file = $("imageInput").files[0];

  if (!content && !file) {
    alert("Écris quelque chose ou ajoute une image.");
    return;
  }

  const form = new FormData();

  form.append("username", username);
  form.append("content", content);

  if (file) {
    form.append("image", file);
  }

  $("publishBtn").disabled = true;
  $("publishBtn").textContent = "Publication...";

  try {

    const response = await fetch("/api/posts", {
      method: "POST",
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur");
    }

    $("postContent").value = "";
    $("imageInput").value = "";
    $("imagePreview").classList.add("hidden");
    $("imagePreview").innerHTML = "";
    $("charCount").textContent = "0";

    await loadFeed();

  } catch (error) {
    alert(error.message);
  }

  $("publishBtn").disabled = false;
  $("publishBtn").textContent = "Publier";
});


async function loadFeed() {

  const response = await fetch("/api/feed");
  const posts = await response.json();

  renderPosts(posts, $("feed"));
}


function renderPosts(posts, container) {

  container.innerHTML = "";

  if (!posts.length) {

    container.innerHTML = `
      <div class="empty">
        <h3>Bienvenue sur AgoraX 👋</h3>
        <p>Sois le premier à publier quelque chose.</p>
      </div>
    `;

    return;
  }

  posts.forEach(post => {
    container.appendChild(createPostElement(post));
  });
}


function createPostElement(post) {

  const article = document.createElement("article");

  article.className = "post";

  const liked =
    (post.likes || []).includes(username);

  const comments = post.comments || [];

  article.innerHTML = `
    <div class="post-head">

      <div class="avatar">
        ${escapeHTML(post.username.charAt(0).toUpperCase())}
      </div>

      <div>
        <strong>${escapeHTML(post.username)}</strong>
        <div class="post-time">
          ${timeAgo(post.createdAt)}
        </div>
      </div>

    </div>

    ${
      post.content
        ? `<div class="post-content">${escapeHTML(post.content)}</div>`
        : ""
    }

    ${
      post.image
        ? `<img class="post-image" src="${post.image}" alt="Image publiée">`
        : ""
    }

    <div class="post-actions">

      <button
        class="post-action ${liked ? "liked" : ""}"
        data-like="${post.id}"
      >
        ❤️ ${post.likes ? post.likes.length : 0}
      </button>

      <button
        class="post-action"
        data-focus-comment="${post.id}"
      >
        💬 ${comments.length}
      </button>

      ${
        post.username.toLowerCase() === username.toLowerCase()
          ? `
            <button
              class="post-action delete-action"
              data-delete="${post.id}"
              title="Supprimer cette publication"
            >
              🗑️ Supprimer
            </button>
          `
          : ""
      }

    </div>

    <div class="comments">

      ${comments.map(comment => `
        <div class="comment">
          <strong>${escapeHTML(comment.username)}</strong>
          ${escapeHTML(comment.content)}
        </div>
      `).join("")}

    </div>

    <form class="comment-box" data-comment-form="${post.id}">

      <input
        maxlength="500"
        placeholder="Écrire un commentaire..."
        autocomplete="off"
      >

      <button type="submit">
        Envoyer
      </button>

    </form>
  `;

  article.querySelector("[data-like]")
    .addEventListener("click", () => likePost(post.id));

  const deleteButton =
    article.querySelector("[data-delete]");

  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      deletePost(post.id);
    });
  }

  article.querySelector("[data-comment-form]")
    .addEventListener("submit", event => {

      event.preventDefault();

      const input = event.target.querySelector("input");

      addComment(post.id, input.value);

      input.value = "";
    });

  return article;
}


async function likePost(id) {

  await fetch(`/api/posts/${id}/like`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username
    })
  });

  loadFeed();
  loadProfile();
}


async function addComment(id, content) {

  content = content.trim();

  if (!content) return;

  await fetch(`/api/posts/${id}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      content
    })
  });

  loadFeed();
}


/* =========================
   SUPPRESSION PUBLICATION
   ========================= */

async function deletePost(id) {

  const confirmation = confirm(
    "Voulez-vous vraiment supprimer cette publication ?"
  );

  if (!confirmation) return;

  const response = await fetch(`/api/posts/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username
    })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Impossible de supprimer la publication.");
    return;
  }

  await loadFeed();
  await loadProfile();
}


/* =========================
   PROFIL
   ========================= */



async function loadProfile() {

  if (!username) return;

  const response =
    await fetch(`/api/profile/${encodeURIComponent(username)}`);

  if (!response.ok) return;

  const profile = await response.json();

  $("profileUsername").textContent =
    profile.displayName || profile.username;

  $("profileBio").textContent =
    profile.bio || "";

  $("profileStats").textContent =
    `${profile.posts.length} publication${profile.posts.length > 1 ? "s" : ""}`;

  // Localisation
  const location = $("profileLocation");

  if (profile.location) {
    location.textContent = "📍 " + profile.location;
    location.classList.remove("hidden");
  } else {
    location.textContent = "";
    location.classList.add("hidden");
  }

  // Lien
  const link = $("profileLink");

  if (profile.link) {
    let safeLink = profile.link;

    if (
      !safeLink.startsWith("http://") &&
      !safeLink.startsWith("https://")
    ) {
      safeLink = "https://" + safeLink;
    }

    link.href = safeLink;
    link.textContent = "🔗 " + profile.link;
    link.classList.remove("hidden");
  } else {
    link.href = "#";
    link.textContent = "";
    link.classList.add("hidden");
  }

  // Photo de profil
  const bigAvatar = $("bigAvatar");

  if (profile.avatarImage) {
    bigAvatar.innerHTML =
      `<img src="${profile.avatarImage}" alt="Photo de profil">`;
  } else {
    bigAvatar.textContent =
      profile.username.charAt(0).toUpperCase();
  }

  // Couverture
  const cover = $("profileCover");

  if (profile.coverImage) {
    cover.style.backgroundImage =
      `url("${profile.coverImage}")`;
    cover.classList.add("has-image");
  } else {
    cover.style.backgroundImage = "";
    cover.classList.remove("has-image");
  }

  renderPosts(profile.posts, $("profileFeed"));
}


/* =========================
   MODIFICATION DU PROFIL
   ========================= */

$("editProfileBtn").addEventListener("click", async () => {

  const response =
    await fetch(`/api/profile/${encodeURIComponent(username)}`);

  if (!response.ok) return;

  const profile = await response.json();

  $("displayNameInput").value =
    profile.displayName || profile.username;

  $("bioInput").value =
    profile.bio || "";

  $("linkInput").value =
    profile.link || "";

  $("locationInput").value =
    profile.location || "";

  $("bioCount").textContent =
    $("bioInput").value.length;

  const avatarPreview = $("avatarPreview");

  if (profile.avatarImage) {
    avatarPreview.innerHTML =
      `<img src="${profile.avatarImage}" alt="Avatar">`;
  } else {
    avatarPreview.textContent =
      profile.username.charAt(0).toUpperCase();
  }

  const coverPreview = $("coverPreview");

  if (profile.coverImage) {
    coverPreview.style.backgroundImage =
      `url("${profile.coverImage}")`;
  } else {
    coverPreview.style.backgroundImage = "";
  }

  $("editProfileCard").classList.remove("hidden");
});


$("closeEditProfile").addEventListener("click", () => {
  $("editProfileCard").classList.add("hidden");
});


$("cancelEditProfile").addEventListener("click", () => {
  $("editProfileCard").classList.add("hidden");
});


$("bioInput").addEventListener("input", () => {

  $("bioCount").textContent =
    $("bioInput").value.length;

});


$("avatarInput").addEventListener("change", () => {

  const file = $("avatarInput").files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  $("avatarPreview").innerHTML =
    `<img src="${url}" alt="Nouvelle photo">`;
});


$("coverInput").addEventListener("change", () => {

  const file = $("coverInput").files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  $("coverPreview").style.backgroundImage =
    `url("${url}")`;
});


$("profileForm").addEventListener("submit", async event => {

  event.preventDefault();

  const form = new FormData();

  form.append("username", username);
  form.append(
    "displayName",
    $("displayNameInput").value
  );
  form.append(
    "bio",
    $("bioInput").value
  );
  form.append(
    "link",
    $("linkInput").value
  );
  form.append(
    "location",
    $("locationInput").value
  );

  const avatarFile =
    $("avatarInput").files[0];

  const coverFile =
    $("coverInput").files[0];

  if (avatarFile) {
    form.append("avatar", avatarFile);
  }

  if (coverFile) {
    form.append("cover", coverFile);
  }

  $("saveProfileBtn").disabled = true;
  $("saveProfileBtn").textContent =
    "Enregistrement...";

  try {

    const response =
      await fetch("/api/profile/update", {
        method: "POST",
        body: form
      });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Impossible de modifier le profil."
      );
    }

    $("editProfileCard")
      .classList.add("hidden");

    await loadProfile();

    if (data.displayName) {
      $("profileName").textContent =
        data.displayName;
    }

  } catch (error) {

    alert(error.message);

  }

  $("saveProfileBtn").disabled = false;
  $("saveProfileBtn").textContent =
    "💾 Enregistrer";
});


/* =========================
   NOTIFICATIONS
   ========================= */

async function loadNotifications() {

  if (!username) return;

  const response =
    await fetch(`/api/notifications/${encodeURIComponent(username)}`);

  const notifications = await response.json();

  const container = $("notifications");

  if (!notifications.length) {

    container.innerHTML = `
      <div class="empty">
        Aucune notification pour le moment.
      </div>
    `;

    $("notificationCount").classList.add("hidden");

    return;
  }

  const unread = notifications.filter(n => !n.read).length;

  $("notificationCount").textContent = unread;
  $("notificationCount").classList.toggle(
    "hidden",
    unread === 0
  );

  container.innerHTML = notifications.map(n => `
    <div class="notification">
      ${escapeHTML(n.text)}
      <small>${timeAgo(n.createdAt)}</small>
    </div>
  `).join("");
}


/* =========================
   RECHERCHE
   ========================= */

$("searchInput").addEventListener("keydown", async event => {

  if (event.key !== "Enter") return;

  const q = event.target.value.trim();

  if (!q) {
    loadFeed();
    return;
  }

  const response =
    await fetch(`/api/search?q=${encodeURIComponent(q)}`);

  const results = await response.json();

  renderPosts(results, $("feed"));

  Object.values(pages)
    .forEach(page => page.classList.add("hidden"));

  pages.home.classList.remove("hidden");

  $("pageTitle").textContent = "Recherche";
  $("pageSubtitle").textContent =
    `${results.length} résultat(s) pour « ${q} »`;
});


/* =========================
   CHAT
   ========================= */

document.querySelectorAll(".room").forEach(button => {

  button.addEventListener("click", () => {

    const room = button.dataset.room;

    if (room === currentRoom) return;

    currentRoom = room;

    document.querySelectorAll(".room")
      .forEach(r => r.classList.remove("active"));

    button.classList.add("active");

    $("messages").innerHTML = "";

    $("roomName").textContent = room;

    socket.emit("changeRoom", room);

  });

});


$("messageForm").addEventListener("submit", event => {

  event.preventDefault();

  const input = $("messageInput");

  const text = input.value.trim();

  if (!text) return;

  socket.emit("message", text);

  input.value = "";
  input.focus();

});


socket.on("message", data => {

  const article = document.createElement("article");

  article.className = "message";

  article.innerHTML = `
    <div class="message-avatar">
      ${escapeHTML(data.username.charAt(0).toUpperCase())}
    </div>

    <div>

      <div class="message-head">
        <strong>${escapeHTML(data.username)}</strong>
        <span class="message-time">
          ${escapeHTML(data.time)}
        </span>
      </div>

      <div class="message-text">
        ${escapeHTML(data.message)}
      </div>

    </div>
  `;

  $("messages").appendChild(article);

  $("messages").scrollTop =
    $("messages").scrollHeight;

});


socket.on("system", text => {

  const div = document.createElement("div");

  div.className = "system";

  div.textContent = text;

  $("messages").appendChild(div);

});


socket.on("online", count => {
  $("online").textContent = count;
});


/* =========================
   EMOJIS
   ========================= */

$("emojiBtn").addEventListener("click", event => {

  event.stopPropagation();

  $("emojiPicker")
    .classList.toggle("hidden");

});


$("emojiPicker")
  .querySelectorAll("button")
  .forEach(button => {

    button.addEventListener("click", () => {

      $("messageInput").value +=
        button.textContent;

      $("messageInput").focus();

    });

  });


document.addEventListener("click", event => {

  if (
    !$("emojiPicker").contains(event.target) &&
    event.target !== $("emojiBtn")
  ) {
    $("emojiPicker").classList.add("hidden");
  }

});


/* =========================
   TEMPS RÉEL
   ========================= */

socket.on("newPost", post => {

  if (!document.querySelector("#homePage").classList.contains("hidden")) {
    loadFeed();
  }

});

socket.on("postUpdated", () => {
  loadFeed();
});

socket.on("newComment", () => {
  loadFeed();
  loadProfile();
  loadNotifications();
});


socket.on("postDeleted", id => {
  loadFeed();
  loadProfile();
});


socket.on("profileUpdated", data => {
  if (
    username &&
    data.username.toLowerCase() === username.toLowerCase()
  ) {
    loadProfile();
  }
});
