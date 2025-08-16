interface ChatMessage {
  text: string;
  timestamp: string;
  sender: string;
}

interface Friend {
  friend_id: number;
  username: string;
  email: string;
}

class ChatApp {
  private ws: WebSocket | null = null;
  private messageInput: HTMLInputElement | null;
  private sendButton: HTMLButtonElement | null;
  private messagesContainer: HTMLDivElement | null;
  private noMessagesElement: HTMLDivElement | null;
  private friendsListElement: HTMLDivElement | null;
  private friendsLoadingElement: HTMLDivElement | null;
  private noFriendsElement: HTMLDivElement | null;
  private connectionStatusElement: HTMLSpanElement | null;
  private userInfoElement: HTMLSpanElement | null;
  private token: string | null = null;

  constructor() {
    this.messageInput = document.getElementById(
      "messageText"
    ) as HTMLInputElement;
    this.sendButton = document.getElementById(
      "sendButton"
    ) as HTMLButtonElement;
    this.messagesContainer = document.getElementById(
      "messages"
    ) as HTMLDivElement;
    this.noMessagesElement = document.getElementById(
      "noMessages"
    ) as HTMLDivElement;
    this.friendsListElement = document.getElementById(
      "friendsList"
    ) as HTMLDivElement;
    this.friendsLoadingElement = document.getElementById(
      "friendsLoading"
    ) as HTMLDivElement;
    this.noFriendsElement = document.getElementById(
      "noFriends"
    ) as HTMLDivElement;
    this.connectionStatusElement = document.getElementById(
      "connectionStatus"
    ) as HTMLSpanElement;
    this.userInfoElement = document.getElementById(
      "userInfo"
    ) as HTMLSpanElement;

    if (!this.messageInput || !this.sendButton || !this.messagesContainer) {
      throw new Error("Required DOM elements not found");
    }

    this.token = localStorage.getItem("token");
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check authentication first
    await this.checkAuthentication();

    // Load friends list
    this.loadFriendsList();

    // Initialize WebSocket with authentication
    this.initializeWebSocket();
    this.addEventListeners();

    // Set user info
    this.setUserInfo();
  }

  private async checkAuthentication(): Promise<void> {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/check-auth", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }
  }

  private async loadFriendsList(): Promise<void> {
    try {
      const response = await fetch("/api/friends", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.displayFriends(data.friends);
      } else {
        console.error("Failed to load friends");
        this.showNoFriends();
      }
    } catch (error) {
      console.error("Error loading friends:", error);
      this.showNoFriends();
    }
  }

  private displayFriends(friends: Friend[]): void {
    if (
      !this.friendsListElement ||
      !this.friendsLoadingElement ||
      !this.noFriendsElement
    )
      return;

    // Hide loading
    this.friendsLoadingElement.classList.add("hidden");

    if (friends.length === 0) {
      this.noFriendsElement.classList.remove("hidden");
      return;
    }

    // Show friends list
    this.friendsListElement.classList.remove("hidden");
    this.noFriendsElement.classList.add("hidden");

    // Clear existing friends
    this.friendsListElement.innerHTML = "";

    // Add friends
    friends.forEach((friend) => {
      const friendElement = this.createFriendElement(friend);
      this.friendsListElement!.appendChild(friendElement);
    });
  }

  private showNoFriends(): void {
    if (!this.friendsLoadingElement || !this.noFriendsElement) return;

    this.friendsLoadingElement.classList.add("hidden");
    this.noFriendsElement.classList.remove("hidden");
  }

  private createFriendElement(friend: Friend): HTMLElement {
    const template = document.getElementById(
      "friendTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set friend info
    const avatar = element.querySelector(".w-8.h-8") as HTMLElement;
    const username = element.querySelector("p:first-of-type") as HTMLElement;
    const email = element.querySelector("p:last-of-type") as HTMLElement;

    if (avatar) avatar.textContent = friend.username.charAt(0).toUpperCase();
    if (username) username.textContent = friend.username;
    if (email) email.textContent = friend.email;

    // Add click handler for friend selection
    element.addEventListener("click", () => {
      this.selectFriend(friend);
    });

    return element;
  }

  private selectFriend(friend: Friend): void {
    // Update UI to show selected friend
    console.log(`Selected friend: ${friend.username}`);
    // TODO: Implement friend selection logic for private messaging
  }

  private setUserInfo(): void {
    if (!this.userInfoElement) return;

    // Get username from token or localStorage
    const username = localStorage.getItem("username") || "User";
    this.userInfoElement.textContent = `Welcome, ${username}!`;
  }

  private initializeWebSocket(): void {
    if (!this.token) {
      console.error("No token found for WebSocket connection");
      this.updateConnectionStatus(
        "Not authenticated",
        "bg-red-100 text-red-700"
      );
      return;
    }

    // Connect to WebSocket with authentication token
    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${this.token}`);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.updateConnectionStatus("Connected", "bg-green-100 text-green-700");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (!this.messagesContainer || !this.noMessagesElement) return;

      // Hide no messages state
      this.noMessagesElement.classList.add("hidden");
      this.messagesContainer.classList.remove("hidden");

      // Parse message (assuming JSON format)
      let messageData;
      try {
        messageData = JSON.parse(event.data);
      } catch {
        // Fallback to plain text
        messageData = {
          text: event.data,
          sender: "Unknown",
          timestamp: new Date().toISOString(),
        };
      }

      const messageElement = this.createMessageElement(messageData);
      this.messagesContainer.appendChild(messageElement);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.updateConnectionStatus("Error", "bg-red-100 text-red-700");
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
      this.updateConnectionStatus("Disconnected", "bg-gray-100 text-gray-700");
    };
  }

  private updateConnectionStatus(text: string, classes: string): void {
    if (!this.connectionStatusElement) return;

    this.connectionStatusElement.textContent = text;
    this.connectionStatusElement.className = `px-3 py-1 rounded-full text-sm ${classes}`;
  }

  private createMessageElement(messageData: any): HTMLElement {
    const template = document.getElementById(
      "messageTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set message info
    const avatar = element.querySelector(".w-8.h-8") as HTMLElement;
    const username = element.querySelector("span:first-of-type") as HTMLElement;
    const timestamp = element.querySelector("span:last-of-type") as HTMLElement;
    const messageText = element.querySelector("p") as HTMLElement;

    if (avatar)
      avatar.textContent = messageData.sender?.charAt(0)?.toUpperCase() || "?";
    if (username) username.textContent = messageData.sender || "Unknown";
    if (timestamp)
      timestamp.textContent = new Date(
        messageData.timestamp
      ).toLocaleTimeString();
    if (messageText) messageText.textContent = messageData.text || messageData;

    return element;
  }

  private sendMessage(): void {
    if (!this.messageInput || !this.ws) return;

    const message = this.messageInput.value.trim();
    if (message) {
      // Create message object
      const messageData = {
        text: message,
        timestamp: new Date().toISOString(),
        sender: localStorage.getItem("username") || "You",
      };

      // Send message via WebSocket
      this.ws.send(JSON.stringify(messageData));

      // Add message to local display
      if (this.messagesContainer && this.noMessagesElement) {
        this.noMessagesElement.classList.add("hidden");
        this.messagesContainer.classList.remove("hidden");

        const messageElement = this.createMessageElement(messageData);
        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

      this.messageInput.value = "";
    }
  }

  private addEventListeners(): void {
    if (!this.sendButton || !this.messageInput) return;

    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
  }
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
