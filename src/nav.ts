interface User {
  username: string;
}

interface NotificationData {
  type: string;
  notification_type?: string;
  sender_username?: string;
  sender_id?: number;
  message_preview?: string;
  timestamp: string;
  // Friend request specific fields
  request_type?: string;
  recipient_username?: string;
  // User status specific fields
  username?: string;
  status?: string;
}

class NavigationManager {
  private authStatusElement: HTMLElement | null;
  private authButtonsElement: HTMLElement | null;
  private navSignoutElement: HTMLElement | null;
  private navChatElement: HTMLElement | null;
  private navFriendsElement: HTMLElement | null;
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private notificationCounts = {
    messages: 0,
    friendRequests: 0,
  };

  constructor() {
    this.authStatusElement = document.getElementById("auth-status");
    this.authButtonsElement = document.getElementById("auth-buttons");
    this.navSignoutElement = document.getElementById("nav-signout");
    this.navChatElement = document.getElementById("nav-chat");
    this.navFriendsElement = document.getElementById("nav-friends");
    this.token = localStorage.getItem("token");
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

    // Initialize WebSocket if authenticated
    if (this.token) {
      this.initializeWebSocket();
    }
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
      // Initialize WebSocket if not already done
      if (!this.ws) {
        this.token = token;
        this.initializeWebSocket();
      }
    } else {
      this.showUnauthenticatedState();
      // Close WebSocket if authenticated
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
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

    // Show protected navigation links with notification badges
    if (this.navChatElement) {
      this.navChatElement.classList.remove("hidden");
      this.navChatElement.style.display = "";
      this.updateChatNotificationBadge();
    }
    if (this.navFriendsElement) {
      this.navFriendsElement.classList.remove("hidden");
      this.navFriendsElement.style.display = "";
      this.updateFriendsNotificationBadge();
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

  private initializeWebSocket(): void {
    if (!this.token) return;

    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${this.token}`);

    this.ws.onopen = () => {
      console.log("Navigation WebSocket connected");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data: NotificationData = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("Navigation WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("Navigation WebSocket connection closed");
    };
  }

  private handleWebSocketMessage(data: NotificationData): void {
    switch (data.type) {
      case "notification_update":
        if (data.notification_type === "new_message") {
          this.notificationCounts.messages++;
          this.updateChatNotificationBadge();
          this.showToastNotification(
            `New message from ${data.sender_username}: ${data.message_preview}`
          );
        }
        break;

      case "friend_request_update":
        if (data.request_type === "sent") {
          this.notificationCounts.friendRequests++;
          this.updateFriendsNotificationBadge();
          this.showToastNotification(
            `Friend request sent to ${data.recipient_username}`
          );
        } else if (data.request_type === "received") {
          this.notificationCounts.friendRequests++;
          this.updateFriendsNotificationBadge();
          this.showToastNotification(
            `New friend request from ${data.sender_username}`
          );
        } else if (data.request_type === "accepted") {
          this.showToastNotification(
            `${data.sender_username} accepted your friend request!`
          );
        } else if (data.request_type === "rejected") {
          this.showToastNotification(
            `${data.sender_username} declined your friend request`
          );
        }
        break;

      case "user_status_update":
        // Handle user online/offline status updates
        console.log(`User ${data.username} is now ${data.status}`);
        break;
    }
  }

  private updateChatNotificationBadge(): void {
    if (!this.navChatElement) return;

    let badge = this.navChatElement.querySelector(".notification-badge");
    if (!badge) {
      // Create badge if it doesn't exist
      badge = document.createElement("span");
      badge.className =
        "notification-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center";
      this.navChatElement.style.position = "relative";
      this.navChatElement.appendChild(badge);
    }

    if (this.notificationCounts.messages > 0) {
      badge.textContent = this.notificationCounts.messages.toString();
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  private updateFriendsNotificationBadge(): void {
    if (!this.navFriendsElement) return;

    let badge = this.navFriendsElement.querySelector(".notification-badge");
    if (!badge) {
      // Create badge if it doesn't exist
      badge = document.createElement("span");
      badge.className =
        "notification-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center";
      this.navFriendsElement.style.position = "relative";
      this.navFriendsElement.appendChild(badge);
    }

    if (this.notificationCounts.friendRequests > 0) {
      badge.textContent = this.notificationCounts.friendRequests.toString();
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  private showToastNotification(message: string): void {
    // Create toast notification
    const toast = document.createElement("div");
    toast.className =
      "fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full";
    toast.textContent = message;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove("translate-x-full");
    }, 100);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.classList.add("translate-x-full");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  public clearMessageNotifications(): void {
    this.notificationCounts.messages = 0;
    this.updateChatNotificationBadge();
  }

  public clearFriendRequestNotifications(): void {
    this.notificationCounts.friendRequests = 0;
    this.updateFriendsNotificationBadge();
  }

  private handleLogout(): void {
    localStorage.removeItem("token");

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reset notification counts
    this.notificationCounts = { messages: 0, friendRequests: 0 };

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
