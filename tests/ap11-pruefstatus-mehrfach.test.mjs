// Tests für AP11: Prüfstatus der Kernpunkte in der App (F-39), Multiple Choice mit mehreren
// richtigen Antworten (F-40), Herkunft „Prüfungsverband“ (F-30) und das FKN-Modul.
// Das FKN-Modul liegt nur in privat/fkn/fkn.json (nie committet); ohne die Datei wird sein
// Test übersprungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  bewerteMc, istMehrfach, richtigeOptionen, kernpunkteGeprueft,
} from '../src/engine/m3-fragetypen.js';
import { pruefeModul } from '../src/engine/m8-inhaltsformat.js';
import { leseModul } from '../src/engine/m1-kern.js';
import {
  oeffneSpeicher, neuerPruefstatus, setzePruefstatus, fuehrePruefstatusZusammen, pruefePruefstatus,
  pruefeSicherung, SpeicherFehler, DB_NAME, freitextEintrag,
} from '../src/engine/m7-speicherung.js';
import { pruefstandJeThema } from '../src/engine/m5-statistik.js';
import { pruefungsregeln, bildePruefbogen, werteAus } from '../src/engine/m6-pruefung.js';
import { erzeugeIndexedDB } from './hilfen/fake-indexeddb.mjs';

const lies = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), 'utf8');
const alsDatei = (inhalt) => JSON.parse(JSON.stringify(inhalt));
const codes = (fehler) => fehler.map((f) => f.code);

const mehrfach = { id: 't-1', typ: 'mc', optionen: ['a', 'b', 'c', 'd'], richtig: [2, 0] };
const einfach = { id: 't-2', typ: 'mc', optionen: ['a', 'b'], richtig: 1 };

// --- F-40: Mehrfachauswahl ------------------------------------------------

test('F-40: Mehrfachauswahl ist nur richtig, wenn genau die richtigen Optionen gewählt sind', () => {
  assert.equal(istMehrfach(mehrfach), true);
  assert.equal(istMehrfach(einfach), false);
  assert.deepEqual(richtigeOptionen(mehrfach), [0, 2]);
  assert.deepEqual(richtigeOptionen(einfach), [1]);

  assert.equal(bewerteMc(mehrfach, new Set([0, 2])), true);
  assert.equal(bewerteMc(mehrfach, [2, 0]), true, 'Reihenfolge der Wahl ist egal');
  assert.equal(bewerteMc(mehrfach, new Set([0])), false, 'eine richtige fehlt');
  assert.equal(bewerteMc(mehrfach, new Set([0, 1, 2])), false, 'eine falsche zu viel');
  assert.equal(bewerteMc(mehrfach, new Set()), false, 'nichts gewählt');
  assert.equal(bewerteMc(mehrfach, undefined), false, 'nicht beantwortet (Simulation)');
  assert.equal(bewerteMc({ ...mehrfach, richtig: [3] }, 3), true, 'eine einzelne Nummer zählt als Wahl');
});

test('F-08 bleibt unverändert: eine richtige Option', () => {
  assert.equal(bewerteMc(einfach, 1), true);
  assert.equal(bewerteMc(einfach, 0), false);
  assert.equal(bewerteMc(einfach, undefined), false);
});

const modul = (fragen, meta = {}) => ({
  format: 1,
  meta: { id: 't', titel: 'Test', sprache: 'de', version: '1', stand: '2026-11-22', ...meta },
  themen: [{ id: 't-a', titel: 'A' }],
  fragen,
});
const mc = (extra) => ({
  id: 't-1', thema: 't-a', typ: 'mc', frage: 'Frage?', optionen: ['a', 'b', 'c'], richtig: [0, 2],
  erklaerung: '', quelle: 'eigen', ...extra,
});

test('F-40: M8 prüft die Liste der richtigen Optionen mit Zeile und Klartext', () => {
  assert.deepEqual(pruefeModul(modul([mc()])), []);
  assert.deepEqual(pruefeModul(modul([mc({ richtig: [1] })])), []);
  assert.deepEqual(codes(pruefeModul(modul([mc({ richtig: [] })]))), ['inhalt.zuWenige']);
  assert.deepEqual(codes(pruefeModul(modul([mc({ richtig: [0, 3] })]))), ['inhalt.richtigAusserhalb']);
  assert.deepEqual(codes(pruefeModul(modul([mc({ richtig: [0, 'b'] })]))), ['inhalt.richtigAusserhalb']);
  const doppelt = pruefeModul(modul([mc({ richtig: [2, 0, 2] })]));
  assert.deepEqual(codes(doppelt), ['inhalt.richtigDoppelt']);
  assert.equal(doppelt[0].werte.nr, 2);
});

