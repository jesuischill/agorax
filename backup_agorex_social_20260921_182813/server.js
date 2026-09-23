const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SOCIAL_FILE = path.join(DATA_DIR, "social.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function users() {
  return readJSON(USERS_FILE, []);
}

function saveUsers(data) {
  writeJSON(USERS_FILE, data);
}

function social() {
  const data = readJSON(SOCIAL_FILE, {});

  for (const key of [
    "posts",
    "comments",
    "stories",
    "messages",
    "notifications"
  ]) {
    if (!Array.isArray(data[key])) data[key] = [];
  }

  return data;
}

function saveSocial(data) {
  writeJSON(SOCIAL_FILE, data);
}

function id() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 8);
}

function cleanUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    age: user.age,
    bio: user.bio || "",
    avatar: user.avatar || "",
    banner: user.banner || "",
    createdAt: user.createdAt
  };
}

function findUser(username) {
  return users().find(
    u => String(u.username).toLowerCase() === String(username).toLowerCase()
  );
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "AUTH_REQUIRED"
    });
  }

  const user = users().find(u => u.id === req.session.userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({
      error: "SESSION_INVALID"
    });
  }

  req.currentUser = user;
  next();
}

const sessionMiddleware = session({
  secret:
    process.env.AGOREX_SESSION_SECRET ||
    "agorex-super-session-secret-change-this",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(
      null,
      Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 10) +
        ext
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Images uniquement"));
    }
    cb(null, true);
  }
});

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

function addNotification(username, notification) {
  const data = social();

  data.notifications.push({
    id: id(),
    username,
    createdAt: new Date().toISOString(),
    read: false,
    ...notification
  });

  data.notifications = data.notifications.slice(-5000);
  saveSocial(data);
}

function publicPost(post, currentUsername) {
  const data = social();

  const comments = data.comments
    .filter(c => c.postId === post.id)
    .sort(
      (a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
    );

  return {
    ...post,
    likes: Array.isArray(post.likes) ? post.likes.length : 0,
    likedByMe:
      Array.isArray(post.likes) &&
      post.likes.includes(currentUsername),
    comments
  };
}

/* ==========================================
   AUTH
========================================== */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      age,
      privacyAccepted
    } = req.body;

    const cleanUsername = String(username || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const numericAge = Number(age);

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({
        error: "Tous les champs sont obligatoires."
      });
    }

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(cleanUsername)) {
      return res.status(400).json({
        error: "Pseudo invalide."
      });
    }

    if (!cleanEmail.includes("@")) {
      return res.status(400).json({
        error: "Email invalide."
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        error: "Le mot de passe doit contenir au moins 6 caractères."
      });
    }

    if (!Number.isInteger(numericAge) || numericAge < 13) {
      return res.status(400).json({
        error: "Âge invalide."
      });
    }

    if (!privacyAccepted) {
      return res.status(400).json({
        error: "Les règles de confidentialité doivent être acceptées."
      });
    }

    const list = users();

    if (
      list.some(
        u =>
          u.username.toLowerCase() === cleanUsername.toLowerCase()
      )
    ) {
      return res.status(409).json({
        error: "Ce pseudo existe déjà."
      });
    }

    if (list.some(u => u.email === cleanEmail)) {
      return res.status(409).json({
        error: "Cet email est déjà utilisé."
      });
    }

    const user = {
      id: id(),
      username: cleanUsername,
      email: cleanEmail,
      age: numericAge,
      passwordHash: await bcrypt.hash(password, 12),
      privacyAccepted: true,
      bio: "",
      avatar: "",
      banner: "",
      createdAt: new Date().toISOString()
    };

    list.push(user);
    saveUsers(list);

    req.session.userId = user.id;

    req.session.save(() => {
      res.json({
        ok: true,
        user: cleanUser(user)
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erreur pendant l'inscription."
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identity = String(
      req.body.identity || req.body.username || req.body.email || ""
    ).trim();

    const password = String(req.body.password || "");

    const user = users().find(
      u =>
        u.username.toLowerCase() === identity.toLowerCase() ||
        u.email.toLowerCase() === identity.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        error: "Identifiants incorrects."
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Identifiants incorrects."
      });
    }

    req.session.userId = user.id;

    req.session.save(() => {
      res.json({
        ok: true,
        user: cleanUser(user)
      });
    });
  } catch (error) {
    res.status(500).json({
      error: "Erreur de connexion."
    });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      authenticated: false
    });
  }

  const user = users().find(
    u => u.id === req.session.userId
  );

  if (!user) {
    return res.status(401).json({
      authenticated: false
    });
  }

  res.json({
    authenticated: true,
    user: cleanUser(user)
  });
});

