console.log("=== AUTH.TS SCRIPT LOADING ===");

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

// Function to make authenticated requests
function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // With cookie-based authentication, the browser automatically sends cookies
  return fetch(url, options);
}

// Function to check authentication status from server
async function checkServerAuth(): Promise<boolean> {
  try {
    const response = await fetch("/check-auth");
    if (response.ok) {
      const data = await response.json();
      return data.authenticated;
    }
  } catch (error) {
    console.error("Auth check failed:", error);
  }
  return false;
}

// Function to redirect to login if not authenticated
async function redirectToLoginIfNotAuthenticated(): Promise<void> {
  try {
    const isAuth = await checkServerAuth();
    if (!isAuth) {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "/login";
  }
}

// Function to protect routes that require authentication
async function protectRoute(): Promise<void> {
  try {
    const isAuth = await checkServerAuth();
    if (!isAuth) {
      window.location.href = "/login";
      return;
    }
  } catch (error) {
    console.error("Route protection failed:", error);
    window.location.href = "/login";
  }
}

// Function to handle page load authentication
async function handlePageLoadAuth(): Promise<void> {
  try {
    const isAuth = await checkServerAuth();

    if (isAuth) {
      // If user is authenticated and on login/signup pages, redirect to chat
      if (
        window.location.pathname === "/login" ||
        window.location.pathname === "/signup"
      ) {
        // Add a small delay to prevent immediate redirect after logout
        setTimeout(() => {
          window.location.href = "/chat";
        }, 200);
        return;
      }
    } else {
      // Only redirect to login if not already there and not on home page
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/"
      ) {
        window.location.href = "/login";
      }
    }
  } catch (error) {
    console.error("Server auth check failed:", error);
  }
}

// Export for use in other modules
export {
  makeAuthenticatedRequest,
  checkServerAuth,
  redirectToLoginIfNotAuthenticated,
  protectRoute,
};

document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Auth script is running!");

  // Check authentication status when page loads
  handlePageLoadAuth();

  // Special handling for chat pages (including subpaths) to prevent flash
  if (window.location.pathname === "/chat" || window.location.pathname.startsWith("/chat/")) {
    try {
      const response = await fetch("/check-auth");
      if (!response.ok) {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Chat auth check failed:", error);
      window.location.href = "/login";
    }
  }

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    if (!username || !password) {
      alert("Username and password are required.");
      return;
    }

    const loginData: LoginData = {
      username: username.toString().trim(),
      password: password.toString().trim(),
    };

    // Disable form during submission
    const submitButton = form.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
    }

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: loginData.username,
          password: loginData.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Login successful, redirecting to:", data.redirect_url);
        window.location.replace(data.redirect_url);
      } else {
        const errorData = await response.json();
        alert(
          errorData.detail || "Login failed. Please check your credentials."
        );
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

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const signupData: SignupData = {
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("password2") as string,
    };

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
