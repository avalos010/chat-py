import { ParticleBackground } from "./particles";

// Initialize particle background when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing particle background...");

  // Check if we're on a page that should have particles
  const currentPath = window.location.pathname;

  if (currentPath === "/" || currentPath === "/about") {
    console.log(`Setting up particles for ${currentPath}`);

    // Initialize particle background
    try {
      new ParticleBackground("particle-background");
      console.log("Particle background initialized successfully");
    } catch (error) {
      console.error("Failed to initialize particle background:", error);
    }
  } else {
    console.log("Not on home or about page, skipping particle background");
  }
});
