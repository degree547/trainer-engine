// Anzeigen für XP, Level, Streak und Tagesziel (M4), gemeinsam für Startseite und Rundenende.

import { t, tn } from './i18n.js';
import { el } from './dom.js';
import { TAGESZIEL_MAX } from '../engine/m4-gamification.js';

/** Text zum Hinweis aus M4 (startHinweis), mit Einzahl oder Mehrzahl. */
export function hinweistext({ code, werte }) {
  const anzahl = code === 'hinweis.zielErreicht' ? werte.tage : werte.offen;
  return tn(code, anzahl, werte);
}

/** Level mit Fortschrittsbalken (F-14). */
export function levelbalken(level) {
  const rest = level.fuerNaechstes - level.imLevel;
  return el('div', { class: 'level' },
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
