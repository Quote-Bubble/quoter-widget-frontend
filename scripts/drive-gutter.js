/**
 * Roofline (gutters / fascias) branch drive — gutter lines are drawn
 * directly for every property type now, since a footprint trace was never
 * needed for this job's pricing (gutter length only). No chimney/rooflight
 * counters either, since calculateRooflineEstimate never priced them.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.QUOTE_BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "tmp", "playwright");

async function clickOption(page, label) {
  await page.getByRole("button", { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first().click();
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
  await page.locator("#quote-address input, input").first().fill("10 Downing Street");
  await page.locator("#quote-postcode").fill("SW1A 2AA");
  // force: the autocomplete suggestions dropdown can still be settling from
  // the debounced lookup and visually overlaps the button below it.
  await page.getByRole("button", { name: "Continue" }).click({ force: true });
  await page.waitForTimeout(400);

  await clickOption(page, "Gutters, fascias & soffits");
  await clickOption(page, "Semi-detached");
  await clickOption(page, "Two");

  await page.getByRole("heading", { name: /Is this your house/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Yes, measure this roof/i }).click();

  await page.getByRole("heading", { name: /Mark the gutters/i }).waitFor({ timeout: 45000 });
  await page.waitForTimeout(1500);

  const chimneyCounters = await page.getByRole("button", { name: /More chimneys/i }).count();
  if (chimneyCounters > 0) {
    throw new Error("Roofline job type should not show chimney/rooflight counters");
  }

  const map = page.locator(".gm-style").first();
  await map.waitFor({ timeout: 20000 });
  const box = await map.boundingBox();
  if (!box) throw new Error("Map has no bounding box");

  const pts = [
    [box.x + box.width * 0.4, box.y + box.height * 0.6],
    [box.x + box.width * 0.6, box.y + box.height * 0.6],
  ];
  for (const [x, y] of pts) {
    await page.mouse.click(x, y, { delay: 40 });
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: /Finish this line/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "draw-gutter.png") });

  // Continue must be disabled until at least one gutter line exists — draw
  // an extra confirmation that the button is enabled now.
  const continueBtn = page.getByRole("button", { name: "Continue" });
  const disabled = await continueBtn.isDisabled();
  if (disabled) throw new Error("Continue should be enabled after drawing a gutter run");
  await continueBtn.click();
  await page.waitForTimeout(400);

  await clickOption(page, "Gutters + fascias");

  await page.locator("#contact-name").fill("Gutter Guy");
  await page.locator("#contact-phone").fill("07700900999");
  await page.getByRole("button", { name: /Show my estimate/i }).click();
  await page.getByRole("heading", { name: /your estimate/i }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: path.join(OUT, "gutter-estimate.png") });

  if (leadStatus !== 202) throw new Error(`Expected lead 202, got ${leadStatus}`);
  console.log("drive-gutter OK", { leadStatus });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
