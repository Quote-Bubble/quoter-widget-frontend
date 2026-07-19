/**
 * Manual-outline drive: semi-detached / terraced / flat full replacements
 * still need a hand-drawn roof outline (their roof structure can be shared
 * with a neighbour, so the satellite scan alone can't tell whose portion is
 * whose). Draws a rectangle face, marks a gutter edge, marks a chimney.
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
  await page.waitForTimeout(500);

  await page.locator("#quote-address input, input").first().fill("10 Downing Street");
  await page.locator("#quote-postcode").fill("SW1A 2AA");
  // force: the autocomplete suggestions dropdown can still be settling from
  // the debounced lookup and visually overlaps the button below it.
  await page.getByRole("button", { name: "Continue" }).click({ force: true });
  await page.waitForTimeout(500);

  await clickOption(page, "Full roof replacement");
  await clickOption(page, "Semi-detached");
  await clickOption(page, "Two");

  await page.getByRole("heading", { name: /Is this your house/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Yes, measure this roof/i }).click();

  await page.getByRole("heading", { name: /Outline your roof faces/i }).waitFor({ timeout: 45000 });
  await page.waitForTimeout(1500);

  const map = page.locator(".gm-style").first();
  await map.waitFor({ timeout: 20000 });
  const box = await map.boundingBox();
  if (!box) throw new Error("Map has no bounding box");

  const pts = [
    [box.x + box.width * 0.38, box.y + box.height * 0.38],
    [box.x + box.width * 0.62, box.y + box.height * 0.38],
    [box.x + box.width * 0.62, box.y + box.height * 0.62],
    [box.x + box.width * 0.38, box.y + box.height * 0.62],
  ];
  for (const [x, y] of pts) {
    await page.mouse.click(x, y, { delay: 40 });
    await page.waitForTimeout(350);
  }
  await page.mouse.click(pts[0][0], pts[0][1], { delay: 40 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "outline-after-close.png") });

  await page.getByRole("button", { name: /^Done$/i }).click();
  await page.waitForTimeout(400);

  const midBottomX = (pts[2][0] + pts[3][0]) / 2;
  const midBottomY = (pts[2][1] + pts[3][1]) / 2;
  await page.mouse.click(midBottomX, midBottomY, { delay: 40 });
  await page.waitForTimeout(500);

  const doneGutters = page.getByRole("button", { name: /Done marking gutters/i });
  if (await doneGutters.count()) {
    await doneGutters.click();
  } else {
    await page.screenshot({ path: path.join(OUT, "outline-stuck.png") });
    throw new Error("Did not reach gutter-marking mode");
  }
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);

  await page.getByText(/What's on the roof/i).waitFor();
  await page.getByRole("button", { name: /Concrete/i }).first().click();
  await page.waitForTimeout(500);

  await page.locator("#contact-name").fill("Sam Semi");
  await page.locator("#contact-phone").fill("07700900321");
  await page.getByRole("button", { name: /Show my estimate/i }).click();

  await page.getByRole("heading", { name: /your estimate/i }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: path.join(OUT, "outline-estimate.png") });

  if (leadStatus !== 202) throw new Error(`Expected lead 202, got ${leadStatus}`);
  console.log("drive-outline OK", { leadStatus });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
