const { once } = require("node:events");
const { promisify } = require("node:util");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../app");
const { sequelize, User, Article } = require("../models");

let server;
let baseUrl;

// Never reset a database unless every setting matches the disposable test service.
function assertTestDatabase() {
  const { database, username, host, port } = sequelize.config;
  if (
    process.env.NODE_ENV !== "test" ||
    database !== "conduit_test" ||
    username !== "conduit_test" ||
    host !== "127.0.0.1" ||
    Number(port) !== 5433
  ) {
    throw new Error("Refusing to reset a database outside the integration test service");
  }
}

beforeAll(async () => {
  assertTestDatabase();
  await sequelize.authenticate();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(async () => {
  assertTestDatabase();
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  try {
    if (server) await promisify(server.close.bind(server))();
  } finally {
    await sequelize.close();
  }
});

async function request(path, { method = "GET", body, token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Token ${token}` }),
      ...headers,
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

const credentials = {
  username: "author",
  email: "author@example.test",
  password: "integration-password",
};
const articleInput = {
  title: "Integration testing",
  description: "Testing the API with PostgreSQL",
  body: "An article created through the real HTTP API.",
  tagList: ["testing", "devops"],
};

async function register(user = credentials) {
  const response = await request("/users", { method: "POST", body: { user } });
  expect(response.status).toBe(201);
  return response.body.user;
}

async function createArticle(token) {
  const response = await request("/articles", {
    method: "POST", token, body: { article: articleInput },
  });
  expect(response.status).toBe(201);
  return response.body.article;
}

describe("API integration with PostgreSQL", () => {
  it("registers a user, stores a hashed password and authenticates the issued token", async () => {
    const user = await register();
    expect(user).toMatchObject({ username: credentials.username, email: credentials.email });
    expect(user.token).toEqual(expect.any(String));
    expect(user).not.toHaveProperty("password");
    const stored = await User.findOne({ where: { email: credentials.email } });
    expect(stored.password).not.toBe(credentials.password);
    expect(await bcrypt.compare(credentials.password, stored.password)).toBe(true);
    const current = await request("/user", { token: user.token });
    expect(current.status).toBe(200);
    expect(current.body.user.email).toBe(credentials.email);
    expect(current.body.user).not.toHaveProperty("password");
  });

  it("logs in with persisted credentials and returns a usable token", async () => {
    await register();
    const login = await request("/users/login", {
      method: "POST", body: { user: { email: credentials.email, password: credentials.password } },
    });
    expect(login.status).toBe(200);
    expect(login.body.user).not.toHaveProperty("password");
    const current = await request("/user", { token: login.body.user.token });
    expect(current.status).toBe(200);
    expect(current.body.user.username).toBe(credentials.username);
  });

  it("rejects an incorrect password without issuing a token", async () => {
    await register();
    const response = await request("/users/login", {
      method: "POST", body: { user: { ...credentials, password: "wrong-password" } },
    });
    expect(response.status).toBe(422);
    expect(response.body.errors.body).toContain("Wrong email/password combination");
    expect(response.body).not.toHaveProperty("user");
  });

  it("rejects duplicate registration without creating another user", async () => {
    await register();
    const response = await request("/users", { method: "POST", body: { user: credentials } });
    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty("errors.body");
    expect(await User.count()).toBe(1);
  });

  it("requires authentication for the current user and article creation", async () => {
    expect((await request("/user")).status).toBe(401);
    const response = await request("/articles", { method: "POST", body: { article: articleInput } });
    expect(response.status).toBe(401);
    expect(await Article.count()).toBe(0);
  });

  it.each([
    "Token",
    "Token malformed",
    "Token malformed extra",
    "Basic malformed",
  ])("rejects the invalid authorization header %s with HTTP 401", async (authorization) => {
    const response = await request("/user", { headers: { Authorization: authorization } });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ errors: { body: ["You need to login first!"] } });
  });

  it.each([
    ["invalid signature", () => jwt.sign({ email: credentials.email }, "wrong-signing-key")],
    ["expired token", () => jwt.sign({ email: credentials.email }, process.env.JWT_KEY, { expiresIn: -1 })],
    ["inactive token", () => jwt.sign({ email: credentials.email }, process.env.JWT_KEY, { notBefore: "1h" })],
    ["missing email", () => jwt.sign({ username: credentials.username }, process.env.JWT_KEY)],
  ])("rejects a token with %s with HTTP 401", async (_label, createToken) => {
    const response = await request("/user", { token: createToken() });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ errors: { body: ["You need to login first!"] } });
  });

  it("rejects a token for a deleted user without continuing the request", async () => {
    const user = await register();
    await User.destroy({ where: { email: credentials.email } });
    const response = await request("/user", { token: user.token });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ errors: { body: ["You need to login first!"] } });
  });

  it("persists an article, its author and tags for public retrieval", async () => {
    const user = await register();
    const article = await createArticle(user.token);
    const response = await request(`/articles/${article.slug}`);
    expect(response.status).toBe(200);
    expect(response.body.article).toMatchObject({
      ...articleInput,
      tagList: expect.arrayContaining(articleInput.tagList),
      author: { username: credentials.username },
      favorited: false,
      favoritesCount: 0,
    });
    expect(response.body.article.author).not.toHaveProperty("password");
    const stored = await Article.findOne({ where: { slug: article.slug } });
    expect((await stored.getAuthor()).email).toBe(credentials.email);
    expect((await stored.getTagList()).map((tag) => tag.name).sort()).toEqual([...articleInput.tagList].sort());
  });

  it("rejects invalid articles without storing them", async () => {
    const user = await register();
    const response = await request("/articles", {
      method: "POST", token: user.token, body: { article: { ...articleInput, title: "" } },
    });
    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty("errors.body");
    expect(await Article.count()).toBe(0);
  });

  it("prevents another user from changing or deleting an article", async () => {
    const author = await register();
    const article = await createArticle(author.token);
    const other = await register({ ...credentials, username: "reader", email: "reader@example.test" });
    const path = `/articles/${article.slug}`;
    const update = await request(path, {
      method: "PUT", token: other.token, body: { article: { body: "Unwanted edit" } },
    });
    expect(update.status).toBe(403);
    expect((await request(path, { method: "DELETE", token: other.token })).status).toBe(403);
    expect((await request(path)).body.article.body).toBe(articleInput.body);
    expect(await Article.count()).toBe(1);
  });

  it("lets the author update and delete an article", async () => {
    const author = await register();
    const article = await createArticle(author.token);
    const path = `/articles/${article.slug}`;
    const update = await request(path, {
      method: "PUT", token: author.token, body: { article: { body: "Updated content" } },
    });
    expect(update.status).toBe(200);
    expect((await request(path)).body.article.body).toBe("Updated content");
    expect((await request(path, { method: "DELETE", token: author.token })).status).toBe(200);
    expect((await request(path)).status).toBe(404);
    expect(await Article.count()).toBe(0);
  });
});
