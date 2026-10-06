import assert from "node:assert/strict";

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
  console.log("Smoke tests passed: frontend, JavaScript bundle, deep links and database-backed API.");
} catch (error) {
  console.error("Smoke tests failed:", error.message);
  process.exitCode = 1;
}
