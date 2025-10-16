/**
 * @jest-environment jsdom
 */

describe("Frontend Simple Tests", () => {
  test("DOM manipulation works", () => {
    document.body.innerHTML = `
      <div id="test-container">
        <button id="test-button">Click me</button>
        <div id="result"></div>
      </div>
    `;

    const button = document.getElementById("test-button") as HTMLButtonElement;
    const result = document.getElementById("result") as HTMLDivElement;

    expect(button).toBeDefined();
    expect(result).toBeDefined();

    button.click();

    // Test that we can manipulate the DOM
    result.textContent = "Button clicked!";
    expect(result.textContent).toBe("Button clicked!");
  });

  test("Event handling works", () => {
    document.body.innerHTML = `
      <input id="test-input" type="text" />
    `;

    const input = document.getElementById("test-input") as HTMLInputElement;
    let eventFired = false;

    input.addEventListener("input", () => {
      eventFired = true;
    });

    input.value = "test";
    input.dispatchEvent(new Event("input"));

    expect(eventFired).toBe(true);
  });

  test("CSS classes can be added and removed", () => {
    document.body.innerHTML = `
      <div id="test-div"></div>
    `;

    const div = document.getElementById("test-div") as HTMLDivElement;

    div.classList.add("test-class");
    expect(div.classList.contains("test-class")).toBe(true);

    div.classList.remove("test-class");
    expect(div.classList.contains("test-class")).toBe(false);
  });

  test("Async operations work", async () => {
    const mockPromise = Promise.resolve("test result");
    const result = await mockPromise;

    expect(result).toBe("test result");
  });

  test("Fetch mocking works", async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ message: "success" }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const response = await fetch("/test-endpoint");
    const data = await response.json();

    expect(data.message).toBe("success");
    expect(global.fetch).toHaveBeenCalledWith("/test-endpoint");
  });
});
