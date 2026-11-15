// Prüft M6: Regeln aus dem Modul, Prüfbogen, Zeit und Auswertung (F-20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  pruefungsregeln, bildePruefbogen, endeUm, restzeit, zeittext, werteAus,
} from '../src/engine/m6-pruefung.js';
import { pruefeModul } from '../src/engine/m8-inhaltsformat.js';

const frage = (thema, nr, extra = {}) => ({
  id: `t-${thema}-${nr}`, thema: `t-${thema}`, typ: 'freitext', frage: `Frage ${thema}${nr}?`, musterantwort: 'A.',
  kernpunkte: ['P'], kernpunkteStatus: 'ungeprueft', herkunft: 'eigen', erklaerung: '', quelle: 'Q', ...extra,
});
const modul = (pruefung) => ({
  format: 1,
  meta: { id: 't', titel: 'Test', sprache: 'de', version: '1', stand: '2026-11-15' },
  themen: [{ id: 't-a', titel: 'A' }, { id: 't-b', titel: 'B' }, { id: 't-c', titel: 'C' }],
  fragen: [
    ...Array.from({ length: 6 }, (_, i) => frage('a', i + 1)),
    ...Array.from({ length: 4 }, (_, i) => frage('b', i + 1)),
    frage('c', 1),
    { id: 't-b-mc', thema: 't-b', typ: 'mc', frage: 'MC?', optionen: ['x', 'y'], richtig: 1, erklaerung: '', quelle: 'Q' },
  ],
  ...(pruefung ? { pruefung } : {}),
});
const REGELN = { fragen: { 't-b': 2, 't-a': 3 }, minuten: 20, punkteJeFrage: 2, bestehenAb: 7, hinweis: 'vorläufig' };

/** Zufallszahlen aus einer festen Folge, damit der Bogen reproduzierbar ist. */
const folge = (...werte) => { let i = 0; return () => werte[i++ % werte.length]; };

test('Testmodul mit Prüfungsregeln ist gültig', () => {
  assert.deepEqual(pruefeModul(modul(REGELN)), []);
});

test('pruefungsregeln: Summen, Themenreihenfolge wie im Modul, Standard 1 Punkt', () => {
  const r = pruefungsregeln(modul(REGELN));
  assert.deepEqual(r.verteilung, [{ thema: 't-a', titel: 'A', anzahl: 3 }, { thema: 't-b', titel: 'B', anzahl: 2 }]);
  assert.equal(r.fragen, 5);
  assert.equal(r.maxPunkte, 10);
  assert.equal(r.bestehenAb, 7);
  assert.equal(r.minuten, 20);
  assert.equal(r.hinweis, 'vorläufig');
  const ohnePunkte = pruefungsregeln(modul({ fragen: { 't-a': 2 }, minuten: 5, bestehenAb: 1 }));
  assert.equal(ohnePunkte.punkteJeFrage, 1);
  assert.equal(ohnePunkte.maxPunkte, 2);
  assert.equal(ohnePunkte.hinweis, '');
});

test('ohne Abschnitt "pruefung" gibt es keine Simulation', () => {
  assert.equal(pruefungsregeln(modul()), null);
  assert.deepEqual(bildePruefbogen(modul()), []);
});

test('Prüfbogen: richtige Anzahl je Thema, keine Doppelten, Themen- und Katalogreihenfolge', () => {
  const m = modul(REGELN);
  for (let lauf = 0; lauf < 50; lauf += 1) {
    const bogen = bildePruefbogen(m);
    assert.equal(bogen.length, 5);
    assert.equal(bogen.filter((f) => f.thema === 't-a').length, 3);
    assert.equal(bogen.filter((f) => f.thema === 't-b').length, 2);
    assert.equal(new Set(bogen.map((f) => f.id)).size, 5);
    // Thema A vor B, innerhalb eines Themas Reihenfolge des Moduls
    const positionen = bogen.map((f) => m.fragen.indexOf(f));
    assert.deepEqual(positionen, [...positionen].sort((x, y) => x - y));
  }
});

