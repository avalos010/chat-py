"use strict";
class ChatApp {
    constructor() {
        this.ws = new WebSocket("ws://localhost:8000/ws");
        this.messageInput = document.getElementById("messageText");
        this.sendButton = document.getElementById("sendButton");
        this.messagesContainer = document.getElementById("messages");
        if (!this.messageInput || !this.sendButton || !this.messagesContainer) {
            throw new Error("Required DOM elements not found");
        }
        this.initializeWebSocket();
        this.addEventListeners();
    }
    initializeWebSocket() {
        this.ws.onmessage = (event) => {
            if (!this.messagesContainer)
                return;
            const message = document.createElement("div");
            message.className =
                "p-3 bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5";
            message.textContent = event.data;
            this.messagesContainer.appendChild(message);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        };
    }
    sendMessage() {
        if (!this.messageInput)
            return;
        const message = this.messageInput.value.trim();
        if (message) {
            this.ws.send(message);
            this.messageInput.value = "";
        }
    }
    addEventListeners() {
        if (!this.sendButton || !this.messageInput)
            return;
        this.sendButton.addEventListener("click", () => this.sendMessage());
        this.messageInput.addEventListener("keypress", (e) => {
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
