// M5 Statistik: Fortschritt je Thema (F-17) und Schwächenliste (F-18).
// Das Modul kennt keine Prüfungsinhalte. Es rechnet nur mit dem Lernstand aus M2
// und den Themen und Fragen, die das Inhaltsmodul vorgibt.
//
// Regeln:
// - Sicher ist eine Frage in Fach 4 oder 5 (F-17). Der Fortschritt eines Themas ist
//   der Anteil seiner Fragen, die sicher sind. Daneben stehen die Fragen, die gerade
//   gelernt werden (Fach 1 bis 3), und die neuen (noch nie beantwortet).
// - Fehlerquote einer Frage = falsche Antworten / alle Antworten (Zähler aus M2, Version 2).
// - Schwächenliste (F-18): Fragen mit mindestens MIN_VERSUCHE Antworten und mindestens
//   einer falschen, nach Fehlerquote absteigend. Bei gleicher Quote zuerst die mit mehr
//   Fehlern, dann das niedrigere Fach, dann die Reihenfolge im Modul.

import { FAECHER } from './m2-lernlogik.js';

/** Ab diesem Fach gilt eine Frage als sicher (F-17). */
export const SICHER_AB_FACH = 4;
/** So viele Antworten braucht eine Frage, bevor sie in die Schwächenliste kommt. */
export const MIN_VERSUCHE = 2;
/** Länge der Schwächenliste. */
export const SCHWAECHEN_ANZAHL = 10;

function leereZahlen() {
  return { gesamt: 0, sicher: 0, lernend: 0, neu: 0, anteil: 0 };
}

function zaehle(zahlen, karte) {
  zahlen.gesamt += 1;
  if (!karte) zahlen.neu += 1;
  else if (karte.fach >= SICHER_AB_FACH && karte.fach <= FAECHER) zahlen.sicher += 1;
  else zahlen.lernend += 1;
}

function mitAnteil(zahlen) {
  return { ...zahlen, anteil: zahlen.gesamt > 0 ? zahlen.sicher / zahlen.gesamt : 0 };
}

/**
 * Fortschritt je Thema (F-17), in der Reihenfolge der Themen im Modul.
 * Karten zu Fragen, die es im Modul nicht mehr gibt, zählen nicht mit.
 * @returns {{themen: {id: string, titel: string, gesamt: number, sicher: number, lernend: number,
 *   neu: number, anteil: number}[], gesamt: {gesamt: number, sicher: number, lernend: number,
 *   neu: number, anteil: number}}} anteil zwischen 0 und 1
 */
export function fortschrittJeThema(modul, lernstand) {
  const jeThema = new Map(modul.themen.map((thema) => [thema.id, leereZahlen()]));
  const gesamt = leereZahlen();
  for (const frage of modul.fragen) {
    const karte = lernstand.karten[frage.id];
    const zahlen = jeThema.get(frage.thema);
    if (zahlen) zaehle(zahlen, karte);
    zaehle(gesamt, karte);
  }
  return {
    themen: modul.themen.map((thema) => ({ id: thema.id, titel: thema.titel, ...mitAnteil(jeThema.get(thema.id)) })),
    gesamt: mitAnteil(gesamt),
  };
}

/**
 * Fehlerquote einer Karte.
 * @returns {{versuche: number, richtig: number, falsch: number, quote: number} | null}
 *   null, wenn die Frage noch nicht beantwortet wurde
 */
export function fehlerquote(karte) {
  const richtig = karte?.richtig ?? 0;
  const falsch = karte?.falsch ?? 0;
  const versuche = richtig + falsch;
  if (versuche === 0) return null;
  return { versuche, richtig, falsch, quote: falsch / versuche };
}

/**
 * Schwächenliste (F-18): die Fragen mit der höchsten Fehlerquote.
 * @param {{anzahl?: number, minVersuche?: number}} [optionen]
 * @returns {{frage: object, fach: number, versuche: number, richtig: number, falsch: number, quote: number}[]}
 */
export function schwaechenliste(modul, lernstand, { anzahl = SCHWAECHEN_ANZAHL, minVersuche = MIN_VERSUCHE } = {}) {
  const kandidaten = [];
  modul.fragen.forEach((frage, nr) => {
    const karte = lernstand.karten[frage.id];
    const q = fehlerquote(karte);
    if (!q || q.falsch === 0 || q.versuche < minVersuche) return;
    kandidaten.push({ frage, fach: karte.fach, nr, ...q });
  });
  kandidaten.sort((a, b) => (b.quote - a.quote) || (b.falsch - a.falsch) || (a.fach - b.fach) || (a.nr - b.nr));
  return kandidaten.slice(0, anzahl).map(({ nr, ...eintrag }) => eintrag);
}
