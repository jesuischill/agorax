const socket = io();

const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");
const usernameInput = document.getElementById("username");
const enterBtn = document.getElementById("enterBtn");
const roomsEl = document.getElementById("rooms");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const roomName = document.getElementById("roomName");
const online = document.getElementById("online");
const profileName = document.getElementById("profileName");
const avatar = document.getElementById("avatar");

let username = "";
let currentRoom = "Général";

enterBtn.addEventListener("click", join);
usernameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") join();
});

async function join() {
  const name = usernameInput.value.trim();

  if (!name) {
    usernameInput.focus();
    return;
  }

  username = name.slice(0, 30);

  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");

  profileName.textContent = username;
  avatar.textContent = username.charAt(0).toUpperCase();

  const response = await fetch("/api/rooms");
  const rooms = await response.json();

  renderRooms(rooms);
  socket.emit("join", { username, room: currentRoom });
  messageInput.focus();
}

function renderRooms(rooms) {
  roomsEl.innerHTML = "";

  rooms.forEach(room => {
    const button = document.createElement("button");
    button.className = "room" + (room === currentRoom ? " active" : "");
    button.textContent = "# " + room;

    button.addEventListener("click", () => {
      if (room === currentRoom) return;

      currentRoom = room;
      messagesEl.innerHTML = "";
      roomName.textContent = room;

      document.querySelectorAll(".room").forEach(r => r.classList.remove("active"));
      button.classList.add("active");

      socket.emit("changeRoom", room);
      messageInput.focus();
    });

    roomsEl.appendChild(button);
  });
}

form.addEventListener("submit", e => {
  e.preventDefault();

  const text = messageInput.value.trim();

  if (!text) return;

  socket.emit("message", text);
  messageInput.value = "";
  messageInput.focus();
});

socket.on("message", data => {
  addMessage(data);
});

socket.on("system", text => {
  const div = document.createElement("div");
  div.className = "system";
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollMessages();
});

socket.on("online", count => {
  online.textContent = count;
});

socket.on("roomChanged", room => {
  currentRoom = room;
  roomName.textContent = room;
});

function addMessage(data) {
  const article = document.createElement("article");
  article.className = "message";

  const messageAvatar = document.createElement("div");
  messageAvatar.className = "message-avatar";
  messageAvatar.textContent = data.username.charAt(0).toUpperCase();

  const content = document.createElement("div");

  const head = document.createElement("div");
  head.className = "message-head";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = data.username;

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = data.time;

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = data.message;

  head.appendChild(name);
  head.appendChild(time);

  content.appendChild(head);
  content.appendChild(text);

  article.appendChild(messageAvatar);
  article.appendChild(content);

  messagesEl.appendChild(article);
  scrollMessages();
}

function scrollMessages() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


/* EMOJIS */

const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");

emojiBtn.addEventListener("click", event => {
  event.stopPropagation();
  emojiPicker.classList.toggle("hidden");
});

emojiPicker.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", () => {
    messageInput.value += button.textContent;
    messageInput.focus();
  });
});

document.addEventListener("click", event => {
  if (!emojiPicker.contains(event.target) && event.target !== emojiBtn) {
    emojiPicker.classList.add("hidden");
  }
});
