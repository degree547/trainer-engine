// Tests für AP8: Sicherung exportieren und importieren (F-22, F-34), Fortschritt übersteht
// ein Modul-Update (F-23), Sprachwahl.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  oeffneSpeicher, pruefeSicherung, baueSicherung, dateinameSicherung, freitextEintrag, SpeicherFehler,
  SICHERUNG_VERSION,
} from '../src/engine/m7-speicherung.js';
import { neuerLernstand, bewerte, lernUebersicht, LERNSTAND_VERSION } from '../src/engine/m2-lernlogik.js';
import { vergibAntwort, schliesseRundeAb, gesamtXp, streakVon } from '../src/engine/m4-gamification.js';
import { fortschrittJeThema } from '../src/engine/m5-statistik.js';
import { spracheAusBrowser, bevorzugteSprache, merkeSprache } from '../src/ui/i18n.js';
import { erzeugeIndexedDB } from './hilfen/fake-indexeddb.mjs';

const HEUTE = '2026-11-22';
const lies = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), 'utf8');

/** Ein Gerät mit eigenem Speicher, auf dem eine Runde gespielt wurde. */
async function geraetMitRunde(fragen, { jetzt = 1, tag = HEUTE } = {}) {
  const speicher = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  let ls = neuerLernstand();
  for (const [i, id] of fragen.entries()) {
    ls = bewerte(ls, id, true, tag, { jetzt: jetzt + i });
    await speicher.speichereAntwort(freitextEintrag(
      { modul: 'sks', frage: id, text: `Antwort ${id}`, gewusst: true, modus: 'normal' }, jetzt + i));
    await speicher.aendereProfil((p) => vergibAntwort(p, { richtig: true, modus: 'normal' }, tag));
  }
  await speicher.aendereProfil((p) => schliesseRundeAb(p, { modus: 'normal', beantwortet: 1, gesamt: 1, fehler: 0 }, tag));
  await speicher.speichere('sks', ls);
  return speicher;
}

/** Wie in der App: Datei als Text schreiben und wieder lesen. */
const alsDatei = (inhalt) => JSON.parse(JSON.stringify(inhalt));

test('F-22: Export enthält Lernstand aller Module, Profil und Freitext-Antworten (F-34)', async () => {
  const speicher = await geraetMitRunde(['sks-nav-001', 'sks-nav-002']);
  await speicher.speichere('beispiel', bewerte(neuerLernstand(), 'bsp-001', false, HEUTE, { jetzt: 9 }));
  const s = await speicher.ladeSicherung(Date.UTC(2026, 10, 22, 18));

  assert.equal(s.app, 'trainer-engine');
  assert.equal(s.art, 'sicherung');
  assert.equal(s.version, SICHERUNG_VERSION);
  assert.equal(s.erstellt, '2026-11-22T18:00:00.000Z');
  assert.deepEqual(Object.keys(s.lernstand).sort(), ['beispiel', 'sks']);
  assert.deepEqual(Object.keys(s.lernstand.sks.karten).sort(), ['sks-nav-001', 'sks-nav-002']);
  assert.equal(s.antworten.length, 2);
  assert.equal(s.antworten[0].text, 'Antwort sks-nav-001');
  assert.equal(gesamtXp(s.profil), 2 * 10 + 20);
  assert.equal(dateinameSicherung(HEUTE), 'trainer-engine-sicherung-2026-11-22.json');
});

test('Export und Import auf einem zweiten Gerät stellen Streak, XP, Fächer und Antworten wieder her', async () => {
  const geraet1 = await geraetMitRunde(['sks-nav-001', 'sks-nav-002']);
  const datei = alsDatei(await geraet1.ladeSicherung());

  const geraet2 = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  const eigeneId = (await geraet2.ladeProfil()).profil.geraet;
  const { sicherung, verworfen } = pruefeSicherung(datei);
  assert.equal(verworfen, 0);
  const ergebnis = await geraet2.importiere(sicherung);
  assert.deepEqual(ergebnis, { module: 1, karten: 2, antworten: 2 });

  assert.deepEqual((await geraet2.lade('sks')).lernstand, (await geraet1.lade('sks')).lernstand);
  const { profil } = await geraet2.ladeProfil();
  assert.equal(profil.geraet, eigeneId, 'Gerät 2 behält seine eigene Geräte-ID');
  assert.equal(gesamtXp(profil), 40);
  assert.equal(streakVon(profil, HEUTE).tage, 1);
  assert.equal((await geraet2.ladeAntworten('sks')).antworten.length, 2);
});

