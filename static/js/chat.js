// src/chat.ts
var ChatApp = class {
  constructor() {
    this.ws = null;
    this.token = null;
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
    if (avatar) avatar.textContent = friend.username.charAt(0).toUpperCase();
    if (username) username.textContent = friend.username;
    if (email) email.textContent = friend.email;
    element.addEventListener("click", () => {
      this.selectFriend(friend);
    });
    return element;
  }
  selectFriend(friend) {
    console.log(`Selected friend: ${friend.username}`);
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
      this.noMessagesElement.classList.add("hidden");
      this.messagesContainer.classList.remove("hidden");
      let messageData;
      try {
        messageData = JSON.parse(event.data);
      } catch {
        messageData = {
          text: event.data,
          sender: "Unknown",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
  sendMessage() {
    if (!this.messageInput || !this.ws) return;
    const message = this.messageInput.value.trim();
    if (message) {
      const messageData = {
        text: message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sender: localStorage.getItem("username") || "You"
      };
      this.ws.send(JSON.stringify(messageData));
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
  addEventListeners() {
    if (!this.sendButton || !this.messageInput) return;
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
  }
};
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
