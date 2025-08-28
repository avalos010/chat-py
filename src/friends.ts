// Friends functionality for chat-py
console.log("=== FRIENDS.TS SCRIPT LOADING ===");

interface User {
  id: number;
  username: string;
  email: string;
}

interface FriendRequest {
  id: number;
  user_id: number;
  created_at: string;
  username: string;
  email: string;
}

interface Friend {
  friend_id: number;
  username: string;
  email: string;
  status?: "online" | "offline";
}

class FriendsManager {
  // Token is now stored in HttpOnly cookies, not accessible from JavaScript
  private ws: WebSocket | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadFriendsList();
    await this.loadAllFriendRequests(); // Load all requests directly
    // Removed loadSentFriendRequests() since it's now consolidated
    this.setupEventListeners();
    this.initializeWebSocket();
  }

  private setupEventListeners(): void {
    // Search functionality
    const searchInput = document.getElementById(
      "userSearch"
    ) as HTMLInputElement;
    const searchBtn = document.getElementById("searchBtn") as HTMLButtonElement;

    if (searchInput && searchBtn) {
      // Search on button click
      searchBtn.addEventListener("click", () => {
        this.searchUsers(searchInput.value.trim());
      });

      // Search on Enter key
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.searchUsers(searchInput.value.trim());
        }
      });

      // Search on input change (debounced)
      let searchTimeout: NodeJS.Timeout;
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          if (searchInput.value.trim().length >= 2) {
            this.searchUsers(searchInput.value.trim());
          } else {
            this.hideSearchResults();
          }
        }, 300);
      });
    }
  }

  private async searchUsers(searchTerm: string): Promise<void> {
    if (searchTerm.length < 2) {
      this.hideSearchResults();
      return;
    }

    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchTerm)}`,
        {}
      );

      if (response.ok) {
        const data = await response.json();
        this.displaySearchResults(data.users);
      } else {
        console.error("Failed to search users");
        this.hideSearchResults();
      }
    } catch (error) {
      console.error("Error searching users:", error);
      this.hideSearchResults();
    }
  }

  private displaySearchResults(users: User[]): void {
    const searchResults = document.getElementById("searchResults");
    const noResults = document.getElementById("noResults");

    if (!searchResults || !noResults) return;

    if (users.length === 0) {
      searchResults.classList.add("hidden");
      noResults.classList.remove("hidden");
      return;
    }

    searchResults.innerHTML = "";
    users.forEach((user) => {
      const userElement = this.createUserSearchElement(user);
      searchResults.appendChild(userElement);
    });

    searchResults.classList.remove("hidden");
    noResults.classList.add("hidden");
  }

  private hideSearchResults(): void {
    const searchResults = document.getElementById("searchResults");
    const noResults = document.getElementById("noResults");

    if (searchResults) searchResults.classList.add("hidden");
    if (noResults) noResults.classList.add("hidden");
  }

  private createUserSearchElement(user: User): HTMLElement {
    const template = document.getElementById(
      "userSearchTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set user info
    const avatar = element.querySelector(".w-10.h-10") as HTMLElement;
    const username = element.querySelector("p:first-of-type") as HTMLElement;
    const email = element.querySelector("p:last-of-type") as HTMLElement;

    if (avatar) avatar.textContent = user.username.charAt(0).toUpperCase();
    if (username) username.textContent = user.username;
    if (email) email.textContent = user.email;

    // Setup add friend button
    const addButton = element.querySelector(
      ".send-request"
    ) as HTMLButtonElement;
    if (addButton) {
      addButton.addEventListener("click", () =>
        this.sendFriendRequest(user.id)
      );
    }

    return element;
  }

  private async sendFriendRequest(friendId: number): Promise<void> {
    try {
      const response = await fetch("/api/friend-request/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (response.ok) {
        alert("Friend request sent successfully!");
        // Refresh both friend requests and sent friend requests
        this.loadFriendRequests();
        this.loadSentFriendRequests();
        // Hide search results
        this.hideSearchResults();
        // Clear search input
        const searchInput = document.getElementById(
          "userSearch"
        ) as HTMLInputElement;
        if (searchInput) searchInput.value = "";
      } else {
        const errorData = await response.json();
        alert(`Failed to send friend request: ${errorData.detail}`);
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      alert("An error occurred while sending the friend request");
    }
  }

  private async loadFriendRequests(): Promise<void> {
    try {
      const response = await fetch("/api/friend-requests", {
        headers: {},
      });

      if (response.ok) {
        const data = await response.json();
        this.displayFriendRequests(data.requests);
      } else {
        console.error("Failed to load friend requests");
        this.showNoFriendRequests();
      }
    } catch (error) {
      console.error("Error loading friend requests:", error);
      this.showNoFriendRequests();
    }
  }

  private async loadSentFriendRequests(): Promise<void> {
    try {
      const response = await fetch("/api/sent-friend-requests", {
        headers: {},
      });

      if (response.ok) {
        const data = await response.json();
        this.displaySentFriendRequests(data.requests);
      } else {
        console.error("Failed to load sent friend requests");
        this.showNoSentFriendRequests();
      }
    } catch (error) {
      console.error("Error loading sent friend requests:", error);
      this.showNoSentFriendRequests();
    }
  }

  private displayFriendRequests(requests: FriendRequest[]): void {
    const container = document.getElementById("friendRequests");
    const loading = document.getElementById("requestsLoading");
    const noRequests = document.getElementById("noRequests");

    if (!container || !loading || !noRequests) return;

    if (requests.length === 0) {
      loading.classList.add("hidden");
      noRequests.classList.remove("hidden");
      return;
    }

    loading.classList.add("hidden");
    noRequests.classList.add("hidden");

    // Clear existing requests
    const existingRequests = container.querySelectorAll("[data-request-id]");
    existingRequests.forEach((el) => el.remove());

    // Add new requests
    requests.forEach((request) => {
      const requestElement = this.createFriendRequestElement(request);
      container.appendChild(requestElement);
    });
  }

  private showNoFriendRequests(): void {
    const loading = document.getElementById("requestsLoading");
    const noRequests = document.getElementById("noRequests");

    if (loading) loading.classList.add("hidden");
    if (noRequests) noRequests.classList.remove("hidden");
  }

  private displaySentFriendRequests(requests: FriendRequest[]): void {
    const container = document.getElementById("sentFriendRequests");
    const loading = document.getElementById("sentRequestsLoading");
    const noRequests = document.getElementById("noSentRequests");

    if (!container || !loading || !noRequests) return;

    if (requests.length === 0) {
      loading.classList.add("hidden");
      noRequests.classList.remove("hidden");
      return;
    }

    loading.classList.add("hidden");
    noRequests.classList.add("hidden");

    // Clear existing sent requests
    const existingRequests = container.querySelectorAll(
      "[data-sent-request-id]"
    );
    existingRequests.forEach((el) => el.remove());

    // Add new sent requests
    requests.forEach((request) => {
      const requestElement = this.createSentFriendRequestElement(request);
      container.appendChild(requestElement);
    });
  }

  private showNoSentFriendRequests(): void {
    const loading = document.getElementById("sentRequestsLoading");
    const noRequests = document.getElementById("noSentRequests");

    if (loading) loading.classList.add("hidden");
    if (noRequests) noRequests.classList.remove("hidden");
  }

  private createFriendRequestElement(request: FriendRequest): HTMLElement {
    const template = document.getElementById(
      "friendRequestTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set request info
    const avatar = element.querySelector(".w-10.h-10") as HTMLElement;
    const username = element.querySelector("p:first-of-type") as HTMLElement;
    const email = element.querySelector("p:last-of-type") as HTMLElement;

    if (avatar) avatar.textContent = request.username.charAt(0).toUpperCase();
    if (username) username.textContent = request.username;
    if (email) email.textContent = request.email;

    // Setup accept/reject buttons
    const acceptButton = element.querySelector(
      ".accept-request"
    ) as HTMLButtonElement;
    const rejectButton = element.querySelector(
      ".reject-request"
    ) as HTMLButtonElement;

    if (acceptButton) {
      acceptButton.addEventListener("click", () => {
        this.acceptFriendRequest(request.user_id);
        // Hide the actual friend request element, not the template
        element.classList.add("hidden");
      });
    }

    if (rejectButton) {
      rejectButton.addEventListener("click", () =>
        this.rejectFriendRequest(request.user_id)
      );
    }

    // Add data attribute for identification
    element.setAttribute("data-request-id", request.id.toString());

    return element;
  }

  private createSentFriendRequestElement(request: FriendRequest): HTMLElement {
    const template = document.getElementById(
      "sentFriendRequestTemplate"
    ) as HTMLTemplateElement;
    if (!template) return document.createElement("div");

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement;
    if (!element) return document.createElement("div");

    // Set request info
    const avatar = element.querySelector(".w-10.h-10") as HTMLElement;
    const username = element.querySelector("p:first-of-type") as HTMLElement;
    const email = element.querySelector("p:last-of-type") as HTMLElement;

    if (avatar) avatar.textContent = request.username.charAt(0).toUpperCase();
    if (username) username.textContent = request.username;
    if (email) email.textContent = request.email;

    // Setup cancel button
    const cancelButton = element.querySelector(
      ".cancel-request"
    ) as HTMLButtonElement;

    if (cancelButton) {
      cancelButton.addEventListener("click", () =>
        this.cancelFriendRequest(request.user_id)
      );
    }

    // Add data attribute for identification
    element.setAttribute("data-sent-request-id", request.id.toString());

    return element;
  }

  private async acceptFriendRequest(friendId: number): Promise<void> {
    try {
      const response = await fetch("/api/friend-request/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (response.ok) {
        alert("Friend request accepted!");
        // Refresh both lists
        this.loadFriendRequests();
        this.loadFriendsList();
      } else {
        const errorData = await response.json();
        alert(`Failed to accept friend request: ${errorData.detail}`);
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      alert("An error occurred while accepting the friend request");
    }
  }

  private async rejectFriendRequest(friendId: number): Promise<void> {
    try {
      const response = await fetch("/api/friend-request/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (response.ok) {
        alert("Friend request rejected");
        // Refresh friend requests
        this.loadFriendRequests();
      } else {
        const errorData = await response.json();
        alert(`Failed to reject friend request: ${errorData.detail}`);
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      alert("An error occurred while rejecting the friend request");
    }
  }

  private async cancelFriendRequest(friendId: number): Promise<void> {
    if (!confirm("Are you sure you want to cancel this friend request?")) {
      return;
    }

    try {
      const response = await fetch(`/api/friend-request/cancel/${friendId}`, {
        method: "DELETE",
        headers: {},
      });

      if (response.ok) {
        alert("Friend request canceled successfully");
        // Refresh sent friend requests
        this.loadSentFriendRequests();
      } else {
        const errorData = await response.json();
        alert(`Failed to cancel friend request: ${errorData.detail}`);
      }
    } catch (error) {
      console.error("Error canceling friend request:", error);
      alert("An error occurred while canceling the friend request");
    }
  }

  private async loadFriendsList(): Promise<void> {
    try {
      const response = await fetch("/api/friends", {
        headers: {},
      });

      if (response.ok) {
        const data = await response.json();
        this.displayFriendsList(data.friends);

        // Load online status for all friends
        await this.loadFriendsOnlineStatus();
      } else {
        console.error("Failed to load friends list");
        this.showNoFriends();
      }
    } catch (error) {
      console.error("Error loading friends list:", error);
      this.showNoFriends();
    }
  }

  private displayFriendsList(friends: Friend[]): void {
    const container = document.getElementById("friendsList");
    const loading = document.getElementById("friendsLoading");
    const noFriends = document.getElementById("noFriends");

    if (!container || !loading || !noFriends) return;

    if (friends.length === 0) {
      loading.classList.add("hidden");
      noFriends.classList.remove("hidden");
      return;
    }

    loading.classList.add("hidden");
    noFriends.classList.add("hidden");

    // Clear existing friends
    const existingFriends = container.querySelectorAll("[data-friend-id]");
    existingFriends.forEach((el) => el.remove());

    // Add new friends
    friends.forEach((friend) => {
      const friendElement = this.createFriendElement(friend);
      container.appendChild(friendElement);
    });
  }

  private showNoFriends(): void {
    const loading = document.getElementById("friendsLoading");
    const noFriends = document.getElementById("noFriends");

    if (loading) loading.classList.add("hidden");
    if (noFriends) noFriends.classList.remove("hidden");
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
    const avatar = element.querySelector(".w-10.h-10") as HTMLElement;
    const username = element.querySelector("p:first-of-type") as HTMLElement;
    const email = element.querySelector("p:last-of-type") as HTMLElement;

    if (avatar) avatar.textContent = friend.username.charAt(0).toUpperCase();
    if (username) username.textContent = friend.username;
    if (email) email.textContent = friend.email;

    // Add online status indicator
    const statusIndicator = element.querySelector(
      ".status-indicator"
    ) as HTMLElement;
    if (statusIndicator) {
      const status = friend.status || "offline";
      statusIndicator.className = `status-indicator w-3 h-3 rounded-full ${
        status === "online" ? "bg-green-500" : "bg-gray-400"
      }`;
      statusIndicator.title = `${friend.username} is ${status}`;
    }

    // Setup remove friend button
    const removeButton = element.querySelector(
      ".remove-friend"
    ) as HTMLButtonElement;
    if (removeButton) {
      removeButton.addEventListener("click", () =>
        this.removeFriend(friend.friend_id)
      );
    }

    // Add data attribute for identification
    element.setAttribute("data-friend-id", friend.friend_id.toString());

    return element;
  }

  private async removeFriend(friendId: number): Promise<void> {
    if (!confirm("Are you sure you want to remove this friend?")) {
      return;
    }

    try {
      const response = await fetch(`/api/friends/${friendId}`, {
        method: "DELETE",
        headers: {},
      });

      if (response.ok) {
        // Remove the friend element from the DOM
        const friendElement = document.querySelector(
          `[data-friend-id="${friendId}"]`
        );
        if (friendElement) {
          friendElement.remove();
        }

        // Also remove from friends list if it exists
        const friendsList = document.getElementById("friendsList");
        if (friendsList) {
          const friendItem = friendsList.querySelector(
            `[data-friend-id="${friendId}"]`
          );
          if (friendItem) {
            friendItem.remove();
          }
        }

        alert("Friend removed successfully");
      } else {
        const errorData = await response.json();
        alert(`Failed to remove friend: ${errorData.detail}`);
      }
    } catch (error) {
      console.error("Error removing friend:", error);
      alert("An error occurred while removing the friend");
    }
  }

  private async loadAllFriendRequests(): Promise<void> {
    try {
      const response = await fetch("/api/all-friend-requests", {
        headers: {},
      });

      if (response.ok) {
        const data = await response.json();
        this.displayAllFriendRequests(data.requests);
      } else {
        console.error("Failed to load all friend requests");
      }
    } catch (error) {
      console.error("Error loading all friend requests:", error);
    }
  }

  private displayAllFriendRequests(requests: any[]): void {
    const container = document.getElementById("allFriendRequests");
    if (!container) return;

    // Clear existing content
    container.innerHTML = "";

    if (requests.length === 0) {
      container.innerHTML =
        '<p class="text-gray-500 text-center py-4">No pending friend requests</p>';
      return;
    }

    // Group requests by type
    const incoming = requests.filter((r) => r.request_type === "incoming");
    const outgoing = requests.filter((r) => r.request_type === "outgoing");

    // Display incoming requests
    if (incoming.length > 0) {
      const incomingSection = document.createElement("div");
      incomingSection.className = "mb-6";
      incomingSection.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Incoming Requests</h3>
        <div class="space-y-3">
          ${incoming
            .map(
              (request) => `
            <div class="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                  ${request.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p class="font-medium text-gray-900">${request.username}</p>
                  <p class="text-sm text-gray-500">${request.email}</p>
                </div>
              </div>
              <div class="flex space-x-2">
                <button class="accept-request bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-user-id="${
                  request.user_id
                }">
                  Accept
                </button>
                <button class="reject-request bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-user-id="${
                  request.user_id
                }">
                  Reject
                </button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
      container.appendChild(incomingSection);
    }

    // Display outgoing requests
    if (outgoing.length > 0) {
      const outgoingSection = document.createElement("div");
      outgoingSection.className = "mb-6";
      outgoingSection.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Outgoing Requests</h3>
        <div class="space-y-3">
          ${outgoing
            .map(
              (request) => `
            <div class="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                  ${request.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p class="font-medium text-gray-900">${request.username}</p>
                  <p class="text-sm text-gray-500">${request.email}</p>
                </div>
              </div>
              <button class="cancel-request bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-friend-id="${
                request.friend_id
              }">
                Cancel
              </button>
            </div>
          `
            )
            .join("")}
        </div>
      `;
      container.appendChild(outgoingSection);
    }

    // Add event listeners
    this.addAllRequestEventListeners();
  }

  private addAllRequestEventListeners(): void {
    // Accept buttons
    document.querySelectorAll(".accept-request").forEach((button) => {
      button.addEventListener("click", (e) => {
        const userId = (e.target as HTMLElement).getAttribute("data-user-id");
        if (userId) {
          this.acceptFriendRequest(parseInt(userId));
          // Hide the request element
          (e.target as HTMLElement)
            .closest(".bg-white")
            ?.classList.add("hidden");
        }
      });
    });

    // Reject buttons
    document.querySelectorAll(".reject-request").forEach((button) => {
      button.addEventListener("click", (e) => {
        const userId = (e.target as HTMLElement).getAttribute("data-user-id");
        if (userId) {
          this.rejectFriendRequest(parseInt(userId));
          // Hide the request element
          (e.target as HTMLElement)
            .closest(".bg-white")
            ?.classList.add("hidden");
        }
      });
    });

    // Cancel buttons
    document.querySelectorAll(".cancel-request").forEach((button) => {
      button.addEventListener("click", (e) => {
        const friendId = (e.target as HTMLElement).getAttribute(
          "data-friend-id"
        );
        if (friendId) {
          this.cancelFriendRequest(parseInt(friendId));
          // Hide the request element
          (e.target as HTMLElement)
            .closest(".bg-white")
            ?.classList.add("hidden");
        }
      });
    });
  }

  private async toggleAllRequestsView(): Promise<void> {
    // This method is no longer needed
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      // Get auth token from server for WebSocket connection
      const tokenResponse = await fetch("/api/ws-token");
      if (!tokenResponse.ok) {
        console.error("Failed to get WebSocket token for friends");
        return;
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      // Connect to WebSocket with token as query parameter
      this.ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

      this.ws.onopen = () => {
        console.log("Friends WebSocket connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Friends WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("Friends WebSocket connection closed");
      };
    } catch (error) {
      console.error("Error initializing friends WebSocket:", error);
    }
  }

  private handleWebSocketMessage(message: any): void {
    const type = message.type;

    switch (type) {
      case "friend_request_update":
        if (message.request_type === "sent") {
          this.loadSentFriendRequests(); // Refresh sent friend requests
        } else if (message.request_type === "received") {
          this.loadAllFriendRequests(); // Refresh received friend requests
        } else if (message.request_type === "accepted") {
          this.loadAllFriendRequests(); // Refresh friend requests
          this.loadFriendsList(); // Refresh friends list
          this.showToastNotification(
            `${message.sender_username} accepted your friend request!`
          );
        } else if (message.request_type === "rejected") {
          this.loadAllFriendRequests(); // Refresh friend requests
          this.showToastNotification(
            `${message.sender_username} declined your friend request`
          );
        }
        break;

      case "user_status_update":
        // Handle user online/offline status updates
        console.log(`User ${message.username} is now ${message.status}`);
        this.updateUserStatus(message.user_id, message.status);
        break;

      default:
        // Ignore other message types (like chat messages)
        break;
    }
  }

  private updateUserStatus(userId: number, status: string): void {
    // Update status indicators in the UI for friends list
    const statusElements = document.querySelectorAll(
      `[data-friend-id="${userId}"] .status-indicator`
    );
    statusElements.forEach((element) => {
      const statusElement = element as HTMLElement;
      if (status === "online") {
        statusElement.className =
          "status-indicator w-3 h-3 rounded-full bg-green-500";
        statusElement.title = "Online";
      } else {
        statusElement.className =
          "status-indicator w-3 h-3 rounded-full bg-gray-400";
        statusElement.title = "Offline";
      }
    });
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

  private async loadFriendsOnlineStatus(): Promise<void> {
    try {
      const response = await fetch("/api/friends/online-status", {
        headers: {},
      });

      if (response.ok) {
        const data = await response.json();
        // Update status indicators for each friend
        data.friends_status.forEach((friendStatus: any) => {
          this.updateUserStatus(friendStatus.friend_id, friendStatus.status);
        });
      }
    } catch (error) {
      console.error("Error loading friends online status:", error);
    }
  }
}

// Initialize friends functionality when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded - Friends script is running!");
  new FriendsManager();
});
