(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.InkMuse = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SIZE = { width: 750, height: 1000 };
  const THEMES = {
    warm: {
      name: "温暖生活",
      paper: "#f4eee3",
      ink: "#35352c",
      accent: "#b7573c",
      muted: "#79796a",
      wash: "#e3dfcd",
      serif: true,
    },
    nature: {
      name: "清爽自然",
      paper: "#eef2e9",
      ink: "#263b30",
      accent: "#517451",
      muted: "#647567",
      wash: "#d9e3d2",
      serif: true,
    },
    editorial: {
      name: "杂志叙事",
      paper: "#f5f3ee",
      ink: "#242729",
      accent: "#a84434",
      muted: "#777771",
      wash: "#e5e1d8",
      serif: true,
    },
    bold: {
      name: "大胆表达",
      paper: "#f2e748",
      ink: "#272826",
      accent: "#5442b3",
      muted: "#606047",
      wash: "#e2d840",
      serif: false,
    },
  };
  const SAMPLES = {
    slow: {
      label: "生活随笔",
      title: "把周末，还给自己",
      text: "把周末，还给自己\n\n我们总想把休息日过得很充实：约朋友、赶展览、补上工作日没做完的事。可有时候，真正需要的不是更多安排，而是一点空白。\n\n早起半小时，慢慢喝完一杯咖啡。不刷手机，听听窗外的声音，让身体比消息先醒来。\n\n走一条没有目的地的路。绕过熟悉的街口，去看一棵树、一家小店，或者傍晚落在墙上的光。\n\n给自己做一顿简单的饭。认真洗菜，打开喜欢的歌，把吃饭当作今天值得期待的一件事。\n\n休息不需要证明它有用。那些没有被填满的时间，也可以是生活里很好的部分。",
    },
    plant: {
      label: "实用分享",
      title: "给新手的绿植养护笔记",
      text: "给新手的绿植养护笔记\n\n养植物的第一步，是先了解家里的光照，再选择适合的品种。明亮的散射光和长时间直晒并不一样。\n\n浇水前先摸摸土壤。不同植物对水分的需要不同，不必机械地每天浇水。盆底有排水孔，能减少积水的风险。\n\n买回家后，先给植物一点适应环境的时间。不要同时换盆、施肥、搬位置，留意叶片和土壤的变化。\n\n把观察当成习惯。每周看一眼新叶、土壤和光照，比频繁折腾更有帮助。",
    },
    city: {
      label: "旅行记录",
      title: "用散步，认识一座城市",
      text: "用散步，认识一座城市\n\n第一次到一座城市，我喜欢给自己留一个没有计划的下午。不急着打卡，先在住处附近走一走。\n\n从一家街边咖啡店开始，观察人们怎样度过日常。沿着老街慢慢走，注意门窗、招牌和建筑之间的空隙。\n\n旅行里最值得记住的，有时是一段闲聊、一家小店，或一条走错却很好看的路。\n\n比起走过多少地方，我更想记住自己在这里的感受。",
    },
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const hex = (value, fallback) =>
    /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
  function themeFor(key, custom) {
    const base = THEMES[key] || THEMES.warm;
    const theme = { ...base };
    for (const field of ["paper", "ink", "accent", "muted", "wash"])
      theme[field] = hex(custom && custom[field], base[field]);
    if (contrast(theme.paper, theme.ink) < 4.5)
      theme.ink = luminance(theme.paper) > 0.3 ? "#202622" : "#faf8ef";
    if (contrast(theme.paper, theme.muted) < 3) theme.muted = theme.ink;
    return theme;
  }
  function luminance(color) {
    const c = [1, 3, 5]
      .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
      .map((v) =>
        v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
      );
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function normalize(plan, source, options) {
    options = options || {};
    if (!plan || !Array.isArray(plan.pages) || !plan.pages.length)
      throw new Error("设计结果没有页面，请重新生成。");
    if (plan.pages.length > 24)
      throw new Error("设计页面过多，请分成几篇制作。");
    const mood =
      options.mood && options.mood !== "auto"
        ? options.mood
        : plan.mood || "warm";
    const doc = {
      version: 1,
      title: String(plan.title || "我的图文").slice(0, 120),
      source: String(source || ""),
      mood,
      theme: themeFor(mood, plan.palette),
      mode: options.mode || "polish",
      origin: options.origin || "ai",
      note: String(plan.note || ""),
      pages: [],
    };
    doc.pages = plan.pages.map((page, index) => ({
      id: `page-${index + 1}`,
      title: String(page.title || doc.title).slice(0, 120),
      body: String(page.body || "").slice(0, 12000),
      label: String(
        page.label || (index === 0 ? "COVER STORY" : "READ & KEEP"),
      ).slice(0, 35),
      layout: ["hero", "split", "editorial", "poster"].includes(page.layout)
        ? page.layout
        : index === 0
          ? "hero"
          : "editorial",
      imageQuery: String(page.imageQuery || "").slice(0, 160),
      imagePrompt: String(page.imagePrompt || "").slice(0, 600),
      image: page.image || null,
      artwork: Number(
        page.artwork ?? (options.origin === "sample" ? index : index + 3),
      ),
      design: {
        imageHeight: Math.max(
          240,
          Math.min(420, Number(page.design?.imageHeight) || 350),
        ),
        titleSize: Math.max(
          40,
          Math.min(76, Number(page.design?.titleSize) || 58),
        ),
        imageWidth: Math.max(
          230,
          Math.min(340, Number(page.design?.imageWidth) || 314),
        ),
      },
    }));
    return doc;
  }
  function sample(key) {
    const s = SAMPLES[key] || SAMPLES.slow;
    const parts = s.text.split("\n\n");
    return normalize(
      {
        title: s.title,
        mood: key === "plant" ? "nature" : "warm",
        note: "内置示例 · 插画由程序绘制，可更换为真实配图",
        pages: [
          {
            title: s.title,
            body: parts[1],
            label: "NOTES ON LIVING",
            layout: "hero",
            imageQuery:
              key === "plant"
                ? "houseplant leaves"
                : key === "city"
                  ? "old city street"
                  : "coffee cup morning",
            artwork: key === "plant" ? 1 : 0,
          },
          {
            title:
              key === "plant"
                ? "先观察，再照顾"
                : key === "city"
                  ? "留一个空白的下午"
                  : "让日子，慢一点",
            body: parts.slice(2, parts.length > 4 ? 4 : 3).join("\n\n"),
            label: "SMALL THINGS MATTER",
            layout: "split",
            artwork: 1,
          },
          {
            title:
              key === "plant"
                ? "和植物一起慢慢长大"
                : key === "city"
                  ? "记住此刻的感受"
                  : "留白，也是一种丰盛",
            body: parts.slice(parts.length > 4 ? 4 : 3).join("\n\n"),
            label: "A NOTE TO SELF",
            layout: "poster",
            artwork: 2,
          },
        ],
      },
      s.text,
      { origin: "sample", mode: "polish" },
    );
  }
  function wrap(ctx, text, width) {
    const lines = [];
    for (const paragraph of String(text).split("\n")) {
      if (!paragraph) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const char of Array.from(paragraph)) {
        if (line && ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = char;
        } else line += char;
      }
      lines.push(line);
    }
    return lines;
  }
  function font(ctx, size, weight, serif) {
    ctx.font = `${weight || 400} ${size}px ${serif ? '"Noto Serif SC", "Songti SC", STSong, serif' : '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'}`;
  }
  function metrics(ctx, page, theme) {
    const layout = page.layout;
    const design = page.design || {};
    const width = layout === "split" ? 640 - (design.imageWidth || 314) : 622;
    let size = design.titleSize || (layout === "poster" ? 70 : 58);
    let title;
    do {
      font(ctx, size, 600, theme.serif);
      title = wrap(ctx, page.title, width);
      if (title.length <= 4 || size <= 28) break;
      size -= 2;
    } while (true);
    const titleY =
      layout === "hero"
        ? 146 + (design.imageHeight || 350)
        : layout === "poster"
          ? 155
          : 154;
    const titleBottom = titleY + title.length * size * 1.28;
    const bodyY = titleBottom + 32;
    const bottom = layout === "poster" ? 810 : 889;
    return {
      width,
      size,
      title,
      titleY,
      bodyY,
      bodySize: layout === "split" ? 23 : 25,
      lineHeight: 39,
      maxLines: Math.max(1, Math.floor((bottom - bodyY) / 39)),
    };
  }
  function fitDocument(ctx, document) {
    const doc = clone(document);
    const result = [];
    for (const original of doc.pages) {
      let remaining = original.body,
        continuation = 0;
      do {
        const page = {
          ...original,
          id: continuation
            ? `${original.id}-continued-${continuation}`
            : original.id,
        };
        if (continuation) {
          page.layout = "editorial";
          page.image = null;
          page.label = "CONTINUED";
        }
        const m = metrics(ctx, page, doc.theme);
        font(ctx, m.bodySize);
        const lines = wrap(ctx, remaining, m.width);
        if (lines.length <= m.maxLines) {
          page.body = remaining;
          remaining = "";
        } else {
          const visible = lines.slice(0, m.maxLines);
          let chars = visible.join("").length;
          let offset = 0,
            consumed = 0;
          while (offset < remaining.length && consumed < chars) {
            if (remaining[offset] !== "\n") consumed++;
            offset++;
          }
          page.body = remaining.slice(0, offset);
          remaining = remaining.slice(offset).replace(/^\n+/, "");
          if (!offset) throw new Error("内容无法分页，请缩短本页标题后重试。");
        }
        result.push(page);
        continuation++;
        if (result.length > 60)
          throw new Error("内容超过 60 页，请分成几篇制作。");
      } while (remaining);
    }
    doc.pages = result;
    return doc;
  }
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function ellipse(ctx, x, y, rx, ry, color, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    ctx.scale(rx, ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  function artwork(ctx, box, theme, seed) {
    const { x, y, w, h } = box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    rect(ctx, x, y, w, h, theme.wash);
    ellipse(ctx, x + w * 0.77, y + h * 0.2, w * 0.19, w * 0.19, "#d8b17e");
    rect(ctx, x, y + h * 0.72, w, h * 0.28, "#b3bda6");
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 8; i++)
      rect(ctx, x + w * (0.03 + i * 0.16), y, w * 0.014, h, "#fffdf2");
    ctx.globalAlpha = 1;
    if (seed >= 3) {
      ellipse(
        ctx,
        x + w * 0.35,
        y + h * 0.61,
        w * 0.26,
        h * 0.37,
        theme.accent,
        -0.25,
      );
      ellipse(
        ctx,
        x + w * 0.68,
        y + h * 0.65,
        w * 0.2,
        h * 0.28,
        theme.paper,
        0.4,
      );
      rect(ctx, x + w * 0.2, y + h * 0.22, 2, h * 0.6, theme.ink);
    } else if (seed % 3 === 1) {
      rect(ctx, x + w * 0.42, y + h * 0.5, w * 0.18, h * 0.36, "#bf745b");
      for (let i = 0; i < 7; i++) {
        const angle = i % 2 ? -0.65 : 0.65;
        const px = x + w * (0.5 + (i % 2 ? -0.1 : 0.1));
        const py = y + h * (0.15 + i * 0.055);
        ellipse(
          ctx,
          px,
          py,
          w * 0.115,
          h * 0.055,
          i % 2 ? "#46684b" : "#718c67",
          angle,
        );
      }
      rect(ctx, x + w * 0.5, y + h * 0.15, 3, h * 0.45, "#46684b");
    } else {
      ellipse(ctx, x + w * 0.48, y + h * 0.8, w * 0.28, h * 0.1, "#939c85");
      ellipse(ctx, x + w * 0.48, y + h * 0.74, w * 0.27, h * 0.1, "#eee9da");
      ctx.strokeStyle = "#faf5e9";
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(x + w * 0.66, y + h * 0.57, w * 0.075, 0, Math.PI * 2);
      ctx.stroke();
      rect(ctx, x + w * 0.31, y + h * 0.42, w * 0.32, h * 0.27, "#fffaf0");
      ellipse(ctx, x + w * 0.47, y + h * 0.68, w * 0.16, h * 0.055, "#fffaf0");
      ellipse(ctx, x + w * 0.47, y + h * 0.42, w * 0.16, h * 0.055, "#e8ddc9");
      ellipse(ctx, x + w * 0.47, y + h * 0.42, w * 0.125, h * 0.036, "#725240");
    }
    ctx.restore();
  }
  function coverImage(ctx, image, box, focal) {
    const iw = image.naturalWidth || image.width,
      ih = image.naturalHeight || image.height;
    if (!iw || !ih) throw new Error("图片尺寸无效，请换一张图片。");
    const scale = Math.max(box.w / iw, box.h / ih);
    const sw = box.w / scale,
      sh = box.h / scale;
    const fx = focal && focal.x !== undefined ? focal.x : 0.5,
      fy = focal && focal.y !== undefined ? focal.y : 0.5;
    const sx = Math.max(0, Math.min(iw - sw, iw * fx - sw / 2));
    const sy = Math.max(0, Math.min(ih - sh, ih * fy - sh / 2));
    ctx.drawImage(image, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
  }
  function draw(ctx, doc, index, loadedImage) {
    const page = doc.pages[index],
      t = doc.theme,
      m = metrics(ctx, page, t);
    if (!page) throw new Error("找不到这一页。");
    ctx.save();
    ctx.textBaseline = "top";
    rect(ctx, 0, 0, SIZE.width, SIZE.height, t.paper);
    font(ctx, 15, 500);
    ctx.fillStyle = t.muted;
    ctx.fillText("INKMUSE  /  " + page.label, 64, 38);
    rect(ctx, 64, 74, 622, 1, t.muted);
    let box;
    if (page.layout === "hero")
      box = { x: 64, y: 104, w: 622, h: page.design?.imageHeight || 350 };
    if (page.layout === "split") {
      const w = page.design?.imageWidth || 314;
      box = { x: 750 - w, y: 134, w, h: 735 };
    }
    if (page.layout === "editorial" && page.image)
      box = { x: 498, y: 95, w: 188, h: 56 };
    if (box) {
      if (page.image && loadedImage)
        coverImage(ctx, loadedImage, box, page.image.focal);
      else if (page.image) {
        rect(ctx, box.x, box.y, box.w, box.h, t.wash);
        font(ctx, 17);
        ctx.fillStyle = t.ink;
        ctx.fillText("图片未载入，请重试", box.x + 16, box.y + 24);
      } else artwork(ctx, box, t, page.artwork);
    }
    if (page.layout === "poster") {
      rect(ctx, 64, 112, 45, 5, t.accent);
      ellipse(ctx, 598, 845, 75, 75, t.wash);
      ellipse(ctx, 628, 825, 43, 43, t.accent);
      font(ctx, 150, 400, true);
      ctx.fillStyle = t.wash;
      ctx.fillText("”", 542, 84);
    }
    font(ctx, m.size, 600, t.serif);
    ctx.fillStyle = t.ink;
    m.title.forEach((line, i) =>
      ctx.fillText(line, 64, m.titleY + i * m.size * 1.28),
    );
    font(ctx, m.bodySize);
    ctx.fillStyle = t.ink;
    const lines = wrap(ctx, page.body, m.width);
    lines.forEach((line, i) =>
      ctx.fillText(line, 64, m.bodyY + i * m.lineHeight),
    );
    rect(ctx, 64, 925, 622, 1, t.muted);
    font(ctx, 15, 500);
    ctx.fillStyle = t.muted;
    const credit = page.image
      ? page.image.kind === "generated"
        ? "AI 生成配图"
        : page.image.credit || "自有配图"
      : "INKMUSE ORIGINAL ART";
    ctx.fillText(Array.from(credit).slice(0, 42).join(""), 64, 948);
    ctx.textAlign = "right";
    ctx.fillText(
      `${String(index + 1).padStart(2, "0")} / ${String(doc.pages.length).padStart(2, "0")}`,
      686,
      948,
    );
    ctx.restore();
    return {
      overflow: lines.length > m.maxLines,
      lines: lines.length,
      maxLines: m.maxLines,
    };
  }
  function attribution(doc) {
    return doc.pages
      .map(
        (p, i) =>
          `${i + 1}. ${p.title}\n${p.image ? `${p.image.credit || "User supplied"}\n${p.image.license || ""}\n${p.image.source || ""}\n${p.image.kind === "generated" ? "AI-generated illustration" : "Image may be cropped to fit the layout."}` : "Original procedural illustration by InkMuse."}`,
      )
      .join("\n\n");
  }
  function validateImport(doc) {
    if (
      !doc ||
      doc.version !== 1 ||
      !Array.isArray(doc.pages) ||
      !doc.pages.length ||
      doc.pages.length > 60
    )
      throw new Error("不是有效的 InkMuse 草稿。");
    if (
      doc.pages.some(
        (p) =>
          typeof p.title !== "string" ||
          typeof p.body !== "string" ||
          p.body.length > 12000,
      )
    )
      throw new Error("草稿页面格式不正确。");
    doc.theme = themeFor(doc.mood, doc.theme);
    for (const p of doc.pages) {
      if (!["hero", "split", "editorial", "poster"].includes(p.layout))
        p.layout = "editorial";
      if (
        p.image &&
        !/^(\/assets\/[a-f0-9]+\.(png|jpg|webp)|data:image\/(png|jpeg|webp);base64,)/.test(
          p.image.url || "",
        )
      )
        throw new Error("草稿图片地址无效，请重新选择图片。");
      if (p.design)
        p.design = {
          imageHeight: Math.max(
            240,
            Math.min(420, Number(p.design.imageHeight) || 350),
          ),
          titleSize: Math.max(
            40,
            Math.min(76, Number(p.design.titleSize) || 58),
          ),
          imageWidth: Math.max(
            230,
            Math.min(340, Number(p.design.imageWidth) || 314),
          ),
        };
    }
    return doc;
  }
  return {
    SIZE,
    THEMES,
    SAMPLES,
    clone,
    normalize,
    sample,
    themeFor,
    fitDocument,
    draw,
    wrap,
    attribution,
    validateImport,
    contrast,
  };
});
