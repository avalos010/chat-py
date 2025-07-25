interface ChatMessage {
  text: string;
  timestamp: string;
  sender: string;
}

class ChatApp {
  private ws: WebSocket;
  private messageInput: HTMLInputElement | null;
  private sendButton: HTMLButtonElement | null;
  private messagesContainer: HTMLDivElement | null;

  constructor() {
    this.ws = new WebSocket("ws://localhost:8000/ws");
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

    this.initializeWebSocket();
    this.addEventListeners();
  }

  private initializeWebSocket(): void {
    this.ws.onmessage = (event: MessageEvent) => {
      if (!this.messagesContainer) return;

      const message = document.createElement("div");
      message.className =
        "p-3 bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5";
      message.textContent = event.data;
      this.messagesContainer.appendChild(message);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    };
  }

  private sendMessage(): void {
    if (!this.messageInput) return;

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