test('F-30: Herkunft „verband“ ist erlaubt, unbekannte Herkunft nicht', () => {
  assert.deepEqual(pruefeModul(modul([mc({ herkunft: 'verband' })], { herkunft: 'verband' })), []);
  assert.deepEqual(codes(pruefeModul(modul([mc({ herkunft: 'dsv' })]))), ['inhalt.wertNichtErlaubt']);
});

test('Beispielmodul enthält eine Mehrfachauswahl und ist gültig', async () => {
  const beispiel = leseModul(await lies('content/beispiel/beispiel.json'));
  const frage = beispiel.fragen.find((f) => istMehrfach(f));
  assert.ok(frage, 'Mehrfachauswahl im Beispielmodul');
  assert.deepEqual(richtigeOptionen(frage).map((i) => frage.optionen[i]), ['Hund', 'Wal']);
});

// --- F-39: Prüfstatus der Kernpunkte --------------------------------------

const freitext = (id, kernpunkteStatus = 'ungeprueft', thema = 't-a') => ({ id, thema, typ: 'freitext', kernpunkteStatus });

test('F-39: ohne eigene Wahl gilt der Wert aus dem Modul, sonst die Wahl', () => {
  const offen = freitext('t-1');
  const fertig = freitext('t-2', 'geprueft');
  let stand = neuerPruefstatus();
  assert.equal(kernpunkteGeprueft(offen, stand), false);
  assert.equal(kernpunkteGeprueft(fertig, stand), true);
  assert.equal(kernpunkteGeprueft(offen, null), false);

  stand = setzePruefstatus(stand, 't-1', true, 10);
  stand = setzePruefstatus(stand, 't-2', false, 11);
  assert.equal(kernpunkteGeprueft(offen, stand), true);
  assert.equal(kernpunkteGeprueft(fertig, stand), false, 'Zurücknehmen gilt auch gegen das Modul');
  assert.deepEqual(stand.fragen['t-1'], { geprueft: true, geaendert: 10 });
});

test('F-39: Zusammenführen – je Frage gewinnt der jüngere Eintrag, auch ein Zurücknehmen', () => {
  const a = setzePruefstatus(setzePruefstatus(neuerPruefstatus(), 'x', true, 5), 'y', true, 5);
  const b = setzePruefstatus(setzePruefstatus(neuerPruefstatus(), 'x', false, 9), 'z', true, 1);
  const zusammen = fuehrePruefstatusZusammen(a, b);
  assert.deepEqual(zusammen.fragen, {
    x: { geprueft: false, geaendert: 9 },
    y: { geprueft: true, geaendert: 5 },
    z: { geprueft: true, geaendert: 1 },
  });
  assert.deepEqual(fuehrePruefstatusZusammen(zusammen, zusammen), zusammen);
});

test('F-39: beschädigte Einträge werden übersprungen, neuere Versionen nicht angefasst', () => {
  const { pruefstatus, verworfen } = pruefePruefstatus({
    version: 1,
    fragen: { a: { geprueft: true, geaendert: 1 }, b: { geprueft: 'ja', geaendert: 1 }, c: { geprueft: true } },
  });
  assert.deepEqual(Object.keys(pruefstatus.fragen), ['a']);
  assert.equal(verworfen, 2);
  assert.throws(() => pruefePruefstatus({ version: 2, fragen: {} }), (e) => e instanceof SpeicherFehler && e.code === 'speicher.neuereVersion');
  assert.throws(() => pruefePruefstatus({ fragen: [] }), (e) => e.code === 'speicher.unlesbar');
});

