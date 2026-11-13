// Tests für M7 Speicherung: Lernstand bleibt nach Neustart erhalten (F-21),
// Umstellung älterer Stände, Zusammenführen zweier Stände.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  oeffneSpeicher, migriere, fuehreZusammen, bitteUmDauerhaftenSpeicher, SpeicherFehler, DB_NAME,
} from '../src/engine/m7-speicherung.js';
import { neuerLernstand, bewerte, LERNSTAND_VERSION } from '../src/engine/m2-lernlogik.js';
import { erzeugeIndexedDB } from './hilfen/fake-indexeddb.mjs';

const HEUTE = '2026-11-22';
const karte = (fach, geaendert) => ({ fach, faellig: '2026-11-25', zuletzt: '2026-11-21', geaendert });

test('F-21: Lernstand bleibt nach einem Neustart erhalten', async () => {
  const indexedDB = erzeugeIndexedDB();
  const erster = await oeffneSpeicher({ indexedDB });
  assert.deepEqual((await erster.lade('sks')).lernstand, neuerLernstand());

  let ls = bewerte(neuerLernstand(), 'sks-nav-001', true, HEUTE, { jetzt: 1 });
  ls = bewerte(ls, 'sks-nav-002', false, HEUTE, { jetzt: 2 });
  await erster.speichere('sks', ls);
  erster.schliesse();

  // „Neustart“: Speicher neu öffnen, wie nach dem Neuladen der Seite.
  const zweiter = await oeffneSpeicher({ indexedDB });
  const { lernstand, verworfen } = await zweiter.lade('sks');
  assert.deepEqual(lernstand, ls);
  assert.equal(verworfen, 0);
});

test('Lernstände verschiedener Module bleiben getrennt', async () => {
  const speicher = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await speicher.speichere('sks', { version: 1, karten: { 'sks-nav-001': karte(2, 1) } });
  await speicher.speichere('beispiel', { version: 1, karten: { 'bsp-001': karte(3, 1) } });
  assert.deepEqual(Object.keys((await speicher.lade('sks')).lernstand.karten), ['sks-nav-001']);
  assert.deepEqual(Object.keys((await speicher.lade('beispiel')).lernstand.karten), ['bsp-001']);
});

test('Speichern führt mit dem gespeicherten Stand zusammen (zwei Tabs)', async () => {
  const indexedDB = erzeugeIndexedDB();
  const tabA = await oeffneSpeicher({ indexedDB });
  const tabB = await oeffneSpeicher({ indexedDB });
  await tabA.speichere('sks', { version: 1, karten: { a: karte(2, 10) } });
  // Tab B kennt die Antwort aus Tab A nicht und speichert nur seine eigene.
  const zusammen = await tabB.speichere('sks', { version: 1, karten: { b: karte(3, 20) } });
  assert.deepEqual(Object.keys(zusammen.karten).sort(), ['a', 'b']);
  assert.deepEqual(Object.keys((await tabA.lade('sks')).lernstand.karten).sort(), ['a', 'b']);
});

test('schnell hintereinander gespeichert: der letzte Stand gewinnt', async () => {
  const speicher = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  let ls = neuerLernstand();
  const auftraege = [];
  for (let i = 1; i <= 5; i += 1) {
    ls = bewerte(ls, 'sks-nav-001', true, HEUTE, { jetzt: i });
    auftraege.push(speicher.speichere('sks', ls));
  }
  await Promise.all(auftraege);
  assert.equal((await speicher.lade('sks')).lernstand.karten['sks-nav-001'].fach, 5);
});

test('ein Schreibfehler wird gemeldet, der nächste Versuch klappt wieder', async () => {
  const indexedDB = erzeugeIndexedDB({ schreibfehler: true });
  const speicher = await oeffneSpeicher({ indexedDB });
  await assert.rejects(speicher.speichere('sks', { version: 1, karten: { a: karte(2, 1) } }));
  indexedDB.schreibfehler = false;
  await speicher.speichere('sks', { version: 1, karten: { a: karte(2, 1) } });
  assert.equal((await speicher.lade('sks')).lernstand.karten.a.fach, 2);
});

