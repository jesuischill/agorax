const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const crypto = require("crypto");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");

const USERS_FILE = path.join(DATA, "users.json");
const POSTS_FILE = path.join(DATA, "posts.json");
const STORIES_FILE = path.join(DATA, "stories.json");
const MESSAGES_FILE = path.join(DATA, "messages.json");
const ROOMS_FILE = path.join(DATA, "rooms.json");
const NOTIFICATIONS_FILE = path.join(DATA, "notifications.json");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

function ensureFile(file, value = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  }
}

ensureFile(USERS_FILE);
ensureFile(POSTS_FILE);
ensureFile(STORIES_FILE);
ensureFile(MESSAGES_FILE);
ensureFile(ROOMS_FILE, [
  { id: "general", name: "Général", icon: "🌐", description: "Le salon principal de Veyra" },
  { id: "jeux", name: "Jeux", icon: "🎮", description: "Jeux vidéo et gaming" },
  { id: "musique", name: "Musique", icon: "🎵", description: "Parler musique" },
  { id: "tech", name: "Technologie", icon: "💻", description: "Technologie et informatique" },
  { id: "sport", name: "Sport", icon: "⚽", description: "Discussions sportives" },
  { id: "creation", name: "Création", icon: "🎨", description: "Art, vidéo et création" }
]);
ensureFile(NOTIFICATIONS_FILE);

function read(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function makeId() {
  return Date.now().toString(36) + crypto.randomBytes(5).toString("hex");
}

function safeUser(user) {
  if (!user) return null;
  return {
    username: user.username,
    email: user.email,
    age: user.age,
    bio: user.bio || "",
    avatar: user.avatar || "",
    banner: user.banner || "",
    followers: Array.isArray(user.followers) ? user.followers : [],
    following: Array.isArray(user.following) ? user.following : [],
    createdAt: user.createdAt
  };
}

function currentUser(req) {
  const users = read(USERS_FILE);
  return users.find(u => u.username === req.session.username);
}

function auth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Non connecté" });
  req.user = user;
  next();
}

function notify(username, data) {
  const notifications = read(NOTIFICATIONS_FILE);
  notifications.unshift({
    id: makeId(),
    username,
    read: false,
    createdAt: new Date().toISOString(),
    ...data
  });
  write(NOTIFICATIONS_FILE, notifications.slice(0, 1000));
}

/* -------------------- SESSION -------------------- */

