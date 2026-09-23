const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const FILES = {
  users: path.join(DATA, "users.json"),
  messages: path.join(DATA, "messages.json"),
  posts: path.join(DATA, "posts.json"),
  stories: path.join(DATA, "stories.json"),
  rooms: path.join(DATA, "rooms.json"),
  follows: path.join(DATA, "follows.json")
};

function read(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return value;
  } catch {
    return fallback;
  }
}

function write(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

for (const [key, file] of Object.entries(FILES)) {
  const fallback = key === "users" ? [] : [];
  if (!fs.existsSync(file)) write(file, fallback);
}

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function clean(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function publicUser(user) {
  return {
    username: user.username,
    email: user.email,
    age: user.age,
    bio: user.bio || "",
    avatar: user.avatar || "",
    createdAt: user.createdAt
  };
}

function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Connexion requise." });
  }
  next();
}

function currentUser(req) {
  const users = read(FILES.users);
  return users.find(u => u.username === req.session.user.username);
}

function ownerName(item) {
  return String(
    item.username ||
    item.pseudo ||
    item.user ||
    item.author?.username ||
    ""
  );
}

/* =========================
   EXPRESS
========================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "veyra-local-session-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

app.use("/uploads", express.static(UPLOADS));
app.use(express.static(PUBLIC));

/* =========================
   UPLOADS
========================= */

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

/* =========================
   AUTH
========================= */

app.get("/api/auth/me", auth, (req, res) => {
  const user = currentUser(req);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Utilisateur introuvable." });
  }
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/register", async (req, res) => {
  const username = clean(req.body.username, 30);
  const email = clean(req.body.email, 150).toLowerCase();
  const age = Number(req.body.age);
  const password = String(req.body.password || "");

  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    return res.status(400).json({
      error: "Le pseudo doit contenir 3 à 30 caractères."
    });
  }

  if (!email.includes("@")) {
    return res.status(400).json({
      error: "Adresse email invalide."
    });
  }

  if (!Number.isInteger(age) || age < 13) {
    return res.status(400).json({
      error: "L'âge minimum est de 13 ans."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Le mot de passe doit contenir au moins 8 caractères."
    });
  }

  const users = read(FILES.users);

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
    passwordHash: await bcrypt.hash(password, 12),
    bio: "",
    avatar: "",
    createdAt: now()
  };

  users.push(user);
  write(FILES.users, users);

  req.session.user = { username };

  res.json({
    ok: true,
    user: publicUser(user)
  });
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = clean(req.body.identifier, 150);
  const password = String(req.body.password || "");

  const users = read(FILES.users);

  const user = users.find(u =>
    u.username.toLowerCase() === identifier.toLowerCase() ||
    u.email.toLowerCase() === identifier.toLowerCase()
  );

  if (!user || !user.passwordHash) {
    return res.status(401).json({
      error: "Identifiants incorrects."
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return res.status(401).json({
      error: "Identifiants incorrects."
    });
  }

  req.session.user = {
    username: user.username
  };

  res.json({
    ok: true,
    user: publicUser(user)
  });
});

app.post("/api/auth/logout", auth, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

/* =========================
   PROFILE
========================= */

app.get("/api/profile/:username", auth, (req, res) => {
  const users = read(FILES.users);
  const user = users.find(
    u => u.username.toLowerCase() === req.params.username.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  const follows = read(FILES.follows);
  const me = req.session.user.username;

  res.json({
    user: publicUser(user),
    following: follows.some(
      f => f.from === me && f.to === user.username
    ),
    followers: follows.filter(
      f => f.to === user.username
    ).length,
    followingCount: follows.filter(
      f => f.from === user.username
    ).length
  });
});

app.put("/api/profile", auth, (req, res) => {
  const users = read(FILES.users);
  const index = users.findIndex(
    u => u.username === req.session.user.username
  );

  if (index === -1) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  users[index].bio = clean(req.body.bio, 300);
  write(FILES.users, users);

  res.json({
    ok: true,
    user: publicUser(users[index])
  });
});

app.post("/api/profile/avatar", auth, upload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucune image." });
  }

  const users = read(FILES.users);
  const index = users.findIndex(
    u => u.username === req.session.user.username
  );

  if (index === -1) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  users[index].avatar = `/uploads/${req.file.filename}`;
  write(FILES.users, users);

  res.json({
    ok: true,
    avatar: users[index].avatar
  });
});

/* =========================
   SEARCH
========================= */

