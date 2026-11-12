import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  pruefeGrundform, leseModul, ladeModulAusUrl, ladeModulAusDatei, modulUebersicht, ModulFehler,
} from '../src/engine/m1-kern.js';

const gueltig = () => ({
  format: 1, meta: { id: 'x', titel: 'X', sprache: 'de', version: '1', stand: '2026-11-12' }, themen: [], fragen: [],
});

test('gültiges Modul hat keine Fehler', () => {
  assert.deepEqual(pruefeGrundform(gueltig()), []);
});

test('Grundform: fehlende Teile werden einzeln gemeldet', () => {
  assert.deepEqual(pruefeGrundform(null), ['modul.keinObjekt']);
  assert.deepEqual(pruefeGrundform([]), ['modul.keinObjekt']);
  assert.deepEqual(pruefeGrundform({}), [
    'modul.formatVersion', 'modul.metaFehlt', 'modul.themenFehlen', 'modul.fragenFehlen',
  ]);
  assert.deepEqual(pruefeGrundform({ ...gueltig(), meta: { id: ' ', titel: '' } }), [
    'modul.idFehlt', 'modul.titelFehlt',
  ]);
  assert.deepEqual(pruefeGrundform({ ...gueltig(), format: 2 }), ['modul.formatVersion']);
});

test('leseModul: kaputtes JSON wirft ModulFehler mit Code', () => {
  assert.throws(() => leseModul('{ nicht json', 'a.json'), (e) =>
    e instanceof ModulFehler && e.code === 'modul.keinJson' && e.details.quelle === 'a.json');
});

test('leseModul: ungültiges Modul listet die Fehler', () => {
  assert.throws(() => leseModul('{"format":1}'), (e) =>
    e.code === 'modul.ungueltig' && e.details.fehler.some((f) => f.code === 'modul.metaFehlt'));
});

test('ladeModulAusUrl lädt über die übergebene fetch-Funktion', async () => {
  const holen = async (url) => ({ ok: true, status: 200, text: async () => JSON.stringify(gueltig()), url });
  const modul = await ladeModulAusUrl('content/x.json', holen);
  assert.equal(modul.meta.id, 'x');
});

test('ladeModulAusUrl meldet HTTP-Fehler und Netzfehler', async () => {
  await assert.rejects(ladeModulAusUrl('a', async () => ({ ok: false, status: 404 })),
    (e) => e.code === 'modul.nichtErreichbar' && e.details.meldung === 'HTTP 404');
  await assert.rejects(ladeModulAusUrl('a', async () => { throw new Error('offline'); }),
    (e) => e.code === 'modul.nichtErreichbar' && e.details.meldung === 'offline');
});

test('ladeModulAusDatei liest eine gewählte Datei (F-01)', async () => {
  const datei = new File([JSON.stringify(gueltig())], 'mein-modul.json', { type: 'application/json' });
  const modul = await ladeModulAusDatei(datei);
  assert.equal(modul.meta.titel, 'X');
});

test('das mitgelieferte Beispielmodul ist gültig', async () => {
  const text = await readFile(new URL('../content/beispiel/beispiel.json', import.meta.url), 'utf8');
  const u = modulUebersicht(leseModul(text));
  assert.equal(u.id, 'beispiel');
  assert.equal(u.themen, 1);
  assert.equal(u.fragen, 2);
});