test('ohne IndexedDB: verständlicher Fehler statt Absturz', async () => {
  await assert.rejects(oeffneSpeicher({ indexedDB: null }), (f) => f instanceof SpeicherFehler && f.code === 'speicher.nichtVerfuegbar');
});

test('ein Stand aus einer neueren App-Version wird weder gelesen noch überschrieben', async () => {
  const indexedDB = erzeugeIndexedDB();
  const speicher = await oeffneSpeicher({ indexedDB });
  const neuer = { version: LERNSTAND_VERSION + 1, karten: { a: { etwasNeues: true } } };
  indexedDB.roh(DB_NAME, 'lernstand').set('sks', neuer);
  await assert.rejects(speicher.lade('sks'), (f) => f.code === 'speicher.neuereVersion');
  await assert.rejects(speicher.speichere('sks', { version: 1, karten: { b: karte(1, 1) } }));
  assert.deepEqual(indexedDB.roh(DB_NAME, 'lernstand').get('sks'), neuer);
});

test('migriere: leerer Speicher, unlesbare Daten, beschädigte Einträge', () => {
  assert.deepEqual(migriere(undefined), { lernstand: neuerLernstand(), verworfen: 0 });
  assert.throws(() => migriere('Unsinn'), (f) => f.code === 'speicher.unlesbar');
  assert.throws(() => migriere({ version: 1 }), (f) => f.code === 'speicher.unlesbar');

  const { lernstand, verworfen } = migriere({
    karten: {
      gut: karte(3, 5),
      ohneZeit: { fach: 1, faellig: '2026-11-23', zuletzt: '2026-11-22' }, // vor dem Zeitstempel: erlaubt
      fachZuHoch: karte(6, 1),
      datumFalsch: { fach: 2, faellig: '23.11.2026' },
      leer: null,
    },
  });
  assert.equal(lernstand.version, LERNSTAND_VERSION);
  assert.deepEqual(Object.keys(lernstand.karten), ['gut', 'ohneZeit']);
  assert.equal(verworfen, 3);
});

test('fuehreZusammen: je Frage gewinnt der jüngere Eintrag, bei Gleichstand der erste', () => {
  const handy = { version: 1, karten: { a: karte(4, 300), b: karte(2, 100), nurHandy: karte(1, 50) } };
  const notebook = { version: 1, karten: { a: karte(1, 200), b: karte(5, 400), nurNotebook: karte(3, 60) } };
  const zusammen = fuehreZusammen(handy, notebook);
  assert.equal(zusammen.karten.a.fach, 4);
  assert.equal(zusammen.karten.b.fach, 5);
  assert.deepEqual(Object.keys(zusammen.karten).sort(), ['a', 'b', 'nurHandy', 'nurNotebook']);
  // Gleichstand und fehlender Zeitstempel
  assert.equal(fuehreZusammen({ karten: { a: karte(2, 7) } }, { karten: { a: karte(3, 7) } }).karten.a.fach, 2);
  assert.equal(fuehreZusammen({ karten: { a: karte(2) } }, { karten: { a: karte(3, 1) } }).karten.a.fach, 3);
  // Die Eingaben bleiben unverändert.
  assert.equal(handy.karten.b.fach, 2);
  assert.equal(Object.keys(handy.karten).length, 3);
});

test('dauerhafter Speicher: zugesagt, abgelehnt, nicht angeboten', async () => {
  assert.equal(await bitteUmDauerhaftenSpeicher({ persisted: async () => true, persist: async () => false }), 'dauerhaft');
  assert.equal(await bitteUmDauerhaftenSpeicher({ persisted: async () => false, persist: async () => true }), 'dauerhaft');
  assert.equal(await bitteUmDauerhaftenSpeicher({ persisted: async () => false, persist: async () => false }), 'nichtDauerhaft');
  assert.equal(await bitteUmDauerhaftenSpeicher({}), 'unbekannt');
  assert.equal(await bitteUmDauerhaftenSpeicher(undefined), 'unbekannt');
  assert.equal(await bitteUmDauerhaftenSpeicher({ persist: async () => { throw new Error('x'); } }), 'unbekannt');
});
