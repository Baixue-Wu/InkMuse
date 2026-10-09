/* global InkMuse, JSZip */
"use strict";
const $ = (id) => document.getElementById(id);
const Core = InkMuse;
const demo = window.InkMuseBuild?.demo === true;
const canvas = $("main-canvas");
const context = canvas.getContext("2d");
const storageKey = "inkmuse.workspace.v1";
const draftsKey = "inkmuse.drafts.v1";
let doc = Core.sample("slow");
let selected = 0,
  mood = "auto",
  busy = false,
  renderId = 0,
  imageMode = "search",
  imagePageId = null;
let history = [],
  future = [],
  toastTimer,
  saveTimer;
const imageCache = new Map();
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 4500);
}
function status(message, error) {
  $("status").textContent = message;
  $("status").hidden = !message;
  $("status").classList.toggle("error", !!error);
}
function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          doc,
          selected,
          source: $("source").value,
          mood,
          polish: $("polish").checked,
          pictures: $("pictures").checked,
        }),
      );
    } catch {
      toast("设备存储空间不足，请导出项目文件保存作品。");
    }
  }, 250);
}
function snapshot() {
  history.push(Core.clone(doc));
  if (history.length > 25) history.shift();
  future = [];
}
function mutate(fn) {
  snapshot();
  try {
    fn();
    doc = Core.fitDocument(context, doc);
    selected = Math.min(selected, doc.pages.length - 1);
    render();
    persist();
  } catch (error) {
    doc = history.pop();
    status(error.message, true);
  }
}
async function api(path, body) {
  if (demo) throw new Error("公开演示版不连接 AI 服务。请体验内置样例、编辑、上传配图和导出。");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 210000);
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || `请求失败 (${response.status})`);
    return result;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("等待时间较长，原文已保留。请稍后重试。");
    if (error instanceof TypeError)
      throw new Error("连接失败，请确认 InkMuse 服务正在运行后重试。");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
