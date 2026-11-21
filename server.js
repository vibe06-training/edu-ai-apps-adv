const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, resolve, sep } = require('node:path');
const generate = require('./api/generate.js');

const PORT = 3000;
const publicDir = resolve(__dirname, 'public');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

async function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const filePath = resolve(join(publicDir, pathname === '/' ? 'index.html' : pathname));
  if (!filePath.startsWith(publicDir + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('찾을 수 없습니다.');
  }
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/api/generate') {
    generate(req, res);
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res);
  } else {
    res.writeHead(405).end();
  }
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
