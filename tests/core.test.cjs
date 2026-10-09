const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../core/design.js");
const ctx = {
  font: "",
  measureText(text) {
    return {
      width:
        Array.from(text).length * Number(this.font.match(/(\d+)px/)?.[1] || 25),
    };
  },
};
test("pagination preserves long source content and is idempotent", () => {
  const text = "你好世界。".repeat(1500);
  const doc = Core.normalize(
    { pages: [{ title: "长文章", body: text, layout: "hero" }] },
    text,
    { mode: "preserve" },
  );
  const fitted = Core.fitDocument(ctx, doc);
  assert.ok(fitted.pages.length > 1);
  assert.equal(fitted.pages.map((p) => p.body).join(""), text);
  assert.deepEqual(Core.fitDocument(ctx, fitted), fitted);
});
test("untrusted palette colors cannot make body text unreadable", () => {
  const theme = Core.themeFor("warm", {
    paper: "#ffffff",
    ink: "#ffffff",
    muted: "#ffffff",
    accent: "url(evil)",
  });
  assert.ok(Core.contrast(theme.paper, theme.ink) >= 4.5);
  assert.equal(theme.accent, Core.THEMES.warm.accent);
});
test("draft imports reject arbitrary remote image URLs", () => {
  const doc = Core.sample("slow");
  doc.pages[0].image = { url: "http://localhost/private" };
  assert.throws(() => Core.validateImport(doc), /图片地址无效/);
});
test("every sample is an explicitly labelled editable document", () => {
  for (const key of Object.keys(Core.SAMPLES)) {
    const doc = Core.sample(key);
    assert.equal(doc.origin, "sample");
    assert.ok(doc.source);
    assert.equal(doc.pages.length, 3);
    assert.ok(
      Core.attribution(doc).includes("Original procedural illustration"),
    );
  }
});
