// Prüft M8: JSON mit Zeilenangaben lesen und das Inhaltsformat prüfen (F-24, F-25, F-26, F-32).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leseJsonMitZeilen, pruefeModul, lesePruefe, JsonFehler } from '../src/engine/m8-inhaltsformat.js';
import { leseModul, ModulFehler } from '../src/engine/m1-kern.js';

const freitext = (nr, extra = {}) => ({
  id: `t-${nr}`, thema: 't-a', typ: 'freitext', frage: 'Frage?', musterantwort: 'Antwort.',
  kernpunkte: ['Punkt'], kernpunkteStatus: 'ungeprueft', herkunft: 'amtlich',
  erklaerung: '', quelle: 'Quelle', ...extra,
});
const mc = (nr, extra = {}) => ({
  id: `t-${nr}`, thema: 't-a', typ: 'mc', frage: 'Frage?', optionen: ['a', 'b'], richtig: 1,
  erklaerung: 'weil', quelle: 'eigen', ...extra,
});
const modul = (fragen = [freitext(1), mc(2)], extra = {}) => ({
  format: 1,
  meta: { id: 't', titel: 'Test', sprache: 'de', version: '1', stand: '2026-11-12' },
  themen: [{ id: 't-a', titel: 'A' }],
  fragen,
  ...extra,
});
const codes = (fehler) => fehler.map((f) => f.code);

test('JSON-Leser liefert dasselbe Ergebnis wie JSON.parse', () => {
  const text = JSON.stringify({ a: [1, -2.5e3, true, false, null, 'x\n"y" ä \\'], b: { c: {} }, d: [] }, null, 2);
  assert.deepEqual(leseJsonMitZeilen(text).daten, JSON.parse(text));
  assert.deepEqual(leseJsonMitZeilen('﻿{"a":1}').daten, { a: 1 });
});

test('JSON-Leser merkt sich die Zeile jedes Werts', () => {
  const text = '{\n  "fragen": [\n    {\n      "id": "x",\n      "typ": "mc"\n    }\n  ]\n}';
  const { zeilen } = leseJsonMitZeilen(text);
  assert.equal(zeilen.get('fragen'), 2);
  assert.equal(zeilen.get('fragen.0'), 3);
  assert.equal(zeilen.get('fragen.0.typ'), 5);
});

test('JSON-Syntaxfehler nennen Zeile, Spalte und Code (F-26)', () => {
  const fall = (text, code, zeile) => assert.throws(() => leseJsonMitZeilen(text), (e) =>
    e instanceof JsonFehler && e.code === code && e.zeile === zeile);
  fall('{\n  "a": 1\n  "b": 2\n}', 'json.kommaFehlt', 3);
  fall('{\n  "a" 1\n}', 'json.erwartet', 2);
  fall('{\n  "a": [1, 2\n', 'json.unerwartetesEnde', 3);
  fall('{\n  "a": 1,\n  "a": 2\n}', 'json.doppelterSchluessel', 3);
  fall('{"a": "x\ny"}', 'json.steuerzeichen', 1);
  fall('{"a": 01}', 'json.kommaFehlt', 1);
  fall('{"a": 1} x', 'json.restText', 1);
  fall('{a: 1}', 'json.schluesselErwartet', 1);
  fall('{"a": wahr}', 'json.unerwartetesZeichen', 1);
});

test('gültiges Modul mit Freitext- und MC-Frage hat keine Fehler', () => {
  assert.deepEqual(pruefeModul(modul()), []);
});

test('Metadaten werden geprüft (F-24)', () => {
  const m = modul();
  m.meta = { id: 'Mit Leerzeichen', titel: '', version: '1', stand: '12.11.2026', herkunft: 'irgendwo' };
  assert.deepEqual(codes(pruefeModul(m)), [
    'inhalt.idUngueltig', 'modul.titelFehlt', 'inhalt.keinText', 'inhalt.datumUngueltig', 'inhalt.wertNichtErlaubt',
  ]);
  assert.deepEqual(codes(pruefeModul({ format: 2, themen: {}, fragen: null })), [
    'modul.formatVersion', 'modul.metaFehlt', 'modul.themenFehlen', 'modul.fragenFehlen',
  ]);
  assert.deepEqual(codes(pruefeModul([])), ['modul.keinObjekt']);
});

test('jede Frage braucht ID, Thema, Typ, Frage, Erklärung und Quelle (F-25)', () => {
  const ohne = (feld) => { const f = mc(1); delete f[feld]; return codes(pruefeModul(modul([f]))); };
  for (const feld of ['id', 'thema', 'typ', 'frage', 'erklaerung', 'quelle']) {
    assert.ok(ohne(feld).includes('inhalt.feldFehlt'), feld);
  }
  // Erklärung darf leer sein, muss aber ein Text sein
  assert.deepEqual(pruefeModul(modul([mc(1, { erklaerung: '' })])), []);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { erklaerung: 3 })]))), ['inhalt.keinTextLeerErlaubt']);
});