test('F-39: Prüfstatus wird je Modul gespeichert und übersteht Neustart und Modul-Update', async () => {
  const indexedDB = erzeugeIndexedDB();
  let speicher = await oeffneSpeicher({ indexedDB });
  await speicher.setzePruefstatus('sks', 'sks-recht-001', true, 100);
  await speicher.setzePruefstatus('sks', 'sks-recht-002', true, 101);
  const zurueck = await speicher.setzePruefstatus('sks', 'sks-recht-002', false, 102);
  assert.equal(zurueck.fragen['sks-recht-002'].geprueft, false);
  await speicher.setzePruefstatus('fkn', 'fkn-001', true, 103);
  speicher.schliesse();

  speicher = await oeffneSpeicher({ indexedDB });
  const { pruefstatus } = await speicher.ladePruefstatus('sks');
  assert.deepEqual(pruefstatus.fragen, {
    'sks-recht-001': { geprueft: true, geaendert: 100 },
    'sks-recht-002': { geprueft: false, geaendert: 102 },
  });
  assert.deepEqual(Object.keys((await speicher.ladePruefstatus('fkn')).pruefstatus.fragen), ['fkn-001']);
  assert.deepEqual((await speicher.ladePruefstatus('beispiel')).pruefstatus.fragen, {});

  // Modul-Update (F-23): neue Fassung mit derselben ID und einer zusätzlichen Frage.
  const neueFassung = { themen: [{ id: 't-a' }], fragen: [freitext('sks-recht-001'), freitext('sks-recht-003')] };
  assert.equal(kernpunkteGeprueft(neueFassung.fragen[0], pruefstatus), true);
  assert.equal(kernpunkteGeprueft(neueFassung.fragen[1], pruefstatus), false);
});

test('F-39: Umstellung von Datenbankversion 3 behält Antworten und legt den Prüfstatus an', async () => {
  const indexedDB = erzeugeIndexedDB();
  await new Promise((fertig) => {
    const anfrage = indexedDB.open(DB_NAME, 3);
    anfrage.onupgradeneeded = () => {
      for (const name of ['lernstand', 'profil', 'antworten']) anfrage.result.createObjectStore(name);
    };
    anfrage.onsuccess = () => { anfrage.result.close(); fertig(); };
  });
  const eintrag = freitextEintrag({ modul: 'sks', frage: 'sks-nav-001', text: 'x', gewusst: true, modus: 'normal' }, 5);
  indexedDB.roh(DB_NAME, 'antworten').set(eintrag.id, eintrag);

  const speicher = await oeffneSpeicher({ indexedDB });
  assert.equal((await speicher.ladeAntworten()).antworten.length, 1);
  await speicher.setzePruefstatus('sks', 'sks-nav-001', true, 6);
  assert.equal((await speicher.ladePruefstatus('sks')).pruefstatus.fragen['sks-nav-001'].geprueft, true);
});

test('F-39 und F-22: Prüfstatus steckt in der Sicherung und wird beim Import zusammengeführt', async () => {
  const geraet1 = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await geraet1.setzePruefstatus('sks', 'sks-recht-001', true, 100);
  await geraet1.setzePruefstatus('sks', 'sks-recht-002', false, 300);
  const datei = alsDatei(await geraet1.ladeSicherung());
  assert.ok(datei.version >= 2, 'ab Version 2 mit Prüfstatus');
  assert.deepEqual(Object.keys(datei.pruefstatus), ['sks']);

  const geraet2 = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await geraet2.setzePruefstatus('sks', 'sks-recht-002', true, 200); // älter als das Zurücknehmen auf Gerät 1
  await geraet2.setzePruefstatus('sks', 'sks-recht-003', true, 50);
  const { sicherung, verworfen } = pruefeSicherung(datei);
  assert.equal(verworfen, 0);
  const ergebnis = await geraet2.importiere(sicherung);
  assert.equal(ergebnis.pruefstatus, 2);
  assert.deepEqual((await geraet2.ladePruefstatus('sks')).pruefstatus.fragen, {
    'sks-recht-001': { geprueft: true, geaendert: 100 },
    'sks-recht-002': { geprueft: false, geaendert: 300 },
    'sks-recht-003': { geprueft: true, geaendert: 50 },
  });
  assert.equal((await geraet2.importiere(sicherung)).pruefstatus, 0, 'zweiter Import ändert nichts');
});

