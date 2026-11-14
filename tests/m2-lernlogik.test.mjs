// Tests für M2 Lernlogik: Leitner-Fächer (F-03) und Rundenbildung (F-05).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ABSTAENDE, RUNDENGROESSE, datumVon, plusTage, neuerLernstand, bewerte, istFaellig,
  bildeRunde, bildeVorgezogeneRunde, lernUebersicht,
} from '../src/engine/m2-lernlogik.js';
import { leseModul } from '../src/engine/m1-kern.js';

const HEUTE = '2026-11-22';

// Kleines Testmodul: Thema b steht in "themen" vor a, die Fragen sind gemischt.
const frage = (id, thema) => ({ id, thema });
const modul = {
  themen: [{ id: 'x-b' }, { id: 'x-a' }],
  fragen: [frage('x-a-1', 'x-a'), frage('x-b-1', 'x-b'), frage('x-a-2', 'x-a'), frage('x-b-2', 'x-b')],
};
const ids = (fragen) => fragen.map((f) => f.id);
// Vergleich ohne den genauen Zeitstempel, der eigens geprüft wird.
// Nur Fach und Termine vergleichen; Zeitpunkt und Zähler prüfen eigene Tests.
const ohneZeit = ({ geaendert, richtig, falsch, ...karte }) => karte;

test('Datum: Ortszeit, Monats- und Jahreswechsel, Zeitumstellung', () => {
  assert.equal(datumVon(new Date(2026, 10, 22, 23, 59)), '2026-11-22');
  assert.equal(datumVon(new Date(2026, 10, 23, 0, 1)), '2026-11-23');
  assert.equal(plusTage('2026-11-30', 1), '2026-12-01');
  assert.equal(plusTage('2026-12-31', 1), '2027-01-01');
  assert.equal(plusTage('2027-03-27', 2), '2027-03-29'); // über die Umstellung auf Sommerzeit
  assert.equal(plusTage('2026-10-24', 2), '2026-10-26'); // über die Umstellung auf Winterzeit
  assert.equal(plusTage('2026-11-22', 0), '2026-11-22');
  assert.throws(() => plusTage('22.11.2026', 1));
});

test('Abstände je Fach: 1, 2, 4, 8, 16 Tage', () => {
  assert.deepEqual(ABSTAENDE, [1, 2, 4, 8, 16]);
  assert.equal(RUNDENGROESSE, 10);
});

test('F-03: richtig = ein Fach höher, Termin nach dem Abstand des neuen Fachs', () => {
  let ls = neuerLernstand();
  ls = bewerte(ls, 'x-a-1', true, HEUTE);
  assert.deepEqual(ohneZeit(ls.karten['x-a-1']), { fach: 2, faellig: '2026-11-24', zuletzt: HEUTE });
  ls = bewerte(ls, 'x-a-1', true, '2026-11-24');
  assert.deepEqual(ohneZeit(ls.karten['x-a-1']), { fach: 3, faellig: '2026-11-28', zuletzt: '2026-11-24' });
  ls = bewerte(ls, 'x-a-1', true, '2026-11-28');
  assert.equal(ls.karten['x-a-1'].fach, 4);
  assert.equal(ls.karten['x-a-1'].faellig, '2026-12-06');
  ls = bewerte(ls, 'x-a-1', true, '2026-12-06');
  assert.equal(ls.karten['x-a-1'].fach, 5);
  assert.equal(ls.karten['x-a-1'].faellig, '2026-12-22');
  // In Fach 5 bleibt die Frage, der Abstand bleibt 16 Tage.
  ls = bewerte(ls, 'x-a-1', true, '2026-12-22');
  assert.deepEqual(ohneZeit(ls.karten['x-a-1']), { fach: 5, faellig: '2027-01-07', zuletzt: '2026-12-22' });
});

