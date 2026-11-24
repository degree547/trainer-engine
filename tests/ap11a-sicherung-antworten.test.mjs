// Tests für AP11A: Sicherung nach jeder Runde (F-41), Laden beim leeren Start (F-42),
// Antworten aller Fragetypen im erweiterten Format (F-43, F-44).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  oeffneSpeicher, pruefeSicherung, antwortEintrag, freitextEintrag, istGueltigeAntwort, istLeereSicherung,
  frageInhalt, migriere, SICHERUNG_VERSION,
} from '../src/engine/m7-speicherung.js';
import { neuerLernstand, bewerte } from '../src/engine/m2-lernlogik.js';
import { vergibAntwort } from '../src/engine/m4-gamification.js';
import { erzeugeIndexedDB } from './hilfen/fake-indexeddb.mjs';

const HEUTE = '2026-11-24';
const lies = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), 'utf8');
const alsDatei = (inhalt) => JSON.parse(JSON.stringify(inhalt));

const modul = { meta: { id: 'sks', stand: '2006-07-01' } };
const freitext = {
  id: 'sks-recht-001', thema: 'recht', typ: 'freitext', frage: 'Was gilt?', erklaerung: '',
  musterantwort: 'Dies und das.', kernpunkte: ['dies', 'das'], kernpunkteStatus: 'ungeprueft', quelle: 'Katalog',
};
const mc = {
  id: 'sks-nav-002', thema: 'nav', typ: 'mc', frage: 'Welche?', erklaerung: 'Weil.',
  optionen: ['a', 'b', 'c'], richtig: [0, 2], quelle: 'Katalog',
};
const zahl = {
  id: 'sks-gen-kurs', thema: 'nav', typ: 'zahl', frage: 'MgK 045°, Abl. +3°: rwK?', erklaerung: 'rwK = 048°',
  loesung: 48, toleranz: 0, einheit: '°', kreis: 360, quelle: 'Generator',
};

test('F-43, F-44: Freitext-Eintrag mit Text, abgehakten Kernpunkten, Katalogstand und Frage', () => {
  const e = antwortEintrag({ modul, frage: freitext, gewusst: false, modus: 'normal', antwort: { text: 'Dies', abgehakt: new Set([0]) } }, 10);
  assert.equal(e.modul, 'sks');
  assert.equal(e.stand, '2006-07-01');
  assert.equal(e.frage, 'sks-recht-001');
  assert.equal(e.typ, 'freitext');
  assert.equal(e.zeit, 10);
  assert.equal(e.modus, 'normal');
  assert.equal(e.gewusst, false);
  assert.equal(e.text, 'Dies');
  assert.deepEqual(e.abgehakt, [0]);
  assert.deepEqual(e.inhalt, {
    thema: 'recht', frage: 'Was gilt?', erklaerung: '', musterantwort: 'Dies und das.', kernpunkte: ['dies', 'das'],
  });
  assert.ok(istGueltigeAntwort(e));
});

test('F-43, F-44: Multiple Choice speichert gewählte Optionen, Optionen und richtige Antwort', () => {
  const e = antwortEintrag({ modul, frage: mc, gewusst: true, modus: 'vorziehen', antwort: { gewaehlt: new Set([2, 0]) } }, 11);
  assert.deepEqual(e.gewaehlt, [0, 2]);
  assert.deepEqual(e.inhalt.optionen, ['a', 'b', 'c']);
  assert.deepEqual(e.inhalt.richtig, [0, 2]);
  assert.equal(e.text, undefined);
  assert.ok(istGueltigeAntwort(e));
  const einfach = antwortEintrag({ modul, frage: { ...mc, richtig: 1 }, gewusst: false, modus: 'normal', antwort: { gewaehlt: 0 } }, 12);
  assert.deepEqual(einfach.gewaehlt, [0]);
  const leer = antwortEintrag({ modul, frage: mc, gewusst: false, modus: 'simulation', antwort: { gewaehlt: null } }, 13);
  assert.deepEqual(leer.gewaehlt, []);
  assert.ok(istGueltigeAntwort(leer));
});

