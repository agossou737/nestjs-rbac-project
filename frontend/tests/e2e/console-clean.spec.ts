import { test, expect } from "@playwright/test";

// Against the nginx build (PLAYWRIGHT_BASE_URL) this also proves the Content-Security-Policy blocks nothing the app needs:
// a refused script, style or font shows up as a console error.
const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";

test("the signed-in screens run without any console error or CSP violation", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required");
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/login");
  await page.getByLabel(/adresse e-mail/i).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/dashboard");
  await page.waitForLoadState("networkidle");

  for (const path of ["/users", "/roles", "/permissions", "/activity-logs", "/login-history"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/roles");
  await page.getByRole("link", { name: "Viewer" }).first().click();
  await expect(page.getByText(/matrice des permissions/i)).toBeVisible();
  await page.getByRole("button", { name: /menu du compte/i }).click();
  await page.keyboard.press("Escape");

  // The anonymous /login page probes /auth/refresh to restore a session (the HttpOnly cookie is invisible to scripts):
  // its 401 is the expected answer, and the browser always logs a failed network status.
  const unexpected = errors.filter((text) => !/status of 401 \(Unauthorized\)/.test(text));
  expect(unexpected).toEqual([]);
  expect(errors.length).toBeLessThanOrEqual(1);
});
