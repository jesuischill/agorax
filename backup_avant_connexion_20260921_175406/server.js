const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "social.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    users: {},
    posts: [],
    comments: [],
    notifications: []
  }, null, 2));
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {
      users: {},
      posts: [],
      comments: [],
      notifications: []
    };
  }
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp"
    ];

    cb(null, allowed.includes(file.mimetype));
  }
});

/* =========================
   API
   ========================= */

app.get("/api/feed", (req, res) => {
  db = loadDB();

  const posts = db.posts
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(post => ({
      ...post,
      likes: post.likes || [],
      comments: db.comments.filter(c => c.postId === post.id)
    }));

  res.json(posts);
});

app.post("/api/users", (req, res) => {
  db = loadDB();

  const username = String(req.body.username || "")
    .trim()
    .slice(0, 30);

  if (!username) {
    return res.status(400).json({
      error: "Pseudo obligatoire"
    });
  }

  const key = username.toLowerCase();

  if (!db.users[key]) {
    db.users[key] = {
      username,
      displayName: username,
      bio: "Bienvenue sur mon profil AgoraX 👋",
      link: "",
      location: "",
      avatar: username.charAt(0).toUpperCase(),
      avatarImage: null,
      coverImage: null,
      createdAt: Date.now()
    };

    saveDB(db);
  }

  res.json(db.users[key]);
});

app.get("/api/profile/:username", (req, res) => {
  db = loadDB();

  const key = req.params.username.toLowerCase();
  const user = db.users[key];

  if (!user) {
    return res.status(404).json({
      error: "Utilisateur introuvable"
    });
  }

  const posts = db.posts
    .filter(p => p.username.toLowerCase() === user.username.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json({
    ...user,
    posts
  });
});


app.post("/api/profile/update", upload.fields([
  { name: "avatar", maxCount: 1 },
  { name: "cover", maxCount: 1 }
]), (req, res) => {
  db = loadDB();

  const username = String(req.body.username || "").trim();
  const key = username.toLowerCase();

  if (!username || !db.users[key]) {
    return res.status(404).json({
      error: "Utilisateur introuvable"
    });
  }

  const user = db.users[key];

  const displayName = String(req.body.displayName || username)
    .trim()
    .slice(0, 40);

  const bio = String(req.body.bio || "")
    .trim()
    .slice(0, 160);

  const link = String(req.body.link || "")
    .trim()
    .slice(0, 200);

  const location = String(req.body.location || "")
    .trim()
    .slice(0, 80);

  user.displayName = displayName || username;
  user.bio = bio;
  user.link = link;
  user.location = location;

  if (req.files && req.files.avatar && req.files.avatar[0]) {
    if (user.avatarImage) {
      const oldPath = path.join(
        __dirname,
        user.avatarImage.replace(/^\/uploads\//, "uploads/")
      );

      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {}
      }
    }

    user.avatarImage =
      "/uploads/" + req.files.avatar[0].filename;
  }

  if (req.files && req.files.cover && req.files.cover[0]) {
    if (user.coverImage) {
      const oldPath = path.join(
        __dirname,
        user.coverImage.replace(/^\/uploads\//, "uploads/")
      );

      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {}
      }
    }

    user.coverImage =
      "/uploads/" + req.files.cover[0].filename;
  }

  saveDB(db);

  io.emit("profileUpdated", {
    username: user.username
  });

  res.json(user);
});

app.post("/api/posts", upload.single("image"), (req, res) => {
  db = loadDB();

  const username = String(req.body.username || "")
    .trim()
    .slice(0, 30);

  const content = String(req.body.content || "")
    .trim()
    .slice(0, 2000);

  if (!username) {
    return res.status(400).json({
      error: "Pseudo obligatoire"
    });
  }

  if (!content && !req.file) {
    return res.status(400).json({
      error: "La publication est vide"
    });
  }

  const post = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    username,
    content,
    image: req.file ? "/uploads/" + req.file.filename : null,
    likes: [],
    createdAt: Date.now()
  };

  db.posts.push(post);
  saveDB(db);

  io.emit("newPost", post);

  res.json(post);
});


app.delete("/api/posts/:id", (req, res) => {
  db = loadDB();

  const post = db.posts.find(p => p.id === req.params.id);
  const username = String(req.body.username || "").trim();

  if (!post) {
    return res.status(404).json({
      error: "Publication introuvable"
    });
  }

  if (!username || post.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({
      error: "Vous ne pouvez supprimer que vos propres publications."
    });
  }

  // Supprimer l'image associée si elle existe
  if (post.image) {
    const imagePath = path.join(
      __dirname,
      post.image.replace(/^\/uploads\//, "uploads/")
    );

    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch {}
    }
  }

  // Supprimer la publication
  db.posts = db.posts.filter(p => p.id !== post.id);

  // Supprimer ses commentaires
  db.comments = db.comments.filter(
    comment => comment.postId !== post.id
  );

  saveDB(db);

  io.emit("postDeleted", post.id);

  res.json({
    success: true,
    id: post.id
  });
});

