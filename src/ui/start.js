// Startbildschirm: Lernstand mit „Runde starten“, das geladene Inhaltsmodul
// und das Laden einer Moduldatei.

import { t, tn, datumstext, SPRACHEN } from './i18n.js';
import { el } from './dom.js';
import { faecherleiste } from './runde.js';
import { hinweistext, levelbalken, fortschrittszahlen, tageszielwahl } from './fortschritt.js';
import { modulUebersicht } from '../engine/m1-kern.js';

/** Ort eines Formatfehlers in Klartext, z. B. „Zeile 12 · Frage 3 (sks-nav-003)“. */
function ortstext(f) {
  const teile = [];
  if (f.zeile) teile.push(t('fehler.zeile', { zeile: f.zeile }));
  const ort = f.ort ?? {};
  if (ort.art === 'meta') teile.push(t('fehler.ortMeta'));
  if (ort.art === 'thema') teile.push(t(ort.id ? 'fehler.ortThemaId' : 'fehler.ortThema', ort));
  if (ort.art === 'frage') teile.push(t(ort.id ? 'fehler.ortFrageId' : 'fehler.ortFrage', ort));
  if (ort.art === 'rang') teile.push(t('fehler.ortRang', ort));
  return teile.join(' · ');
}

const MAX_FEHLER = 20;

export function fehlertext(fehler) {
  const details = fehler.details ?? {};
  const kopf = fehler.code === 'modul.keinJson' ? 'modul.keinJsonKopf' : (fehler.code ?? 'modul.nichtErreichbar');
  const zeilen = [t(kopf, { meldung: details.meldung ?? fehler.message })];
  const liste = details.fehler ?? [];
  for (const f of liste.slice(0, MAX_FEHLER)) {
    if (typeof f === 'string') { zeilen.push('• ' + t(f)); continue; }
    const ort = ortstext(f);
    zeilen.push('• ' + (ort ? `${ort}: ` : '') + t(f.code, f.werte));
  }
  if (liste.length > MAX_FEHLER) zeilen.push(t('fehler.weitere', { anzahl: liste.length - MAX_FEHLER }));
  return zeilen.join('\n');
}

/**
 * @param {HTMLElement} ziel
 * @param {{modul?: object, fehler?: Error, dateiname?: string,
 *          lernen?: {faellig: number, neu: number, spaeter: number, faecher: number[]},
 *          fortschritt?: object, hinweis?: {code: string, werte: object}, onTagesziel?: (wert: number) => void,
 *          speicherung?: {fehler?: string, dauerhaft?: string, verworfen?: number},
 *          onDatei: (file: File) => void, onStandard: () => void,
 *          onRunde: () => void, onVorziehen: () => void, onStatistik?: () => void,
 *          thema?: string|null, onThema?: (id: string|null) => void, anderswoFaellig?: number,
 *          einstellungen?: object}} zustand
 *   thema: gewähltes Thema (F-06), null = alle; anderswoFaellig: fällige Fragen in den übrigen Themen;
 *   einstellungen: Sprache und Datensicherung, siehe einstellungskarte()
 */
