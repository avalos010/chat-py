/**
 * Test utilities for frontend testing
 */

export function setupDOM(): void {
  // Setup basic DOM structure for tests
  document.body.innerHTML = `
    <div id="app">
      <nav id="navigation"></nav>
      <main id="main-content"></main>
    </div>
  `;
}

export function createMockElement(
  tag: string,
  className?: string,
  content?: string
): HTMLElement {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (content) {
    element.textContent = content;
  }
  return element;
}

export function createMockEvent(type: string, options: any = {}): Event {
  return new Event(type, options);
}

export function createMockKeyboardEvent(
  type: string,
  key: string
): KeyboardEvent {
  return new KeyboardEvent(type, { key });
}

export function mockFetch(response: any, ok: boolean = true): void {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

export function mockWebSocket(): WebSocket {
  const mockWs = {
    close: jest.fn(),
    send: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: WebSocket.OPEN,
  } as any;

  (global.WebSocket as jest.Mock).mockImplementation(() => mockWs);
  return mockWs;
}

export function waitFor(
  condition: () => boolean,
  timeout: number = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error("Timeout waiting for condition"));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}
