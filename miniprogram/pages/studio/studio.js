const Core = require("../../core/design");
const { apiBase } = require("../../config");
const layouts = ["hero", "split", "editorial", "poster"];
function request(path, data) {
  return new Promise((resolve, reject) =>
    wx.request({
      url: apiBase + path,
      method: "POST",
      data,
      timeout: 210000,
      success: (res) =>
        res.statusCode === 200
          ? resolve(res.data)
          : reject(new Error(res.data.error || "请求失败，请重试。")),
      fail: (error) =>
        reject(
          new Error(
            `连接失败：${error.errMsg}。请检查服务地址与小程序合法域名配置。`,
          ),
        ),
    }),
  );
}
function modal(message) {
  wx.showModal({ title: "InkMuse", content: message, showCancel: false });
}
Page({
  data: {
    source: Core.SAMPLES.slow.text,
    mood: "auto",
    pictures: true,
    polish: true,
    moods: [
      { key: "auto", label: "交给灵感" },
      { key: "warm", label: "温暖生活" },
      { key: "nature", label: "清爽自然" },
      { key: "editorial", label: "杂志叙事" },
      { key: "bold", label: "大胆表达" },
    ],
    layoutNames: ["大图开篇", "图文并置", "文字叙事", "留白金句"],
    layoutIndex: 0,
    selected: 0,
    pageCount: 3,
    pageTitle: "",
    pageBody: "",
    note: "",
    credit: "",
    canvasHeight: 400,
    busy: false,
    saving: false,
    editing: false,
    canUndo: false,
    message: "",
    origin: "sample",
    imageDialog: false,
    imageMode: "search",
    imageBusy: false,
    imageMessage: "",
    candidates: [],
    query: "",
  },
  onLoad() {
    this.doc = Core.sample("slow");
    this.history = [];
    this.drawNumber = 0;
  },
  onReady() {
    wx.createSelectorQuery()
      .in(this)
      .select("#art")
      .fields({ node: true, size: true })
      .exec((result) => {
        if (!result[0] || !result[0].node)
          return modal("Canvas 初始化失败。请使用支持 Canvas 2D 的基础库。");
        this.canvas = result[0].node;
        this.canvas.width = Core.SIZE.width * 2;
        this.canvas.height = Core.SIZE.height * 2;
        this.setData({
          canvasHeight: (result[0].width * Core.SIZE.height) / Core.SIZE.width,
        });
        this.ctx = this.canvas.getContext("2d");
        this.ctx.scale(2, 2);
        this.doc = Core.fitDocument(this.ctx, this.doc);
        this.render();
      });
  },
  sourceInput(e) {
    this.setData({ source: e.detail.value });
  },
  titleInput(e) {
    this.setData({ pageTitle: e.detail.value });
  },
  bodyInput(e) {
    this.setData({ pageBody: e.detail.value });
  },
  queryInput(e) {
    this.setData({ query: e.detail.value });
  },
  picturesChange(e) {
    this.setData({ pictures: e.detail.value });
  },
  polishChange(e) {
    this.setData({ polish: e.detail.value });
  },
  change(fn) {
    this.history.push(Core.clone(this.doc));
    if (this.history.length > 20) this.history.shift();
    try {
      fn();
      this.doc = Core.fitDocument(this.ctx, this.doc);
      this.render();
    } catch (error) {
      this.doc = this.history.pop();
      modal(error.message);
    }
  },
  sample(e) {
    if (!this.ctx) return;
    const key = e.currentTarget.dataset.key;
    this.change(() => {
      this.doc = Core.sample(key);
      this.setData({
        source: this.doc.source,
        selected: 0,
        mood: "auto",
        message: "",
      });
    });
  },
  moodChange(e) {
    const mood = e.currentTarget.dataset.key;
    this.setData({ mood });
    if (mood !== "auto")
      this.change(() => {
        this.doc.mood = mood;
        this.doc.theme = Core.themeFor(mood);
      });
  },
  async render() {
    if (!this.ctx) return;
    const token = ++this.drawNumber,
      index = Math.min(this.data.selected, this.doc.pages.length - 1),
      page = this.doc.pages[index];
    this.setData({
      selected: index,
      pageCount: this.doc.pages.length,
      pageTitle: page.title,
      pageBody: page.body,
      layoutIndex: layouts.indexOf(page.layout),
      note: this.doc.note,
      origin: this.doc.origin,
      credit: page.image
        ? `${page.image.credit || "自有配图"} · ${page.image.license || ""}`
        : "",
      canUndo: this.history.length > 0,
    });
    try {
      const image = page.image ? await this.loadImage(page.image.url) : null;
      if (token === this.drawNumber)
        Core.draw(this.ctx, this.doc, index, image);
    } catch (error) {
      if (token === this.drawNumber) {
        Core.draw(this.ctx, this.doc, index, null);
        this.setData({ message: error.message });
      }
    }
  },
  async loadImage(url) {
    let path = url;
    if (url.startsWith("/assets/"))
      path = await new Promise((resolve, reject) =>
        wx.downloadFile({
          url: apiBase + url,
          success: (res) =>
            res.statusCode === 200
              ? resolve(res.tempFilePath)
              : reject(new Error("配图下载失败，请重新选择。")),
          fail: (e) => reject(new Error(e.errMsg)),
        }),
      );
    return new Promise((resolve, reject) => {
      const image = this.canvas.createImage();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("配图加载失败，请换一张图片。"));
      image.src = path;
    });
  },
  async generate() {
    if (this.data.busy || !this.ctx) return;
    const source = this.data.source.trim();
    if (source.length < 10) return modal("请先写下至少 10 个字。");
    const options = {
      mood: this.data.mood,
      mode: this.data.polish ? "polish" : "preserve",
      origin: "ai",
    };
    this.setData({
      busy: true,
      message: "正在读懂文字，设计版式并寻找配图。请稍候，原文会保留。",
    });
    try {
      const result = await request("/api/design", {
        text: source,
        ...options,
        pictures: this.data.pictures,
      });
      this.change(() => {
        this.doc = Core.normalize(result.plan, source, options);
        this.setData({ selected: 0 });
      });
      this.setData({
        message: result.warnings.length
          ? result.warnings.join("；")
          : "设计完成，可以逐页修改或保存图片。",
      });
    } catch (error) {
      this.setData({ message: error.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  navigate(e) {
    const next = this.data.selected + Number(e.currentTarget.dataset.step);
    if (next >= 0 && next < this.doc.pages.length) {
      this.setData({ selected: next });
      this.render();
    }
  },
  toggleEditor() {
    this.setData({ editing: !this.data.editing });
  },
  applyText() {
    if (!this.data.pageTitle.trim()) return modal("标题不能为空。");
    this.change(() => {
      const page = this.doc.pages[this.data.selected];
      page.title = this.data.pageTitle.trim();
      page.body = this.data.pageBody;
      this.doc.origin = "edited";
    });
  },
  layoutChange(e) {
    this.change(() => {
      this.doc.pages[this.data.selected].layout =
        layouts[Number(e.detail.value)];
    });
  },
  movePage(e) {
    const from = this.data.selected,
      to = from + Number(e.currentTarget.dataset.step);
    if (to < 0 || to >= this.doc.pages.length) return;
    this.change(() => {
      [this.doc.pages[from], this.doc.pages[to]] = [
        this.doc.pages[to],
        this.doc.pages[from],
      ];
      this.setData({ selected: to });
    });
  },
  undo() {
    if (this.history.length) {
      this.doc = this.history.pop();
      this.render();
    }
  },
  saveDraft() {
    try {
      wx.setStorageSync("inkmuse.draft", {
        doc: this.doc,
        source: this.data.source,
      });
      wx.showToast({ title: "草稿已保存", icon: "success" });
    } catch {
      modal("保存失败，请检查设备存储空间。");
    }
  },
  restore() {
    try {
      const saved = wx.getStorageSync("inkmuse.draft");
      if (!saved) return modal("还没有保存的草稿。");
      this.change(() => {
        this.doc = saved.doc;
        this.setData({ source: saved.source, selected: 0 });
      });
    } catch (error) {
      modal(`无法恢复草稿：${error.message}`);
    }
  },
  async exportPage(index) {
    const page = this.doc.pages[index];
    const image = page.image ? await this.loadImage(page.image.url) : null;
    const result = Core.draw(this.ctx, this.doc, index, image);
    if (result.overflow)
      throw new Error("内容超出页面，请应用文字修改重新分页。");
    const path = await new Promise((resolve, reject) =>
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        fileType: "png",
        success: (res) => resolve(res.tempFilePath),
        fail: (e) => reject(new Error(e.errMsg)),
      }),
    );
    await new Promise((resolve, reject) =>
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: resolve,
        fail: (e) => reject(new Error(e.errMsg)),
      }),
    );
  },
  async saveImage() {
    try {
      await this.exportPage(this.data.selected);
      wx.showToast({ title: "图片已保存", icon: "success" });
    } catch (error) {
      this.exportError(error);
    }
  },
  async saveAll() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    let count = 0;
    try {
      for (let i = 0; i < this.doc.pages.length; i++) {
        await this.exportPage(i);
        count++;
      }
      wx.showToast({ title: `已保存 ${count} 张`, icon: "success" });
    } catch (error) {
      this.exportError(new Error(`已保存 ${count} 张。${error.message}`));
    } finally {
      this.setData({ saving: false });
      this.render();
    }
  },
  exportError(error) {
    if (/auth deny|auth denied/.test(error.message))
      wx.showModal({
        title: "需要相册权限",
        content: "允许保存到相册后，可以再次导出。",
        confirmText: "打开设置",
        success: (res) => {
          if (res.confirm) wx.openSetting({});
        },
      });
    else modal(error.message);
  },
  openImages() {
    const page = this.doc.pages[this.data.selected];
    this.imagePage = page.id;
    this.setData({
      imageDialog: true,
      imageMode: "search",
      query: page.imageQuery,
      candidates: [],
      imageMessage: "来源与许可会随配图保留。",
    });
  },
  closeImages() {
    this.setData({ imageDialog: false });
  },
  imageModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    const page = this.doc.pages.find((p) => p.id === this.imagePage);
    this.setData({
      imageMode: mode,
      query: mode === "search" ? page.imageQuery : page.imagePrompt,
      candidates: [],
      imageMessage:
        mode === "search"
          ? "搜索真实图片，选择与你的文字相符的画面。"
          : "生图需要服务端配置。生成图不能代替真实事件的照片。",
    });
  },
  applyImage(image) {
    this.change(() => {
      const page =
        this.doc.pages.find((p) => p.id === this.imagePage) ||
        this.doc.pages[this.data.selected];
      page.image = image;
      if (["poster", "editorial"].includes(page.layout)) page.layout = "hero";
    });
    this.setData({ imageDialog: false });
  },
  async findImages() {
    if (this.data.imageBusy) return;
    this.setData({ imageBusy: true, imageMessage: "正在寻找画面…" });
    try {
      if (this.data.imageMode === "generate") {
        const result = await request("/api/images/generate", {
          prompt: this.data.query,
        });
        this.applyImage(result.image);
      } else {
        const result = await request("/api/images/search", {
          query: this.data.query,
        });
        this.setData({
          candidates: result.images,
          imageMessage: result.images.length
            ? "点击配图放入当前页。"
            : "没有找到图片，请换关键词或上传。",
        });
      }
    } catch (error) {
      this.setData({ imageMessage: error.message });
    } finally {
      this.setData({ imageBusy: false });
    }
  },
  async selectImage(e) {
    if (this.data.imageBusy) return;
    this.setData({ imageBusy: true });
    try {
      const result = await request("/api/images/select", {
        id: e.currentTarget.dataset.id,
      });
      this.applyImage(result.image);
    } catch (error) {
      this.setData({ imageMessage: error.message });
    } finally {
      this.setData({ imageBusy: false });
    }
  },
  uploadImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      success: (res) => {
        const file = res.tempFiles[0];
        if (file.size > 12 * 1024 * 1024)
          return modal("请选择小于 12 MB 的图片。");
        wx.getFileSystemManager().saveFile({
          tempFilePath: file.tempFilePath,
          success: (saved) => {
            this.imagePage = this.doc.pages[this.data.selected].id;
            this.applyImage({
              url: saved.savedFilePath,
              kind: "upload",
              credit: "自有配图",
              license: "用户提供",
              source: "",
            });
          },
          fail: (error) => modal(error.errMsg),
        });
      },
    });
  },
  copyCredit() {
    wx.setClipboardData({ data: Core.attribution(this.doc) });
  },
});
