const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
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
const USERS_FILE = path.join(DATA, "users.json");
const POSTS_FILE = path.join(DATA, "posts.json");
const STORIES_FILE = path.join(DATA, "stories.json");
const MESSAGES_FILE = path.join(DATA, "messages.json");
const ROOMS_FILE = path.join(DATA, "rooms.json");
const NOTIFICATIONS_FILE = path.join(DATA, "notifications.json");

fs.mkdirSync(DATA, { recursive: true });

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

const sessionMiddleware = session({
  secret: process.env.VEYRA_SESSION_SECRET || "veyra-local-secret-change-me",
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
app.use(express.static(path.join(ROOT, "public")));

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
  if (!user) {
    return res.status(401).json({ error: "Non connecté" });
  }
  req.user = user;
  next();
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function notify(username, notification) {
  const notifications = read(NOTIFICATIONS_FILE);
  notifications.unshift({
    id: id(),
    username,
    read: false,
    createdAt: new Date().toISOString(),
    ...notification
  });
  write(NOTIFICATIONS_FILE, notifications.slice(0, 1000));
}

app.get("/api/auth/me", (req, res) => {
  res.json({ user: safeUser(currentUser(req)) });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const age = Number(req.body.age);

    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Le pseudo doit contenir au moins 3 caractères." });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Adresse email invalide." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    if (!Number.isFinite(age) || age < 13) {
      return res.status(400).json({ error: "Âge invalide." });
    }

    const users = read(USERS_FILE);

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: "Ce pseudo est déjà utilisé." });
    }

    if (users.some(u => u.email === email)) {
      return res.status(409).json({ error: "Cet email est déjà utilisé." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      username,
      email,
      passwordHash,
      age,
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
      res.json({ ok: true, user: safeUser(user) });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur pendant l'inscription." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.username || req.body.email || "").trim();
    const password = String(req.body.password || "");

    const users = read(USERS_FILE);

    const user = users.find(u =>
      u.username.toLowerCase() === identifier.toLowerCase() ||
      u.email.toLowerCase() === identifier.toLowerCase()
    );

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: "Pseudo/email ou mot de passe incorrect." });
    }

    req.session.username = user.username;

    req.session.save(() => {
      res.json({ ok: true, user: safeUser(user) });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur pendant la connexion." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/feed", auth, (req, res) => {
  const posts = read(POSTS_FILE)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(post => ({
      ...post,
      liked: Array.isArray(post.likes) && post.likes.includes(req.user.username),
      likeCount: Array.isArray(post.likes) ? post.likes.length : 0
    }));

  res.json({ posts });
});

app.post("/api/posts", auth, (req, res) => {
  const content = String(req.body.content || "").trim();

  if (!content) {
    return res.status(400).json({ error: "Publication vide." });
  }

  const posts = read(POSTS_FILE);

  const post = {
    id: id(),
    username: req.user.username,
    content: content.slice(0, 2000),
    likes: [],
    comments: [],
    createdAt: new Date().toISOString()
  };

  posts.push(post);
  write(POSTS_FILE, posts);

  res.json({ post });
});

app.post("/api/posts/:postId/like", auth, (req, res) => {
  const posts = read(POSTS_FILE);
  const post = posts.find(p => p.id === req.params.postId);

  if (!post) {
    return res.status(404).json({ error: "Publication introuvable." });
  }

  post.likes ||= [];

  const index = post.likes.indexOf(req.user.username);

  if (index >= 0) {
    post.likes.splice(index, 1);
  } else {
    post.likes.push(req.user.username);

    if (post.username !== req.user.username) {
      notify(post.username, {
        type: "like",
        from: req.user.username,
        text: `${req.user.username} a aimé votre publication.`
      });
    }
  }

  write(POSTS_FILE, posts);

  res.json({
    liked: post.likes.includes(req.user.username),
    likeCount: post.likes.length
  });
});

app.get("/api/stories", auth, (req, res) => {
  const now = Date.now();

  const stories = read(STORIES_FILE)
    .filter(s => new Date(s.expiresAt).getTime() > now)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ stories });
});

