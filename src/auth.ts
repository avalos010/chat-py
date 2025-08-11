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
  redirect_url?: string;
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
  try {
    const response = await makeAuthenticatedRequest("/check-auth");
    if (response.ok) {
      const data = await response.json();
      return data.authenticated;
    }
  } catch (error) {
    console.error("Auth check failed:", error);
  }
  return false;
}

// Function to handle page load authentication
async function handlePageLoadAuth(): Promise<void> {
  const token = localStorage.getItem("token");
  if (token) {
    // Check if token is valid on server
    const isAuth = await checkServerAuth();
    if (isAuth) {
      // User is authenticated, redirect to dashboard
      if (
        window.location.pathname === "/" ||
        window.location.pathname === "/login"
      ) {
        window.location.href = "/dashboard";
      }
    } else {
      // Token is invalid, clear it and stay on current page
      localStorage.removeItem("token");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Setup automatic Authorization header injection
  setupAuthInterceptor();

  // Check authentication status when page loads
  handlePageLoadAuth();

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const username = formData.get("username");
    const password = formData.get("password");

    if (typeof username !== "string") {
      throw new Error("Username is required.");
    }
    if (typeof password !== "string") {
      throw new Error("Password is required.");
    }
    const loginData: LoginData = {
      username,
      password,
    };
    try {
      const response = await fetch("/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        const data: TokenResponse = await response.json();
        localStorage.setItem("token", data.access_token);
        // Redirect to dashboard after successful login
        window.location.href = data.redirect_url || "/dashboard";
      } else {
        alert("Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  });

  // Add logout functionality
  const logoutButton = document.getElementById("logoutButton");
  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const signupData: SignupData = {
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("password2") as string,
    };

    if (signupData.password !== signupData.confirmPassword) {
      alert("Passwords do not match.");
      throw new Error("Passwords do not match.");
    }

    try {
      const response = await fetch("/signup", {
        method: "POST",
        body: JSON.stringify(signupData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        alert("Signup successful! You can now log in.");
        window.location.href = "/login";
      } else {
        alert("Signup failed. Please try again.");
      }
    } catch (error) {
      console.error("Signup error:", error);
    }
  });
});
