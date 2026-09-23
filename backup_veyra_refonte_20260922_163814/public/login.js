const loginView = document.querySelector("#loginView");
const registerView = document.querySelector("#registerView");

document.querySelector("#showRegister").onclick = () => {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
};

document.querySelector("#showLogin").onclick = () => {
  registerView.classList.add("hidden");
  loginView.classList.remove("hidden");
};

document.querySelector("#loginForm").onsubmit = async e => {
  e.preventDefault();

  const error = document.querySelector("#loginError");
  error.textContent = "";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: document.querySelector("#loginIdentifier").value.trim(),
        password: document.querySelector("#loginPassword").value
      })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Connexion impossible.");

    location.href = "/";
  } catch (err) {
    error.textContent = err.message;
  }
};

document.querySelector("#registerForm").onsubmit = async e => {
  e.preventDefault();

  const error = document.querySelector("#registerError");
  error.textContent = "";

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.querySelector("#registerUsername").value.trim(),
        email: document.querySelector("#registerEmail").value.trim(),
        age: Number(document.querySelector("#registerAge").value),
        password: document.querySelector("#registerPassword").value
      })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Inscription impossible.");

    location.href = "/";
  } catch (err) {
    error.textContent = err.message;
  }
};
