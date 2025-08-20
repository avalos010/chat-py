// src/chat.ts
var ChatApp = class {
  constructor() {
    this.ws = null;
    this.token = null;
    this.selectedFriend = null;
    this.conversations = /* @__PURE__ */ new Map();
    this.refreshInterval = null;
    this.refreshFriendsButton = null;
    this.messageInput = document.getElementById(
      "messageText"
    );
    this.sendButton = document.getElementById(
      "sendButton"
    );
    this.messagesContainer = document.getElementById(
      "messages"
    );
    this.noMessagesElement = document.getElementById(
      "noMessages"
    );
    this.friendsListElement = document.getElementById(
      "friendsList"
    );
    this.friendsLoadingElement = document.getElementById(
      "friendsLoading"
    );
    this.noFriendsElement = document.getElementById(
      "noFriends"
    );
    this.connectionStatusElement = document.getElementById(
      "connectionStatus"
    );
    this.userInfoElement = document.getElementById(
      "userInfo"
    );
    this.noFriendSelectedElement = document.getElementById("noFriendSelected");
    this.chatConversationElement = document.getElementById("chatConversation");
    this.selectedFriendAvatarElement = document.getElementById(
      "selectedFriendAvatar"
    );
    this.selectedFriendNameElement = document.getElementById("selectedFriendName");
    this.selectedFriendStatusElement = document.getElementById(
      "selectedFriendStatus"
    );
    this.refreshFriendsButton = document.getElementById(
      "refreshFriends"
    );
    if (!this.messageInput || !this.sendButton || !this.messagesContainer) {
      throw new Error("Required DOM elements not found");
    }
    this.token = localStorage.getItem("token");
    this.initialize();
  }
  async initialize() {
    await this.checkAuthentication();
    this.loadFriendsList();
    this.initializeWebSocket();
    this.addEventListeners();
    this.setUserInfo();
    this.setupAutoRefresh();
  }
  async checkAuthentication() {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    try {
      const response = await fetch("/check-auth", {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
  async loadFriendsList() {
    try {
      const response = await fetch("/api/friends", {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
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
  displayFriends(friends) {
    if (!this.friendsListElement || !this.friendsLoadingElement || !this.noFriendsElement)
      return;
    this.friendsLoadingElement.classList.add("hidden");
    if (friends.length === 0) {
      this.noFriendsElement.classList.remove("hidden");
      return;
    }
    this.friendsListElement.classList.remove("hidden");
    this.noFriendsElement.classList.add("hidden");
    this.friendsListElement.innerHTML = "";
    friends.forEach((friend) => {
      const friendElement = this.createFriendElement(friend);
      this.friendsListElement.appendChild(friendElement);
    });
  }
  showNoFriends() {
    if (!this.friendsLoadingElement || !this.noFriendsElement) return;
    this.friendsLoadingElement.classList.add("hidden");
    this.noFriendsElement.classList.remove("hidden");
  }
  createFriendElement(friend) {
    const template = document.getElementById(
      "friendTemplate"
    );
    if (!template) return document.createElement("div");
    const clone = template.content.cloneNode(true);
    const element = clone.firstElementChild;
    if (!element) return document.createElement("div");
    const avatar = element.querySelector(".w-8.h-8");
    const username = element.querySelector("p:first-of-type");
    const email = element.querySelector("p:last-of-type");
    const unreadBadge = element.querySelector(".unread-badge");
    if (avatar) avatar.textContent = friend.username.charAt(0).toUpperCase();
    if (username) username.textContent = friend.username;
    if (email) email.textContent = friend.email;
    if (unreadBadge && friend.unread_count && friend.unread_count > 0) {
      unreadBadge.textContent = friend.unread_count.toString();
      unreadBadge.classList.remove("hidden");
    }
    element.addEventListener("click", () => {
      this.selectFriend(friend);
    });
    return element;
  }
  selectFriend(friend) {
    this.selectedFriend = friend;
    if (this.noFriendSelectedElement && this.chatConversationElement) {
      this.noFriendSelectedElement.classList.add("hidden");
      this.chatConversationElement.classList.remove("hidden");
    }
    if (this.selectedFriendAvatarElement) {
      this.selectedFriendAvatarElement.textContent = friend.username.charAt(0).toUpperCase();
    }
    if (this.selectedFriendNameElement) {
      this.selectedFriendNameElement.textContent = friend.username;
    }
    if (this.selectedFriendStatusElement) {
      this.selectedFriendStatusElement.textContent = "\u25CF Online";
      this.selectedFriendStatusElement.className = "text-sm text-green-600";
    }
    this.loadConversation(friend.friend_id);
    this.markMessagesAsRead(friend.friend_id);
    if (this.messageInput) {
      this.messageInput.focus();
    }
    console.log(`Selected friend: ${friend.username}`);
  }
  async markMessagesAsRead(friendId) {
    try {
      await fetch(`/api/conversation/${friendId}/mark-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      this.updateUnreadCount(friendId, 0);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }
  updateUnreadCount(friendId, count) {
    const friendElements = document.querySelectorAll(".friend-item");
    friendElements.forEach((element) => {
      const usernameElement = element.querySelector("p:first-of-type");
      if (usernameElement && usernameElement.textContent === this.selectedFriend?.username) {
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
  updateUnreadCountForFriend(username) {
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
  loadConversation(friendId) {
    const conversation = this.conversations.get(friendId) || [];
    if (conversation.length === 0) {
      this.loadConversationFromServer(friendId);
    } else {
      if (this.noMessagesElement && this.messagesContainer) {
        this.noMessagesElement.classList.add("hidden");
        this.messagesContainer.classList.remove("hidden");
      }
      this.displayMessages(conversation);
    }
  }
  async loadConversationFromServer(friendId) {
    try {
      const response = await fetch(`/api/conversation/${friendId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const messages = data.conversation.map((msg) => ({
          text: msg.message_text,
          timestamp: msg.timestamp,
          sender: msg.sender_username,
          sender_id: msg.sender_id
        }));
        this.conversations.set(friendId, messages);
        if (messages.length === 0) {
          if (this.noMessagesElement && this.messagesContainer) {
            this.noMessagesElement.classList.remove("hidden");
            this.messagesContainer.classList.add("hidden");
          }
        } else {
          if (this.noMessagesElement && this.messagesContainer) {
            this.noMessagesElement.classList.add("hidden");
            this.messagesContainer.classList.remove("hidden");
          }
          this.displayMessages(messages);
        }
      } else {
        console.error("Failed to load conversation");
        if (this.noMessagesElement && this.messagesContainer) {
          this.noMessagesElement.classList.remove("hidden");
          this.messagesContainer.classList.add("hidden");
        }
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      if (this.noMessagesElement && this.messagesContainer) {
        this.noMessagesElement.classList.remove("hidden");
        this.messagesContainer.classList.add("hidden");
      }
    }
  }
  setUserInfo() {
    if (!this.userInfoElement) return;
    const username = localStorage.getItem("username") || "User";
    this.userInfoElement.textContent = `Welcome, ${username}!`;
  }
  initializeWebSocket() {
    if (!this.token) {
      console.error("No token found for WebSocket connection");
      this.updateConnectionStatus(
        "Not authenticated",
        "bg-red-100 text-red-700"
      );
      return;
    }
    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${this.token}`);
    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.updateConnectionStatus("Connected", "bg-green-100 text-green-700");
    };
    this.ws.onmessage = (event) => {
      if (!this.messagesContainer || !this.noMessagesElement) return;
      try {
        const messageData = JSON.parse(event.data);
        if (messageData.type === "message") {
          const message = {
            text: messageData.message_text,
            timestamp: messageData.timestamp,
            sender: messageData.sender_username
          };
          if (this.selectedFriend && (messageData.sender_username === this.selectedFriend.username || messageData.recipient_username === this.selectedFriend.username)) {
            this.noMessagesElement.classList.add("hidden");
            this.messagesContainer.classList.remove("hidden");
            const conversation = this.conversations.get(this.selectedFriend.friend_id) || [];
            conversation.push(message);
            this.conversations.set(this.selectedFriend.friend_id, conversation);
            const messageElement = this.createMessageElement(message);
            this.messagesContainer.appendChild(messageElement);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
          } else {
            this.updateUnreadCountForFriend(messageData.sender_username);
          }
        } else if (messageData.type === "message_sent") {
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
  updateConnectionStatus(text, classes) {
    if (!this.connectionStatusElement) return;
    this.connectionStatusElement.textContent = text;
    this.connectionStatusElement.className = `px-3 py-1 rounded-full text-sm ${classes}`;
  }
  createMessageElement(messageData) {
    const template = document.getElementById(
      "messageTemplate"
    );
    if (!template) return document.createElement("div");
    const clone = template.content.cloneNode(true);
    const element = clone.firstElementChild;
    if (!element) return document.createElement("div");
    const avatar = element.querySelector(".w-8.h-8");
    const username = element.querySelector("span:first-of-type");
    const timestamp = element.querySelector("span:last-of-type");
    const messageText = element.querySelector("p");
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
  displayMessages(messages) {
    if (!this.messagesContainer) return;
    this.messagesContainer.innerHTML = "";
    messages.forEach((message) => {
      const messageElement = this.createMessageElement(message);
      this.messagesContainer.appendChild(messageElement);
    });
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  sendMessage() {
    if (!this.messageInput || !this.ws || !this.selectedFriend) return;
    const message = this.messageInput.value.trim();
    if (message) {
      const messageData = {
        text: message,
        recipient: this.selectedFriend.username
      };
      this.ws.send(JSON.stringify(messageData));
      const localMessage = {
        text: message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sender: localStorage.getItem("username") || "You"
      };
      const conversation = this.conversations.get(this.selectedFriend.friend_id) || [];
      conversation.push(localMessage);
      this.conversations.set(this.selectedFriend.friend_id, conversation);
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
  addEventListeners() {
    if (!this.sendButton || !this.messageInput) return;
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
    if (this.refreshFriendsButton) {
      this.refreshFriendsButton.addEventListener("click", () => {
        this.refreshFriendsList();
      });
    }
  }
  async refreshFriendsList() {
    if (this.refreshFriendsButton) {
      this.refreshFriendsButton.disabled = true;
      this.refreshFriendsButton.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
      `;
    }
    try {
      await this.loadFriendsList();
      if (this.refreshFriendsButton) {
        this.refreshFriendsButton.innerHTML = `
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        `;
        setTimeout(() => {
          if (this.refreshFriendsButton) {
            this.refreshFriendsButton.innerHTML = `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            `;
            this.refreshFriendsButton.disabled = false;
          }
        }, 2e3);
      }
    } catch (error) {
      console.error("Failed to refresh friends:", error);
      if (this.refreshFriendsButton) {
        this.refreshFriendsButton.innerHTML = `
          <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        `;
        setTimeout(() => {
          if (this.refreshFriendsButton) {
            this.refreshFriendsButton.innerHTML = `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            `;
            this.refreshFriendsButton.disabled = false;
          }
        }, 2e3);
      }
    }
  }
  setupAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      this.loadFriendsList();
    }, 3e4);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.loadFriendsList();
      }
    });
  }
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
};
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
