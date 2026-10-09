import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { test, expect } from "@playwright/test";

async function register(page) {
  const username = `user-${randomUUID()}`;
  const email = `${username}@example.test`;
  const password = "playwright-test-password";

  await page.goto("/#/register");
  await page.getByPlaceholder("Your Name").fill(username);
  await page.getByPlaceholder("Email", { exact: true }).fill(email);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("link", { name: "New Article" })).toBeVisible();
  return { username, email, password };
}

async function logOut(page, username) {
  await page.getByRole("navigation").getByText(username, { exact: true }).click();
  await page.getByRole("link", { name: /Logout$/ }).click();
  await expect(page.getByRole("link", { name: "New Article" })).toHaveCount(0);
}

async function logIn(page, { email, password }) {
  await page.getByRole("link", { name: /Login$/ }).click();
  await page.getByPlaceholder("Email", { exact: true }).fill(email);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("link", { name: "New Article" })).toBeVisible();
}

test("register, log out and log back in", async ({ page }) => {
  const user = await register(page);
  await logOut(page, user.username);
  await logIn(page, user);
  await expect(page.getByText(user.username, { exact: true })).toBeVisible();
});

test("publish an article and read it after a page reload", async ({ page }) => {
  await register(page);
  const title = `Playwright article ${randomUUID()}`;
  const body = "This article was written through the browser.";

  await page.getByRole("link", { name: "New Article" }).click();
  await page.getByPlaceholder("Article Title").fill(title);
  await page.getByPlaceholder("What's this article about?").fill("A browser test");
  await page.getByPlaceholder("Write your article (in markdown)").fill(body);
  await page.getByPlaceholder("Enter tags").fill("testing");
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});

async function openSettings(page, username) {
  await page.getByRole("navigation").getByText(username, { exact: true }).click();
  await page.getByRole("link", { name: /Settings$/ }).click();
  await expect(page.getByRole("heading", { name: "Your Settings" })).toBeVisible();
}

async function saveSettings(page) {
  const update = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/user"
  );
  await page.getByRole("button", { name: "Update Settings", exact: true }).click();
  expect((await update).status()).toBe(200);
}

test("update a profile and log back in with the unchanged password", async ({ page }) => {
  const user = await register(page);
  const bio = `Updated bio ${randomUUID()}`;
  await openSettings(page, user.username);
  await expect(page.getByPlaceholder("Password", { exact: true })).toHaveValue("");
  await page.getByPlaceholder("Short bio about you").fill(bio);
  await saveSettings(page);

  await logOut(page, user.username);
  await logIn(page, user);
  await openSettings(page, user.username);
  await expect(page.getByPlaceholder("Short bio about you")).toHaveValue(bio);
});

test("change a password and log back in with the new password", async ({ page }) => {
  const user = await register(page);
  const password = "updated-playwright-password";
  await openSettings(page, user.username);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await saveSettings(page);

  await logOut(page, user.username);
  await logIn(page, { ...user, password });
  await expect(page.getByText(user.username, { exact: true })).toBeVisible();
});
