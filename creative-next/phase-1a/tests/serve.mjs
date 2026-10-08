import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

export function createTestServer() {
  return http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !mime[path.extname(target)]) {
        response.writeHead(403); response.end('Forbidden'); return;
      }
      const data = await readFile(target);
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-store' });
      response.end(data);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createTestServer();
  server.listen(Number(process.env.PORT || 4178), '127.0.0.1', () => {
    console.log(`Phase 1-A memory-only test: http://127.0.0.1:${server.address().port}/`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