export function zeigeStart(ziel, zustand) {
  const inhalt = [];
  const lernen = zustand.modul ? zustand.lernen : null;

  if (lernen) inhalt.push(lernkarte(lernen, zustand));
  if (lernen && zustand.fortschritt) inhalt.push(fortschrittskarte(zustand));

  if (zustand.modul) {
    const u = modulUebersicht(zustand.modul);
    const liste = el('dl', { class: 'kennzahlen' },
      el('dt', {}, t('start.themen')), el('dd', {}, String(u.themen)),
      el('dt', {}, t('start.fragen')), el('dd', {}, String(u.fragen)),
    );
    if (u.stand) liste.append(el('dt', {}, t('start.stand')), el('dd', {}, u.stand));
    if (u.herkunft) liste.append(el('dt', {}, t('start.herkunft')), el('dd', {}, u.herkunft));

    // Fragenzahl je Thema, damit sich der Import mit dem Original abgleichen lässt.
    const themenliste = el('ul', { class: 'themen' });
    for (const thema of zustand.modul.themen) {
      const anzahl = zustand.modul.fragen.filter((f) => f.thema === thema.id).length;
      themenliste.append(el('li', {}, el('span', {}, thema.titel), el('span', { class: 'zahl' }, String(anzahl))));
    }

    const karte = el('section', { class: 'karte' },
      el('p', { class: 'etikett' }, t('start.modul')),
      el('h2', {}, u.titel),
      liste,
      themenliste,
    );
    if (zustand.dateiname) karte.append(el('p', { class: 'hinweis' }, t('start.dateiGeladen', { name: zustand.dateiname })));
    inhalt.push(karte);
  }

  if (zustand.fehler) {
    inhalt.push(el('section', { class: 'karte fehler', role: 'alert' }, fehlertext(zustand.fehler)));
  }

  if (zustand.einstellungen) inhalt.push(einstellungskarte(zustand.einstellungen));

  const eingabe = el('input', {
    type: 'file', accept: '.json,application/json', id: 'moduldatei', class: 'versteckt',
    onchange: (e) => { const datei = e.target.files?.[0]; if (datei) zustand.onDatei(datei); },
  });
  const aktionen = el('div', { class: 'aktionen' },
    eingabe,
    el('label', { for: 'moduldatei', class: lernen ? 'knopf zweitrangig' : 'knopf' }, t('start.dateiLaden')),
  );
  if (zustand.dateiname || zustand.fehler) {
    aktionen.append(el('button', { type: 'button', class: 'knopf zweitrangig', onclick: zustand.onStandard }, t('start.standardLaden')));
  }

  ziel.replaceChildren(el('div', { class: 'inhalt' }, ...inhalt), aktionen);
}

/** Lernstand auf einen Blick: fällig, neu, Fächer – mit den Knöpfen zum Lernen ganz oben. */
function lernkarte(lernen, zustand) {
  const liste = el('dl', { class: 'kennzahlen' },
    el('dt', {}, t('lernen.faellig')), el('dd', {}, String(lernen.faellig)),
    el('dt', {}, t('lernen.neu')), el('dd', {}, String(lernen.neu)),
  );
  const knoepfe = el('div', { class: 'aktionen lernknoepfe' });
  if (lernen.faellig + lernen.neu > 0) {
    knoepfe.append(el('button', { type: 'button', class: 'knopf', onclick: zustand.onRunde }, t('lernen.rundeStarten')));
  }
  if (lernen.spaeter > 0) {
    knoepfe.append(el('button', { type: 'button', class: 'knopf zweitrangig', onclick: zustand.onVorziehen }, t('lernen.vorziehen')));
  }
  if (zustand.onStatistik) {
    knoepfe.append(el('button', { type: 'button', class: 'knopf zweitrangig', onclick: zustand.onStatistik }, t('lernen.statistik')));
  }
  // Lernerinnerung beim Start: Tagesziel und Streak (statt Benachrichtigungen).
  const erinnerung = zustand.hinweis
    ? el('p', { class: `erinnerung${zustand.fortschritt?.streak.heuteErreicht ? ' erreicht' : ''}`, role: 'status' },
      hinweistext(zustand.hinweis))
    : null;
  return el('section', { class: 'karte' },
    el('p', { class: 'etikett' }, t('lernen.titel')),
    erinnerung,
    zustand.onThema ? themenwahl(zustand.modul.themen, zustand.thema ?? null, zustand.onThema) : null,
    el('h2', {}, lernen.faellig + lernen.neu > 0 ? t('lernen.bereit') : t('lernen.allesErledigt')),
    liste,
    faecherleiste(lernen.faecher),
    zustand.thema && zustand.anderswoFaellig > 0
      ? el('p', { class: 'hinweis' }, tn('lernen.anderswoFaellig', zustand.anderswoFaellig))
      : null,
    knoepfe.childElementCount > 0 ? knoepfe : null,
    ...speicherhinweise(zustand.speicherung ?? {}),
  );
}

