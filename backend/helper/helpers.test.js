const { slugify, appendTagList, appendFavorites, appendFollowers } = require("./helpers");

describe("Slugify", () => {
  const stringsArray = [
    "  Hello World  ",
    "  Hello WORLD  ",
    " HELLO WORLD",
    "Hello World",
    "Hello_world ",
    "Hello-world",
  ];

  test.each(stringsArray)("%p", (string) => {
    expect(slugify(string)).toBe("hello-world");
  });
});

describe("Article tags", () => {
  it("returns tag names without exposing database metadata", () => {
    expect(appendTagList([{ name: "react", id: 1 }, { name: "devops", id: 2 }]))
      .toEqual(["react", "devops"]);
  });

  it("returns an empty list for an untagged article", () => {
    expect(appendTagList([])).toEqual([]);
  });

  it("adds tags without replacing other article fields", () => {
    const article = { dataValues: { title: "First article" } };
    appendTagList([{ name: "react" }], article);
    expect(article.dataValues).toEqual({ title: "First article", tagList: ["react"] });
  });
});

describe("Article favorites", () => {
  const user = { id: 7 };

  it.each([
    ["a reader who favorited the article", user, true, 3, true],
    ["a reader who has not favorited it", user, false, 0, false],
    ["an anonymous reader", null, true, 3, false],
  ])("reports favorites for %s", async (_label, reader, storedFavorite, count, expected) => {
    const article = {
      dataValues: { title: "First article" },
      hasUser: vi.fn().mockResolvedValue(storedFavorite),
      countUsers: vi.fn().mockResolvedValue(count),
    };

    await appendFavorites(reader, article);

    expect(article.dataValues).toEqual({
      title: "First article", favorited: expected, favoritesCount: count,
    });
    expect(article.hasUser).toHaveBeenCalledWith(reader);
  });

  it("propagates a database failure instead of reporting a false count", async () => {
    const failure = new Error("Database unavailable");
    const article = {
      dataValues: {},
      hasUser: vi.fn().mockResolvedValue(false),
      countUsers: vi.fn().mockRejectedValue(failure),
    };
    await expect(appendFavorites(user, article)).rejects.toThrow("Database unavailable");
  });
});

describe.each(["profile", "article author"])("Following status on a %s", (target) => {
  const user = { id: 7 };

  it.each([
    ["a follower", user, true, 2, true],
    ["a non-follower", user, false, 0, false],
    ["an anonymous reader", null, true, 2, false],
  ])("reports the relationship for %s", async (_label, reader, storedFollowing, count, expected) => {
    const profile = {
      dataValues: { username: "author" },
      hasFollower: vi.fn().mockResolvedValue(storedFollowing),
      countFollowers: vi.fn().mockResolvedValue(count),
    };
    const result = target === "profile"
      ? profile
      : { author: profile, getAuthor: vi.fn().mockResolvedValue(profile) };

    await appendFollowers(reader, result);

    expect(profile.dataValues).toEqual({
      username: "author", following: expected, followersCount: count,
    });
    expect(profile.hasFollower).toHaveBeenCalledWith(reader);
  });
});
