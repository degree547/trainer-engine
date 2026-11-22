// Gemeinsame Anzeige für Multiple Choice (F-08) und Mehrfachauswahl (F-40):
// Lösung in Auflösung, Simulation und Schwächenliste.

import { t } from './i18n.js';
import { el } from './dom.js';
import { istMehrfach, richtigeOptionen } from '../engine/m3-fragetypen.js';

/** Texte der Optionen mit den angegebenen Nummern, in der Reihenfolge des Moduls. */
export function optionstexte(frage, nummern) {
  return [...nummern].sort((a, b) => a - b).map((i) => frage.optionen[i]);
}

/** Etikett und Text der richtigen Antwort; bei Mehrfachauswahl alle richtigen als Liste. */
export function mcLoesung(frage) {
  const texte = optionstexte(frage, richtigeOptionen(frage));
  if (!istMehrfach(frage)) {
    return [el('p', { class: 'etikett' }, t('runde.richtigeAntwort')), el('p', { class: 'antworttext' }, texte[0])];
  }
  return [
    el('p', { class: 'etikett' }, t('runde.richtigeAntworten')),
    el('ul', { class: 'antwortliste' }, ...texte.map((text) => el('li', { class: 'antworttext' }, text))),
  ];
}

/** Hinweis über den Optionen einer Mehrfachauswahl. */
export function mehrfachHinweis(frage) {
  return istMehrfach(frage) ? el('p', { class: 'hinweis oben', id: 'mehrfachhinweis' }, t('mc.mehrfachHinweis')) : null;
}
