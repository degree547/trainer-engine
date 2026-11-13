// M2 Lernlogik: Leitner-Fächer und Rundenbildung (F-03, F-05).
// Das Modul kennt keine Prüfungsinhalte. Es arbeitet nur mit Frage-IDs,
// Themen-IDs und der Reihenfolge, die das Inhaltsmodul vorgibt.
//
// Lernstand (wird ab AP5 von M7 gespeichert):
//   { version: 1, karten: { "<frage-id>": { fach: 1..5, faellig: "JJJJ-MM-TT", zuletzt: "JJJJ-MM-TT" } } }
// Eine Frage ohne Eintrag in "karten" ist neu. Einträge zu Fragen, die es im
// Modul nicht mehr gibt, bleiben erhalten, werden aber übersprungen (F-23).
//
// Regeln:
// - Richtig = ein Fach höher (höchstens Fach 5), falsch = zurück in Fach 1 (F-03).
// - Wieder fällig nach ABSTAENDE[fach - 1] Tagen; nach einer falschen Antwort am nächsten Tag.
// - Übung (vorgezogene Wiederholung, Fehler-Durchlauf direkt nach der Runde):
//   richtig ändert nichts, falsch setzt zurück in Fach 1 wie sonst auch.
// - Eine Runde: zuerst fällige Fragen (am längsten überfällig zuerst), dann neue
//   Fragen Thema für Thema in der Reihenfolge des Moduls (F-05).

export const LERNSTAND_VERSION = 1;
export const FAECHER = 5;
/** Tage bis zur nächsten Wiederholung je Fach (Fach 1 bis 5). */
export const ABSTAENDE = [1, 2, 4, 8, 16];
export const RUNDENGROESSE = 10;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Heutiges Datum in Ortszeit als "JJJJ-MM-TT". Fällig wird nach Kalendertagen gerechnet. */
export function datumVon(zeitpunkt = new Date()) {
  const j = zeitpunkt.getFullYear();
  const m = String(zeitpunkt.getMonth() + 1).padStart(2, '0');
  const t = String(zeitpunkt.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

/** Datum plus n Kalendertage. */
export function plusTage(datum, tage) {
  if (!DATUM.test(datum)) throw new Error(`Ungültiges Datum: ${datum}`);
  const [j, m, t] = datum.split('-').map(Number);
  // Mittags rechnen, damit Sommer- und Winterzeit keinen Tag verschieben.
  return datumVon(new Date(j, m - 1, t + tage, 12));
}

export function neuerLernstand() {
  return { version: LERNSTAND_VERSION, karten: {} };
}

/**
 * Bewertet eine Antwort und liefert einen neuen Lernstand (der alte bleibt unverändert).
 * @param {object} lernstand
 * @param {string} frageId
 * @param {boolean} richtig
 * @param {string} heute "JJJJ-MM-TT"
 * @param {{uebung?: boolean}} [optionen] Übung: richtig ändert Fach und Termin nicht
 */
export function bewerte(lernstand, frageId, richtig, heute, { uebung = false } = {}) {
  if (!DATUM.test(heute)) throw new Error(`Ungültiges Datum: ${heute}`);
  const alt = lernstand.karten[frageId];
  let karte;
  if (!richtig) {
    karte = { fach: 1, faellig: plusTage(heute, ABSTAENDE[0]), zuletzt: heute };
  } else if (uebung && alt) {
    karte = { ...alt, zuletzt: heute };
  } else {
    // Eine neue Frage gilt als Fach 1; richtig beantwortet kommt sie in Fach 2.
    const fach = Math.min((alt?.fach ?? 1) + 1, FAECHER);
    karte = { fach, faellig: plusTage(heute, ABSTAENDE[fach - 1]), zuletzt: heute };
  }
  return { ...lernstand, karten: { ...lernstand.karten, [frageId]: karte } };
}

export function istFaellig(karte, heute) {
  return karte != null && karte.faellig <= heute;
}

/** Reihenfolge der Fragen im Modul: Themen wie in "themen", darin wie in "fragen". */
function fragenNachThemen(modul) {
  const rang = new Map(modul.themen.map((thema, i) => [thema.id, i]));
  return modul.fragen
    .map((frage, nr) => ({ frage, nr }))
    .sort((a, b) => (rang.get(a.frage.thema) - rang.get(b.frage.thema)) || (a.nr - b.nr))
    .map(({ frage, nr }) => ({ frage, nr }));
}

/** Gelernte Fragen sortiert: frühester Termin zuerst, dann niedriges Fach, dann Modulreihenfolge. */
function nachTermin(eintraege, karten) {
  return eintraege.sort((a, b) => {
    const ka = karten[a.frage.id];
    const kb = karten[b.frage.id];
    return ka.faellig.localeCompare(kb.faellig) || (ka.fach - kb.fach) || (a.nr - b.nr);
  });
}

/**
 * Bildet eine Runde: zuerst fällige, dann neue Fragen (F-05).
 * @returns {object[]} höchstens `anzahl` Fragen aus dem Modul
 */
export function bildeRunde(modul, lernstand, heute, { anzahl = RUNDENGROESSE } = {}) {
  const karten = lernstand.karten;
  const alle = fragenNachThemen(modul);
  const faellig = nachTermin(alle.filter((e) => istFaellig(karten[e.frage.id], heute)), karten);
  const neu = alle.filter((e) => !karten[e.frage.id]);
  return [...faellig, ...neu].slice(0, anzahl).map((e) => e.frage);
}

/**
 * Bildet eine vorgezogene Wiederholung aus gelernten, noch nicht fälligen Fragen:
 * nächster Termin zuerst, bei gleichem Termin die niedrigen Fächer.
 */
export function bildeVorgezogeneRunde(modul, lernstand, heute, { anzahl = RUNDENGROESSE } = {}) {
  const karten = lernstand.karten;
  const spaeter = fragenNachThemen(modul).filter((e) => karten[e.frage.id] && !istFaellig(karten[e.frage.id], heute));
  return nachTermin(spaeter, karten).slice(0, anzahl).map((e) => e.frage);
}

/**
 * Kennzahlen für die Startseite.
 * @returns {{faellig: number, neu: number, spaeter: number, faecher: number[]}}
 *   faecher[0] ist die Anzahl in Fach 1, faecher[4] in Fach 5
 */
export function lernUebersicht(modul, lernstand, heute) {
  const ergebnis = { faellig: 0, neu: 0, spaeter: 0, faecher: Array(FAECHER).fill(0) };
  for (const frage of modul.fragen) {
    const karte = lernstand.karten[frage.id];
    if (!karte) { ergebnis.neu += 1; continue; }
    ergebnis.faecher[karte.fach - 1] += 1;
    if (istFaellig(karte, heute)) ergebnis.faellig += 1;
    else ergebnis.spaeter += 1;
  }
  return ergebnis;
}