/* ==========================================
   SEARCH
========================================== */

app.get("/api/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();

  if (!q) {
    return res.json([]);
  }

  const result = users()
    .filter(u =>
      u.username.toLowerCase().includes(q)
    )
    .slice(0, 30)
    .map(cleanUser);

  res.json(result);
});

/* ==========================================
   PROFILE
========================================== */

app.get("/api/profile/:username", requireAuth, (req, res) => {
  const user = findUser(req.params.username);

  if (!user) {
    return res.status(404).json({
      error: "Utilisateur introuvable."
    });
  }

  const data = social();

  const posts = data.posts
    .filter(p => p.author === user.username)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .map(p => publicPost(p, req.currentUser.username));

  res.json({
    user: cleanUser(user),
    posts
  });
});

app.post(
  "/api/profile/update",
  requireAuth,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 }
  ]),
  (req, res) => {
    const list = users();
    const user = list.find(
      u => u.id === req.currentUser.id
    );

    if (!user) {
      return res.status(404).json({
        error: "Utilisateur introuvable."
      });
    }

    if (req.body.bio !== undefined) {
      user.bio = String(req.body.bio).slice(0, 300);
    }

    if (req.files?.avatar?.[0]) {
      user.avatar =
        "/uploads/" +
        req.files.avatar[0].filename;
    }

    if (req.files?.banner?.[0]) {
      user.banner =
        "/uploads/" +
        req.files.banner[0].filename;
    }

    saveUsers(list);

    res.json({
      ok: true,
      user: cleanUser(user)
    });
  }
);

/* ==========================================
   FEED
========================================== */

app.get("/api/feed", requireAuth, (req, res) => {
  const data = social();

  data.posts = data.posts.filter(
    p => !p.deleted
  );

  const posts = data.posts
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .map(p =>
      publicPost(
        p,
        req.currentUser.username
      )
    );

  res.json(posts);
});

app.post(
  "/api/posts",
  requireAuth,
  upload.single("image"),
  (req, res) => {
    const text = String(
      req.body.text || ""
    ).trim();

    const image = req.file
      ? "/uploads/" + req.file.filename
      : "";

    if (!text && !image) {
      return res.status(400).json({
        error: "Publication vide."
      });
    }

    const data = social();

    const post = {
      id: id(),
      author: req.currentUser.username,
      text: text.slice(0, 5000),
      image,
      likes: [],
      createdAt: new Date().toISOString()
    };

    data.posts.push(post);
    saveSocial(data);

    res.json({
      ok: true,
      post: publicPost(
        post,
        req.currentUser.username
      )
    });
  }
);

app.delete(
  "/api/posts/:id",
  requireAuth,
  (req, res) => {
    const data = social();

    const post = data.posts.find(
      p => p.id === req.params.id
    );

    if (!post) {
      return res.status(404).json({
        error: "Publication introuvable."
      });
    }

    if (
      post.author !==
      req.currentUser.username
    ) {
      return res.status(403).json({
        error: "Tu ne peux supprimer que tes publications."
      });
    }

    data.posts = data.posts.filter(
      p => p.id !== req.params.id
    );

    data.comments = data.comments.filter(
      c => c.postId !== req.params.id
    );

    saveSocial(data);

    res.json({ ok: true });
  }
);

app.post(
  "/api/posts/:id/like",
  requireAuth,
  (req, res) => {
    const data = social();

    const post = data.posts.find(
      p => p.id === req.params.id
    );

    if (!post) {
      return res.status(404).json({
        error: "Publication introuvable."
      });
    }

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    const index = post.likes.indexOf(
      req.currentUser.username
    );

    if (index >= 0) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(
        req.currentUser.username
      );

      if (
        post.author !==
        req.currentUser.username
      ) {
        addNotification(post.author, {
          type: "like",
          from: req.currentUser.username,
          postId: post.id
        });
      }
    }

    saveSocial(data);

    res.json({
      ok: true,
      likes: post.likes.length,
      liked: index < 0
    });
  }
);

