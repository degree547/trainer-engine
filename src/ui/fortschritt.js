// Anzeigen für XP, Level, Rang, Streak und Tagesziel (M4), gemeinsam für Startseite und Rundenende.

import { t, tn } from './i18n.js';
import { el } from './dom.js';
import { TAGESZIEL_MAX } from '../engine/m4-gamification.js';

/** Text zum Hinweis aus M4 (startHinweis), mit Einzahl oder Mehrzahl. */
export function hinweistext({ code, werte }) {
  const anzahl = code === 'hinweis.zielErreicht' ? werte.tage : werte.offen;
  return tn(code, anzahl, werte);
}

/**
 * Bild eines Rangs (F-36). Ohne Bild oder wenn es sich nicht laden lässt: Platzhalter
 * mit dem Anfangsbuchstaben des Rangs.
 */
export function rangbild(rang, gross = false) {
  const klasse = `rangbild${gross ? ' gross' : ''}`;
  const platzhalter = () => el('span', { class: `${klasse} platzhalter`, 'aria-hidden': 'true' },
    rang.name.trim().charAt(0).toUpperCase());
  if (!rang.bild) return platzhalter();
  const bild = el('img', { class: klasse, src: rang.bild, alt: '', width: gross ? '64' : '40', height: gross ? '64' : '40' });
  bild.addEventListener('error', () => bild.replaceWith(platzhalter()), { once: true });
  return bild;
}

/** Rang mit Bild und Namen, darunter der nächste Rang (F-36). */
function rangzeile(rang) {
  return el('div', { class: 'rang' },
    rangbild(rang),
    el('p', {},
      el('span', { class: 'etikett' }, t('rang.titel')),
      el('strong', { class: 'rangname' }, rang.name),
      rang.naechster
        ? el('span', { class: 'leise' }, t('rang.naechster', { rang: rang.naechster.name, level: rang.naechster.ab }))
        : el('span', { class: 'leise' }, t('rang.hoechster'))));
}

/** Hervorgehobener Hinweis am Rundenende, wenn ein neuer Rang erreicht ist (F-36). */
export function rangaufstieg(rang) {
  return el('div', { class: 'rangaufstieg', role: 'status' },
    rangbild(rang, true),
    el('p', {},
      el('span', { class: 'etikett' }, t('rang.aufstieg')),
      el('strong', { class: 'rangname' }, rang.name)));
}

/** Level mit Fortschrittsbalken (F-14), davor der Rang, wenn das Modul Ränge hat (F-36). */
export function levelbalken(level, rang = null) {
  const rest = level.fuerNaechstes - level.imLevel;
  return el('div', { class: 'level' },
    rang ? rangzeile(rang) : null,
    el('p', { class: 'levelzeile' },
      el('strong', {}, t('fortschritt.level', { level: level.level })),
      el('span', { class: 'leise' }, t('fortschritt.bisLevel', { rest, naechstes: level.level + 1 }))),
    el('div', {
      class: 'balken levelbalken', role: 'progressbar',
      'aria-label': t('fortschritt.level', { level: level.level }),
      'aria-valuemin': '0', 'aria-valuemax': String(level.fuerNaechstes), 'aria-valuenow': String(level.imLevel),
    }, el('span', { style: `width: ${Math.round(level.anteil * 100)}%` })),
  );
}

/** Streak, heutige Runden und XP gesamt als Kennzahlen (F-13, F-15). */
export function fortschrittszahlen(f) {
  const s = f.streak;
  return el('dl', { class: 'kennzahlen' },
    el('dt', {}, t('fortschritt.streak')),
    el('dd', {}, tn('fortschritt.tage', s.tage), s.heuteErreicht ? el('span', { class: 'erreicht' }, ' ✓') : null),
    el('dt', {}, t('fortschritt.heute')),
    el('dd', {}, tn('fortschritt.runden', s.ziel, { runden: s.heuteRunden, ziel: s.ziel })),
    el('dt', {}, t('fortschritt.xp')), el('dd', {}, String(f.xp)),
  );
}

/** Auswahl des Tagesziels (F-13): 1 bis TAGESZIEL_MAX Runden am Tag. */
export function tageszielwahl(ziel, onAendern) {
  const auswahl = el('select', {
    id: 'tagesziel', class: 'auswahl',
    onchange: (e) => onAendern(Number(e.target.value)),
  });
  for (let n = 1; n <= TAGESZIEL_MAX; n += 1) {
    auswahl.append(el('option', { value: String(n), selected: n === ziel }, tn('fortschritt.zielOption', n)));
  }
  return el('div', { class: 'zielwahl' },
    el('label', { for: 'tagesziel' }, t('fortschritt.tagesziel')),
    auswahl);
}