app.post("/api/stories", auth, (req, res) => {
  const content = String(req.body.content || "").trim();

  if (!content) {
    return res.status(400).json({ error: "Story vide." });
  }

  const stories = read(STORIES_FILE);

  const story = {
    id: id(),
    username: req.user.username,
    content: content.slice(0, 500),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  stories.push(story);
  write(STORIES_FILE, stories);

  res.json({ story });
});

app.get("/api/users/:username", (req, res) => {
  const users = read(USERS_FILE);
  const user = users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());

  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  res.json({ user: safeUser(user) });
});

app.get("/api/profile/:username", (req, res) => {
  const users = read(USERS_FILE);
  const user = users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());

  if (!user) {
    return res.status(404).json({ error: "Profil introuvable." });
  }

  const posts = read(POSTS_FILE)
    .filter(p => p.username === user.username)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    user: safeUser(user),
    posts
  });
});

app.post("/api/profile/follow/:username", auth, (req, res) => {
  const targetName = req.params.username;
  const users = read(USERS_FILE);

  const me = users.find(u => u.username === req.user.username);
  const target = users.find(u => u.username.toLowerCase() === targetName.toLowerCase());

  if (!target) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  if (target.username === me.username) {
    return res.status(400).json({ error: "Vous ne pouvez pas vous suivre vous-même." });
  }

  me.following ||= [];
  target.followers ||= [];

  const alreadyFollowing = me.following.includes(target.username);

  if (alreadyFollowing) {
    me.following = me.following.filter(x => x !== target.username);
    target.followers = target.followers.filter(x => x !== me.username);
  } else {
    me.following.push(target.username);
    target.followers.push(me.username);

    notify(target.username, {
      type: "follow",
      from: me.username,
      text: `${me.username} vous suit maintenant.`
    });
  }

  write(USERS_FILE, users);

  res.json({
    following: !alreadyFollowing,
    user: safeUser(target)
  });
});

app.post("/api/profile/update", auth, (req, res) => {
  const users = read(USERS_FILE);
  const user = users.find(u => u.username === req.user.username);

  if (typeof req.body.bio === "string") {
    user.bio = req.body.bio.slice(0, 300);
  }

  if (typeof req.body.avatar === "string") {
    user.avatar = req.body.avatar.slice(0, 1000);
  }

  if (typeof req.body.banner === "string") {
    user.banner = req.body.banner.slice(0, 1000);
  }

  write(USERS_FILE, users);

  res.json({ user: safeUser(user) });
});

app.get("/api/search", auth, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();

  if (!q) {
    return res.json({ users: [], posts: [] });
  }

  const users = read(USERS_FILE)
    .filter(u => u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map(safeUser);

  const posts = read(POSTS_FILE)
    .filter(p =>
      p.content.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q)
    )
    .slice(0, 20);

  res.json({ users, posts });
});

app.get("/api/notifications/:username", auth, (req, res) => {
  if (req.params.username !== req.user.username) {
    return res.status(403).json({ error: "Accès refusé." });
  }

  const notifications = read(NOTIFICATIONS_FILE)
    .filter(n => n.username === req.user.username)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);

  res.json({ notifications });
});

app.get("/api/rooms", auth, (req, res) => {
  res.json({ rooms: read(ROOMS_FILE) });
});

app.post("/api/rooms", auth, (req, res) => {
  const name = String(req.body.name || "").trim();
  const icon = String(req.body.icon || "💬").trim();

  if (!name || name.length < 2 || name.length > 40) {
    return res.status(400).json({ error: "Nom de salon invalide." });
  }

  const rooms = read(ROOMS_FILE);

  if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "Ce salon existe déjà." });
  }

  const room = {
    id: id(),
    name,
    icon: icon.slice(0, 4),
    description: String(req.body.description || "").slice(0, 120)
  };

  rooms.push(room);
  write(ROOMS_FILE, rooms);

  res.json({ room });
});

app.get("/api/messages/public", auth, (req, res) => {
  const messages = read(MESSAGES_FILE)
    .filter(m => m.type === "public")
    .slice(-200);

  res.json({ messages });
});