test('F-43, F-44: Zahl speichert die Eingabe und die gezogene Aufgabe samt Lösung', () => {
  const e = antwortEintrag({ modul, frage: zahl, gewusst: true, modus: 'fehler', antwort: { eingabe: '048' } }, 14);
  assert.equal(e.eingabe, '048');
  assert.deepEqual(e.inhalt, {
    thema: 'nav', frage: 'MgK 045°, Abl. +3°: rwK?', erklaerung: 'rwK = 048°', loesung: 48, toleranz: 0, einheit: '°', kreis: 360,
  });
  assert.ok(istGueltigeAntwort(e));
});

test('F-44: Die gespeicherte Frage ist eine Kopie, spätere Änderungen am Modul wirken nicht', () => {
  const frage = structuredClone(freitext);
  const inhalt = frageInhalt(frage);
  frage.kernpunkte.push('neu');
  assert.deepEqual(inhalt.kernpunkte, ['dies', 'das']);
});

test('F-43: Prüfung der Einträge, alte Freitext-Einträge (F-34) bleiben gültig', () => {
  assert.ok(istGueltigeAntwort(freitextEintrag({ modul: 'sks', frage: 'a', text: 't', gewusst: true, modus: 'normal' }, 1)));
  const gut = antwortEintrag({ modul, frage: mc, gewusst: true, modus: 'normal', antwort: { gewaehlt: 0 } }, 1);
  assert.equal(istGueltigeAntwort({ ...gut, typ: 'bild' }), false);
  assert.equal(istGueltigeAntwort({ ...gut, gewaehlt: 'a' }), false);
  assert.equal(istGueltigeAntwort({ ...gut, gewaehlt: [-1] }), false);
  assert.equal(istGueltigeAntwort({ ...gut, modus: 'quiz' }), false);
  assert.equal(istGueltigeAntwort({ ...gut, stand: 2006 }), false);
  assert.equal(istGueltigeAntwort({ ...gut, inhalt: [] }), false);
  const z = antwortEintrag({ modul, frage: zahl, gewusst: true, modus: 'normal', antwort: { eingabe: '1' } }, 1);
  assert.equal(istGueltigeAntwort({ ...z, eingabe: 1 }), false);
  const f = antwortEintrag({ modul, frage: freitext, gewusst: true, modus: 'normal', antwort: { text: 'x' } }, 1);
  assert.equal(istGueltigeAntwort({ ...f, abgehakt: [1.5] }), false);
  assert.equal(istGueltigeAntwort({ ...f, text: undefined }), false);
  assert.equal(istGueltigeAntwort({ ...modul, ...f, modul: '' }), false);
});

test('F-43: Umstellung eines Lernstands der Version 1 zählt nur Freitext-Antworten aus Runden', () => {
  const alt = { karten: { 'sks-nav-002': { fach: 1, faellig: HEUTE }, 'sks-recht-001': { fach: 1, faellig: HEUTE } } };
  const antworten = [
    antwortEintrag({ modul, frage: mc, gewusst: true, modus: 'normal', antwort: { gewaehlt: 0 } }, 1),
    antwortEintrag({ modul, frage: freitext, gewusst: true, modus: 'simulation', antwort: { text: 'x' } }, 2),
    antwortEintrag({ modul, frage: freitext, gewusst: false, modus: 'normal', antwort: { text: 'y' } }, 3),
  ];
  const { lernstand } = migriere(alt, antworten);
  assert.equal(lernstand.karten['sks-nav-002'].richtig, 0);
  assert.equal(lernstand.karten['sks-recht-001'].richtig, 0);
  assert.equal(lernstand.karten['sks-recht-001'].falsch, 1);
});

