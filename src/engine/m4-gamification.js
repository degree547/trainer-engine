// M4 Gamification: XP, Level, Tages-Streak und Tagesziel (F-12 bis F-15).
// Das Modul kennt keine Prüfungsinhalte und keine Frage-IDs. Es zählt nur Antworten
// und Runden. Das Profil gilt für die ganze App, nicht je Inhaltsmodul.
//
// Profil (wird von M7 gespeichert):
//   { version: 1,
//     geraet: "<ID dieses Geräts>",
//     tagesziel: { wert: 1..5, geaendert: <Millisekunden seit 1970> },
//     geraete: { "<geraete-id>": { "JJJJ-MM-TT": { xp, runden, ziel } } } }
//
// Gezählt wird je Gerät und Tag. Jedes Gerät schreibt nur in seinen eigenen Eintrag.
// Beim Zusammenführen zweier Profile (Import in AP8) gilt je Gerät und Tag der größere
// Wert. So wird nichts doppelt gezählt, auch wenn dieselbe Datei zweimal importiert wird,
// und nichts geht verloren, wenn auf zwei Geräten am selben Tag gelernt wurde.
// "ziel" ist das Tagesziel zum Zeitpunkt des Eintrags; so bleibt ein früher erreichter
// Tag erreicht, auch wenn das Tagesziel später erhöht wird.
//
// Regeln:
// - XP_RICHTIG je richtiger Antwort, XP_RICHTIG_FEHLER im Durchlauf „Fehler wiederholen“
//   (die Antwort war gerade erst zu sehen).
// - Eine Runde zählt für das Tagesziel, wenn sie zu Ende gespielt wurde und keine
//   Fehler-Wiederholung ist. Ist sie dazu fehlerfrei, gibt es XP_BONUS (F-12).
// - Streak: Tage in Folge mit erreichtem Tagesziel. Ist das Ziel heute noch offen,
//   zählt der Streak bis gestern weiter (F-13).
// - Level: Level 2 ab 100 XP; jedes weitere Level braucht 50 XP mehr als das vorige (F-14).

import { plusTage } from './m2-lernlogik.js';

export const PROFIL_VERSION = 1;
export const XP_RICHTIG = 10;
export const XP_RICHTIG_FEHLER = 5;
export const XP_BONUS = 20;
export const TAGESZIEL_STANDARD = 1;
export const TAGESZIEL_MAX = 5;
export const LEVEL_ERSTES = 100;
export const LEVEL_ZUWACHS = 50;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function pruefeDatum(heute) {
  if (!DATUM.test(heute)) throw new Error(`Ungültiges Datum: ${heute}`);
}

/** Zufällige Kennung für dieses Gerät (bleibt im gespeicherten Profil). */
export function neueGeraeteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function neuesProfil(geraet = neueGeraeteId()) {
  return {
    version: PROFIL_VERSION,
    geraet,
    tagesziel: { wert: TAGESZIEL_STANDARD, geaendert: 0 },
    geraete: {},
  };
}

/** Ändert den Tageseintrag dieses Geräts und liefert ein neues Profil. */
function aendereTag(profil, heute, aenderung) {
  pruefeDatum(heute);
  const eigene = profil.geraete[profil.geraet] ?? {};
  const alt = eigene[heute] ?? { xp: 0, runden: 0 };
  const neu = { ...alt, ...aenderung(alt), ziel: profil.tagesziel.wert };
  return {
    ...profil,
    geraete: { ...profil.geraete, [profil.geraet]: { ...eigene, [heute]: neu } },
  };
}

/**
 * XP für eine Antwort (F-12).
 * @param {{richtig: boolean, modus: 'normal'|'vorziehen'|'fehler'}} antwort
 * @returns {{profil: object, xp: number}}
 */
export function vergibAntwort(profil, { richtig, modus }, heute) {
  const xp = richtig ? (modus === 'fehler' ? XP_RICHTIG_FEHLER : XP_RICHTIG) : 0;
  if (xp === 0) return { profil, xp };
  return { profil: aendereTag(profil, heute, (alt) => ({ xp: alt.xp + xp })), xp };
}

