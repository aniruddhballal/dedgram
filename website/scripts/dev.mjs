import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputRoot = join(websiteRoot, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

const build = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: websiteRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

build.on('error', (error) => {
  console.error(`Could not start the website build: ${error.message}`);
  process.exitCode = 1;
});

build.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`Website build failed${signal ? ` with ${signal}` : ''}.`);
    process.exitCode = code || 1;
    return;
  }
  startServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
});

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = resolve(outputRoot, normalize(relative));
  if (candidate !== outputRoot && !candidate.startsWith(`${outputRoot}\\`)) return null;
  try {
    if ((await stat(candidate)).isFile()) return candidate;
  } catch {}
  if (!extname(candidate)) {
    const indexFile = join(candidate, 'index.html');
    try {
      if ((await stat(indexFile)).isFile()) return indexFile;
    } catch {}
  }
  return null;
}

async function startServer() {
  await access(outputRoot);
  const server = createServer(async (request, response) => {
    try {
      const file = await resolveFile(request.url || '/');
      if (!file) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream' });
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Internal server error');
      console.error(error);
    }
  });

  server.listen(port, host, () => {
    console.log(`Website running at http://${host}:${port}`);
    console.log('Press Ctrl+C to stop.');
  });
}
