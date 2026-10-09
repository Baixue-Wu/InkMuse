#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: node scripts/build.cjs [--out dist] [--demo] [--api-base URL] [--appid touristappid]\nBuilds web and native WeChat clients. --demo builds a browser-only sample editor without service calls.",
  );
} else {
  const value = (flag, fallback) =>
    args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  const root = path.resolve(__dirname, "..");
  const out = path.resolve(value("--out", path.join(root, "dist")));
  const config = require("../config.example.json");
  const apiBase = value("--api-base", `http://${config.host}:${config.port}`);
  if (!/^https?:\/\//.test(apiBase))
    throw new Error("--api-base must be an HTTP(S) URL");
  for (const target of ["web", "miniprogram"]) {
    const dest = path.join(out, target);
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(path.join(root, target), dest, { recursive: true });
    fs.cpSync(path.join(root, "core"), path.join(dest, "core"), {
      recursive: true,
    });
  }
  fs.mkdirSync(path.join(out, "web/vendor"), { recursive: true });
  fs.copyFileSync(
    require.resolve("jszip/dist/jszip.min.js"),
    path.join(out, "web/vendor/jszip.min.js"),
  );
  const core = fs.readFileSync(path.join(root, "core/design.js"));
  const manifest = {
    demo: args.includes("--demo"),
    version: require("../package.json").version,
    coreSha256: crypto.createHash("sha256").update(core).digest("hex"),
    apiBase,
  };
  fs.writeFileSync(path.join(out, "web/runtime.js"), `window.InkMuseBuild = ${JSON.stringify(manifest)};\n`);
  for (const target of ["web", "miniprogram"])
    fs.writeFileSync(
      path.join(out, target, "build.json"),
      JSON.stringify(manifest, null, 2),
    );
  fs.writeFileSync(
    path.join(out, "miniprogram/config.js"),
    `module.exports = ${JSON.stringify({ apiBase })};\n`,
  );
  fs.writeFileSync(
    path.join(out, "miniprogram/project.config.json"),
    JSON.stringify(
      {
        appid: value("--appid", "touristappid"),
        projectname: "InkMuse",
        compileType: "miniprogram",
        miniprogramRoot: "./",
        setting: { es6: true, minified: true, urlCheck: true },
        libVersion: "latest",
      },
      null,
      2,
    ),
  );
  console.log(
    `Built ${out}/web and ${out}/miniprogram (${manifest.coreSha256.slice(0, 12)}).`,
  );
}