test('dieselbe Sicherung zweimal importiert zählt nichts doppelt', async () => {
  const geraet1 = await geraetMitRunde(['sks-nav-001']);
  const { sicherung } = pruefeSicherung(alsDatei(await geraet1.ladeSicherung()));
  const geraet2 = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await geraet2.importiere(sicherung);
  const zweites = await geraet2.importiere(sicherung);
  assert.deepEqual(zweites, { module: 1, karten: 0, antworten: 0 });
  assert.equal(gesamtXp((await geraet2.ladeProfil()).profil), 30);
  assert.equal((await geraet2.ladeAntworten()).antworten.length, 1);
});

test('Import führt zusammen: jüngere Karte gewinnt, Lernstand beider Geräte bleibt', async () => {
  const geraet1 = await geraetMitRunde(['sks-nav-001', 'sks-nav-002'], { jetzt: 100 });
  const geraet2 = await geraetMitRunde(['sks-nav-002', 'sks-nav-003'], { jetzt: 200, tag: '2026-11-23' });
  // Auf Gerät 2 ist sks-nav-002 jünger; nach dem Import von Gerät 1 muss sie so bleiben.
  const vorher = (await geraet2.lade('sks')).lernstand.karten['sks-nav-002'];
  const ergebnis = await geraet2.importiere(pruefeSicherung(alsDatei(await geraet1.ladeSicherung())).sicherung);
  assert.equal(ergebnis.karten, 1);

  const { karten } = (await geraet2.lade('sks')).lernstand;
  assert.deepEqual(Object.keys(karten).sort(), ['sks-nav-001', 'sks-nav-002', 'sks-nav-003']);
  assert.deepEqual(karten['sks-nav-002'], vorher);
  const { profil } = await geraet2.ladeProfil();
  assert.equal(gesamtXp(profil), 40 + 40, 'XP beider Geräte zählen');
  assert.equal(streakVon(profil, '2026-11-23').tage, 2);
  assert.equal((await geraet2.ladeAntworten()).antworten.length, 4);
});

test('pruefeSicherung lehnt falsche Dateien ab, ohne etwas zu übernehmen', () => {
  const code = (daten) => {
    try { pruefeSicherung(daten); } catch (fehler) { assert.ok(fehler instanceof SpeicherFehler); return fehler.code; }
    return 'angenommen';
  };
  assert.equal(code(null), 'sicherung.keineSicherung');
  assert.equal(code([]), 'sicherung.keineSicherung');
  assert.equal(code({ hallo: 1 }), 'sicherung.keineSicherung');
  assert.equal(code({ format: 1, meta: {}, themen: [], fragen: [] }), 'sicherung.istModul');
  const gut = baueSicherung({ profil: null, lernstaende: {}, antworten: [] });
  assert.equal(code(gut), 'angenommen');
  assert.equal(code({ ...gut, version: SICHERUNG_VERSION + 1 }), 'sicherung.neuereVersion');
  assert.equal(code({ ...gut, version: 'eins' }), 'sicherung.unlesbar');
  assert.equal(code({ ...gut, lernstand: [] }), 'sicherung.unlesbar');
  assert.equal(code({ ...gut, lernstand: { sks: { karten: 'x' } } }), 'sicherung.unlesbar');
  assert.equal(code({ ...gut, lernstand: { sks: { version: LERNSTAND_VERSION + 1, karten: {} } } }), 'sicherung.neuereVersion');
  assert.equal(code({ ...gut, profil: { version: 1 } }), 'sicherung.unlesbar');
});

test('beschädigte Einträge in der Sicherung werden übersprungen und gezählt', () => {
  const s = baueSicherung({
    profil: null,
    lernstaende: { sks: { version: LERNSTAND_VERSION, karten: { gut: { fach: 2, faellig: HEUTE, geaendert: 1 }, kaputt: { fach: 9 } } } },
    antworten: [{ id: 'x' }],
  });
  const { sicherung, verworfen } = pruefeSicherung(s);
  assert.equal(verworfen, 2);
  assert.deepEqual(Object.keys(sicherung.lernstaende.sks.karten), ['gut']);
  assert.deepEqual(sicherung.antworten, []);
});

test('Sicherung mit Lernstand der Version 1 wird beim Import umgestellt', async () => {
  const antwort = freitextEintrag({ modul: 'sks', frage: 'a', text: 't', gewusst: false, modus: 'normal' }, 5);
  const s = baueSicherung({ profil: null, lernstaende: { sks: { karten: { a: { fach: 1, faellig: HEUTE, geaendert: 5 } } } }, antworten: [antwort] });
  const { sicherung } = pruefeSicherung(alsDatei(s));
  assert.equal(sicherung.lernstaende.sks.version, LERNSTAND_VERSION);
  assert.equal(sicherung.lernstaende.sks.karten.a.falsch, 1);
});

