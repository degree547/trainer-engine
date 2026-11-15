// M6 Prüfungssimulation (F-20): Prüfbogen zusammenstellen, Zeit messen, auswerten.
// Das Modul kennt keine Prüfungsinhalte und keine Prüfungsordnung. Fragenzahl je Thema,
// Zeitlimit, Punkte je Frage und Bestehensgrenze stehen im Inhaltsmodul unter "pruefung"
// (geprüft von M8).
//
// Regeln:
// - Je Thema werden so viele Fragen zufällig gezogen, wie das Modul verlangt. Die Themen
//   folgen der Reihenfolge im Modul, innerhalb eines Themas die Reihenfolge des Katalogs.
// - Eine richtige Antwort bringt die Punkte je Frage, eine falsche oder fehlende 0 Punkte.
//   Multiple Choice wird automatisch bewertet, Freitext nach Abgabe selbst
//   („Gewusst“ = volle Punkte); eine leere Freitext-Antwort zählt als nicht gewusst.
// - Bestanden ist die Simulation ab "bestehenAb" Punkten.
// - Die Simulation ändert weder Leitner-Fächer noch XP oder Tagesziel. Das entscheidet
//   die App, M6 selbst speichert nichts.

/**
 * Regeln der Prüfungssimulation aus dem Modul, mit Themen-Titeln und Summen.
 * @param {object} modul geprüftes Inhaltsmodul
 * @returns {null | {
 *   verteilung: {thema: string, titel: string, anzahl: number}[],
 *   fragen: number, minuten: number, punkteJeFrage: number, maxPunkte: number,
 *   bestehenAb: number, hinweis: string,
 * }} null, wenn das Modul keine Prüfungssimulation vorsieht
 */
export function pruefungsregeln(modul) {
  const p = modul?.pruefung;
  if (!p || typeof p !== 'object') return null;
  const titel = new Map((modul.themen ?? []).map((thema) => [thema.id, thema.titel]));
  // Reihenfolge der Themen wie im Modul, nicht wie in "pruefung.fragen".
  const verteilung = (modul.themen ?? [])
    .filter((thema) => Number.isInteger(p.fragen?.[thema.id]) && p.fragen[thema.id] > 0)
    .map((thema) => ({ thema: thema.id, titel: titel.get(thema.id), anzahl: p.fragen[thema.id] }));
  const fragen = verteilung.reduce((summe, v) => summe + v.anzahl, 0);
  const punkteJeFrage = p.punkteJeFrage ?? 1;
  return {
    verteilung,
    fragen,
    minuten: p.minuten,
    punkteJeFrage,
    maxPunkte: fragen * punkteJeFrage,
    bestehenAb: p.bestehenAb,
    hinweis: typeof p.hinweis === 'string' ? p.hinweis : '',
  };
}

/**
 * Stellt einen Prüfbogen zusammen.
 * @param {object} modul
 * @param {() => number} [zufall] liefert Zahlen in [0, 1); austauschbar für Tests
 * @returns {object[]} Fragen des Bogens
 */
export function bildePruefbogen(modul, zufall = Math.random) {
  const regeln = pruefungsregeln(modul);
  if (!regeln) return [];
  const bogen = [];
  for (const { thema, anzahl } of regeln.verteilung) {
    const kandidaten = modul.fragen.map((frage, index) => ({ frage, index })).filter((e) => e.frage.thema === thema);
    // Teilweises Fisher-Yates: die ersten `anzahl` Plätze zufällig besetzen.
    const n = Math.min(anzahl, kandidaten.length);
    for (let i = 0; i < n; i += 1) {
      const j = i + Math.floor(zufall() * (kandidaten.length - i));
      [kandidaten[i], kandidaten[j]] = [kandidaten[j], kandidaten[i]];
    }
    bogen.push(...kandidaten.slice(0, n).sort((a, b) => a.index - b.index).map((e) => e.frage));
  }
  return bogen;
}

/** Zeitpunkt (Millisekunden), an dem die Bearbeitungszeit endet. */
export function endeUm(startMs, minuten) {
  return startMs + minuten * 60_000;
}

/** Verbleibende Zeit in Millisekunden, nie unter 0. */
export function restzeit(endeMs, jetztMs) {
  return Math.max(endeMs - jetztMs, 0);
}

/**
 * Zeit als Uhr: „89:59“, ab einer Stunde „1:05:09“. Angefangene Sekunden zählen voll,
 * damit „0:00“ erst erscheint, wenn die Zeit wirklich um ist.
 */
export function zeittext(ms) {
  const sekundenGesamt = Math.ceil(Math.max(ms, 0) / 1000);
  const stunden = Math.floor(sekundenGesamt / 3600);
  const minuten = Math.floor((sekundenGesamt % 3600) / 60);
  const sekunden = sekundenGesamt % 60;
  const zwei = (z) => String(z).padStart(2, '0');
  return stunden > 0 ? `${stunden}:${zwei(minuten)}:${zwei(sekunden)}` : `${minuten}:${zwei(sekunden)}`;
}

/**
 * Wertet einen Prüfbogen aus.
 * @param {object} modul
 * @param {object[]} bogen Fragen aus bildePruefbogen
 * @param {Map<string, boolean>} bewertungen Frage-ID → richtig; fehlt eine Frage, zählt sie als falsch
 * @returns {{
 *   punkte: number, maxPunkte: number, bestehenAb: number, bestanden: boolean,
 *   richtig: number, gesamt: number,
 *   themen: {id: string, titel: string, gesamt: number, richtig: number, punkte: number, maxPunkte: number}[],
 *   fehler: object[],
 * }}
 */
export function werteAus(modul, bogen, bewertungen) {
  const regeln = pruefungsregeln(modul);
  const punkteJeFrage = regeln?.punkteJeFrage ?? 1;
  const themen = new Map();
  for (const thema of modul.themen) {
    if (bogen.some((frage) => frage.thema === thema.id)) {
      themen.set(thema.id, { id: thema.id, titel: thema.titel, gesamt: 0, richtig: 0, punkte: 0, maxPunkte: 0 });
    }
  }
  const fehler = [];
  let richtig = 0;
  for (const frage of bogen) {
    const zeile = themen.get(frage.thema);
    const ok = bewertungen.get(frage.id) === true;
    zeile.gesamt += 1;
    zeile.maxPunkte += punkteJeFrage;
    if (ok) {
      richtig += 1;
      zeile.richtig += 1;
      zeile.punkte += punkteJeFrage;
    } else {
      fehler.push(frage);
    }
  }
  const punkte = richtig * punkteJeFrage;
  const maxPunkte = bogen.length * punkteJeFrage;
  const bestehenAb = regeln?.bestehenAb ?? maxPunkte;
  return {
    punkte, maxPunkte, bestehenAb, bestanden: punkte >= bestehenAb,
    richtig, gesamt: bogen.length,
    themen: [...themen.values()],
    fehler,
  };
}
