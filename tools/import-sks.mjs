// Import des amtlichen SKS-Fragenkatalogs (ELWIS) in das Inhaltsformat M8.
//
// Aufruf:  node tools/import-sks.mjs
//
// Eingaben:
//   content/sks/quelle/Fragenkatalog-SKS.pdf   amtlicher Katalog (von ELWIS heruntergeladen)
//   tools/sks/korrekturen.json                  Handkorrekturen je Frage-ID (Trennung Frage/Antwort, Hinweise)
//   tools/sks/kernpunkte-*.json                 Kernpunkte je Frage-ID (aus den amtlichen Antworten abgeleitet)
// Ausgabe:
//   content/sks/sks.json                        Inhaltsmodul
//   Bericht auf der Konsole: Fragenzahl je Bereich, unsichere Trennungen, fehlende Kernpunkte
//
// Für die Textgewinnung wird `pdftotext` (Poppler, liegt Git für Windows bei) benutzt.
// Das ist nur ein Entwicklungswerkzeug; die App selbst braucht es nicht.

import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { pruefeModul } from '../src/engine/m8-inhaltsformat.js';

const WURZEL = fileURLToPath(new URL('..', import.meta.url));
const PDF = join(WURZEL, 'content/sks/quelle/Fragenkatalog-SKS.pdf');
const ZIEL = join(WURZEL, 'content/sks/sks.json');
const ARBEIT = join(WURZEL, 'tools/sks');

export const STAND = '2006-07-01';
export const STAND_TEXT = '01.07.2006';

// Reihenfolge wie im Katalog. Die Nummerierung beginnt in jedem Bereich bei 1.
export const BEREICHE = [
  { id: 'nav', titel: 'Navigation', anzahl: 118 },
  { id: 'recht', titel: 'Schifffahrtsrecht', anzahl: 110 },
  { id: 'wetter', titel: 'Wetterkunde', anzahl: 101 },
  { id: 'sm1', titel: 'Seemannschaft I (Antriebsmaschine und unter Segel)', anzahl: 163 },
  { id: 'sm2', titel: 'Seemannschaft II (Antriebsmaschine)', anzahl: 146 },
];

// Zeilen aus Kopf- und Fußbereichen der ELWIS-Seiten, die nicht zum Fragentext gehören.
const RAUSCHEN = [
  /^Sie sind hier:/,
  /^ELWIS\s+Sportschifffahrt/,
  /^©\s*Wasserstraßen/,
  /^Stand: 01\. Juli 2006$/,
  /^Download Fragen- und Antwortenkatalog/,
  /^(Navigation|Schifffahrtsrecht|Wetterkunde|Seemannschaft I|Seemannschaft II)$/,
  /^Seemannschaft I \(Antriebsmaschine und unter Segel\)$/,
  /^Seemannschaft II \(Antriebsmaschine\)$/,
  /^Antriebsmaschine( und unter Segel)?$/,
];

const LISTENANFANG = /^(\d{1,2}\.|[a-z]\)|\d{1,2}\)|[-–•])\s/;