app.post(
  "/api/posts/:id/comments",
  requireAuth,
  (req, res) => {
    const text = String(
      req.body.text || ""
    ).trim();

    if (!text) {
      return res.status(400).json({
        error: "Commentaire vide."
      });
    }

    const data = social();

    const post = data.posts.find(
      p => p.id === req.params.id
    );

    if (!post) {
      return res.status(404).json({
        error: "Publication introuvable."
      });
    }

    const comment = {
      id: id(),
      postId: post.id,
      author: req.currentUser.username,
      text: text.slice(0, 1000),
      createdAt: new Date().toISOString()
    };

    data.comments.push(comment);
    saveSocial(data);

    if (
      post.author !==
      req.currentUser.username
    ) {
      addNotification(post.author, {
        type: "comment",
        from: req.currentUser.username,
        postId: post.id
      });
    }

    res.json({
      ok: true,
      comment
    });
  }
);

/* ==========================================
   STORIES
========================================== */

app.get("/api/stories", requireAuth, (req, res) => {
  const data = social();
  const now = Date.now();

  data.stories = data.stories.filter(
    story =>
      new Date(story.expiresAt).getTime() >
      now
  );

  saveSocial(data);

  const grouped = {};

  for (const story of data.stories) {
    if (!grouped[story.author]) {
      grouped[story.author] = [];
    }

    grouped[story.author].push(story);
  }

  res.json(
    Object.entries(grouped).map(
      ([username, stories]) => ({
        username,
        user: cleanUser(
          findUser(username)
        ),
        stories
      })
    )
  );
});

app.post(
  "/api/stories",
  requireAuth,
  upload.single("image"),
  (req, res) => {
    const text = String(
      req.body.text || ""
    ).trim();

    const image = req.file
      ? "/uploads/" + req.file.filename
      : "";

    if (!text && !image) {
      return res.status(400).json({
        error: "Story vide."
      });
    }

    const now = Date.now();

    const story = {
      id: id(),
      author: req.currentUser.username,
      text: text.slice(0, 1000),
      image,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(
        now + 24 * 60 * 60 * 1000
      ).toISOString(),
      views: []
    };

    const data = social();

    data.stories = data.stories.filter(
      s =>
        new Date(s.expiresAt).getTime() >
        now
    );

    data.stories.push(story);
    saveSocial(data);

    res.json({
      ok: true,
      story
    });
  }
);

app.post(
  "/api/stories/:id/view",
  requireAuth,
  (req, res) => {
    const data = social();

    const story = data.stories.find(
      s => s.id === req.params.id
    );

    if (!story) {
      return res.status(404).json({
        error: "Story introuvable."
      });
    }

    if (!Array.isArray(story.views)) {
      story.views = [];
    }

    if (
      !story.views.includes(
        req.currentUser.username
      )
    ) {
      story.views.push(
        req.currentUser.username
      );
    }

    saveSocial(data);

    res.json({
      ok: true
    });
  }
);

/* ==========================================
   NOTIFICATIONS
========================================== */

