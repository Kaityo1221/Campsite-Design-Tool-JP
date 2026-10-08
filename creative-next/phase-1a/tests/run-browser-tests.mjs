import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import config from './playwright.config.mjs';
import { createTestServer } from './serve.mjs';
import { runIsolationSuite } from './isolation.spec.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('='); return [arg.slice(2, index), arg.slice(index + 1)];
}));
if (!options['playwright-module']) throw new Error('Specify --playwright-module=/absolute/path/to/playwright/index.mjs');
const playwright = await import(pathToFileURL(path.resolve(options['playwright-module'])).href);
const outputDirectory = fileURLToPath(new URL('../test-results/', import.meta.url));
await mkdir(outputDirectory, { recursive: true });
const server = createTestServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}/`, results = [];
try {
  for (const engine of config.engines) {
    let browser;
    try {
      const launch = { headless: true };
      if (engine === 'chromium' && options['chromium-channel']) launch.channel = options['chromium-channel'];
      if (engine === 'webkit' && options['webkit-executable']) launch.executablePath = path.resolve(options['webkit-executable']);
      browser = await playwright[engine].launch(launch);
      results.push(await runIsolationSuite(browser, baseURL, config, engine));
      console.log(`${engine}: browser interaction and isolation PASS`);
    } catch (error) {
      results.push({ engine, passed: false, error: error.stack });
      console.error(`${engine}: FAIL\n${error.stack}`);
      process.exitCode = 1;
    } finally { await browser?.close(); }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(outputDirectory, 'browser-results.json'), JSON.stringify({ kind: 'automated browser; not real iPhone Safari or KMZ roundtrip', results }, null, 2));
}
