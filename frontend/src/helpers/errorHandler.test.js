import errorHandler from "./errorHandler";

describe("API error messages", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "dir").mockImplementation(() => {});
  });

  it.each([401, 403, 404, 422, 500])("preserves the server message for HTTP %i", (status) => {
    // Axios exposes the parsed response body through response.data.
    const error = {
      response: { status, data: { errors: { body: ["Article title is required"] } } },
    };
    expect(() => errorHandler(error)).toThrow("Article title is required");
  });

  it("uses the first validation message when the API returns several", () => {
    const error = {
      response: { status: 422, data: { errors: { body: ["Title is required", "Body is required"] } } },
    };
    expect(() => errorHandler(error)).toThrow("Title is required");
  });

  it("handles a network failure without trying to read a missing response", () => {
    expect(() => errorHandler(new Error("Network unavailable"))).not.toThrow();
  });
});