test('Freitextfragen brauchen Musterantwort, Kernpunkte, Herkunft und Quelle (F-32)', () => {
  const ohne = (feld) => { const f = freitext(1); delete f[feld]; return codes(pruefeModul(modul([f]))); };
  for (const feld of ['musterantwort', 'kernpunkte', 'kernpunkteStatus', 'herkunft', 'quelle']) {
    assert.deepEqual(ohne(feld), ['inhalt.feldFehlt'], feld);
  }
  assert.deepEqual(codes(pruefeModul(modul([freitext(1, { kernpunkte: [] })]))), ['inhalt.zuWenige']);
  assert.deepEqual(codes(pruefeModul(modul([freitext(1, { kernpunkte: ['ok', ' '] })]))), ['inhalt.eintragKeinText']);
  assert.deepEqual(codes(pruefeModul(modul([freitext(1, { herkunft: 'internet' })]))), ['inhalt.wertNichtErlaubt']);
  assert.deepEqual(codes(pruefeModul(modul([freitext(1, { kernpunkteStatus: 'ok' })]))), ['inhalt.wertNichtErlaubt']);
});

test('MC-Fragen: Optionen und richtige Antwort', () => {
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { optionen: ['nur eine'], richtig: 0 })]))), ['inhalt.zuWenige']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { richtig: 2 })]))), ['inhalt.richtigAusserhalb']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { richtig: '1' })]))), ['inhalt.richtigAusserhalb']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { optionen: 'a,b' })]))), ['inhalt.keineListe', 'inhalt.richtigAusserhalb']);
});

test('MC-Fragen: optional "mischen" (true/false) und "herkunft"', () => {
  assert.deepEqual(pruefeModul(modul([mc(1, { mischen: false, herkunft: 'amtlich' }), mc(2, { mischen: true })])), []);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { mischen: 'nein' })]))), ['inhalt.keinWahrheitswert']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { herkunft: 'internet' })]))), ['inhalt.wertNichtErlaubt']);
});

test('IDs: Format, eindeutig, mit Präfix der Modul-ID; Thema muss existieren', () => {
  assert.deepEqual(codes(pruefeModul(modul([mc(1), mc(1)]))), ['inhalt.idDoppelt']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { id: 'anders-1' })]))), ['inhalt.idPraefix']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { id: 't_1' })]))), ['inhalt.idUngueltig']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { thema: 'gibt-es-nicht' })]))), ['inhalt.themaUnbekannt']);
  assert.deepEqual(codes(pruefeModul(modul([mc(1, { typ: 'lückentext' })]))), ['inhalt.typUnbekannt']);
  const doppeltesThema = modul();
  doppeltesThema.themen.push({ id: 't-a', titel: 'B' });
  assert.deepEqual(codes(pruefeModul(doppeltesThema)), ['inhalt.idDoppelt']);
});

test('Formatfehler nennen Zeile und Ort der Frage (F-26)', () => {
  const m = modul([freitext(1), freitext(2, { kernpunkte: undefined })]);
  const text = JSON.stringify(m, null, 2);
  const { fehler } = lesePruefe(text);
  assert.equal(fehler.length, 1);
  const [f] = fehler;
  assert.equal(f.code, 'inhalt.feldFehlt');
  assert.deepEqual(f.ort, { art: 'frage', nr: 2, id: 't-2' });
  // Fehlt das Feld, zeigt die Meldung auf die Zeile mit der öffnenden Klammer der Frage
  // (die Zeile direkt vor "id": "t-2").
  const zeilen = text.split('\n');
  const idZeile = zeilen.findIndex((z) => z.includes('"id": "t-2"')) + 1; // 1-basiert
  assert.equal(zeilen[idZeile - 2].trim(), '{');
  assert.equal(f.zeile, idZeile - 1);
});

test('M1 lädt nur Module, die M8 für gültig hält', () => {
  assert.throws(() => leseModul(JSON.stringify(modul([freitext(1, { herkunft: 'x' })]))), (e) =>
    e instanceof ModulFehler && e.code === 'modul.ungueltig' && e.details.fehler[0].code === 'inhalt.wertNichtErlaubt');
  assert.throws(() => leseModul('{\n"format": 1,\n}'), (e) =>
    e.code === 'modul.keinJson' && e.details.zeile === 3 && e.details.fehler[0].code === 'json.schluesselErwartet');
  assert.equal(leseModul(JSON.stringify(modul())).meta.id, 't');
});
