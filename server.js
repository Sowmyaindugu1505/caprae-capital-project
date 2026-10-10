
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { analyze } = require('./scoring');
const { researchWebsite } = require('./websiteResearch');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

// Send JSON responses
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  });

  res.end(JSON.stringify(data));
}

// Read JSON request bodies
function readJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let finished = false;

    req.on('data', chunk => {
      if (finished) return;

      size += chunk.length;

      if (size > 2_000_000) {
        finished = true;
        reject(new Error('Request body is too large.'));
        req.resume();
        return;
      }

      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (finished) return;

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', reject);
  });
}

// Main server
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  let url;

  try {
    url = new URL(req.url, `http://${HOST}:${PORT}`);
  } catch {
    return sendJSON(res, 400, {
      error: 'Invalid request URL.'
    });
  }

  // Existing company analysis API
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    try {
      const parsed = await readJSON(req);

      if (
        !parsed ||
        !parsed.base ||
        !parsed.base.name ||
        !parsed.base.product ||
        !Array.isArray(parsed.targets) ||
        parsed.targets.length > 2000
      ) {
        throw new Error(
          'Provide a base company with a product and up to 2,000 target companies.'
        );
      }

      const result = analyze(parsed.base, parsed.targets);

      return sendJSON(res, 200, result);
    } catch (error) {
      return sendJSON(res, 400, {
        error: error.message
      });
    }
  }

  // NEW: Website research API
  if (req.method === 'POST' && url.pathname === '/api/research') {
    try {
      const parsed = await readJSON(req);

      if (
        !parsed ||
        typeof parsed.website !== 'string' ||
        !parsed.website.trim()
      ) {
        return sendJSON(res, 400, {
          error: 'Please provide a website URL.'
        });
      }

      if (parsed.website.length > 2048) {
        return sendJSON(res, 400, {
          error: 'Website URL is too long.'
        });
      }

      console.log('Researching website:', parsed.website);

      const result = await researchWebsite(parsed.website);

      if (result.status === 'Failed') {
        return sendJSON(res, 400, result);
      }

      console.log('Research successful:', result.companyName);

      return sendJSON(res, 200, result);
    } catch (error) {
      return sendJSON(res, 400, {
        error: error.message
      });
    }
  }

  // Serve dashboard files
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  let name;

  try {
    name = url.pathname === '/'
      ? 'index.html'
      : decodeURIComponent(url.pathname.slice(1));
  } catch {
    res.writeHead(400);
    return res.end('Invalid file path');
  }

  const filepath = path.resolve(ROOT, name);

  if (
    !filepath.startsWith(ROOT + path.sep) &&
    filepath !== path.join(ROOT, 'index.html')
  ) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filepath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end('Not found');
    }

    res.writeHead(200, {
      'Content-Type':
        MIME[path.extname(filepath)] ||
        'application/octet-stream'
    });

    res.end(data);
  });
});

// Start the server only when this file is run directly
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(
      `Synergy Intelligence at http://${HOST}:${PORT}`
    );
  });
}

module.exports = server;
