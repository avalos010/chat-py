import { protectRoute } from "./auth.js";
import { ParticleBackground } from "./particles.js";

interface Contact {
  id: string;
  username: string;
  email: string;
  status: "online" | "offline";
  lastSeen?: string;
}

class HomePageManager {
  private contentContainer: HTMLElement | null;
  private particleBackground: ParticleBackground | null = null;

  constructor() {
    this.contentContainer = document.getElementById("home-content");
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.contentContainer) {
      await this.loadContent();
    }

    // Initialize particle background
    this.initParticleBackground();
  }

  private initParticleBackground(): void {
    try {
      this.particleBackground = new ParticleBackground("particle-background");
    } catch (error) {
      console.error("Failed to initialize particle background:", error);
    }
  }

  private async loadContent(): Promise<void> {
    // Prefer cookie-based auth; fallback to localStorage for backward compatibility
    const cookieToken = document.cookie.split("; ").find(c => c.startsWith("auth_token="))?.split("=")[1] || null;
    const token = cookieToken || localStorage.getItem("token");

    if (token) {
      // User is authenticated, show authenticated content
      this.showAuthenticatedContent();
    } else {
      // User is not authenticated, show public content
      this.showPublicContent();
    }
  }

  private showAuthenticatedContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = `
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Welcome Back!</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">You're successfully logged in. What would you like to do today?</p>
      </div>
      
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <!-- Chat Card -->
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-4 text-center">Real-time Chat</h3>
            <p class="text-gray-600 mb-6">Connect with friends through instant messaging</p>
            <a href="/chat" class="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-center font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg">
              Start Chatting
            </a>
          </div>
        </div>

        <!-- Account Card -->
        <div class="bg-white rounded-2xl shadow-lg hover:shadow-xl p-8 border border-gray-100 transition-all duration-300 transform hover:-translate-y-2">
          <div class="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-4 text-center">Account Settings</h3>
          <p class="text-gray-600 mb-6 text-center">Manage your profile and account preferences.</p>
          <div class="space-y-3">
            <button 
              id="logoutBtn" 
              class="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Sign Out
            </button>
            <a href="/about" class="block w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl text-center font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg">
              About chat-py
            </a>
          </div>
        </div>
      </div>
    `;

    // Add logout event listener
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", this.handleLogout.bind(this));
    }
  }

  private showPublicContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = `
      <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Features Card -->
        <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Features</h3>
          <ul class="space-y-3 text-gray-600">
            <li class="flex items-center">
              <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Real-time messaging
            </li>
            <li class="flex items-center">
              <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              User authentication
            </li>
            <li class="flex items-center">
              <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Modern UI with Tailwind
            </li>
            <li class="flex items-center">
              <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              TypeScript support
            </li>
          </ul>
        </div>

        <!-- Get Started Card -->
        <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Get Started</h3>
          <div class="space-y-3">
            <a href="/login" class="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
              Sign In
            </a>
            <a href="/signup" class="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
              Create Account
            </a>
            <a href="/about" class="block w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
              Learn More
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private handleLogout(): void {
    localStorage.removeItem("token");

    // Dispatch custom event to notify other components
    document.dispatchEvent(new CustomEvent("authStateChanged"));

    // Reload content to show public version
    this.loadContent();
  }
}

// Initialize home page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new HomePageManager();
});

// Export for use in other modules
export { HomePageManager };
