const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const JSZip = require("jszip");

test("the studio edits, reorders, undoes, saves and exports real PNGs", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "好文字，值得被看见。" }),
  ).toBeVisible();
  await expect(page.locator(".thumb")).toHaveCount(3);
  await page.getByRole("button", { name: "编辑这一页" }).click();
  await page.locator("#page-title").fill("属于我的周末");
  await page.getByRole("button", { name: "应用文字修改" }).click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator("#page-title")).toHaveValue("把周末，还给自己");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(page.locator("#page-title")).toHaveValue("属于我的周末");
  await page.getByRole("button", { name: "后移一页" }).click();
  await expect(page.locator("#page-label")).toContainText("第 2 页");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.locator("#draft-count")).toHaveText("1");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  expect(Object.keys(zip.files).filter((x) => x.endsWith(".png"))).toHaveLength(
    3,
  );
  const png = await zip.file("01.png").async("nodebuffer");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1500);
  expect(png.readUInt32BE(20)).toBe(2000);
  expect(await zip.file("图片来源.txt").async("string")).toContain(
    "Original procedural illustration",
  );
  expect(
    JSON.parse(await zip.file("InkMuse.json").async("string")).pages[1].title,
  ).toBe("属于我的周末");
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator("#page-label")).toContainText("第 2 页");
  expect(errors).toEqual([]);
});

test("long text is continued without dropping characters", async ({ page }) => {
  await page.goto("/");
  await page.locator("#edit-toggle").click();
  const text = "很长的中文段落不能溢出，也不能悄悄丢失。".repeat(90);
  await page.locator("#page-body").fill(text);
  await page.locator("#apply-text").click();
  expect(await page.locator(".thumb").count()).toBeGreaterThan(3);
  const result = await page.evaluate(() => {
    const c = document.createElement("canvas").getContext("2d");
    const input = InkMuse.normalize(
      {
        pages: [
          {
            title: "标题",
            body: "很长的中文段落不能溢出，也不能悄悄丢失。".repeat(90),
            layout: "hero",
          },
        ],
      },
      "",
      {},
    );
    const output = InkMuse.fitDocument(c, input);
    return {
      text: output.pages.map((p) => p.body).join(""),
      overflows: output.pages.map(
        (p, i) => InkMuse.draw(c, output, i, null).overflow,
      ),
    };
  });
  expect(result.text).toBe(text);
  expect(result.overflows.every((x) => !x)).toBe(true);
});

test("failed generation preserves existing work and exposes the error", async ({
  page,
}) => {
  await page.route("**/api/design", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "设计服务超时，请重试。" }),
    }),
  );
  await page.goto("/");
  const before = await page.locator("#source").inputValue();
  await page.locator("#generate").click();
  await expect(page.locator("#status")).toHaveText("设计服务超时，请重试。");
  await expect(page.locator("#source")).toHaveValue(before);
  await expect(page.locator(".thumb")).toHaveCount(3);
  await expect(page.locator("#generate")).toBeEnabled();
});

test("image selection changes only the chosen page and has exportable provenance", async ({
  page,
}) => {
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xoAAAAASUVORK5CYII=";
  await page.route("**/api/images/search", (route) =>
    route.fulfill({
      json: {
        images: [
          {
            id: "fixture",
            title: "Test photograph",
            preview: `data:image/png;base64,${png}`,
            credit: "Test author",
            license: "CC0",
          },
        ],
      },
    }),
  );
  await page.route("**/api/images/select", (route) =>
    route.fulfill({
      json: {
        image: {
          url: `data:image/png;base64,${png}`,
          kind: "search",
          credit: "Test author",
          license: "CC0",
          source: "https://commons.wikimedia.org/wiki/Test",
        },
      },
    }),
  );
  await page.goto("/");
  await page.locator("#edit-toggle").click();
  await page.locator("#image-button").click();
  await page.locator("#image-query").fill("test");
  await page.locator("#image-submit").click();
  await page.locator(".image-result").click();
  await expect(page.locator("#image-dialog")).not.toBeVisible();
  await expect(page.locator("#image-credit")).toContainText("Test author");
  await page.getByRole("button", { name: "选择第 2 页", exact: true }).click();
  await expect(page.locator("#image-credit")).toBeEmpty();
});

test("mobile studio fits the viewport and dialogs remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.locator("#drafts-button").click();
  await expect(page.locator("#draft-dialog")).toBeVisible();
  await page.locator('[data-close="draft-dialog"]').click();
  await page.screenshot({ path: ".local/mobile-preview.png", fullPage: true });
});

test("desktop preview has no script errors", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: ".local/studio-preview.png", fullPage: true });
  expect(
    await page
      .locator("#main-canvas")
      .evaluate((c) => c.getContext("2d").getImageData(0, 0, 1, 1).data[3]),
  ).toBe(255);
});
