import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const route of ["/dashboard", "/design-system"]) {
  test(`app shell ${route} has no serious accessibility violation`, async ({ page }) => {
    await page.goto(route);
    await page.locator("main").waitFor();
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
