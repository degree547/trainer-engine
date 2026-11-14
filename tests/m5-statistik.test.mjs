// Tests für M5 Statistik: Fortschritt je Thema (F-17), Schwächenliste (F-18),
// Zähler richtig/falsch aus M2 und ihre Umstellung von Version 1 in M7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fortschrittJeThema, fehlerquote, schwaechenliste, MIN_VERSUCHE,
} from '../src/engine/m5-statistik.js';
import { neuerLernstand, bewerte, LERNSTAND_VERSION } from '../src/engine/m2-lernlogik.js';
import { oeffneSpeicher, migriere, freitextEintrag, DB_NAME } from '../src/engine/m7-speicherung.js';
import { erzeugeIndexedDB } from './hilfen/fake-indexeddb.mjs';

const HEUTE = '2026-11-22';
const frage = (id, thema) => ({ id, thema });
const modul = {
  themen: [{ id: 'x-a', titel: 'A' }, { id: 'x-b', titel: 'B' }],
  fragen: [frage('x-a-1', 'x-a'), frage('x-a-2', 'x-a'), frage('x-a-3', 'x-a'), frage('x-a-4', 'x-a'),
    frage('x-b-1', 'x-b'), frage('x-b-2', 'x-b')],
};
const karte = (fach, richtig, falsch) => ({ fach, faellig: '2026-11-25', zuletzt: '2026-11-21', geaendert: 1, richtig, falsch });

test('M2 zählt richtige und falsche Antworten, auch in Übungen', () => {
  let ls = bewerte(neuerLernstand(), 'x-a-1', true, HEUTE);
  ls = bewerte(ls, 'x-a-1', false, HEUTE);
  ls = bewerte(ls, 'x-a-1', true, HEUTE, { uebung: true });
  ls = bewerte(ls, 'x-a-1', false, HEUTE, { uebung: true });
  assert.equal(ls.karten['x-a-1'].richtig, 2);
  assert.equal(ls.karten['x-a-1'].falsch, 2);
  assert.equal(ls.version, LERNSTAND_VERSION);
});

test('M2: Karten ohne Zähler (alter Stand) zählen ab 0 weiter', () => {
  const alt = { version: 2, karten: { 'x-a-1': { fach: 2, faellig: HEUTE, zuletzt: HEUTE } } };
  const ls = bewerte(alt, 'x-a-1', false, HEUTE);
  assert.deepEqual([ls.karten['x-a-1'].richtig, ls.karten['x-a-1'].falsch], [0, 1]);
});

test('F-17: Fortschritt je Thema = Anteil der Fragen in Fach 4 und 5', () => {
  const ls = { version: 2, karten: {
    'x-a-1': karte(4, 3, 0), 'x-a-2': karte(5, 4, 0), 'x-a-3': karte(3, 2, 0),
    'x-b-1': karte(1, 0, 1),
    'weg-1': karte(5, 1, 0), // Frage gibt es im Modul nicht mehr
  } };
  const f = fortschrittJeThema(modul, ls);
  assert.deepEqual(f.themen.map((t) => t.id), ['x-a', 'x-b']);
  assert.deepEqual(f.themen[0], { id: 'x-a', titel: 'A', gesamt: 4, sicher: 2, lernend: 1, neu: 1, anteil: 0.5 });
  assert.deepEqual(f.themen[1], { id: 'x-b', titel: 'B', gesamt: 2, sicher: 0, lernend: 1, neu: 1, anteil: 0 });
  assert.deepEqual(f.gesamt, { gesamt: 6, sicher: 2, lernend: 2, neu: 2, anteil: 2 / 6 });
});

test('F-17: leeres Thema und leerer Lernstand ergeben 0 %', () => {
  const m = { themen: [...modul.themen, { id: 'x-c', titel: 'C' }], fragen: modul.fragen };
  const f = fortschrittJeThema(m, neuerLernstand());
  assert.equal(f.themen[2].gesamt, 0);
  assert.equal(f.themen[2].anteil, 0);
  assert.equal(f.gesamt.neu, 6);
  assert.equal(f.gesamt.anteil, 0);
});

test('Fehlerquote einer Karte', () => {
  assert.equal(fehlerquote(undefined), null);
  assert.equal(fehlerquote({ fach: 1 }), null);
  assert.deepEqual(fehlerquote(karte(1, 1, 3)), { versuche: 4, richtig: 1, falsch: 3, quote: 0.75 });
});

test('F-18: Schwächenliste nach Fehlerquote, mit Mindestzahl an Antworten', () => {
  assert.equal(MIN_VERSUCHE, 2);
  const ls = { version: 2, karten: {
    'x-a-1': karte(1, 1, 1),   // 50 %
    'x-a-2': karte(1, 0, 1),   // nur eine Antwort: noch nicht in der Liste
    'x-a-3': karte(2, 1, 3),   // 75 %
    'x-a-4': karte(5, 4, 0),   // nie falsch
    'x-b-1': karte(3, 2, 2),   // 50 %, mehr Fehler als x-a-1
    'x-b-2': karte(1, 2, 2),   // 50 %, gleich viele Fehler wie x-b-1, niedrigeres Fach
  } };
  const liste = schwaechenliste(modul, ls);
  assert.deepEqual(liste.map((e) => e.frage.id), ['x-a-3', 'x-b-2', 'x-b-1', 'x-a-1']);
  assert.deepEqual(liste[0], { frage: modul.fragen[2], fach: 2, versuche: 4, richtig: 1, falsch: 3, quote: 0.75 });
  assert.deepEqual(schwaechenliste(modul, ls, { anzahl: 2 }).map((e) => e.frage.id), ['x-a-3', 'x-b-2']);
  assert.deepEqual(schwaechenliste(modul, ls, { minVersuche: 1 })[0].frage.id, 'x-a-2');
  assert.deepEqual(schwaechenliste(modul, neuerLernstand()), []);
});

