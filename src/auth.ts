console.log("=== AUTH.TS SCRIPT LOADING ===");
console.log("Script is executing...");
console.log("About to define interfaces...");

interface LoginData {
  username: string;
  password: string;
}

interface SignupData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

// Function to make authenticated requests
function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("token");
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return fetch(url, options);
}

// Override fetch to automatically add Authorization header
function setupAuthInterceptor(): void {
  const originalFetch = window.fetch;
  window.fetch = function (
    url: string | Request | URL,
    options: RequestInit = {}
  ) {
    const token = localStorage.getItem("token");
    if (
      token &&
      typeof url === "string" &&
      !url.includes("/token") &&
      !url.includes("/signup")
    ) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return originalFetch(url, options);
  };
}

// Function to check if user is authenticated
function isAuthenticated(): boolean {
  return localStorage.getItem("token") !== null;
}

// Function to redirect to login if not authenticated
function redirectToLoginIfNotAuthenticated(): void {
  if (!isAuthenticated()) {
    window.location.href = "/login";
  }
}

// Function to check authentication status from server
async function checkServerAuth(): Promise<boolean> {
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

// Function to protect routes that require authentication
async function protectRoute(): Promise<void> {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    // Verify token is valid by checking server auth
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

// Function to handle page load authentication
async function handlePageLoadAuth(): Promise<void> {
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

      // If user is authenticated and on login/signup pages, redirect to chat
      if (
        window.location.pathname === "/login" ||
        window.location.pathname === "/signup"
      ) {
        console.log(
          "User is authenticated, redirecting from login/signup to chat"
        );
        window.location.href = "/chat";
        return;
      }
    } else {
      console.log("Token is invalid, clearing it");
      localStorage.removeItem("token");
    }
  } else {
    console.log("No token found, staying on current page");
  }
}

// Export for use in other modules
export {
  makeAuthenticatedRequest,
  isAuthenticated,
  redirectToLoginIfNotAuthenticated,
  checkServerAuth,
  protectRoute,
};

document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Auth script is running!");
  console.log("Window location:", window.location.href);
  console.log("Document ready state:", document.readyState);

  // Setup automatic Authorization header injection
  setupAuthInterceptor();

  // Check authentication status when page loads
  console.log("About to call handlePageLoadAuth...");
  handlePageLoadAuth();

  // Special handling for chat page to prevent flash
  if (window.location.pathname === "/chat") {
    console.log("Chat page detected, checking auth immediately...");
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await fetch("/check-auth", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          console.log("Chat auth successful");
          // User is authenticated, show the page
        } else {
          console.log("Chat auth failed, redirecting to login");
          window.location.href = "/login";
        }
      } catch (error) {
        console.error("Chat auth check failed:", error);
        window.location.href = "/login";
      }
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

    const form = e.target as HTMLFormElement;
    console.log("Form element:", form);
    console.log("Form action:", form.action);
    console.log("Form method:", form.method);
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    console.log("Form data:", {
      username,
      password: password ? "[HIDDEN]" : "undefined",
    });

    // Validate form data
    if (!username || typeof username !== "string" || username.trim() === "") {
      alert("Username is required.");
      return;
    }
    if (!password || typeof password !== "string" || password.trim() === "") {
      alert("Password is required.");
      return;
    }
    const loginData: LoginData = {
      username: username.trim(),
      password: password.trim(),
    };

    // Disable form during submission
    const submitButton = form.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
    }

    console.log("Sending login request to /token");
    try {
      const response = await fetch("/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      console.log("Login response status:", response.status);
      if (response.ok) {
        const data: TokenResponse = await response.json();
        console.log("Login successful, token received:", data);
        localStorage.setItem("token", data.access_token);

        // Also set a cookie for server-side authentication
        document.cookie = `auth_token=${data.access_token}; path=/; max-age=1800; SameSite=Strict`;

        // Redirect to chat after successful login
        console.log("Redirecting to chat...");
        // Use replace to prevent back button from going to login
        window.location.replace("/chat");
      } else {
        console.log("Login failed, staying on login page");
        // Redirect to chat page
        window.location.href = "/chat";
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login. Please try again.");
    } finally {
      // Re-enable form
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign in";
      }
    }
  });

  // Add logout functionality
  const logoutButton = document.getElementById("logoutButton");
  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  });

  signupForm?.addEventListener("submit", async (e) => {
    console.log("Signup form submitted");
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const signupData: SignupData = {
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("password2") as string,
    };

    console.log("Signup data:", {
      username: signupData.username,
      email: signupData.email,
      password: signupData.password ? "[HIDDEN]" : "undefined",
      confirmPassword: signupData.confirmPassword ? "[HIDDEN]" : "undefined",
    });

    // Validate signup data
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

    // Disable form during submission
    const submitButton = form.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
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
          "Content-Type": "application/json",
        },
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
      // Re-enable form
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign up";
      }
    }
  });
});
