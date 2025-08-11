import { protectRoute } from "./auth.js";

interface ChatMessage {
  text: string;
  timestamp: string;
  sender: string;
}

class ChatApp {
  private ws: WebSocket | null = null;
  private messageInput: HTMLInputElement | null;
  private sendButton: HTMLButtonElement | null;
  private messagesContainer: HTMLDivElement | null;

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

    if (!this.messageInput || !this.sendButton || !this.messagesContainer) {
      throw new Error("Required DOM elements not found");
    }

    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check authentication first
    await protectRoute();

    // Initialize WebSocket with authentication
    this.initializeWebSocket();
    this.addEventListeners();
  }

  private initializeWebSocket(): void {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No token found for WebSocket connection");
      return;
    }

    // Connect to WebSocket with authentication token
    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

    this.ws.onmessage = (event: MessageEvent) => {
      if (!this.messagesContainer) return;

      const message = document.createElement("div");
      message.className =
        "p-3 bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5";
      message.textContent = event.data;
      this.messagesContainer.appendChild(message);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }

  private sendMessage(): void {
    if (!this.messageInput || !this.ws) return;

    const message = this.messageInput.value.trim();
    if (message) {
      this.ws.send(message);
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
