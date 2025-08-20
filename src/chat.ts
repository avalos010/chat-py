interface ChatMessage {
  text: string;
  timestamp: string;
  sender: string;
}

interface Friend {
  friend_id: number;
  username: string;
  email: string;
  status?: "online" | "offline";
  unread_count?: number;
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

  // New elements for messenger interface
  private noFriendSelectedElement: HTMLElement | null;
  private chatConversationElement: HTMLElement | null;
  private selectedFriendAvatarElement: HTMLElement | null;
  private selectedFriendNameElement: HTMLElement | null;
  private selectedFriendStatusElement: HTMLElement | null;

  private selectedFriend: Friend | null = null;
  private conversations: Map<number, ChatMessage[]> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;
  private refreshFriendsButton: HTMLButtonElement | null = null;

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

    // New elements
    this.noFriendSelectedElement = document.getElementById("noFriendSelected");
    this.chatConversationElement = document.getElementById("chatConversation");
    this.selectedFriendAvatarElement = document.getElementById(
      "selectedFriendAvatar"
    );
    this.selectedFriendNameElement =
      document.getElementById("selectedFriendName");
    this.selectedFriendStatusElement = document.getElementById(
      "selectedFriendStatus"
    );
    this.refreshFriendsButton = document.getElementById(
      "refreshFriends"
    ) as HTMLButtonElement;

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

    // Set up automatic refresh every 30 seconds
    this.setupAutoRefresh();
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
    const unreadBadge = element.querySelector(".unread-badge") as HTMLElement;

    if (avatar) avatar.textContent = friend.username.charAt(0).toUpperCase();
    if (username) username.textContent = friend.username;
    if (email) email.textContent = friend.email;

    // Handle unread message count
    if (unreadBadge && friend.unread_count && friend.unread_count > 0) {
      unreadBadge.textContent = friend.unread_count.toString();
      unreadBadge.classList.remove("hidden");
    }

    // Add click handler for friend selection
    element.addEventListener("click", () => {
      this.selectFriend(friend);
    });