export function pdfZuText(pdf = PDF) {
  return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/** Fügt umbrochene Zeilen zu Absätzen zusammen; Aufzählungspunkte beginnen eine neue Zeile. */
export function fuegeZeilen(zeilen) {
  const ergebnis = [];
  for (const roh of zeilen) {
    const zeile = roh.trim().replace(/\s+/g, ' ');
    if (zeile === '') continue;
    if (ergebnis.length === 0 || LISTENANFANG.test(zeile)) { ergebnis.push(zeile); continue; }
    const letzte = ergebnis[ergebnis.length - 1];
    // Trennstrich am Zeilenende vor Großbuchstaben bleibt stehen („WSP-Dienststellen“).
    if (/[A-Za-zÄÖÜäöüß]-$/.test(letzte) && /^[A-ZÄÖÜ]/.test(zeile)) ergebnis[ergebnis.length - 1] = letzte + zeile;
    else ergebnis[ergebnis.length - 1] = `${letzte} ${zeile}`;
  }
  return ergebnis.join('\n');
}

/** Zerlegt den Katalogtext in Blöcke je Frage: { bereich, nr, zeilen[] }. */
export function zerlegeInBloecke(text) {
  const zeilen = text.replace(/\f/g, '\n').split(/\r?\n/);
  // Inhaltsverzeichnis überspringen: der Katalog beginnt mit der ersten „Nummer 1:“.
  const bloecke = [];
  let bereichIndex = -1;
  let aktuell = null;
  for (const roh of zeilen) {
    const zeile = roh.trim();
    const treffer = /^Nummer (\d+):$/.exec(zeile);
    if (treffer) {
      const nr = Number(treffer[1]);
      if (nr === 1) bereichIndex++;
      aktuell = { bereich: BEREICHE[bereichIndex]?.id ?? '?', nr, zeilen: [] };
      bloecke.push(aktuell);
      continue;
    }
    if (!aktuell) continue;
    if (RAUSCHEN.some((r) => r.test(zeile))) { aktuell.zeilen.push(''); continue; }
    aktuell.zeilen.push(roh);
  }
  return bloecke;
}

/**
 * Trennt Frage und Antwort. Die Frage endet mit der ersten Zeile, die auf „?“, „!“ oder „:“
 * endet und auf die keine weitere Fragezeile folgt (z. B. „2. Wer muss ausweichen?“).
 * @returns {{frage: string, antwort: string, unsicher: string|null}}
 */
export function trenneFrageAntwort(blockZeilen) {
  const zeilen = blockZeilen.map((z) => z.trim().replace(/\s+/g, ' ')).filter((z) => z !== '');
  // Aufforderungen („Nennen Sie …“) enden oft mit einem Punkt statt mit einem Fragezeichen.
  const aufforderung = /^(\d\.\s*)?(Nennen|Erklären|Erläutern|Beschreiben|Zählen|Geben|Begründen)\b/.test(zeilen[0] ?? '');
  const endetFrage = (z) => /[?!:]$/.test(z) || /\(Begründung!?\)$/.test(z) || (aufforderung && /\.$/.test(z));
  const istFragefortsetzung = (z) =>
    /^\d\.\s*(Was|Wie|Wo|Wer|Wann|Warum|Welche|Wodurch|Womit|Weshalb|Wovon|Worauf|Woran|Nennen|Erklären|Begründen|Beschreiben|Zählen|Geben|Unter|In|Mit|Ab|Bis|Ist|Sind|Darf|Dürfen|Kann|Können|Muss|Müssen|Gibt|Hat|Haben)\b/.test(z)
    || /^\(Begründung!?\)$/.test(z)
    || /^[a-zäöüß]/.test(z) && !/^[a-z]\)/.test(z);
  let ende = -1;
  for (let i = 0; i < zeilen.length; i++) {
    if (!endetFrage(zeilen[i])) continue;
    const naechste = zeilen[i + 1];
    if (naechste !== undefined && istFragefortsetzung(naechste) && i < 6) continue;
    ende = i;
    break;
  }
  let unsicher = null;
  if (ende < 0) { ende = 0; unsicher = 'kein Fragezeichen gefunden'; }
  else if (ende >= 4) unsicher = 'Frage länger als 4 Zeilen';
  let frage = fuegeZeilen(zeilen.slice(0, ende + 1)).replace(/\n/g, ' ');
  let antwort = fuegeZeilen(zeilen.slice(ende + 1));
  // Steht am Anfang der Antwort noch ein Fragesatz oder eine Aufforderung
  // („Wovon hängt sie ab?“, „Begründen Sie Ihre Antwort.“), gehört er zur Frage.
  const nachsatz = /^((?:\d\.\s*)?(?:Wo|Was|Wie|Wer|Wann|Warum|Welche[nrs]?|Wovon|Worauf|Weshalb|Worum|Um was|(?:Für|Zu|In|An|Bei|Mit|Aus|Von|Nach) welche[mnrs]?)\b[^.?!\n]*\?|(?:\d\.\s*)?(?:Begründen|Erläutern|Nennen|Erklären|Beschreiben|Schlagen|Geben|Ergänzen|Vervollständigen) Sie\b[^.?!\n]*[.!]|\(Begründung!?\))\s*/;
  for (let treffer; (treffer = nachsatz.exec(antwort)); ) {
    frage = `${frage} ${treffer[1]}`;
    antwort = antwort.slice(treffer[0].length);
  }
  if (!unsicher && antwort === '') unsicher = 'keine Antwort';
  if (!unsicher && !/[?]/.test(frage) && !aufforderung) unsicher = 'Frage ohne Fragezeichen';
  return { frage, antwort, unsicher };
}

const BILDHINWEIS = /\b(Abbildung|Skizze|Zeichnung|Bild|abgebildet|dargestellt|nachfolgenden?)\b/i;
const TEXT_BILD_FEHLT = 'Zu dieser Frage gehört im amtlichen Katalog eine Abbildung, die hier noch fehlt.';

export function frageId(bereich, nr) {
  return `sks-${bereich}-${String(nr).padStart(3, '0')}`;
}

