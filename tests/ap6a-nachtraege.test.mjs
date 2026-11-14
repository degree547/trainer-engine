// Tests für die Nachträge aus AP6A:
// F-34 Freitext-Antworten speichern (M7), F-36 Ränge je Level (M4), F-37 Ränge im Inhaltsmodul (M8).
// F-33 (Enter schickt ab) ist Oberfläche und wird im Browser geprüft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pruefeModul } from '../src/engine/m8-inhaltsformat.js';
import { rangVon, aufstiegVon, levelStart } from '../src/engine/m4-gamification.js';
import {
  oeffneSpeicher, freitextEintrag, istGueltigeAntwort, fuehreAntwortenZusammen, DB_NAME, DB_VERSION,
} from '../src/engine/m7-speicherung.js';
import { erzeugeIndexedDB } from './hilfen/fake-indexeddb.mjs';

const RAENGE = [
  { ab: 1, name: 'Eins' },
  { ab: 3, name: 'Zwei', bild: 'bilder/zwei.svg' },
  { ab: 5, name: 'Drei' },
];

const modul = (extra = {}) => ({
  format: 1,
  meta: { id: 't', titel: 'Test', sprache: 'de', version: '1', stand: '2026-11-14' },
  themen: [{ id: 't-a', titel: 'A' }],
  fragen: [{ id: 't-1', thema: 't-a', typ: 'mc', frage: 'F?', optionen: ['a', 'b'], richtig: 0, erklaerung: '', quelle: 'q' }],
  ...extra,
});
const codes = (fehler) => fehler.map((f) => f.code);

// --- F-37: Ränge im Inhaltsformat ------------------------------------------

test('F-37: Ränge sind optional, gültige Ränge erzeugen keinen Fehler', () => {
  assert.deepEqual(pruefeModul(modul()), []);
  assert.deepEqual(pruefeModul(modul({ raenge: RAENGE })), []);
});

test('F-37: fehlerhafte Ränge werden mit Klartext-Code gemeldet', () => {
  assert.deepEqual(codes(pruefeModul(modul({ raenge: {} }))), ['inhalt.keineListe']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: [] }))), ['inhalt.zuWenige']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: ['x'] }))), ['inhalt.keinObjekt']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: [{ ab: 2, name: 'A' }] }))), ['inhalt.rangErstesAb']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: [{ ab: 1, name: 'A' }, { ab: 1, name: 'B' }] }))), ['inhalt.rangAbSteigend']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: [{ ab: 1.5, name: 'A' }] }))), ['inhalt.rangAbUngueltig']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: [{ ab: 1, name: '' }] }))), ['inhalt.keinText']);
  assert.deepEqual(codes(pruefeModul(modul({ raenge: [{ ab: 1, name: 'A', bild: 3 }] }))), ['inhalt.keinText']);
  const [f] = pruefeModul(modul({ raenge: [{ ab: 1, name: 'A' }, { ab: 1, name: 'B' }] }));
  assert.deepEqual(f.ort, { art: 'rang', nr: 2 });
  assert.deepEqual(f.werte, { ab: 1, vorher: 1 });
});

test('F-37: das SKS-Modul bringt zwölf nautische Ränge mit, Kapitän ab Level 30', async () => {
  const sks = JSON.parse(await readFile(new URL('../content/sks/sks.json', import.meta.url), 'utf8'));
  assert.deepEqual(pruefeModul(sks), []);
  assert.equal(sks.raenge.length, 12);
  assert.deepEqual(sks.raenge[0], { ab: 1, name: 'Süßwassermatrose' });
  assert.equal(sks.raenge.find((r) => r.name === 'Kapitän').ab, 30);
  assert.equal(sks.raenge.at(-1).name, 'Admiral');
  // Rangbilder folgen später: bis dahin überall Platzhalter.
  assert.ok(sks.raenge.every((r) => r.bild === undefined));
});

// --- F-36: Rang je Level ---------------------------------------------------

test('F-36: jedes Level gehört zu einem Rang, mit dem nächsten Rang dazu', () => {
  assert.equal(rangVon(RAENGE, 1).name, 'Eins');
  assert.equal(rangVon(RAENGE, 2).name, 'Eins');
  assert.equal(rangVon(RAENGE, 2).naechster.name, 'Zwei');
  assert.equal(rangVon(RAENGE, 3).name, 'Zwei');
  assert.equal(rangVon(RAENGE, 3).bild, 'bilder/zwei.svg');
  assert.equal(rangVon(RAENGE, 3).nr, 2);
  assert.equal(rangVon(RAENGE, 99).name, 'Drei');
  assert.equal(rangVon(RAENGE, 99).naechster, null);
});

test('F-36: ohne Ränge im Modul gibt es keinen Rang', () => {
  assert.equal(rangVon(undefined, 4), null);
  assert.equal(rangVon([], 4), null);
  assert.deepEqual(aufstiegVon(0, levelStart(5), undefined), { level: true, rang: null });
});

