import * as THREE from "three";

export class ParticleBackground {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private particles!: THREE.InstancedMesh;
  private particleCount = 150; // Optimized count for good performance
  private animationId: number | null = null;
  private container: HTMLElement;
  private isInitialized = false;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement;
    if (!this.container) {
      console.error(`Container with id '${containerId}' not found`);
      return;
    }

    // Check if Three.js is available
    if (typeof THREE === "undefined") {
      console.error("Three.js not loaded. Particle background disabled.");
      return;
    }

    try {
      this.setupScene();
      this.createParticles();
      this.handleResize();
      this.animate();
      this.isInitialized = true;

      // Handle window resize
      window.addEventListener("resize", () => this.handleResize());
    } catch (error) {
      console.error("Failed to initialize particle background:", error);
      this.showFallback();
    }
  }

  private showFallback(): void {
    // Show a simple CSS-based fallback if Three.js fails
    if (this.container) {
      this.container.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-br from-blue-200/20 to-indigo-200/20"></div>
      `;
    }
  }

  private setupScene(): void {
    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 15;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true, // Transparent background
      antialias: true,
    });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setClearColor(0x000000, 0); // Transparent

    // Add renderer to container
    this.container.appendChild(this.renderer.domElement);

    // Style the canvas
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.zIndex = "0";
    this.renderer.domElement.style.pointerEvents = "none";
  }

  private createParticles(): void {
    // Create geometry for particles (small spheres)
    const geometry = new THREE.SphereGeometry(0.08, 6, 6);

    // Create material with blue/indigo colors
    const material = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, // Blue-600
      transparent: true,
      opacity: 0.4,
      depthWrite: false, // Better performance for transparent objects
    });

    // Create instanced mesh for better performance
    this.particles = new THREE.InstancedMesh(
      geometry,
      material,
      this.particleCount
    );

    // Set initial positions and scales for particles
    for (let i = 0; i < this.particleCount; i++) {
      const matrix = new THREE.Matrix4();

      // Random position in 3D space
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;

      // Random scale for variety
      const scale = Math.random() * 0.5 + 0.5;

      matrix.setPosition(x, y, z);
      matrix.scale(new THREE.Vector3(scale, scale, scale));

      this.particles.setMatrixAt(i, matrix);
    }

    this.scene.add(this.particles);
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Gentle rotation for subtle movement
    if (this.particles) {
      this.particles.rotation.y += 0.001;
      this.particles.rotation.x += 0.0005;

      // Add gentle floating motion
      const time = Date.now() * 0.0005;
      for (let i = 0; i < this.particleCount; i++) {
        const matrix = new THREE.Matrix4();
        this.particles.getMatrixAt(i, matrix);

        const position = new THREE.Vector3();
        matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

        // Add gentle floating motion
        position.y += Math.sin(time + i * 0.1) * 0.001;
        position.x += Math.cos(time + i * 0.1) * 0.001;

        matrix.setPosition(position);
        this.particles.setMatrixAt(i, matrix);
      }

      this.particles.instanceMatrix.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private handleResize(): void {
    if (!this.container || !this.camera || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }

    // Clean up Three.js resources
    if (this.particles) {
      this.particles.geometry.dispose();
      if (Array.isArray(this.particles.material)) {
        this.particles.material.forEach((mat: THREE.Material) => mat.dispose());
      } else {
        this.particles.material.dispose();
      }
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