function loadImage(url) {
  if (!imageCache.has(url))
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
          imageCache.delete(url);
          reject(new Error("配图加载失败，请重新选择图片后导出。"));
        };
        image.src = url;
      }),
    );
  return imageCache.get(url);
}
async function drawPage(target, documentValue, index, scale = 1) {
  target.width = Core.SIZE.width * scale;
  target.height = Core.SIZE.height * scale;
  const ctx = target.getContext("2d");
  ctx.scale(scale, scale);
  const page = documentValue.pages[index];
  const image = page.image ? await loadImage(page.image.url) : null;
  const result = Core.draw(ctx, documentValue, index, image);
  if (result.overflow)
    throw new Error("本页文字超出页面，请应用文字修改以重新分页。");
}
async function render() {
  const currentRender = ++renderId;
  const documentValue = Core.clone(doc),
    index = selected;
  $("undo").disabled = !history.length;
  $("redo").disabled = !future.length;
  $("move-left").disabled = !selected;
  $("move-right").disabled = selected === doc.pages.length - 1;
  $("delete-page").disabled = doc.pages.length === 1;
  $("origin-badge").textContent =
    doc.origin === "sample" ? "内置示例" : "我的作品";
  $("design-note").textContent = doc.note || "为你的文字，找到合适的视觉表达。";
  $("page-label").textContent =
    `第 ${selected + 1} 页 / 共 ${doc.pages.length} 页`;
  const page = doc.pages[selected];
  $("page-title").value = page.title;
  $("page-body").value = page.body;
  $("page-layout").value = page.layout;
  $("image-focal").value = (page.image?.focal?.y ?? 0.5) * 100;
  $("focal-label").hidden = !page.image;
  $("image-credit").replaceChildren();
  if (page.image) {
    $("image-credit").append(
      document.createTextNode(
        `${page.image.credit || "自有图片"} · ${page.image.license || "自有素材"} `,
      ),
    );
    if (/^https:\/\//.test(page.image.source || "")) {
      const link = document.createElement("a");
      link.href = page.image.source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "查看来源 ↗";
      $("image-credit").append(link);
    }
  }
  const thumbs = $("thumbnails");
  thumbs.replaceChildren();
  documentValue.pages.forEach((p, i) => {
    const button = document.createElement("button");
    button.className = `thumb${i === selected ? " active" : ""}`;
    button.setAttribute("aria-label", `选择第 ${i + 1} 页`);
    button.setAttribute("aria-pressed", String(i === selected));
    const small = document.createElement("canvas");
    const num = document.createElement("span");
    num.textContent = String(i + 1).padStart(2, "0");
    button.append(small, num);
    button.onclick = () => {
      selected = i;
      render();
      persist();
    };
    thumbs.append(button);
    drawPage(small, documentValue, i, 0.18).catch(() => {
      const ctx = small.getContext("2d");
      ctx.setTransform(0.18, 0, 0, 0.18, 0, 0);
      Core.draw(ctx, documentValue, i, null);
    });
  });
  try {
    const image = page.image ? await loadImage(page.image.url) : null;
    if (currentRender !== renderId) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    Core.draw(context, documentValue, index, image);
  } catch (error) {
    if (currentRender === renderId) {
      Core.draw(context, documentValue, index, null);
      status(error.message, true);
    }
  }
}
function setMood(value, apply) {
  mood = value;
  document
    .querySelectorAll("[data-mood]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.mood === value),
    );
  if (apply && value !== "auto")
    mutate(() => {
      doc.mood = value;
      doc.theme = Core.themeFor(value);
    });
  persist();
}
function updateCount() {
  $("char-count").textContent = `${$("source").value.length} 字`;
  persist();
}
function safeFilename(title) {
  return title.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").slice(0, 65) || "InkMuse";
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function toBlob(target) {
  return new Promise((resolve, reject) =>
    target.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("图片导出失败，请重试。")),
      "image/png",
    ),
  );
}
async function portable(documentValue = doc) {
  const result = Core.clone(documentValue);
  for (const page of result.pages)
    if (page.image && !page.image.url.startsWith("data:")) {
      const response = await fetch(page.image.url);
      if (!response.ok) throw new Error("无法打包配图，请重新选择图片。");
      page.image.url = await readDataURL(await response.blob());
    }
  return result;
}
function readDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败，请重试。"));
    reader.readAsDataURL(blob);
  });
}

$("source").oninput = updateCount;
$("clear-button").onclick = () => {
  $("source").value = "";
  updateCount();
  $("source").focus();
};
document.querySelectorAll("[data-sample]").forEach((button) => {
  button.onclick = () => {
    snapshot();
    doc = Core.fitDocument(context, Core.sample(button.dataset.sample));
    $("source").value = doc.source;
    selected = 0;
    status("");
    setMood("auto", false);
    updateCount();
    render();
  };
});
document.querySelectorAll("[data-mood]").forEach((button) => {
  button.onclick = () => setMood(button.dataset.mood, true);
});
$("polish").onchange = persist;
$("pictures").onchange = persist;
$("generate").onclick = async () => {
  if (busy) return;
  const text = $("source").value.trim();
  if (text.length < 10) {
    status("先写下至少 10 个字，再让灵感开始。", true);
    $("source").focus();
    return;
  }
  busy = true;
  document.body.classList.add("busy");
  $("generate").disabled = true;
  const options = {
    mood,
    mode: $("polish").checked ? "polish" : "preserve",
    origin: "ai",
  };
  status(
    "正在读懂文字，设计版式并寻找配图。通常需要半分钟到两分钟，你的原文会保留。",
  );
  try {
    const result = await api("/api/design", {
      text,
      ...options,
      pictures: $("pictures").checked,
    });
    const next = Core.fitDocument(
      context,
      Core.normalize(result.plan, text, options),
    );
    snapshot();
    doc = next;
    selected = 0;
    await render();
    persist();
    status(
      result.warnings.length
        ? `设计已完成，配图需要你看一眼：${result.warnings.join("；")}`
        : "设计完成。可以逐页修改文字、换图，或直接导出。",
      !!result.warnings.length,
    );
    if (window.innerWidth < 760)
      document.querySelector(".preview").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    document.body.classList.remove("busy");
    $("generate").disabled = false;
  }
};
$("undo").onclick = () => {
  if (!history.length) return;
  future.push(Core.clone(doc));
  doc = history.pop();
  selected = Math.min(selected, doc.pages.length - 1);
  render();
  persist();
};
$("redo").onclick = () => {
  if (!future.length) return;
  history.push(Core.clone(doc));
  doc = future.pop();
  selected = Math.min(selected, doc.pages.length - 1);
  render();
  persist();
};
$("edit-toggle").onclick = () => {
  $("editor").hidden = !$("editor").hidden;
  $("edit-toggle").innerHTML = $("editor").hidden
    ? "编辑这一页 <span>⌄</span>"
    : "收起编辑 <span>⌃</span>";
};
$("apply-text").onclick = () => {
  const title = $("page-title").value.trim(),
    body = $("page-body").value;
  if (!title) return toast("标题不能为空。");
  mutate(() => {
    doc.pages[selected].title = title;
    doc.pages[selected].body = body;
    doc.origin = "edited";
  });
  toast("文字已更新，超长内容会自动续页。");
};
$("page-layout").onchange = () =>
  mutate(() => {
    doc.pages[selected].layout = $("page-layout").value;
  });
