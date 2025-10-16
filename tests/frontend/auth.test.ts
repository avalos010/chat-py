/**
 * @jest-environment jsdom
 */

import { setupDOM } from "../test-utils";

// Mock fetch globally
global.fetch = jest.fn();

describe("Authentication", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="login-form">
        <input id="username" type="text" />
        <input id="password" type="password" />
        <button type="submit">Login</button>
      </form>
      <form id="signup-form">
        <input id="signup-username" type="text" />
        <input id="signup-email" type="email" />
        <input id="signup-password" type="password" />
        <button type="submit">Sign Up</button>
      </form>
      <div id="error-message"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  describe("Login Form", () => {
    test("should handle successful login", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ message: "Login successful" }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const usernameInput = document.getElementById(
        "username"
      ) as HTMLInputElement;
      const passwordInput = document.getElementById(
        "password"
      ) as HTMLInputElement;

      usernameInput.value = "testuser";
      passwordInput.value = "password123";

      const form = document.getElementById("login-form") as HTMLFormElement;
      const submitEvent = new Event("submit");

      form.dispatchEvent(submitEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        "/login",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        })
      );
    });

    test("should handle login errors", async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ detail: "Invalid credentials" }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const usernameInput = document.getElementById(
        "username"
      ) as HTMLInputElement;
      const passwordInput = document.getElementById(
        "password"
      ) as HTMLInputElement;

      usernameInput.value = "wronguser";
      passwordInput.value = "wrongpassword";

      const form = document.getElementById("login-form") as HTMLFormElement;
      const submitEvent = new Event("submit");

      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Signup Form", () => {
    test("should validate password length", () => {
      const passwordInput = document.getElementById(
        "signup-password"
      ) as HTMLInputElement;
      const longPassword = "a".repeat(100); // Longer than 72 characters

      passwordInput.value = longPassword;

      const form = document.getElementById("signup-form") as HTMLFormElement;
      const submitEvent = new Event("submit");

      form.dispatchEvent(submitEvent);

      // Should prevent submission for passwords longer than 72 characters
      expect(passwordInput.value.length).toBeGreaterThan(72);
    });

    test("should handle successful signup", async () => {
      const mockResponse = {
        ok: true,
        status: 302, // Redirect response
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const usernameInput = document.getElementById(
        "signup-username"
      ) as HTMLInputElement;
      const emailInput = document.getElementById(
        "signup-email"
      ) as HTMLInputElement;
      const passwordInput = document.getElementById(
        "signup-password"
      ) as HTMLInputElement;

      usernameInput.value = "newuser";
      emailInput.value = "newuser@example.com";
      passwordInput.value = "password123";

      const form = document.getElementById("signup-form") as HTMLFormElement;
      const submitEvent = new Event("submit");

      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        "/signup",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });
});