/** Auswahl des Themas für die nächste Runde (F-06): alle Themen oder eines. */
function themenwahl(themen, gewaehlt, onThema) {
  const auswahl = el('select', {
    id: 'themenwahl', class: 'auswahl',
    onchange: (e) => onThema(e.target.value === '' ? null : e.target.value),
  }, el('option', { value: '', selected: gewaehlt == null }, t('lernen.alleThemen')));
  for (const thema of themen) {
    auswahl.append(el('option', { value: thema.id, selected: thema.id === gewaehlt }, thema.titel));
  }
  return el('div', { class: 'themenwahl' }, el('label', { for: 'themenwahl' }, t('lernen.thema')), auswahl);
}

/** XP, Level mit Rang, Streak und Tagesziel (F-13, F-14, F-36). */
function fortschrittskarte(zustand) {
  const f = zustand.fortschritt;
  return el('section', { class: 'karte' },
    el('p', { class: 'etikett' }, t('fortschritt.titel')),
    levelbalken(f.level, f.rang),
    fortschrittszahlen(f),
    zustand.onTagesziel ? tageszielwahl(f.streak.ziel, zustand.onTagesziel) : null,
  );
}

/** Hinweise zur Speicherung, nur wenn etwas zu beachten ist. */
function speicherhinweise({ fehler, dauerhaft, verworfen }) {
  const hinweise = [];
  if (fehler) hinweise.push(el('p', { class: 'hinweis warnung', role: 'status' }, t(fehler)));
  else if (dauerhaft === 'nichtDauerhaft') hinweise.push(el('p', { class: 'hinweis' }, t('speicher.nichtDauerhaft')));
  if (verworfen > 0) hinweise.push(el('p', { class: 'hinweis warnung' }, t('speicher.verworfen', { anzahl: verworfen })));
  return hinweise;
}

/**
 * Sprache und Datensicherung (F-22).
 * @param {{sprache: string, onSprache: (sprache: string) => void,
 *          sicherung: {verfuegbar: boolean, letzte?: string|null, meldung?: {art: 'ok'|'fehler', text: string}|null},
 *          onExport: () => void, onImport: (datei: File) => void}} e
 */
function einstellungskarte(e) {
  const sprachwahl = el('select', {
    id: 'sprachwahl', class: 'auswahl',
    onchange: (ereignis) => e.onSprache(ereignis.target.value),
  });
  for (const sprache of SPRACHEN) {
    sprachwahl.append(el('option', { value: sprache, selected: sprache === e.sprache, lang: sprache }, t(`sprache.${sprache}`)));
  }

  const { verfuegbar, letzte, meldung } = e.sicherung;
  const teile = [
    el('p', { class: 'etikett' }, t('einstellungen.titel')),
    el('div', { class: 'themenwahl' }, el('label', { for: 'sprachwahl' }, t('einstellungen.sprache')), sprachwahl),
    el('h2', {}, t('sicherung.titel')),
    el('p', { class: 'hinweis oben' }, t('sicherung.erklaerung')),
  ];
  if (verfuegbar) {
    const eingabe = el('input', {
      type: 'file', accept: '.json,application/json', id: 'sicherungsdatei', class: 'versteckt',
      onchange: (ereignis) => {
        const datei = ereignis.target.files?.[0];
        ereignis.target.value = '';
        if (datei) e.onImport(datei);
      },
    });
    teile.push(el('div', { class: 'aktionen sicherung' },
      el('button', { type: 'button', class: 'knopf zweitrangig', onclick: e.onExport }, t('sicherung.exportieren')),
      eingabe,
      el('label', { for: 'sicherungsdatei', class: 'knopf zweitrangig' }, t('sicherung.importieren')),
    ));
    teile.push(el('p', { class: 'hinweis' },
      letzte ? t('sicherung.letzte', { datum: datumstext(letzte) }) : t('sicherung.nochKeine')));
  } else {
    teile.push(el('p', { class: 'hinweis warnung' }, t('sicherung.nichtVerfuegbar')));
  }
  if (meldung) {
    teile.push(el('p', {
      class: `hinweis meldung${meldung.art === 'fehler' ? ' warnung' : ' erfolg'}`,
      role: meldung.art === 'fehler' ? 'alert' : 'status',
    }, meldung.text));
  }
  return el('section', { class: 'karte' }, ...teile);
}