async function leseJson(pfad, ersatz) {
  try { return JSON.parse(await readFile(pfad, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return ersatz;
    throw new Error(`${pfad}: ${e.message}`);
  }
}

async function leseKernpunkte() {
  const alle = {};
  let dateien = [];
  try { dateien = (await readdir(ARBEIT)).filter((d) => /^kernpunkte-.*\.json$/.test(d)).sort(); } catch { /* leer */ }
  for (const datei of dateien) Object.assign(alle, await leseJson(join(ARBEIT, datei), {}));
  return alle;
}

/** Kernpunkte als Notlösung: Aufzählungspunkte der Antwort, sonst die ganze Antwort. */
export function automatischeKernpunkte(antwort) {
  const zeilen = antwort.split('\n');
  if (zeilen.length > 1 && zeilen.every((z, i) => i === 0 || LISTENANFANG.test(z))) {
    return zeilen.map((z) => z.replace(LISTENANFANG, '').trim()).filter(Boolean);
  }
  return [antwort.replace(/\n/g, ' ')];
}

export async function baueModul(text) {
  const korrekturen = await leseJson(join(ARBEIT, 'korrekturen.json'), {});
  const kernpunkte = await leseKernpunkte();
  const bericht = { anzahl: {}, unsicher: [], ohneKernpunkte: [], bild: [], korrigiert: 0 };

  const fragen = zerlegeInBloecke(text).map((block) => {
    const id = frageId(block.bereich, block.nr);
    const bereich = BEREICHE.find((b) => b.id === block.bereich);
    bericht.anzahl[block.bereich] = (bericht.anzahl[block.bereich] ?? 0) + 1;
    let { frage, antwort, unsicher } = trenneFrageAntwort(block.zeilen);
    const korrektur = korrekturen[id];
    if (korrektur) {
      bericht.korrigiert++;
      if (korrektur.frage) frage = korrektur.frage;
      if (korrektur.musterantwort) antwort = korrektur.musterantwort;
      unsicher = null;
    }
    if (unsicher) bericht.unsicher.push({ id, grund: unsicher, frage, antwort });

    const eintrag = {
      id,
      thema: `sks-${block.bereich}`,
      typ: 'freitext',
      frage,
      musterantwort: antwort,
      kernpunkte: kernpunkte[id] ?? automatischeKernpunkte(antwort),
      kernpunkteStatus: 'ungeprueft',
      herkunft: 'amtlich',
      erklaerung: '',
      quelle: `ELWIS, Fragen- und Antwortenkatalog SKS, Stand ${STAND_TEXT}, ${bereich?.titel ?? block.bereich} Nr. ${block.nr}`,
    };
    if (!kernpunkte[id]) bericht.ohneKernpunkte.push(id);
    // In korrekturen.json bedeutet "hinweis": "bild" den Standardtext für eine fehlende Abbildung.
    let hinweis = korrektur?.hinweis ?? (BILDHINWEIS.test(frage) ? 'bild' : null);
    if (hinweis === 'bild') { hinweis = TEXT_BILD_FEHLT; bericht.bild.push(id); }
    if (hinweis) eintrag.hinweis = hinweis;
    return eintrag;
  });

  const modul = {
    format: 1,
    meta: {
      id: 'sks',
      titel: 'Sportküstenschifferschein (SKS)',
      sprache: 'de',
      version: '1',
      stand: STAND,
      herkunft: 'amtlich',
      quelle: `Fragen- und Antwortenkatalog für den amtlichen Sportküstenschifferschein, Stand ${STAND_TEXT}, ELWIS (Wasserstraßen- und Schifffahrtsverwaltung des Bundes)`,
      hinweis: 'Fragen und Musterantworten sind amtlich. Die Kernpunkte sind aus den Musterantworten abgeleitet und ungeprüft, bis sie gegengelesen wurden.',
    },
    themen: BEREICHE.map((b) => ({ id: `sks-${b.id}`, titel: b.titel })),
    fragen,
  };
  return { modul, bericht };
}

async function main() {
  const { modul, bericht } = await baueModul(pdfZuText());
  const fehler = pruefeModul(modul);

  console.log('Fragen je Bereich (Ist / Soll laut Katalog):');
  let abweichung = false;
  for (const b of BEREICHE) {
    const ist = bericht.anzahl[b.id] ?? 0;
    if (ist !== b.anzahl) abweichung = true;
    console.log(`  ${b.titel.padEnd(52)} ${String(ist).padStart(3)} / ${b.anzahl}${ist === b.anzahl ? '' : '  ← ABWEICHUNG'}`);
  }
  console.log(`Handkorrekturen angewandt: ${bericht.korrigiert}`);
  console.log(`Fragen mit Abbildungshinweis: ${bericht.bild.length}`);
  console.log(`Fragen ohne eigene Kernpunkte (automatisch): ${bericht.ohneKernpunkte.length}`);
  console.log(`Unsichere Trennung Frage/Antwort: ${bericht.unsicher.length}`);
  for (const u of bericht.unsicher) console.log(`  ${u.id} (${u.grund}): ${u.frage.slice(0, 90)}`);
  if (process.argv.includes('--unsicher-json')) {
    await writeFile(process.argv[process.argv.indexOf('--unsicher-json') + 1], JSON.stringify(bericht.unsicher, null, 2));
  }

  if (fehler.length > 0 || abweichung) {
    console.error(`\nModul NICHT geschrieben: ${fehler.length} Formatfehler${abweichung ? ', Fragenzahl weicht ab' : ''}.`);
    for (const f of fehler.slice(0, 20)) console.error(' ', f.code, JSON.stringify(f.ort), JSON.stringify(f.werte));
    process.exitCode = 1;
    return;
  }
  await writeFile(ZIEL, JSON.stringify(modul, null, 2) + '\n');
  console.log(`\nGeschrieben: content/sks/sks.json (${modul.fragen.length} Fragen)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
