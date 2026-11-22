// M3 Fragetypen: Regeln für Multiple Choice (F-08) und Freitext (F-29, F-30).
// Das Modul kennt keine Prüfungsinhalte und keine Oberfläche. Es entscheidet nur,
// wie eine Frage gezeigt und wie eine Antwort bewertet wird.
//
// Multiple Choice (F-08):
// - Genau eine Option ist richtig ("richtig" = Nummer der Option ab 0).
// - Mehrfachauswahl (F-40): Ist "richtig" eine Liste von Nummern, können mehrere Optionen
//   richtig sein. Der Lernende tippt alle zutreffenden an und lässt dann prüfen; richtig ist
//   die Antwort nur, wenn genau die richtigen Optionen gewählt sind.
// - Die Optionen werden für jede Anzeige neu gemischt, damit nicht die Position
//   gelernt wird (in manchen amtlichen Katalogen steht die richtige Antwort immer an
//   erster Stelle). Mit "mischen": false bleibt die Reihenfolge des Moduls, etwa wenn
//   eine Option „Alle oben genannten“ lautet.
// - Die Bewertung ist automatisch: richtig, wenn die richtige Option gewählt wurde.
//
// Prüfstatus der Kernpunkte (F-39): Das Modul gibt mit "kernpunkteStatus" einen Ausgangswert
// vor. Hat der Lernende den Status in der App umgeschaltet (gespeichert in M7), gilt seine Wahl.
//
// Freitext (F-29, F-30):
// - Die Antwort wird getippt; ein leeres Feld ist nach Rückfrage erlaubt.
// - Danach erscheinen Musterantwort mit Herkunft und Quelle sowie die Kernpunkte
//   als Checkliste.
// - Aus den abgehakten Kernpunkten ergibt sich ein Vorschlag: alle abgehakt = gewusst,
//   sonst nicht gewusst. Die Entscheidung trifft der Lernende selbst; sie bestimmt
//   das Leitner-Fach (über M2).
//
// Zahleneingabe (F-09):
// - Getippt wird nur die Zahl; die Einheit steht fest neben dem Feld. Tippt der Lernende
//   die Einheit trotzdem mit, wird sie ignoriert. Komma und Punkt gelten beide als
//   Dezimaltrennzeichen, Tausenderpunkte sind nicht erlaubt.
// - Richtig ist jede Zahl, die höchstens "toleranz" von "loesung" abweicht (Grenze
//   eingeschlossen). Die Bewertung ist automatisch.
// - Mit "kreis" (z. B. 360) wird die Abweichung im Kreis gemessen: 359 und 1 liegen
//   dann 2 auseinander, nicht 358.

export const TYPEN = ['mc', 'freitext', 'zahl'];

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

/** Ob eine MC-Frage mehrere richtige Optionen haben kann (F-40). */
export function istMehrfach(frage) {
  return frage.typ === 'mc' && Array.isArray(frage.richtig);
}

/** Nummern der richtigen Optionen einer MC-Frage, aufsteigend. */
export function richtigeOptionen(frage) {
  return (Array.isArray(frage.richtig) ? [...frage.richtig] : [frage.richtig]).sort((a, b) => a - b);
}

/**
 * Bewertet eine MC-Antwort.
 * @param {{richtig: number | number[]}} frage
 * @param {number | Iterable<number> | null | undefined} gewaehlt Nummer der gewählten Option im
 *   Modul (nicht die Anzeigeposition); bei Mehrfachauswahl die Menge der gewählten Nummern
 */
export function bewerteMc(frage, gewaehlt) {
  if (!Array.isArray(frage.richtig)) return gewaehlt === frage.richtig;
  if (gewaehlt == null) return false;
  const wahl = new Set(typeof gewaehlt === 'number' ? [gewaehlt] : gewaehlt);
  return wahl.size === frage.richtig.length && frage.richtig.every((i) => wahl.has(i));
}

/**
 * Ob die Kernpunkte einer Freitextfrage als geprüft gelten (F-39): die Wahl des Lernenden
 * aus dem gespeicherten Prüfstatus (M7), sonst der Wert aus dem Modul.
 * @param {{id: string, kernpunkteStatus?: string}} frage
 * @param {{fragen: Object<string, {geprueft: boolean}>} | null} [pruefstatus]
 */
export function kernpunkteGeprueft(frage, pruefstatus) {
  const eintrag = pruefstatus?.fragen?.[frage.id];
  return eintrag ? eintrag.geprueft : frage.kernpunkteStatus === 'geprueft';
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
 * @returns {'amtlich' | 'verband' | 'buch' | 'eigen' | ''}
 */
export function herkunftVon(frage, modul) {
  return frage.herkunft ?? modul?.meta?.herkunft ?? '';
}

// --- Zahleneingabe (F-09) ---------------------------------------------------

/**
 * Liest eine getippte Zahl. Komma oder Punkt als Dezimaltrennzeichen, optional mit
 * Vorzeichen; eine angehängte Einheit (die der Frage oder „°“) wird ignoriert.
 * @param {string} eingabe
 * @param {string} [einheit]
 * @returns {number | null} null, wenn keine Zahl erkennbar ist
 */
export function leseZahl(eingabe, einheit = '') {
  if (typeof eingabe !== 'string') return null;
  let text = eingabe.trim().replace(/\u2212/g, '-'); // typografisches Minus
  const einheiten = [einheit, '°'].filter((e) => typeof e === 'string' && e.trim() !== '');
  for (const e of einheiten) {
    if (text.toLowerCase().endsWith(e.trim().toLowerCase())) text = text.slice(0, -e.trim().length).trim();
  }
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const zahl = Number(text.replace(',', '.'));
  return Number.isFinite(zahl) ? zahl : null;
}

/**
 * Abweichung einer Zahl von der Lösung; mit "kreis" die kürzere Strecke im Kreis.
 * @param {{loesung: number, kreis?: number}} frage
 */
export function abweichung(frage, zahl) {
  const diff = Math.abs(zahl - frage.loesung);
  if (!frage.kreis) return diff;
  const rest = diff % frage.kreis;
  return Math.min(rest, frage.kreis - rest);
}

/**
 * Bewertet eine Zahlenantwort.
 * @param {{loesung: number, toleranz: number, einheit?: string, kreis?: number}} frage
 * @param {string} eingabe getippter Text
 * @returns {{richtig: boolean, zahl: number | null, abweichung: number | null}}
 */
export function bewerteZahl(frage, eingabe) {
  const zahl = leseZahl(eingabe, frage.einheit);
  if (zahl === null) return { richtig: false, zahl: null, abweichung: null };
  const a = abweichung(frage, zahl);
  // Kleiner Zuschlag gegen Rundungsfehler der Gleitkommazahlen (z. B. 0,1 + 0,2).
  return { richtig: a <= frage.toleranz + 1e-9, zahl, abweichung: a };
}
