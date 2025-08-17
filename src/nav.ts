interface User {
  username: string;
}

class NavigationManager {
  private authStatusElement: HTMLElement | null;
  private authButtonsElement: HTMLElement | null;
  private navSignoutElement: HTMLElement | null;
  private navChatElement: HTMLElement | null;
  private navFriendsElement: HTMLElement | null;

  constructor() {
    this.authStatusElement = document.getElementById("auth-status");
    this.authButtonsElement = document.getElementById("auth-buttons");
    this.navSignoutElement = document.getElementById("nav-signout");
    this.navChatElement = document.getElementById("nav-chat");
    this.navFriendsElement = document.getElementById("nav-friends");
    this.initialize();
  }

  private initialize(): void {
    // Hide protected routes by default
    this.hideProtectedRoutes();

    // Small delay to ensure DOM is fully ready, then update navigation
    setTimeout(() => {
      this.updateNavigation();
    }, 100);

    this.setupEventListeners();
  }

  private hideProtectedRoutes(): void {
    // Ensure protected routes are hidden by default using both class and style
    if (this.navChatElement) {
      this.navChatElement.classList.add("hidden");
      this.navChatElement.style.display = "none";
    }
    if (this.navFriendsElement) {
      this.navFriendsElement.classList.add("hidden");
      this.navFriendsElement.style.display = "none";
    }
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
        <button 
          id="authLogoutBtn" 
          class="bg-penn-red hover:bg-penn-red/90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors ml-2"
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
    if (this.navChatElement) {
      this.navChatElement.classList.remove("hidden");
      this.navChatElement.style.display = "";
    }
    if (this.navFriendsElement) {
      this.navFriendsElement.classList.remove("hidden");
      this.navFriendsElement.style.display = "";
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
          class="bg-space-cadet hover:bg-space-cadet/90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Sign In
        </a>
        <a 
          href="/signup" 
          class="bg-sunset hover:bg-sunset/90 text-raisin-black px-4 py-2 rounded-md text-sm font-medium transition-colors ml-2"
        >
          Sign Up
        </a>
      `;
      this.authButtonsElement.classList.remove("hidden");
    }

    // Explicitly hide protected navigation links for unauthenticated users
    if (this.navChatElement) {
      this.navChatElement.classList.add("hidden");
      this.navChatElement.style.display = "none";
    }
    if (this.navFriendsElement) {
      this.navFriendsElement.classList.add("hidden");
      this.navFriendsElement.style.display = "none";
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
  const navManager = new NavigationManager();

  // Force refresh navigation state after a short delay to handle any edge cases
  setTimeout(() => {
    navManager.refresh();
  }, 200);
});

// Export for use in other modules
export { NavigationManager };
