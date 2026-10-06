const errorHandler = require("./errorHandler");
const {
  UnauthorizedError, ForbiddenError, NotFoundError, FieldRequiredError,
  AlreadyTakenError, ValidationError,
} = require("../helper/customErrors");

describe("API error responses", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it.each([
    [new UnauthorizedError(), 401, "You need to login first!"],
    [new ForbiddenError("article"), 403, "You are not the author of this article"],
    [new NotFoundError("Article", "with this slug"), 404, "Article not found with this slug"],
    [new FieldRequiredError("title"), 422, "title is required"],
    [new AlreadyTakenError("Username", "choose another"), 422, "Username already exists.. choose another"],
    [new ValidationError("Invalid email"), 422, "Invalid email"],
  ])("maps %s to HTTP %i with the API error body", (error, status, message) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(error, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ errors: { body: [message] } });
  });

  it("returns HTTP 500 for an unexpected failure", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(new Error("Unexpected failure"), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