app.get("/api/users/search", auth, (req, res) => {
  const q = clean(req.query.q, 50).toLowerCase();

  if (!q) return res.json([]);

  const users = read(FILES.users)
    .filter(u => u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map(publicUser);

  res.json(users);
});

/* =========================
   FOLLOWS
========================= */

app.post("/api/users/:username/follow", auth, (req, res) => {
  const me = req.session.user.username;
  const target = req.params.username;

  if (me === target) {
    return res.status(400).json({
      error: "Impossible de se suivre soi-même."
    });
  }

  const users = read(FILES.users);

  if (!users.some(u => u.username === target)) {
    return res.status(404).json({
      error: "Utilisateur introuvable."
    });
  }

  const follows = read(FILES.follows);

  const existing = follows.find(
    f => f.from === me && f.to === target
  );

  if (existing) {
    write(
      FILES.follows,
      follows.filter(f => f !== existing)
    );
    return res.json({ following: false });
  }

  follows.push({
    from: me,
    to: target,
    createdAt: now()
  });

  write(FILES.follows, follows);

  res.json({ following: true });
});

/* =========================
   POSTS
========================= */

app.get("/api/posts", auth, (req, res) => {
  const posts = read(FILES.posts);

  res.json(
    posts
      .slice()
      .sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      )
  );
});

app.post("/api/posts", auth, upload.single("attachment"), (req, res) => {
  const text = clean(req.body.text, 5000);

  if (!text && !req.file) {
    return res.status(400).json({
      error: "Ajoute du texte ou un fichier."
    });
  }

  const post = {
    id: id(),
    username: req.session.user.username,
    text,
    attachment: req.file
      ? `/uploads/${req.file.filename}`
      : "",
    originalName: req.file
      ? req.file.originalname
      : "",
    createdAt: now(),
    likes: [],
    comments: []
  };

  const posts = read(FILES.posts);
  posts.push(post);
  write(FILES.posts, posts);

  res.json(post);
});

app.post("/api/posts/:id/like", auth, (req, res) => {
  const posts = read(FILES.posts);
  const post = posts.find(p => String(p.id) === String(req.params.id));

  if (!post) {
    return res.status(404).json({
      error: "Publication introuvable."
    });
  }

  post.likes = Array.isArray(post.likes)
    ? post.likes
    : [];

  const me = req.session.user.username;

  if (post.likes.includes(me)) {
    post.likes = post.likes.filter(x => x !== me);
  } else {
    post.likes.push(me);
  }

  write(FILES.posts, posts);

  res.json({
    liked: post.likes.includes(me),
    count: post.likes.length
  });
});

app.delete("/api/posts/:id", auth, (req, res) => {
  const posts = read(FILES.posts);
  const index = posts.findIndex(
    p => String(p.id) === String(req.params.id)
  );

  if (index === -1) {
    return res.status(404).json({
      error: "Publication introuvable."
    });
  }

  const post = posts[index];

  if (ownerName(post) !== req.session.user.username) {
    return res.status(403).json({
      error: "Tu peux uniquement supprimer tes propres publications."
    });
  }

  posts.splice(index, 1);
  write(FILES.posts, posts);

  if (post.attachment) {
    const filename = path.basename(post.attachment);
    const file = path.join(UPLOADS, filename);

    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch {}
    }
  }

  res.json({ ok: true });
});

/* =========================
   STORIES
   IMPORTANT : AUCUNE EXPIRATION
========================= */

app.get("/api/stories", auth, (req, res) => {
  const stories = read(FILES.stories);

  res.json(
    stories
      .slice()
      .sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      )
  );
});

app.post("/api/stories", auth, upload.single("attachment"), (req, res) => {
  const caption = clean(req.body.caption, 500);

  if (!req.file && !caption) {
    return res.status(400).json({
      error: "Ajoute une photo ou un texte à ta story."
    });
  }

  const story = {
    id: id(),
    username: req.session.user.username,
    caption,
    attachment: req.file
      ? `/uploads/${req.file.filename}`
      : "",
    originalName: req.file
      ? req.file.originalname
      : "",
    createdAt: now()
  };

  // IMPORTANT :
  // aucune expiresAt
  // aucun délai de 24 heures
  const stories = read(FILES.stories);
  stories.push(story);
  write(FILES.stories, stories);

  res.json(story);
});

app.delete("/api/stories/:id", auth, (req, res) => {
  const stories = read(FILES.stories);

  const index = stories.findIndex(
    s => String(s.id) === String(req.params.id)
  );

  if (index === -1) {
    return res.status(404).json({
      error: "Story introuvable."
    });
  }

  const story = stories[index];

  if (ownerName(story) !== req.session.user.username) {
    return res.status(403).json({
      error: "Tu peux uniquement supprimer tes propres stories."
    });
  }

  stories.splice(index, 1);
  write(FILES.stories, stories);

  if (story.attachment) {
    const filename = path.basename(story.attachment);
    const file = path.join(UPLOADS, filename);

    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch {}
    }
  }

  res.json({
    ok: true,
    deleted: story.id
  });
});

/* =========================
   ROOMS
========================= */

app.get("/api/rooms", auth, (req, res) => {
  res.json(read(FILES.rooms));
});