test('F-36: Rangaufstieg wird erkannt, ein Level ohne neuen Rang nicht', () => {
  const xpLevel = (level) => levelStart(level);
  // Level 1 → 2: neues Level, aber noch derselbe Rang
  assert.deepEqual(aufstiegVon(xpLevel(1), xpLevel(2), RAENGE), { level: true, rang: null });
  // Level 2 → 3: neuer Rang „Zwei“
  const a = aufstiegVon(xpLevel(3) - 10, xpLevel(3), RAENGE);
  assert.equal(a.level, true);
  assert.equal(a.rang.name, 'Zwei');
  // Zwei Ränge auf einmal übersprungen: der erreichte Rang zählt
  assert.equal(aufstiegVon(0, xpLevel(6), RAENGE).rang.name, 'Drei');
  // Keine neuen XP
  assert.deepEqual(aufstiegVon(xpLevel(3), xpLevel(3), RAENGE), { level: false, rang: null });
});

// --- F-34: Freitext-Antworten speichern ------------------------------------

const eintrag = (zeit, extra = {}) => freitextEintrag(
  { modul: 'sks', frage: 'sks-nav-001', text: 'Vollständig und berichtigt', gewusst: true, modus: 'normal', ...extra }, zeit);

test('F-34: Eintrag enthält Frage-ID, Zeitpunkt, Text und Selbstbewertung', () => {
  const e = eintrag(1_700_000_000_000);
  assert.equal(e.frage, 'sks-nav-001');
  assert.equal(e.modul, 'sks');
  assert.equal(e.zeit, 1_700_000_000_000);
  assert.equal(e.text, 'Vollständig und berichtigt');
  assert.equal(e.gewusst, true);
  assert.equal(e.modus, 'normal');
  assert.ok(istGueltigeAntwort(e));
  assert.notEqual(eintrag(1).id, eintrag(1).id, 'jede Antwort bekommt eine eigene ID');
  // Leere Antwort (nach Rückfrage erlaubt) wird als leerer Text gespeichert.
  assert.equal(eintrag(2, { text: undefined }).text, '');
});

test('F-34: Freitext-Antworten bleiben nach einem Neustart erhalten', async () => {
  const indexedDB = erzeugeIndexedDB();
  const erster = await oeffneSpeicher({ indexedDB });
  await erster.speichereAntwort(eintrag(2, { gewusst: false }));
  await erster.speichereAntwort(eintrag(1));
  await erster.speichereAntwort(eintrag(3, { modul: 'iapp', frage: 'iapp-001' }));
  erster.schliesse();

  const zweiter = await oeffneSpeicher({ indexedDB });
  const alle = await zweiter.ladeAntworten();
  assert.deepEqual(alle.antworten.map((e) => e.zeit), [1, 2, 3], 'sortiert nach Zeitpunkt');
  assert.equal(alle.verworfen, 0);
  const sks = await zweiter.ladeAntworten('sks');
  assert.deepEqual(sks.antworten.map((e) => e.gewusst), [true, false]);
});

test('F-34: ungültige Einträge werden nicht gespeichert und beim Laden übersprungen', async () => {
  const indexedDB = erzeugeIndexedDB();
  const speicher = await oeffneSpeicher({ indexedDB });
  await assert.rejects(speicher.speichereAntwort({ frage: 'x' }));
  await speicher.speichereAntwort(eintrag(1));
  indexedDB.roh(DB_NAME, 'antworten').set('kaputt', { id: 'kaputt', text: 5 });
  const { antworten, verworfen } = await speicher.ladeAntworten();
  assert.equal(antworten.length, 1);
  assert.equal(verworfen, 1);
});

test('F-34: Zusammenführen zweier Geräte zählt keine Antwort doppelt (für den Import in AP8)', () => {
  const a = [eintrag(1), eintrag(3)];
  const b = [a[1], eintrag(2)];
  const { antworten } = fuehreAntwortenZusammen(a, b);
  assert.deepEqual(antworten.map((e) => e.zeit), [1, 2, 3]);
  assert.deepEqual(fuehreAntwortenZusammen(antworten, antworten).antworten, antworten);
});

test('F-34: Umstellung auf Datenbankversion 3 behält Lernstand und Profil', async () => {
  assert.equal(DB_VERSION, 3);
  const indexedDB = erzeugeIndexedDB();
  // Datenbank wie aus AP6 (Version 2: „lernstand“ und „profil“) anlegen.
  await new Promise((fertig) => {
    const anfrage = indexedDB.open(DB_NAME, 2);
    anfrage.onupgradeneeded = () => {
      anfrage.result.createObjectStore('lernstand');
      anfrage.result.createObjectStore('profil');
    };
    anfrage.onsuccess = fertig;
  });
  const karte = { fach: 4, faellig: '2026-11-20', zuletzt: '2026-11-12', geaendert: 1 };
  indexedDB.roh(DB_NAME, 'lernstand').set('sks', { version: 1, karten: { 'sks-nav-001': karte } });
  const profil = { version: 1, geraet: 'g1', tagesziel: { wert: 2, geaendert: 0 }, geraete: { g1: { '2026-11-13': { xp: 30, runden: 1, ziel: 1 } } } };
  indexedDB.roh(DB_NAME, 'profil').set('profil', profil);

  const speicher = await oeffneSpeicher({ indexedDB });
  assert.equal((await speicher.lade('sks')).lernstand.karten['sks-nav-001'].fach, 4);
  assert.deepEqual((await speicher.ladeProfil()).profil, profil);
  await speicher.speichereAntwort(eintrag(1));
  assert.equal((await speicher.ladeAntworten()).antworten.length, 1);
});
