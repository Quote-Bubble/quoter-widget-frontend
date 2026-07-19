/**
 * Repair path smoke drive — no map / locate / condition.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.QUOTE_BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "tmp", "playwright");

async function clickOption(page, label) {
  await page.getByRole("button", { name: new RegExp(label, "i") }).first().click();
  await page.waitForTimeout(400);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  let leadStatus = null;
  page.on("response", (response) => {
    if (response.url().includes("/api/lead") && response.request().method() === "POST") {
      leadStatus = response.status();
    }
  });

  await page.goto(`${BASE}/quote`);
  await page.locator("#quote-address input, input").first().fill("4 Elm Grove");
  await page.locator("#quote-postcode").fill("BS5 6AB");
  // force: the autocomplete suggestions dropdown can still be settling from
  // the debounced lookup and visually overlaps the button below it.
  await page.getByRole("button", { name: "Continue" }).click({ force: true });
  await page.waitForTimeout(400);

  await clickOption(page, "Tile or slate repair");
  await clickOption(page, "Terraced");
  await clickOption(page, "Two");
  await clickOption(page, "A small patch");
  await page.getByRole("button", { name: /Concrete/i }).first().click();
  await page.waitForTimeout(400);

  await page.locator("#contact-name").fill("Sam Repair");
  await page.locator("#contact-phone").fill("01171112222");
  await page.getByRole("button", { name: /Show my estimate/i }).click();
  await page.getByRole("heading", { name: /your estimate/i }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, "repair-estimate.png") });

  if (leadStatus !== 202) throw new Error(`Expected lead 202, got ${leadStatus}`);
  console.log("drive-repair OK", { leadStatus });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
