// Tests für AP9B: Navigationsrechnungen im SKS-Modul (F-28, M9).
// 1. Die amtliche Steuertafel und die Regel zum Ablesen (linear, kaufmännisch gerundet)
//    gegen die Ablenkungswerte aus den amtlichen Lösungen (ELWIS).
// 2. Jeder freigegebene Generator gegen amtliche und selbst gerechnete Fälle (tests/hilfen).
// 3. Die Beispiele aus dem Buch: Sie liegen nur in privat/buch/beispiele.json (nie committet);
//    fehlt die Datei, wird dieser Teil übersprungen.
// 4. Zufallsproben: Jede erzeugte Aufgabe ist vollständig und rechnerisch stimmig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  erzeugeAufgabe, freigegebeneGeneratoren, ausTabelle, runde, rechne, fuelle, FUNKTIONEN,
} from '../src/engine/m9-generatoren.js';
import { pruefeModul } from '../src/engine/m8-inhaltsformat.js';
import { abweichung } from '../src/engine/m3-fragetypen.js';
import { FAELLE, ABL_AMTLICH, GEPRUEFT } from './hilfen/navigation-faelle.mjs';

const modul = JSON.parse(await readFile(new URL('../content/sks/sks.json', import.meta.url), 'utf8'));
const tabellen = modul.tabellen;
const generator = (id) => modul.generatoren.find((g) => g.id === id);

let buch = null;
try {
  buch = JSON.parse(await readFile(new URL('../privat/buch/beispiele.json', import.meta.url), 'utf8'));
} catch {
  buch = null;
}

/** Prüft eine Aufgabe gegen die erwartete Lösung mit der Toleranz des Generators. */
function pruefeFall(id, fall) {
  const g = generator(id);
  assert.ok(g, `Generator ${id} fehlt`);
  const aufgabe = erzeugeAufgabe(g, { werte: fall.werte, tabellen });
  const ab = Math.abs(abweichung(aufgabe, fall.erwartet));
  assert.ok(ab <= g.toleranz + 1e-9,
    `${id} (${fall.quelle}): erwartet ${fall.erwartet}, gerechnet ${aufgabe.loesung} (Toleranz ${g.toleranz})`);
  return aufgabe;
}

// --- 1. Steuertafel ----------------------------------------------------------

test('Steuertafel: 37 Werte je Spalte (000° bis 360°), amtlich, 000° und 360° gleich', () => {
  for (const name of ['ablMgK', 'ablMwK']) {
    const t = tabellen[name];
    assert.equal(t.werte.length, 37, name);
    assert.equal(t.herkunft, 'amtlich');
    assert.equal(t.werte[0], t.werte[36], name);
  }
  // Stichproben vom Foto der Steuertafel (Begleitheft, Ausgabe 2013).
  assert.equal(tabellen.ablMgK.werte[8], 12); // MgK 080° → +12°
  assert.equal(tabellen.ablMgK.werte[25], 0); // MgK 250° → 0°
  assert.equal(tabellen.ablMgK.werte[31], -11); // MgK 310° → −11°
  assert.equal(tabellen.ablMwK.werte[10], 11); // mwK 100° → +11°
  assert.equal(tabellen.ablMwK.werte[28], -9); // mwK 280° → −9°
});

test('Steuertafel: Ablesen linear und kaufmännisch gerundet trifft alle Werte der amtlichen Lösungen', () => {
  for (const [spalte, kurs, abl] of ABL_AMTLICH) {
    const t = spalte === 'MgK' ? tabellen.ablMgK : tabellen.ablMwK;
    assert.equal(runde(ausTabelle(t, kurs)), abl, `${spalte} ${kurs}°`);
  }
  // Amtliche Vergleiche mit der Tabelle: „Abl für MgK 117° nach Deviationstabelle = +8°“,
  // „Deviationstabelle für MgK 157°: +4°“.
  assert.equal(runde(ausTabelle(tabellen.ablMgK, 117)), 8);
  assert.equal(runde(ausTabelle(tabellen.ablMgK, 157)), 4);
});

test('M9: Tabellen in Formeln, winkel() und sign()', () => {
  assert.equal(rechne('ablMgK(85)', {}, tabellen), 11.5);
  assert.equal(rechne('ablMgK(365)', {}, tabellen), -2.5); // Kreis: 365° = 005°
  assert.equal(FUNKTIONEN.winkel.f(350, 10), 20);
  assert.equal(FUNKTIONEN.winkel.f(10, 350), -20);
  assert.equal(FUNKTIONEN.winkel.f(0, 180), 180);
  assert.equal(FUNKTIONEN.sign.f(-3), -1);
  assert.throws(() => ausTabelle({ von: 0, schritt: 10, werte: [1, 2] }, 11), /formel.tabelleBereich/);
});

test('M9: Platzhalter mit Format und Listentext', () => {
  const werte = { k: 45, z: 360, a: -3, b: 4, n: 0, w: 270 };
  assert.equal(fuelle('{k:kurs} {z:kurs} {z:tafel} {a:vz} {b:vz} {n:vz} {w}', werte, String, { w: 'W' }),
    '045 000 360 -3 +4 0 W');
});

