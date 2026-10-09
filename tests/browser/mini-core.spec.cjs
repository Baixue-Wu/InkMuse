const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const vm = require("node:vm");
const Core = require("../../core/design.js");

test("native page bootstraps through the wx boundary and persists an editable draft", async ({
  page,
}) => {
  await page.goto("/");
  const bundle = fs.readFileSync(
    "dist/miniprogram/pages/studio/studio.js",
    "utf8",
  );
  const saved = new Map();
  let definition;
  const ctx = {
    scale() {},
    save() {},
    restore() {},
    fillRect() {},
    fillText() {},
    translate() {},
    rotate() {},
    beginPath() {},
    rect() {},
    clip() {},
    arc() {},
    fill() {},
    stroke() {},
    drawImage() {},
    measureText(text) {
      return { width: Array.from(text).length * 23 };
    },
  };
  const canvas = { getContext: () => ctx };
  const wx = {
    createSelectorQuery() {
      return {
        in() {
          return this;
        },
        select() {
          return this;
        },
        fields() {
          return this;
        },
        exec(fn) {
          fn([{ node: canvas, width: 300, height: 400 }]);
        },
      };
    },
    setStorageSync(key, value) {
      saved.set(key, Core.clone(value));
    },
    getStorageSync(key) {
      return saved.get(key);
    },
    showToast() {},
    showModal() {},
  };
  vm.runInNewContext(bundle, {
    require: (name) =>
      name.includes("design") ? Core : { apiBase: "http://localhost" },
    wx,
    Page: (value) => {
      definition = value;
    },
  });
  const instance = {
    ...definition,
    data: Core.clone(definition.data),
    setData(values) {
      Object.assign(this.data, values);
    },
  };
  instance.onLoad();
  instance.onReady();
  expect(instance.data.canvasHeight).toBe(400);
  instance.setData({
    pageTitle: "在小程序中编辑",
    pageBody: "这是小程序中的文字修改。",
  });
  instance.applyText();
  instance.saveDraft();
  expect(saved.get("inkmuse.draft").doc.pages[0].title).toBe("在小程序中编辑");
  instance.undo();
  expect(instance.doc.pages[0].title).toBe("把周末，还给自己");
  instance.restore();
  expect(instance.doc.pages[0].title).toBe("在小程序中编辑");
});
