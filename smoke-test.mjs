import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8080";

async function get(path, contentType) {
  const response = await fetch(new URL(path, baseUrl), {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  assert.equal(response.status, 200, `${path} must return HTTP 200`);
  assert.ok(
    response.headers.get("content-type")?.includes(contentType),
    `${path} must return ${contentType}`,
  );
  return response;
}

async function api(path, { method = "GET", body, token, status = 200 } = {}) {
  const response = await fetch(new URL(`/api${path}`, baseUrl), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Token ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  assert.equal(response.status, status, `${method} ${path} must return HTTP ${status}`);
  assert.ok(response.headers.get("content-type")?.includes("application/json"));
  return response.json();
}

async function checkUserJourney() {
  const username = `smoke-${randomUUID()}`;
  const credentials = {
    username,
    email: `${username}@example.test`,
    password: randomBytes(24).toString("hex"),
  };
  const registration = await api("/users", {
    method: "POST", body: { user: credentials }, status: 201,
  });
  assert.equal(registration.user.username, username);
  assert.ok(registration.user.token, "Registration must issue a token");
  assert.ok(!("password" in registration.user), "Registration must not expose the password");

  const { user } = await api("/users/login", {
    method: "POST", body: { user: { email: credentials.email, password: credentials.password } },
  });
  assert.ok(user.token, "Login must issue a token");
  const current = await api("/user", { token: user.token });
  assert.equal(current.user.email, credentials.email);

  const articleInput = {
    title: `Smoke article ${randomUUID()}`,
    description: "Checking a deployed image",
    body: "Created and retrieved through the deployed API.",
    tagList: ["smoke-testing"],
  };
  const { article } = await api("/articles", {
    method: "POST", token: user.token, body: { article: articleInput }, status: 201,
  });
  assert.ok(article.slug, "Article creation must return a slug");
  const path = `/articles/${encodeURIComponent(article.slug)}`;
  try {
    const retrieved = await api(path);
    assert.equal(retrieved.article.title, articleInput.title);
    assert.equal(retrieved.article.body, articleInput.body);
    assert.deepEqual(retrieved.article.tagList, articleInput.tagList);
    assert.equal(retrieved.article.author.username, username);
  } finally {
    await api(path, { method: "DELETE", token: user.token });
  }
  console.log("Write smoke tests passed: registration, login, article creation and retrieval.");
}

try {
  const html = await (await get("/", "text/html")).text();
  assert.match(html, /id=["']root["']/, "Frontend must contain the React root");
  const script = html.match(/src=["'](\/assets\/[^"']+\.js)["']/)?.[1];
  assert.ok(script, "Frontend must reference its built JavaScript bundle");
  await get(script, "javascript");
  const login = await (await get("/login", "text/html")).text();
  assert.equal(login, html, "Frontend deep links must serve the application");

  const { tags } = await (await get("/api/tags", "application/json")).json();
  assert.ok(Array.isArray(tags), "Tags API must return an array from the database");
  const articles = await (await get("/api/articles", "application/json")).json();
  assert.ok(Array.isArray(articles.articles), "Articles API must return an array");
  assert.equal(typeof articles.articlesCount, "number");
  if (process.env.SMOKE_WRITE_TESTS === "1") await checkUserJourney();
  console.log("Smoke tests passed: frontend, JavaScript bundle, deep links and database-backed API.");
} catch (error) {
  console.error("Smoke tests failed:", error.message);
  process.exitCode = 1;
}
