// Lädt die Oberflächentexte aus src/i18n/<sprache>.json und merkt sich die gewählte Sprache.
// Ohne gemerkte Wahl richtet sich die Sprache nach dem Browser; ist sie dort weder Deutsch
// noch Englisch, gilt Deutsch. Die Wahl ist eine Einstellung dieses Browsers (localStorage),
// kein Teil des Lernstands und der Sicherung.

export const SPRACHEN = ['de', 'en'];
const STANDARD = 'de';
const SPRACHE_SCHLUESSEL = 'trainer-engine.sprache';

let texte = {};
let aktuelleSprache = STANDARD;

export function waehleSprache(gewuenscht) {
  return SPRACHEN.includes(gewuenscht) ? gewuenscht : STANDARD;
}

/**
 * Erste unterstützte Sprache aus der Liste des Browsers (z. B. ["en-GB", "de"] → "en").
 * @param {readonly string[]} [liste] navigator.languages; für Tests austauschbar
 */
export function spracheAusBrowser(liste = globalThis.navigator?.languages ?? []) {
  for (const eintrag of liste) {
    const kurz = String(eintrag).toLowerCase().split('-')[0];
    if (SPRACHEN.includes(kurz)) return kurz;
  }
  return STANDARD;
}

/** Gemerkte Sprache, sonst die des Browsers. */
export function bevorzugteSprache(speicher = globalThis.localStorage) {
  try {
    const gemerkt = speicher?.getItem(SPRACHE_SCHLUESSEL);
    if (SPRACHEN.includes(gemerkt)) return gemerkt;
  } catch {
    // Ohne localStorage (z. B. privates Fenster) gilt die Sprache des Browsers.
  }
  return spracheAusBrowser();
}

/** Merkt die gewählte Sprache in diesem Browser. */
export function merkeSprache(sprache, speicher = globalThis.localStorage) {
  try {
    speicher?.setItem(SPRACHE_SCHLUESSEL, waehleSprache(sprache));
  } catch {
    // Ohne localStorage gilt die Wahl nur bis zum Schließen.
  }
}

export function sprache() {
  return aktuelleSprache;
}

export async function ladeTexte(gewuenscht = STANDARD, holen = globalThis.fetch) {
  const neu = waehleSprache(gewuenscht);
  const antwort = await holen(new URL(`../i18n/${neu}.json`, import.meta.url));
  texte = await antwort.json();
  aktuelleSprache = neu;
  if (globalThis.document) document.documentElement.lang = neu;
  return neu;
}

/** Ersetzt {name} in einem Text durch Werte aus `werte`. */
export function fuelle(text, werte = {}) {
  return text.replace(/\{(\w+)\}/g, (ganz, name) => (name in werte ? String(werte[name]) : ganz));
}

export function t(schluessel, werte) {
  const text = texte[schluessel];
  return text === undefined ? schluessel : fuelle(text, werte);
}

/**
 * Text mit Einzahl oder Mehrzahl: nimmt „<schluessel>.eins“ für 1, sonst „<schluessel>.mehr“.
 * Die Zahl steht im Text als {anzahl} zur Verfügung.
 */
export function tn(schluessel, anzahl, werte = {}) {
  return t(`${schluessel}.${anzahl === 1 ? 'eins' : 'mehr'}`, { anzahl, ...werte });
}

/** Datum „JJJJ-MM-TT“ in der Schreibweise der Sprache: 14.11.2026 bzw. 14/11/2026. */
export function datumstext(datum) {
  const [jahr, monat, tag] = datum.split('-');
  return aktuelleSprache === 'de' ? `${tag}.${monat}.${jahr}` : `${tag}/${monat}/${jahr}`;
}
