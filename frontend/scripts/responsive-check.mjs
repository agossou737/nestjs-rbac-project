#!/usr/bin/env node
/**
 * responsive-check.mjs, Automated responsive verification (tailwind-v4-responsive skill).
 *
 * Usage:
 *   node responsive-check.mjs <baseUrl> [route ...]
 *   node responsive-check.mjs http://localhost:5173 / /dashboard /settings
 *
 * For each route × width: fails on horizontal overflow or oversized images,
 * warns on small touch targets at mobile widths, saves screenshots to responsive-report/.
 * Exit code 0 = pass, 1 = failures (CI-ready).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WIDTHS = [320, 375, 414, 640, 768, 1024, 1280, 1536, 1920];
const MOBILE_MAX = 414;
const OUT = "responsive-report";

const [baseUrl, ...routesArg] = process.argv.slice(2);
if (!baseUrl) {
  console.error("Usage: node responsive-check.mjs <baseUrl> [route ...]");
  process.exit(2);
}
const routes = routesArg.length ? routesArg : ["/"];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
// Project addition: one shared context, signed in once when LOGIN_EMAIL and LOGIN_PASSWORD are set. The refresh
// cookie rotates on every load, so every page must reuse the same cookie jar.
const context = await browser.newContext();
if (process.env.LOGIN_EMAIL && process.env.LOGIN_PASSWORD) {
  const login = await context.newPage();
  await login.goto(new URL("/login", baseUrl).href);
  await login.getByLabel(/adresse e-mail/i).fill(process.env.LOGIN_EMAIL);
  await login.getByLabel(/^mot de passe$/i).fill(process.env.LOGIN_PASSWORD);
  await login.getByRole("button", { name: /se connecter/i }).click();
  await login.waitForURL((url) => !url.pathname.startsWith("/login"));
  await login.close();
}
let failures = 0, warnings = 0;

for (const route of routes) {
  const url = new URL(route, baseUrl).href;
  for (const width of WIDTHS) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

      const report = await page.evaluate((mobileMax) => {
        const vw = document.documentElement.clientWidth;
        const overflowing = [];
        const sel = (el) => {
          let s = el.tagName.toLowerCase();
          if (el.id) s += `#${el.id}`;
          else if (el.classList.length) s += "." + [...el.classList].slice(0, 3).join(".");
          return s;
        };
        // An element that only overflows inside a horizontal scroller (chips row, wide table in an
        // overflow-x:auto box) is intended: the scroller itself stays within the viewport.
        const clippedByScroller = (el) => {
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            // Project fix: an <svg> clips its own shapes by default; that is not a page scroller.
            if (a instanceof SVGElement) continue;
            const ox = getComputedStyle(a).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
              const ar = a.getBoundingClientRect();
              return ar.right <= vw + 1 && ar.left >= -1;
            }
          }
          return false;
        };
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !clippedByScroller(el))
            overflowing.push({ sel: sel(el), w: Math.round(r.width), right: Math.round(r.right) });
        }
        const hOverflow = document.documentElement.scrollWidth > vw + 1;

        const bigImages = [...document.images]
          .filter((img) => img.getBoundingClientRect().width > vw + 1)
          .map((img) => img.src.slice(0, 80));

        const smallTargets = [];
        if (window.innerWidth <= mobileMax) {
          for (const el of document.querySelectorAll("a,button,[role=button],input,select")) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
              smallTargets.push({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
        return { hOverflow, scrollWidth: document.documentElement.scrollWidth, vw,
                 overflowing: overflowing.slice(0, 10), bigImages, smallTargets: smallTargets.slice(0, 10) };
      }, MOBILE_MAX);

      const tag = `${route.replace(/\//g, "_") || "_"}-${width}`;
      await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
      // Viewport-height slices of tall pages, so a reviewer can read the text that a downscaled
      // full-page capture of a phone screen makes illegible.
      const VIEWPORT_H = 900;
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      if (total > VIEWPORT_H * 1.5) {
        for (let n = 0, y = 0; y < total; n++, y += VIEWPORT_H) {
          await page.screenshot({ path: `${OUT}/${tag}-s${n}.png`, fullPage: true,
            clip: { x: 0, y, width, height: Math.min(VIEWPORT_H, total - y) } });
        }
      }

      if (report.hOverflow || report.overflowing.length) {
        failures++;
        console.log(`FAIL ${url} @ ${width}px, horizontal overflow (scrollWidth ${report.scrollWidth} > ${report.vw})`);
        for (const o of report.overflowing) console.log(`    ↳ ${o.sel} (width ${o.w}px, right edge ${o.right}px)`);
      } else {
        console.log(`ok   ${url} @ ${width}px`);
      }
      if (report.bigImages.length) {
        failures++;
        console.log(`FAIL ${url} @ ${width}px, image(s) wider than viewport:`);
        for (const s of report.bigImages) console.log(`    ↳ ${s}`);
      }
      if (report.smallTargets.length) {
        warnings++;
        console.log(`warn ${url} @ ${width}px, touch targets < 44px:`);
        for (const t of report.smallTargets) console.log(`    ↳ ${t.sel} (${t.w}×${t.h})`);
      }
    } catch (err) {
      failures++;
      console.log(`FAIL ${url} @ ${width}px, ${err.message}`);
    } finally {
      await page.close();
    }
  }
}

await browser.close();
console.log(`\nDone. ${failures} failure(s), ${warnings} warning(s). Screenshots in ${OUT}/`);
process.exit(failures ? 1 : 0);
