import { test, expect, type Page } from "@playwright/test";

// Real chain: API on :3000, Mailpit on :8026 (docker compose), seeded Super Administrator in E2E_EMAIL / E2E_PASSWORD.
const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:8026";

async function signIn(page: Page, address: string, secret: string) {
  await page.goto("/login");
  await page.getByLabel(/adresse e-mail/i).fill(address);
  await page.getByLabel(/^mot de passe$/i).fill(secret);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function invitationLink(to: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const link = String(message.Text).match(/https?:\/\/\S+\/reset-password\?token=\S+/)?.[0];
      if (link) return new URL(link).pathname + new URL(link).search;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No invitation mail for ${to}`);
}

test("an invited Viewer sets a password from the email and only sees what the role opens", async ({ browser }) => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required");
  const viewerEmail = `viewer.${Date.now()}@example.test`;
  const viewerPassword = "Une-phrase-assez-longue-42";

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, email, password);
  await admin.goto("/users");
  await admin.getByRole("button", { name: /créer un utilisateur/i }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Prénom").fill("Codjo");
  await dialog.getByLabel("Nom", { exact: true }).fill("Lecteur");
  await dialog.getByLabel(/adresse e-mail/i).fill(viewerEmail);
  await dialog.getByLabel("Viewer").check();
  await dialog.getByRole("button", { name: /créer le compte/i }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Codjo Lecteur" })).toBeVisible();
  await admin.context().close();

  const viewer = await (await browser.newContext()).newPage();
  await viewer.goto(await invitationLink(viewerEmail));
  await viewer.getByLabel("Nouveau mot de passe").fill(viewerPassword);
  await viewer.getByLabel("Confirmez le mot de passe").fill(viewerPassword);
  await viewer.getByRole("button", { name: /enregistrer le mot de passe/i }).click();
  await expect(viewer).toHaveURL(/\/login$/);

  await signIn(viewer, viewerEmail, viewerPassword);
  await expect(viewer.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();

  const nav = viewer.locator("[data-sidebar='content']");
  for (const allowed of ["Tableau de bord", "Utilisateurs", "Départements", "Rôles", "Permissions"]) {
    await expect(nav.getByRole("link", { name: allowed })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Journal d'activité" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Historique des connexions" })).toHaveCount(0);

  await viewer.goto("/users");
  await expect(viewer.getByRole("heading", { level: 1, name: "Utilisateurs" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: /créer un utilisateur/i })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: /^actions pour/i })).toHaveCount(0);

  await viewer.goto("/activity-logs");
  await expect(viewer.getByText("Accès refusé")).toBeVisible();
  await viewer.context().close();
});
