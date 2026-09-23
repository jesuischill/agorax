(() => {
  "use strict";

  let currentUser = null;
  let posts = [];
  let stories = [];
  let socket = null;
  let currentConversation = null;
  let conversations = [];

  const $ = id => document.getElementById(id);

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options
    });

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(
        data.error || "Une erreur est survenue."
      );
    }

    return data;
  }

  function toast(message) {
    const box = $("toast");
    box.textContent = message;
    box.style.display = "block";

    setTimeout(() => {
      box.style.display = "none";
    }, 2500);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function avatar(user) {
    return user?.avatar ||
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100" height="100" rx="50" fill="#242c3d"/>
        <text x="50" y="58" text-anchor="middle"
          font-size="40" fill="white">
          ${(user?.username || "?")[0].toUpperCase()}
        </text>
      </svg>
    `);
  }

  async function init() {
    try {
      const me = await api("/api/auth/me");
      currentUser = me.user;

      renderUser();
      bindUI();

      await Promise.all([
        loadFeed(),
        loadStories(),
        loadNotifications(),
        loadConversations()
      ]);

      connectSocket();
    } catch {
      window.location.replace("/login.html");
    }
  }

  function renderUser() {
    const img = avatar(currentUser);

    $("sideAvatar").src = img;
    $("composerAvatar").src = img;
    $("profileAvatar").src = img;

    $("sideUsername").textContent =
      currentUser.username;

    $("profileUsername").textContent =
      "@" + currentUser.username;

    $("profileBio").textContent =
      currentUser.bio ||
      "Bienvenue sur Agorex.";

    $("bioInput").value =
      currentUser.bio || "";
  }

  function bindUI() {
    $("logoutBtn").onclick = async () => {
      await api("/api/auth/logout", {
        method: "POST"
      });

      window.location.replace("/login.html");
    };

    $("publishBtn").onclick =
      publishPost;

    $("createStoryBtn").onclick =
      () => $("storyModal").classList.remove("hidden");

    $("publishStoryBtn").onclick =
      publishStory;

    $("editProfileBtn").onclick =
      () => $("profileModal").classList.remove("hidden");

    $("saveProfileBtn").onclick =
      saveProfile;

    $("notificationBtn").onclick =
      () => {
        $("notificationsPanel")
          .classList.toggle("hidden");
      };

    $("messagesBtn").onclick =
      openMessages;

    $("profileBtn").onclick =
      () => $("profileModal").classList.remove("hidden");

    document.querySelectorAll(
      "[data-close]"
    ).forEach(button => {
      button.onclick = () => {
        $(button.dataset.close)
          .classList.add("hidden");
      };
    });

    $("closeStoryViewer").onclick =
      () => $("storyViewer")
        .classList.add("hidden");

    $("postImage").onchange = () => {
      const file =
        $("postImage").files[0];

      $("imagePreview").textContent =
        file ? "🖼️ " + file.name : "";
    };

    document.querySelectorAll(
      ".feed-tab"
    ).forEach(button => {
      button.onclick = () => {
        document.querySelectorAll(
          ".feed-tab"
        ).forEach(x =>
          x.classList.remove("active")
        );

        button.classList.add("active");

        renderFeed(
          button.dataset.sort
        );
      };
    });

    document.querySelectorAll(
      ".nav"
    ).forEach(button => {
      button.onclick = () => {
        document.querySelectorAll(
          ".nav"
        ).forEach(x =>
          x.classList.remove("active")
        );

        button.classList.add("active");

        const page =
          button.dataset.page;

        if (page === "messages") {
          openMessages();
        }

        if (page === "notifications") {
          $("notificationsPanel")
            .classList.remove("hidden");
        }

        if (page === "profile") {
          $("profileModal")
            .classList.remove("hidden");
        }

        if (page === "home") {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
      };
    });

    $("searchInput").oninput =
      searchUsers;

    $("privateForm").onsubmit =
      sendPrivateMessage;

    $("publicChatToggle").onclick =
      () => $("publicChat")
        .classList.toggle("hidden");

    $("closePublicChat").onclick =
      () => $("publicChat")
        .classList.add("hidden");

    $("publicChatForm").onsubmit =
      sendPublicMessage;

    $("publicRoom").onchange =
      () => {
        if (socket) {
          socket.emit(
            "joinPublic",
            $("publicRoom").value
          );
        }
      };
  }

  async function loadFeed() {
    try {
      posts = await api("/api/feed");
      renderFeed("recent");
    } catch (error) {
      toast(error.message);
    }
  }

  function renderFeed(sort = "recent") {
    let list = [...posts];

    if (sort === "popular") {
      list.sort(
        (a, b) =>
          (b.likes || 0) -
          (a.likes || 0)
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );
    }

    $("feed").innerHTML =
      list.map(renderPost).join("");

    bindPostActions();
  }

  function renderPost(post) {
    const comments =
      post.comments || [];

    return `
      <article class="post">
        <div class="post-head">
          <div>
            <div class="post-author">
              @${escapeHTML(post.author)}
            </div>
            <div class="post-date">
              ${new Date(post.createdAt).toLocaleString("fr-FR")}
            </div>
          </div>

          ${
            post.author === currentUser.username
              ? `
                <button
                  class="delete-post"
                  data-id="${post.id}">
                  🗑️
                </button>
              `
              : ""
          }
        </div>

        ${
          post.text
            ? `<div class="post-text">
                ${escapeHTML(post.text)}
              </div>`
            : ""
        }

        ${
          post.image
            ? `<img class="post-image"
                src="${post.image}">
              `
            : ""
        }

        <div class="post-actions">
          <button
            class="like-post"
            data-id="${post.id}">
            ${post.likedByMe ? "❤️" : "🤍"}
            ${post.likes || 0}
          </button>

          <button
            class="comment-focus"
            data-id="${post.id}">
            💭 ${comments.length}
          </button>
        </div>

        <div class="comments">
          ${comments.map(c => `
            <div class="comment">
              <strong>@${escapeHTML(c.author)}</strong>
              ${escapeHTML(c.text)}
            </div>
          `).join("")}

          <form
            class="comment-form"
            data-id="${post.id}">
            <input
              name="text"
              maxlength="1000"
              placeholder="Écrire un commentaire...">
            <button class="primary">
              Envoyer
            </button>
          </form>
        </div>
      </article>
    `;
  }

  function bindPostActions() {
    document.querySelectorAll(
      ".like-post"
    ).forEach(button => {
      button.onclick = async () => {
        try {
          await api(
            "/api/posts/" +
            button.dataset.id +
            "/like",
            {
              method: "POST"
            }
          );

          await loadFeed();
        } catch (error) {
          toast(error.message);
        }
      };
    });

    document.querySelectorAll(
      ".delete-post"
    ).forEach(button => {
      button.onclick = async () => {
        if (!confirm("Supprimer cette publication ?")) {
          return;
        }

        await api(
          "/api/posts/" +
          button.dataset.id,
          {
            method: "DELETE"
          }
        );

        await loadFeed();
      };
    });

    document.querySelectorAll(
      ".comment-form"
    ).forEach(form => {
      form.onsubmit = async event => {
        event.preventDefault();

        const input =
          form.querySelector("input");

        const text =
          input.value.trim();

        if (!text) return;

        await api(
          "/api/posts/" +
          form.dataset.id +
          "/comments",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({ text })
          }
        );

        input.value = "";
        await loadFeed();
      };
    });
  }

  async function publishPost() {
    const text =
      $("postText").value.trim();

    const file =
      $("postImage").files[0];

    if (!text && !file) {
      toast("Écris quelque chose ou ajoute une image.");
      return;
    }

    const form = new FormData();

    form.append("text", text);

    if (file) {
      form.append("image", file);
    }

    try {
      await api("/api/posts", {
        method: "POST",
        body: form
      });

      $("postText").value = "";
      $("postImage").value = "";
      $("imagePreview").textContent = "";

      await loadFeed();

      toast("Publication créée !");
    } catch (error) {
      toast(error.message);
    }
  }

  async function loadStories() {
    try {
      stories = await api("/api/stories");

      $("stories").innerHTML =
        stories.map(group => {
          const last =
            group.stories[
              group.stories.length - 1
            ];

          return `
            <div
              class="story-card"
              data-story="${last.id}">
              ${
                last.image
                  ? `<img src="${last.image}">`
                  : ""
              }
              <span>
                @${escapeHTML(group.username)}
              </span>
            </div>
          `;
        }).join("");

      document.querySelectorAll(
        ".story-card"
      ).forEach(card => {
        card.onclick = () =>
          openStory(card.dataset.story);
      });
    } catch {}
  }

  async function publishStory() {
    const text =
      $("storyText").value.trim();

    const file =
      $("storyImage").files[0];

    if (!text && !file) {
      toast("Ta story est vide.");
      return;
    }

    const form = new FormData();

    form.append("text", text);

    if (file) {
      form.append("image", file);
    }

    try {
      await api("/api/stories", {
        method: "POST",
        body: form
      });

      $("storyText").value = "";
      $("storyImage").value = "";

      $("storyModal")
        .classList.add("hidden");

      await loadStories();

      toast("Story publiée pour 24 h !");
    } catch (error) {
      toast(error.message);
    }
  }

  async function openStory(storyId) {
    for (const group of stories) {
      const story =
        group.stories.find(
          s => s.id === storyId
        );

      if (!story) continue;

      $("storyViewerImage").src =
        story.image || "";

      $("storyViewerImage").style.display =
        story.image ? "block" : "none";

      $("storyViewerText").textContent =
        story.text || "";

      $("storyViewer")
        .classList.remove("hidden");

      await api(
        "/api/stories/" +
        story.id +
        "/view",
        {
          method: "POST"
        }
      );

      return;
    }
  }

  async function saveProfile() {
    const form = new FormData();

    form.append(
      "bio",
      $("bioInput").value
    );

    const avatarFile =
      $("avatarInput").files[0];

    const bannerFile =
      $("bannerInput").files[0];

    if (avatarFile) {
      form.append(
        "avatar",
        avatarFile
      );
    }

    if (bannerFile) {
      form.append(
        "banner",
        bannerFile
      );
    }

    try {
      const result =
        await api(
          "/api/profile/update",
          {
            method: "POST",
            body: form
          }
        );

      currentUser =
        result.user;

      renderUser();

      $("profileModal")
        .classList.add("hidden");

      toast("Profil mis à jour !");
    } catch (error) {
      toast(error.message);
    }
  }

  async function loadNotifications() {
    try {
      const list =
        await api(
          "/api/notifications/" +
          encodeURIComponent(
            currentUser.username
          )
        );

      $("notifications").innerHTML =
        list.length
          ? list.map(n => `
            <div class="notification">
              <strong>@${escapeHTML(n.from || "Agorex")}</strong>
              ${
                n.type === "like"
                  ? " a aimé ta publication ❤️"
                  : n.type === "comment"
                  ? " a commenté ta publication 💭"
                  : n.type === "message"
                  ? " t'a envoyé un message 💬"
                  : " a interagi avec toi."
              }
            </div>
          `).join("")
          : `<p class="muted">
              Aucune notification.
            </p>`;
    } catch {}
  }

  async function searchUsers() {
    const q =
      $("searchInput").value.trim();

    if (q.length < 2) {
      $("searchResults")
        .classList.remove("open");

      return;
    }

    try {
      const result =
        await api(
          "/api/search?q=" +
          encodeURIComponent(q)
        );

      $("searchResults").innerHTML =
        result.map(user => `
          <div
            class="search-result"
            data-username="${escapeHTML(user.username)}">
            <img
              src="${avatar(user)}"
              width="35"
              height="35"
              style="border-radius:50%;object-fit:cover">
            <strong>
              @${escapeHTML(user.username)}
            </strong>
          </div>
        `).join("");

      $("searchResults")
        .classList.add("open");

      document.querySelectorAll(
        ".search-result"
      ).forEach(item => {
        item.onclick = () => {
          openConversation(
            item.dataset.username
          );

          $("searchResults")
            .classList.remove("open");

          $("searchInput").value = "";
        };
      });
    } catch {}
  }

  async function loadConversations() {
    try {
      conversations =
        await api("/api/conversations");

      renderConversations();
    } catch {}
  }

  function renderConversations() {
    $("conversationList").innerHTML =
      conversations.map(c => `
        <div
          class="conversation-item"
          data-username="${escapeHTML(c.user.username)}">
          <strong>
            @${escapeHTML(c.user.username)}
          </strong>
          <div class="muted">
            ${escapeHTML(
              c.lastMessage.message
            )}
          </div>
        </div>
      `).join("");

    document.querySelectorAll(
      ".conversation-item"
    ).forEach(item => {
      item.onclick = () =>
        openConversation(
          item.dataset.username
        );
    });
  }

  async function openMessages() {
    $("messagesPanel")
      .classList.remove("hidden");

    await loadConversations();
  }

  async function openConversation(username) {
    $("messagesPanel")
      .classList.remove("hidden");

    currentConversation =
      username;

    $("conversationHeader")
      .textContent =
      "@" + username;

    try {
      const messages =
        await api(
          "/api/messages/" +
          encodeURIComponent(username)
        );

      renderPrivateMessages(messages);
    } catch (error) {
      toast(error.message);
    }
  }

  function renderPrivateMessages(messages) {
    $("privateMessages").innerHTML =
      messages.map(m => `
        <div class="private-message ${
          m.from === currentUser.username
            ? "mine"
            : ""
        }">
          ${escapeHTML(m.message)}
          <div class="post-date">
            ${new Date(
              m.createdAt
            ).toLocaleTimeString(
              "fr-FR",
              {
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
          </div>
        </div>
      `).join("");

    $("privateMessages")
      .scrollTop =
      $("privateMessages").scrollHeight;
  }

  function sendPrivateMessage(event) {
    event.preventDefault();

    if (!socket ||
        !currentConversation) {
      toast("Choisis une discussion.");
      return;
    }

    const input =
      $("privateInput");

    const message =
      input.value.trim();

    if (!message) return;

    socket.emit(
      "privateMessage",
      {
        to: currentConversation,
        message
      }
    );

    input.value = "";
  }

  function sendPublicMessage(event) {
    event.preventDefault();

    if (!socket) return;

    const input =
      $("publicChatInput");

    const message =
      input.value.trim();

    if (!message) return;

    socket.emit(
      "publicMessage",
      message
    );

    input.value = "";
  }

  function addPublicMessage(message) {
    const box =
      $("publicMessages");

    const element =
      document.createElement("div");

    element.className =
      "public-message";

    element.innerHTML = `
      <strong>
        @${escapeHTML(message.from)}
      </strong>
      <br>
      ${escapeHTML(message.message)}
    `;

    box.appendChild(element);
    box.scrollTop =
      box.scrollHeight;
  }

  function connectSocket() {
    if (typeof io !== "function") {
      toast("Socket.IO n'est pas chargé.");
      return;
    }

    socket = io({
      transports: [
        "websocket",
        "polling"
      ]
    });

    socket.on("connect", () => {
      socket.emit(
        "joinPublic",
        $("publicRoom").value
      );
    });

    socket.on(
      "publicMessage",
      addPublicMessage
    );

    socket.on(
      "privateMessage",
      async message => {
        if (
          currentConversation &&
          (
            message.from ===
              currentConversation ||
            message.to ===
              currentConversation
          )
        ) {
          const messages =
            await api(
              "/api/messages/" +
              encodeURIComponent(
                currentConversation
              )
            );

          renderPrivateMessages(
            messages
          );
        }

        await loadConversations();
        await loadNotifications();
      }
    );

    socket.on(
      "presence",
      data => {
        console.log(
          data.username,
          data.online
            ? "en ligne"
            : "hors ligne"
        );
      }
    );

    socket.on(
      "typing",
      data => {
        if (
          data.from ===
          currentConversation
        ) {
          $("typingIndicator")
            .textContent =
            data.typing
              ? `@${data.from} écrit...`
              : "";
        }
      }
    );
  }

  init();

})();