app.get("/api/messages/room/:roomId", auth, (req, res) => {
  const rooms = read(ROOMS_FILE);

  if (!rooms.some(r => r.id === req.params.roomId)) {
    return res.status(404).json({ error: "Salon introuvable." });
  }

  const messages = read(MESSAGES_FILE)
    .filter(m => m.type === "room" && m.roomId === req.params.roomId)
    .slice(-200);

  res.json({ messages });
});

app.get("/api/messages/:username", auth, (req, res) => {
  const other = req.params.username;

  const messages = read(MESSAGES_FILE)
    .filter(m =>
      m.type === "private" &&
      (
        (m.from === req.user.username && m.to === other) ||
        (m.from === other && m.to === req.user.username)
      )
    )
    .slice(-200);

  res.json({ messages });
});

app.get("/api/messages/conversations", auth, (req, res) => {
  const all = read(MESSAGES_FILE);
  const users = new Set();

  for (const message of all) {
    if (message.type !== "private") continue;

    if (message.from === req.user.username) users.add(message.to);
    if (message.to === req.user.username) users.add(message.from);
  }

  res.json({
    conversations: [...users].map(username => ({ username }))
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "Veyra",
    version: "1.0.0"
  });
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on("connection", socket => {
  const username = socket.request.session?.username;

  if (!username) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${username}`);

  socket.on("joinPublic", () => {
    socket.join("public");
  });

  socket.on("joinRoom", roomId => {
    const rooms = read(ROOMS_FILE);

    if (!rooms.some(r => r.id === roomId)) return;

    socket.join(`room:${roomId}`);
  });

  socket.on("privateMessage", data => {
    const to = String(data?.to || "").trim();
    const text = String(data?.text || "").trim();

    if (!to || !text || text.length > 2000) return;

    const users = read(USERS_FILE);
    const recipient = users.find(u => u.username.toLowerCase() === to.toLowerCase());

    if (!recipient) return;

    const message = {
      id: id(),
      type: "private",
      from: username,
      to: recipient.username,
      text,
      createdAt: new Date().toISOString()
    };

    const messages = read(MESSAGES_FILE);
    messages.push(message);
    write(MESSAGES_FILE, messages.slice(-10000));

    io.to(`user:${username}`).to(`user:${recipient.username}`).emit("privateMessage", message);
  });

  socket.on("publicMessage", data => {
    const text = String(data?.text || "").trim();

    if (!text || text.length > 2000) return;

    const message = {
      id: id(),
      type: "public",
      from: username,
      text,
      createdAt: new Date().toISOString()
    };

    const messages = read(MESSAGES_FILE);
    messages.push(message);
    write(MESSAGES_FILE, messages.slice(-10000));

    io.to("public").emit("publicMessage", message);
  });

  socket.on("roomMessage", data => {
    const roomId = String(data?.roomId || "");
    const text = String(data?.text || "").trim();

    if (!roomId || !text || text.length > 2000) return;

    const rooms = read(ROOMS_FILE);

    if (!rooms.some(r => r.id === roomId)) return;

    const message = {
      id: id(),
      type: "room",
      roomId,
      from: username,
      text,
      createdAt: new Date().toISOString()
    };

    const messages = read(MESSAGES_FILE);
    messages.push(message);
    write(MESSAGES_FILE, messages.slice(-10000));

    io.to(`room:${roomId}`).emit("roomMessage", message);
  });

  socket.on("typing", data => {
    const type = data?.type || "public";

    if (type === "private" && data?.to) {
      io.to(`user:${data.to}`).emit("typing", {
        type: "private",
        from: username
      });
    }

    if (type === "room" && data?.roomId) {
      socket.to(`room:${data.roomId}`).emit("typing", {
        type: "room",
        from: username,
        roomId: data.roomId
      });
    }

    if (type === "public") {
      socket.to("public").emit("typing", {
        type: "public",
        from: username
      });
    }
  });

  socket.on("disconnect", () => {});
});

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "login.html"));
});

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "favicon.svg"));
});

server.listen(PORT, () => {
  console.log(`\n🚀 Veyra lancé sur http://localhost:${PORT}\n`);
});
