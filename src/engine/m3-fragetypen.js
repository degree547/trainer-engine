// M3 Fragetypen: Regeln für Multiple Choice (F-08) und Freitext (F-29, F-30).
// Das Modul kennt keine Prüfungsinhalte und keine Oberfläche. Es entscheidet nur,
// wie eine Frage gezeigt und wie eine Antwort bewertet wird.
//
// Multiple Choice (F-08):
// - Genau eine Option ist richtig ("richtig" = Nummer der Option ab 0).
// - Die Optionen werden für jede Anzeige neu gemischt, damit nicht die Position
//   gelernt wird (in manchen amtlichen Katalogen steht die richtige Antwort immer an
//   erster Stelle). Mit "mischen": false bleibt die Reihenfolge des Moduls, etwa wenn
//   eine Option „Alle oben genannten“ lautet.
// - Die Bewertung ist automatisch: richtig, wenn die richtige Option gewählt wurde.
//
// Freitext (F-29, F-30):
// - Die Antwort wird getippt; ein leeres Feld ist nach Rückfrage erlaubt.
// - Danach erscheinen Musterantwort mit Herkunft und Quelle sowie die Kernpunkte
//   als Checkliste.
// - Aus den abgehakten Kernpunkten ergibt sich ein Vorschlag: alle abgehakt = gewusst,
//   sonst nicht gewusst. Die Entscheidung trifft der Lernende selbst; sie bestimmt
//   das Leitner-Fach (über M2).

export const TYPEN = ['mc', 'freitext'];

/**
 * Reihenfolge, in der die Optionen einer MC-Frage gezeigt werden.
 * @param {{optionen: string[], mischen?: boolean}} frage
 * @param {() => number} [zufall] liefert Zahlen in [0, 1); austauschbar für Tests
 * @returns {number[]} Nummern der Optionen im Modul, in Anzeigereihenfolge
 */
export function optionsReihenfolge(frage, zufall = Math.random) {
  const reihenfolge = frage.optionen.map((_, i) => i);
  if (frage.mischen === false) return reihenfolge;
  // Fisher-Yates: jede Reihenfolge ist gleich wahrscheinlich.
  for (let i = reihenfolge.length - 1; i > 0; i -= 1) {
    const j = Math.floor(zufall() * (i + 1));
    [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]];
  }
  return reihenfolge;
}

/** Buchstabe zur Anzeigeposition: 0 → A, 1 → B, … */
export function buchstabe(position) {
  return String.fromCharCode(65 + position);
}

/**
 * Bewertet eine MC-Antwort.
 * @param {{richtig: number}} frage
 * @param {number} gewaehlt Nummer der gewählten Option im Modul (nicht die Anzeigeposition)
 */
export function bewerteMc(frage, gewaehlt) {
  return gewaehlt === frage.richtig;
}

/** Ob eine getippte Freitextantwort leer ist (nur Leerzeichen zählen als leer). */
export function istLeer(antwort) {
  return typeof antwort !== 'string' || antwort.trim() === '';
}

/**
 * Vorschlag zur Selbstbewertung einer Freitextantwort.
 * @param {{kernpunkte: string[]}} frage
 * @param {Iterable<number>} abgehakt Nummern der abgehakten Kernpunkte
 * @returns {{gewusst: boolean, abgehakt: number, gesamt: number}}
 */
export function freitextVorschlag(frage, abgehakt) {
  const gesamt = frage.kernpunkte.length;
  const gueltig = new Set([...abgehakt].filter((i) => Number.isInteger(i) && i >= 0 && i < gesamt));
  return { gewusst: gesamt > 0 && gueltig.size === gesamt, abgehakt: gueltig.size, gesamt };
}

/**
 * Herkunft der Antwort einer Frage (F-30): Frage, sonst Modul, sonst leer.
 * @returns {'amtlich' | 'buch' | 'eigen' | ''}
 */
export function herkunftVon(frage, modul) {
  return frage.herkunft ?? modul?.meta?.herkunft ?? '';
}
