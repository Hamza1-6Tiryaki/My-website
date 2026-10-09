// Small Node server (no dependencies, requires Node 20.12+).
//  - Serves the static site (index.html, script.js, css/, img/)
//  - POST /api/translate -> proxies to Google Cloud Translation (v2), keeping the API key server-side
//
// Usage:  copy .env.example to .env, set GOOGLE_TRANSLATE_API_KEY, then run: npm start

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// Load .env if present (Node built-in)
try {
    process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
    // .env is optional; the variable can also come from the real environment
}

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const ROOT = __dirname;

const SOURCE_LANG = 'en';
const ALLOWED_TARGETS = new Set(['tr', 'de', 'ru']);
const MAX_TEXTS = 100;
const MAX_TEXT_LENGTH = 5000;
const MAX_BODY_BYTES = 100 * 1024;

// Files that must never be served to the browser
const BLOCKED_FILES = new Set(['server.js', 'package.json', 'package-lock.json']);
const BLOCKED_EXTENSIONS = new Set(['.php']);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

// Very small in-memory rate limiter (per IP) to protect the API quota
const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60 * 1000;
const hits = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.start > RATE_WINDOW_MS) {
        hits.set(ip, { start: now, count: 1 });
        return false;
    }
    entry.count += 1;
    return entry.count > RATE_LIMIT;
}

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

async function handleTranslate(req, res) {
    if (!API_KEY) {
        return sendJson(res, 500, { error: 'GOOGLE_TRANSLATE_API_KEY is not configured on the server.' });
    }
    if (isRateLimited(req.socket.remoteAddress)) {
        return sendJson(res, 429, { error: 'Too many requests. Please try again later.' });
    }

    let body;
    try {
        body = JSON.parse(await readBody(req));
    } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }

    const { texts, target } = body || {};
    const validTexts =
        Array.isArray(texts) &&
        texts.length > 0 &&
        texts.length <= MAX_TEXTS &&
        texts.every(t => typeof t === 'string' && t.length <= MAX_TEXT_LENGTH);

    if (!validTexts || !ALLOWED_TARGETS.has(target)) {
        return sendJson(res, 400, { error: 'Invalid "texts" or "target".' });
    }

    try {
        const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-goog-api-key': API_KEY
            },
            body: JSON.stringify({ q: texts, source: SOURCE_LANG, target, format: 'html' })
        });

        if (!response.ok) {
            console.error('Google Translate error:', response.status, await response.text());
            return sendJson(res, 502, { error: 'Translation service error.' });
        }

        const data = await response.json();
        const translations = data.data.translations.map(t => t.translatedText);
        return sendJson(res, 200, { translations });
    } catch (err) {
        console.error('Translate request failed:', err);
        return sendJson(res, 502, { error: 'Translation service unreachable.' });
    }
}

async function serveStatic(req, res) {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
        res.writeHead(400);
        return res.end('Bad request');
    }

    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const fullPath = path.resolve(ROOT, relative);
    const hasHiddenSegment = relative.split(/[\\/]/).some(segment => segment.startsWith('.'));

    if (
        !fullPath.startsWith(ROOT + path.sep) ||
        hasHiddenSegment ||
        BLOCKED_FILES.has(path.basename(fullPath)) ||
        BLOCKED_EXTENSIONS.has(path.extname(fullPath).toLowerCase())
    ) {
        res.writeHead(404);
        return res.end('Not found');
    }

    try {
        const file = await fs.readFile(fullPath);
        const type = MIME_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(file);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
}

const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    // '/translate.php' is the URL used in production (PHP); locally Node answers it
    if (pathname === '/translate.php' || pathname === '/api/translate') {
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            return sendJson(res, 405, { error: 'Method not allowed.' });
        }
        return handleTranslate(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        return res.end('Method not allowed');
    }
    return serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (!API_KEY) {
        console.warn('Warning: GOOGLE_TRANSLATE_API_KEY is not set. Translation requests will fail.');
    }
});