test('F-03: falsch = zurück in Fach 1, spätestens am nächsten Tag wieder fällig', () => {
  let ls = neuerLernstand();
  ls = bewerte(ls, 'x-a-1', false, HEUTE);
  assert.deepEqual(ohneZeit(ls.karten['x-a-1']), { fach: 1, faellig: '2026-11-23', zuletzt: HEUTE });
  ls = { ...ls, karten: { ...ls.karten, 'x-a-2': { fach: 5, faellig: '2026-12-01', zuletzt: '2026-11-15' } } };
  ls = bewerte(ls, 'x-a-2', false, HEUTE);
  assert.deepEqual(ohneZeit(ls.karten['x-a-2']), { fach: 1, faellig: '2026-11-23', zuletzt: HEUTE });
});

test('Übung: richtig ändert Fach und Termin nicht, falsch setzt zurück', () => {
  const start = { version: 1, karten: { 'x-a-1': { fach: 3, faellig: '2026-11-25', zuletzt: '2026-11-21' } } };
  const richtig = bewerte(start, 'x-a-1', true, HEUTE, { uebung: true });
  assert.deepEqual(ohneZeit(richtig.karten['x-a-1']), { fach: 3, faellig: '2026-11-25', zuletzt: HEUTE });
  const falsch = bewerte(start, 'x-a-1', false, HEUTE, { uebung: true });
  assert.deepEqual(ohneZeit(falsch.karten['x-a-1']), { fach: 1, faellig: '2026-11-23', zuletzt: HEUTE });
  // Fehler-Durchlauf: in der Runde falsch, danach richtig -> bleibt in Fach 1, morgen fällig.
  let ls = bewerte(neuerLernstand(), 'x-b-1', false, HEUTE);
  ls = bewerte(ls, 'x-b-1', true, HEUTE, { uebung: true });
  assert.deepEqual(ohneZeit(ls.karten['x-b-1']), { fach: 1, faellig: '2026-11-23', zuletzt: HEUTE });
});

test('bewerte setzt den genauen Zeitpunkt der Bewertung (für das Zusammenführen)', () => {
  let ls = bewerte(neuerLernstand(), 'x-a-1', true, HEUTE, { jetzt: 1000 });
  assert.equal(ls.karten['x-a-1'].geaendert, 1000);
  ls = bewerte(ls, 'x-a-1', true, HEUTE, { uebung: true, jetzt: 2000 });
  assert.equal(ls.karten['x-a-1'].geaendert, 2000);
  ls = bewerte(ls, 'x-a-1', false, HEUTE, { jetzt: 3000 });
  assert.equal(ls.karten['x-a-1'].geaendert, 3000);
  const vorher = Date.now();
  assert.ok(bewerte(ls, 'x-b-1', true, HEUTE).karten['x-b-1'].geaendert >= vorher);
});

test('bewerte verändert den alten Lernstand nicht', () => {
  const alt = neuerLernstand();
  bewerte(alt, 'x-a-1', true, HEUTE);
  assert.deepEqual(alt.karten, {});
});

test('istFaellig nach Kalendertagen', () => {
  const karte = { fach: 1, faellig: '2026-11-23' };
  assert.equal(istFaellig(karte, '2026-11-22'), false);
  assert.equal(istFaellig(karte, '2026-11-23'), true);
  assert.equal(istFaellig(karte, '2026-11-30'), true);
  assert.equal(istFaellig(undefined, HEUTE), false);
});

test('F-05: neue Fragen Thema für Thema in der Reihenfolge des Moduls', () => {
  assert.deepEqual(ids(bildeRunde(modul, neuerLernstand(), HEUTE)), ['x-b-1', 'x-b-2', 'x-a-1', 'x-a-2']);
  assert.deepEqual(ids(bildeRunde(modul, neuerLernstand(), HEUTE, { anzahl: 3 })), ['x-b-1', 'x-b-2', 'x-a-1']);
});

test('F-05: zuerst fällige (am längsten überfällig zuerst), dann neue', () => {
  const ls = { version: 1, karten: {
    'x-a-2': { fach: 2, faellig: '2026-11-22', zuletzt: '2026-11-20' },
    'x-b-2': { fach: 3, faellig: '2026-11-20', zuletzt: '2026-11-16' },
    'x-b-1': { fach: 2, faellig: '2026-11-25', zuletzt: '2026-11-23' }, // noch nicht fällig
  } };
  assert.deepEqual(ids(bildeRunde(modul, ls, HEUTE)), ['x-b-2', 'x-a-2', 'x-a-1']);
  assert.deepEqual(ids(bildeRunde(modul, ls, HEUTE, { anzahl: 1 })), ['x-b-2']);
});

