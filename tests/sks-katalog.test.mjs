// Prüft das SKS-Modul gegen den amtlichen Katalog: Fragenzahl je Bereich, Stichproben, Herkunft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { leseModul } from '../src/engine/m1-kern.js';
import { BEREICHE, baueModul, pdfZuText, trenneFrageAntwort, fuegeZeilen } from '../tools/import-sks.mjs';

const text = await readFile(new URL('../content/sks/sks.json', import.meta.url), 'utf8');
const modul = leseModul(text, 'sks.json'); // wirft, falls M8 Fehler findet
const frage = (id) => modul.fragen.find((f) => f.id === id);

test('Fragenzahl je Bereich stimmt mit dem amtlichen Katalog überein', () => {
  const soll = { 'sks-nav': 118, 'sks-recht': 110, 'sks-wetter': 101, 'sks-sm1': 163, 'sks-sm2': 146 };
  assert.deepEqual(modul.themen.map((t) => t.id), Object.keys(soll));
  for (const [thema, anzahl] of Object.entries(soll)) {
    assert.equal(modul.fragen.filter((f) => f.thema === thema).length, anzahl, thema);
  }
  assert.equal(modul.fragen.length, 638);
  assert.deepEqual(BEREICHE.map((b) => b.anzahl), Object.values(soll));
});

test('IDs folgen der amtlichen Nummerierung lückenlos (F-23)', () => {
  for (const b of BEREICHE) {
    const ids = modul.fragen.filter((f) => f.thema === `sks-${b.id}`).map((f) => f.id);
    const erwartet = Array.from({ length: b.anzahl }, (_, i) => `sks-${b.id}-${String(i + 1).padStart(3, '0')}`);
    assert.deepEqual(ids, erwartet, b.id);
  }
});

test('Stand, Herkunft und Prüfstatus sind vermerkt', () => {
  assert.equal(modul.meta.stand, '2006-07-01');
  assert.equal(modul.meta.herkunft, 'amtlich');
  for (const f of modul.fragen) {
    assert.equal(f.typ, 'freitext');
    assert.equal(f.herkunft, 'amtlich');
    assert.equal(f.kernpunkteStatus, 'ungeprueft');
    assert.match(f.quelle, /^ELWIS, Fragen- und Antwortenkatalog SKS, Stand 01\.07\.2006, .+ Nr\. \d+$/);
    assert.ok(f.kernpunkte.length >= 1, f.id);
  }
});

test('Stichproben gegen den Originaltext', () => {
  assert.equal(frage('sks-nav-001').frage,
    'Worauf müssen Sie als Schiffsführer vor Reiseantritt hinsichtlich der Seekarten und Seebücher achten?');
  assert.equal(frage('sks-nav-001').musterantwort,
    'Auf Vollständigkeit der Unterlagen und deren Berichtigung auf den neuesten Stand.');
  assert.equal(frage('sks-nav-026').frage, 'Was ist die "Sichtweite" eines Feuers? Wovon hängt sie ab?');
  assert.equal(frage('sks-recht-047').musterantwort, 'Mindestens 1 000 m.');
  assert.equal(frage('sks-wetter-077').musterantwort, 'Sichtweite unter 1 000 Meter.');
  assert.equal(frage('sks-sm1-024').musterantwort, '4 Festmacherleinen und 4 Fender.');
  assert.match(frage('sks-sm2-089').musterantwort, /^Ein Kurswinkel von 20 bis 25°/);
  assert.equal(frage('sks-sm2-146').quelle.endsWith('Seemannschaft II (Antriebsmaschine) Nr. 146'), true);
  // Seitenköpfe der ELWIS-Seiten dürfen nirgends im Text stehen
  for (const f of modul.fragen) {
    assert.doesNotMatch(`${f.frage} ${f.musterantwort}`, /Sie sind hier|ELWIS Sportschifffahrt|Stand: 01\. Juli|International Hydrographic|CO22/, f.id);
  }
});

test('Fragen mit fehlender Abbildung tragen einen Hinweis', () => {
  for (const id of ['sks-wetter-034', 'sks-recht-023', 'sks-sm1-079', 'sks-sm1-104', 'sks-sm2-065']) {
    assert.match(frage(id).hinweis ?? '', /Abbildung|Zeichnung/, id);
  }
  assert.equal(frage('sks-wetter-031').hinweis, undefined);
});

test('Trennung von Frage und Antwort (Import-Regeln)', () => {
  const t = (...zeilen) => trenneFrageAntwort(zeilen);
  assert.deepEqual(t('Was ist X?', 'Ein Y.'), { frage: 'Was ist X?', antwort: 'Ein Y.', unsicher: null });
  assert.equal(t('Nennen Sie drei Dinge.', '1. a,', '2. b.').antwort, '1. a,\n2. b.');
  assert.equal(t('Was ist X?', 'Wovon hängt es ab? Von Y.').frage, 'Was ist X? Wovon hängt es ab?');
  assert.equal(t('1. Was ist X?', '2. Wie geht Y?', '1. So.', '2. Anders.').frage, '1. Was ist X? 2. Wie geht Y?');
  assert.equal(fuegeZeilen(['WSP-', 'Dienststellen und', 'Schleusen']), 'WSP-Dienststellen und Schleusen');
});

// Nur wenn pdftotext installiert ist: Neu-Import aus dem PDF ergibt genau die gespeicherte Datei.
// (`pdftotext -v` endet mit Code 99; nur „Programm nicht gefunden“ zählt als fehlend.)
let pdftotext = true;
try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { if (e.code === 'ENOENT') pdftotext = false; }

test('Neu-Import aus dem PDF ergibt dieselbe Moduldatei', { skip: !pdftotext && 'pdftotext nicht installiert' }, async () => {
  const { modul: neu } = await baueModul(pdfZuText());
  // Zeilenenden angleichen: Git kann die Datei unter Windows mit CRLF auschecken.
  assert.equal(JSON.stringify(neu, null, 2) + '\n', text.replace(/\r\n/g, '\n'));
});
