// M7 Speicherung: Lernstand dauerhaft im Browser ablegen (F-21).
// Das Modul kennt keine Prüfungsinhalte. Es speichert den Lernstand aus M2 je Modul-ID.
//
// Ablage: IndexedDB-Datenbank "trainer-engine", Objektspeicher "lernstand",
// Schlüssel = Modul-ID (z. B. "sks"), Wert = Lernstand { version, karten }.
// Die Daten gelten nur für diese Adresse und diesen Browser. Ein anderes Gerät,
// ein anderer Browser oder der lokale Testserver haben jeweils einen eigenen Lernstand.
//
// Versionen:
// - DB_VERSION ist die Version der Datenbankstruktur (Objektspeicher).
// - LERNSTAND_VERSION (aus M2) ist die Version des gespeicherten Inhalts. Ältere
//   Stände werden beim Laden mit migriere() umgestellt. Ein Stand aus einer neueren
//   App-Version wird nicht angefasst und nicht überschrieben.
//
// Speichern führt den Lernstand im Speicher mit dem gespeicherten zusammen
// (je Frage gewinnt der jüngere Eintrag). So gehen keine Antworten verloren, wenn
// die App in zwei Tabs oder als installierte App und im Browser zugleich offen ist.
//
// Seit Datenbankversion 2 gibt es den Objektspeicher "profil" mit einem einzigen
// Eintrag (Schlüssel "profil"): XP, Streak und Tagesziel aus M4, für die ganze App.
// Das Profil wird nicht als Ganzes überschrieben, sondern mit aendereProfil()
// innerhalb einer Transaktion gelesen, geändert und geschrieben. So zählen XP aus
// zwei offenen Tabs beide.
//
// Seit Datenbankversion 3 gibt es den Objektspeicher "antworten" (F-34): jede getippte
// Freitext-Antwort als eigener Eintrag
//   { id, modul, frage, zeit (Millisekunden seit 1970), text, gewusst, modus }
// Schlüssel ist die zufällige "id". Einträge werden nur angehängt, nie geändert. So kann
// der Export (AP8) sie mitnehmen und ein Import zweier Geräte sie einfach vereinen
// (fuehreAntwortenZusammen), ohne dass etwas doppelt oder verloren geht.

import { LERNSTAND_VERSION, FAECHER, neuerLernstand } from './m2-lernlogik.js';
import { pruefeProfil, ProfilFehler } from './m4-gamification.js';

export const DB_NAME = 'trainer-engine';
export const DB_VERSION = 3;
const SPEICHER = 'lernstand';
const PROFIL = 'profil';
const PROFIL_SCHLUESSEL = 'profil';
const ANTWORTEN = 'antworten';
const MODI = ['normal', 'vorziehen', 'fehler'];

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Fehler mit Code, damit die Oberfläche einen Text dazu anzeigen kann. */
export class SpeicherFehler extends Error {
  constructor(code, meldung) {
    super(meldung ?? code);
    this.code = code;
  }
}

function istGueltigeKarte(karte) {
  return karte != null && typeof karte === 'object'
    && Number.isInteger(karte.fach) && karte.fach >= 1 && karte.fach <= FAECHER
    && typeof karte.faellig === 'string' && DATUM.test(karte.faellig)
    && (karte.zuletzt === undefined || (typeof karte.zuletzt === 'string' && DATUM.test(karte.zuletzt)))
    && (karte.geaendert === undefined || Number.isFinite(karte.geaendert));
}

/**
 * Prüft einen geladenen Lernstand und stellt ältere Versionen um.
 * Ungültige Einträge werden verworfen und gezählt, statt den ganzen Stand abzulehnen.
 * @returns {{lernstand: object, verworfen: number}}
 * @throws {SpeicherFehler} 'speicher.neuereVersion', wenn der Stand aus einer neueren App stammt
 */
export function migriere(daten) {
  if (daten == null) return { lernstand: neuerLernstand(), verworfen: 0 };
  if (typeof daten !== 'object' || typeof daten.karten !== 'object' || daten.karten === null) {
    throw new SpeicherFehler('speicher.unlesbar');
  }
  const version = daten.version ?? 1;
  if (version > LERNSTAND_VERSION) throw new SpeicherFehler('speicher.neuereVersion');
  // Hier kommen künftige Umstellungen hin, z. B. if (version < 2) { ... }.
  // Version 1 ist der erste gespeicherte Stand; "geaendert" darf fehlen und zählt dann als 0.

  const karten = {};
  let verworfen = 0;
  for (const [id, karte] of Object.entries(daten.karten)) {
    if (istGueltigeKarte(karte)) karten[id] = { ...karte };
    else verworfen += 1;
  }
  return { lernstand: { version: LERNSTAND_VERSION, karten }, verworfen };
}

