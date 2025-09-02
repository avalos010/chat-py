interface User {
  username: string;
}

interface NotificationData {
  type: string;
  notification_type?: string;
  sender_username?: string;
  sender_id?: number;
  recipient_id?: number;
  conversation_id?: string;
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
  // Token is now stored in HttpOnly cookies, not accessible from JavaScript
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
    // With cookie-based auth, we'll check auth status from server
    this.initializeWebSocket();
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

    // Listen for conversation notification clearing
    document.addEventListener(
      "clearConversationNotifications",
      (event: any) => {
        const { conversationId } = event.detail;
        this.clearConversationNotifications(conversationId);
      }
    );
  }

  private async updateNavigation(): Promise<void> {
    try {
      // Check authentication status from server
      const response = await fetch("/api/user/me", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const userData = await response.json();
        this.showAuthenticatedState(userData.username);

        // Initialize WebSocket only if authenticated
        if (!this.ws) {
          this.initializeWebSocket();
        }
      } else {
        this.showUnauthenticatedState();

        // Close WebSocket if not authenticated
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      this.showUnauthenticatedState();

      // Close WebSocket on error
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  }

  private showAuthenticatedState(username?: string): void {
    if (this.authStatusElement) {
      this.authStatusElement.innerHTML = `
        <span class="text-sunset font-medium">${username || "User"}</span>
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

    // Hide About link for authenticated users (they get redirected anyway)
    const aboutLink = document.getElementById("nav-about");
    if (aboutLink) {
      aboutLink.classList.add("hidden");
      aboutLink.style.display = "none";
    }
  }

  private showUnauthenticatedState(): void {
    if (this.authStatusElement) {
      this.authStatusElement.innerHTML = ``;
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

    // Show About link for unauthenticated users
    const aboutLink = document.getElementById("nav-about");
    if (aboutLink) {
      aboutLink.classList.remove("hidden");
      aboutLink.style.display = "";
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

  private async initializeWebSocket(): Promise<void> {
    try {
      // Get auth token from server for WebSocket connection
      const tokenResponse = await fetch("/api/ws-token");
      if (!tokenResponse.ok) {
        console.error("Failed to get WebSocket token for navigation");
        return;
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      // Connect to WebSocket with token as query parameter
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;
      this.ws = new WebSocket(`${proto}://${host}/ws?token=${token}`);

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
    } catch (error) {
      console.error("Error initializing navigation WebSocket:", error);
    }
  }

  private handleWebSocketMessage(data: NotificationData): void {
    switch (data.type) {
      case "notification_update":
        if (data.notification_type === "new_message") {
          // Check if this message is for the currently open conversation
          const currentPath = window.location.pathname;
          const isInChat = currentPath.startsWith("/chat/");
          const currentConversationId = isInChat
            ? currentPath.split("/")[2]
            : null;

          const isForOpenConversation =
            currentConversationId &&
            data.conversation_id === currentConversationId;

          // Only show notifications if the conversation isn't currently open
          if (!isForOpenConversation) {
            this.notificationCounts.messages++;
            this.updateChatNotificationBadge();
            this.showToastNotification(
              `New message from ${data.sender_username}: ${data.message_preview}`
            );
          }
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

  private async handleLogout(): Promise<void> {
    try {
      await fetch("/logout", { method: "POST" });

      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Clear any lingering Supabase cookies
      document.cookie =
        "sb-rttctcyfriyzpllxyvju-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

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
      window.location.replace("/login");
    } catch (error) {
      // Clear storage even on error
      localStorage.clear();
      sessionStorage.clear();
      // Redirect anyway
      window.location.replace("/login");
    }
  }

  // Public method to trigger navigation update
  public refresh(): void {
    this.updateNavigation();
  }

  // Clear notifications for a specific conversation
  // Add field near notificationCounts
  // private conversationMessageCounts: Record<string, number> = {};
  // Update handlers where messages arrive:
  // this.conversationMessageCounts[data.conversation_id] = (this.conversationMessageCounts[data.conversation_id] || 0) + 1;
  // this.notificationCounts.messages = Object.values(this.conversationMessageCounts).reduce((a,b)=>a+b,0);

  private clearConversationNotifications(conversationId: string): void {
    // Reset count for this conversation and update global badge
    // Ensure the map exists
    // @ts-ignore - declared alongside notificationCounts
    if (!this.conversationMessageCounts) this.conversationMessageCounts = {};
    // @ts-ignore
    this.conversationMessageCounts[conversationId] = 0;
    // @ts-ignore
    this.notificationCounts.messages = Object.values(this.conversationMessageCounts).reduce((a, b) => a + b, 0);
    this.updateChatNotificationBadge();
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
