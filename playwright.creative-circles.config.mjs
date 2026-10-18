import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['creative-circle-visibility.spec.mjs', 'creative-dev-default-renderer.spec.mjs', 'creative-wayfarer-reference.spec.mjs'],
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    browserName: 'chromium',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
    baseURL: 'http://127.0.0.1:4186',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/helpers/creative-circle-server.mjs',
    url: 'http://127.0.0.1:4186/creative/index.html',
    reuseExistingServer: !process.env.CI
  }
});
