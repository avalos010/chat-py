const ws = new WebSocket("ws://localhost:8000/ws");
const messageInput = document.getElementById("messageText");
const sendButton = document.getElementById("sendButton");

ws.onmessage = function (event) {
  const messages = document.getElementById("messages");
  const message = document.createElement("div");
  message.className = "message";
  message.textContent = event.data;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
};

function sendMessage() {
  if (messageInput.value.trim()) {
    ws.send(messageInput.value);
    messageInput.value = "";
  }
}

// Add event listeners
sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});
