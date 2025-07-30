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

document.addEventListener("DOMContentLoaded", () => {
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
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        window.location.href = "/";
      } else {
        alert("Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
    }
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