function move(direction) {
  mutate(() => {
    const target = selected + direction;
    if (target < 0 || target >= doc.pages.length) return;
    [doc.pages[selected], doc.pages[target]] = [
      doc.pages[target],
      doc.pages[selected],
    ];
    selected = target;
  });
}
$("move-left").onclick = () => move(-1);
$("move-right").onclick = () => move(1);
$("delete-page").onclick = () => {
  if (doc.pages.length > 1) mutate(() => doc.pages.splice(selected, 1));
};
$("remove-image").onclick = () =>
  mutate(() => {
    doc.pages[selected].image = null;
  });
$("image-focal").onchange = () => {
  const value = Number($("image-focal").value) / 100;
  mutate(() => {
    if (doc.pages[selected].image)
      doc.pages[selected].image.focal = { x: 0.5, y: value };
  });
};
$("image-upload").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    )
      throw new Error("请选择小于 12 MB 的 PNG、JPEG 或 WebP 图片。");
    const image = await loadImage(await readDataURL(file));
    const temp = document.createElement("canvas");
    const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
    temp.width = image.width * ratio;
    temp.height = image.height * ratio;
    temp.getContext("2d").drawImage(image, 0, 0, temp.width, temp.height);
    const url = temp.toDataURL("image/jpeg", 0.9);
    mutate(() => {
      doc.pages[selected].image = {
        url,
        kind: "upload",
        credit: "自有配图",
        source: "",
        license: "用户提供",
      };
      if (["poster", "editorial"].includes(doc.pages[selected].layout))
        doc.pages[selected].layout = "hero";
    });
    toast("图片已放入这一页。");
  } catch (error) {
    toast(error.message);
  }
  event.target.value = "";
};
$("download-page").onclick = async () => {
  try {
    const temp = document.createElement("canvas");
    await drawPage(temp, doc, selected, 2);
    download(
      await toBlob(temp),
      `${safeFilename(doc.title)}-${selected + 1}.png`,
    );
    toast("已导出 1500 × 2000 高清图片。");
  } catch (error) {
    status(error.message, true);
  }
};
$("export").onclick = async () => {
  $("export").disabled = true;
  try {
    const zip = new JSZip();
    const exported = Core.clone(doc);
    for (let i = 0; i < exported.pages.length; i++) {
      const temp = document.createElement("canvas");
      await drawPage(temp, exported, i, 2);
      zip.file(`${String(i + 1).padStart(2, "0")}.png`, await toBlob(temp));
    }
    zip.file("图片来源.txt", Core.attribution(exported));
    zip.file("InkMuse.json", JSON.stringify(await portable(exported), null, 2));
    download(
      await zip.generateAsync({ type: "blob" }),
      `${safeFilename(exported.title)}.zip`,
    );
    toast("全部图片、来源与可编辑草稿已打包。");
  } catch (error) {
    status(error.message, true);
  } finally {
    $("export").disabled = false;
  }
};