/**
 * Schließt eine Runde ab: zählt sie für das Tagesziel und vergibt den Bonus (F-12, F-13).
 * @param {{modus: string, beantwortet: number, gesamt: number, fehler: number}} runde
 * @returns {{profil: object, zaehlt: boolean, bonus: number}}
 */
export function schliesseRundeAb(profil, { modus, beantwortet, gesamt, fehler }, heute) {
  const zaehlt = modus !== 'fehler' && gesamt > 0 && beantwortet >= gesamt;
  if (!zaehlt) return { profil, zaehlt, bonus: 0 };
  const bonus = fehler === 0 ? XP_BONUS : 0;
  return {
    profil: aendereTag(profil, heute, (alt) => ({ xp: alt.xp + bonus, runden: alt.runden + 1 })),
    zaehlt,
    bonus,
  };
}

/** Setzt das Tagesziel (1 bis TAGESZIEL_MAX Runden). Der heutige Eintrag übernimmt es. */
export function setzeTagesziel(profil, wert, heute, jetzt = Date.now()) {
  const ziel = Math.min(Math.max(Math.round(Number(wert)) || TAGESZIEL_STANDARD, 1), TAGESZIEL_MAX);
  const neu = { ...profil, tagesziel: { wert: ziel, geaendert: jetzt } };
  return neu.geraete[neu.geraet]?.[heute] ? aendereTag(neu, heute, () => ({})) : neu;
}

/** Werte je Tag über alle Geräte: XP und Runden addiert, Ziel = kleinstes Ziel des Tages. */
export function tagesWerte(profil) {
  const tage = new Map();
  for (const eintraege of Object.values(profil.geraete)) {
    for (const [datum, e] of Object.entries(eintraege)) {
      const summe = tage.get(datum) ?? { xp: 0, runden: 0, ziel: Infinity };
      summe.xp += e.xp;
      summe.runden += e.runden;
      summe.ziel = Math.min(summe.ziel, e.ziel ?? TAGESZIEL_STANDARD);
      tage.set(datum, summe);
    }
  }
  return tage;
}

export function gesamtXp(profil) {
  let summe = 0;
  for (const e of tagesWerte(profil).values()) summe += e.xp;
  return summe;
}

/** XP, ab denen ein Level beginnt (Level 1 bei 0). */
export function levelStart(level) {
  const n = level - 1;
  return LEVEL_ERSTES * n + (LEVEL_ZUWACHS * n * (n - 1)) / 2;
}

/**
 * Level zu einer XP-Zahl (F-14).
 * @returns {{level: number, imLevel: number, fuerNaechstes: number, anteil: number}}
 *   imLevel: XP seit Beginn des Levels, fuerNaechstes: XP, die das Level insgesamt umfasst
 */
export function levelVon(xp) {
  let level = 1;
  while (levelStart(level + 1) <= xp) level += 1;
  const start = levelStart(level);
  const fuerNaechstes = levelStart(level + 1) - start;
  const imLevel = xp - start;
  return { level, imLevel, fuerNaechstes, anteil: imLevel / fuerNaechstes };
}

/**
 * Tagesziel und Streak (F-13).
 * @returns {{tage: number, heuteErreicht: boolean, heuteRunden: number, ziel: number, gelernt: boolean}}
 *   gelernt: ob es überhaupt schon einen Lerntag gibt
 */
export function streakVon(profil, heute) {
  pruefeDatum(heute);
  const tage = tagesWerte(profil);
  const ziel = profil.tagesziel.wert;
  const heuteRunden = tage.get(heute)?.runden ?? 0;
  const heuteErreicht = heuteRunden >= ziel;
  const erreicht = (datum) => {
    const e = tage.get(datum);
    return e != null && e.runden > 0 && e.runden >= e.ziel;
  };
  let anzahl = heuteErreicht ? 1 : 0;
  let datum = plusTage(heute, -1);
  while (erreicht(datum)) {
    anzahl += 1;
    datum = plusTage(datum, -1);
  }
  return { tage: anzahl, heuteErreicht, heuteRunden, ziel, gelernt: tage.size > 0 };
}

/**
 * Hinweis für den App-Start (Lernerinnerung ohne Benachrichtigung).
 * @returns {{code: string, werte: object}} Textschlüssel ohne Endung .eins/.mehr und Werte
 */