test('F-43, F-22: Antworten aller Typen stecken in der Sicherung (Version 3) und kommen beim Import ohne Doppelte an', async () => {
  const geraet1 = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await geraet1.speichereAntwort(antwortEintrag({ modul, frage: freitext, gewusst: true, modus: 'normal', antwort: { text: 'x', abgehakt: [0, 1] } }, 1));
  await geraet1.speichereAntwort(antwortEintrag({ modul, frage: mc, gewusst: false, modus: 'normal', antwort: { gewaehlt: [1] } }, 2));
  await geraet1.speichereAntwort(antwortEintrag({ modul, frage: zahl, gewusst: true, modus: 'simulation', antwort: { eingabe: '48' } }, 3));
  const datei = alsDatei(await geraet1.ladeSicherung());
  assert.equal(datei.version, 3);
  assert.equal(SICHERUNG_VERSION, 3);
  assert.deepEqual(datei.antworten.map((e) => e.typ), ['freitext', 'mc', 'zahl']);
  assert.equal(datei.antworten[2].inhalt.frage, 'MgK 045°, Abl. +3°: rwK?');

  const { sicherung, verworfen } = pruefeSicherung(datei);
  assert.equal(verworfen, 0);
  const geraet2 = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  assert.equal((await geraet2.importiere(sicherung)).antworten, 3);
  assert.equal((await geraet2.importiere(sicherung)).antworten, 0, 'zweiter Import ändert nichts');
  const { antworten } = await geraet2.ladeAntworten('sks');
  assert.deepEqual(antworten, datei.antworten);
});

test('F-43: Sicherungen der Version 2 mit alten Freitext-Einträgen werden weiter gelesen', () => {
  const alt = {
    app: 'trainer-engine', art: 'sicherung', version: 2, erstellt: '2026-11-22T10:00:00.000Z', profil: null, lernstand: {},
    antworten: [freitextEintrag({ modul: 'sks', frage: 'sks-recht-001', text: 't', gewusst: true, modus: 'normal' }, 5)],
    pruefstatus: {},
  };
  const { sicherung, verworfen } = pruefeSicherung(alt);
  assert.equal(verworfen, 0);
  assert.equal(sicherung.antworten.length, 1);
});

test('F-42: Leerer Start heißt: keine Karte und keine XP', async () => {
  const speicher = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  assert.equal(istLeereSicherung(await speicher.ladeSicherung()), true, 'frisches Gerät');
  await speicher.speichere('sks', neuerLernstand());
  assert.equal(istLeereSicherung(await speicher.ladeSicherung()), true, 'Lernstand ohne Karten');

  const mitKarte = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await mitKarte.speichere('sks', bewerte(neuerLernstand(), 'sks-nav-001', false, HEUTE, { jetzt: 1 }));
  assert.equal(istLeereSicherung(await mitKarte.ladeSicherung()), false, 'eine Karte');

  const mitXp = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await mitXp.aendereProfil((p) => vergibAntwort(p, { richtig: true, modus: 'normal' }, HEUTE));
  assert.equal(istLeereSicherung(await mitXp.ladeSicherung()), false, 'XP ohne Lernstand');
  assert.equal(istLeereSicherung(null), true);
});

test('F-41, F-42: App bietet Sichern am Rundenende und Laden beim leeren Start an; Texte in beiden Sprachen', async () => {
  const app = await lies('src/app.js');
  assert.match(app, /navigator\.canShare\?\.\(\{ files: \[datei\] \}\)/, 'Teilen-Menü, wenn Dateien teilbar sind');
  assert.match(app, /navigator\.share\(/);
  assert.match(app, /AbortError/, 'Abbrechen des Teilen-Menüs ist kein Fehler');
  assert.match(app, /ladeHerunter\(json, name\)/, 'sonst Download');
  assert.match(app, /onSichern: sichernKnopf\(\)/);
  assert.match(app, /istLeereSicherung\(/);
  assert.match(await lies('src/ui/runde.js'), /sicherungskarte\(runde\.onSichern\)/);
  assert.match(await lies('src/ui/pruefung.js'), /sicherungskarte\(sim\.onSichern\)/);
  assert.match(await lies('src/ui/start.js'), /leerstartkarte\(/);
  const sw = await lies('sw.js');
  assert.match(sw, /'src\/ui\/sichern\.js'/);
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const en = JSON.parse(await lies('src/i18n/en.json'));
  for (const k of ['sicherung.sichern', 'sicherung.nochmalSichern', 'sicherung.nachRunde', 'sicherung.geteilt',
    'leerstart.titel', 'leerstart.erklaerung', 'leerstart.laden', 'leerstart.neu']) {
    assert.ok(de[k], `de: ${k}`);
    assert.ok(en[k], `en: ${k}`);
  }
});
