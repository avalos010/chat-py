interface ChatMessage {
  text: string;
  timestamp: string;
  sender: string;
  isRead?: boolean;
  messageId?: string;
}

interface TypingIndicator {
  username: string;
  isTyping: boolean;
  timestamp: number;
}

interface Friend {
  friend_id: number;
  conversation_id: string;
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
  private conversationsList: HTMLElement | null = null;
  private noConversations: HTMLElement | null = null;
  private conversationsLoading: HTMLElement | null = null;
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
  private refreshConversationsButton: HTMLButtonElement | null = null;

  // Typing indicator and read receipt system
  private typingIndicators: Map<number, TypingIndicator> = new Map();
  private typingTimeout: NodeJS.Timeout | null = null;
  private lastTypingTime: number = 0;
  private pendingReadReceipts: Set<string> = new Set();

  // Current user info
  private currentUserId: number | null = null;

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
    this.conversationsList = document.getElementById(
      "conversationsList"
    ) as HTMLDivElement;
    this.noConversations = document.getElementById("noConversations");
    this.conversationsLoading = document.getElementById("conversationsLoading");
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

    if (!this.messageInput || !this.sendButton || !this.messagesContainer) {
      throw new Error("Required DOM elements not found");
    }

    this.token = localStorage.getItem("token");
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log("=== Chat initialization started ===");
    try {
      console.log("About to check authentication...");
      // Check authentication first
      await this.checkAuthentication();
      console.log("Authentication check completed successfully");

      console.log("About to get current user info...");
      // Get current user info including ID
      await this.getCurrentUserInfo();

      console.log("About to load unified conversations...");
      // Load unified conversations list (includes friends and former friends)
      this.loadUnifiedConversations();

      console.log("About to initialize WebSocket...");
      // Initialize WebSocket with authentication
      this.initializeWebSocket();
      this.addEventListeners();

      console.log("About to set user info...");
      // Set user info
      this.setUserInfo();

      // Check if there's a conversation ID in the URL and restore it
      this.handleUrlBasedNavigation();

      console.log("=== Chat initialization completed successfully ===");
    } catch (error) {
      console.error("Chat initialization failed:", error);
      // Don't redirect if there's an initialization error - just log it
      // This prevents redirect loops
    }
  }

  private async checkAuthentication(): Promise<void> {
    console.log("=== checkAuthentication called ===");
    const token = localStorage.getItem("token");
    console.log("Token found:", !!token);
    console.log("Current pathname:", window.location.pathname);

    if (!token) {
      console.log("No token found, checking if we need to redirect...");
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== "/login") {
        console.log("Redirecting to login...");
        window.location.href = "/login";
      } else {
        console.log("Already on login page, no redirect needed");
      }
      return;
    }

    console.log("Token found, checking with server...");
    try {
      const response = await fetch("/check-auth", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Server response status:", response.status);
      console.log("Server response ok:", response.ok);

      if (!response.ok) {
        console.log("Authentication check failed, clearing token");
        localStorage.removeItem("token");
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== "/login") {
          console.log("Redirecting to login due to auth failure...");
          window.location.href = "/login";
        } else {
          console.log("Already on login page, no redirect needed");
        }
        return;
      }

      console.log("Authentication check successful");
    } catch (error) {
      console.error("Authentication check failed:", error);
      // Don't clear token on network errors - just log the error
      // This prevents losing authentication due to temporary network issues
      console.log("Network error during auth check, keeping token");
    }
  }

  private async getCurrentUserInfo(): Promise<void> {
    try {
      const response = await fetch("/api/user/me", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        this.currentUserId = userData.id;
        console.log("Current user ID:", this.currentUserId);
      } else {
        console.error("Failed to get current user info");
      }
    } catch (error) {
      console.error("Error getting current user info:", error);
    }
  }

  private async loadUnifiedConversations(): Promise<void> {
    try {
      console.log("Loading unified conversations...");
      const response = await fetch("/api/recent-conversations", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      console.log("Response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Received conversations data:", data);
        this.displayUnifiedConversations(data.conversations);
      } else {
        console.error("Failed to load unified conversations");
        const errorText = await response.text();
        console.error("Error response:", errorText);
        this.showNoConversations();
      }
    } catch (error) {
      console.error("Error loading unified conversations:", error);
      this.showNoConversations();
    }
  }

  private displayUnifiedConversations(conversations: any[]): void {
    console.log("Displaying conversations:", conversations);
    if (
      !this.conversationsList ||
      !this.noConversations ||
      !this.conversationsLoading
    ) {
      console.error("Missing DOM elements:", {
        conversationsList: !!this.conversationsList,
        noConversations: !!this.noConversations,
        conversationsLoading: !!this.conversationsLoading,
      });
      return;
    }

    // Hide loading
    this.conversationsLoading.classList.add("hidden");
    console.log("Hidden loading, conversations count:", conversations.length);

    if (conversations.length === 0) {
      console.log("No conversations, showing no conversations message");
      this.noConversations.classList.remove("hidden");
      return;
    }

    // Show conversations list
    this.conversationsList.classList.remove("hidden");
    this.noConversations.classList.add("hidden");
    console.log("Showing conversations list");

    // Clear existing conversations
    this.conversationsList.innerHTML = "";

    // Add conversations
    conversations.forEach((conv, index) => {
      console.log(`Creating conversation element ${index}:`, conv);
      const convElement = this.createUnifiedConversationElement(conv);
      if (this.conversationsList) {
        this.conversationsList.appendChild(convElement);
        console.log(`Added conversation element ${index}`);
      }
    });

    // Update typing indicators for all conversations
    this.updateConversationTypingIndicators();
  }

  private createUnifiedConversationElement(conversation: any): HTMLElement {
    const template = document.getElementById(
      "unifiedConversationTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set conversation info
    const avatar = element.querySelector(".conversation-avatar") as HTMLElement;
    const username = element.querySelector(
      ".conversation-username"
    ) as HTMLElement;
    const lastMessage = element.querySelector(
      ".conversation-last-message"
    ) as HTMLElement;
    const unreadBadge = element.querySelector(".unread-badge") as HTMLElement;
    const statusIndicator = element.querySelector(
      ".status-indicator"
    ) as HTMLElement;

    if (avatar)
      avatar.textContent = conversation.username.charAt(0).toUpperCase();
    if (username) username.textContent = conversation.username;

    if (lastMessage) {
      // Show last message text and time
      const lastMessageTime = new Date(conversation.last_message_time);
      const now = new Date();
      const diffInHours =
        (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

      // Check if the last message is from the current user
      const isOwnMessage =
        this.currentUserId === conversation.last_message_sender;
      const messagePrefix = isOwnMessage ? "You: " : "";

      if (diffInHours < 24) {
        lastMessage.textContent = `${messagePrefix}${
          conversation.last_message_text
        } • ${lastMessageTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      } else {
        lastMessage.textContent = `${messagePrefix}${
          conversation.last_message_text
        } • ${lastMessageTime.toLocaleDateString()}`;
      }
    }

    // Handle unread message count
    if (
      unreadBadge &&
      conversation.unread_count &&
      conversation.unread_count > 0
    ) {
      unreadBadge.textContent = conversation.unread_count.toString();
      unreadBadge.classList.remove("hidden");
    }

    // Set status indicator (online/offline based on friendship)
    if (statusIndicator) {
      // For now, assume all conversations are with current friends
      // You could enhance this by checking friendship status
      statusIndicator.className = "w-2 h-2 bg-green-500 rounded-full";
    }

    // Add data attribute for finding this conversation later
    element.setAttribute("data-username", conversation.username);

    // Add click handler for conversation selection
    element.addEventListener("click", () => {
      this.selectUnifiedConversation(conversation);
    });

    return element;
  }

  private selectUnifiedConversation(conversation: any): void {
    this.selectedFriend = {
      friend_id: conversation.user_id,
      conversation_id: conversation.conversation_id,
      username: conversation.username,
      email: conversation.email || "",
      status: "online",
      unread_count: conversation.unread_count || 0,
    };

    // Update URL to include conversation ID
    const newUrl = `/chat/${conversation.conversation_id}`;
    window.history.pushState(
      { conversationId: conversation.conversation_id },
      "",
      newUrl
    );

    // Update UI to show selected friend
    if (this.noFriendSelectedElement && this.chatConversationElement) {
      this.noFriendSelectedElement.classList.add("hidden");
      this.chatConversationElement.classList.remove("hidden");
    }

    // Update friend info in chat header
    if (this.selectedFriendAvatarElement && this.selectedFriend) {
      this.selectedFriendAvatarElement.textContent =
        this.selectedFriend.username.charAt(0).toUpperCase();
    }
    if (this.selectedFriendNameElement && this.selectedFriend) {
      this.selectedFriendNameElement.textContent = this.selectedFriend.username;
    }
    if (this.selectedFriendStatusElement) {
      this.selectedFriendStatusElement.textContent = "● Online";
      this.selectedFriendStatusElement.className = "text-sm text-green-600";
    }

    // Load conversation history for this friend
    if (this.selectedFriend) {
      this.loadConversation(this.selectedFriend.friend_id);

      // Mark messages as read
      this.markMessagesAsRead(this.selectedFriend.friend_id);

      // Clear notifications for this conversation since it's now open
      this.clearConversationNotifications(this.selectedFriend.conversation_id);
    }

    // Focus on message input
    if (this.messageInput) {
      this.messageInput.focus();
    }

    if (this.selectedFriend) {
      console.log(
        `Selected unified conversation: ${this.selectedFriend.username}`
      );
    }
  }

  private showNoConversations(): void {
    if (!this.conversationsLoading || !this.noConversations) return;

    this.conversationsLoading.classList.add("hidden");
    this.noConversations.classList.remove("hidden");
  }

  // Clear conversation selection and update URL
  private clearConversationSelection(): void {
    this.selectedFriend = null;

    // Update URL to just /chat
    window.history.pushState({}, "", "/chat");

    // Show no friend selected state
    if (this.noFriendSelectedElement && this.chatConversationElement) {
      this.noFriendSelectedElement.classList.remove("hidden");
      this.chatConversationElement.classList.add("hidden");
    }
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
      // Try to load conversation with current friend first
      let response = await fetch(`/api/conversation/${friendId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      // If that fails (e.g., they're no longer a friend), try the "anyone" endpoint
      if (!response.ok && response.status === 403) {
        console.log(
          "User is no longer a friend, trying to load conversation history anyway..."
        );
        response = await fetch(`/api/conversation/${friendId}/anyone`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
      }

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
            messageId: messageData.message_id || `msg_${Date.now()}`,
            isRead: false,
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

            // Clear typing indicator since message was sent
            this.clearTypingIndicator(messageData.sender_username);
            // Also clear typing indicator in conversations list
            this.updateConversationTypingIndicator(
              messageData.sender_username,
              false
            );

            // Send read receipt
            this.sendReadReceipt(messageData.message_id || message.messageId);
          } else {
            // Message from someone else - update unread count
            this.updateUnreadCountForFriend(messageData.sender_username);
          }

          // Always refresh the conversations list to show new messages in real-time
          this.loadUnifiedConversations();
        } else if (messageData.type === "message_sent") {
          // This is a confirmation that our message was sent
          console.log("Message sent successfully:", messageData);

          // Add message to local conversation with pending read receipt
          if (this.selectedFriend && messageData.message_id) {
            this.pendingReadReceipts.add(messageData.message_id);
          }
        } else if (messageData.type === "typing_indicator") {
          // Handle typing indicator
          this.handleTypingIndicator(messageData);
        } else if (messageData.type === "read_receipt") {
          // Handle read receipt
          this.handleReadReceipt(messageData);
        } else if (messageData.type === "connection_established") {
          console.log(
            "WebSocket connection established for user:",
            messageData.username
          );
        } else if (messageData.type === "notification_update") {
          // Handle notification updates (like new messages from other users)
          if (messageData.notification_type === "new_message") {
            // Check if this message is for the currently open conversation
            const currentConversationId = this.getCurrentConversationId();
            const isForOpenConversation =
              currentConversationId &&
              messageData.conversation_id === currentConversationId;

            // Only refresh conversations list if the message isn't for the open conversation
            if (!isForOpenConversation) {
              this.loadUnifiedConversations();
            }
          }
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

    // Check if this is the current user's message
    // We need to get the sender ID from the message data or check by username
    const currentUsername = localStorage.getItem("username");
    const isOwnMessage =
      messageData.sender === currentUsername ||
      messageData.sender_id === this.currentUserId;

    if (avatar) {
      if (isOwnMessage) {
        avatar.textContent = "Y"; // "You"
      } else {
        avatar.textContent =
          messageData.sender?.charAt(0)?.toUpperCase() || "?";
      }
    }

    if (username) {
      if (isOwnMessage) {
        username.textContent = "You";
      } else {
        username.textContent = messageData.sender || "Unknown";
      }
    }

    if (timestamp)
      timestamp.textContent = new Date(
        messageData.timestamp
      ).toLocaleTimeString();
    if (messageText) messageText.textContent = messageData.text || messageData;

    // Add message ID for read receipts
    if (messageData.messageId) {
      element.setAttribute("data-message-id", messageData.messageId);
    }

    // Add read receipt indicator
    if (messageData.sender === localStorage.getItem("username")) {
      const readIcon = document.createElement("span");
      readIcon.className = `read-icon text-gray-400 text-xs ml-2 ${
        messageData.isRead ? "text-blue-500" : ""
      }`;
      readIcon.innerHTML = messageData.isRead ? "✓✓" : "✓";
      readIcon.title = messageData.isRead ? "Read" : "Delivered";

      // Add to timestamp area
      if (timestamp) {
        timestamp.appendChild(readIcon);
      }
    }

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

    // Add typing indicator on input
    this.messageInput.addEventListener("input", () => {
      this.sendTypingIndicator(true);

      // Clear previous timeout
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      // Set timeout to stop typing indicator after 3 seconds of no input
      this.typingTimeout = setTimeout(() => {
        this.sendTypingIndicator(false);
      }, 3000);
    });

    // Add refresh button listeners
    this.refreshConversationsButton = document.getElementById(
      "refreshConversationsButton"
    ) as HTMLButtonElement;
    if (this.refreshConversationsButton) {
      this.refreshConversationsButton.addEventListener("click", () => {
        this.loadUnifiedConversations();
      });
    }

    // Handle browser back/forward navigation
    window.addEventListener("popstate", (event) => {
      if (event.state && event.state.conversationId) {
        // Restore conversation from URL
        this.handleUrlBasedNavigation();
      } else {
        // Clear selected conversation
        this.selectedFriend = null;
        if (this.noFriendSelectedElement && this.chatConversationElement) {
          this.noFriendSelectedElement.classList.remove("hidden");
          this.chatConversationElement.classList.add("hidden");
        }
      }
    });
  }

  // Typing indicator methods
  private sendTypingIndicator(isTyping: boolean): void {
    if (!this.ws || !this.selectedFriend) return;

    const typingData = {
      type: "typing_indicator",
      recipient: this.selectedFriend.username,
      isTyping: isTyping,
    };

    this.ws.send(JSON.stringify(typingData));
  }

  private handleTypingIndicator(data: any): void {
    // Don't show typing indicator for ourselves
    if (data.username === localStorage.getItem("username")) {
      return;
    }

    // Show typing indicator in the conversations list
    this.updateConversationTypingIndicator(data.username, data.isTyping);

    // Only show typing indicator in chat if it's from the currently selected friend
    if (
      !this.selectedFriend ||
      data.username !== this.selectedFriend.username
    ) {
      return;
    }

    if (data.isTyping) {
      this.showTypingIndicator(data.username);
    } else {
      this.hideTypingIndicator(data.username);
    }
  }

  private showTypingIndicator(username: string): void {
    // Create or update typing indicator
    let typingElement = document.getElementById("typingIndicator");
    if (!typingElement) {
      typingElement = document.createElement("div");
      typingElement.id = "typingIndicator";
      typingElement.className =
        "flex items-center space-x-2 text-gray-500 text-sm italic p-2";
      typingElement.innerHTML = `
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        </div>
        <span>${username} is typing...</span>
      `;

      if (this.messagesContainer) {
        this.messagesContainer.appendChild(typingElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }
  }

  private hideTypingIndicator(username: string): void {
    const typingElement = document.getElementById("typingIndicator");
    if (typingElement) {
      typingElement.remove();
    }
  }

  private clearTypingIndicator(username: string): void {
    this.hideTypingIndicator(username);
  }

  // Read receipt methods
  private sendReadReceipt(messageId: string): void {
    if (!this.ws) return;

    const readReceipt = {
      type: "read_receipt",
      message_id: messageId,
    };

    this.ws.send(JSON.stringify(readReceipt));
  }

  private handleReadReceipt(data: any): void {
    // Update message read status in UI
    const messageElement = document.querySelector(
      `[data-message-id="${data.message_id}"]`
    );
    if (messageElement) {
      const readIcon = messageElement.querySelector(".read-icon");
      if (readIcon) {
        readIcon.innerHTML = "✓✓"; // Double check for read
        readIcon.className = "read-icon text-blue-500 text-xs";
      }
    }
  }

  private clearMessageNotifications(): void {
    // Clear message notifications in navigation
    document.dispatchEvent(new CustomEvent("clearMessageNotifications"));
  }

  // Conversation typing indicator methods
  private updateConversationTypingIndicators(): void {
    // Clear all existing typing indicators
    const typingElements = document.querySelectorAll(
      ".conversation-typing-indicator"
    );
    typingElements.forEach((el) => el.remove());
  }

  private updateConversationTypingIndicator(
    username: string,
    isTyping: boolean
  ): void {
    // Find the conversation element for this user
    const conversationElement = document.querySelector(
      `[data-username="${username}"]`
    );
    if (!conversationElement) return;

    // Remove existing typing indicator
    const existingIndicator = conversationElement.querySelector(
      ".conversation-typing-indicator"
    );
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (isTyping) {
      // Create and add typing indicator
      const typingIndicator = document.createElement("div");
      typingIndicator.className =
        "conversation-typing-indicator flex items-center space-x-1 text-gray-500 text-xs italic ml-2";
      typingIndicator.innerHTML = `
        <div class="flex space-x-1">
          <div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
          <div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
          <div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        </div>
        <span class="ml-1">typing...</span>
      `;

      // Find the conversation info area to add the typing indicator
      const conversationInfo = conversationElement.querySelector(
        ".conversation-last-message"
      );
      if (conversationInfo) {
        conversationInfo.appendChild(typingIndicator);
      }
    }
  }

  // Check if a conversation is currently open
  private isConversationOpen(conversationId: string): boolean {
    return this.selectedFriend?.conversation_id === conversationId;
  }

  // Check if current URL has a conversation ID
  private getCurrentConversationId(): string | null {
    const pathParts = window.location.pathname.split("/");
    if (pathParts.length >= 3 && pathParts[1] === "chat") {
      return pathParts[2]; // Return the conversation ID as string (UUID)
    }
    return null;
  }

  // Handle URL-based navigation to restore conversation state
  private async handleUrlBasedNavigation(): Promise<void> {
    const conversationId = this.getCurrentConversationId();
    if (conversationId) {
      // Try to find the conversation in the loaded conversations
      const response = await fetch("/api/recent-conversations", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const conversation = data.conversations.find(
          (conv: any) => conv.conversation_id === conversationId
        );

        if (conversation) {
          // Restore the conversation
          this.selectUnifiedConversation(conversation);
        }
      }
    }
  }

  // Clear notifications for a specific conversation
  private clearConversationNotifications(conversationId: string): void {
    // Dispatch event to clear navigation notifications
    document.dispatchEvent(
      new CustomEvent("clearConversationNotifications", {
        detail: { conversationId },
      })
    );
  }
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
