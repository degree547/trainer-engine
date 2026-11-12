// Lokaler Testserver (nur node:http, keine Pakete).
// Bildet GitHub Pages nach: die App liegt unter /trainer-engine/.
// Start:  node tools/serve.mjs   →   http://localhost:8080/trainer-engine/

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRAEFIX = '/trainer-engine/';
const PORT = Number(process.env.PORT) || 8080;

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Nie ausliefern: private Buchinhalte und Git-Interna.
const GESPERRT = [/^privat(\/|$)/, /^\.git(\/|$)/, /^node_modules(\/|$)/];

export function pfadZuDatei(urlPfad) {
  if (!urlPfad.startsWith(PRAEFIX)) return null;
  let relativ = decodeURIComponent(urlPfad.slice(PRAEFIX.length));
  if (relativ === '' || relativ.endsWith('/')) relativ += 'index.html';
  const sauber = normalize(relativ).replaceAll('\\', '/');
  if (sauber.startsWith('..') || GESPERRT.some((r) => r.test(sauber))) return null;
  const voll = join(WURZEL, sauber);
  if (voll !== WURZEL && !voll.startsWith(WURZEL + sep)) return null;
  return voll;
}

const server = http.createServer(async (anfrage, antwort) => {
  const urlPfad = new URL(anfrage.url, 'http://localhost').pathname;
  if (urlPfad === '/' || urlPfad === '/trainer-engine') {
    antwort.writeHead(302, { Location: PRAEFIX });
    return antwort.end();
  }
  const datei = pfadZuDatei(urlPfad);
  try {
    if (!datei || !(await stat(datei)).isFile()) throw new Error('nicht gefunden');
    const inhalt = await readFile(datei);
    antwort.writeHead(200, {
      'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    antwort.end(inhalt);
  } catch {
    antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    antwort.end('404 – nicht gefunden');
  }
  console.log(`${antwort.statusCode} ${urlPfad}`);
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Trainer Engine läuft auf http://localhost:${PORT}${PRAEFIX}`);
  });
}
