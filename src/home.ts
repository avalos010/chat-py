class HomePageManager {
  private contentContainer: HTMLElement | null;

  constructor() {
    this.contentContainer = document.getElementById("home-content");
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.contentContainer) {
      await this.loadContent();
    }
  }

  private async loadContent(): Promise<void> {
    const token = localStorage.getItem("token");

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
      <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Welcome Card -->
        <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div class="flex items-center mb-4">
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-semibold text-gray-900">Welcome back!</h3>
              <p class="text-gray-600">You're successfully logged in</p>
            </div>
          </div>
                      <div class="space-y-3">
              <a href="/dashboard" class="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
                Go to Dashboard
              </a>
              <a href="/chat" class="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
                Join Chat Room
              </a>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="space-y-3">
            <button 
              id="logoutBtn" 
              class="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Sign Out
            </button>
            <a href="/about" class="block w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
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
