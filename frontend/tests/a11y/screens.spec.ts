import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Requires the API on :3000 and a Super Administrator in E2E_EMAIL / E2E_PASSWORD (backend/.env seed values).
const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoSeriousViolation(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe("public screens", () => {
  for (const route of ["/login", "/forgot-password", "/reset-password?token=sample"]) {
    test(`${route} has no serious accessibility violation`, async ({ page }) => {
      await page.goto(route);
      await page.locator("h1").waitFor();
      await expectNoSeriousViolation(page);
    });
  }
});

// One page for every signed-in check: the refresh cookie rotates on each load, so a second context would replay it.
test.describe.serial("signed-in screens", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required");
    page = await (await browser.newContext()).newPage();
    await page.goto("/login");
    await page.getByLabel(/adresse e-mail/i).fill(email);
    await page.getByLabel(/^mot de passe$/i).fill(password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  const screens: [string, RegExp][] = [
    ["/dashboard", /tableau de bord/i],
    ["/users", /utilisateurs/i],
    ["/users?search=zzz-no-match", /utilisateurs/i],
    ["/departments", /départements/i],
    ["/roles", /rôles/i],
    ["/permissions", /permissions/i],
    ["/activity-logs", /journal d'activité/i],
    ["/login-history", /historique des connexions/i],
  ];

  for (const [route, heading] of screens) {
    test(`${route} has no serious accessibility violation`, async () => {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoSeriousViolation(page);
    });
  }

  test("user detail and role matrix have no serious accessibility violation", async () => {
    await page.goto("/users");
    await page.locator("table a[href^='/users/']").first().click();
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolation(page);

    await page.goto("/roles");
    await page.getByRole("link", { name: "Viewer" }).first().click();
    await expect(page.getByText(/matrice des permissions/i)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolation(page);
  });
});
