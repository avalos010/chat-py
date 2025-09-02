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

  // New elements for messenger interface
  private noFriendSelectedElement: HTMLElement | null;
  private chatConversationElement: HTMLElement | null;
  private selectedFriendAvatarElement: HTMLElement | null;
  private selectedFriendNameElement: HTMLElement | null;
  private selectedFriendStatusElement: HTMLElement | null;

  private selectedFriend: Friend | null = null;
  private conversations: Map<number, ChatMessage[]> = new Map();
  private friendsStatus: any[] = [];
  private conversationsData: any[] = []; // Store conversations data for URL routing
  private refreshConversationsButton: HTMLButtonElement | null = null;

  // Typing indicator and read receipt system
  private typingIndicators: Map<string, TypingIndicator> = new Map();
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
    ) as HTMLElement;
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

    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log("Initializing ChatApp...");

    // Get current user info
    await this.getCurrentUserInfo();

    // Load conversations
    await this.loadUnifiedConversations();

    // Setup event listeners
    this.setupEventListeners();

    // Initialize WebSocket
    this.initializeWebSocket();

    // Setup refresh button
    this.refreshConversationsButton = document.getElementById(
      "refreshConversationsButton"
    ) as HTMLButtonElement;
    if (this.refreshConversationsButton) {
      this.refreshConversationsButton.addEventListener("click", () => {
        this.loadUnifiedConversations();
      });
    }

    // Check for conversation ID in URL and auto-select if present
    this.handleInitialConversationFromURL();
  }

  private async getCurrentUserInfo(): Promise<void> {
    try {
      const response = await fetch("/api/user/me");

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
      const response = await fetch("/api/recent-conversations");

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

    // Store conversations data for URL routing
    this.conversationsData = conversations;

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

    // Load online status for all conversations
    this.loadConversationsOnlineStatus();
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
    const messageSender = element.querySelector(
      ".conversation-message-sender"
    ) as HTMLElement;
    const typingIndicator = element.querySelector(
      ".conversation-typing-indicator"
    ) as HTMLElement;
    const readStatus = element.querySelector(
      ".conversation-read-status"
    ) as HTMLElement;

    if (avatar)
      avatar.textContent = conversation.username.charAt(0).toUpperCase();
    if (username) username.textContent = conversation.username;
    if (lastMessage) {
      lastMessage.textContent =
        conversation.last_message_text || "No messages yet";
    }

    // Set message sender indicator
    if (messageSender) {
      if (conversation.last_message_sender === this.currentUserId) {
        messageSender.textContent = "You:";
        messageSender.className =
          "conversation-message-sender text-xs text-blue-500";
      } else {
        messageSender.textContent = `${conversation.username}:`;
        messageSender.className =
          "conversation-message-sender text-xs text-gray-400";
      }
    }

    // Set unread count
    if (
      unreadBadge &&
      conversation.unread_count &&
      conversation.unread_count > 0
    ) {
      const unreadCount = unreadBadge.querySelector(
        ".unread-count"
      ) as HTMLElement;
      if (unreadCount)
        unreadCount.textContent = conversation.unread_count.toString();
      unreadBadge.classList.remove("hidden");
    }

    // Set online status
    if (statusIndicator) {
      // Get status from friendsStatus array
      const friendStatus = this.friendsStatus.find(
        (f) => f.username === conversation.username
      );
      const status = friendStatus?.status || conversation.status || "offline";

      if (status === "online") {
        statusIndicator.classList.add("bg-green-500");
        statusIndicator.classList.remove("bg-gray-400");
      } else {
        statusIndicator.classList.add("bg-gray-400");
        statusIndicator.classList.remove("bg-green-500");
      }
    }

    // Set read status for messages sent by current user
    if (readStatus && conversation.last_message_sender === this.currentUserId) {
      // Show read status if the last message was sent by current user
      readStatus.classList.remove("hidden");
    } else if (readStatus) {
      readStatus.classList.add("hidden");
    }

    // Initialize typing indicator as hidden
    if (typingIndicator) {
      typingIndicator.classList.add("hidden");
    }

    // Add click event to select conversation
    element.addEventListener("click", () => {
      if (conversation) {
        this.selectConversation(conversation);
      }
    });

    return element;
  }

  private selectConversation(conversation: any): void {
    console.log("Selecting conversation:", conversation);

    // Get status from friendsStatus array
    const friendStatus = this.friendsStatus.find(
      (f) => f.username === conversation.username
    );
    const status = friendStatus?.status || conversation.status || "offline";

    // Update selected friend
    this.selectedFriend = {
      friend_id: conversation.friend_id,
      conversation_id: conversation.conversation_id,
      username: conversation.username,
      email: conversation.email,
      status: status,
      unread_count: conversation.unread_count,
    };

    // Update URL to include conversation ID
    this.updateURLForConversation(conversation.conversation_id);

    // Update UI
    this.showChatConversation();
    this.loadConversation(conversation.friend_id);

    // Mark messages as read
    this.markMessagesAsRead(conversation.friend_id);
  }

  private showChatConversation(): void {
    if (this.noFriendSelectedElement) {
      this.noFriendSelectedElement.classList.add("hidden");
    }
    if (this.chatConversationElement) {
      this.chatConversationElement.classList.remove("hidden");
    }

    // Update friend info
    if (this.selectedFriend) {
      if (this.selectedFriendNameElement) {
        this.selectedFriendNameElement.textContent =
          this.selectedFriend.username;
      }
      if (this.selectedFriendAvatarElement) {
        this.selectedFriendAvatarElement.textContent =
          this.selectedFriend.username.charAt(0).toUpperCase();
      }
      if (this.selectedFriendStatusElement) {
        this.selectedFriendStatusElement.textContent =
          this.selectedFriend.status === "online" ? "● Online" : "○ Offline";
        this.selectedFriendStatusElement.className =
          this.selectedFriend.status === "online"
            ? "text-sm text-green-600"
            : "text-sm text-gray-500";
      }
    }
  }

  private async markMessagesAsRead(friendId: number): Promise<void> {
    try {
      await fetch(`/api/conversation/${friendId}/mark-read`, {
        method: "POST",
      });

      // Update the unread count display
      this.updateUnreadCount(friendId, 0);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }

  private updateUnreadCount(friendId: number, count: number): void {
    const conversationItems = document.querySelectorAll(
      "#conversationsList .flex.items-center.space-x-3.p-3.rounded-lg"
    );
    conversationItems.forEach((el) => {
      const usernameEl = el.querySelector(".conversation-username") as HTMLElement | null;
      const unreadBadge = el.querySelector(".unread-badge") as HTMLElement | null;
      if (!usernameEl || !unreadBadge) return;
      if (usernameEl.textContent === this.selectedFriend?.username) {
        if (count > 0) {
          const unreadCount = unreadBadge.querySelector(".unread-count") as HTMLElement | null;
          if (unreadCount) unreadCount.textContent = String(count);
          unreadBadge.classList.remove("hidden");
        } else {
          unreadBadge.classList.add("hidden");
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
      let response = await fetch(`/api/conversation/${friendId}`);

      // If that fails (e.g., they're no longer a friend), try the "anyone" endpoint
      if (!response.ok && response.status === 403) {
        console.log(
          "User is no longer a friend, trying to load conversation history anyway..."
        );
        response = await fetch(`/api/conversation/${friendId}/anyone`);
      }

      if (response.ok) {
        const data = await response.json();
        const messages = data.conversation.map((msg: any) => ({
          text: msg.message_text,
          timestamp: msg.timestamp,
          sender: msg.sender_username,
          messageId: msg.id.toString(),
          isRead: msg.is_read,
        }));

        // Store in memory
        this.conversations.set(friendId, messages);

        // Show messages
        if (this.noMessagesElement && this.messagesContainer) {
          this.noMessagesElement.classList.add("hidden");
          this.messagesContainer.classList.remove("hidden");
        }

        this.displayMessages(messages);
      } else {
        console.error("Failed to load conversation");
        this.showNoMessages();
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      this.showNoMessages();
    }
  }

  private displayMessages(messages: ChatMessage[]): void {
    if (!this.messagesContainer) return;

    this.messagesContainer.innerHTML = "";
    messages.forEach((message) => {
      const messageElement = this.createMessageElement(message);
      if (this.messagesContainer) {
        this.messagesContainer.appendChild(messageElement);
      }
    });

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private createMessageElement(message: ChatMessage): HTMLElement {
    const template = document.getElementById(
      "messageTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set message content
    const username = element.querySelector("span:first-of-type") as HTMLElement;
    const timestamp = element.querySelector("span:last-of-type") as HTMLElement;
    const messageText = element.querySelector("p") as HTMLElement;

    if (username) username.textContent = message.sender;
    if (timestamp)
      timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
    if (messageText) messageText.textContent = message.text;

    return element;
  }

  private showNoMessages(): void {
    if (this.noMessagesElement) {
      this.noMessagesElement.classList.remove("hidden");
    }
    if (this.messagesContainer) {
      this.messagesContainer.classList.add("hidden");
    }
  }

  private showNoConversations(): void {
    if (this.conversationsLoading) {
      this.conversationsLoading.classList.add("hidden");
    }
    if (this.noConversations) {
      this.noConversations.classList.remove("hidden");
    }
    if (this.conversationsList) {
      this.conversationsList.classList.add("hidden");
    }
  }

  private setupEventListeners(): void {
    // Message input events
    this.messageInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });

    this.sendButton?.addEventListener("click", () => {
      this.sendMessage();
    });

    // Typing indicator
    this.messageInput?.addEventListener("input", () => {
      this.handleTyping();
    });

    // Clear typing indicator when input loses focus
    this.messageInput?.addEventListener("blur", () => {
      console.log("Input lost focus, clearing typing indicator");
      this.clearTypingIndicator();
    });

    // Clear any existing timeout when input gains focus
    this.messageInput?.addEventListener("focus", () => {
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
      }
    });

    // Add a global method for debugging - clear all typing indicators
    (window as any).clearAllTypingIndicators = () => {
      console.log("Force clearing all typing indicators");
      this.typingIndicators.clear();
      this.updateConversationTypingIndicators();
      this.updateMainChatTypingIndicator(false);
    };
  }

  private handleTyping(): void {
    if (!this.selectedFriend) return;

    console.log("Typing detected for:", this.selectedFriend.username);

    const now = Date.now();
    this.lastTypingTime = now;

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set new timeout
    this.typingTimeout = setTimeout(() => {
      if (Date.now() - this.lastTypingTime >= 1000) {
        this.clearTypingIndicator(this.selectedFriend!.username);
      }
    }, 1000);

    // Send typing indicator
    this.sendTypingIndicator(true);
  }

  private sendTypingIndicator(isTyping: boolean): void {
    if (!this.selectedFriend || !this.ws) return;

    const typingData = {
      type: "typing_indicator",
      recipient: this.selectedFriend.username,
      is_typing: isTyping,
    };

    console.log("Sending typing indicator:", typingData);
    this.ws.send(JSON.stringify(typingData));
  }

  private clearTypingIndicator(username?: string): void {
    console.log("clearTypingIndicator called with username:", username);
    console.log(
      "Current typingIndicators:",
      Array.from(this.typingIndicators.keys())
    );

    if (username) {
      // Clear specific user's typing indicator
      this.typingIndicators.delete(username);
      console.log("Cleared typing indicator for:", username);

      // Also clear typing indicator in main chat if this is the selected friend
      if (username === this.selectedFriend?.username) {
        this.updateMainChatTypingIndicator(false);
      }
    } else if (this.selectedFriend) {
      // Clear current user's typing indicator (when input loses focus)
      console.log(
        "Clearing current user typing indicator for:",
        this.selectedFriend.username
      );
      this.typingIndicators.delete(this.selectedFriend.username);
      this.updateMainChatTypingIndicator(false);

      // Send stop typing indicator to the selected friend
      this.sendTypingIndicator(false);
    }

    // Update UI to hide typing indicator
    this.updateConversationTypingIndicators();
    console.log(
      "Updated UI, remaining typingIndicators:",
      Array.from(this.typingIndicators.keys())
    );
  }

  private updateConversationTypingIndicators(): void {
    console.log("updateConversationTypingIndicators called");
    // Update typing indicators in conversations list
    const conversationElements = document.querySelectorAll(
      ".flex.items-center.space-x-3.p-3.rounded-lg"
    );

    console.log("Found conversation elements:", conversationElements.length);

    conversationElements.forEach((element, index) => {
      const usernameElement = element.querySelector(
        ".conversation-username"
      ) as HTMLElement;
      const typingIndicator = element.querySelector(
        ".conversation-typing-indicator"
      ) as HTMLElement;
      const lastMessage = element.querySelector(
        ".conversation-last-message"
      ) as HTMLElement;
      const messageSender = element.querySelector(
        ".conversation-message-sender"
      ) as HTMLElement;

      if (usernameElement && typingIndicator) {
        const username = usernameElement.textContent;
        const isTyping = this.typingIndicators.has(username || "");

        console.log(
          `Conversation ${index}: ${username}, isTyping: ${isTyping}`
        );

        if (isTyping) {
          // Show typing indicator
          console.log(`Showing typing indicator for ${username}`);
          typingIndicator.classList.remove("hidden");
          const typingUsername = typingIndicator.querySelector(
            ".typing-username"
          ) as HTMLElement;
          if (typingUsername) {
            typingUsername.textContent = username || "";
          }
          // Hide last message and sender when typing
          if (lastMessage) lastMessage.classList.add("hidden");
          if (messageSender) messageSender.classList.add("hidden");
        } else {
          // Hide typing indicator
          console.log(`Hiding typing indicator for ${username}`);
          typingIndicator.classList.add("hidden");
          // Show last message and sender when not typing
          if (lastMessage) lastMessage.classList.remove("hidden");
          if (messageSender) messageSender.classList.remove("hidden");
        }
      }
    });
  }

  private async loadConversationsOnlineStatus(): Promise<void> {
    try {
      const response = await fetch("/api/friends/online-status");
      if (response.ok) {
        const data = await response.json();
        const friendsStatus = data.friends_status || [];

        // Update status indicators for each friend
        friendsStatus.forEach((friend: any) => {
          this.updateUserStatusInConversations(friend.username, friend.status);

          // Update selected friend status if this is the currently selected friend
          if (
            this.selectedFriend &&
            this.selectedFriend.username === friend.username
          ) {
            this.selectedFriend.status = friend.status;
            this.updateSelectedFriendStatus();
          }
        });

        // Store status information for later use
        this.friendsStatus = friendsStatus;
      }
    } catch (error) {
      console.error("Error loading online status:", error);
    }
  }

  private sendMessage(): void {
    if (!this.messageInput || !this.selectedFriend) return;

    const messageText = this.messageInput.value.trim();
    if (!messageText) return;

    // Create message object
    const message: ChatMessage = {
      text: messageText,
      timestamp: new Date().toISOString(),
      sender: "You",
      messageId: `msg_${Date.now()}`,
      isRead: false,
    };

    // Add to local conversation
    const conversation =
      this.conversations.get(this.selectedFriend.friend_id) || [];
    conversation.push(message);
    this.conversations.set(this.selectedFriend.friend_id, conversation);

    // Display message
    this.displayMessages(conversation);

    // Clear input
    this.messageInput.value = "";

    // Send via WebSocket
    if (this.ws) {
      const messageData = {
        type: "message",
        text: messageText,
        recipient: this.selectedFriend.username,
      };
      this.ws.send(JSON.stringify(messageData));
    }

    // Clear typing indicator
    this.clearTypingIndicator(this.selectedFriend.username);
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      // Get auth token from server for WebSocket connection
      const tokenResponse = await fetch("/api/ws-token");
      if (!tokenResponse.ok) {
        console.error("Failed to get WebSocket token");
        this.updateConnectionStatus("Auth Failed", "bg-red-100 text-red-700");
        return;
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      // Connect to WebSocket with token as query parameter
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host;
      this.ws = new WebSocket(`${wsProtocol}//${wsHost}/ws?token=${token}`);

      this.setupWebSocketEventHandlers();
    } catch (error) {
      console.error("Error initializing WebSocket:", error);
      this.updateConnectionStatus(
        "Connection Failed",
        "bg-red-100 text-red-700"
      );
    }
  }

  private setupWebSocketEventHandlers(): void {
    if (!this.ws) return;

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
        } else if (messageData.type === "user_status_update") {
          // Handle user status updates (online/offline)
          this.handleUserStatusUpdate(messageData);
        } else if (messageData.type === "notification_update") {
          // Handle notification updates (like new messages from other users)
          if (messageData.notification_type === "new_message") {
            // Check if this message is for the currently open conversation
            const currentConversationId = this.getCurrentConversationId();
            const isForOpenConversation =
              currentConversationId &&
              messageData.conversation_id === currentConversationId;

            if (!isForOpenConversation) {
              // Show notification for new message
              this.showNotification(
                `New message from ${messageData.sender_username}: ${messageData.message_preview}`
              );
            }
          }
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.updateConnectionStatus("Error", "bg-red-100 text-red-700");
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
      this.updateConnectionStatus(
        "Disconnected",
        "bg-yellow-100 text-yellow-700"
      );

      // Try to reconnect after a delay
      setTimeout(() => {
        this.initializeWebSocket();
      }, 5000);
    };
  }

  private updateConnectionStatus(status: string, className: string): void {
    if (this.connectionStatusElement) {
      this.connectionStatusElement.textContent = status;
      // Preserve existing classes, replace only bg/text color utility classes
      const el = this.connectionStatusElement;
      el.classList.remove("bg-green-100","text-green-700","bg-red-100","text-red-700","bg-yellow-100","text-yellow-700");
      className.split(" ").forEach(c => c && el.classList.add(c));
    }
  }

  private handleTypingIndicator(data: any): void {
    console.log("Received typing indicator:", data);

    // Handle typing indicators for all conversations, not just selected one
    if (data.is_typing) {
      this.typingIndicators.set(data.username, {
        username: data.username,
        isTyping: true,
        timestamp: Date.now(),
      });
    } else {
      this.typingIndicators.delete(data.username);
    }

    // Update UI to show/hide typing indicators
    this.updateConversationTypingIndicators();

    // Also update typing indicator in the main chat if this is the selected friend
    if (data.username === this.selectedFriend?.username) {
      // Update main chat typing indicator
      this.updateMainChatTypingIndicator(data.is_typing);
    }
  }

  private handleReadReceipt(data: any): void {
    // Handle read receipts for messages
    if (this.pendingReadReceipts.has(data.message_id)) {
      this.pendingReadReceipts.delete(data.message_id);

      // Update message display to show as read
      this.updateMessageReadStatus(data.message_id, true);
    }
  }

  private sendReadReceipt(messageId: string): void {
    if (!this.ws) return;

    const readReceipt = {
      type: "read_receipt",
      message_id: messageId,
    };

    this.ws.send(JSON.stringify(readReceipt));
  }

  private updateMessageReadStatus(messageId: string, isRead: boolean): void {
    // Update the message display to show read status
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      // Update read status indicator
    }
  }

  private updateConversationTypingIndicator(
    username: string,
    isTyping: boolean
  ): void {
    // Update typing indicator in conversations list
    this.typingIndicators.set(username, {
      username,
      isTyping,
      timestamp: Date.now(),
    });
    this.updateConversationTypingIndicators();
  }

  private updateMainChatTypingIndicator(isTyping: boolean): void {
    console.log(
      "updateMainChatTypingIndicator called with isTyping:",
      isTyping
    );
    // Update typing indicator in the main chat area
    const typingIndicator = document.querySelector(".typing-indicator");
    console.log("Found main chat typing indicator:", !!typingIndicator);

    if (typingIndicator) {
      if (isTyping) {
        console.log("Showing main chat typing indicator");
        typingIndicator.classList.remove("hidden");
        // Set the username in the typing indicator
        const typingUsername =
          typingIndicator.querySelector(".typing-username");
        if (typingUsername && this.selectedFriend) {
          typingUsername.textContent = this.selectedFriend.username;
        }
      } else {
        console.log("Hiding main chat typing indicator");
        typingIndicator.classList.add("hidden");
      }
    }
  }

  private handleUserStatusUpdate(data: any): void {
    // Update status indicators in conversations list
    const username = data.username;
    const status = data.status; // "online" or "offline"

    console.log(`User ${username} is now ${status}`);

    // Update status in conversations list
    this.updateUserStatusInConversations(username, status);

    // Update status in currently selected friend header if applicable
    if (this.selectedFriend && this.selectedFriend.username === username) {
      this.selectedFriend.status = status as "online" | "offline";
      this.updateSelectedFriendStatus();
    }
  }

  private updateUserStatusInConversations(
    username: string,
    status: "online" | "offline"
  ): void {
    // Find all conversation elements for this user and update their status indicators
    const conversationElements = document.querySelectorAll(
      ".flex.items-center.space-x-3.p-3.rounded-lg"
    );

    conversationElements.forEach((element) => {
      const usernameElement = element.querySelector(
        ".conversation-username"
      ) as HTMLElement;
      if (usernameElement && usernameElement.textContent === username) {
        const statusIndicator = element.querySelector(
          ".status-indicator"
        ) as HTMLElement;
        if (statusIndicator) {
          if (status === "online") {
            statusIndicator.classList.add("bg-green-500");
            statusIndicator.classList.remove("bg-gray-400");
          } else {
            statusIndicator.classList.add("bg-gray-400");
            statusIndicator.classList.remove("bg-green-500");
          }
        }
      }
    });
  }

  private updateSelectedFriendStatus(): void {
    if (this.selectedFriend && this.selectedFriendStatusElement) {
      this.selectedFriendStatusElement.textContent =
        this.selectedFriend.status === "online" ? "● Online" : "○ Offline";
      this.selectedFriendStatusElement.className =
        this.selectedFriend.status === "online"
          ? "text-sm text-green-600"
          : "text-sm text-gray-500";
    }
  }

  private getCurrentConversationId(): string | null {
    return this.selectedFriend?.conversation_id || null;
  }

  private showNotification(message: string): void {
    // Show a toast notification
    console.log("Notification:", message);

    // You could implement a proper toast notification system here
    // For now, just log to console
  }

  private handleInitialConversationFromURL(): void {
    // Check if there's a conversation ID in the URL path
    const pathParts = window.location.pathname.split("/");
    const conversationId = pathParts[pathParts.length - 1];

    // Also check for conversation_id from backend template
    const templateConversationId = (window as any).initialConversationId;

    const targetConversationId =
      conversationId !== "chat" ? conversationId : templateConversationId;

    if (targetConversationId && targetConversationId !== "") {
      console.log("Found conversation ID in URL:", targetConversationId);
      // Wait a bit for conversations to load, then try to select
      setTimeout(() => {
        this.selectConversationById(targetConversationId);
      }, 1000);
    }
  }

  private selectConversationById(conversationId: string): void {
    // Find the conversation with matching ID
    const conversationElements = document.querySelectorAll(
      ".flex.items-center.space-x-3.p-3.rounded-lg"
    );

    for (let i = 0; i < conversationElements.length; i++) {
      const element = conversationElements[i];
      const usernameElement = element.querySelector(
        ".conversation-username"
      ) as HTMLElement;

      if (usernameElement) {
        const username = usernameElement.textContent;
        // We need to find the conversation data by username
        // Since we don't have direct access to the conversation data here,
        // we'll trigger a click on the matching element
        const conversationData = this.findConversationDataByUsername(username);
        if (
          conversationData &&
          conversationData.conversation_id === conversationId
        ) {
          console.log("Auto-selecting conversation:", conversationData);
          this.selectConversation(conversationData);
          return;
        }
      }
    }

    console.log("Could not find conversation with ID:", conversationId);
  }

  private findConversationDataByUsername(username: string): any | null {
    // This is a helper method to find conversation data by username
    // We'll need to store the conversations data when we load them
    return (
      this.conversationsData?.find((conv: any) => conv.username === username) ||
      null
    );
  }

  private updateURLForConversation(conversationId: string): void {
    // Update the URL to include the conversation ID
    const newUrl = `/chat/${conversationId}`;
    window.history.pushState({ conversationId }, "", newUrl);

    // Add event listener for browser back/forward navigation
    window.addEventListener("popstate", (event) => {
      this.handlePopState(event);
    });
  }

  private handlePopState(event: PopStateEvent): void {
    // Handle browser back/forward navigation
    const pathParts = window.location.pathname.split("/");
    const conversationId = pathParts[pathParts.length - 1];

    if (conversationId === "chat") {
      // User navigated back to main chat page
      this.clearSelectedConversation();
    } else {
      // User navigated to a specific conversation
      this.selectConversationById(conversationId);
    }
  }

  private clearSelectedConversation(): void {
    // Clear the selected conversation and show the "no friend selected" state
    this.selectedFriend = null;

    if (this.noFriendSelectedElement) {
      this.noFriendSelectedElement.classList.remove("hidden");
    }
    if (this.chatConversationElement) {
      this.chatConversationElement.classList.add("hidden");
    }
  }
}

// Initialize the chat app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  try {
    new ChatApp();
  } catch (error) {
    console.error("Failed to initialize ChatApp:", error);
  }
});
