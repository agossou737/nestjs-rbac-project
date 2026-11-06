import { test, expect } from "@playwright/test";

// API on :3000 (or the docker stack via PLAYWRIGHT_BASE_URL), seeded Super Administrator in E2E_EMAIL / E2E_PASSWORD.
const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";

test("an administrator creates a department with a manager, attaches an account and cannot delete it while it has members", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required");
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const code = `QA${suffix}`;
  const memberEmail = `member.${suffix.toLowerCase()}@example.test`;

  await page.goto("/login");
  await page.getByLabel(/adresse e-mail/i).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.getByRole("link", { name: "Départements" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Départements" })).toBeVisible();

  await page.getByRole("button", { name: /créer un département/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Code").fill(code.toLowerCase());
  await expect(dialog.getByLabel("Code")).toHaveValue(code);
  await dialog.getByLabel("Nom", { exact: true }).fill(`Qualité ${suffix}`);
  await dialog.getByRole("combobox", { name: /responsable/i }).click();
  await page.getByPlaceholder("Nom ou e-mail").fill("Super");
  await page.getByRole("option", { name: /super/i }).first().click();
  await dialog.getByRole("button", { name: /créer le département/i }).click();
  await expect(page.getByText(`Département ${code} créé`)).toBeVisible();

  await page.goto("/users");
  await page.getByRole("button", { name: /créer un utilisateur/i }).click();
  const userDialog = page.getByRole("dialog");
  await userDialog.getByLabel("Prénom").fill("Membre");
  await userDialog.getByLabel("Nom", { exact: true }).fill("Qualité");
  await userDialog.getByLabel(/adresse e-mail/i).fill(memberEmail);
  await userDialog.getByRole("combobox", { name: /département/i }).click();
  await page.getByRole("option", { name: new RegExp(code) }).click();
  await userDialog.getByRole("button", { name: /créer le compte/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Membre Qualité" })).toBeVisible();

  await page.goto(`/departments?search=${code}`);
  const row = page.getByRole("row", { name: new RegExp(code) });
  await expect(row.getByRole("link", { name: "1 membre" })).toBeVisible();
  await row.getByRole("button", { name: `Autres actions pour ${code}` }).click();
  await expect(page.getByRole("menuitem", { name: /supprimer/i })).toBeDisabled();
  await page.keyboard.press("Escape");

  await row.getByRole("link", { name: "1 membre" }).click();
  await expect(page).toHaveURL(/\/users\?department_id=/);
  await expect(page.getByRole("link", { name: /membre qualité/i }).first()).toBeVisible();
});
