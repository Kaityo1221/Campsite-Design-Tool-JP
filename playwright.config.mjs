import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 7000 },
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['iPhone 15'],
    browserName: 'webkit',
    locale: 'ja-JP',
    permissions: ['geolocation'],
    geolocation: { latitude: 35.6812, longitude: 139.7671 },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/field-mode.html',
    reuseExistingServer: true,
    timeout: 15000
  }
});