app.post("/api/posts/:id/like", (req, res) => {
  db = loadDB();

  const post = db.posts.find(p => p.id === req.params.id);
  const username = String(req.body.username || "").trim();

  if (!post || !username) {
    return res.status(400).json({
      error: "Données invalides"
    });
  }

  post.likes = post.likes || [];

  const index = post.likes.indexOf(username);

  if (index >= 0) {
    post.likes.splice(index, 1);
  } else {
    post.likes.push(username);

    if (post.username !== username) {
      db.notifications.push({
        id: Date.now().toString(36),
        username: post.username,
        text: `${username} a aimé votre publication.`,
        read: false,
        createdAt: Date.now()
      });
    }
  }

  saveDB(db);

  io.emit("postUpdated", post);

  res.json(post);
});

app.post("/api/posts/:id/comments", (req, res) => {
  db = loadDB();

  const post = db.posts.find(p => p.id === req.params.id);

  const username = String(req.body.username || "")
    .trim()
    .slice(0, 30);

  const content = String(req.body.content || "")
    .trim()
    .slice(0, 500);

  if (!post || !username || !content) {
    return res.status(400).json({
      error: "Commentaire invalide"
    });
  }

  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    postId: post.id,
    username,
    content,
    createdAt: Date.now()
  };

  db.comments.push(comment);

  if (post.username !== username) {
    db.notifications.push({
      id: Date.now().toString(36) + "c",
      username: post.username,
      text: `${username} a commenté votre publication.`,
      read: false,
      createdAt: Date.now()
    });
  }

  saveDB(db);

  io.emit("newComment", comment);

  res.json(comment);
});

app.get("/api/notifications/:username", (req, res) => {
  db = loadDB();

  const username = req.params.username.toLowerCase();

  const notifications = db.notifications
    .filter(n => n.username.toLowerCase() === username)
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json(notifications);
});

app.get("/api/search", (req, res) => {
  db = loadDB();

  const q = String(req.query.q || "").trim().toLowerCase();

  if (!q) {
    return res.json([]);
  }

  const results = db.posts
    .filter(post =>
      post.content.toLowerCase().includes(q) ||
      post.username.toLowerCase().includes(q)
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);

  res.json(results);
});

/* =========================
   CHAT
   ========================= */

const rooms = new Set([
  "Général",
  "Actualités",
  "Jeux",
  "Technologie",
  "Musique"
]);

const users = new Map();

function countRoom(room) {
  let total = 0;

  for (const user of users.values()) {
    if (user.room === room) total++;
  }

  return total;
}

io.on("connection", socket => {

  socket.on("join", ({ username, room = "Général" }) => {
    username = String(username || "Anonyme")
      .trim()
      .slice(0, 30) || "Anonyme";

    if (!rooms.has(room)) {
      room = "Général";
    }

    users.set(socket.id, {
      username,
      room
    });

    socket.join(room);

    socket.emit("joined", {
      username,
      room
    });

    socket.to(room).emit(
      "system",
      `${username} a rejoint le salon.`
    );

    io.to(room).emit(
      "online",
      countRoom(room)
    );
  });

  socket.on("changeRoom", room => {
    const user = users.get(socket.id);

    if (!user || !rooms.has(room)) {
      return;
    }

    socket.leave(user.room);

    socket.to(user.room).emit(
      "system",
      `${user.username} a quitté le salon.`
    );

    io.to(user.room).emit(
      "online",
      countRoom(user.room)
    );

    user.room = room;

    socket.join(room);

    socket.emit("roomChanged", room);

    socket.to(room).emit(
      "system",
      `${user.username} a rejoint le salon.`
    );

    io.to(room).emit(
      "online",
      countRoom(room)
    );
  });

  socket.on("message", text => {
    const user = users.get(socket.id);

    if (!user) return;

    const message = String(text || "")
      .trim()
      .slice(0, 500);

    if (!message) return;

    io.to(user.room).emit("message", {
      username: user.username,
      message,
      room: user.room,
      time: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (!user) return;

    users.delete(socket.id);

    socket.to(user.room).emit(
      "system",
      `${user.username} a quitté le salon.`
    );

    io.to(user.room).emit(
      "online",
      countRoom(user.room)
    );
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║         AGORAX SOCIAL 2.0            ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("📱 Réseau social actif");
  console.log("💬 Chat temps réel actif");
  console.log("❤️ Likes actifs");
  console.log("💬 Commentaires actifs");
  console.log("🖼️ Images actives");
  console.log("💾 Sauvegarde active");
  console.log("");
});
