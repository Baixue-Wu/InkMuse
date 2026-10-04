const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 40000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8792",
    viewport: { width: 1440, height: 1120 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "python3 -m server --config config.example.json --port 8792",
    url: "http://127.0.0.1:8792/api/status",
    reuseExistingServer: false,
  },
});