test('M8: Tabellen, Listen, Zwischenwerte und Bedingung werden geprüft', () => {
  const basis = (g = {}, extra = {}) => ({
    format: 1,
    meta: { id: 't', titel: 'Test', sprache: 'de', version: '1', stand: '2026-11-20' },
    themen: [{ id: 't-a', titel: 'A' }],
    fragen: [],
    tabellen: { tab: { von: 0, schritt: 10, werte: [0, 10] } },
    generatoren: [{
      id: 't-gen', thema: 't-a', freigegeben: false, frage: '{x} {w}', quelle: 'eigen', erklaerung: '{y}',
      variablen: { x: { von: 0, bis: 10 }, w: { liste: [{ wert: 1, text: 'eins' }, 2] } },
      zwischenwerte: { y: 'tab(x) + w' }, bedingung: 'y - 1', loesung: 'y', toleranz: 0, einheit: '', ...g,
    }],
    ...extra,
  });
  const codes = (m) => pruefeModul(m).map((f) => f.code);
  assert.deepEqual(codes(basis()), []);
  assert.ok(codes(basis({ variablen: { x: { von: 0, bis: 10 }, w: { liste: [] } } })).includes('inhalt.variablenListe'));
  assert.ok(codes(basis({ bedingung: '-1' })).includes('inhalt.bedingungNieErfuellt'));
  assert.ok(codes(basis({ zwischenwerte: { y: 'z + 1' } })).includes('inhalt.formelVariable'));
  assert.ok(codes(basis({ zwischenwerte: { x: '1' } })).includes('inhalt.variablenName'));
  assert.ok(codes(basis({ loesung: 'nichtda(x)' })).includes('inhalt.formelFehler'));
  assert.ok(codes(basis({}, { tabellen: { tab: { von: 0, schritt: 10, werte: [1] } } })).includes('inhalt.tabelleWerte'));
  assert.ok(codes(basis({ frage: '{q}' })).includes('inhalt.platzhalterUnbekannt'));
});

// --- 2. Amtliche und eigene Fälle --------------------------------------------

for (const [id, faelle] of Object.entries(FAELLE)) {
  test(`${id}: amtliche und eigene Fälle`, () => {
    for (const fall of faelle) {
      const aufgabe = pruefeFall(id, fall);
      if (fall.rwp !== undefined) assert.match(aufgabe.frage, new RegExp(`rwP = ${String(fall.rwp).padStart(3, '0')}°`), fall.quelle);
    }
  });
}

test('SKS-Modul: gültig, jeder Generator ist freigegeben und hat Testfälle', () => {
  assert.deepEqual(pruefeModul(modul), []);
  assert.ok(modul.generatoren.length >= 18);
  for (const g of modul.generatoren) {
    assert.equal(g.freigegeben, true, g.id);
    assert.ok(GEPRUEFT.has(g.id), `${g.id} hat keine Testfälle`);
    assert.equal(g.thema, 'sks-nav');
  }
});

// --- 3. Beispiele aus dem Buch (nur lokal) -------------------------------------

test('Buchbeispiele (privat/buch/beispiele.json)', { skip: buch ? false : 'privat/buch/beispiele.json fehlt (wird nie committet)' }, () => {
  let anzahl = 0;
  for (const [id, faelle] of Object.entries(buch.faelle)) {
    for (const fall of faelle) { pruefeFall(id, fall); anzahl += 1; }
  }
  for (const [spalte, kurs, abl, quelle] of buch.ablenkung ?? []) {
    const t = spalte === 'MgK' ? tabellen.ablMgK : tabellen.ablMwK;
    assert.equal(runde(ausTabelle(t, kurs)), abl, `${spalte} ${kurs}° (${quelle})`);
    anzahl += 1;
  }
  assert.ok(anzahl > 0);
});

// --- 4. Zufallsproben ----------------------------------------------------------

function zufallsfolge(start) {
  let z = start >>> 0;
  return () => { z = (Math.imul(z, 1664525) + 1013904223) >>> 0; return z / 2 ** 32; };
}

test('Zufallsproben: jede erzeugte Aufgabe ist vollständig und stimmig', () => {
  const zufall = zufallsfolge(42);
  const zahlText = (n) => String(runde(n, 2)).replace('.', ',');
  for (const g of freigegebeneGeneratoren(modul)) {
    for (let i = 0; i < 300; i += 1) {
      const a = erzeugeAufgabe(g, { zufall, tabellen, zahlText });
      assert.ok(Number.isFinite(a.loesung), g.id);
      assert.doesNotMatch(a.frage, /[{}]/, `${g.id}: ${a.frage}`);
      assert.doesNotMatch(a.erklaerung, /[{}]/, `${g.id}: ${a.erklaerung}`);
      if (g.einheit === '°' && g.kreis) {
        assert.ok(Number.isInteger(a.loesung) && a.loesung >= 0 && a.loesung < 360, `${g.id}: ${a.loesung}`);
      }
      // Die Lösung steht im Rechenweg.
      if (g.kreis) assert.ok(a.erklaerung.includes(String(a.loesung).padStart(3, '0')), `${g.id}: ${a.erklaerung}`);
    }
  }
});

test('Zufallsproben: Kurs vorwärts und zurück passt zusammen', () => {
  // Wer den gerechneten MgK wieder zum rwK beschickt, muss (bis auf 1° durch die zwei
  // Tafelspalten) beim Ausgangskurs landen.
  const vor = generator('sks-gen-kurs-mgk-rwk');
  const zurueck = generator('sks-gen-kurs-rwk-mgk');
  const zufall = zufallsfolge(7);
  for (let i = 0; i < 300; i += 1) {
    const a = erzeugeAufgabe(zurueck, { zufall, tabellen });
    const b = erzeugeAufgabe(vor, { werte: { mgk: a.loesung, mw: a.werte.mw }, tabellen });
    assert.ok(Math.abs(FUNKTIONEN.winkel.f(b.loesung, a.werte.rwk)) <= 1, `rwK ${a.werte.rwk} → MgK ${a.loesung} → rwK ${b.loesung}`);
  }
});