test('Umstellung von Version 1: Zähler aus den Freitext-Antworten nachtragen (Variante A)', () => {
  const v1 = { version: 1, karten: {
    'x-a-1': { fach: 2, faellig: HEUTE, zuletzt: HEUTE, geaendert: 5 },
    'x-a-2': { fach: 3, faellig: HEUTE, zuletzt: HEUTE, geaendert: 6 }, // z. B. Multiple Choice
  } };
  const antworten = [
    freitextEintrag({ modul: 'x', frage: 'x-a-1', text: 'a', gewusst: false, modus: 'normal' }, 1),
    freitextEintrag({ modul: 'x', frage: 'x-a-1', text: 'b', gewusst: true, modus: 'fehler' }, 2),
    freitextEintrag({ modul: 'x', frage: 'x-a-1', text: 'c', gewusst: true, modus: 'normal' }, 3),
    freitextEintrag({ modul: 'x', frage: 'x-zz-9', text: 'd', gewusst: false, modus: 'normal' }, 4), // ohne Karte
    { id: 'kaputt' },
  ];
  const { lernstand, verworfen } = migriere(v1, antworten);
  assert.equal(verworfen, 0);
  assert.equal(lernstand.version, LERNSTAND_VERSION);
  assert.deepEqual([lernstand.karten['x-a-1'].richtig, lernstand.karten['x-a-1'].falsch], [2, 1]);
  assert.deepEqual([lernstand.karten['x-a-2'].richtig, lernstand.karten['x-a-2'].falsch], [0, 0]);
  assert.equal(lernstand.karten['x-zz-9'], undefined);
  assert.equal(v1.karten['x-a-1'].richtig, undefined, 'der geladene Stand bleibt unverändert');
});

test('Version 2 wird nicht erneut aus den Antworten gezählt; ungültige Zähler werden verworfen', () => {
  const v2 = { version: 2, karten: { 'x-a-1': karte(2, 7, 1), 'x-a-2': karte(2, -1, 0), 'x-a-3': karte(2, 1.5, 0) } };
  const antworten = [freitextEintrag({ modul: 'x', frage: 'x-a-1', text: 'a', gewusst: false, modus: 'normal' }, 1)];
  const { lernstand, verworfen } = migriere(v2, antworten);
  assert.deepEqual([lernstand.karten['x-a-1'].richtig, lernstand.karten['x-a-1'].falsch], [7, 1]);
  assert.equal(verworfen, 2);
});

test('M7: gespeicherter Stand der Version 1 wird beim Laden mit den Antworten des Moduls umgestellt', async () => {
  const indexedDB = erzeugeIndexedDB();
  const speicher = await oeffneSpeicher({ indexedDB });
  await speicher.speichereAntwort(freitextEintrag({ modul: 'sks', frage: 'sks-nav-001', text: 'x', gewusst: false, modus: 'normal' }, 1));
  await speicher.speichereAntwort(freitextEintrag({ modul: 'sks', frage: 'sks-nav-001', text: 'y', gewusst: true, modus: 'normal' }, 2));
  await speicher.speichereAntwort(freitextEintrag({ modul: 'anderes', frage: 'sks-nav-001', text: 'z', gewusst: false, modus: 'normal' }, 3));
  indexedDB.roh(DB_NAME, 'lernstand').set('sks', {
    version: 1, karten: { 'sks-nav-001': { fach: 2, faellig: HEUTE, zuletzt: HEUTE, geaendert: 2 } },
  });

  const { lernstand } = await speicher.lade('sks');
  assert.deepEqual([lernstand.karten['sks-nav-001'].richtig, lernstand.karten['sks-nav-001'].falsch], [1, 1]);

  // Nach der nächsten Antwort ist Version 2 gespeichert und zählt weiter, ohne doppelt zu zählen.
  const neu = bewerte(lernstand, 'sks-nav-001', false, HEUTE, { jetzt: 10 });
  await speicher.speichere('sks', neu);
  await speicher.speichereAntwort(freitextEintrag({ modul: 'sks', frage: 'sks-nav-001', text: 'w', gewusst: false, modus: 'normal' }, 10));
  const roh = indexedDB.roh(DB_NAME, 'lernstand').get('sks');
  assert.equal(roh.version, LERNSTAND_VERSION);
  const geladen = (await speicher.lade('sks')).lernstand.karten['sks-nav-001'];
  assert.deepEqual([geladen.richtig, geladen.falsch], [1, 2]);
});