test('fällige Fragen mit gleichem Termin: niedriges Fach zuerst', () => {
  const ls = { version: 1, karten: {
    'x-b-1': { fach: 4, faellig: '2026-11-22', zuletzt: '2026-11-14' },
    'x-a-1': { fach: 1, faellig: '2026-11-22', zuletzt: '2026-11-21' },
  } };
  assert.deepEqual(ids(bildeRunde(modul, ls, HEUTE, { anzahl: 2 })), ['x-a-1', 'x-b-1']);
});

test('Runde ist kürzer, wenn nichts mehr fällig oder neu ist', () => {
  let ls = neuerLernstand();
  for (const f of modul.fragen) ls = bewerte(ls, f.id, true, HEUTE);
  assert.deepEqual(bildeRunde(modul, ls, HEUTE), []);
});

test('vorgezogene Wiederholung: nur gelernte, nicht fällige; nächster Termin zuerst', () => {
  const ls = { version: 1, karten: {
    'x-a-1': { fach: 4, faellig: '2026-11-30', zuletzt: '2026-11-22' },
    'x-a-2': { fach: 1, faellig: '2026-11-23', zuletzt: '2026-11-22' },
    'x-b-1': { fach: 2, faellig: '2026-11-21', zuletzt: '2026-11-19' }, // fällig, gehört in die normale Runde
    'x-b-2': { fach: 2, faellig: '2026-11-23', zuletzt: '2026-11-21' },
  } };
  assert.deepEqual(ids(bildeVorgezogeneRunde(modul, ls, HEUTE)), ['x-a-2', 'x-b-2', 'x-a-1']);
  assert.deepEqual(bildeVorgezogeneRunde(modul, neuerLernstand(), HEUTE), []);
});

test('F-23: Lernstand zu Fragen, die es nicht mehr gibt, wird übersprungen', () => {
  const ls = { version: 1, karten: {
    'x-alt-9': { fach: 1, faellig: '2026-11-01', zuletzt: '2026-10-31' },
    'x-a-1': { fach: 2, faellig: '2026-11-22', zuletzt: '2026-11-20' },
  } };
  assert.deepEqual(ids(bildeRunde(modul, ls, HEUTE, { anzahl: 2 })), ['x-a-1', 'x-b-1']);
  const u = lernUebersicht(modul, ls, HEUTE);
  assert.deepEqual(u, { faellig: 1, neu: 3, spaeter: 0, faecher: [0, 1, 0, 0, 0] });
});

test('Übersicht zählt fällig, neu, später und die Fächer', () => {
  let ls = neuerLernstand();
  ls = bewerte(ls, 'x-a-1', true, '2026-11-21'); // Fach 2, fällig 23.11.
  ls = bewerte(ls, 'x-b-1', false, '2026-11-21'); // Fach 1, fällig 22.11.
  assert.deepEqual(lernUebersicht(modul, ls, HEUTE), { faellig: 1, neu: 2, spaeter: 1, faecher: [1, 1, 0, 0, 0] });
});

test('SKS-Katalog: erste Runde besteht aus den ersten 10 Navigationsfragen', async () => {
  const text = await readFile(new URL('../content/sks/sks.json', import.meta.url), 'utf8');
  const sks = leseModul(text);
  const runde = bildeRunde(sks, neuerLernstand(), HEUTE);
  assert.equal(runde.length, 10);
  assert.deepEqual(ids(runde), Array.from({ length: 10 }, (_, i) => `sks-nav-${String(i + 1).padStart(3, '0')}`));
});

test('M2 kennt keine Prüfungsinhalte', async () => {
  const quelltext = await readFile(new URL('../src/engine/m2-lernlogik.js', import.meta.url), 'utf8');
  assert.ok(!/sks|navigation|seemannschaft/i.test(quelltext));
});
