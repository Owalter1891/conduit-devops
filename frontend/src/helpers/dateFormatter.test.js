import dateFormatter from "./dateFormatter";

describe("Article date formatting", () => {
  // The test environment uses UTC so these results are independent of the host timezone.
  it.each([
    ["2020-01-01T12:11:08.212Z", "January 1, 2020"],
    ["2024-02-29T12:00:00Z", "February 29, 2024"],
    ["2026-12-31T23:30:00-02:00", "January 1, 2027"],
  ])("formats %s as %s", (input, expected) => {
    expect(dateFormatter(input)).toBe(expected);
  });
});
