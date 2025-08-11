import { ParticleBackground } from "./particles.js";

class AboutPageManager {
  private particleBackground: ParticleBackground | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
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
}

// Initialize about page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AboutPageManager();
});

// Export for use in other modules
export { AboutPageManager };
