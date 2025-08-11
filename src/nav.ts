interface User {
  username: string;
}

class NavigationManager {
  private authStatusElement: HTMLElement | null;
  private authButtonsElement: HTMLElement | null;
  private navSignoutElement: HTMLElement | null;
  private navDashboardElement: HTMLElement | null;
  private navChatElement: HTMLElement | null;

  constructor() {
    this.authStatusElement = document.getElementById("auth-status");
    this.authButtonsElement = document.getElementById("auth-buttons");
    this.navSignoutElement = document.getElementById("nav-signout");
    this.navDashboardElement = document.getElementById("nav-dashboard");
    this.navChatElement = document.getElementById("nav-chat");
    this.initialize();
  }

  private initialize(): void {
    this.updateNavigation();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for storage changes (when token is added/removed)
    window.addEventListener("storage", () => {
      this.updateNavigation();
    });

    // Also update when auth state changes locally
    document.addEventListener("authStateChanged", () => {
      this.updateNavigation();
    });
  }

  private updateNavigation(): void {
    const token = localStorage.getItem("token");

    if (token) {
      this.showAuthenticatedState();
    } else {
      this.showUnauthenticatedState();
    }
  }

  private showAuthenticatedState(): void {
    if (this.authStatusElement) {
      this.authStatusElement.innerHTML = `
        <span class="text-green-400">✓ Authenticated</span>
      `;
    }

    if (this.authButtonsElement) {
      this.authButtonsElement.innerHTML = `
        <a href="/dashboard" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Dashboard
        </a>
        <button 
          id="authLogoutBtn" 
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors ml-2"
        >
          Sign Out
        </button>
      `;
      this.authButtonsElement.classList.remove("hidden");

      // Add logout event listener for the signout button
      const authLogoutBtn = document.getElementById("authLogoutBtn");
      if (authLogoutBtn) {
        authLogoutBtn.addEventListener("click", this.handleLogout.bind(this));
      }
    }

    // Show protected navigation links
    if (this.navDashboardElement) {
      this.navDashboardElement.classList.remove("hidden");
    }
    if (this.navChatElement) {
      this.navChatElement.classList.remove("hidden");
    }

    // Hide the nav-signout div since we only need one signout button
    if (this.navSignoutElement) {
      this.navSignoutElement.classList.add("hidden");
    }
  }

  private showUnauthenticatedState(): void {
    if (this.authStatusElement) {
      this.authStatusElement.innerHTML = `
        <span class="text-gray-400">Not authenticated</span>
      `;
    }

    if (this.authButtonsElement) {
      this.authButtonsElement.innerHTML = `
        <a 
          href="/login" 
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Sign In
        </a>
        <a 
          href="/signup" 
          class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors ml-2"
        >
          Sign Up
        </a>
      `;
      this.authButtonsElement.classList.remove("hidden");
    }

    // Hide protected navigation links
    if (this.navDashboardElement) {
      this.navDashboardElement.classList.add("hidden");
    }
    if (this.navChatElement) {
      this.navChatElement.classList.add("hidden");
    }
  }

  private handleLogout(): void {
    localStorage.removeItem("token");

    // Dispatch custom event to notify other components
    document.dispatchEvent(new CustomEvent("authStateChanged"));

    // Redirect to login page
    window.location.href = "/login";
  }

  // Public method to trigger navigation update
  public refresh(): void {
    this.updateNavigation();
  }
}

// Initialize navigation when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new NavigationManager();
});

// Export for use in other modules
export { NavigationManager };