app.post("/api/rooms", auth, (req, res) => {
  const name = clean(req.body.name, 50);

  if (!name) {
    return res.status(400).json({
      error: "Nom du salon obligatoire."
    });
  }

  const rooms = read(FILES.rooms);

  const room = {
    id: id(),
    name,
    owner: req.session.user.username,
    createdAt: now()
  };

  rooms.push(room);
  write(FILES.rooms, rooms);

  res.json(room);
});

/* =========================
   MESSAGES PERSISTANTS
========================= */

app.get("/api/messages/conversations", auth, (req, res) => {
  const me = req.session.user.username;
  const messages = read(FILES.messages);

  const map = new Map();

  for (const message of messages) {
    if (message.type !== "private") continue;

    let other = null;

    if (message.from === me) other = message.to;
    if (message.to === me) other = message.from;

    if (!other) continue;

    const previous = map.get(other);

    if (
      !previous ||
      new Date(message.createdAt) > new Date(previous.createdAt)
    ) {
      map.set(other, message);
    }
  }

  res.json(
    Array.from(map.entries()).map(([username, message]) => ({
      username,
      lastMessage: message
    }))
  );
});

app.get("/api/messages/:username", auth, (req, res) => {
  const me = req.session.user.username;
  const other = req.params.username;

  const messages = read(FILES.messages);

  res.json(
    messages.filter(m =>
      m.type === "private" &&
      (
        (m.from === me && m.to === other) ||
        (m.from === other && m.to === me)
      )
    )
  );
});

app.get("/api/messages/public", auth, (req, res) => {
  const messages = read(FILES.messages);

  res.json(
    messages.filter(m => m.type === "public")
  );
});

app.get("/api/messages/room/:roomId", auth, (req, res) => {
  const messages = read(FILES.messages);

  res.json(
    messages.filter(m =>
      m.type === "room" &&
      String(m.roomId) === String(req.params.roomId)
    )
  );
});

/* =========================
   SOCKET.IO
========================= */

io.use((socket, next) => {
  const session = socket.request.session;

  if (!session?.user) {
    return next(new Error("Non connecté"));
  }

  socket.username = session.user.username;
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  next();
});

io.engine.use((req, res, next) => {
  sessionMiddleware(req, res, next);
});

const sessionMiddleware = session({
  secret: "veyra-local-session-change-this",
  resave: false,
  saveUninitialized: false
});

io.engine.use(sessionMiddleware);

io.on("connection", socket => {
  const username = socket.username;

  socket.join(`user:${username}`);
  socket.join("public");

  io.emit("presence", {
    username,
    online: true
  });

  socket.on("joinPublic", () => {
    socket.join("public");
  });

  socket.on("joinRoom", roomId => {
    socket.join(`room:${roomId}`);
  });

  socket.on("privateMessage", data => {
    const to = clean(data?.to, 30);
    const text = clean(data?.text, 5000);

    if (!to || !text) return;

    const message = {
      id: id(),
      type: "private",
      from: username,
      to,
      text,
      createdAt: now()
    };

    const messages = read(FILES.messages);
    messages.push(message);
    write(FILES.messages, messages);

    io.to(`user:${username}`).emit("privateMessage", message);
    io.to(`user:${to}`).emit("privateMessage", message);
  });

  socket.on("publicMessage", data => {
    const text = clean(data?.text, 5000);
    if (!text) return;

    const message = {
      id: id(),
      type: "public",
      from: username,
      text,
      createdAt: now()
    };

    const messages = read(FILES.messages);
    messages.push(message);
    write(FILES.messages, messages);

    io.to("public").emit("publicMessage", message);
  });

  socket.on("roomMessage", data => {
    const roomId = clean(data?.roomId, 100);
    const text = clean(data?.text, 5000);

    if (!roomId || !text) return;

    const message = {
      id: id(),
      type: "room",
      roomId,
      from: username,
      text,
      createdAt: now()
    };

    const messages = read(FILES.messages);
    messages.push(message);
    write(FILES.messages, messages);

    io.to(`room:${roomId}`).emit("roomMessage", message);
  });

  socket.on("typing", data => {
    const to = clean(data?.to, 30);

    if (!to) return;

    io.to(`user:${to}`).emit("typing", {
      from: username,
      typing: Boolean(data?.typing)
    });
  });

  socket.on("disconnect", () => {
    io.emit("presence", {
      username,
      online: false
    });
  });
});

/* =========================
   EXPRESS 5 FALLBACK
========================= */

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

server.listen(PORT, () => {
  console.log("");
  console.log("======================================");
  console.log("🚀 VEYRA EST DEMARRE");
  console.log("======================================");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("♾️ Stories permanentes");
  console.log("💾 Messages persistants");
  console.log("🗑️ Suppression personnelle activée");
  console.log("======================================");
});