test('F-22: Sicherung der Version 1 (ohne Prüfstatus) wird weiter gelesen', () => {
  const alt = { app: 'trainer-engine', art: 'sicherung', version: 1, erstellt: '2026-11-14T10:00:00.000Z', profil: null, lernstand: {}, antworten: [] };
  const { sicherung } = pruefeSicherung(alt);
  assert.deepEqual(sicherung.pruefstaende, {});
  assert.throws(() => pruefeSicherung({ ...alt, version: 99 }), (e) => e.code === 'sicherung.neuereVersion');
  assert.throws(() => pruefeSicherung({ ...alt, version: 2, pruefstatus: [] }), (e) => e.code === 'sicherung.unlesbar');
  assert.throws(() => pruefeSicherung({ ...alt, version: 2, pruefstatus: { sks: { version: 9, fragen: {} } } }),
    (e) => e.code === 'sicherung.neuereVersion');
});

test('F-39: Statistik zählt geprüfte Freitextfragen je Thema', () => {
  const m = {
    themen: [{ id: 't-a' }, { id: 't-b' }],
    fragen: [
      freitext('t-1'), freitext('t-2', 'geprueft'), freitext('t-3', 'ungeprueft', 't-b'),
      { id: 't-4', thema: 't-b', typ: 'mc' },
    ],
  };
  const stand = setzePruefstatus(setzePruefstatus(neuerPruefstatus(), 't-1', true, 1), 't-2', false, 2);
  const { themen, gesamt } = pruefstandJeThema(m, stand);
  assert.deepEqual(themen.get('t-a'), { gesamt: 2, geprueft: 1 });
  assert.deepEqual(themen.get('t-b'), { gesamt: 1, geprueft: 0 });
  assert.deepEqual(gesamt, { gesamt: 3, geprueft: 1 });
});

// --- FKN-Modul (nur lokal) ------------------------------------------------

let fknText = null;
try {
  fknText = await lies('privat/fkn/fkn.json');
} catch {
  // Datei fehlt: Test wird übersprungen.
}

test('FKN-Modul (privat/fkn/fkn.json) läuft ohne Änderung an der Engine',
  { skip: fknText ? false : 'privat/fkn/fkn.json fehlt (wird nie committet)' }, () => {
    const fkn = leseModul(fknText);
    assert.equal(fkn.meta.id, 'fkn');
    assert.equal(fkn.meta.herkunft, 'verband');
    assert.equal(fkn.fragen.length, 60);
    const ids = fkn.fragen.map((f) => f.id);
    assert.equal(new Set(ids).size, 60);
    assert.equal(ids[0], 'fkn-001');
    assert.equal(ids[59], 'fkn-060');

    const mcFragen = fkn.fragen.filter((f) => f.typ === 'mc');
    assert.deepEqual(mcFragen.map((f) => Number(f.id.slice(4))), [11, 12, 16, 26, 31, 41, 42, 52, 53, 56, 58]);
    assert.deepEqual(mcFragen.filter(istMehrfach).map((f) => Number(f.id.slice(4))), [12, 26, 31, 53]);
    for (const f of fkn.fragen.filter((x) => x.typ === 'freitext')) {
      assert.equal(f.kernpunkteStatus, 'ungeprueft', `${f.id}: Kernpunkte ungeprüft`);
      assert.ok(f.kernpunkte.length >= 1, `${f.id}: Kernpunkte`);
    }

    // Prüfungsordnung FKN: 15 Fragen, 30 Minuten, 2 Punkte je Frage, bestanden ab 24 von 30.
    const regeln = pruefungsregeln(fkn);
    assert.equal(regeln.fragen, 15);
    assert.equal(regeln.minuten, 30);
    assert.equal(regeln.punkteJeFrage, 2);
    assert.equal(regeln.bestehenAb, 24);
    assert.equal(regeln.maxPunkte, 30);
    const bogen = bildePruefbogen(fkn);
    assert.equal(bogen.length, 15);
    const alleRichtig = new Map(bogen.map((f) => [f.id, true]));
    assert.equal(werteAus(fkn, bogen, alleRichtig).bestanden, true);
    const dreiFalsch = new Map(bogen.map((f, i) => [f.id, i >= 3]));
    assert.equal(werteAus(fkn, bogen, dreiFalsch).punkte, 24);
    assert.equal(werteAus(fkn, bogen, dreiFalsch).bestanden, true);
    const vierFalsch = new Map(bogen.map((f, i) => [f.id, i >= 4]));
    assert.equal(werteAus(fkn, bogen, vierFalsch).bestanden, false);
  });