    return element;
  }

  private selectFriend(friend: Friend): void {
    this.selectedFriend = friend;

    // Update UI to show selected friend
    if (this.noFriendSelectedElement && this.chatConversationElement) {
      this.noFriendSelectedElement.classList.add("hidden");
      this.chatConversationElement.classList.remove("hidden");
    }

    // Update friend info in chat header
    if (this.selectedFriendAvatarElement) {
      this.selectedFriendAvatarElement.textContent = friend.username
        .charAt(0)
        .toUpperCase();
    }
    if (this.selectedFriendNameElement) {
      this.selectedFriendNameElement.textContent = friend.username;
    }
    if (this.selectedFriendStatusElement) {
      this.selectedFriendStatusElement.textContent = "● Online";
      this.selectedFriendStatusElement.className = "text-sm text-green-600";
    }

    // Load conversation history for this friend
    this.loadConversation(friend.friend_id);

    // Mark messages as read
    this.markMessagesAsRead(friend.friend_id);

    // Focus on message input
    if (this.messageInput) {
      this.messageInput.focus();
    }

    console.log(`Selected friend: ${friend.username}`);
  }

  private async markMessagesAsRead(friendId: number): Promise<void> {
    try {
      await fetch(`/api/conversation/${friendId}/mark-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      // Update the unread count display
      this.updateUnreadCount(friendId, 0);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }

  private updateUnreadCount(friendId: number, count: number): void {
    // Find the friend element and update the unread badge
    const friendElements = document.querySelectorAll(".friend-item");
    friendElements.forEach((element) => {
      const usernameElement = element.querySelector("p:first-of-type");
      if (
        usernameElement &&
        usernameElement.textContent === this.selectedFriend?.username
      ) {
        const unreadBadge = element.querySelector(".unread-badge");
        if (unreadBadge) {
          if (count > 0) {
            unreadBadge.textContent = count.toString();
            unreadBadge.classList.remove("hidden");
          } else {
            unreadBadge.classList.add("hidden");
          }
        }
      }
    });
  }

  private updateUnreadCountForFriend(username: string): void {
    // Find the friend element and increment the unread badge
    const friendElements = document.querySelectorAll(".friend-item");
    friendElements.forEach((element) => {
      const usernameElement = element.querySelector("p:first-of-type");
      if (usernameElement && usernameElement.textContent === username) {
        const unreadBadge = element.querySelector(".unread-badge");
        if (unreadBadge) {
          const currentCount = parseInt(unreadBadge.textContent || "0");
          const newCount = currentCount + 1;
          unreadBadge.textContent = newCount.toString();
          unreadBadge.classList.remove("hidden");
        }
      }
    });
  }

  private loadConversation(friendId: number): void {
    // Get conversation from memory or load from server
    const conversation = this.conversations.get(friendId) || [];

    if (conversation.length === 0) {
      // Load conversation history from server
      this.loadConversationFromServer(friendId);
    } else {
      // Show messages
      if (this.noMessagesElement && this.messagesContainer) {
        this.noMessagesElement.classList.add("hidden");
        this.messagesContainer.classList.remove("hidden");
      }

      // Display messages
      this.displayMessages(conversation);
    }
  }

  private async loadConversationFromServer(friendId: number): Promise<void> {
    try {
      const response = await fetch(`/api/conversation/${friendId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const messages = data.conversation.map((msg: any) => ({
          text: msg.message_text,
          timestamp: msg.timestamp,
          sender: msg.sender_username,
          sender_id: msg.sender_id,
        }));

        // Store in memory
        this.conversations.set(friendId, messages);

        if (messages.length === 0) {
          // Show no messages state
          if (this.noMessagesElement && this.messagesContainer) {
            this.noMessagesElement.classList.remove("hidden");
            this.messagesContainer.classList.add("hidden");
          }
        } else {
          // Show messages
          if (this.noMessagesElement && this.messagesContainer) {
            this.noMessagesElement.classList.add("hidden");
            this.messagesContainer.classList.remove("hidden");
          }

          // Display messages
          this.displayMessages(messages);
        }
      } else {
        console.error("Failed to load conversation");
        // Show no messages state
        if (this.noMessagesElement && this.messagesContainer) {
          this.noMessagesElement.classList.remove("hidden");
          this.messagesContainer.classList.add("hidden");
        }
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      // Show no messages state
      if (this.noMessagesElement && this.messagesContainer) {
        this.noMessagesElement.classList.remove("hidden");
        this.messagesContainer.classList.add("hidden");
      }
    }
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

      try {
        // Parse the message data
        const messageData = JSON.parse(event.data);

        if (messageData.type === "message") {
          // This is a chat message
          const message: ChatMessage = {
            text: messageData.message_text,
            timestamp: messageData.timestamp,
            sender: messageData.sender_username,
          };

          // Add to conversation if it's from the currently selected friend
          if (
            this.selectedFriend &&
            (messageData.sender_username === this.selectedFriend.username ||
              messageData.recipient_username === this.selectedFriend.username)
          ) {
            // Hide no messages state
            this.noMessagesElement.classList.add("hidden");
            this.messagesContainer.classList.remove("hidden");

            // Add message to conversation
            const conversation =
              this.conversations.get(this.selectedFriend.friend_id) || [];
            conversation.push(message);
            this.conversations.set(this.selectedFriend.friend_id, conversation);

            // Display the message
            const messageElement = this.createMessageElement(message);
            this.messagesContainer.appendChild(messageElement);
            this.messagesContainer.scrollTop =
              this.messagesContainer.scrollHeight;
          } else {
            // Message from someone else - update unread count
            this.updateUnreadCountForFriend(messageData.sender_username);
          }
        } else if (messageData.type === "message_sent") {
          // This is a confirmation that our message was sent
          console.log("Message sent successfully:", messageData);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
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

  private displayMessages(messages: ChatMessage[]): void {
    if (!this.messagesContainer) return;

    this.messagesContainer.innerHTML = "";
    messages.forEach((message) => {
      const messageElement = this.createMessageElement(message);
      this.messagesContainer!.appendChild(messageElement);
    });

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private sendMessage(): void {
    if (!this.messageInput || !this.ws || !this.selectedFriend) return;

    const message = this.messageInput.value.trim();
    if (message) {
      // Create message object for WebSocket
      const messageData = {
        text: message,
        recipient: this.selectedFriend.username,
      };

      // Send message via WebSocket
      this.ws.send(JSON.stringify(messageData));

      // Create local message object
      const localMessage: ChatMessage = {
        text: message,
        timestamp: new Date().toISOString(),
        sender: localStorage.getItem("username") || "You",
      };

      // Add message to local conversation
      const conversation =
        this.conversations.get(this.selectedFriend.friend_id) || [];
      conversation.push(localMessage);
      this.conversations.set(this.selectedFriend.friend_id, conversation);

      // Add message to local display
      if (this.messagesContainer && this.noMessagesElement) {
        this.noMessagesElement.classList.add("hidden");
        this.messagesContainer.classList.remove("hidden");

        const messageElement = this.createMessageElement(localMessage);
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

    // Add refresh button listener
    if (this.refreshFriendsButton) {
      this.refreshFriendsButton.addEventListener("click", () => {
        this.refreshFriendsList();
      });
    }
  }

  private async refreshFriendsList(): Promise<void> {
    if (this.refreshFriendsButton) {
      // Add loading state to refresh button
      this.refreshFriendsButton.disabled = true;
      this.refreshFriendsButton.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
      `;
    }

    try {
      await this.loadFriendsList();

      // Show success feedback
      if (this.refreshFriendsButton) {
        this.refreshFriendsButton.innerHTML = `
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        `;

        // Reset button after 2 seconds
        setTimeout(() => {
          if (this.refreshFriendsButton) {
            this.refreshFriendsButton.innerHTML = `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            `;
            this.refreshFriendsButton.disabled = false;
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to refresh friends:", error);

      // Show error feedback
      if (this.refreshFriendsButton) {
        this.refreshFriendsButton.innerHTML = `
          <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        `;

        // Reset button after 2 seconds
        setTimeout(() => {
          if (this.refreshFriendsButton) {
            this.refreshFriendsButton.innerHTML = `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            `;
            this.refreshFriendsButton.disabled = false;
          }
        }, 2000);
      }
    }
  }

  private setupAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      this.loadFriendsList();
    }, 30000); // Refresh every 30 seconds

    // Also refresh when the page becomes visible (user switches back to tab)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.loadFriendsList();
      }
    });
  }

  private cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
