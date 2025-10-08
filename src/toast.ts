/**
 * Toast/Snackbar notification utility
 * Reusable across the entire application
 */

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  duration?: number; // milliseconds, default 4000
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

class Toast {
  private static readonly DEFAULT_DURATION = 4000;
  private static readonly ANIMATION_DURATION = 300;

  /**
   * Show a toast notification
   * @param message - The message to display
   * @param type - The type of toast (success, error, info, warning)
   * @param options - Optional configuration
   */
  public static show(
    message: string,
    type: ToastType = "info",
    options: ToastOptions = {}
  ): void {
    const { duration = this.DEFAULT_DURATION, position = "top-right" } =
      options;

    const toast = document.createElement("div");
    const bgColor = this.getBackgroundColor(type);
    const positionClasses = this.getPositionClasses(position);

    toast.className = `fixed ${positionClasses} ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${this.getInitialTransform(
      position
    )}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove(this.getInitialTransform(position).split(" ")[0]);
    }, 100);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.add(this.getInitialTransform(position).split(" ")[0]);
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, this.ANIMATION_DURATION);
    }, duration);
  }

  /**
   * Convenience methods for different toast types
   */
  public static success(message: string, options?: ToastOptions): void {
    this.show(message, "success", options);
  }

  public static error(message: string, options?: ToastOptions): void {
    this.show(message, "error", options);
  }

  public static info(message: string, options?: ToastOptions): void {
    this.show(message, "info", options);
  }

  public static warning(message: string, options?: ToastOptions): void {
    this.show(message, "warning", options);
  }

  private static getBackgroundColor(type: ToastType): string {
    switch (type) {
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      case "info":
      default:
        return "bg-blue-500";
    }
  }

  private static getPositionClasses(
    position: ToastOptions["position"]
  ): string {
    switch (position) {
      case "top-left":
        return "top-4 left-4";
      case "bottom-right":
        return "bottom-4 right-4";
      case "bottom-left":
        return "bottom-4 left-4";
      case "top-right":
      default:
        return "top-4 right-4";
    }
  }

  private static getInitialTransform(
    position: ToastOptions["position"]
  ): string {
    if (position?.includes("left")) {
      return "-translate-x-full";
    }
    return "translate-x-full";
  }
}

// Export for use in other modules
export default Toast;
