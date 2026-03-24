import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function serveStatic(filePath, contentType, res) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

export async function startServer(sessionDir, port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/') {
        serveStatic(path.join(__dirname, 'index.html'), 'text/html', res);
      } else if (req.method === 'GET' && req.url === '/styles.css') {
        serveStatic(path.join(__dirname, 'styles.css'), 'text/css', res);
      } else if (req.method === 'GET' && req.url === '/api/draft') {
        serveStatic(path.join(sessionDir, 'current-draft.json'), 'application/json', res);
      } else if (req.method === 'POST' && req.url === '/api/annotate') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          fs.appendFileSync(
            path.join(sessionDir, 'annotations.jsonl'),
            body.trim() + '\n'
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      const info = { port: actualPort, url: `http://localhost:${actualPort}` };
      fs.writeFileSync(path.join(sessionDir, '.server-info'), JSON.stringify(info));
      resolve({ server, port: actualPort });
    });
  });
}

export async function stopServer({ server }) {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}

// CLI entry point
const isDirectRun = process.argv[1]
  && process.argv[1].endsWith('server.js')
  && process.argv.includes('--session-dir');

if (isDirectRun) {
  const args = process.argv.slice(2);
  const sessionDir = args[args.indexOf('--session-dir') + 1];
  const portArg = args.includes('--port')
    ? parseInt(args[args.indexOf('--port') + 1], 10)
    : 0;
  startServer(sessionDir, portArg).then(({ port }) => {
    console.log(JSON.stringify({
      type: 'server-started',
      port,
      url: `http://localhost:${port}`,
    }));
  });
}