test('fehlgeschlagener Import ändert nichts', async () => {
  const indexedDB = erzeugeIndexedDB();
  const speicher = await geraetMitRunde(['sks-nav-001']);
  const { sicherung } = pruefeSicherung(alsDatei(await speicher.ladeSicherung()));
  const ziel = await oeffneSpeicher({ indexedDB });
  await ziel.speichere('sks', bewerte(neuerLernstand(), 'sks-nav-009', true, HEUTE, { jetzt: 1 }));
  indexedDB.schreibfehler = true;
  await assert.rejects(ziel.importiere(sicherung));
  indexedDB.schreibfehler = false;
  assert.deepEqual(Object.keys((await ziel.lade('sks')).lernstand.karten), ['sks-nav-009']);
});

test('F-23: Lernstand übersteht ein Modul-Update (Frage entfällt, Frage kommt dazu)', async () => {
  const alt = {
    themen: [{ id: 'nav', titel: 'Navigation' }],
    fragen: [{ id: 'q-1', thema: 'nav' }, { id: 'q-2', thema: 'nav' }],
  };
  const neu = {
    themen: [{ id: 'nav', titel: 'Navigation' }],
    fragen: [{ id: 'q-2', thema: 'nav' }, { id: 'q-3', thema: 'nav' }],
  };
  let ls = bewerte(neuerLernstand(), 'q-1', true, HEUTE, { jetzt: 1 });
  ls = bewerte(ls, 'q-2', true, HEUTE, { jetzt: 2 });
  const speicher = await oeffneSpeicher({ indexedDB: erzeugeIndexedDB() });
  await speicher.speichere('m', ls);
  assert.equal(lernUebersicht(alt, ls, HEUTE).neu, 0);

  const geladen = (await speicher.lade('m')).lernstand;
  const u = lernUebersicht(neu, geladen, HEUTE);
  assert.equal(u.neu, 1, 'die neue Frage q-3 ist neu');
  assert.equal(u.spaeter, 1, 'q-2 behält ihr Fach');
  assert.equal(fortschrittJeThema(neu, geladen).themen[0].gesamt, 2, 'die entfallene Frage zählt nicht mit');
  // Die Karte der entfallenen Frage bleibt gespeichert und kommt in die Sicherung.
  assert.ok((await speicher.ladeSicherung()).lernstand.m.karten['q-1']);
});

test('Sprachwahl: gemerkte Sprache, sonst die des Browsers, sonst Deutsch', () => {
  assert.equal(spracheAusBrowser(['en-GB', 'de-DE']), 'en');
  assert.equal(spracheAusBrowser(['fr-FR', 'de-AT']), 'de');
  assert.equal(spracheAusBrowser(['fr-FR']), 'de');
  assert.equal(spracheAusBrowser([]), 'de');

  const ablage = new Map();
  const speicher = { getItem: (k) => ablage.get(k) ?? null, setItem: (k, v) => ablage.set(k, v) };
  merkeSprache('en', speicher);
  assert.equal(bevorzugteSprache(speicher), 'en');
  merkeSprache('fr', speicher);
  assert.equal(bevorzugteSprache(speicher), 'de', 'unbekannte Sprache wird als Deutsch gemerkt');
  const kaputt = { getItem: () => { throw new Error('gesperrt'); } };
  assert.ok(['de', 'en'].includes(bevorzugteSprache(kaputt)));
});

test('jeder Sicherungs-Code hat einen Text in beiden Sprachen', async () => {
  const de = JSON.parse(await lies('src/i18n/de.json'));
  const en = JSON.parse(await lies('src/i18n/en.json'));
  const quelltext = (await lies('src/engine/m7-speicherung.js')) + (await lies('src/app.js')) + (await lies('src/ui/start.js'));
  const codes = new Set(quelltext.match(/'(sicherung|einstellungen|sprache)\.\w+'/g).map((c) => c.slice(1, -1)));
  for (const s of ['de', 'en']) codes.add(`sprache.${s}`);
  assert.ok(codes.size >= 12);
  for (const code of codes) {
    assert.ok(code in de, `Text fehlt in de.json für ${code}`);
    assert.ok(code in en, `Text fehlt in en.json für ${code}`);
  }
});
