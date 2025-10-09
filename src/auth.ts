import Toast from "./toast.js";

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

// No longer need client-side redirects - server handles all authentication redirects

// Export for use in other modules
export { makeAuthenticatedRequest, checkServerAuth };

document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Auth script is running!");

  // Server now handles all redirects - no client-side redirect checks needed

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    if (!username || !password) {
      Toast.error("Username and password are required.");
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
        Toast.success("Login successful!");
        setTimeout(() => {
          window.location.replace(data.redirect_url);
        }, 500);
      } else {
        const errorData = await response.json();
        Toast.error(
          errorData.detail || "Login failed. Please check your credentials."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      Toast.error("An error occurred during login. Please try again.");
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
      Toast.error("Username is required.");
      return;
    }
    if (!signupData.email || signupData.email.trim() === "") {
      Toast.error("Email is required.");
      return;
    }
    if (!signupData.password || signupData.password.length < 6) {
      Toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (signupData.password.length > 72) {
      Toast.error("Password must be less than 72 characters.");
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      Toast.error("Passwords do not match.");
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
        Toast.success("Signup successful! Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      } else {
        const errorData = await response.text();
        console.error("Signup failed:", errorData);
        Toast.error("Signup failed. Please try again.");
      }
    } catch (error) {
      console.error("Signup error:", error);
      Toast.error("An error occurred during signup. Please try again.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign up";
      }
    }
  });
});