/**
 * Führt zwei Lernstände zusammen: je Frage gewinnt der Eintrag mit dem jüngeren
 * Zeitpunkt "geaendert". Bei Gleichstand gewinnt `a`. Keiner der beiden wird verändert.
 */
export function fuehreZusammen(a, b) {
  const karten = { ...a.karten };
  for (const [id, karte] of Object.entries(b.karten)) {
    const eigene = karten[id];
    if (!eigene || (karte.geaendert ?? 0) > (eigene.geaendert ?? 0)) karten[id] = karte;
  }
  return { version: LERNSTAND_VERSION, karten };
}

// --- Freitext-Antworten (F-34) -------------------------------------------

function neueAntwortId(jetzt) {
  const zufall = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
  return `${jetzt.toString(36)}-${zufall}`;
}

/**
 * Baut den Eintrag für eine Freitext-Antwort (F-34).
 * @param {{modul: string, frage: string, text: string, gewusst: boolean, modus: string}} antwort
 * @param {number} [jetzt] Zeitpunkt in Millisekunden; für Tests austauschbar
 */
export function freitextEintrag({ modul, frage, text, gewusst, modus }, jetzt = Date.now()) {
  return { id: neueAntwortId(jetzt), modul, frage, zeit: jetzt, text: String(text ?? ''), gewusst: Boolean(gewusst), modus };
}

export function istGueltigeAntwort(e) {
  return e != null && typeof e === 'object'
    && typeof e.id === 'string' && e.id !== ''
    && typeof e.modul === 'string' && e.modul !== ''
    && typeof e.frage === 'string' && e.frage !== ''
    && Number.isFinite(e.zeit) && typeof e.text === 'string' && typeof e.gewusst === 'boolean'
    && MODI.includes(e.modus);
}

/**
 * Vereint zwei Listen von Freitext-Antworten (für den Import in AP8): jede ID einmal,
 * sortiert nach Zeitpunkt. Ungültige Einträge werden übersprungen und gezählt.
 * @returns {{antworten: object[], verworfen: number}}
 */
export function fuehreAntwortenZusammen(a, b) {
  const nachId = new Map();
  let verworfen = 0;
  for (const e of [...a, ...b]) {
    if (!istGueltigeAntwort(e)) { verworfen += 1; continue; }
    if (!nachId.has(e.id)) nachId.set(e.id, { ...e });
  }
  const antworten = [...nachId.values()].sort((x, y) => x.zeit - y.zeit || (x.id < y.id ? -1 : 1));
  return { antworten, verworfen };
}

/** Prüft ein gespeichertes Profil (M4) und meldet Probleme als SpeicherFehler. */
function profilAus(daten) {
  try {
    return pruefeProfil(daten);
  } catch (fehler) {
    if (fehler instanceof ProfilFehler) throw new SpeicherFehler(fehler.code);
    throw fehler;
  }
}

/** IndexedDB-Anfrage als Promise. */
function alsPromise(anfrage) {
  return new Promise((erfuellt, abgelehnt) => {
    anfrage.onsuccess = () => erfuellt(anfrage.result);
    anfrage.onerror = () => abgelehnt(anfrage.error);
  });
}

/** Ende einer Transaktion als Promise (erst dann ist wirklich gespeichert). */
function transaktionFertig(tx) {
  return new Promise((erfuellt, abgelehnt) => {
    tx.oncomplete = () => erfuellt();
    tx.onerror = () => abgelehnt(tx.error);
    tx.onabort = () => abgelehnt(tx.error ?? new SpeicherFehler('speicher.abgebrochen'));
  });
}

/**
 * Öffnet den Speicher.
 * @param {{indexedDB?: IDBFactory, name?: string}} [optionen] für Tests austauschbar
 * @returns {Promise<{lade: Function, speichere: Function, schliesse: Function}>}
 * @throws {SpeicherFehler} 'speicher.nichtVerfuegbar', wenn der Browser keine IndexedDB anbietet
 */