const sessionMiddleware = session({
  secret: process.env.VEYRA_SESSION_SECRET || "veyra-local-session-secret-change-me",
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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

/* -------------------- UPLOADS -------------------- */

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [
      ".jpg", ".jpeg", ".png", ".webp", ".gif",
      ".pdf", ".txt", ".docx", ".xlsx"
    ].includes(ext) ? ext : "";
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(10).toString("hex")}${safeExt}`
    );
  }
});

const uploader = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error("Type de fichier non autorisé."));
    }
    cb(null, true);
  }
});

function uploadSingle(field) {
  return (req, res, next) => {
    uploader.single(field)(req, res, err => {
      if (err) {
        return res.status(400).json({
          error: err.message || "Erreur pendant l'envoi du fichier."
        });
      }
      next();
    });
  };
}

function attachmentFromFile(file) {
  if (!file) return null;

  return {
    url: `/uploads/${encodeURIComponent(file.filename)}`,
    name: file.originalname,
    mime: file.mimetype,
    size: file.size
  };
}

app.use(
  "/uploads",
  express.static(UPLOADS, {
    index: false,
    dotfiles: "deny"
  })
);

/* -------------------- AUTH -------------------- */

app.post("/api/auth/register", (req, res) => {
  const users = read(USERS_FILE);

  const username = String(req.body.username || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const age = Number(req.body.age);

  if (username.length < 3) {
    return res.status(400).json({ error: "Le pseudo doit contenir au moins 3 caractères." });
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ error: "Pseudo invalide." });
  }

  if (!email.includes("@")) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
  }

  if (!Number.isInteger(age) || age < 13 || age > 120) {
    return res.status(400).json({ error: "Âge invalide." });
  }

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "Ce pseudo est déjà utilisé." });
  }

  if (users.some(u => u.email.toLowerCase() === email)) {
    return res.status(409).json({ error: "Cet email est déjà utilisé." });
  }

  const user = {
    username,
    email,
    age,
    passwordHash: bcrypt.hashSync(password, 12),
    bio: "",
    avatar: "",
    banner: "",
    followers: [],
    following: [],
    createdAt: new Date().toISOString()
  };

  users.push(user);
  write(USERS_FILE, users);

  req.session.username = username;

  req.session.save(() => {
    res.json({
      ok: true,
      user: safeUser(user)
    });
  });
});

app.post("/api/auth/login", (req, res) => {
  const users = read(USERS_FILE);

  const identifier = String(
    req.body.identifier ||
    req.body.username ||
    req.body.email ||
    ""
  ).trim();

  const password = String(req.body.password || "");

  const user = users.find(u =>
    u.username.toLowerCase() === identifier.toLowerCase() ||
    u.email.toLowerCase() === identifier.toLowerCase()
  );

  if (!user || !bcrypt.compareSync(password, user.passwordHash || "")) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }

  req.session.username = user.username;

  req.session.save(() => {
    res.json({
      ok: true,
      user: safeUser(user)
    });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  const user = currentUser(req);
  res.json({
    authenticated: !!user,
    user: safeUser(user)
  });
});

/* -------------------- UPLOAD API -------------------- */

app.post("/api/upload", auth, uploadSingle("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu." });
  }

  res.json({
    ok: true,
    attachment: attachmentFromFile(req.file)
  });
});

/* -------------------- POSTS -------------------- */

app.get("/api/feed", auth, (req, res) => {
  const posts = read(POSTS_FILE)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);

  res.json(posts);
});

app.post("/api/posts", auth, uploadSingle("attachment"), (req, res) => {
  const posts = read(POSTS_FILE);

  const content = String(req.body.content || "").trim();

  if (!content && !req.file) {
    return res.status(400).json({
      error: "Écris quelque chose ou ajoute un fichier."
    });
  }

  const post = {
    id: makeId(),
    username: req.user.username,
    content,
    attachment: attachmentFromFile(req.file),
    likes: [],
    comments: [],
    createdAt: new Date().toISOString()
  };

  posts.unshift(post);
  write(POSTS_FILE, posts);

  res.json(post);
});

app.post("/api/posts/:id/like", auth, (req, res) => {
  const posts = read(POSTS_FILE);
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.status(404).json({ error: "Publication introuvable." });
  }

  if (!Array.isArray(post.likes)) post.likes = [];

  const index = post.likes.indexOf(req.user.username);

  if (index === -1) {
    post.likes.push(req.user.username);

    if (post.username !== req.user.username) {
      notify(post.username, {
        type: "like",
        from: req.user.username,
        text: `${req.user.username} a aimé ta publication.`
      });
    }
  } else {
    post.likes.splice(index, 1);
  }

  write(POSTS_FILE, posts);
  res.json({ likes: post.likes });
});

/* -------------------- STORIES -------------------- */

app.get("/api/stories", auth, (req, res) => {
  const now = Date.now();

  const stories = read(STORIES_FILE).filter(
    s => new Date(s.expiresAt).getTime() > now
  );

  write(STORIES_FILE, stories);

  res.json(
    stories.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
  );
});

app.post("/api/stories", auth, uploadSingle("attachment"), (req, res) => {
  const stories = read(STORIES_FILE);

  const content = String(req.body.content || "").trim();

  if (!content && !req.file) {
    return res.status(400).json({
      error: "Écris quelque chose ou ajoute une image."
    });
  }

  const now = Date.now();

  const story = {
    id: makeId(),
    username: req.user.username,
    content,
    attachment: attachmentFromFile(req.file),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString()
  };

  stories.unshift(story);
  write(STORIES_FILE, stories);

  res.json(story);
});

/* -------------------- PROFILE -------------------- */

app.get("/api/users/:username", auth, (req, res) => {
  const users = read(USERS_FILE);
  const user = users.find(
    u => u.username.toLowerCase() === req.params.username.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  res.json(safeUser(user));
});

app.get("/api/profile/:username", auth, (req, res) => {
  const users = read(USERS_FILE);
  const username = req.params.username;

  const user = users.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  const posts = read(POSTS_FILE)
    .filter(p => p.username.toLowerCase() === user.username.toLowerCase())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    user: safeUser(user),
    posts
  });
});

app.post("/api/profile/follow/:username", auth, (req, res) => {
  const users = read(USERS_FILE);

  const target = users.find(
    u => u.username.toLowerCase() === req.params.username.toLowerCase()
  );

  const me = users.find(
    u => u.username.toLowerCase() === req.user.username.toLowerCase()
  );

  if (!target || !me) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  if (target.username === me.username) {
    return res.status(400).json({ error: "Tu ne peux pas te suivre toi-même." });
  }

  target.followers = Array.isArray(target.followers) ? target.followers : [];
  me.following = Array.isArray(me.following) ? me.following : [];

  const index = target.followers.indexOf(me.username);

  if (index === -1) {
    target.followers.push(me.username);
    me.following.push(target.username);

    notify(target.username, {
      type: "follow",
      from: me.username,
      text: `${me.username} te suit maintenant.`
    });
  } else {
    target.followers.splice(index, 1);
    me.following = me.following.filter(x => x !== target.username);
  }

  write(USERS_FILE, users);

  res.json({
    following: me.following.includes(target.username),
    followers: target.followers.length
  });
});

app.post("/api/profile/update", auth, (req, res) => {
  const users = read(USERS_FILE);

  const me = users.find(
    u => u.username.toLowerCase() === req.user.username.toLowerCase()
  );

  if (!me) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  me.bio = String(req.body.bio || "").slice(0, 300);
  me.avatar = String(req.body.avatar || "").slice(0, 500);
  me.banner = String(req.body.banner || "").slice(0, 500);

  write(USERS_FILE, users);

  res.json(safeUser(me));
});

/* -------------------- SEARCH -------------------- */

app.get("/api/search", auth, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();

  if (!q) return res.json([]);

  const users = read(USERS_FILE)
    .filter(u => u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map(safeUser);

  res.json(users);
});

/* -------------------- NOTIFICATIONS -------------------- */

app.get("/api/notifications/:username", auth, (req, res) => {
  const notifications = read(NOTIFICATIONS_FILE)
    .filter(n => n.username === req.params.username)
    .slice(0, 50);

  res.json(notifications);
});

/* -------------------- ROOMS -------------------- */

app.get("/api/rooms", auth, (req, res) => {
  res.json(read(ROOMS_FILE));
});

app.post("/api/rooms", auth, (req, res) => {
  const rooms = read(ROOMS_FILE);

  const name = String(req.body.name || "").trim();

  if (name.length < 2 || name.length > 40) {
    return res.status(400).json({ error: "Nom de salon invalide." });
  }

  const room = {
    id: makeId(),
    name,
    icon: String(req.body.icon || "💬").slice(0, 4),
    description: String(req.body.description || "").slice(0, 120)
  };

  rooms.push(room);
  write(ROOMS_FILE, rooms);

  res.json(room);
});

/* -------------------- MESSAGES -------------------- */

app.get("/api/messages/:username", auth, (req, res) => {
  const other = req.params.username;

  const messages = read(MESSAGES_FILE).filter(m =>
    m.type === "private" &&
    (
      (m.from === req.user.username && m.to === other) ||
      (m.from === other && m.to === req.user.username)
    )
  );

  res.json(messages.slice(-200));
});

app.get("/api/messages/conversations", auth, (req, res) => {
  const messages = read(MESSAGES_FILE);

  const map = new Map();

  for (const message of messages) {
    if (message.type !== "private") continue;

    if (
      message.from !== req.user.username &&
      message.to !== req.user.username
    ) {
      continue;
    }

    const other =
      message.from === req.user.username
        ? message.to
        : message.from;

    const previous = map.get(other);

    if (!previous || new Date(message.createdAt) > new Date(previous.createdAt)) {
      map.set(other, message);
    }
  }

  const result = [...map.entries()]
    .map(([username, message]) => ({
      username,
      lastMessage: message,
      createdAt: message.createdAt
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(result);
});

app.get("/api/messages/public", auth, (req, res) => {
  const messages = read(MESSAGES_FILE)
    .filter(m => m.type === "public")
    .slice(-200);

  res.json(messages);
});

app.get("/api/messages/room/:roomId", auth, (req, res) => {
  const messages = read(MESSAGES_FILE)
    .filter(
      m =>
        m.type === "room" &&
        m.roomId === req.params.roomId
    )
    .slice(-200);

  res.json(messages);
});

/* -------------------- SOCKET.IO -------------------- */

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const connectedUsers = new Map();

function broadcastPresence() {
  io.emit("presence", [...connectedUsers.keys()]);
}

io.on("connection", socket => {
  const username = socket.request.session?.username;

  if (!username) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${username}`);

  connectedUsers.set(
    username,
    (connectedUsers.get(username) || 0) + 1
  );

  broadcastPresence();

  socket.on("joinPublic", () => {
    socket.join("public");
  });

  socket.on("joinRoom", roomId => {
    if (typeof roomId !== "string") return;
    socket.join(`room:${roomId}`);
  });

  socket.on("privateMessage", data => {
    const to = String(data?.to || "").trim();
    const text = String(data?.text || "").trim();
    const attachment = data?.attachment || null;

    if (!to) return;
    if (!text && !attachment) return;
    if (to === username) return;

    const users = read(USERS_FILE);

    if (!users.some(u => u.username === to)) return;

    const message = {
      id: makeId(),
      type: "private",
      from: username,
      to,
      text: text.slice(0, 5000),
      attachment,
      createdAt: new Date().toISOString()
    };

    const messages = read(MESSAGES_FILE);
    messages.push(message);
    write(MESSAGES_FILE, messages);

    io.to(`user:${username}`).emit("privateMessage", message);
    io.to(`user:${to}`).emit("privateMessage", message);

    notify(to, {
      type: "message",
      from: username,
      text: `Nouveau message de ${username}.`
    });
  });

  socket.on("publicMessage", data => {
    const text = String(data?.text || "").trim();
    const attachment = data?.attachment || null;

    if (!text && !attachment) return;

    const message = {
      id: makeId(),
      type: "public",
      from: username,
      text: text.slice(0, 5000),
      attachment,
      createdAt: new Date().toISOString()
    };

    const messages = read(MESSAGES_FILE);
    messages.push(message);
    write(MESSAGES_FILE, messages);

    io.to("public").emit("publicMessage", message);
  });

  socket.on("roomMessage", data => {
    const roomId = String(data?.roomId || "");
    const text = String(data?.text || "").trim();
    const attachment = data?.attachment || null;

    if (!roomId || (!text && !attachment)) return;

    const rooms = read(ROOMS_FILE);

    if (!rooms.some(r => r.id === roomId)) return;

    const message = {
      id: makeId(),
      type: "room",
      roomId,
      from: username,
      text: text.slice(0, 5000),
      attachment,
      createdAt: new Date().toISOString()
    };

    const messages = read(MESSAGES_FILE);
    messages.push(message);
    write(MESSAGES_FILE, messages);

    io.to(`room:${roomId}`).emit("roomMessage", message);
  });

  socket.on("typing", data => {
    const to = String(data?.to || "").trim();

    if (!to) return;

    io.to(`user:${to}`).emit("typing", {
      from: username,
      active: !!data.active
    });
  });

  socket.on("disconnect", () => {
    const count = connectedUsers.get(username) || 0;

    if (count <= 1) {
      connectedUsers.delete(username);
    } else {
      connectedUsers.set(username, count - 1);
    }

    broadcastPresence();
  });
});

/* -------------------- STATIC -------------------- */

app.use(express.static(path.join(ROOT, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "Veyra",
    version: "2.0.0"
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║          VEYRA v2.0.0               ║");
  console.log("║   Réseau social + discussions       ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");
  console.log(`Veyra est disponible sur http://localhost:${PORT}`);
  console.log("");
});
