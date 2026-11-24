// Sichern am Ende einer Runde (F-41): ein Tipp speichert die Sicherungsdatei, auf dem Smartphone
// über das Teilen-Menü, sonst als Download. Was genau passiert, regelt app.js.

import { t } from './i18n.js';
import { el } from './dom.js';

/**
 * Karte mit Knopf „Fortschritt sichern“ und Rückmeldung.
 * @param {() => Promise<{art: 'ok'|'fehler'|'abgebrochen', text?: string}>} onSichern
 */
export function sicherungskarte(onSichern) {
  const meldung = el('p', { class: 'hinweis meldung', id: 'sicherungsmeldung', role: 'status' });
  const knopf = el('button', {
    type: 'button', class: 'knopf', id: 'sichernknopf',
    onclick: async () => {
      knopf.disabled = true;
      meldung.textContent = '';
      meldung.className = 'hinweis meldung';
      let ergebnis;
      try {
        ergebnis = await onSichern();
      } catch {
        ergebnis = { art: 'fehler', text: t('sicherung.exportFehler') };
      }
      knopf.disabled = false;
      if (ergebnis.art === 'abgebrochen') return; // Teilen-Menü geschlossen: kein Fehler
      meldung.className = `hinweis meldung ${ergebnis.art === 'fehler' ? 'warnung' : 'erfolg'}`;
      meldung.setAttribute('role', ergebnis.art === 'fehler' ? 'alert' : 'status');
      meldung.textContent = ergebnis.text;
      if (ergebnis.art === 'ok') knopf.textContent = t('sicherung.nochmalSichern');
    },
  }, t('sicherung.sichern'));
  return el('section', { class: 'karte sicherungrunde' },
    el('p', { class: 'etikett' }, t('sicherung.titel')),
    el('p', { class: 'hinweis oben' }, t('sicherung.nachRunde')),
    el('div', { class: 'aktionen' }, knopf),
    meldung);
}