export async function oeffneSpeicher({ indexedDB = globalThis.indexedDB, name = DB_NAME } = {}) {
  if (!indexedDB) throw new SpeicherFehler('speicher.nichtVerfuegbar');
  let db;
  try {
    const anfrage = indexedDB.open(name, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const neu = anfrage.result;
      if (!neu.objectStoreNames.contains(SPEICHER)) neu.createObjectStore(SPEICHER);
      if (!neu.objectStoreNames.contains(PROFIL)) neu.createObjectStore(PROFIL);
      if (!neu.objectStoreNames.contains(ANTWORTEN)) neu.createObjectStore(ANTWORTEN);
    };
    db = await alsPromise(anfrage);
  } catch (fehler) {
    throw new SpeicherFehler('speicher.nichtVerfuegbar', fehler?.message);
  }

  // Schreibvorgänge nacheinander ausführen, damit ein älterer nie einen jüngeren überholt.
  let warteschlange = Promise.resolve();
  function reiheEin(arbeit) {
    const auftrag = warteschlange.then(arbeit);
    warteschlange = auftrag.catch(() => {});
    return auftrag;
  }

  return {
    /**
     * Lädt den Lernstand eines Moduls (ein neuer, leerer, wenn noch keiner gespeichert ist).
     * @returns {Promise<{lernstand: object, verworfen: number}>}
     */
    async lade(modulId) {
      const tx = db.transaction(SPEICHER, 'readonly');
      const daten = await alsPromise(tx.objectStore(SPEICHER).get(modulId));
      return migriere(daten);
    },

    /**
     * Speichert den Lernstand eines Moduls und liefert den zusammengeführten Stand zurück.
     * @returns {Promise<object>}
     */
    speichere(modulId, lernstand) {
      return reiheEin(async () => {
        const tx = db.transaction(SPEICHER, 'readwrite');
        const speicher = tx.objectStore(SPEICHER);
        const fertig = transaktionFertig(tx);
        const gespeichert = migriere(await alsPromise(speicher.get(modulId))).lernstand;
        const zusammen = fuehreZusammen(lernstand, gespeichert);
        speicher.put(zusammen, modulId);
        await fertig;
        return zusammen;
      });
    },

    /**
     * Lädt das Profil (XP, Streak, Tagesziel). Gibt es noch keines, wird gleich ein
     * neues mit einer festen Geräte-ID angelegt.
     * @returns {Promise<{profil: object, verworfen: number}>}
     */
    ladeProfil() {
      return reiheEin(async () => {
        const tx = db.transaction(PROFIL, 'readwrite');
        const speicher = tx.objectStore(PROFIL);
        const fertig = transaktionFertig(tx);
        const daten = await alsPromise(speicher.get(PROFIL_SCHLUESSEL));
        const ergebnis = profilAus(daten);
        if (daten == null) speicher.put(ergebnis.profil, PROFIL_SCHLUESSEL);
        await fertig;
        return ergebnis;
      });
    },

    /**
     * Ändert das gespeicherte Profil: lesen, `aenderung(profil)` anwenden, schreiben.
     * `aenderung` liefert { profil, ... } (wie die Funktionen aus M4) und darf nichts
     * Asynchrones tun. Zurück kommt dieses Ergebnis, nachdem gespeichert ist.
     * @returns {Promise<object>}
     */
    aendereProfil(aenderung) {
      return reiheEin(async () => {
        const tx = db.transaction(PROFIL, 'readwrite');
        const speicher = tx.objectStore(PROFIL);
        const fertig = transaktionFertig(tx);
        const { profil } = profilAus(await alsPromise(speicher.get(PROFIL_SCHLUESSEL)));
        const ergebnis = aenderung(profil);
        speicher.put(ergebnis.profil, PROFIL_SCHLUESSEL);
        await fertig;
        return ergebnis;
      });
    },

    /**
     * Speichert eine Freitext-Antwort (Eintrag aus freitextEintrag). Bestehende Einträge
     * bleiben unverändert.
     * @returns {Promise<void>}
     */
    speichereAntwort(eintrag) {
      if (!istGueltigeAntwort(eintrag)) return Promise.reject(new SpeicherFehler('speicher.schreibfehler'));
      return reiheEin(async () => {
        const tx = db.transaction(ANTWORTEN, 'readwrite');
        const fertig = transaktionFertig(tx);
        tx.objectStore(ANTWORTEN).put(eintrag, eintrag.id);
        await fertig;
      });
    },

    /**
     * Lädt alle gespeicherten Freitext-Antworten, optional nur die eines Moduls,
     * sortiert nach Zeitpunkt. Beschädigte Einträge werden übersprungen und gezählt.
     * @returns {Promise<{antworten: object[], verworfen: number}>}
     */
    async ladeAntworten(modulId) {
      const tx = db.transaction(ANTWORTEN, 'readonly');
      const alle = await alsPromise(tx.objectStore(ANTWORTEN).getAll());
      const { antworten, verworfen } = fuehreAntwortenZusammen(alle ?? [], []);
      return { antworten: modulId ? antworten.filter((e) => e.modul === modulId) : antworten, verworfen };
    },

    schliesse() {
      db.close();
    },
  };
}

/**
 * Bittet den Browser, die Daten dieser Seite nicht bei Platzmangel zu löschen.
 * @param {StorageManager} [storage] für Tests austauschbar
 * @returns {Promise<'dauerhaft'|'nichtDauerhaft'|'unbekannt'>}
 */
export async function bitteUmDauerhaftenSpeicher(storage = globalThis.navigator?.storage) {
  if (!storage?.persist) return 'unbekannt';
  try {
    if (storage.persisted && await storage.persisted()) return 'dauerhaft';
    return (await storage.persist()) ? 'dauerhaft' : 'nichtDauerhaft';
  } catch {
    return 'unbekannt';
  }
}
