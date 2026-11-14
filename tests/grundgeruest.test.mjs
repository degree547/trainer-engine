// Prüft das PWA-Grundgerüst: Texte, Service-Worker-Liste, relative Pfade, Testserver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fuelle, waehleSprache } from '../src/ui/i18n.js';
import { pfadZuDatei } from '../tools/serve.mjs';

const lies = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), 'utf8');

test('de.json und en.json haben dieselben Schlüssel', async () => {
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const en = JSON.parse(await lies('src/i18n/en.json'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
});

test('jeder Fehlercode aus M1 und M8 hat einen Text', async () => {
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const quelltext = (await lies('src/engine/m1-kern.js')) + (await lies('src/engine/m8-inhaltsformat.js'));
  const codes = new Set(quelltext.match(/'(modul|inhalt|json)\.\w+'/g).map((c) => c.slice(1, -1)));
  assert.ok(codes.size > 20);
  for (const code of codes) assert.ok(code in de, `Text fehlt für ${code}`);
});

test('jeder Speicher-Code aus M7 und app.js hat einen Text', async () => {
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const quelltext = (await lies('src/engine/m7-speicherung.js')) + (await lies('src/engine/m4-gamification.js')) + (await lies('src/app.js'));
  const codes = new Set(quelltext.match(/'speicher\.\w+'/g).map((c) => c.slice(1, -1)));
  assert.ok(codes.size >= 6);
  for (const code of codes) assert.ok(code in de, `Text fehlt für ${code}`);
});

test('Platzhalter und Sprachwahl', () => {
  assert.equal(fuelle('Datei: {name}', { name: 'a.json' }), 'Datei: a.json');
  assert.equal(fuelle('{unbekannt}', {}), '{unbekannt}');
  assert.equal(waehleSprache('en'), 'en');
  assert.equal(waehleSprache('fr'), 'de');
});

test('alle Dateien im Service-Worker-Cache existieren', async () => {
  const sw = await lies('sw.js');
  const liste = sw.match(/const DATEIEN = \[([\s\S]*?)\];/)[1];
  const dateien = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((d) => d !== './');
  assert.ok(dateien.length > 5);
  for (const datei of dateien) await access(new URL(`../${datei}`, import.meta.url));
});

test('alle JS-Dateien der App stehen im Service-Worker-Cache', async () => {
  const sw = await lies('sw.js');
  for (const datei of ['src/app.js', 'src/engine/m1-kern.js', 'src/engine/m2-lernlogik.js', 'src/engine/m3-fragetypen.js', 'src/engine/m4-gamification.js', 'src/engine/m5-statistik.js', 'src/engine/m7-speicherung.js', 'src/engine/m8-inhaltsformat.js',
    'src/ui/dom.js', 'src/ui/i18n.js', 'src/ui/start.js', 'src/ui/runde.js', 'src/ui/fortschritt.js', 'src/ui/statistik.js', 'content/sks/sks.json']) {
    assert.ok(sw.includes(`'${datei}'`), `${datei} fehlt in sw.js`);
  }
});

test('Pfade in index.html und Manifest sind relativ (GitHub Pages unter /trainer-engine/)', async () => {
  const html = await lies('index.html');
  for (const [, pfad] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.ok(!pfad.startsWith('/') && !/^https?:/.test(pfad), `nicht relativ: ${pfad}`);
  }
  const manifest = JSON.parse(await lies('manifest.webmanifest'));
  for (const pfad of [manifest.start_url, manifest.scope, ...manifest.icons.map((i) => i.src)]) {
    assert.ok(!pfad.startsWith('/'), `nicht relativ: ${pfad}`);
  }
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
});

test('.gitignore enthält die Pflichteinträge', async () => {
  const zeilen = (await lies('.gitignore')).split(/\r?\n/);
  for (const e of ['privat/', 'node_modules/', '.DS_Store', 'Thumbs.db']) assert.ok(zeilen.includes(e), e);
});

test('Testserver liefert nichts aus privat/ und nichts außerhalb des Projekts', () => {
  assert.ok(pfadZuDatei('/trainer-engine/index.html'));
  assert.ok(pfadZuDatei('/trainer-engine/').endsWith('index.html'));
  assert.equal(pfadZuDatei('/trainer-engine/privat/buch.json'), null);
  assert.equal(pfadZuDatei('/trainer-engine/../geheim.txt'), null);
  assert.equal(pfadZuDatei('/trainer-engine/%2e%2e/geheim.txt'), null);
  assert.equal(pfadZuDatei('/anderes/index.html'), null);
});

test('jeder Text, den die Bildschirme verwenden, steht in de.json', async () => {
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const quelltext = (await lies('src/app.js')) + (await lies('src/ui/start.js')) + (await lies('src/ui/runde.js'));
  const schluessel = new Set([...quelltext.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]));
  for (const modus of ['normal', 'vorziehen', 'fehler']) schluessel.add(`runde.titel.${modus}`);
  assert.ok(schluessel.size > 20);
  for (const s of schluessel) assert.ok(s in de, `Text fehlt für ${s}`);
});

test('jeder Hinweis aus M4 hat Texte für Einzahl und Mehrzahl', async () => {
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const quelltext = await lies('src/engine/m4-gamification.js');
  const codes = new Set(quelltext.match(/'hinweis\.\w+'/g).map((c) => c.slice(1, -1)));
  assert.ok(codes.size >= 5);
  for (const code of codes) for (const form of ['eins', 'mehr']) assert.ok(`${code}.${form}` in de, `Text fehlt für ${code}.${form}`);
});
