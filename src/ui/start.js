// Startbildschirm: zeigt das geladene Inhaltsmodul und erlaubt das Laden einer Moduldatei.

import { t } from './i18n.js';
import { modulUebersicht } from '../engine/m1-kern.js';

function el(tag, attribute = {}, ...kinder) {
  const knoten = document.createElement(tag);
  for (const [name, wert] of Object.entries(attribute)) {
    if (name === 'onclick' || name === 'onchange') knoten.addEventListener(name.slice(2), wert);
    else knoten.setAttribute(name, wert);
  }
  for (const kind of kinder) knoten.append(kind);
  return knoten;
}

export function fehlertext(fehler) {
  const details = fehler.details ?? {};
  const zeilen = [t(fehler.code ?? 'modul.nichtErreichbar', { meldung: details.meldung ?? fehler.message })];
  for (const code of details.fehler ?? []) zeilen.push('• ' + t(code));
  return zeilen.join('\n');
}

/**
 * @param {HTMLElement} ziel
 * @param {{modul?: object, fehler?: Error, dateiname?: string,
 *          onDatei: (file: File) => void, onStandard: () => void}} zustand
 */
export function zeigeStart(ziel, zustand) {
  const inhalt = [];

  if (zustand.modul) {
    const u = modulUebersicht(zustand.modul);
    const liste = el('dl', { class: 'kennzahlen' },
      el('dt', {}, t('start.themen')), el('dd', {}, String(u.themen)),
      el('dt', {}, t('start.fragen')), el('dd', {}, String(u.fragen)),
    );
    if (u.stand) liste.append(el('dt', {}, t('start.stand')), el('dd', {}, u.stand));
    if (u.herkunft) liste.append(el('dt', {}, t('start.herkunft')), el('dd', {}, u.herkunft));

    const karte = el('section', { class: 'karte' },
      el('p', { class: 'etikett' }, t('start.modul')),
      el('h2', {}, u.titel),
      liste,
    );
    if (zustand.dateiname) karte.append(el('p', { class: 'hinweis' }, t('start.dateiGeladen', { name: zustand.dateiname })));
    inhalt.push(karte);
  }

  if (zustand.fehler) {
    inhalt.push(el('section', { class: 'karte fehler', role: 'alert' }, fehlertext(zustand.fehler)));
  }

  const eingabe = el('input', {
    type: 'file', accept: '.json,application/json', id: 'moduldatei', class: 'versteckt',
    onchange: (e) => { const datei = e.target.files?.[0]; if (datei) zustand.onDatei(datei); },
  });
  const aktionen = el('div', { class: 'aktionen' },
    eingabe,
    el('label', { for: 'moduldatei', class: 'knopf' }, t('start.dateiLaden')),
  );
  if (zustand.dateiname || zustand.fehler) {
    aktionen.append(el('button', { type: 'button', class: 'knopf zweitrangig', onclick: zustand.onStandard }, t('start.standardLaden')));
  }

  ziel.replaceChildren(el('div', { class: 'inhalt' }, ...inhalt), aktionen);
}