document.querySelectorAll("[data-close]").forEach((button) => {
  button.onclick = () => $(button.dataset.close).close();
});
$("original-button").onclick = () => {
  $("original-text").textContent = doc.source;
  $("original-dialog").showModal();
};
function drafts() {
  const value = stored(draftsKey, []);
  return Array.isArray(value) ? value : [];
}
function updateDraftCount() {
  $("draft-count").textContent = drafts().length;
}
$("save-draft").onclick = () => {
  const items = drafts();
  const item = {
    id: Date.now(),
    date: new Date().toLocaleString("zh-CN"),
    doc: Core.clone(doc),
    source: $("source").value,
  };
  try {
    localStorage.setItem(
      draftsKey,
      JSON.stringify([item, ...items].slice(0, 12)),
    );
    updateDraftCount();
    toast("草稿已保存在这台设备。");
  } catch {
    toast("设备存储已满，请导出项目文件保存。");
  }
};
function renderDrafts() {
  const list = $("draft-list");
  list.replaceChildren();
  if (!drafts().length) {
    list.textContent = "还没有保存的草稿。把第一份灵感留在这里吧。";
    list.className = "dialog-note";
    return;
  }
  for (const item of drafts()) {
    const row = document.createElement("div");
    row.className = "draft-item";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.doc.title;
    const date = document.createElement("small");
    date.textContent = `${item.date} · ${item.doc.pages.length} 页`;
    info.append(title, date);
    const actions = document.createElement("div");
    const open = document.createElement("button");
    open.className = "small-button";
    open.textContent = "继续编辑";
    open.onclick = () => {
      try {
        const next = Core.validateImport(Core.clone(item.doc));
        snapshot();
        doc = Core.fitDocument(context, next);
        selected = 0;
        $("source").value = item.source;
        updateCount();
        render();
        persist();
        $("draft-dialog").close();
      } catch (error) {
        toast(error.message);
      }
    };
    const remove = document.createElement("button");
    remove.className = "text-button";
    remove.textContent = "删除";
    remove.onclick = () => {
      localStorage.setItem(
        draftsKey,
        JSON.stringify(drafts().filter((x) => x.id !== item.id)),
      );
      updateDraftCount();
      renderDrafts();
    };
    actions.append(open, remove);
    row.append(info, actions);
    list.append(row);
  }
}
$("drafts-button").onclick = () => {
  renderDrafts();
  $("draft-dialog").showModal();
};
$("studio-tab").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
$("export-json").onclick = async () => {
  try {
    download(
      new Blob([JSON.stringify(await portable(), null, 2)], {
        type: "application/json",
      }),
      `${safeFilename(doc.title)}.inkmuse.json`,
    );
  } catch (error) {
    toast(error.message);
  }
};
$("import-json").onchange = async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) throw new Error("草稿文件过大。");
    const next = Core.fitDocument(
      context,
      Core.validateImport(JSON.parse(await file.text())),
    );
    snapshot();
    doc = next;
    selected = 0;
    $("source").value = doc.source;
    updateCount();
    render();
    persist();
    $("draft-dialog").close();
    toast("草稿已导入。");
  } catch (error) {
    toast(`无法导入：${error.message}`);
  }
  event.target.value = "";
};

