// Statistikbildschirm: Fortschritt je Thema (F-17) und Schwächenliste (F-18).
// Ein Tipp auf eine Frage der Schwächenliste klappt die richtige Antwort auf.

import { t, tn } from './i18n.js';
import { el } from './dom.js';
import { MIN_VERSUCHE } from '../engine/m5-statistik.js';

const prozent = (anteil) => Math.round(anteil * 100);

/**
 * @param {HTMLElement} ziel
 * @param {{
 *   modul: object,
 *   fortschritt: {themen: object[], gesamt: object},  // aus fortschrittJeThema (M5)
 *   schwaechen: object[],                              // aus schwaechenliste (M5)
 *   onZurueck: () => void,
 *   onThema?: (id: string) => void,                   // Thema wählen und zur Startseite (F-06)
 * }} statistik
 */
export function zeigeStatistik(ziel, statistik) {
  const kopf = el('div', { class: 'rundenkopf' },
    el('p', { class: 'etikett' }, t('statistik.titel')),
    el('button', { type: 'button', class: 'textknopf', onclick: statistik.onZurueck }, t('statistik.zurueck')),
  );
  const aktionen = el('div', { class: 'aktionen' },
    el('button', { type: 'button', class: 'knopf', onclick: statistik.onZurueck }, t('auswertung.zurStartseite')));

  ziel.replaceChildren(
    el('div', { class: 'inhalt' }, kopf, themenkarte(statistik.fortschritt, statistik.onThema), schwaechenkarte(statistik)),
    aktionen,
  );
  window.scrollTo(0, 0);
}

/** Fortschritt je Thema mit Balken: sicher (Fach 4–5) und in Arbeit (Fach 1–3). */
function themenkarte({ themen, gesamt }, onThema) {
  const liste = el('ul', { class: 'themenfortschritt', role: 'list' });
  for (const thema of themen) liste.append(themenzeile(thema.titel, thema, onThema ? () => onThema(thema.id) : null));
  return el('section', { class: 'karte' },
    el('p', { class: 'etikett' }, t('statistik.fortschritt')),
    el('h2', {}, t('statistik.gesamtSicher', { prozent: prozent(gesamt.anteil) })),
    el('p', { class: 'hinweis oben' }, t('statistik.sicherErklaerung')),
    liste,
  );
}

function themenzeile(titel, z, onLernen) {
  const anteilLernend = z.gesamt > 0 ? z.lernend / z.gesamt : 0;
  return el('li', {},
    el('p', { class: 'themenzeile' },
      el('span', {}, titel),
      el('strong', { class: 'zahl' }, `${prozent(z.anteil)} %`)),
    el('div', {
      class: 'balken themenbalken', role: 'progressbar',
      'aria-label': t('statistik.balkenLabel', { thema: titel, prozent: prozent(z.anteil) }),
      'aria-valuemin': '0', 'aria-valuemax': String(z.gesamt), 'aria-valuenow': String(z.sicher),
    },
    el('span', { class: 'sicher', style: `width: ${z.anteil * 100}%` }),
    el('span', { class: 'lernend', style: `width: ${anteilLernend * 100}%` })),
    el('p', { class: 'leise themenzahlen' },
      t('statistik.zahlen', { sicher: z.sicher, lernend: z.lernend, neu: z.neu, gesamt: z.gesamt })),
    onLernen && z.gesamt > 0
      ? el('button', { type: 'button', class: 'textknopf', onclick: onLernen }, t('statistik.themaLernen'))
      : null,
  );
}

/** Schwächenliste: Fragen mit der höchsten Fehlerquote, aufklappbar mit der richtigen Antwort. */
function schwaechenkarte({ modul, schwaechen }) {
  const themenTitel = new Map(modul.themen.map((thema) => [thema.id, thema.titel]));
  const karte = el('section', { class: 'karte' },
    el('p', { class: 'etikett' }, t('statistik.schwaechen')),
    el('p', { class: 'hinweis oben' }, t('statistik.schwaechenErklaerung', { min: MIN_VERSUCHE })),
  );
  if (schwaechen.length === 0) {
    karte.append(el('p', { class: 'leer' }, t('statistik.keineSchwaechen', { min: MIN_VERSUCHE })));
  } else {
    const liste = el('ol', { class: 'schwaechen', role: 'list' });
    for (const e of schwaechen) liste.append(schwaechenzeile(e, themenTitel));
    karte.append(liste);
  }
  karte.append(el('p', { class: 'hinweis' }, t('statistik.zaehlungSeit')));
  return karte;
}

function schwaechenzeile(e, themenTitel) {
  const { frage } = e;
  const antwort = frage.typ === 'mc'
    ? [el('p', { class: 'etikett' }, t('runde.richtigeAntwort')), el('p', { class: 'antworttext' }, frage.optionen[frage.richtig])]
    : [el('p', { class: 'etikett' }, t('runde.musterantwort')), el('p', { class: 'antworttext' }, frage.musterantwort)];
  return el('li', {},
    el('details', {},
      el('summary', {},
        el('span', { class: 'quote' }, `${prozent(e.quote)} %`),
        el('span', { class: 'schwaechetext' },
          el('span', { class: 'fragekurz' }, frage.frage),
          el('span', { class: 'leise' },
            tn('statistik.falschVon', e.falsch, { versuche: e.versuche }), ' · ',
            themenTitel.get(frage.thema) ?? frage.thema, ' · ',
            t('statistik.fach', { fach: e.fach })))),
      el('div', { class: 'schwaecheantwort' },
        el('p', { class: 'fragetext' }, frage.frage),
        ...antwort,
        frage.quelle ? el('p', { class: 'quelle' }, t('runde.quelle'), ' ', frage.quelle) : null)));
}