app.get(
  "/api/notifications/:username",
  requireAuth,
  (req, res) => {
    if (
      req.params.username !==
      req.currentUser.username
    ) {
      return res.status(403).json({
        error: "Accès refusé."
      });
    }

    const data = social();

    res.json(
      data.notifications
        .filter(
          n =>
            n.username ===
            req.currentUser.username
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
        .slice(0, 100)
    );
  }
);

/* ==========================================
   PRIVATE MESSAGES
========================================== */

function conversationKey(a, b) {
  return [a, b]
    .sort((x, y) =>
      x.localeCompare(y)
    )
    .join("::");
}

app.get(
  "/api/messages/:username",
  requireAuth,
  (req, res) => {
    const target = findUser(
      req.params.username
    );

    if (!target) {
      return res.status(404).json({
        error: "Utilisateur introuvable."
      });
    }

    const data = social();

    const key = conversationKey(
      req.currentUser.username,
      target.username
    );

    const messages = data.messages
      .filter(m => m.conversation === key)
      .slice(-200);

    res.json(messages);
  }
);

app.get(
  "/api/conversations",
  requireAuth,
  (req, res) => {
    const data = social();
    const me = req.currentUser.username;

    const conversations = {};

    for (const message of data.messages) {
      if (
        message.from !== me &&
        message.to !== me
      ) {
        continue;
      }

      const other =
        message.from === me
          ? message.to
          : message.from;

      conversations[other] = message;
    }

    const result = Object.entries(
      conversations
    )
      .map(([username, lastMessage]) => ({
        user: cleanUser(
          findUser(username)
        ),
        lastMessage
      }))
      .filter(x => x.user);

    res.json(result);
  }
);

/* ==========================================
   SOCKET.IO
========================================== */

io.engine.use(sessionMiddleware);

const onlineUsers = new Map();

io.on("connection", socket => {
  const session = socket.request.session;

  const user = session?.userId
    ? users().find(
        u => u.id === session.userId
      )
    : null;

  if (!user) {
    socket.disconnect(true);
    return;
  }

  const username = user.username;

  onlineUsers.set(username, socket.id);

  socket.join("public:general");

  socket.emit("ready", {
    username
  });

  io.emit("presence", {
    username,
    online: true
  });

  socket.on("joinPublic", room => {
    const cleanRoom = String(
      room || "general"
    ).replace(/[^a-zA-Z0-9_-]/g, "");

    for (const roomName of [
      "general",
      "gaming",
      "musique",
      "entraide"
    ]) {
      socket.leave(
        "public:" + roomName
      );
    }

    socket.join(
      "public:" + cleanRoom
    );

    socket.emit("roomJoined", cleanRoom);
  });

  socket.on("publicMessage", text => {
    const message = String(
      text || ""
    ).trim();

    if (!message) return;

    const rooms = Array.from(
      socket.rooms
    ).filter(r =>
      r.startsWith("public:")
    );

    const room =
      rooms[0] || "public:general";

    const payload = {
      id: id(),
      from: username,
      message: message.slice(0, 1000),
      createdAt: new Date().toISOString()
    };

    io.to(room).emit(
      "publicMessage",
      payload
    );
  });

  socket.on(
    "privateMessage",
    ({ to, message }) => {
      const target = findUser(to);

      const text = String(
        message || ""
      ).trim();

      if (!target || !text) return;

      const payload = {
        id: id(),
        from: username,
        to: target.username,
        message: text.slice(0, 2000),
        createdAt: new Date().toISOString(),
        conversation: conversationKey(
          username,
          target.username
        )
      };

      const data = social();
      data.messages.push(payload);
      data.messages =
        data.messages.slice(-10000);
      saveSocial(data);

      const targetSocket =
        onlineUsers.get(
          target.username
        );

      if (targetSocket) {
        io.to(targetSocket).emit(
          "privateMessage",
          payload
        );
      }

      socket.emit(
        "privateMessage",
        payload
      );

      addNotification(
        target.username,
        {
          type: "message",
          from: username
        }
      );
    }
  );

  socket.on(
    "typing",
    ({ to, typing }) => {
      const targetSocket =
        onlineUsers.get(to);

      if (targetSocket) {
        io.to(targetSocket).emit(
          "typing",
          {
            from: username,
            typing: !!typing
          }
        );
      }
    }
  );

  socket.on("disconnect", () => {
    if (
      onlineUsers.get(username) ===
      socket.id
    ) {
      onlineUsers.delete(username);
    }

    io.emit("presence", {
      username,
      online: false
    });
  });
});

/* ==========================================
   ERROR HANDLING
========================================== */

app.use((err, req, res, next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: "Fichier trop volumineux."
    });
  }

  res.status(500).json({
    error: err.message || "Erreur serveur."
  });
});

/* ==========================================
   START
========================================== */

server.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║              AGOREX 3.0                 ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║ 🌐 http://localhost:" + PORT + "                 ║");
  console.log("║ 🔐 Authentification                     ║");
  console.log("║ 📰 Publications                         ║");
  console.log("║ 👻 Stories 24h                          ║");
  console.log("║ 💬 Messages privés                      ║");
  console.log("║ 🌍 Chat public                          ║");
  console.log("║ ❤️ Likes                                ║");
  console.log("║ 💭 Commentaires                         ║");
  console.log("║ 👤 Profils                              ║");
  console.log("║ 🔔 Notifications                        ║");
  console.log("║ ⚡ Temps réel Socket.IO                 ║");
  console.log("╚══════════════════════════════════════════╝");
});
