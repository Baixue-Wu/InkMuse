#!/usr/bin/env node
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: node scripts/preview.cjs --url URL --out DIRECTORY [--design smoke-result.json | --workspace workspace.json] [--live]\nCapture previews and an exported ZIP. --design replays a captured response; --workspace restores a saved workspace; --live clicks Generate using the configured model and search service.",
    );
    return;
  }
  const value = (flag, fallback) =>
    args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  const url = value("--url");
  const out = value("--out");
  if (!url || !out)
    throw new Error("Pass --url and --out. Run with --help for usage.");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1120 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    if (args.includes("--workspace")) {
      const workspace = fs.readFileSync(value("--workspace"), "utf8");
      await page.evaluate(
        (value) => localStorage.setItem("inkmuse.workspace.v1", value),
        workspace,
      );
      await page.reload();
    }
    if (args.includes("--design")) {
      const response = JSON.parse(fs.readFileSync(value("--design"), "utf8"));
      await page.evaluate((result) => {
        const doc = InkMuse.normalize(result.plan, result.source, {
          origin: "ai",
          mode: "polish",
        });
        localStorage.setItem(
          "inkmuse.workspace.v1",
          JSON.stringify({
            doc,
            selected: 0,
            source: result.source,
            mood: "auto",
          }),
        );
      }, response);
      await page.reload();
    }
    if (args.includes("--live")) {
      await page.locator("#generate").click();
      await page.waitForFunction(
        () => !document.querySelector("#generate").disabled,
        null,
        { timeout: 210000 },
      );
      const status = await page.locator("#status").textContent();
      console.log(status);
      if ((await page.locator("#origin-badge").textContent()) !== "我的作品")
        throw new Error("Live design did not complete.");
    }
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(out, "desktop.png"),
      fullPage: true,
    });
    await page
      .locator("#main-canvas")
      .screenshot({ path: path.join(out, "cover.png") });
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export").click();
    const exported = await downloadPromise;
    await exported.saveAs(path.join(out, "InkMuse.zip"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(out, "mobile.png"),
      fullPage: true,
    });
    const state = await page.evaluate(() =>
      localStorage.getItem("inkmuse.workspace.v1"),
    );
    fs.writeFileSync(path.join(out, "workspace.json"), state);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Captured ${out}.`);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