function imageTab(mode) {
  imageMode = mode;
  $("search-tab").classList.toggle("active", mode === "search");
  $("generation-tab").classList.toggle("active", mode === "generate");
  $("image-submit").textContent = mode === "search" ? "搜索 ↗" : "生成 ↗";
  const page = doc.pages.find((p) => p.id === imagePageId);
  $("image-query").value =
    mode === "search" ? page?.imageQuery || "" : page?.imagePrompt || "";
  $("image-note").textContent =
    mode === "search"
      ? "搜索 Wikimedia Commons 真实素材。来源与许可会随作品保留；请确认画面确实符合文字。"
      : "描述想要的插画或氛围。生成图用于视觉表达，不能代替真实地点或事件的照片。";
  $("image-results").replaceChildren();
  $("image-status").textContent = "";
  if (demo) $("image-note").textContent = "公开演示版支持上传自己的图片；在线搜索与 AI 配图未开放。";
}
$("image-button").onclick = () => {
  imagePageId = doc.pages[selected].id;
  imageTab("search");
  $("image-dialog").showModal();
};
$("search-tab").onclick = () => imageTab("search");
$("generation-tab").onclick = () => imageTab("generate");
function applyImage(image) {
  mutate(() => {
    const page = doc.pages.find((p) => p.id === imagePageId);
    if (!page) throw new Error("原页面已删除，请重新选择页面。");
    page.image = image;
    if (["poster", "editorial"].includes(page.layout)) page.layout = "hero";
  });
  $("image-dialog").close();
  toast("配图已更新，其他页面保持原样。");
}
$("image-form").onsubmit = async (event) => {
  event.preventDefault();
  const query = $("image-query").value.trim();
  if (!query) return;
  $("image-submit").disabled = true;
  $("image-results").replaceChildren();
  $("image-status").textContent =
    imageMode === "search" ? "正在寻找匹配的画面…" : "正在绘制你的配图…";
  try {
    if (imageMode === "generate") {
      const result = await api("/api/images/generate", { prompt: query });
      applyImage(result.image);
    } else {
      const result = await api("/api/images/search", { query });
      $("image-status").textContent = result.images.length
        ? `找到 ${result.images.length} 张候选，点击放入当前页。`
        : "没有找到合适图片，试试更具体的关键词或上传自己的图片。";
      for (const item of result.images) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "image-result";
        const image = document.createElement("img");
        image.src = item.preview;
        image.alt = item.title;
        image.loading = "lazy";
        const caption = document.createElement("span");
        caption.textContent = item.title;
        const credit = document.createElement("small");
        credit.textContent = `${item.credit} · ${item.license}`;
        caption.append(credit);
        button.append(image, caption);
        button.onclick = async () => {
          button.disabled = true;
          $("image-status").textContent = "正在载入配图…";
          try {
            const response = await api("/api/images/select", { id: item.id });
            applyImage(response.image);
          } catch (error) {
            $("image-status").textContent = error.message;
            button.disabled = false;
          }
        };
        $("image-results").append(button);
      }
    }
  } catch (error) {
    $("image-status").textContent = error.message;
  } finally {
    $("image-submit").disabled = false;
  }
};

const saved = stored(storageKey, null);
if (saved) {
  try {
    doc = Core.validateImport(saved.doc);
    selected = Math.min(saved.selected || 0, doc.pages.length - 1);
    mood = saved.mood || "auto";
    $("source").value = saved.source || doc.source;
    $("polish").checked = saved.polish !== false;
    $("pictures").checked = saved.pictures !== false;
  } catch {
    $("source").value = doc.source;
    toast("上次草稿无法恢复，已打开内置示例。");
  }
} else $("source").value = doc.source;
doc = Core.fitDocument(context, doc);
setMood(mood, false);
updateCount();
updateDraftCount();
render();
if (demo) {
  document.querySelector(".intro p").textContent = "公开演示版：选择内置样例，修改文字与版式，上传配图并导出。作品保存在当前浏览器。";
  $("generate").disabled = true;
  $("generate").textContent = "AI 生成需运行完整版";
  $("generation-hint").textContent = "从上方三个样例开始体验。AI 润色、图片搜索与生成未开放。";
  for (const id of ["pictures", "polish", "search-tab", "generation-tab", "image-submit", "image-query"]) {
    if ($(id)) $(id).disabled = true;
  }
} else api("/api/status")
  .then((result) => {
    $("generation-tab").dataset.configured = String(result.generation);
  })
  .catch((error) => status(error.message, true));