test('Prüfbogen ist zufällig, mit fester Zufallsfolge reproduzierbar', () => {
  const m = modul(REGELN);
  const a = bildePruefbogen(m, folge(0.9, 0.1, 0.5)).map((f) => f.id);
  const b = bildePruefbogen(m, folge(0.9, 0.1, 0.5)).map((f) => f.id);
  assert.deepEqual(a, b);
  // Immer die erste Wahl: die ersten Fragen jedes Themas
  assert.deepEqual(bildePruefbogen(m, () => 0).map((f) => f.id), ['t-a-1', 't-a-2', 't-a-3', 't-b-1', 't-b-2']);
  // Immer die letzte Wahl: Fragen vom Ende jedes Themas sind dabei
  const spaet = bildePruefbogen(m, () => 0.999).map((f) => f.id);
  assert.ok(spaet.includes('t-a-6') && spaet.includes('t-b-mc'));
  // Über viele Läufe kommt jede Frage aus A vor
  const gesehen = new Set();
  for (let lauf = 0; lauf < 200; lauf += 1) for (const f of bildePruefbogen(m)) gesehen.add(f.id);
  for (let i = 1; i <= 6; i += 1) assert.ok(gesehen.has(`t-a-${i}`));
});

test('Zeit: Ende, Restzeit und Uhr', () => {
  const ende = endeUm(1000, 90);
  assert.equal(ende, 1000 + 90 * 60 * 1000);
  assert.equal(restzeit(ende, ende - 5000), 5000);
  assert.equal(restzeit(ende, ende + 5000), 0);
  assert.equal(zeittext(90 * 60_000), '1:30:00');
  assert.equal(zeittext(89 * 60_000 + 59_000), '1:29:59');
  assert.equal(zeittext(59 * 60_000 + 59_000), '59:59');
  assert.equal(zeittext(61_000), '1:01');
  assert.equal(zeittext(500), '0:01'); // angefangene Sekunde zählt
  assert.equal(zeittext(0), '0:00');
  assert.equal(zeittext(-10), '0:00');
});

test('Auswertung: Punkte, Bestehensgrenze, je Thema, Fehlerliste', () => {
  const m = modul(REGELN);
  const bogen = bildePruefbogen(m, () => 0); // t-a-1..3, t-b-1..2
  const bewertungen = new Map([['t-a-1', true], ['t-a-2', true], ['t-a-3', false], ['t-b-1', true]]); // t-b-2 fehlt
  const e = werteAus(m, bogen, bewertungen);
  assert.equal(e.richtig, 3);
  assert.equal(e.gesamt, 5);
  assert.equal(e.punkte, 6);
  assert.equal(e.maxPunkte, 10);
  assert.equal(e.bestehenAb, 7);
  assert.equal(e.bestanden, false);
  assert.deepEqual(e.themen, [
    { id: 't-a', titel: 'A', gesamt: 3, richtig: 2, punkte: 4, maxPunkte: 6 },
    { id: 't-b', titel: 'B', gesamt: 2, richtig: 1, punkte: 2, maxPunkte: 4 },
  ]);
  assert.deepEqual(e.fehler.map((f) => f.id), ['t-a-3', 't-b-2']);
});

test('Auswertung: genau an der Grenze ist bestanden', () => {
  const m = modul({ ...REGELN, bestehenAb: 6 });
  const bogen = bildePruefbogen(m, () => 0);
  const e = werteAus(m, bogen, new Map([['t-a-1', true], ['t-a-2', true], ['t-b-1', true]]));
  assert.equal(e.punkte, 6);
  assert.equal(e.bestanden, true);
  const knapp = werteAus(m, bogen, new Map([['t-a-1', true], ['t-a-2', true]]));
  assert.equal(knapp.bestanden, false);
});

test('M6 enthält keine Prüfungsinhalte', async () => {
  const quelltext = await readFile(new URL('../src/engine/m6-pruefung.js', import.meta.url), 'utf8');
  assert.ok(!/sks|SKS|Navigation|Wetter/.test(quelltext));
});
