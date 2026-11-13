// Rundenbildschirm: Frage → Auflösung mit Erklärung (F-07) → Selbstbewertung.
// Übergangslösung bis AP4: statt Antwort tippen und Kernpunkte abhaken gibt es
// die Knöpfe „Gewusst“ und „Nicht gewusst“.

import { t } from './i18n.js';
import { el } from './dom.js';

/**
 * @param {HTMLElement} ziel
 * @param {{
 *   fragen: object[],
 *   modus: 'normal' | 'vorziehen' | 'fehler',
 *   themenTitel: Map<string, string>,
 *   onBewertung: (frage: object, richtig: boolean, uebung: boolean) => void,
 *   holeFaecher: () => number[],
 *   onFertig: () => void,
 * }} runde
 */
export function zeigeRunde(ziel, runde) {
  const uebung = runde.modus !== 'normal';
  const ergebnisse = [];
  let nr = 0;
  let aufgedeckt = false;

  function bewerteUndWeiter(richtig) {
    const frage = runde.fragen[nr];
    runde.onBewertung(frage, richtig, uebung);
    ergebnisse.push({ frage, richtig });
    nr += 1;
    aufgedeckt = false;
    if (nr < runde.fragen.length) zeichneFrage();
    else zeichneAuswertung();
  }

  function zeichneFrage() {
    const frage = runde.fragen[nr];
    const kopf = el('div', { class: 'rundenkopf' },
      el('p', { class: 'etikett' },
        t(`runde.titel.${runde.modus}`), ' · ',
        t('runde.fortschritt', { nr: nr + 1, gesamt: runde.fragen.length })),
      el('button', { type: 'button', class: 'textknopf', onclick: zeichneAuswertung }, t('runde.beenden')),
    );
    const balken = el('div', {
      class: 'balken', role: 'progressbar', 'aria-valuemin': '0',
      'aria-valuemax': String(runde.fragen.length), 'aria-valuenow': String(nr),
    }, el('span', { style: `width: ${(nr / runde.fragen.length) * 100}%` }));

    const karte = el('section', { class: 'karte frage' },
      el('p', { class: 'etikett' }, runde.themenTitel.get(frage.thema) ?? frage.thema),
      el('h2', { class: 'fragetext' }, frage.frage),
      frage.hinweis ? el('p', { class: 'hinweis' }, frage.hinweis) : null,
      frage.typ === 'mc' ? optionenliste(frage) : null,
    );

    const inhalt = [kopf, balken, karte];
    if (aufgedeckt) inhalt.push(aufloesung(frage));
    if (uebung && nr === 0 && !aufgedeckt) inhalt.push(el('p', { class: 'hinweis' }, t('runde.uebungHinweis')));

    const aktionen = el('div', { class: 'aktionen' });
    if (!aufgedeckt) {
      aktionen.append(el('button', {
        type: 'button', class: 'knopf',
        onclick: () => { aufgedeckt = true; zeichneFrage(); },
      }, t('runde.aufloesen')));
    } else {
      aktionen.classList.add('nebeneinander');
      aktionen.append(
        el('button', { type: 'button', class: 'knopf falsch', onclick: () => bewerteUndWeiter(false) }, t('runde.nichtGewusst')),
        el('button', { type: 'button', class: 'knopf richtig', onclick: () => bewerteUndWeiter(true) }, t('runde.gewusst')),
      );
    }
    ziel.replaceChildren(el('div', { class: 'inhalt' }, ...inhalt), aktionen);
    if (aufgedeckt) ziel.querySelector('.aufloesung')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }

  function optionenliste(frage) {
    return el('ol', { class: 'optionen', type: 'A' }, ...frage.optionen.map((text, i) =>
      el('li', { class: aufgedeckt && i === frage.richtig ? 'korrekt' : null }, text)));
  }

  function aufloesung(frage) {
    const teile = [];
    if (frage.typ === 'mc') {
      teile.push(el('p', { class: 'etikett' }, t('runde.richtigeAntwort')),
        el('p', { class: 'antworttext' }, frage.optionen[frage.richtig]));
    } else {
      teile.push(el('p', { class: 'etikett' }, t('runde.musterantwort')),
        el('p', { class: 'antworttext' }, frage.musterantwort));
    }
    if (frage.erklaerung) {
      teile.push(el('p', { class: 'etikett' }, t('runde.erklaerung')), el('p', { class: 'antworttext' }, frage.erklaerung));
    }
    if (frage.quelle) teile.push(el('p', { class: 'quelle' }, frage.quelle));
    return el('section', { class: 'karte aufloesung', 'aria-live': 'polite' }, ...teile);
  }

  function zeichneAuswertung() {
    const gewusst = ergebnisse.filter((e) => e.richtig).length;
    const fehler = ergebnisse.filter((e) => !e.richtig).map((e) => e.frage);
    const faecher = runde.holeFaecher();

    const karte = el('section', { class: 'karte' },
      el('p', { class: 'etikett' }, t(`runde.titel.${runde.modus}`)),
      el('h2', {}, ergebnisse.length === 0 ? t('auswertung.keineAntwort')
        : t('auswertung.gewusst', { gewusst, gesamt: ergebnisse.length })),
      fehler.length === 0 && ergebnisse.length > 0 ? el('p', {}, t('auswertung.ohneFehler')) : null,
      uebung && ergebnisse.length > 0 ? el('p', { class: 'hinweis' }, t('runde.uebungHinweis')) : null,
      faecherleiste(faecher),
    );

    const aktionen = el('div', { class: 'aktionen' });
    if (fehler.length > 0) {
      aktionen.append(el('button', {
        type: 'button', class: 'knopf',
        onclick: () => zeigeRunde(ziel, { ...runde, fragen: fehler, modus: 'fehler' }),
      }, t('auswertung.fehlerWiederholen', { anzahl: fehler.length })));
    }
    aktionen.append(el('button', {
      type: 'button', class: fehler.length > 0 ? 'knopf zweitrangig' : 'knopf', onclick: runde.onFertig,
    }, t('auswertung.zurStartseite')));

    ziel.replaceChildren(el('div', { class: 'inhalt' }, karte), aktionen);
    window.scrollTo(0, 0);
  }

  if (runde.fragen.length === 0) zeichneAuswertung();
  else zeichneFrage();
}

/** Anzahl der Fragen in Fach 1 bis 5 als Leiste. */
export function faecherleiste(faecher) {
  return el('div', { class: 'faecher' },
    el('p', { class: 'etikett' }, t('lernen.faecher')),
    el('ol', {}, ...faecher.map((anzahl, i) =>
      el('li', { 'aria-label': t('lernen.fachLabel', { fach: i + 1, anzahl }) },
        el('span', { class: 'fachnr' }, String(i + 1)),
        el('span', { class: 'zahl' }, String(anzahl))))),
  );
}
