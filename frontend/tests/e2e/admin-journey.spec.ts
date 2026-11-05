import { test, expect } from "@playwright/test";

// End-to-end journey against the real API (:3000) with the seeded Super Administrator (E2E_EMAIL / E2E_PASSWORD).
const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";

test("an administrator creates an account, grants a role, and the change is traced", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required");
  const newEmail = `e2e.${Date.now()}@example.test`;

  await page.goto("/users");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fusers/);
  await page.getByLabel(/adresse e-mail/i).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Utilisateurs" })).toBeVisible();

  await page.getByRole("button", { name: /créer un utilisateur/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Prénom").fill("Awa");
  await dialog.getByLabel("Nom", { exact: true }).fill("Test");
  await dialog.getByLabel(/adresse e-mail/i).fill(newEmail);
  await dialog.getByLabel("Viewer").check();
  await dialog.getByRole("button", { name: /créer le compte/i }).click();

  await expect(page.getByText(`Compte créé, invitation envoyée à ${newEmail}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Awa Test" })).toBeVisible();

  await page.getByRole("tab", { name: "Rôles" }).click();
  await page.getByLabel("Editor").check();
  await page.getByRole("button", { name: /enregistrer les rôles/i }).click();
  await expect(page.getByText("Rôles enregistrés")).toBeVisible();

  await page.getByRole("tab", { name: "Activité" }).click();
  await expect(page.getByText(/a modifié les rôles d'un compte/)).toBeVisible();
  await expect(page.getByText(/a créé un compte/)).toBeVisible();

  // Reload: the session survives through the refresh cookie, the token never touched storage.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Awa Test" })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toMatch(/eyJ/);

  await page.getByRole("button", { name: /menu du compte/i }).click();
  await page.getByRole("menuitem", { name: /se déconnecter/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login/);
});
