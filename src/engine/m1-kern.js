// M1 Kern: lädt ein Inhaltsmodul aus einer JSON-Datei (F-01).
// Das Modul kennt keine Prüfungsinhalte. Die vollständige Prüfung des
// Inhaltsformats übernimmt M8; ein Inhaltsmodul gelangt nur über M8 in die Engine.

import { lesePruefe, FORMAT_VERSION } from './m8-inhaltsformat.js';

export { FORMAT_VERSION };

export class ModulFehler extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'ModulFehler';
    this.code = code;
    this.details = details;
  }
}

/**
 * Prüft die Grundform eines Inhaltsmoduls.
 * @returns {string[]} Liste von Fehlercodes, leer wenn alles passt.
 */
export function pruefeGrundform(daten) {
  const fehler = [];
  if (daten === null || typeof daten !== 'object' || Array.isArray(daten)) {
    return ['modul.keinObjekt'];
  }
  if (daten.format !== FORMAT_VERSION) fehler.push('modul.formatVersion');
  const meta = daten.meta;
  if (meta === null || typeof meta !== 'object') {
    fehler.push('modul.metaFehlt');
  } else {
    if (typeof meta.id !== 'string' || meta.id.trim() === '') fehler.push('modul.idFehlt');
    if (typeof meta.titel !== 'string' || meta.titel.trim() === '') fehler.push('modul.titelFehlt');
  }
  if (!Array.isArray(daten.themen)) fehler.push('modul.themenFehlen');
  if (!Array.isArray(daten.fragen)) fehler.push('modul.fragenFehlen');
  return fehler;
}

/**
 * Wandelt den Text einer Moduldatei in ein geprüftes Modulobjekt um.
 * @throws {ModulFehler}
 */
export function leseModul(text, quelle = '') {
  // Die vollständige Prüfung mit Zeilenangaben übernimmt M8 (F-26).
  const { daten, fehler, jsonFehler } = lesePruefe(text);
  if (jsonFehler) {
    throw new ModulFehler('modul.keinJson', {
      quelle, zeile: jsonFehler.zeile, spalte: jsonFehler.spalte,
      fehler: [{ code: jsonFehler.code, zeile: jsonFehler.zeile, ort: { art: 'modul' }, werte: jsonFehler.werte }],
    });
  }
  if (fehler.length > 0) {
    throw new ModulFehler('modul.ungueltig', { quelle, fehler });
  }
  return daten;
}

/**
 * Lädt ein Modul von einer (relativen) Adresse.
 * @param {string} url
 * @param {typeof fetch} [holen] austauschbar für Tests
 */
export async function ladeModulAusUrl(url, holen = globalThis.fetch) {
  let antwort;
  try {
    antwort = await holen(url);
  } catch (e) {
    throw new ModulFehler('modul.nichtErreichbar', { quelle: url, meldung: e.message });
  }
  if (!antwort.ok) {
    throw new ModulFehler('modul.nichtErreichbar', { quelle: url, meldung: `HTTP ${antwort.status}` });
  }
  return leseModul(await antwort.text(), url);
}

/**
 * Lädt ein Modul aus einer vom Nutzer gewählten Datei (File oder Blob mit name).
 */
export async function ladeModulAusDatei(datei) {
  return leseModul(await datei.text(), datei.name ?? '');
}

/**
 * Kurze Kennzahlen eines Moduls für die Anzeige.
 */
export function modulUebersicht(modul) {
  return {
    id: modul.meta.id,
    titel: modul.meta.titel,
    sprache: modul.meta.sprache ?? '',
    version: modul.meta.version ?? '',
    stand: modul.meta.stand ?? '',
    herkunft: modul.meta.herkunft ?? '',
    themen: modul.themen.length,
    fragen: modul.fragen.length,
  };
}
