// Lädt die Oberflächentexte aus src/i18n/<sprache>.json.
// Die Umschaltung im Menü folgt in AP8; hier nur Laden und Ersetzen von Platzhaltern.

export const SPRACHEN = ['de', 'en'];
const STANDARD = 'de';

let texte = {};
let aktuelleSprache = STANDARD;

export function waehleSprache(gewuenscht) {
  return SPRACHEN.includes(gewuenscht) ? gewuenscht : STANDARD;
}

export async function ladeTexte(sprache = STANDARD, holen = globalThis.fetch) {
  aktuelleSprache = waehleSprache(sprache);
  const antwort = await holen(new URL(`../i18n/${aktuelleSprache}.json`, import.meta.url));
  texte = await antwort.json();
  document.documentElement.lang = aktuelleSprache;
  return aktuelleSprache;
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
