// src/auth.ts
console.log("=== AUTH.TS SCRIPT LOADING ===");
console.log("Script is executing...");
console.log("About to define interfaces...");
function makeAuthenticatedRequest(url, options = {}) {
  const token = localStorage.getItem("token");
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    };
  }
  return fetch(url, options);
}
function setupAuthInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    const token = localStorage.getItem("token");
    if (token && typeof url === "string" && !url.includes("/token") && !url.includes("/signup")) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`
      };
    }
    return originalFetch(url, options);
  };
}
async function checkServerAuth() {
  console.log("=== checkServerAuth called ===");
  const token = localStorage.getItem("token");
  console.log(
    "Token in checkServerAuth:",
    token ? token.substring(0, 20) + "..." : "null"
  );
  try {
    console.log("Making request to /check-auth...");
    const response = await makeAuthenticatedRequest("/check-auth");
    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);
    console.log("Response headers:", response.headers);
    if (response.ok) {
      const data = await response.json();
      console.log("Response data:", data);
      return data.authenticated;
    } else {
      console.log("Response not ok, status:", response.status);
      const errorText = await response.text();
      console.log("Error response body:", errorText);
    }
  } catch (error) {
    console.error("Auth check failed:", error);
  }
  return false;
}
async function protectRoute() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return;
  }
  try {
    const isAuth = await checkServerAuth();
    if (!isAuth) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }
  } catch (error) {
    console.error("Route protection failed:", error);
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}
async function handlePageLoadAuth() {
  console.log("=== handlePageLoadAuth called ===");
  const token = localStorage.getItem("token");
  console.log("Token found:", !!token);
  if (token) {
    console.log("Checking server auth...");
    const isAuth = await checkServerAuth();
    console.log("Server auth result:", isAuth);
    if (isAuth) {
      console.log("User is authenticated, checking if redirect needed...");
      console.log("Current pathname:", window.location.pathname);
      console.log(
        "Should redirect to dashboard?",
        window.location.pathname === "/" || window.location.pathname === "/login"
      );
      if (window.location.pathname === "/" || window.location.pathname === "/login") {
        console.log("Redirecting to dashboard from:", window.location.pathname);
        const token2 = localStorage.getItem("token");
        if (token2) {
          console.log("Pre-verifying authentication...");
          try {
            const authResponse = await fetch("/check-auth", {
              headers: {
                Authorization: `Bearer ${token2}`
              }
            });
            if (authResponse.ok) {
              console.log(
                "Authentication verified, redirecting to dashboard..."
              );
              window.location.href = `/dashboard?token=${encodeURIComponent(
                token2
              )}`;
            } else {
              console.log(
                "Authentication failed, clearing token and staying on login"
              );
              localStorage.removeItem("token");
              document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            }
          } catch (error) {
            console.error("Auth check failed:", error);
            localStorage.removeItem("token");
            document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          }
        } else {
          window.location.href = "/dashboard";
        }
      } else {
        console.log(
          "No redirect needed, current path:",
          window.location.pathname
        );
        console.log("User is already on a protected page");
        console.log("Current page:", window.location.href);
      }
    } else {
      console.log("Token is invalid, clearing it");
      localStorage.removeItem("token");
    }
  } else {
    console.log("No token found, staying on current page");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded - Auth script is running!");
  console.log("Window location:", window.location.href);
  console.log("Document ready state:", document.readyState);
  setupAuthInterceptor();
  console.log("About to call handlePageLoadAuth...");
  handlePageLoadAuth();
  if (window.location.pathname === "/dashboard") {
    console.log("Dashboard page detected, checking auth immediately...");
    const token = localStorage.getItem("token");
    if (token) {
      const loginRedirect = document.getElementById("login-redirect");
      if (loginRedirect) {
        loginRedirect.classList.remove("hidden");
      }
      fetch("/check-auth", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }).then((response) => {
        if (response.ok) {
          console.log("Dashboard auth successful");
          if (loginRedirect) {
            loginRedirect.classList.add("hidden");
          }
        } else {
          console.log("Dashboard auth failed, redirecting to login");
          window.location.href = "/login";
        }
      }).catch((error) => {
        console.error("Dashboard auth check failed:", error);
        window.location.href = "/login";
      });
    } else {
      console.log("No token found, redirecting to login");
      window.location.href = "/login";
    }
  }
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  console.log("Login form found:", !!loginForm);
  console.log("Signup form found:", !!signupForm);
  loginForm?.addEventListener("submit", async (e) => {
    console.log("=== LOGIN FORM SUBMITTED ===");
    console.log("Event type:", e.type);
    console.log("Default prevented:", e.defaultPrevented);
    e.preventDefault();
    console.log(
      "Default prevented after preventDefault():",
      e.defaultPrevented
    );
    const form = e.target;
    console.log("Form element:", form);
    console.log("Form action:", form.action);
    console.log("Form method:", form.method);
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");
    console.log("Form data:", {
      username,
      password: password ? "[HIDDEN]" : "undefined"
    });
    if (!username || typeof username !== "string" || username.trim() === "") {
      alert("Username is required.");
      return;
    }
    if (!password || typeof password !== "string" || password.trim() === "") {
      alert("Password is required.");
      return;
    }
    const loginData = {
      username: username.trim(),
      password: password.trim()
    };
    const submitButton = form.querySelector(
      'button[type="submit"]'
    );
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
    }
    console.log("Sending login request to /token");
    try {
      const response = await fetch("/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(loginData)
      });
      console.log("Login response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Login successful, token received:", data);
        localStorage.setItem("token", data.access_token);
        document.cookie = `auth_token=${data.access_token}; path=/; max-age=1800; SameSite=Strict`;
        console.log("Redirecting to dashboard...");
        console.log("Current location before redirect:", window.location.href);
        try {
          window.location.replace("/dashboard");
        } catch (error) {
          console.error("Redirect failed:", error);
          window.location.href = "/dashboard";
        }
      } else {
        const errorData = await response.text();
        console.error("Login failed:", errorData);
        alert("Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login. Please try again.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign in";
      }
    }
  });
  const logoutButton = document.getElementById("logoutButton");
  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  });
  signupForm?.addEventListener("submit", async (e) => {
    console.log("Signup form submitted");
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const signupData = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("password2")
    };
    console.log("Signup data:", {
      username: signupData.username,
      email: signupData.email,
      password: signupData.password ? "[HIDDEN]" : "undefined",
      confirmPassword: signupData.confirmPassword ? "[HIDDEN]" : "undefined"
    });
    if (!signupData.username || signupData.username.trim() === "") {
      alert("Username is required.");
      return;
    }
    if (!signupData.email || signupData.email.trim() === "") {
      alert("Email is required.");
      return;
    }
    if (!signupData.password || signupData.password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    const submitButton = form.querySelector(
      'button[type="submit"]'
    );
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing up...";
    }
    console.log("Sending signup request to /signup");
    try {
      const response = await fetch("/signup", {
        method: "POST",
        body: JSON.stringify(signupData),
        headers: {
          "Content-Type": "application/json"
        }
      });
      console.log("Signup response status:", response.status);
      if (response.ok) {
        alert("Signup successful! You can now log in.");
        window.location.href = "/login";
      } else {
        const errorData = await response.text();
        console.error("Signup failed:", errorData);
        alert("Signup failed. Please try again.");
      }
    } catch (error) {
      console.error("Signup error:", error);
      alert("An error occurred during signup. Please try again.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign up";
      }
    }
  });
});

// src/chat.ts
var ChatApp = class {
  constructor() {
    this.ws = null;
    this.messageInput = document.getElementById(
      "messageText"
    );
    this.sendButton = document.getElementById(
      "sendButton"
    );
    this.messagesContainer = document.getElementById(
      "messages"
    );
    if (!this.messageInput || !this.sendButton || !this.messagesContainer) {
      throw new Error("Required DOM elements not found");
    }
    this.initialize();
  }
  async initialize() {
    await protectRoute();
    this.initializeWebSocket();
    this.addEventListeners();
  }
  initializeWebSocket() {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No token found for WebSocket connection");
      return;
    }
    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
    this.ws.onmessage = (event) => {
      if (!this.messagesContainer) return;
      const message = document.createElement("div");
      message.className = "p-3 bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5";
      message.textContent = event.data;
      this.messagesContainer.appendChild(message);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    };
    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }
  sendMessage() {
    if (!this.messageInput || !this.ws) return;
    const message = this.messageInput.value.trim();
    if (message) {
      this.ws.send(message);
      this.messageInput.value = "";
    }
  }
  addEventListeners() {
    if (!this.sendButton || !this.messageInput) return;
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
  }
};
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
