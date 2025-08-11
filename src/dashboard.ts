import { protectRoute } from "./auth.js";

interface Contact {
  id: string;
  username: string;
  email: string;
  status: "online" | "offline";
  lastSeen?: string;
}

interface Conversation {
  id: string;
  contactId: string;
  contactUsername: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

class DashboardManager {
  private contentContainer: HTMLElement | null;
  private contacts: Contact[] = [];
  private conversations: Conversation[] = [];

  constructor() {
    this.contentContainer = document.getElementById("dashboard-content");
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.contentContainer) {
      await this.checkAuthentication();
      await this.loadDashboard();
    }
  }

  private async checkAuthentication(): Promise<void> {
    await protectRoute();
  }

  private async loadDashboard(): Promise<void> {
    try {
      // Try to load data from backend first
      const token = localStorage.getItem("token");
      if (token) {
        const response = await fetch("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Dashboard data loaded:", data);
          // In the future, this would load real contacts and conversations
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }

    // For now, load mock data. Later this will come from the backend
    this.loadMockData();
    this.renderDashboard();
  }

  private loadMockData(): void {
    // Mock contacts
    this.contacts = [
      {
        id: "1",
        username: "alice",
        email: "alice@example.com",
        status: "online",
      },
      {
        id: "2",
        username: "bob",
        email: "bob@example.com",
        status: "offline",
        lastSeen: "2 hours ago",
      },
      {
        id: "3",
        username: "charlie",
        email: "charlie@example.com",
        status: "online",
      },
    ];

    // Mock conversations
    this.conversations = [
      {
        id: "1",
        contactId: "1",
        contactUsername: "alice",
        lastMessage: "Hey, how are you?",
        timestamp: "2 min ago",
        unreadCount: 0,
      },
      {
        id: "2",
        contactId: "2",
        contactUsername: "bob",
        lastMessage: "See you tomorrow!",
        timestamp: "1 hour ago",
        unreadCount: 2,
      },
      {
        id: "3",
        contactId: "3",
        contactUsername: "charlie",
        lastMessage: "Thanks for the help!",
        timestamp: "3 hours ago",
        unreadCount: 0,
      },
    ];
  }

  private renderDashboard(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = `
      <div class="grid lg:grid-cols-3 gap-8 w-full">
        <!-- Contacts Panel -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="p-6 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-gray-900">Contacts</h2>
                <button id="addContactBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors">
                  + Add
                </button>
              </div>
            </div>
            <div class="p-4 space-y-3">
              ${this.renderContacts()}
            </div>
          </div>
        </div>

        <!-- Conversations Panel -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Recent Conversations</h2>
            </div>
            <div class="p-4 space-y-3">
              ${this.renderConversations()}
            </div>
          </div>
        </div>
      </div>

      <!-- Add Contact Modal -->
      <div id="addContactModal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Add New Contact</h3>
            <form id="addContactForm" class="space-y-4">
              <div>
                <label for="contactUsername" class="block text-sm font-medium text-gray-700">Username</label>
                <input type="text" id="contactUsername" name="username" required 
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              </div>
              <div>
                <label for="contactEmail" class="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" id="contactEmail" name="email" required 
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              </div>
              <div class="flex space-x-3">
                <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                  Add Contact
                </button>
                <button type="button" id="cancelAddContact" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private renderContacts(): string {
    return this.contacts
      .map(
        (contact) => `
      <div class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" 
           data-contact-id="${contact.id}">
        <div class="relative">
          <div class="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <span class="text-gray-600 font-medium">${contact.username
              .charAt(0)
              .toUpperCase()}</span>
          </div>
          <div class="absolute -bottom-1 -right-1 w-4 h-4 ${
            contact.status === "online" ? "bg-green-400" : "bg-gray-400"
          } rounded-full border-2 border-white"></div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${
            contact.username
          }</p>
          <p class="text-xs text-gray-500 truncate">${
            contact.status === "online"
              ? "Online"
              : `Last seen ${contact.lastSeen}`
          }</p>
        </div>
        <button class="text-blue-600 hover:text-blue-800 text-sm font-medium" onclick="startChat('${
          contact.id
        }')">
          Chat
        </button>
      </div>
    `
      )
      .join("");
  }

  private renderConversations(): string {
    if (this.conversations.length === 0) {
      return `
        <div class="text-center py-8">
          <div class="text-gray-400 mb-2">
            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
          </div>
          <p class="text-gray-500">No conversations yet</p>
          <p class="text-sm text-gray-400">Start chatting with your contacts!</p>
        </div>
      `;
    }

    return this.conversations
      .map(
        (conversation) => `
      <div class="flex items-center space-x-4 p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-gray-100" 
           data-conversation-id="${conversation.id}">
        <div class="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
          <span class="text-gray-600 font-medium">${conversation.contactUsername
            .charAt(0)
            .toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-gray-900">${
              conversation.contactUsername
            }</p>
            <p class="text-xs text-gray-500">${conversation.timestamp}</p>
          </div>
          <p class="text-sm text-gray-600 truncate">${
            conversation.lastMessage
          }</p>
        </div>
        ${
          conversation.unreadCount > 0
            ? `
          <div class="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            ${conversation.unreadCount}
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("");
  }

  private setupEventListeners(): void {
    // Dashboard signout button
    const dashboardSignoutBtn = document.getElementById("dashboardSignoutBtn");
    if (dashboardSignoutBtn) {
      dashboardSignoutBtn.addEventListener("click", () =>
        this.handleDashboardSignout()
      );
    }

    // Add contact button
    const addContactBtn = document.getElementById("addContactBtn");
    if (addContactBtn) {
      addContactBtn.addEventListener("click", () => this.showAddContactModal());
    }

    // Cancel add contact
    const cancelBtn = document.getElementById("cancelAddContact");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.hideAddContactModal());
    }

    // Add contact form
    const addContactForm = document.getElementById(
      "addContactForm"
    ) as HTMLFormElement;
    if (addContactForm) {
      addContactForm.addEventListener("submit", (e) =>
        this.handleAddContact(e)
      );
    }

    // Conversation click handlers
    const conversationElements = document.querySelectorAll(
      "[data-conversation-id]"
    );
    conversationElements.forEach((element) => {
      element.addEventListener("click", (e) => {
        const conversationId = (e.currentTarget as HTMLElement).dataset
          .conversationId;
        if (conversationId) {
          this.startConversation(conversationId);
        }
      });
    });
  }

  private showAddContactModal(): void {
    const modal = document.getElementById("addContactModal");
    if (modal) {
      modal.classList.remove("hidden");
    }
  }

  private hideAddContactModal(): void {
    const modal = document.getElementById("addContactModal");
    if (modal) {
      modal.classList.add("hidden");
    }
  }

  private async handleAddContact(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const username = formData.get("username") as string;
    const email = formData.get("email") as string;

    // Add to contacts (in real app, this would be an API call)
    const newContact: Contact = {
      id: Date.now().toString(),
      username,
      email,
      status: "offline",
    };

    this.contacts.push(newContact);
    this.hideAddContactModal();
    this.renderDashboard();

    // Reset form
    form.reset();
  }

  private startConversation(conversationId: string): void {
    const conversation = this.conversations.find(
      (c) => c.id === conversationId
    );
    if (conversation) {
      // In a real app, this would navigate to a chat page
      console.log(`Starting conversation with ${conversation.contactUsername}`);
      // For now, just show an alert
      alert(`Starting chat with ${conversation.contactUsername}`);
    }
  }

  private handleDashboardSignout(): void {
    localStorage.removeItem("token");

    // Dispatch custom event to notify other components
    document.dispatchEvent(new CustomEvent("authStateChanged"));

    // Redirect to login page
    window.location.href = "/login";
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new DashboardManager();
});

// Global function for starting chats (accessible from HTML)
(window as any).startChat = (contactId: string) => {
  console.log(`Starting chat with contact ${contactId}`);
  // In a real app, this would navigate to a chat page
  alert(`Starting chat with contact ${contactId}`);
};

// Export for use in other modules
export { DashboardManager };
