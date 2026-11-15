// Bausteine für Zahlenfragen (F-09), genutzt von Runde und Prüfungssimulation.
// Getippt wird nur die Zahl, die Einheit steht fest neben dem Feld. Die Regeln (Komma oder
// Punkt, Toleranz, Kreis) stehen in M3.

import { t, zahltext } from './i18n.js';
import { el } from './dom.js';
import { bewerteZahl, istLeer } from '../engine/m3-fragetypen.js';

/** Zahl mit Einheit, z. B. „12,5 sm“ oder „45°“. */
export function mitEinheit(zahl, einheit) {
  if (!einheit) return zahltext(zahl);
  return einheit === '°' ? `${zahltext(zahl)}°` : `${zahltext(zahl)} ${einheit}`;
}

/**
 * Eingabefeld für eine Zahl.
 * @param {{frage: object, wert: string, ungueltig?: boolean, enterkeyhint?: string,
 *   onInput: (text: string) => void, onEnter: (text: string) => void}} o
 */
export function zahlfeld({ frage, wert, ungueltig = false, enterkeyhint = 'send', onInput, onEnter }) {
  const feld = el('input', {
    id: 'antwort', class: 'zahlfeld', type: 'text', inputmode: 'decimal',
    autocomplete: 'off', spellcheck: 'false', enterkeyhint,
    placeholder: t('zahl.platzhalter'), 'aria-invalid': ungueltig ? 'true' : 'false',
    'aria-describedby': ungueltig ? 'zahlhinweis' : null,
    onkeydown: (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      onEnter(e.target.value);
    },
    oninput: (e) => onInput(e.target.value),
  });
  feld.value = wert;
  return el('div', { class: 'eingabe' },
    el('label', { for: 'antwort', class: 'etikett' }, t('zahl.eingabeLabel')),
    el('div', { class: 'zahlzeile' },
      feld,
      frage.einheit ? el('span', { class: 'einheit', 'aria-hidden': 'true' }, frage.einheit) : null),
    ungueltig ? el('p', { class: 'hinweis warnung', id: 'zahlhinweis', role: 'alert' }, t('zahl.ungueltig')) : null);
}

/** Ob ein Text eine Zahl ist, die M3 lesen kann (leere Eingabe zählt nicht als ungültig). */
export function zahlUngueltig(frage, text) {
  return !istLeer(text) && bewerteZahl(frage, text).zahl === null;
}

/** Eigene Antwort und Lösung, als Teile einer Karte. */
export function zahlAufloesung(frage, text) {
  const e = bewerteZahl(frage, text ?? '');
  const teile = [
    el('p', { class: `urteil ${e.richtig ? 'ok' : 'nein'}` }, t(e.richtig ? 'zahl.richtig' : 'zahl.falsch')),
    el('p', { class: 'etikett' }, t('zahl.deineAntwort')),
    e.zahl === null
      ? el('p', { class: 'antworttext leise' }, t('zahl.keineAntwort'))
      : el('p', { class: 'antworttext' }, mitEinheit(e.zahl, frage.einheit)),
    ...zahlLoesung(frage),
  ];
  if (e.zahl !== null && !e.richtig) {
    teile.push(el('p', { class: 'hinweis oben' }, t('zahl.abweichung', { abweichung: mitEinheit(e.abweichung, frage.einheit) })));
  }
  return teile;
}

/** Lösung mit Einheit und erlaubter Abweichung. */
export function zahlLoesung(frage) {
  return [
    el('p', { class: 'etikett' }, t('zahl.loesung')),
    el('p', { class: 'antworttext loesungszahl' }, mitEinheit(frage.loesung, frage.einheit)),
    el('p', { class: 'hinweis oben' }, frage.toleranz === 0
      ? t('zahl.toleranzGenau')
      : t('zahl.toleranz', { toleranz: mitEinheit(frage.toleranz, frage.einheit) })),
  ];
}
