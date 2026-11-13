// Tests für M3 Fragetypen: Multiple Choice (F-08) und Freitext mit Kernpunkten (F-29, F-30).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  optionsReihenfolge, buchstabe, bewerteMc, istLeer, freitextVorschlag, herkunftVon,
} from '../src/engine/m3-fragetypen.js';

const mc = (extra = {}) => ({ typ: 'mc', optionen: ['a', 'b', 'c', 'd'], richtig: 0, ...extra });
const freitext = (kernpunkte = ['eins', 'zwei', 'drei']) => ({ typ: 'freitext', kernpunkte });

/** Zufallsquelle mit fester Zahlenfolge, damit die Tests wiederholbar sind. */
function folge(...zahlen) {
  let i = 0;
  return () => zahlen[i++ % zahlen.length];
}

test('F-08: MC wird automatisch bewertet, nur die richtige Option zählt', () => {
  const frage = mc({ richtig: 2 });
  assert.equal(bewerteMc(frage, 2), true);
  for (const falsch of [0, 1, 3, null, undefined, '2']) assert.equal(bewerteMc(frage, falsch), false);
});

test('MC: gemischte Reihenfolge enthält jede Option genau einmal', () => {
  for (let n = 0; n < 50; n += 1) {
    const r = optionsReihenfolge(mc());
    assert.deepEqual([...r].sort(), [0, 1, 2, 3]);
  }
});

test('MC: Mischen ist austauschbar und wiederholbar (Fisher-Yates)', () => {
  // Mit lauter Nullen wandert jede Option an den Anfang: Ergebnis ist eindeutig.
  assert.deepEqual(optionsReihenfolge(mc(), folge(0)), [1, 2, 3, 0]);
  // Mit Werten knapp unter 1 bleibt alles an seinem Platz.
  assert.deepEqual(optionsReihenfolge(mc(), folge(0.999)), [0, 1, 2, 3]);
});

test('MC: richtige Antwort landet nicht immer an erster Stelle (z. B. amtlicher Katalog mit Antwort A)', () => {
  const positionen = new Set();
  for (let n = 0; n < 200; n += 1) positionen.add(optionsReihenfolge(mc({ richtig: 0 })).indexOf(0));
  assert.deepEqual([...positionen].sort(), [0, 1, 2, 3]);
});

test('MC: "mischen": false behält die Reihenfolge des Moduls (z. B. „Alle oben genannten“)', () => {
  assert.deepEqual(optionsReihenfolge(mc({ mischen: false }), folge(0)), [0, 1, 2, 3]);
  assert.deepEqual(optionsReihenfolge(mc({ mischen: true }), folge(0)), [1, 2, 3, 0]);
});

test('MC: Buchstaben zur Anzeigeposition', () => {
  assert.deepEqual([0, 1, 2, 3].map(buchstabe), ['A', 'B', 'C', 'D']);
});

test('Freitext: leere Antwort erkennen', () => {
  for (const leer of ['', '   ', '\n\t', undefined, null]) assert.equal(istLeer(leer), true);
  assert.equal(istLeer(' Licht '), false);
});

test('F-29: Vorschlag „gewusst“ nur, wenn alle Kernpunkte abgehakt sind', () => {
  const frage = freitext();
  assert.deepEqual(freitextVorschlag(frage, []), { gewusst: false, abgehakt: 0, gesamt: 3 });
  assert.deepEqual(freitextVorschlag(frage, [0, 2]), { gewusst: false, abgehakt: 2, gesamt: 3 });
  assert.deepEqual(freitextVorschlag(frage, new Set([2, 0, 1])), { gewusst: true, abgehakt: 3, gesamt: 3 });
  assert.deepEqual(freitextVorschlag(freitext(['nur einer']), [0]), { gewusst: true, abgehakt: 1, gesamt: 1 });
});

test('F-29: ungültige oder doppelte Häkchen zählen nicht', () => {
  const frage = freitext();
  assert.deepEqual(freitextVorschlag(frage, [0, 0, 1, 1]), { gewusst: false, abgehakt: 2, gesamt: 3 });
  assert.deepEqual(freitextVorschlag(frage, [0, 1, 3, -1, '2']), { gewusst: false, abgehakt: 2, gesamt: 3 });
});

test('F-30: Herkunft der Antwort aus der Frage, sonst aus dem Modul', () => {
  const modul = { meta: { herkunft: 'amtlich' } };
  assert.equal(herkunftVon({ herkunft: 'buch' }, modul), 'buch');
  assert.equal(herkunftVon({}, modul), 'amtlich');
  assert.equal(herkunftVon({}, { meta: {} }), '');
  assert.equal(herkunftVon({}, null), '');
});

test('F-30: alle SKS-Freitextfragen haben eine Herkunft mit Anzeigetext', async () => {
  const lies = async (pfad) => JSON.parse(await readFile(new URL(`../${pfad}`, import.meta.url), 'utf8'));
  const [sks, de, en] = await Promise.all(['content/sks/sks.json', 'src/i18n/de.json', 'src/i18n/en.json'].map(lies));
  for (const frage of sks.fragen) {
    const herkunft = herkunftVon(frage, sks);
    assert.ok(`herkunft.${herkunft}` in de && `herkunft.${herkunft}` in en, `${frage.id}: ${herkunft}`);
  }
});

test('jeder Text, den die Bildschirme verwenden, steht in de.json', async () => {
  const de = JSON.parse(await readFile(new URL('../src/i18n/de.json', import.meta.url), 'utf8'));
  for (const datei of ['runde.js', 'start.js']) {
    const quelltext = await readFile(new URL(`../src/ui/${datei}`, import.meta.url), 'utf8');
    for (const [, schluessel] of quelltext.matchAll(/\bt\('([\w.]+)'/g)) {
      assert.ok(schluessel in de, `${datei}: Text fehlt für ${schluessel}`);
    }
  }
});