export function startHinweis(profil, heute) {
  const s = streakVon(profil, heute);
  const offen = Math.max(s.ziel - s.heuteRunden, 0);
  if (s.heuteErreicht) return { code: 'hinweis.zielErreicht', werte: { tage: s.tage } };
  if (s.tage > 0) return { code: 'hinweis.streakEndet', werte: { tage: s.tage, offen } };
  if (s.heuteRunden > 0) return { code: 'hinweis.nochOffen', werte: { offen } };
  if (s.gelernt) return { code: 'hinweis.neuerStreak', werte: { offen } };
  return { code: 'hinweis.ersteRunde', werte: { offen } };
}

/** Kennzahlen für Startseite und Rundenende. */
export function fortschritt(profil, heute) {
  const xp = gesamtXp(profil);
  return { xp, level: levelVon(xp), streak: streakVon(profil, heute) };
}

// --- Prüfen und Zusammenführen (für M7 und den Import in AP8) -------------

function istGanzeZahl(wert) {
  return Number.isInteger(wert) && wert >= 0;
}

function istGueltigerTag(e) {
  return e != null && typeof e === 'object' && istGanzeZahl(e.xp) && istGanzeZahl(e.runden)
    && (e.ziel === undefined || (Number.isInteger(e.ziel) && e.ziel >= 1 && e.ziel <= TAGESZIEL_MAX));
}

/** Fehler, wenn ein Profil aus einer neueren App-Version stammt. */
export class ProfilFehler extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/**
 * Prüft ein geladenes Profil. Ungültige Tageseinträge werden verworfen und gezählt.
 * @returns {{profil: object, verworfen: number}} ohne Daten ein neues Profil
 * @throws {ProfilFehler} 'speicher.profilUnlesbar' oder 'speicher.neuereVersion'
 */
export function pruefeProfil(daten) {
  if (daten == null) return { profil: neuesProfil(), verworfen: 0 };
  if (typeof daten !== 'object' || typeof daten.geraete !== 'object' || daten.geraete === null
    || typeof daten.geraet !== 'string' || daten.geraet === '') {
    throw new ProfilFehler('speicher.profilUnlesbar');
  }
  if ((daten.version ?? 1) > PROFIL_VERSION) throw new ProfilFehler('speicher.neuereVersion');

  const z = daten.tagesziel;
  const tagesziel = z && Number.isInteger(z.wert) && z.wert >= 1 && z.wert <= TAGESZIEL_MAX
    ? { wert: z.wert, geaendert: Number.isFinite(z.geaendert) ? z.geaendert : 0 }
    : { wert: TAGESZIEL_STANDARD, geaendert: 0 };

  const geraete = {};
  let verworfen = 0;
  for (const [id, eintraege] of Object.entries(daten.geraete)) {
    if (eintraege == null || typeof eintraege !== 'object') { verworfen += 1; continue; }
    geraete[id] = {};
    for (const [datum, e] of Object.entries(eintraege)) {
      if (DATUM.test(datum) && istGueltigerTag(e)) geraete[id][datum] = { ...e };
      else verworfen += 1;
    }
  }
  return { profil: { version: PROFIL_VERSION, geraet: daten.geraet, tagesziel, geraete }, verworfen };
}

/**
 * Führt zwei Profile zusammen. Die Geräte-ID kommt aus `a` (dem eigenen Gerät),
 * das Tagesziel aus dem jüngeren Stand, je Gerät und Tag gilt der größere Wert.
 */
export function fuehreProfileZusammen(a, b) {
  const geraete = {};
  for (const quelle of [a.geraete, b.geraete]) {
    for (const [id, eintraege] of Object.entries(quelle)) {
      const ziel = (geraete[id] ??= {});
      for (const [datum, e] of Object.entries(eintraege)) {
        const alt = ziel[datum];
        ziel[datum] = alt
          ? {
            xp: Math.max(alt.xp, e.xp),
            runden: Math.max(alt.runden, e.runden),
            ziel: e.runden > alt.runden ? e.ziel : alt.ziel,
          }
          : { ...e };
      }
    }
  }
  const tagesziel = b.tagesziel.geaendert > a.tagesziel.geaendert ? { ...b.tagesziel } : { ...a.tagesziel };
  return { version: PROFIL_VERSION, geraet: a.geraet, tagesziel, geraete };
}
