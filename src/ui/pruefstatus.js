// Prüfstatus der Kernpunkte (F-39): Knopf unter der Checkliste, um die Kernpunkte einer
// Freitextfrage als geprüft zu markieren oder das zurückzunehmen. Gespeichert wird in M7.

import { t } from './i18n.js';
import { el } from './dom.js';

/**
 * Zeile mit Status und Knopf.
 * @param {{geprueft: boolean, onUmschalten: ((geprueft: boolean) => void) | null}} optionen
 *   onUmschalten null: nur den Status zeigen (z. B. ohne Speicher im Browser)
 */
export function pruefstatusZeile({ geprueft, onUmschalten }) {
  if (geprueft) {
    return el('div', { class: 'pruefstatus geprueft' },
      el('p', { class: 'hinweis erfolg' }, t('pruefstatus.istGeprueft')),
      onUmschalten
        ? el('button', { type: 'button', class: 'textknopf', id: 'pruefstatusknopf', onclick: () => onUmschalten(false) },
          t('pruefstatus.zuruecknehmen'))
        : null);
  }
  return el('div', { class: 'pruefstatus' },
    el('p', { class: 'hinweis' }, t('freitext.ungeprueft')),
    onUmschalten ? el('p', { class: 'hinweis' }, t('pruefstatus.anleitung')) : null,
    onUmschalten
      ? el('button', { type: 'button', class: 'knopf zweitrangig klein', id: 'pruefstatusknopf', onclick: () => onUmschalten(true) },
        t('pruefstatus.markieren'))
      : null);
}
